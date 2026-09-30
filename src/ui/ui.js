import * as THREE from 'three';
import { icon } from './icons.js';
import { clamp, esc, fmtNum, fmtTime } from '../core/util.js';
import { ABILITIES, ABILITY_ORDER } from '../data/abilities.js';
import { ITEMS } from '../data/items.js';
import { Screens } from './screens.js';
import { Panels } from './panels.js';
import { DialogUI } from './dialogui.js';

const AD_TEXTS = [
  ['ВЫ — 1 000 000-й ПОСЕТИТЕЛЬ!', 'Нажмите ОК, чтобы получить приз!'],
  ['Ваш компьютер заражён!', 'Срочно скачайте «АнтиВирус Супер Pro 2003».'],
  ['Ускоритель интернета', 'Увеличьте скорость в 500 раз! Бесплатно!'],
  ['Горячие процессы рядом', 'Познакомьтесь с потоками в вашем регионе.'],
  ['Вам пришло письмо', '3 новых письма от принца Нигерии.'],
  ['Обновите Flash Player', 'Без этого мир не откроется. Честно.'],
  ['Очистка реестра!', 'Найдено 9 999 ошибок. Исправить за 99$?'],
  ['Заработок в сети', 'Мама в шоке! Кликни, чтобы узнать.'],
];

export class UI {
  constructor(game, root) {
    this.game = game;
    this.root = root;
    this.toastKeys = new Set();
    this.dmgPool = [];
    this.dmgActive = [];
    this.popupList = [];
    this.lastHp = -1;
    this.cache = {};
    this.panelName = null;
    this.promptItem = null;
    this.wpVec = new THREE.Vector3();
    this.build();
    this.screens = new Screens(game, this);
    this.panels = new Panels(game, this);
    this.dialogUI = new DialogUI(game, this);
  }

  build() {
    const r = this.root;
    r.innerHTML = `
      <div id="hud">
        <div class="crosshair" id="xh"><i></i></div>
        <div class="hitmark" id="hitmark"></div>
        <div class="popups" id="popups"></div>
        <div class="dmg-layer" id="dmgLayer"></div>
        <div class="wp" id="wp"><b>◆</b><span></span></div>
        <div class="objective win" id="objective"><div class="tb"><span class="grow">Задача.exe</span></div><div class="bd"></div></div>
        <div class="zonebar" id="zonebar"><div class="nm"></div><div class="pth"></div></div>
        <div class="timer" id="timer"><small></small><span></span></div>
        <div class="bossbar win" id="bossbar"><div class="tb"><span class="grow"></span></div><div class="bd"><div class="hp sunken"><b class="ghost"></b><b class="now"></b></div><div class="sub"></div></div></div>
        <div class="buffs" id="buffs"></div>
        <div class="toasts" id="toasts"></div>
        <div class="prompt" id="prompt"></div>
        <div class="zonetitle" id="zonetitle"><h1></h1><p></p></div>
        <div class="hurtfx" id="hurtfx"></div>
        <div class="heatfx" id="heatfx"></div>
        <div class="clipfx" id="clipfx"></div>
        <div class="flashfx" id="flashfx"></div>
        <div class="taskbar" id="taskbar">
          <div class="tb-start" id="tbStart">${icon('cursor')}<span>Шорткат</span><small id="verLbl">v1.0</small></div>
          <div class="meters">
            <div class="meter hp"><span class="ico-w">${icon('heart')}</span><div class="bar sunken"><b class="ghost"></b><b class="now"></b><span></span></div></div>
            <div class="meter ram"><span class="ico-w">${icon('ram')}</span><div class="bar sunken"><b class="ghost"></b><b class="now"></b><span></span></div></div>
            <div class="meter xp"><span class="ico-w">${icon('star')}</span><div class="bar sunken"><b class="ghost"></b><b class="now"></b><span></span></div></div>
          </div>
          <div class="hotbar" id="hotbar"></div>
          <div class="tray"><div class="bytes">${icon('coin')}<span id="bytes">0</span></div><div class="clk" id="clk">00:00</div></div>
        </div>
      </div>
      <div id="screens"></div>
      <div class="fade" id="fade"></div>`;
    this.$ = (id) => r.querySelector(id);
    this.hud = this.$('#hud');
    this.screensEl = this.$('#screens');
    this.fadeEl = this.$('#fade');
    this.xh = this.$('#xh');
    this.hitmark = this.$('#hitmark');
    this.promptEl = this.$('#prompt');
    this.toastsEl = this.$('#toasts');
    this.objEl = this.$('#objective');
    this.dmgLayer = this.$('#dmgLayer');
    this.popupsEl = this.$('#popups');
    this.bars = {};
    for (const k of ['hp', 'ram', 'xp']) {
      const m = r.querySelector(`.meter.${k}`);
      this.bars[k] = { now: m.querySelector('.now'), ghost: m.querySelector('.ghost'), txt: m.querySelector('.bar > span') };
    }
    // хотбар способностей
    const hb = this.$('#hotbar');
    this.slots = {};
    for (const id of ABILITY_ORDER) {
      const a = ABILITIES[id];
      const el = document.createElement('div');
      el.className = 'slot locked';
      el.style.setProperty('--c', a.color);
      el.innerHTML = `${icon(a.icon)}<span class="key">${a.key}</span><span class="cost">${a.cost}</span><span class="cd"></span>`;
      el.firstElementChild.style.color = a.color;
      el.title = `${a.name}: ${a.desc}`;
      hb.appendChild(el);
      this.slots[id] = { el, cd: el.querySelector('.cd'), ico: el.firstElementChild };
    }
    // слот зелий (R)
    const pot = document.createElement('div');
    pot.className = 'slot locked';
    pot.innerHTML = `${icon('zip')}<span class="key">R</span><span class="cnt">0</span>`;
    pot.firstElementChild.style.color = '#2a7a2a';
    hb.appendChild(pot);
    this.potSlot = { el: pot, cnt: pot.querySelector('.cnt') };
  }

