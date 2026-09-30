import * as THREE from 'three';
import { basic, GEO } from '../gfx/materials.js';

// Палитра «операционной системы»
export const PAL = {
  gray: 0xc0c0c0, light: 0xe6e6e6, dark: 0x808080, darker: 0x4a4a4a, navy: 0x000080, xp: 0x0a58d6, sky: 0x3a8cff,
  folder: 0xf3c646, folderLight: 0xffe07a, folderDark: 0xd9a520, paper: 0xf5f5ef, teal: 0x008080,
  grass: 0x57b43f, grassDark: 0x3f8f2f, dirt: 0x8a6a45, red: 0xd93025, green: 0x2fae5a, blue: 0x2a6bff, yellow: 0xffd23f,
  orange: 0xff8a3d, pink: 0xff5ea8, purple: 0x8a4dff, cyan: 0x39e6ff, white: 0xffffff, black: 0x101018, wood: 0x9a6b3c,
};

/** Угол поворота, чтобы локальная +Z смотрела из (x,z) в сторону (tx,tz). */
export const faceTo = (x, z, tx, tz) => Math.atan2(tx - x, tz - z);

/** Локальная система координат для сборки зданий с поворотом на кратные 90° (и произвольные). */
export function frame(b, cx, cz, yaw = 0) {
  const c = Math.cos(yaw), s = Math.sin(yaw);
  const quarter = Math.abs(Math.sin(yaw * 2)) < 1e-6;
  const swap = quarter && Math.abs(s) > 0.5;
  const f = {
    cx, cz, yaw,
    pos: (lx, lz) => [cx + lx * c + lz * s, cz - lx * s + lz * c],
    dir: (lx, lz) => [lx * c + lz * s, -lx * s + lz * c],
    box(lx, y0, lz, sx, sy, sz, color, o = {}) {
      const [wx, wz] = f.pos(lx, lz);
      if (quarter) return b.block(wx, y0, wz, swap ? sz : sx, sy, swap ? sx : sz, color, o);
      return b.block(wx, y0, wz, sx, sy, sz, color, { ...o, rotY: yaw });
    },
    cyl(lx, y0, lz, rt, rb, h, color, o = {}) {
      const [wx, wz] = f.pos(lx, lz);
      return b.cyl(wx, y0, wz, rt, rb, h, color, o);
    },
  };
  return f;
}

export const shade = (hex, k) => {
  const c = new THREE.Color(hex);
  c.multiplyScalar(k);
  return c.getHex();
};

// ---------------------------------------------------------------- природа / мелочь
export function tree(z, x, zz, s = 1, o = {}) {
  const b = z.b;
  const top = o.color ?? PAL.grassDark;
  b.cyl(x, 0, zz, 0.28 * s, 0.38 * s, 2.4 * s, PAL.wood, { seg: 6, collide: true, yBase: true });
  const y0 = (o.y ?? 0);
  void y0;
  b.cone(x, 1.7 * s, zz, 2.1 * s, 2.6 * s, top, { seg: 7 });
  b.cone(x, 3.2 * s, zz, 1.6 * s, 2.3 * s, shade(top, 1.12), { seg: 7 });
  b.cone(x, 4.5 * s, zz, 1.0 * s, 1.9 * s, shade(top, 1.25), { seg: 7 });
}

/** Дерево на высоте y (для рельефа). */
export function treeAt(z, x, y, zz, s = 1, color = PAL.grassDark) {
  const b = z.b;
  b.cyl(x, y, zz, 0.28 * s, 0.38 * s, 2.4 * s, PAL.wood, { seg: 6, collide: true });
  b.cone(x, y + 1.7 * s, zz, 2.1 * s, 2.6 * s, color, { seg: 7 });
  b.cone(x, y + 3.2 * s, zz, 1.6 * s, 2.3 * s, shade(color, 1.12), { seg: 7 });
  b.cone(x, y + 4.5 * s, zz, 1.0 * s, 1.9 * s, shade(color, 1.25), { seg: 7 });
}

export function bush(z, x, y, zz, r = 1, color = PAL.grass) {
  z.b.sphere(x, y + r * 0.6, zz, r, color, { sy: r * 0.75, collide: false });
}

