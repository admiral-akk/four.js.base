import GUI from "lil-gui";

class DebugManager {
  constructor() {
    this.gui = new GUI();

    this.data = {};
  }

  add(name, defaultVal, config = {}) {
    if (this.data[name]) {
      return this.data[name];
    }
    this.data[name] = { value: defaultVal };
    let reference;
    if (defaultVal.isColor) {
      reference = this.gui.addColor(this.data[name], "value").name(name);
    } else {
      reference = this.gui.add(this.data[name], "value").name(name);
    }
    for (const [key, value] of Object.entries(config)) {
      if (reference[key] instanceof Function) {
        reference[key](value);
      }
    }
    return this.data[name];
  }
}

export { DebugManager };
