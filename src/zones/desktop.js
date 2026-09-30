import * as THREE from 'three';
import { smooth } from '../core/util.js';
import { basic, GEO } from '../gfx/materials.js';
import { canvasTexture } from '../gfx/text.js';
import { PAL, frame, faceTo, shade, treeAt, bush, rock, lamp, bench, flowers, windowPlatform, scrollbar, gateway, crystal, iconBuilding, osWindow, pillar } from './props.js';
import { GATES, gateLock } from '../data/world.js';

// Центральный хаб: «Рабочий стол». Обои — небо, иконки — здания, панель задач — длинная платформа.
const PLAZA = { x: 0, z: 0, r: 36 };
const RIFT = { x0: 60, x1: 72, z0: 12, z1: 92 };
const BLISS = { x: 72, z: -48, r: 26, h: 10 };

const inRift = (x, z) => x > RIFT.x0 && x < RIFT.x1 && z > RIFT.z0;

export function hubHeight(x, z) {
  if (inRift(x, z)) return -90;
  const r = Math.hypot(x - PLAZA.x, z - PLAZA.z);
  const edge = smooth((r - 38) / 28);
  const n = Math.sin(x * 0.045 + 1) * Math.cos(z * 0.05) * 2.0 + Math.sin(x * 0.11 + z * 0.07) * 0.7;
  let h = edge * (n + 1.6);
  const bx = x - BLISS.x, bz = z - BLISS.z;
  h += BLISS.h * Math.exp(-(bx * bx + bz * bz) / (2 * 15 * 15)) * 1.0;
  // панель задач и подход к ней — плоские
  h *= 1 - smooth((z - 50) / 14);
  // у рамки — ровно
  const wallFade = smooth((Math.min(120 - Math.abs(x), 90 - Math.abs(z)) - 2) / 10);
  return h * wallFade;
}

const GATE_POS = (i) => {
  const th = ((200 + i * (140 / 6)) * Math.PI) / 180;
  return { x: Math.cos(th) * 62, z: Math.sin(th) * 62 };
};
const GATE_ORDER = ['documents', 'autorun', 'temp', 'registry', 'recycle', 'diskd', 'internet'];

function pathNear(x, z) {
  for (let i = 0; i < 7; i++) {
    const g = GATE_POS(i);
    const t = Math.max(0, Math.min(1, (x * g.x + z * g.z) / (g.x * g.x + g.z * g.z)));
    if (Math.hypot(x - g.x * t, z - g.z * t) < 2.6) return true;
  }
  return Math.abs(x) < 2.8 && z > 0 && z < 64;
}

function hash2(x, z) {
  const s = Math.sin(x * 12.9898 + z * 78.233) * 43758.5453;
  return s - Math.floor(s);
}

