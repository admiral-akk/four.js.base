import { TowerDefense } from "./tower_defense.js";
import { MainMenu } from "./main_menu.js";
import { GameState } from "../../engine/engine.js";
import { makeEnum } from "../../utils/helper.js";

const commands = makeEnum(["newGame", "mainMenu"]);

export class GameOverMenu extends GameState {
  init() {
    this.ui.createElement({
      classNames: "column-c",
      style: {
        position: "absolute",
        top: "20%",
        right: "40%",
        height: "50%",
        width: "20%",
      },
      children: [
        {
          classNames: "targetable column-c",
          style: {
            height: "90%",
            width: "30%",
          },
          command: {
            type: commands.newGame,
          },
          children: [
            {
              text: "New Game",
            },
          ],
        },
        {
          classNames: "targetable column-c",
          style: {
            height: "90%",
            width: "30%",
          },
          command: {
            type: commands.mainMenu,
          },
          children: [
            {
              text: "Main Menu",
            },
          ],
        },
      ],
    });
  }

  tick(engine) {}

  update(engine) {
    const { clickedCommands } = engine.input.getState().ui;
    this.commands.push(...clickedCommands);
  }

  resolveCommands(engine) {
    this.commands.forEach((command) => {
      switch (command.type) {
        case commands.mainMenu:
          engine.popState();
          engine.replaceState(MainMenu);
          break;
        case commands.newGame:
          engine.popState();
          engine.replaceState(TowerDefense);
          break;
        default:
          break;
      }
    });
  }
}
