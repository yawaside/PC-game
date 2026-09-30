import { ITEMS, SLOT_NAMES, EQUIP_SLOTS } from '../data/items.js';
import { ABILITIES, ABILITY_ORDER } from '../data/abilities.js';
import { HIDDEN_FILES, HIDDEN_TOTAL, HIDDEN_NEEDED } from '../data/world.js';
import { SHOPS } from '../data/shops.js';
import { RECIPES_ARCHIVER } from '../data/recipes.js';
import { STAT_INFO, STATS } from '../config.js';
import { esc, fmtNum, hexStr, plural } from '../core/util.js';
import { icon } from './icons.js';
import { versionName, xpForNext } from '../player/stats.js';

const SLOT_ICON = { weapon: 'sword', accessory: 'gear', armor: 'shield', zip: 'zip', junk: 'file', code: 'code', quest: 'key' };
const SLOT_ORDER = ['weapon', 'accessory', 'armor', 'zip', 'code', 'junk', 'quest'];

const itemIcon = (id) => {
  const it = ITEMS[id];
  if (!it) return icon('file');
  const col = it.color !== undefined ? hexStr(it.color === 0xffffff ? 0x444444 : it.color) : '#444';
  return `<span style="color:${it.slot === 'weapon' || it.slot === 'accessory' ? col : '#333'}">${icon(SLOT_ICON[it.slot] || 'file')}</span>`;
};

function modText(it) {
  const parts = [];
  const M = { dmg: 'урон', cpu: 'CPU', ram: 'RAM', storage: 'Storage', bandwidth: 'Bandwidth', hp: 'HP', armor: 'броня', move: 'скорость', dashCd: 'перезарядка рывка', grapple: 'дальность «Ссылки»' };
  for (const [k, v] of Object.entries(it.mods || {})) {
    const pct = ['move', 'dashCd', 'grapple', 'dmg'].includes(k);
    parts.push(`${M[k] || k} ${v > 0 ? '+' : ''}${pct ? Math.round(v * 100) + '%' : v}`);
  }
  if (it.w) {
    parts.push(`урон ×${it.w.dmg}`, `скорость ×${it.w.speed}`, `дальность ×${it.w.range}`);
    if (it.w.crit) parts.push(`крит ${Math.round(it.w.crit * 100)}%`);
    if (it.w.lifesteal) parts.push(`вампиризм ${Math.round(it.w.lifesteal * 100)}%`);
    if (it.w.bossDmg) parts.push(`по боссам +${Math.round(it.w.bossDmg * 100)}%`);
  }
  if (it.use) {
    if (it.use.heal) parts.push(`+${it.use.heal} HP`);
    if (it.use.ram) parts.push(`+${it.use.ram} RAM`);
    if (it.use.buff) parts.push(`бафф ${it.use.dur} с`);
  }
  return parts.join(' · ');
}

export class Panels {
  constructor(game, ui) {
    this.game = game;
    this.ui = ui;
    this.name = null;
    this.root = null;
    this.tab = 'files';
    this.sel = null;
    this.qSel = null;
    this.shopTab = 'buy';
    this.kind = null;
    this.arg = null;
  }

  get el() {
    return this.ui.screensEl;
  }

  open(name, arg) {
    this.name = name;
    this.arg = arg;
    if (name === 'workshop') this.kind = arg;
    if (name === 'inventory') this.tab = arg || 'files';
    if (name === 'shop') this.shopTab = 'buy';
    this.sel = null;
    this.render();
  }

  close() {
    this.name = null;
    this.el.innerHTML = '';
    this.root = null;
  }

  update() {}

  keys() {
    const inp = this.game.input;
    if (this.name === 'inventory' && this.tab === 'files') {
      const list = this.sortedStacks();
      if (!list.length) return;
      let i = list.findIndex((s) => s.id === this.sel);
      if (inp.codeHit('ArrowDown') || inp.codeHit('KeyS')) i = Math.min(list.length - 1, i + 1);
      else if (inp.codeHit('ArrowUp') || inp.codeHit('KeyW')) i = Math.max(0, i < 0 ? 0 : i - 1);
      else if (inp.codeHit('Enter') || inp.codeHit('KeyE')) { this.primary(); return; }
      else return;
      this.sel = list[i].id;
      this.render();
    }
  }

