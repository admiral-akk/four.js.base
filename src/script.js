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
import { SokobanParser } from "./sokoban/parser.js";

const gui = new DebugManager();
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

// https://colorhunt.co/palette/f9ed69f08a5db83b5e6a2c70
const yellow = new THREE.Color(0xf9ed69);
const orange = new THREE.Color(0xf08a5d);
const red = new THREE.Color(0xb83b5e);
const purple = new THREE.Color(0x6a2c70);
const grey = new THREE.Color(0xbbbbbb);

const controls = new CameraController(camera, time, new THREE.Vector3());

class Floor {
  constructor(x, y, adjacency) {
    this.x = x;
    this.y = y;
    this.adjacency = adjacency;
    this.graphics = {};
    loader.load("./model/road/road_crossroad.glb", (model) => {
      this.graphics.obj = model.clone();
      scene.add(this.graphics.obj);
      this.update();
    });
  }

  update() {
    this.graphics.obj.position.set(this.x, 0, this.y - 0.5);
  }

  unload() {
    scene.remove(this.graphics.obj);
  }
}

class Wall {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.update();
  }

  update() {}

  unload() {}
}

class Box {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.graphics = {};
    loader.load("./model/sedanSports.glb", (model) => {
      this.graphics.obj = model.clone();
      this.graphics.obj.scale.set(0.25, 0.25, 0.25);
      scene.add(this.graphics.obj);
      this.update();
    });
  }

  update() {
    this.graphics.obj.position.set(this.x, 0, this.y + 0.25);
  }

  unload() {
    scene.remove(this.graphics.obj);
  }
}

class Button {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.graphics = {};
    loader.load("./model/road/road_crossroadPath.glb", (model) => {
      this.graphics.obj = model.clone();
      scene.add(this.graphics.obj);
      this.update();
    });
    loader.load("./model/sedanSports.glb", (model) => {
      this.graphics.car = model.clone();
      this.graphics.car.scale.set(0.25, 0.25, 0.25);
      const material = new THREE.MeshBasicMaterial({
        transparent: true,
        color: yellow,
        opacity: 0.25,
      });
      this.graphics.car.traverse((child) => {
        child.material = material;
      });
      scene.add(this.graphics.car);
      this.update();
    });
  }

  update(occupied) {
    if (this.graphics.obj) {
      this.graphics.obj.position.set(this.x, 0, this.y - 0.5);
    }
    if (this.graphics.car) {
      this.graphics.car.position.set(this.x, 0, this.y + 0.25);
      this.graphics.car.visible = !occupied;
    }
  }

  unload() {
    scene.remove(this.graphics.obj);
  }
}

class Player {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.graphics = {};
    loader.load("./model/truckFlat.glb", (model) => {
      this.graphics.obj = model.clone();
      this.graphics.obj.scale.set(0.25, 0.25, 0.25);
      scene.add(this.graphics.obj);
      this.update();
    });
    this.connected = null;
  }

  connect(box) {
    this.connected = this.connected === box ? null : box;
  }

  update() {
    this.graphics.obj.position.set(this.x, 0, this.y + 0.25);
    controls.target = this.graphics.obj.position;
  }

  unload() {
    scene.remove(this.graphics.obj);
  }
}

class Position {
  constructor(x, y) {
    this.x = x;
    this.y = y;
  }

  equals(other) {
    return other.x === this.x && other.y === this.y;
  }

  key() {
    return this.x + "|" + this.y;
  }

  adjacent() {
    return [
      new Position(this.x + 1, this.y),
      new Position(this.x - 1, this.y),
      new Position(this.x, this.y + 1),
      new Position(this.x, this.y - 1),
    ];
  }
}

class KeyedSet extends Set {
  add(keyedValue) {
    const key = keyedValue.key ? keyedValue.key() : keyedValue;
    return super.add(key);
  }

  has(keyedValue) {
    const key = keyedValue.key ? keyedValue.key() : keyedValue;
    return super.has(key);
  }

  delete(keyedValue) {
    const key = keyedValue.key ? keyedValue.key() : keyedValue;
    return super.delete(key);
  }
}

const bfs = (nextPos, validPos) => {
  const queue = [nextPos];
  const visited = new KeyedSet();
  while (queue.length > 0) {
    const p = queue.pop();
    if (visited.has(p)) {
      continue;
    }
    visited.add(p);
    if (!validPos.has(p)) {
      continue;
    }
    queue.push(...p.adjacent());
  }
  return visited;
};

