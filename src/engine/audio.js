import { AudioLoader, AudioListener, Audio } from "three";

export class RegisteredAudio extends Audio {
  constructor(listener) {
    super(listener);
    this.manager = listener;
  }

  onEnded() {
    super.onEnded();
    this.manager.clearFinished(this);
  }
}

export class AudioManager extends AudioListener {
  constructor(loadingManager) {
    super();
    this.audioLoader = new AudioLoader(loadingManager);
    this.buffers = new Map();
    this.currentlyPlaying = [];
    this.lastPlayed = new Map();
    this.lastDetune = new Map();
  }

  clearFinished(audio) {
    const index = this.currentlyPlaying.findIndex((a) => a === audio);
    if (index >= 0) {
      this.currentlyPlaying.splice(index, 1);
    }
  }

  play({ path }) {
    const reference = this.buffers.get(path);
    if (!reference.value) {
      return;
    }

    const { value, max, minInterval } = reference;
    const time = Date.now();
    const lastPlayed = this.lastPlayed.get(path);

    const currentlyPlayingCount = this.currentlyPlaying.filter(
      (a) => a.buffer === value
    ).length;

    if (currentlyPlayingCount >= max) {
      return;
    }

    if (lastPlayed && time - lastPlayed < minInterval) {
      return;
    }

    let lastDetune = this.lastDetune.get(path) ?? 0;

    const detunes = [-100, -50, 0, 50, 100];
    detunes.splice(
      detunes.findIndex((i) => i === lastDetune),
      1
    );
    const detune = detunes[Math.floor(Math.random() * 4)];
    this.lastDetune.set(path, detune);

    this.lastPlayed.set(path, time);
    const audio = new RegisteredAudio(this);
    audio.setBuffer(value);
    audio.detune = detune;
    audio.setLoop(false);
    audio.play();
    audio.onEnded();
    return audio;
  }

  load({ path, max = 2, minInterval = 100 }) {
    console.log(path);
    if (this.buffers.get(path)) {
      return;
    }
    const reference = { max, minInterval };
    this.audioLoader.load(path, (buffer) => {
      reference.value = buffer;
    });
    this.buffers.set(path, reference);
  }
}
