import * as THREE from "three";
import { Vector3 } from "three";
import { KeyedMap, KeyedSet, Position } from "../../utils/helper.js";
import { Entity } from "../../engine/entity.js";

export class MainMenu extends THREE.Scene {
  constructor() {
    super();
    this.camera = new THREE.PerspectiveCamera(75, 16 / 9);
    this.add(this.camera);
  }

  init() {
    const div = this.ui.createElement({
      classNames: "column-c",
      style: {
        position: "absolute",
        top: "10%",
        right: "10%",
        height: "10%",
        width: "80%",
      },
    });
    this.ui.createElement({
      text: "My First Tower Defense",
      parent: div,
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
    });

    this.ui.createElement({
      text: "Start Game",
      parent: this.start,
    });
  }

  cleanup() {}
  pause() {}
  resume() {}

  update(engine) {
    const { ui } = engine.input.getState();
    if (ui.clicked.find((v) => v === this.start) !== undefined) {
      engine.replaceState(new TowerDefense());
    }
  }
  render(renderer) {
    renderer.render(this, this.camera);
  }
}

class Enemy extends Entity {
  constructor(pos) {
    super();
    this.pos = pos;
  }
}

class Tower extends Entity {
  constructor() {
    super();
    this.range = 1;
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
    this.towers = new KeyedMap();
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

  step(commands) {
    const lives = this.state.lives;
    const effects = [];

    // first build any towers
    for (let i = 0; i < commands.length; i++) {
      const command = commands[i];
      switch (command.type) {
        case "build":
          if (this.towers.has(pos)) {
            this.towers.set(pos, new Tower());
            effects.push({ effect: "build", pos });
          }
          break;
        case "spawn":
          this.enemies.push(new Enemy(command.pos));
          effects.push({ effects: "spawnenemy", pos });
          break;
        default:
          break;
      }
    }

    // then have the towers attack
    towers.forEach((tower, pos) => {
      const target = this.enemies.find((e) => e.pos.dist(pos) <= tower.range);
      if (target) {
        target.health -= tower.damage;
        effects.push({
          effect: "attack",
          attacker: tower.entityId,
          enemy: target.entityId,
        });
      }
    });

    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const enemy = this.enemies[i];
      if (enemy.health <= 0) {
        effects.push({
          effect: "enemydied",
          enemy: enemy.entityId,
        });
        this.enemies.splice(i, 1);
      }
    }

    // then have the enemies move
    for (let i = 0; i < this.enemies.length; i++) {
      const enemy = this.enemies[i];
      const path = this.path(enemy.pos, this.goal);

      effects.push({
        effect: "enemymoved",
        enemy: enemy.entityId,
        target: path[1],
      });
    }

    // then see if any made it and subtract lives
    this.enemies
      .filter((e) => e.pos.equals(this.goal))
      .forEach((enemy) => {
        effects.push({ effect: "reachedflag", entityId: enemy.entityId });
        this.state.lives--;
      });

    // then check lives
    if (this.state.lives <= 0) {
      effects.push({ effect: "gameover" });
    } else if (this.state.lives != lives) {
      effects.push({ effect: "liveschange", lives: this.state.lives });
    }

    return effects;
  }
}

class TowerDefense extends THREE.Scene {
  constructor() {
    super();
    this.camera = new THREE.OrthographicCamera(
      (-4 * 16) / 9,
      (4 * 16) / 9,
      4,
      -4
    );
    this.add(this.camera);
  }

  init() {
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

    this.ground = makeGround(5, 5);
  }

  cleanup() {}
  pause() {}
  resume() {}

  update(engine) {}

  render(renderer) {
    renderer.render(this, this.camera);
  }
}
