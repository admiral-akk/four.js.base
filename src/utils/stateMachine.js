// http://gamedevgeek.com/tutorials/managing-game-states-in-c/
export class StateMachine {
  constructor() {
    this.states = [];
  }

  stateParams() {
    return {};
  }

  init(stateConstructor) {
    this.pushState(stateConstructor);
  }

  cleanup(state) {
    state.cleanup();
  }

  currentState() {
    const len = this.states.length;
    if (len > 0) {
      return this.states[len - 1];
    }
    return null;
  }

  addState(stateConstructor) {
    const state = new stateConstructor(this.stateParams());
    state.init(this);
    this.states.push(state);
  }

  replaceState(stateConstructor) {
    const current = this.currentState();
    if (current) {
      this.states.pop().cleanup();
      this.cleanup(current);
    }
    this.addState(stateConstructor);
  }

  pushState(stateConstructor) {
    this.currentState()?.pause();
    this.addState(stateConstructor);
  }

  popState() {
    const current = this.currentState();
    if (current) {
      this.states.pop().cleanup();
      this.cleanup(current);
    }
    this.currentState()?.resume();
  }

  update() {
    this.currentState()?.update(this);
  }
}

export class State {
  constructor() {}

  init(engine) {}

  cleanup() {}
  pause() {}
  resume() {}

  update(engine) {}
}
