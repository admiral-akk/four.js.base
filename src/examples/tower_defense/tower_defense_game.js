import { Entity } from "../../engine/entity.js";
import { KeyedMap, KeyedSet, makeEnum } from "../../utils/helper.js";
import { GridPosition } from "./grid_position.js";

export class Enemy extends Entity {
  constructor(position) {
    super();
    this.name = "enemy";
    this.position = position;
    this.health = 2;
    this.speed = 0.01;
  }
}

export class Tower extends Entity {
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

export class Goal extends Entity {
  constructor(gridPos) {
    super();
    this.name = "goal";
    this.gridPos = gridPos;
  }
}

export class Projectile extends Entity {
  constructor({ target, tower }) {
    super();
    this.name = "projectile";
    this.position = tower.position.clone();
    this.target = target;
    this.tower = tower;
    this.speed = 0.02;
  }
}

export class Navigator extends KeyedMap {
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

export class TowerDefenseGame {
  static commands = makeEnum(["build", "startFight"]);
  static effects = makeEnum([
    "spawn",
    "died",
    "moved",
    "reachedFlag",
    "livesChanged",
    "gameOver",
  ]);

  static buildReason = makeEnum([
    "outOfBounds",
    "occupied",
    "blocksPath",
    "legal",
  ]);

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
    effects.push({ effect: TowerDefenseGame.effects.spawn, entity: this.goal });
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
        reason: TowerDefenseGame.buildReason.outOfBounds,
      };
    }

    const occupied = this.towers.find((t) => t.gridPos.equals(gridPos));

    if (occupied || this.goal.gridPos.equals(gridPos)) {
      return {
        result: false,
        reason: TowerDefenseGame.buildReason.occupied,
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
        reason: TowerDefenseGame.buildReason.blocksPath,
      };
    }

    return {
      result: true,
      reason: TowerDefenseGame.buildReason.legal,
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
            effects.push({ effect: TowerDefenseGame.effects.spawn, entity });
          }

          break;
        case TowerDefenseGame.commands.build:
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
              effects.push({ effect: TowerDefenseGame.effects.spawn, entity });
              break;
            case "enemy":
              this.enemies.push(entity);
              effects.push({ effect: TowerDefenseGame.effects.spawn, entity });
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
        effects.push({
          effect: TowerDefenseGame.effects.died,
          entity: projectile,
        });
      } else {
        projectile.position.add(
          delta.normalize().multiplyScalar(projectile.speed)
        );
        effects.push({
          effect: TowerDefenseGame.effects.moved,
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
          effect: TowerDefenseGame.effects.spawn,
          entity: projectile,
        });
      }
    }

    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const enemy = this.enemies[i];
      if (enemy.health <= 0) {
        effects.push({
          effect: TowerDefenseGame.effects.died,
          entity: enemy,
        });
        this.enemies.splice(i, 1);
        this.state.gold++;
        for (let j = this.projectiles.length - 1; j >= 0; j--) {
          const projectile = this.projectiles[j];
          if (projectile.target === enemy) {
            this.projectiles.splice(j, 1);
            effects.push({
              effect: TowerDefenseGame.effects.died,
              entity: projectile,
            });
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
          effects.push({
            effect: TowerDefenseGame.effects.reachedFlag,
            entity: enemy,
          });
        } else {
          distanceToMove -= delta.length();
          enemy.position.copy(enemy.nextPosition.toVector3());
          enemy.nextPosition = this.navigator.get(enemy.nextPosition);
        }
      }
      effects.push({
        effect: TowerDefenseGame.effects.moved,
        entity: enemy,
      });
    }

    // then check lives
    if (this.state.lives <= 0) {
      effects.push({ effect: TowerDefenseGame.effects.gameOver });
    } else if (this.state.lives != lives) {
      effects.push({
        effect: TowerDefenseGame.effects.livesChanged,
        lives: this.state.lives,
      });
    }

    this.tick++;
    return effects;
  }
}
