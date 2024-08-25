import { animateCSS, animateCSSKey } from "../utils/animate.js";

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

class UIParams {
  constructor(params) {
    for (const key in params) {
      this[key] = params[key];
    }
  }
}

export class UIContainerParams extends UIParams {
  construct(parent) {
    const {
      center = [0.5, 0.5],
      size = [1, 1],
      intro = null,
      outro = null,
    } = this;
    const div = document.createElement("div");
    div.className = "root-level-ui";
    div.isCustom = true;
    div.style.width = `${size[0] * 100}%`;
    div.style.height = `${size[1] * 100}%`;
    // offset by half to center it.
    div.style.right = `${center[0] * 100 - size[0] * 50}%`;
    div.style.top = `${center[1] * 100 - size[1] * 50}%`;
    parent.appendChild(div);

    div.intro = intro;
    div.outro = outro;
    animateCSSKey([div], "intro");
    return div;
  }
}

export class UIButtonParams extends UIParams {
  construct(parent) {
    const { command } = this;
    const div = document.createElement("div");
    div.isCustom = true;
    div.className = `targetable ${commandButton}`;
    div.command = command;
    parent.appendChild(div);
    return div;
  }
}

export class UITextBox extends UIParams {
  construct(parent) {
    const {
      containerClass = "default-text-box-container",
      textClass = "default-text-box",
      text,
      size = "m",
    } = this;
    const div = document.createElement("div");
    const textDiv = document.createElement("div");
    div.appendChild(textDiv);
    div.isCustom = true;
    textDiv.isCustom = true;
    parent.appendChild(div);
    div.className = `${containerClass} text-box-container`;
    textDiv.className = `${textClass} text-box f-${size}`;
    textDiv.innerText = text;

    return div;
  }
}

export class UIInstance {
  constructor(zIndex) {
    this.div = document.createElement("div");
    this.div.className = "ui";
    this.div.style.zIndex = `${zIndex}`;
  }

  exitAll() {
    return animateCSSKey(Array.from(this.div.children), "outro");
  }

  // All elements can have an intro and outtro animation
  exit(element) {
    return animateCSSKey(element, "outro");
  }

  compose(uiOperations, parent = this.div) {
    for (let op of uiOperations) {
      parent = op.construct(parent);
    }
    return parent;
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
      animateCSS([element], intro);
    }
    return element;
  }
}
