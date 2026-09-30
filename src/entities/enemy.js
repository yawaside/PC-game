import * as THREE from 'three';
import { makeBody, moveBody } from '../physics/body.js';
import { makeEnemyModel } from './models.js';
import { clamp, damp, angleDiff, rnd } from '../core/util.js';

/**
 * Враги. hp/dmg — базовые значения для уровня 1, масштабируются уровнем зоны и «Чистой установкой».
 * fly — летающий; ghostly — проходит сквозь стены.
 */
export const ENEMIES = {
  slime: { name: 'Adware-слизень', kind: 'slime', hp: 46, dmg: 9, speed: 2.6, r: 0.8, h: 1.7, xp: 14, aggro: 26, loot: 'common', lootN: [1, 2], bytes: [2, 7] },
  bat: { name: 'Spyware-мышь', kind: 'bat', hp: 28, dmg: 8, speed: 7, r: 0.4, h: 0.8, fly: 2.4, xp: 16, aggro: 24, loot: 'common', lootN: [0, 1], bytes: [1, 5] },
  worm: { name: 'Worm-червь', kind: 'worm', hp: 62, dmg: 15, speed: 6, r: 0.7, h: 2.6, xp: 22, aggro: 30, loot: 'common', lootN: [1, 2], bytes: [3, 8] },
  golem: { name: 'Bloatware-голем', kind: 'golem', hp: 280, dmg: 28, speed: 1.9, r: 1.5, h: 4.6, xp: 95, aggro: 34, loot: 'rich', lootN: [2, 3], bytes: [25, 50] },
  bird: { name: 'Popup-птица', kind: 'bird', hp: 16, dmg: 6, speed: 9, r: 0.45, h: 0.6, fly: 4, xp: 6, aggro: 30, loot: 'common', lootN: [0, 1], bytes: [0, 3] },
  soldier: { name: 'Процесс-солдат', kind: 'soldier', hp: 74, dmg: 10, speed: 3.5, r: 0.45, h: 2.1, xp: 24, aggro: 34, loot: 'mid', lootN: [1, 2], bytes: [4, 10] },
  ghost: { name: 'Призрак игры', kind: 'ghost', hp: 60, dmg: 9, speed: 3.2, r: 0.7, h: 1.7, fly: 1.4, ghostly: true, xp: 26, aggro: 28, loot: 'mid', lootN: [1, 1], bytes: [4, 10] },
  hacker: { name: 'Пират-хакер', kind: 'hacker', hp: 96, dmg: 12, speed: 4.4, r: 0.5, h: 2.2, xp: 36, aggro: 38, loot: 'mid', lootN: [1, 2], bytes: [6, 14] },
  miner: { name: 'Майнер-дрон', kind: 'miner', hp: 66, dmg: 13, speed: 4.8, r: 0.6, h: 1.0, fly: 5, xp: 30, aggro: 40, loot: 'mid', lootN: [1, 1], bytes: [5, 12] },
  glitch: { name: 'Глитч', kind: 'glitch', hp: 50, dmg: 13, speed: 5, r: 0.7, h: 1.3, xp: 20, aggro: 28, loot: 'common', lootN: [1, 2], bytes: [2, 7] },
};

const COLORS = {
  slime: { body: 0x9b59ff }, bird: { body: 0x3a8cff }, soldier: { body: 0x6d7a4a },
};

let shadowGeo = null, shadowMat = null, barGeo = null;

