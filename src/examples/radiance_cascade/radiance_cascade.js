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
    this.createColorButton("#000000");
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
  
  float sdfDist(vec2 p) {
  
      vec2 toStart = p - start;
      vec2 line = end - start;
      float lineLengthSquared = dot(line, line);
      float t = clamp(dot(toStart, line) / lineLengthSquared, 0., 1.);
      vec2 closest = (toStart - line * t);
      return length(closest) - radius ;
  }
  
  void main()
  { 
      float dist = sdfDist(vUv);
    float inRange = smoothstep (0., 0.0025,dist);

      vec4 current = texture2D(tTarget,vUv);
  
    outColor = inRange * current + (1. - inRange) * vec4(color, 1.);
  }
  `;
const sdfFragShader = `
  uniform sampler2D tTarget;
  
  uniform vec2 start;
  uniform vec2 end;
  
  uniform float radius;
  uniform float totalWidth;
  
  varying vec2 vUv;
  out vec4 outColor;
  
  float sdfDist(vec2 p) {
  
      vec2 toStart = p - start;
      vec2 line = end - start;
      float lineLengthSquared = dot(line, line);
      float t = clamp(dot(toStart, line) / lineLengthSquared, 0., 1.);
      vec2 closest = (toStart - line * t);
      return length(closest) - radius;
  }
  
  void main()
  { 
      float dist =  sdfDist(vUv);

      vec4 current = texture2D(tTarget,vUv);
  
      outColor = vec4(min(dist, current.x), vec3(0.));
  }
    `;

const setToConstant = `
  uniform vec4 constant;
  out vec4 outColor;
  void main() {  outColor = constant; }`;

const renderCascade = `
#define M_PI 3.1415926538
#define TAU 6.283185307179586

uniform sampler2D tColor;
uniform sampler2D tSdf;
uniform sampler2D tCascadeZero;

// the ray count at cascadeDepth = 0;
uniform int sqrtBaseRayCount;
uniform int baseRayCount;

varying vec2 vUv;

out vec4 outColor;

vec2 uvOffset(int index) {
  vec2 dim = 0.5 / vec2(textureSize(tCascadeZero, 0));
  float xOffset = clamp(floor(mod(float(index), float(sqrtBaseRayCount))), 0., float(sqrtBaseRayCount));
  float yOffset = clamp(floor(float(index) / float(sqrtBaseRayCount)), 0., float(sqrtBaseRayCount));
  return dim + (vec2(xOffset, yOffset)) /  float(sqrtBaseRayCount);
}

vec4 radiance(vec2 uv) {
  vec4 rad = vec4(0.);
  vec2 dim = 1. / vec2(textureSize(tCascadeZero, 0));
  for (int i = 0; i < baseRayCount; i++) {
    vec2 adjustedUv = uv / (float(sqrtBaseRayCount)) - dim;
    vec2 offsetUv = uvOffset(i) + adjustedUv;
    rad += texture2D(tCascadeZero, offsetUv);
  }
  return rad / float(baseRayCount);
}

  void main() {
    outColor = radiance(vUv);
  }
`;

const cascadeRayMarch = `
#define M_PI 3.1415926538
#define TAU 6.283185307179586
#define EPS 0.00005

uniform sampler2D tColor;
uniform sampler2D tSdf;
uniform sampler2D tPrevCascade;

// higher means fewer probes, more angles
uniform int cascadeDepth;

// the ray count at cascadeDepth = 0;
uniform int sqrtBaseRayCount;
uniform int baseRayCount;

uniform int maxSteps;
uniform float minStep;

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
  float sqrtNumRays = float(sqrtBaseRayCount << depth);
  float xOffset = floor(mod(float(index), sqrtNumRays));
  float yOffset = floor(float(index) / sqrtNumRays);
  return (vec2(xOffset, yOffset) + 0.5) / sqrtNumRays;
}

vec4 sampleCascade(vec2 sampleUv, int index) {
  int startIndex = baseRayCount * index - sqrtBaseRayCount / 2;
  int endIndex = baseRayCount * index + sqrtBaseRayCount / 2;
  float sqrtNumRaysDeeper =  float(sqrtBaseRayCount << (cascadeDepth + 1));

  vec2 size = vec2(textureSize(tPrevCascade,0 ));
  vec2 pixelsPerBox = size /  sqrtNumRaysDeeper;

  vec2 rescale = size /  sqrtNumRaysDeeper;
  vec2 dim = 1. / vec2(textureSize(tPrevCascade,0 ));

  vec2 downscaledUv = ((size - 1.) / size) * (sampleUv) / sqrtNumRaysDeeper;

  vec4 radiance = vec4(0.);
  for (int i = startIndex; i < startIndex + 1; i++) {
    radiance += texture2D(tPrevCascade, downscaledUv + uvOffset(i, cascadeDepth + 1));
  }
  return radiance / float(sqrtBaseRayCount);
}

