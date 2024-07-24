import * as THREE from "three";
import { Vector3 } from "three";
import { Entity } from "../../engine/entity.js";
import { GameState } from "../../engine/engine.js";

const gridSize = 0.4;

class GridPosition {
  constructor(x, y) {
    this.x = x;
    this.y = y;
  }

  toVector3() {
    return new Vector3(this.x * gridSize, 0.3, this.y * gridSize);
  }

  static toGridPosition(v) {
    return new GridPosition(
      Math.round(v.x / gridSize),
      Math.round(v.z / gridSize)
    );
  }

  neighbors() {
    const { x, y } = this;
    return [
      new GridPosition(x + 1, y),
      new GridPosition(x - 1, y),
      new GridPosition(x, y + 1),
      new GridPosition(x, y - 1),
    ];
  }

  dist_max(other) {
    return Math.max(Math.abs(other.x - this.x), Math.abs(other.y - this.y));
  }

  dist(other) {
    return Math.abs(other.x - this.x) + Math.abs(other.y - this.y);
  }

  equals(other) {
    return this.dist(other) === 0;
  }

  key() {
    return this.x + "-" + this.y;
  }
}

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
  constructor(position) {
    super();
    this.name = "enemy";
    this.position = position;
    this.health = 2;
    this.speed = 0.01;
  }
}

class Tower extends Entity {
  constructor(position) {
    super();
    this.name = "tower";
    this.pos = position ? GridPosition.toGridPosition(position) : null;
    this.position = this.pos?.toVector3();
    this.range = 2;
    this.cooldown = 40;
    this.nextAttackTick = 0;
    this.damage = 1;
  }
}

class Projectile extends Entity {
  constructor({ target, tower }) {
    super();
    this.name = "projectile";
    this.position = tower.position.clone();
    this.target = target;
    this.tower = tower;
    this.speed = 0.02;
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
    this.goal = new GridPosition(0, 0);
    this.towers = [];
    this.enemies = [];
    this.projectiles = [];
    this.tick = 0;
  }

  path(start, end) {
    const path = [start];
    while (!path[path.length - 1].equals(end)) {
      const last = path[path.length - 1];
      if (last.x !== end.x) {
        path.push(new GridPosition(last.x + Math.sign(end.x - last.x), last.y));
      } else {
        path.push(new GridPosition(last.x, last.y + Math.sign(end.y - last.y)));
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
                (t) => t.pos.dist(GridPosition.toGridPosition(pos)) <= 1
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

    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const projectile = this.projectiles[i];
      const delta = projectile.target.position.clone().sub(projectile.position);

      if (delta.length() <= projectile.speed) {
        this.projectiles.splice(i, 1);
        projectile.target.health -= projectile.tower.damage;
        effects.push({ effect: "died", entity: projectile });
      } else {
        projectile.position.add(
          delta.normalize().multiplyScalar(projectile.speed)
        );
        effects.push({
          effect: "moved",
          entity: projectile,
        });
      }
    }

    for (let i = this.towers.length - 1; i >= 0; i--) {
      const tower = this.towers[i];
      if (tower.nextAttackTick > this.tick) {
        continue;
      }
      const target = this.enemies.find(
        (e) => e.position.distanceTo(tower.position) <= tower.range
      );
      if (target) {
        const projectile = new Projectile({ target, tower });
        this.projectiles.push(projectile);
        tower.nextAttackTick = this.tick + tower.cooldown;
        console.log(projectile);
        effects.push({
          effect: "spawn",
          entity: projectile,
        });
      }
    }

    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const enemy = this.enemies[i];
      if (enemy.health <= 0) {
        effects.push({
          effect: "died",
          entity: enemy,
        });
        this.enemies.splice(i, 1);
        for (let j = this.projectiles.length - 1; j >= 0; j--) {
          const projectile = this.projectiles[j];
          if (projectile.target === enemy) {
            this.projectiles.splice(j, 1);
            effects.push({ effect: "died", entity: projectile });
          }
        }
      }
    }

    // then have the enemies move
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const enemy = this.enemies[i];
      const delta = this.goal.toVector3().sub(enemy.position);
      if (delta.length() <= enemy.speed) {
        this.enemies.splice(i, 1);
        this.state.lives--;
        effects.push({ effect: "reachedFlag", entity: enemy });
      } else {
        enemy.position.add(delta.normalize().multiplyScalar(enemy.speed));
        effects.push({
          effect: "moved",
          entity: enemy,
        });
      }
    }

    // then check lives
    if (this.state.lives <= 0) {
      effects.push({ effect: "gameover" });
    } else if (this.state.lives != lives) {
      effects.push({ effect: "liveschange", lives: this.state.lives });
    }

    this.tick++;
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

    const grid = (x, y) => {
      const geo = new THREE.PlaneGeometry(1, 1);
      geo.rotateX(-Math.PI / 2);
      const mesh = new THREE.Mesh(
        geo,
        new THREE.MeshBasicMaterial({
          color: (x + y) % 2 === 0 ? "lightgray" : "grey",
        })
      );
      this.add(mesh);
      mesh.position.copy(new Vector3(x, 0, y));
      return mesh;
    };

    for (let x = -5; x <= 5; x++) {
      for (let y = -5; y <= 5; y++) {
        grid(x, y);
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
      const geo = new THREE.SphereGeometry(0.2);
      const material = new THREE.MeshBasicMaterial({ color: "grey" });
      const mesh = new THREE.Mesh(geo, material);
      material.transparent = true;
      material.opacity = 0;
      this.add(mesh);
      return mesh;
    };

    this.ground = makeGround(100, 100);
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
      return [
        {
          type: "create",
          entity: new this.activeCreation.constructor(hit.point),
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
          console.log(effect);
          switch (entity.name) {
            case "tower":
              const makeTower = () => {
                const geo = new THREE.BoxGeometry(0.2, 0.2, 0.2);
                const material = new THREE.MeshBasicMaterial({
                  color: "red",
                });
                const mesh = new THREE.Mesh(geo, material);
                this.add(mesh);
                mesh.position.copy(entity.position);
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
                console.log(mesh);
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
        case "reachedFlag":
          {
            const matching = [];
            this.traverse((child) => {
              if (child.entity === effect.entity) {
                matching.push(child);
              }
            });
            if (effect.entity.name === "projectile") {
              console.log(matching);
            }
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
          if (effect.entity.name === "projectile") {
            console.log(matching);
          }
          matching.forEach((v) => {
            v.position.copy(v.entity.position);
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

    if (commands.find((c) => c.type === "step") || true) {
      effects = effects.concat(this.game.step());
    }
    this.updateRender(effects);

    const { object } = state;
    const hit = object.hover.get(this.ground);
    if (hit) {
      this.hint.visible = true;
      this.hint.material.opacity = 0.5;
      this.hint.position.copy(
        GridPosition.toGridPosition(hit.point).toVector3()
      );
    } else {
      this.hint.visible = false;
    }
  }

  render(renderer) {
    renderer.render(this, this.camera);
  }
}
