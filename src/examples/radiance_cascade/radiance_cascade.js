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
      const { pos } = mouse;
      if (pos) {
        game.commands.push(new DragCommand(pos, pos));
      }
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

const renderCascade = `
#define M_PI 3.1415926538
#define TAU 6.283185307179586
#define EPS 0.001

uniform sampler2D tColor;
uniform sampler2D tSdf;
uniform sampler2D tCascadeZero;

// the ray count at cascadeDepth = 0;
uniform int sqrtBaseRayCount;
uniform int baseRayCount;

varying vec2 vUv;

out vec4 outColor;

vec2 uvOffset(int index) {
  float xOffset = floor(mod(float(index), float(sqrtBaseRayCount)));
  float yOffset = floor(float(index) / float(sqrtBaseRayCount));
  return vec2(xOffset, yOffset) /  float(sqrtBaseRayCount);
}

vec4 radiance(vec2 uv) {
  vec4 rad = vec4(0.);
  for (int i = 0; i < baseRayCount; i++) {
    vec2 offsetUv = uvOffset(i) + uv / float(sqrtBaseRayCount);
    rad += texture2D(tCascadeZero, offsetUv);
  }
  return rad / float(baseRayCount);
}

  void main() {
    vec2 off = uvOffset(12) + vUv / float(sqrtBaseRayCount);
    outColor = vec4(off, 0., 1.);
    outColor = radiance(vUv);
  }
`;

const cascadeRayMarch = `
#define M_PI 3.1415926538
#define TAU 6.283185307179586
#define EPS 0.0001

uniform sampler2D tColor;
uniform sampler2D tSdf;
uniform sampler2D tPrevCascade;

// higher means fewer probes, more angles
uniform int cascadeDepth;

// the ray count at cascadeDepth = 0;
uniform int sqrtBaseRayCount;
uniform int baseRayCount;

uniform int maxSteps;

// Distance we travel before trying to use
// the higher cascade
uniform float maxDistance;

varying vec2 vUv;

out vec4 outColor;

bool outOfBounds(vec2 uv) {
  return uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0;
}

float stepSize(vec2 uv) {
  return texture2D(tSdf, uv).x;
}

vec2 uvOffset(int index, int depth) {
  float sqrtNumRays = float(sqrtBaseRayCount << cascadeDepth);
  float xOffset = floor(mod(float(index), sqrtNumRays));
  float yOffset = floor(float(index) / sqrtNumRays);
  return vec2(xOffset, yOffset);
}

vec4 sampleCascade(vec2 sampleUv, int index) {
  int startIndex = baseRayCount * index - sqrtBaseRayCount / 2;
  int endIndex = baseRayCount * index + sqrtBaseRayCount / 2;
  float sqrtNumRaysDeeper = float(sqrtBaseRayCount << (cascadeDepth + 1));

  vec2 downscaledUv = sampleUv / sqrtNumRaysDeeper;

  vec4 radiance = vec4(0.);
  for (int i = startIndex; i < endIndex; i++) {
    radiance += texture2D(tPrevCascade,downscaledUv + uvOffset(i, cascadeDepth + 1));
  }
  return radiance / float(sqrtBaseRayCount);
  // first, figure out the 4 places to read from
}

void fireRay(vec2 sampleUv, int index, inout vec4 radiance) {
  int rayCount = baseRayCount << (2 * cascadeDepth);
  float oneOverRayCount = 1.0 / float(rayCount);
  float tauOverRayCount = TAU * oneOverRayCount;
  float angle = tauOverRayCount * (float(index )+ 0.5);
  vec2 rayDirectionUv = vec2(cos(angle), -sin(angle));
  float distTravelled = 0.;
  for (int step = 0; step < maxSteps; step++) {
    if (outOfBounds(sampleUv)) {
      break;
    }
    vec4 color = texture2D(tColor, sampleUv);
    float stepVal = stepSize(sampleUv);
    if (color.a > 0.2) {
      radiance += texture2D(tColor, sampleUv);
      break;
    }
    sampleUv += stepVal * rayDirectionUv;
    distTravelled += stepVal;
    if (distTravelled >= maxDistance) {
      // sample from the higher cascade level
      radiance += sampleCascade(sampleUv, index);
      break;
    }
  }
}

// returns the UV to start the probe from and the index which
// indicates the direction
vec3 probeToEvaluate(vec2 uv) {
  vec2 texSize = vec2(textureSize(tSdf, 0));
  float sqrtNumRays = float(sqrtBaseRayCount << cascadeDepth);

  vec2 discreteUv =  mod(uv * sqrtNumRays, vec2(1.));

  float probeIndex = floor(float(sqrtNumRays) * uv.x) + 
    float(sqrtNumRays) * floor(float(sqrtNumRays) * uv.y) ;

  return vec3(discreteUv, probeIndex);
}


vec4 raymarch() {
  int rayCount = baseRayCount << (2 * cascadeDepth);
  bool isLastLayer = false;
  float partial = 0.125;
  float intervalStart = isLastLayer ? 0.0 : partial;
  float intervalEnd = isLastLayer ? partial : 2.;
  ivec2 texSize = textureSize(tSdf, 0);
  vec2 resolution = vec2(texSize);
  float minStep = min(1. / float(texSize.x), 1. / float(texSize.y));
  float oneOverRayCount = 1.0 / float(baseRayCount);
  float tauOverRayCount = TAU * oneOverRayCount;
  
  vec2 resolutionUv = floor(0.25 * vUv * resolution) * 4.0 / resolution;
  vec4 radiance = vec4(0.0);

  vec3 probeData = probeToEvaluate(vUv);

  
  
  for (int i = 0; i < baseRayCount; i++) {
    fireRay(vUv, i, radiance);
  } 
  vec4 radiance2 = vec4(0.0);
  int index = int(probeData.z);
  vec2 startUv = probeData.xy;
  fireRay(startUv, index, radiance2);
  
  return radiance2;
  }
  
  void main() {
    outColor = raymarch();
    //outColor = vec4(probeToEvaluate(vUv), 1.0);
  }
`;

