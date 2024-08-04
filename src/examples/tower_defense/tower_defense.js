import * as THREE from "three";
import { Vector3 } from "three";
import { GameState } from "../../engine/engine.js";
import { GameOverMenu } from "./game_over_menu.js";
import { TowerDefenseGame, baseTowerConfig } from "./tower_defense_game.js";
import { GridPosition } from "./grid_position.js";
import { KeyedMap, makeEnum } from "../../utils/helper.js";

const entityMap = new KeyedMap();

const inputIds = makeEnum([
  "tooltip",
  "abilitySelect",
  "bottomMenu",
  "goldText",
  "livesText",
]);

class EntityMesh extends THREE.Group {
  constructor(scene, { entity }) {
    super();
    scene.add(this);
    this.position.copy(entity.position);
    this.entity = entity;
    entityMap.set(entity, this);
  }

  update(scene) {
    const { tl } = scene;
    const { x, y, z } = this.entity.position;
    tl.killTweensOf(this.position);
    tl.to(
      this.position,
      { x, y, z, duration: scene.timeToNextTick },
      tl.time()
    );
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
    this.red = red;
    this.green = green;
    this.enemy = enemy;
    this.update(scene);
  }

  update({ tl, timeToNextTick }) {
    const { health, config } = this.enemy.entity;
    const healthPercent = health / config.health;
    tl.killTweensOf(this.red.scale);
    tl.killTweensOf(this.green.scale);
    tl.to(
      this.red.scale,
      { x: 1 - healthPercent, duration: timeToNextTick },
      tl.time()
    );
    tl.to(
      this.green.scale,
      { x: healthPercent, duration: timeToNextTick },
      tl.time()
    );
  }
}

class EnemyMesh extends EntityMesh {
  static geo = new THREE.ConeGeometry(0.1, 0.2).translate(0, 0.1, 0);
  static mat = new THREE.MeshBasicMaterial({
    color: "green",
  });

  constructor(scene, entity) {
    super(scene, {
      entity,
    });
    const body = new THREE.Mesh(
      EnemyMesh.geo,
      new THREE.MeshBasicMaterial({
        color: "green",
      })
    );
    this.add(body);
    this.healthBar = new HealthBar(scene, this);
    this.healthBar.position.y = 0.3;

    body.material.opacity = 0;
    body.material.transparent = true;
    scene.tl.to(body.material, { opacity: 1 }, scene.tl.time());
  }

  update(scene) {
    super.update(scene);
    this.healthBar.update(scene);
  }
}

class GoalMesh extends EntityMesh {
  static geo = new THREE.CylinderGeometry(0.2, 0.2, 0.2);
  static mat = new THREE.MeshBasicMaterial({
    color: "yellow",
  });
  constructor(scene, entity) {
    super(scene, { entity });
    const body = new THREE.Mesh(GoalMesh.geo, GoalMesh.mat);
    this.add(body);
    this.position.y = 0;
    this.scale.set(0, 0, 0);
    scene.tl.to(this.scale, { x: 1, y: 1, z: 1 }, scene.tl.time());
  }
}

class SpearMesh extends THREE.Group {
  static shaft = new THREE.BoxGeometry(0.04, 0.3, 0.04).translate(0, 0.15, 0);
  static shaftMat = new THREE.MeshBasicMaterial({
    color: "brown",
  });
  static tip = new THREE.ConeGeometry(0.06, 0.1, 4).translate(0, 0.05, 0);
  static tipMat = new THREE.MeshBasicMaterial({
    color: "silver",
  });
  constructor() {
    super();
    const shaft = new THREE.Mesh(SpearMesh.shaft, SpearMesh.shaftMat);
    const tip = new THREE.Mesh(SpearMesh.tip, SpearMesh.tipMat);
    shaft.add(tip);
    tip.position.y = 0.3;
    this.add(shaft);
  }
}

class TowerMesh extends EntityMesh {
  static body = new THREE.BoxGeometry(0.15, 0.25, 0.15).translate(0, 0.125, 0);
  static head = new THREE.SphereGeometry(0.07).translate(0, 0.07 / 2, 0);
  static mat = new THREE.MeshBasicMaterial({
    color: "red",
  });
  static mat2 = new THREE.MeshBasicMaterial({
    color: "orange",
  });

  constructor(scene, entity) {
    super(scene, { entity });
    this.position.y = 0;
    const body = new THREE.Mesh(TowerMesh.body, TowerMesh.mat);
    this.add(body);
    body.position.y = 0;

    const m = new THREE.Mesh(TowerMesh.head, TowerMesh.mat2);
    body.add(m);
    m.position.y = 0.25;

    const spear = new SpearMesh();
    body.add(spear);
    spear.position.set(0.2, 0.15);

    this.weapon = spear;
    this.scale.set(0, 0, 0);
    scene.tl.to(this.scale, { x: 1, y: 1, z: 1 }, scene.tl.time());
  }

