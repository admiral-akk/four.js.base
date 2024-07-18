// http://gamedevgeek.com/tutorials/managing-game-states-in-c/
export class GameEngine {
  constructor(input) {
    this.ui = document.querySelector("div.uiContainer");
    this.states = [];
    this.input = input;
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
    return div;
  }

  cleanupContainer(ui) {
    this.ui.removeChild(ui);
    this.input.cleanupContainer(ui);
  }

  replaceState(state) {
    const current = this.currentState();
    if (current) {
      this.states.pop().cleanup();
      this.cleanupContainer(current.ui);
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
      this.cleanupContainer(current.ui);
    }
    this.currentState()?.resume();
  }

  update() {
    this.currentState()?.update(this);
    this.input.endLoop();
  }

  render(renderer) {
    this.currentState()?.render(renderer);
  }
}
