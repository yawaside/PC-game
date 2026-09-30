// Универсальное тело с AABB-коллизией: игрок, враги, союзники, дропы.
// Позиция (x,y,z) — центр основания. Разрешение по осям X → Z → Y.
const EPS = 1e-3;
const tmp = [];
const tmp2 = [];

export function makeBody(r = 0.36, h = 1.8, step = 0.6) {
  return {
    x: 0, y: 0, z: 0,
    vx: 0, vy: 0, vz: 0,
    r, h, step,
    snap: 0.4,
    grounded: false, wasGrounded: false,
    inv: false, // гравитация перевёрнута (BSOD)
    fly: false, // не использует рельеф
    hitWall: false, hitHead: false,
    platform: null, ride: null,
    stepDelta: 0,
  };
}

function overlapXZ(b, x, z, box) {
  return x + b.r > box.minX + EPS && x - b.r < box.maxX - EPS && z + b.r > box.minZ + EPS && z - b.r < box.maxZ - EPS;
}

function headroom(w, b, x, y, z) {
  w.query(x - b.r, y, z - b.r, x + b.r, y + b.h, z + b.r, tmp2);
  for (let i = 0; i < tmp2.length; i++) {
    const c = tmp2[i];
    if (c.maxY <= y + EPS || c.minY >= y + b.h - EPS) continue;
    if (overlapXZ(b, x, z, c)) return false;
  }
  return true;
}

function collideAxis(b, w, axis, d) {
  if (d === 0) return;
  let nx = b.x,
    nz = b.z;
  if (axis === 0) nx += d;
  else nz += d;

  // слишком крутой рельеф = стена
  if (!b.inv && !b.fly && w.groundFn) {
    const gNew = w.groundFn(nx, nz);
    if (gNew > b.y + b.step + 0.02 && gNew > w.groundFn(b.x, b.z) + 0.01) {
      if (axis === 0) b.vx = 0;
      else b.vz = 0;
      b.hitWall = true;
      return;
    }
  }

  w.query(nx - b.r, b.y, nz - b.r, nx + b.r, b.y + b.h, nz + b.r, tmp);
  for (let i = 0; i < tmp.length; i++) {
    const box = tmp[i];
    if (b.y + b.h <= box.minY + EPS || b.y >= box.maxY - EPS) continue;
    if (!overlapXZ(b, nx, nz, box)) continue;
    // ступенька
    const rise = box.maxY - b.y;
    if (!b.inv && !b.fly && (b.grounded || b.wasGrounded) && rise > EPS && rise <= b.step && headroom(w, b, nx, box.maxY + EPS, nz)) {
      b.stepDelta += rise;
      b.y = box.maxY;
      b.grounded = true;
      continue;
    }
    if (axis === 0) {
      nx = d > 0 ? box.minX - b.r - EPS : box.maxX + b.r + EPS;
      b.vx = 0;
    } else {
      nz = d > 0 ? box.minZ - b.r - EPS : box.maxZ + b.r + EPS;
      b.vz = 0;
    }
    b.hitWall = true;
  }
  b.x = nx;
  b.z = nz;
}

function collideY(b, w, dy) {
  const prevY = b.y;
  b.y += dy;
  const lo = Math.min(prevY, b.y),
    hi = Math.max(prevY, b.y) + b.h;
  w.query(b.x - b.r, lo, b.z - b.r, b.x + b.r, hi, b.z + b.r, tmp);
  for (let i = 0; i < tmp.length; i++) {
    const box = tmp[i];
    if (!overlapXZ(b, b.x, b.z, box)) continue;
    if (b.y + b.h <= box.minY + EPS || b.y >= box.maxY - EPS) continue;
    const tol = 0.06 + Math.abs(box.dy || 0) + 0.03;
    if (!b.inv) {
      if (prevY >= box.maxY - tol) {
        b.y = box.maxY;
        if (b.vy < 0) b.vy = 0;
        b.grounded = true;
        b.platform = box.dyn ? box : null;
      } else if (prevY + b.h <= box.minY + tol) {
        b.y = box.minY - b.h - EPS;
        if (b.vy > 0) b.vy = 0;
        b.hitHead = true;
      }
    } else if (prevY + b.h <= box.minY + tol) {
      b.y = box.minY - b.h - EPS;
      if (b.vy > 0) b.vy = 0;
      b.grounded = true;
      b.platform = box.dyn ? box : null;
    } else if (prevY >= box.maxY - tol) {
      b.y = box.maxY;
      if (b.vy < 0) b.vy = 0;
      b.hitHead = true;
    }
  }
  if (!b.inv && !b.fly && w.groundFn) {
    const gy = w.groundFn(b.x, b.z);
    if (b.y < gy) {
      b.y = gy;
      if (b.vy < 0) b.vy = 0;
      b.grounded = b.vy <= 0.0001;
      b.platform = null;
    }
  }
}

