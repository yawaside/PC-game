import { QUESTS } from '../data/quests.js';
import { ITEMS } from '../data/items.js';
import { GATES } from '../data/world.js';

const EVENTS = ['enemyKilled', 'dialogEnd', 'zoneEnter', 'crafted', 'converted', 'compiled', 'popupClosed', 'prisonerFreed', 'chestOpened', 'hiddenFound', 'itemUsed', 'bought', 'allyJoined', 'checkpoint'];

/** Система квестов: объективы по порядку, события и опрос состояния. */
export class Quests {
  constructor(game) {
    this.game = game;
    this.state = {};
    this.trackedId = null;
    this.acc = 0;
    for (const ev of EVENTS) game.events.on(ev, (...a) => this.onEvent(ev, ...a));
  }

  reset() {
    this.state = {};
    this.trackedId = null;
  }
  toJSON() {
    return { state: this.state, tracked: this.trackedId };
  }
  load(d) {
    this.state = d?.state || {};
    this.trackedId = d?.tracked || null;
  }

  def(id) {
    return QUESTS[id];
  }
  has(id) {
    return !!this.state[id];
  }
  isDone(id) {
    return this.state[id]?.st === 'done';
  }
  isActive(id) {
    return this.state[id]?.st === 'active';
  }
  /** Все объективы, кроме «сдать квест», выполнены. */
  isReady(id) {
    const q = QUESTS[id], st = this.state[id];
    if (!q || !st || st.st !== 'active') return false;
    return q.objectives.every((o) => o.turnin || this.objDone(q, st, o));
  }
  progress(id, objId) {
    const v = this.state[id]?.p?.[objId];
    return typeof v === 'number' ? v : v ? 1 : 0;
  }

  start(id) {
    const q = QUESTS[id];
    if (!q || this.state[id]) return false;
    this.state[id] = { st: 'active', p: {}, fired: {} };
    const g = this.game;
    g.ui.toast(`${q.main ? 'Новая главная задача' : 'Новая задача'}: ${q.title}`, 'good', 4200);
    g.audio.sfx('quest');
    q.onStart?.(g);
    if (!this.trackedId || q.main) this.trackedId = id;
    g.events.emit('questStart', id);
    return true;
  }

  complete(id) {
    const q = QUESTS[id], st = this.state[id];
    if (!q || !st || st.st === 'done') return false;
    const g = this.game;
    st.st = 'done';
    for (const o of q.objectives) if (o.type === 'flag' && o.turnin && o.flag) g.setFlag(o.flag);
    g.setFlag(`q_${id}`);
    const r = q.reward || {};
    if (r.xp) { const n = g.stats.addXp(r.xp); g.ui.toast(`+${n} опыта`, 'xp'); }
    if (r.bytes) { g.inv.addBytes(r.bytes); g.ui.toast(`+${r.bytes} байт`, 'xp'); }
    if (r.items) for (const [it, n] of Object.entries(r.items)) { if (g.inv.add(it, n) > 0) g.ui.toast(`Получено: ${ITEMS[it].name}${n > 1 ? ' ×' + n : ''}`, 'good'); else g.ui.toast(`Нет места для ${ITEMS[it].name}!`, 'warn'); }
    g.ui.toast(`Задача выполнена: ${q.title}`, 'good', 4200);
    g.audio.sfx('questdone');
    q.onComplete?.(g);
    if (this.trackedId === id) this.trackedId = null;
    g.events.emit('questDone', id);
    return true;
  }

  // ------------------------------------------------------------------ объективы
  objDone(q, st, o) {
    const g = this.game;
    switch (o.type) {
      case 'flag': return o.value !== undefined ? g.flags[o.flag] === o.value : !!g.flags[o.flag];
      case 'kill':
      case 'event': return (st.p[o.id] || 0) >= (o.n || 1);
      case 'visit':
      case 'talk':
      case 'reach': return st.p[o.id] === true;
      case 'collect': return g.inv.count(o.item) >= (o.n || 1);
      case 'custom': return !!o.check(g);
      default: return false;
    }
  }

  curIndex(q, st) {
    for (let i = 0; i < q.objectives.length; i++) if (!this.objDone(q, st, q.objectives[i])) return i;
    return -1;
  }

  onEvent(name, ...args) {
    const g = this.game;
    for (const [id, st] of Object.entries(this.state)) {
      if (st.st !== 'active') continue;
      const q = QUESTS[id];
      if (!q) continue;
      const i = this.curIndex(q, st);
      if (i < 0) continue;
      const o = q.objectives[i];
      switch (o.type) {
        case 'kill':
          if (name === 'enemyKilled') {
            const info = args[0] || {};
            if (o.enemy && o.enemy !== info.type) break;
            if (o.zone && o.zone !== g.zoneId) break;
            st.p[o.id] = (st.p[o.id] || 0) + 1;
          }
          break;
        case 'event':
          if (name === o.event) st.p[o.id] = (st.p[o.id] || 0) + (typeof args[0] === 'number' ? 1 : 1);
          break;
        case 'visit':
          if (name === 'zoneEnter' && args[0] === o.zone) st.p[o.id] = true;
          break;
        case 'talk':
          if (name === 'dialogEnd' && args[1] === o.npc && (!o.dialog || o.dialog === args[0])) st.p[o.id] = true;
          break;
        default:
      }
    }
  }

