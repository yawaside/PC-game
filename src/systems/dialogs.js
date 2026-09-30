import { DIALOGS, NPC_TALK } from '../data/dialogs.js';

// Исполнитель диалогов: линейные массивы реплик с метками и ветвлением.
export class Dialogs {
  constructor(game) {
    this.game = game;
    this.cur = null;
    this.seen = new Set();
    this.queue = [];
    this._after = [];
  }

  /** Выполнить действие после закрытия диалога (например, открыть магазин). */
  after(fn) {
    this._after.push(fn);
  }

  reset() {
    this.cur = null;
    this.seen = new Set();
    this.queue = [];
    this.game.ui?.dialogUI?.hide();
  }
  toJSON() {
    return { seen: [...this.seen] };
  }
  load(d) {
    this.reset();
    (d?.seen || []).forEach((s) => this.seen.add(s));
  }

  get active() {
    return !!this.cur;
  }

  /** Запустить диалог по id (или массиву реплик). opts: {npc, onEnd, id} */
  start(idOrScript, opts = {}) {
    const g = this.game;
    if (this.cur) {
      this.queue.push([idOrScript, opts]);
      return false;
    }
    let script = idOrScript;
    const id = typeof idOrScript === 'string' ? idOrScript : opts.id || 'custom';
    if (typeof idOrScript === 'string') {
      script = DIALOGS[idOrScript];
      if (typeof script === 'function') script = script(g, opts);
    }
    if (!script || !script.length) return false;
    if (g.state !== 'play' && g.state !== 'transition') {
      // отложим до возвращения в игру
      this.queue.push([idOrScript, opts]);
      const off = g.events.on('state', (s) => {
        if (s === 'play') {
          off();
          this.flushQueue();
        }
      });
      return false;
    }
    const labels = {};
    script.forEach((e, i) => {
      if (e.label) labels[e.label] = i;
    });
    this.cur = { id, script, i: 0, labels, opts };
    this.seen.add(id);
    g.setState('dialog');
    g.input.exitLock();
    g.ui.hidePrompt?.();
    this.step();
    return true;
  }

  flushQueue() {
    if (this.cur || !this.queue.length) return;
    const [s, o] = this.queue.shift();
    this.start(s, o);
  }

  /** Диалог с NPC: по его id выбирается подходящий сценарий. */
  talk(npcId, opts = {}) {
    const fn = NPC_TALK[npcId];
    const pick = fn ? fn(this.game, opts) : null;
    if (!pick) return false;
    return this.start(pick, { ...opts, npc: npcId, id: typeof pick === 'string' ? pick : `talk_${npcId}` });
  }

  step() {
    const g = this.game;
    const c = this.cur;
    if (!c) return;
    for (;;) {
      const e = c.script[c.i];
      if (!e) return this.finish();
      if (e.if && !e.if(g)) {
        c.i++;
        continue;
      }
      if (e.do) e.do(g, c.opts);
      if (e.set) for (const [k, v] of Object.entries(e.set)) g.setFlag(k, v);
      const text = typeof e.text === 'function' ? e.text(g) : e.text;
      const choices = e.choices ? e.choices.filter((ch) => !ch.if || ch.if(g)) : null;
      if (!text && !(choices && choices.length)) {
        if (e.go) {
          this.jump(e.go);
          if (!this.cur) return;
          continue;
        }
        if (e.end) return this.finish();
        c.i++;
        continue;
      }
      g.ui.dialogUI.say(e.who || 'narr', text || '', choices, (idx) => {
        if (choices && idx !== null) {
          const ch = choices[idx];
          ch.do?.(g, c.opts);
          if (ch.set) for (const [k, v] of Object.entries(ch.set)) g.setFlag(k, v);
          if (ch.go) {
            this.jump(ch.go);
            if (!this.cur) return;
            this.step();
            return;
          }
          c.i++;
          this.step();
          return;
        }
        if (e.end) return this.finish();
        if (e.go) {
          this.jump(e.go);
          if (!this.cur) return;
          this.step();
          return;
        }
        c.i++;
        this.step();
      });
      return;
    }
  }

  jump(label) {
    const c = this.cur;
    if (label === 'end') {
      this.finish();
      return;
    }
    if (!(label in c.labels)) {
      console.warn('dialog label missing', label);
      this.finish();
      return;
    }
    c.i = c.labels[label];
  }

  finish() {
    const g = this.game;
    const c = this.cur;
    this.cur = null;
    g.ui.dialogUI.hide();
    if (g.state === 'dialog') {
      g.setState('play');
      g.input.requestLock();
    }
    if (c) {
      g.events.emit('dialogEnd', c.id, c.opts?.npc);
      c.opts?.onEnd?.(g);
    }
    const fns = this._after.splice(0);
    for (const f of fns) f(g);
    if (this.queue.length) setTimeout(() => this.flushQueue(), 50);
  }
}
