import * as THREE from 'three';

// Воксельные частицы на InstancedMesh: два пула — обычные и светящиеся (аддитивные).
class Pool {
  constructor(scene, max, additive) {
    this.max = max;
    this.n = 0;
    const mat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: additive,
      opacity: additive ? 0.9 : 1,
      blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
      depthWrite: !additive,
      fog: false,
    });
    this.mesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), mat, max);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(max * 3), 3);
    this.mesh.instanceColor.setUsage(THREE.DynamicDrawUsage);
    this.mesh.frustumCulled = false;
    this.mesh.count = 0;
    this.mesh.renderOrder = additive ? 5 : 4;
    scene.add(this.mesh);
    const f = (k) => new Float32Array(max * k);
    this.p = f(3);
    this.v = f(3);
    this.life = f(1);
    this.maxLife = f(1);
    this.s0 = f(1);
    this.s1 = f(1);
    this.c0 = f(3);
    this.c1 = f(3);
    this.grav = f(1);
    this.drag = f(1);
  }
  add(o) {
    if (this.n >= this.max) return;
    const i = this.n++;
    this.p[i * 3] = o.x;
    this.p[i * 3 + 1] = o.y;
    this.p[i * 3 + 2] = o.z;
    this.v[i * 3] = o.vx;
    this.v[i * 3 + 1] = o.vy;
    this.v[i * 3 + 2] = o.vz;
    this.life[i] = this.maxLife[i] = o.life;
    this.s0[i] = o.size;
    this.s1[i] = o.size1;
    this.c0.set(o.c0, i * 3);
    this.c1.set(o.c1, i * 3);
    this.grav[i] = o.grav;
    this.drag[i] = o.drag;
  }
  update(dt) {
    const arr = this.mesh.instanceMatrix.array;
    const col = this.mesh.instanceColor.array;
    let i = 0;
    while (i < this.n) {
      this.life[i] -= dt;
      if (this.life[i] <= 0) {
        // удалить: подставить последнюю
        const l = --this.n;
        if (i !== l) {
          this.p.copyWithin(i * 3, l * 3, l * 3 + 3);
          this.v.copyWithin(i * 3, l * 3, l * 3 + 3);
          this.c0.copyWithin(i * 3, l * 3, l * 3 + 3);
          this.c1.copyWithin(i * 3, l * 3, l * 3 + 3);
          this.life[i] = this.life[l];
          this.maxLife[i] = this.maxLife[l];
          this.s0[i] = this.s0[l];
          this.s1[i] = this.s1[l];
          this.grav[i] = this.grav[l];
          this.drag[i] = this.drag[l];
        }
        continue;
      }
      const k = 1 - Math.exp(-this.drag[i] * dt);
      this.v[i * 3] -= this.v[i * 3] * k;
      this.v[i * 3 + 2] -= this.v[i * 3 + 2] * k;
      this.v[i * 3 + 1] += -this.grav[i] * dt - this.v[i * 3 + 1] * k;
      this.p[i * 3] += this.v[i * 3] * dt;
      this.p[i * 3 + 1] += this.v[i * 3 + 1] * dt;
      this.p[i * 3 + 2] += this.v[i * 3 + 2] * dt;
      const t = 1 - this.life[i] / this.maxLife[i];
      const s = this.s0[i] + (this.s1[i] - this.s0[i]) * t;
      const o = i * 16;
      arr[o] = s;
      arr[o + 5] = s;
      arr[o + 10] = s;
      arr[o + 15] = 1;
      arr[o + 12] = this.p[i * 3];
      arr[o + 13] = this.p[i * 3 + 1];
      arr[o + 14] = this.p[i * 3 + 2];
      col[i * 3] = this.c0[i * 3] + (this.c1[i * 3] - this.c0[i * 3]) * t;
      col[i * 3 + 1] = this.c0[i * 3 + 1] + (this.c1[i * 3 + 1] - this.c0[i * 3 + 1]) * t;
      col[i * 3 + 2] = this.c0[i * 3 + 2] + (this.c1[i * 3 + 2] - this.c0[i * 3 + 2]) * t;
      i++;
    }
    this.mesh.count = this.n;
    this.mesh.instanceMatrix.needsUpdate = true;
    this.mesh.instanceColor.needsUpdate = true;
  }
  clear() {
    this.n = 0;
    this.mesh.count = 0;
  }
}

const _c = new THREE.Color();
const rgb = (c) => {
  _c.set(c);
  return [_c.r, _c.g, _c.b];
};

export class Particles {
  constructor(scene, max = 900) {
    this.solid = new Pool(scene, max, false);
    this.glow = new Pool(scene, max, true);
  }

  /** Одна частица. o: {vx,vy,vz,life,size,size1,color,color1,grav,drag,glow} */
  emit(x, y, z, o = {}) {
    const c0 = rgb(o.color ?? 0xffffff);
    const c1 = o.color1 !== undefined ? rgb(o.color1) : c0;
    (o.glow ? this.glow : this.solid).add({
      x,
      y,
      z,
      vx: o.vx ?? 0,
      vy: o.vy ?? 0,
      vz: o.vz ?? 0,
      life: o.life ?? 0.6,
      size: o.size ?? 0.2,
      size1: o.size1 ?? 0,
      c0,
      c1,
      grav: o.grav ?? 0,
      drag: o.drag ?? 0,
    });
  }

  /** Взрыв частиц во все стороны. o: {speed, up, life, size, color, color1, grav, drag, glow, spread} */
  burst(x, y, z, n, o = {}) {
    const sp = o.speed ?? 4;
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const u = Math.random() * 2 - 1;
      const r = Math.sqrt(1 - u * u);
      const s = sp * (0.4 + Math.random() * 0.6);
      const sz = (o.size ?? 0.2) * (0.6 + Math.random() * 0.8);
      this.emit(x + (Math.random() - 0.5) * (o.spread ?? 0), y + (Math.random() - 0.5) * (o.spread ?? 0), z + (Math.random() - 0.5) * (o.spread ?? 0), {
        ...o,
        vx: Math.cos(a) * r * s,
        vy: u * s * (o.flat ? 0.3 : 1) + (o.up ?? 0),
        vz: Math.sin(a) * r * s,
        life: (o.life ?? 0.6) * (0.7 + Math.random() * 0.6),
        size: sz,
        size1: (o.size1 ?? 0) * sz,
      });
    }
  }

  /** Кольцо частиц в горизонтальной плоскости. */
  ring(x, y, z, n, radius, o = {}) {
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      this.emit(x + Math.cos(a) * radius * 0.2, y, z + Math.sin(a) * radius * 0.2, {
        ...o,
        vx: Math.cos(a) * (o.speed ?? radius * 2),
        vz: Math.sin(a) * (o.speed ?? radius * 2),
        vy: o.vy ?? 0,
      });
    }
  }

  /** Линия частиц между двумя точками (след рывка, лучи). */
  line(x0, y0, z0, x1, y1, z1, n, o = {}) {
    for (let i = 0; i < n; i++) {
      const t = Math.random();
      this.emit(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t, z0 + (z1 - z0) * t, {
        ...o,
        vx: (Math.random() - 0.5) * (o.jitter ?? 1),
        vy: (Math.random() - 0.5) * (o.jitter ?? 1) + (o.up ?? 0),
        vz: (Math.random() - 0.5) * (o.jitter ?? 1),
      });
    }
  }

  update(dt) {
    this.solid.update(dt);
    this.glow.update(dt);
  }
  clear() {
    this.solid.clear();
    this.glow.clear();
  }
}
