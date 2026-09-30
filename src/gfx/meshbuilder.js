import * as THREE from 'three';
import { MAT } from './materials.js';

// «Батчер» статической геометрии: боксы/цилиндры/любые THREE-геометрии складываются
// в чанки с запечёнными цветами вершин (подсветка + градиент-«окклюзия»),
// поэтому целая зона — это пара десятков draw-call'ов. Одновременно он собирает коллайдеры.

const LIGHT = new THREE.Vector3(0.4, 0.8, 0.45).normalize();
const _c = new THREE.Color();
const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _e = new THREE.Euler();
const _v = new THREE.Vector3();
const _s = new THREE.Vector3();
const _n = new THREE.Vector3();
const _nm = new THREE.Matrix3();

export function shadeOf(nx, ny, nz) {
  if (ny < -0.5) return 0.5;
  const d = Math.max(0, nx * LIGHT.x + ny * LIGHT.y + nz * LIGHT.z);
  return Math.min(1, 0.56 + (0.44 * d) / 0.8);
}

const FACES = [
  { n: [1, 0, 0], u: [0, 1, 0], v: [0, 0, 1] },
  { n: [-1, 0, 0], u: [0, 0, 1], v: [0, 1, 0] },
  { n: [0, 1, 0], u: [0, 0, 1], v: [1, 0, 0] },
  { n: [0, -1, 0], u: [1, 0, 0], v: [0, 0, 1] },
  { n: [0, 0, 1], u: [1, 0, 0], v: [0, 1, 0] },
  { n: [0, 0, -1], u: [0, 1, 0], v: [1, 0, 0] },
];
const QUAD = [
  [-1, -1],
  [1, -1],
  [1, 1],
  [-1, 1],
];

class Chunk {
  constructor(unlit) {
    this.unlit = unlit;
    this.p = [];
    this.n = [];
    this.c = [];
    this.i = [];
    this.v = 0;
  }
  vert(x, y, z, nx, ny, nz, r, g, b) {
    this.p.push(x, y, z);
    this.n.push(nx, ny, nz);
    this.c.push(r, g, b);
    return this.v++;
  }
}

export class MeshBuilder {
  constructor(opts = {}) {
    this.chunkSize = opts.chunk ?? 48;
    this.chunks = new Map();
    this.colliders = [];
  }

  _chunk(x, z, unlit) {
    const k = `${Math.floor(x / this.chunkSize)},${Math.floor(z / this.chunkSize)},${unlit ? 1 : 0}`;
    let c = this.chunks.get(k);
    if (!c) this.chunks.set(k, (c = new Chunk(!!unlit)));
    return c;
  }
  _rgb(color) {
    _c.set(color);
    return [_c.r, _c.g, _c.b];
  }
  _collider(minX, minY, minZ, maxX, maxY, maxZ, o) {
    const box = { minX, minY, minZ, maxX, maxY, maxZ, enabled: true, tag: o.tag || null, dyn: false };
    this.colliders.push(box);
    return box;
  }

