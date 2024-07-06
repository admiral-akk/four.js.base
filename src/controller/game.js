import * as THREE from "three";
export class Game {
  constructor(scene, input) {
    this.state = "WAITING";
    const queryParams = new URLSearchParams(window.location.search);
    this.currentLevel = parseInt(queryParams.get("level") ?? "0", 10);

    //this.ui = new UiController();
    this.scene = scene;
    this.input = input;
    const light = new THREE.DirectionalLight(0xffffff, 10);
    light.position.set(100, 100, 100);
    light.target.position.set(0, 0, 0);
    light.castShadow = true;
    light.shadow.mapSize.width = 2048;
    light.shadow.mapSize.height = 2048;
    light.shadow.camera.near = 1.0;
    light.shadow.camera.far = 200.0;
    light.shadow.camera.left = -20.0;
    light.shadow.camera.right = 20.0;
    light.shadow.camera.top = 20.0;
    light.shadow.camera.bottom = -20.0;
    scene.add(light);
  }

  startGame() {}

  update(time) {}
}