void fireRay(vec2 sampleUv, int index, inout vec4 radiance) {
  int rayCount = baseRayCount << (2 * cascadeDepth);
  float oneOverRayCount = 1.0 / float(rayCount);
  float tauOverRayCount = TAU * oneOverRayCount;
  float angle = tauOverRayCount * (float(index)+ 0.5);
  vec2 rayDirectionUv = vec2(cos(angle), -sin(angle));
  float distTravelled = 0.;
  for (int step = 0; step < maxSteps; step++) {
    if (outOfBounds(sampleUv)) {
      radiance += vec4(0.,0.,1.,1.);
      break;
    }
    float stepVal = stepSize(sampleUv);
    if (stepVal < 0.) {
  float sqrtNumRays = float(sqrtBaseRayCount << cascadeDepth);
      float x = mod(float(index), sqrtNumRays) / sqrtNumRays;
      float y = floor(float(index) / sqrtNumRays) / sqrtNumRays;
      radiance += vec4(x,y, 0., 1.);
      //radiance += texture2D(tColor, sampleUv);
      break;
    }
    distTravelled += stepVal;
    sampleUv += stepVal * rayDirectionUv;
    if (distTravelled >= maxDistance) {
      // sample from the higher cascade level
      //radiance += vec4(0.,0.,1.,0.);
      //radiance += 100.;
      //*sampleCascade(sampleUv, index);
      break;
    }
  }
}

void cascadeRange(int index, int currentDepth, out ivec3 fullSample, out ivec2 halfSample) {
  int center = 4 * index;
  int bot = center - 1;
  int bot2 = center - 2;
  if (bot < 0) {
    int indexCountAtNextDepth = baseRayCount << (2 * currentDepth + 2);
    bot += indexCountAtNextDepth;
    bot2 += indexCountAtNextDepth;
  }
  fullSample = ivec3(bot, center, center + 1);
  halfSample = ivec2(bot2, center + 2);
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
    vec3 probeData = probeToEvaluate(vUv);
    vec4 radiance2 = vec4(0.0);
    int index = int(probeData.z);
    vec2 startUv = probeData.xy;
    fireRay(startUv, index, radiance2);
  
    return radiance2;
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
    float dist = floor(1.+100.*clamp(distance(vUv, closestUv), 0.0, 1.0)) / 10.;
  outColor = vec4(dist, 0., 0., 0.); 
  }`;

export class RadianceCascade extends GameState {
  init(engine) {
    super.init(engine);
    this.input = new InputManager(this);
    this.input.init(engine, this);
    this.color = "#dddddd";
    this.pixelRadius = 0.075;
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
    this.sdfRT = engine.renderer.newRenderTarget(1, sdfRTConfig);
    this.sdfRT2 = engine.renderer.newRenderTarget(1, sdfRTConfig);
    this.spareSdfRT2 = engine.renderer.newRenderTarget(1, sdfRTConfig);

    engine.renderer.applyPostProcess(
      {
        constant: new THREE.Vector4(1, 0, 0, 0),
      },
      setToConstant,
      this.sdfRT2
    );
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
        start: start,
        end: end,
        color: new THREE.Color(this.color),
        radius: this.pixelRadius * this.pixelRadius,
        totalWidth: 4,
        tTarget: this.sdfRT2,
      },
      sdfFragShader,
      this.spareSdfRT2
    );
    [this.spareSdfRT2, this.sdfRT2] = [this.sdfRT2, this.spareSdfRT2];

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

    while (resolution >= 0) {
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
    const maxDepth = 1;
    let cascadeDepth = maxDepth;
    while (cascadeDepth >= 1) {
      const uniforms = {
        tColor: this.colorRT,
        tSdf: this.sdfRT2,
        cascadeDepth: cascadeDepth,
        sqrtBaseRayCount: Math.sqrt(this.rayCount),
        baseRayCount: this.rayCount,
        minStep: 1 / this.cascadeRT.width,
        maxSteps: this.maxSteps,
        maxDistance: Math.pow(2, cascadeDepth - maxDepth - 2),
      };
      if (cascadeDepth < maxDepth) {
        uniforms.tPrevCascade = this.cascadeRT;
      } else {
        delete uniforms.tPrevCascade;
      }

      renderer.applyPostProcess(uniforms, cascadeRayMarch, this.spareCascadeRT);

      [this.spareCascadeRT, this.cascadeRT] = [
        this.cascadeRT,
        this.spareCascadeRT,
      ];
      cascadeDepth--;
    }
    renderer.applyPostProcess(
      {
        tColor: this.colorRT,
        tSdf: this.sdfRT2,
        tCascadeZero: this.cascadeRT,
        sqrtBaseRayCount: Math.sqrt(this.rayCount),
        baseRayCount: this.rayCount,
        maxSteps: this.maxSteps,
        maxDistance: Math.pow(0.5, cascadeDepth) / 2,
      },
      renderCascade,
      null
    );
    renderer.applyPostProcess(
      { tInput: this.cascadeRT },
      renderTextureFrag,
      null
    );
  }
}
