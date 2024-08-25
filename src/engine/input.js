import * as THREE from "three";
import { KeyedMap } from "../utils/helper";

const _raycaster = new THREE.Raycaster();
_raycaster.layers.set(1);

export const commandButton = "commandButton";

class InputManager {
  update(scene, camera) {
    const { pos } = this.getState().mouse;
    if (!pos) {
      return;
    }
    _raycaster.setFromCamera(pos, camera);
    const intersects = _raycaster.intersectObjects(scene.children);
    for (let i = 0; i < intersects.length; i++) {
      const intersection = intersects[i];
      this.storeEvent(intersection.object, {
        type: "rayhit",
        distance: intersection.distance,
        point: intersection.point,
        order: i,
      });
    }
  }

  cleanup(scene) {
    scene.traverse((child) => {
      if (this.history.object.has(child)) {
        this.history.object.delete(child);
      }
    });
    this.cleanupContainer(scene.ui.div);
  }

  cleanupContainer(ui) {
    if (this.history.ui.has(ui)) {
      this.history.ui.delete(ui);
    }
    for (let i = 0; i < ui.children.length; i++) {
      this.cleanupContainer(ui.children[i]);
    }
  }

  getEventStore(type) {
    switch (type) {
      case "rayhit":
        return this.history.object;
      case "pointerup":
      case "pointerdown":
      case "pointermove":
        return this.history.mouse;
      case "keydown":
      case "keyup":
        return this.history.key;
      case "mousedown":
      case "mouseup":
      case "mouseleave":
      case "mouseenter":
        return this.history.ui;
      case "blur":
      case "focusout":
        break;
      case "wheel":
        break;
      default:
        break;
    }
    return null;
  }

  storeEvent(key, ev) {
    const store = this.getEventStore(ev.type);
    if (!store) {
      return;
    }
    ev.frame = this.frame;

    if (store instanceof Array) {
      store.push(ev);
    } else {
      if (!store.has(key)) {
        store.set(key, []);
      }
      store.get(key).push(ev);
    }
  }

  constructor(windowManager, time) {
    this.state = {};
    this.frame = 0;
    this.history = {
      mouse: [],
      key: new Map(),
      ui: new Map(),
      object: new Map(),
    };
    this.ui = new KeyedMap();
    this.sizes = { width: 1, height: 1 };
    this.listeners = [];
    window.addEventListener("blur", (event) => {
      this.storeEvent(null, { type: event.type });
    });
    window.addEventListener("focusout", (event) => {
      this.storeEvent(null, { type: event.type });
    });
    window.addEventListener("keydown", (event) => {
      const key = event.key.toLowerCase();
      if (key === "f12") {
        return;
      }
      event.preventDefault();
      this.storeEvent(key, { type: event.type });
    });
    window.addEventListener("keyup", (event) => {
      const key = event.key.toLowerCase();
      event.preventDefault();
      this.storeEvent(key, { type: event.type });
    });

    const handleMouseEvent = (event) => {
      const { sizes } = this;
      if (event.target.className !== "webgl") {
        return;
      }
      const pos = new THREE.Vector2(
        ((event.clientX - sizes.horizontalOffset) / sizes.width) * 2 - 1,
        -((event.clientY - sizes.verticalOffset) / sizes.height) * 2 + 1
      );
      this.storeEvent(null, {
        type: event.type,
        pos: pos,
        buttons: event.buttons,
      });
    };

    const handleScrollEvent = (event) => {
      this.storeEvent(null, {
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
    windowManager.listeners.push(this);
    windowManager.update();
    time.listeners.push(this);
  }

  updateTime({ frame }) {
    this.frame = frame;
  }

  updateSize(sizes) {
    this.sizes = sizes;
  }

  getObjectState() {
    const object = {
      hover: new Map(),
    };

    const keys = this.history.object.keys();

    for (const key of keys) {
      const events = this.history.object.get(key);
      {
        const last = events.length > 0 ? events[events.length - 1] : null;
        if (last && last.frame === this.frame && last.type === "rayhit") {
          object.hover.set(key, last);
        }
      }
    }
    return object;
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
      if (ev.frame !== this.frame) {
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
        if (ev.frame === this.frame) {
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
      if (ev.frame !== this.frame) {
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
        if (ev.frame === this.frame) {
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
    const keyState = {
      pressed: [],
      held: [],
      released: [],
    };
    const keys = this.history.key.keys();

    for (const key of keys) {
      const events = this.history.key.get(key);
      {
        // released
        const last = events.length > 0 ? events[events.length - 1] : null;
        const secondLast = events.length > 1 ? events[events.length - 2] : null;
        if (
          last &&
          secondLast &&
          last.frame === this.frame &&
          last.type === "keyup" &&
          secondLast.type === "keydown"
        ) {
          keyState.released.push(key);
        }
      }
      {
        // pressed
        const last = events.length > 0 ? events[events.length - 1] : null;
        if (last && last.type === "keydown") {
          if (last.frame === this.frame) {
            keyState.pressed.push(key);
          } else {
            keyState.held.push(key);
          }
        }
      }
    }

    return keyState;
  }

  getUiState() {
    const ui = {
      idle: [],
      down: [],
      clicked: [],
      hover: [],
      commands: [],
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
          last.frame === this.frame &&
          last.type === "mouseup" &&
          secondLast.type === "mousedown"
        ) {
          ui.clicked.push(key);
          if (key.classList.contains(commandButton)) {
            ui.commands.push(this.ui.get(key).command);
          }
        }
      }
      {
        // down
        // if last event is mouse down and this frame

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
      object: this.getObjectState(),
    };
  }

  register(element) {
    this.ui.set(element, element);
    element.onmousedown = (event) => {
      this.storeEvent(element, {
        type: event.type,
      });
    };
    element.onmouseup = (event) => {
      this.storeEvent(element, {
        type: event.type,
      });
    };
    element.onmouseenter = (event) => {
      this.storeEvent(element, {
        type: event.type,
      });
    };
    element.onmouseleave = (event) => {
      this.storeEvent(element, {
        type: event.type,
      });
    };
    element.onmouseout = (event) => {
      this.storeEvent(element, {
        type: event.type,
      });
    };
  }

  endLoop() {
    const elements = document.getElementsByTagName("*");
    for (let i = 0; i < elements.length; i++) {
      const element = elements[i];
      if (window.getComputedStyle(element, null).pointerEvents !== "auto") {
        continue;
      }
      if (element.isCustom !== true) {
        continue;
      }
      if (this.ui.has(element)) {
        continue;
      }
      this.register(element);
    }
  }
}

export { InputManager };
