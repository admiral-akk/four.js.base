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
    this.maxSteps = 120;
    this.colorRT = engine.renderer.newRenderTarget(1, {});
    this.spareRT = engine.renderer.newRenderTarget(1, {});

    this.distanceFieldRT = engine.renderer.newRenderTarget(1, {});
    this.spareDistanceFieldRT = engine.renderer.newRenderTarget(1, {});

    this.cascadeRT = engine.renderer.newRenderTarget(1, {
      fixedSize: new THREE.Vector2(1024, 1024),
    });
    this.spareCascadeRT = engine.renderer.newRenderTarget(1, {
      fixedSize: new THREE.Vector2(1024, 1024),
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
        tSdf: this.sdfRT,
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
  }
}
