import "./style.css";
import * as THREE from "three";
import { TimeManager } from "./utils/time.js";
import { WindowManager } from "./utils/window.js";
import { DebugManager } from "./utils/debug.js";
import { customRenderer } from "./utils/renderer.js";
import { generateCamera, cameraConfig } from "./utils/camera.js";
import Stats from "stats-js";
import { FullScreenQuad } from "three/addons/postprocessing/Pass.js";
import { generateLoadingManager } from "./utils/loader.js";
import * as PPS from "./utils/postProcessingShaders.js";
import { basicCustomShader } from "./utils/basicCustomShader.js";
import { InputManager } from "./utils/input.js";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

const gui = new DebugManager();
var stats = new Stats();
stats.showPanel(0); // 0: fps, 1: ms, 2: mb, 3+: custom
document.body.appendChild(stats.dom);

const time = new TimeManager();
const scene = new THREE.Scene();
const loader = generateLoadingManager();
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
      phi: (3 * Math.PI) / 2 + 0.1,
      theta: Math.PI / 4,
      distance: 10,
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

// https://colorhunt.co/palette/f9ed69f08a5db83b5e6a2c70
const yellow = new THREE.Color(0xf9ed69);
const orange = new THREE.Color(0xf08a5d);
const red = new THREE.Color(0xb83b5e);
const purple = new THREE.Color(0x6a2c70);
const grey = new THREE.Color(0xbbbbbb);

const controls = new CameraController(camera, time, new THREE.Vector3());
class Game {
  constructor(scene, input) {
    this.scene = scene;
    this.input = input;
    const box = new THREE.Mesh(
      new THREE.BoxGeometry(1, 1),
      new THREE.MeshBasicMaterial({ color: yellow })
    );
    box.position.set(0, 1, 0);
    box.castShadow = true;
    box.receiveShadow = true;
    scene.add(box);

    controls.target = box.position;

    const sphere = new THREE.Mesh(
      new THREE.SphereGeometry(1),
      new THREE.MeshBasicMaterial({ color: orange })
    );
    sphere.position.set(2, 2, 2);
    sphere.castShadow = true;
    sphere.receiveShadow = true;
    scene.add(sphere);

    const planeG = new THREE.PlaneGeometry(100, 100);
    const plane = new THREE.Mesh(
      planeG,
      new THREE.MeshBasicMaterial({ color: grey })
    );
    var uvAttribute = planeG.attributes.uv;

    for (var i = 0; i < uvAttribute.count; i++) {
      var u = uvAttribute.getX(i);
      var v = uvAttribute.getY(i);

      // do something with uv

      // write values back to attribute

      uvAttribute.setXY(i, 10 * u, 10 * v);
    }

    planeG.uvsNeedUpdate = true;
    plane.rotation.x = -Math.PI / 2;
    scene.add(plane);
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

    this.box = box;
  }

