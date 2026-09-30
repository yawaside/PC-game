import * as THREE from 'three';
import { GEO } from '../gfx/materials.js';
import { canvasTexture } from '../gfx/text.js';

// Процедурные low-poly модели врагов и NPC. Направление «вперёд» — локальная +Z.

const matCache = new Map();
export function M(color, o = {}) {
  const key = `${color}|${o.e || 0}|${o.o ?? 1}`;
  if (!o.own && matCache.has(key)) return matCache.get(key);
  const m = new THREE.MeshLambertMaterial({ color, flatShading: true, transparent: (o.o ?? 1) < 1, opacity: o.o ?? 1 });
  if (o.e !== undefined) m.emissive = new THREE.Color(o.e);
  if (!o.own) matCache.set(key, m);
  return m;
}
const B = (w, h, d) => new THREE.BoxGeometry(w, h, d);
export const box = (w, h, d, color, x = 0, y = 0, z = 0, o = {}) => {
  const m = new THREE.Mesh(B(w, h, d), o.mat || M(color, o));
  m.position.set(x, y, z);
  return m;
};
export const ball = (r, color, x = 0, y = 0, z = 0, o = {}) => {
  const m = new THREE.Mesh(o.geo || GEO.ico, o.mat || M(color, o));
  m.scale.set(r * (o.sx ?? 1), r * (o.sy ?? 1), r * (o.sz ?? 1));
  m.position.set(x, y, z);
  return m;
};
export const cone = (r, h, color, x = 0, y = 0, z = 0, o = {}) => {
  const m = new THREE.Mesh(new THREE.ConeGeometry(r, h, o.seg ?? 5), M(color, o));
  m.position.set(x, y, z);
  return m;
};
export const cyl = (rt, rb, h, color, x = 0, y = 0, z = 0, o = {}) => {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, o.seg ?? 8), M(color, o));
  m.position.set(x, y, z);
  return m;
};
const glowMat = (color) => new THREE.MeshBasicMaterial({ color });

function windowTex(title = '', body = '#fff', bar = '#000080') {
  const t = canvasTexture(64, 48, (g) => {
    g.fillStyle = '#c0c0c0'; g.fillRect(0, 0, 64, 48);
    g.fillStyle = bar; g.fillRect(2, 2, 60, 9);
    g.fillStyle = body; g.fillRect(3, 13, 58, 32);
    g.fillStyle = '#c00'; g.fillRect(52, 4, 8, 5);
    g.fillStyle = '#000'; g.fillRect(8, 20, 34, 3); g.fillRect(8, 28, 26, 3); g.fillRect(8, 36, 40, 3);
  });
  t.userData.shared = true;
  t.magFilter = THREE.NearestFilter;
  return t;
}
let winMat = null;
const winQuad = () => {
  if (!winMat) winMat = new THREE.MeshBasicMaterial({ map: windowTex(), side: THREE.DoubleSide });
  return new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.675), winMat);
};

