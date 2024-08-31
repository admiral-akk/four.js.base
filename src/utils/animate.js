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
  constructor(name, delay = 0, speed = 1) {
    this.name = name;
    this.delay = delay;
    this.speed = speed;
  }

  addAnimation(element) {
    // remove existing animations

    clearAnimations(element);

    const animationName = `${animationPrefix}${this.name}`;
    element.classList.add(`${animationPrefix}animated`, animationName);
    element.style["animation-delay"] = `${this.delay}s`;
    element.style["animation-duration"] = `${this.speed}s`;
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
      if (event) {
        event.stopPropagation();
      }

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
      if (animation) {
        animation.addAnimation(node);
        node.addEventListener(
          "animationend",
          (ev) => handleAnimationEnd(node, ev),
          { once: true }
        );
      } else {
        handleAnimationEnd(node, null);
      }
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