  // ================================================================== HUD
  showHud(on) {
    this.hud.classList.toggle('show', on);
  }

  update(dt) {
    const g = this.game;
    const st = g.state;
    const inGame = st === 'play' || st === 'dialog' || st === 'panel' || st === 'pause' || st === 'dead' || st === 'transition' || st === 'cutscene';
    this.showHud(inGame && g.zone);
    if (!inGame) return;
    const p = g.player, stt = g.stats;
    // бары
    const hpR = clamp(p.hp / stt.maxHp, 0, 1), ramR = clamp(p.ram / stt.maxRam, 0, 1), xpR = stt.level >= 30 ? 1 : clamp(stt.xp / stt.xpNeeded, 0, 1);
    this.setBar('hp', hpR, `${Math.ceil(p.hp)} / ${stt.maxHp}`);
    this.setBar('ram', ramR, `${Math.floor(p.ram)} / ${stt.maxRam}`);
    this.setBar('xp', xpR, stt.level >= 30 ? 'MAX' : `${stt.xp} / ${stt.xpNeeded}`);
    const ver = stt.version + (stt.points > 0 ? ` (+${stt.points})` : '');
    if (this.cache.ver !== ver) { this.cache.ver = ver; this.$('#verLbl').textContent = ver; }
    // способности
    for (const id of ABILITY_ORDER) {
      const s = this.slots[id];
      const info = g.combat.abilityInfo(id);
      const learned = info.learned;
      s.el.classList.toggle('locked', !learned);
      s.el.classList.toggle('active', !!info.active);
      s.el.classList.toggle('nomana', learned && p.ram < info.cost && !g.cheats.ram);
      const cdR = info.cdMax > 0 ? clamp(info.cd / info.cdMax, 0, 1) : 0;
      s.cd.style.height = `${cdR * 100}%`;
    }
    const heals = g.inv.count('heal_zip');
    this.potSlot.el.classList.toggle('locked', heals <= 0);
    if (this.cache.heals !== heals) { this.cache.heals = heals; this.potSlot.cnt.textContent = heals; }
    const bytes = fmtNum(g.inv.bytes);
    if (this.cache.bytes !== bytes) { this.cache.bytes = bytes; this.$('#bytes').textContent = bytes; }
    const clk = fmtTime(g.playtime);
    if (this.cache.clk !== clk) { this.cache.clk = clk; this.$('#clk').textContent = clk; }
    // зона
    const zid = g.zone?.id;
    if (this.cache.zone !== zid) {
      this.cache.zone = zid;
      this.$('#zonebar .nm').textContent = g.zone?.name || '';
      this.$('#zonebar .pth').textContent = g.zone?.def.path || '';
    }
    // прицел
    const cls = g.combat.crosshairState();
    if (this.cache.xh !== cls) { this.cache.xh = cls; this.xh.className = 'crosshair ' + cls; }
    // баффы
    this.updateBuffs();
    // перегрев / низкое HP
    const heat = p.overclock ? clamp(g.combat.heat / 100, 0, 1) : 0;
    this.$('#heatfx').style.opacity = heat * 0.9;
    // тосты
    this.updateToasts(dt);
    this.updateDamageNumbers(dt);
    this.updatePopups(dt);
    this.updateObjective();
    this.updateWaypoint();
    this.updateTimer();
    this.updateBossBar();
    this.dialogUI.update(dt);
    this.panels.update(dt);
  }

