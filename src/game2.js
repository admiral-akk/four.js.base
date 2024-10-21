import { State, StateMachine } from "./utils/stateMachine";
import { Vec, LineSegment } from "./utils/vector";

// Input State Machine

function getRandomInt({ min = 0, max, steps = 2 }) {
  return (Math.floor(steps * Math.random()) / (steps - 1)) * (max - min) + min;
}

class Command {
  constructor() {
    this.type = Object.getPrototypeOf(this).constructor;
  }
}

class MoveCommand extends Command {
  constructor(playerIndex, direction) {
    super();
    this.playerIndex = playerIndex;
    this.direction = direction;
  }
}

class TickCommand extends Command {
  constructor(delta) {
    super();
    this.delta = delta;
  }
}

class OpenInputState extends State {
  update(game, inputStateMachine, inputState) {
    const leftDir =
      (inputState["w"] !== undefined) - +(inputState["s"] !== undefined);

    const rightDir =
      (inputState["arrowup"] !== undefined) -
      +(inputState["arrowdown"] !== undefined);
    game.commands.push(new MoveCommand(0, leftDir));
    game.commands.push(new MoveCommand(1, rightDir));
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
    this.data.state.balls = this.setupBalls();
    this.data.state.ball = {
      position: new Vec(0, 0),
      color: new Vec(1, 1, 1, 1),
      size: 0.1,
      velocity: new Vec(0.8, 0.4),
    };
    this.data.state.paddles = [
      {
        position: new Vec(-0.9, 0),
        size: new Vec(0.02, 0.2),
        color: new Vec(1, 0, 0, 1),
        direction: 0,
      },
      {
        position: new Vec(0.9, 0),
        size: new Vec(0.02, 0.2),
        color: new Vec(0, 1, 0, 1),
        direction: 0,
      },
    ];
    this.data.saveData();
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
      case MoveCommand:
        {
          this.data.state.paddles[command.playerIndex].direction =
            command.direction;
        }
        break;
      case TickCommand:
        const { delta } = command;
        const { ball, balls, paddles } = this.data.state;
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

          for (let i = 0; i < paddles.length; i++) {
            const p = paddles[i];
            p.position[1] += delta * p.direction * 0.02;
            p.position[1] = Math.min(
              Math.max(p.position[1], -1 + p.size[1]),
              1 - p.size[1]
            );
          }

          // check intersections

          for (let i = 0; i < paddles.length; i++) {
            const p = paddles[i];
            const size = new Vec(p.size);
            const top = new Vec(p.position).add(p.size);
            const bot = new Vec(p.position).sub(p.size);
            const lineSegments = [
              new LineSegment(
                top.clone(),
                top.clone().sub(size.clone().mul(Vec.X2).mul(2))
              ),
              new LineSegment(
                top.clone(),
                top.clone().sub(size.clone().mul(Vec.Y2).mul(2))
              ),
              new LineSegment(
                bot.clone(),
                bot.clone().add(size.clone().mul(Vec.X2).mul(2))
              ),
              new LineSegment(
                bot.clone(),
                bot.clone().add(size.clone().mul(Vec.Y2).mul(2))
              ),
            ];

            for (let i = 0; i < lineSegments.length; i++) {
              const l = lineSegments[i];
              const dist = l.distanceTo(ball.position);
              if (dist < ball.size) {
                ball.color = p.color;
              }
            }

            p.position[1] += delta * p.direction * 0.02;
            p.position[1] = Math.min(
              Math.max(p.position[1], -1 + p.size[1]),
              1 - p.size[1]
            );
          }
          this.data.saveData();
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
