import "./style.css";
import * as THREE from "three";
import { TimeManager } from "./utils/time.js";
import { WindowManager } from "./utils/window.js";
import { DebugManager } from "./utils/debug.js";
import { customRenderer } from "./utils/renderer.js";
import { generateCamera, cameraConfig } from "./utils/camera.js";
import Stats from "stats-js";
import { FullScreenQuad } from "three/addons/postprocessing/Pass.js";
import { OkLabColor } from "./utils/labColour.js";
import { generateLoadingManager } from "./utils/loader.js";
import * as PPS from "./utils/postProcessingShaders.js";
import { InputManager } from "./utils/input.js";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

const gui = new DebugManager();
gui.add("isLinear", false);
var stats = new Stats();
stats.showPanel(0); // 0: fps, 1: ms, 2: mb, 3+: custom
document.body.appendChild(stats.dom);

const time = new TimeManager();
const scene = new THREE.Scene();
const loader = generateLoadingManager();

loader.load("./texture/rock/Rock051_1K-JPG_NormalDX.jpg");
loader.load("./model/crate.glb");

const input = new InputManager(time);

const camera = generateCamera(scene, cameraConfig);
const windowManager = new WindowManager(camera);
const renderer = customRenderer(windowManager);

class CameraController {
  constructor(
    camera,
    time,
    target,
    config = {
      phi: 0.3,
      theta: Math.PI / 5,
      distance: 3,
      stepSize: 0.1,
    }
  ) {
    this.camera = camera;
    this.time = time;
    this.currentTarget = target.clone();
    this.target = target.clone();
    this.config = config;

    this.updatePosition();
  }

  updatePosition() {
    const { phi, theta, distance } = this.config;
    const initialPos = this.currentTarget.clone();

    initialPos.add(
      new THREE.Vector3(
        Math.sin(phi) * Math.cos(theta),
        Math.sin(theta),
        Math.cos(phi) * Math.cos(theta)
      ).multiplyScalar(distance)
    );

    this.camera.position.set(initialPos.x, initialPos.y, initialPos.z);
    camera.lookAt(this.currentTarget);
    camera.updateProjectionMatrix();
  }

  update() {
    const delta = this.target.clone().sub(this.currentTarget);
    const { stepSize } = this.config;
    if (delta.length() < stepSize) {
      this.currentTarget = this.target.clone();
    } else {
      this.currentTarget.add(delta.normalize().multiplyScalar(stepSize));
    }
    this.updatePosition();
  }
}

const controls = new CameraController(camera, time, new THREE.Vector3());

class UiController {
  constructor() {
    const ui = document.querySelector("div.ui");
    var div = document.createElement("div");
    // https://css-tricks.com/fitting-text-to-a-container/
    div.style.position = "absolute";
    div.style.fontSize = "2cqi";
    div.style.top = "3%";
    div.style.right = "3%";
    div.style.height = "10%";
    div.style.width = "10%";
    div.style.background = "red";
    div.style.container = "ui";
    div.innerHTML = "Hello world";
    const tutorial = document.createElement("div");
    tutorial.style.position = "absolute";
    tutorial.style.top = "90%";
    tutorial.style.bottom = "3%";
    tutorial.style.right = "20%";
    tutorial.style.left = "20%";
    tutorial.style.background = "red";
    tutorial.style.alignContent = "center";
    const tutorialText = document.createElement("div");
    tutorialText.innerHTML = "Tutorial message";
    tutorialText.style.textAlign = "center";
    tutorialText.style.fontSize = "2cqi";
    tutorialText.style.container = "ui";
    this.div = div;
    this.tutorial = tutorial;
    this.tutorialText = tutorialText;
    tutorial.appendChild(tutorialText);
    ui.appendChild(div);
    this.ui = ui;
  }

  setTutorialMessage(message) {
    const { ui, tutorial, tutorialText } = this;
    if (!message) {
      if (tutorial.parentElement === ui) {
        ui.removeChild(tutorial);
      }
    } else {
      ui.appendChild(tutorial);
      tutorialText.innerHTML = message;
    }
  }

  updateStats({ hitTargets, totalTargets }) {
    this.div.innerHTML = `${hitTargets} / $d{totalTargets}`;
  }
}
class Game {
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

  startGame() {
    scene.add(
      new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshBasicMaterial())
    );
  }

  update(time) {}
}

const game = new Game(scene);

