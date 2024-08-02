import * as THREE from "three";
import { Vector3 } from "three";
import { GameState } from "../../engine/engine.js";
import { GameOverMenu } from "./game_over_menu.js";
import { TowerDefenseGame } from "./tower_defense_game.js";
import { GridPosition } from "./grid_position.js";
import { KeyedMap, makeEnum } from "../../utils/helper.js";

const entityMap = new KeyedMap();

class EntityMesh extends THREE.Mesh {
  constructor(scene, { geo, mat, entity }) {
    super(geo, mat);
    scene.add(this);
    this.position.copy(entity.position);
    this.entity = entity;
    entityMap.set(entity, this);
  }

  update() {
    this.position.copy(this.entity.position);
  }

  destroy(scene) {
    scene.remove(this);
    entityMap.delete(this.entity);
  }
}

class HealthBar extends THREE.Group {
  static greenGeo = new THREE.PlaneGeometry(0.3, 0.05).translate(0.15, 0, 0);
  static redGeo = new THREE.PlaneGeometry(0.3, 0.05).translate(-0.15, 0, 0);
  static redMat = new THREE.MeshBasicMaterial({
    color: "red",
  });
  static greenMat = new THREE.MeshBasicMaterial({
    color: "green",
  });
  constructor(scene, enemy) {
    super();
    const red = new THREE.Mesh(HealthBar.redGeo, HealthBar.redMat);
    const green = new THREE.Mesh(HealthBar.greenGeo, HealthBar.greenMat);
    this.rotation.copy(scene.camera.rotation);
    this.add(red);
    this.add(green);
    enemy.add(this);
    green.position.x = -0.15;
    red.position.x = 0.15;
    this.position.y = 0.3;
    this.red = red;
    this.green = green;
    this.enemy = enemy;
    this.update();
  }

  update() {
    const { health, config } = this.enemy.entity;
    const healthPercent = health / config.health;
    this.red.scale.set(1 - healthPercent, 1, 1);
    this.green.scale.set(healthPercent, 1, 1);
  }
}

class EnemyMesh extends EntityMesh {
  static geo = new THREE.ConeGeometry(0.2, 0.3);
  static mat = new THREE.MeshBasicMaterial({
    color: "green",
  });

  constructor(scene, entity) {
    super(scene, {
      entity,
      geo: EnemyMesh.geo,
      mat: new THREE.MeshBasicMaterial({
        color: "green",
      }),
    });
    this.healthBar = new HealthBar(scene, this);

    this.material.opacity = 0;
    this.material.transparent = true;
    scene.tl.to(this.material, { opacity: 1 }, scene.tl.time());
  }

  update() {
    super.update();
    this.healthBar.update();
  }
}

class GoalMesh extends EntityMesh {
  static geo = new THREE.CylinderGeometry(0.2, 0.2, 0.2);
  static mat = new THREE.MeshBasicMaterial({
    color: "yellow",
  });
  constructor(scene, entity) {
    super(scene, { entity, geo: GoalMesh.geo, mat: GoalMesh.mat });
    this.position.y = 0;
    this.scale.set(0, 0, 0);
    scene.tl.to(this.scale, { x: 1, y: 1, z: 1 }, scene.tl.time());
  }
}

class TowerMesh extends EntityMesh {
  static geo = new THREE.BoxGeometry(0.2, 0.2, 0.2);
  static mat = new THREE.MeshBasicMaterial({
    color: "red",
  });
  constructor(scene, entity) {
    super(scene, { entity, geo: TowerMesh.geo, mat: TowerMesh.mat });
    this.position.y = 0;

    this.scale.set(0, 0, 0);
    scene.tl.to(this.scale, { x: 1, y: 1, z: 1 }, scene.tl.time());
  }
}

class ProjectileMesh extends EntityMesh {
  static geo = new THREE.SphereGeometry(0.05);
  static mat = new THREE.MeshBasicMaterial({
    color: "yellow",
  });
  constructor(scene, entity) {
    super(scene, { entity, geo: ProjectileMesh.geo, mat: ProjectileMesh.mat });
    this.position.y = 0;
  }
}

export class TowerDefenseInput {
  static states = makeEnum(["free", "build", "selectedUnit"]);

  constructor({ ui }) {
    this.ui = ui;
    this.state = {
      type: TowerDefenseInput.states.free,
      selectedUnit: null,
      selectedBuild: null,
      hitTarget: null,
    };
  }