  sortedStacks() {
    const inv = this.game.inv;
    const seen = new Map();
    for (const s of inv.stacks) seen.set(s.id, (seen.get(s.id) || 0) + s.n);
    const arr = [...seen.entries()].map(([id, n]) => ({ id, n }));
    arr.sort((a, b) => SLOT_ORDER.indexOf(ITEMS[a.id].slot) - SLOT_ORDER.indexOf(ITEMS[b.id].slot) || (ITEMS[b.id].tier - ITEMS[a.id].tier) || ITEMS[a.id].name.localeCompare(ITEMS[b.id].name));
    return arr;
  }

  // -------------------------------------------------------------- каркас
  shell(title, tabs = null) {
    this.el.innerHTML = '';
    const dim = document.createElement('div');
    dim.className = 'dim';
    const w = document.createElement('div');
    w.className = 'panel win';
    w.innerHTML = `<div class="tb">${icon('folder')}<span class="grow">${esc(title)}</span><span class="x" data-act="close">×</span></div>`;
    if (tabs) {
      const t = document.createElement('div');
      t.className = 'tabs';
      t.innerHTML = tabs.map(([id, label]) => `<div class="tab ${this.tab === id ? 'on' : ''}" data-tab="${id}">${esc(label)}</div>`).join('');
      w.appendChild(t);
    }
    const bd = document.createElement('div');
    bd.className = 'bd';
    w.appendChild(bd);
    dim.appendChild(w);
    this.el.appendChild(dim);
    this.root = bd;
    w.addEventListener('click', (e) => this.onClick(e));
    dim.addEventListener('mousedown', (e) => e.stopPropagation());
    return bd;
  }

  onClick(e) {
    const t = e.target.closest('[data-act],[data-tab],[data-item],[data-stat],[data-q],[data-buy],[data-sell],[data-craft],[data-eq]');
    if (!t) return;
    const g = this.game;
    g.audio.unlock();
    const d = t.dataset;
    if (d.act === 'close') return this.ui.closePanel();
    if (d.tab) { this.tab = d.tab; this.sel = null; g.audio.sfx('click'); return this.render(); }
    if (d.item) { this.sel = d.item; g.audio.sfx('click'); return this.render(); }
    if (d.act) return this.action(d.act, d);
    if (d.stat) {
      if (g.stats.spend(d.stat)) { g.audio.sfx('levelpoint'); g.inv.clampVitals(); }
      return this.render();
    }
    if (d.q) { this.qSel = d.q; g.quests.setTracked(d.q); g.audio.sfx('click'); return this.render(); }
    if (d.buy) return this.buy(d.buy);
    if (d.sell) return this.sell(d.sell);
    if (d.craft) return this.craft(d.craft, d.n ? +d.n : 1);
    if (d.eq) { if (g.inv.unequip(d.eq)) g.audio.sfx('click'); else g.ui.toast('Нет места в рюкзаке', 'warn'); return this.render(); }
  }

  action(act) {
    const g = this.game, inv = g.inv;
    const id = this.sel;
    if (act === 'equip' && id) {
      if (inv.equip(id)) { g.audio.sfx('equip'); g.ui.toast(`Экипировано: ${ITEMS[id].name}`, 'good'); g.combat.refreshWeapon?.(); }
    } else if (act === 'use' && id) this.use(id);
    else if (act === 'drop' && id) {
      if (ITEMS[id].slot !== 'quest') { inv.remove(id, 1); g.audio.sfx('click'); g.ui.toast(`Удалено: ${ITEMS[id].name}`, 'info'); if (!inv.has(id)) this.sel = null; }
    } else if (act === 'convert' && id) {
      const to = inv.convert(id);
      if (to) { g.audio.sfx('convert'); g.ui.toast(`Конвертировано: ${ITEMS[id].name} → ${ITEMS[to].name}`, 'good'); this.sel = to; g.events.emit('converted', to); }
      else g.ui.toast('Не хватает материалов для конвертации', 'warn');
    } else if (act === 'showhidden') {
      g.showHidden = !g.showHidden;
      g.audio.sfx('click');
    }
    this.render();
  }

