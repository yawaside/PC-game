import * as THREE from 'three';
import { CFG, VERSION } from './config.js';
import { Input } from './core/input.js';
import { AudioEngine } from './core/audio.js';
import { Emitter } from './core/events.js';
import { Save, Settings, Records } from './core/save.js';
import { hashStr } from './core/rng.js';
import { clamp, damp, dist2D, fmtTime } from './core/util.js';
import { Sky } from './gfx/sky.js';
import { Particles } from './gfx/particles.js';
import { Stats } from './player/stats.js';
import { Inventory } from './player/inventory.js';
import { Player } from './player/player.js';
import { Zone } from './zones/zone.js';
import { ZONES } from './zones/index.js';
import { GATES, HIDDEN_FILES, HIDDEN_TOTAL, gateLock } from './data/world.js';
import { UI } from './ui/ui.js';
import { Combat } from './combat/combat.js';
import { Entities } from './entities/manager.js';
import { Quests } from './systems/quests.js';
import { Dialogs } from './systems/dialogs.js';
import { WorldEvents } from './systems/worldevents.js';
import { Music } from './core/music.js';
import { makeHalo } from './gfx/text.js';
import { basic, GEO } from './gfx/materials.js';

const QUALITY_H = { pixel: 288, medium: 540, high: 1080 };

export class Game {
  constructor(canvas, uiRoot, opts = {}) {
    this.canvas = canvas;
    this.debug = !!opts.debug;
    this.settings = Settings.load();
    this.records = Records.load();
    this.events = new Emitter();
    this.clockT = 0;
    this.playtime = 0;
    this.timeScale = 1;
    this.freeze = 0;
    this.shakeAmt = 0;
    this.state = 'boot';
    this.prevState = 'play';
    this.flags = {};
    this.mode = 'story';
    this.ng = 0;
    this.runSeed = (Math.random() * 1e9) | 0;
    this.opened = new Set();
    this.hidden = new Set();
    this.cheats = { god: false, moon: false, speed: false, ram: false };
    this.cp = null;
    this.zone = null;
    this.portalCd = 0;
    this.interactTarget = null;
    this.lockNote = 0;
    this.mood = 0.25;

    // --- рендер ---
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance', alpha: false });
    renderer.autoClear = false;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.setClearColor(0x000000, 1);
    this.renderer = renderer;
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(this.settings.fov, 16 / 9, 0.06, 1400);
    this.scene.add(this.camera);
    this.wScene = new THREE.Scene();
    this.wCamera = new THREE.PerspectiveCamera(62, 16 / 9, 0.02, 20);
    this.wScene.add(new THREE.HemisphereLight(0xffffff, 0x8899bb, 1.5));
    const wl = new THREE.DirectionalLight(0xffffff, 1.6);
    wl.position.set(1, 2, 1.5);
    this.wScene.add(wl);
    this.hemi = new THREE.HemisphereLight(0xffffff, 0x888888, 1);
    this.sun = new THREE.DirectionalLight(0xffffff, 1);
    this.scene.add(this.hemi, this.sun, this.sun.target);
    this.sky = new Sky();
    this.scene.add(this.sky.mesh);
    this.fx = new Particles(this.scene, 1400);

    // --- системы ---
    this.input = new Input(canvas);
    this.audio = new AudioEngine(this.settings);
    this.music = new Music(this.audio);
    this.stats = new Stats(this);
    this.inv = new Inventory(this);
    this.player = new Player(this);
    this.scene.add(this.player.rope);
    this.combat = new Combat(this);
    this.ents = new Entities(this);
    this.quests = new Quests(this);
    this.dialogs = new Dialogs(this);
    this.worldEvents = new WorldEvents(this);
    this.ui = new UI(this, uiRoot);

    this.applyQuality();
    window.addEventListener('resize', () => this.resize());
    this.resize();
    this.input.onLockChange = (locked, failed) => this.onLockChange(locked, failed);
    this.input.onAnyKey = () => this.audio.unlock();
    window.addEventListener('pointerdown', () => this.audio.unlock());
    document.addEventListener('visibilitychange', () => {
      if (document.hidden && this.state === 'play') this.pause();
    });

    this.last = performance.now();
    this.loop = this.loop.bind(this);
    if (this.debug) window.__game = this;
  }

