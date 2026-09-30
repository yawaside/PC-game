import * as THREE from 'three';
import { Enemy, ENEMIES } from './enemy.js';
import { Projectile } from './projectile.js';
import { Pickup } from './pickup.js';
import { NPC, Ally } from './npc.js';
import { BOSSES } from './bosses/index.js';
import { rollLoot } from '../data/items.js';
import { ALLIES } from '../data/allies.js';
import { canvasTexture } from '../gfx/text.js';

/** Цель, по которой можно бить (кристаллы, замки, пилоны). */
class Target {
  constructor(ents, o) {
    this.ents = ents;
    this.game = ents.game;
    this.o = o;
    this.x = o.x; this.y = o.y; this.z = o.z;
    this.def = { r: o.r ?? 1, h: o.h ?? 2 };
    this.maxHp = o.hp ?? 60;
    this.hp = this.maxHp;
    this.dead = false;
    this.flash = 0;
    this.mesh = o.mesh || null;
    if (this.mesh) ents.group.add(this.mesh);
    this.isTarget = true;
    this.intangible = false;
  }
  get cy() { return this.y + this.def.h * 0.5; }
  takeHit(dmg, info = {}) {
    if (this.dead) return 0;
    if (this.o.accept && !this.o.accept(info)) {
      this.game.fx.burst(this.x, this.cy, this.z, 5, { speed: 3, size: 0.14, color: 0xaaaaaa, glow: true, life: 0.25 });
      this.game.ui.damageNumber(this.x, this.y + this.def.h, this.z, 'не пробить', '');
      return 0;
    }
    dmg = Math.max(1, Math.round(dmg));
    this.hp -= dmg;
    this.flash = 1;
    this.game.ui.damageNumber(this.x, this.y + this.def.h + 0.2, this.z, String(dmg), info.crit ? 'crit' : '');
    this.o.onHit?.(this, dmg, info);
    if (this.hp <= 0) {
      this.dead = true;
      this.game.fx.burst(this.x, this.cy, this.z, 24, { speed: 6, size: 0.25, color: this.o.color ?? 0xffffff, glow: true, life: 0.7 });
      this.game.audio.sfx('break');
      if (this.mesh) this.ents.group.remove(this.mesh);
      this.o.onDie?.(this);
    }
    return dmg;
  }
  update(dt) {
    this.flash = Math.max(0, this.flash - dt * 5);
    this.o.update?.(this, dt);
    if (this.mesh) this.mesh.traverse((c) => { if (c.isMesh && c.material?.emissive) c.material.emissive.setScalar(this.flash * 0.8); });
  }
}

/** Менеджер всех динамических объектов зоны. */
export class Entities {
  constructor(game) {
    this.game = game;
    this.group = new THREE.Group();
    game.scene.add(this.group);
    this.enemies = [];
    this.npcs = [];
    this.pickups = [];
    this.projectiles = [];
    this.targets = [];
    this.allies = [];
    this.effects = [];
    this.extraInteract = [];
    this.boss = null;
    this.allyTypes = [];
    this._popupMat = null;
  }

  popupMat() {
    if (!this._popupMat) {
      const t = canvasTexture(64, 48, (g) => {
        g.fillStyle = '#c0c0c0'; g.fillRect(0, 0, 64, 48);
        g.fillStyle = '#000080'; g.fillRect(2, 2, 60, 9);
        g.fillStyle = '#ffffff'; g.fillRect(3, 13, 58, 32);
        g.fillStyle = '#d00'; g.fillRect(52, 4, 8, 5);
        g.fillStyle = '#f00'; g.font = '700 14px monospace'; g.fillText('WIN!!!', 8, 30);
        g.fillStyle = '#000'; g.fillRect(8, 36, 40, 3);
      });
      t.magFilter = THREE.NearestFilter;
      t.userData.shared = true;
      this._popupMat = new THREE.MeshBasicMaterial({ map: t, side: THREE.DoubleSide });
    }
    return this._popupMat;
  }

  // ------------------------------------------------------------ загрузка зоны
  loadZone(zone) {
    const g = this.game;
    for (const d of zone.npcDefs) this.spawnNpc(d);
    for (const e of zone.enemyDefs) {
      if (e.id && g.flag(`dead_${e.id}`)) continue;
      if (e.when && !e.when(g)) continue;
      this.spawnEnemy(e.type, e.x, e.z, e);
    }
    for (const p of zone.pickupDefs) {
      if (p.kind === 'hidden' && g.hidden.has(p.hiddenId)) continue;
      if (p.when && !p.when(g)) continue;
      if (p.kind === 'chest') {
        const pk = this.spawnPickup('chest', p.x, p.y, p.z, { ...p, id: p.chestId });
        if (p.chestId && g.opened.has(p.chestId)) { pk.opened = true; pk.openT = 1; pk.lid.rotation.x = -1.9; pk.halo.material.opacity = 0.1; }
      } else if (p.kind === 'hidden') this.spawnPickup('hidden', p.x, p.y, p.z, p);
      else this.spawnPickup(p.kind, p.x, p.y, p.z, { ...p, pop: false });
    }
    for (const t of zone.targetDefs) this.spawnTarget(t);
    // союзники следуют за игроком
    for (const t of this.allyTypes) this.spawnAlly(t, true);
  }

