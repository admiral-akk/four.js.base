import "./style.css";
import { WindowManager } from "./engine/window.js";
import { DataManager } from "./engine/data.js";
import Stats from "stats-js";
import { addCustomArrayMethods } from "./utils/array.js";
import * as twgl from "twgl.js";
import { State, StateMachine } from "./utils/stateMachine";
import { InputManager2 } from "./engine/input2.js";
import { TimeManager } from "./engine/time.js";
import calculateCascade from "./shaders/cascade.fs";
import renderCascade from "./shaders/renderCascade.fs";
import calculateQuadCascade from "./shaders/quadCascade.fs";
import renderQuadCascade from "./shaders/renderQuadCascade.fs";

addCustomArrayMethods();
var stats = new Stats();
stats.showPanel(0); // 0: fps, 1: ms, 2: mb, 3+: custom
document.body.appendChild(stats.dom);

// Time

const timeManager = new TimeManager();

// Data Storage

const data = new DataManager();
data.init();

// Canvas Manager

const windowManager = new WindowManager(1);

// Render Pipeline

function getRandomInt({ min = 0, max, steps = 2 }) {
  return (Math.floor(steps * Math.random()) / (steps - 1)) * (max - min) + min;
}
const gl = document.getElementById("webgl").getContext("webgl2");
twgl.addExtensionsToContext(gl);

function renderTo(
  gl,
  programInfo,
  bufferInfo,
  uniforms,
  targetFrameBuffer = null,
  targetDimensions = null
) {
  gl.useProgram(programInfo.program);
  twgl.setBuffersAndAttributes(gl, programInfo, bufferInfo);
  twgl.setUniforms(programInfo, uniforms);
  twgl.bindFramebufferInfo(gl, targetFrameBuffer);
  if (targetDimensions) {
    gl.viewport(
      targetDimensions[0],
      targetDimensions[1],
      targetDimensions[2],
      targetDimensions[3]
    );
  }
  twgl.drawBufferInfo(gl, bufferInfo);
}

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

// Input handler

const input = new InputManager2(windowManager, timeManager);

// Input State Machine

class Command {
  constructor() {
    this.type = Object.getPrototypeOf(this).constructor;
  }
}

class ClearCommand extends Command {}
class TickCommand extends Command {
  constructor(delta) {
    super();
    this.delta = delta;
  }
}

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