const initUv = `
uniform sampler2D tColor;
varying vec2 vUv;

out vec4 outColor;

void main() {
  vec4 color = texture2D(tColor, vUv);

  if (color.a > 0.01) {
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
  vec4 current = texture2D(tDistanceField, vUv);
  vec4 nearestSeed = vec4(-2.0);
  float nearestDist = 999999.9;
  vec2 resolution = vec2(textureSize(tDistanceField,0));
  vec2 jumpSize = fwidth(vUv) * stepSize;
  for (int x = -1; x <= 1; x++) {
    for (int y = -1; y <= 1; y++) {
      vec2 sampleUv = vUv + vec2(float(x), float(y)) * stepSize / resolution ;
      if (outOfBounds(sampleUv)) {
        continue;
      }
      vec4 distanceField = texture2D(tDistanceField, sampleUv);
      if (distanceField.a == 0.0) {
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

  if (nearestDist < 999999.) {
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
    float dist = clamp(distance(vUv, closestUv), 0.0, 1.0);
  outColor = vec4(dist, 0., 0., 0.); 
  }`;

export class RadianceCascade extends GameState {
  init(engine) {
    super.init(engine);
    this.input = new InputManager(this);
    this.input.init(engine, this);
    this.color = "#dddddd";
    this.pixelRadius = 0.02;
    this.rayCount = 16;
    this.maxSteps = 120;
    this.colorRT = engine.renderer.newRenderTarget(1, {});
    this.spareRT = engine.renderer.newRenderTarget(1, {});

    this.distanceFieldRT = engine.renderer.newRenderTarget(1, {});
    this.spareDistanceFieldRT = engine.renderer.newRenderTarget(1, {});

    this.cascadeRT = engine.renderer.newRenderTarget(1, {});
    this.spareCascadeRT = engine.renderer.newRenderTarget(1, {});

    const sdfRTConfig = {
      type: THREE.FloatType,
      format: THREE.RedFormat,
    };
    this.sdfRT = engine.renderer.newRenderTarget(1, {});
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

    let resolution = Math.ceil(Math.log2(maxDim)) - 1;

    while (resolution >= -2) {
      engine.renderer.applyPostProcess(
        {
          tDistanceField: this.spareDistanceFieldRT,
          stepSize: Math.pow(2, resolution),
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

    let cascadeDepth = 5;
    while (cascadeDepth >= 0) {
      renderer.applyPostProcess(
        {
          tColor: this.colorRT,
          tSdf: this.sdfRT,
          tPrevCascade: this.cascadeRT,
          cascadeDepth: cascadeDepth,
          sqrtBaseRayCount: Math.sqrt(this.rayCount),
          baseRayCount: this.rayCount,
          maxSteps: this.maxSteps,
          maxDistance: Math.pow(0.5, cascadeDepth) / 2,
        },
        cascadeRayMarch,
        this.spareCascadeRT
      );

      [this.spareCascadeRT, this.cascadeRT] = [
        this.cascadeRT,
        this.spareCascadeRT,
      ];
      cascadeDepth--;
    }

    renderer.applyPostProcess(
      { tInput: this.cascadeRT },
      renderTextureFrag,
      null
    );
    renderer.applyPostProcess(
      {
        tColor: this.colorRT,
        tSdf: this.sdfRT,
        tCascadeZero: this.cascadeRT,
        sqrtBaseRayCount: Math.sqrt(this.rayCount),
        baseRayCount: this.rayCount,
        maxSteps: this.maxSteps,
        maxDistance: Math.pow(0.5, cascadeDepth) / 2,
      },
      renderCascade,
      null
    );
  }
}