  // ================================================================== базовое
  get act() {
    return this.flags.act || 1;
  }
  get hiddenCount() {
    return this.hidden.size;
  }
  get zoneId() {
    return this.zone?.id;
  }
  get version() {
    return VERSION;
  }
  seedFor(zoneId) {
    return hashStr(`${this.runSeed}:${zoneId}:${this.ng}`);
  }

  setFlag(k, v = true) {
    if (this.flags[k] === v) return;
    this.flags[k] = v;
    this.events.emit('flag', k, v);
  }
  flag(k) {
    return this.flags[k];
  }

  setState(s) {
    if (this.state === s) return;
    this.prevState = this.state;
    this.state = s;
    this.input.enabled = s === 'play';
    this.events.emit('state', s, this.prevState);
  }

  shake(a) {
    this.shakeAmt = Math.max(this.shakeAmt, a);
  }
  hitstop(t) {
    this.freeze = Math.max(this.freeze, t);
  }
  /** «Лаг»: мир на миг замирает. */
  lagSpike(dur = 0.18) {
    this.freeze = Math.max(this.freeze, dur);
    this.fx.clear?.();
  }

  applyQuality() {
    const q = this.settings.quality;
    this.canvas.style.imageRendering = q === 'high' ? 'auto' : 'pixelated';
    this.resize();
  }

