import * as THREE from 'three';

// Общие материалы статической геометрии: цвет берётся из вершин (см. meshbuilder).
export const MAT = {
  lit: new THREE.MeshLambertMaterial({ vertexColors: true }),
  unlit: new THREE.MeshBasicMaterial({ vertexColors: true }),
};

const cacheL = new Map();
const cacheB = new Map();

/** Материал с освещением. own:true — отдельный экземпляр (для вспышки при попадании и т.п.). */
export function lambert(color, o = {}) {
  const key = `${color}|${o.flat ?? true}|${o.opacity ?? 1}|${o.emissive ?? 0}|${o.side ?? 0}`;
  if (!o.own && cacheL.has(key)) return cacheL.get(key);
  const m = new THREE.MeshLambertMaterial({
    color,
    flatShading: o.flat ?? true,
    transparent: (o.opacity ?? 1) < 1,
    opacity: o.opacity ?? 1,
    emissive: o.emissive ?? 0x000000,
    side: o.side ?? THREE.FrontSide,
  });
  if (!o.own) cacheL.set(key, m);
  return m;
}

/** Материал без освещения (неон, интерфейсные элементы в мире). */
export function basic(color, o = {}) {
  const key = `${color}|${o.opacity ?? 1}|${o.add ?? 0}|${o.side ?? 0}|${o.fog ?? true}|${o.depth ?? true}`;
  if (!o.own && cacheB.has(key)) return cacheB.get(key);
  const m = new THREE.MeshBasicMaterial({
    color,
    transparent: (o.opacity ?? 1) < 1 || !!o.add,
    opacity: o.opacity ?? 1,
    blending: o.add ? THREE.AdditiveBlending : THREE.NormalBlending,
    depthWrite: o.add ? false : (o.depth ?? true),
    side: o.side ?? THREE.FrontSide,
    fog: o.fog ?? true,
  });
  if (!o.own) cacheB.set(key, m);
  return m;
}

/** Светящийся полупрозрачный материал (аддитивный). */
export const glow = (color, opacity = 0.8) => basic(color, { opacity, add: true, side: THREE.DoubleSide });

// Общая единичная геометрия для моделей.
export const GEO = {
  box: new THREE.BoxGeometry(1, 1, 1),
  cyl8: new THREE.CylinderGeometry(1, 1, 1, 8),
  cyl6: new THREE.CylinderGeometry(1, 1, 1, 6),
  cone8: new THREE.ConeGeometry(1, 1, 8),
  sph: new THREE.SphereGeometry(1, 10, 8),
  sphLow: new THREE.SphereGeometry(1, 7, 5),
  plane: new THREE.PlaneGeometry(1, 1),
  octa: new THREE.OctahedronGeometry(1, 0),
  ico: new THREE.IcosahedronGeometry(1, 0),
  torus: new THREE.TorusGeometry(1, 0.12, 6, 20),
};

for (const g of Object.values(GEO)) g.userData.shared = true;
