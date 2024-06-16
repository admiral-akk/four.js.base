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
import {
  CCDIKSolver,
  CCDIKHelper,
} from "three/addons/animation/CCDIKSolver.js";

const gui = new DebugManager();
gui.add("renderMode", "StandardDiffuse", [
  "LabOkGradient",
  "LinearGradient",
  "StandardDiffuse",
]);
gui.add("autoUpdate", true);
gui.add("x", 0, -10);
gui.add("y", 0);
gui.add("z", 10);

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

//const controls = new CameraController(camera, time, new THREE.Vector3());

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

let ikSolver = undefined;
let targetBone = undefined;
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

    const segmentHeight = 8;
    const segmentCount = 3;
    const height = segmentHeight * segmentCount;
    const halfHeight = height * 0.5;

    const sizing = {
      segmentHeight,
      segmentCount,
      height,
      halfHeight,
    };

    const bones = [];

    const material = new THREE.MeshPhongMaterial({
      color: 0x156289,
      emissive: 0x072534,
      side: THREE.DoubleSide,
      wireframe: true,
      flatShading: true,
    });

    const material2 = new THREE.MeshPhongMaterial({
      color: 0x156289,
      emissive: 0x072534,
      flatShading: true,
    });

    const makeMesh = () => {
      const geo = new THREE.BoxGeometry(1, 7, 1);
      geo.translate(0, 3, 0);
      return new THREE.Mesh(geo, material2);
    };

    // "root bone"
    const rootBone = new THREE.Bone();
    rootBone.name = "root";
    rootBone.position.y = -sizing.halfHeight;
    bones.push(rootBone);

    //
    // "bone0", "bone1", "bone2", "bone3"
    //

    // "bone0"
    let prevBone = new THREE.Bone();
    prevBone.position.y = 0;
    rootBone.add(prevBone);
    bones.push(prevBone);
    // "bone1", "bone2", "bone3"
    for (let i = 1; i <= sizing.segmentCount; i++) {
      const bone = new THREE.Bone();
      bone.position.y = sizing.segmentHeight;
      bones.push(bone);
      bone.name = `bone${i}`;
      prevBone.add(makeMesh());
      prevBone.add(bone);
      prevBone = bone;
    }

    // "target"
    targetBone = new THREE.Bone();
    targetBone.name = "target";
    targetBone.position.y = sizing.height + sizing.segmentHeight; // relative to parent: rootBone
    rootBone.add(targetBone);
    bones.push(targetBone);

    const geometry = new THREE.CylinderGeometry(
      5, // radiusTop
      5, // radiusBottom
      sizing.height, // height
      8, // radiusSegments
      sizing.segmentCount * 1, // heightSegments
      true // openEnded
    );

    const position = geometry.attributes.position;

    const vertex = new THREE.Vector3();

    const skinIndices = [];
    const skinWeights = [];

    for (let i = 0; i < position.count; i++) {
      vertex.fromBufferAttribute(position, i);

      const y = vertex.y + sizing.halfHeight;

      const skinIndex = Math.floor(y / sizing.segmentHeight);
      const skinWeight = (y % sizing.segmentHeight) / sizing.segmentHeight;

      skinIndices.push(skinIndex, skinIndex + 1, 0, 0);
      skinWeights.push(1 - skinWeight, skinWeight, 0, 0);
    }

    geometry.setAttribute(
      "skinIndex",
      new THREE.Uint16BufferAttribute(skinIndices, 4)
    );
    geometry.setAttribute(
      "skinWeight",
      new THREE.Float32BufferAttribute(skinWeights, 4)
    );
    const mesh = new THREE.SkinnedMesh(geometry, material);
    const skeleton = new THREE.Skeleton(bones);

    mesh.add(bones[0]);

    mesh.bind(skeleton);
    scene.add(mesh);

    const skeletonHelper = new THREE.SkeletonHelper(mesh);
    skeletonHelper.material.linewidth = 2;
    scene.add(skeletonHelper);

    //
    // ikSolver
    //

    const iks = [
      {
        target: 5,
        effector: 4,
        links: [{ index: 3 }, { index: 2 }, { index: 1 }],
      },
    ];
    ikSolver = new CCDIKSolver(mesh, iks);
    scene.add(new CCDIKHelper(mesh, iks));
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

    this.bufferTarget2 = renderer.newRenderTarget(1, 1, {
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
        const gradientPass = new FullScreenQuad(
          postProcessing(
            {
              tInput: { value: buffer2.texture },
              uStartColor: { value: start },
              uEndColor: { value: end },
            },
            PPS.gradientFragShader
          )
        );
        this.renderer.setRenderTarget(buffer1);
        gradientPass.render(this.renderer);
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
        const linearConvertionPass = new FullScreenQuad(
          postProcessing(
            {
              tInput: { value: buffer2.texture },
            },
            PPS.labToLinearFragShader
          )
        );
        this.renderer.setRenderTarget(buffer1);
        linearConvertionPass.render(this.renderer);
        const temp = buffer1;
        buffer1 = buffer2;
        buffer2 = temp;
        break;
      default:
        break;
    }

    const gammaPass = new FullScreenQuad(
      postProcessing(
        {
          tInput: {
            value: buffer2.texture,
          },
        },
        PPS.gammaFragShader
      )
    );
    this.renderer.setRenderTarget(null);
    gammaPass.render(this.renderer);
  }
}

const controls2 = new OrbitControls(camera, renderer.domElement);
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
  if (targetBone) {
    targetBone.position.x = gui.data.x.value;
    targetBone.position.y = gui.data.y.value;
    targetBone.position.z = gui.data.z.value;
  }
  if (gui.data.autoUpdate.value) {
    ikSolver?.update();
  }

  //controls.update();
  time.endLoop();
  stats.end();
  window.requestAnimationFrame(raf);
}

window.requestAnimationFrame(raf);