  meleeAttack({ tl }) {
    const spear = this.weapon;
    tl.killTweensOf(spear.position);
    tl.killTweensOf(spear.rotation);
    // position
    tl.fromTo(
      spear.position,
      { x: 0.2, y: 0.15, z: 0 },
      { x: 0.2, y: 0.05, z: -0.2, duration: 0.2 },
      tl.time()
    )
      .to(spear.position, { x: 0.2, y: 0.05, z: 0.3, duration: 0.04 })
      .to(spear.position, { x: 0.2, y: 0.15, z: 0, duration: 0.1 }, ">0.04");

    // rotation
    tl.fromTo(
      spear.rotation,
      { x: 0, y: 0, z: 0 },
      { x: Math.PI / 2, y: 0, z: 0, duration: 0.04 },
      tl.time()
    ).to(spear.rotation, { x: 0, y: 0, z: 0 }, ">0.04");
  }

  update(scene) {
    super.update(scene);
    const { currentTarget } = this.entity;
    if (currentTarget) {
      const targetMesh = entityMap.get(currentTarget);
      if (targetMesh) {
        const worldPos = targetMesh.getWorldPosition(new THREE.Vector3());
        worldPos.y = 0;
        this.lookAt(worldPos);
      }
    }
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
    const tooltip = document.getElementById(inputIds.tooltip);
    switch (this.state.type) {
      case TowerDefenseInput.states.selectedUnit:
        const { selectedUnit } = this.state;
        const towerScreenSpace = selectedUnit.gridPos
          .toVector3()
          .project(camera);
        tooltip.style.display = "block";
        tooltip.classList.add("targetable");
        tooltip.style.opacity = 1;

        tooltip.style.bottom = null;
        tooltip.style.top = null;
        tooltip.style.right = null;
        tooltip.style.left = null;
        if (towerScreenSpace.y > 0.5) {
          tooltip.style.top = `${(1.025 - towerScreenSpace.y) * 50}%`;
        } else {
          tooltip.style.bottom = `${(towerScreenSpace.y + 1.025) * 50}%`;
        }
        if (towerScreenSpace.x > 0.5) {
          tooltip.style.right = `${(1.025 - towerScreenSpace.x) * 50}%`;
        } else {
          tooltip.style.left = `${(towerScreenSpace.x + 1.025) * 50}%`;
        }

        const { children } = document.getElementById(inputIds.abilitySelect);

        for (let i = 0; i < children.length; i++) {
          if (selectedUnit.getActiveIndex() === i) {
            children[i].classList.add("selected");
          } else {
            children[i].classList.remove("selected");
          }

          const { damage, range, cooldown } = selectedUnit.abilityOptions[i];

          children[
            i
          ].children[0].innerText = `Damage: ${damage}\nRange: ${range}\nCooldown: ${cooldown}`;
        }

        break;
      default:
        tooltip.style.display = "none";
        tooltip.classList.remove("targetable");
        break;
    }
  }