export function rock(z, x, y, zz, r = 1, color = 0x8a8a92) {
  z.b.geo(GEO.ico, x, y + r * 0.45, zz, color, { sx: r, sy: r * 0.7, sz: r * 0.9, ry: x * 3.1, collide: r > 1.2, cr: 0.8 });
}

export function lamp(z, x, y, zz, h = 4, color = 0xffe9a8) {
  z.b.cyl(x, y, zz, 0.08, 0.14, h, PAL.darker, { seg: 5, collide: false });
  z.b.box(x, y + h + 0.15, zz, 0.45, 0.45, 0.45, color, { unlit: true });
  z.light(x, y + h + 0.15, zz, color, 3.2, 0.5);
}

export function bench(z, x, y, zz, yaw = 0) {
  const f = frame(z.b, x, zz, yaw);
  f.box(0, y + 0.45, 0, 1.8, 0.12, 0.5, PAL.wood, { collide: false });
  f.box(0, y + 0.75, -0.22, 1.8, 0.4, 0.08, PAL.wood, { collide: false });
  f.box(-0.75, y, 0, 0.1, 0.45, 0.45, PAL.darker, { collide: false });
  f.box(0.75, y, 0, 0.1, 0.45, 0.45, PAL.darker, { collide: false });
}

export function flowers(z, rng, cx, y, cz, n, radius) {
  const cols = [PAL.pink, PAL.yellow, PAL.white, PAL.orange, PAL.purple];
  for (let i = 0; i < n; i++) {
    const a = rng.range(0, Math.PI * 2), r = Math.sqrt(rng.next()) * radius;
    const x = cx + Math.cos(a) * r, zz = cz + Math.sin(a) * r;
    const gy = z.terrainFn ? z.terrainFn(x, zz) : y;
    z.b.box(x, gy + 0.22, zz, 0.12, 0.44, 0.12, PAL.grassDark, { collide: false });
    z.b.box(x, gy + 0.5, zz, 0.3, 0.16, 0.3, rng.pick(cols), { unlit: true });
  }
}

// ---------------------------------------------------------------- «ОС» элементы
/** Окно ОС как стена/фасад: строка заголовка, кнопки, клиентская область. */
export function osWindow(z, cx, y0, cz, w, h, d, yaw = 0, o = {}) {
  const f = frame(z.b, cx, cz, yaw);
  const body = o.body ?? PAL.gray;
  f.box(0, y0, 0, w, h, d, body, o.solid === false ? { collide: false } : {});
  // заголовок (на лицевой стороне, +Z)
  const tb = o.title ?? PAL.navy;
  f.box(0, y0 + h - 0.7, d / 2 + 0.03, w - 0.3, 0.55, 0.06, tb, { unlit: true, collide: false });
  // кнопки
  const bx = w / 2 - 0.55;
  f.box(bx, y0 + h - 0.63, d / 2 + 0.07, 0.38, 0.38, 0.05, PAL.light, { unlit: true, collide: false });
  f.box(bx - 0.48, y0 + h - 0.63, d / 2 + 0.07, 0.38, 0.38, 0.05, PAL.light, { unlit: true, collide: false });
  f.box(bx - 0.96, y0 + h - 0.63, d / 2 + 0.07, 0.38, 0.38, 0.05, PAL.red, { unlit: true, collide: false });
  // клиентская область
  if (o.client !== false) {
    f.box(0, y0 + 0.3, d / 2 + 0.03, w - 0.5, h - 1.3, 0.05, o.client ?? PAL.light, { unlit: !!o.clientUnlit, collide: false });
  }
  return f;
}

/** Платформа-окно: плоская плита со строкой заголовка. */
export function windowPlatform(z, cx, y, cz, w, d, yaw = 0, o = {}) {
  const f = frame(z.b, cx, cz, yaw);
  const th = o.th ?? 0.7;
  f.box(0, y - th, 0, w, th, d, o.body ?? PAL.gray, { top: o.top ?? PAL.light });
  f.box(0, y - 0.12, d / 2 - 0.35, w - 0.3, 0.14, 0.5, o.title ?? PAL.navy, { unlit: true, collide: false, grad: 1 });
  f.box(w / 2 - 0.5, y - 0.11, d / 2 - 0.35, 0.3, 0.16, 0.34, PAL.red, { unlit: true, collide: false });
  return f;
}

