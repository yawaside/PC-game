// Синтезатор звуковых эффектов на WebAudio. Все звуки рождаются из осцилляторов и шума —
// поэтому в репозитории нет ни одного аудиофайла.
export class AudioEngine {
  constructor(settings) {
    this.settings = settings;
    this.ctx = null;
    this.master = null;
    this.sfxBus = null;
    this.musicBus = null;
    this.noiseBuf = null;
    this.muted = false;
    this.lastPlayed = new Map();
  }

  /** Создаём контекст только после действия пользователя (политика автозапуска). */
  unlock() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    try {
      this.ctx = new AC({ latencyHint: 'interactive' });
    } catch {
      return;
    }
    const c = this.ctx;
    this.master = c.createGain();
    const comp = c.createDynamicsCompressor();
    comp.threshold.value = -14;
    comp.knee.value = 18;
    comp.ratio.value = 6;
    comp.attack.value = 0.004;
    comp.release.value = 0.2;
    this.master.connect(comp).connect(c.destination);
    this.sfxBus = c.createGain();
    this.musicBus = c.createGain();
    this.sfxBus.connect(this.master);
    this.musicBus.connect(this.master);
    // белый шум на 2 секунды
    const len = c.sampleRate * 2;
    this.noiseBuf = c.createBuffer(1, len, c.sampleRate);
    const d = this.noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    this.applyVolumes();
  }

  applyVolumes() {
    if (!this.ctx) return;
    const s = this.settings;
    const t = this.ctx.currentTime;
    this.master.gain.setTargetAtTime(this.muted ? 0 : s.master, t, 0.05);
    this.sfxBus.gain.setTargetAtTime(s.sfx, t, 0.05);
    this.musicBus.gain.setTargetAtTime(s.music * 0.6, t, 0.05);
  }

  toggleMute() {
    this.muted = !this.muted;
    this.applyVolumes();
    return this.muted;
  }

  get now() {
    return this.ctx ? this.ctx.currentTime : 0;
  }

  // --- примитивы ---
  tone(type, f0, f1, dur, vol = 0.2, o = {}) {
    const c = this.ctx;
    const t0 = this.now + (o.delay || 0);
    const osc = c.createOscillator();
    const g = c.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(Math.max(20, f0), t0);
    if (f1 !== f0) osc.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t0 + dur);
    if (o.detune) osc.detune.value = o.detune;
    const a = o.attack ?? 0.005;
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.linearRampToValueAtTime(vol, t0 + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    let node = osc;
    if (o.lp) {
      const f = c.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.value = o.lp;
      osc.connect(f);
      node = f;
    }
    node.connect(g).connect(o.bus || this.sfxBus);
    osc.start(t0);
    osc.stop(t0 + dur + 0.05);
  }

  noise(dur, vol = 0.2, o = {}) {
    const c = this.ctx;
    const t0 = this.now + (o.delay || 0);
    const src = c.createBufferSource();
    src.buffer = this.noiseBuf;
    src.loop = true;
    const f = c.createBiquadFilter();
    f.type = o.type || 'lowpass';
    f.frequency.setValueAtTime(o.f0 ?? 1200, t0);
    if (o.f1) f.frequency.exponentialRampToValueAtTime(Math.max(20, o.f1), t0 + dur);
    f.Q.value = o.q ?? 0.8;
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.linearRampToValueAtTime(vol, t0 + (o.attack ?? 0.004));
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(f).connect(g).connect(o.bus || this.sfxBus);
    src.start(t0, Math.random());
    src.stop(t0 + dur + 0.05);
  }

  /** Проиграть эффект по имени. Повторы одного звука чаще 30 мс глушатся. */
  sfx(name, arg) {
    if (!this.ctx || this.muted) return;
    const now = performance.now();
    if (now - (this.lastPlayed.get(name) || 0) < 30) return;
    this.lastPlayed.set(name, now);
    const fn = SFX[name];
    if (!fn) return;
    try {
      fn(this, arg);
    } catch (e) {
      console.warn('sfx error', name, e);
    }
  }
}

const N = (m) => 440 * Math.pow(2, (m - 69) / 12);

