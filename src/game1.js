import { State, StateMachine } from "./utils/stateMachine";

// Input State Machine

function getRandomInt({ min = 0, max, steps = 2 }) {
  return (Math.floor(steps * Math.random()) / (steps - 1)) * (max - min) + min;
}
class Command {
  constructor() {
    this.type = Object.getPrototypeOf(this).constructor;
  }
}

class ClearCommand extends Command {}
class TickCommand extends Command {
  constructor(delta) {
    super();
    this.delta = delta;
  }
}

class DragCommand extends Command {
  constructor(curr) {
    super();
    this.curr = curr;
  }
}

class StartDragCommand extends Command {
  constructor(start) {
    super();
    this.start = start;
  }
}

class UpdateColorCommand extends Command {
  constructor(color) {
    super();
    this.color = color;
  }
}
class LineCommand extends Command {
  constructor(start, end) {
    super();
    this.start = start;
    this.end = end;
  }
}

class DragInputState extends State {
  constructor(start) {
    super();
    this.start = start;
    this.curr = start;
  }

  update(game, inputStateMachine, inputState) {
    const { mouse } = inputState;
    if (!mouse) {
      return;
    }
    const { pos, buttons } = mouse;
    if (!buttons) {
      if (!this.start.equals(pos)) {
        game.commands.push(new LineCommand(this.start, pos));
      }
      inputStateMachine.replaceState(new OpenInputState());
    } else if (!this.start.equals(pos)) {
      this.curr = pos;
      game.commands.push(new DragCommand(this.curr));
    }
  }
}

class OpenInputState extends State {
  update(game, inputStateMachine, inputState) {
    const { mouse } = inputState;
    if (!mouse) {
      return;
    }
    const { pos, buttons } = mouse;
    if (pos && buttons) {
      game.commands.push(new StartDragCommand(pos));
      inputStateMachine.replaceState(new DragInputState(pos));
    }
  }
}

class InputManager extends StateMachine {
  constructor() {
    super();
    this.pushState(new OpenInputState());
  }

  init() {}

  update(game, inputState) {
    this.currentState()?.update(game, this, inputState);
  }
}

const inputState = new InputManager();

// Game

const clipToScreenSpace = ([x, y]) => [(x + 1) / 2, (y + 1) / 2];

class MyGame {
  constructor(data) {
    this.commands = [];
    this.data = data;
    data.listeners.push(this);
    if (this.data.state.ball) {
      this.data.state.ball.size = 0.1;
    }
    if (!Array.isArray(this.data.state.lines)) {
      this.data.state.lines = [];
      this.data.state.balls = this.setupBalls();
      this.data.state.ball = {
        position: [0, 0],
        color: [1, 1, 1, 1],
        size: 0.1,
        velocity: [0.8, 0.4],
      };
      this.data.state.paddles = [
        { position: [-0.9, 0], size: [0.02, 0.2], color: [1, 0, 0, 1] },
        { position: [0.9, 0], size: [0.02, 0.2], color: [0, 1, 0, 1] },
      ];
      this.data.saveData();
    }
    this.activeColor = [1, 1, 1, 1];
    this.currLine = { start: [0, 0], end: [0, 0], color: this.activeColor };
  }

  setupBalls() {
    const balls = [];
    for (var i = 0; i < 200; i++) {
      balls.push({
        position: [
          getRandomInt({ max: 0.2, min: -0.2, steps: 40 }),
          getRandomInt({ max: 0.9, min: -0.9, steps: 100 }),
        ],
        color: [0, 0, 0, 1],
        size: getRandomInt({ max: 0.02, min: 0.01, steps: 5 }),
      });
    }
    return balls;
  }

  startLine(pos) {
    this.currLine = { start: pos, end: pos, color: this.activeColor };
  }

  updateLine(pos) {
    this.currLine.end = pos;
  }

  endLine(pos) {
    this.currLine.end = pos;
    this.data.state.lines.push(this.currLine);
    this.currLine = { start: [0, 0], end: [0, 0], color: this.activeColor };
    this.data.saveData();
  }

  configUpdated() {
    if (!this.data.state.lines) {
      this.data.state.lines = [];
    }
  }

  updateColor(color) {
    this.activeColor = structuredClone(color);
    this.activeColor.push(1);
    this.currLine.color = this.activeColor;
  }

  moveBall(delta) {
    const { ball } = this.data.state;
    ball.position[0] += delta * ball.velocity[0];
    ball.position[1] += delta * ball.velocity[1];

    if (Math.abs(ball.position[0]) + ball.size >= 1) {
      ball.velocity[0] *= -1;
    }
    if (Math.abs(ball.position[1]) + ball.size >= 1) {
      ball.velocity[1] *= -1;
    }
  }

  applyCommand(command) {
    switch (command.type) {
      case TickCommand:
        const { delta } = command;
        const { ball, balls } = this.data.state;
        this.moveBall(delta);
        for (let i = 0; i < balls.length; i++) {
          const other = balls[i];
          other.color[0] = Math.max(0, other.color[0] - 0.4 * delta);
          other.color[1] = Math.max(0, other.color[1] - 0.4 * delta);
          other.color[2] = Math.max(0, other.color[2] - 0.4 * delta);
          const diff = [
            other.position[0] - ball.position[0],
            other.position[1] - ball.position[1],
          ];
          const dist = Math.sqrt(diff[0] * diff[0] + diff[1] * diff[1]);
          if (dist < 0.2) {
            other.color[0] = ball.color[0];
            other.color[1] = ball.color[1];
            other.color[2] = ball.color[2];
          }
          this.data.saveData();
        }
        break;
      case ClearCommand:
        this.clearLines();
        break;
      case UpdateColorCommand:
        this.updateColor(command.color);
        break;
      case StartDragCommand:
        {
          {
            this.data.state.isDragging = true;
            this.startLine(clipToScreenSpace(command.start));
          }
        }
        break;
      case DragCommand:
        {
          this.data.state.isDragging = true;
          this.updateLine(clipToScreenSpace(command.curr));
        }
        break;
      case LineCommand:
        {
          this.data.state.isDragging = false;
          this.endLine(clipToScreenSpace(command.end));
        }
        break;
      default:
        break;
    }
  }

  update() {
    this.commands.push(new TickCommand(0.04));
    this.commands.forEach((command) => {
      this.applyCommand(command);
    });
    this.commands.length = 0;
  }
}

export { InputManager, MyGame };
