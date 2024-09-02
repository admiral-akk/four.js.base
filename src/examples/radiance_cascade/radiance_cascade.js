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

const sdfRTConfig = {
  type: THREE.FloatType,
  format: THREE.RedFormat,
  internalFormat: THREE.R32F,
};

const sdfFragShader = `
#include <packing>

uniform sampler2D tSdf;

uniform vec2 start;
uniform vec2 end;

uniform vec3 color;

uniform float radius;

varying vec2 vUv;
out vec4 outColor;

float sdfDist(vec2 p) {
    vec2 toStart = p - start;
    vec2 line = end - start;
    float lineLengthSquared = dot(line, line);
    float t = clamp(dot(toStart, line) / lineLengthSquared, 0., 1.);
    vec2 closest = (toStart - line * t);
    return dot(closest, closest);
}

void main()
{ 
    vec4 current =  texture2D(tSdf,vUv);
    float dist = sdfDist(vUv);

    float inRange = step(radius,dist);
    
    outColor = inRange * current + (1. - inRange) * vec4(color, 1.);
}
  `;

export class RadianceCascade extends GameState {
  init(engine) {
    super.init(engine);
    this.input = new InputManager(this);
    this.input.init(engine, this);
    this.color = "#dddddd";
    this.radius = 0.01;
    this.sdfRenderTarget = engine.renderer.newRenderTarget(1, {});
    this.spareRenderTarget = engine.renderer.newRenderTarget(1, {});
  }

  applyDrag(engine, [start, end]) {
    const startCopy = start.clone().addScalar(1).multiplyScalar(0.5);
    const endCopy = end.clone().addScalar(1).multiplyScalar(0.5);
    engine.renderer.applyPostProcess(
      {
        start: { value: startCopy },
        end: { value: endCopy },
        color: { value: new THREE.Color(this.color) },
        radius: { value: this.radius * this.radius },
        tSdf: { value: this.sdfRenderTarget.texture },
      },
      sdfFragShader,
      this.spareRenderTarget
    );
    engine.renderer.applyPostProcess(
      { tInput: { value: this.spareRenderTarget.texture } },
      renderTextureFrag,
      this.sdfRenderTarget
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
          this.applyDrag(engine, [command.start, command.end]);
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
      { tInput: { value: this.sdfRenderTarget.texture } },
      renderTextureFrag,
      null
    );
  }
}