export default {
  id: 'desktop',
  name: 'Рабочий стол',
  path: 'C:\\Users\\Shortcut\\Desktop',
  level: 1,
  music: 'desktop',
  voidY: -40,
  sky: { top: 0x2f7fe0, mid: 0xbfe6ff, bot: 0xa9c79a, sun: 0xfff4c2, sunDir: [0.45, 0.5, -0.55], clouds: 0.95, cloudCol: 0xffffff, mood: true },
  fog: { color: 0xbfe6ff, near: 110, far: 470 },
  light: { sky: 0xdfeeff, ground: 0x6f8a55, hemi: 1.0, sun: 0xfff1d6, dir: 1.15, pos: [45, 55, -55] },

  build(z, game) {
    const b = z.b;
    const rng = z.rng;
    z.bounds(-119, 119, -89, 89);

    // ---------------- рельеф ----------------
    z.terrain({
      minX: -126, maxX: 126, minZ: -96, maxZ: 96, step: 3, height: hubHeight,
      color: (x, zz, y) => {
        if (inRift(x, zz) || y < -20) return 0x15152a;
        const rr = Math.hypot(x, zz);
        if (rr < PLAZA.r - 1.5) return ((Math.floor(x / 3) + Math.floor(zz / 3)) & 1) ? 0xc6c7ba : 0xe6e7da;
        if (zz > 58) return 0x9bbf8a;
        if (pathNear(x, zz)) return 0xdccfa6;
        const v = hash2(Math.floor(x / 3), Math.floor(zz / 3));
        if (y > 7) return v > 0.5 ? 0x7fd45f : 0x74c855;
        return v > 0.6 ? 0x5fbf45 : v > 0.25 ? 0x57b43f : 0x4fa83a;
      },
    });

    // ---------------- рамка монитора ----------------
    const bezel = 0xd9d3bd;
    b.block(0, -6, -93, 260, 34, 6, bezel, { top: 0xece7d3 });
    b.block(0, -6, 93, 260, 34, 6, bezel, { top: 0xece7d3 });
    b.block(-123, -6, 0, 6, 34, 192, bezel, { top: 0xece7d3 });
    b.block(123, -6, 0, 6, 34, 192, bezel, { top: 0xece7d3 });
    b.block(0, 27, -93, 260, 1.4, 7.5, shade(bezel, 0.88), { collide: false });
    z.sign('MONITOR 15"  —  DESKTOPIA', 0, 11, 89.9, 30, Math.PI, { w: 768, h: 96, color: '#6e6a58', size: 48, shadow: false });
    b.box(104, 4, 89.7, 1.2, 1.2, 0.4, 0x3cff6a, { unlit: true, collide: false });
    z.light(104, 4, 89, 0x3cff6a, 5, 0.6);
    z.sign('POWER', 112, 4, 89.9, 6, Math.PI, { w: 256, h: 64, color: '#6e6a58', size: 30, shadow: false });

    // ---------------- площадь ----------------
    const PY = 0.02;
    b.cyl(0, -0.02, 0, PLAZA.r + 1.2, PLAZA.r + 1.4, PY + 0.4, 0xb9b9ab, { seg: 28, collide: false, noBottom: true });
    // люк BIOS в центре площади
    b.cyl(0, 0, 0, 5.2, 5.6, 0.25, 0x555560, { seg: 16, collide: false });
    b.cyl(0, 0.25, 0, 4.4, 4.6, 0.06, 0x2b2b33, { seg: 16, collide: false });
    const hatchSign = z.sign('BIOS', 0, 0.38, 0, 7, 0, { w: 256, h: 128, color: '#ffb000', size: 70, shadow: false });
    hatchSign.rotation.x = -Math.PI / 2;
    // памятник: гигантский курсор
    const mx = -13, mz = 11;
    b.cyl(mx, 0, mz, 3.2, 3.6, 1.0, 0xbcbcc4, { seg: 8, collide: true, top: 0xdedee6 });
    const cur = new THREE.Shape();
    cur.moveTo(0, 0); cur.lineTo(0, 16); cur.lineTo(4, 12.4); cur.lineTo(7, 19); cur.lineTo(9.6, 17.8); cur.lineTo(6.7, 11.3); cur.lineTo(11.5, 11.3); cur.closePath();
    const curGeo = new THREE.ExtrudeGeometry(cur, { depth: 1.6, bevelEnabled: false });
    const curOut = new THREE.Mesh(curGeo, basic(0x000000));
    const curIn = new THREE.Mesh(curGeo, basic(0xffffff));
    curIn.scale.set(0.82, 0.86, 1.3); curIn.position.set(0.55, 1.0, -0.2);
    const mon = new THREE.Group();
    mon.add(curOut, curIn);
    mon.scale.setScalar(0.62);
    mon.position.set(mx - 2, 1.0, mz);
    mon.rotation.y = 0.5;
    z.group.add(mon);
    z.animate((t) => { mon.position.y = 1.2 + Math.sin(t) * 0.25; mon.rotation.y = 0.5 + Math.sin(t * 0.4) * 0.4; });
    z.sign('ПОСЛЕДНИЙ КЛИК', mx, 2.4, mz + 3.3, 4.4, 0, { w: 512, h: 80, color: '#222', bg: '#c0c0c0', border: '#fff', size: 36, shadow: false });

    // ---------------- мастерская (восток площади) ----------------
    const wx = 22, wzz = 4;
    b.block(wx + 4, 0, wzz, 22, 0.25, 15, 0xa8a8a0, { collide: false });
    // Архиватор (книги в тисках)
    {
      const x = wx - 2, zz = wzz + 4;
      b.block(x, 0, zz, 3, 0.6, 2.4, 0x555566);
      b.block(x, 0.6, zz, 2.4, 0.7, 1.8, PAL.red, { top: 0xff8877 });
      b.block(x, 1.3, zz, 2.4, 0.7, 1.8, PAL.blue, { top: 0x7799ff });
      b.block(x, 2.0, zz, 2.4, 0.7, 1.8, PAL.yellow, { top: 0xffee99 });
      b.block(x, 2.7, zz, 3.2, 0.3, 2.4, PAL.dark);
      b.block(x - 1.6, 0.6, zz, 0.3, 2.4, 0.3, PAL.dark, { collide: false });
      b.block(x + 1.6, 0.6, zz, 0.3, 2.4, 0.3, PAL.dark, { collide: false });
      z.sign('АРХИВАТОР', x, 3.8, zz, 4, 0, { w: 384, h: 72, color: '#fff', bg: 'rgba(0,0,120,0.85)', size: 34, shadow: false });
      z.interact({ x, y: 0, z: zz + 2, r: 3.4, prompt: 'Архиватор — сжать мусор в .zip', use: (g) => g.ui.openWorkshop('archiver') });
    }
    // Компилятор (наковальня с экраном)
    {
      const x = wx + 5, zz = wzz - 3;
      b.block(x, 0, zz, 2.6, 0.9, 2.0, 0x4a4a55);
      b.block(x, 0.9, zz, 3.4, 0.7, 2.4, 0x2b2b35, { top: 0x3a3a48 });
      b.block(x, 1.6, zz - 0.4, 2.6, 1.6, 0.25, 0x101820, { collide: false });
      for (let i = 0; i < 4; i++) b.box(x - 0.9 + (i % 2) * 0.7, 2.0 + i * 0.26, zz - 0.25, 0.9 + (i % 3) * 0.3, 0.1, 0.05, 0x3cff6a, { unlit: true, collide: false });
      z.sign('КОМПИЛЯТОР', x, 4.0, zz, 4.2, 0, { w: 384, h: 72, color: '#fff', bg: 'rgba(0,100,40,0.85)', size: 34, shadow: false });
      z.light(x, 2.4, zz, 0x3cff6a, 4, 0.4);
      z.interact({ x, y: 0, z: zz + 2.4, r: 3.4, prompt: 'Компилятор — собрать программы из фрагментов', use: (g) => g.ui.openWorkshop('compiler') });
    }
    // Конвертер (два барабана со стрелкой)
    {
      const x = wx + 12, zz = wzz + 4.5;
      b.cyl(x - 1.6, 0, zz, 1.0, 1.1, 2.2, PAL.orange, { seg: 8, collide: true });
      b.cyl(x + 1.6, 0, zz, 1.0, 1.1, 2.2, PAL.cyan, { seg: 8, collide: true });
      b.block(x, 1.3, zz, 2.6, 0.35, 0.6, PAL.dark, { collide: false });
      b.box(x, 2.2, zz, 0.9, 0.9, 0.12, PAL.white, { unlit: true, collide: false });
      z.sign('КОНВЕРТЕР', x, 4.0, zz, 4, 0, { w: 384, h: 72, color: '#fff', bg: 'rgba(120,50,0,0.85)', size: 34, shadow: false });
      z.interact({ x, y: 0, z: zz + 2.6, r: 3.4, prompt: 'Конвертер — сменить формат файла', use: (g) => g.ui.openWorkshop('converter') });
    }
    // ---------------- NPC площади ----------------
    z.npc('klara', 6, 38, Math.PI * 0.9);
    z.npc('clippy', -8, 30, 0.6);
    z.npc('calc', -24, 5, 0.5);
    z.npc('notepad', 13, 22, Math.PI);
    z.npc('taskman', -36, -26, 1.0);
    z.checkpoint(-3, 0, 42, 'desktop_spawn');
    z.checkpoint(0, 0, -8, 'desktop_plaza');
    z.spawn('default', 0, 0, 54, 0);
    z.spawn('start', 0, 0, 54, 0);
    z.spawn('bios', 0, 0, 8, 0);

    // ---------------- врата в зоны ----------------
    const gateCols = { documents: 0xffd23f, autorun: 0xff6b6b, temp: 0x9dff6b, registry: 0xb084ff, recycle: 0x6bffb5, diskd: 0xffb066, internet: 0x5bd0ff };
    GATE_ORDER.forEach((id, i) => {
      const p = GATE_POS(i);
      const yaw = faceTo(p.x, p.z, 0, 0);
      const info = GATES[id];
      gateBuilding(z, id, p.x, p.z, yaw, gateCols[id]);
      gateway(z, p.x, 0, p.z, yaw, {
        to: id, spawn: 'hub', label: info.name, color: gateCols[id], lock: (g) => gateLock(g, id),
        sub: info.rec ? `рекомендуется ${info.rec}` : '',
      });
      z.spawn(id, p.x + Math.sin(yaw) * 6.5, 0, p.z + Math.cos(yaw) * 6.5, yaw + Math.PI);
    });

    // BIOS: портал в центре (активен в акте 3)
    {
      const col = 0xffb000;
      const mat = new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.0, depthWrite: false, fog: false, side: THREE.DoubleSide });
      const beam = new THREE.Mesh(new THREE.CylinderGeometry(4, 4, 40, 16, 1, true), mat);
      beam.position.set(0, 20, 0);
      z.group.add(beam);
      z.animate((t) => {
        const open = !gateLock(game, 'bios');
        mat.opacity = open ? 0.25 + Math.sin(t * 3) * 0.08 : 0;
        hatchSign.visible = true;
      });
      z.portal({ x: 0, y: 0, z: 0, yaw: 0, w: 7, h: 4, d: 7, to: 'bios', spawn: 'hub', label: 'BIOS', lock: (g) => gateLock(g, 'bios'), color: col, round: true, id: 'bios' });
    }

    // Скрытая папка System Volume Information на вершине холма Bliss
    {
      const sx = BLISS.x, sz = BLISS.z, sy = hubHeight(sx, sz);
      b.block(sx, sy, sz, 4.2, 2.6, 3.4, 0x8a8a94, { top: 0xaaaab8 });
      b.block(sx - 0.9, sy + 2.6, sz, 1.8, 0.45, 3.2, 0x7a7a84, { collide: false });
      b.block(sx, sy + 0.4, sz + 1.72, 1.0, 1.0, 0.1, PAL.yellow, { collide: false });
      z.sign('System Volume\nInformation', sx, sy + 3.5, sz + 1.8, 5, 0, { w: 512, h: 128, color: '#dfe', bg: 'rgba(30,30,40,0.85)', size: 42, shadow: false });
      const info = GATES.sysvol;
      z.portal({ x: sx, y: sy, z: sz + 2.2, yaw: 0, w: 3, h: 3, d: 2.4, to: 'sysvol', spawn: 'hub', label: info.name, lock: (g) => gateLock(g, 'sysvol'), color: 0xbfe8ff, id: 'sysvol', hidden: true });
      z.spawn('sysvol', sx, sy, sz + 5.5, Math.PI);
    }

    // ---------------- район значков (запад) ----------------
    const kinds = ['folder', 'doc', 'exe', 'img', 'music', 'zip', 'doc', 'folder', 'exe'];
    const names = ['Новая папка', 'Курсовая.doc', 'setup.exe', 'IMG_0042.jpg', 'Tokio.mp3', 'backup.zip', 'Реферат.doc', 'Новая папка (2)', 'game.exe', 'Новая папка (3)', 'Фото.jpg', 'KeyGen.exe', 'Письмо.doc', 'mix.mp3', 'Сканы.zip'];
    let ni = 0;
    for (let col = 0; col < 3; col++) {
      for (let row = 0; row < 9; row++) {
        if (hash2(col * 7.1, row * 3.3) > 0.78) continue;
        const x = -108 + col * 12, zz = -50 + row * 10.5;
        iconBuilding(z, kinds[(row + col * 2) % kinds.length], x, zz, -Math.PI / 2 + (hash2(col, row) - 0.5) * 0.0, names[ni++ % names.length], {});
      }
    }
    // ---------------- панель задач ----------------
    buildTaskbar(z, game);

    // ---------------- Трещина обоев и мосты-скроллбары ----------------
    z.sign('ТРЕЩИНА В ОБОЯХ', 66, 4, 11, 12, Math.PI, { w: 512, h: 80, color: '#ff8080', bg: 'rgba(20,0,0,0.6)', size: 34, shadow: false });
    scrollbar(z, 52, 34, 82, 34, 0.0, 3.6);
    scrollbar(z, 52, 52, 82, 52, 0.0, 3.6);
    scrollbar(z, 52, 20, 82, 20, 0.0, 3.6);
    // восточное плато: башня часов, сундук, NPC
    buildClockTower(z);
    z.npc('tray', 90, 45, -1.2);
    z.chest('desktop_east', 84, 0, 26, { table: 'common', bytes: 40 });
    z.hiddenFile('hidden_desktop', 108, 25.5, 72);

    // ---------------- башня «Пуск» (запад панели задач) ----------------
    buildStartTower(z);

    // ---------------- природа ----------------
    for (let i = 0; i < 70; i++) {
      const x = rng.range(-115, 115), zz = rng.range(-85, 60);
      const r = Math.hypot(x, zz);
      if (r < PLAZA.r + 4 || inRift(x, zz) || pathNear(x, zz) || x < -76 || (Math.hypot(x - BLISS.x, zz - BLISS.z) < 4)) continue;
      if (Math.hypot(x, zz + 62) < 10) continue;
      let blocked = false;
      for (let g = 0; g < 7; g++) { const p = GATE_POS(g); if (Math.hypot(x - p.x, zz - p.z) < 26) blocked = true; }
      if (blocked) continue;
      treeAt(z, x, hubHeight(x, zz), zz, rng.range(0.8, 1.5), rng.pick([PAL.grassDark, 0x3a8a3a, 0x4a9a4a]));
    }
    for (let i = 0; i < 40; i++) {
      const x = rng.range(-115, 115), zz = rng.range(-85, 60);
      if (Math.hypot(x, zz) < PLAZA.r || inRift(x, zz) || pathNear(x, zz) || x < -78) continue;
      bush(z, x, hubHeight(x, zz), zz, rng.range(0.6, 1.3), rng.pick([PAL.grass, 0x4fae45, 0x66c455]));
    }
    for (let i = 0; i < 14; i++) {
      const x = rng.range(-100, 110), zz = rng.range(-80, 55);
      if (Math.hypot(x, zz) < PLAZA.r + 2 || inRift(x, zz) || x < -78) continue;
      rock(z, x, hubHeight(x, zz), zz, rng.range(0.8, 1.8));
    }
    for (let i = 0; i < 6; i++) flowers(z, rng, rng.range(-80, 100), 0, rng.range(-60, 40), 26, 6);
    // фонари и скамейки вокруг площади
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      const x = Math.cos(a) * (PLAZA.r - 3), zz = Math.sin(a) * (PLAZA.r - 3);
      if (Math.abs(x) < 4 && zz > 0) continue;
      lamp(z, x, 0, zz, 4.2);
      if (i % 2) bench(z, Math.cos(a) * (PLAZA.r - 5.5), 0, Math.sin(a) * (PLAZA.r - 5.5), -a + Math.PI / 2);
    }
    // дорожные указатели
    z.sign('← ЗОНЫ: нажмите E возле врат или просто войдите в вихрь →', 0, 6.5, 26, 14, 0, { w: 1024, h: 96, color: '#fff', bg: 'rgba(0,0,0,0.0)', size: 36 });

    // ---------------- враги ----------------
    z.enemy('slime', -66, 6); z.enemy('slime', 40, 34); z.enemy('slime', -40, 44);
    z.enemy('slime', 70, -14); z.enemy('slime', -80, -56);
    // якоря для грэппла (Ссылка) — бонусный маршрут на башню «Пуск»
    z.anchor(-100, 34, 56, 'http://пуск.рф');
    z.anchor(-78, 30, 52, 'www.рабочий.стол');
    z.anchor(56, 26, 14, 'http://→восток');
    z.anchor(80, 30, 40, 'https://часы');
    z.anchor(BLISS.x - 12, 28, BLISS.z + 20, 'ссылка.ссылка');
  },
};

