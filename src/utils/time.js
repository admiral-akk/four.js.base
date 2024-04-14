import * as THREE from "three";

class TimeManager {
  constructor() {
    const clock = new THREE.Clock();
    this.gameSpeed = 1;
    this.time = {
      userTime: 0,
      gameTime: 0,
      userDeltaTime: 0,
      gameDeltaTime: 0,
    };
    this.listeners = [];

    this.tick = () => {
      const deltaTime = clock.getDelta();
      this.time.userTime += deltaTime;
      this.time.gameTime += deltaTime * this.gameSpeed;
      this.time.userDeltaTime = deltaTime;
      this.time.gameDeltaTime = deltaTime * this.gameSpeed;
      this.listeners.forEach((v) => {
        v.updateTime(this.time);
      });
    };
  }
}

export { TimeManager };