export class Enemy {
  constructor(ents, type, x, z, o = {}) {
    const g = ents.game;
    this.ents = ents;
    this.game = g;
    this.world = g.zone.world;
    const def = { ...(o.def || ENEMIES[type]) };
    this.def = def;
    this.type = type;
    this.name = def.name;
    this.kind = def.kind;
    const lvl = o.level ?? g.zone.def.level ?? 1;
    const hpMul = (1 + 0.17 * (lvl - 1)) * g.ngHp() * (o.hpMul ?? 1);
    this.maxHp = Math.max(1, Math.round(def.hp * hpMul));
    this.hp = o.hp ?? this.maxHp;
    this.dmg = def.dmg * (1 + 0.085 * (lvl - 1)) * g.ngDmg() * (o.dmgMul ?? 1);
    this.xp = Math.round(def.xp * (1 + 0.12 * (lvl - 1)));
    this.id = o.id || null;
    this.gen = o.gen || 0;
    this.noSplit = !!o.noSplit;
    this.o = o;
    this.dead = false;
    this.aggro = !!o.aggro;
    this.t = Math.random() * 10;
    this.cd = rnd(0.5, 2);
    this.cd2 = rnd(1, 3);
    this.state = 'idle';
    this.st = 0;
    this.flash = 0;
    this.sleepT = 0;
    this.slow = 1;
    this.stagger = 0;
    this.kx = 0; this.kz = 0;
    this.home = { x, z };
    this.losT = 0; this.los = false;
    this.alpha = 1;
    this.deadT = 0;
    this.barT = 0;
    this.intangible = false;
    this.phaseLabel = '';
    this.moving = 0;
    this.yaw = Math.random() * Math.PI * 2;
    this.wander = { x, z, t: 0 };

    const m = makeEnemyModel(def.kind, { ...COLORS[type], ...(o.colors || {}) });
    this.root = m.root;
    this.parts = m.parts;
    if (o.scale) this.root.scale.setScalar(o.scale);
    // собственные материалы, чтобы подсвечивать/прозрачить индивидуально
    this.mats = [];
    this.root.traverse((c) => {
      if (c.isMesh && c.material && c.material.isMeshLambertMaterial) {
        c.material = c.material.clone();
        this.mats.push(c.material);
      } else if (c.isMesh && c.material && c.material.isMeshBasicMaterial && c.material.map === null) {
        c.material = c.material.clone();
        this.basicMats = this.basicMats || [];
        this.basicMats.push(c.material);
      }
    });
    if (!shadowGeo) {
      shadowGeo = new THREE.CircleGeometry(1, 12).rotateX(-Math.PI / 2);
      shadowMat = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.32, depthWrite: false, fog: true });
      barGeo = new THREE.PlaneGeometry(1, 1);
    }
    this.shadow = new THREE.Mesh(shadowGeo, shadowMat);
    this.shadow.scale.setScalar(def.r * 1.2);
    this.shadow.renderOrder = 1;
    ents.group.add(this.root, this.shadow);

    // HP-полоска
    if (!o.noBar) {
      const bg = new THREE.Sprite(new THREE.SpriteMaterial({ color: 0x000000, depthTest: false, transparent: true, fog: false }));
      const fg = new THREE.Sprite(new THREE.SpriteMaterial({ color: 0xff4040, depthTest: false, transparent: true, fog: false }));
      bg.center.set(0.5, 0.5); fg.center.set(0, 0.5);
      bg.renderOrder = 10; fg.renderOrder = 11;
      this.bar = new THREE.Group();
      this.bar.add(bg, fg);
      this.barFg = fg; this.barBg = bg;
      this.barW = Math.max(1.0, def.r * 1.8);
      bg.scale.set(this.barW + 0.08, 0.17, 1);
      this.bar.visible = false;
      ents.group.add(this.bar);
    }

    // положение
    this.body = makeBody(def.r, def.h, 0.6);
    this.body.x = x; this.body.z = z;
    const gy = o.y ?? this.world.groundY(x, z);
    this.body.y = gy + (def.fly ? def.fly : 0);
    this.body.fly = !!def.fly;
    this.body.grounded = false;
    this.syncFromBody();
    this.init?.();
    this.root.position.set(this.x, this.y, this.z);
  }

  get cy() { return this.y + this.def.h * 0.5; }
  syncFromBody() { this.x = this.body.x; this.y = this.body.y; this.z = this.body.z; }

  get p() { return this.game.player; }
  dist2() { return Math.hypot(this.p.x - this.x, this.p.z - this.z); }
  dist3() { return Math.hypot(this.p.x - this.x, this.p.center - this.cy, this.p.z - this.z); }

  canSee(dt = 0) {
    this.losT -= dt;
    if (this.losT > 0) return this.los;
    this.losT = 0.3;
    const p = this.p;
    this.los = !this.world.blocked(this.x, this.cy, this.z, p.x, p.center, p.z, false);
    return this.los;
  }

  faceTo(tx, tz, dt, rate = 10) {
    const want = Math.atan2(tx - this.x, tz - this.z);
    this.yaw += angleDiff(this.yaw, want) * Math.min(1, rate * dt);
  }

  // --------------------------------------------------------------- урон
  takeHit(dmg, info = {}) {
    if (this.dead || this.intangible) return 0;
    if (this.invulnerable) { this.game.fx.burst(this.x, this.cy, this.z, 4, { speed: 2, size: 0.12, color: 0xaaaaaa, glow: true, life: 0.2 }); return 0; }
    dmg = Math.max(1, Math.round(dmg));
    this.hp -= dmg;
    this.flash = 1;
    this.aggro = true;
    this.barT = 4;
    const from = info.from;
    if (from && info.knock && !this.heavy) {
      const dx = this.x - from.x, dz = this.z - from.z;
      const l = Math.hypot(dx, dz) || 1;
      const k = (info.knock * (this.def.kb ?? 1)) / Math.max(1, this.def.r * 0.8);
      this.kx += (dx / l) * k; this.kz += (dz / l) * k;
    }
    if (info.heavy && !this.heavy) this.stagger = 0.45;
    this.game.ui.damageNumber(this.x, this.y + this.def.h + 0.2, this.z, String(dmg), info.crit ? 'crit' : '');
    this.onHit?.(dmg, info);
    if (this.hp <= 0) this.die(info);
    return dmg;
  }

  sleep(t) { this.sleepT = Math.max(this.sleepT, this.boss ? t * 0.35 : t); }

  die(info = {}) {
    if (this.dead) return;
    this.dead = true;
    this.hp = 0;
    const g = this.game;
    const d = this.def;
    g.audio.sfx(this.boss ? 'bossdie' : 'kill');
    g.fx.burst(this.x, this.cy, this.z, this.boss ? 60 : 16, { speed: this.boss ? 9 : 5, size: 0.24, color: this.mats[0]?.color?.getHex() ?? 0xffffff, color1: 0xffffff, glow: true, life: 0.7, grav: 6 });
    // XP
    const gained = g.stats.addXp(this.xp);
    if (gained > 0) g.ui.damageNumber(this.x, this.y + d.h + 0.9, this.z, `+${gained} XP`, 'xp');
    // добыча
    const nloot = Math.round(rnd(d.lootN[0], d.lootN[1] + 0.99));
    if (d.loot && nloot > 0) this.ents.dropLoot(this.x, this.cy, this.z, d.loot, nloot);
    const by = Math.round(rnd(d.bytes[0], d.bytes[1] + 0.99) * (this.o.bytesMul || 1));
    if (by > 0) this.ents.spawnPickup('bytes', this.x, this.cy, this.z, { amount: by });
    const hpFrac = g.player.hp / g.stats.maxHp;
    if (Math.random() < (hpFrac < 0.4 ? 0.3 : 0.1)) this.ents.spawnPickup('hp', this.x, this.cy, this.z, { amount: 14 + g.stats.level });
    if (Math.random() < 0.08) this.ents.spawnPickup('ram', this.x, this.cy, this.z, { amount: 18 });
    if (this.id) g.setFlag(`dead_${this.id}`);
    if (info.lifesteal) g.player.heal(info.lifesteal);
    this.onDie?.(info);
    g.events.emit('enemyKilled', { type: this.type, enemy: this, info });
    g.ui.hitMarker(true);
    this.deadT = 0.001;
  }

  // --------------------------------------------------------------- обновление
  update(dt) {
    if (this.dead) return this.updateDead(dt);
    const p = this.p;
    this.t += dt;
    this.flash = Math.max(0, this.flash - dt * 5);
    this.barT = Math.max(0, this.barT - dt);
    this.stagger = Math.max(0, this.stagger - dt);
    if (this.slowT > 0) { this.slowT -= dt; if (this.slowT <= 0) this.slow = 1; }
    const far = this.dist2() > 110;
    if (far && !this.boss) { this.visible(false); return; }
    this.visible(true);

    if (this.sleepT > 0) {
      this.sleepT -= dt;
      this.body.vx *= 0.9; this.body.vz *= 0.9;
      if (!this.def.fly) this.gravityStep(dt);
      this.animate(dt * 0.15);
      this.syncMesh(dt, true);
      return;
    }
    const d2 = this.dist2();
    if (!this.aggro) {
      if (d2 < this.def.aggro && this.canSee(dt)) { this.aggro = true; this.onAggro?.(); }
    } else if (d2 > this.def.aggro * 2.8 + 12 && !this.boss) this.aggro = false;

    if (this.stagger <= 0 && !this.game.player.dead) this.ai(dt, d2);
    else if (!this.def.fly) this.gravityStep(dt);

    // отдача
    if (Math.abs(this.kx) + Math.abs(this.kz) > 0.05) {
      this.body.vx += this.kx * dt * 8; this.body.vz += this.kz * dt * 8;
      this.kx *= Math.exp(-7 * dt); this.kz *= Math.exp(-7 * dt);
    }
    this.animate(dt);
    this.syncMesh(dt, false);
  }

  visible(v) {
    if (this.root.visible !== v) { this.root.visible = v; this.shadow.visible = v; }
  }

  gravityStep(dt, speedMul = 1) {
    const b = this.body;
    b.vy -= 30 * dt;
    if (b.vy < -40) b.vy = -40;
    const k = Math.exp(-(b.grounded ? 9 : 1.4) * dt);
    b.vx *= k; b.vz *= k;
    void speedMul;
    moveBody(b, dt, this.world);
    this.syncFromBody();
  }

  /** Двигаться по земле к точке со скоростью speed. */
  walkTo(dt, tx, tz, speed, accel = 26) {
    const b = this.body;
    const dx = tx - b.x, dz = tz - b.z;
    const l = Math.hypot(dx, dz);
    if (l > 0.05) {
      const s = speed * this.slow;
      const dvx = (dx / l) * s - b.vx, dvz = (dz / l) * s - b.vz;
      const dl = Math.hypot(dvx, dvz);
      const a = accel * dt;
      const k = dl > a ? a / dl : 1;
      b.vx += dvx * k; b.vz += dvz * k;
      this.moving = Math.min(1, l);
    } else this.moving = 0;
    b.vy -= 30 * dt;
    if (b.vy < -40) b.vy = -40;
    moveBody(b, dt, this.world);
    this.syncFromBody();
  }

  /** Летать со скоростью (vx,vy,vz), избегая стен. */
  flyStep(dt, vx, vy, vz) {
    const b = this.body;
    const s = this.slow;
    const nx = b.x + vx * dt * s, ny = b.y + vy * dt * s, nz = b.z + vz * dt * s;
    const w = this.world;
    let ax = nx, ay = ny, az = nz;
    if (!this.def.ghostly) {
      const hh = this.def.h * 0.5;
      if (w.blocked(b.x, b.y + hh, b.z, nx, ny + hh, nz, false)) {
        // скольжение по осям
        ax = b.x; az = b.z; ay = b.y;
        if (!w.blocked(b.x, b.y + hh, b.z, nx, b.y + hh, b.z)) ax = nx;
        if (!w.blocked(b.x, b.y + hh, b.z, b.x, b.y + hh, nz)) az = nz;
        if (!w.blocked(b.x, b.y + hh, b.z, b.x, ny + hh, b.z)) ay = ny;
      }
    }
    const gy = w.groundY(ax, az);
    b.x = ax; b.y = Math.max(ay, gy + 0.4); b.z = az;
    const cl = this.world.bounds;
    if (cl) { b.x = clamp(b.x, cl.minX + 1, cl.maxX - 1); b.z = clamp(b.z, cl.minZ + 1, cl.maxZ - 1); }
    this.syncFromBody();
    this.moving = Math.min(1, Math.hypot(vx, vz) / 4);
  }

  ai() {}

  animate() {}

  syncMesh(dt, sleeping) {
    const r = this.root;
    r.position.set(this.x, this.y, this.z);
    r.rotation.y = this.yaw;
    const col = this.flash > 0 ? this.flash : 0;
    const sleepTint = sleeping ? 0.4 : 0;
    for (const m of this.mats) {
      if (m.emissive) {
        const base = this.emissiveBase ?? 0;
        m.emissive.setRGB(Math.max(col, base), Math.max(col, base * 0.6, sleepTint * 0.6), Math.max(col, base * 0.3, sleepTint));
        m.opacity = this.alpha;
        m.transparent = this.alpha < 0.99 || m.userData.t;
      }
    }
    // тень
    const fl = this.world.floorBelow(this.x, this.y + 0.5, this.z, 0.3, 40);
    if (fl > -1e8) {
      this.shadow.position.set(this.x, fl + 0.04, this.z);
      const k = this.def.fly ? clamp(1 - (this.y - fl) / 14, 0.25, 1) : 1;
      this.shadow.scale.setScalar(this.def.r * 1.25 * k);
      this.shadow.visible = this.root.visible;
    } else this.shadow.visible = false;
    // полоса HP
    if (this.bar) {
      const show = this.barT > 0 && !this.boss && this.dist2() < 45;
      this.bar.visible = show;
      if (show) {
        this.bar.position.set(this.x, this.y + this.def.h + 0.45, this.z);
        this.barFg.position.x = -this.barW / 2;
        this.barFg.scale.set(this.barW * clamp(this.hp / this.maxHp, 0, 1), 0.11, 1);
        this.barBg.scale.set(this.barW + 0.08, 0.17, 1);
      }
    }
    void dt;
  }

  updateDead(dt) {
    this.deadT += dt;
    const k = clamp(1 - this.deadT / 0.35, 0, 1);
    this.root.scale.set(k, k, k);
    this.root.position.y = this.y - (1 - k) * 0.3;
    this.shadow.visible = false;
    if (this.bar) this.bar.visible = false;
    if (this.deadT > 0.35) this.dispose();
  }

  dispose() {
    this.gone = true;
    this.ents.group.remove(this.root, this.shadow);
    if (this.bar) {
      this.ents.group.remove(this.bar);
      this.barFg.material.dispose(); this.barBg.material.dispose();
    }
    for (const m of this.mats) m.dispose();
    this.root.traverse((c) => { if (c.isMesh && c.geometry && c.geometry !== undefined && !c.geometry.userData?.shared && !c.userData.sharedGeo) c.geometry.dispose?.(); });
  }

  // --------------------------------------------------------------- атаки
  hurtPlayer(dmg = this.dmg, knock = 6, extra = {}) {
    return this.p.hurt(dmg, { from: this, knock, type: 'melee', by: this.name, ...extra });
  }

  /** Выстрел в игрока. o: {type,speed,dmg,color,homing,lead,spread,up,aoe,onHit,grav,life,ramDrain} */
  fire(o = {}) {
    const p = this.p;
    const sp = o.speed ?? 20;
    const ox = this.x + Math.sin(this.yaw) * this.def.r, oz = this.z + Math.cos(this.yaw) * this.def.r;
    const oy = this.y + this.def.h * (o.h ?? 0.65);
    let tx = p.x, ty = p.center, tz = p.z;
    if (o.lead !== false) {
      const d = Math.hypot(tx - ox, ty - oy, tz - oz);
      const t = d / sp * (o.lead ?? 0.7);
      tx += p.body.vx * t; tz += p.body.vz * t;
    }
    let dx = tx - ox, dy = ty - oy, dz = tz - oz;
    if (o.spread) { dx += (Math.random() - 0.5) * o.spread; dy += (Math.random() - 0.5) * o.spread * 0.5; dz += (Math.random() - 0.5) * o.spread; }
    const l = Math.hypot(dx, dy, dz) || 1;
    return this.ents.spawnProjectile({
      x: ox, y: oy, z: oz, vx: (dx / l) * sp, vy: (dy / l) * sp + (o.up ?? 0), vz: (dz / l) * sp,
      dmg: o.dmg ?? this.dmg, type: o.type || 'bolt', color: o.color ?? 0xff5050, homing: o.homing, aoe: o.aoe, grav: o.grav,
      life: o.life, by: this.name, onHit: o.onHit, ramDrain: o.ramDrain, r: o.r, knock: o.knock,
    });
  }
}

