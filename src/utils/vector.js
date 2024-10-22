class LineSegment extends Array {
  constructor(start, end) {
    super();
    this.push(start, end);
  }

  distanceTo(other) {
    const delta = this[1].clone().sub(this[0]);
    const deltaLength = delta.len();

    const dir = other.clone().sub(this[0]);
    const t = (dir.dot(delta) / delta.lenSq()).clamp(0, 1);

    return this[0].clone().add(delta.mul(t)).sub(other).len();
  }
}

class Vec extends Array {
  static X2 = new Vec([1, 0]);
  static X3 = new Vec([1, 0, 0]);
  static X4 = new Vec([1, 0, 0, 0]);

  static Y2 = new Vec([0, 1]);
  static Y3 = new Vec([0, 1, 0]);
  static Y4 = new Vec([0, 1, 0, 0]);

  static Z3 = new Vec([0, 0, 1]);
  static Z4 = new Vec([0, 0, 1, 0]);

  static W4 = new Vec([0, 0, 0, 1]);

  static ONE2 = new Vec(1, 1);
  static ONE3 = new Vec(1, 1, 1);
  static ONE4 = new Vec(1, 1, 1, 1);

  static ZERO2 = new Vec(0, 0);
  static ZERO3 = new Vec(0, 0, 0);
  static ZERO4 = new Vec(0, 0, 0, 0);

  constructor(arrOrX, y = null, z = null, w = null) {
    super();
    if (Array.isArray(arrOrX)) {
      for (let i = 0; i < arrOrX.length; i++) {
        this.push(arrOrX[i]);
      }
    } else if (typeof arrOrX !== "number" || y === null) {
      throw new Error("Invalid construction");
    } else {
      this.push(arrOrX, y);
      if (z !== null) {
        this.push(z);
      }
      if (w !== null) {
        this.push(w);
      }
    }
  }

  copy(other) {
    if (typeof other === "number") {
      for (let i = 0; i < this.length; i++) {
        this[i] = other;
      }
    } else if (other.length === this.length) {
      for (let i = 0; i < this.length; i++) {
        this[i] = other[i];
      }
    }
    return this;
  }

  add(other) {
    if (typeof other === "number") {
      for (let i = 0; i < this.length; i++) {
        this[i] += other;
      }
    } else if (other.length === this.length) {
      for (let i = 0; i < this.length; i++) {
        this[i] += other[i];
      }
    } else {
      throw new Error("Invalid add");
    }
    return this;
  }

  sub(other) {
    if (typeof other === "number") {
      for (let i = 0; i < this.length; i++) {
        this[i] -= other;
      }
    } else if (other.length === this.length) {
      for (let i = 0; i < this.length; i++) {
        this[i] -= other[i];
      }
    } else {
      throw new Error("Invalid sub");
    }
    return this;
  }

  mul(other) {
    if (typeof other === "number") {
      for (let i = 0; i < this.length; i++) {
        this[i] *= other;
      }
    } else if (other.length === this.length) {
      for (let i = 0; i < this.length; i++) {
        this[i] *= other[i];
      }
    } else {
      throw new Error("Invalid mul");
    }
    return this;
  }

  dot(other) {
    if (other.length === this.length) {
      let sum = 0;
      for (let i = 0; i < this.length; i++) {
        sum += this[i] * other[i];
      }
      return sum;
    } else {
      throw new Error("Invalid dot");
    }
  }

  mix(other, t) {
    for (let i = 0; i < this.length; i++) {
      this[i] = this[i].mix(other[i], t[i]);
    }
    return this;
  }

  min(other) {
    for (let i = 0; i < this.length; i++) {
      this[i] = Math.min(this[i], other[i]);
    }
    return this;
  }

  clamp(low, high) {
    for (let i = 0; i < this.length; i++) {
      this[i] = this[i].clamp(low, high);
    }
    return this;
  }

  max(other) {
    for (let i = 0; i < this.length; i++) {
      this[i] = Math.max(this[i], other[i]);
    }
    return this;
  }

  normalize() {
    var sum = 0;
    for (let i = 0; i < this.length; i++) {
      sum += this[i] * this[i];
    }
    for (let i = 0; i < this.length; i++) {
      this[i] /= sum;
    }
    return this;
  }

  cross(other) {
    if (other.length === this.length) {
      if (this.length === 2) {
        return this[0] * other[1] - this[1] * other[0];
      } else if (this.length === 3) {
        return new Vec([
          this[1] * other[2] - this[2] * other[1],
          this[2] * other[0] - this[0] * other[2],
          this[0] * other[1] - this[1] * other[0],
        ]);
      } else {
        throw new Error("Can't do 4D cross (yet?)");
      }
    } else {
      throw new Error("Dimensions need to match for cross.");
    }
  }

  len() {
    return Math.sqrt(this.lenSq());
  }

  lenSq() {
    var sum = 0;
    for (let i = 0; i < this.length; i++) {
      sum += this[i] * this[i];
    }
    return sum;
  }

  clone() {
    return new Vec(this);
  }
}

export { Vec, LineSegment };
