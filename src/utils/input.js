import * as THREE from "three";

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
    this.tick = 0;
    this.history = [];
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
    window.addEventListener("blur", (event) => {
      const { pressedKeys } = this.keyState;
      pressedKeys.clear();
      this.mouseState.buttons = null;
      this.history.push({ tick: this.tick, type: event.type });
    });
    window.addEventListener("focusout", (event) => {
      const { pressedKeys } = this.keyState;
      pressedKeys.clear();
      this.mouseState.buttons = null;
      this.history.push({ tick: this.tick, type: event.type });
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
      this.history.push({ tick: this.tick, type: event.type, key: key });
    });
    window.addEventListener("keyup", (event) => {
      const key = event.key.toLowerCase();
      event.preventDefault();
      const { pressedKeys } = this.keyState;
      if (pressedKeys.has(key)) {
        pressedKeys.delete(key);
      }
      this.history.push({ tick: this.tick, type: event.type, key: key });
    });

    const handleMouseEvent = (event) => {
      const { sizes } = this;
      if (event.target.className !== "webgl") {
        return;
      }
      const previous = this.mouseState.pos;
      const pos = new THREE.Vector2(
        ((event.clientX - sizes.horizontalOffset) / sizes.width) * 2 - 1,
        -((event.clientY - sizes.verticalOffset) / sizes.height) * 2 + 1
      );
      this.mouseState.pos = pos;

      if (previous) {
        this.mouseState.posDelta = new THREE.Vector2(
          this.mouseState.pos.x - previous.x,
          this.mouseState.pos.y - previous.y
        );
      }

      this.mouseState.buttons = event.buttons;
      this.history.push({
        tick: this.tick,
        type: event.type,
        pos: pos,
        buttons: event.buttons,
      });
    };

    const handleScrollEvent = (event) => {
      this.mouseState.mouseWheel.deltaY = event.deltaY;
      this.history.push({
        tick: this.tick,
        type: event.type,
        deltaY: event.deltaY,
      });
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

  getState() {
    const mouse = {
      pos: null,
      pressed: 0,
      held: 0,
      released: 0,
    };
    const key = {
      pressed: [],
      held: [],
      released: [],
    };
    const ui = {
      idle: [],
      down: [],
      clicked: [],
      hover: [],
    };

    // handle mouse position
    const latestMouseEvent = this.history.findLast((ev) => {
      switch (ev.type) {
        case "pointerdown":
        case "pointerup":
        case "pointermove":
          return true;
        default:
          return false;
      }
    });
    if (latestMouseEvent) {
      mouse.pos = latestMouseEvent.pos;
    }

    // handle released
    const latestCurrentPointerUp = this.history.findLast((ev) => {
      if (ev.tick !== this.tick) {
        return false;
      }
      switch (ev.type) {
        case "pointerup":
          return true;
        default:
          return false;
      }
    });
    if (latestCurrentPointerUp) {
      // find what the previous
      const prevPointer = this.history.findLast((ev) => {
        if (ev.tick === this.tick) {
          return false;
        }
        switch (ev.type) {
          case "pointerdown":
          case "pointerup":
          case "pointermove":
            return true;
          default:
            return false;
        }
      });
      if (prevPointer) {
        mouse.released =
          prevPointer.buttons -
          (prevPointer.buttons & latestCurrentPointerUp.buttons);
      }
    }

    // handle pressed
    const latestCurrentPointerDown = this.history.findLast((ev) => {
      if (ev.tick !== this.tick) {
        return false;
      }
      switch (ev.type) {
        case "pointerdown":
          return true;
        default:
          return false;
      }
    });
    if (latestCurrentPointerDown) {
      // find what the previous
      const prevPointer = this.history.findLast((ev) => {
        if (ev.tick === this.tick) {
          return false;
        }
        switch (ev.type) {
          case "pointerdown":
          case "pointerup":
          case "pointermove":
            return true;
          default:
            return false;
        }
      });
      if (prevPointer) {
        mouse.pressed =
          latestCurrentPointerDown.buttons -
          (prevPointer.buttons & latestCurrentPointerDown.buttons);
      }
    }

    return {
      mouse,
      key,
      ui,
    };
  }

  register(element) {
    element.inputKey = this.getUnique();
    element.state = "idle";
    this.ui.set(element.inputKey, element);
    element.onmousedown = (event) => {
      this.ui.get(element.inputKey).state = "down";
      this.history.push({
        tick: this.tick,
        type: event.type,
        inputKey: element.inputKey,
      });
    };
    element.onmouseup = (event) => {
      const state = this.ui.get(element.inputKey);
      if (state.state === "down") {
        this.ui.get(element.inputKey).state = "clicked";
      } else {
        this.ui.get(element.inputKey).state = "hover";
      }
      this.history.push({
        tick: this.tick,
        type: event.type,
        inputKey: element.inputKey,
      });
    };
    element.onmouseenter = (event) => {
      this.ui.get(element.inputKey).state = "hover";
      this.history.push({
        tick: this.tick,
        type: event.type,
        inputKey: element.inputKey,
      });
    };
    element.onmouseover = (event) => {
      this.ui.get(element.inputKey).state = "hover";
      this.history.push({
        tick: this.tick,
        type: event.type,
        inputKey: element.inputKey,
      });
    };
    element.onmouseleave = (event) => {
      this.ui.get(element.inputKey).state = "idle";
      this.history.push({
        tick: this.tick,
        type: event.type,
        inputKey: element.inputKey,
      });
    };
    element.onmouseout = (event) => {
      this.ui.get(element.inputKey).state = "idle";
      this.history.push({
        tick: this.tick,
        type: event.type,
        inputKey: element.inputKey,
      });
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
    this.tick++;
  }
}

export { InputManager };
