// http://gamedevgeek.com/tutorials/managing-game-states-in-c/
export class StateMachine {
  constructor() {
    this.states = [];
  }

  stateParams() {
    return {};
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

  addState(state) {
    state.init(this);
    this.states.push(state);
  }

  replaceState(state) {
    const current = this.currentState();
    if (current) {
      this.states.pop().cleanup();
      this.cleanup(current);
    }
    this.addState(state);
  }

  pushState(state) {
    this.currentState()?.pause();
    this.addState(state);
  }

  popState() {
    const current = this.currentState();
    if (current) {
      this.states.pop().cleanup();
      this.cleanup(current);
    }
    this.currentState()?.resume();
  }
}

export class State {
  constructor() {}

  init(machine) {}
  cleanup() {}
  pause() {}
  resume() {}
}
