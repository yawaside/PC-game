import * as THREE from 'three';
import { basic, GEO } from '../gfx/materials.js';
import { makeHalo, makeLabel } from '../gfx/text.js';
import { M, box } from './models.js';
import { ITEMS, rollLoot } from '../data/items.js';
import { HIDDEN_FILES, HIDDEN_TOTAL } from '../data/world.js';
import { hexStr, clamp } from '../core/util.js';

const SLOT_COL = { weapon: 0xffffff, accessory: 0x9ad07a, armor: 0x7fb6ff, zip: 0xf3d25a, junk: 0x9aa0a8, code: 0x39e6ff, quest: 0xff9bf0 };

/** Подбираемые объекты: предметы, байты, сферы здоровья/RAM, сундуки, скрытые файлы. */
export class Pickup {
  constructor(ents, kind, x, y, z, o = {}) {
    this.ents = ents;
    this.game = ents.game;
    this.kind = kind;
    this.x = x; this.y = y; this.z = z;
    this.o = o;
    this.id = o.id || null;
    this.item = o.item || null;
    this.amount = o.amount || 1;
    this.dead = false;
    this.t = Math.random() * 6;
    this.vx = (o.pop === false ? 0 : (Math.random() - 0.5) * 4);
    this.vz = (o.pop === false ? 0 : (Math.random() - 0.5) * 4);
    this.vy = o.pop === false ? 0 : 5 + Math.random() * 3;
    this.grounded = o.pop === false;
    this.delay = o.pop === false ? 0 : 0.45;
    this.interact = null;
    const g = new THREE.Group();
    this.group = g;
    this.halo = null;
    if (kind === 'item') {
      const it = ITEMS[this.item];
      const col = it.slot === 'weapon' || it.slot === 'accessory' ? (it.color ?? SLOT_COL[it.slot]) : SLOT_COL[it.slot] ?? 0xffffff;
      const c = col === 0xffffff ? 0xeeeeee : col;
      if (it.slot === 'zip') { g.add(box(0.36, 0.44, 0.12, c), box(0.08, 0.3, 0.14, 0x555555)); }
      else if (it.slot === 'weapon') { g.add(box(0.12, 0.7, 0.08, c)); g.add(box(0.36, 0.1, 0.1, 0x666666, 0, -0.15, 0)); g.rotation.z = 0.5; }
      else if (it.slot === 'armor') g.add(box(0.5, 0.56, 0.16, c));
      else if (it.slot === 'code') g.add(box(0.42, 0.42, 0.1, c, 0, 0, 0, { mat: basic(c, {}) }));
      else g.add(box(0.42, 0.5, 0.1, c), box(0.14, 0.14, 0.12, 0x444444, 0.14, 0.18, 0));
      this.spin = true;
      this.halo = makeHalo(c, 1.6, 0.45);
      g.add(this.halo);
      this.range = 1.7;
    } else if (kind === 'bytes') {
      const m = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.07, 8), basic(0xffd23f, {}));
      m.rotation.x = Math.PI / 2;
      g.add(m);
      this.coin = m;
      this.range = 1.5;
      this.magnet = 5;
    } else if (kind === 'hp' || kind === 'ram') {
      const c = kind === 'hp' ? 0xff4a5a : 0x4a8aff;
      g.add(new THREE.Mesh(GEO.octa, basic(c, {})));
      g.children[0].scale.set(0.26, 0.36, 0.26);
      this.halo = makeHalo(c, 1.4, 0.55);
      g.add(this.halo);
      this.spin = true;
      this.range = 1.4;
      this.magnet = 5;
    } else if (kind === 'chest') {
      this.buildChest(g, o);
      this.range = 0;
      this.interact = {
        x, y, z, r: 3.0,
        prompt: () => (this.opened ? '' : 'Открыть архив'),
        enabled: () => !this.opened && !this.dead,
        use: () => this.open(),
      };
      this.grounded = true; this.vy = 0; this.vx = this.vz = 0;
    } else if (kind === 'hidden') {
      const info = HIDDEN_FILES.find((h) => h.id === o.hiddenId);
      this.info = info;
      g.add(box(0.5, 0.64, 0.08, 0xdfeaff, 0, 0, 0, { o: 0.75, e: 0x335577 }), box(0.18, 0.18, 0.1, 0x99b0d0, 0.16, 0.24, 0, { o: 0.75 }));
      g.children[0].material = g.children[0].material.clone();
      this.halo = makeHalo(0xaaddff, 2.2, 0.7);
      g.add(this.halo);
      this.spin = true;
      this.range = 1.8;
      this.grounded = true; this.vy = 0; this.vx = this.vz = 0;
      this.hidden = true;
      if (info) {
        this.label = makeLabel(info.name, { color: '#bfe6ff', size: 40, width: 2.8 });
        this.label.position.y = 0.9;
        g.add(this.label);
      }
    }
    g.position.set(x, y, z);
    ents.group.add(g);
  }

  buildChest(g, o) {
    const tier = o.table || 'common';
    const body = tier === 'rich' ? 0x8a4ad0 : tier === 'mid' ? 0x3a7acb : 0xc08a2a;
    const trim = 0xf0e0a0;
    g.add(box(1.3, 0.75, 0.9, body, 0, 0.38, 0));
    this.lid = new THREE.Group();
    this.lid.add(box(1.36, 0.3, 0.96, body, 0, 0.15, 0.0), box(1.4, 0.06, 1.0, trim, 0, 0.02, 0));
    this.lid.position.set(0, 0.75, -0.45);
    this.lid.children.forEach((c) => (c.position.z += 0.45));
    g.add(this.lid);
    g.add(box(0.2, 0.26, 0.06, trim, 0, 0.6, 0.47));
    g.add(box(1.36, 0.1, 0.96, trim, 0, 0.3, 0, { o: 0.9 }));
    // файловая иконка-архив
    this.zipMark = box(0.3, 0.3, 0.04, 0xffffff, 0, 0.4, 0.48, { mat: basic(0xffffff, {}) });
    g.add(this.zipMark);
    this.halo = makeHalo(tier === 'rich' ? 0xc08aff : 0xffe07a, 2.6, 0.45);
    this.halo.position.y = 0.7;
    g.add(this.halo);
  }

  open() {
    if (this.opened) return;
    const g = this.game;
    this.opened = true;
    if (this.o.chestId) g.opened.add(this.o.chestId);
    g.audio.sfx('chest');
    g.fx.burst(this.x, this.y + 0.9, this.z, 22, { speed: 5, size: 0.2, color: 0xffe07a, glow: true, life: 0.7, up: 3 });
    this.openT = 0;
    const table = this.o.table || 'common';
    const n = this.o.count || (table === 'rich' ? 3 : table === 'mid' ? 2 : 2);
    if (this.o.items) for (const [id, k] of this.o.items) this.ents.spawnPickup('item', this.x, this.y + 1.0, this.z, { item: id, amount: k });
    else this.ents.dropLoot(this.x, this.y + 1.0, this.z, table, n);
    if (this.o.bytes) this.ents.spawnPickup('bytes', this.x, this.y + 1.0, this.z, { amount: this.o.bytes });
    if (this.o.onOpen) this.o.onOpen(g);
    g.events.emit('chestOpened', this.o.chestId);
  }

  collect() {
    const g = this.game;
    if (this.kind === 'item') {
      const it = ITEMS[this.item];
      const added = g.inv.add(this.item, this.amount);
      if (added <= 0) {
        if (this.warnT === undefined || g.clockT - this.warnT > 4) { this.warnT = g.clockT; g.ui.toast(`Нет места для ${it.name} — освободите рюкзак (Tab)`, 'warn'); }
        return false;
      }
      g.audio.sfx('pickup');
      g.ui.toast(`Получено: ${it.name}${added > 1 ? ' ×' + added : ''}`, it.slot === 'quest' || it.tier >= 3 ? 'good' : 'info', 2600);
    } else if (this.kind === 'bytes') {
      g.inv.addBytes(this.amount);
      g.audio.sfx('coin');
      g.ui.damageNumber(this.x, this.y + 0.6, this.z, `+${this.amount} Б`, 'xp');
    } else if (this.kind === 'hp') {
      const h = g.player.heal(this.amount);
      if (h <= 0 && g.player.hp >= g.stats.maxHp) return false;
      g.audio.sfx('heal');
      g.ui.damageNumber(this.x, this.y + 0.6, this.z, `+${Math.round(h)}`, 'heal');
    } else if (this.kind === 'ram') {
      if (g.player.ram >= g.stats.maxRam - 0.5) return false;
      g.player.ram = Math.min(g.stats.maxRam, g.player.ram + this.amount);
      g.audio.sfx('ram');
    } else if (this.kind === 'hidden') {
      if (g.hidden.has(this.o.hiddenId)) return true;
      g.hidden.add(this.o.hiddenId);
      g.audio.sfx('secret');
      g.fx.burst(this.x, this.y, this.z, 26, { speed: 6, size: 0.22, color: 0xbfe6ff, glow: true, life: 0.9 });
      g.ui.toast(`Скрытый файл найден: ${this.info?.name || '???'} (${g.hidden.size}/${HIDDEN_TOTAL})`, 'good', 5200);
      g.flash?.();
      g.events.emit('hiddenFound', this.o.hiddenId);
    }
    this.kill();
    return true;
  }

  kill() {
    this.dead = true;
    this.ents.group.remove(this.group);
  }

  update(dt) {
    const g = this.game;
    const p = g.player;
    this.t += dt;
    if (this.kind === 'hidden') {
      const show = g.showHidden || Math.hypot(p.x - this.x, p.z - this.z) < 11;
      this.group.visible = show;
      if (!show) return;
    }
    // физика дропа
    if (!this.grounded) {
      this.vy -= 22 * dt;
      this.x += this.vx * dt; this.z += this.vz * dt; this.y += this.vy * dt;
      const fl = g.zone.world.floorBelow(this.x, this.y + 0.6, this.z, 0.15, 30);
      const gy = (fl > -1e8 ? fl : g.zone.world.groundY(this.x, this.z)) + 0.35;
      if (this.y < gy) {
        this.y = gy; this.vy *= -0.3; this.vx *= 0.6; this.vz *= 0.6;
        if (Math.abs(this.vy) < 1.2) { this.vy = 0; this.grounded = true; this.baseY = gy; }
      }
    } else {
      if (this.baseY === undefined) this.baseY = this.y;
      this.delay = 0;
    }
    this.delay -= dt;
    let py = this.y;
    if (this.grounded && this.kind !== 'chest') py = this.baseY + 0.12 * Math.sin(this.t * 2.6) + 0.15;
    this.group.position.set(this.x, this.kind === 'chest' ? this.y : py, this.z);
    if (this.spin) this.group.rotation.y = this.t * 1.8;
    if (this.coin) this.coin.rotation.z = this.t * 6;
    if (this.kind === 'chest') {
      if (this.opened) {
        this.openT = Math.min(1, (this.openT ?? 0) + dt * 2.5);
        this.lid.rotation.x = -this.openT * 1.9;
        this.halo.material.opacity = 0.15;
      }
      return;
    }
    // магнит и сбор
    const dx = p.x - this.x, dz = p.z - this.z, dy = p.center - this.y;
    const d = Math.hypot(dx, dy, dz);
    if (this.magnet && d < this.magnet && this.delay <= 0 && this.grounded) {
      const k = (1 - d / this.magnet) * 14 * dt + 2 * dt;
      this.x += (dx / d) * k * 3; this.z += (dz / d) * k * 3; this.baseY += (dy / d) * k * 3;
    }
    if (this.delay <= 0 && d < this.range && !g.player.dead) this.collect();
  }
}

export { rollLoot, hexStr, clamp, M };
