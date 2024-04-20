import * as THREE from "three";

class InputManager {
  updateTime({ userDeltaTime, gameDeltaTime }) {
    this.keyState.pressedKeys.forEach((v) => {
      v.heldUserTime += userDeltaTime;
      v.heldGameTime += gameDeltaTime;
    });
  }

  constructor(time) {
    this.mouseState = {
      posDelta: new THREE.Vector2(),
      pos: null,
      buttons: null,
      mouseWheel: {
        deltaY: null,
      },
    };
    this.keyState = {
      pressedKeys: new Map(),
    };
    this.sizes = { width: 1, height: 1 };
    this.listeners = [];
    window.addEventListener("blur", () => {
      const { pressedKeys } = this.keyState;
      pressedKeys.clear();
      this.mouseState.buttons = null;
    });
    window.addEventListener("focusout", () => {
      const { pressedKeys } = this.keyState;
      pressedKeys.clear();
      this.mouseState.buttons = null;
    });
    window.addEventListener("keydown", (event) => {
      const key = event.key.toLowerCase();
      if (key === "f12") {
        return;
      }
      event.preventDefault();
      const { pressedKeys } = this.keyState;
      if (!pressedKeys.has(key)) {
        pressedKeys.set(key, { heldGameTime: 0, heldUserTime: 0 });
      }
    });
    window.addEventListener("keyup", (event) => {
      const key = event.key.toLowerCase();
      event.preventDefault();
      const { pressedKeys } = this.keyState;
      if (pressedKeys.has(key)) {
        pressedKeys.delete(key);
      }
    });

    const handleMouseEvent = (event) => {
      const { sizes } = this;
      if (event.target.className !== "webgl") {
        return;
      }
      const previous = this.mouseState.pos;
      this.mouseState.pos = new THREE.Vector2(
        ((event.clientX - sizes.horizontalOffset) / sizes.width) * 2 - 1,
        -((event.clientY - sizes.verticalOffset) / sizes.height) * 2 + 1
      );

      if (previous) {
        this.mouseState.posDelta = new THREE.Vector2(
          this.mouseState.pos.x - previous.x,
          this.mouseState.pos.y - previous.y
        );
      }

      this.mouseState.buttons = event.buttons;
    };

    const handleScrollEvent = (event) => {
      this.mouseState.mouseWheel.deltaY = event.deltaY;
    };

    window.addEventListener("wheel", handleScrollEvent);
    window.addEventListener("pointerdown", handleMouseEvent);
    window.addEventListener("pointerup", handleMouseEvent);
    window.addEventListener("pointermove", handleMouseEvent);

    window.addEventListener(
      "contextmenu",
      (ev) => {
        ev.preventDefault();
        return false;
      },
      false
    );
    time.listeners.push(this);
  }

  getKey(k) {
    return this.keyState.pressedKeys.get(k);
  }

  updateSize(sizes) {
    this.sizes = sizes;
  }
  endLoop() {
    this.mouseState.posDelta.x = 0;
    this.mouseState.posDelta.y = 0;
    this.mouseState.mouseWheel.deltaY = null;
  }
}

export { InputManager };
