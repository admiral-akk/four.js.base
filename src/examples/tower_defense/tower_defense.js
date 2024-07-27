import * as THREE from "three";
import { Vector3 } from "three";
import { Entity } from "../../engine/entity.js";
import { GameState } from "../../engine/engine.js";
import { GameOverMenu } from "./game_over_menu.js";
import { KeyedMap, KeyedSet } from "../../utils/helper.js";
import { GridPosition } from "./grid_position.js";

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
    this.gridPos = position ? new GridPosition(position) : null;
    this.position = this.gridPos?.toVector3();
    this.range = 2;
    this.cooldown = 40;
    this.cost = 2;
    this.nextAttackTick = 0;
    this.damage = 1;
  }
}

class Goal extends Entity {
  constructor(gridPos) {
    super();
    this.name = "goal";
    this.gridPos = gridPos;
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

class Navigator extends KeyedMap {
  update(goalPos, towersPos, inbounds) {
    this.clear();
    const walls = new KeyedSet();
    walls.addAll(towersPos.map((p) => p.clone()));
    this.set(goalPos, goalPos);
    const queue = new KeyedSet();
    queue.add(goalPos);
    while (queue.size) {
      const curr = queue.pop();
      curr.neighbors().forEach((p) => {
        if (this.has(p)) {
          return;
        }
        this.set(p, curr);
        if (walls.has(p)) {
          return;
        }
        if (!inbounds(p)) {
          return;
        }
        queue.add(p);
      });
    }
  }
}

class TowerDefenseGame {
  constructor() {
    this.state = {
      lives: 10,
      gold: 10,
    };
    const bound = 7;
    this.bounds = [
      new GridPosition(-bound, -bound),
      new GridPosition(bound, bound),
    ];
    this.towers = [];
    this.enemies = [];
    this.projectiles = [];
    this.tick = 0;
    this.navigator = new Navigator();
  }

  init() {
    const effects = [];
    this.goal = new Goal(new GridPosition(0, 0));
    this.updateNavigation();
    effects.push({ effect: "spawn", entity: this.goal });
    return effects;
  }

  updateNavigation() {
    this.navigator.update(
      this.goal.gridPos,
      this.towers.map((t) => t.gridPos),
      (p) => this.inbounds(p, 1)
    );
  }

  inbounds(pos, relaxation = 0) {
    const min = this.bounds[0];
    const max = this.bounds[1];
    return (
      pos.x >= min.x - relaxation &&
      pos.x <= max.x + relaxation &&
      pos.y >= min.y - relaxation &&
      pos.y <= max.y + relaxation
    );
  }

  legalBuild(gridPos) {
    if (!this.inbounds(gridPos)) {
      return {
        result: false,
        reason: "outOfBounds",
      };
    }

    const occupied = this.towers.find((t) => t.gridPos.equals(gridPos));

    if (occupied || this.goal.gridPos.equals(gridPos)) {
      return {
        result: false,
        reason: "occupied",
      };
    }

    const testNavigator = new Navigator();
    const testTower = Array.from(this.towers.map((t) => t.gridPos));
    testTower.push(gridPos);
    testNavigator.update(this.goal.gridPos, testTower, (p) =>
      this.inbounds(p, 1)
    );

    if (
      !testNavigator.has(
        new GridPosition(this.bounds[0].x - 1, this.bounds[0].y - 1)
      )
    ) {
      return {
        result: false,
        reason: "blocksPath",
      };
    }

    return {
      result: true,
      reason: "legal",
    };
  }

  handle(commands) {
    const effects = [];
    for (let i = 0; i < commands.length; i++) {
      const command = commands[i];
      switch (command.type) {
        case "spawnEnemy":
          {
            const dir = Math.floor(Math.random() * 4);
            let pos = null;
            switch (dir) {
              case 0:
              default:
                pos = new GridPosition(
                  this.bounds[0].x - 1,
                  Math.floor(
                    Math.random() * (this.bounds[1].y - this.bounds[0].y) +
                      this.bounds[0].y
                  )
                );
            }
            const entity = new command.enemyConstructor(pos.toVector3());
            entity.nextPosition = this.navigator.get(pos);
            this.enemies.push(entity);
            effects.push({ effect: "spawn", entity });
          }

          break;
        case "create":
          const { entity } = command;
          const pos = entity.gridPos;
          switch (entity.name) {
            case "tower":
              if (!this.legalBuild(pos).result) {
                continue;
              }
              if (this.state.gold < entity.cost) {
                continue;
              }
              this.towers.push(entity);

              this.updateNavigation();
              this.state.gold -= entity.cost;
              effects.push({ effect: "spawn", entity });
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
        this.state.gold++;
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
      let distanceToMove = enemy.speed;
      while (distanceToMove > 0) {
        const delta = enemy.nextPosition.toVector3().sub(enemy.position);
        if (delta.length() > distanceToMove) {
          enemy.position.add(delta.normalize().multiplyScalar(distanceToMove));
          distanceToMove = 0;
        } else if (this.goal.gridPos.equals(enemy.nextPosition)) {
          distanceToMove = 0;
          this.enemies.splice(i, 1);
          this.state.lives--;
          effects.push({ effect: "reachedFlag", entity: enemy });
        } else {
          distanceToMove -= delta.length();
          enemy.position.copy(enemy.nextPosition.toVector3());
          enemy.nextPosition = this.navigator.get(enemy.nextPosition);
        }
      }
      effects.push({
        effect: "moved",
        entity: enemy,
      });
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
      const legalPos = this.game.legalBuild(gridPos);
      if (legalPos.result) {
        this.hint.visible = true;
        this.hint.material.opacity = 0.5;
        this.hint.position.copy(gridPos.toVector3());
      } else {
        this.hint.visible = false;
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