class Level {
  constructor({ level, solution }) {
    const mapRows = level;
    const width = mapRows[0].length;
    const height = mapRows.length;

    const counts = new Map();

    for (const ch of solution.toLowerCase()) {
      const count = counts.get(ch) ?? 0;

      counts.set(ch, count + 1);
    }
    const xOffset = (counts.get("r") ?? 0) - (counts.get("l") ?? 0);
    const yOffset = (counts.get("d") ?? 0) - (counts.get("u") ?? 0);

    var playerPos = null;

    const nonWalls = new KeyedSet();

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const value = mapRows[y][x];
        const pos = new Position(x, y);
        if (value !== "#") {
          nonWalls.add(pos);
        }
        if (value === "@" || value === "+") {
          playerPos = pos;
        }
      }
    }

    const accessibleSquares = bfs(playerPos, nonWalls);

    this.state = {
      player: null,
      walls: [],
      boxes: [],
      buttons: [],
      floors: [],
      map: mapRows.map((r) => r.split("")),
      moves: [],
    };

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const pos = new Position(x, y);
        switch (mapRows[y][x]) {
          case "#":
          case "$":
          case "*":
            break;
          default:
            if (accessibleSquares.has(pos)) {
              this.state.floors.push(new Floor(x, y));
            }
            break;
        }
        switch (mapRows[y][x]) {
          case "#":
            this.state.walls.push(new Wall(x, y));
            break;
          case "*":
          case ".":
          case "+":
            this.state.boxes.push(new Box(x, y));
            break;
          default:
            break;
        }
        switch (mapRows[y][x]) {
          case "@":
          case "+":
            this.state.player = new Player(x + xOffset, y + yOffset);
            break;
          case "$":
          case "*":
            this.state.buttons.push(new Button(x, y));
            break;
          default:
            break;
        }
      }
    }
  }

  unload() {
    const { boxes, player, walls, buttons, floors } = this.state;
    boxes
      .concat([player])
      .concat(walls)
      .concat(buttons)
      .concat(floors)
      .forEach((v) => v.unload());
  }

  undo() {
    const { moves } = this.state;
    if (moves.length === 0) {
      return;
    }

    this.undoMove(moves.pop());
  }

  undoMove({ deltaX, deltaY, boxMoved }) {
    const { boxes, player } = this.state;

    const nextX = player.x - deltaX;
    const nextY = player.y - deltaY;
    if (boxMoved) {
      const box = boxes.find((w) => w.x === nextX && w.y === nextY);
      box.x -= deltaX;
      box.y -= deltaY;
    }
    player.x -= deltaX;
    player.y -= deltaY;
    this.update();
  }

  attemptMove({ deltaX, deltaY }) {
    const { boxes, player, walls } = this.state;
    if (deltaX) {
      deltaY = 0;
    }

    const targetX = player.x + deltaX;
    const targetY = player.y + deltaY;

    const connectBox = boxes.find((b) => b.x === targetX && b.y === targetY);

    if (connectBox) {
      player.connect(connectBox);
    }

    // check if space is occupied by wall/box
    if (walls.concat(boxes).some((w) => w.x === targetX && w.y === targetY)) {
      return;
    }

    if (player.connected) {
      // check if they're moving in the direction where

      if (
        player.x - targetX === player.connected.x - player.x &&
        player.y - targetY === player.connected.y - player.y
      ) {
        player.connected.x = player.x;
        player.connected.y = player.y;
      } else {
        player.connect(null);
      }
    }

    player.x = targetX;
    player.y = targetY;
    this.update();
  }

  update() {
    const { boxes, player, walls, buttons } = this.state;

    boxes.concat(player, walls).forEach((v) => v.update());
    buttons.forEach((b) =>
      b.update(!!boxes.concat(player).find((p) => p.x === b.x && p.y === b.y))
    );
  }

  completed() {
    const { boxes, buttons } = this.state;

    return buttons.every(
      (button) =>
        !!boxes.find((box) => box.x === button.x && box.y === button.y)
    );
  }

  getStats() {
    const { boxes, buttons } = this.state;
    return {
      hitTargets: buttons.filter(
        (button) =>
          !!boxes.find((box) => box.x === button.x && box.y === button.y)
      ).length,
      totalTargets: buttons.length,
    };
  }
}

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
    ui.appendChild(tutorial);
    tutorial.appendChild(tutorialText);
    ui.appendChild(div);
  }

  updateStats({ hitTargets, totalTargets }) {
    this.div.innerHTML = `${hitTargets} / ${totalTargets}`;
  }
}

class Game {
  constructor(scene, input) {
    this.state = "WAITING";
    const queryParams = new URLSearchParams(window.location.search);
    this.currentLevel = queryParams.get("level") ?? 0;
    loader.load("./text/beginnerWithSolution.txt", (v) => {
      this.parsedLevels = new SokobanParser(v);
      this.loadLevel();
    });
    this.ui = new UiController();
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
    this.state = "INGAME";
  }

  loadLevel() {
    this.level = new Level(this.parsedLevels.levels[this.currentLevel]);
  }

  update(time) {
    if (this.state == "WAITING") {
      return;
    }
    if (!this.level) {
      return;
    }
    const stats = this.level.getStats();
    this.ui.updateStats(stats);
    if (this.level.completed()) {
      this.level.unload();
      this.currentLevel++;
      this.loadLevel();
      return;
    }

    const w = input.getKey("w");
    const s = input.getKey("s");
    const a = input.getKey("a");
    const d = input.getKey("d");
    const z = input.getKey("z");
    const space = input.getKey(" ");

    const active = (v, opp = null) => {
      return +(
        !opp &&
        (v?.ticks === 0 || (v?.ticks > 30 && v?.ticks % 10 === 0))
      );
    };

    const deltaY = active(w) - active(s);
    const deltaX = active(d) - active(a);
    const undo = active(z);
    const isPull = !!space;
    if (undo) {
      this.level.undo();
    } else if (deltaX !== 0 || deltaY !== 0) {
      this.level.attemptMove({ deltaX, deltaY: -deltaY, isPull });
    }
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
    camera.updateUniforms();
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
          ...camera.uniforms,
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
          tInput: { value: this.diffuseTarget.texture },
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

const startMenu = new Menu();

function raf() {
  pipeline.render(scene, camera);
  time.tick();
  game.update(time);
  controls.update();
  time.endLoop();
  window.requestAnimationFrame(raf);
}

window.requestAnimationFrame(raf);
