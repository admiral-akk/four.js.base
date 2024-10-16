import * as THREE from "three";
import { Vector3 } from "three";
import { GameState } from "../../engine/engine.js";
import { GameOverMenu } from "./game_over_menu.js";
import { TowerDefenseGame, baseTowerConfig } from "./tower_defense_game.js";
import { GridPosition } from "./grid_position.js";
import { KeyedMap, makeEnum } from "../../utils/helper.js";
import { State, StateMachine } from "../../utils/stateMachine.js";
import { AnimationCSS, animateCSSKey } from "../../utils/animate.js";
import {
  AbsolutePosition,
  UIButtonParams,
  UIContainerParams,
  ImagePosition,
  UIImageParams,
  UITextBoxParams,
} from "../../engine/ui.js";

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
    const { currentTarget, activeAbility } = this.entity;
    if (!scene.tl.getTweensOf(this.weapon.position).length) {
      switch (activeAbility.type) {
        case "rangedAttack":
          this.weapon.position.set(0.1, 0.25, -0.2);
          this.weapon.rotation.x = Math.PI / 2;
          break;
        default:
        case "meleeAttack":
          this.weapon.position.set(0.2, 0.15, 0);
          this.weapon.rotation.x = 0;
          break;
      }
    }
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
  constructor(scene, entity) {
    super(scene, { entity });
    this.position.y = 0;
    const spear = new SpearMesh();
    this.add(spear);
    spear.rotation.x = Math.PI / 2;
  }

  update(scene) {
    super.update(scene);
    this.lookAt(
      entityMap.get(this.entity.target)?.getWorldPosition(new THREE.Vector3())
    );
  }
}

class OpenInputState extends State {
  update(input, scene) {}
  generateCommand(input, scene) {
    const state = scene.inputManager.getState();
    const { playSound, game } = scene;
    const { mouse, object, ui } = state;
    const { released } = mouse;

    const hit = object.hover.get(input.ground);
    const hitGrid = hit ? new GridPosition(hit.point) : null;
    let clickedCommand = ui.commands?.[0];
    switch (clickedCommand?.type) {
      case "selectBuilding":
        playSound("./audio/click1.ogg");
        input.replaceState(new BuildInputState(clickedCommand.buildingConfig));
        break;
      default:
        break;
    }
    const towerAt = game.getTower(hitGrid);
    if (hitGrid && towerAt && released) {
      input.replaceState(new SelectedUnitInputState(towerAt, scene.ui));
    }
    return clickedCommand;
  }
}

class SelectedUnitInputState extends State {
  constructor(selectedUnit, ui) {
    super();
    this.selectedUnit = selectedUnit;
    this.ui = ui;
  }

  init(input) {
    const makeRangeHint = () => {
      const geo = new THREE.CircleGeometry(1).rotateX(-Math.PI / 2);
      const material = new THREE.MeshBasicMaterial({ color: "red" });
      const mesh = new THREE.Mesh(geo, material);
      material.transparent = true;
      material.opacity = 0;
      input.scene.add(mesh);
      return mesh;
    };

    this.rangeHint = makeRangeHint();

    this.tooltip = this.ui.compose([
      new UIContainerParams({
        id: inputIds.tooltip,
        position: new AbsolutePosition({
          width: 0.2,
          height: 0.2,
          centerX: 0.5,
          centerY: 0.5,
        }),
        intro: new AnimationCSS("zoomInDown", 0, 0.1),
        outro: new AnimationCSS("bounceOutLeft", 0, 0.1),
      }),
      new UIContainerParams({
        id: inputIds.abilitySelect,
        position: new AbsolutePosition({
          width: 1,
          height: 0.8,
          centerX: 0.5,
          centerY: 0.5,
        }),
      }),
    ]);

    const dart = this.ui.compose(
      [
        new UIButtonParams({
          command: {
            type: TowerDefenseGame.commands.setAbility,
            index: 0,
          },
          position: new AbsolutePosition({
            width: 0.4,
            height: 0.4,
            centerX: 0.25,
            centerY: 0.5,
          }),
        }),
        new UIImageParams({ imageName: "dart" }),
      ],
      this.tooltip
    );

    this.ui.compose(
      [
        new UIImageParams({
          imageName: "clockwise-rotation",
          position: new AbsolutePosition({
            width: 0.2,
            height: 0.2,
            centerX: 0,
            centerY: 0,
          }),
        }),
        new UITextBoxParams({
          class: "ability-number",
          text: "40",
        }),
      ],
      dart
    );
    this.ui.compose(
      [
        new UIImageParams({
          imageName: "punch-blast",
          position: new AbsolutePosition({
            width: 0.2,
            height: 0.2,
            centerX: 1,
            centerY: 0,
          }),
        }),
        new UITextBoxParams({
          class: "ability-number",
          text: "1",
        }),
      ],
      dart
    );

    const spear = this.ui.compose(
      [
        new UIButtonParams({
          command: {
            type: TowerDefenseGame.commands.setAbility,
            index: 1,
          },
          position: new AbsolutePosition({
            width: 0.4,
            height: 0.4,
            centerX: 0.75,
            centerY: 0.5,
          }),
        }),
        new UIImageParams({
          imageName: "spear-feather",
        }),
      ],
      this.tooltip
    );

    this.ui.compose(
      [
        new UIImageParams({
          imageName: "clockwise-rotation",
          position: new AbsolutePosition({
            width: 0.2,
            height: 0.1,
            centerX: 0,
            centerY: 0,
          }),
        }),
        new UITextBoxParams({
          class: "ability-number",
          text: "40",
        }),
      ],
      spear
    );
    this.ui.compose(
      [
        new UIImageParams({
          imageName: "punch-blast",
          position: new AbsolutePosition({
            width: 0.2,
            height: 0.2,
            centerX: 1,
            centerY: 0,
          }),
        }),
        new UITextBoxParams({
          class: "ability-number",
          text: "1",
        }),
      ],
      spear
    );

    this.tooltip.style.display = "block";
    this.tooltip.classList.add("targetable");
    this.tooltip.style.opacity = 1;
  }

