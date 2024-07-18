// http://gamedevgeek.com/tutorials/managing-game-states-in-c/
export class GameEngine {
  constructor(input) {
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

  replaceState(state) {
    const current = this.currentState();
    if (current) {
      this.states.pop().cleanup();
    }
    state.init();
    this.states.push(state);
  }

  pushState(state) {
    this.currentState()?.pause();
    state.init();
    this.states.push(state);
  }

  popState() {
    const current = this.currentState();
    if (current) {
      const state = this.states.pop();
      state.cleanup();
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
