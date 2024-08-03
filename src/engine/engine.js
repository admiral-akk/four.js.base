import { Scene, PerspectiveCamera, OrthographicCamera } from "three";
import { gsap } from "gsap";
import { AudioManager } from "./audio.js";

function addAlignment(style, alignment) {
  if (alignment.height) {
    style.height = `${alignment.height * 100}%`;
  }
  if (alignment.width) {
    style.width = `${alignment.width * 100}%`;
  }
  if (style.position === "absolute") {
    if (alignment.rightOffset) {
      style.right = `${100 * alignment.rightOffset}%`;
    } else {
      style.right = `${50 * (1 - alignment.width)}%`;
    }
    if (alignment.topOffset) {
      style.top = `${100 * alignment.topOffset}%`;
    } else {
      style.top = `${50 * (1 - alignment.height)}%`;
    }
  }
}

function addUiHelpers(div, tl) {
  div.createElement = ({
    type = "div",
    id = null,
    alignment = {},
    style = {},
    parent = div,
    classNames = "",
    text = "",
    data = null,
    children = [],
  }) => {
    const element = document.createElement(type);
    element.className = classNames;
    if (parent === div) {
      element.style.position = "absolute";
    }
    addAlignment(element.style, alignment);
    for (const [key, value] of Object.entries(style)) {
      element.style[key] = value;
    }
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

// http://gamedevgeek.com/tutorials/managing-game-states-in-c/
export class GameEngine {
  constructor(input, time, loader, renderer, window) {
    gsap.globalTimeline.timeScale(10);
    this.ui = document.querySelector("div.uiContainer");
    this.states = [];
    this.input = input;
    this.time = time;
    this.loader = loader;
    this.renderer = renderer;
    this.window = window;
    this.listener = new AudioManager(this.loader);
    this.listener.setMasterVolume(0.05);
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

  render(renderer) {
    renderer.render(this, this.camera);
  }
}