  use(id) {
    const g = this.game, inv = g.inv, it = ITEMS[id];
    if (!it?.use || !inv.has(id)) return;
    if (it.use.heal) { if (g.player.hp >= g.stats.maxHp) return g.ui.toast('HP и так полное', 'info'); g.player.heal(it.use.heal); }
    if (it.use.ram) { if (g.player.ram >= g.stats.maxRam) return g.ui.toast('RAM и так полная', 'info'); g.player.ram = Math.min(g.stats.maxRam, g.player.ram + it.use.ram); }
    if (it.use.buff) g.stats.addBuff(it.use.buff, it.use.mult, it.use.dur);
    inv.remove(id, 1);
    g.audio.sfx('use');
    g.ui.toast(`Распаковано: ${it.name}`, 'good');
    g.events.emit('itemUsed', id);
    if (!inv.has(id)) this.sel = null;
  }

  primary() {
    const it = ITEMS[this.sel];
    if (!it) return;
    if (EQUIP_SLOTS.includes(it.slot)) this.action('equip');
    else if (it.use) this.action('use');
  }

  render() {
    const n = this.name;
    if (n === 'inventory') this.renderInventory();
    else if (n === 'quests') this.renderQuests();
    else if (n === 'files') this.renderFiles();
    else if (n === 'workshop') this.renderWorkshop();
    else if (n === 'shop') this.renderShop();
  }

  // -------------------------------------------------------------- инвентарь
  renderInventory() {
    const g = this.game, inv = g.inv, st = g.stats;
    const bd = this.shell(`Проводник — C:\\Шорткат\\${st.version}`, [['files', 'Файлы'], ['version', `Версия${st.points ? ` (+${st.points})` : ''}`], ['programs', 'Программы']]);
    if (this.tab === 'files') this.tabFiles(bd);
    else if (this.tab === 'version') this.tabVersion(bd);
    else this.tabPrograms(bd);
  }

  tabFiles(bd) {
    const g = this.game, inv = g.inv;
    const list = this.sortedStacks();
    if (!this.sel || !list.find((s) => s.id === this.sel)) this.sel = list[0]?.id || null;
    let lastSlot = null;
    const rows = list.map((s) => {
      const it = ITEMS[s.id];
      const head = it.slot !== lastSlot ? `<div class="hint" style="padding:4px 6px 0"><b>${esc(SLOT_NAMES[it.slot])}</b></div>` : '';
      lastSlot = it.slot;
      return `${head}<div class="item ${this.sel === s.id ? 'sel' : ''}" data-item="${s.id}">${itemIcon(s.id)}<span>${esc(it.name)}</span><span class="n">${s.n > 1 ? '×' + s.n : ''}</span></div>`;
    }).join('') || '<div class="hint" style="padding:10px">Пусто. Как на свежеустановленной системе.</div>';
    const eq = EQUIP_SLOTS.map((slot) => {
      const id = inv.equipped[slot];
      const it = id && ITEMS[id];
      return `<div class="eqslot sunken" ${id ? `data-eq="${slot}" title="Снять"` : ''}>${it ? itemIcon(id) : icon(SLOT_ICON[slot])}<div><b>${it ? esc(it.name) : '— пусто —'}</b><small>${esc(SLOT_NAMES[slot])}</small></div></div>`;
    }).join('');
    const it = this.sel && ITEMS[this.sel];
    let det = '<div class="hint">Выберите файл слева.</div>';
    let btns = '';
    if (it) {
      det = `<h3>${itemIcon(this.sel)} ${esc(it.name)}</h3><span class="tag">${esc(SLOT_NAMES[it.slot])}</span><span class="tag">ур. ${it.tier}</span><p>${esc(it.desc)}</p><p class="hint">${esc(modText(it))}</p>${it.convert ? `<p class="hint">Конвертация → <b>${esc(ITEMS[it.convert.to].name)}</b>: ${Object.entries(it.convert.cost).map(([k, n]) => `${n}× ${esc(ITEMS[k].name)}${inv.has(k, n) ? '' : ' ✗'}`).join(', ')}</p>` : ''}`;
      if (EQUIP_SLOTS.includes(it.slot)) btns += '<button class="btn" data-act="equip">Экипировать</button>';
      if (it.use) btns += '<button class="btn" data-act="use">Использовать</button>';
      if (it.convert) btns += `<button class="btn ${inv.canConvert(this.sel) ? '' : 'dis'}" data-act="convert">Конвертировать</button>`;
      if (it.slot !== 'quest') btns += '<button class="btn" data-act="drop">Удалить</button>';
    }
    bd.innerHTML = `<div class="cols">
      <div class="col" style="flex:1.25"><div class="row hint" style="justify-content:space-between;margin-bottom:3px"><span>Занято: <b>${inv.used()} / ${inv.capacity}</b> (Storage ${g.stats.stat('storage')})</span><span>${icon('coin')} ${fmtNum(inv.bytes)} Б</span></div><div class="list sunken">${rows}</div></div>
      <div class="col" style="flex:1"><div class="grp" style="margin-top:0"><b>Запущено сейчас</b>${eq}</div><div class="detail sunken" style="flex:1;overflow:auto">${det}</div><div class="row" style="flex-wrap:wrap;margin-top:6px">${btns}</div></div>
    </div><div class="hint" style="margin-top:4px">↑↓ — выбор, Enter — экипировать/использовать, Tab — закрыть</div>`;
  }