  setBar(k, r, txt) {
    const b = this.bars[k];
    const c = this.cache;
    const key = k + 'r';
    if (c[key] === r && c[k + 't'] === txt) return;
    if (c[key] === undefined) b.ghost.style.width = `${r * 100}%`;
    if (c[key] !== r) {
      b.now.style.width = `${r * 100}%`;
      if (c[key] === undefined || r >= c[key]) b.ghost.style.width = `${r * 100}%`;
      else setTimeout(() => (b.ghost.style.width = `${r * 100}%`), 10);
    }
    c[key] = r;
    if (c[k + 't'] !== txt) { c[k + 't'] = txt; b.txt.textContent = txt; }
  }

  updateBuffs() {
    const b = this.game.stats.buffs;
    const keys = Object.keys(b);
    const sig = keys.map((k) => `${k}${Math.ceil(b[k].t)}`).join('|');
    if (this.cache.buffs === sig) return;
    this.cache.buffs = sig;
    const names = { dmg: 'Урон', speed: 'Скорость', armor: 'Защита' };
    this.$('#buffs').innerHTML = keys.map((k) => `<div class="bf">${names[k] || k} ${Math.ceil(b[k].t)}с</div>`).join('');
  }

  // ================================================================== подсказки и тосты
  prompt(text, item = null) {
    if (!text) { this.hidePrompt(); return; }
    if (this.cache.prompt !== text) {
      this.cache.prompt = text;
      this.promptEl.innerHTML = `<span class="kbd">E</span>${esc(text)}`;
    }
    this.promptEl.style.display = 'block';
    this.promptItem = item;
  }
  hidePrompt() {
    if (this.cache.prompt !== null) { this.cache.prompt = null; }
    this.promptEl.style.display = 'none';
  }

  toast(text, kind = 'info', ms = 3400) {
    const el = document.createElement('div');
    el.className = `toast ${kind}`;
    el.textContent = text;
    this.toastsEl.appendChild(el);
    while (this.toastsEl.children.length > 5) this.toastsEl.firstChild.remove();
    const t = { el, t: ms / 1000 };
    (this.toastList ||= []).push(t);
  }
  toastOnce(key, text, ms = 3600) {
    if (this.toastKeys.has(key)) return;
    this.toastKeys.add(key);
    this.toast(text, 'good', ms || 3600);
  }
  updateToasts(dt) {
    const list = this.toastList;
    if (!list) return;
    for (let i = list.length - 1; i >= 0; i--) {
      const t = list[i];
      t.t -= dt;
      if (t.t < 0.4) t.el.classList.add('out');
      if (t.t <= 0) { t.el.remove(); list.splice(i, 1); }
    }
  }

  showZoneTitle(name, path, delay = 0) {
    const el = this.$('#zonetitle');
    el.querySelector('h1').textContent = name;
    el.querySelector('p').textContent = path || '';
    el.classList.remove('show');
    void el.offsetWidth;
    setTimeout(() => el.classList.add('show'), delay * 1000);
  }

  hurt(dmg) {
    const el = this.$('#hurtfx');
    el.classList.add('on');
    clearTimeout(this._hurtT);
    this._hurtT = setTimeout(() => el.classList.remove('on'), 60);
    void dmg;
  }
  clipFlash() {
    const el = this.$('#clipfx');
    el.classList.add('on');
    setTimeout(() => el.classList.remove('on'), 60);
  }
  flash(ms = 60) {
    const el = this.$('#flashfx');
    el.classList.add('on');
    setTimeout(() => el.classList.remove('on'), ms);
  }
  hitMarker(kill = false) {
    const el = this.hitmark;
    el.classList.toggle('kill', kill);
    el.classList.add('on');
    clearTimeout(this._hmT);
    this._hmT = setTimeout(() => el.classList.remove('on'), kill ? 160 : 90);
  }

  fade(on, ms = 260) {
    return new Promise((res) => {
      this.fadeEl.style.transitionDuration = `${Math.max(ms, 1)}ms`;
      this.fadeEl.classList.toggle('on', on);
      setTimeout(res, ms + 20);
    });
  }