// ---------------------------------------------------------------------- враги
export function makeEnemyModel(kind, c = {}) {
  const g = new THREE.Group();
  const p = {}; // именованные части для анимации
  switch (kind) {
    case 'slime': {
      const col = c.body ?? 0x9b59ff;
      p.body = ball(0.85, col, 0, 0.62, 0, { sy: 0.78, e: 0x220044 });
      p.core = ball(0.42, c.core ?? 0xc9a0ff, 0, 0.6, 0, { o: 0.9, e: 0x331166 });
      g.add(p.body, p.core);
      g.add(box(0.2, 0.26, 0.05, 0xffffff, -0.3, 0.85, 0.72), box(0.2, 0.26, 0.05, 0xffffff, 0.3, 0.85, 0.72));
      g.add(box(0.1, 0.14, 0.06, 0x000000, -0.3, 0.83, 0.75), box(0.1, 0.14, 0.06, 0x000000, 0.3, 0.83, 0.75));
      g.add(box(0.5, 0.08, 0.05, 0x220033, 0, 0.5, 0.76));
      const w = winQuad(); w.position.set(0, 1.45, -0.1); w.rotation.y = 0; p.ad = w; g.add(w);
      break;
    }
    case 'bat': {
      p.body = ball(0.3, c.body ?? 0x3a2a55, 0, 0, 0, { sy: 1.1, sz: 1.3 });
      p.wingL = new THREE.Group(); p.wingR = new THREE.Group();
      p.wingL.add(box(1.0, 0.04, 0.6, c.wing ?? 0x4a3a70, -0.5, 0, 0));
      p.wingR.add(box(1.0, 0.04, 0.6, c.wing ?? 0x4a3a70, 0.5, 0, 0));
      p.wingL.position.set(-0.2, 0.05, 0); p.wingR.position.set(0.2, 0.05, 0);
      g.add(p.body, p.wingL, p.wingR);
      g.add(cone(0.08, 0.22, 0x3a2a55, -0.13, 0.32, 0.1), cone(0.08, 0.22, 0x3a2a55, 0.13, 0.32, 0.1));
      const eye = new THREE.Mesh(B(0.14, 0.12, 0.05), glowMat(0xff3030)); eye.position.set(0, 0.06, 0.36); g.add(eye); p.eye = eye;
      g.add(box(0.05, 0.2, 0.05, 0x888888, 0.3, -0.1, 0.25), ball(0.1, 0x99ddff, 0.3, -0.27, 0.25, { o: 0.8 }));
      break;
    }
    case 'worm': {
      p.segs = [];
      for (let i = 0; i < 5; i++) {
        const s = ball(0.62 - i * 0.07, i === 0 ? 0xc4805a : 0x9a5a3a, 0, i * 0.85, 0, { sy: 0.9 });
        p.segs.push(s); g.add(s);
      }
      const h = p.segs[0];
      h.add(box(0.36, 0.1, 0.06, 0x330000, 0, 0.0, 0.5));
      g.add(box(0.14, 0.14, 0.06, 0xffffff, -0.25, 0.25, 0.52), box(0.14, 0.14, 0.06, 0xffffff, 0.25, 0.25, 0.52));
      p.mound = cyl(1.4, 1.8, 0.25, 0x5a4330, 0, -0.1, 0, { seg: 8 });
      g.add(p.mound);
      break;
    }
    case 'golem': {
      const gray = c.body ?? 0x7a86a0, dark = 0x444c60;
      p.torso = box(2.4, 2.6, 1.6, gray, 0, 2.3, 0);
      p.head = box(1.0, 0.9, 0.9, dark, 0, 4.0, 0.05);
      p.armL = new THREE.Group(); p.armR = new THREE.Group();
      p.armL.add(box(0.9, 2.4, 0.9, gray, 0, -1.0, 0)); p.armR.add(box(0.9, 2.4, 0.9, gray, 0, -1.0, 0));
      p.armL.position.set(-1.7, 3.3, 0); p.armR.position.set(1.7, 3.3, 0);
      p.legL = box(0.9, 1.4, 0.9, dark, -0.7, 0.7, 0); p.legR = box(0.9, 1.4, 0.9, dark, 0.7, 0.7, 0);
      g.add(p.torso, p.head, p.armL, p.armR, p.legL, p.legR);
      p.bar = box(1.7, 0.3, 0.06, 0x3cff6a, -0.0, 2.6, 0.83, { mat: glowMat(0x3cff6a) });
      g.add(box(1.9, 0.5, 0.06, 0x111111, 0, 2.6, 0.81), p.bar);
      const eyeM = glowMat(0xff4040);
      const e1 = new THREE.Mesh(B(0.22, 0.14, 0.05), eyeM); e1.position.set(-0.25, 4.05, 0.52);
      const e2 = e1.clone(); e2.position.x = 0.25; g.add(e1, e2);
      p.core = ball(0.3, 0xffb030, 0, 2.3, 0.86, { mat: glowMat(0xffb030) }); g.add(p.core);
      break;
    }
    case 'bird': {
      p.body = box(0.42, 0.3, 0.5, c.body ?? 0x3a8cff, 0, 0, 0);
      g.add(p.body);
      p.wingL = new THREE.Group(); p.wingR = new THREE.Group();
      p.wingL.add(box(0.7, 0.05, 0.4, c.wing ?? 0x9fd0ff, -0.35, 0, 0)); p.wingR.add(box(0.7, 0.05, 0.4, c.wing ?? 0x9fd0ff, 0.35, 0, 0));
      p.wingL.position.set(-0.2, 0.1, 0); p.wingR.position.set(0.2, 0.1, 0);
      g.add(p.wingL, p.wingR);
      g.add(cone(0.1, 0.28, 0xffa030, 0, -0.02, 0.4, { seg: 4 }));
      g.children[g.children.length - 1].rotation.x = Math.PI / 2;
      g.add(box(0.1, 0.1, 0.04, 0xffffff, -0.12, 0.1, 0.27), box(0.1, 0.1, 0.04, 0xffffff, 0.12, 0.1, 0.27));
      g.add(box(0.05, 0.05, 0.04, 0x000000, -0.12, 0.1, 0.3), box(0.05, 0.05, 0.04, 0x000000, 0.12, 0.1, 0.3));
      g.add(box(0.26, 0.09, 0.03, 0xc0c0c0, 0, 0.25, -0.1));
      break;
    }
    case 'soldier': {
      const cl = c.body ?? 0x6d7a4a;
      p.body = box(0.8, 1.0, 0.5, cl, 0, 1.15, 0);
      p.head = ball(0.3, 0xd8c79a, 0, 1.95, 0);
      p.helmet = ball(0.36, c.helmet ?? 0x4f5a36, 0, 2.05, 0, { sy: 0.7 });
      p.legL = box(0.3, 0.8, 0.3, 0x3a422a, -0.2, 0.4, 0); p.legR = box(0.3, 0.8, 0.3, 0x3a422a, 0.2, 0.4, 0);
      p.armL = box(0.22, 0.8, 0.22, cl, -0.54, 1.2, 0.1); p.armR = box(0.22, 0.8, 0.22, cl, 0.54, 1.2, 0.3);
      p.gun = box(0.12, 0.14, 0.9, 0x222222, 0.46, 1.2, 0.6);
      g.add(p.body, p.head, p.helmet, p.legL, p.legR, p.armL, p.armR, p.gun, box(0.12, 0.3, 0.05, 0xd93025, -0.5, 1.45, 0.17));
      g.add(box(0.1, 0.1, 0.04, 0x000000, -0.11, 1.98, 0.27), box(0.1, 0.1, 0.04, 0x000000, 0.11, 1.98, 0.27));
      break;
    }
    case 'ghost': {
      p.body = ball(0.7, c.body ?? 0xdfe6ff, 0, 0, 0, { sy: 1.15, o: 0.78, e: 0x5a66aa });
      p.tail = cone(0.6, 1.1, c.body ?? 0xdfe6ff, 0, -0.85, 0, { o: 0.6, seg: 6, e: 0x5a66aa });
      p.tail.rotation.x = Math.PI;
      g.add(p.body, p.tail);
      g.add(box(0.18, 0.28, 0.05, 0x000000, -0.25, 0.15, 0.62), box(0.18, 0.28, 0.05, 0x000000, 0.25, 0.15, 0.62), box(0.22, 0.26, 0.05, 0x000000, 0, -0.25, 0.64));
      // геймпад на груди
      g.add(box(0.5, 0.18, 0.06, 0x333344, 0, -0.45, 0.66), box(0.08, 0.08, 0.08, 0xff4040, 0.14, -0.43, 0.7), box(0.08, 0.08, 0.08, 0x40ff40, 0.2, -0.47, 0.7));
      break;
    }
    case 'hacker': {
      p.body = cone(0.55, 1.7, c.body ?? 0x16161e, 0, 0.85, 0, { seg: 6 });
      p.head = ball(0.32, 0x22222a, 0, 1.85, 0, { sy: 1.1 });
      g.add(p.body, p.head);
      const gm = glowMat(c.eye ?? 0x3cff6a);
      const e1 = new THREE.Mesh(B(0.14, 0.06, 0.05), gm); e1.position.set(-0.14, 1.88, 0.28);
      const e2 = e1.clone(); e2.position.x = 0.14; g.add(e1, e2);
      p.lap = box(0.6, 0.05, 0.42, 0x8a8a94, 0.4, 1.05, 0.35); p.lap.rotation.x = -0.4;
      g.add(p.lap, box(0.56, 0.3, 0.04, 0x0a2a10, 0.4, 1.2, 0.2, { mat: glowMat(0x1aa84a) }));
      g.children[g.children.length - 1].rotation.x = -0.4;
      break;
    }
    case 'miner': {
      p.body = ball(0.55, c.body ?? 0x8a6a2a, 0, 0, 0, { sy: 0.8 });
      p.rotor = new THREE.Group();
      p.rotor.add(box(1.3, 0.04, 0.12, 0x222222), box(0.12, 0.04, 1.3, 0x222222));
      p.rotor.position.y = 0.55;
      g.add(p.body, p.rotor, box(0.05, 0.3, 0.05, 0x555555, 0, 0.3, 0));
      g.add(box(0.5, 0.06, 0.06, 0x888888, 0.0, -0.5, 0.3), ball(0.14, 0xffd23f, 0.0, -0.7, 0.3, { mat: glowMat(0xffd23f) }));
      const eye = new THREE.Mesh(B(0.3, 0.12, 0.05), glowMat(0xffaa00)); eye.position.set(0, 0.05, 0.5); g.add(eye); p.eye = eye;
      break;
    }
    case 'glitch': {
      p.cubes = [];
      const cols = [0xff2a6a, 0x2affd0, 0xffe02a, 0x5a2aff];
      for (let i = 0; i < 8; i++) {
        const cc = box(0.5, 0.5, 0.5, cols[i % 4], (i & 1 ? 0.3 : -0.3), 0.35 + (i & 2 ? 0.6 : 0), (i & 4 ? 0.3 : -0.3), { mat: glowMat(cols[i % 4]) });
        p.cubes.push(cc); g.add(cc);
      }
      break;
    }
    default: {
      g.add(box(1, 1, 1, 0xff00ff, 0, 0.5, 0));
    }
  }
  return { root: g, parts: p };
}

