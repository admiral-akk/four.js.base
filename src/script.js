import "./style.css";
import { TimeManager } from "./utils/time.js";
import { WindowManager } from "./utils/window.js";
import { DebugManager } from "./utils/debug.js";
import { CustomerRenderer } from "./utils/renderer.js";
import Stats from "stats-js";
import { generateLoadingManager } from "./utils/loader.js";
import { InputManager } from "./utils/input.js";

import { Text } from "troika-three-text";
import { GameEngine } from "./utils/engine.js";
import { MainMenu } from "./examples/tictactoe.js";

const initialState = new MainMenu();

const gui = new DebugManager();

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