  tabVersion(bd) {
    const g = this.game, st = g.stats;
    const need = xpForNext(st.level);
    const rows = STATS.map((k) => {
      const inf = STAT_INFO[k];
      return `<div class="statrow"><span class="nm">${icon(inf.icon)} ${inf.name}</span><span class="v">${st.stat(k)}</span>${st.points > 0 ? `<button class="btn" style="min-height:24px;padding:0 10px" data-stat="${k}">+</button>` : '<span style="width:40px"></span>'}<span class="d">${esc(inf.desc)}</span></div>`;
    }).join('');
    bd.innerHTML = `<div class="cols">
      <div class="col" style="flex:1.2">
        <div class="grp"><b style="font-size:26px">${st.version}</b> <span class="hint">уровень ${st.level}${st.level >= 30 ? ' (максимум)' : ''}</span>
          <div class="progress sunken"><b style="width:${st.level >= 30 ? 100 : Math.round((st.xp / need) * 100)}%"></b></div>
          <div class="hint">${st.level >= 30 ? '' : `Опыт: ${st.xp} / ${need}`} · Свободных очков: <b>${st.points}</b></div></div>
        <div class="grp">${rows}</div>
      </div>
      <div class="col" style="flex:1"><div class="grp"><b>Производные параметры</b>
        <div class="statrow"><span class="nm">${icon('heart')} HP</span><span class="v" style="width:auto">${st.maxHp}</span></div>
        <div class="statrow"><span class="nm">${icon('ram')} RAM</span><span class="v" style="width:auto">${st.maxRam} (+${st.ramRegen.toFixed(1)}/с)</span></div>
        <div class="statrow"><span class="nm">${icon('sword')} Урон</span><span class="v" style="width:auto">×${st.dmgMult.toFixed(2)}</span></div>
        <div class="statrow"><span class="nm">${icon('net')} Скорость</span><span class="v" style="width:auto">×${st.speedMult.toFixed(2)}</span></div>
        <div class="statrow"><span class="nm">${icon('shield')} Броня</span><span class="v" style="width:auto">${st.armor} (−${Math.round((1 - st.damageTaken) * 100)}% урона)</span></div>
        <div class="statrow"><span class="nm">${icon('disk')} Слоты</span><span class="v" style="width:auto">${st.slots}</span></div></div>
        <div class="hint">Каждый новый номер версии даёт 2 очка. Экипировка (.dll, .sys) тоже меняет характеристики.</div></div>
    </div>`;
  }

  tabPrograms(bd) {
    const g = this.game, st = g.stats;
    const moves = [
      ['doubleJump', 'jump', 'Драйвер прыжка v2.0', 'Пробел в воздухе — двойной прыжок'],
      ['dash', 'dash', 'Буфер обмена', 'Q — короткий рывок-телепорт с неуязвимостью'],
      ['grapple', 'link', 'Ссылка (Link.dll)', 'F — зацепиться за синюю гиперссылку в зоне прицела'],
    ];
    const mv = moves.map(([k, ic, nm, ds]) => `<div class="item" style="cursor:default;${st.moves[k] ? '' : 'opacity:.45'}">${icon(ic)}<span><b>${nm}</b><br><small class="hint">${ds}</small></span><span class="n">${st.moves[k] ? 'установлено' : 'не найдено'}</span></div>`).join('');
    const ab = ABILITY_ORDER.map((id) => {
      const a = ABILITIES[id];
      const have = st.abilities[id];
      const mod = st.mods[id];
      return `<div class="item" style="cursor:default;${have ? '' : 'opacity:.45'}"><span style="color:${a.color}">${icon(a.icon)}</span><span><b>${a.name}</b> <span class="tag">${a.key}</span>${mod ? `<span class="tag" style="background:#2a7a2a">${esc(a.mod.name)}</span>` : ''}<br><small class="hint">${esc(a.desc)} · RAM ${a.cost} · перезарядка ${a.cd} с</small></span><span class="n">${have ? 'установлено' : 'не найдено'}</span></div>`;
    }).join('');
    bd.innerHTML = `<div class="list sunken" style="flex:1"><div class="hint" style="padding:6px 6px 0"><b>Навыки движения</b></div>${mv}<div class="hint" style="padding:6px 6px 0"><b>Программы (1–5, Safe Mode — 6)</b></div>${ab}</div><div class="hint" style="margin-top:4px">Улучшить программы («2.0») можно в Компиляторе на Рабочем столе.</div>`;
  }