/** Мост-скроллбар по оси. axis: 'x' или 'z'. Возвращает верх y. */
export function scrollbar(z, x0, z0, x1, z1, y, width = 3.4) {
  const b = z.b;
  const alongX = Math.abs(x1 - x0) > Math.abs(z1 - z0);
  const len = alongX ? Math.abs(x1 - x0) : Math.abs(z1 - z0);
  const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
  const sx = alongX ? len : width, sz = alongX ? width : len;
  b.block(cx, y - 0.5, cz, sx, 0.5, sz, PAL.light, { top: 0xf1f1f1, grad: 0.85 });
  // кнопки-стрелки по краям
  const cap = 2.2;
  for (const s of [-1, 1]) {
    const px = alongX ? cx + s * (len / 2 - cap / 2) : cx, pz = alongX ? cz : cz + s * (len / 2 - cap / 2);
    b.block(px, y - 0.52, pz, alongX ? cap : width, 0.54, alongX ? width : cap, PAL.gray, { top: 0xd4d4d4 });
    b.block(px, y + 0.03, pz, alongX ? 0.5 : 1.0, 0.03, alongX ? 1.0 : 0.5, PAL.darker, { unlit: true, collide: false });
  }
  // ползунок
  const tl = Math.max(4, len * 0.3);
  const tx = alongX ? cx + len * 0.12 : cx, tz = alongX ? cz : cz + len * 0.12;
  b.block(tx, y - 0.02, tz, alongX ? tl : width - 0.6, 0.22, alongX ? width - 0.6 : tl, 0xb5b5c4, { top: 0xd0d0e0 });
  return y;
}

/** Плитка «папка-домик» для района «Мои документы». */
export function folderHouse(z, cx, cz, w, d, h, yaw = 0, color = PAL.folder, o = {}) {
  const b = z.b;
  const f = frame(b, cx, cz, yaw);
  const y0 = o.y ?? (z.terrainFn ? z.terrainFn(cx, cz) : 0);
  f.box(0, y0, 0, w, h, d, color);
  // крыша-ярлычок папки
  f.box(-w * 0.22, y0 + h, 0, w * 0.5, 0.6, d * 0.96, shade(color, 0.88));
  f.box(w * 0.05, y0 + h, 0, w * 0.96, 0.22, d, shade(color, 1.05), { top: shade(color, 1.12) });
  // бумаги из-под крыши
  f.box(w * 0.2, y0 + h + 0.22, -d * 0.1, w * 0.45, 0.35, d * 0.6, PAL.paper, { collide: false });
  // дверь и окна на лицевой стороне (+Z)
  f.box(0, y0, d / 2 + 0.02, 1.3, 2.2, 0.08, shade(color, 0.45), { unlit: false, collide: false });
  f.box(0.45, y0 + 1.0, d / 2 + 0.08, 0.12, 0.12, 0.05, PAL.yellow, { unlit: true, collide: false });
  if (w > 5) {
    for (const s of [-1, 1]) f.box(s * (w / 2 - 1.3), y0 + h * 0.45, d / 2 + 0.03, 1.2, 1.2, 0.06, 0x9fd8ff, { unlit: true, collide: false });
  }
  if (o.label) {
    const [lx, lz] = f.pos(0, d / 2 + 0.14);
    z.sign(o.label, lx, y0 + 2.75, lz, Math.min(w - 0.5, 4.4), yaw, { w: 512, h: 96, color: '#3a2a00', bg: 'rgba(255,248,210,0.92)', border: '#7a5a00', borderW: 5, size: 44, shadow: false });
  }
  return { x: cx, z: cz, y: y0, w, d, h, yaw, f };
}