// ====================================================================== здания-врата
function gateBuilding(z, id, x, zz, yaw, col) {
  const b = z.b;
  // локальная система: +Z — к центру площади, здание стоит позади врат (z<0)
  const f = frame(b, x, zz, yaw);
  const big = (lx, y0, lz, sx, sy, sz, c, o = {}) => f.box(lx, y0, lz, sx, sy, sz, c, o);
  switch (id) {
    case 'documents': {
      big(0, 0, -6, 24, 11, 10, PAL.folder);
      big(-7, 11, -6, 10, 1.4, 10, PAL.folderDark);
      big(0, 11, -6, 24, 0.6, 10, PAL.folderLight);
      big(3, 11.6, -7, 14, 0.5, 8, PAL.paper, { collide: false });
      big(-10, 0, 0.2, 2, 11, 0.6, PAL.folderDark, { collide: false });
      break;
    }
    case 'autorun': {
      big(0, 0, -6, 24, 10, 10, 0x6d7a4a, { top: 0x7e8c58 });
      big(0, 10, -6, 26, 0.8, 11, 0x4f5a36);
      big(-9, 10.8, -6, 2, 6, 2, PAL.dark, { collide: false });
      big(-9, 14.8, -5.2, 5, 2.6, 0.2, PAL.red, { unlit: true, collide: false });
      f.cyl(9, 10.8, -6, 0.15, 0.15, 7, PAL.dark, { seg: 5 });
      const [sx0, sz0] = f.pos(0, 0.9);
      z.sign('⚙', sx0, 7.5, sz0, 4, yaw, { w: 128, h: 128, color: '#dfe6b0', size: 100, shadow: false });
      break;
    }
    case 'temp': {
      big(0, 0, -6, 24, 10, 10, 0x7d8a86, { top: 0x93a19c });
      big(-6, 10, -6, 9, 1.4, 10, 0x6b7874);
      for (let i = 0; i < 9; i++) big(-11 + i * 2.7, 6 - (i % 3) * 1.6, 0.05, 1.3, 2 + (i % 3) * 1.6, 0.5, 0x7aff4a, { unlit: true, collide: false });
      big(0, 0, 2.5, 16, 0.12, 3, 0x6fdd3a, { unlit: true, collide: false });
      break;
    }
    case 'registry': {
      const cols = [0x4a7bff, 0xff4a7b, 0x39e6ff, 0xffd23f, 0xb084ff];
      for (let i = 0; i < 9; i++) {
        const cx = -9 + (i % 3) * 7.5 + (Math.floor(i / 3) % 2) * 1.5, cy = Math.floor(i / 3) * 4.2;
        big(cx, cy, -6, 6.2, 4.0, 6.5, cols[i % cols.length], { top: shade(cols[i % cols.length], 1.2) });
      }
      break;
    }
    case 'recycle': {
      f.cyl(0, 0, -6, 10.5, 8.5, 12, 0x3a9a55, { seg: 10, collide: true, top: 0x4fbf6a });
      f.cyl(0, 12, -6, 11.5, 11.0, 1.4, 0x2f8a48, { seg: 10, collide: false, top: 0x5fd07a });
      f.cyl(0, 13.4, -6, 2, 1.6, 0.8, 0x2f8a48, { seg: 6, collide: false });
      const [rx0, rz0] = f.pos(0, 3.2);
      z.sign('♻', rx0, 8.5, rz0, 7, yaw, { w: 256, h: 256, color: '#d8ffe3', size: 200, shadow: false });
      break;
    }
    case 'diskd': {
      big(0, 0, -6, 26, 8, 12, 0x8a93a3, { top: 0xa8b2c4 });
      big(0, 8, -6, 26.6, 0.6, 12.6, 0x6f7889);
      big(9, 2.2, 0.18, 2.4, 0.5, 0.1, PAL.green, { unlit: true, collide: false });
      const [lx0, lz0] = f.pos(9, 0.3);
      z.light(lx0, 2.5, lz0, 0x39ff6a, 4, 0.5);
      const [dx0, dz0] = f.pos(-9, 0.4);
      z.sign('D:', dx0, 4.2, dz0, 5, yaw, { w: 256, h: 192, color: '#ffffff', size: 150, shadow: false });
      break;
    }
    case 'internet': {
      big(0, 0, -6, 20, 2.4, 14, 0x2a4a8a, { top: 0x4a7ac4 });
      const [gx, gz] = f.pos(0, -6);
      b.sphere(gx, 11.5, gz, 8.2, 0x2f7fe0, { collide: false });
      b.sphere(gx, 11.5, gz, 8.3, 0x4fc16a, { sy: 0.0001, collide: false });
      for (let i = 0; i < 5; i++) {
        const a = i * 1.3;
        b.box(gx + Math.cos(a) * 6.4, 11.5 + Math.sin(a * 1.7) * 4, gz + Math.sin(a) * 6.4, 3.4, 2.4, 3.4, 0x4fc16a, { collide: false });
      }
      f.cyl(9, 2.4, -6, 0.2, 0.3, 14, PAL.dark, { seg: 5 });
      break;
    }
  }
  void col;
}

