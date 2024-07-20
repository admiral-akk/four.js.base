import * as THREE from "three";

class TimeManager {
  tick() {
    const deltaTime = this.clock.getDelta();
    this.time.frame++;
    this.time.userTime += deltaTime;
    this.time.gameTime += deltaTime * this.gameSpeed;
    this.time.userDeltaTime = deltaTime;
    this.time.gameDeltaTime = deltaTime * this.gameSpeed;
  }

  constructor() {
    this.clock = new THREE.Clock();
    this.gameSpeed = 1;
    this.time = {
      userTime: 0,
      gameTime: 0,
      userDeltaTime: 0,
      gameDeltaTime: 0,
      frame: 0,
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