/** Здание-иконка (в районе значков рабочего стола). */
export function iconBuilding(z, kind, cx, cz, yaw, label, o = {}) {
  const b = z.b;
  const f = frame(b, cx, cz, yaw);
  const y0 = o.y ?? (z.terrainFn ? z.terrainFn(cx, cz) : 0);
  const W = 6, D = 5, H = 4.6;
  const C = {
    doc: [0xf2f2ee, PAL.sky], exe: [0xd6d6dc, PAL.navy], img: [0xdde8ff, 0x4fc16a], music: [0xffe3f1, PAL.pink], zip: [0xf3e2b3, PAL.orange], folder: [PAL.folder, PAL.folderDark],
  }[kind] || [0xdddddd, PAL.navy];
  f.box(0, y0, 0, W, H, D, C[0]);
  f.box(0, y0 + H, 0, W + 0.4, 0.4, D + 0.4, C[1], { top: shade(C[1], 1.15) });
  if (kind === 'doc') {
    for (let i = 0; i < 4; i++) f.box(0, y0 + 1.2 + i * 0.65, D / 2 + 0.03, W - 1.6 - (i % 2) * 1.2, 0.18, 0.05, 0x8899aa, { unlit: true, collide: false });
    f.box(W / 2 - 0.45, y0 + H - 0.75, D / 2 + 0.05, 0.9, 0.9, 0.06, 0xd0d6e0, { unlit: true, collide: false });
  } else if (kind === 'exe') {
    f.box(0, y0 + H - 0.9, D / 2 + 0.03, W - 0.4, 0.6, 0.06, PAL.navy, { unlit: true, collide: false });
    f.box(0, y0 + 0.7, D / 2 + 0.03, W - 1, H - 2, 0.05, 0xffffff, { unlit: true, collide: false });
    f.box(0, y0 + 1.6, D / 2 + 0.07, 1.6, 1.0, 0.05, PAL.teal, { unlit: true, collide: false });
  } else if (kind === 'img') {
    f.box(0, y0 + 0.7, D / 2 + 0.03, W - 1, H - 1.6, 0.05, 0x7ec8ff, { unlit: true, collide: false });
    f.box(0, y0 + 0.7, D / 2 + 0.06, W - 1, 1.1, 0.05, PAL.grass, { unlit: true, collide: false });
    f.box(1.3, y0 + 2.6, D / 2 + 0.08, 0.9, 0.9, 0.05, PAL.yellow, { unlit: true, collide: false });
  } else if (kind === 'music') {
    f.box(-1, y0 + 0.8, D / 2 + 0.04, 0.5, 2.2, 0.06, PAL.darker, { unlit: true, collide: false });
    f.box(1, y0 + 1.2, D / 2 + 0.04, 0.5, 2.2, 0.06, PAL.darker, { unlit: true, collide: false });
    f.box(0, y0 + 3.2, D / 2 + 0.04, 2.5, 0.4, 0.06, PAL.darker, { unlit: true, collide: false });
  } else if (kind === 'zip') {
    for (let i = 0; i < 9; i++) f.box(i % 2 ? -0.22 : 0.22, y0 + 0.4 + i * 0.4, D / 2 + 0.04, 0.4, 0.22, 0.05, i % 2 ? PAL.darker : PAL.dark, { unlit: true, collide: false });
  } else {
    f.box(-W * 0.22, y0 + H + 0.4, 0, W * 0.4, 0.5, D * 0.9, PAL.folderDark);
  }
  if (label) {
    const [lx, lz] = f.pos(0, D / 2 + 0.3);
    z.sign(label, lx, y0 + 0.5 + (kind === 'doc' ? 0 : 0), lz, 5.4, yaw, { w: 512, h: 96, color: '#ffffff', bg: 'rgba(0,0,0,0.0)', size: 46 });
  }
  return { x: cx, z: cz, y: y0, w: W, d: D, h: H, f };
}

// ---------------------------------------------------------------- порталы
const portalVert = /* glsl */ `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`;
const portalFrag = /* glsl */ `
  varying vec2 vUv; uniform float uTime; uniform vec3 uColor; uniform float uAlpha;
  void main(){
    vec2 p = vUv * 2.0 - 1.0; p.y *= 0.8;
    float r = length(p); float a = atan(p.y, p.x);
    float w = sin(a * 5.0 + r * 12.0 - uTime * 3.0) * 0.5 + 0.5;
    float w2 = sin(a * 3.0 - r * 7.0 + uTime * 2.0) * 0.5 + 0.5;
    float edge = smoothstep(1.05, 0.7, r);
    float v = mix(0.25, 1.0, w * w2 + 0.2) * edge;
    gl_FragColor = vec4(uColor * (0.5 + v * 1.1), v * uAlpha);
    #include <colorspace_fragment>
  }
`;