  /** Бокс по центру. o: {rotY, top, unlit, collide=true, tag, grad, noBottom} */
  box(cx, cy, cz, sx, sy, sz, color, o = {}) {
    const hx = sx / 2,
      hy = sy / 2,
      hz = sz / 2;
    const rot = o.rotY || 0,
      cs = Math.cos(rot),
      sn = Math.sin(rot);
    const ch = this._chunk(cx, cz, o.unlit);
    const base = this._rgb(color);
    const topc = o.top !== undefined ? this._rgb(o.top) : base;
    const grad = o.grad ?? 0.72;
    for (const f of FACES) {
      if (o.noBottom && f.n[1] < 0) continue;
      const nx = f.n[0] * cs + f.n[2] * sn;
      const ny = f.n[1];
      const nz = -f.n[0] * sn + f.n[2] * cs;
      const sh = o.unlit ? 1 : shadeOf(nx, ny, nz);
      const col = f.n[1] > 0 ? topc : base;
      const hn = Math.abs(f.n[0]) * hx + Math.abs(f.n[1]) * hy + Math.abs(f.n[2]) * hz;
      const hu = Math.abs(f.u[0]) * hx + Math.abs(f.u[1]) * hy + Math.abs(f.u[2]) * hz;
      const hv = Math.abs(f.v[0]) * hx + Math.abs(f.v[1]) * hy + Math.abs(f.v[2]) * hz;
      const side = f.n[1] === 0;
      const i0 = ch.v;
      for (const [a, b] of QUAD) {
        const lx = f.n[0] * hn + f.u[0] * a * hu + f.v[0] * b * hv;
        const ly = f.n[1] * hn + f.u[1] * a * hu + f.v[1] * b * hv;
        const lz = f.n[2] * hn + f.u[2] * a * hu + f.v[2] * b * hv;
        const k = sh * (side && ly < 0 ? grad : 1);
        ch.vert(cx + lx * cs + lz * sn, cy + ly, cz - lx * sn + lz * cs, nx, ny, nz, col[0] * k, col[1] * k, col[2] * k);
      }
      ch.i.push(i0, i0 + 1, i0 + 2, i0, i0 + 2, i0 + 3);
    }
    if (o.collide !== false && !o.unlit) {
      const ex = Math.abs(hx * cs) + Math.abs(hz * sn);
      const ez = Math.abs(hx * sn) + Math.abs(hz * cs);
      return this._collider(cx - ex, cy - hy, cz - ez, cx + ex, cy + hy, cz + ez, o);
    }
    if (o.collide === true) {
      return this._collider(cx - hx, cy - hy, cz - hz, cx + hx, cy + hy, cz + hz, o);
    }
    return null;
  }

  /** Бокс, опирающийся на y0 основанием (удобно для зданий). */
  block(x, y0, z, sx, sy, sz, color, o = {}) {
    return this.box(x, y0 + sy / 2, z, sx, sy, sz, color, o);
  }

