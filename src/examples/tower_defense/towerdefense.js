import * as THREE from "three";
import { Vector3 } from "three";
import { KeyedMap, Position } from "../../utils/helper.js";
import { Entity } from "../../engine/entity.js";
import { GameState } from "../../engine/engine.js";

export class MainMenu extends GameState {
  constructor({ ui, window }) {
    super({
      ui,
      window,
      cameraConfig: {
        isPerspective: true,
        fov: 75,
      },
    });
  }

  init() {
    this.ui.createElement({
      classNames: "column-c",
      style: {
        position: "absolute",
        top: "10%",
        right: "10%",
        height: "10%",
        width: "80%",
      },
      children: [
        {
          text: "My First Tower Defense",
        },
      ],
    });

    this.start = this.ui.createElement({
      classNames: "interactive column-c",
      style: {
        position: "absolute",
        top: "80%",
        right: "40%",
        height: "10%",
        width: "20%",
      },
      children: [
        {
          text: "Start Game",
        },
      ],
    });
  }

  cleanup() {}
  pause() {}
  resume() {}

  update(engine) {
    const { ui } = engine.input.getState();
    if (ui.clicked.find((v) => v === this.start) !== undefined) {
      engine.replaceState((v) => new TowerDefense(v));
    }
  }
  render(renderer) {
    renderer.render(this, this.camera);
  }
}

class Enemy extends Entity {
  constructor(pos) {
    super();
    this.name = "enemy";
    this.pos = pos;
    this.health = 2;
    this.speed = 1;
  }
}

class Tower extends Entity {
  constructor(pos) {
    super();
    this.name = "tower";
    this.pos = pos;
    this.range = 2;
    this.damage = 1;
  }
}

// need a notion of:
// tower
// lives
// enemy
// attack

class TowerDefenseGame {
  constructor() {
    this.state = {
      lives: 10,
    };
    this.goal = new Position(0, 0);
    this.towers = [];
    this.enemies = [];
  }

  path(start, end) {
    const path = [start];
    while (!path[path.length - 1].equals(end)) {
      const last = path[path.length - 1];
      if (last.x !== end.x) {
        path.push(new Position(last.x + Math.sign(end.x - last.x), last.y));
      } else {
        path.push(new Position(last.x, last.y + Math.sign(end.y - last.y)));
      }
    }
    return path;
  }

  handle(commands) {
    const effects = [];
    for (let i = 0; i < commands.length; i++) {
      const command = commands[i];
      switch (command.type) {
        case "create":
          const { entity } = command;
          const pos = entity.pos;
          switch (entity.name) {
            case "tower":
              const occupied = this.towers.find(
                (t) => t.pos.dist_max(pos) <= 1
              );
              if (!occupied) {
                this.towers.push(entity);
                effects.push({ effect: "spawn", entity });
              }
              break;
            case "enemy":
              this.enemies.push(entity);
              effects.push({ effect: "spawn", entity });
              break;
            default:
              break;
          }
          break;
        default:
          break;
      }
    }

    return effects;
  }

  step() {
    const lives = this.state.lives;
    const effects = [];

    // then have the towers attack
    this.towers.forEach((tower) => {
      const target = this.enemies.find(
        (e) => e.pos.dist(tower.pos) <= tower.range
      );
      if (target) {
        target.health -= tower.damage;
        effects.push({
          effect: "attack",
          attacker: tower,
          target,
        });
      }
    });

    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const enemy = this.enemies[i];
      if (enemy.health <= 0) {
        effects.push({
          effect: "died",
          entity: enemy,
        });
        this.enemies.splice(i, 1);
      }
    }

    // then have the enemies move
    for (let i = 0; i < this.enemies.length; i++) {
      const enemy = this.enemies[i];
      const path = this.path(enemy.pos, this.goal);
      enemy.pos = path[Math.min(path.length - 1, enemy.speed)];

      effects.push({
        effect: "moved",
        entity: enemy,
      });
    }

    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const enemy = this.enemies[i];
      if (enemy.pos.equals(this.goal)) {
        this.enemies.splice(i, 1);
        this.state.lives--;
        effects.push({ effect: "reachedFlag", entity: enemy });
      }
    }

    // then check lives
    if (this.state.lives <= 0) {
      effects.push({ effect: "gameover" });
    } else if (this.state.lives != lives) {
      effects.push({ effect: "liveschange", lives: this.state.lives });
    }

    return effects;
  }
}

