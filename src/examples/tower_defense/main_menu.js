import { TowerDefense } from "./tower_defense.js";
import { GameState } from "../../engine/engine.js";
import { makeEnum } from "../../utils/helper.js";

const commands = makeEnum(["start"]);

export class MainMenu extends GameState {
  init() {
    const title = this.ui.createElement({
      classNames: "column-c",
      alignment: {
        topOffset: -0.9,
        width: 0.8,
        height: 0.1,
      },
      children: ["My First Tower Defense"],
    });

    this.tl.to(title, { top: "10%" });
    this.start = this.ui.createElement({
      classNames: "targetable column-c",
      alignment: {
        topOffset: 1.8,
        width: 0.2,
        height: 0.1,
      },
      command: {
        type: commands.start,
      },
      children: ["Start Game"],
    });
    this.tl.to(this.start, { top: "80%" });
  }

  // things to load
  manifest() {
    return ["./audio/click1.ogg"];
  }

  tick(engine) {}

  update(engine) {
    const clickedCommands = engine.input.getState().ui.commands;
    if (clickedCommands) {
      this.commands.push(...clickedCommands);
    }
  }

  resolveCommands(engine) {
    this.commands.forEach((command) => {
      console.log(command.type);
      switch (command.type) {
        case commands.start:
          engine.playSound("./audio/click1.ogg");
          this.tl.to(".column-c", { top: "-100%" });
          this.tl.eventCallback("onComplete", () => {
            engine.replaceState(TowerDefense);
          });
          break;
        default:
          break;
      }
    });
  }
}