  // -------------------------------------------------------------- квесты
  renderQuests() {
    const g = this.game;
    const j = g.quests.journal();
    const bd = this.shell('Блокнот — Журнал задач.txt', [['active', `Активные (${j.active.length})`], ['done', `Выполнено (${j.done.length})`]]);
    const list = this.tab === 'done' ? j.done : j.active;
    if (!this.qSel || !list.find((q) => q.id === this.qSel)) this.qSel = list[0]?.id || null;
    const rows = list.map((q) => `<div class="item ${this.qSel === q.id ? 'sel' : ''}" data-q="${q.id}">${icon(q.main ? 'star' : 'file')}<span>${esc(q.title)}</span>${q.tracked ? '<span class="n">◆</span>' : ''}</div>`).join('') || '<div class="hint" style="padding:10px">Здесь пока пусто.</div>';
    const q = list.find((x) => x.id === this.qSel);
    const det = q ? `<h3>${esc(q.title)}</h3>${q.main ? '<span class="tag">главная</span>' : '<span class="tag" style="background:#666">побочная</span>'}${q.giver ? `<span class="tag" style="background:#2a7a2a">${esc(q.giver)}</span>` : ''}<p>${esc(q.desc)}</p>${(q.lines || []).map((l) => `<div class="row" style="margin:2px 0;${l.done ? 'color:#2a7a2a;text-decoration:line-through' : ''}">${icon(l.done ? 'check' : 'arrow')} ${esc(l.text)}</div>`).join('')}${q.reward ? `<p class="hint">Награда: ${esc(q.reward)}</p>` : ''}${this.tab === 'active' ? `<p class="hint">Клик по задаче — отслеживать на экране${q.tracked ? ' (отслеживается)' : ''}.</p>` : ''}` : '<div class="hint">Выберите задачу.</div>';
    bd.innerHTML = `<div class="cols"><div class="col" style="flex:1"><div class="list sunken">${rows}</div></div><div class="col" style="flex:1.3"><div class="detail sunken" style="flex:1;overflow:auto">${det}</div></div></div>`;
  }

  // -------------------------------------------------------------- скрытые файлы
  renderFiles() {
    const g = this.game;
    const bd = this.shell('Свойства папки — Скрытые файлы');
    const found = g.hiddenCount;
    const rows = HIDDEN_FILES.map((h) => {
      const f = g.hidden.has(h.id);
      return `<div class="item" style="cursor:default;${f ? '' : 'opacity:.7'}">${icon(f ? 'file' : 'lock')}<span>${f ? `<b>${esc(h.name)}</b>` : '???.???'}<br><small class="hint">${f ? `найден · ${esc(h.zone)}` : `подсказка: ${esc(h.hint)}`}</small></span></div>`;
    }).join('');
    bd.innerHTML = `<div class="row" style="justify-content:space-between;margin-bottom:6px"><span>Найдено скрытых файлов: <b>${found} / ${HIDDEN_TOTAL}</b></span><button class="btn ${g.showHidden ? 'on' : ''}" data-act="showhidden">Показывать скрытые файлы: ${g.showHidden ? 'ДА' : 'НЕТ'}</button></div>
      <div class="list sunken" style="flex:1">${rows}</div>
      <div class="hint" style="margin-top:4px">${found >= HIDDEN_NEEDED ? 'Папка «System Volume Information» на холме Bliss открыта. ' : `${HIDDEN_NEEDED} файлов открывают папку «System Volume Information». `}Все ${HIDDEN_TOTAL} — ключ к секретной «Облачной» концовке.</div>`;
  }