// ====================================================================== панель задач
function buildTaskbar(z, game) {
  const b = z.b;
  const Y = 1.6;
  // сама панель: две части (разрыв над «трещиной» ради платформинга)
  const seg = (x0, x1) => {
    b.span(x0, 0, 66, x1, Y, 90, PAL.gray, { top: 0xd8d8d8, grad: 0.85 });
    b.span(x0, Y, 66, x1, Y + 0.12, 67.2, 0xf4f4f4, { collide: false });
    b.span(x0, 0, 66, x1, 0.6, 66.3, 0x5a5a66, { collide: false, unlit: true });
  };
  seg(-119, RIFT.x0);
  seg(RIFT.x1, 119);
  // ступени на панель
  for (const sx of [-60, 10, 40, 100]) b.stairs(sx, 0, 63, 7, 3, 0.53, 1.0, 1, 0xbfbfbf, { top: 0xdedede });
  // кнопки окон
  const labels = ['Проводник', 'Блокнот', 'Без имени — Paint', 'Антивирус (не отвечает)', 'Приключение'];
  for (let i = 0; i < labels.length; i++) {
    const x = -40 + i * 18;
    b.block(x, Y + 0.12, 72, 15, 1.3, 5, 0xd0d0d0, { top: i === 4 ? 0xe8f0ff : 0xe0e0e0, collide: true });
    z.sign(labels[i], x, Y + 0.85, 69.45, 11, Math.PI, { w: 512, h: 64, color: '#111', size: 34, shadow: false });
  }
  // системный трей
  b.block(92, Y, 72, 12, 3.4, 1.2, 0x2a2a44, { top: 0x44446a });
  // часы трея: отображают реальное время ПК
  const tex = canvasTexture(256, 64, () => {});
  const cv = tex.userData.canvas;
  const g = cv.getContext('2d');
  let lastMin = -1;
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(9, 2.25), new THREE.MeshBasicMaterial({ map: tex, transparent: true }));
  mesh.position.set(92, Y + 1.7, 71.35);
  mesh.rotation.y = Math.PI;
  z.group.add(mesh);
  z.animate(() => {
    const d = new Date();
    if (d.getMinutes() === lastMin) return;
    lastMin = d.getMinutes();
    g.clearRect(0, 0, 256, 64);
    g.fillStyle = '#0a0a30';
    g.fillRect(0, 0, 256, 64);
    g.fillStyle = '#5cff8a';
    g.font = '700 44px "Pixelify Sans", monospace';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(`${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`, 128, 34);
    tex.needsUpdate = true;
  });
}

