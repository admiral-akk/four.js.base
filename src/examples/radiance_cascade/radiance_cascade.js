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
import symmetryShader from "./shaders/symmetry.glsl";

import GUI from "lil-gui";
import { Vector4 } from "three";
import { Vector2 } from "three";
const gui = new GUI();

const myObject = {
  startDepth: 5,
  finalDepth: 4,
  renderCascadeStep: true,
  renderSymmetryStep: false,
  continousBilinearFix: false,
  linePreconfig: "x",
  symmetryCheck: false,
  symmetryType: 0,
  renderMode: 0,
  textureSize: 10,
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
};
readConfig();
const clearConfig = () => {
  const config = localStorage.getItem(configString);
  if (config) {
    localStorage.removeItem(configString);
  }
};

const saveConfig = () => {
  localStorage.setItem(configString, JSON.stringify(myObject));
};

readConfig();

let pendingImage = false;

const saveImage = () => {
  pendingImage = true;
};

const buttons = {
  clearConfig: clearConfig,
  saveImage: saveImage,
};

const startDepth = gui
  .add(myObject, "startDepth", 1, myObject.textureSize - 4, 1)
  .name("Start Depth");

const finalDepth = gui
  .add(myObject, "finalDepth")
  .name("Final Depth")
  .min(0)
  .max(Math.min(myObject.startDepth, 9))
  .step(1)
  .onChange(saveConfig)
  .listen();

startDepth
  .onChange(() => {
    finalDepth.max(myObject.startDepth);
    myObject.finalDepth = Math.min(myObject.startDepth, myObject.finalDepth);
    saveConfig();
  })
  .listen();
gui.add(myObject, "renderCascadeStep").onChange(saveConfig);
gui.add(myObject, "renderSymmetryStep").onChange(saveConfig);

gui.add(myObject, "continousBilinearFix").onChange(saveConfig);
gui.add(myObject, "renderMode").min(0).max(15).step(1).onChange(saveConfig);
gui.add(buttons, "clearConfig").name("Clear Config");
gui.add(buttons, "saveImage").name("Save Image");
gui.add(myObject, "symmetryCheck").onChange(saveConfig);
gui.add(myObject, "symmetryType").min(0).max(3).step(1).onChange(saveConfig);

class Command {
  constructor() {
    this.type = Object.getPrototypeOf(this).constructor;
  }
}

class UpdateColorCommand extends Command {
  constructor(color, wallType) {
    super();
    this.color = color;
    this.wallType = wallType;
  }
}

class ClearCommand extends Command {}

class DragCommand extends Command {
  constructor(curr) {
    super();
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
      game.commands.push(new DragCommand(this.curr));
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

  createColorButton(color, wallType) {
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
          command: new UpdateColorCommand(color, wallType),
        }),
      ])
    );
  }

  init(engine, game) {
    this.createColorButton("#ff0000", 0);
    this.createColorButton("#00ff00", 0);
    this.createColorButton("#000000", 0);
    this.createColorButton("#ffffff", 0);
    this.createColorButton("#ffffff", 1);
  }

  update(engine, game) {
    this.currentState()?.update(engine, game, this);
  }
}

// https://learnopengl.com/Getting-started/Coordinate-Systems
const clipToScreenSpace = (clipVec2) => {
  console.log(clipVec2);
  return clipVec2.clone().addScalar(1).multiplyScalar(0.5);
};

