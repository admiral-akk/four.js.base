let entityId = 0;

export class Entity {
  constructor() {
    this.entityId = entityId++;
  }

  key() {
    return this.entityId;
  }
}