class UpdateColorCommand extends Command {
  constructor(color) {
    super();
    this.color = color;
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
  constructor(data) {
    this.commands = [];
    this.data = data;
    data.listeners.push(this);
    if (this.data.state.ball) {
      this.data.state.ball.size = 0.1;
    }
    if (!Array.isArray(this.data.state.lines)) {
      this.data.state.lines = [];
      this.data.state.balls = this.setupBalls();
      this.data.state.ball = {
        position: [0, 0],
        color: [1, 1, 1, 1],
        size: 0.1,
        velocity: [0.8, 0.4],
      };
      this.data.saveData();
    }
    this.activeColor = [1, 1, 1, 1];
    this.currLine = { start: [0, 0], end: [0, 0], color: this.activeColor };
  }

  setupBalls() {
    const balls = [];
    for (var i = 0; i < 200; i++) {
      balls.push({
        position: [
          getRandomInt({ max: 0.2, min: -0.2, steps: 40 }),
          getRandomInt({ max: 0.9, min: -0.9, steps: 100 }),
        ],
        color: [0, 0, 0, 1],
        size: getRandomInt({ max: 0.02, min: 0.01, steps: 5 }),
      });
    }
    return balls;
  }

  startLine(pos) {
    this.currLine = { start: pos, end: pos, color: this.activeColor };
  }

  updateLine(pos) {
    this.currLine.end = pos;
  }

  endLine(pos) {
    this.currLine.end = pos;
    this.data.state.lines.push(this.currLine);
    this.currLine = { start: [0, 0], end: [0, 0], color: this.activeColor };
    this.data.saveData();
  }

  configUpdated() {
    if (!this.data.state.lines) {
      this.data.state.lines = [];
    }
  }

  updateColor(color) {
    this.activeColor = structuredClone(color);
    this.activeColor.push(1);
    this.currLine.color = this.activeColor;
  }

  moveBall(delta) {
    const { ball } = this.data.state;
    ball.position[0] += delta * ball.velocity[0];
    ball.position[1] += delta * ball.velocity[1];

    if (Math.abs(ball.position[0]) + ball.size >= 1) {
      ball.velocity[0] *= -1;
    }
    if (Math.abs(ball.position[1]) + ball.size >= 1) {
      ball.velocity[1] *= -1;
    }
  }

  applyCommand(command) {
    switch (command.type) {
      case TickCommand:
        const { delta } = command;
        const { ball, balls } = this.data.state;
        this.moveBall(delta);
        for (let i = 0; i < balls.length; i++) {
          const other = balls[i];
          other.color[0] = Math.max(0, other.color[0] - 0.4 * delta);
          other.color[1] = Math.max(0, other.color[1] - 0.4 * delta);
          other.color[2] = Math.max(0, other.color[2] - 0.4 * delta);
          const diff = [
            other.position[0] - ball.position[0],
            other.position[1] - ball.position[1],
          ];
          const dist = Math.sqrt(diff[0] * diff[0] + diff[1] * diff[1]);
          if (dist < 0.2) {
            other.color[0] = ball.color[0];
            other.color[1] = ball.color[1];
            other.color[2] = ball.color[2];
          }
          this.data.saveData();
        }
        break;
      case ClearCommand:
        this.clearLines();
        break;
      case UpdateColorCommand:
        this.updateColor(command.color);
        break;
      case StartDragCommand:
        {
          {
            this.data.state.isDragging = true;
            this.startLine(clipToScreenSpace(command.start));
          }
        }
        break;
      case DragCommand:
        {
          this.data.state.isDragging = true;
          this.updateLine(clipToScreenSpace(command.curr));
        }
        break;
      case LineCommand:
        {
          this.data.state.isDragging = false;
          this.endLine(clipToScreenSpace(command.end));
        }
        break;
      default:
        break;
    }
  }

  update() {
    this.commands.push(new TickCommand(0.04));
    this.commands.forEach((command) => {
      this.applyCommand(command);
    });
    this.commands.length = 0;
  }
}

const game = new MyGame(data);

// Data Storage Layer

// Draw Lines

const vs = `#version 300 es
in vec2 position;
void main() {
  gl_Position = vec4(position, 0.0, 1.0);
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
uniform vec4 color;
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
  outColor = mix(texture(tPrev, uv).xyzw, color.rgba,  dist);
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
      float lineVal = texture(tLine, sampleUv).a;

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
uniform vec4 renderTarget;
uniform sampler2D tPrev;

out vec4 outColor;

void main() {
  vec2 uv = gl_FragCoord.xy / resolution;
  vec2 targetUv = (renderTarget.zw - renderTarget.xy) * uv + renderTarget.xy;
  outColor = texture(tPrev, targetUv).rgba;
}
`;

const fs_apply_gamma = `#version 300 es
precision highp float;

uniform vec2 resolution;
uniform sampler2D tPrev;

out vec4 outColor;

void main() {
  vec2 uv = gl_FragCoord.xy / resolution;
  outColor = pow(texture(tPrev, uv), vec4(1./2.2));
}
`;

const drawLineToBuffer = twgl.createProgramInfo(gl, [vs, fs_write_line]);
const renderTexture = twgl.createProgramInfo(gl, [vs, fs_render_texture]);
const calculateDistance = twgl.createProgramInfo(gl, [vs, fs_render_closest]);
const drawTexture = twgl.createProgramInfo(gl, [vs, fs_render_closest]);
const fillColor = twgl.createProgramInfo(gl, [vs, fs_constant_fill]);
const jumpFill = twgl.createProgramInfo(gl, [vs, fs_jump]);
const applyGamma = twgl.createProgramInfo(gl, [vs, fs_apply_gamma]);
const cascadeCalculate = twgl.createProgramInfo(gl, [vs, calculateCascade]);
const cascadeRender = twgl.createProgramInfo(gl, [vs, renderCascade]);
const cascadeQuadCalculate = twgl.createProgramInfo(gl, [
  vs,
  calculateQuadCascade,
]);
const cascadeQuadRender = twgl.createProgramInfo(gl, [vs, renderQuadCascade]);

function drawToBuffer(time, buffer, size, game) {
  time += 100000;
  const vs_instance = `#version 300 es
    in vec2 position;
    in vec4 color;
    in mat4 matrix;
    
    out vec4 v_color;
      void main() {
        // Multiply the position by the matrix.
        gl_Position = matrix * vec4(position, 0.0, 1.0);
        v_color = color;
      }
    `;
  const fs_instance_color = `#version 300 es

    precision mediump float;
    
    in vec4 v_color;
    
    out vec4 outColor;
    void main() {
      outColor = v_color;
    }`;

  const instanceColor = twgl.createProgramInfo(gl, [
    vs_instance,
    fs_instance_color,
  ]);

  const m4 = twgl.m4;
  const matrices = [];
  const colors = [];

  const { ball, balls } = game.data.state;

  for (let i = 0; i < balls.length; i++) {
    const b = balls[i];
    const scale = m4.scaling([b.size, b.size, b.size]);
    const translation = m4.translation([
      b.position[0] / b.size,
      b.position[1] / b.size,
      0,
    ]);

    const mat = m4.multiply(scale, translation);
    mat.forEach((v, i) => {
      matrices.push(v);
    });
    colors.push(b.color[0], b.color[1], b.color[2], 1);
  }

  const scale = m4.scaling([ball.size, ball.size, ball.size]);
  const translation = m4.translation([
    ball.position[0] / ball.size,
    ball.position[1] / ball.size,
    0,
  ]);

  const mat = m4.multiply(scale, translation);
  mat.forEach((v, i) => {
    matrices.push(v);
  });
  colors.push(ball.color[0], ball.color[1], ball.color[2], 1);

  const vertexData = [];

  const numPts = 32;

  for (var i = 0; i <= numPts; i++) {
    vertexData.push(
      Math.sin((i * Math.PI * 2) / numPts),
      Math.cos((i * Math.PI * 2) / numPts)
    );
  }

  const arrays2 = {
    position: {
      numComponents: 2,
      data: vertexData,
    },
    color: {
      numComponents: 4,
      data: colors,
      divisor: 1,
    },
    matrix: {
      numComponents: 16,
      data: matrices,
      divisor: 1,
    },
  };
  const bufferInfo = twgl.createBufferInfoFromArrays(gl, arrays2);
  const vertexArrayInfo = twgl.createVertexArrayInfo(
    gl,
    instanceColor,
    bufferInfo
  );

  gl.useProgram(instanceColor.program);
  twgl.setBuffersAndAttributes(gl, instanceColor, vertexArrayInfo);
  twgl.setUniforms(instanceColor, {});
  twgl.bindFramebufferInfo(gl, buffer);
  twgl.drawBufferInfo(
    gl,
    vertexArrayInfo,
    gl.TRIANGLE_FAN,
    vertexArrayInfo.numElements,
    0,
    balls.length + 1
  );
}

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

const width = 8 * 128;
const height = width;
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
        auto: true,
      },
    ],
    width,
    height
  ),
  lightEmittersWithCurrent: twgl.createFramebufferInfo(
    gl,
    [
      {
        internalFormat: gl.RGBA8,
        format: gl.RGBA,
        mag: gl.NEAREST,
        min: gl.NEAREST,
        wrap: gl.CLAMP_TO_EDGE,
        auto: true,
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
        auto: true,
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
        auto: true,
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
        auto: true,
      },
    ],
    width,
    height
  ),
  cascadeRT: twgl.createFramebufferInfo(
    gl,
    [
      {
        internalFormat: gl.RGBA32F,
        format: gl.RGBA,
        mag: gl.LINEAR,
        min: gl.LINEAR,
        wrap: gl.CLAMP_TO_EDGE,
        auto: true,
      },
    ],
    2 * width,
    height
  ),
  spareCascadeRT: twgl.createFramebufferInfo(
    gl,
    [
      {
        internalFormat: gl.RGBA32F,
        format: gl.RGBA,
        mag: gl.LINEAR,
        min: gl.LINEAR,
        wrap: gl.CLAMP_TO_EDGE,
        auto: true,
      },
    ],
    2 * width,
    height
  ),
  linearCascadeRT: twgl.createFramebufferInfo(
    gl,
    [
      {
        internalFormat: gl.RGBA32F,
        format: gl.RGBA,
        mag: gl.LINEAR,
        min: gl.LINEAR,
        wrap: gl.CLAMP_TO_EDGE,
        auto: true,
      },
    ],
    2 * width,
    height
  ),
  quadCascadeRT: twgl.createFramebufferInfo(
    gl,
    [
      {
        internalFormat: gl.RGBA32F,
        format: gl.RGBA,
        mag: gl.LINEAR,
        min: gl.LINEAR,
        wrap: gl.CLAMP_TO_EDGE,
        auto: true,
      },
    ],
    width,
    height
  ),
  spareQuadCascadeRT: twgl.createFramebufferInfo(
    gl,
    [
      {
        internalFormat: gl.RGBA32F,
        format: gl.RGBA,
        mag: gl.LINEAR,
        min: gl.LINEAR,
        wrap: gl.CLAMP_TO_EDGE,
        auto: true,
      },
    ],
    width,
    height
  ),
  finalCascadeRT: twgl.createFramebufferInfo(
    gl,
    [
      {
        internalFormat: gl.RGBA32F,
        format: gl.RGBA,
        mag: gl.LINEAR,
        min: gl.LINEAR,
        wrap: gl.CLAMP_TO_EDGE,
        auto: true,
      },
    ],
    width,
    height
  ),
  finalCascadeRTSpare: twgl.createFramebufferInfo(
    gl,
    [
      {
        internalFormat: gl.RGBA32F,
        format: gl.RGBA,
        mag: gl.LINEAR,
        min: gl.LINEAR,
        wrap: gl.CLAMP_TO_EDGE,
        auto: true,
      },
    ],
    width,
    height
  ),
};
let linesCount = 0;

