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

const vs = `
attribute vec4 position;

void main() {
  gl_Position = position;
}
`;
const fs = `
precision mediump float;

uniform vec2 resolution;
uniform float time;

void main() {
  vec2 uv = gl_FragCoord.xy / resolution;
  float color = 0.0;
  // lifted from glslsandbox.com
  color += sin( uv.x * cos( time / 3.0 ) * 60.0 ) + cos( uv.y * cos( time / 2.80 ) * 10.0 );
  color += sin( uv.y * sin( time / 2.0 ) * 40.0 ) + cos( uv.x * sin( time / 1.70 ) * 40.0 );
  color += sin( uv.x * sin( time / 1.0 ) * 10.0 ) + sin( uv.y * sin( time / 3.50 ) * 80.0 );
  color *= sin( time / 10.0 ) * 0.5;

  gl_FragColor = vec4( vec3(color), 1.0 );
}
`;
const programInfo = twgl.createProgramInfo(gl, [vs, fs]);

const arrays = {
  position: {
    numComponents: 3,
    data: [-1, -1, 0, 1, -1, 0, -1, 1, 0, -1, 1, 0, 1, -1, 0, 1, 1, 0],
  },
};
const bufferInfo = twgl.createBufferInfoFromArrays(gl, arrays);

const width = 256;
const height = 256;

const frameBuffers = {
  cascadeRT: twgl.createFramebufferInfo(gl, null, width, height),
  cascadeRTSpare: twgl.createFramebufferInfo(gl, null, width, height),
  finalCascadeRT: twgl.createFramebufferInfo(gl, null, width, height),
  finalCascadeRTSpare: twgl.createFramebufferInfo(gl, null, width, height),
};

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
          this.updateLine(clipToScreenSpace(command.end));
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

function render(time) {
  timeManager.tick();
  windowManager.update();
  inputState.update(game, input.getState());
  game.update();
  twgl.resizeCanvasToDisplaySize(gl.canvas);
  gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);

  const uniforms = {
    time: time * 0.001,
    resolution: [gl.canvas.width, gl.canvas.height],
  };

  gl.useProgram(programInfo.program);
  twgl.setBuffersAndAttributes(gl, programInfo, bufferInfo);
  twgl.setUniforms(programInfo, uniforms);
  twgl.bindFramebufferInfo(gl);
  twgl.drawBufferInfo(gl, bufferInfo);

  requestAnimationFrame(render);
}
requestAnimationFrame(render);
