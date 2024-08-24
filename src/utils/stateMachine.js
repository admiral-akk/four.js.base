// http://gamedevgeek.com/tutorials/managing-game-states-in-c/
export class StateMachine {
  constructor() {
    this.states = [];
  }

  stateParams() {
    return {};
  }

  cleanup() {
    while (this.currentState()) {
      this.popState();
    }
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

  cleanupState(state) {
    state.cleanup(this);
  }

  replaceState(state) {
    const current = this.currentState();
    if (current) {
      console.log(current);
      this.cleanupState(this.states.pop());
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
      this.cleanupState(this.states.pop());
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
