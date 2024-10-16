import { TowerDefense } from "./tower_defense.js";
import { MainMenu } from "./main_menu.js";
import { GameState } from "../../engine/engine.js";
import { makeEnum } from "../../utils/helper.js";
import {
  UIButtonParams,
  UIContainerParams,
  UITextBoxParams,
  AbsolutePosition,
} from "../../engine/ui.js";
import { animateCSS, AnimationCSS } from "../../utils/animate.js";

const commands = makeEnum(["newGame", "mainMenu"]);

export class GameOverMenu extends GameState {
  init(engine) {
    super.init(engine);

    const table = this.ui.compose([
      new UIContainerParams({
        position: new AbsolutePosition({
          width: 0.2,
          height: 0.5,
          centerX: 0.5,
          centerY: 0.4,
        }),
        intro: new AnimationCSS("zoomInDown", 1, 1),
        outro: new AnimationCSS("bounceOutLeft", 1, 1),
      }),
    ]);

    this.ui.compose(
      [
        new UIButtonParams({ command: { type: commands.newGame } }),
        new UITextBoxParams({ text: "New Game" }),
      ],
      table
    );

    this.ui.compose(
      [
        new UIButtonParams({ command: { type: commands.mainMenu } }),
        new UITextBoxParams({ text: "Main Menu" }),
      ],
      table
    );
  }

  tick(engine) {}

  update(engine) {
    const { commands } = engine.input.getState().ui;
    this.commands.push(...commands);
  }

  resolveCommands(engine) {
    this.commands.forEach((command) => {
      switch (command.type) {
        case commands.mainMenu:
          this.ui.exitAll().then((_) => {
            engine.popState();
            engine.replaceState(new MainMenu());
          });
          break;
        case commands.newGame:
          this.ui.exitAll().then((_) => {
            engine.popState();
            engine.replaceState(new TowerDefense());
          });
          break;
        default:
          break;
      }
    });
  }

  render(renderer) {}
}
