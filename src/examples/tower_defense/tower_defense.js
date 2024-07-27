import * as THREE from "three";
import { Vector3 } from "three";
import { GameState } from "../../engine/engine.js";
import { GameOverMenu } from "./game_over_menu.js";
import { TowerDefenseGame, Enemy, Tower } from "./tower_defense_game.js";
import { GridPosition } from "./grid_position.js";

export class TowerDefense extends GameState {
  constructor({ ui, window }) {
    super({
      ui,
      window,
      cameraConfig: {
        isPerspective: false,
        width: 10,
      },
    });
  }

  init() {
    this.game = new TowerDefenseGame();
    const effects = this.game.init();
    this.updateRender(effects);
    this.buildingConstructor = null;
    this.camera.position.copy(new Vector3(4, 4, 4));
    this.camera.lookAt(new Vector3());

    const grid = (x, y) => {
      const geo = new THREE.PlaneGeometry(
        GridPosition.gridSize,
        GridPosition.gridSize
      );
      geo.rotateX(-Math.PI / 2);
      const mesh = new THREE.Mesh(
        geo,
        new THREE.MeshBasicMaterial({
          color: (x + y) % 2 === 0 ? "lightgray" : "grey",
        })
      );
      mesh.gridPos = new GridPosition(x, y);
      this.add(mesh);
      mesh.position.copy(mesh.gridPos.toVector3());
      mesh.position.y = 0;
      return mesh;
    };

    for (let x = this.game.bounds[0].x; x <= this.game.bounds[1].x; x++) {
      for (let y = this.game.bounds[0].y; y <= this.game.bounds[1].y; y++) {
        grid(x - 0.5, y - 0.5);
      }
    }

    const makeGround = (height, width) => {
      const geo = new THREE.PlaneGeometry(width, height);
      geo.rotateX(-Math.PI / 2);
      const mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial());
      this.add(mesh);
      mesh.visible = false;
      mesh.layers.enable(1);
      return mesh;
    };

    const makeHint = () => {
      const geo = new THREE.BoxGeometry(0.2, 0.2, 0.2);
      const material = new THREE.MeshBasicMaterial({ color: "grey" });
      const mesh = new THREE.Mesh(geo, material);
      material.transparent = true;
      material.opacity = 0;
      this.add(mesh);
      return mesh;
    };

    this.ground = makeGround(100, 100);
    this.hint = makeHint();

    this.buildMenu = this.ui.createElement({
      classNames: "row-c",
      style: {
        position: "absolute",
        top: "80%",
        right: "10%",
        height: "10%",
        width: "80%",
      },
    });

    this.build = this.ui.createElement({
      classNames: "interactive column-c",
      style: {
        height: "90%",
        aspectRatio: 1,
      },
      data: {
        command: {
          type: "selectBuilding",
          buildingConstructor: Tower,
        },
      },
      parent: this.buildMenu,
      children: [
        {
          classNames: "f-s",
          text: "Build1",
        },
      ],
    });
    this.gold = this.ui.createElement({
      text: `Gold: ${this.game.state.gold}`,
      parent: this.ui.createElement({
        classNames: "row-c",
        style: {
          position: "absolute",
          top: "10%",
          right: "10%",
          height: "10%",
          width: "10%",
        },
      }),
    });