// ============================================================================ AI по типам
const AI = {
  // ----------------------------------------------------------------- слизень
  slime(dt, d2) {
    const b = this.body;
    if (!this.aggro) return this.idleWander(dt, 1.0);
    this.cd -= dt; this.cd2 -= dt;
    if (this.state === 'windup') {
      this.st -= dt;
      this.moving = 0;
      this.gravityStep(dt);
      if (this.st <= 0) {
        if (this.dist2() < 3.0) this.hurtPlayer(this.dmg, 7);
        this.state = 'idle'; this.cd = 1.5;
        this.game.fx.burst(this.x, this.y + 0.3, this.z, 6, { speed: 3, size: 0.2, color: 0xc9a0ff, life: 0.3, flat: true });
      }
      return;
    }
    if (this.state === 'spit') {
      this.st -= dt;
      this.faceTo(this.p.x, this.p.z, dt, 14);
      this.gravityStep(dt);
      if (this.st <= 0) {
        this.state = 'idle';
        this.fire({ type: 'popup', speed: 13, dmg: this.dmg * 0.55, color: 0xffffff, lead: 0.3, ramDrain: 6, life: 3.2, onHit: (pr, dealt) => { if (dealt >= 0) this.game.ui.spawnPopup(this); } });
        this.game.audio.sfx('popup');
        this.cd2 = rnd(3.4, 5.2);
      }
      return;
    }
    this.faceTo(this.p.x, this.p.z, dt, 6);
    if (d2 < 2.4 && this.cd <= 0) { this.state = 'windup'; this.st = 0.5; return; }
    if (d2 > 6 && d2 < 26 && this.cd2 <= 0 && this.canSee(dt)) { this.state = 'spit'; this.st = 0.45; return; }
    if (d2 > 2.0) this.walkTo(dt, this.p.x, this.p.z, this.def.speed, 18);
    else this.gravityStep(dt);
    if (b.grounded && d2 > 3 && Math.random() < dt * 0.6) b.vy = 5;
  },

  // ----------------------------------------------------------------- летучая мышь (шпион)
  bat(dt, d2) {
    const p = this.p;
    this.cd -= dt;
    const b = this.body;
    const vis = this.state === 'dive' || this.state === 'retreat' || d2 < 8;
    this.alpha += ((vis ? 1 : 0.07) - this.alpha) * Math.min(1, 6 * dt);
    if (!this.aggro) {
      this.alpha = 0.07;
      const a = this.t * 0.7;
      return this.flyStep(dt, Math.cos(a) * 2, Math.sin(this.t * 1.3) * 0.6, Math.sin(a) * 2);
    }
    if (this.state === 'idle' || this.state === 'hover') {
      this.state = 'hover';
      const a = this.t * 1.3 + this.home.x;
      const tx = p.x + Math.cos(a) * 7, tz = p.z + Math.sin(a) * 7;
      const ty = p.body.y + 2.8 + Math.sin(this.t * 2) * 0.8;
      let vx = tx - b.x, vy = ty - b.y, vz = tz - b.z;
      const l = Math.hypot(vx, vy, vz) || 1;
      this.flyStep(dt, (vx / l) * this.def.speed, (vy / l) * this.def.speed, (vz / l) * this.def.speed);
      this.faceTo(p.x, p.z, dt, 8);
      if (this.cd <= 0 && d2 < 14) { this.state = 'dive'; this.st = 1.1; this.lock = { x: p.x, y: p.center, z: p.z }; this.game.audio.sfx('bat'); }
    } else if (this.state === 'dive') {
      this.st -= dt;
      const tx = p.x, ty = p.center, tz = p.z;
      const dx = tx - b.x, dy = ty - (b.y + 0.4), dz = tz - b.z;
      const l = Math.hypot(dx, dy, dz) || 1;
      const sp = this.def.speed * 2.3;
      this.flyStep(dt, (dx / l) * sp, (dy / l) * sp, (dz / l) * sp);
      this.faceTo(tx, tz, dt, 16);
      if (l < 1.25) {
        const dealt = this.hurtPlayer(this.dmg, 5);
        if (dealt > 0) {
          const steal = Math.max(6, Math.round(this.game.stats.xp * 0.06));
          const took = Math.min(this.game.stats.xp, steal);
          if (took > 0) { this.game.stats.xp -= took; this.stolen = (this.stolen || 0) + took; this.game.ui.damageNumber(p.x, p.y + 2, p.z, `−${took} XP`, 'player'); this.game.audio.sfx('steal'); }
        }
        this.state = 'retreat'; this.st = 1.3; this.cd = rnd(1.2, 2.4);
      } else if (this.st <= 0) { this.state = 'retreat'; this.st = 1.0; this.cd = rnd(1.0, 2.0); }
    } else if (this.state === 'retreat') {
      this.st -= dt;
      const dx = b.x - p.x, dz = b.z - p.z;
      const l = Math.hypot(dx, dz) || 1;
      this.flyStep(dt, (dx / l) * this.def.speed, 3, (dz / l) * this.def.speed);
      if (this.st <= 0) this.state = 'hover';
    }
  },

  // ----------------------------------------------------------------- червь
  worm(dt, d2) {
    const p = this.p;
    const b = this.body;
    this.cd -= dt;
    const parts = this.parts;
    if (this.state === 'idle') { this.state = 'burrow'; }
    if (this.state === 'burrow') {
      this.invulnerable = true;
      this.root.visible = false;
      this.shadow.visible = false;
      // едем под землёй к игроку
      const dx = p.x - b.x, dz = p.z - b.z;
      const l = Math.hypot(dx, dz) || 1;
      const sp = this.def.speed * this.slow;
      b.x += (dx / l) * sp * dt; b.z += (dz / l) * sp * dt;
      b.y = this.world.groundY(b.x, b.z) - 0.2;
      const fl = this.world.floorBelow(b.x, b.y + 2, b.z, 0.3, 30);
      if (fl > -1e8) b.y = fl - 0.1;
      this.syncFromBody();
      if (Math.random() < dt * 8) this.game.fx.emit(b.x, b.y + 0.1, b.z, { vx: (Math.random() - 0.5) * 2, vy: 2.5, vz: (Math.random() - 0.5) * 2, life: 0.4, size: 0.2, color: 0x7a5a3a, grav: 8 });
      // грызём разрушаемые блоки
      const z = this.game.zone;
      for (const d of z.destructibles) {
        if (!d.alive) continue;
        if (Math.hypot(d.x - b.x, d.z - b.z) < Math.max(d.sx, d.sz) * 0.7 + 1.2 && Math.abs(d.y - b.y) < 6) {
          d.hp -= 22 * dt;
          if (d.hp <= 0) { d.alive = false; d.box.enabled = false; d.mesh.visible = false; d.respawn = 18; this.game.fx.burst(d.x, d.y, d.z, 14, { speed: 4, size: 0.3, color: 0x7a8a76, grav: 10 }); }
        }
      }
      if (l < 4 && this.cd <= 0 && this.canSee(dt) || l < 3) { this.state = 'erupt'; this.st = 0.7; this.eruptPos = { x: b.x, z: b.z }; this.root.visible = true; this.game.audio.sfx('rumble'); }
      return;
    }
    if (this.state === 'erupt') {
      this.st -= dt;
      this.root.visible = true;
      const k = 1 - clamp(this.st / 0.7, 0, 1);
      this.root.scale.y = 0.15 + k * 0.85;
      if (Math.random() < dt * 20) this.game.fx.emit(b.x + (Math.random() - 0.5) * 2, b.y + 0.2, b.z + (Math.random() - 0.5) * 2, { vx: 0, vy: 4, vz: 0, life: 0.4, size: 0.22, color: 0x8a6a4a, grav: 9 });
      if (this.st <= 0) {
        this.state = 'up'; this.st = 3.0; this.invulnerable = false; this.bit = false;
        this.game.fx.ring(b.x, b.y + 0.2, b.z, 18, 2.4, { color: 0x8a6a4a, size: 0.25, life: 0.45, speed: 5, grav: 4 });
        this.game.shake(0.3);
      }
      return;
    }
    if (this.state === 'up') {
      this.st -= dt;
      this.faceTo(p.x, p.z, dt, 8);
      this.root.scale.y = 1;
      this.root.visible = true;
      if (!this.bit && this.st < 2.5 && d2 < 3.4) {
        this.bit = true;
        this.hurtPlayer(this.dmg, 9);
        this.game.audio.sfx('bite');
      }
      if (this.st <= 1.9 && !this.bit2 && d2 < 3.6) { this.bit2 = true; this.hurtPlayer(this.dmg * 0.7, 7); }
      if (this.st <= 0) { this.state = 'burrow'; this.cd = rnd(1.5, 3); this.bit2 = false; this.root.scale.y = 1; }
    }
    void parts;
  },

  // ----------------------------------------------------------------- голем
  golem(dt, d2) {
    const p = this.p;
    this.cd -= dt;
    this.heavy = true;
    // утечка RAM
    if (this.aggro && d2 < 14) {
      p.ramDrain = 1.2;
      p.ram = Math.max(0, p.ram - 6 * dt);
      if (this.game.clockT % 1.2 < dt) this.game.ui.toastOnce('golem_ram', 'Bloatware-голем пожирает вашу RAM! Держитесь подальше или бейте быстрее.', 3500);
    }
    if (!this.aggro) return this.idleWander(dt, 0.6);
    if (this.state === 'slam') {
      this.st -= dt;
      this.gravityStep(dt);
      const k = clamp(1 - this.st / 1.0, 0, 1);
      this.slamK = k;
      if (this.st <= 0) {
        this.state = 'idle'; this.cd = rnd(2.6, 3.8); this.slamK = 0;
        const b = this.body;
        const fx = b.x + Math.sin(this.yaw) * 2.6, fz = b.z + Math.cos(this.yaw) * 2.6;
        this.game.fx.ring(fx, b.y + 0.2, fz, 34, 5.5, { color: 0xc9d4ff, color1: 0x5a6a9a, size: 0.35, life: 0.6, speed: 9, grav: 3 });
        this.game.audio.sfx('slam');
        this.game.shake(0.9);
        const pd = Math.hypot(p.x - fx, p.z - fz);
        if (pd < 5.8 && p.body.y < b.y + 2.2) this.hurtPlayer(this.dmg, 14, { type: 'blast' });
      }
      return;
    }
    this.faceTo(p.x, p.z, dt, 3);
    if (d2 < 5.2 && this.cd <= 0) { this.state = 'slam'; this.st = 1.0; this.game.audio.sfx('windup'); return; }
    if (d2 > 3.2) this.walkTo(dt, p.x, p.z, this.def.speed, 10);
    else this.gravityStep(dt);
  },

  // ----------------------------------------------------------------- Popup-птица
  bird(dt, d2) {
    const p = this.p;
    this.cd -= dt;
    const b = this.body;
    if (!this.aggro) {
      const a = this.t * 0.8 + this.home.x;
      return this.flyStep(dt, Math.cos(a) * 2.5, Math.sin(this.t * 2) * 0.5, Math.sin(a) * 2.5);
    }
    if (this.state === 'dive') {
      this.st -= dt;
      const dx = this.lock.x - b.x, dy = this.lock.y - (b.y + 0.3), dz = this.lock.z - b.z;
      const l = Math.hypot(dx, dy, dz) || 1;
      const sp = this.def.speed * 1.7;
      this.flyStep(dt, (dx / l) * sp, (dy / l) * sp, (dz / l) * sp);
      this.faceTo(this.lock.x, this.lock.z, dt, 16);
      if (Math.hypot(p.x - b.x, p.center - (b.y + 0.3), p.z - b.z) < 1.1) {
        this.hurtPlayer(this.dmg, 5);
        this.state = 'circle'; this.cd = rnd(1.6, 3.4);
      } else if (this.st <= 0 || l < 1.2) { this.state = 'circle'; this.cd = rnd(1.2, 3.0); }
      return;
    }
    this.state = 'circle';
    const a = this.t * 1.1 + (this.home.x + this.gen * 2);
    const R = 8 + (this.home.z % 3);
    const tx = p.x + Math.cos(a) * R, tz = p.z + Math.sin(a) * R;
    const ty = Math.max(p.body.y + 3.2, this.world.groundY(tx, tz) + 3.5) + Math.sin(this.t * 3) * 0.6;
    const dx = tx - b.x, dy = ty - b.y, dz = tz - b.z;
    const l = Math.hypot(dx, dy, dz) || 1;
    this.flyStep(dt, (dx / l) * this.def.speed, (dy / l) * this.def.speed, (dz / l) * this.def.speed);
    this.faceTo(p.x, p.z, dt, 8);
    if (this.cd <= 0 && d2 < 22) { this.state = 'dive'; this.st = 1.0; this.lock = { x: p.x, y: p.center, z: p.z }; }
  },

  // ----------------------------------------------------------------- процесс-солдат
  soldier(dt, d2) {
    const p = this.p;
    this.cd -= dt; this.cd2 -= dt;
    if (!this.aggro) return this.idleWander(dt, 1.4);
    this.faceTo(p.x, p.z, dt, 8);
    if (this.state === 'aim') {
      this.st -= dt;
      this.moving = 0;
      this.gravityStep(dt);
      if (this.st <= 0) {
        this.fire({ speed: 26, dmg: this.dmg, color: 0xffb040, lead: 0.8, spread: 0.6 });
        this.game.audio.sfx('shoot');
        this.state = 'idle'; this.cd = rnd(2.0, 3.0);
      }
      return;
    }
    // держим дистанцию 7–14
    const side = this.o.side ?? (this.o.side = Math.random() < 0.5 ? 1 : -1);
    let tx = this.x, tz = this.z;
    const ax = (p.x - this.x) / (d2 || 1), az = (p.z - this.z) / (d2 || 1);
    if (d2 > 14) { tx = p.x; tz = p.z; }
    else if (d2 < 6.5) { tx = this.x - ax * 4; tz = this.z - az * 4; }
    else { tx = this.x - az * side * 3; tz = this.z + ax * side * 3; }
    this.walkTo(dt, tx, tz, this.def.speed, 22);
    if (this.cd <= 0 && d2 < 30 && this.canSee(dt)) { this.state = 'aim'; this.st = 0.42; this.game.audio.sfx('windup'); }
  },

  // ----------------------------------------------------------------- призрак
  ghost(dt, d2) {
    const p = this.p;
    this.cd -= dt;
    const b = this.body;
    const ph = Math.sin(this.t * 0.9 + this.home.x);
    this.alpha = 0.3 + (ph * 0.5 + 0.5) * 0.65;
    this.intangible = this.alpha < 0.36;
    if (!this.aggro) return this.flyStep(dt, Math.cos(this.t * 0.5) * 1.4, Math.sin(this.t) * 0.4, Math.sin(this.t * 0.5) * 1.4);
    const dx = p.x - b.x, dy = p.body.y + 0.6 - b.y, dz = p.z - b.z;
    const l = Math.hypot(dx, dy, dz) || 1;
    const sp = this.def.speed * (this.intangible ? 1.35 : 1);
    this.flyStep(dt, (dx / l) * sp, (dy / l) * sp * 0.8, (dz / l) * sp);
    this.faceTo(p.x, p.z, dt, 5);
    if (l < 1.7 && this.cd <= 0) {
      this.cd = 0.8;
      this.hurtPlayer(this.dmg, 3, { iframes: 0.4 });
      this.p.ram = Math.max(0, this.p.ram - 4);
    }
    if (this.cd2 <= 0 && d2 > 6 && d2 < 24) { this.cd2 = rnd(4, 6); this.fire({ type: 'orb', speed: 10, color: 0xcfd8ff, dmg: this.dmg * 0.8, homing: 1.8, life: 4.5 }); }
    else this.cd2 -= dt;
  },

  // ----------------------------------------------------------------- хакер
  hacker(dt, d2) {
    const p = this.p;
    this.cd -= dt; this.cd2 -= dt;
    if (!this.aggro) return this.idleWander(dt, 1.2);
    this.faceTo(p.x, p.z, dt, 10);
    if (this.state === 'burst') {
      this.st -= dt;
      this.gravityStep(dt);
      this.shots = this.shots ?? 3;
      if (this.st <= 0 && this.shots > 0) {
        this.fire({ speed: 34, dmg: this.dmg * 0.75, color: 0x3cff6a, lead: 0.9, spread: 0.5 });
        this.game.audio.sfx('shoot');
        this.shots--; this.st = 0.16;
      }
      if (this.shots <= 0) { this.state = 'blink'; this.st = 0.3; }
      return;
    }
    if (this.state === 'blink') {
      this.st -= dt;
      this.gravityStep(dt);
      if (this.st <= 0) {
        const a = Math.random() * Math.PI * 2, r = rnd(6, 11);
        const nx = p.x + Math.cos(a) * r, nz = p.z + Math.sin(a) * r;
        const gy = this.world.floorBelow(nx, this.y + 4, nz, 0.4, 14);
        if (gy > -1e8 && !this.world.overlaps(nx, gy + 0.1, nz, 0.5, 2.0)) {
          this.game.fx.burst(this.x, this.y + 1, this.z, 14, { speed: 4, size: 0.2, color: 0x3cff6a, glow: true, life: 0.4 });
          this.body.x = nx; this.body.z = nz; this.body.y = gy; this.body.vy = 0;
          this.syncFromBody();
          this.game.fx.burst(nx, gy + 1, nz, 14, { speed: 4, size: 0.2, color: 0x3cff6a, glow: true, life: 0.4 });
          this.game.audio.sfx('blink');
        }
        this.state = 'idle'; this.cd = rnd(1.8, 2.8);
      }
      return;
    }
    const ax = (p.x - this.x) / (d2 || 1), az = (p.z - this.z) / (d2 || 1);
    const side = this.o.side ?? (this.o.side = Math.random() < 0.5 ? 1 : -1);
    let tx = this.x - az * side * 4, tz = this.z + ax * side * 4;
    if (d2 > 16) { tx = p.x; tz = p.z; } else if (d2 < 5) { tx = this.x - ax * 5; tz = this.z - az * 5; }
    this.walkTo(dt, tx, tz, this.def.speed, 26);
    if (this.cd <= 0 && d2 < 30 && this.canSee(dt)) { this.state = 'burst'; this.st = 0.35; this.shots = 3; this.game.audio.sfx('windup'); }
  },

  // ----------------------------------------------------------------- дрон-майнер
  miner(dt, d2) {
    const p = this.p;
    this.cd -= dt;
    const b = this.body;
    if (!this.aggro) return this.flyStep(dt, Math.cos(this.t * 0.6) * 1.5, Math.sin(this.t * 1.1) * 0.5, Math.sin(this.t * 0.6) * 1.5);
    if (this.state === 'lock') {
      this.st -= dt;
      this.flyStep(dt, 0, Math.sin(this.t * 6) * 0.4, 0);
      const pr = this.parts;
      void pr;
      // линия прицела
      const L = this.lock;
      this.game.fx.line(b.x, b.y + 0.5, b.z, L.x, L.y, L.z, 2, { glow: true, color: 0xff4040, life: 0.12, size: 0.1, jitter: 0.1 });
      if (this.st <= 0) {
        this.state = 'idle'; this.cd = rnd(2.6, 3.8);
        this.game.audio.sfx('laser');
        this.game.fx.line(b.x, b.y + 0.5, b.z, L.x, L.y, L.z, 26, { glow: true, color: 0xffd23f, color1: 0xff5030, life: 0.3, size: 0.22, jitter: 0.6 });
        // попадание: расстояние от груди игрока до отрезка
        const ox = b.x, oy = b.y + 0.5, oz = b.z;
        const vx = L.x - ox, vy = L.y - oy, vz = L.z - oz;
        const len2 = vx * vx + vy * vy + vz * vz || 1;
        // продлеваем луч за точку прицеливания
        const px = p.x - ox, py = p.center - oy, pz = p.z - oz;
        const t = clamp((px * vx + py * vy + pz * vz) / len2, 0, 1.6);
        const d = Math.hypot(px - vx * t, py - vy * t, pz - vz * t);
        if (d < 1.15 && !this.world.blocked(ox, oy, oz, p.x, p.center, p.z)) this.hurtPlayer(this.dmg, 6, { type: 'laser' });
      }
      return;
    }
    // держим дистанцию
    const tdist = 11;
    const dx = p.x - b.x, dz = p.z - b.z;
    const l = Math.hypot(dx, dz) || 1;
    const ang = this.t * 0.5 + this.home.x;
    let tx = p.x - (dx / l) * tdist + Math.cos(ang) * 3, tz = p.z - (dz / l) * tdist + Math.sin(ang) * 3;
    if (l < tdist - 3) { tx = b.x - (dx / l) * 6; tz = b.z - (dz / l) * 6; }
    const ty = Math.max(p.body.y + 4.5, this.world.groundY(tx, tz) + 4.5);
    const vx = tx - b.x, vy = ty - b.y, vz = tz - b.z;
    const vl = Math.hypot(vx, vy, vz) || 1;
    this.flyStep(dt, (vx / vl) * this.def.speed, (vy / vl) * this.def.speed, (vz / vl) * this.def.speed);
    this.faceTo(p.x, p.z, dt, 6);
    if (this.cd <= 0 && d2 < 30 && this.canSee(dt)) { this.state = 'lock'; this.st = 1.15; this.lock = { x: p.x, y: p.center, z: p.z }; this.game.audio.sfx('windup'); }
  },

  // ----------------------------------------------------------------- глитч
  glitch(dt, d2) {
    const p = this.p;
    this.cd -= dt; this.cd2 -= dt;
    if (!this.aggro) return this.idleWander(dt, 1.2);
    if (this.state === 'fuse') {
      this.st -= dt;
      this.gravityStep(dt);
      this.flash = Math.abs(Math.sin(this.t * 30));
      if (this.st <= 0) { this.explode(); }
      return;
    }
    this.faceTo(p.x, p.z, dt, 8);
    // рывки-«лаги»
    if (this.cd2 <= 0) {
      this.cd2 = rnd(0.7, 1.3);
      const dx = p.x - this.x, dz = p.z - this.z, l = Math.hypot(dx, dz) || 1;
      const step = Math.min(3.2, l - 1.2);
      if (step > 0.5) {
        const nx = this.x + (dx / l) * step + (Math.random() - 0.5) * 1.6, nz = this.z + (dz / l) * step + (Math.random() - 0.5) * 1.6;
        const gy = this.world.floorBelow(nx, this.y + 2, nz, 0.5, 6);
        if (gy > -1e8 && !this.world.overlaps(nx, gy + 0.2, nz, 0.6, 1)) {
          this.game.fx.burst(this.x, this.y + 0.6, this.z, 5, { speed: 2, size: 0.18, color: 0x2affd0, glow: true, life: 0.25 });
          this.body.x = nx; this.body.z = nz; this.body.y = gy;
          this.syncFromBody();
        }
      }
    }
    this.walkTo(dt, p.x, p.z, this.def.speed * 0.6, 16);
    if (d2 < 2.2) { this.state = 'fuse'; this.st = 0.7; this.game.audio.sfx('windup'); }
  },
};

