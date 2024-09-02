import { GameState } from "../../engine/engine";
import {
  AbsolutePosition,
  AspectSize,
  UIButtonParams,
  UIContainerParams,
} from "../../engine/ui";
import { renderTextureFrag } from "../../shaders/postProcessingShaders";
import { State, StateMachine } from "../../utils/stateMachine";
import * as THREE from "three";

class Command {
  constructor() {
    this.type = Object.getPrototypeOf(this).constructor;
  }
}

class UpdateColorCommand extends Command {
  constructor(color) {
    super();
    this.color = color;
  }
}

class DragCommand extends Command {
  constructor(start, end) {
    super();
    this.start = start;
    this.end = end;
  }
}
class DragInputState extends State {
  constructor(start) {
    super();
    this.start = start;
  }
  update(engine, game, input) {
    const state = engine.input.getState();
    const { mouse } = state;
    const { pos } = mouse;
    if (!this.start.equals(pos)) {
      game.commands.push(new DragCommand(this.start, pos));
      input.replaceState(new DragInputState(pos));
    }

    if (mouse.released) {
      input.replaceState(new OpenInputState());
    }
  }
}

class OpenInputState extends State {
  update(engine, game, input) {
    const state = engine.input.getState();
    const { mouse } = state;
    if (mouse.pressed) {
      input.replaceState(new DragInputState(mouse.pos));
    }
  }
}

class InputManager extends StateMachine {
  constructor(game) {
    super();
    this.ui = game.ui;
    this.buttons = [];
    this.pushState(new OpenInputState());
  }

  createColorButton(color) {
    this.buttons.push(
      this.ui.compose([
        new UIContainerParams({
          id: "my-id",
          position: new AbsolutePosition({
            centerX: 0.1,
            centerY: this.buttons.length * 0.2 + 0.1,
          }),
          size: new AspectSize({ width: 0.1, aspectRatio: 1 }),
          style: { "background-color": color },
        }),
        new UIButtonParams({
          command: new UpdateColorCommand(color),
        }),
      ])
    );
  }

  init(engine, game) {
    this.createColorButton("#ff0000");
    this.createColorButton("#00ff00");
    this.createColorButton("#0000ff");
    this.createColorButton("#ffffff");
  }

  update(engine, game) {
    this.currentState()?.update(engine, game, this);
  }
}

const colorFragShader = `
uniform sampler2D tTarget;

uniform vec2 start;
uniform vec2 end;

uniform vec3 color;

uniform float radius;
uniform float totalWidth;

varying vec2 vUv;
out vec4 outColor;

float sdfDist(vec2 p, vec2 texelSize) {
    float xPixelCount = float(textureSize(tTarget,0).x);
    float distancePerPixel = totalWidth / xPixelCount;

    vec2 toStart = p - start;
    vec2 line = end - start;
    float lineLengthSquared = dot(line, line);
    float t = clamp(dot(toStart, line) / lineLengthSquared, 0., 1.);
    vec2 closest = distancePerPixel * texelSize * (toStart - line * t);
    return dot(closest, closest);
}

void main()
{ 
    vec2 texelSize = 1. / fwidth(vUv);
    float dist = sdfDist(vUv, texelSize);
    float inRange = step(radius,dist);

    vec4 current =  texture2D(tTarget,vUv);

    outColor = inRange * current + (1. - inRange) * vec4(color, 1.);
}
  `;

const setToConstant = `
  uniform vec4 constant;
  out vec4 outColor;
  void main() {  outColor = constant; }`;

const rayMarch = `
#define M_PI 3.1415926538
#define TAU 6.283185307179586

uniform sampler2D tColor;
uniform sampler2D tSdf;
uniform sampler2D tDistanceField;

uniform int rayCount;
uniform int maxSteps;

varying vec2 vUv;
out vec4 outColor;

float rand(vec2 co)
{
    return fract(sin(dot(co.xy ,vec2(12.9898,78.233))) * 43758.5453);
}

bool outOfBounds(vec2 uv) {
  return uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0;
}


float stepSize(vec2 uv, float minStep) {
  return max(minStep, texture2D(tSdf, uv).x);
}

vec4 raymarch() {
  ivec2 texSize = textureSize(tSdf, 0);
  float minStep = min(1. / float(texSize.x), 1. / float(texSize.y));
  vec4 light = texture2D(tColor, vUv);

  if (light.a > 0.1) {
    return light;
  }
    float oneOverRayCount = 1.0 / float(rayCount);
float tauOverRayCount = TAU * oneOverRayCount;

float noise = rand(vUv);
vec4 radiance = vec4(0.0);

for (int i = 0; i < rayCount; i++) {
  float angle = tauOverRayCount * (float(i) + noise);
  vec2 rayDirectionUv =  vec2(cos(angle), -sin(angle));

  vec2 sampleUv = vUv + stepSize(vUv, minStep) * rayDirectionUv;

  for (int step = 0; step < maxSteps; step++) {
    if (outOfBounds(sampleUv)) {
      break;
    }
      float stepVal = stepSize(sampleUv, minStep);
    vec4 sampleLight = texture2D(tColor, sampleUv);
    if (sampleLight.a > 0.1) {
      radiance += sampleLight;
      break;
    }
    sampleUv += stepVal * rayDirectionUv;
  }
} 

return radiance * oneOverRayCount;

}

void main() {
  outColor = raymarch();
}
`;

