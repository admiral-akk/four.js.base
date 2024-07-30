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
    const title = this.ui.createElement({
      classNames: "column-c",
      style: {
        position: "absolute",
        top: "-90%",
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

    this.tl.to(title, { top: "10%" });
    this.start = this.ui.createElement({
      classNames: "interactive column-c",
      style: {
        position: "absolute",
        top: "180%",
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
    this.tl.to(this.start, { top: "80%" });
  }

  // things to load
  manifest() {
    return ["./audio/click1.ogg"];
  }

  update(engine) {
    const { ui } = engine.input.getState();
    if (ui.clicked.find((v) => v === this.start) !== undefined) {
      engine.playSound("./audio/click1.ogg");
      this.tl.to(".column-c", { top: "-100%" });
      this.tl.eventCallback("onComplete", () => {
        engine.replaceState(TowerDefense);
      });
    }
  }
}
