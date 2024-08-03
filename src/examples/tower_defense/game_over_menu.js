import { TowerDefense } from "./tower_defense.js";
import { MainMenu } from "./main_menu.js";
import { GameState } from "../../engine/engine.js";

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
          classNames: "interactive column-c",
          style: {
            height: "90%",
            width: "30%",
          },
          data: {
            command: {
              type: "newGame",
            },
          },
          children: [
            {
              text: "New Game",
            },
          ],
        },
        {
          classNames: "interactive column-c",
          style: {
            height: "90%",
            width: "30%",
          },
          data: {
            command: {
              type: "mainMenu",
            },
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

  update(engine) {
    const { ui } = engine.input.getState();
    const command = ui.clicked.find((v) => v.data?.command)?.data?.command;
    if (command) {
      console.log(command);
      switch (command.type) {
        case "mainMenu":
          engine.popState();
          engine.replaceState(MainMenu);
          break;
        case "newGame":
          engine.popState();
          engine.replaceState(TowerDefense);
          break;
        default:
          break;
      }
    }
  }
}