Enemy.prototype.ai = function (dt, d2) {
  const f = AI[this.kind];
  if (f) f.call(this, dt, d2);
};

Enemy.prototype.idleWander = function (dt, speed) {
  const w = this.wander;
  w.t -= dt;
  if (w.t <= 0) {
    w.t = rnd(2, 5);
    const a = Math.random() * Math.PI * 2, r = rnd(0, 6);
    w.x = this.home.x + Math.cos(a) * r; w.z = this.home.z + Math.sin(a) * r;
    if (Math.random() < 0.35) w.t += 2;
  }
  if (this.def.fly) { this.flyStep(dt, 0, 0, 0); return; }
  const d = Math.hypot(w.x - this.x, w.z - this.z);
  if (d > 0.8 && w.t < 6) { this.faceTo(w.x, w.z, dt, 4); this.walkTo(dt, w.x, w.z, speed); }
  else this.gravityStep(dt);
};

Enemy.prototype.explode = function () {
  if (this.dead) return;
  const g = this.game, p = this.p;
  g.fx.burst(this.x, this.y + 0.6, this.z, 30, { speed: 7, size: 0.28, color: 0xff2a6a, color1: 0x2affd0, glow: true, life: 0.6 });
  g.audio.sfx('boom');
  g.shake(0.5);
  if (Math.hypot(p.x - this.x, p.center - this.cy, p.z - this.z) < 4.2) p.hurt(this.dmg, { from: this, knock: 10, type: 'blast', by: this.name });
  for (const e of this.ents.enemies) if (e !== this && !e.dead && Math.hypot(e.x - this.x, e.z - this.z) < 4) e.takeHit(this.dmg * 0.8, { from: this, knock: 6, aoe: true, noHitstop: true });
  this.die({ silent: true });
};

