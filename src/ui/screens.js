import { Save, Settings, Records } from '../core/save.js';
import { esc, fmtTime } from '../core/util.js';
import { icon } from './icons.js';
import { VERSION } from '../config.js';
import { ENDINGS } from '../data/endings.js';

const CONTROLS = [
  ['W A S D', 'движение'], ['Мышь', 'обзор'], ['Пробел', 'прыжок (повторно — двойной)'], ['Shift', 'бег'],
  ['Q', 'рывок «Буфер обмена»'], ['F', 'грэппл «Ссылка» по синей ссылке'], ['ЛКМ', 'лёгкий удар курсором'], ['ПКМ (держать)', 'тяжёлый удар'],
  ['1–5 (6)', 'программы: Firewall, Defrag, Sleep Mode, Overclock, Delete (Safe Mode)'], ['E', 'говорить / использовать'], ['R', 'зелье патча (.zip)'],
  ['X', 'закрыть рекламное окно'], ['Tab / I', 'инвентарь и версия'], ['J', 'журнал задач'], ['H', 'скрытые файлы'], ['M', 'звук вкл/выкл'], ['Esc', 'пауза'],
];

export class Screens {
  constructor(game, ui) {
    this.game = game;
    this.ui = ui;
    this.el = ui.screensEl;
    this.deathKey = null;
  }

  clear() {
    this.el.innerHTML = '';
    if (this.deathKey) { window.removeEventListener('keydown', this.deathKey); window.removeEventListener('mousedown', this.deathKey); this.deathKey = null; }
  }

  btn(text, fn, cls = '') {
    const b = document.createElement('button');
    b.className = `btn ${cls}`;
    b.textContent = text;
    b.addEventListener('click', () => { this.game.audio.unlock(); this.game.audio.sfx('click'); fn(b); });
    return b;
  }

  winBox(title, cls = '') {
    const w = document.createElement('div');
    w.className = `win ${cls}`;
    w.innerHTML = `<div class="tb"><span class="grow">${esc(title)}</span><span class="x">×</span></div>`;
    const bd = document.createElement('div');
    bd.style.padding = '10px';
    w.appendChild(bd);
    return [w, bd];
  }

  // ------------------------------------------------------------------ титульный экран
  title() {
    const g = this.game;
    this.clear();
    const wrap = document.createElement('div');
    wrap.className = 'title-wrap';
    wrap.innerHTML = `
      <div class="logo">DESKTOP<em>IA</em></div>
      <div class="tagline">Вы — крошечный ярлык на рабочем столе старого ПК. Мир вот-вот отформатируют. Кто, если не вы?</div>`;
    const [win, bd] = this.winBox('Desktopia.exe — Главное меню', 'title-menu');
    const col = document.createElement('div');
    col.className = 'scr-center';
    bd.appendChild(col);
    const hasSave = Save.exists();
    if (hasSave) col.appendChild(this.btn('Продолжить', () => this.startAction(() => g.continueGame()), 'big'));
    col.appendChild(this.btn('Новая игра', () => this.startAction(() => g.newGame('story')), 'big'));
    col.appendChild(this.btn('Быстрая загрузка (спидран)', () => this.startAction(() => g.newGame('speedrun')), 'big'));
    col.appendChild(this.btn('Настройки', () => this.settings(() => this.title())));
    col.appendChild(this.btn('Управление', () => this.controls(() => this.title())));
    col.appendChild(this.btn('Рекорды и концовки', () => this.records(() => this.title())));
    win.appendChild(bd);
    wrap.appendChild(win);
    const ver = document.createElement('div');
    ver.className = 'ver';
    ver.textContent = `Desktopia ${VERSION} · 3D RPG от первого лица · WebGL`;
    const tips = document.createElement('div');
    tips.className = 'tips';
    tips.innerHTML = 'Лучше всего — на полном экране.<br>Мышь захватывается по клику; Esc — пауза.';
    wrap.append(ver, tips);
    this.el.appendChild(wrap);
  }

  async startAction(fn) {
    this.clear();
    this.game.audio.unlock();
    await fn();
  }

  // ------------------------------------------------------------------ пауза
  pause() {
    const g = this.game;
    this.clear();
    const dim = document.createElement('div');
    dim.className = 'dim';
    const [win, bd] = this.winBox('Диспетчер задач — Пауза');
    const col = document.createElement('div');
    col.className = 'scr-center';
    col.appendChild(this.btn('Продолжить', () => g.resume(), 'big'));
    col.appendChild(this.btn('Сохранить игру', () => g.saveGame(false)));
    col.appendChild(this.btn('Настройки', () => this.settings(() => this.pause())));
    col.appendChild(this.btn('Управление', () => this.controls(() => this.pause())));
    col.appendChild(this.btn('В главное меню', () => this.toMenu()));
    const info = document.createElement('div');
    info.className = 'hint';
    info.style.textAlign = 'center';
    info.textContent = `${g.stats.version} · ${g.zone?.name || ''} · время ${fmtTime(g.playtime)}${g.ng ? ' · Чистая установка #' + g.ng : ''}`;
    col.appendChild(info);
    bd.appendChild(col);
    dim.appendChild(win);
    this.el.appendChild(dim);
  }