const postProcessing = (uniforms, fragShader) => {
  return new THREE.ShaderMaterial({
    uniforms: uniforms,
    vertexShader: `
    #include <packing>
    varying vec2 vUv;

		void main() {

			vUv = uv;
			gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );

		}`,
    fragmentShader: fragShader,
  });
};

class RenderPipeline {
  constructor(renderer) {
    this.renderer = renderer;

    this.normalTarget = renderer.newRenderTarget(1, 1);
    this.normalTarget.depthTexture = new THREE.DepthTexture();

    this.diffuseTarget = renderer.newRenderTarget(1, 1);

    this.worldPositionTarget = renderer.newRenderTarget(1, 1, {
      format: THREE.RGBAFormat,
      type: THREE.HalfFloatType,
    });

    this.gradientTarget = renderer.newRenderTarget(1, 1, {
      format: THREE.RGBAFormat,
      type: THREE.HalfFloatType,
    });

    this.bufferTarget = renderer.newRenderTarget(1, 1, {
      format: THREE.RGBAFormat,
      type: THREE.HalfFloatType,
    });
  }

  renderOverride(scene, camera, material, target) {
    const oldTarget = this.renderer.getRenderTarget();
    const oldOverride = scene.overrideMaterial;

    scene.overrideMaterial = material;
    this.renderer.setRenderTarget(target);

    renderer.render(scene, camera);

    scene.overrideMaterial = oldOverride;
    this.renderer.setRenderTarget(oldTarget);
  }

  render(scene, camera) {
    camera.updateUniforms();
    this.renderOverride(scene, camera, null, this.diffuseTarget);

    const isLinear = gui.data.isLinear.value;
    const start = isLinear
      ? new THREE.Color(1, 1, 1)
      : OkLabColor.fromLinearRGB(1, 1, 1);
    const end = isLinear
      ? new THREE.Color(0, 0, 1)
      : OkLabColor.fromLinearRGB(0, 0, 1);

    const gradientPass = new FullScreenQuad(
      postProcessing(
        {
          tInput: { value: this.diffuseTarget.texture },
          uStartColor: { value: start },
          uEndColor: { value: end },
        },
        PPS.gradientFragShader
      )
    );
    this.renderer.setRenderTarget(this.gradientTarget);
    gradientPass.render(this.renderer);
    if (!isLinear) {
      const linearConvertionPass = new FullScreenQuad(
        postProcessing(
          {
            tInput: { value: this.gradientTarget.texture },
          },
          PPS.labToLinearFragShader
        )
      );
      this.renderer.setRenderTarget(this.bufferTarget);
      linearConvertionPass.render(this.renderer);
    }

    const gammaPass = new FullScreenQuad(
      postProcessing(
        {
          tInput: {
            value: (isLinear ? this.gradientTarget : this.bufferTarget).texture,
          },
        },
        PPS.gammaFragShader
      )
    );
    this.renderer.setRenderTarget(null);
    gammaPass.render(this.renderer);
  }
}

const pipeline = new RenderPipeline(renderer);

class Menu {
  constructor() {
    const ui = document.querySelector("div.ui");
    var div = document.createElement("div");
    // https://css-tricks.com/fitting-text-to-a-container/
    div.style.position = "absolute";
    div.style.top = "20%";
    div.style.right = "30%";
    div.style.bottom = "20%";
    div.style.left = "30%";
    div.style.background = "red";
    div.style.container = "ui";
    const button = document.createElement("button");
    button.innerHTML = "START GAME";
    button.style.position = "relative";
    button.style.top = "3%";
    button.style.right = "20%";
    button.style.bottom = "3%";
    button.style.pointerEvents = "auto";
    button.style.left = "20%";
    button.style.width = "60%";
    button.style.fontSize = "2cqi";
    button.style.background = "white";
    button.style.container = "ui";
    button.onclick = () => {
      game.startGame();

      ui.removeChild(div);
    };
    ui.appendChild(div);
    div.appendChild(button);
    this.div = div;
  }
}

//const startMenu = new Menu();

const workers = [];

for (let i = 0; i < 9; i++) {
  const myWorker = new Worker("worker.js");
  workers.push(myWorker);
  myWorker.onmessage = (ev) => console.log("Message ", ev);
  myWorker.postMessage([10, 20]);
}

function raf() {
  stats.begin();
  pipeline.render(scene, camera);
  time.tick();
  game.update(time);
  controls.update();
  time.endLoop();
  stats.end();
  window.requestAnimationFrame(raf);
}

window.requestAnimationFrame(raf);
