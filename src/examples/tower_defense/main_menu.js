import { TowerDefense } from "./tower_defense.js";
import { GameState } from "../../engine/engine.js";
import { makeEnum } from "../../utils/helper.js";
import { animateCSS, AnimationCSS } from "../../utils/animate.js";

const commands = makeEnum(["start"]);

export class MainMenu extends GameState {
  init(engine) {
    super.init(engine);

    const container = this.ui.createContainer({
      center: [0.5, 0.1],
      size: [0.8, 0.1],
      intro: new AnimationCSS("zoomInDown", 1, "fast"),
      outro: new AnimationCSS("bounceOutLeft", 1, "fast"),
    });

    this.ui.createTextBox(container, {
      text: "My First Tower Defense",
    });

    const buttonContainer = this.ui.createContainer({
      center: [0.5, 0.8],
      size: [0.2, 0.1],
      intro: new AnimationCSS("zoomInDown", 1, "fast"),
      outro: new AnimationCSS("bounceOutLeft", 1, "fast"),
    });

    const button = this.ui.createButton(buttonContainer, {
      command: { type: commands.start },
    });

    this.ui.createTextBox(button, {
      text: "Start Game",
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

          this.ui.exitAll().then((result) => {
            console.log("resolved");
            engine.replaceState(new TowerDefense());
          });
          break;
        default:
          break;
      }
    });
  }
}
