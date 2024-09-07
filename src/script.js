import "./style.css";
import { TimeManager } from "./engine/time.js";
import { WindowManager } from "./engine/window.js";
import { CustomerRenderer } from "./engine/renderer.js";
import Stats from "stats-js";
import { generateLoadingManager } from "./engine/loader.js";
import { InputManager } from "./engine/input.js";
import { GameEngine } from "./engine/engine.js";
import { RadianceCascade } from "./examples/radiance_cascade/radiance_cascade.js";
import { addCustomArrayMethods } from "./utils/array.js";

addCustomArrayMethods();

var stats = new Stats();
stats.showPanel(0); // 0: fps, 1: ms, 2: mb, 3+: custom
document.body.appendChild(stats.dom);

const time = new TimeManager();
const loader = generateLoadingManager();
const windowManager = new WindowManager(1);
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
