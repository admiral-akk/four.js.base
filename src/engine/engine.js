// http://gamedevgeek.com/tutorials/managing-game-states-in-c/
export class GameEngine {
  constructor(input, time, loader, renderer) {
    this.ui = document.querySelector("div.uiContainer");
    this.states = [];
    this.input = input;
    this.time = time;
    this.loader = loader;
    this.renderer = renderer;
  }

  init(initialState) {
    this.pushState(initialState);
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
    }) => {
      const element = document.createElement(type);
      element.className = classNames;
      for (const [key, value] of Object.entries(style)) {
        element.style[key] = value;
      }
      element.innerText = text;
      parent.appendChild(element);
      return element;
    };
    return div;
  }

  cleanupScene(current) {
    this.ui.removeChild(current.ui);
    this.input.cleanupScene(current);
  }

  replaceState(state) {
    const current = this.currentState();
    if (current) {
      this.states.pop().cleanup();
      this.cleanupScene(current);
    }
    state.ui = this.makeContainer();
    state.init();
    this.states.push(state);
  }

  pushState(state) {
    state.ui = this.makeContainer();
    this.currentState()?.pause();
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
