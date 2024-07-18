import "./style.css";
import * as THREE from "three";
import { TimeManager } from "./utils/time.js";
import { WindowManager } from "./utils/window.js";
import { DebugManager } from "./utils/debug.js";
import { CustomerRenderer } from "./utils/renderer.js";
import { generateCamera, cameraConfig } from "./utils/camera.js";
import Stats from "stats-js";
import { FullScreenQuad } from "three/addons/postprocessing/Pass.js";
import { OkLabColor } from "./utils/labColour.js";
import { generateLoadingManager } from "./utils/loader.js";
import * as PPS from "./utils/postProcessingShaders.js";
import { InputManager } from "./utils/input.js";
import { Game } from "./controller/game.js";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { uniform } from "three/examples/jsm/nodes/Nodes.js";

import { Text } from "troika-three-text";
import { MeshBasicMaterial } from "three";
import { TicTacToe } from "./examples/tictactoe.js";
import { KeyedMap, KeyedSet } from "./utils/helper.js";

// input
// intent
// application state
// events -> render state

const gui = new DebugManager();
gui.add("renderMode", "StandardDiffuse", [
  "LabOkGradient",
  "LinearGradient",
  "StandardDiffuse",
]);

var stats = new Stats();
stats.showPanel(0); // 0: fps, 1: ms, 2: mb, 3+: custom
document.body.appendChild(stats.dom);

const time = new TimeManager();
const scene = new THREE.Scene();
const loader = generateLoadingManager();

loader.load("./texture/rock/Rock051_1K-JPG_NormalDX.jpg");
loader.load("./model/crate.glb");

const camera = generateCamera(scene, cameraConfig);
const windowManager = new WindowManager(camera);
const input = new InputManager(windowManager, time);
const renderer = new CustomerRenderer(windowManager);

class MainMenu {
  constructor() {}

  init() {
    const ui = document.querySelector("div.ui");

    this.clicked = false;
    var div = document.createElement("div");
    div.onclick = (ev) => {
      this.clicked = true;
    };
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
    div.style.pointerEvents = "auto";
    const tutorial = document.createElement("div");
    tutorial.style.position = "absolute";
    tutorial.style.top = "90%";
    tutorial.style.bottom = "3%";
    tutorial.style.right = "20%";
    tutorial.style.left = "20%";
    tutorial.style.pointerEvents = "auto";
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
    this.div = div;
  }
  cleanup() {
    this.ui.removeChild(this.div);
  }

  pause() {}
  resume() {}

  update(engine) {
    const { ui } = engine.input.getState();
    if (ui.clicked.find((v) => v === this.div.inputKey) !== undefined) {
      engine.replaceState(new TicTacToe());
    }
  }
  render(renderer) {}
}

// http://gamedevgeek.com/tutorials/managing-game-states-in-c/
class GameEngine {
  constructor(input) {
    this.states = [];
    this.input = input;
  }

  init() {
    this.pushState(new MainMenu());
  }

  currentState() {
    const len = this.states.length;
    if (len > 0) {
      return this.states[len - 1];
    }
    return null;
  }

  replaceState(state) {
    const current = this.currentState();
    if (current) {
      this.states.pop().cleanup();
    }
    state.init();
    this.states.push(state);
  }

  pushState(state) {
    this.currentState()?.pause();
    state.init();
    this.states.push(state);
  }

  popState() {
    const current = this.currentState();
    if (current) {
      const state = this.states.pop();
      state.cleanup();
    }

    this.currentState()?.resume();
  }

  update() {
    this.currentState()?.update(this);
    this.input.endLoop();
  }

  render(renderer) {
    this.currentState()?.render(renderer);
  }
}

const engine = new GameEngine(input);
engine.init();
const game = new Game(scene);

class RenderPipeline {
  constructor(renderer) {
    this.renderer = renderer;

    this.normalTarget = renderer.newRenderTarget(1);
    this.normalTarget.depthTexture = new THREE.DepthTexture();

    this.diffuseTarget = renderer.newRenderTarget(1);

    this.worldPositionTarget = renderer.newRenderTarget(1, {
      format: THREE.RGBAFormat,
      type: THREE.HalfFloatType,
    });

    this.gradientTarget = renderer.newRenderTarget(1, {
      format: THREE.RGBAFormat,
      type: THREE.HalfFloatType,
    });

    this.bufferTarget = renderer.newRenderTarget(1, {
      format: THREE.RGBAFormat,
      type: THREE.HalfFloatType,
    });

    this.bufferTarget2 = renderer.newRenderTarget(1, {
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

  applyPostProcess(uniforms, fragShader, outputBuffer) {
    const gradientPass = new FullScreenQuad(
      new THREE.ShaderMaterial({
        uniforms: uniforms,
        vertexShader: `
        #include <packing>
        varying vec2 vUv;
    
        void main() {
    
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
    
        }`,
        fragmentShader: fragShader,
      })
    );
    const temp = this.renderer.getRenderTarget();
    this.renderer.setRenderTarget(outputBuffer);
    gradientPass.render(this.renderer);
    this.renderer.setRenderTarget(temp);
  }

  render(scene, camera) {
    camera.updateUniforms();

    let start, end;
    let buffer1 = this.bufferTarget;
    let buffer2 = this.bufferTarget2;
    switch (gui.data.renderMode.value) {
      case "LabOkGradient":
        start = OkLabColor.fromLinearRGB(1, 1, 1);
        end = OkLabColor.fromLinearRGB(0, 0, 1);
        break;
      case "LinearGradient":
      default:
        start = new THREE.Color(1, 1, 1);
        end = new THREE.Color(0, 0, 1);
        break;
    }

    switch (gui.data.renderMode.value) {
      case "LabOkGradient":
      case "LinearGradient":
        this.applyPostProcess(
          {
            tInput: { value: buffer2.texture },
            uStartColor: { value: start },
            uEndColor: { value: end },
          },
          PPS.gradientFragShader,
          buffer1
        );
        const temp = buffer1;
        buffer1 = buffer2;
        buffer2 = temp;
        break;
      default:
        this.renderOverride(scene, camera, null, buffer2);
        break;
    }

    switch (gui.data.renderMode.value) {
      case "LabOkGradient":
        this.applyPostProcess(
          {
            tInput: { value: buffer2.texture },
          },
          PPS.labToLinearFragShader,
          buffer1
        );
        const temp = buffer1;
        buffer1 = buffer2;
        buffer2 = temp;
        break;
      default:
        break;
    }
    this.applyPostProcess(
      {
        tInput: { value: buffer2.texture },
      },
      PPS.gammaFragShader,
      null
    );
  }
}

const cube = new THREE.Mesh(
  new THREE.SphereGeometry(10),
  new THREE.MeshStandardMaterial()
);
scene.add(cube);

const controls = new OrbitControls(camera, renderer.domElement);
const pipeline = new RenderPipeline(renderer);

function raf() {
  stats.begin();
  pipeline.render(scene, camera);
  time.tick();
  cube.rotateOnAxis(new THREE.Vector3(0, 1, 0), time.time.userDeltaTime);
  game.update(time);
  engine.update();
  engine.render(renderer);

  //controls.update();
  time.endLoop();
  stats.end();
  window.requestAnimationFrame(raf);
}

window.requestAnimationFrame(raf);