  update(dt) {
    this.acc += dt;
    if (this.acc < 0.25) return;
    this.acc = 0;
    const g = this.game;
    for (const q of Object.values(QUESTS)) {
      if (!this.state[q.id] && q.auto && q.auto(g)) this.start(q.id);
    }
    for (const [id, st] of Object.entries(this.state)) {
      if (st.st !== 'active') continue;
      const q = QUESTS[id];
      if (!q) continue;
      // reach-объективы
      const i = this.curIndex(q, st);
      if (i >= 0 && q.objectives[i].type === 'reach') {
        const o = q.objectives[i];
        if (g.zoneId === o.zone) {
          const d = Math.hypot(g.player.x - o.at[0], g.player.z - o.at[2]);
          if (d < (o.r || 4)) st.p[o.id] = true;
        }
      }
      // onDone-хуки
      for (const o of q.objectives) {
        if (!st.fired[o.id] && this.objDone(q, st, o)) {
          st.fired[o.id] = true;
          o.onDone?.(g);
          if (!o.turnin && q.objectives.indexOf(o) < q.objectives.length - 1) g.audio.sfx('objective');
        }
      }
      if (q.objectives.every((o) => this.objDone(q, st, o))) this.complete(id);
    }
  }

  onZoneEnter() {}

  // ------------------------------------------------------------------ интерфейс
  lines(q, st) {
    const cur = this.curIndex(q, st);
    const out = [];
    q.objectives.forEach((o, i) => {
      const done = this.objDone(q, st, o);
      if (i > cur && cur >= 0 && !done) return; // будущие скрыты
      let text = o.text;
      if ((o.type === 'kill' || o.type === 'event') && (o.n || 1) > 1) text += ` (${Math.min(o.n, st.p[o.id] || 0)}/${o.n})`;
      if (o.type === 'collect' && (o.n || 1) > 1) text += ` (${Math.min(o.n, this.game.inv.count(o.item))}/${o.n})`;
      if (o.progressText) text += ` (${o.progressText(this.game)})`;
      out.push({ text, done });
    });
    return out;
  }

  tracked() {
    let id = this.trackedId;
    if (!id || !this.isActive(id)) {
      const act = Object.keys(this.state).filter((k) => this.isActive(k));
      const mains = act.filter((k) => QUESTS[k]?.main).sort((a, b) => (QUESTS[a].order || 0) - (QUESTS[b].order || 0));
      id = mains[0] || act[0] || null;
      this.trackedId = id;
    }
    if (!id) return null;
    const q = QUESTS[id], st = this.state[id];
    if (!q) return null;
    return { id, title: q.title, main: !!q.main, lines: this.lines(q, st) };
  }

  setTracked(id) {
    if (this.isActive(id)) this.trackedId = id;
  }

  journal() {
    const active = [], done = [];
    for (const [id, st] of Object.entries(this.state)) {
      const q = QUESTS[id];
      if (!q) continue;
      const row = { id, title: q.title, main: !!q.main, giver: q.giver, desc: q.desc, lines: this.lines(q, st), reward: q.reward?.text, tracked: this.trackedId === id, order: q.order || 99 };
      (st.st === 'done' ? done : active).push(row);
    }
    active.sort((a, b) => (b.main - a.main) || a.order - b.order);
    return { active, done };
  }

  /** Маркер на экране для текущего объектива отслеживаемой задачи. */
  waypoint() {
    const g = this.game;
    const t = this.tracked();
    if (!t || !g.zone) return null;
    const q = QUESTS[t.id], st = this.state[t.id];
    const i = this.curIndex(q, st);
    if (i < 0) return null;
    const o = q.objectives[i];
    const zid = o.zone || q.zone;
    if (!zid) return null;
    if (g.zone.id === zid) {
      if (o.npc) {
        const n = g.ents.npcs.find((x) => x.id === o.npc);
        if (n) return { x: n.x, y: n.y + 1.4, z: n.z, label: n.name };
      }
      if (o.at) return { x: o.at[0], y: o.at[1], z: o.at[2], label: o.label || '' };
      return null;
    }
    const to = g.zone.id === 'desktop' ? zid : 'desktop';
    const p = g.zone.portals.find((k) => k.to === to);
    if (p) return { x: p.x, y: p.y + 2, z: p.z, label: to === 'desktop' ? 'Выход на Рабочий стол' : GATES[zid]?.name || zid };
    return null;
  }
}
