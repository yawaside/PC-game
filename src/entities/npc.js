import * as THREE from 'three';
import { makeNpcModel } from './models.js';
import { makeLabel } from '../gfx/text.js';
import { NPC_INFO, NPC_LOOK } from '../data/npcs.js';
import { angleDiff } from '../core/util.js';
import { makeBody, moveBody } from '../physics/body.js';
import { ALLIES } from '../data/allies.js';

/** Неигровой персонаж: стоит, смотрит на игрока, отвечает на E. */
export class NPC {
  constructor(ents, def) {
    this.ents = ents;
    this.game = ents.game;
    const info = NPC_INFO[def.id] || { name: def.name || def.id };
    const look = def.look || NPC_LOOK[def.id] || { body: 0xdddddd, acc: 0x888888, shape: 'file', scale: 1 };
    this.id = def.id;
    this.def = def;
    this.name = def.name || info.name;
    this.x = def.x; this.z = def.z;
    const w = this.game.zone.world;
    this.y = def.y ?? w.groundY(def.x, def.z);
    this.yaw = def.yaw || 0;
    this.baseYaw = this.yaw;
    this.t = Math.random() * 6;
    this.gone = false;
    const m = makeNpcModel(look);
    this.root = m.root;
    this.root.scale.setScalar(look.scale || 1);
    this.root.position.set(this.x, this.y, this.z);
    ents.group.add(this.root);
    this.label = makeLabel(this.name, { size: 40, color: '#ffffff', width: 2.6, border: null });
    this.label.position.set(this.x, this.y + 2.6 * (look.scale || 1) + 0.3, this.z);
    ents.group.add(this.label);
    this.shadow = new THREE.Mesh(new THREE.CircleGeometry(0.8, 12).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0, transparent: true, opacity: 0.3, depthWrite: false }));
    this.shadow.position.set(this.x, this.y + 0.04, this.z);
    ents.group.add(this.shadow);
    this.interact = {
      x: this.x, y: this.y, z: this.z, r: def.r ?? 3.2,
      prompt: () => (def.prompt ? (typeof def.prompt === 'function' ? def.prompt(this.game, this) : def.prompt) : `Поговорить: ${this.name}`),
      enabled: () => !this.gone && !(def.hideIf && def.hideIf(this.game)),
      use: () => {
        if (def.use) return def.use(this.game, this);
        if (!this.game.dialogs.talk(this.id, { x: this.x, z: this.z })) this.game.ui.toast(`${this.name}: «…»`, 'info');
      },
    };
  }

  update(dt) {
    const g = this.game;
    this.t += dt;
    if (this.def.hideIf && this.def.hideIf(g)) {
      if (!this.gone) { this.gone = true; this.root.visible = false; this.label.visible = false; this.shadow.visible = false; }
      return;
    }
    if (this.gone) { this.gone = false; this.root.visible = true; this.label.visible = true; this.shadow.visible = true; }
    const p = g.player;
    const d = Math.hypot(p.x - this.x, p.z - this.z);
    let want = this.baseYaw;
    if (d < 11 && !this.def.still) want = Math.atan2(p.x - this.x, p.z - this.z);
    this.yaw += angleDiff(this.yaw, want) * Math.min(1, 5 * dt);
    this.root.rotation.y = this.yaw;
    this.root.position.y = this.y + Math.sin(this.t * 2) * 0.05;
    this.label.visible = d < 28;
  }

  dispose() {
    this.ents.group.remove(this.root, this.label, this.shadow);
  }
}

/** Союзник: следует за игроком и помогает в бою. */
export class Ally {
  constructor(ents, type, x, z) {
    this.ents = ents;
    this.game = ents.game;
    this.type = type;
    const def = ALLIES[type] || ALLIES.prisoner;
    this.def = def;
    this.name = def.name;
    const m = makeNpcModel(def.look);
    this.root = m.root;
    this.root.scale.setScalar(def.look.scale || 1);
    ents.group.add(this.root);
    this.body = makeBody(0.4, 1.8, 0.6);
    this.body.x = x; this.body.z = z;
    this.body.y = this.game.zone.world.floorBelow(x, this.game.player.body.y + 3, z, 0.3, 50);
    if (!(this.body.y > -1e8)) this.body.y = this.game.player.body.y;
    this.yaw = 0;
    this.cd = 1;
    this.t = Math.random() * 5;
    this.dead = false;
    this.shadow = new THREE.Mesh(new THREE.CircleGeometry(0.6, 10).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0, transparent: true, opacity: 0.3, depthWrite: false }));
    ents.group.add(this.shadow);
    this.label = makeLabel(this.name, { size: 36, color: '#b7ffca', width: 2.0 });
    ents.group.add(this.label);
  }

  get x() { return this.body.x; }
  get y() { return this.body.y; }
  get z() { return this.body.z; }

  update(dt) {
    const g = this.game, p = g.player, b = this.body, w = g.zone.world;
    this.t += dt;
    this.cd -= dt;
    // цель — ближайший враг
    let tgt = null, bd = 16;
    for (const e of this.ents.enemies) {
      if (e.dead || e.intangible || e.invulnerable) continue;
      const d = Math.hypot(e.x - b.x, e.z - b.z);
      if (d < bd) { bd = d; tgt = e; }
    }
    let tx = p.x, tz = p.z, speed = 6.5;
    const dp = Math.hypot(p.x - b.x, p.z - b.z);
    if (tgt && dp < 22) { tx = tgt.x; tz = tgt.z; speed = 7.5; }
    const dx = tx - b.x, dz = tz - b.z, l = Math.hypot(dx, dz);
    const stop = tgt ? 1.8 : 3.4;
    if (l > stop) {
      const s = Math.min(speed * (l > 12 ? 1.4 : 1), l * 3);
      b.vx += ((dx / l) * s - b.vx) * Math.min(1, 10 * dt);
      b.vz += ((dz / l) * s - b.vz) * Math.min(1, 10 * dt);
    } else { b.vx *= 0.8; b.vz *= 0.8; }
    b.vy -= 30 * dt;
    moveBody(b, dt, w);
    if (dp > 40) { b.x = p.x + 2; b.z = p.z + 2; b.y = p.body.y; b.vy = 0; }
    this.yaw += angleDiff(this.yaw, Math.atan2(dx, dz)) * Math.min(1, 10 * dt);
    if (tgt && bd < 2.4 && this.cd <= 0) {
      this.cd = 1.1;
      tgt.takeHit(this.def.dmg + g.stats.level * 0.8, { from: { x: b.x, z: b.z }, knock: 4, aoe: true, noHitstop: true });
      g.fx.burst(tgt.x, tgt.cy, tgt.z, 6, { speed: 3, size: 0.15, color: 0xb7ffca, glow: true, life: 0.25 });
    }
    this.root.position.set(b.x, b.y + Math.abs(Math.sin(this.t * 8)) * 0.08 * Math.min(1, Math.hypot(b.vx, b.vz) / 4), b.z);
    this.root.rotation.y = this.yaw;
    this.shadow.position.set(b.x, b.y + 0.04, b.z);
    this.label.position.set(b.x, b.y + 2.9, b.z);
    this.label.visible = dp < 14;
  }

  dispose() {
    this.ents.group.remove(this.root, this.shadow, this.label);
  }
}
