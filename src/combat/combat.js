import * as THREE from 'three';
import { CFG } from '../config.js';
import { ABILITIES, ABILITY_ORDER } from '../data/abilities.js';
import { ITEMS } from '../data/items.js';
import { basic } from '../gfx/materials.js';
import { clamp, damp, lerp } from '../core/util.js';

// Позы меча (вьюмодель): [x, y, z, rx, ry, rz]
const IDLE = [0.3, -0.36, -0.62, -0.3, 0.3, -0.3];
const POSES = {
  // [windup, strike, recover(=idle)]
  l0: { wind: [0.6, -0.22, -0.62, -0.1, -0.75, -1.0], hit: [-0.45, -0.34, -0.88, -0.45, 0.95, 0.85], dur: 0.36 },
  l1: { wind: [-0.42, -0.28, -0.62, -0.2, 0.75, 1.0], hit: [0.6, -0.42, -0.9, -0.45, -0.85, -0.9], dur: 0.36 },
  l2: { wind: [0.32, 0.06, -0.52, 0.75, 0.0, -0.25], hit: [0.12, -0.6, -0.98, -1.45, 0.0, -0.1], dur: 0.44 },
  heavy: { wind: [0.36, 0.1, -0.48, 1.0, 0.0, -0.3], hit: [0.08, -0.7, -1.02, -1.75, 0.0, 0.0], dur: 0.52 },
};
const ease = (t) => 1 - Math.pow(1 - t, 3);
const mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);

export class Combat {
  constructor(game) {
    this.game = game;
    this.viewVisible = true;
    this.swayRoll = 0;
    this.cds = {};
    this.shieldT = 0;
    this.shieldMax = 1;
    this.heat = 0;
    this.heatTick = 0;
    this.safeT = 0;
    this.atk = null;
    this.combo = 0;
    this.comboT = 0;
    this.charge = 0;
    this.charging = false;
    this.buffer = null;
    this.effects = [];
    this.xhState = '';
    this.potCd = 0;
    this.pose = IDLE.slice();
    this.swing = 0;
    this.buildView();
    this.buildShield();
  }

