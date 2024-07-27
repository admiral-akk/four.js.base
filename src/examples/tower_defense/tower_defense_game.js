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
  constructor(
    gridPos,
    config = {
      cost: 2,
      attack: {
        cooldown: 40,
        damage: 1,
        range: 2,
        projectileSpeed: 0.02,
      },
    }
  ) {
    super();
    this.name = "tower";
    this.nextAttackTick = 0;
    for (const [key, value] of Object.entries(config)) {
      this[key] = value;
    }
    this.gridPos = gridPos;
    this.position = this.gridPos.toVector3();
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
  static phases = makeEnum(["fight", "build"]);
  static commands = makeEnum(["build", "startFightPhase", "spawnEnemy"]);
  static effects = makeEnum([
    "spawn",
    "died",
    "moved",
    "reachedFlag",
    "livesChanged",
    "gameOver",
    "changedPhase",
  ]);

  static buildReason = makeEnum([
    "outOfBounds",
    "occupied",
    "blocksPath",
    "notBuildPhase",
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
    this.phase = TowerDefenseGame.phases.build;
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

    if (this.phase !== TowerDefenseGame.phases.build) {
      return {
        result: false,
        reason: TowerDefenseGame.buildReason.notBuildPhase,
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

  setPhase(newPhase, effects) {
    if (this.phase === newPhase) {
      return;
    }
    effects.push({
      effect: TowerDefenseGame.effects.changePhase,
      old: this.phase,
      new: newPhase,
    });
    this.phase = newPhase;
    switch (newPhase) {
      case TowerDefenseGame.phases.fight:
        for (let i = 0; i < 10; i++) {
          this.spawnEnemy(Enemy, effects);
        }
        break;
      default:
        break;
    }
  }

  spawnEnemy(constructor, effects) {
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
    const entity = new constructor(pos.toVector3());
    entity.nextPosition = this.navigator.get(pos);
    this.enemies.push(entity);
    effects.push({ effect: TowerDefenseGame.effects.spawn, entity });
  }

  build(gridPos, config, effects) {
    if (!this.legalBuild(gridPos).result) {
      return;
    }
    if (this.state.gold < config.cost) {
      return;
    }
    const tower = new Tower(gridPos, config);
    this.towers.push(tower);

    this.updateNavigation();
    this.state.gold -= config.cost;
    effects.push({ effect: TowerDefenseGame.effects.spawn, entity: tower });
  }

  handle(commands) {
    const effects = [];
    for (let i = 0; i < commands.length; i++) {
      const command = commands[i];
      switch (command.type) {
        case TowerDefenseGame.commands.startFightPhase:
          this.setPhase(TowerDefenseGame.phases.fight, effects);
          break;
        case TowerDefenseGame.commands.spawnEnemy:
          this.spawnEnemy(command.enemyConstructor, effects);
          break;
        case TowerDefenseGame.commands.build:
          this.build(command.gridPos, command.config, effects);
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
      const { damage, projectileSpeed } = projectile.tower.attack;

      if (delta.length() <= projectileSpeed) {
        this.projectiles.splice(i, 1);
        projectile.target.health -= damage;
        effects.push({
          effect: TowerDefenseGame.effects.died,
          entity: projectile,
        });
      } else {
        projectile.position.add(
          delta.normalize().multiplyScalar(projectileSpeed)
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
        (e) => e.position.distanceTo(tower.position) <= tower.attack.range
      );
      if (target) {
        const projectile = new Projectile({ target, tower });
        this.projectiles.push(projectile);
        tower.nextAttackTick = this.tick + tower.attack.cooldown;
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

    // check phase change
    if (this.phase === TowerDefenseGame.phases.fight) {
      if (this.enemies.length === 0) {
        this.setPhase(TowerDefenseGame.phases.build, effects);
      }
    }

    this.tick++;
    return effects;
  }
}
