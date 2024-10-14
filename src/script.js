import "./style.css";
import { WindowManager } from "./engine/window.js";
import { DataManager } from "./engine/data.js";
import Stats from "stats-js";
import { addCustomArrayMethods } from "./utils/array.js";
import * as twgl from "twgl.js";
import { State, StateMachine } from "./utils/stateMachine";
import { InputManager2 } from "./engine/input2.js";
import { TimeManager } from "./engine/time.js";
import calculateCascade from "./shaders/cascade.glsl";
import { createFramebufferInfo } from "./twgl/framebuffers.js";

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

const gl = document.getElementById("webgl").getContext("webgl2");

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
addNumberConfig("Start Depth", 4, 1, 5, 1);
addNumberConfig("End Depth", 0, 0, 4, 1);

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

const vs = `#version 300 es

in vec4 vPosition;

void main() {
  gl_Position = vPosition;
}
`;

const fs_constant_fill = `#version 300 es
precision highp float;

uniform vec4 color;

out vec4 outColor;

void main() {
  outColor = color;
}
`;

const fs_write_line = `#version 300 es
precision mediump float;

uniform vec2 resolution;
uniform float time;
uniform vec2 lineStart;
uniform vec2 lineEnd;
uniform float pixelLineSize;
uniform sampler2D tPrev;

out vec4 outColor;

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
  float prevColor = texture(tPrev, uv).x;
  outColor = vec4( vec3(max(prevColor, dist)), 1.0 );
}
`;

const fs_jump = `#version 300 es
precision mediump float;

uniform vec2 resolution;
uniform float jumpSize; 
uniform sampler2D tPrev;
uniform sampler2D tLine;

out vec4 outColor;

void main() {
  vec2 uv = gl_FragCoord.xy / resolution;
  
  vec3 prevClosestPos = texture(tPrev, uv).xyz;

  for (int i = -1; i <= 1; i++) {
    for (int j = -1; j <= 1; j++) {
      vec2 delta = vec2(float(i), float(j)) * jumpSize / resolution;
      vec2 sampleUv = uv + delta;
      vec3 closestPos = texture(tPrev, sampleUv).xyz;
      float lineVal = texture(tLine, sampleUv).r;

      if (lineVal > 0.1) {
        closestPos = vec3(sampleUv, 1.);
      }

      if (closestPos.z > 0.) {
        if (prevClosestPos.z > 0.) {
          if (length(closestPos.xy - uv) < length(prevClosestPos.xy - uv)) {
            prevClosestPos = closestPos;
          }
        } else {
          prevClosestPos = closestPos;
        }
      }
    }
  }
  outColor = vec4( prevClosestPos , 0.);
}
`;

const fs_render_closest = `#version 300 es
precision mediump float;

uniform vec2 resolution;
uniform sampler2D tPrev;

out vec4 outColor;

void main() {
  vec2 uv = gl_FragCoord.xy / resolution;
  float dist = length(texture(tPrev, uv).xy - uv);
  outColor = vec4(float(gl_FragCoord.x == resolution.x - 0.5), float(gl_FragCoord.y == resolution.y - 0.5), 0. ,1.);
  outColor = vec4(vec3(dist), 1.0);
}

`;

const fs_calculate_distance = `#version 300 es
precision mediump float;

uniform vec2 resolution;
uniform sampler2D tPrev;

out vec4 outColor;

void main() {
  vec2 uv = gl_FragCoord.xy / resolution;
  outColor = texture(tPrev, uv);
}

`;

const fs_render_texture = `#version 300 es
precision highp float;

uniform vec2 resolution;
uniform sampler2D tPrev;

out vec4 outColor;

void main() {
  vec2 uv = gl_FragCoord.xy / resolution;
  outColor = texture(tPrev, uv);
}
`;

