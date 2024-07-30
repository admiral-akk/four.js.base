import { AudioLoader, AudioListener, Audio } from "three";

export class AudioManager extends AudioListener {
  constructor(loadingManager) {
    super();
    this.audioLoader = new AudioLoader(loadingManager);
    this.buffers = new Map();
    this.audioPool = [];
    this.playingCount = new Map();
  }

  play(path) {
    const sound = this.buffers.get(path)?.value;
    console.log(path);
    if (!sound) {
      this.load(path);
      return;
    }
    if (!this.playingCount.get(path)) {
      this.playingCount.set(path, []);
    }
    const currentlyPlaying = this.playingCount.get(path);
    for (let i = currentlyPlaying.length - 1; i >= 0; i--) {
      const audio = currentlyPlaying[i];
      console.log(audio);
      if (!audio.isPlaying) {
        currentlyPlaying.splice(i, 1);
      }
    }

    for (let i = 0; i < currentlyPlaying.length - 1; i++) {
      currentlyPlaying[i].stop();
    }
    currentlyPlaying.splice(0, currentlyPlaying.length - 3);
    const audio = new Audio(this);
    audio.setBuffer(sound);
    audio.setLoop(false);
    audio.play();
    currentlyPlaying.push(audio);
    return audio;
  }

  load({path, min}) {
    if (this.buffers.get(path)) {
      return;
    }
    console.log(path);
    const reference = this.buffers.set(path);
    this.audioLoader.load(path, (buffer) => {
      reference.value = buffer;
    });
    this.buffers.set(path, reference);
  }
}