export class RadianceCascade extends GameState {
  init(engine) {
    super.init(engine);
    this.input = new InputManager(this);
    this.input.init(engine, this);
    this.color = "#dddddd";

    const cascadeTextureSize = Math.pow(2, myObject.textureSize);
    const textureConfig = {
      fixedSize: new THREE.Vector2(2 * cascadeTextureSize, cascadeTextureSize),
      wrapS: THREE.ClampToEdgeWrapping,
      wrapT: THREE.ClampToEdgeWrapping,
      magFilter: THREE.LinearFilter,
      minFilter: THREE.LinearFilter,
      generateMipmaps: false,
      format: THREE.RGBAFormat,
      type: THREE.FloatType,
      internalFormat: "RGBA32F",
      anisotropy: 1,
      colorSpace: THREE.NoColorSpace,
      depthBuffer: false,
      stencilBuffer: false,
      resolveDepthBuffer: false,
      resolveStencilBuffer: false,
      depthTexture: null,
    };

    this.cascadeRT = engine.renderer.newRenderTarget(1, textureConfig);
    this.spareCascadeRT = engine.renderer.newRenderTarget(1, textureConfig);

    const textureConfig2 = {
      fixedSize: new THREE.Vector2(cascadeTextureSize, cascadeTextureSize),
      wrapS: THREE.ClampToEdgeWrapping,
      wrapT: THREE.ClampToEdgeWrapping,
      magFilter: THREE.LinearFilter,
      minFilter: THREE.LinearFilter,
      generateMipmaps: false,
      format: THREE.RGBAFormat,
      type: THREE.FloatType,
      internalFormat: "RGBA32F",
      anisotropy: 1,
      colorSpace: THREE.NoColorSpace,
      depthBuffer: false,
      stencilBuffer: false,
      resolveDepthBuffer: false,
      resolveStencilBuffer: false,
      depthTexture: null,
    };
    this.finalCascadeRT = engine.renderer.newRenderTarget(1, textureConfig2);
    this.spareFinalCascadeRT = engine.renderer.newRenderTarget(
      1,
      textureConfig2
    );

    gui
      .add(myObject, "textureSize", 3, 12, 1)
      .name("Texture Size")
      .onChange(() => {
        const cascadeTextureSize = Math.pow(2, myObject.textureSize);
        myObject.finalDepth = Math.min(
          myObject.finalDepth,
          myObject.textureSize
        );
        myObject.startDepth = Math.min(
          myObject.startDepth,
          myObject.textureSize
        );
        startDepth.max(myObject.textureSize - 4);
        finalDepth.max(Math.min(myObject.startDepth, myObject.textureSize));
        myObject.startDepth = Math.min(
          myObject.startDepth,
          myObject.textureSize - 2
        );
        myObject.finalDepth = Math.min(
          myObject.startDepth,
          myObject.finalDepth
        );
        this.cascadeRT.fixedSize = new THREE.Vector2(
          2 * cascadeTextureSize,
          cascadeTextureSize
        );
        this.spareCascadeRT.fixedSize = new THREE.Vector2(
          2 * cascadeTextureSize,
          cascadeTextureSize
        );
        this.finalCascadeRT.fixedSize = new THREE.Vector2(
          cascadeTextureSize,
          cascadeTextureSize
        );
        this.spareFinalCascadeRT.fixedSize = new THREE.Vector2(
          cascadeTextureSize,
          cascadeTextureSize
        );
        engine.renderer.refreshSize();
        saveConfig();
      });

    const storedLines = localStorage.getItem("lines");

    if (storedLines) {
      this.lineSegments = JSON.parse(storedLines);
    } else {
      this.lineSegments = { value: [] };
    }

    gui.add(this, "clearLines").name("Clear Lines");
    gui
      .add(myObject, "linePreconfig", ["x", "+", "-", "|", "="])
      .onChange(saveConfig);
    buttons.applyLineConfig = () => {
      this.commands.push(
        new ClearCommand(),
        new UpdateColorCommand("#ffffff", 0)
      );
      switch (myObject.linePreconfig) {
        case "x":
          this.commands.push(
            new StartDragCommand(new Vector2(-0.5, -0.5)),
            new DragCommand(new Vector2(0.5, 0.5)),
            new StartDragCommand(new Vector2(-0.5, 0.5)),
            new DragCommand(new Vector2(0.5, -0.5))
          );
          break;
        case "-":
          this.commands.push(
            new StartDragCommand(new Vector2(-0.5, 0)),
            new DragCommand(new Vector2(0.5, 0))
          );
          break;
        case "|":
          this.commands.push(
            new StartDragCommand(new Vector2(0, -0.5)),
            new DragCommand(new Vector2(0, 0.5))
          );
          break;
        case "+":
          this.commands.push(
            new StartDragCommand(new Vector2(-0.5, 0)),
            new DragCommand(new Vector2(0.5, 0)),
            new StartDragCommand(new Vector2(0, -0.5)),
            new DragCommand(new Vector2(0, 0.5))
          );
          break;
        case "=":
          this.commands.push(
            new StartDragCommand(new Vector2(-1, 0.9)),
            new DragCommand(new Vector2(1, 0.9)),
            new UpdateColorCommand("#000000", 0),
            new StartDragCommand(new Vector2(0, 0)),
            new DragCommand(new Vector2(1, 0))
          );
          break;
        default:
          throw new Error("UNKNOWN CONFIG");
      }
    };
    gui.add(buttons, "applyLineConfig").name("Apply Line Config");
  }

