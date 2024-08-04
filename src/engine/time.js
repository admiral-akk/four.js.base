import * as THREE from "three";

class TimeManager {
  tick() {
    const deltaTime = this.clock.getDelta();
    this.time.frame++;
    this.time.realTime += deltaTime;
  }

  constructor() {
    this.clock = new THREE.Clock();
    this.time = {
      frame: 0,
      realTime: 0,
    };
    this.listeners = [];
  }

  endLoop() {
    this.listeners.forEach((v) => {
      v.updateTime(this.time);
    });
  }
}

export { TimeManager };
