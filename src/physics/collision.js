// Мир коллизий: статические AABB в сетке + динамические (движущиеся платформы, шифрованные плитки),
// плюс необязательная функция высоты рельефа.
const NEG = -1e9;

export class CollisionWorld {
  constructor(cell = 6) {
    this.cell = cell;
    this.grid = new Map();
    this.big = []; // огромные коллайдеры — линейный перебор
    this.dynamic = [];
    this.stamp = 1;
    this.groundFn = null;
    this.bounds = null; // {minX,maxX,minZ,maxZ}
    this.count = 0;
  }

  _key(ix, iz) {
    return (ix + 4096) * 8192 + (iz + 4096);
  }

  add(b) {
    if (b.enabled === undefined) b.enabled = true;
    b._stamp = 0;
    const c = this.cell;
    const x0 = Math.floor(b.minX / c),
      x1 = Math.floor(b.maxX / c),
      z0 = Math.floor(b.minZ / c),
      z1 = Math.floor(b.maxZ / c);
    if ((x1 - x0 + 1) * (z1 - z0 + 1) > 80) {
      this.big.push(b);
    } else {
      for (let ix = x0; ix <= x1; ix++) {
        for (let iz = z0; iz <= z1; iz++) {
          const k = this._key(ix, iz);
          let l = this.grid.get(k);
          if (!l) this.grid.set(k, (l = []));
          l.push(b);
        }
      }
    }
    this.count++;
    return b;
  }

  addAll(list) {
    for (const b of list) this.add(b);
  }

  /** Динамический коллайдер (перемещается через translate/setPos). */
  addDynamic(b) {
    b.enabled = b.enabled ?? true;
    b.dyn = true;
    b.dx = b.dy = b.dz = 0;
    this.dynamic.push(b);
    return b;
  }

  removeDynamic(b) {
    b.enabled = false;
    const i = this.dynamic.indexOf(b);
    if (i >= 0) this.dynamic.splice(i, 1);
  }

  translate(b, dx, dy, dz) {
    b.minX += dx;
    b.maxX += dx;
    b.minY += dy;
    b.maxY += dy;
    b.minZ += dz;
    b.maxZ += dz;
    b.dx = dx;
    b.dy = dy;
    b.dz = dz;
  }

  /** Собрать все включённые коллайдеры, пересекающие область. */
  query(minX, minY, minZ, maxX, maxY, maxZ, out) {
    out.length = 0;
    const st = ++this.stamp;
    const c = this.cell;
    const x0 = Math.floor(minX / c),
      x1 = Math.floor(maxX / c),
      z0 = Math.floor(minZ / c),
      z1 = Math.floor(maxZ / c);
    for (let ix = x0; ix <= x1; ix++) {
      for (let iz = z0; iz <= z1; iz++) {
        const l = this.grid.get(this._key(ix, iz));
        if (!l) continue;
        for (let i = 0; i < l.length; i++) {
          const b = l[i];
          if (b._stamp === st || !b.enabled) continue;
          b._stamp = st;
          if (b.maxX > minX && b.minX < maxX && b.maxY > minY && b.minY < maxY && b.maxZ > minZ && b.minZ < maxZ) out.push(b);
        }
      }
    }
    const scan = (list) => {
      for (let i = 0; i < list.length; i++) {
        const b = list[i];
        if (!b.enabled) continue;
        if (b.maxX > minX && b.minX < maxX && b.maxY > minY && b.minY < maxY && b.maxZ > minZ && b.minZ < maxZ) out.push(b);
      }
    };
    scan(this.big);
    scan(this.dynamic);
    return out;
  }

  groundY(x, z) {
    return this.groundFn ? this.groundFn(x, z) : NEG;
  }

  /** Высота самой верхней опоры не выше y (+eps) под точкой (x,z) с радиусом r. */
  floorBelow(x, y, z, r = 0.3, maxDrop = 200) {
    let best = this.groundFn ? this.groundFn(x, z) : NEG;
    if (best > y + 0.05) best = NEG;
    const tmp = this._tmp || (this._tmp = []);
    this.query(x - r, y - maxDrop, z - r, x + r, y + 0.05, z + r, tmp);
    for (const b of tmp) if (b.maxY <= y + 0.05 && b.maxY > best) best = b.maxY;
    return best;
  }

  /**
   * Луч против AABB и рельефа. Возвращает {t, box|null, x,y,z} или null.
   * Направление (dx,dy,dz) должно быть нормализовано.
   */
  raycast(ox, oy, oz, dx, dy, dz, maxDist, terrain = true) {
    const ex = ox + dx * maxDist,
      ey = oy + dy * maxDist,
      ez = oz + dz * maxDist;
    const tmp = this._tmp2 || (this._tmp2 = []);
    this.query(Math.min(ox, ex) - 0.01, Math.min(oy, ey) - 0.01, Math.min(oz, ez) - 0.01, Math.max(ox, ex) + 0.01, Math.max(oy, ey) + 0.01, Math.max(oz, ez) + 0.01, tmp);
    let bestT = maxDist + 1,
      bestBox = null;
    for (const b of tmp) {
      let t0 = 0,
        t1 = maxDist;
      const o = [ox, oy, oz],
        d = [dx, dy, dz],
        mn = [b.minX, b.minY, b.minZ],
        mx = [b.maxX, b.maxY, b.maxZ];
      let hit = true;
      for (let a = 0; a < 3; a++) {
        if (Math.abs(d[a]) < 1e-9) {
          if (o[a] < mn[a] || o[a] > mx[a]) {
            hit = false;
            break;
          }
        } else {
          let ta = (mn[a] - o[a]) / d[a],
            tb = (mx[a] - o[a]) / d[a];
          if (ta > tb) [ta, tb] = [tb, ta];
          if (ta > t0) t0 = ta;
          if (tb < t1) t1 = tb;
          if (t0 > t1) {
            hit = false;
            break;
          }
        }
      }
      if (hit && t0 < bestT) {
        bestT = t0;
        bestBox = b;
      }
    }
    if (terrain && this.groundFn) {
      const step = 0.75;
      const lim = Math.min(bestT, maxDist);
      for (let t = 0; t <= lim; t += step) {
        const py = oy + dy * t;
        if (py < this.groundFn(ox + dx * t, oz + dz * t)) {
          if (t < bestT) {
            bestT = t;
            bestBox = null;
          }
          break;
        }
      }
    }
    if (bestT > maxDist) return null;
    return { t: bestT, box: bestBox, x: ox + dx * bestT, y: oy + dy * bestT, z: oz + dz * bestT };
  }

  /** Есть ли препятствие между двумя точками. */
  blocked(ax, ay, az, bx, by, bz, terrain = false) {
    const dx = bx - ax,
      dy = by - ay,
      dz = bz - az;
    const len = Math.hypot(dx, dy, dz);
    if (len < 0.01) return false;
    return !!this.raycast(ax, ay, az, dx / len, dy / len, dz / len, len, terrain);
  }

  /** Занята ли область телом (для проверки спавна). */
  overlaps(x, y, z, r, h) {
    const tmp = this._tmp3 || (this._tmp3 = []);
    this.query(x - r, y, z - r, x + r, y + h, z + r, tmp);
    return tmp.length > 0;
  }
}
