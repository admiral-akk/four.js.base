import * as THREE from "three";

class TimeManager {
  tick() {
    const deltaTime = this.clock.getDelta();
    this.time.frame++;
    this.time.realTime += deltaTime;
    this.listeners.forEach((v) => {
      v.updateTime(this.time);
    });
  }

  addListener(listener) {
    this.listeners.push(listener);
  }

  constructor() {
    this.clock = new THREE.Clock();
    this.time = {
      frame: 0,
      realTime: 0,
    };
    this.listeners = [];
  }
}

export { TimeManager };