const SFX = {
  ui: (a) => a.tone('square', 740, 900, 0.05, 0.1),
  select: (a) => { a.tone('square', 520, 520, 0.06, 0.1); a.tone('square', 780, 780, 0.08, 0.1, { delay: 0.05 }); },
  back: (a) => a.tone('square', 500, 300, 0.09, 0.1),
  error: (a) => { a.tone('square', 170, 140, 0.16, 0.16); a.tone('square', 130, 110, 0.16, 0.14, { delay: 0.09 }); },
  blip: (a, p = 1) => a.tone('square', 300 * p, 300 * p, 0.035, 0.07),
  step: (a) => { a.noise(0.06, 0.05, { f0: 500, f1: 200 }); a.tone('sine', 90, 60, 0.05, 0.05); },
  jump: (a) => a.tone('square', 260, 560, 0.13, 0.1),
  djump: (a) => { a.tone('square', 420, 900, 0.14, 0.1); a.tone('triangle', 800, 1500, 0.16, 0.08, { delay: 0.03 }); },
  land: (a) => { a.noise(0.12, 0.12, { f0: 700, f1: 160 }); a.tone('sine', 110, 50, 0.1, 0.12); },
  dash: (a) => { a.noise(0.2, 0.16, { type: 'bandpass', f0: 3000, f1: 300, q: 1.5 }); a.tone('sawtooth', 160, 720, 0.14, 0.08); },
  grapple: (a) => { a.tone('sawtooth', 140, 900, 0.18, 0.08); a.noise(0.14, 0.07, { type: 'highpass', f0: 2500 }); },
  swing: (a) => a.noise(0.13, 0.11, { type: 'bandpass', f0: 1800, f1: 500, q: 1.2 }),
  swingHeavy: (a) => { a.noise(0.26, 0.15, { type: 'bandpass', f0: 1000, f1: 150, q: 0.9 }); a.tone('sawtooth', 120, 60, 0.22, 0.08); },
  hit: (a) => { a.noise(0.09, 0.14, { f0: 2400, f1: 500 }); a.tone('square', 240, 90, 0.11, 0.12); },
  crit: (a) => { a.noise(0.1, 0.16, { f0: 3400, f1: 600 }); a.tone('square', 300, 100, 0.12, 0.12); a.tone('triangle', 1100, 1500, 0.12, 0.1, { delay: 0.02 }); },
  hitHeavy: (a) => { a.noise(0.18, 0.22, { f0: 1800, f1: 120 }); a.tone('square', 140, 40, 0.22, 0.18); },
  kill: (a) => { [72, 67, 60].forEach((m, i) => a.tone('square', N(m), N(m), 0.07, 0.09, { delay: i * 0.05 })); },
  hurt: (a) => { a.tone('sawtooth', 220, 60, 0.26, 0.14); a.noise(0.14, 0.1, { f0: 900, f1: 200 }); },
  pickup: (a) => { a.tone('square', 880, 1320, 0.07, 0.08); },
  coin: (a) => { a.tone('square', N(83), N(83), 0.05, 0.07); a.tone('square', N(88), N(88), 0.12, 0.07, { delay: 0.05 }); },
  item: (a) => { [76, 79, 83].forEach((m, i) => a.tone('triangle', N(m), N(m), 0.09, 0.1, { delay: i * 0.06 })); },
  levelup: (a) => { [60, 64, 67, 72, 76, 79, 84].forEach((m, i) => a.tone('square', N(m), N(m), 0.14, 0.09, { delay: i * 0.07 })); },
  heal: (a) => { a.tone('sine', 440, 880, 0.3, 0.14); a.tone('sine', 660, 1320, 0.3, 0.1, { delay: 0.08 }); },
  equip: (a) => { a.tone('square', 300, 420, 0.06, 0.09); a.tone('square', 500, 700, 0.08, 0.09, { delay: 0.06 }); },
  craft: (a) => { [64, 68, 71, 76].forEach((m, i) => a.tone('triangle', N(m), N(m), 0.12, 0.11, { delay: i * 0.08 })); a.noise(0.2, 0.06, { type: 'highpass', f0: 4000 }); },
  // способности
  cast_firewall: (a) => { a.tone('sawtooth', 200, 500, 0.3, 0.1); a.tone('square', 700, 700, 0.3, 0.05, { delay: 0.05 }); },
  shield_hit: (a) => { a.tone('square', 900, 400, 0.08, 0.12); a.noise(0.06, 0.08, { type: 'highpass', f0: 3000 }); },
  cast_defrag: (a) => { for (let i = 0; i < 10; i++) a.tone('square', 300 + i * 70, 300 + i * 70, 0.05, 0.07, { delay: i * 0.04 }); },
  defrag_boom: (a) => { a.noise(0.35, 0.22, { f0: 1600, f1: 80 }); a.tone('sine', 140, 40, 0.3, 0.22); },
  cast_sleep: (a) => { [72, 67, 64, 60, 55].forEach((m, i) => a.tone('sine', N(m), N(m), 0.35, 0.09, { delay: i * 0.1 })); },
  cast_overclock: (a) => { a.tone('sawtooth', 100, 1200, 0.4, 0.1); a.noise(0.3, 0.08, { type: 'highpass', f0: 2000 }); },
  overheat: (a) => { a.noise(0.5, 0.2, { f0: 3000, f1: 200 }); a.tone('sawtooth', 500, 80, 0.5, 0.15); },
  cast_delete: (a) => { a.tone('square', 660, 660, 0.08, 0.1); a.tone('square', 440, 440, 0.1, 0.1, { delay: 0.12 }); a.tone('square', 880, 880, 0.06, 0.08, { delay: 0.6 }); },
  delete_boom: (a) => { a.noise(1, 0.3, { f0: 2400, f1: 40 }); a.tone('sine', 120, 25, 0.9, 0.3); a.tone('sawtooth', 300, 40, 0.7, 0.14); },
  cast_safe: (a) => { a.tone('triangle', 400, 800, 0.4, 0.12); a.tone('triangle', 600, 1200, 0.4, 0.08, { delay: 0.05 }); },
  ready: (a) => a.tone('square', 1040, 1040, 0.05, 0.06),
  // мир
  explosion: (a) => { a.noise(0.5, 0.26, { f0: 2000, f1: 60 }); a.tone('sine', 120, 35, 0.4, 0.22); },
  popup: (a) => { a.tone('square', 880, 880, 0.05, 0.09); a.tone('square', 660, 660, 0.07, 0.09, { delay: 0.06 }); },
  shoot: (a) => a.tone('square', 600, 200, 0.1, 0.08),
  zap: (a) => { a.tone('sawtooth', 900, 120, 0.14, 0.09); a.noise(0.1, 0.06, { type: 'highpass', f0: 3500 }); },
  portal: (a) => { a.tone('sine', 200, 900, 0.5, 0.12); a.tone('triangle', 300, 1200, 0.5, 0.08, { delay: 0.05 }); },
  door: (a) => { a.tone('square', 120, 80, 0.25, 0.12); a.noise(0.2, 0.1, { f0: 600, f1: 200 }); },
  unlock: (a) => { [60, 64, 67, 72].forEach((m, i) => a.tone('square', N(m), N(m), 0.09, 0.09, { delay: i * 0.06 })); },
  save: (a) => { a.tone('sine', 660, 660, 0.12, 0.12); a.tone('sine', 880, 880, 0.2, 0.12, { delay: 0.1 }); a.tone('sine', 1320, 1320, 0.3, 0.1, { delay: 0.2 }); },
  roar: (a) => { a.tone('sawtooth', 90, 45, 0.9, 0.22, { lp: 900 }); a.noise(0.8, 0.12, { f0: 500, f1: 90 }); },
  bossHit: (a) => { a.noise(0.14, 0.18, { f0: 1600, f1: 200 }); a.tone('sawtooth', 100, 50, 0.2, 0.16); },
  warn: (a) => { a.tone('square', 880, 880, 0.12, 0.1); a.tone('square', 660, 660, 0.12, 0.1, { delay: 0.14 }); },
  bsod: (a) => { for (let i = 0; i < 6; i++) { a.tone('square', 420, 420, 0.22, 0.1, { delay: i * 0.4 }); a.tone('square', 320, 320, 0.22, 0.1, { delay: i * 0.4 + 0.2 }); } },
  reset: (a) => { a.tone('sine', 80, 1600, 0.9, 0.2); a.noise(0.9, 0.1, { type: 'highpass', f0: 1000 }); },
  tick: (a) => a.tone('square', 1200, 1200, 0.02, 0.05),
  glitch: (a) => { a.noise(0.12, 0.12, { type: 'bandpass', f0: 4000, f1: 800, q: 4 }); a.tone('square', 90, 60, 0.1, 0.08); },
  crystal: (a, i = 0) => { const m = [72, 76, 79, 84][i % 4]; a.tone('triangle', N(m), N(m), 0.45, 0.14); a.tone('sine', N(m + 12), N(m + 12), 0.45, 0.06); },
  win: (a) => { [60, 64, 67, 72, 67, 72, 76, 84].forEach((m, i) => a.tone('square', N(m), N(m), 0.18, 0.1, { delay: i * 0.1 })); },
  flood: (a) => a.noise(1.2, 0.2, { f0: 400, f1: 150 }),
};