// ============================================================================ анимации
Enemy.prototype.animate = function (dt) {
  const P = this.parts, t = this.t;
  switch (this.kind) {
    case 'slime': {
      const k = this.state === 'windup' ? 1.25 - (this.st / 0.5) * 0.4 : 1;
      P.body.scale.y = (0.78 + Math.sin(t * 4) * 0.05) * 0.85 * k;
      P.body.scale.x = P.body.scale.z = 0.85 * (1 - (k - 1) * 0.3);
      if (P.ad) { P.ad.rotation.y = Math.sin(t * 1.5) * 0.3; P.ad.position.y = 1.5 + Math.sin(t * 2) * 0.05; }
      break;
    }
    case 'bat':
    case 'bird': {
      const f = this.kind === 'bat' ? 14 : 18;
      const fl = Math.sin(t * f) * 0.8;
      P.wingL.rotation.z = fl; P.wingR.rotation.z = -fl;
      break;
    }
    case 'worm': {
      if (P.segs) P.segs.forEach((s, i) => { s.position.x = Math.sin(t * 4 + i * 0.8) * 0.12 * i; s.position.z = Math.cos(t * 3 + i) * 0.08 * i; });
      break;
    }
    case 'golem': {
      const sw = Math.sin(t * 2.4) * 0.3 * this.moving;
      const k = this.state === 'slam' ? (this.slamK || 0) : 0;
      P.armL.rotation.x = sw - k * 3.0; P.armR.rotation.x = -sw - k * 3.0;
      P.legL.rotation.x = -sw; P.legR.rotation.x = sw;
      P.core.scale.setScalar(0.3 + Math.sin(t * 5) * 0.03);
      P.bar.scale.x = Math.max(0.1, 0.5 + Math.sin(t * 0.8) * 0.45);
      P.bar.position.x = -0.85 + P.bar.scale.x * 0.85;
      break;
    }
    case 'soldier': {
      const sw = Math.sin(t * 9) * 0.6 * this.moving;
      P.legL.rotation.x = sw; P.legR.rotation.x = -sw;
      P.armL.rotation.x = -sw * 0.5;
      break;
    }
    case 'ghost': {
      P.body.position.y = Math.sin(t * 2) * 0.12;
      P.tail.rotation.y = t * 0.8;
      break;
    }
    case 'miner': {
      P.rotor.rotation.y = t * 30;
      break;
    }
    case 'glitch': {
      P.cubes.forEach((c, i) => {
        const j = Math.sin(t * 13 + i * 3) > 0.6 ? 0.25 : 0.0;
        c.position.x = (i & 1 ? 0.3 : -0.3) + (Math.random() - 0.5) * j;
        c.position.z = (i & 4 ? 0.3 : -0.3) + (Math.random() - 0.5) * j;
        c.rotation.y += dt * (i % 2 ? 2 : -2);
      });
      break;
    }
    default:
  }
};