// ---------------------------------------------------------------------- NPC
export function makeNpcModel(look) {
  const g = new THREE.Group();
  const p = {};
  const body = look.body, acc = look.acc;
  const face = (y, z, col = 0x111111) => {
    g.add(box(0.12, 0.18, 0.05, 0xffffff, -0.22, y, z), box(0.12, 0.18, 0.05, 0xffffff, 0.22, y, z));
    g.add(box(0.07, 0.12, 0.06, col, -0.22, y - 0.01, z + 0.02), box(0.07, 0.12, 0.06, col, 0.22, y - 0.01, z + 0.02));
  };
  switch (look.shape) {
    case 'shield': {
      p.body = box(1.2, 1.3, 0.35, body, 0, 1.3, 0);
      g.add(p.body, box(0.9, 0.6, 0.35, body, 0, 0.55, 0), box(0.5, 0.3, 0.35, body, 0, 0.12, 0));
      g.add(box(1.0, 1.1, 0.06, acc, 0, 1.3, 0.2), face(1.42, 0.25, 0x2a6bff) || box(0.4, 0.06, 0.05, 0x7a2a00, 0, 1.05, 0.25));
      g.add(box(0.36, 0.06, 0.05, 0x7a2a00, 0, 1.05, 0.24));
      p.halo = ball(0.12, 0xffffff, 0, 2.2, 0, { mat: glowMat(0xffee99) });
      g.add(p.halo);
      break;
    }
    case 'clip': {
      g.add(box(0.14, 1.6, 0.14, 0x9aa0ac, -0.3, 0.9, 0), box(0.14, 1.3, 0.14, 0x9aa0ac, 0.3, 1.05, 0), box(0.74, 0.14, 0.14, 0x9aa0ac, 0, 1.75, 0), box(0.4, 0.14, 0.14, 0x9aa0ac, 0.1, 0.25, 0));
      p.body = box(0.14, 0.14, 0.14, 0x9aa0ac, 0, 0.2, 0);
      g.add(box(0.24, 0.3, 0.05, 0xffffff, -0.12, 1.45, 0.12), box(0.24, 0.3, 0.05, 0xffffff, 0.22, 1.45, 0.12), box(0.08, 0.14, 0.06, 0x000000, -0.08, 1.43, 0.15), box(0.08, 0.14, 0.06, 0x000000, 0.26, 1.43, 0.15));
      g.add(box(0.3, 0.05, 0.05, 0x000, -0.05, 1.25, 0.12, {}));
      break;
    }
    case 'calc': {
      g.add(box(1.0, 1.5, 0.35, body, 0, 0.85, 0), box(0.8, 0.4, 0.06, acc, 0, 1.35, 0.2, { mat: glowMat(acc) }));
      for (let y = 0; y < 3; y++) for (let x = 0; x < 3; x++) g.add(box(0.18, 0.14, 0.05, x === 2 ? 0xe05a2a : 0xe0e0e0, -0.26 + x * 0.26, 0.75 - y * 0.22, 0.2));
      g.add(box(0.12, 0.14, 0.05, 0x111111, -0.18, 1.35, 0.25), box(0.12, 0.14, 0.05, 0x111111, 0.18, 1.35, 0.25));
      break;
    }
    case 'pad': {
      g.add(box(1.2, 1.5, 0.16, body, 0, 1.0, 0), box(1.2, 0.3, 0.2, acc, 0, 1.85, 0));
      for (let i = 0; i < 5; i++) g.add(box(0.9, 0.04, 0.05, 0xc9b84a, 0, 0.55 + i * 0.22, 0.1));
      g.add(box(0.12, 0.14, 0.05, 0x111, -0.25, 1.5, 0.12), box(0.12, 0.14, 0.05, 0x111, 0.25, 1.5, 0.12));
      break;
    }
    case 'win': {
      g.add(box(1.3, 1.5, 0.2, body, 0, 1.0, 0), box(1.3, 0.25, 0.22, 0x1084d0, 0, 1.9, 0));
      for (let i = 0; i < 5; i++) g.add(box(0.16, 0.2 + ((i * 7) % 5) * 0.1, 0.06, i % 2 ? 0x3ab26a : 0xe0413a, -0.45 + i * 0.22, 0.45 + (0.1 + ((i * 7) % 5) * 0.05), 0.13));
      break;
    }
    case 'clock': {
      g.add(cyl(0.7, 0.7, 0.3, body, 0, 1.2, 0, { seg: 10 }));
      g.children[g.children.length - 1].rotation.x = Math.PI / 2;
      g.add(box(0.12, 0.45, 0.05, acc, 0, 1.4, 0.2, { mat: glowMat(acc) }), box(0.35, 0.1, 0.05, acc, 0.12, 1.25, 0.2, { mat: glowMat(acc) }));
      g.add(box(0.5, 0.2, 0.4, 0x555566, 0, 0.25, 0));
      break;
    }
    case 'horse': {
      g.add(box(1.0, 1.3, 0.9, body, 0, 0.7, 0), box(0.5, 0.95, 0.5, body, 0, 1.75, 0.35));
      g.add(box(0.44, 0.44, 0.7, 0xb07a40, 0, 2.15, 0.7), box(0.12, 0.3, 0.08, acc, 0, 2.35, 0.05));
      g.add(box(0.1, 0.1, 0.05, 0xffffff, -0.18, 2.4, 0.61), box(0.1, 0.1, 0.05, 0xffffff, 0.18, 2.4, 0.61), box(0.05, 0.06, 0.06, 0, -0.18, 2.4, 0.64), box(0.05, 0.06, 0.06, 0, 0.18, 2.4, 0.64));
      g.add(box(0.14, 0.7, 0.14, 0x7a4a20, -0.3, 0.0, 0.25), box(0.14, 0.7, 0.14, 0x7a4a20, 0.3, 0.0, 0.25), box(0.3, 0.3, 0.1, 0xffe07a, 0, 2.6, 0.05));
      break;
    }
    case 'bin': {
      g.add(cyl(0.65, 0.55, 1.4, body, 0, 0.7, 0, { seg: 8 }), cyl(0.75, 0.72, 0.2, 0x2a7a42, 0, 1.45, 0, { seg: 8 }));
      g.add(face(1.0, 0.56), box(0.4, 0.06, 0.05, 0x103a20, 0, 0.7, 0.58));
      break;
    }
    case 'broom': {
      g.add(box(0.12, 2.0, 0.12, 0x8a6a3a, 0, 1.0, 0), box(0.8, 0.5, 0.3, 0xe0c060, 0, 0.3, 0));
      g.add(box(0.7, 0.5, 0.35, body, 0, 1.5, 0), face(1.6, 0.2));
      break;
    }
    case 'soldier': {
      const m = makeEnemyModel('soldier', { body, helmet: 0x5a6a3a });
      return { root: m.root, parts: m.parts };
    }
    case 'cube': {
      g.add(box(1.2, 1.2, 1.2, body, 0, 0.9, 0), box(0.8, 0.8, 0.8, acc, 0, 2.0, 0));
      g.add(face(0.95, 0.62), box(0.1, 0.1, 0.06, 0xffd23f, 0, 2.0, 0.42));
      break;
    }
    case 'mine': {
      g.add(ball(0.75, body, 0, 0.8, 0), ...Array.from({ length: 6 }, (_, i) => { const a = (i / 6) * Math.PI * 2; return box(0.14, 0.14, 0.4, acc, Math.cos(a) * 0.85, 0.8, Math.sin(a) * 0.85, {}); }));
      g.add(face(0.95, 0.6));
      break;
    }
    case 'card': {
      g.add(box(0.9, 1.4, 0.06, body, 0, 0.9, 0), box(0.3, 0.3, 0.07, acc, -0.22, 1.35, 0.03), box(0.3, 0.3, 0.07, acc, 0.22, 0.45, 0.03));
      g.add(face(0.95, 0.06));
      break;
    }
    case 'router': {
      g.add(box(1.5, 0.5, 1.0, body, 0, 0.6, 0));
      for (let i = 0; i < 3; i++) g.add(box(0.05, 1.0, 0.05, 0x111111, -0.45 + i * 0.45, 1.3, -0.25), box(0.12, 0.1, 0.05, acc, -0.45 + i * 0.45, 0.65, 0.52, { mat: glowMat(acc) }));
      g.add(face(0.7, 0.52));
      break;
    }
    case 'chip': {
      g.add(box(1.4, 1.4, 0.3, body, 0, 1.2, 0));
      for (let i = 0; i < 6; i++) g.add(box(0.12, 0.25, 0.1, 0x9a8a5a, -0.55 + i * 0.22, 0.35, 0), box(0.12, 0.25, 0.1, 0x9a8a5a, -0.55 + i * 0.22, 2.05, 0));
      g.add(box(1.0, 1.0, 0.06, acc, 0, 1.2, 0.17), face(1.35, 0.2));
      break;
    }
    case 'file':
    default: {
      g.add(box(0.9, 1.2, 0.2, body, 0, 0.85, 0), box(0.3, 0.3, 0.22, acc, 0.3, 1.3, 0));
      g.add(face(0.9, 0.12));
    }
  }
  return { root: g, parts: p };
}