  // ================================================================== числа урона
  damageNumber(x, y, z, text, cls = '') {
    let el = this.dmgPool.pop();
    if (!el) {
      if (this.dmgActive.length > 30) return;
      el = document.createElement('div');
      this.dmgLayer.appendChild(el);
    }
    el.className = `dmg ${cls}`;
    el.textContent = text;
    el.style.display = 'block';
    this.dmgActive.push({ el, x, y, z, t: 0, dx: (Math.random() - 0.5) * 30 });
  }
  updateDamageNumbers(dt) {
    const cam = this.game.camera;
    const W = this.game.viewW, H = this.game.viewH;
    for (let i = this.dmgActive.length - 1; i >= 0; i--) {
      const d = this.dmgActive[i];
      d.t += dt;
      if (d.t > 0.9) {
        d.el.style.display = 'none';
        this.dmgPool.push(d.el);
        this.dmgActive.splice(i, 1);
        continue;
      }
      this.wpVec.set(d.x, d.y + d.t * 1.1, d.z).project(cam);
      if (this.wpVec.z > 1) { d.el.style.display = 'none'; continue; }
      d.el.style.display = 'block';
      const sx = (this.wpVec.x * 0.5 + 0.5) * W + d.dx * d.t, sy = (-this.wpVec.y * 0.5 + 0.5) * H;
      d.el.style.transform = `translate(${sx}px, ${sy}px) scale(${1 + Math.max(0, 0.2 - d.t) * 2})`;
      d.el.style.opacity = d.t > 0.6 ? 1 - (d.t - 0.6) / 0.3 : 1;
    }
  }

  // ================================================================== adware-окна
  spawnPopup(owner) {
    if (!this.game.settings.popups) return null;
    if (this.popupList.length >= 7) return null;
    const [h, t] = AD_TEXTS[(Math.random() * AD_TEXTS.length) | 0];
    const el = document.createElement('div');
    el.className = 'popup win';
    const W = this.game.viewW, H = this.game.viewH;
    el.style.left = `${W * 0.2 + Math.random() * W * 0.5}px`;
    el.style.top = `${H * 0.12 + Math.random() * H * 0.45}px`;
    el.innerHTML = `<div class="tb"><span class="grow">${esc(h)}</span><span class="x">×</span></div><div class="bd">${esc(t)}<div class="row"><span class="btn fake">OK</span><span class="btn fake">Отмена</span></div></div>`;
    this.popupsEl.appendChild(el);
    const p = { el, owner, t: 9 };
    this.popupList.push(p);
    this.popupHint(true);
    this.game.audio.sfx('popup');
    return p;
  }
  popupHint(on) {
    let hint = this.popupsEl.querySelector('.hint');
    if (on && !hint) {
      hint = document.createElement('div');
      hint.className = 'hint';
      hint.innerHTML = 'Закройте рекламу: <span class="kbd">X</span>';
      this.popupsEl.appendChild(hint);
    } else if (!on && hint) hint.remove();
  }
  closeTopPopup() {
    const p = this.popupList.pop();
    if (!p) return false;
    p.el.remove();
    if (!this.popupList.length) this.popupHint(false);
    this.game.audio.sfx('click');
    this.game.events.emit('popupClosed');
    return true;
  }
  clearPopups(owner = null) {
    for (let i = this.popupList.length - 1; i >= 0; i--) {
      const p = this.popupList[i];
      if (!owner || p.owner === owner) { p.el.remove(); this.popupList.splice(i, 1); }
    }
    if (!this.popupList.length) this.popupHint(false);
  }
  updatePopups(dt) {
    if (this.game.state === 'play' && this.game.input.actHit('closePopup')) this.closeTopPopup();
    for (let i = this.popupList.length - 1; i >= 0; i--) {
      const p = this.popupList[i];
      p.t -= dt;
      if (p.t <= 0 || (p.owner && p.owner.dead)) { p.el.remove(); this.popupList.splice(i, 1); }
    }
    if (!this.popupList.length) this.popupHint(false);
  }