// ====================================================================== башня «Пуск»
function buildStartTower(z) {
  const b = z.b;
  const X = -100, Z = 77, Y = 1.6;
  b.block(X, Y, Z, 18, 12, 16, 0x39a845, { top: 0x5fd06d });
  b.block(X, Y + 12, Z, 18.8, 0.8, 16.8, 0x2c8737, { top: 0x4fbf5d });
  z.sign('Пуск', X, Y + 6.5, Z - 8.2 + 16.4, 12, 0, { w: 512, h: 160, color: '#ffffff', size: 120, shadow: 'rgba(0,60,0,0.7)', double: true });
  // флаг из четырёх цветных «стёкол»
  b.block(X, Y + 12.8, Z, 0.3, 9, 0.3, PAL.dark, { collide: false });
  const fl = [PAL.red, PAL.green, PAL.blue, PAL.yellow];
  fl.forEach((c, i) => b.box(X + 1.3 + (i % 2) * 1.7, Y + 19.2 + (i < 2 ? 1.7 : 0), Z, 1.6, 1.6, 0.3, c, { unlit: true, collide: false }));
  // лестница из окон-платформ (прыжковый маршрут на крышу)
  const steps = [
    [-84, 2.4, 62], [-80, 3.8, 58.5], [-85, 5.2, 55.5], [-91, 6.6, 55], [-96, 8.0, 57.5], [-99, 9.4, 61.5], [-103, 10.8, 64.5],
  ];
  steps.forEach(([x, y, zz], i) => windowPlatform(z, x, y, zz, 5, 4, (i % 2) * 0.4));
  // переход на крышу
  windowPlatform(z, -106, Y + 12.05, 70, 6, 5);
  z.hiddenFile('hidden_start', X, Y + 13.2, Z);
  z.chest('desktop_start', X + 5, Y + 12.8, Z + 2, { table: 'mid', bytes: 60 });
  z.checkpoint(-88, Y, 62, 'desktop_taskbar');
}

