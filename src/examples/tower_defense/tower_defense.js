import * as THREE from "three";
import { Vector3 } from "three";
import { GameState } from "../../engine/engine.js";
import { GameOverMenu } from "./game_over_menu.js";
import { TowerDefenseGame } from "./tower_defense_game.js";
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
    this.buildingConfig = null;
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

    this.towerUi = this.ui.createElement({
      classNames: "column-c",
      style: {
        position: "absolute",
        height: "10%",
        width: "10%",
        display: "none",
      },
      children: [
        {
          classNames: "row-c",
          children: ["Tower"],
        },
        {
          classNames: "row-c",
          children: ["Range", "2"],
        },
        {
          classNames: "row-c",
          children: ["Damage", "1"],
        },
        {
          classNames: "row-c",
          children: ["Attack Speed", "40"],
        },
      ],
    });

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
          buildingConfig: {
            cost: 2,
            attack: {
              cooldown: 40,
              damage: 1,
              range: 2,
              projectileSpeed: 0.02,
            },
          },
        },
      },
      parent: this.buildMenu,
      children: ["Build1"],
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
          type: TowerDefenseGame.commands.spawnEnemy,
          config: {
            health: 2,
            speed: 0.01,
          },
        },
      },
      parent: this.buildMenu,
      children: [
        {
          text: "Spawn Enemy",
        },
      ],
    });
    this.spawn = this.ui.createElement({
      classNames: "interactive column-c",
      style: {
        height: "90%",
        width: "30%",
      },
      data: {
        command: {
          type: TowerDefenseGame.commands.startFightPhase,
        },
      },
      parent: this.buildMenu,
      children: [
        {
          text: "Start Fight",
        },
      ],
    });
  }

  generateCommands(state) {
    const { mouse, object, ui } = state;
    const { released } = mouse;
    if (ui.clicked.length > 0) {
      const command = ui.clicked[0].data.command;
      switch (command.type) {
        case "selectBuilding":
          this.buildingConfig =
            this.buildingConfig === command.buildingConfig
              ? null
              : command.buildingConfig;
          break;
        default:
          break;
      }
      return [command];
    }
    const hit = object.hover.get(this.ground);
    if (hit && released && this.buildingConfig) {
      return [
        {
          type: TowerDefenseGame.commands.build,
          gridPos: new GridPosition(hit.point),
          config: this.buildingConfig,
        },
      ];
    }
    return [];
  }

  updateRender(effects) {
    for (let i = 0; i < effects.length; i++) {
      const effect = effects[i];
      switch (effect.effect) {
        case TowerDefenseGame.effects.spawn:
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
        case TowerDefenseGame.effects.died:
          this.gold.innerText = `Gold: ${this.game.state.gold}`;
          this.lives.innerText = `Lives left: ${this.game.state.lives}`;
        case TowerDefenseGame.effects.reachedFlag:
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
        case TowerDefenseGame.effects.moved:
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
        case TowerDefenseGame.effects.gameOver:
          this.lives.innerText = `Lives left: ${this.game.state.lives}`;
          break;
        case TowerDefenseGame.effects.livesChanged:
          this.lives.innerText = `Lives left: ${this.game.state.lives}`;
          break;
        default:
          break;
      }
    }
  }

  updateUi(state) {
    const { hover } = state.ui;
    const { children } = this.buildMenu;

    for (let i = 0; i < children.length; i++) {
      const child = children[i];
      if (hover.indexOf(child) >= 0) {
        child.classList.add("hovered");
      } else {
        child.classList.remove("hovered");
      }

      if (child.data.command.type === "selectBuilding") {
        if (this.buildingConfig === child.data.command.buildingConfig) {
          child.classList.add("selected");
        } else {
          child.classList.remove("selected");
        }
      }
    }
  }

  update(engine) {
    const state = engine.input.getState();
    this.updateUi(state);
    const commands = this.generateCommands(state);
    let effects = this.game.handle(commands);

    if (commands.find((c) => c.type === "step") || true) {
      effects = effects.concat(this.game.step());
    }
    this.updateRender(effects);

    const { object } = state;
    const hit = object.hover.get(this.ground);
    if (hit) {
      const gridPos = new GridPosition(hit.point);
      if (this.buildingConfig) {
        this.hint.position.copy(gridPos.toVector3());
        const legalPos = this.game.legalBuild(gridPos);

        if (legalPos.result) {
          this.hint.visible = true;
          this.hint.material.color = new THREE.Color("#1b680c");
          this.hint.material.opacity = 0.5;
        } else {
          switch (legalPos.reason) {
            case TowerDefenseGame.buildReason.blocksPath:
              this.hint.visible = true;
              this.hint.material.color = new THREE.Color("#cd0808");
              this.hint.material.opacity = 0.5;
              break;
            default:
              this.hint.visible = false;
          }
        }
      } else {
        this.hint.visible = false;
        const highlightedTower = this.game.towers.find((t) =>
          t.gridPos.equals(gridPos)
        );
        if (highlightedTower) {
          const towerScreenSpace = gridPos.toVector3().project(this.camera);
          this.towerUi.style.display = "block";

          this.towerUi.style.bottom = null;
          this.towerUi.style.top = null;
          this.towerUi.style.right = null;
          this.towerUi.style.left = null;
          if (towerScreenSpace.y > 0.5) {
            this.towerUi.style.top = `${(1 - towerScreenSpace.y) * 50}%`;
          } else {
            this.towerUi.style.bottom = `${(towerScreenSpace.y + 1) * 50}%`;
          }
          if (towerScreenSpace.x > 0.5) {
            this.towerUi.style.right = `${(1 - towerScreenSpace.x) * 50}%`;
          } else {
            this.towerUi.style.left = `${(towerScreenSpace.x + 1) * 50}%`;
          }
        } else {
          this.towerUi.style.display = "none";
        }
      }
    } else {
      this.hint.visible = false;
    }

    if (effects.find((v) => v.effect === TowerDefenseGame.effects.gameOver)) {
      engine.pushState(GameOverMenu);
    }

    this.updateUi(state);
  }
}
