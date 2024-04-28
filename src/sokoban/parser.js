class SokobanParser {
  constructor(rawText) {
    this.state = "TOP";
    this.levels = [];

    this.parse(rawText.split("\n").reverse());
  }

  parse(linesReversed) {
    if (linesReversed.length === 0) {
      return;
    }

    switch (this.state) {
      case "TOP":
        const line = linesReversed.pop();
        const s = line.split(":");
        if (s.length < 2) {
          this.state = "LEVELS";
          break;
        }
        this[s[0]] = s[1];
        break;
      case "LEVELS":
        this.levels.push(new SokobanLevelParser(linesReversed));
        break;
      default:
        throw new Error("Unknown state");
    }
    this.parse(linesReversed);
  }
}

class SokobanLevelParser {
  constructor(linesReversed) {
    this.level = [];
    this.state = "START";
    this.parse(linesReversed);
  }

  parse(linesReversed) {
    if (linesReversed.length === 0) {
      return;
    }

    const line = linesReversed.pop();

    switch (this.state) {
      case "START":
        if (line.includes("#")) {
          this.state = "LEVEL";
          linesReversed.push(line);
        }
        break;
      case "LEVEL":
        if (line.includes("#")) {
          this.level.push(line);
        } else {
          this.state = "METADATA";
          linesReversed.push(line);
        }
        break;
      case "METADATA":
        const s = line.split(":");
        if (s.length < 2) {
          return;
        }
        this[s[0]] = s[1];
        break;
      default:
        throw new Error("Unknown state");
    }
    this.parse(linesReversed);
  }
}

export { SokobanParser };