  updateTooltipPosition(camera) {
    switch (this.state.type) {
      case TowerDefenseInput.states.selectedUnit:
        const towerScreenSpace = this.state.selectedUnit.gridPos
          .toVector3()
          .project(camera);
        this.towerUi.style.display = "block";
        this.towerUi.classList.add("interactive");
        this.towerUi.style.opacity = 1;

        this.towerUi.style.bottom = null;
        this.towerUi.style.top = null;
        this.towerUi.style.right = null;
        this.towerUi.style.left = null;
        if (towerScreenSpace.y > 0.5) {
          this.towerUi.style.top = `${(1.025 - towerScreenSpace.y) * 50}%`;
        } else {
          this.towerUi.style.bottom = `${(towerScreenSpace.y + 1.025) * 50}%`;
        }
        if (towerScreenSpace.x > 0.5) {
          this.towerUi.style.right = `${(1.025 - towerScreenSpace.x) * 50}%`;
        } else {
          this.towerUi.style.left = `${(towerScreenSpace.x + 1.025) * 50}%`;
        }
        break;
      default:
        this.towerUi.style.display = "none";
        this.towerUi.classList.remove("interactive");
        break;
    }
  }

  updateUi(scene, state) {
    const { hover } = state.ui;
    const { camera } = scene;
    const { children } = document.getElementById("bottomMenu");

    for (let i = 0; i < children.length; i++) {
      const child = children[i];
      if (hover.indexOf(child) >= 0) {
        child.classList.add("hovered");
      } else {
        child.classList.remove("hovered");
      }

      if (child.data.command.type === "selectBuilding") {
        if (this.state.selectedBuild === child.data.command.buildingConfig) {
          child.classList.add("selected");
        } else {
          child.classList.remove("selected");
        }
      }
    }

    this.updateTooltipPosition(camera);
  }

  generateCommands(state, engine, game) {
    const { mouse, object, ui } = state;
    const { released } = mouse;
    const commands = [];

    const hit = object.hover.get(this.ground);
    const hitGrid = hit ? new GridPosition(hit.point) : null;
    const clickedCommand = ui.clicked?.[0]?.data?.command;
    this.state.hitTarget = hitGrid;

    switch (this.state.type) {
      case TowerDefenseInput.states.free:
      case TowerDefenseInput.states.selectedUnit:
        if (clickedCommand?.type === "selectBuilding") {
          this.state.type = TowerDefenseInput.states.build;
          this.state.selectedUnit = null;
          this.state.selectedBuild = clickedCommand.buildingConfig;
          engine.playSound("./audio/click1.ogg");
        }
        const towerAt = game.getTower(hitGrid);
        if (hitGrid && towerAt && released) {
          this.state.type = TowerDefenseInput.states.selectedUnit;
          this.state.selectedBuild = null;
          this.state.selectedUnit = towerAt;
        } else if (released) {
          this.state.type = TowerDefenseInput.states.free;
          this.state.selectedUnit = null;
        }
        break;
      case TowerDefenseInput.states.build:
        if (clickedCommand?.type === "selectBuilding") {
          this.state.type = TowerDefenseInput.states.free;
          this.state.selectedBuild = null;
          engine.playSound("./audio/click1.ogg");
          break;
        }
        if (hit && released) {
          commands.push({
            type: TowerDefenseGame.commands.build,
            gridPos: hitGrid,
            config: this.state.selectedBuild,
          });
        }
        break;
      default:
        break;
    }

    if (clickedCommand) {
      commands.push(clickedCommand);
    }
    commands.push({ type: TowerDefenseGame.commands.step });
    return commands;
  }

  init(scene) {
    const makeGround = (height, width) => {
      const geo = new THREE.PlaneGeometry(width, height);
      geo.rotateX(-Math.PI / 2);
      const mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial());
      scene.add(mesh);
      mesh.visible = false;
      mesh.layers.enable(1);
      return mesh;
    };
    this.ground = makeGround(100, 100);