  // -------------------------------------------------------------- мастерские
  renderWorkshop() {
    const g = this.game, inv = g.inv;
    const kind = this.kind;
    const titles = { archiver: 'Архиватор — мусор в .zip', compiler: 'Компилятор — фрагменты в программы', converter: 'Конвертер — смена формата' };
    const bd = this.shell(titles[kind]);
    const need = (req) => Object.entries(req).map(([k, n]) => `<span class="${inv.has(k, n) ? '' : 'lack'}">${n}× ${esc(ITEMS[k].name)} (${inv.count(k)})</span>`).join(', ');
    let body = '';
    if (kind === 'archiver') {
      body = RECIPES_ARCHIVER.map((r, i) => {
        const can = Object.entries(r.req).every(([k, n]) => inv.has(k, n));
        const it = ITEMS[r.out];
        return `<div class="recipe sunken">${itemIcon(r.out)}<div><div class="nm">${esc(it.name)}${r.n > 1 ? ' ×' + r.n : ''}</div><div class="need">${need(r.req)}</div><div class="hint">${esc(it.desc)}</div></div><button class="btn ${can ? '' : 'dis'}" data-craft="a${i}">Сжать</button></div>`;
      }).join('');
    } else if (kind === 'compiler') {
      body = ABILITY_ORDER.filter((id) => ABILITIES[id].mod).map((id) => {
        const a = ABILITIES[id], m = a.mod;
        const have = g.stats.abilities[id];
        const done = g.stats.mods[id];
        const can = have && !done && Object.entries(m.recipe).every(([k, n]) => inv.has(k, n));
        return `<div class="recipe sunken"><span style="color:${a.color};font-size:26px">${icon(a.icon)}</span><div><div class="nm">${esc(m.name)}</div><div class="need">${have ? need(m.recipe) : '<span class="lack">Сначала найдите «' + a.name + '»</span>'}</div><div class="hint">${esc(m.desc)}</div></div><button class="btn ${can ? '' : 'dis'}" data-craft="c${id}">${done ? 'Готово' : 'Скомпилировать'}</button></div>`;
      }).join('');
    } else {
      const convs = g.inv.stacks.filter((s, i, a) => ITEMS[s.id].convert && a.findIndex((x) => x.id === s.id) === i);
      body = convs.map((s) => {
        const it = ITEMS[s.id], c = it.convert;
        const can = inv.canConvert(s.id);
        return `<div class="recipe sunken">${itemIcon(s.id)}<div><div class="nm">${esc(it.name)} → ${esc(ITEMS[c.to].name)}</div><div class="need">${need(c.cost)}</div><div class="hint">${esc(ITEMS[c.to].desc)}</div></div><button class="btn ${can ? '' : 'dis'}" data-craft="v${s.id}">Конвертировать</button></div>`;
      }).join('') || '<div class="hint" style="padding:10px">Нечего конвертировать. Подберите .bmp, .ocx или .bat — их можно улучшить до .png, .dll и .exe.</div>';
    }
    bd.innerHTML = `<div class="row hint" style="justify-content:space-between;margin-bottom:4px"><span>Ваши файлы: мусор — из врагов и сундуков, фрагменты кода — из редкой добычи</span><span>Занято: ${inv.used()}/${inv.capacity}</span></div><div class="list" style="flex:1">${body}</div>`;
  }

  craft(key, times = 1) {
    const g = this.game, inv = g.inv;
    const kind = key[0], rest = key.slice(1);
    let ok = false;
    if (kind === 'a') {
      const r = RECIPES_ARCHIVER[+rest];
      if (r && Object.entries(r.req).every(([k, n]) => inv.has(k, n))) {
        if (inv.free <= 0 && !inv.has(r.out)) return g.ui.toast('Нет места в рюкзаке', 'warn');
        for (const [k, n] of Object.entries(r.req)) inv.remove(k, n);
        inv.add(r.out, r.n);
        g.ui.toast(`Создано: ${ITEMS[r.out].name}${r.n > 1 ? ' ×' + r.n : ''}`, 'good');
        ok = true;
        g.events.emit('crafted', r.out);
      }
    } else if (kind === 'c') {
      const a = ABILITIES[rest];
      if (a?.mod && g.stats.abilities[rest] && !g.stats.mods[rest] && Object.entries(a.mod.recipe).every(([k, n]) => inv.has(k, n))) {
        for (const [k, n] of Object.entries(a.mod.recipe)) inv.remove(k, n);
        g.stats.mods[rest] = true;
        g.ui.toast(`Скомпилировано: ${a.mod.name}!`, 'good');
        ok = true;
        g.events.emit('compiled', rest);
      }
    } else if (kind === 'v') {
      const to = inv.convert(rest);
      if (to) { g.ui.toast(`Конвертировано: ${ITEMS[rest].name} → ${ITEMS[to].name}`, 'good'); ok = true; g.events.emit('converted', to); }
    }
    g.audio.sfx(ok ? 'craft' : 'error');
    if (!ok) g.ui.toast('Не хватает материалов', 'warn');
    void times;
    this.render();
  }

