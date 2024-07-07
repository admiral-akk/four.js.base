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

const game = new Game(scene);

class RenderPipeline {
  constructor(renderer) {
    console.log(renderer);
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

  //controls.update();
  time.endLoop();
  stats.end();
  window.requestAnimationFrame(raf);
}

window.requestAnimationFrame(raf);