  cleanup(input) {
    input.scene.remove(this.rangeHint);
    const tooltip = this.tooltip;
    tooltip.classList.remove("targetable");
    animateCSSKey([tooltip], "outro").then(() => {
      tooltip.remove();
    });
  }

  updateRangeHint() {
    const selectedUnit = this.selectedUnit;
    const { range } =
      selectedUnit.abilityOptions[selectedUnit.getActiveIndex()];

    this.rangeHint.position.x = selectedUnit.position.x;
    this.rangeHint.position.y = 0.01;
    this.rangeHint.position.z = selectedUnit.position.z;
    this.rangeHint.scale.set(range, range, range);
    this.rangeHint.material.opacity = 0.4;
  }

  updateTooltipPosition(input) {
    const { camera } = input.scene;
    const tooltip = this.tooltip;
    const selectedUnit = this.selectedUnit;
    const towerScreenSpace = selectedUnit.gridPos.toVector3().project(camera);

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
      const child = children[i];
      if (selectedUnit.getActiveIndex() === i) {
        child.classList.add("selected");
      } else {
        child.classList.remove("selected");
      }

      const { damage, cooldown } = selectedUnit.abilityOptions[i];

      child.children[0].children[0].children[0].children[0].innerText = `${cooldown}`;
      child.children[0].children[1].children[0].children[0].innerText = `${damage}`;
    }
  }

  update(input, scene) {
    this.updateRangeHint();
    this.updateTooltipPosition(input);
  }

  generateCommand(input, scene) {
    const state = scene.inputManager.getState();
    const { playSound, game } = scene;
    const { mouse, object, ui } = state;
    const { released } = mouse;

    const hit = object.hover.get(this.ground);
    const hitGrid = hit ? new GridPosition(hit.point) : null;
    let clickedCommand = ui.commands?.[0];
    switch (clickedCommand?.type) {
      case "selectBuilding":
        playSound("./audio/click1.ogg");
        input.replaceState(new BuildInputState(clickedCommand.buildingConfig));
        break;
      case TowerDefenseGame.commands.setAbility:
        clickedCommand.gridPos = this.selectedUnit.gridPos;
        playSound("./audio/click1.ogg");
        break;
      default:
        break;
    }
    const towerAt = game.getTower(hitGrid);
    if (hitGrid && towerAt && released) {
      input.replaceState(new SelectedUnitInputState(towerAt, scene.ui));
    } else if (released) {
      input.replaceState(new OpenInputState());
    }
    return clickedCommand;
  }
}

class BuildInputState extends State {
  constructor(buildingConfig) {
    super();
    this.buildingConfig = buildingConfig;
  }

  init(input) {
    const { children } = document.getElementById("bottomMenu");

    for (let i = 0; i < children.length; i++) {
      const child = children[i];
      if (child.command.type === "selectBuilding") {
        if (this.selectedBuild === child.command.buildingConfig) {
          child.classList.add("selected");
        } else {
          child.classList.remove("selected");
        }
      }
    }

    const makeHint = () => {
      const geo = new THREE.BoxGeometry(0.2, 0.2, 0.2);
      const material = new THREE.MeshBasicMaterial({ color: "grey" });
      const mesh = new THREE.Mesh(geo, material);
      material.transparent = true;
      material.opacity = 0;
      input.scene.add(mesh);
      return mesh;
    };

    this.hint = makeHint();
  }

  cleanup(input) {
    const { children } = document.getElementById("bottomMenu");

    for (let i = 0; i < children.length; i++) {
      const child = children[i];
      if (child.command.type === "selectBuilding") {
        if (this.selectedBuild === child.command.buildingConfig) {
          child.classList.add("selected");
        } else {
          child.classList.remove("selected");
        }
      }
    }
    input.scene.remove(this.hint);
  }

