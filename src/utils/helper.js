// https://stackoverflow.com/questions/44447847/enums-in-javascript-with-es6
export function makeEnum(arr) {
  let obj = Object.create(null);
  for (let val of arr) {
    obj[val] = val;
  }
  return Object.freeze(obj);
}

export function makeEnumMap(arr) {
  let obj = Object.create(null);
  for (let val of arr) {
    obj[val[0]] = val[1];
  }
  return Object.freeze(obj);
}

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

export class KeyedSet extends KeyedMap {
  add(keyedValue) {
    return super.set(keyedValue, keyedValue);
  }

  addAll(keyedValues) {
    keyedValues.forEach((v) => this.add(v));
  }

  pop() {
    for (const [key, value] of this) {
      this.delete(value);
      return value;
    }
    return null;
  }
}

Number.prototype.clamp = function (min, max) {
  return Math.min(Math.max(this, min), max);
};
Number.prototype.mix = function (other, t) {
  return this * (1 - t) + other * t;
};

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