  async toMenu() {
    const g = this.game;
    this.clear();
    await this.ui.fade(true, 250);
    g.music.stop?.(0.3);
    g.ui.clearPopups();
    g.setState('transition');
    await g.enterZone('desktop', 'default', { fresh: true, menu: true });
    g.setState('menu');
    this.title();
  }

  // ------------------------------------------------------------------ настройки
  settings(back) {
    const g = this.game;
    const s = g.settings;
    this.clear();
    const dim = document.createElement('div');
    dim.className = 'dim';
    const [win, bd] = this.winBox('Панель управления — Настройки', 'settings');
    const slider = (label, key, min, max, step, fmt = (v) => Math.round(v * 100) + '%') => {
      const row = document.createElement('div');
      row.className = 'srow';
      const v = document.createElement('span');
      const inp = document.createElement('input');
      inp.type = 'range'; inp.min = min; inp.max = max; inp.step = step; inp.value = s[key];
      v.textContent = fmt(+s[key]);
      inp.addEventListener('input', () => {
        s[key] = +inp.value;
        v.textContent = fmt(s[key]);
        Settings.write(s);
        g.audio.applyVolumes();
        if (key === 'fov') g.camera.updateProjectionMatrix();
      });
      row.append(Object.assign(document.createElement('span'), { textContent: label }), inp, v);
      bd.appendChild(row);
    };
    slider('Общая громкость', 'master', 0, 1, 0.05);
    slider('Музыка', 'music', 0, 1, 0.05);
    slider('Эффекты', 'sfx', 0, 1, 0.05);
    slider('Чувствительность мыши', 'sens', 0.3, 3, 0.05, (v) => v.toFixed(2));
    slider('Поле зрения (FOV)', 'fov', 60, 110, 1, (v) => Math.round(v) + '°');
    const row = document.createElement('div');
    row.className = 'srow';
    const sel = document.createElement('select');
    sel.innerHTML = '<option value="pixel">Пиксель (288p, ретро)</option><option value="medium">Средний (540p)</option><option value="high">Высокий (1080p)</option>';
    sel.value = s.quality;
    sel.addEventListener('change', () => { s.quality = sel.value; Settings.write(s); g.applyQuality(); });
    row.append(Object.assign(document.createElement('span'), { textContent: 'Качество картинки' }), sel, document.createElement('span'));
    bd.appendChild(row);
    const chk = (label, key) => {
      const l = document.createElement('label');
      l.className = 'chk';
      const c = document.createElement('input');
      c.type = 'checkbox'; c.checked = !!s[key];
      c.addEventListener('change', () => { s[key] = c.checked; Settings.write(s); });
      l.append(c, document.createTextNode(label));
      bd.appendChild(l);
    };
    chk('Покачивание камеры при ходьбе', 'bob');
    chk('Тряска экрана', 'shake');
    chk('Рекламные окна (adware-слизни)', 'popups');
    chk('Инвертировать мышь по вертикали', 'invertY');
    const b = document.createElement('div');
    b.style.cssText = 'display:flex;justify-content:flex-end;margin-top:8px';
    b.appendChild(this.btn('Назад', () => back()));
    bd.appendChild(b);
    dim.appendChild(win);
    this.el.appendChild(dim);
  }

  controls(back) {
    this.clear();
    const dim = document.createElement('div');
    dim.className = 'dim';
    const [win, bd] = this.winBox('Справка — Управление', 'settings');
    win.style.width = '720px';
    const list = document.createElement('div');
    list.className = 'controls-list';
    list.innerHTML = CONTROLS.map(([k, d]) => `<div><span class="kbd">${esc(k)}</span> ${esc(d)}</div>`).join('');
    bd.appendChild(list);
    const p = document.createElement('p');
    p.className = 'hint';
    p.textContent = 'Если браузер не даёт захватить мышь (встроенный просмотр), игра переключится на свободный обзор: двигайте мышь или используйте стрелки.';
    bd.appendChild(p);
    const b = document.createElement('div');
    b.style.cssText = 'display:flex;justify-content:flex-end';
    b.appendChild(this.btn('Назад', () => back()));
    bd.appendChild(b);
    dim.appendChild(win);
    this.el.appendChild(dim);
  }

