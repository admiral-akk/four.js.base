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

  storeEvent(ev) {
    ev.tick = this.tick;
    switch (ev.type) {
      case "wheel":
      case "pointerup":
      case "pointerdown":
      case "pointermove":
        this.history.mouse.push(ev);
        break;
      case "blur":
      case "focusout":
        break;
      case "keydown":
      case "keyup":
        if (!this.history.key.has(ev.key)) {
          this.history.key.set(ev.key, []);
        }
        this.history.key.get(ev.key).push(ev);
        break;
      case "mousedown":
      case "mouseup":
      case "mouseleave":
      case "mouseout":
      case "mouseenter":
        if (!this.history.ui.has(ev.inputKey)) {
          this.history.ui.set(ev.inputKey, []);
        }
        this.history.ui.get(ev.inputKey).push(ev);
        break;
      default:
        break;
    }
  }

  constructor(windowManager, time) {
    this.tick = 0;
    this.history = {
      mouse: [],
      key: new Map(),
      ui: new Map(),
    };
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
      this.storeEvent({ type: event.type });
    });
    window.addEventListener("focusout", (event) => {
      const { pressedKeys } = this.keyState;
      pressedKeys.clear();
      this.mouseState.buttons = null;
      this.storeEvent({ type: event.type });
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
      this.storeEvent({ type: event.type, key });
    });
    window.addEventListener("keyup", (event) => {
      const key = event.key.toLowerCase();
      event.preventDefault();
      const { pressedKeys } = this.keyState;
      if (pressedKeys.has(key)) {
        pressedKeys.delete(key);
      }
      this.storeEvent({ type: event.type, key });
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
      this.storeEvent({
        type: event.type,
        pos: pos,
        buttons: event.buttons,
      });
    };

    const handleScrollEvent = (event) => {
      this.mouseState.mouseWheel.deltaY = event.deltaY;
      this.storeEvent({
        type: event.type,
        pos: pos,
        buttons: event.buttons,
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

  getMouseState() {
    const mouse = {
      pos: null,
      pressed: 0,
      held: 0,
      released: 0,
    };

    // handle released
    const latestCurrentPointerUp = this.history.mouse.findLast((ev) => {
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
      const prevPointer = this.history.mouse.findLast((ev) => {
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
    const latestCurrentPointerDown = this.history.mouse.findLast((ev) => {
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
      const prevPointer = this.history.mouse.findLast((ev) => {
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

    // handle held
    // handle mouse position
    const latestMouseEvent = this.history.mouse.findLast((ev) => {
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
      mouse.held =
        latestMouseEvent.buttons -
        (mouse.pressed & latestMouseEvent.buttons) -
        (mouse.released & latestMouseEvent.buttons);
    }
    return mouse;
  }

  getKeyState() {
    const key = {
      pressed: [],
      held: [],
      released: [],
    };
    return key;
  }

  getUiState() {
    const ui = {
      idle: [],
      down: [],
      clicked: [],
      hover: [],
    };
    const keys = this.history.ui.keys();

    for (const key of keys) {
      const events = this.history.ui.get(key);
      {
        // clicked
        // if last two events are:
        // mouse down
        // mouse up

        const last = events.length > 0 ? events[events.length - 1] : null;
        const secondLast = events.length > 1 ? events[events.length - 2] : null;
        if (
          last &&
          secondLast &&
          last.tick === this.tick &&
          last.type === "mouseup" &&
          secondLast.type === "mousedown"
        ) {
          ui.clicked.push(key);
        }
      }
      {
        // down
        // if last event is mouse down and this tick

        const last = events.length > 0 ? events[events.length - 1] : null;
        if (last && last.type === "mousedown") {
          ui.down.push(key);
        }
      }
      {
        // hover
        // if last event is mouse enter, over, or up + not clicked

        const last = events.length > 0 ? events[events.length - 1] : null;
        switch (last.type) {
          case "mouseup":
            if (ui.clicked.includes(key)) {
              break;
            }
          case "mouseover":
          case "mouseenter":
            ui.hover.push(key);
            break;

          default:
            break;
        }
      }
      {
        // idle
        // if last event is mouse enter, over, or up + not clicked

        const last = events.length > 0 ? events[events.length - 1] : null;
        if (last) {
          switch (last.type) {
            case "mouseleave":
            case "mouseout":
              ui.idle.push(key);
              break;

            default:
              break;
          }
        } else {
          break;
        }
      }
    }

    return ui;
  }

  getState() {
    return {
      mouse: this.getMouseState(),
      key: this.getKeyState(),
      ui: this.getUiState(),
    };
  }

  register(element) {
    element.inputKey = this.getUnique();
    this.ui.set(element.inputKey, element);
    element.onmousedown = (event) => {
      this.storeEvent({
        type: event.type,
        inputKey: element.inputKey,
      });
    };
    element.onmouseup = (event) => {
      this.storeEvent({
        type: event.type,
        inputKey: element.inputKey,
      });
    };
    element.onmouseenter = (event) => {
      this.storeEvent({
        type: event.type,
        inputKey: element.inputKey,
      });
    };
    element.onmouseleave = (event) => {
      this.storeEvent({
        type: event.type,
        inputKey: element.inputKey,
      });
    };
    element.onmouseout = (event) => {
      this.storeEvent({
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
      if (!element.parentNode) {
        this.ui.delete(k);
      } else if (element.state === "clicked") {
        element.state = "hover";
      }
    });
    this.tick++;
  }
}

export { InputManager };
