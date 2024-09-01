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

class Params {
  constructor(params) {
    for (const key in params) {
      this[key] = params[key];
    }
  }
}

// Controls the position / size of the UI element.
export class PositionParams extends Params {}

export class RelativePosition extends PositionParams {}

export class ImagePosition extends PositionParams {
  constructor(
    params = { width: 1, aspectRatio: 1, centerX: 0.5, centerY: 0.5 }
  ) {
    super(params);
  }

  setPosition(style) {
    style.width = `${this.width * 100}%`;
    style.height = `${this.height * 100}%`;
    style.position = "absolute";
    //style["aspect-ratio"] = this.aspectRatio;
    // offset by half to center it.
    style.right = `${this.centerX * 100 - this.width * 50}%`;
    style.top = `${this.centerY * 100 - this.height * 50}%`;
  }
}

class SizeParams extends Params {
  setSize(style) {
    style.width = `${this.width * 100}%`;
  }
}

export class RelativeSize extends SizeParams {
  constructor(params = { width: 1, height: 1 }) {
    super(params);
  }

  setSize(style) {
    super.setSize(style);
    style.height = `${this.height * 100}%`;
  }

  getSize() {
    // hard coded aspect ratio, fix later.
    return [this.width, this.height];
  }
}

export class AspectSize extends SizeParams {
  constructor(params = { width: 1, aspectRatio: 1 }) {
    super(params);
  }

  setSize(style) {
    super.setSize(style);
    style["aspect-ratio"] = `${this.aspectRatio}`;
  }

  getSize() {
    // hard coded aspect ratio, fix later.
    return [this.width, ((16 / 9) * this.width) / this.aspectRatio];
  }
}

export class AbsolutePosition extends PositionParams {
  constructor(params = { width: 1, height: 1, centerX: 0.5, centerY: 0.5 }) {
    super(params);
  }

  setPosition(style, size) {
    const [width, height] = size.getSize();
    style.position = "absolute";
    // offset by half to center it.
    style.right = `${this.centerX * 100 - width * 50}%`;
    style.top = `${this.centerY * 100 - height * 50}%`;
  }
}

class UIParams extends Params {
  construct(parent) {
    const { position = new AbsolutePosition(), size = new RelativeSize() } =
      this;

    const div = document.createElement("div");
    parent.appendChild(div);
    div.isCustom = true;
    // special case
    if (this.id) {
      div.id = this.id;
    }
    if (this.class) {
      div.className = this.class;
    }
    if (this.style) {
      for (const key in this.style) {
        div.style[key] = this.style[key];
      }
    }
    size.setSize(div.style);
    position.setPosition(div.style, size);
    return div;
  }
}

export class UIContainerParams extends UIParams {
  construct(parent) {
    const div = super.construct(parent);
    const { intro = null, outro = null } = this;
    div.classList.add("root-level-ui");
    div.intro = intro;
    div.outro = outro;
    animateCSSKey([div], "intro");
    return div;
  }
}

export class UIImageParams extends UIParams {
  construct(parent) {
    const div = super.construct(parent);
    const { imageName } = this;
    div.classList.add("default-image");
    div.style["background-image"] = `url(./icons/${imageName}.png)`;

    return div;
  }
}

export class UIButtonParams extends UIParams {
  construct(parent) {
    const div = super.construct(parent);

    const { command } = this;
    div.classList.add("targetable");
    div.classList.add(commandButton);
    div.command = command;

    return div;
  }
}

export class UITextBoxParams extends UIParams {
  construct(parent) {
    const {
      containerClass = "default-text-box-container",
      textClass = "default-text-box",
      text,
      textSize = "m",
    } = this;

    const div = super.construct(parent);
    div.classList.add(containerClass);
    div.classList.add("text-box-container");

    const textDiv = super.construct(div);
    textDiv.classList.add(textClass);
    textDiv.classList.add("text-box");
    textDiv.classList.add(`f-${textSize}`);
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
