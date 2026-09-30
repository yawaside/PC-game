import * as THREE from 'three';
import { MAT } from './materials.js';
import { shadeOf } from './meshbuilder.js';

/**
 * Гранёный (low-poly) рельеф по функции высоты.
 * colorFn(x, z, y, ny) -> hex. Функция height должна быть той же, что использует коллизия.
 */
export function makeTerrain({ minX, maxX, minZ, maxZ, step = 3, height, color, skirt = 0 }) {
  const nx = Math.max(1, Math.ceil((maxX - minX) / step));
  const nz = Math.max(1, Math.ceil((maxZ - minZ) / step));
  const sx = (maxX - minX) / nx;
  const sz = (maxZ - minZ) / nz;
  const H = new Float32Array((nx + 1) * (nz + 1));
  for (let j = 0; j <= nz; j++) for (let i = 0; i <= nx; i++) H[j * (nx + 1) + i] = height(minX + i * sx, minZ + j * sz);
  const pos = [];
  const nor = [];
  const col = [];
  const c = new THREE.Color();
  const a = new THREE.Vector3(),
    b = new THREE.Vector3(),
    d = new THREE.Vector3(),
    n = new THREE.Vector3();
  const tri = (p0, p1, p2) => {
    a.set(p1[0] - p0[0], p1[1] - p0[1], p1[2] - p0[2]);
    b.set(p2[0] - p0[0], p2[1] - p0[1], p2[2] - p0[2]);
    n.copy(a).cross(b).normalize();
    if (n.y < 0) n.negate();
    const cx = (p0[0] + p1[0] + p2[0]) / 3;
    const cz = (p0[2] + p1[2] + p2[2]) / 3;
    const cy = (p0[1] + p1[1] + p2[1]) / 3;
    c.set(color(cx, cz, cy, n.y));
    const sh = shadeOf(n.x, n.y, n.z);
    for (const p of [p0, p1, p2]) {
      pos.push(p[0], p[1], p[2]);
      nor.push(n.x, n.y, n.z);
      col.push(c.r * sh, c.g * sh, c.b * sh);
    }
  };
  for (let j = 0; j < nz; j++) {
    for (let i = 0; i < nx; i++) {
      const x0 = minX + i * sx,
        x1 = x0 + sx,
        z0 = minZ + j * sz,
        z1 = z0 + sz;
      const h00 = H[j * (nx + 1) + i],
        h10 = H[j * (nx + 1) + i + 1],
        h01 = H[(j + 1) * (nx + 1) + i],
        h11 = H[(j + 1) * (nx + 1) + i + 1];
      const p00 = [x0, h00, z0],
        p10 = [x1, h10, z0],
        p01 = [x0, h01, z1],
        p11 = [x1, h11, z1];
      // чередуем диагональ, чтобы рельеф выглядел живее
      if ((i + j) % 2 === 0) {
        tri(p00, p01, p11);
        tri(p00, p11, p10);
      } else {
        tri(p00, p01, p10);
        tri(p10, p01, p11);
      }
    }
  }
  void d;
  void skirt;
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.computeBoundingSphere();
  const mesh = new THREE.Mesh(g, MAT.lit);
  mesh.userData.ownGeometry = true;
  return mesh;
}
