import { ITEMS, EQUIP_SLOTS, STACKABLE } from '../data/items.js';

// Инвентарь: стеки файлов, экипировка в трёх слотах, «байты» (деньги).
export class Inventory {
  constructor(game) {
    this.game = game;
    this.reset();
  }

  reset(keep = null) {
    this.stacks = keep?.stacks ? keep.stacks.map((s) => ({ ...s })) : [];
    this.equipped = keep?.equipped ? { ...keep.equipped } : { weapon: 'cursor', accessory: null, armor: null };
    this.bytes = keep?.bytes ?? 0;
    this.quick = keep?.quick ?? 'heal_zip';
  }

  get stats() {
    return this.game.stats;
  }

  count(id) {
    let n = 0;
    for (const s of this.stacks) if (s.id === id) n += s.n;
    return n;
  }
  has(id, n = 1) {
    return this.count(id) >= n;
  }

  /** Сколько слотов занято (квестовые предметы места не занимают). */
  used() {
    let u = 0;
    for (const s of this.stacks) if (ITEMS[s.id].slot !== 'quest') u++;
    return u;
  }
  get capacity() {
    return this.stats.slots;
  }
  get free() {
    return this.capacity - this.used();
  }

  /** Добавить предметы. Возвращает, сколько реально поместилось. */
  add(id, n = 1) {
    const it = ITEMS[id];
    if (!it) return 0;
    let added = 0;
    const quest = it.slot === 'quest';
    if (STACKABLE(id)) {
      const max = it.stack;
      for (const s of this.stacks) {
        if (s.id !== id || s.n >= max) continue;
        const k = Math.min(max - s.n, n - added);
        s.n += k;
        added += k;
        if (added >= n) break;
      }
      while (added < n && (quest || this.free > 0)) {
        const k = Math.min(max, n - added);
        this.stacks.push({ id, n: k });
        added += k;
      }
    } else {
      while (added < n && (quest || this.free > 0)) {
        this.stacks.push({ id, n: 1 });
        added++;
      }
    }
    if (added > 0) this.game.events.emit('itemAdded', id, added);
    return added;
  }

  remove(id, n = 1) {
    if (this.count(id) < n) return false;
    let left = n;
    for (let i = this.stacks.length - 1; i >= 0 && left > 0; i--) {
      const s = this.stacks[i];
      if (s.id !== id) continue;
      const k = Math.min(s.n, left);
      s.n -= k;
      left -= k;
      if (s.n <= 0) this.stacks.splice(i, 1);
    }
    this.game.events.emit('itemRemoved', id, n);
    return true;
  }

  weapon() {
    return ITEMS[this.equipped.weapon] || ITEMS.cursor;
  }

  /** Сумма модификатора по всей экипировке. */
  mod(name) {
    let v = 0;
    for (const slot of EQUIP_SLOTS) {
      const id = this.equipped[slot];
      if (id) v += ITEMS[id].mods?.[name] || 0;
    }
    return v;
  }

  equip(id) {
    const it = ITEMS[id];
    if (!it || !EQUIP_SLOTS.includes(it.slot) || !this.has(id)) return false;
    const prev = this.equipped[it.slot];
    this.remove(id, 1);
    if (prev) {
      // место освободилось только что — вернуть прежний предмет
      this.stacks.push({ id: prev, n: 1 });
    }
    this.equipped[it.slot] = id;
    this.game.events.emit('equip', id);
    this.clampVitals();
    return true;
  }

  unequip(slot) {
    const id = this.equipped[slot];
    if (!id) return false;
    if (this.free <= 0) return false;
    this.stacks.push({ id, n: 1 });
    this.equipped[slot] = null;
    if (slot === 'weapon') this.equipped.weapon = null;
    this.clampVitals();
    return true;
  }

  clampVitals() {
    const p = this.game.player;
    if (!p) return;
    p.hp = Math.min(p.hp, this.stats.maxHp);
    p.ram = Math.min(p.ram, this.stats.maxRam);
  }

  addBytes(n) {
    this.bytes += Math.round(n);
    this.game.events.emit('bytes', n);
  }
  spendBytes(n) {
    if (this.bytes < n) return false;
    this.bytes -= n;
    return true;
  }

  /** Конвертация: заменяет предмет его следующим форматом, если хватает сырья. */
  canConvert(id) {
    const it = ITEMS[id];
    if (!it?.convert || !this.has(id)) return false;
    return Object.entries(it.convert.cost).every(([k, n]) => this.has(k, n));
  }
  convert(id) {
    if (!this.canConvert(id)) return false;
    const c = ITEMS[id].convert;
    for (const [k, n] of Object.entries(c.cost)) this.remove(k, n);
    this.remove(id, 1);
    this.add(c.to, 1);
    return c.to;
  }

  toJSON() {
    return { stacks: this.stacks, equipped: this.equipped, bytes: this.bytes, quick: this.quick };
  }
  load(d) {
    this.reset(d);
  }
}
