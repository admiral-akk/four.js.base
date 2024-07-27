import { Vector3, Vector2 } from "three";

export class GridPosition extends Vector2 {
  static gridSize = 0.5;

  constructor(x, y) {
    if (x.isVector3) {
      super(
        Math.round(x.x / GridPosition.gridSize),
        Math.round(x.z / GridPosition.gridSize)
      );
    } else {
      super(Math.round(x), Math.round(y));
    }
  }

  toVector3() {
    return new Vector3(
      this.x * GridPosition.gridSize,
      0,
      this.y * GridPosition.gridSize
    );
  }

  neighbors() {
    const { x, y } = this;
    return [
      new GridPosition(x + 1, y),
      new GridPosition(x - 1, y),
      new GridPosition(x, y + 1),
      new GridPosition(x, y - 1),
    ];
  }

  key() {
    return this.x + "-" + this.y;
  }
}
