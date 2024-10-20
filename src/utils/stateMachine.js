import { addCustomArrayMethods } from "./array.js";
addCustomArrayMethods();
// http://gamedevgeek.com/tutorials/managing-game-states-in-c/
export class StateMachine {
  constructor() {
    this.states = [];
  }

  stateParams() {
    return {};
  }

  cleanup() {
    while (this.states.length) {
      this.cleanupState(this.states.pop());
    }
  }

  currentState() {
    return this.states.peek();
  }

  addState(state) {
    state.init(this);
    this.states.push(state);
  }

  cleanupState(state) {
    if (state) {
      state.cleanup(this);
    }
  }

  replaceState(state) {
    this.cleanupState(this.states.pop());
    this.addState(state);
  }

  pushState(state) {
    this.currentState()?.pause();
    this.addState(state);
  }

  popState() {
    this.cleanupState(this.states.pop());
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
