import { esc } from '../core/util.js';
import { drawFace } from './faces.js';
import { NPC_INFO } from '../data/npcs.js';

// Диалоговое окно: имя, портрет, текст «печатной машинкой», варианты ответов.
export class DialogUI {
  constructor(game, ui) {
    this.game = game;
    this.ui = ui;
    this.el = null;
    this.cur = null;
  }

  get active() {
    return !!this.cur;
  }

  say(who, text, choices, cb) {
    const info = NPC_INFO[who] || NPC_INFO.narr;
    const el = this.ensure();
    const face = el.querySelector('.face');
    drawFace(face, info.face || who);
    el.querySelector('.tb .grow').textContent = info.title ? `${info.name} — ${info.title}` : info.name;
    el.querySelector('.tb').style.background = info.bar || '';
    this.cur = { text: String(text), shown: 0, choices: choices && choices.length ? choices : null, cb, done: false };
    el.querySelector('.txt').textContent = '';
    el.querySelector('.choices').innerHTML = '';
    el.querySelector('.nxt').style.visibility = 'hidden';
  }

  ensure() {
    if (this.el) return this.el;
    const el = document.createElement('div');
    el.className = 'dialog win';
    el.innerHTML = `<div class="tb">${''}<span class="grow"></span></div><div class="bd"><canvas class="face sunken" width="28" height="28"></canvas><div style="flex:1"><div class="txt"></div><div class="choices"></div><div class="nxt">Далее — <span class="kbd">E</span></div></div></div>`;
    this.ui.screensEl.appendChild(el);
    el.addEventListener('click', (e) => {
      const b = e.target.closest('[data-ch]');
      if (b) { this.game.audio.sfx('click'); this.choose(+b.dataset.ch); return; }
      this.confirm();
    });
    this.el = el;
    return el;
  }

  hide() {
    this.el?.remove();
    this.el = null;
    this.cur = null;
  }

  update(dt) {
    const c = this.cur;
    if (!c || c.done) return;
    const before = Math.floor(c.shown);
    c.shown = Math.min(c.text.length, c.shown + dt * 68);
    const n = Math.floor(c.shown);
    if (n !== before) {
      this.el.querySelector('.txt').textContent = c.text.slice(0, n);
      if (n % 3 === 0 && c.text[n - 1] !== ' ') this.game.audio.sfx('blip');
    }
    if (c.shown >= c.text.length) this.finishLine();
  }

  finishLine() {
    const c = this.cur;
    c.done = true;
    c.shown = c.text.length;
    const el = this.el;
    el.querySelector('.txt').textContent = c.text;
    if (c.choices) {
      el.querySelector('.choices').innerHTML = c.choices.map((ch, i) => `<button class="btn" data-ch="${i}"><span class="kbd">${i + 1}</span> ${esc(ch.text)}</button>`).join('');
    } else el.querySelector('.nxt').style.visibility = 'visible';
  }

  confirm() {
    const c = this.cur;
    if (!c) return;
    if (!c.done) { this.finishLine(); return; }
    if (c.choices) return;
    this.choose(null);
  }

  choose(i) {
    const c = this.cur;
    if (!c || !c.done) return;
    this.cur = null;
    c.cb?.(i);
  }

  keys() {
    const c = this.cur;
    if (!c) return;
    const inp = this.game.input;
    if (inp.rawHit('confirm') && !c.choices) this.confirm();
    else if (inp.rawHit('confirm') && !c.done) this.finishLine();
    if (c.choices && c.done) {
      for (let i = 0; i < Math.min(9, c.choices.length); i++) if (inp.codeHit(`Digit${i + 1}`) || inp.codeHit(`Numpad${i + 1}`)) { this.choose(i); return; }
    } else if (c.choices && !c.done) for (let i = 1; i <= 9; i++) if (inp.codeHit(`Digit${i}`)) this.finishLine();
  }
}