    this.ui.createElement({
      classNames: "row-c",
      id: "bottomMenu",
      style: {
        position: "absolute",
        top: "80%",
        right: "10%",
        height: "10%",
        width: "80%",
      },
      children: [
        {
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
                abilityOptions: [
                  {
                    type: "rangedAttack",
                    cooldown: 40,
                    damage: 1,
                    range: 2,
                    projectileSpeed: 0.1,
                  },
                  {
                    type: "meleeAttack",
                    cooldown: 15,
                    damage: 1,
                    range: 1,
                  },
                ],
              },
            },
          },
          children: ["Build1"],
        },
        {
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
          children: ["Spawn Enemy"],
        },
        {
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
          children: ["Start Fight"],
        },
      ],
    });

    this.towerUi = this.ui.createElement({
      classNames: "interactive column-c",
      id: "towerUi",
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
        {
          classNames: "row-c",
          children: [
            {
              classNames: "interactive column-c",
              id: "ability1",
              style: {
                width: "40%",
              },
              children: ["Ability 1"],
            },
            {
              classNames: "interactive column-c",
              id: "ability2",
              style: {
                width: "40%",
              },
              children: ["Ability 2"],
            },
          ],
        },
      ],
    });
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

  // things to load
  manifest() {
    return ["./audio/click1.ogg", "./audio/swish.wav"];
  }

  cleanup() {
    [...entityMap.keys()].forEach((k) => entityMap.get(k)?.destroy(this));
  }

  init() {
    this.game = new TowerDefenseGame();
    const effects = this.game.init();
    this.applyEffects(effects);
    this.input = new TowerDefenseInput({ ui: this.ui });
    this.input.init(this);
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
      mesh.scale.set(0, 0, 0);
      this.tl.to(mesh.scale, { x: 1, y: 1, z: 1, duration: 0.4 }, "<0.01");
      return mesh;
    };

    for (let x = this.game.bounds[0].x; x <= this.game.bounds[1].x; x++) {
      for (let y = this.game.bounds[0].y; y <= this.game.bounds[1].y; y++) {
        grid(x - 0.5, y - 0.5);
      }
    }
    const makeHint = () => {
      const geo = new THREE.BoxGeometry(0.2, 0.2, 0.2);
      const material = new THREE.MeshBasicMaterial({ color: "grey" });
      const mesh = new THREE.Mesh(geo, material);
      material.transparent = true;
      material.opacity = 0;
      this.add(mesh);
      return mesh;
    };

    this.hint = makeHint();

    this.tl.fromTo("#bottomMenu", { top: "200%" }, { top: "80%" });
    this.gold = this.ui.createElement({
      id: "gold",
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
    this.tl.fromTo("#gold", { right: "-100%" }, { right: "10%" });

    this.lives = this.ui.createElement({
      id: "lives",
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
    this.tl.fromTo("#lives", { right: "200%" }, { right: "80%" });
  }

  applyEffects(effects, engine) {
    for (let i = 0; i < effects.length; i++) {
      const effect = effects[i];
      switch (effect.effect) {
        case TowerDefenseGame.effects.goldChanged:
          this.gold.innerText = `Gold: ${this.game.state.gold}`;
          break;
        case TowerDefenseGame.effects.spawn:
          const { entity } = effect;
          switch (entity.name) {
            case "goal":
              this.tl.then(() => new GoalMesh(this, entity));
              break;
            case "tower":
              new TowerMesh(this, entity);
              break;
            case "enemy":
              new EnemyMesh(this, entity);
              break;
            case "projectile":
              new ProjectileMesh(this, entity);
              engine.playSound("./audio/click1.ogg");
              break;
            default:
              break;
          }
          break;
        case TowerDefenseGame.effects.hit:
          entityMap.get(effect.entity)?.update();
          switch (effect.attack.type) {
            case "meleeAttack":
              engine.playSound("./audio/swish.wav");
              break;
            default:
              break;
          }
          break;
        case TowerDefenseGame.effects.reachedFlag:
        case TowerDefenseGame.effects.died:
          entityMap.get(effect.entity)?.destroy(this);
          break;
        case TowerDefenseGame.effects.moved:
          entityMap.get(effect.entity)?.update();
          break;
        case TowerDefenseGame.effects.gameOver:
          engine.pushState(GameOverMenu);
        case TowerDefenseGame.effects.livesChanged:
          this.lives.innerText = `Lives left: ${this.game.state.lives}`;
          break;
        default:
          break;
      }
    }
  }

  updateHint() {
    const gridPos = this.input.state.hitTarget;
    if (gridPos) {
      if (this.input.state.type === TowerDefenseInput.states.build) {
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
      }
    } else {
      this.hint.visible = false;
    }
  }

  update(engine) {
    const state = engine.input.getState();
    const commands = this.input.generateCommands(state, engine, this.game);
    const effects = this.game.handle(commands);
    this.applyEffects(effects, engine);
    this.updateHint(state);
    this.input.updateUi(this, state);
  }
}
