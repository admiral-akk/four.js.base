import GUI from "lil-gui";

const stateString = "state";
const configString = "config";

class DataManager {
  constructor({ state = {}, config = {} }) {
    this.defaultConfig = config;
    this.defaultState = state;
    this.listeners = [];
  }

  init() {
    this.gui = new GUI();
    // load in the local data, if any
    this.readData();
  }

  addButton({ fn, name }) {
    const s = {};
    s[name] = fn;
    this.gui.add(s, name);
  }

  addConfigData(key) {
    const {
      minOrOptions = null,
      max = null,
      step = null,
      name,
    } = this.config[key];
    this.gui
      .add(this.config[key], "value", minOrOptions, max, step)
      .name(name)
      .onChange(() => {
        this.writeData();
        this.notify();
      });
  }

  notify() {
    this.listeners.forEach((l) => l.configUpdated(this.config));
  }

  readData() {
    const state = localStorage.getItem(stateString);
    if (state) {
      this.state = JSON.parse(state);
    } else {
      this.state = this.defaultState;
    }

    const config = localStorage.getItem(configString);
    if (config) {
      this.config = JSON.parse(config);
    } else {
      this.config = this.defaultConfig;
    }

    for (var key of Object.keys(this.defaultConfig)) {
      if (this.config[key] === null) {
        this.config[key] = this.defaultConfig[key];
      }
    }

    for (var key of Object.keys(this.config)) {
      this.addConfigData(key);
    }
  }

  writeData() {
    localStorage.setItem(stateString, JSON.stringify(this.state));
    localStorage.setItem(configString, JSON.stringify(this.config));
  }

  clearData() {
    if (localStorage.getItem(stateString)) {
      localStorage.removeItem(stateString);
    }
    if (localStorage.getItem(configString)) {
      localStorage.removeItem(configString);
    }
  }

  addListener(listener) {
    this.listeners.push(listener);
  }
}

export { DataManager };
