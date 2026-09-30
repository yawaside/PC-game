// Музыкальный движок (заглушка, заменяется процедурной музыкой).
export class Music {
  constructor(audio) {
    this.audio = audio;
    this.track = null;
    this.intensity = 0;
  }
  play(track) { this.track = track; }
  stop() { this.track = null; }
  setIntensity(v) { this.intensity = v; }
  update() {}
}
