import { TowerDefense } from "./tower_defense.js";
import { GameState } from "../../engine/engine.js";
import { makeEnum } from "../../utils/helper.js";
import { animateCSS, AnimationCSS } from "../../utils/animate.js";

const commands = makeEnum(["start"]);

export class MainMenu extends GameState {
  init(engine) {
    super.init(engine);
    this.ui.createElement({
      id: "12",
      classNames: ["column-c", "main-menu-title"],
      intro: new AnimationCSS("zoomInDown", 1, "fast"),
      children: ["My First Tower Defense"],
    });

    this.ui.createElement({
      id: "13",
      classNames: ["column-c", "main-menu-start-game"],
      intro: new AnimationCSS("zoomInDown", 4, "slow"),
      command: {
        type: commands.start,
      },
      children: ["Start Game"],
    });
  }

  // things to load
  manifest() {
    return ["./audio/click1.ogg"];
  }

  update(engine) {
    const clickedCommands = engine.input.getState().ui.commands;
    if (clickedCommands) {
      this.commands.push(...clickedCommands);
    }
  }

  resolveCommands(engine) {
    this.commands.forEach((command) => {
      switch (command.type) {
        case commands.start:
          engine.playSound("./audio/click1.ogg");
          animateCSS(".column-c", new AnimationCSS("bounceOutLeft")).then(
            (msg) => {
              console.log("resolved");
              engine.replaceState(new TowerDefense());
            }
          );
          break;
        default:
          break;
      }
    });
  }
}
