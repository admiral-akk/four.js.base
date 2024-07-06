export class UiController {
  constructor() {
    const ui = document.querySelector("div.ui");
    var div = document.createElement("div");
    // https://css-tricks.com/fitting-text-to-a-container/
    div.style.position = "absolute";
    div.style.fontSize = "2cqi";
    div.style.top = "3%";
    div.style.right = "3%";
    div.style.height = "10%";
    div.style.width = "10%";
    div.style.background = "red";
    div.style.container = "ui";
    div.innerHTML = "Hello world";
    const tutorial = document.createElement("div");
    tutorial.style.position = "absolute";
    tutorial.style.top = "90%";
    tutorial.style.bottom = "3%";
    tutorial.style.right = "20%";
    tutorial.style.left = "20%";
    tutorial.style.background = "red";
    tutorial.style.alignContent = "center";
    const tutorialText = document.createElement("div");
    tutorialText.innerHTML = "Tutorial message";
    tutorialText.style.textAlign = "center";
    tutorialText.style.fontSize = "2cqi";
    tutorialText.style.container = "ui";
    this.div = div;
    this.tutorial = tutorial;
    this.tutorialText = tutorialText;
    tutorial.appendChild(tutorialText);
    ui.appendChild(div);
    this.ui = ui;
  }

  setTutorialMessage(message) {
    const { ui, tutorial, tutorialText } = this;
    if (!message) {
      if (tutorial.parentElement === ui) {
        ui.removeChild(tutorial);
      }
    } else {
      ui.appendChild(tutorial);
      tutorialText.innerHTML = message;
    }
  }

  updateStats({ hitTargets, totalTargets }) {
    this.div.innerHTML = `${hitTargets} / $d{totalTargets}`;
  }
}
