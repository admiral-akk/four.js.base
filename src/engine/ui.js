import { animateCSS } from "../utils/animate.js";

import { commandButton } from "./input.js";
export class UIManager {
  constructor() {
    this.root = document.querySelector("div.uiContainer");
    this.instances = [];
  }

  pushInstance() {
    const instance = new UIInstance(this.instances.length + 1);
    this.instances.push(instance);
    this.root.appendChild(instance.div);
    return instance;
  }

  dropInstance() {
    const instance = this.instances.pop();
    if (instance) {
      this.root.removeChild(instance.div);
    }
  }
}

function addAlignment(style, alignment) {
  if ("height" in alignment) {
    style.height = `${alignment.height * 100}%`;
  }
  if ("width" in alignment) {
    style.width = `${alignment.width * 100}%`;
  }
  if (style.position === "absolute") {
    if ("rightOffset" in alignment) {
      style.right = `${100 * alignment.rightOffset}%`;
    } else {
      style.right = `${50 * (1 - alignment.width)}%`;
    }
    if ("topOffset" in alignment) {
      style.top = `${100 * alignment.topOffset}%`;
    } else {
      style.top = `${50 * (1 - alignment.height)}%`;
    }
  }
}

export class UIInstance {
  constructor(zIndex) {
    this.div = document.createElement("div");
    this.div.className = "ui";
    this.div.style.zIndex = `${zIndex}`;
  }

  createElement({
    type = "div",
    id = null,
    alignment = {},
    style = {},
    command = null,
    parent = this.div,
    intro = null,
    classNames = "",
    text = "",
    data = null,
    children = [],
  }) {
    const element = document.createElement(type);
    if (classNames instanceof Array) {
      classNames = classNames.join(" ");
    }
    element.className = classNames;
    if (command) {
      element.command = command;
      element.classList.add(commandButton);
    }
    if (parent === this.div) {
      element.style.position = "absolute";
    }
    for (const [key, value] of Object.entries(style)) {
      element.style[key] = value;
    }
    addAlignment(element.style, alignment);
    element.isCustom = true;
    if (data) {
      element.data = data;
    }
    if (id) {
      element.id = id;
    }
    element.innerText = text;

    if (typeof parent === "string" || parent instanceof String) {
      parent = document.getElementById(parent);
    }
    parent.appendChild(element);
    children.map((c) => {
      let child = c;
      if (typeof c === "string" || c instanceof String) {
        child = {
          className: "f-s",
          text: c,
          parent: element,
        };
      } else {
        child.parent = element;
      }
      element.appendChild(this.createElement(child));
    });
    if (intro) {
      animateCSS(element, intro);
    }
    return element;
  }
}
