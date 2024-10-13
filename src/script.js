import "./style.css";
import { WindowManager } from "./engine/window.js";
import { DataManager } from "./engine/data.js";
import Stats from "stats-js";
import { addCustomArrayMethods } from "./utils/array.js";
import * as twgl from "twgl.js";
import { State, StateMachine } from "./utils/stateMachine";
import { InputManager2 } from "./engine/input2.js";
import { TimeManager } from "./engine/time.js";

addCustomArrayMethods();
var stats = new Stats();
stats.showPanel(0); // 0: fps, 1: ms, 2: mb, 3+: custom
document.body.appendChild(stats.dom);

// Time

const timeManager = new TimeManager();

// Data Storage

const defaultData = {
  state: {},
  config: {},
};

const addEnumConfig = (displayName, initialValue, options) => {
  defaultData.config[displayName] = {
    name: displayName,
    value: initialValue,
    minOrOptions: options,
  };
};

const addNumberConfig = (displayName, initialValue, min, max, step) => {
  defaultData.config[displayName] = {
    name: displayName,
    value: initialValue,
    minOrOptions: min,
    max,
    step,
  };
};

// Canvas Manager

const windowManager = new WindowManager(1);

// Render Pipeline

const gl = document.getElementById("webgl").getContext("webgl");

const arrays = {
  position: {
    numComponents: 3,
    data: [-1, -1, 0, 1, -1, 0, -1, 1, 0, -1, 1, 0, 1, -1, 0, 1, 1, 0],
  },
};
const bufferInfo = twgl.createBufferInfoFromArrays(gl, arrays);

windowManager.listeners.push({
  updateSize: ({ width, height }) => {
    gl.canvas.width = width;
    gl.canvas.height = height;
  },
});

addEnumConfig("My Enum", "v", ["1", "2", "3", "v"]);
addNumberConfig("My Num", 0, -1, 10, 0.1);

// Input handler

const input = new InputManager2(windowManager, timeManager);

// Input State Machine

class Command {
  constructor() {
    this.type = Object.getPrototypeOf(this).constructor;
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

  update(game, inputStateMachine, inputState) {
    const { mouse } = inputState;
    if (!mouse) {
      return;
    }
    const { pos, buttons } = mouse;
    if (!buttons) {
      if (!this.start.equals(pos)) {
        game.commands.push(new LineCommand(this.start, pos));
      }
      inputStateMachine.replaceState(new OpenInputState());
    } else if (!this.start.equals(pos)) {
      this.curr = pos;
      game.commands.push(new DragCommand(this.curr));
    }
  }
}

class OpenInputState extends State {
  update(game, inputStateMachine, inputState) {
    const { mouse } = inputState;
    if (!mouse) {
      return;
    }
    const { pos, buttons } = mouse;
    if (pos && buttons) {
      game.commands.push(new StartDragCommand(pos));
      inputStateMachine.replaceState(new DragInputState(pos));
    }
  }
}

class InputManager extends StateMachine {
  constructor() {
    super();
    this.pushState(new OpenInputState());
  }

  init() {}

  update(game, inputState) {
    this.currentState()?.update(game, this, inputState);
  }
}

const inputState = new InputManager();

// Game

const clipToScreenSpace = ([x, y]) => [(x + 1) / 2, (y + 1) / 2];

class MyGame {
  constructor() {
    this.commands = [];
    this.lines = [];
    this.currLine = { start: [0, 0], end: [0, 0] };
  }

  startLine(pos) {
    this.currLine = { start: pos, end: pos };
  }

  updateLine(pos) {
    this.currLine.end = pos;
  }

  endLine(pos) {
    this.currLine.end = pos;
    this.lines.push(this.currLine);
  }

  applyCommand(command) {
    switch (command.type) {
      case ClearCommand:
        this.clearLines();
        break;
      case StartDragCommand:
        {
          {
            this.startLine(clipToScreenSpace(command.start));
          }
        }
        break;
      case DragCommand:
        {
          this.updateLine(clipToScreenSpace(command.curr));
        }
        break;
      case LineCommand:
        {
          this.endLine(clipToScreenSpace(command.end));
        }
        break;
      default:
        break;
    }
  }

