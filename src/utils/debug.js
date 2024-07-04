import GUI from "lil-gui";

class DebugManager extends GUI {
  constructor() {
    super();

    this.data = {};
  }

  add(name, $1 = undefined, max = undefined, step = undefined) {
    if (this.data[name]) {
      return this.data[name];
    }
    this.data[name] = { value: $1 };
    let reference;
    if ($1.isColor) {
      reference = super.addColor(this.data[name], "value").name(name);
    } else {
      reference = super.add(this.data[name], "value", $1, max, step).name(name);
    }
    return this.data[name];
  }
}

export { DebugManager };