const drawLineToBuffer = twgl.createProgramInfo(gl, [vs, fs_write_line]);
const renderTexture = twgl.createProgramInfo(gl, [vs, fs_render_texture]);
const calculateDistance = twgl.createProgramInfo(gl, [vs, fs_render_closest]);
const drawTexture = twgl.createProgramInfo(gl, [vs, fs_render_closest]);
const fillColor = twgl.createProgramInfo(gl, [vs, fs_constant_fill]);
const jumpFill = twgl.createProgramInfo(gl, [vs, fs_jump]);
const cascadeCalculate = twgl.createProgramInfo(gl, [vs, calculateCascade]);

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
const frameBuffers = {
  lightEmitters: twgl.createFramebufferInfo(
    gl,
    [
      {
        internalFormat: gl.RGBA8,
        format: gl.RGBA,
        mag: gl.NEAREST,
        min: gl.NEAREST,
        wrap: gl.CLAMP_TO_EDGE,
      },
    ],
    width,
    height
  ),
  distance: twgl.createFramebufferInfo(
    gl,
    [
      {
        internalFormat: gl.RGBA8,
        format: gl.RGBA,
        mag: gl.LINEAR,
        min: gl.LINEAR,
        wrap: gl.CLAMP_TO_EDGE,
      },
    ],
    width,
    height
  ),
  fill: twgl.createFramebufferInfo(
    gl,
    [
      {
        internalFormat: gl.RGBA8,
        format: gl.RGBA,
        mag: gl.NEAREST,
        min: gl.NEAREST,
        wrap: gl.CLAMP_TO_EDGE,
      },
    ],
    width,
    height
  ),
  spare: twgl.createFramebufferInfo(
    gl,
    [
      {
        internalFormat: gl.RGBA8,
        format: gl.RGBA,
        mag: gl.NEAREST,
        min: gl.NEAREST,
        wrap: gl.CLAMP_TO_EDGE,
      },
    ],
    width,
    height
  ),
  cascadeRT: twgl.createFramebufferInfo(
    gl,
    [
      {
        internalFormat: gl.RGBA8,
        format: gl.RGBA,
        mag: gl.LINEAR,
        min: gl.LINEAR,
        wrap: gl.CLAMP_TO_EDGE,
      },
    ],
    width,
    2 * height
  ),
  spareCascadeRT: twgl.createFramebufferInfo(
    gl,
    [
      {
        internalFormat: gl.RGBA8,
        format: gl.RGBA,
        mag: gl.LINEAR,
        min: gl.LINEAR,
        wrap: gl.CLAMP_TO_EDGE,
      },
    ],
    width,
    2 * height
  ),
  finalCascadeRT: twgl.createFramebufferInfo(
    gl,
    [
      {
        internalFormat: gl.RGBA8,
        format: gl.RGBA,
        mag: gl.LINEAR,
        min: gl.LINEAR,
        wrap: gl.CLAMP_TO_EDGE,
      },
    ],
    width,
    2 * height
  ),
  finalCascadeRTSpare: twgl.createFramebufferInfo(
    gl,
    [
      {
        internalFormat: gl.RGBA8,
        format: gl.RGBA,
        mag: gl.LINEAR,
        min: gl.LINEAR,
        wrap: gl.CLAMP_TO_EDGE,
      },
    ],
    width,
    2 * height
  ),
};
let linesCount = 0;

