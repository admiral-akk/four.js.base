const animationPrefix = "animate__";
const configurationPrefix = "--animiate-";

const durationStyle = `${configurationPrefix}duration`;
const delayStyle = `${configurationPrefix}delay`;

function clearAnimations(element) {
  Array.from(element.classList)
    .filter((c) => c.includes(animationPrefix))
    .forEach((p) => element.classList.remove(p));
  element.style.removeProperty(durationStyle);
  element.style.removeProperty(delayStyle);
}

export class AnimationCSS {
  constructor(name, delay = 0, speed = null) {
    this.name = name;
    this.delay = delay;
    this.speed = speed;
  }

  addAnimation(element) {
    // remove existing animations

    clearAnimations(element);

    const animationName = `${animationPrefix}${this.name}`;
    element.classList.add(`${animationPrefix}animated`, animationName);

    switch (this.delay) {
      case 1:
      case 2:
      case 3:
      case 4:
      case 5:
        element.classList.add(`${animationPrefix}delay-${this.delay}`);
        break;
      default:
        break;
    }

    switch (this.speed) {
      case "slow":
      case "slower":
      case "fast":
      case "faster":
        element.classList.add(`${animationPrefix}${this.speed}`);
        break;
      default:
        break;
    }
  }
}

export const animateCSSKey = (elements, key) => {
  // We create a Promise and return it
  return new Promise((resolve, reject) => {
    let nodes = [];
    if (typeof elements === "string" || elements instanceof String) {
      nodes = document.querySelectorAll(elements);
    } else {
      nodes = elements;
    }

    let remaining = nodes.length;

    function handleAnimationEnd(node, event) {
      event.stopPropagation();
      clearAnimations(node);
      if (remaining === 1) {
        // When the animation ends, we clean the classes and return the nodes
        resolve(nodes);
      } else {
        remaining--;
      }
    }

    nodes.forEach((node) => {
      const animation = node[key];
      animation.addAnimation(node);
      node.addEventListener(
        "animationend",
        (ev) => handleAnimationEnd(node, ev),
        { once: true }
      );
    });
  });
};

export const animateCSS = (elements, animation) =>
  // We create a Promise and return it
  new Promise((resolve, reject) => {
    let nodes = [];
    if (typeof elements === "string" || elements instanceof String) {
      nodes = document.querySelectorAll(elements);
    } else {
      nodes = elements;
    }

    let remaining = nodes.length;

    function handleAnimationEnd(node, event) {
      event.stopPropagation();
      clearAnimations(node);
      if (remaining === 1) {
        // When the animation ends, we clean the classes and return the nodes
        resolve(nodes);
      } else {
        remaining--;
      }
    }

    nodes.forEach((node) => {
      animation.addAnimation(node);
      node.addEventListener(
        "animationend",
        (ev) => handleAnimationEnd(node, ev),
        { once: true }
      );
    });
  });