  updateHint(input, scene) {
    const { game } = scene;
    const state = scene.inputManager.getState();
    const { object } = state;

    const hit = object.hover.get(input.ground);
    const gridPos = hit ? new GridPosition(hit.point) : null;
    if (gridPos) {
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
  }

  update(input, scene) {
    this.updateHint(input, scene);
  }

  generateCommand(input, scene) {
    const state = scene.inputManager.getState();
    const { playSound } = scene;
    const { mouse, object, ui } = state;
    const { released } = mouse;

    const hit = object.hover.get(input.ground);
    const hitGrid = hit ? new GridPosition(hit.point) : null;
    let clickedCommand = ui.commands?.[0];
    if (clickedCommand?.type === "selectBuilding") {
      playSound("./audio/click1.ogg");
      input.replaceState(new OpenInputState());
    } else if (hit && released) {
      clickedCommand = {
        type: TowerDefenseGame.commands.build,
        gridPos: hitGrid,
        config: this.buildingConfig,
      };
    }
    return clickedCommand;
  }
}

class TowerDefenseInput extends StateMachine {
  static states = makeEnum(["free", "build", "selectedUnit"]);

  constructor(scene) {
    super();
    this.scene = scene;
    this.ui = scene.ui;
    this.pushState(new OpenInputState());
  }

  update(scene) {
    const state = scene.inputManager.getState();
    const { hover } = state.ui;
    const { children } = document.getElementById("bottomMenu");

    for (let i = 0; i < children.length; i++) {
      const child = children[i];
      if (hover.indexOf(child) >= 0) {
        child.classList.add("hovered");
      } else {
        child.classList.remove("hovered");
      }
    }

    this.currentState()?.update(this, scene);
  }

  generateCommands(scene) {
    const command = this.currentState()?.generateCommand(this, scene);
    if (command) {
      return [command];
    }
    return [];
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

    this.ui.compose([
      new UIContainerParams({
        position: new AbsolutePosition({
          width: 0.15,
          height: 0.1,
          centerX: 0.5,
          centerY: 0.1,
        }),
        intro: new AnimationCSS("zoomInDown", 1, 1),
        outro: new AnimationCSS("bounceOutLeft", 1, 1),
      }),
      new UIButtonParams({
        command: {
          type: TowerDefenseGame.commands.startFightPhase,
        },
      }),
      new UITextBoxParams({
        text: "Start Fight",
      }),
    ]);

    const bottomBar = this.ui.compose([
      new UIContainerParams({
        id: inputIds.bottomMenu,
        position: new AbsolutePosition({
          width: 0.8,
          height: 0.15,
          centerX: 0.5,
          centerY: 0.875,
        }),
        intro: new AnimationCSS("zoomInDown", 1, 1),
        outro: new AnimationCSS("bounceOutLeft", 1, 1),
      }),
    ]);

    this.ui.compose(
      [
        new UIButtonParams({
          position: new AbsolutePosition({
            width: 0.4,
            height: 0.8,
            centerX: 0.25,
            centerY: 0.5,
          }),
          command: { type: "selectBuilding", buildingConfig: baseTowerConfig },
        }),
        new UITextBoxParams({
          text: "Build 1",
        }),
      ],
      bottomBar
    );
    this.ui.compose(
      [
        new UIButtonParams({
          position: new AbsolutePosition({
            width: 0.4,
            height: 0.8,
            centerX: 0.75,
            centerY: 0.5,
          }),
          command: {
            type: TowerDefenseGame.commands.spawnEnemy,
            config: {
              health: 2,
              speed: 0.01,
            },
          },
        }),
        new UITextBoxParams({
          text: "Spawn Enemy",
        }),
      ],
      bottomBar
    );
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

  init(engine) {
    super.init(engine);
    this.inputManager = engine.input;
    this.playSound = (path) => engine.playSound(path);
    this.game = new TowerDefenseGame();
    const effects = this.game.init();
    this.applyEffects(effects);
    this.tickRate = 30;
    this.input = new TowerDefenseInput(this);
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
        case TowerDefenseGame.effects.changedActiveAbility:
          entityMap.get(effect.entity)?.update(this);
          break;
        case TowerDefenseGame.effects.attacked:
          const tower = entityMap.get(effect.entity);
          entityMap.get(effect.target)?.update(this);
          tower.update(this);
          switch (effect.entity.activeAbility.type) {
            case "meleeAttack":
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
          engine.pushState(new GameOverMenu());
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
    this.commands.push(...this.input.generateCommands(this));
  }

  resolveCommands(engine) {
    const effects = this.game.handle(this.commands);
    this.applyEffects(effects, engine);
    this.input.update(this);
  }
}