  resize() {
    const w = window.innerWidth || 1280, h = window.innerHeight || 720;
    const q = QUALITY_H[this.settings.quality] ?? 288;
    const ih = Math.min(h * (this.settings.quality === 'high' ? Math.min(window.devicePixelRatio || 1, 1.5) : 1), q);
    const iw = Math.round((ih * w) / h);
    this.renderer.setPixelRatio(1);
    this.renderer.setSize(iw, Math.round(ih), false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.wCamera.aspect = w / h;
    this.wCamera.updateProjectionMatrix();
    this.viewW = w;
    this.viewH = h;
  }

  // ================================================================== жизненный цикл
  start() {
    this.last = performance.now();
    requestAnimationFrame(this.loop);
  }

  loop(now) {
    requestAnimationFrame(this.loop);
    let dt = (now - this.last) / 1000;
    this.last = now;
    if (!(dt > 0)) dt = 0.016;
    dt = Math.min(dt, CFG.maxDt * 2);
    try {
      this.update(dt);
      this.render();
    } catch (e) {
      this.fatal(e);
    }
    this.input.endFrame();
  }

  fatal(e) {
    console.error(e);
    if (this._fatalShown) return;
    this._fatalShown = true;
    const el = document.getElementById('fatal');
    if (el) {
      el.style.display = 'block';
      el.textContent = 'STOP: ' + (e?.stack || e);
    }
  }

  // ================================================================== новая игра / загрузка
  resetProgress({ keepNg = false } = {}) {
    const ng = keepNg ? { stats: this.stats.toJSON(), inv: this.inv.toJSON(), hidden: [...this.hidden] } : null;
    this.flags = {};
    this.opened = new Set();
    this.hidden = new Set(ng ? ng.hidden : []);
    this.cp = null;
    this.playtime = 0;
    this.stats.reset(ng ? this.ngCarry(ng.stats) : null);
    this.inv.reset(ng ? ng.inv : null);
    this.quests.reset();
    this.dialogs.reset();
    this.worldEvents.reset();
    this.ents.allies = [];
    this.mood = 0.25;
    this.timeScale = 1;
    this.freeze = 0;
    this.player.dead = false;
    this.player.hp = this.stats.maxHp;
    this.player.ram = this.stats.maxRam;
    this.player.setInverted(false);
  }

  ngCarry(st) {
    // «Чистая установка»: уровень и очки остаются, прогресс мира — нет
    return { ...st, moves: { doubleJump: false, dash: false, grapple: false }, abilities: { ...st.abilities, firewall: false, defrag: false, sleep: false, overclock: false, delete: false, safemode: true } };
  }

  async newGame(mode = 'story') {
    this.audio.unlock();
    this.mode = mode;
    this.ng = 0;
    this.runSeed = (Math.random() * 1e9) | 0;
    this.resetProgress();
    this.records.runs = (this.records.runs || 0) + 1;
    Records.write(this.records);
    if (mode === 'speedrun') {
      this.stats.moves = { doubleJump: true, dash: true, grapple: true };
      for (const k of ['firewall', 'defrag', 'sleep', 'overclock', 'delete']) this.stats.abilities[k] = true;
      this.stats.reset({ ...this.stats.toJSON(), level: 12, points: 0, base: { cpu: 9, ram: 8, storage: 6, bandwidth: 8 } });
      this.setFlag('act', 2);
      this.setFlag('intro_done');
      this.setFlag('met_klara');
      this.worldEvents.startSpeedrun();
    }
    this.player.hp = this.stats.maxHp;
    this.player.ram = this.stats.maxRam;
    await this.enterZone('desktop', 'default', { fresh: true });
    if (mode === 'story') this.dialogs.start('intro');
    else this.ui.toast('БЫСТРАЯ ЗАГРУЗКА: успей до синего экрана!', 'warn');
  }

  async newGamePlus() {
    this.ng++;
    const carry = { keepNg: true };
    const nextNg = this.ng;
    this.resetProgress(carry);
    this.ng = nextNg;
    this.mode = 'story';
    this.runSeed = (Math.random() * 1e9) | 0;
    this.setFlag('act', 1);
    this.setFlag('met_klara');
    this.setFlag('intro_done');
    this.setFlag('ngplus', nextNg);
    this.player.hp = this.stats.maxHp;
    this.player.ram = this.stats.maxRam;
    await this.enterZone('desktop', 'default', { fresh: true });
    this.ui.toast(`ЧИСТАЯ УСТАНОВКА #${nextNg}: мир собран заново, враги сильнее. Доступен Safe Mode [6]`, 'good');
    this.dialogs.start('ngplus');
  }

  serialize() {
    const p = this.player;
    return {
      v: 1, t: Date.now(), playtime: this.playtime, mode: this.mode, ng: this.ng, seed: this.runSeed,
      zone: this.zone?.id, cp: this.cp,
      stats: this.stats.toJSON(), inv: this.inv.toJSON(),
      flags: this.flags, opened: [...this.opened], hidden: [...this.hidden],
      quests: this.quests.toJSON(), dialogs: this.dialogs.toJSON(), allies: this.ents.allyIds(),
      hp: p.hp, ram: p.ram, mood: this.mood, worldEvents: this.worldEvents.toJSON(),
    };
  }

  saveGame(quiet = false) {
    if (this.mode === 'speedrun') return false;
    const ok = Save.write(this.serialize());
    if (!quiet) this.ui.toast(ok ? 'Сохранено (точка восстановления создана)' : 'Не удалось сохранить: хранилище недоступно', ok ? 'good' : 'bad');
    return ok;
  }

  async continueGame() {
    const d = Save.load();
    if (!d) return false;
    this.audio.unlock();
    this.resetProgress();
    this.mode = d.mode || 'story';
    this.ng = d.ng || 0;
    this.runSeed = d.seed ?? this.runSeed;
    this.playtime = d.playtime || 0;
    this.flags = d.flags || {};
    this.opened = new Set(d.opened || []);
    this.hidden = new Set(d.hidden || []);
    this.stats.load(d.stats);
    this.inv.load(d.inv);
    this.quests.load(d.quests);
    this.dialogs.load(d.dialogs);
    this.worldEvents.load(d.worldEvents);
    this.ents.restoreAllies(d.allies || []);
    this.mood = d.mood ?? 0.3;
    this.cp = d.cp || null;
    this.player.hp = d.hp ?? this.stats.maxHp;
    this.player.ram = d.ram ?? this.stats.maxRam;
    const z = d.cp?.zone || d.zone || 'desktop';
    await this.enterZone(z, d.cp ? `cp:${d.cp.id}` : 'default', { fresh: true });
    this.player.hp = Math.max(this.player.hp, this.stats.maxHp * 0.5);
    this.ui.toast('Загрузка из точки восстановления', 'info');
    return true;
  }

  // ================================================================== зоны
  async enterZone(id, spawn = 'default', opts = {}) {
    const def = ZONES[id];
    if (!def) {
      this.ui.toast(`Зона «${GATES[id]?.name || id}» пока недоступна`, 'warn');
      return false;
    }
    const prevState = this.state;
    this.setState('transition');
    this.ui.hidePrompt?.();
    await this.ui.fade(true, opts.fresh ? 10 : 260);
    this.unloadZone();
    const zone = new Zone(this, def);
    def.build(zone, this);
    zone.finish();
    this.zone = zone;
    this.scene.add(zone.group);
    this.applyAtmosphere(zone);
    // точки появления и чекпоинты
    let sp = zone.spawns[spawn] || zone.spawns.default;
    if (spawn.startsWith('cp:')) {
      const c = zone.checkpoints.find((k) => `cp:${k.id}` === spawn);
      if (c) sp = { x: c.x, y: c.y, z: c.z + 1.6, yaw: 0 };
    }
    this.player.teleport(sp.x, sp.y + 0.05, sp.z, sp.yaw);
    this.player.setInverted(false);
    this.buildCheckpoints(zone);
    this.ents.loadZone(zone);
    this.music.play(def.music || 'desktop');
    this.camera.position.set(sp.x, sp.y + CFG.eye, sp.z);
    this.player.updateCamera(0.016, 0, 0);
    this.sky.update(1, this.camera.position);
    this.fx.clear();
    this.portalCd = 1.0;
    this.events.emit('zoneEnter', id, def);
    this.quests.onZoneEnter(id);
    this.worldEvents.onZoneEnter(id);
    if (!opts.fresh && this.mode !== 'speedrun') this.saveGame(true);
    await this.ui.fade(false, opts.fresh ? 300 : 360);
    if (!opts.menu) this.ui.showZoneTitle(def.name, def.path, opts.fresh ? 0.3 : 0);
    if (opts.menu) this.setState('menu');
    else this.setState('play');
    if (this.state === 'play') this.input.requestLock();
    return true;
  }

  unloadZone() {
    if (!this.zone) return;
    this.ents.clear();
    this.combat.clear();
    this.scene.remove(this.zone.group);
    this.zone.dispose();
    this.zone.group.traverse((o) => {
      if (o.isMesh) {
        if (o.userData.ownGeometry) o.geometry.dispose();
        const m = o.material;
        if (m && m.map && !m.map.userData.shared) m.map.dispose?.();
      }
    });
    this.zone = null;
  }

  applyAtmosphere(zone) {
    const def = zone.def;
    const s = def.sky || {};
    const f = def.fog || { color: 0xbfe6ff, near: 100, far: 400 };
    const l = def.light || {};
    const sky = { ...s };
    let fogC = new THREE.Color(f.color);
    if (s.mood) {
      // «настроение» системы: выцветшие обои → яркие по мере спасения мира
      const k = clamp(1 - this.mood, 0, 1) * 0.6;
      const gray = new THREE.Color(0x8c95a0);
      for (const key of ['top', 'mid', 'bot', 'sun']) if (sky[key] !== undefined) sky[key] = new THREE.Color(sky[key]).lerp(gray, k).getHex();
      fogC = fogC.clone().lerp(gray, k);
    }
    this.sky.apply(sky, true);
    this.scene.fog = new THREE.Fog(fogC.getHex(), f.near, f.far);
    this.renderer.setClearColor(fogC.getHex(), 1);
    this.hemi.color.set(l.sky ?? 0xffffff);
    this.hemi.groundColor.set(l.ground ?? 0x666666);
    this.hemi.intensity = l.hemi ?? 1;
    this.sun.color.set(l.sun ?? 0xffffff);
    this.sun.intensity = l.dir ?? 1;
    const p = l.pos || [40, 60, -40];
    this.sun.position.set(...p);
    this.sun.target.position.set(0, 0, 0);
    this.fogBase = { near: f.near, far: f.far, color: fogC.getHex() };
  }

  /** Плавно сменить мир-настроение (яркость обоев). */
  setMood(v) {
    this.mood = clamp(v, 0, 1);
    if (this.zone?.def.sky?.mood) this.applyAtmosphere(this.zone);
  }

  buildCheckpoints(zone) {
    for (const c of zone.checkpoints) {
      const g = new THREE.Group();
      g.position.set(c.x, c.y, c.z);
      const base = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.85, 0.25, 10), new THREE.MeshLambertMaterial({ color: 0x2c4a7c, flatShading: true }));
      base.position.y = 0.12;
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.5, 0.05, 6, 16), basic(0x7fe9ff, { fog: true }));
      ring.rotation.x = Math.PI / 2;
      ring.position.y = 1.1;
      const core = new THREE.Mesh(GEO.octa, basic(0xffffff));
      core.scale.set(0.3, 0.45, 0.3);
      core.position.y = 1.1;
      const halo = makeHalo(0x7fe9ff, 3.2, 0.5);
      halo.position.y = 1.1;
      g.add(base, ring, core, halo);
      zone.group.add(g);
      zone.animate((t) => {
        ring.rotation.z = t * 1.4;
        core.rotation.y = t * 2;
        g.position.y = c.y + Math.sin(t * 2 + c.x) * 0.05;
        const a = this.cp && this.cp.id === c.id;
        halo.material.opacity = a ? 0.9 : 0.4;
      });
      zone.interact({
        x: c.x, y: c.y, z: c.z, r: 2.6,
        prompt: 'Точка восстановления — отдохнуть и сохраниться',
        use: (game) => game.useCheckpoint(zone, c),
      });
    }
  }

  useCheckpoint(zone, c) {
    const p = this.player;
    this.cp = { zone: zone.id, id: c.id, x: c.x, y: c.y, z: c.z };
    p.hp = this.stats.maxHp;
    p.ram = this.stats.maxRam;
    this.audio.sfx('checkpoint');
    this.fx.ring(c.x, c.y + 0.3, c.z, 24, 2.0, { glow: true, color: 0x7fe9ff, size: 0.2, life: 0.8, speed: 5 });
    this.events.emit('checkpoint', c);
    if (this.mode === 'speedrun') this.ui.toast('Точка восстановления: HP и RAM восстановлены', 'good');
    else this.saveGame(false);
  }

  // ================================================================== опасности, смерть
  onVoid() {
    const p = this.player;
    if (this.state !== 'play') return;
    const dmg = Math.round(this.stats.maxHp * 0.12);
    const ls = p.lastSafe;
    p.teleport(ls.x, ls.y + 0.5, ls.z);
    this.ui.toast('Ошибка доступа к памяти (0xC0000005) — возврат на безопасную точку', 'bad');
    this.audio.sfx('error');
    p.invuln = 0;
    p.hurt(dmg, { ignoreInvuln: true, iframes: 1.2, type: 'void' });
  }

  playerDied(o = {}) {
    if (this.state === 'dead') return;
    this.setState('dead');
    this.input.exitLock();
    this.audio.sfx('death');
    this.music.stop?.(1.2);
    this.ui.showDeath(o);
    this.events.emit('playerDied');
  }

  async respawn() {
    const c = this.cp;
    const p = this.player;
    this.player.dead = false;
    const lost = Math.round(this.inv.bytes * 0.1);
    this.inv.bytes -= lost;
    this.worldEvents.onRespawn?.();
    this.timeScale = 1;
    this.freeze = 0;
    this.ui.hideDeath();
    if (c) await this.enterZone(c.zone, `cp:${c.id}`, { fresh: false });
    else await this.enterZone(this.zone?.id || 'desktop', 'default', { fresh: false });
    p.hp = this.stats.maxHp;
    p.ram = this.stats.maxRam;
    p.invuln = 2;
    if (lost > 0) this.ui.toast(`Потеряно ${lost} Б при аварийной перезагрузке`, 'warn');
  }

  // ================================================================== пауза
  pause() {
    if (this.state !== 'play') return;
    this.setState('pause');
    this.input.exitLock();
    this.ui.showPause();
  }
  resume() {
    if (this.state !== 'pause') return;
    this.ui.hidePause();
    this.setState('play');
    this.input.requestLock();
  }

  onLockChange(locked) {
    if (!locked && this.state === 'play' && !this.input.freeLook) this.pause();
  }

  // ================================================================== обновление
  update(dt) {
    this.clockT += dt;
    this.shakeAmt = Math.max(0, this.shakeAmt - dt * 2.2);
    const inp = this.input;

    // глобальные клавиши
    if (this.state === 'play') {
      if (inp.rawHit('pause') && inp.freeLook) this.pause();
      else if (inp.rawHit('inventory')) this.ui.openPanel('inventory');
      else if (inp.rawHit('quests')) this.ui.openPanel('quests');
      else if (inp.rawHit('hidden')) this.ui.openPanel('files');
      else if (inp.rawHit('mute')) this.ui.toast(this.audio.toggleMute() ? 'Звук выключен' : 'Звук включён', 'info');
    } else if (this.state === 'panel' || this.state === 'pause' || this.state === 'dialog') {
      this.ui.handleKeys?.();
    }
    if (inp.rawHit('mute') && this.state !== 'play') this.audio.toggleMute();

    // замедление/хитстоп
    let sdt = dt;
    if (this.freeze > 0) {
      this.freeze -= dt;
      sdt = dt * 0.04;
    }
    sdt *= this.timeScale;

    if (this.state === 'play') {
      this.playtime += dt;
      const z = this.zone;
      z.update(sdt);
      this.player.update(sdt);
      this.combat.update(sdt);
      this.ents.update(sdt);
      this.worldEvents.update(sdt);
      this.quests.update(sdt);
      this.updatePortals(dt);
      this.updateInteract();
      this.updateZoneFocus();
    } else if (this.state === 'menu') {
      this.updateMenuCamera(dt);
      this.zone?.update(dt);
    } else if (this.zone) {
      // мир продолжает «дышать», но без боя
      this.zone.t += dt;
      for (const a of this.zone.animated) a(this.zone.t, dt);
      if (this.state === 'dialog' || this.state === 'panel') this.ents.updateIdle(dt);
    }

    this.fx.update(dt);
    this.sky.update(dt, this.camera.position);
    this.music.update(dt, this);
    this.ui.update(dt);
  }

  updateMenuCamera(dt) {
    const t = this.clockT * 0.05;
    const r = 70;
    this.camera.position.set(Math.cos(t) * r, 22 + Math.sin(t * 2) * 3, Math.sin(t) * r * 0.7 + 10);
    this.camera.lookAt(0, 6, 0);
    this.camera.rotation.z = 0;
  }

  updateZoneFocus() {
    // подсвечиваем якоря, если дальность позволяет (делает Player). Здесь — учёт скоростного режима HUD.
  }

  updatePortals(dt) {
    this.portalCd -= dt;
    this.lockNote -= dt;
    if (this.portalCd > 0) return;
    const p = this.player;
    for (const po of this.zone.portals) {
      const dx = p.x - po.x, dz = p.z - po.z;
      const c = Math.cos(po.yaw), s = Math.sin(po.yaw);
      const lx = dx * c - dz * s, lz = dx * s + dz * c;
      let inside;
      if (po.round) inside = Math.hypot(dx, dz) < po.w / 2;
      else inside = Math.abs(lx) < po.w / 2 + 0.2 && Math.abs(lz) < po.d / 2 + 0.3;
      if (!inside || p.y < po.y - 1.2 || p.y > po.y + po.h + 1) continue;
      const reason = po.lock ? po.lock(this) : null;
      if (reason) {
        if (this.lockNote <= 0) {
          this.lockNote = 2.5;
          this.ui.toast(`${po.label}: ${reason}`, 'warn');
          this.audio.sfx('error');
        }
        // мягко отталкиваем от закрытых врат
        const l = Math.hypot(dx, dz) || 1;
        p.body.vx += (dx / l) * 9; p.body.vz += (dz / l) * 9;
        continue;
      }
      this.portalCd = 2;
      this.audio.sfx('portal');
      this.enterZone(po.to, po.spawn || 'default').catch((e) => this.fatal(e));
      return;
    }
  }

  // --- взаимодействие ---
  updateInteract() {
    const p = this.player;
    const f = p.forward3();
    const fl = Math.hypot(f.x, f.z) || 1;
    let best = null, bestScore = 1e9;
    const consider = (it) => {
      if (it.enabled && !it.enabled(this)) return;
      const dx = it.x - p.x, dz = it.z - p.z;
      const d = Math.hypot(dx, dz);
      const r = it.r ?? 2.6;
      if (d > r) return;
      const dy = (it.y ?? p.y) - p.y;
      if (dy > 3.2 || dy < -3.2) return;
      const dot = d > 0.01 ? (dx * f.x + dz * f.z) / (d * fl) : 1;
      if (dot < -0.2 && d > 1.2) return;
      const score = d - dot * 1.2;
      if (score < bestScore) { bestScore = score; best = it; }
    };
    for (const it of this.zone.interacts) consider(it);
    for (const it of this.ents.interactables()) consider(it);
    this.interactTarget = best;
    if (best) {
      const text = typeof best.prompt === 'function' ? best.prompt(this) : best.prompt;
      this.ui.prompt(text, best);
      if (this.input.actHit('interact')) best.use(this, best);
    } else this.ui.prompt(null);
  }

  // ================================================================== рендер
  render() {
    const r = this.renderer;
    r.clear(true, true, true);
    r.render(this.scene, this.camera);
    if (this.state === 'play' || this.state === 'pause' || this.state === 'dialog' || this.state === 'panel' || this.state === 'dead') {
      if (this.combat.viewVisible) {
        r.clearDepth();
        this.wCamera.fov = this.camera.fov * 0.78;
        this.wCamera.updateProjectionMatrix();
        r.render(this.wScene, this.wCamera);
      }
    }
  }

  // ================================================================== отладка
  dbgGoto(zone, spawn = 'hub') {
    return this.enterZone(zone, spawn, { fresh: true });
  }
  dbgGrantAll() {
    this.stats.moves = { doubleJump: true, dash: true, grapple: true };
    for (const k of ['firewall', 'defrag', 'sleep', 'overclock', 'delete']) this.stats.abilities[k] = true;
  }
  ngHp() { return Math.pow(1.7, this.ng); }
  ngDmg() { return Math.pow(1.3, this.ng); }
  get elapsedStr() {
    return fmtTime(this.playtime);
  }
}

export { damp, dist2D, HIDDEN_FILES, HIDDEN_TOTAL, gateLock };