class TowerDefense extends GameState {
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
    this.activeCreation = null;
    this.camera.position.copy(new Vector3(4, 4, 4));
    this.camera.lookAt(new Vector3());

    const makeGround = (height, width) => {
      const geo = new THREE.PlaneGeometry(width, height);
      geo.rotateX(-Math.PI / 2);
      const mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial());
      this.add(mesh);
      mesh.layers.enable(1);
      return mesh;
    };

    const makeHint = () => {
      const geo = new THREE.SphereGeometry(0.2);
      const material = new THREE.MeshBasicMaterial({ color: "grey" });
      const mesh = new THREE.Mesh(geo, material);
      material.transparent = true;
      material.opacity = 0;
      this.add(mesh);
      return mesh;
    };

    this.ground = makeGround(5, 5);
    this.hint = makeHint();
    this.build = this.ui.createElement({
      classNames: "interactive column-c",
      style: {
        position: "absolute",
        top: "80%",
        right: "10%",
        height: "10%",
        width: "20%",
      },
      data: {
        command: {
          type: "buildmode",
        },
      },
      children: [
        {
          text: "Build",
        },
      ],
    });
    this.step = this.ui.createElement({
      classNames: "interactive column-c",
      style: {
        position: "absolute",
        top: "80%",
        right: "40%",
        height: "10%",
        width: "20%",
      },
      data: {
        command: {
          type: "step",
        },
      },
      children: [
        {
          text: "Step",
        },
      ],
    });

    this.spawn = this.ui.createElement({
      classNames: "interactive column-c",
      style: {
        position: "absolute",
        top: "80%",
        right: "70%",
        height: "10%",
        width: "20%",
      },
      data: {
        command: {
          type: "enemymode",
        },
      },
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
      return [ui.clicked[0].data.command];
    }
    const hit = object.hover.get(this.ground);
    if (hit && released && this.activeCreation !== null) {
      const { x, z } = hit.point;
      const pos = new Position(Math.round(x), Math.round(z));
      return [
        {
          type: "create",
          entity: new this.activeCreation.constructor(pos),
        },
      ];
    }
    return [];
  }

  updateInputState(commands) {
    for (let i = 0; i < commands.length; i++) {
      const command = commands[i];
      switch (command.type) {
        case "enemymode":
          this.activeCreation =
            this.activeCreation?.name === "enemy" ? null : new Enemy(null);
          break;
        case "buildmode":
          this.activeCreation =
            this.activeCreation?.name === "tower" ? null : new Tower(null);
          break;
        default:
          break;
      }
    }
  }

  updateRender(effects) {
    for (let i = 0; i < effects.length; i++) {
      const effect = effects[i];
      switch (effect.effect) {
        case "spawn":
          const { entity } = effect;
          switch (entity.name) {
            case "tower":
              const makeTower = () => {
                const geo = new THREE.BoxGeometry(0.2, 0.2, 0.2);
                const material = new THREE.MeshBasicMaterial({
                  color: "red",
                });
                const mesh = new THREE.Mesh(geo, material);
                this.add(mesh);
                mesh.position.copy(
                  new Vector3(entity.pos.x, 0.1, entity.pos.y)
                );
                mesh.entity = entity;
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
                mesh.position.copy(
                  new Vector3(entity.pos.x, 0.1, entity.pos.y)
                );
                mesh.entity = entity;
                return mesh;
              };
              makeEnemy();
              break;
            default:
              break;
          }
          break;
        case "attack":
          break;
        case "died":
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
            const { x, y } = v.entity.pos;
            v.position.copy(new THREE.Vector3(x, v.position.y, y));
          });
          break;
        case "gameover":
          break;
        case "liveschange":
          break;
        default:
          break;
      }
    }
  }

  update(engine) {
    const state = engine.input.getState();
    const commands = this.generateCommands(state);
    this.updateInputState(commands);
    let effects = this.game.handle(commands);

    if (commands.find((c) => c.type === "step")) {
      effects = effects.concat(this.game.step());
    }
    this.updateRender(effects);

    const { object } = state;
    const hit = object.hover.get(this.ground);
    if (hit) {
      this.hint.visible = true;
      this.hint.material.opacity = 0.5;
      this.hint.position.copy(
        new Vector3(Math.round(hit.point.x), 0.3, Math.round(hit.point.z))
      );
    } else {
      this.hint.visible = false;
    }
  }

  render(renderer) {
    renderer.render(this, this.camera);
  }
}
