import GUI from "lil-gui";

const stateString = "state";
const configString = "config";

class DataManager {
  constructor() {
    this.added = [];
    this.listeners = [];
    this.serializedConfig = {};
    this.config = {};
    this.state = {};
  }

  init() {
    const gui = new GUI();

    this.variables = gui.addFolder("Variables");
    this.buttons = gui.addFolder("Buttons");

    // load in the local data, if any
    this.readData();
    this.addButton({ name: "Clear Data", fn: () => this.clearData() });
  }

  addEnum(displayName, defaultValue, options) {
    const existingValue =
      this.serializedConfig[displayName]?.value ?? defaultValue;
    this.config[displayName] = {
      name: displayName,
      defaultValue: defaultValue,
      value: existingValue,
      minOrOptions: options,
    };
    this.addConfigData(displayName);
    this.added.push(displayName);
    return () => {
      return structuredClone(this.config[displayName].value);
    };
  }

  addNumber(displayName, defaultValue, min = null, max = null, step = null) {
    const existingValue =
      this.serializedConfig[displayName]?.value ?? defaultValue;
    this.config[displayName] = {
      name: displayName,
      defaultValue: defaultValue,
      value: existingValue,
      minOrOptions: min,
      max,
      step,
    };
    this.addConfigData(displayName);
    this.added.push(displayName);
    return () => {
      return structuredClone(this.config[displayName].value);
    };
  }

  addColor(displayName, defaultValue) {
    const existingValue =
      this.serializedConfig[displayName]?.value ?? defaultValue;
    this.config[displayName] = {
      name: displayName,
      defaultValue: defaultValue,
      value: existingValue,
    };
    this.variables
      .addColor(this.config[displayName], "value")
      .name(displayName)
      .onChange(() => {
        this.saveData();
        this.notify();
      })
      .listen();
    this.added.push(displayName);
    return () => {
      return structuredClone(this.config[displayName].value);
    };
  }

  addButton({ fn, name }) {
    const s = {};
    s[name] = fn;
    this.buttons.add(s, name);
  }

  addConfigData(key) {
    const {
      minOrOptions = null,
      max = null,
      step = null,
      name,
    } = this.config[key];
    this.variables
      .add(this.config[key], "value", minOrOptions, max, step)
      .name(name)
      .onChange(() => {
        this.saveData();
        this.notify();
      })
      .listen();
  }

  notify() {
    this.listeners.forEach((l) => l.configUpdated(this.config));
  }

  readData() {
    const state = localStorage.getItem(stateString);
    if (state && state != "undefined") {
      this.state = JSON.parse(state);
    } else {
      this.state = {};
    }

    const config = localStorage.getItem(configString);
    if (config && config != "undefined") {
      this.serializedConfig = JSON.parse(config);
    } else {
      this.serializedConfig = {};
    }
  }

  saveData() {
    localStorage.setItem(stateString, JSON.stringify(this.state));
    localStorage.setItem(configString, JSON.stringify(this.config));
  }

  clearData() {
    if (localStorage.getItem(stateString)) {
      localStorage.removeItem(stateString);
    }
    this.state = {};
    if (localStorage.getItem(configString)) {
      localStorage.removeItem(configString);
    }

    for (const [_, value] of Object.entries(this.config)) {
      value.value = value.defaultValue;
    }

    this.notify();
  }

  addListener(listener) {
    this.listeners.push(listener);
  }
}

export { DataManager };