  update(time) {
    const w = input.getKey("w");
    const s = input.getKey("s");
    const a = input.getKey("a");
    const d = input.getKey("d");
    const forward =
      +(w !== undefined && w.heldGameTime == 0.0) -
      +(s !== undefined && s.heldGameTime == 0.0);
    const right =
      +(d !== undefined && d.heldGameTime == 0.0) -
      +(a !== undefined && a.heldGameTime == 0.0);
    this.box.position.add(new THREE.Vector3(forward, 0, right));
    this.box.setRotationFromEuler(new THREE.Euler(0, time.time.gameTime, 0));
    controls.target = this.box.position;
  }
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

const worldPosMaterial = new THREE.ShaderMaterial({
  uniforms: [],
  vertexShader: `
    varying vec3 vWorldPosition;
    
    void main() {
    
        vec4 objectPos = vec4(position, 1.);
        // Moves it into world space. Includes object rotations, scale, and translation.
        vec4 worldPos = modelMatrix * objectPos;
        // Applies view (moves it relative to camera position/orientation)
        vec4 viewPos = viewMatrix * worldPos;
        // Applies projection (orthographic/perspective)
        vec4 projectionPos = projectionMatrix * viewPos;
        gl_Position = projectionPos;
        vWorldPosition = worldPos.xyz;
    }
    `,

  fragmentShader: `
    varying vec3 vWorldPosition;
    
    void main()
    {
      gl_FragColor = vec4(vWorldPosition, 1.);
    }
    `,
});

class RenderPipeline {
  constructor(renderer) {
    this.renderer = renderer;

    this.normalTarget = renderer.newRenderTarget(1, 1);
    this.normalTarget.depthTexture = new THREE.DepthTexture();

    this.diffuseTarget = renderer.newRenderTarget(1, 1);

    this.shadowTarget = renderer.newRenderTarget(1, 1);

    this.worldPositionTarget = renderer.newRenderTarget(1, 1, {
      format: THREE.RGBAFormat,
      type: THREE.FloatType,
    });

    this.sobelTexture = renderer.newRenderTarget(1, 1);

    this.tempBuffer = renderer.newRenderTarget(1, 1);
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
    // Render normals + depth
    const normalMap = loader.load(
      "./texture/rock/Rock051_1K-JPG_NormalDX.jpg"
    ).value;

    normalMap.wrapS = THREE.RepeatWrapping;

    normalMap.wrapT = THREE.RepeatWrapping;
    this.renderOverride(
      scene,
      camera,
      new THREE.MeshNormalMaterial({ normalMap: normalMap }),
      this.normalTarget
    );
    this.renderOverride(
      scene,
      camera,
      worldPosMaterial,
      this.worldPositionTarget
    );
    this.renderOverride(
      scene,
      camera,
      new THREE.ShaderMaterial({
        ...basicCustomShader,
        fog: true,
        lights: true,
      }),
      this.shadowTarget
    );
    this.renderOverride(scene, camera, null, this.diffuseTarget);

    const sobelFilter = new FullScreenQuad(
      postProcessing(
        {
          textureWidth: { value: this.normalTarget.width },
          textureHeight: { value: this.normalTarget.height },
          pixelWidth: gui.add("pixelWidth", 2, {
            min: 1,
            max: 10,
            step: 1,
          }),
          tNormal: { value: this.normalTarget.texture },
          tDepth: { value: this.normalTarget.depthTexture },
          normalStrength: gui.add("normalStrength", 0.01, {
            min: 0,
            max: 0.1,
            step: 0.001,
          }),
          depthStrength: gui.add("depthStrength", 1, { min: 0, max: 10 }),
          ...camera.generateCameraUniforms(),
        },
        PPS.sobelFragShader
      )
    );

    this.renderer.setRenderTarget(this.sobelTexture);
    sobelFilter.render(this.renderer);

    for (let i = -1; i >= 0; i--) {
      const xPass = new FullScreenQuad(
        postProcessing(
          {
            textureWidth: { value: this.normalTarget.width },
            textureHeight: { value: this.normalTarget.height },
            xPixelJump: { value: 1 << i },
            yPixelJump: { value: 0 },
            tInput: { value: this.sobelTexture.texture },
          },
          PPS.fillFragShader
        )
      );
      this.renderer.setRenderTarget(this.tempBuffer);
      xPass.render(this.renderer);

      const yPass = new FullScreenQuad(
        postProcessing(
          {
            textureWidth: { value: this.normalTarget.width },
            textureHeight: { value: this.normalTarget.height },
            xPixelJump: { value: 0 },
            yPixelJump: { value: 1 },
            tInput: { value: this.tempBuffer.texture },
          },
          PPS.fillFragShader
        )
      );
      this.renderer.setRenderTarget(this.sobelTexture);
      yPass.render(this.renderer);
    }

    const renderTexturePass = new FullScreenQuad(
      postProcessing(
        {
          textureWidth: { value: this.normalTarget.width },
          textureHeight: { value: this.normalTarget.height },
          thickness: { value: 3 },
          scale: { value: 0.08 },
          frequency: { value: 3 },
          noiseScale: { value: 0.3 },
          noiseFrequency: { value: 20 },
          tShadow: { value: this.shadowTarget.texture },
          tWorldPos: { value: this.worldPositionTarget.texture },
        },
        PPS.crossHatchFrag
      )
    );
    this.renderer.setRenderTarget(this.tempBuffer);
    renderTexturePass.render(this.renderer);

    const combinePass = new FullScreenQuad(
      postProcessing(
        {
          tDiffuse: { value: this.diffuseTarget.texture },
          tSobel: { value: this.sobelTexture.texture },
          tHatch: { value: null },
        },
        PPS.combineFragShader
      )
    );
    this.renderer.setRenderTarget(this.normalTarget);
    combinePass.render(this.renderer);

    const gammaPass = new FullScreenQuad(
      postProcessing(
        {
          tInput: { value: this.normalTarget.texture },
        },
        PPS.gammaFragShader
      )
    );
    this.renderer.setRenderTarget(null);
    gammaPass.render(this.renderer);
  }
}

const pipeline = new RenderPipeline(renderer);

function raf() {
  pipeline.render(scene, camera);
  time.tick();
  game.update(time);
  controls.update();
  time.endLoop();
  window.requestAnimationFrame(raf);
}

window.requestAnimationFrame(raf);
