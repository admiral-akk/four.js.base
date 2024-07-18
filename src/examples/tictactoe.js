import * as THREE from "three";
import { KeyedMap, KeyedSet } from "../utils/helper.js";
import { MeshBasicMaterial } from "three";
import { generateCamera } from "../utils/camera.js";

class Position {
  constructor(x, y) {
    this.x = x;
    this.y = y;
  }
  key() {
    return this.x + "-" + this.y;
  }
}

class TicTacToeIntent {
  constructor() {
    this.targets = new KeyedSet();
  }

  init(scene) {
    const makeTarget = (x, y) => {
      const plane = new THREE.PlaneGeometry(1.6, 1.6);
      const mesh = new THREE.Mesh(plane, new MeshBasicMaterial());

      mesh.visible = false;

      mesh.position.copy(new THREE.Vector3(2 * x - 2, 2 * y - 2, 0));
      scene.add(mesh);
      mesh.layers.enable(1);
      mesh.pos = new Position(x, y);
      mesh.key = mesh.pos.key;
      return mesh;
    };
    for (let i = 0; i < 9; i++) {
      const x = i % 3;
      const y = (i / 3) | 0;
      const target = makeTarget(x, y);
      this.targets.add(target);
    }
  }

  update(scene, input, camera) {
    const { mouse, object } = input.getState();
    const { released } = mouse;
    if (released) {
      const target = object.hover.find((v) => {
        return this.targets.has(v);
      });
      if (target) {
        const pos = target.pos;
        if (released & 1) {
          return [{ pos: pos, player: "X" }];
        } else {
          return [{ pos: pos, player: "Y" }];
        }
      }
    }
    return [];
  }
}

class TicTacToeGame {
  constructor() {
    this.activePlayer = "X";
    this.board = new KeyedMap();
  }

  gameover() {
    const lines = [];
    for (let x = 0; x < 3; x++) {
      const positions = [];
      for (let y = 0; y < 3; y++) {
        positions.push(new Position(x, y));
      }
      lines.push(positions);
    }
    for (let y = 0; y < 3; y++) {
      const positions = [];
      for (let x = 0; x < 3; x++) {
        positions.push(new Position(x, y));
      }
      lines.push(positions);
    }
    const diag = [];
    const diag2 = [];
    for (let x = 0; x < 3; x++) {
      diag.push(new Position(x, x));
      diag2.push(new Position(2 - x, x));
    }
    lines.push(diag);
    lines.push(diag2);

    let winningPlayer = null;
    const winningLines = [];
    for (let i = 0; i < lines.length; i++) {
      const positions = lines[i];
      const player = this.board.get(positions[0]);
      if (!player) {
        continue;
      }
      if (
        !positions.every((v) => {
          return this.board.get(v) === player;
        })
      ) {
        continue;
      }
      winningLines.push(positions);
      winningPlayer = player;
    }

    if (winningPlayer) {
      return {
        effect: "gameover",
        winner: winningPlayer,
        lines: winningLines,
      };
    } else if (this.board.size === 9) {
      return {
        effect: "gameover",
        winner: null,
        lines: [],
      };
    } else {
      return null;
    }
  }

  update(commands) {
    const effects = [];
    for (let i = 0; i < commands.length; i++) {
      const command = commands[i];
      if (command.player !== this.activePlayer) {
        continue;
      }

      if (this.board.has(command.pos)) {
        continue;
      }
      this.board.set(command.pos, command.player);
      this.activePlayer = command.player === "X" ? "Y" : "X";
      effects.push({
        effect: "add",
        pos: command.pos,
        player: command.player,
      });
    }
    const gameOverEffect = this.gameover();
    if (gameOverEffect) {
      effects.push(gameOverEffect);
    }
    return effects;
  }
}

class TicTacToeScene extends THREE.Scene {
  constructor() {
    super();
  }

