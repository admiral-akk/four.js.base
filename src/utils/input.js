import * as THREE from "three";
import { element } from "three/examples/jsm/nodes/Nodes.js";

class InputManager {
  updateTime({ userDeltaTime, gameDeltaTime }) {
    this.keyState.pressedKeys.forEach((v) => {
      v.heldUserTime += userDeltaTime;
      v.heldGameTime += gameDeltaTime;
      v.ticks += 1;
    });
  }

  getUnique() {
    return this.uniqueVal++;
  }

  constructor(windowManager, time) {
    this.uniqueVal = 0;
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
    this.ui = new Map();
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
        pressedKeys.set(key, { heldGameTime: 0, heldUserTime: 0, ticks: 0 });
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
    windowManager.listeners.push(this);
    windowManager.update();
  }

  getKey(k) {
    return this.keyState.pressedKeys.get(k);
  }

  updateSize(sizes) {
    this.sizes = sizes;
  }

  register(element) {
    element.inputKey = this.getUnique();
    element.state = "idle";
    this.ui.set(element.inputKey, element);
    element.onmousedown = () => {
      this.ui.get(element.inputKey).state = "down";
    };
    element.onmouseup = () => {
      const state = this.ui.get(element.inputKey);
      if (state.state === "down") {
        this.ui.get(element.inputKey).state = "clicked";
      } else {
        this.ui.get(element.inputKey).state = "hover";
      }
    };
    element.onmouseenter = () => {
      this.ui.get(element.inputKey).state = "hover";
    };
    element.onmouseover = () => {
      this.ui.get(element.inputKey).state = "hover";
    };
    element.onmouseleave = () => {
      this.ui.get(element.inputKey).state = "idle";
    };
    element.onmouseout = () => {
      this.ui.get(element.inputKey).state = "idle";
    };
  }
  //onclick	The user clicks on an element
  // oncontextmenu	The user right-clicks on an element
  // ondblclick	The user double-clicks on an element
  // onmousedown	A mouse button is pressed over an element
  // onmouseenter	The pointer is moved onto an element
  // onmouseleave	The pointer is moved out of an element
  // onmousemove	The pointer is moving over an element
  // onmouseout	The mouse pointer moves out of an element
  // onmouseover	The mouse pointer is moved over an element
  // onmouseup

  endLoop() {
    this.mouseState.posDelta.x = 0;
    this.mouseState.posDelta.y = 0;
    this.mouseState.mouseWheel.deltaY = null;

    const elements = document.getElementsByTagName("*");
    for (let i = 0; i < elements.length; i++) {
      const element = elements[i];
      if (element.style.pointerEvents !== "auto") {
        continue;
      }
      if (this.ui.has(element.inputKey)) {
        continue;
      }
      this.register(element);
    }

    const keys = this.ui.keys();
    keys.forEach((k) => {
      const element = this.ui.get(k);
      //console.log(this.ui.get(k));
      if (!element.parentNode) {
        this.ui.delete(k);
      } else if (element.state === "clicked") {
        element.state = "hover";
      }
      console.log(element.state);
    });
  }
}

export { InputManager };