  // ================================================================== вьюмодель: курсор-меч
  buildView() {
    const g = this.game;
    const s = new THREE.Shape();
    // курсор: острие вверху слева
    s.moveTo(0, 19); s.lineTo(0, 3); s.lineTo(4, 6.6); s.lineTo(7, 0); s.lineTo(9.6, 1.2); s.lineTo(6.7, 7.7); s.lineTo(11.5, 7.7); s.closePath();
    const SC = 0.025;
    const geo = new THREE.ExtrudeGeometry(s, { depth: 1.4, bevelEnabled: false });
    geo.translate(-8.3, -0.6, -0.7);
    geo.scale(SC, SC, SC);
    this.bladeMat = new THREE.MeshLambertMaterial({ color: 0xffffff, flatShading: true, emissive: 0x333333 });
    this.outlineMat = new THREE.MeshBasicMaterial({ color: 0x000000 });
    const blade = new THREE.Mesh(geo, this.bladeMat);
    // контур: тот же силуэт, чуть крупнее, сдвинут назад — белая грань остаётся спереди
    const cx = (5.6 - 8.3) * SC, cy = (8.5 - 0.6) * SC;
    const outG = new THREE.Group();
    outG.position.set(cx, cy, -0.02);
    outG.scale.set(1.2, 1.1, 1.0);
    const outline = new THREE.Mesh(geo, this.outlineMat);
    outline.position.set(-cx, -cy, 0);
    outG.add(outline);
    const sword = new THREE.Group();
    sword.add(outG, blade);
    sword.rotation.z = -0.4; // острие — строго вверх
    // «рука» — простая перчатка из боксов
    const glove = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.11, 0.14), new THREE.MeshLambertMaterial({ color: 0xf5f5f5, flatShading: true }));
    glove.position.set(0.0, 0.0, 0.03);
    const cuff = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.09, 0.09), new THREE.MeshLambertMaterial({ color: 0x0a58d6, flatShading: true }));
    cuff.position.set(0.02, -0.07, 0.12);
    this.rig = new THREE.Group();
    this.rig.add(sword, glove, cuff);
    this.sword = sword;
    g.wScene.add(this.rig);
    // след удара
    this.trail = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.5), new THREE.MeshBasicMaterial({ color: 0xbfeaff, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending }));
    this.trail.position.set(0, 0, -1.0);
    g.wScene.add(this.trail);
    this.refreshWeapon();
  }

  refreshWeapon() {
    const w = this.game.inv.weapon();
    const c = w.color ?? 0xffffff;
    this.bladeMat.color.setHex(c);
    this.bladeMat.emissive.setHex(c === 0xffffff ? 0x333333 : new THREE.Color(c).multiplyScalar(0.25).getHex());
  }

  buildShield() {
    const g = this.game;
    // щит Firewall: шестиугольная сетка перед камерой
    const geo = new THREE.SphereGeometry(1.9, 10, 6, -Math.PI / 2 - 0.9, 1.8, 0.6, 1.6);
    this.shieldMat = new THREE.MeshBasicMaterial({ color: 0x4fc3ff, transparent: true, opacity: 0.0, wireframe: true, depthWrite: false, fog: false, side: THREE.DoubleSide });
    this.shieldFill = new THREE.MeshBasicMaterial({ color: 0x4fc3ff, transparent: true, opacity: 0.0, depthWrite: false, fog: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending });
    this.shield = new THREE.Group();
    this.shield.add(new THREE.Mesh(geo, this.shieldMat), new THREE.Mesh(geo, this.shieldFill));
    this.shield.visible = false;
    g.scene.add(this.shield);
  }

  clear() {
    for (const e of this.effects) e.dispose?.();
    this.effects = [];
    this.shieldT = 0;
    this.safeT = 0;
    this.atk = null;
    this.charging = false;
    this.charge = 0;
    const p = this.game.player;
    p.overclock = false;
    this.heat = 0;
    this.shield.visible = false;
  }

  // ================================================================== информация для HUD
  abilityInfo(id) {
    const a = ABILITIES[id];
    const st = this.game.stats;
    let active = false;
    if (id === 'firewall') active = this.shieldT > 0;
    else if (id === 'overclock') active = this.game.player.overclock;
    else if (id === 'safemode') active = this.safeT > 0;
    return { learned: !!st.abilities[id], cd: this.cds[id] || 0, cdMax: this.cdMax(id), cost: a.cost, active };
  }
  cdMax(id) {
    const a = ABILITIES[id];
    return a.cd * (id === 'delete' && this.game.stats.mods.delete ? 0.7 : 1);
  }

  crosshairState() {
    return this.xhState;
  }

  // ================================================================== урон по игроку
  filterDamage(dmg, o = {}) {
    if (o.type === 'heat' || o.type === 'void') return dmg;
    if (this.safeT > 0) return 0;
    const g = this.game, p = g.player;
    if (this.shieldT > 0 && o.from) {
      const f = p.forward3();
      const dx = o.from.x - p.x, dz = o.from.z - p.z;
      const l = Math.hypot(dx, dz) || 1;
      const dot = (dx * f.x + dz * f.z) / (l * (Math.hypot(f.x, f.z) || 1));
      if (dot > 0.15) {
        g.audio.sfx('shieldhit');
        g.fx.burst(p.x + f.x * 1.5, p.eyeY + f.y * 1.5, p.z + f.z * 1.5, 8, { speed: 3, size: 0.16, color: 0x7fe9ff, glow: true, life: 0.3 });
        this.shieldFlash = 1;
        return o.type === 'proj' ? 0 : dmg * 0.3;
      }
    }
    return dmg;
  }

  /** Проверка снаряда врага против щита. true — снаряд поглощён/отражён. */
  shieldTest(pr) {
    if (this.shieldT <= 0) return false;
    const g = this.game, p = g.player;
    const f = p.forward3();
    const ex = p.x, ey = p.eyeY, ez = p.z;
    const dx = pr.x - ex, dy = pr.y - ey, dz = pr.z - ez;
    const d = Math.hypot(dx, dy, dz);
    if (d > 2.7) return false;
    if ((dx * f.x + dy * f.y + dz * f.z) / (d || 1) < 0.1) return false;
    g.audio.sfx('shieldhit');
    this.shieldFlash = 1;
    g.fx.burst(pr.x, pr.y, pr.z, 8, { speed: 3, size: 0.16, color: 0x7fe9ff, glow: true, life: 0.3 });
    if (g.stats.mods.firewall) {
      // отражаем в ближайшего врага
      let best = null, bd = 40;
      for (const e of g.ents.enemies) { if (e.dead) continue; const dd = Math.hypot(e.x - pr.x, e.z - pr.z); if (dd < bd) { bd = dd; best = e; } }
      pr.reflect(best);
      return false;
    }
    pr.kill(false);
    return true;
  }

  // ================================================================== обновление
  update(dt) {
    const g = this.game, inp = g.input, p = g.player, st = g.stats;
    for (const k of Object.keys(this.cds)) if (this.cds[k] > 0) this.cds[k] = Math.max(0, this.cds[k] - dt);
    this.comboT -= dt;
    if (this.comboT <= 0) this.combo = 0;
    this.potCd -= dt;
    this.safeT = Math.max(0, this.safeT - dt);

    this.updateAbilitiesState(dt);
    this.updateInput(dt, inp, p, st);
    this.updateAttack(dt);
    this.updateEffects(dt);
    this.updateAim();
    this.poseUpdate(dt);
    this.updateShield(dt);
  }

  updateInput(dt, inp, p, st) {
    const g = this.game;
    // способности
    for (const id of ABILITY_ORDER) {
      if (inp.actHit(`ability${ABILITIES[id].key}`)) this.cast(id);
    }
    if (inp.actHit('heal')) this.quickHeal();
    if (g.state !== 'play') return;
    // атаки
    const spd = st.weaponSpeed;
    if (inp.clicked(0) && !this.charging) {
      if (!this.atk || this.atk.t > this.atk.dur * 0.55) this.startLight(spd);
      else this.buffer = 'light';
    }
    if (inp.held(2) && (!this.atk || this.atk.kind === 'heavyCharge') && !p.dead) {
      if (!this.charging) {
        this.charging = true; this.charge = 0;
        this.atk = { kind: 'heavyCharge', t: 0, dur: 99, hit: true };
        g.audio.sfx('charge');
      }
      this.charge = Math.min(1, this.charge + dt / (0.75 / spd));
    } else if (this.charging) {
      this.charging = false;
      if (this.charge > 0.12) this.startHeavy(spd);
      else this.atk = null;
    }
    if (this.buffer && (!this.atk || this.atk.t > this.atk.dur * 0.85)) {
      this.buffer = null;
      this.startLight(spd);
    }
  }

  startLight(spd) {
    const g = this.game;
    const kinds = ['l0', 'l1', 'l2'];
    const k = kinds[this.combo % 3];
    const P = POSES[k];
    this.atk = { kind: k, t: 0, dur: P.dur / spd, hit: false, combo: this.combo % 3 };
    this.combo++;
    this.comboT = 1.0;
    g.audio.sfx('swing');
    this.swing = this.combo % 2 ? 1 : -1;
  }

  startHeavy() {
    const g = this.game;
    const P = POSES.heavy;
    const spd = g.stats.weaponSpeed;
    this.atk = { kind: 'heavy', t: 0, dur: P.dur / spd, hit: false, charge: this.charge };
    g.audio.sfx('heavyswing');
    this.comboT = 0;
    this.combo = 0;
  }

  updateAttack(dt) {
    const a = this.atk;
    if (!a || a.kind === 'heavyCharge') return;
    a.t += dt;
    const p = a.t / a.dur;
    if (!a.hit && p >= 0.42) {
      a.hit = true;
      if (a.kind === 'heavy') this.heavyHit(a);
      else this.lightHit(a);
    }
    if (a.t >= a.dur) this.atk = null;
  }

  // ------------------------------------------------------------------ удары
  weaponStats() {
    const w = this.game.inv.weapon();
    return w.w || { dmg: 1, speed: 1, range: 1 };
  }

  rollDamage(base, target, opts = {}) {
    const g = this.game, w = this.weaponStats();
    let dmg = base * g.stats.dmgMult;
    let crit = false;
    if (w.crit && Math.random() < w.crit) { dmg *= 1.8; crit = true; }
    if (target.boss && w.bossDmg) dmg *= 1 + w.bossDmg;
    if (opts.mult) dmg *= opts.mult;
    return { dmg, crit };
  }

  lightHit(a) {
    const g = this.game, p = g.player, st = g.stats;
    const f = p.forward3();
    const ex = p.x, ey = p.eyeY, ez = p.z;
    const range = CFG.meleeRange * st.rangeMult * (a.combo === 2 ? 1.12 : 1);
    const cosMin = a.combo === 2 ? 0.5 : 0.25;
    const hits = this.collectHits(ex, ey, ez, f, range, cosMin);
    const finisher = a.combo === 2;
    let n = 0, killed = false;
    for (const e of hits) {
      const { dmg, crit } = this.rollDamage(CFG.lightDmg * (finisher ? 1.6 : 1), e);
      const was = e.dead;
      const dealt = e.takeHit(dmg, { from: { x: p.x, z: p.z }, knock: finisher ? 9 : 4.5, crit, heavy: false, type: 'melee', lifesteal: 0 });
      if (dealt > 0) { n++; this.onHitFx(e, dealt, crit, false, finisher); this.lifesteal(dealt); if (!was && e.dead) killed = true; }
    }
    if (n) {
      g.audio.sfx(finisher ? 'hitheavy' : 'hit');
      g.ui.hitMarker(killed);
      g.hitstop(finisher ? 0.06 : 0.035);
      g.shake(finisher ? 0.35 : 0.15);
    } else this.whiff(ex, ey, ez, f, range);
  }

  heavyHit(a) {
    const g = this.game, p = g.player, st = g.stats;
    const f = p.forward3();
    const fl = Math.hypot(f.x, f.z) || 1;
    const R = 3.7 * Math.min(1.3, st.rangeMult);
    const cx = p.x + (f.x / fl) * 2.6, cz = p.z + (f.z / fl) * 2.6;
    const cy = p.body.y;
    const ch = a.charge ?? 1;
    g.audio.sfx('slam');
    g.fx.ring(cx, cy + 0.15, cz, 28, R, { color: 0xbfeaff, color1: 0x5aa0ff, size: 0.28, life: 0.5, speed: R * 2.4, glow: true });
    g.fx.burst(cx, cy + 0.3, cz, 14, { speed: 5, size: 0.22, color: 0xffffff, grav: 10, life: 0.5, up: 3 });
    g.shake(0.65);
    let n = 0, killed = false;
    const all = [...g.ents.enemies, ...g.ents.targets];
    for (const e of all) {
      if (e.dead || e.intangible) continue;
      const d = Math.hypot(e.x - cx, e.z - cz);
      if (d > R + e.def.r) continue;
      if (Math.abs(e.cy - (cy + 1)) > 4.5 + e.def.h * 0.5) continue;
      const fall = 1 - clamp(d / (R + e.def.r), 0, 1) * 0.4;
      const { dmg, crit } = this.rollDamage(CFG.heavyDmg * (0.85 + 0.5 * ch) * fall, e);
      const was = e.dead;
      const dealt = e.takeHit(dmg, { from: { x: cx - (f.x / fl) * 1.5, z: cz - (f.z / fl) * 1.5 }, knock: 11, crit, heavy: true, aoe: true, type: 'melee' });
      if (dealt > 0) { n++; this.onHitFx(e, dealt, crit, true, true); this.lifesteal(dealt); if (!was && e.dead) killed = true; }
    }
    if (n) { g.ui.hitMarker(killed); g.hitstop(0.08); g.audio.sfx('hitheavy'); }
  }

  collectHits(ex, ey, ez, f, range, cosMin) {
    const g = this.game;
    const out = [];
    const w = g.zone.world;
    const consider = (e) => {
      if (e.dead || e.intangible) return;
      const dx = e.x - ex, dy = e.cy - ey, dz = e.z - ez;
      const d = Math.hypot(dx, dy, dz);
      const reach = range + e.def.r;
      if (d > reach + 0.3) return;
      const dot = (dx * f.x + dy * f.y + dz * f.z) / (d || 1);
      const tol = cosMin - Math.min(0.35, (e.def.r / Math.max(d, 0.4)) * 0.6);
      if (dot < tol) return;
      if (d > e.def.r + 0.8 && w.blocked(ex, ey, ez, e.x, e.cy, e.z)) return;
      out.push(e);
    };
    for (const e of g.ents.enemies) consider(e);
    for (const t of g.ents.targets) consider(t);
    return out;
  }

  whiff() {
    // нет попаданий: лёгкие частицы
  }

  onHitFx(e, dmg, crit, heavy) {
    const g = this.game;
    const w = this.weaponStats();
    const col = w.fx === 'paint' ? [0xff5ea8, 0x5ea8ff, 0xffd23f][(Math.random() * 3) | 0] : crit ? 0xffd23f : 0xffffff;
    g.fx.burst(e.x, e.cy, e.z, heavy ? 14 : 8, { speed: heavy ? 6 : 4, size: heavy ? 0.22 : 0.16, color: col, glow: true, life: 0.35 });
  }

  lifesteal(dealt) {
    const w = this.weaponStats();
    if (w.lifesteal) this.game.player.heal(dealt * w.lifesteal);
  }

  // ================================================================== вьюмодель: позы
  poseUpdate(dt) {
    const g = this.game, p = g.player;
    const a = this.atk;
    let target = IDLE.slice();
    let rollTarget = 0;
    if (a) {
      if (a.kind === 'heavyCharge') {
        const P = POSES.heavy;
        target = mix(IDLE, P.wind, ease(clamp(this.charge * 1.6, 0, 1)));
        const sh = this.charge * 0.012;
        target[0] += (Math.random() - 0.5) * sh; target[1] += (Math.random() - 0.5) * sh;
        rollTarget = 0;
      } else {
        const P = POSES[a.kind];
        const pp = clamp(a.t / a.dur, 0, 1);
        if (pp < 0.3) target = mix(IDLE, P.wind, ease(pp / 0.3));
        else if (pp < 0.55) { const k = ease((pp - 0.3) / 0.25); target = mix(P.wind, P.hit, k); rollTarget = this.swing * 0.03 * Math.sin(k * Math.PI); }
        else target = mix(P.hit, IDLE, ease((pp - 0.55) / 0.45));
        // след удара
        const tk = pp > 0.3 && pp < 0.6 ? 1 - Math.abs((pp - 0.45) / 0.15) : 0;
        this.trail.material.opacity = tk * 0.5;
        this.trail.rotation.z = a.kind === 'l0' ? 0.4 : a.kind === 'l1' ? -0.4 : 1.4;
        this.trail.scale.set(3.6 * tk + 0.1, 0.25 + tk * 0.1, 1);
      }
    } else this.trail.material.opacity = 0;
    // покачивание, спринт, прыжок
    const bobT = p.bob;
    const moving = clamp(p.speedNow / 7, 0, 1.4) * (p.body.grounded ? 1 : 0.2);
    const sprint = p.sprinting ? 1 : 0;
    const ox = Math.cos(bobT) * 0.012 * moving;
    const oy = Math.abs(Math.sin(bobT)) * 0.018 * moving;
    const idleBreath = Math.sin(g.clockT * 1.8) * 0.004;
    const fall = clamp(-p.body.vy / 30, -0.3, 0.3);
    const tx = target[0] + ox - sprint * 0.06, ty = target[1] - oy + idleBreath + fall * 0.08 - (p.landDip || 0) * 0.3, tz = target[2];
    const pose = this.pose;
    const k = Math.min(1, (a ? 28 : 12) * dt);
    pose[0] += (tx - pose[0]) * k; pose[1] += (ty - pose[1]) * k; pose[2] += (tz - pose[2]) * k;
    pose[3] += (target[3] + sprint * 0.25 - pose[3]) * k; pose[4] += (target[4] - pose[4]) * k; pose[5] += (target[5] - pose[5]) * k;
    this.rig.position.set(pose[0], pose[1], pose[2]);
    this.rig.rotation.set(pose[3], pose[4], pose[5], 'YXZ');
    this.swayRoll = damp(this.swayRoll, rollTarget, 10, dt);
    // отдача от рывка
    this.rig.position.z += p.fovKick * 0.06;
    // оверклок — свечение
    this.bladeMat.emissiveIntensity = p.overclock ? 1.5 + Math.sin(g.clockT * 20) * 0.5 : 1;
  }

  // ================================================================== прицел
  updateAim() {
    const g = this.game, p = g.player;
    let s = '';
    const f = p.forward3();
    const range = CFG.meleeRange * g.stats.rangeMult * 1.4;
    for (const e of g.ents.enemies) {
      if (e.dead || e.intangible) continue;
      const dx = e.x - p.x, dy = e.cy - p.eyeY, dz = e.z - p.z;
      const d = Math.hypot(dx, dy, dz);
      if (d > range + e.def.r) continue;
      if ((dx * f.x + dy * f.y + dz * f.z) / d > 0.93) { s = 'enemy'; break; }
    }
    if (!s && p.aim) s = 'link';
    this.xhState = s;
  }

  // ================================================================== способности
  quickHeal() {
    const g = this.game, p = g.player;
    if (this.potCd > 0) return;
    if (!g.inv.has('heal_zip')) { g.ui.toast('Нет патчей (patch.zip). Сожмите мусор в Архиваторе.', 'warn'); return; }
    if (p.hp >= g.stats.maxHp) { g.ui.toast('HP и так полное', 'info'); return; }
    g.inv.remove('heal_zip', 1);
    const h = p.heal(ITEMS.heal_zip.use.heal);
    this.potCd = 0.9;
    g.audio.sfx('heal');
    g.ui.damageNumber(p.x, p.y + 2.2, p.z, `+${Math.round(h)}`, 'heal');
  }

  cast(id) {
    const g = this.game, st = g.stats, p = g.player;
    const a = ABILITIES[id];
    if (!st.abilities[id]) { g.ui.toast(`Программа «${a.name}» ещё не установлена`, 'warn'); g.audio.sfx('error'); return; }
    if (id === 'overclock' && p.overclock) { this.stopOverclock(); return; }
    if ((this.cds[id] || 0) > 0) { g.audio.sfx('error'); return; }
    if (!p.spendRam(a.cost)) { g.ui.toast('Не хватает RAM!', 'warn'); g.audio.sfx('error'); return; }
    this.cds[id] = this.cdMax(id);
    p.ramDrain = 1.2;
    g.audio.sfx('cast');
    this[`cast_${id}`]?.();
    g.events.emit('cast', id);
  }

  cast_firewall() {
    const g = this.game;
    const mod = g.stats.mods.firewall;
    this.shieldMax = mod ? 7 : 4;
    this.shieldT = this.shieldMax;
    g.audio.sfx('shield');
  }

  cast_defrag() {
    const g = this.game, p = g.player, st = g.stats;
    const mod = st.mods.defrag;
    const R = 14 * (mod ? 1.4 : 1);
    const f = p.forward3();
    const fl = Math.hypot(f.x, f.z) || 1;
    const fx = f.x / fl, fz = f.z / fl;
    const list = [];
    for (const e of g.ents.enemies) {
      if (e.dead) continue;
      if (Math.hypot(e.x - p.x, e.z - p.z) < R) list.push(e);
    }
    list.sort((a, b) => Math.hypot(a.x - p.x, a.z - p.z) - Math.hypot(b.x - p.x, b.z - p.z));
    const dist = 7.5;
    const cx = p.x + fx * dist, cz = p.z + fz * dist;
    const gy = g.zone.world.floorBelow(cx, p.body.y + 4, cz, 0.3, 30);
    const cy = gy > -1e8 ? gy : p.body.y;
    const px = -fz, pz = fx; // поперёк
    const slots = list.slice(0, 16).map((e, i, arr) => {
      const off = (i - (arr.length - 1) / 2) * 1.9;
      return { e, x: cx + px * off, z: cz + pz * off };
    });
    const eff = { t: 0, dead: false, slots, cx, cz, cy, mod, exploded: 0 };
    const dmgBase = CFG.lightDmg * 3.3 * st.dmgMult * (mod ? 1.35 : 1);
    eff.update = (dt) => {
      eff.t += dt;
      const pull = eff.t < 1.1;
      g.fx.ring(cx, cy + 0.1, cz, 2, 7.5, { glow: true, color: 0xff8a3d, size: 0.16, life: 0.4, speed: 0.1 });
      if (pull) {
        for (const s of eff.slots) {
          const e = s.e;
          if (e.dead) continue;
          if (e.boss) continue;
          const dx = s.x - e.x, dz = s.z - e.z;
          const l = Math.hypot(dx, dz);
          if (l > 0.2) { e.body.x += (dx / l) * Math.min(l, 13 * dt); e.body.z += (dz / l) * Math.min(l, 13 * dt); e.syncFromBody?.(); }
          e.stagger = 0.3;
          e.body.vy = Math.max(e.body.vy, 0);
          if (Math.random() < dt * 14) g.fx.emit(e.x, e.cy, e.z, { vx: 0, vy: 1, vz: 0, life: 0.25, size: 0.15, color: 0xffb066, glow: true });
        }
        // линия-«сетка» на земле
        for (let i = 0; i < 2; i++) { const t = (Math.random() - 0.5) * 2 * (eff.slots.length * 0.95 + 1); g.fx.emit(cx + px * t, cy + 0.12, cz + pz * t, { vx: 0, vy: 0.3, vz: 0, life: 0.25, size: 0.12, color: 0xffd23f, glow: true }); }
      } else if (eff.exploded < eff.slots.length && eff.t > 1.1 + eff.exploded * 0.09) {
        const s = eff.slots[eff.exploded++];
        const e = s.e;
        g.audio.sfx('boom');
        g.fx.burst(e.dead ? s.x : e.x, cy + 0.8, e.dead ? s.z : e.z, 18, { speed: 7, size: 0.3, color: 0xff8a3d, color1: 0xffe07a, glow: true, life: 0.55, up: 2 });
        g.shake(0.25);
        if (!e.dead) {
          const { dmg, crit } = this.rollDamage(dmgBase, e);
          e.takeHit(dmg, { from: { x: cx, z: cz }, knock: 6, crit, aoe: true, heavy: true, type: 'defrag', noHitstop: true });
        }
        // по остальным рядом тоже
        for (const o of g.ents.enemies) {
          if (o.dead || o === e || eff.slots.some((q) => q.e === o)) continue;
          if (Math.hypot(o.x - s.x, o.z - s.z) < 3) o.takeHit(dmgBase * 0.5, { from: { x: s.x, z: s.z }, knock: 5, aoe: true, noHitstop: true });
        }
      } else if (eff.exploded >= eff.slots.length && eff.t > 1.1 + eff.slots.length * 0.09 + 0.2) eff.dead = true;
    };
    if (!slots.length) {
      // некого собирать — всё равно эффектный «скан»
      g.fx.ring(cx, cy + 0.2, cz, 30, 8, { glow: true, color: 0xff8a3d, size: 0.2, life: 0.6, speed: 12 });
      g.ui.toast('Defrag: рядом нет врагов', 'info', 1800);
      this.cds.defrag = 1.5;
      return;
    }
    this.effects.push(eff);
    g.audio.sfx('defrag');
  }

  cast_sleep() {
    const g = this.game, p = g.player, st = g.stats;
    const mod = st.mods.sleep;
    const R = 17 * (mod ? 1.35 : 1);
    const dur = 5 * (mod ? 1.6 : 1);
    let n = 0;
    for (const e of g.ents.enemies) {
      if (e.dead) continue;
      if (Math.hypot(e.x - p.x, e.cy - p.center, e.z - p.z) < R) { e.sleep(dur); n++; g.fx.burst(e.x, e.cy + e.def.h * 0.5, e.z, 8, { speed: 2, size: 0.16, color: 0x8fa8ff, glow: true, life: 0.8, up: 1.5 }); }
    }
    for (const pr of g.ents.projectiles) if (Math.hypot(pr.x - p.x, pr.z - p.z) < R) pr.kill(true);
    g.fx.ring(p.x, p.body.y + 0.3, p.z, 50, R, { glow: true, color: 0x8fa8ff, color1: 0x2a3a8a, size: 0.28, life: 0.9, speed: R * 1.3 });
    g.audio.sfx('sleep');
    g.ui.flash?.(40);
    if (!n) g.ui.toast('Sleep Mode: рядом тишина', 'info', 1500);
  }

  cast_overclock() {
    const g = this.game, p = g.player;
    p.overclock = true;
    this.heatTick = 0;
    g.audio.sfx('overclock');
    g.ui.toast('Overclock: быстрее, но следите за перегревом!', 'warn', 2400);
  }

  stopOverclock() {
    const p = this.game.player;
    if (!p.overclock) return;
    p.overclock = false;
    this.game.audio.sfx('error');
  }

  cast_delete() {
    const g = this.game, p = g.player, st = g.stats;
    const mod = st.mods.delete;
    const f = p.forward3();
    const targets = [];
    for (const e of g.ents.enemies) {
      if (e.dead || e.intangible) continue;
      const dx = e.x - p.x, dy = e.cy - p.eyeY, dz = e.z - p.z;
      const d = Math.hypot(dx, dy, dz);
      if (d > 42) continue;
      if ((dx * f.x + dy * f.y + dz * f.z) / d < 0.25) continue;
      if (g.zone.world.blocked(p.x, p.eyeY, p.z, e.x, e.cy, e.z)) continue;
      targets.push(e);
    }
    g.audio.sfx('delete');
    g.ui.flash?.(90);
    g.shake(0.6);
    g.ui.toast('«Вы действительно хотите удалить эти объекты?» — Да.', 'bad', 2600);
    const eff = { t: 0, dead: false, targets, done: false, sprites: [] };
    eff.update = (dt) => {
      eff.t += dt;
      for (const e of targets) if (!e.dead && Math.random() < dt * 20) g.fx.emit(e.x + (Math.random() - 0.5) * e.def.r * 2, e.cy + (Math.random() - 0.5) * e.def.h, e.z + (Math.random() - 0.5) * e.def.r * 2, { vx: 0, vy: 2, vz: 0, life: 0.4, size: 0.18, color: 0xff4d6d, glow: true });
      for (const e of targets) if (!e.dead) e.stagger = 0.2;
      if (eff.t > 0.9 && !eff.done) {
        eff.done = true;
        for (const e of targets) {
          if (e.dead) continue;
          g.fx.burst(e.x, e.cy, e.z, 26, { speed: 8, size: 0.26, color: 0xff4d6d, color1: 0xffffff, glow: true, life: 0.7 });
          if (e.boss) e.takeHit(Math.round(e.maxHp * 0.2 * (mod ? 1.3 : 1)), { from: { x: p.x, z: p.z }, knock: 0, aoe: true, heavy: true, type: 'delete' });
          else e.takeHit(e.maxHp * 3 + 99999, { from: { x: p.x, z: p.z }, knock: 4, aoe: true, heavy: true, type: 'delete', noHitstop: true });
        }
        g.shake(0.8);
        g.audio.sfx('boom');
        g.ui.hitMarker(true);
      }
      if (eff.t > 1.2) eff.dead = true;
    };
    this.effects.push(eff);
    if (!targets.length) g.ui.toast('Delete: впереди нечего удалять… пока.', 'info', 1800);
  }

  cast_safemode() {
    const g = this.game;
    this.safeT = 4;
    for (const e of g.ents.enemies) if (!e.dead) { e.slow = 0.5; e.slowT = 4; }
    g.audio.sfx('shield');
    g.ui.flash?.(40);
    g.ui.toast('Safe Mode: 16 цветов и 4 секунды покоя', 'good', 2000);
  }

  updateAbilitiesState(dt) {
    const g = this.game, p = g.player;
    if (this.shieldT > 0) this.shieldT = Math.max(0, this.shieldT - dt);
    // перегрев
    if (p.overclock) {
      const rate = g.stats.mods.overclock ? 9 : 14;
      this.heat = Math.min(100, this.heat + rate * dt);
      if (this.heat > 70) {
        this.heatTick -= dt;
        if (this.heatTick <= 0) {
          this.heatTick = 0.6;
          if (p.hp > 8) p.hurt(2 + g.stats.level * 0.35, { ignoreInvuln: true, iframes: 0, type: 'heat' });
          else this.stopOverclock();
        }
      }
      if (this.heat >= 100) { this.stopOverclock(); g.ui.toast('ПЕРЕГРЕВ! Overclock отключён', 'bad'); g.audio.sfx('error'); }
    } else this.heat = Math.max(0, this.heat - 22 * dt);
  }

  updateEffects(dt) {
    for (let i = this.effects.length - 1; i >= 0; i--) {
      const e = this.effects[i];
      e.update(dt);
      if (e.dead) { e.dispose?.(); this.effects.splice(i, 1); }
    }
  }

  updateShield(dt) {
    const g = this.game, p = g.player, cam = g.camera;
    const on = this.shieldT > 0;
    this.shield.visible = on;
    if (!on) return;
    const f = p.forward3();
    this.shield.position.set(cam.position.x, cam.position.y, cam.position.z);
    this.shield.rotation.set(0, p.yaw + Math.PI, 0);
    this.shield.rotateY(0);
    // сфера смотрит в +Z по умолчанию: поворачиваем к взгляду
    this.shield.rotation.y = p.yaw;
    this.shield.rotation.x = 0;
    this.shieldFlash = Math.max(0, (this.shieldFlash || 0) - dt * 4);
    const fade = clamp(this.shieldT / 0.6, 0, 1);
    this.shieldMat.opacity = (0.55 + this.shieldFlash * 0.4) * fade;
    this.shieldFill.opacity = (0.07 + this.shieldFlash * 0.22) * fade;
    void f;
  }
}
