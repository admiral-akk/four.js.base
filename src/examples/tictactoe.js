import * as THREE from "three";
import { KeyedMap, KeyedSet } from "../utils/helper.js";
import { MeshBasicMaterial } from "three";
import { gsap } from "gsap";
import { generateCamera } from "../utils/camera.js";

export class MainMenu {
  constructor() {}

  init() {
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
    div.style.pointerEvents = "auto";
    this.ui.appendChild(div);
    this.div = div;
  }

  cleanup() {}

  pause() {}
  resume() {}

  update(engine) {
    const { ui } = engine.input.getState();
    if (ui.clicked.find((v) => v === this.div) !== undefined) {
      engine.replaceState(new TicTacToe());
    }
  }
  render(renderer) {}
}

class Position {
  constructor(x, y) {
    this.x = x;
    this.y = y;
  }
  key() {
    return this.x + "-" + this.y;
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
      switch (command.type) {
        case "mark":
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
          break;
        default:
          break;
      }
    }
    const gameOverEffect = this.gameover();
    if (gameOverEffect) {
      effects.push(gameOverEffect);
    }
    return effects;
  }
}

class TicTacToe extends THREE.Scene {
  constructor() {
    super();
    this.targets = new KeyedSet();
    this.marks = new KeyedMap();
    this.commands = [];
  }

  generateCommands(input) {
    const { mouse, object, ui } = input.getState();
    const { released } = mouse;
    if (ui.clicked.length > 0) {
      return [ui.clicked[0].command];
    }
    if (this.game.gameover() !== null) {
      return [];
    }
    if (released) {
      const target = object.hover.find((v) => {
        return this.targets.has(v);
      });
      if (target) {
        const pos = target.pos;
        return [{ type: "mark", pos: pos, player: this.game.activePlayer }];
      }
    }
    return [];
  }