const initUv = `
uniform sampler2D tColor;
varying vec2 vUv;

out vec4 outColor;

void main() {
  vec4 color = texture2D(tColor, vUv);

  if (color.a > 0.1) {
    outColor = vec4(vUv, 0., 1.);
  } else {
    outColor = vec4(0.,0.,0.,0.); 
  }
}
`;

const jumpFlood = `
uniform sampler2D tDistanceField;

uniform float stepSize;
varying vec2 vUv;
out vec4 outColor;

bool outOfBounds(vec2 uv) {
  return uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0;
}

void main() {
  vec4 nearestSeed = vec4(-2.0);
  float nearestDist = 999999.9;
  vec2 jumpSize = fwidth(vUv) * stepSize;
  for (int x = -1; x <= 1; x++) {
    for (int y = -1; y <= 1; y++) {
      vec2 sampleUv = vUv + vec2(float(x), float(y)) * jumpSize;
      if (outOfBounds(sampleUv)) {
        continue;
      }
      vec4 distanceField = texture2D(tDistanceField, sampleUv);
      if (distanceField.a < 0.1) {
        continue;
      }
      
      vec2 diff = vUv - distanceField.xy;
      float dist = dot(diff,diff);
      if (dist < nearestDist) {
        nearestDist = dist;
        nearestSeed = distanceField;
      }
    }
  }

  if (nearestDist < 10000.) {
    outColor = nearestSeed;
  } else {
    outColor = vec4(0.);
  }
}
`;

const fillSdf = `
  uniform sampler2D tDistanceField; 
  varying vec2 vUv;
  out vec4 outColor;
  void main() {  
    vec2 closestUv = texture2D(tDistanceField, vUv).xy;
    float dist = length(vUv - closestUv);
  outColor = vec4(dist, 0., 0., 0.); 
  }`;

export class RadianceCascade extends GameState {
  init(engine) {
    super.init(engine);
    this.input = new InputManager(this);
    this.input.init(engine, this);
    this.color = "#dddddd";
    this.pixelRadius = 0.1;
    this.rayCount = 16;
    this.maxSteps = 16;
    this.colorRT = engine.renderer.newRenderTarget(1, {});
    this.spareRT = engine.renderer.newRenderTarget(1, {});

    this.distanceFieldRT = engine.renderer.newRenderTarget(1, {});
    this.spareDistanceFieldRT = engine.renderer.newRenderTarget(1, {});

    const sdfRTConfig = {
      type: THREE.FloatType,
      format: THREE.RedFormat,
    };
    this.sdfRT = engine.renderer.newRenderTarget(1, sdfRTConfig);
  }

  applyDrag(engine, [start, end]) {
    engine.renderer.applyPostProcess(
      {
        start: start,
        end: end,
        color: new THREE.Color(this.color),
        radius: this.pixelRadius * this.pixelRadius,
        totalWidth: 4,
        tTarget: this.colorRT,
      },
      colorFragShader,
      this.spareRT
    );
    [this.colorRT, this.spareRT] = [this.spareRT, this.colorRT];

    engine.renderer.applyPostProcess(
      {
        tColor: this.colorRT,
      },
      initUv,
      this.distanceFieldRT
    );

    [this.distanceFieldRT, this.spareDistanceFieldRT] = [
      this.spareDistanceFieldRT,
      this.distanceFieldRT,
    ];

    const maxDim = Math.max(
      this.distanceFieldRT.width,
      this.distanceFieldRT.height
    );

    console.log(maxDim);

    let resolution = 4 * Math.ceil(Math.log2(maxDim));

    while (resolution >= 0) {
      engine.renderer.applyPostProcess(
        {
          tDistanceField: this.spareDistanceFieldRT,
          stepSize: 2 << resolution,
        },
        jumpFlood,
        this.distanceFieldRT
      );

      [this.distanceFieldRT, this.spareDistanceFieldRT] = [
        this.spareDistanceFieldRT,
        this.distanceFieldRT,
      ];
      resolution--;
    }

    engine.renderer.applyPostProcess(
      {
        tDistanceField: this.distanceFieldRT,
      },
      fillSdf,
      this.sdfRT
    );
  }

  update(engine) {
    super.update(engine);
    this.commands.forEach((command) => {
      switch (command.type) {
        case UpdateColorCommand:
          this.color = command.color;
          break;
        case DragCommand:
          const startCopy = command.start
            .clone()
            .addScalar(1)
            .multiplyScalar(0.5);
          const endCopy = command.end.clone().addScalar(1).multiplyScalar(0.5);
          this.applyDrag(engine, [startCopy, endCopy]);
          break;
        default:
          break;
      }
    });
    // check if the color changes
    // find a line if one exists
    // if a line exists, use it to update the canvas
    //
  }

  render(renderer) {
    renderer.applyPostProcess(
      { tInput: this.distanceFieldRT },
      renderTextureFrag,
      null
    );
    renderer.applyPostProcess(
      {
        tColor: this.colorRT,
        tSdf: this.sdfRT,
        tDistanceField: this.distanceFieldRT,
        rayCount: this.rayCount,
        maxSteps: this.maxSteps,
      },
      rayMarch,
      null
    );
  }
}
