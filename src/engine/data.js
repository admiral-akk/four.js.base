import GUI from "lil-gui";

const stateString = "state";
const configString = "config";

class DataManager {
  constructor() {
    this.added = [];
    this.listeners = [];
    this.serializedConfig = {};
    this.config = {};
  }

  init() {
    this.gui = new GUI();
    // load in the local data, if any
    this.readData();
  }

  addEnum(displayName, defaultValue, options) {
    const existingValue =
      this.serializedConfig[displayName]?.value ?? defaultValue;
    this.config[displayName] = {
      name: displayName,
      value: existingValue,
      minOrOptions: options,
    };
    this.addConfigData(displayName);
    this.added.push(displayName);
    return () => {
      return this.config[displayName].value;
    };
  }

  addNumber(displayName, defaultValue, min, max, step) {
    const existingValue =
      this.serializedConfig[displayName]?.value ?? defaultValue;
    this.config[displayName] = {
      name: displayName,
      value: existingValue,
      minOrOptions: min,
      max,
      step,
    };
    this.addConfigData(displayName);
    this.added.push(displayName);
    return () => {
      return this.config[displayName].value;
    };
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
      this.serializedConfig = JSON.parse(config);
    } else {
      this.serializedConfig = {};
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