  /** Бокс по двум углам. */
  span(x0, y0, z0, x1, y1, z1, color, o = {}) {
    return this.box((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2, Math.abs(x1 - x0), Math.abs(y1 - y0), Math.abs(z1 - z0), color, o);
  }

  /** Цилиндр/конус с основанием на y0. */
  cyl(x, y0, z, rTop, rBot, h, color, o = {}) {
    const seg = o.seg ?? 8;
    const ch = this._chunk(x, z, o.unlit);
    const base = this._rgb(color);
    const topc = o.top !== undefined ? this._rgb(o.top) : base;
    const grad = o.grad ?? 0.72;
    const rot0 = o.rot || 0;
    const slope = (rBot - rTop) / h;
    for (let i = 0; i < seg; i++) {
      const a0 = (i / seg) * Math.PI * 2 + rot0;
      const a1 = ((i + 1) / seg) * Math.PI * 2 + rot0;
      const am = (a0 + a1) / 2;
      _n.set(Math.cos(am), slope, Math.sin(am)).normalize();
      const sh = o.unlit ? 1 : shadeOf(_n.x, _n.y, _n.z);
      const b0 = [x + rBot * Math.cos(a0), y0, z + rBot * Math.sin(a0)];
      const b1 = [x + rBot * Math.cos(a1), y0, z + rBot * Math.sin(a1)];
      const t0 = [x + rTop * Math.cos(a0), y0 + h, z + rTop * Math.sin(a0)];
      const t1 = [x + rTop * Math.cos(a1), y0 + h, z + rTop * Math.sin(a1)];
      const i0 = ch.v;
      const cb = [base[0] * sh * grad, base[1] * sh * grad, base[2] * sh * grad];
      const ct = [base[0] * sh, base[1] * sh, base[2] * sh];
      for (const [p, cc] of [
        [b1, cb],
        [b0, cb],
        [t0, ct],
        [t1, ct],
      ]) {
        ch.vert(p[0], p[1], p[2], _n.x, _n.y, _n.z, cc[0], cc[1], cc[2]);
      }
      ch.i.push(i0, i0 + 1, i0 + 2, i0, i0 + 2, i0 + 3);
      if (rTop > 0.001) {
        const j0 = ch.v;
        const k = o.unlit ? 1 : 1;
        ch.vert(x, y0 + h, z, 0, 1, 0, topc[0] * k, topc[1] * k, topc[2] * k);
        ch.vert(t1[0], t1[1], t1[2], 0, 1, 0, topc[0] * k, topc[1] * k, topc[2] * k);
        ch.vert(t0[0], t0[1], t0[2], 0, 1, 0, topc[0] * k, topc[1] * k, topc[2] * k);
        ch.i.push(j0, j0 + 1, j0 + 2);
      }
      if (rBot > 0.001 && !o.noBottom) {
        const j0 = ch.v;
        const k = 0.5;
        ch.vert(x, y0, z, 0, -1, 0, base[0] * k, base[1] * k, base[2] * k);
        ch.vert(b0[0], b0[1], b0[2], 0, -1, 0, base[0] * k, base[1] * k, base[2] * k);
        ch.vert(b1[0], b1[1], b1[2], 0, -1, 0, base[0] * k, base[1] * k, base[2] * k);
        ch.i.push(j0, j0 + 1, j0 + 2);
      }
    }
    if (o.collide) {
      const r = Math.max(rTop, rBot) * 0.82;
      return this._collider(x - r, y0, z - r, x + r, y0 + h, z + r, o);
    }
    return null;
  }

  cone(x, y0, z, r, h, color, o = {}) {
    return this.cyl(x, y0, z, 0, r, h, color, o);
  }

  /** Любая THREE.BufferGeometry (сфера, тор...) с плоскими нормалями. o: {sx,sy,sz,rx,ry,rz,unlit,collide} */
  geo(geometry, x, y, z, color, o = {}) {
    const g = geometry.index ? geometry.toNonIndexed() : geometry.clone();
    g.computeVertexNormals();
    _e.set(o.rx || 0, o.ry || 0, o.rz || 0);
    _q.setFromEuler(_e);
    _s.set(o.sx ?? o.s ?? 1, o.sy ?? o.s ?? 1, o.sz ?? o.s ?? 1);
    _m.compose(_v.set(x, y, z), _q, _s);
    _nm.getNormalMatrix(_m);
    const ch = this._chunk(x, z, o.unlit);
    const base = this._rgb(color);
    const pos = g.attributes.position;
    const nor = g.attributes.normal;
    const i0 = ch.v;
    for (let i = 0; i < pos.count; i++) {
      _v.fromBufferAttribute(pos, i).applyMatrix4(_m);
      _n.fromBufferAttribute(nor, i).applyMatrix3(_nm).normalize();
      const sh = o.unlit ? 1 : shadeOf(_n.x, _n.y, _n.z);
      const k = sh * (o.grad && _n.y < 0 ? o.grad : 1);
      ch.vert(_v.x, _v.y, _v.z, _n.x, _n.y, _n.z, base[0] * k, base[1] * k, base[2] * k);
    }
    for (let i = 0; i < pos.count; i += 3) ch.i.push(i0 + i, i0 + i + 1, i0 + i + 2);
    g.dispose();
    if (o.collide) {
      const rx = (o.sx ?? o.s ?? 1) * (o.cr ?? 1),
        ry = (o.sy ?? o.s ?? 1) * (o.cr ?? 1),
        rz = (o.sz ?? o.s ?? 1) * (o.cr ?? 1);
      return this._collider(x - rx, y - ry, z - rz, x + rx, y + ry, z + rz, o);
    }
    return null;
  }

  sphere(x, y, z, r, color, o = {}) {
    return this.geo(GEO_SPH, x, y, z, color, { s: r, ...o });
  }

  /** Свободный четырёхугольник (p0..p3 против часовой при взгляде снаружи). */
  quad(p0, p1, p2, p3, color, o = {}) {
    const ch = this._chunk((p0[0] + p2[0]) / 2, (p0[2] + p2[2]) / 2, o.unlit);
    _n.set(p1[0] - p0[0], p1[1] - p0[1], p1[2] - p0[2]).cross(_v.set(p2[0] - p0[0], p2[1] - p0[1], p2[2] - p0[2])).normalize();
    const base = this._rgb(color);
    const sh = o.unlit ? 1 : shadeOf(_n.x, _n.y, _n.z);
    const i0 = ch.v;
    for (const p of [p0, p1, p2, p3]) ch.vert(p[0], p[1], p[2], _n.x, _n.y, _n.z, base[0] * sh, base[1] * sh, base[2] * sh);
    ch.i.push(i0, i0 + 1, i0 + 2, i0, i0 + 2, i0 + 3);
    if (o.both) {
      const j0 = ch.v;
      for (const p of [p0, p1, p2, p3]) ch.vert(p[0], p[1], p[2], -_n.x, -_n.y, -_n.z, base[0] * sh, base[1] * sh, base[2] * sh);
      ch.i.push(j0, j0 + 2, j0 + 1, j0, j0 + 3, j0 + 2);
    }
  }

  /** Лестница из ступеней. dir: 0=+x 1=+z 2=-x 3=-z. Возвращает высоту верха. */
  stairs(x, y0, z, width, steps, riser, tread, dir, color, o = {}) {
    const dx = [1, 0, -1, 0][dir],
      dz = [0, 1, 0, -1][dir];
    for (let i = 0; i < steps; i++) {
      const h = riser * (i + 1);
      const cx = x + dx * (i + 0.5) * tread;
      const cz = z + dz * (i + 0.5) * tread;
      const sx = dx !== 0 ? tread : width;
      const sz = dz !== 0 ? tread : width;
      this.block(cx, y0, cz, sx, h, sz, color, { top: o.top, ...o });
    }
    return y0 + riser * steps;
  }

  /** Стена-отрезок между двумя точками (визуально — повёрнутый бокс, коллизия — цепочка AABB). */
  wall(x0, z0, x1, z1, y0, h, thick, color, o = {}) {
    const len = Math.hypot(x1 - x0, z1 - z0);
    const cx = (x0 + x1) / 2,
      cz = (z0 + z1) / 2;
    const ang = Math.atan2(x1 - x0, z1 - z0); // поворот вокруг Y: длина вдоль Z
    const axisAligned = Math.abs(x1 - x0) < 1e-3 || Math.abs(z1 - z0) < 1e-3;
    if (axisAligned) {
      const sx = Math.abs(x1 - x0) < 1e-3 ? thick : len;
      const sz = Math.abs(x1 - x0) < 1e-3 ? len : thick;
      return this.block(cx, y0, cz, sx, h, sz, color, o);
    }
    this.box(cx, y0 + h / 2, cz, thick, h, len, color, { ...o, rotY: ang, collide: false });
    const steps = Math.ceil(len / (thick * 0.9));
    const last = [];
    for (let i = 0; i < steps; i++) {
      const t = (i + 0.5) / steps;
      const px = x0 + (x1 - x0) * t,
        pz = z0 + (z1 - z0) * t;
      const r = thick * 0.5 + 0.05;
      last.push(this._collider(px - r, y0, pz - r, px + r, y0 + h, pz + r, o));
    }
    return last;
  }

  /** Собирает THREE.Group из чанков. */
  build() {
    const group = new THREE.Group();
    for (const ch of this.chunks.values()) {
      if (!ch.v) continue;
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(ch.p, 3));
      g.setAttribute('normal', new THREE.Float32BufferAttribute(ch.n, 3));
      g.setAttribute('color', new THREE.Float32BufferAttribute(ch.c, 3));
      g.setIndex(ch.v > 65000 ? new THREE.Uint32BufferAttribute(ch.i, 1) : new THREE.Uint16BufferAttribute(ch.i, 1));
      g.computeBoundingSphere();
      const mesh = new THREE.Mesh(g, ch.unlit ? MAT.unlit : MAT.lit);
      mesh.matrixAutoUpdate = false;
      mesh.userData.ownGeometry = true;
      group.add(mesh);
    }
    return group;
  }
}

const GEO_SPH = new THREE.SphereGeometry(1, 8, 6);