  clearLines() {
    this.lineSegments.value.length = 0;
    localStorage.setItem("lines", JSON.stringify(this.lineSegments));
  }

  startLine(engine, start) {
    const color = new THREE.Color(this.color);
    this.lineSegments.value.push({
      color: new Vector4(color.r, color.g, color.b, 1),
      startEnd: new Vector4(start.x, start.y, start.x, start.y),
      wallType: this.wallType,
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

  applyCommand(engine, command) {
    switch (command.type) {
      case UpdateColorCommand:
        this.color = command.color;
        this.wallType = command.wallType;
        break;
      case ClearCommand:
        this.clearLines();
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
  }

  update(engine) {
    super.update(engine);
    this.commands.forEach((command) => {
      this.applyCommand(engine, command);
    });
    // check if the color changes
    // find a line if one exists
    // if a line exists, use it to update the canvas
    //
  }

  calculateUniforms(depth) {
    const startDepth = myObject.startDepth;
    const rayCount = 4 << depth;
    const baseProbeWidth = this.cascadeRT.width / 2;
    const probeCount = baseProbeWidth >> depth;
    const baseDistance = (1 * Math.SQRT2) / this.cascadeRT.width;
    const multiplier = Math.log2(Math.SQRT2 / baseDistance) / startDepth;

    const minDistance = baseDistance * Math.pow(2, multiplier * (depth - 1));
    const maxDistance = baseDistance * Math.pow(2, multiplier * depth);

    const cascadeConfig = {
      rayCount: rayCount,
      probeCount: probeCount,
      xSize: this.cascadeRT.width / probeCount,
      ySize: 2,
      depth: depth,
      minDistance: depth > 0 ? minDistance : 0,
      maxDistance: maxDistance,
    };

    const deeperMaxDistance =
      baseDistance * Math.pow(2, multiplier * (depth + 1));

    const deeperCascadeConfig = {
      rayCount: rayCount << 1,
      probeCount: probeCount >> 1,
      xSize: this.cascadeRT.width / (probeCount >> 1),
      ySize: 2,
      depth: depth + 1,
      minDistance: maxDistance,
      maxDistance: deeperMaxDistance,
    };

    const debugInfo = {
      continousBilinearFix: myObject.continousBilinearFix,
      finalDepth: Math.max(0, myObject.finalDepth),
      renderMode: myObject.renderMode,
    };

    return {
      startDepth: startDepth,
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

    if (myObject.finalDepth == 0 && myObject.renderCascadeStep) {
      renderer.applyPostProcess(
        this.calculateUniforms(0),
        renderCascade,
        this.spareFinalCascadeRT
      );
      [this.spareFinalCascadeRT, this.finalCascadeRT] = [
        this.finalCascadeRT,
        this.spareFinalCascadeRT,
      ];
    }

    if (myObject.renderSymmetryStep) {
      let normal = 0;
      switch (myObject.symmetryType) {
        default:
        case 0:
          normal = new Vector2(1, 0);
          break;
        case 1:
          normal = new Vector2(1, 1);
          break;
        case 2:
          normal = new Vector2(0, 1);
          break;
        case 3:
          normal = new Vector2(-1, 1);
          break;
      }

      renderer.applyPostProcess(
        {
          tInput: this.finalCascadeRT,
          normal: normal.normalize(),
          diffScale: 1,
        },
        symmetryShader,
        this.spareFinalCascadeRT
      );
      [this.spareFinalCascadeRT, this.finalCascadeRT] = [
        this.finalCascadeRT,
        this.spareFinalCascadeRT,
      ];
    }

    if (myObject.renderCascadeStep) {
      renderer.renderTexture(this.finalCascadeRT);
    } else {
      renderer.renderTexture(this.cascadeRT);
    }

    if (pendingImage) {
      let canvas = document.getElementById("webgl");

      var image = canvas.toDataURL();
      // Create a link
      var aDownloadLink = document.createElement("a");
      // Add the name of the file to the link
      aDownloadLink.download = "canvas_image.png";
      // Attach the data to the link
      aDownloadLink.href = image;
      // Get the code to click the download link
      aDownloadLink.click();
      pendingImage = false;
    }
  }
}