function renderTo(
  gl,
  programInfo,
  bufferInfo,
  uniforms,
  targetFrameBuffer = null
) {
  gl.useProgram(programInfo.program);
  twgl.setBuffersAndAttributes(gl, programInfo, bufferInfo);
  twgl.setUniforms(programInfo, uniforms);
  twgl.bindFramebufferInfo(gl, targetFrameBuffer);
  twgl.drawBufferInfo(gl, bufferInfo);
}

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

    renderTo(
      gl,
      drawLineToBuffer,
      bufferInfo,
      {
        resolution: [frameBuffers.spare.width, frameBuffers.spare.height],
        lineStart: game.currLine.start,
        lineEnd: game.currLine.end,
        pixelLineSize: 4,
        tPrev: frameBuffers.lightEmitters.attachments[0],
      },
      frameBuffers.spare
    );
    [frameBuffers.lightEmitters, frameBuffers.spare] = [
      frameBuffers.spare,
      frameBuffers.lightEmitters,
    ];
  }

  renderTo(
    gl,
    fillColor,
    bufferInfo,
    { color: [0, 0, 0, 0] },
    frameBuffers.spare
  );
  [frameBuffers.fill, frameBuffers.spare] = [
    frameBuffers.spare,
    frameBuffers.fill,
  ];

  for (var i = Math.ceil(Math.log2(width)); i >= 0; i--) {
    renderTo(
      gl,
      jumpFill,
      bufferInfo,
      {
        resolution: [frameBuffers.fill.width, frameBuffers.fill.height],
        jumpSize: 1 << i,
        tPrev: frameBuffers.fill.attachments[0],
        tLine: frameBuffers.lightEmitters.attachments[0],
      },
      frameBuffers.spare
    );
    [frameBuffers.fill, frameBuffers.spare] = [
      frameBuffers.spare,
      frameBuffers.fill,
    ];
  }

  renderTo(
    gl,
    calculateDistance,
    bufferInfo,
    {
      resolution: [frameBuffers.fill.width, frameBuffers.fill.height],
      tPrev: frameBuffers.fill.attachments[0],
    },
    frameBuffers.distance
  );

  const startDepth = 4;
  const finalDepth = 0;
  let depth = startDepth;

  while (depth >= finalDepth) {
    const baseDistance = (1 * Math.SQRT2) / frameBuffers.cascadeRT.width;
    const multiplier = Math.log2(Math.SQRT2 / baseDistance) / startDepth;

    const minDistance = baseDistance * Math.pow(2, multiplier * (depth - 1));
    const maxDistance = baseDistance * Math.pow(2, multiplier * depth);
    const deeperMaxDistance =
      baseDistance * Math.pow(2, multiplier * (depth + 1));
    renderTo(
      gl,
      cascadeCalculate,
      bufferInfo,
      {
        maxSteps: 32,
        tDistance: frameBuffers.distance.attachments[0],
        tColor: frameBuffers.lightEmitters.attachments[0],
        startDepth: startDepth,
        current: {
          depth: depth,
          minDistance: minDistance,
          maxDistance: maxDistance,
        },
        deeper: {
          depth: depth,
          minDistance: maxDistance,
          maxDistance: deeperMaxDistance,
        },
        debug: {
          continousBilinearFix: false,
          finalDepth: finalDepth,
          renderMode: 0,
        },
        tPrevCascade: frameBuffers.cascadeRT.attachments[0],
      },
      frameBuffers.spareCascadeRT
    );

    [frameBuffers.spareCascadeRT, frameBuffers.cascadeRT] = [
      frameBuffers.cascadeRT,
      frameBuffers.spareCascadeRT,
    ];
    depth--;
  }

  renderTo(gl, drawLineToBuffer, bufferInfo, {
    resolution: [gl.canvas.width, gl.canvas.height],
    lineStart: game.currLine.start,
    lineEnd: game.currLine.end,
    pixelLineSize: 4,
    tPrev: frameBuffers.lightEmitters.attachments[0],
  });

  renderTo(gl, drawTexture, bufferInfo, {
    resolution: [gl.canvas.width, gl.canvas.height],
    tPrev: frameBuffers.fill.attachments[0],
  });

  renderTo(gl, renderTexture, bufferInfo, {
    resolution: [gl.canvas.width, gl.canvas.height],
    tPrev: frameBuffers.lightEmitters.attachments[0],
  });

  renderTo(gl, fillColor, bufferInfo, {
    color: [1, 1, 0, 1],
  });

  if (toSave) {
    saveImage();
  }

  requestAnimationFrame(render);
}
requestAnimationFrame(render);
