import { fmtTime } from '../core/util.js';

/**
 * Мировые события: таймер «Быстрой загрузки», синий экран (BSOD), «Форматирование» в акте 3.
 * Расширяется по мере появления зон.
 */
export class WorldEvents {
  constructor(game) {
    this.game = game;
    this.reset();
  }

  reset() {
    this.speed = null; // {t}
    this.bsod = null;
    this.format = null;
  }

  toJSON() {
    return { format: this.format };
  }
  load(d) {
    this.reset();
    if (d?.format) this.format = d.format;
  }

  startSpeedrun() {
    this.speed = { t: 30 * 60 };
  }

  onZoneEnter() {}
  onRespawn() {}

  update(dt) {
    const g = this.game;
    if (this.speed) {
      this.speed.t -= dt;
      if (this.speed.t <= 0) {
        this.speed = null;
        g.playerDied({ type: 'timeout' });
      }
    }
  }

  /** Данные для таймера на HUD: {label, text, warn} либо null. */
  timerInfo() {
    if (this.speed) return { label: 'БЫСТРАЯ ЗАГРУЗКА — ДО СИНЕГО ЭКРАНА', text: fmtTime(Math.max(0, this.speed.t)), warn: this.speed.t < 300 };
    return null;
  }
}
