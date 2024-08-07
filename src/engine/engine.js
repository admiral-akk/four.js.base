import { Scene, PerspectiveCamera, OrthographicCamera } from "three";
import { gsap } from "gsap";
import { AudioManager } from "./audio.js";
import { commandButton } from "./input.js";

function addAlignment(style, alignment) {
  if ("height" in alignment) {
    style.height = `${alignment.height * 100}%`;
  }
  if ("width" in alignment) {
    style.width = `${alignment.width * 100}%`;
  }
  if (style.position === "absolute") {
    if ("rightOffset" in alignment) {
      style.right = `${100 * alignment.rightOffset}%`;
    } else {
      style.right = `${50 * (1 - alignment.width)}%`;
    }
    if ("topOffset" in alignment) {
      style.top = `${100 * alignment.topOffset}%`;
    } else {
      style.top = `${50 * (1 - alignment.height)}%`;
    }
  }
}

function addUiHelpers(div) {
  div.createElement = ({
    type = "div",
    id = null,
    alignment = {},
    style = {},
    command = null,
    parent = div,
    classNames = "",
    text = "",
    data = null,
    children = [],
  }) => {
    const element = document.createElement(type);
    element.className = classNames;
    if (command) {
      element.command = command;
      element.classList.add(commandButton);
    }
    if (parent === div) {
      element.style.position = "absolute";
    }
    for (const [key, value] of Object.entries(style)) {
      element.style[key] = value;
    }
    addAlignment(element.style, alignment);
    element.isCustom = true;
    if (data) {
      element.data = data;
    }
    if (id) {
      element.id = id;
    }
    element.innerText = text;

    if (typeof parent === "string" || parent instanceof String) {
      parent = document.getElementById(parent);
    }
    parent.appendChild(element);
    children.map((c) => {
      let child = c;
      if (typeof c === "string" || c instanceof String) {
        child = {
          className: "f-s",
          text: c,
          parent: element,
        };
      } else {
        child.parent = element;
      }
      element.appendChild(div.createElement(child));
    });
    return element;
  };
}

class TickTracker {
  constructor(tickRate, getTime) {
    this.getTime = getTime;
    this.targetTime = getTime();
    this.setTickRate(tickRate);
  }

  setTickRate(tickRate) {
    this.delta = 1000 / tickRate;
  }

  shouldTick() {
    if (this.getTime() >= this.targetTime) {
      this.targetTime += this.delta;
      return true;
    }
    return false;
  }

  timeToNextTick() {
    return this.delta - (this.getTime() % this.delta);
  }
}

// http://gamedevgeek.com/tutorials/managing-game-states-in-c/
export class GameEngine {
  constructor(
    input,
    time,
    loader,
    renderer,
    window,
    { fps = 60, gameRate = 30 }
  ) {
    gsap.globalTimeline.timeScale(1);
    this.ui = document.querySelector("div.uiContainer");
    this.states = [];
    this.input = input;
    this.time = time;
    this.loader = loader;
    this.renderer = renderer;
    this.window = window;
    this.listener = new AudioManager(this.loader);
    this.listener.setMasterVolume(0.05);
    this.frameTracker = new TickTracker(fps, () => new Date().getTime());
    this.tickTracker = new TickTracker(
      gameRate,
      () => 1000 * gsap.globalTimeline.time()
    );
  }

  timeToNextTick() {
    return this.frameTracker.timeToNextTick();
  }

  playSound(path) {
    this.listener.play({ path });
  }

  init(stateConstructor) {
    this.pushState(stateConstructor);
  }

  currentState() {
    const len = this.states.length;
    if (len > 0) {
      return this.states[len - 1];
    }
    return null;
  }

  makeContainer() {
    var div = document.createElement("div");
    div.className = "ui";
    div.style.zIndex = `${this.states.length + 1}`;
    this.ui.appendChild(div);
    addUiHelpers(div);
    return div;
  }

  cleanupScene(current) {
    this.ui.removeChild(current.ui);
    this.input.cleanupScene(current);
  }

  replaceState(stateConstructor) {
    const current = this.currentState();
    if (current) {
      this.states.pop().cleanup();
      this.cleanupScene(current);
    }
    const state = new stateConstructor({
      ui: this.makeContainer(),
      window: this.window,
      tl: gsap.timeline(),
      cameraConfig: {
        isPerspective: false,
        width: 10,
      },
    });
    state.init();
    state.manifest().forEach((path) => this.listener.load({ path }));
    state.camera.add(this.listener);
    this.states.push(state);
  }

  pushState(stateConstructor) {
    this.currentState()?.pause();
    const state = new stateConstructor({
      ui: this.makeContainer(),
      window: this.window,
      tl: gsap.timeline(),
      cameraConfig: {
        isPerspective: false,
        width: 10,
      },
    });
    state.init();
    state.manifest().forEach((path) => this.listener.load({ path }));
    state.camera.add(this.listener);
    this.states.push(state);
  }

  popState() {
    const current = this.currentState();
    if (current) {
      this.states.pop().cleanup();
      this.cleanupScene(current);
    }
    this.currentState()?.resume();
  }

  update() {
    this.time.tick();
    const current = this.currentState();
    if (current) {
      this.input.update(current, current.camera);
      current.update(this);
      while (this.tickTracker.shouldTick()) {
        current.tick(this);
      }
      current.timeToNextTick = this.tickTracker.timeToNextTick() / 1000;
      current.resolveCommands(this);
      current.clearCommands();
      this.input.endLoop();
    }
    this.time.endLoop();
  }

  render() {
    this.currentState()?.render(this.renderer);
  }
}

export class GameState extends Scene {
  constructor({ ui, window, cameraConfig, tl }) {
    super();
    this.ui = ui;
    this.tl = tl;
    this.timeToNextTick = 0.1;
    this.commands = [];
    const { aspect } = window.sizes;
    let camera = null;
    if (cameraConfig.isPerspective) {
      const { fov } = cameraConfig;
      camera = new PerspectiveCamera(fov, aspect);
    } else {
      const halfWidth = cameraConfig.width / 2;
      camera = new OrthographicCamera(
        -halfWidth * aspect,
        halfWidth * aspect,
        halfWidth,
        -halfWidth
      );
    }
    this.add(camera);
    this.camera = camera;
  }

  // things to load
  manifest() {
    return [];
  }

  cleanup() {}
  pause() {}
  resume() {}

  tick(engine) {}
  update(engine) {}
  resolveCommands(engine) {}

  clearCommands() {
    this.commands.length = 0;
  }

  render(renderer) {
    renderer.render(this, this.camera);
  }
}
