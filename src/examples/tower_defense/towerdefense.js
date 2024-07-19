import * as THREE from "three";
import { Vector3 } from "three";

export class MainMenu extends THREE.Scene {
  constructor() {
    super();
    this.camera = new THREE.PerspectiveCamera(75, 16 / 9);
    this.add(this.camera);
  }

  init() {
    var div = document.createElement("div");
    // https://css-tricks.com/fitting-text-to-a-container/
    div.style.position = "absolute";
    div.style.fontSize = "2cqi";
    div.style.top = "10%";
    div.style.right = "10%";
    div.style.height = "10%";
    div.style.width = "80%";
    div.style.justifyContent = "space-around";
    div.style.margin = "auto";
    div.style.display = "flex";
    div.style.flexDirection = "column";
    div.style.alignItems = "center";
    div.style.justifyContent = "space-around";

    div.style.background = "red";
    div.style.container = "ui";
    var div2 = document.createElement("div");
    div2.style.fontSize = "2cqi";
    div2.innerHTML = "My First Tower Defense";
    this.ui.appendChild(div);
    div.appendChild(div2);

    var start = document.createElement("div");
    start.style.position = "absolute";
    start.style.fontSize = "2cqi";
    start.style.top = "80%";
    start.style.right = "40%";
    start.style.height = "10%";
    start.style.width = "10%";
    start.style.pointerEvents = "auto";
    start.style.background = "red";
    start.style.display = "flex";
    start.style.flexDirection = "column";
    start.style.alignItems = "center";
    start.style.justifyContent = "space-around";
    var div3 = document.createElement("div");
    div3.style.fontSize = "2cqi";
    div3.innerHTML = "Start Game";
    start.appendChild(div3);
    this.start = start;
    this.ui.appendChild(start);
  }

  cleanup() {}
  pause() {}
  resume() {}

  update(engine) {
    const { ui } = engine.input.getState();
    if (ui.clicked.find((v) => v === this.start) !== undefined) {
      engine.replaceState(new TowerDefense());
    }
  }
  render(renderer) {
    renderer.render(this, this.camera);
  }
}

class TowerDefense extends THREE.Scene {
  constructor() {
    super();
    this.camera = new THREE.OrthographicCamera(
      (-4 * 16) / 9,
      (4 * 16) / 9,
      4,
      -4
    );
    this.add(this.camera);
  }

  init() {
    this.camera.position.copy(new Vector3(4, 4, 4));
    this.camera.lookAt(new Vector3());

    const makeGround = (height, width) => {
      const geo = new THREE.PlaneGeometry(width, height);
      geo.rotateX(-Math.PI / 2);
      const mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial());
      this.add(mesh);
    };
    makeGround(5, 5);
  }

  cleanup() {}
  pause() {}
  resume() {}

  update(engine) {}

  render(renderer) {
    renderer.render(this, this.camera);
  }
}
