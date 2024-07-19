export class KeyedMap extends Map {
  set(keyedValue, value) {
    const key = keyedValue.key ? keyedValue.key() : keyedValue;
    return super.set(key, value);
  }

  has(keyedValue) {
    const key = keyedValue.key ? keyedValue.key() : keyedValue;
    return super.has(key);
  }

  get(keyedValue) {
    const key = keyedValue.key ? keyedValue.key() : keyedValue;
    return super.get(key);
  }

  delete(keyedValue) {
    const key = keyedValue.key ? keyedValue.key() : keyedValue;
    return super.delete(key);
  }
}

export class KeyedSet extends Set {
  add(keyedValue) {
    const key = keyedValue.key ? keyedValue.key() : keyedValue;
    return super.add(key);
  }

  has(keyedValue) {
    const key = keyedValue.key ? keyedValue.key() : keyedValue;
    return super.has(key);
  }

  delete(keyedValue) {
    const key = keyedValue.key ? keyedValue.key() : keyedValue;
    return super.delete(key);
  }
}

export class Position {
  constructor(x, y) {
    this.x = x;
    this.y = y;
  }

  key() {
    return this.x + "-" + this.y;
  }
}
