import "./style.css";
import * as THREE from "three";
import { TimeManager } from "./utils/time.js";
import { WindowManager } from "./utils/window.js";
import { customRenderer } from "./utils/renderer.js";
import { generateCamera, cameraConfig } from "./utils/camera.js";
import Stats from "stats-js";
import { generateLoadingManager } from "./utils/loader.js";

var stats = new Stats();
stats.showPanel(0); // 0: fps, 1: ms, 2: mb, 3+: custom
document.body.appendChild(stats.dom);

const time = new TimeManager();
const scene = new THREE.Scene();
const loader = generateLoadingManager();

const camera = generateCamera(scene, cameraConfig);
const windowManager = new WindowManager(camera);
const renderer = customRenderer(windowManager);

class Game {
  constructor(scene) {
    this.scene = scene;
    const box = new THREE.Mesh(
      new THREE.BoxGeometry(1, 1),
      new THREE.MeshStandardMaterial({ color: 0x0000ff })
    );
    box.position.set(0, 1, 0);
    box.castShadow = true;
    box.receiveShadow = true;
    scene.add(box);

    const sphere = new THREE.Mesh(
      new THREE.SphereGeometry(1),
      new THREE.MeshStandardMaterial({ color: 0xffffff })
    );
    sphere.position.set(2, 2, 2);
    sphere.castShadow = true;
    sphere.receiveShadow = true;
    scene.add(sphere);

    const plane = new THREE.Mesh(
      new THREE.PlaneGeometry(100, 100),
      new THREE.MeshStandardMaterial({ color: 0xffffff })
    );
    plane.castShadow = true;
    plane.receiveShadow = true;
    plane.rotation.x = -Math.PI / 2;
    scene.add(plane);
    const light = new THREE.DirectionalLight(0xffffff, 2);
    light.position.set(100, 100, 100);
    light.target.position.set(0, 0, 0);
    light.castShadow = true;
    light.shadow.mapSize.width = 2048;
    light.shadow.mapSize.height = 2048;
    light.shadow.camera.near = 1.0;
    light.shadow.camera.far = 200.0;
    light.shadow.camera.left = -100.0;
    light.shadow.camera.right = 100.0;
    light.shadow.camera.top = 100.0;
    light.shadow.camera.bottom = -100.0;
    scene.add(light);

    this.box = box;
  }

  update(time) {
    this.box.setRotationFromEuler(new THREE.Euler(0, time.time.gameTime, 0));
  }
}

const game = new Game(scene);

class RenderPipeline {
  constructor(renderer) {
    this.renderer = renderer;
  }

  render(scene, camera) {
    renderer.render(scene, camera);
  }
}

const pipeline = new RenderPipeline(renderer);

function raf() {
  pipeline.render(scene, camera);
  time.tick();
  game.update(time);
  window.requestAnimationFrame(raf);
}

window.requestAnimationFrame(raf);
