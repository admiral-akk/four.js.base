import { Scene, PerspectiveCamera, OrthographicCamera } from "three";
import { gsap } from "gsap";
import { AudioManager } from "./audio.js";
import { StateMachine } from "../utils/stateMachine.js";
import { UIManager } from "./ui.js";

class TickTracker {
  constructor(tickRate, getTime) {
    this.getTime = getTime;
    this.targetTime = getTime();
    this.setTickRate(tickRate);
  }

  setTickRate(tickRate) {
    this.delta = 1000 / tickRate;
  }

  shouldTick() {
    if (this.getTime() >= this.targetTime) {
      this.targetTime += this.delta;
      return true;
    }
    return false;
  }

  timeToNextTick() {
    return this.delta - (this.getTime() % this.delta);
  }
}

// http://gamedevgeek.com/tutorials/managing-game-states-in-c/
export class GameEngine extends StateMachine {
  constructor(
    input,
    time,
    loader,
    renderer,
    window,
    { fps = 60, gameRate = 30 }
  ) {
    super();
    this.input = input;
    gsap.globalTimeline.timeScale(1);
    this.ui = new UIManager();
    this.time = time;
    this.loader = loader;
    this.renderer = renderer;
    this.window = window;
    this.listener = new AudioManager(this.loader);
    this.listener.setMasterVolume(0.05);
    this.frameTracker = new TickTracker(fps, () => new Date().getTime());
    this.tickTracker = new TickTracker(
      gameRate,
      () => 1000 * gsap.globalTimeline.time()
    );
  }

  timeToNextTick() {
    return this.frameTracker.timeToNextTick();
  }

  playSound(path) {
    this.listener.play({ path });
  }

  makeContainer() {
    return this.ui.pushInstance();
  }

  cleanupState(state) {
    super.cleanupState(state);
    this.ui.dropInstance();
    this.input.cleanup(state);
  }

  update() {
    this.time.tick();

    const current = this.currentState();
    if (current) {
      this.input.update(current, current.camera);

      const clickedCommands = this.input.getState().ui.commands;
      if (clickedCommands) {
        current.commands.push(...clickedCommands);
      }
      current.update(this);
      while (this.tickTracker.shouldTick()) {
        current.tick(this);
      }
      current.timeToNextTick = this.tickTracker.timeToNextTick() / 1000;
    }
    this.endLoop();
  }

  endLoop() {
    const current = this.currentState();
    if (current) {
      current.commands.length = 0;
    }
    this.input.endLoop();
    this.time.endLoop();
  }

  render() {
    this.currentState()?.render(this.renderer);
  }
}

export class GameState extends Scene {
  constructor() {
    super();
  }

  init(engine) {
    this.ui = engine.makeContainer();
    this.tl = gsap.timeline();
    this.timeToNextTick = 0.1;
    this.commands = [];
    const { aspect } = engine.window.sizes;
    let camera = null;
    const cameraConfig = {
      isPerspective: false,
      width: 10,
    };
    if (cameraConfig.isPerspective) {
      const { fov } = cameraConfig;
      camera = new PerspectiveCamera(fov, aspect);
    } else {
      const halfWidth = cameraConfig.width / 2;
      camera = new OrthographicCamera(
        -halfWidth * aspect,
        halfWidth * aspect,
        halfWidth,
        -halfWidth
      );
    }
    this.add(camera);
    this.camera = camera;
    this.manifest().forEach((path) => engine.listener.load({ path }));
    this.camera.add(engine.listener);
  }

  // things to load
  manifest() {
    return [];
  }

  cleanup() {}
  pause() {}
  resume() {}

  tick(engine) {}
  update(engine) {
    this.input.update(engine, this);
  }
  resolveCommands(engine) {}

  clearCommands() {
    this.commands.length = 0;
  }

  render(renderer) {
    renderer.render(this, this.camera);
  }
}
