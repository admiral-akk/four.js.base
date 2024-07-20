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

  pop() {
    for (const value of this) {
      set.delete(value);
      return value;
    }
    return null;
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

  neighbors() {
    const { x, y } = this;
    return [
      new Position(x + 1, y),
      new Position(x - 1, y),
      new Position(x, y + 1),
      new Position(x, y - 1),
    ];
  }

  dist_max(other) {
    return Math.max(Math.abs(other.x - this.x), Math.abs(other.y - this.y));
  }

  dist(other) {
    return Math.abs(other.x - this.x) + Math.abs(other.y - this.y);
  }

  equals(other) {
    return this.dist(other) === 0;
  }

  key() {
    return this.x + "-" + this.y;
  }
}