    this.lives = this.ui.createElement({
      text: `Lives left: ${this.game.state.lives}`,
      parent: this.ui.createElement({
        classNames: "row-c",
        style: {
          position: "absolute",
          top: "10%",
          right: "80%",
          height: "10%",
          width: "10%",
        },
      }),
    });
    this.spawn = this.ui.createElement({
      classNames: "interactive column-c",
      style: {
        height: "90%",
        width: "30%",
      },
      data: {
        command: {
          type: "spawnEnemy",
          enemyConstructor: Enemy,
        },
      },
      parent: this.buildMenu,
      children: [
        {
          text: "Spawn Enemy",
        },
      ],
    });
  }

  cleanup() {}
  pause() {}
  resume() {}

  generateCommands(state) {
    const { mouse, object, ui } = state;
    const { released } = mouse;
    if (ui.clicked.length > 0) {
      const command = ui.clicked[0].data.command;
      switch (command.type) {
        case "selectBuilding":
          this.buildingConstructor =
            this.buildingConstructor === command.buildingConstructor
              ? null
              : command.buildingConstructor;
          break;
        default:
          break;
      }
      return [command];
    }
    const hit = object.hover.get(this.ground);
    if (hit && released && this.buildingConstructor) {
      return [
        {
          type: "create",
          entity: new this.buildingConstructor(hit.point),
        },
      ];
    }
    return [];
  }

  updateRender(effects) {
    for (let i = 0; i < effects.length; i++) {
      const effect = effects[i];
      switch (effect.effect) {
        case "spawn":
          const { entity } = effect;
          switch (entity.name) {
            case "goal":
              const makeGoal = () => {
                const geo = new THREE.CylinderGeometry(0.2, 0.2, 0.2);
                const material = new THREE.MeshBasicMaterial({
                  color: "yellow",
                });
                const mesh = new THREE.Mesh(geo, material);
                this.add(mesh);
                mesh.position.copy(entity.gridPos.toVector3());
                mesh.entity = entity;
                mesh.position.y = 0;
                return mesh;
              };
              makeGoal();
              break;
            case "tower":
              this.gold.innerText = `Gold: ${this.game.state.gold}`;
              const makeTower = () => {
                const geo = new THREE.BoxGeometry(0.2, 0.2, 0.2);
                const material = new THREE.MeshBasicMaterial({
                  color: "red",
                });
                const mesh = new THREE.Mesh(geo, material);
                this.add(mesh);
                mesh.position.copy(entity.position);
                mesh.entity = entity;
                mesh.position.y = 0;
                return mesh;
              };
              makeTower();
              break;
            case "enemy":
              const makeEnemy = () => {
                const geo = new THREE.ConeGeometry(0.2, 0.3);
                const material = new THREE.MeshBasicMaterial({
                  color: "green",
                });
                const mesh = new THREE.Mesh(geo, material);
                this.add(mesh);
                mesh.position.copy(entity.position);
                mesh.entity = entity;
                return mesh;
              };
              makeEnemy();
              break;
            case "projectile":
              const makeProjectile = () => {
                const geo = new THREE.SphereGeometry(0.05);
                const material = new THREE.MeshBasicMaterial({
                  color: "yellow",
                });
                const mesh = new THREE.Mesh(geo, material);
                this.add(mesh);
                mesh.position.copy(entity.position);
                mesh.entity = entity;
                return mesh;
              };
              makeProjectile();
              break;
            default:
              break;
          }
          break;
        case "attack":
          break;
        case "died":
          this.gold.innerText = `Gold: ${this.game.state.gold}`;
          this.lives.innerText = `Lives left: ${this.game.state.lives}`;
        case "reachedFlag":
          {
            const matching = [];
            this.traverse((child) => {
              if (child.entity === effect.entity) {
                matching.push(child);
              }
            });
            matching.forEach((v) => {
              this.remove(v);
            });
          }
          break;
        case "moved":
          const matching = [];
          this.traverse((child) => {
            if (child.entity === effect.entity) {
              matching.push(child);
            }
          });
          matching.forEach((v) => {
            v.position.copy(v.entity.position);
          });
          break;
        case "gameover":
          this.lives.innerText = `Lives left: ${this.game.state.lives}`;
          break;
        case "liveschange":
          this.lives.innerText = `Lives left: ${this.game.state.lives}`;
          break;
        default:
          break;
      }
    }
  }

  update(engine) {
    const state = engine.input.getState();
    const commands = this.generateCommands(state);
    let effects = this.game.handle(commands);

    if (commands.find((c) => c.type === "step") || true) {
      effects = effects.concat(this.game.step());
    }
    this.updateRender(effects);

    const { object } = state;
    const hit = object.hover.get(this.ground);
    if (hit && this.buildingConstructor) {
      const gridPos = new GridPosition(hit.point);
      this.hint.position.copy(gridPos.toVector3());
      const legalPos = this.game.legalBuild(gridPos);

      if (legalPos.result) {
        this.hint.visible = true;
        this.hint.material.color = new THREE.Color("#1b680c");
        this.hint.material.opacity = 0.5;
      } else {
        switch (legalPos.reason) {
          case "blocksPath":
          case "insufficientFunds":
            this.hint.visible = true;
            this.hint.material.color = new THREE.Color("#cd0808");
            this.hint.material.opacity = 0.5;
            break;
          case "occupied":
          case "outOfBounds":
          default:
            this.hint.visible = false;
        }
      }
    } else {
      this.hint.visible = false;
    }

    if (effects.find((v) => v.effect === "gameover")) {
      engine.pushState(GameOverMenu);
    }
  }

  render(renderer) {
    renderer.render(this, this.camera);
  }
}