  update() {
    this.commands.forEach((command) => {
      this.applyCommand(command);
    });
    this.commands.length = 0;
  }
}

const game = new MyGame();

// Data Storage Layer

const data = new DataManager(defaultData);
data.init();
data.addButton({ name: "Clear Data", fn: () => data.clearData() });

// Draw Lines

const vs = `
attribute vec4 position;

void main() {
  gl_Position = position;
}
`;

const fs_write_line = `
precision mediump float;

uniform vec2 resolution;
uniform float time;
uniform vec2 lineStart;
uniform vec2 lineEnd;
uniform float pixelLineSize;
uniform sampler2D tPrev;

float lineDist() {
  vec2 uv = gl_FragCoord.xy / resolution;
  if (lineStart == lineEnd) {
    return length(lineStart - uv);
  } else {
   vec2 delta = (lineEnd - lineStart);
    vec2 dir = uv - lineStart;
    float t = dot(dir, delta) / dot(delta,delta);
    if (t < 0. || t > 1.) {
      return min(length(uv - lineStart), length(uv - lineEnd));
    } else {
     return length(lineStart + t * delta - uv);
    }
   return 0.;
  }
}

void main() {
  vec2 uv = gl_FragCoord.xy / resolution;
  float dist = step(lineDist(), pixelLineSize / resolution.x);
  float prevColor = texture2D(tPrev, uv).x;
  gl_FragColor = vec4( vec3(max(prevColor, dist)), 1.0 );
}
`;

const fs_jump = `
precision mediump float;

uniform vec2 resolution;
uniform vec2 lineStart;
uniform vec2 lineEnd;
uniform sampler2D tPrev;

float lineDist() {
  vec2 uv = gl_FragCoord.xy / resolution;
  if (lineStart == lineEnd) {
    return length(lineStart - uv);
  } else {
   vec2 delta = (lineEnd - lineStart);
    vec2 dir = uv - lineStart;
    float t = dot(dir, delta) / dot(delta,delta);
    if (t < 0. || t > 1.) {
      return min(length(uv - lineStart), length(uv - lineEnd));
    } else {
     return length(lineStart + t * delta - uv);
    }
   return 0.;
  }
}

void main() {
  vec2 uv = gl_FragCoord.xy / resolution;

  float dist = floor(10.*lineDist()) / 10.;
  gl_FragColor = vec4( vec3(dist), 1.0 );
}
`;

const fs_render_texture = `
precision mediump float;

uniform vec2 resolution;
uniform sampler2D tPrev;

void main() {
  vec2 uv = gl_FragCoord.xy / resolution;
  gl_FragColor = texture2D(tPrev, uv);
}

`;

const drawLineToBuffer = twgl.createProgramInfo(gl, [vs, fs_write_line]);
const drawTexture = twgl.createProgramInfo(gl, [vs, fs_render_texture]);

let toSave = false;

data.addButton({
  name: "Save Image",
  fn: () => {
    toSave = true;
  },
});

const saveImage = () => {
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
  toSave = false;
};

const width = 256;
const height = 256;

const generateUniforms = () => {
  return {
    resolution: [gl.canvas.width, gl.canvas.height],
    lineStart: game.currLine.start,
    lineEnd: game.currLine.end,
    pixelLineSize: 4,
    tPrev: frameBuffers.lightEmitters.attachments[0],
  };
};

console.log(gl);
const attachments = [
  {
    internalFormat: gl.RGBA32F,
    format: gl.RGBA,
    mag: gl.LINEAR,
    min: gl.LINEAR,
  },
];
const frameBuffers = {
  lightEmitters: twgl.createFramebufferInfo(gl, attachments, width, height),
  lightEmittersSpare: twgl.createFramebufferInfo(
    gl,
    attachments,
    width,
    height
  ),
  cascadeRT: twgl.createFramebufferInfo(gl, attachments, width, height),
  cascadeRTSpare: twgl.createFramebufferInfo(gl, attachments, width, height),
  finalCascadeRT: twgl.createFramebufferInfo(gl, attachments, width, height),
  finalCascadeRTSpare: twgl.createFramebufferInfo(
    gl,
    attachments,
    width,
    height
  ),
};

console.log(frameBuffers);
let linesCount = 0;

function render(time) {
  timeManager.tick();
  windowManager.update();
  inputState.update(game, input.getState());
  game.update();
  twgl.resizeCanvasToDisplaySize(gl.canvas);
  gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);

  if (game.lines.length > linesCount) {
    console.log("thing");
    linesCount++;

    gl.useProgram(drawLineToBuffer.program);
    twgl.setBuffersAndAttributes(gl, drawLineToBuffer, bufferInfo);
    twgl.bindFramebufferInfo(gl, frameBuffers.lightEmittersSpare);
    const uniforms = generateUniforms();
    uniforms.resolution = [
      frameBuffers.lightEmittersSpare.width,
      frameBuffers.lightEmittersSpare.height,
    ];
    twgl.setUniforms(drawLineToBuffer, uniforms);
    twgl.drawBufferInfo(gl, bufferInfo);
    [frameBuffers.lightEmitters, frameBuffers.lightEmittersSpare] = [
      frameBuffers.lightEmittersSpare,
      frameBuffers.lightEmitters,
    ];
  }
  gl.useProgram(drawLineToBuffer.program);
  twgl.setBuffersAndAttributes(gl, drawLineToBuffer, bufferInfo);
  twgl.setUniforms(drawLineToBuffer, generateUniforms());
  twgl.bindFramebufferInfo(gl);
  twgl.drawBufferInfo(gl, bufferInfo);

  if (toSave) {
    saveImage();
  }

  requestAnimationFrame(render);
}
requestAnimationFrame(render);
