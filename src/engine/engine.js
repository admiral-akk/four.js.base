import { Scene, PerspectiveCamera, OrthographicCamera } from "three";

// http://gamedevgeek.com/tutorials/managing-game-states-in-c/
export class GameEngine {
  constructor(input, time, loader, renderer, window) {
    this.ui = document.querySelector("div.uiContainer");
    this.states = [];
    this.input = input;
    this.time = time;
    this.loader = loader;
    this.renderer = renderer;
    this.window = window;
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

    div.createElement = ({
      type = "div",
      style = {},
      parent = div,
      classNames = "",
      text = "",
      data = null,
      children = [],
    }) => {
      const element = document.createElement(type);
      element.className = classNames;
      for (const [key, value] of Object.entries(style)) {
        element.style[key] = value;
      }
      element.isCustom = true;
      if (data) {
        element.data = data;
      }
      element.innerText = text;
      parent.appendChild(element);
      children.map((c) => {
        element.appendChild(div.createElement(c));
      });
      return element;
    };
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
    });
    state.init();
    this.states.push(state);
  }

  pushState(stateConstructor) {
    this.currentState()?.pause();
    const state = new stateConstructor({
      ui: this.makeContainer(),
      window: this.window,
    });
    state.init();
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
  constructor({ ui, window, cameraConfig }) {
    super();
    this.ui = ui;
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
}
