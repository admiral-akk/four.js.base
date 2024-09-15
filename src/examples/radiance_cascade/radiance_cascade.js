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

import renderCascade from "./shaders/renderCascade.glsl";
import calculateCascade from "./shaders/cascade.glsl";

import GUI from "lil-gui";
import { Vector4 } from "three";
const gui = new GUI();

const cascadeTextureSize = 4 * 1024;
const myObject = {
  fogStepSize: 0.01,
  startDepth: 5,
  finalDepth: 4,
  renderMode: 0,
  hasMinDistance: false,
};

const configString = "config";

const readConfig = () => {
  const config = localStorage.getItem(configString);
  if (config) {
    const parsedConfig = JSON.parse(config);

    for (var key of Object.keys(parsedConfig)) {
      myObject[key] = parsedConfig[key];
    }
  }
  console.log(myObject);
};

const clearConfig = () => {
  const config = localStorage.getItem(configString);
  if (config) {
    localStorage.removeItem(configString);
  }
};

const saveConfig = () => {
  localStorage.setItem(configString, JSON.stringify(myObject));
  console.log(myObject);
};

readConfig();

const buttons = {
  clearConfig: clearConfig,
};

const finalDepth = gui
  .add(myObject, "finalDepth")
  .min(-1)
  .max(9)
  .step(1)
  .onChange(saveConfig);
gui
  .add(myObject, `startDepth`, 0, Math.floor(Math.log2(cascadeTextureSize)), 1)
  .name("Start Depth")
  .onChange(saveConfig)
  .onChange((v) => {
    finalDepth.max(myObject.startDepth);
  });
gui.add(myObject, "renderMode").min(0).max(15).step(1).onChange(saveConfig);
gui.add(buttons, "clearConfig").name("Clear Config");
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
            centerX: this.buttons.length * 0.2 + 0.1,
            centerY: 0.9,
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

// https://learnopengl.com/Getting-started/Coordinate-Systems
const clipToScreenSpace = (clipVec2) => {
  return clipVec2.clone().addScalar(1).multiplyScalar(0.5);
};

export class RadianceCascade extends GameState {
  init(engine) {
    super.init(engine);
    this.input = new InputManager(this);
    this.input.init(engine, this);
    this.color = "#dddddd";

    this.cascadeRT = engine.renderer.newRenderTarget(1, {
      fixedSize: new THREE.Vector2(cascadeTextureSize, cascadeTextureSize),
    });
    this.spareCascadeRT = engine.renderer.newRenderTarget(1, {
      fixedSize: new THREE.Vector2(cascadeTextureSize, cascadeTextureSize),
    });

    const storedLines = localStorage.getItem("lines");

    if (storedLines) {
      this.lineSegments = JSON.parse(storedLines);
    } else {
      this.lineSegments = { value: [] };
    }

    buttons.clearLines = () => {
      this.lineSegments.value.length = 0;
      localStorage.setItem("lines", JSON.stringify(this.lineSegments));
    };
    gui.add(buttons, "clearLines").name("Clear Lines");
  }

  startLine(engine, start) {
    const color = new THREE.Color(this.color);
    this.lineSegments.value.push({
      color: new Vector4(color.r, color.g, color.b, 1),
      startEnd: new Vector4(start.x, start.y, start.x, start.y),
    });
    localStorage.setItem("lines", JSON.stringify(this.lineSegments));
  }

  updateLine(engine, end) {
    const lineSegment = this.lineSegments.value.peek();
    lineSegment.startEnd = new Vector4(
      lineSegment.startEnd.x,
      lineSegment.startEnd.y,
      end.x,
      end.y
    );
    localStorage.setItem("lines", JSON.stringify(this.lineSegments));
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
              this.startLine(engine, clipToScreenSpace(command.start));
            }
          }
          break;
        case DragCommand:
          {
            this.updateLine(engine, clipToScreenSpace(command.curr));
          }
          break;
        case LineCommand:
          {
            this.updateLine(engine, clipToScreenSpace(command.end));
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

  calculateUniforms(depth) {
    const startDepth = myObject.startDepth;
    const rayCount = 4 << depth;
    const xSize = Math.ceil(Math.sqrt(rayCount));
    const baseDistance = Math.SQRT2 / this.cascadeRT.width;
    const multiplier = Math.log2(Math.SQRT2 / baseDistance) / startDepth;

    const maxDistance = baseDistance * Math.pow(2, multiplier * depth);

    const cascadeConfig = {
      probeCount: Math.floor(this.cascadeRT.width / xSize),
      depth: depth,
      rayCount: rayCount,
      xSize: xSize,
      minDistance: 0 != depth ? maxDistance / 3 : 0,
      maxDistance: maxDistance,
    };

    const deeperRayCount = 2 * cascadeConfig.rayCount;
    const deeperXSize = Math.ceil(Math.sqrt(deeperRayCount));
    const deeperMaxDistance =
      baseDistance * Math.pow(2, multiplier * (depth + 1));

    const deeperCascadeConfig = {
      probeCount: Math.floor(this.cascadeRT.width / deeperXSize),
      depth: depth + 1,
      rayCount: deeperRayCount,
      xSize: deeperXSize,
      minDistance: deeperMaxDistance / 3,
      maxDistance: deeperMaxDistance,
    };

    const debugInfo = {
      startDepth: startDepth,
      finalDepth: Math.max(0, myObject.finalDepth),
      renderMode: myObject.renderMode,
    };

    return {
      current: cascadeConfig,
      deeper: deeperCascadeConfig,
      debug: debugInfo,
      lineSegments: this.lineSegments,
      tPrevCascade: this.cascadeRT,
    };
  }

  render(renderer) {
    renderer.setTextureToConstant(
      this.cascadeRT,
      new THREE.Vector4(0, 0, 0, 0)
    );
    let depth = myObject.startDepth;
    const finalDepth = Math.max(0, myObject.finalDepth);
    while (depth >= finalDepth) {
      renderer.applyPostProcess(
        this.calculateUniforms(depth),
        calculateCascade,
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
    switch (myObject.finalDepth) {
      case -1:
        renderer.applyPostProcess(
          this.calculateUniforms(0),
          renderCascade,
          null
        );
        break;
      default:
        renderer.renderTexture(this.cascadeRT);
        break;
    }
  }
}