/** Вытолкнуть тело, если оно оказалось внутри коллайдера (динамические блоки и т.п.). */
function depenetrate(b, w) {
  w.query(b.x - b.r, b.y + 0.02, b.z - b.r, b.x + b.r, b.y + b.h - 0.02, b.z + b.r, tmp);
  for (let i = 0; i < tmp.length; i++) {
    const box = tmp[i];
    if (!overlapXZ(b, b.x, b.z, box)) continue;
    const up = box.maxY - b.y;
    const down = b.y + b.h - box.minY;
    const l = b.x + b.r - box.minX;
    const r = box.maxX - (b.x - b.r);
    const n = b.z + b.r - box.minZ;
    const f = box.maxZ - (b.z - b.r);
    const m = Math.min(up, down, l, r, n, f);
    if (m === up && up < 1.2) b.y = box.maxY;
    else if (m === l) b.x = box.minX - b.r - EPS;
    else if (m === r) b.x = box.maxX + b.r + EPS;
    else if (m === n) b.z = box.minZ - b.r - EPS;
    else if (m === f) b.z = box.maxZ + b.r + EPS;
    else if (m === down) b.y = box.minY - b.h - EPS;
  }
}

/** Один шаг движения. Гравитацию применяет вызывающий код. */
export function moveBody(b, dt, w) {
  b.wasGrounded = b.grounded;
  b.grounded = false;
  b.hitWall = false;
  b.hitHead = false;
  b.platform = null;
  b.stepDelta = 0;

  const p = b.ride;
  if (p && p.enabled && p.dyn) {
    b.x += p.dx;
    b.y += p.dy;
    b.z += p.dz;
  }

  // не даём проскочить сквозь тонкие стены на больших скоростях
  const maxMove = Math.max(Math.abs(b.vx), Math.abs(b.vz)) * dt;
  const n = Math.max(1, Math.min(6, Math.ceil(maxMove / 0.45)));
  const sdt = dt / n;
  for (let i = 0; i < n; i++) {
    collideAxis(b, w, 0, b.vx * sdt);
    collideAxis(b, w, 2, b.vz * sdt);
  }
  collideY(b, w, b.vy * dt);

  // прилипание к земле при спуске по склонам и лестницам
  if (!b.grounded && b.wasGrounded && !b.fly && (b.inv ? b.vy >= -0.001 : b.vy <= 0.001)) {
    if (!b.inv) {
      const fl = w.floorBelow(b.x, b.y, b.z, b.r * 0.8, b.snap + 0.1);
      if (fl > -1e8 && b.y - fl <= b.snap && b.y - fl > 0) {
        b.y = fl;
        b.vy = 0;
        b.grounded = true;
      }
    }
  }
  depenetrate(b, w);

  if (w.bounds) {
    const bd = w.bounds;
    if (b.x < bd.minX) b.x = bd.minX, (b.vx = Math.max(0, b.vx));
    if (b.x > bd.maxX) b.x = bd.maxX, (b.vx = Math.min(0, b.vx));
    if (b.z < bd.minZ) b.z = bd.minZ, (b.vz = Math.max(0, b.vz));
    if (b.z > bd.maxZ) b.z = bd.maxZ, (b.vz = Math.min(0, b.vz));
  }
  b.ride = b.platform;
}

/** Телепорт-рывок по прямой с проверкой столкновений; возвращает пройденное расстояние. */
export function sweepBody(b, w, dirX, dirZ, dist) {
  const sx = b.x,
    sz = b.z;
  const step = 0.4;
  let moved = 0;
  const vy0 = b.vy;
  while (moved < dist - 1e-4) {
    const d = Math.min(step, dist - moved);
    const px = b.x,
      pz = b.z;
    b.vx = dirX * d * 1000;
    b.vz = dirZ * d * 1000;
    b.vy = 0;
    moveBody(b, 0.001, w);
    const got = Math.hypot(b.x - px, b.z - pz);
    moved += d;
    if (got < d * 0.5) break;
  }
  b.vy = vy0;
  return Math.hypot(b.x - sx, b.z - sz);
}