  updateHint(game) {
    const gridPos = this.state.hitTarget;
    if (gridPos) {
      if (this.state.type === TowerDefenseInput.states.build) {
        this.hint.position.copy(gridPos.toVector3());
        const legalPos = game.legalBuild(gridPos);

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

  updateUi(scene, state) {
    const { hover } = state.ui;
    const { camera, game } = scene;
    const { children } = document.getElementById("bottomMenu");

    for (let i = 0; i < children.length; i++) {
      const child = children[i];
      if (hover.indexOf(child) >= 0) {
        child.classList.add("hovered");
      } else {
        child.classList.remove("hovered");
      }

      if (child.command.type === "selectBuilding") {
        if (this.state.selectedBuild === child.command.buildingConfig) {
          child.classList.add("selected");
        } else {
          child.classList.remove("selected");
        }
      }
    }

    this.updateTooltipPosition(camera);
    this.updateHint(game);
  }

  generateCommands(state, engine, game) {
    const { mouse, object, ui } = state;
    const { released } = mouse;
    const commands = [];

    const hit = object.hover.get(this.ground);
    const hitGrid = hit ? new GridPosition(hit.point) : null;
    this.state.hitTarget = hitGrid;
    const clickedCommand = ui.commands?.[0];

    switch (this.state.type) {
      case TowerDefenseInput.states.free:
      case TowerDefenseInput.states.selectedUnit:
        switch (clickedCommand?.type) {
          case "selectBuilding":
            this.state.type = TowerDefenseInput.states.build;
            this.state.selectedUnit = null;
            this.state.selectedBuild = clickedCommand.buildingConfig;
            engine.playSound("./audio/click1.ogg");
            break;
          case TowerDefenseGame.commands.setAbility:
            clickedCommand.gridPos = this.state.selectedUnit.gridPos;
            engine.playSound("./audio/click1.ogg");
            break;
          default:
            break;
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

    const makeHint = () => {
      const geo = new THREE.BoxGeometry(0.2, 0.2, 0.2);
      const material = new THREE.MeshBasicMaterial({ color: "grey" });
      const mesh = new THREE.Mesh(geo, material);
      material.transparent = true;
      material.opacity = 0;
      scene.add(mesh);
      return mesh;
    };

    this.hint = makeHint();

    this.ui.createElement({
      classNames: "targetable column-c",
      alignment: {
        topOffset: 0.05,
        width: 0.15,
        height: 0.1,
      },
      command: {
        type: TowerDefenseGame.commands.startFightPhase,
      },
      text: "Start Fight",
    });

    this.ui.createElement({
      classNames: "row-c",
      id: inputIds.bottomMenu,
      alignment: {
        topOffset: 0.8,
        width: 0.8,
        height: 0.15,
      },
      children: [
        {
          classNames: "targetable column-c",
          alignment: {
            height: 0.9,
          },
          style: {
            aspectRatio: 1,
          },
          command: {
            type: "selectBuilding",
            buildingConfig: baseTowerConfig,
          },
          text: "Build1",
        },
        {
          classNames: "targetable column-c",
          alignment: {
            height: 0.9,
            width: 0.3,
          },
          command: {
            type: TowerDefenseGame.commands.spawnEnemy,
            config: {
              health: 2,
              speed: 0.01,
            },
          },
          text: "Spawn Enemy",
        },
      ],
    });

    this.towerUi = this.ui.createElement({
      classNames: "targetable column-c",
      id: inputIds.tooltip,
      alignment: {
        height: 0.1,
        width: 0.1,
      },
      style: {
        display: "none",
      },
      children: [
        {
          classNames: "row-c",
          children: ["Tower"],
        },
        {
          classNames: "row-c",
          id: inputIds.abilitySelect,
          children: [
            {
              classNames: "targetable column-c",
              alignment: {
                width: 0.4,
              },
              style: {
                aspectRatio: 1,
              },
              command: {
                type: TowerDefenseGame.commands.setAbility,
                index: 0,
              },
              children: ["Ability 1"],
            },
            {
              classNames: "targetable column-c",
              alignment: {
                width: 0.4,
              },
              style: {
                aspectRatio: 1,
              },
              command: {
                type: TowerDefenseGame.commands.setAbility,
                index: 1,
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
    this.tickRate = 30;
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

    this.tl.fromTo(
      "#bottomMenu",
      { top: "200%" },
      { top: "80%" },
      this.tl.time()
    );

    this.ui.createElement({
      classNames: "row-c",
      alignment: {
        topOffset: 0.1,
        rightOffset: 0.1,
        width: 0.1,
        height: 0.1,
      },
      children: [
        {
          id: inputIds.goldText,
          text: `Gold: ${this.game.state.gold}`,
        },
      ],
    });
    this.ui.createElement({
      classNames: "row-c",
      alignment: {
        topOffset: 0.1,
        rightOffset: 0.8,
        width: 0.1,
        height: 0.1,
      },
      children: [
        {
          id: inputIds.livesText,
          text: `Lives left: ${this.game.state.lives}`,
        },
      ],
    });
  }

  applyEffects(effects, engine) {
    for (let i = 0; i < effects.length; i++) {
      const effect = effects[i];
      switch (effect.effect) {
        case TowerDefenseGame.effects.goldChanged:
          document.getElementById(
            inputIds.goldText
          ).innerText = `Gold: ${this.game.state.gold}`;
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
        case TowerDefenseGame.effects.attacked:
          const tower = entityMap.get(effect.entity);
          entityMap.get(effect.target)?.update(this);
          switch (effect.entity.activeAbility.type) {
            case "meleeAttack":
              tower.update(this);
              tower.meleeAttack(this);
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
          entityMap.get(effect.entity)?.update(this);
          break;
        case TowerDefenseGame.effects.gameOver:
          engine.pushState(GameOverMenu);
        case TowerDefenseGame.effects.livesChanged:
          document.getElementById(
            inputIds.livesText
          ).innerText = `Lives left: ${this.game.state.lives}`;
          break;
        default:
          break;
      }
    }
  }

  tick(engine) {
    this.commands.push({ type: TowerDefenseGame.commands.step });
  }

  update(engine) {
    const state = engine.input.getState();
    this.commands.push(
      ...this.input.generateCommands(state, engine, this.game)
    );
  }

  resolveCommands(engine) {
    const state = engine.input.getState();
    const effects = this.game.handle(this.commands);
    this.applyEffects(effects, engine);
    this.input.updateUi(this, state);
  }
}
