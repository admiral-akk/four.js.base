import { TowerDefense } from "./tower_defense.js";
import { GameState } from "../../engine/engine.js";
import { makeEnum } from "../../utils/helper.js";
import { animateCSS, AnimationCSS } from "../../utils/animate.js";
import {
  UIButtonParams,
  UIContainerParams,
  UITextBoxParams,
} from "../../engine/ui.js";

const commands = makeEnum(["start"]);

export class MainMenu extends GameState {
  init(engine) {
    super.init(engine);

    this.ui.compose([
      new UIContainerParams({
        center: [0.5, 0.1],
        size: [0.8, 0.1],
        intro: new AnimationCSS("zoomInDown", 0, 1),
        outro: new AnimationCSS("bounceOutLeft", 1, 1),
      }),
      new UITextBoxParams({
        text: "Start Game",
      }),
    ]);

    this.ui.compose([
      new UIContainerParams({
        center: [0.5, 0.8],
        size: [0.2, 0.1],
        intro: new AnimationCSS("zoomInDown", 1, 1),
        outro: new AnimationCSS("bounceOutLeft", 1, 1),
      }),
      new UIButtonParams({
        command: { type: commands.start },
      }),
      new UITextBoxParams({
        text: "Start Game",
      }),
    ]);
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
            engine.replaceState(new TowerDefense());
          });
          break;
        default:
          break;
      }
    });
  }
}