  init() {
    const makeLine = (position, height, width) => {
      const geo = new THREE.BoxGeometry(width, height, 0.2);
      const mesh = new THREE.Mesh(geo, new MeshBasicMaterial());
      mesh.position.copy(position);
      this.add(mesh);
    };

    makeLine(new THREE.Vector3(1, 0, 0), 6, 0.2);
    makeLine(new THREE.Vector3(-1, 0, 0), 6, 0.2);
    makeLine(new THREE.Vector3(0, 1, 0), 0.2, 6);
    makeLine(new THREE.Vector3(0, -1, 0), 0.2, 6);
    const makeHint = (position, player) => {
      const plane = new THREE.PlaneGeometry(1.6, 1.6);
      const material = new MeshBasicMaterial({
        color: player === "X" ? "green" : "red",
      });
      const mesh = new THREE.Mesh(plane, material);

      mesh.position.copy(
        new THREE.Vector3(2 * position.x - 2, 2 * position.y - 2, 0)
      );
      material.transparent = true;
      material.opacity = 0;
      this.add(mesh);
      return mesh;
    };
    this.hint = makeHint({ x: 0, y: 0 }, "X");
  }

  cleanup() {}

  update(game, effects, engine, input) {
    this.hint.material.color =
      game.activePlayer === "X"
        ? new THREE.Color("green")
        : new THREE.Color("red");
    const { mouse, object } = input.getState();
    const buttons = (mouse.pressed || 0) | (mouse.held || 0);

    // update hint to be where it's pointing
    if (object.hover.length) {
      const position = object.hover[0].pos;
      this.hint.position.copy(
        new THREE.Vector3(2 * position.x - 2, 2 * position.y - 2, 0)
      );
      console.log(position);
      console.log(game.board);
      if (game.board.has(position)) {
        this.hint.material.opacity = 0;
      } else {
        switch (buttons) {
          default:
          case 0:
            this.hint.material.opacity = 0.5;
            break;
          case 1:
            if (game.activePlayer === "X") {
              this.hint.material.opacity = 0.75;
            } else {
              this.hint.material.opacity = 0.25;
            }
            break;
          case 2:
            if (game.activePlayer === "O") {
              this.hint.material.opacity = 0.25;
            } else {
              this.hint.material.opacity = 0.75;
            }
            break;
        }
      }
    } else {
      this.hint.material.opacity = 0;
    }
    const makeMark = (position, player) => {
      const plane = new THREE.PlaneGeometry(1.6, 1.6);
      const mesh = new THREE.Mesh(
        plane,
        new MeshBasicMaterial({ color: player === "X" ? "green" : "red" })
      );

      mesh.position.copy(
        new THREE.Vector3(2 * position.x - 2, 2 * position.y - 2, 0)
      );
      this.add(mesh);
    };
    for (let i = 0; i < effects.length; i++) {
      const effect = effects[i];
      switch (effect.effect) {
        case "add":
          makeMark(effect.pos, effect.player);
          break;
        case "gameover":
          engine.replaceState(new TicTacToe());
          break;
        default:
          break;
      }
    }
  }
}

export class TicTacToe {
  constructor() {}

  init() {
    this.game = new TicTacToeGame();
    this.scene = new TicTacToeScene();
    this.scene.init();
    this.intent = new TicTacToeIntent();
    this.intent.init(this.scene);
    this.camera = generateCamera(this.scene, {
      subtypeConfig: {
        type: "perspective",
        fov: 75,
        zoom: 10,
      },
      aspectRatio: 16 / 9,
      near: 0.001,
      far: 40.0,
      position: new THREE.Vector3(0, 0, 4).normalize().multiplyScalar(10),
    });
  }

  cleanup() {}

  pause() {}
  resume() {}

  update(engine) {
    engine.input.update(this.scene, this.camera);
    const commands = this.intent.update(this.scene, engine.input, this.camera);
    const effects = this.game.update(commands);
    this.scene.update(this.game, effects, engine, engine.input);
  }
  render(renderer) {
    renderer.render(this.scene, this.camera);
  }
}