export function portalMaterial(color, alpha = 0.92) {
  return new THREE.ShaderMaterial({
    vertexShader: portalVert, fragmentShader: portalFrag,
    uniforms: { uTime: { value: 0 }, uColor: { value: new THREE.Color(color) }, uAlpha: { value: alpha } },
    transparent: true, depthWrite: false, side: THREE.DoubleSide, fog: false,
  });
}

/**
 * Врата-ярлык: арка + вихрь + стрелка ярлыка. Регистрирует портал зоны.
 * o: {to, spawn, label, color, lock, w, h, sub}
 */
export function gateway(z, x, y, zz, yaw, o = {}) {
  const b = z.b;
  const f = frame(b, x, zz, yaw);
  const w = o.w ?? 5, h = o.h ?? 5.6, col = o.color ?? PAL.cyan;
  // колонны и перемычка
  f.box(-(w / 2 + 0.5), y, 0, 1, h + 1, 1.6, o.frame ?? PAL.gray, { top: PAL.light });
  f.box(w / 2 + 0.5, y, 0, 1, h + 1, 1.6, o.frame ?? PAL.gray, { top: PAL.light });
  f.box(0, y + h, 0, w + 2, 1, 1.6, o.frame ?? PAL.gray, { top: PAL.light });
  f.box(0, y + h - 0.1, 0.85, w + 1.6, 0.6, 0.06, o.bar ?? PAL.navy, { unlit: true, collide: false });
  // вихрь
  const mat = portalMaterial(col);
  const plane = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
  const [px, pz] = f.pos(0, 0);
  plane.position.set(px, y + h / 2, pz);
  plane.rotation.y = yaw;
  z.group.add(plane);
  z.disposables.push(mat);
  z.animate((t) => { mat.uniforms.uTime.value = t; });
  z.light(px, y + h / 2, pz, col, w * 1.4, 0.35);
  // стрелка ярлыка
  const [ax, az] = f.pos(-(w / 2 + 0.5), 1.0);
  z.sign('↗', ax, y + 1.3, az, 1.2, yaw, { w: 128, h: 128, bg: '#ffffff', color: '#000000', border: '#444', borderW: 6, size: 100, shadow: false });
  if (o.label) {
    const [lx, lz] = f.pos(0, 0.95);
    z.sign(o.label, lx, y + h + 0.4, lz, Math.max(w + 2, 6), yaw, { w: 640, h: 96, color: '#ffffff', bg: 'rgba(0,0,128,0.85)', border: '#ffffff', borderW: 4, size: 46, shadow: false });
  }
  z.portal({ x: px, y, z: pz, yaw, w, h, d: 1.8, to: o.to, spawn: o.spawn, label: o.name || o.label, lock: o.lock, color: col, sub: o.sub, id: o.id });
  return { x: px, z: pz, plane, mat };
}

/** Кристалл-октаэдр (светящийся). */
export function crystal(z, x, y, zz, r = 0.6, color = PAL.cyan) {
  const m = z.mesh(GEO.octa, basic(color, { fog: true }), x, y, zz, { sx: r * 0.7, sy: r * 1.2, sz: r * 0.7 });
  z.animate((t) => { m.rotation.y = t * 1.2 + x; m.position.y = y + Math.sin(t * 1.7 + zz) * 0.12; });
  z.light(x, y, zz, color, r * 4, 0.45);
  return m;
}

/** Колонна с капителью. */
export function pillar(z, x, y, zz, h = 6, r = 0.7, color = 0x9a9aa8, o = {}) {
  z.b.cyl(x, y, zz, r, r * 1.08, h, color, { seg: o.seg ?? 8, collide: true, top: o.top });
  z.b.block(x, y + h, zz, r * 2.6, 0.5, r * 2.6, shade(color, 1.08), { collide: false });
  z.b.block(x, y - 0.0, zz, r * 2.5, 0.4, r * 2.5, shade(color, 0.9), { collide: false });
}

/** Плоская платформа-«плита» (база для прыжковых зон). */
export function slab(z, x, y, zz, w, d, color = PAL.gray, o = {}) {
  return z.b.block(x, y - (o.th ?? 1), zz, w, o.th ?? 1, d, color, { top: o.top ?? shade(color, 1.15) });
}