  clear() {
    for (const e of this.enemies) e.dispose?.();
    for (const n of this.npcs) n.dispose();
    for (const p of this.projectiles) p.dispose();
    for (const p of this.pickups) if (!p.dead) this.group.remove(p.group);
    for (const a of this.allies) a.dispose();
    for (const t of this.targets) if (t.mesh) this.group.remove(t.mesh);
    for (const f of this.effects) f.dispose?.();
    this.enemies = []; this.npcs = []; this.projectiles = []; this.pickups = []; this.targets = [];
    this.allies = []; this.effects = []; this.extraInteract = [];
    this.boss = null;
    // прицельно очищаем всё оставшееся в группе
    while (this.group.children.length) this.group.remove(this.group.children[0]);
    this.game.ui?.clearPopups?.();
  }

  // ------------------------------------------------------------ создание
  spawnNpc(d) {
    const n = new NPC(this, d);
    this.npcs.push(n);
    return n;
  }

  spawnEnemy(type, x, z, o = {}) {
    const bossCls = BOSSES[type];
    let e;
    if (bossCls) {
      e = new bossCls(this, type, x, z, o);
      this.boss = e;
    } else {
      if (!ENEMIES[type] && !o.def) return null;
      e = new Enemy(this, type, x, z, o);
    }
    this.enemies.push(e);
    return e;
  }

  spawnPickup(kind, x, y, z, o = {}) {
    const p = new Pickup(this, kind, x, y, z, o);
    this.pickups.push(p);
    return p;
  }

  spawnTarget(o) {
    const t = new Target(this, o);
    this.targets.push(t);
    return t;
  }

  spawnProjectile(o) {
    const p = new Projectile(this, o);
    this.projectiles.push(p);
    return p;
  }

  spawnAlly(type, silent = false) {
    const g = this.game;
    const p = g.player;
    const a = new Ally(this, type, p.x + (Math.random() - 0.5) * 3, p.z + 2 + Math.random() * 2);
    this.allies.push(a);
    if (!silent) {
      this.allyTypes.push(type);
      const def = ALLIES[type];
      for (const [k, v] of Object.entries(def.bonus || {})) g.stats.passives[k] = (g.stats.passives[k] || 0) + v;
      g.inv.clampVitals();
      g.ui.toast(`${def.name} теперь с вами! (${def.desc})`, 'good', 4500);
      g.events.emit('allyJoined', type);
    }
    return a;
  }

  allyIds() { return [...this.allyTypes]; }
  restoreAllies(list) {
    this.allyTypes = [];
    this.game.stats.passives = { cpu: 0, ram: 0, storage: 0, bandwidth: 0, hp: 0, dmg: 0 };
    for (const t of list) {
      this.allyTypes.push(t);
      const def = ALLIES[t];
      if (def) for (const [k, v] of Object.entries(def.bonus || {})) this.game.stats.passives[k] = (this.game.stats.passives[k] || 0) + v;
    }
  }

  dropLoot(x, y, z, table, n = 1) {
    for (let i = 0; i < n; i++) {
      const id = rollLoot(table);
      this.spawnPickup('item', x, y, z, { item: id, amount: 1 });
    }
  }

  addEffect(e) { this.effects.push(e); return e; }

  // ------------------------------------------------------------ выборки
  enemiesNear(x, y, z, r, out = []) {
    out.length = 0;
    for (const e of this.enemies) {
      if (e.dead) continue;
      if (Math.hypot(e.x - x, e.cy - y, e.z - z) <= r + e.def.r) out.push(e);
    }
    return out;
  }

  get aliveCount() {
    let n = 0;
    for (const e of this.enemies) if (!e.dead) n++;
    return n;
  }

  interactables() {
    const out = [];
    for (const n of this.npcs) out.push(n.interact);
    for (const p of this.pickups) if (p.interact && !p.dead) out.push(p.interact);
    for (const i of this.extraInteract) out.push(i);
    return out;
  }

  // ------------------------------------------------------------ обновление
  update(dt) {
    for (const n of this.npcs) n.update(dt);
    for (const a of this.allies) a.update(dt);
    const en = this.enemies;
    for (let i = 0; i < en.length; i++) en[i].update(dt);
    for (let i = en.length - 1; i >= 0; i--) if (en[i].gone) en.splice(i, 1);
    if (this.boss && this.boss.gone) this.boss = null;
    const pr = this.projectiles;
    for (let i = 0; i < pr.length; i++) if (!pr[i].dead) pr[i].update(dt);
    for (let i = pr.length - 1; i >= 0; i--) if (pr[i].dead) { pr[i].dispose(); pr.splice(i, 1); }
    const pk = this.pickups;
    for (let i = 0; i < pk.length; i++) if (!pk[i].dead) pk[i].update(dt);
    for (let i = pk.length - 1; i >= 0; i--) if (pk[i].dead) pk.splice(i, 1);
    for (const t of this.targets) if (!t.dead) t.update(dt);
    for (let i = this.targets.length - 1; i >= 0; i--) if (this.targets[i].dead) this.targets.splice(i, 1);
    for (let i = this.effects.length - 1; i >= 0; i--) {
      const f = this.effects[i];
      f.update(dt);
      if (f.dead) { f.dispose?.(); this.effects.splice(i, 1); }
    }
  }

  /** Лёгкий апдейт (диалог/панель): NPC двигаются, враги — нет. */
  updateIdle(dt) {
    for (const n of this.npcs) n.update(dt);
    for (const p of this.pickups) if (!p.dead) p.update(dt * 0.0001);
  }
}