  records(back) {
    const r = Records.load();
    this.clear();
    const dim = document.createElement('div');
    dim.className = 'dim';
    const [win, bd] = this.winBox('Журнал событий — Рекорды', 'settings');
    const rows = [
      ['Лучшая «Быстрая загрузка»', r.bestSpeedrun ? fmtTime(r.bestSpeedrun) : '—'],
      ['Запусков новой игры', r.runs || 0],
      ['Красная концовка (Удалить Обновление)', r.endings?.includes('red') ? 'получена' : '—'],
      ['Зелёная концовка (Принять Обновление)', r.endings?.includes('green') ? 'получена' : '—'],
      ['Жёлтая концовка (Облако)', r.endings?.includes('yellow') ? 'получена' : 'секретная'],
    ];
    bd.innerHTML = rows.map(([a, b]) => `<div class="statrow"><span style="flex:1">${esc(a)}</span><b>${esc(String(b))}</b></div>`).join('');
    const b = document.createElement('div');
    b.style.cssText = 'display:flex;justify-content:flex-end;margin-top:8px';
    b.appendChild(this.btn('Назад', () => back()));
    bd.appendChild(b);
    dim.appendChild(win);
    this.el.appendChild(dim);
  }

  // ------------------------------------------------------------------ BSOD при смерти
  death(o = {}) {
    const g = this.game;
    this.clear();
    const causes = {
      void: 'PAGE_FAULT_IN_NONPAGED_AREA: вы ушли за пределы адресного пространства.',
      heat: 'CPU_OVERHEAT: Overclock — это не всегда хорошая идея.',
      bsod: 'CRITICAL_PROCESS_DIED: Синий экран смерти победил.',
      timeout: 'TIMER_EXPIRED: «Быстрая загрузка» не успела загрузиться.',
    };
    const why = causes[o.type] || (o.by ? `KERNEL_SECURITY_CHECK_FAILURE: вас завершил процесс «${o.by}».` : 'SYSTEM_SERVICE_EXCEPTION: Шорткат получил критический урон.');
    const d = document.createElement('div');
    d.className = 'bsod';
    d.innerHTML = `
      <h2>Desktopia</h2>
      <div>Обнаружена проблема, и процесс «Шорткат» был завершён, чтобы предотвратить повреждение мира.</div>
      <div class="code">${esc(why)}</div>
      <div>Если вы видите этот экран впервые — не волнуйтесь, вы в хорошей компании.<br>
      Если он появился снова — попробуйте удалить недавно установленные «враги» и сменить стратегию.</div>
      <div class="code">Технические сведения:<br>*** STOP: 0x000000${(Math.random() * 255 | 0).toString(16).toUpperCase().padStart(2, '0')} (0xDE5C0000, 0x00000002, 0x00000000, 0x${g.zone?.id?.length || 0}F0A11ED)</div>
      <div class="cont"><span class="blink">Нажмите любую клавишу для перезагрузки из последней точки восстановления_</span><br>
      <span style="opacity:.75">При перезагрузке будет потеряно 10% байтов.</span></div>`;
    this.el.appendChild(d);
    setTimeout(() => {
      if (g.state !== 'dead') return;
      this.deathKey = () => {
        window.removeEventListener('keydown', this.deathKey);
        window.removeEventListener('mousedown', this.deathKey);
        this.deathKey = null;
        g.respawn().catch((e) => g.fatal(e));
      };
      window.addEventListener('keydown', this.deathKey);
      window.addEventListener('mousedown', this.deathKey);
    }, 1100);
  }

  // ------------------------------------------------------------------ финальные титры
  credits(endingId) {
    const g = this.game;
    const E = ENDINGS[endingId] || ENDINGS.red;
    this.clear();
    g.setState('ending');
    g.input.exitLock();
    const r = Records.load();
    r.endings = Array.from(new Set([...(r.endings || []), endingId]));
    if (g.mode === 'speedrun' && (!r.bestSpeedrun || g.playtime < r.bestSpeedrun)) r.bestSpeedrun = Math.round(g.playtime);
    Records.write(r);
    const d = document.createElement('div');
    d.className = 'credits';
    const lines = E.text.map((t) => `<p>${esc(t)}</p>`).join('');
    d.innerHTML = `<div class="roll" style="top:100%"><h1 style="color:${E.color}">${esc(E.title)}</h1>${lines}
      <p style="margin-top:40px">Время прохождения: ${fmtTime(g.playtime)} · Версия: ${esc(g.stats.version)} · Скрытых файлов: ${g.hidden.size}</p>
      <p style="margin:40px 0 20px">СПАСИБО, ЧТО ИГРАЛИ В DESKTOPIA</p><p>Все звуки и музыка синтезированы в браузере. Ни один пиксель не пострадал.</p><p style="margin-top:80px"></p></div>
      <div style="position:absolute;left:0;right:0;bottom:24px;display:flex;gap:12px;justify-content:center" id="credBtns"></div>`;
    this.el.appendChild(d);
    const roll = d.querySelector('.roll');
    let y = g.viewH;
    const tick = () => {
      if (!roll.isConnected) return;
      y -= 0.6;
      roll.style.top = `${y}px`;
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
    const bt = d.querySelector('#credBtns');
    if (g.mode === 'story') bt.appendChild(this.btn('Чистая установка (Новая игра+)', () => { this.clear(); g.newGamePlus(); }, 'big'));
    bt.appendChild(this.btn('В главное меню', () => this.toMenu(), 'big'));
    g.music.play?.(E.music || 'credits');
  }
}