  init() {
    this.game = new TicTacToeGame();
    const camera = new THREE.PerspectiveCamera(75, 16 / 9);
    this.add(camera);
    camera.position.copy(
      new THREE.Vector3(0, 0, 4).normalize().multiplyScalar(10)
    );

    camera.lookAt(new THREE.Vector3());

    this.camera = camera;

    var div = document.createElement("div");
    // https://css-tricks.com/fitting-text-to-a-container/
    div.style.position = "absolute";
    div.style.fontSize = "2cqi";
    div.style.top = "90%";
    div.style.right = "45%";
    div.style.height = "10%";
    div.style.width = "10%";
    div.style.background = "red";
    div.style.container = "ui";
    div.innerHTML = "Main menu";
    div.command = { type: "mainmenu" };
    div.style.pointerEvents = "auto";
    this.ui.appendChild(div);

    const makeLine = (position, height, width) => {
      const geo = new THREE.BoxGeometry(width, height, 0.2);
      const mesh = new THREE.Mesh(geo, new MeshBasicMaterial());
      mesh.position.copy(position);
      this.add(mesh);
    };

    this.tl = gsap.timeline();
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

    const makeTarget = (x, y) => {
      const plane = new THREE.PlaneGeometry(1.6, 1.6);
      const mesh = new THREE.Mesh(plane, new MeshBasicMaterial());

      mesh.visible = false;

      mesh.position.copy(new THREE.Vector3(2 * x - 2, 2 * y - 2, 0));
      this.add(mesh);
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

  update(engine) {
    engine.input.update(this, this.camera);
    this.commands = this.commands.concat(this.generateCommands(engine.input));
    const endGame = this.commands.find((v) => v.type === "mainmenu");
    const newGame = this.commands.find((v) => v.type === "newgame");
    if (endGame) {
      engine.replaceState(new MainMenu());
    } else if (newGame) {
      engine.replaceState(new TicTacToe());
    } else if (this.commands.length > 0) {
      const effects = this.game.update(this.commands);
      this.updateG(this.game, effects, engine, engine.input);
    } else {
      this.updateG(this.game, [], engine, engine.input);
    }
    this.commands = [];
  }

  updateG(game, effects, engine, input) {
    this.hint.material.color =
      game.activePlayer === "X"
        ? new THREE.Color("green")
        : new THREE.Color("red");
    const { mouse, object } = input.getState();
    const buttons = (mouse.pressed || 0) | (mouse.held || 0);

    // update hint to be where it's pointing
    if (game.gameover() === null && object.hover.length) {
      const position = object.hover[0].pos;
      this.hint.position.copy(
        new THREE.Vector3(2 * position.x - 2, 2 * position.y - 2, 0)
      );
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
      const plane = new THREE.PlaneGeometry(1.3, 1.3);
      const mesh = new THREE.Mesh(
        plane,
        new MeshBasicMaterial({ color: player === "X" ? "green" : "red" })
      );

      this.marks.set(position, mesh);
      mesh.position.copy(
        new THREE.Vector3(2 * position.x - 2, 2 * position.y - 2, 0)
      );

      this.tl.fromTo(
        mesh.scale,
        {
          x: 0.5,
          y: 0.5,
          z: 0.5,
        },
        {
          duration: 0.8,
          ease: "elastic.out(1,0.3)",
          x: 1,
          y: 1,
          z: 1,
        },
        this.tl.time()
      );
      this.add(mesh);
    };
    for (let i = 0; i < effects.length; i++) {
      const effect = effects[i];
      switch (effect.effect) {
        case "add":
          console.log("make mark");
          makeMark(effect.pos, effect.player);
          break;
        case "gameover":
          // highlight the winning lines if any
          effect.lines.forEach((line) => {
            let delay = ">";
            for (let i = 0; i < line.length; i++) {
              const mesh = this.marks.get(line[i]);
              this.tl.to(
                mesh.scale,
                {
                  duration: 0.2,
                  ease: "power3.in",
                  x: 1.4,
                  y: 1.4,
                  z: 1.4,
                },
                delay
              );
              this.tl.to(
                mesh.scale,
                {
                  duration: 0.2,
                  ease: "power3.out",
                  x: 1.0,
                  y: 1.0,
                  z: 1.0,
                },
                ">"
              );
              delay = "<";
            }
          });
          // show the game over menu

          const createMenu = () => {
            var menu = document.createElement("div");
            menu.style.position = "absolute";
            menu.style.fontSize = "2cqi";
            menu.style.top = "30%";
            menu.style.right = "40%";
            menu.style.height = "40%";
            menu.style.display = "flex";
            menu.style.flexDirection = "column";
            menu.style.width = "20%";
            menu.style.alignItems = "center";
            menu.style.background = "yellow";
            menu.style.justifyContent = "space-around";
            menu.style.container = "ui";
            this.ui.appendChild(menu);

            var div = document.createElement("div");
            // https://css-tricks.com/fitting-text-to-a-container/

            div.style.fontSize = "2cqi";
            div.style.height = "40%";
            div.style.width = "90%";
            div.style.background = "red";
            div.style.container = "ui";
            div.innerHTML = "New Game";
            div.command = { type: "newgame" };
            div.style.pointerEvents = "auto";
            var div2 = document.createElement("div");
            // https://css-tricks.com/fitting-text-to-a-container/

            div2.style.fontSize = "2cqi";
            div2.style.height = "40%";
            div2.style.width = "90%";
            div2.style.background = "red";
            div2.style.container = "ui";
            div2.innerHTML = "Main Menu";
            div2.command = { type: "mainmenu" };
            div2.style.pointerEvents = "auto";
            menu.appendChild(div);
            menu.appendChild(div2);
          };
          if (!this.tl.isActive()) {
            createMenu();
          } else {
            this.tl.eventCallback("onComplete", createMenu);
          }
          break;
        default:
          break;
      }
    }
  }
  cleanup() {}
  pause() {}
  resume() {}
  render(renderer) {
    renderer.render(this, this.camera);
  }
}
