import "./style.css";
import { WindowManager } from "./engine/window.js";
import { DataManager, enumConfig, numberConfig } from "./engine/data.js";
import Stats from "stats-js";
import { addCustomArrayMethods } from "./utils/array.js";
import * as twgl from "twgl.js";

addCustomArrayMethods();

const windowManager = new WindowManager(1);
var stats = new Stats();
stats.showPanel(0); // 0: fps, 1: ms, 2: mb, 3+: custom
document.body.appendChild(stats.dom);
const canvas = document.getElementById("webgl");
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

  gl_FragColor = vec4( uv, 0., 1.0 );
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

const defaultData = {
  state: {},
  config: {
    myEnum: enumConfig("My Enum", "v", ["1", "2", "3", "v"]),
    myNum: numberConfig("My Num", 0, -1, 10, 0.1),
  },
};

const data = new DataManager(defaultData);
data.init();

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

function render(time) {
  windowManager.update();
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
/*

const time = new TimeManager();
const loader = generateLoadingManager();
const input = new InputManager(windowManager, time);
const renderer = new CustomerRenderer(windowManager);

const config = {
  fps: 60,
  gameRate: 120,
};

const engine = new GameEngine(
  input,
  time,
  loader,
  renderer,
  windowManager,
  config
);

engine.pushState(new RadianceCascade());

function raf() {
  stats.begin();
  engine.update();
  engine.render();
  stats.end();
  setTimeout(() => {
    window.requestAnimationFrame(raf);
  }, engine.timeToNextTick());
}

window.requestAnimationFrame(raf);
*/