// ====================================================================== башня часов
function buildClockTower(z) {
  const b = z.b;
  const X = 100, Z = 70, Y = 1.6;
  b.block(X, Y, Z, 7, 26, 7, 0x9a8fb0, { top: 0xb8aed0 });
  b.block(X, Y + 26, Z, 9, 1, 9, 0x7a6f90);
  b.cone(X, Y + 27, Z, 5.6, 6, 0xd9554a, { seg: 4, rot: Math.PI / 4, collide: false });
  const tex = canvasTexture(256, 256, () => {});
  const g = tex.userData.canvas.getContext('2d');
  const face = new THREE.MeshBasicMaterial({ map: tex });
  let lastSec = -1;
  z.animate(() => {
    const d = new Date();
    if (d.getSeconds() === lastSec) return;
    lastSec = d.getSeconds();
    g.fillStyle = '#f7f2e0'; g.fillRect(0, 0, 256, 256);
    g.strokeStyle = '#222'; g.lineWidth = 10; g.beginPath(); g.arc(128, 128, 118, 0, 7); g.stroke();
    g.fillStyle = '#222';
    for (let i = 0; i < 12; i++) { const a = (i / 12) * 6.283; g.fillRect(128 + Math.sin(a) * 100 - 4, 128 - Math.cos(a) * 100 - 4, 8, 8); }
    const hand = (a, l, w, c) => { g.strokeStyle = c; g.lineWidth = w; g.beginPath(); g.moveTo(128, 128); g.lineTo(128 + Math.sin(a) * l, 128 - Math.cos(a) * l); g.stroke(); };
    hand(((d.getHours() % 12) + d.getMinutes() / 60) / 12 * 6.283, 60, 12, '#222');
    hand((d.getMinutes() + d.getSeconds() / 60) / 60 * 6.283, 90, 8, '#222');
    hand(d.getSeconds() / 60 * 6.283, 100, 3, '#d22');
    tex.needsUpdate = true;
  });
  for (const [dx, dz, ry] of [[0, 3.55, 0], [0, -3.55, Math.PI], [3.55, 0, Math.PI / 2], [-3.55, 0, -Math.PI / 2]]) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(5, 5), face);
    m.position.set(X + dx, Y + 20, Z + dz);
    m.rotation.y = ry;
    z.group.add(m);
  }
  // внешняя лестница-уступы на крышу башни
  const pts = [[88, 3.4, 60], [92, 6, 56], [97, 8.6, 57], [102, 11.2, 57.5], [106.4, 14, 62], [107, 17, 68], [105.5, 20, 73], [101, 22.6, 76.6], [95.6, 25.2, 74.5], [93.4, 27.8, 69]];
  pts.forEach(([x, y, zz], i) => windowPlatform(z, x, y, zz, 4.4, 3.6, i * 0.5));
  z.checkpoint(86, 0, 38, 'desktop_east');
  void crystal; void osWindow; void pillar; void GEO; void lamp;
}
