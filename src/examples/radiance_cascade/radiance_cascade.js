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

import cascadeShader from "./shaders/cascade.glsl";
import renderCascade from "./shaders/renderCascade.glsl";

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
    renderer.applyPostProcess(
      {
        constant: new THREE.Vector4(0, 0, 0, 0),
      },
      setToConstant,
      this.cascadeRT
    );
    const maxDepth = 6;
    let cascadeDepth = maxDepth;
    const sqrtRayCount = Math.sqrt(this.rayCount);
    const halfUvPerPixel = 1 / (2 * this.cascadeRT.width);
    while (cascadeDepth >= 0) {
      const sqrtRayCountAtDepth = sqrtRayCount << cascadeDepth;
      const rayCountAtDepth = this.rayCount << (2 * cascadeDepth);
      const sqrtRayCountAtNextDepth = 2 * sqrtRayCountAtDepth;

      const maxDeeperUv = 1 / sqrtRayCountAtNextDepth - halfUvPerPixel;

      const uniforms = {
        tColor: this.colorRT,
        tSdf: this.sdfRT2,
        rayCountAtDepth: rayCountAtDepth,
        sqrtRayCountAtDepth: sqrtRayCountAtDepth,
        tauOverRayCount: (2 * Math.PI) / rayCountAtDepth,
        rayCountAtNextDepth: 4 * rayCountAtDepth,
        sqrtRayCountAtNextDepth: sqrtRayCountAtNextDepth,
        cascadeDepth: cascadeDepth,
        sqrtBaseRayCount: sqrtRayCount,
        baseRayCount: this.rayCount,
        minDeeperUv: halfUvPerPixel,
        maxDeeperUv: maxDeeperUv,
        minStep: 1 / this.cascadeRT.width,
        maxSteps: this.maxSteps,
        tPrevCascade: this.cascadeRT,
        maxDistance: Math.pow(2, cascadeDepth - maxDepth - 2),
      };

      renderer.applyPostProcess(uniforms, cascadeShader, this.spareCascadeRT);

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
        tSdf: this.sdfRT2,
        tCascadeZero: this.cascadeRT,
        sqrtBaseRayCount: sqrtRayCount,
        baseRayCount: this.rayCount,
        minUvRemap: halfUvPerPixel,
        maxUvRemap: 1 / sqrtRayCount - halfUvPerPixel,
      },
      renderCascade,
      null
    );
  }
}
