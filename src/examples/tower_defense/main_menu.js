import { TowerDefense } from "./tower_defense.js";
import { GameState } from "../../engine/engine.js";

export class MainMenu extends GameState {
  constructor({ ui, window }) {
    super({
      ui,
      window,
      cameraConfig: {
        isPerspective: true,
        fov: 75,
      },
    });
  }

  init() {
    this.ui.createElement({
      classNames: "column-c",
      style: {
        position: "absolute",
        top: "10%",
        right: "10%",
        height: "10%",
        width: "80%",
      },
      children: [
        {
          text: "My First Tower Defense",
        },
      ],
    });

    this.start = this.ui.createElement({
      classNames: "interactive column-c",
      style: {
        position: "absolute",
        top: "80%",
        right: "40%",
        height: "10%",
        width: "20%",
      },
      children: [
        {
          text: "Start Game",
        },
      ],
    });
  }

  update(engine) {
    const { ui } = engine.input.getState();
    if (ui.clicked.find((v) => v === this.start) !== undefined) {
      this.tl.to(".column-c", { top: "-100%" });
      this.tl.eventCallback("onComplete", () => {
        engine.replaceState(TowerDefense);
      });
    }
  }
}
