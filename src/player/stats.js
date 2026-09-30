import { CFG, STATS } from '../config.js';

/** Уровень = «Версия»: v1.0 → v1.1 → v1.5 → v2.0 → v2.1 → v2.5 → v3.0 ... */
export function versionName(level) {
  const major = 1 + Math.floor((level - 1) / 3);
  const minor = [0, 1, 5][(level - 1) % 3];
  return `v${major}.${minor}`;
}

export const xpForNext = (level) => Math.round(45 + 30 * Math.pow(level - 1, 1.5));
export const MAX_LEVEL = 30;

export class Stats {
  constructor(game) {
    this.game = game;
    this.reset();
  }

  reset(keep = null) {
    this.level = keep?.level ?? 1;
    this.xp = keep?.xp ?? 0;
    this.points = keep?.points ?? 0;
    this.base = keep?.base ? { ...keep.base } : { cpu: 5, ram: 5, storage: 5, bandwidth: 5 };
    this.moves = { doubleJump: false, dash: false, grapple: false, ...(keep?.moves || {}) };
    this.abilities = { firewall: false, defrag: false, sleep: false, overclock: false, delete: false, safemode: false, ...(keep?.abilities || {}) };
    this.mods = { ...(keep?.mods || {}) };
    this.buffs = {};
    this.passives = { cpu: 0, ram: 0, storage: 0, bandwidth: 0, hp: 0, dmg: 0 }; // бонусы от союзников
    this.xpBoost = 1;
  }

  get inv() {
    return this.game.inv;
  }

  /** Значение характеристики: база + экипировка + союзники. */
  stat(name) {
    return this.base[name] + (this.inv?.mod(name) || 0) + (this.passives[name] || 0);
  }

  buff(name) {
    const b = this.buffs[name];
    return b && b.t > 0 ? b.mult : 1;
  }

  addBuff(name, mult, dur) {
    this.buffs[name] = { mult, t: dur, max: dur };
    this.game.events.emit('buff', name);
  }

  get dmgMult() {
    const w = this.inv?.weapon();
    return (1 + (this.stat('cpu') - 5) * 0.1) * (w?.w?.dmg ?? 1) * this.buff('dmg') * (1 + this.passives.dmg);
  }
  get weaponSpeed() {
    return (this.inv?.weapon()?.w?.speed ?? 1) * (this.game.player?.overclock ? 1.7 : 1);
  }
  get maxHp() {
    return Math.round(CFG.baseHp + 14 * (this.level - 1) + (this.inv?.mod('hp') || 0) + this.passives.hp);
  }
  get maxRam() {
    return Math.round(CFG.baseRam + (this.stat('ram') - 5) * 8 + (this.level - 1) * 3);
  }
  get ramRegen() {
    return 3.6 + (this.stat('ram') - 5) * 0.4;
  }
  get slots() {
    return Math.max(8, Math.round(12 + (this.stat('storage') - 5) * 2));
  }
  get speedMult() {
    return (1 + (this.stat('bandwidth') - 5) * 0.025) * (1 + (this.inv?.mod('move') || 0)) * this.buff('speed');
  }
  get rangeMult() {
    return (1 + (this.stat('bandwidth') - 5) * 0.025) * (this.inv?.weapon()?.w?.range ?? 1);
  }
  get armor() {
    return this.inv?.mod('armor') || 0;
  }
  /** Множитель входящего урона. */
  get damageTaken() {
    return Math.max(0.3, 1 - this.armor * 0.017) * this.buff('armor');
  }
  get dashCd() {
    return CFG.dashCd * Math.max(0.4, 1 + (this.inv?.mod('dashCd') || 0));
  }
  get grappleRange() {
    return CFG.grappleRange * (1 + (this.inv?.mod('grapple') || 0));
  }
  get version() {
    return versionName(this.level);
  }
  get xpNeeded() {
    return xpForNext(this.level);
  }

  addXp(n) {
    if (this.level >= MAX_LEVEL) return 0;
    n = Math.round(n * this.xpBoost);
    this.xp += n;
    let ups = 0;
    while (this.xp >= xpForNext(this.level) && this.level < MAX_LEVEL) {
      this.xp -= xpForNext(this.level);
      this.level++;
      this.points += 2;
      ups++;
      this.game.events.emit('levelUp', this.level);
    }
    return n;
  }

  spend(stat) {
    if (this.points <= 0 || !STATS.includes(stat)) return false;
    this.points--;
    this.base[stat]++;
    return true;
  }

  update(dt) {
    for (const k of Object.keys(this.buffs)) {
      const b = this.buffs[k];
      b.t -= dt;
      if (b.t <= 0) delete this.buffs[k];
    }
  }

  toJSON() {
    const { level, xp, points, base, moves, abilities, mods } = this;
    return { level, xp, points, base, moves, abilities, mods };
  }
  load(d) {
    this.reset(d);
  }
}
