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
import lineUpdate from "./shaders/lineUpdate.glsl";
import renderCascadeV2 from "./shaders/cascadeV2.glsl";

import GUI from "lil-gui";
import { Vector4 } from "three";
const gui = new GUI();

const myObject = {
  maxCascadeDepth: 6,
  cascadeDepthToRender: 0,
  renderStage: "renderCascade",
};

gui.add(myObject, "maxCascadeDepth").min(0).max(9).step(1);
gui.add(myObject, "cascadeDepthToRender").min(0).max(6).step(1);
gui.add(myObject, "renderStage", ["color", "sdf", "cascade", "renderCascade"]);

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
  constructor(start, prev, curr) {
    super();
    this.start = start;
    this.prev = prev;
    this.curr = curr;
  }
}

class StartDragCommand extends Command {
  constructor(start) {
    super();
    this.start = start;
  }
}

class LineCommand extends Command {
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

    this.curr = start;
  }
  update(engine, game, input) {
    const state = engine.input.getState();
    const { mouse } = state;
    const { pos } = mouse;
    if (!this.start.equals(pos)) {
      game.commands.push(new DragCommand(this.start, this.curr, pos));
      this.curr = pos;
    }

    if (mouse.released) {
      if (!this.start.equals(pos)) {
        game.commands.push(new LineCommand(this.start, pos));
      }
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
        game.commands.push(new StartDragCommand(pos));
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

const setToConstant = `
  uniform vec4 constant;
  out vec4 outColor;
  void main() {  outColor = constant; }`;

export class RadianceCascade extends GameState {
  init(engine) {
    super.init(engine);
    this.input = new InputManager(this);
    this.input.init(engine, this);
    this.color = "#dddddd";
    this.pixelRadius = 0.075;
    this.rayCount = 16;
    this.maxSteps = 32;
    this.colorRT = engine.renderer.newRenderTarget(1, {});
    this.spareRT = engine.renderer.newRenderTarget(1, {});

    const cascadeTextureSize = 1024;

    this.cascadeRT = engine.renderer.newRenderTarget(1, {
      fixedSize: new THREE.Vector2(cascadeTextureSize, cascadeTextureSize),
    });
    this.spareCascadeRT = engine.renderer.newRenderTarget(1, {
      fixedSize: new THREE.Vector2(cascadeTextureSize, cascadeTextureSize),
    });

    const sdfRTConfig = {
      type: THREE.FloatType,
      format: THREE.RedFormat,
    };
    this.sdfRT = engine.renderer.newRenderTarget(1, sdfRTConfig);
    this.spareSdfRT = engine.renderer.newRenderTarget(1, sdfRTConfig);

    engine.renderer.applyPostProcess(
      {
        constant: new THREE.Vector4(1, 0, 0, 0),
      },
      setToConstant,
      this.sdfRT
    );

    this.lineSegments = { value: [] };
  }

  startLine(engine, start) {
    const color = new THREE.Color(this.color);
    this.lineSegments.value.push({
      color: new Vector4(color.r, color.g, color.b, 1),
      startEnd: new Vector4(start.x, start.y, start.x, start.y),
    });
  }

  updateLine(engine, end) {
    const lineSegment = this.lineSegments.value.peek();
    lineSegment.startEnd = new Vector4(
      lineSegment.startEnd.x,
      lineSegment.startEnd.y,
      end.x,
      end.y
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
        isSdf: false,
      },
      lineUpdate,
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
        tTarget: this.sdfRT,
        isSdf: true,
      },
      lineUpdate,
      this.spareSdfRT
    );
    [this.spareSdfRT, this.sdfRT] = [this.sdfRT, this.spareSdfRT];
  }

  update(engine) {
    super.update(engine);
    this.commands.forEach((command) => {
      switch (command.type) {
        case UpdateColorCommand:
          this.color = command.color;
          break;
        case StartDragCommand:
          {
            {
              const startCopy = command.start
                .clone()
                .addScalar(1)
                .multiplyScalar(0.5);
              const endCopy = command.start
                .clone()
                .addScalar(1)
                .multiplyScalar(0.5);
              this.applyDrag(engine, [startCopy, endCopy]);
              this.startLine(engine, startCopy);
            }
          }
          break;
        case DragCommand:
          {
            const startCopy = command.prev
              .clone()
              .addScalar(1)
              .multiplyScalar(0.5);
            const endCopy = command.curr
              .clone()
              .addScalar(1)
              .multiplyScalar(0.5);
            this.applyDrag(engine, [startCopy, endCopy]);
            this.updateLine(engine, endCopy);
          }
          break;
        case LineCommand:
          {
            const endCopy = command.end
              .clone()
              .addScalar(1)
              .multiplyScalar(0.5);
            this.updateLine(engine, endCopy);
          }
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
    const maxDepth = myObject.maxCascadeDepth;
    let cascadeDepth = maxDepth;
    const sqrtRayCount = Math.sqrt(this.rayCount);
    const halfUvPerPixel = 1 / (2 * this.cascadeRT.width);

    while (cascadeDepth >= 0) {
      const sqrtRayCountAtDepth = sqrtRayCount << cascadeDepth;
      const rayCountAtDepth = this.rayCount << (2 * cascadeDepth);
      const sqrtRayCountAtNextDepth = 2 * sqrtRayCountAtDepth;
      const rayCountAtNextDepth = 4 * rayCountAtDepth;

      const maxDeeperUv = 1 / sqrtRayCountAtNextDepth - halfUvPerPixel;

      const maxDistance =
        Math.pow(2, cascadeDepth - maxDepth - 3) * Math.sqrt(2);

      const uniforms = {
        tColor: this.colorRT,
        tSdf: this.sdfRT,
        sqrtRayCountAtDepth: sqrtRayCountAtDepth,
        tauOverRayCount: (2 * Math.PI) / rayCountAtDepth,
        tauOverRayCountAtNextDepth: (2 * Math.PI) / rayCountAtNextDepth,
        rayCountAtNextDepth: rayCountAtNextDepth,
        sqrtRayCountAtNextDepth: sqrtRayCountAtNextDepth,
        minDeeperUv: halfUvPerPixel,
        maxDeeperUv: maxDeeperUv,
        minStep: 0.5 / this.cascadeRT.width,
        maxSteps: this.maxSteps,
        tPrevCascade: this.cascadeRT,
        maxDistance: maxDistance,
        lineSegments: this.lineSegments,
      };

      renderer.applyPostProcess(uniforms, cascadeShader, this.spareCascadeRT, {
        LINE_SEGMENT_COUNT: this.lineSegments.value.length,
      });

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
        sqrtBaseRayCount: sqrtRayCount,
        baseRayCount: this.rayCount,
        minUvRemap: halfUvPerPixel,
        maxUvRemap: 1 / sqrtRayCount - halfUvPerPixel,
      },
      renderCascade,
      null
    );

    renderer.applyPostProcess(
      {
        constant: new THREE.Vector4(0, 0, 0, 0),
      },
      setToConstant,
      this.cascadeRT
    );

    const startDepth = 1;
    let depth = startDepth;
    const finalDepth = 0;
    while (depth >= finalDepth) {
      const rayCount = 4 << depth;
      const xSize = Math.ceil(Math.sqrt(rayCount));
      const pixelCountPerProbe = Math.floor(this.cascadeRT.width / xSize);

      const deeperRayCount = 2 * rayCount;
      const deepXSize = Math.ceil(Math.sqrt(deeperRayCount));
      const deeperUvPerProbe =
        Math.floor(this.cascadeRT.width / deepXSize) / this.cascadeRT.width;
      const maxDeeperUv = deeperUvPerProbe - halfUvPerPixel;

      const maxDistance =
        depth == startDepth
          ? Math.sqrt(2)
          : Math.pow(2, depth - startDepth) / this.cascadeRT.width;
      renderer.applyPostProcess(
        {
          lineSegments: this.lineSegments,
          tPrevCascade: this.cascadeRT,
          rayCount: rayCount,
          tauOverRayCount: (2 * Math.PI) / rayCount,
          tauOverDeeperRayCount: (2 * Math.PI) / deeperRayCount,
          xSize: xSize,
          invPixelCountPerProbe: 1 / pixelCountPerProbe,
          minDeeperUv: halfUvPerPixel,
          maxDeeperUv: maxDeeperUv,
          maxDistance: maxDistance,
          deepXSize: deepXSize,
          deeperUvPerProbe: deeperUvPerProbe,
        },
        renderCascadeV2,
        this.spareCascadeRT,
        {
          LINE_SEGMENT_COUNT: this.lineSegments.value.length,
        }
      );

      [this.spareCascadeRT, this.cascadeRT] = [
        this.cascadeRT,
        this.spareCascadeRT,
      ];
      depth--;
    }
    renderer.applyPostProcess(
      {
        tCascadeZero: this.cascadeRT,
        sqrtBaseRayCount: 2,
        baseRayCount: 4,
        minUvRemap: halfUvPerPixel,
        maxUvRemap: 0.5 - halfUvPerPixel,
      },
      renderCascade,
      null
    );
  }
}