data.addColor({
  displayName: "Color",
  defaultValue: [1, 1, 1],
  callback: (color) => {
    game.commands.push(new UpdateColorCommand(color));
  },
});

function render(time) {
  timeManager.tick();
  windowManager.update();
  inputState.update(game, input.getState());
  game.update();
  twgl.resizeCanvasToDisplaySize(gl.canvas);
  gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);

  const lines = game.data.state.lines;
  if (lines.length < linesCount) {
    renderTo(
      gl,
      fillColor,
      bufferInfo,
      { color: [0, 0, 0, 0] },
      frameBuffers.lightEmitters
    );
    linesCount = 0;
  }

  while (lines.length > linesCount) {
    renderTo(
      gl,
      drawLineToBuffer,
      bufferInfo,
      {
        resolution: [frameBuffers.spare.width, frameBuffers.spare.height],
        lineStart: lines[linesCount].start,
        lineEnd: lines[linesCount].end,
        color: lines[linesCount].color,
        pixelLineSize: 16,
        tPrev: frameBuffers.lightEmitters.attachments[0],
      },
      frameBuffers.spare
    );
    [frameBuffers.lightEmitters, frameBuffers.spare] = [
      frameBuffers.spare,
      frameBuffers.lightEmitters,
    ];
    linesCount++;
  }

  if (game.data.state.isDragging) {
    renderTo(
      gl,
      drawLineToBuffer,
      bufferInfo,
      {
        resolution: [
          frameBuffers.lightEmitters.width,
          frameBuffers.lightEmitters.height,
        ],
        lineStart: game.currLine.start,
        lineEnd: game.currLine.end,
        pixelLineSize: 4,
        color: game.currLine.color,
        tPrev: frameBuffers.lightEmitters.attachments[0],
      },
      frameBuffers.lightEmittersWithCurrent
    );
  } else {
    renderTo(
      gl,
      renderTexture,
      bufferInfo,
      {
        renderTarget: [0, 0, 1, 1],
        resolution: [
          frameBuffers.lightEmitters.width,
          frameBuffers.lightEmitters.height,
        ],
        tPrev: frameBuffers.lightEmitters.attachments[0],
      },
      frameBuffers.lightEmittersWithCurrent
    );
  }

  renderTo(
    gl,
    fillColor,
    bufferInfo,
    { color: [0, 0, 0, 0] },
    frameBuffers.lightEmittersWithCurrent
  );

  drawToBuffer(time, frameBuffers.lightEmittersWithCurrent, 0.05, game);

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
        tLine: frameBuffers.lightEmittersWithCurrent.attachments[0],
      },
      frameBuffers.spare
    );
    [frameBuffers.fill, frameBuffers.spare] = [
      frameBuffers.spare,
      frameBuffers.fill,
    ];
  }

  const quadEnabled = data.addNumber({
    displayName: "Quad Sample",
    defaultValue: false,
  }).value;

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

  const startDepth = data.addNumber({
    displayName: "Start Depth",
    defaultValue: Math.log2(width) - 2,
    min: 1,
    max: Math.log2(width) - 2,
    step: 1,
  }).value;
  const finalDepth = data.addNumber({
    displayName: "Final Depth",
    defaultValue: 0,
    min: 0,
    max: 8,
    step: 1,
  }).value;
  const initialDepth = data.addNumber({
    displayName: "Initial Depth",
    defaultValue: Math.log2(width) - 2,
    min: 1,
    max: Math.log2(width) - 2,
    step: 1,
  }).value;
  let depth = initialDepth;

  renderTo(
    gl,
    fillColor,
    bufferInfo,
    { color: [0, 0, 0, 0] },
    frameBuffers.cascadeRT
  );
  renderTo(
    gl,
    fillColor,
    bufferInfo,
    { color: [0, 0, 0, 0] },
    frameBuffers.quadCascadeRT
  );

  const maxProbeCount = frameBuffers.cascadeRT.width;
  while (depth >= finalDepth) {
    if (!quadEnabled) {
      const shortestDistance = (10 * Math.SQRT2) / frameBuffers.cascadeRT.width;
      const longestDistance = Math.SQRT2;

      const multiplier2 = Math.log2(longestDistance / shortestDistance);

      const minDistance =
        depth === 0
          ? 0
          : shortestDistance *
            Math.pow(2, (multiplier2 * (depth - 1)) / startDepth);
      const maxDistance =
        depth == startDepth
          ? Math.SQRT2
          : shortestDistance * Math.pow(2, (multiplier2 * depth) / startDepth);
      const deeperMaxDistance =
        shortestDistance *
        Math.pow(2, (multiplier2 * (depth + 1)) / startDepth);

      renderTo(
        gl,
        cascadeCalculate,
        bufferInfo,
        {
          renderResolution: [
            frameBuffers.finalCascadeRT.width,
            frameBuffers.finalCascadeRT.height,
          ],
          resolution: [
            frameBuffers.cascadeRT.width,
            frameBuffers.cascadeRT.height,
          ],
          maxSteps: data.addNumber({
            displayName: "Max Steps",
            defaultValue: 32,
            min: 1,
            max: 128,
            step: 1,
          }).value,
          tDistance: frameBuffers.distance.attachments[0],
          tColor: frameBuffers.lightEmittersWithCurrent.attachments[0],
          startDepth: startDepth,
          current: {
            depth: depth,
            minDistance: minDistance,
            maxDistance: maxDistance,
          },
          deeper: {
            depth: depth,
            minDistance:
              (data.addNumber({
                displayName: "Overlap Factor",
                defaultValue: 0,
                min: 0,
                max: 1,
                step: 0.1,
              }).value +
                1) *
              maxDistance,
            maxDistance: deeperMaxDistance,
          },
          debug: {
            continousBilinearFix: data.addNumber({
              displayName: "Continuous Bilinear Fix",
              defaultValue: true,
            }).value,
            cornerProbes: data.addNumber({
              displayName: "Corner Probes",
              defaultValue: true,
            }).value,
            showSampleUv: data.addNumber({
              displayName: "Show Sample Uv",
              defaultValue: false,
            }).value,
            showProbeUv: data.addNumber({
              displayName: "Show Probe Uv",
              defaultValue: false,
            }).value,
            showDirection: data.addNumber({
              displayName: "Show Direction Uv",
              defaultValue: false,
            }).value,
            noFix: data.addNumber({
              displayName: "No Fix",
              defaultValue: false,
            }).value,
            quadSample: data.addNumber({
              displayName: "Quad Sample",
              defaultValue: false,
            }).value,
          },
          tPrevCascade: frameBuffers.cascadeRT.attachments[0],
        },
        frameBuffers.spareCascadeRT
      );

      [frameBuffers.spareCascadeRT, frameBuffers.cascadeRT] = [
        frameBuffers.cascadeRT,
        frameBuffers.spareCascadeRT,
      ];
    } else {
      const shortestDistance = (10 * Math.SQRT2) / frameBuffers.cascadeRT.width;
      const longestDistance = Math.SQRT2;

      const multiplier2 = Math.log2(longestDistance / shortestDistance);

      const minDistance =
        depth === 0
          ? 0
          : shortestDistance *
            Math.pow(2, (multiplier2 * (depth - 1)) / startDepth);
      const maxDistance =
        depth == startDepth
          ? Math.SQRT2
          : shortestDistance * Math.pow(2, (multiplier2 * depth) / startDepth);
      const deeperMaxDistance =
        shortestDistance *
        Math.pow(2, (multiplier2 * (depth + 1)) / startDepth);

      renderTo(
        gl,
        cascadeQuadCalculate,
        bufferInfo,
        {
          renderResolution: [gl.canvas.width, gl.canvas.height],
          resolution: [
            frameBuffers.quadCascadeRT.width,
            frameBuffers.quadCascadeRT.height,
          ],
          maxSteps: data.addNumber({
            displayName: "Max Steps",
            defaultValue: 32,
            min: 1,
            max: 128,
            step: 1,
          }).value,
          tDistance: frameBuffers.distance.attachments[0],
          tColor: frameBuffers.lightEmittersWithCurrent.attachments[0],
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
            continousBilinearFix: data.addNumber({
              displayName: "Continuous Bilinear Fix",
              defaultValue: true,
            }).value,
            cornerProbes: data.addNumber({
              displayName: "Corner Probes",
              defaultValue: true,
            }).value,
            showSampleUv: data.addNumber({
              displayName: "Show Sample Uv",
              defaultValue: false,
            }).value,
            showProbeUv: data.addNumber({
              displayName: "Show Probe Uv",
              defaultValue: false,
            }).value,
            showDirection: data.addNumber({
              displayName: "Show Direction Uv",
              defaultValue: false,
            }).value,
            noFix: data.addNumber({
              displayName: "No Fix",
              defaultValue: false,
            }).value,
            quadSample: data.addNumber({
              displayName: "Quad Sample",
              defaultValue: false,
            }).value,
            finalDepth: data.addNumber({
              displayName: "Final Depth",
              defaultValue: 0,
              min: 0,
              max: 8,
              step: 1,
            }).value,
          },
          tPrevCascade: frameBuffers.quadCascadeRT.attachments[0],
        },
        frameBuffers.spareQuadCascadeRT
      );
      [frameBuffers.spareQuadCascadeRT, frameBuffers.quadCascadeRT] = [
        frameBuffers.quadCascadeRT,
        frameBuffers.spareQuadCascadeRT,
      ];
    }
    depth--;
  }
  renderTo(
    gl,
    renderTexture,
    bufferInfo,
    {
      resolution: [
        frameBuffers.linearCascadeRT.width,
        frameBuffers.linearCascadeRT.height,
      ],
      renderTarget: [0, 0, 1, 1],
      tPrev: frameBuffers.cascadeRT.attachments[0],
    },
    frameBuffers.linearCascadeRT
  );

  renderTo(gl, drawTexture, bufferInfo, {
    resolution: [gl.canvas.width, gl.canvas.height],
    tPrev: frameBuffers.fill.attachments[0],
  });
  renderTo(gl, renderTexture, bufferInfo, {
    resolution: [gl.canvas.width, gl.canvas.height],
    tPrev: frameBuffers.cascadeRT.attachments[0],
  });

  renderTo(gl, cascadeRender, bufferInfo, {
    resolution: [gl.canvas.width, gl.canvas.height],
    tPrevCascade: frameBuffers.cascadeRT.attachments[0],
  });

  switch (
    data.addEnum({
      displayName: "Render Mode",
      defaultValue: "Render Cascade",
      options: ["Render Cascade", "Cascade Levels"],
    }).value
  ) {
    case "Cascade Levels":
      if (!quadEnabled) {
        renderTo(
          gl,
          renderTexture,
          bufferInfo,
          {
            renderTarget: [
              data.addNumber({
                displayName: "minx",
                defaultValue: 0,
                min: 0,
                max: 1,
                step: 0.01,
              }).value,
              data.addNumber({
                displayName: "miny",
                defaultValue: 0,
                min: 0,
                max: 1,
                step: 0.01,
              }).value,
              data.addNumber({
                displayName: "maxx",
                defaultValue: 1,
                min: 0,
                max: 1,
                step: 0.01,
              }).value,
              data.addNumber({
                displayName: "maxy",
                defaultValue: 1,
                min: 0,
                max: 1,
                step: 0.01,
              }).value,
            ],
            resolution: [
              frameBuffers.finalCascadeRT.width,
              frameBuffers.finalCascadeRT.height,
            ],
            tPrev: frameBuffers.linearCascadeRT.attachments[0],
          },
          frameBuffers.finalCascadeRT
        );

        renderTo(gl, applyGamma, bufferInfo, {
          resolution: [gl.canvas.width, gl.canvas.height],
          tPrev: frameBuffers.finalCascadeRT.attachments[0],
        });
      } else {
        renderTo(
          gl,
          renderTexture,
          bufferInfo,
          {
            renderTarget: [
              data.addNumber({
                displayName: "minx",
                defaultValue: 0,
                min: 0,
                max: 1,
                step: 0.01,
              }).value,
              data.addNumber({
                displayName: "miny",
                defaultValue: 0,
                min: 0,
                max: 1,
                step: 0.01,
              }).value,
              data.addNumber({
                displayName: "maxx",
                defaultValue: 1,
                min: 0,
                max: 1,
                step: 0.01,
              }).value,
              data.addNumber({
                displayName: "maxy",
                defaultValue: 1,
                min: 0,
                max: 1,
                step: 0.01,
              }).value,
            ],
            resolution: [
              frameBuffers.quadCascadeRT.width,
              frameBuffers.quadCascadeRT.height,
            ],
            tPrev: frameBuffers.quadCascadeRT.attachments[0],
          },
          frameBuffers.spareQuadCascadeRT
        );

        renderTo(gl, applyGamma, bufferInfo, {
          resolution: [gl.canvas.width, gl.canvas.height],
          tPrev: frameBuffers.spareQuadCascadeRT.attachments[0],
        });
      }
      break;
    case "Render Cascade":
    default:
      if (!quadEnabled) {
        renderTo(gl, cascadeRender, bufferInfo, {
          resolution: [gl.canvas.width, gl.canvas.height],
          tPrevCascade: frameBuffers.linearCascadeRT.attachments[0],
        });
      } else {
        renderTo(gl, cascadeQuadRender, bufferInfo, {
          resolution: [gl.canvas.width, gl.canvas.height],
          tPrevCascade: frameBuffers.quadCascadeRT.attachments[0],
        });
      }
      break;
  }

  // drawToBuffer(time, null, 0.05, game);

  //drawToBuffer(time, null, 0.03);
  if (toSave) {
    saveImage();
  }

  requestAnimationFrame(render);
}
requestAnimationFrame(render);
