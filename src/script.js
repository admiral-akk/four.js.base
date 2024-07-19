import "./style.css";
import { TimeManager } from "./engine/time.js";
import { WindowManager } from "./engine/window.js";
import { CustomerRenderer } from "./engine/renderer.js";
import Stats from "stats-js";
import { generateLoadingManager } from "./engine/loader.js";
import { InputManager } from "./engine/input.js";
import GUI from "lil-gui";
import { GameEngine } from "./engine/engine.js";
import { MainMenu } from "./examples/tower_defense/towerdefense.js";

const initialState = new MainMenu();

const gui = new GUI();

var stats = new Stats();
stats.showPanel(0); // 0: fps, 1: ms, 2: mb, 3+: custom
document.body.appendChild(stats.dom);

const time = new TimeManager();
const loader = generateLoadingManager();
const windowManager = new WindowManager(16 / 9);
const input = new InputManager(windowManager, time);
const renderer = new CustomerRenderer(windowManager);

const engine = new GameEngine(input, time, loader, renderer);

engine.init(initialState);

function raf() {
  stats.begin();
  engine.update();
  engine.render();
  stats.end();
  window.requestAnimationFrame(raf);
}

window.requestAnimationFrame(raf);