  // -------------------------------------------------------------- магазин
  renderShop() {
    const g = this.game, inv = g.inv;
    const shop = SHOPS[this.arg] || SHOPS.calc;
    const bd = this.shell(shop.name, null);
    const tabs = `<div class="tabs" style="margin:0 0 4px"><div class="tab ${this.shopTab === 'buy' ? 'on' : ''}" data-tab2="buy">Купить</div><div class="tab ${this.shopTab === 'sell' ? 'on' : ''}" data-tab2="sell">Продать</div></div>`;
    let rows = '';
    if (this.shopTab === 'buy') {
      rows = shop.stock.filter(([, , act]) => g.act >= act).map(([id, price]) => {
        const it = ITEMS[id];
        const can = inv.bytes >= price;
        return `<div class="recipe sunken">${itemIcon(id)}<div><div class="nm">${esc(it.name)}</div><div class="need">${esc(it.desc)}</div><div class="hint">${esc(modText(it))}</div></div><button class="btn ${can ? '' : 'dis'}" data-buy="${id}">${price} Б</button></div>`;
      }).join('');
    } else {
      const seen = new Map();
      for (const s of inv.stacks) seen.set(s.id, (seen.get(s.id) || 0) + s.n);
      rows = [...seen.entries()].filter(([id]) => ITEMS[id].slot !== 'quest').map(([id, n]) => {
        const it = ITEMS[id];
        const price = Math.max(1, Math.round(it.value * 0.5));
        return `<div class="recipe sunken">${itemIcon(id)}<div><div class="nm">${esc(it.name)} ×${n}</div><div class="hint">${esc(SLOT_NAMES[it.slot])}</div></div><button class="btn" data-sell="${id}">+${price} Б</button></div>`;
      }).join('') || '<div class="hint" style="padding:10px">Нечего продавать.</div>';
    }
    bd.innerHTML = `<div class="row" style="justify-content:space-between"><span class="hint">${esc(shop.greeting)}</span><b>${icon('coin')} ${fmtNum(inv.bytes)} Б · место ${inv.used()}/${inv.capacity}</b></div>${tabs}<div class="list" style="flex:1">${rows}</div>`;
    // переключатель вкладок магазина
    bd.querySelectorAll('[data-tab2]').forEach((el) => el.addEventListener('click', (ev) => { ev.stopPropagation(); this.shopTab = el.dataset.tab2; this.game.audio.sfx('click'); this.render(); }));
  }

  buy(id) {
    const g = this.game, inv = g.inv;
    const shop = SHOPS[this.arg] || SHOPS.calc;
    const row = shop.stock.find((r) => r[0] === id);
    if (!row) return;
    if (inv.bytes < row[1]) { g.audio.sfx('error'); return g.ui.toast('Недостаточно байтов', 'warn'); }
    if (inv.free <= 0 && !(ITEMS[id].stack > 1 && inv.stacks.some((s) => s.id === id && s.n < ITEMS[id].stack))) { g.audio.sfx('error'); return g.ui.toast('Нет места в рюкзаке', 'warn'); }
    inv.spendBytes(row[1]);
    inv.add(id, 1);
    g.audio.sfx('buy');
    g.events.emit('bought', id);
    this.render();
  }

  sell(id) {
    const g = this.game, inv = g.inv;
    const it = ITEMS[id];
    if (!inv.has(id)) return;
    inv.remove(id, 1);
    inv.addBytes(Math.max(1, Math.round(it.value * 0.5)));
    g.audio.sfx('buy');
    this.render();
  }
}
