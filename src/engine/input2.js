import { KeyedMap } from "../utils/helper";

class InputManager2 {
  fetchUpdates() {
    const events = this.events;
    this.events = [];
    return events;
  }

  getState() {
    return this.state;
  }

  storeEvent(ev) {
    ev.frame = this.frame;
    switch (ev.type) {
      case "blur":
      case "focusout":
        this.state = {};
        break;
      case "keyup":
        delete this.state[ev.key];
        break;
      case "keydown":
        if (!this.state[ev.key]) {
          this.state[ev.key] = { frame: this.frame };
        }
        break;
      case "pointerup":
      case "pointermove":
      case "pointerdown":
        this.state.mouse = { pos: ev.pos, buttons: ev.buttons };
        break;
      case "wheel":
        if (!this.state.wheel) {
          this.state.wheel = { y: 0 };
        }
        this.state.wheel.y += ev.deltaYl;
        break;
      default:
        break;
    }
  }

  constructor(windowManager, time) {
    this.state = {};
    this.frame = 0;
    this.events = [];
    this.sizes = { width: 1, height: 1 };
    this.listeners = [];
    window.addEventListener("blur", (event) => {
      this.storeEvent({ type: event.type });
    });
    window.addEventListener("focusout", (event) => {
      this.storeEvent({ type: event.type });
    });
    window.addEventListener("keydown", (event) => {
      const key = event.key.toLowerCase();
      if (key === "f12") {
        return;
      }
      event.preventDefault();
      this.storeEvent({ key, type: event.type });
    });
    window.addEventListener("keyup", (event) => {
      const key = event.key.toLowerCase();
      event.preventDefault();
      this.storeEvent({ key, type: event.type });
    });

    const handleMouseEvent = (event) => {
      const { sizes } = this;
      if (event.target.className !== "webgl") {
        return;
      }
      const pos = [
        ((event.clientX - sizes.horizontalOffset) / sizes.width) * 2 - 1,
        -((event.clientY - sizes.verticalOffset) / sizes.height) * 2 + 1,
      ];
      this.storeEvent({
        type: event.type,
        pos: pos,
        buttons: event.buttons,
      });
    };

    const handleScrollEvent = (event) => {
      this.storeEvent({
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
}

export { InputManager2 };