  // ================================================================== задачи
  updateObjective() {
    const q = this.game.quests.tracked();
    const sig = q ? JSON.stringify(q) : 'none';
    if (this.cache.obj === sig) return;
    this.cache.obj = sig;
    const bd = this.objEl.querySelector('.bd');
    if (!q) { this.objEl.style.display = 'none'; return; }
    this.objEl.style.display = 'block';
    this.objEl.querySelector('.tb .grow').textContent = q.main ? 'Главная задача.exe' : 'Задача.exe';
    bd.innerHTML = `<b>${esc(q.title)}</b>` + q.lines.map((l) => `<div class="ln ${l.done ? 'done' : ''}">${icon(l.done ? 'check' : 'arrow')}<span>${esc(l.text)}</span></div>`).join('');
  }

  updateWaypoint() {
    const wp = this.$('#wp');
    const g = this.game;
    const t = g.state === 'play' ? g.quests.waypoint() : null;
    if (!t) { wp.style.display = 'none'; return; }
    this.wpVec.set(t.x, t.y + 1.5, t.z).project(g.camera);
    const W = g.viewW, H = g.viewH;
    if (this.wpVec.z > 1) { wp.style.display = 'none'; return; }
    const sx = clamp((this.wpVec.x * 0.5 + 0.5) * W, 30, W - 30), sy = clamp((-this.wpVec.y * 0.5 + 0.5) * H, 40, H - 90);
    const d = Math.hypot(t.x - g.player.x, t.z - g.player.z);
    wp.style.display = 'block';
    wp.style.transform = `translate(${sx - 30}px, ${sy - 20}px)`;
    wp.lastElementChild.textContent = `${t.label ? t.label + ' · ' : ''}${Math.round(d)} м`;
  }

  updateTimer() {
    const el = this.$('#timer');
    const w = this.game.worldEvents;
    const t = w.timerInfo();
    if (!t) { el.style.display = 'none'; return; }
    el.style.display = 'block';
    el.classList.toggle('warn', t.warn);
    el.firstElementChild.textContent = t.label;
    el.lastElementChild.textContent = t.text;
  }

  // босс-бар
  bossBar(show, name = '', sub = '', ratio = 1) {
    const el = this.$('#bossbar');
    el.classList.toggle('show', show);
    this.bossRatio = ratio;
    if (show) {
      el.querySelector('.tb .grow').textContent = name;
      el.querySelector('.sub').textContent = sub;
    }
  }
  updateBossBar() {
    const b = this.game.ents.boss;
    const el = this.$('#bossbar');
    if (!b || b.dead) { if (el.classList.contains('show')) el.classList.remove('show'); return; }
    el.classList.add('show');
    const r = clamp(b.hp / b.maxHp, 0, 1);
    if (this.cache.boss !== r) {
      this.cache.boss = r;
      el.querySelector('.now').style.width = `${r * 100}%`;
      el.querySelector('.ghost').style.width = `${r * 100}%`;
    }
    const nm = `${b.name} — не отвечает`;
    if (this.cache.bossn !== nm + b.phaseLabel) {
      this.cache.bossn = nm + b.phaseLabel;
      el.querySelector('.tb .grow').textContent = nm;
      el.querySelector('.sub').textContent = b.phaseLabel || '';
    }
  }

  // ================================================================== экраны
  showTitle() { this.screens.title(); }
  showPause() { this.screens.pause(); }
  hidePause() { this.screens.clear(); }
  showDeath(o) { this.screens.death(o); }
  hideDeath() { this.screens.clear(); }
  showCredits(ending) { this.screens.credits(ending); }
  clearScreens() { this.screens.clear(); }

  openPanel(name, arg) {
    const g = this.game;
    if (g.state !== 'play' && g.state !== 'panel') return;
    g.setState('panel');
    g.input.exitLock();
    this.panelName = name;
    this.panels.open(name, arg);
  }
  openWorkshop(kind) { this.openPanel('workshop', kind); }
  openShop(id) { this.openPanel('shop', id); }
  closePanel() {
    if (this.game.state !== 'panel') return;
    this.panels.close();
    this.panelName = null;
    this.game.setState('play');
    this.game.input.requestLock();
  }
  handleKeys() {
    const g = this.game, inp = g.input;
    if (g.state === 'panel') {
      if (inp.codeHit('Escape') || inp.rawHit('inventory') && this.panelName === 'inventory' || inp.rawHit('quests') && this.panelName === 'quests' || inp.rawHit('hidden') && this.panelName === 'files') this.closePanel();
      else this.panels.keys();
    } else if (g.state === 'pause') {
      if (inp.codeHit('Escape') || inp.codeHit('KeyP')) g.resume();
    } else if (g.state === 'dialog') {
      this.dialogUI.keys();
    }
  }
}
