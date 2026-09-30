import * as THREE from 'three';
import { CFG } from '../config.js';
import { makeBody, moveBody, sweepBody } from '../physics/body.js';
import { clamp, damp, lerp } from '../core/util.js';
import { basic } from '../gfx/materials.js';

const ropeGeo = new THREE.CylinderGeometry(1, 1, 1, 5).rotateX(Math.PI / 2).translate(0, 0, 0.5);

/** Шорткат: контроллер от первого лица. */
export class Player {
  constructor(game) {
    this.game = game;
    this.body = makeBody(CFG.radius, CFG.height, CFG.step);
    this.yaw = 0;
    this.pitch = 0;
    this.roll = 0;
    this.rollTarget = 0;
    this.hp = CFG.baseHp;
    this.ram = CFG.baseRam;
    this.heat = 0;
    this.invuln = 0;
    this.dead = false;
    this.coyote = 0;
    this.jumpBuf = 0;
    this.jumpsUsed = 0;
    this.dashT = 0;
    this.grapple = null;
    this.grappleCd = 0;
    this.aim = null;
    this.bob = 0;
    this.camOff = 0;
    this.landDip = 0;
    this.fovKick = 0;
    this.tilt = 0;
    this.lastSafe = { x: 0, y: 0, z: 0 };
    this.safeT = 0;
    this.stepAcc = 0;
    this.speedNow = 0;
    this.sprinting = false;
    this.slowMul = 1;
    this.overclock = false;
    this.ramDrain = 0;
    this.knock = { x: 0, z: 0 };
    this.eye = new THREE.Vector3();
    this.rope = new THREE.Mesh(ropeGeo, basic(0x5b8cff));
    this.rope.visible = false;
    this.rope.frustumCulled = false;
    this.rope.scale.set(0.035, 0.035, 1);
    this.fwd = new THREE.Vector3();
    this.lastMoveDir = { x: 0, z: -1 };
  }

  get x() { return this.body.x; }
  get y() { return this.body.y; }
  get z() { return this.body.z; }
  /** Точка «груди» для прицеливания врагов. */
  get center() { return this.body.y + CFG.height * 0.55; }

  teleport(x, y, z, yaw = null) {
    const b = this.body;
    b.x = x; b.y = y; b.z = z;
    b.vx = b.vy = b.vz = 0;
    b.ride = null;
    this.grapple = null;
    this.rope.visible = false;
    if (yaw !== null) { this.yaw = yaw; this.pitch = 0; }
    this.lastSafe = { x, y, z };
    this.camOff = 0;
  }

  setInverted(on) {
    this.body.inv = on;
    this.rollTarget = on ? Math.PI : 0;
    this.body.vy = 0;
  }

  forward3(out = this.fwd) {
    const cp = Math.cos(this.pitch);
    return out.set(-Math.sin(this.yaw) * cp, Math.sin(this.pitch), -Math.cos(this.yaw) * cp);
  }
  get eyeY() {
    const b = this.body;
    return b.inv ? b.y + b.h - CFG.eye : b.y + CFG.eye;
  }

  // ------------------------------------------------------------------
  update(dt) {
    const g = this.game;
    const inp = g.input;
    const st = g.stats;
    const b = this.body;
    const zone = g.zone;
    if (!zone) return;
    const world = zone.world;
    const inv = b.inv;
    const flip = inv ? -1 : 1;

    // --- взгляд ---
    const look = inp.takeLook(dt);
    const sens = 0.0021 * g.settings.sens;
    this.yaw -= look.dx * sens * flip;
    this.pitch -= look.dy * sens * flip * (g.settings.invertY ? -1 : 1);
    this.pitch = clamp(this.pitch, -1.52, 1.52);

    // --- ввод движения ---
    let fw = (inp.act('forward') ? 1 : 0) - (inp.act('back') ? 1 : 0);
    let sd = (inp.act('right') ? 1 : 0) - (inp.act('left') ? 1 : 0);
    sd *= flip;
    const sy = Math.sin(this.yaw), cy = Math.cos(this.yaw);
    let wx = -sy * fw + cy * sd;
    let wz = -cy * fw - sy * sd;
    const wl = Math.hypot(wx, wz);
    if (wl > 1) { wx /= wl; wz /= wl; }
    const moving = wl > 0.01;
    if (moving) { this.lastMoveDir.x = wx / Math.max(wl, 1); this.lastMoveDir.z = wz / Math.max(wl, 1); }

    // --- скорость ---
    this.slowMul = zone.speedAt ? zone.speedAt(b.x, b.z, b.y) : 1;
    this.sprinting = inp.act('sprint') && fw > 0 && b.grounded;
    let speed = CFG.walk * st.speedMult * this.slowMul * (this.sprinting ? CFG.sprintMul : 1);
    if (this.overclock) speed *= 1.15;
    if (g.cheats.speed) speed *= 1.5;

    const onBody = !this.grapple;
    if (onBody) {
      const tx = wx * speed, tz = wz * speed;
      const acc = (b.grounded ? CFG.groundAccel : CFG.airAccel) * dt;
      if (moving) {
        let dvx = tx - b.vx, dvz = tz - b.vz;
        const dl = Math.hypot(dvx, dvz);
        if (dl > acc) { dvx *= acc / dl; dvz *= acc / dl; }
        b.vx += dvx; b.vz += dvz;
      } else if (b.grounded) {
        const f = Math.exp(-CFG.friction * dt);
        b.vx *= f; b.vz *= f;
      } else {
        const f = Math.exp(-0.6 * dt);
        b.vx *= f; b.vz *= f;
      }
      // отдача от ударов
      b.vx += this.knock.x * dt * 8; b.vz += this.knock.z * dt * 8;
      this.knock.x *= Math.exp(-9 * dt); this.knock.z *= Math.exp(-9 * dt);
    }

    // --- прыжок ---
    if (inp.actHit('jump')) this.jumpBuf = CFG.jumpBuffer;
    else this.jumpBuf -= dt;
    if (b.grounded) { this.coyote = CFG.coyote; this.jumpsUsed = 0; } else this.coyote -= dt;
    const gravMul = g.cheats.moon ? 0.4 : 1;
    if (this.jumpBuf > 0 && !this.grapple) {
      if (this.coyote > 0) {
        b.vy = CFG.jumpV * flip * (g.cheats.moon ? 1.25 : 1);
        b.grounded = false;
        this.coyote = 0; this.jumpBuf = 0; this.jumpsUsed = 1;
        g.audio.sfx('jump');
        g.fx.burst(b.x, inv ? b.y + b.h : b.y + 0.05, b.z, 6, { speed: 1.6, flat: true, size: 0.16, color: 0xe8e8e8, life: 0.35, grav: 2 });
      } else if (st.moves.doubleJump && this.jumpsUsed < 2) {
        b.vy = CFG.doubleJumpV * flip * (g.cheats.moon ? 1.25 : 1);
        this.jumpsUsed = 2; this.jumpBuf = 0;
        g.audio.sfx('djump');
        g.fx.ring(b.x, b.y + (inv ? b.h : 0.1), b.z, 14, 1.4, { glow: true, color: 0x7fe9ff, size: 0.18, life: 0.4, speed: 4.5 });
        g.ui.toastOnce?.('dj', 'Драйвер прыжка v2.0 — двойной прыжок!', 0);
      }
    }
    // короткий прыжок при отпускании
    if (!inp.act('jump') && b.vy * flip > 5 && !this.grapple && this.jumpsUsed > 0) b.vy *= Math.exp(-7 * dt);

    // --- рывок (Буфер обмена) и грэппл (Ссылка) ---
    this.dashT -= dt;
    this.grappleCd -= dt;
    if (inp.actHit('dash')) this.tryDash(wx, wz, moving);
    this.updateAim();
    if (inp.actHit('grapple')) this.tryGrapple();

    // --- гравитация ---
    if (this.grapple) this.updateGrapple(dt);
    else {
      b.vy -= CFG.gravity * gravMul * dt * flip;
      b.vy = clamp(b.vy, -CFG.maxFall, CFG.maxFall);
    }

    const wasGrounded = b.grounded;
    const prevVy = b.vy;
    // движущиеся платформы двигаются в update зоны до вызова этого метода
    moveBody(b, dt, world);
    if (this.grapple && (b.hitWall || b.hitHead)) this.endGrapple(0.4);

    // приземление
    if (!wasGrounded && b.grounded && Math.abs(prevVy) > 9) {
      this.landDip = clamp(Math.abs(prevVy) / 40, 0.05, 0.3);
      g.audio.sfx('land');
      g.fx.burst(b.x, inv ? b.y + b.h : b.y + 0.05, b.z, 8, { speed: 2.2, flat: true, size: 0.18, color: 0xdddddd, life: 0.4, grav: 3 });
    }
    // шаги
    const hv = Math.hypot(b.vx, b.vz);
    this.speedNow = hv;
    if (b.grounded && hv > 1.5) {
      this.stepAcc += hv * dt;
      this.bob += hv * dt * 1.15;
      if (this.stepAcc > 2.6) { this.stepAcc = 0; g.audio.sfx('step'); }
    }

    // безопасная точка для возврата из пустоты
    this.safeT -= dt;
    if (this.safeT <= 0 && b.grounded && !this.grapple) {
      this.safeT = 0.4;
      const f = (dx, dz) => world.floorBelow(b.x + dx, b.y + 0.3, b.z + dz, 0.2, 3) > -1e8;
      if (f(1.3, 0) && f(-1.3, 0) && f(0, 1.3) && f(0, -1.3)) this.lastSafe = { x: b.x, y: b.y, z: b.z };
    }

    // пустота
    const voidY = zone.voidY ?? CFG.voidY;
    if (!inv && b.y < voidY) g.onVoid();
    if (inv && b.y > (zone.ceilingVoid ?? 400)) g.onVoid();

    // --- ресурсы ---
    this.ramDrain = Math.max(0, this.ramDrain - dt * 3);
    if (this.ramDrain <= 0.01) this.ram = Math.min(st.maxRam, this.ram + st.ramRegen * dt);
    this.invuln = Math.max(0, this.invuln - dt);
    st.update(dt);

    // --- камера ---
    this.updateCamera(dt, sd, fw);
  }

  // ------------------------------------------------------------------
  tryDash(wx, wz, moving) {
    const g = this.game;
    const st = g.stats;
    if (!st.moves.dash) return;
    if (this.dashT > 0 || this.grapple) return;
    const b = this.body;
    let dx = wx, dz = wz;
    if (!moving) {
      const f = this.forward3();
      const l = Math.hypot(f.x, f.z) || 1;
      dx = f.x / l; dz = f.z / l;
    } else {
      const l = Math.hypot(dx, dz) || 1;
      dx /= l; dz /= l;
    }
    const sx = b.x, sy = b.y, sz = b.z;
    const moved = sweepBody(b, g.zone.world, dx, dz, CFG.dashDist * (1 + (st.stat('bandwidth') - 5) * 0.02));
    if (moved < 0.6) {
      this.dashT = 0.25;
      g.audio.sfx('error');
      return;
    }
    this.dashT = st.dashCd;
    this.invuln = Math.max(this.invuln, 0.28);
    const sp = CFG.walk * st.speedMult;
    b.vx = dx * sp * 1.1; b.vz = dz * sp * 1.1;
    if (!b.grounded) b.vy = b.inv ? Math.min(b.vy * 0.3, -1) : Math.max(b.vy * 0.3, 1);
    this.fovKick = 1;
    g.audio.sfx('dash');
    g.fx.line(sx, sy + 1.0, sz, b.x, b.y + 1.0, b.z, 34, { glow: true, color: 0x7fe9ff, color1: 0x2a6bff, life: 0.45, size: 0.22, jitter: 1.8 });
    g.ui.clipFlash?.();
    g.events.emit('dash');
  }

  updateAim() {
    this.aim = null;
    const g = this.game;
    const st = g.stats;
    const zone = g.zone;
    for (const a of zone.anchors) a.hot = false;
    if (!st.moves.grapple || this.grapple || !zone.anchors.length) return;
    const f = this.forward3();
    const ex = this.body.x, ey = this.eyeY, ez = this.body.z;
    const range = st.grappleRange;
    let best = null, bestScore = 1e9;
    for (const a of zone.anchors) {
      const dx = a.x - ex, dy = a.y - ey, dz = a.z - ez;
      const d = Math.hypot(dx, dy, dz);
      if (d > range || d < 3) continue;
      const dot = (dx * f.x + dy * f.y + dz * f.z) / d;
      if (dot < 0.955) continue;
      const score = (1 - dot) * 40 + d * 0.01;
      if (score < bestScore) { bestScore = score; best = a; }
    }
    if (best) { this.aim = best; best.hot = true; }
  }

  tryGrapple() {
    const g = this.game;
    if (!g.stats.moves.grapple || this.grapple || this.grappleCd > 0) return;
    if (!this.aim) { g.audio.sfx('error'); return; }
    this.grapple = { a: this.aim, t: 0 };
    this.aim = null;
    this.body.ride = null;
    this.fovKick = 0.6;
    g.audio.sfx('grapple');
    g.events.emit('grapple');
  }

  updateGrapple(dt) {
    const gp = this.grapple;
    const b = this.body;
    const a = gp.a;
    gp.t += dt;
    const cx = b.x, cy = b.y + b.h * 0.5, cz = b.z;
    const dx = a.x - cx, dy = a.y - cy, dz = a.z - cz;
    const d = Math.hypot(dx, dy, dz);
    if (d < 2.6 || gp.t > 2.2) return this.endGrapple(1);
    const sp = CFG.grappleSpeed;
    const k = Math.min(1, 14 * dt);
    b.vx = lerp(b.vx, (dx / d) * sp, k);
    b.vy = lerp(b.vy, (dy / d) * sp, k);
    b.vz = lerp(b.vz, (dz / d) * sp, k);
    if (this.game.input.actHit('jump')) this.endGrapple(1, true);
  }

  endGrapple(keep = 1, jump = false) {
    const b = this.body;
    if (!this.grapple) return;
    this.grapple = null;
    this.grappleCd = 0.35;
    b.vx *= 0.8 * keep; b.vz *= 0.8 * keep;
    b.vy = b.vy * 0.6 * keep + (b.inv ? -4 : 4) * keep;
    this.jumpsUsed = jump ? 1 : 0;
    this.rope.visible = false;
  }

  // ------------------------------------------------------------------
  /** Урон по игроку. o: {from:{x,z}, knock, type, ignoreInvuln, iframes} */
  hurt(amount, o = {}) {
    const g = this.game;
    if (this.dead || g.state !== 'play' || g.cheats.god) return 0;
    if (this.invuln > 0 && !o.ignoreInvuln) return 0;
    let dmg = amount * g.stats.damageTaken;
    dmg = g.combat.filterDamage(dmg, o);
    if (dmg <= 0.01) return 0;
    dmg = Math.max(1, Math.round(dmg));
    this.hp -= dmg;
    this.invuln = o.iframes ?? 0.5;
    g.ui.hurt?.(dmg);
    g.audio.sfx('hurt');
    g.shake(clamp(dmg / 30, 0.25, 1));
    if (o.from && o.knock) {
      const dx = this.body.x - o.from.x, dz = this.body.z - o.from.z;
      const l = Math.hypot(dx, dz) || 1;
      this.knock.x += (dx / l) * o.knock;
      this.knock.z += (dz / l) * o.knock;
    }
    g.events.emit('hurt', dmg);
    if (this.hp <= 0) {
      this.hp = 0;
      g.playerDied(o);
    }
    return dmg;
  }

  heal(n) {
    const mx = this.game.stats.maxHp;
    const before = this.hp;
    this.hp = Math.min(mx, this.hp + n);
    return this.hp - before;
  }

  /** Потратить RAM. Возвращает false, если не хватает. */
  spendRam(n) {
    if (this.game.cheats.ram) return true;
    if (this.ram < n) return false;
    this.ram -= n;
    return true;
  }

  // ------------------------------------------------------------------
  updateCamera(dt, sd, fw) {
    const g = this.game;
    const cam = g.camera;
    const b = this.body;
    this.roll = damp(this.roll, this.rollTarget, 3.2, dt);
    this.landDip = damp(this.landDip, 0, 9, dt);
    this.camOff = damp(this.camOff - b.stepDelta, 0, 14, dt);
    this.fovKick = damp(this.fovKick, 0, 6, dt);
    const bobOn = g.settings.bob;
    const bobAmt = bobOn && b.grounded ? clamp(this.speedNow / 7, 0, 1.3) : 0;
    const by = Math.sin(this.bob * 2) * 0.035 * bobAmt;
    const bx = Math.cos(this.bob) * 0.022 * bobAmt;
    const ey = this.eyeY + (b.inv ? -1 : 1) * (by - this.landDip) + this.camOff;
    const cy = Math.cos(this.yaw), sy = Math.sin(this.yaw);
    cam.position.set(b.x + cy * bx, ey, b.z - sy * bx);
    // тряска
    const sh = g.shakeAmt;
    if (sh > 0.001 && g.settings.shake) {
      cam.position.x += (Math.random() - 0.5) * sh * 0.25;
      cam.position.y += (Math.random() - 0.5) * sh * 0.25;
      cam.position.z += (Math.random() - 0.5) * sh * 0.25;
    }
    this.tilt = damp(this.tilt, -sd * 0.014 - (this.game.combat.swayRoll || 0), 8, dt);
    cam.rotation.order = 'YXZ';
    cam.rotation.set(this.pitch + (sh > 0.001 && g.settings.shake ? (Math.random() - 0.5) * sh * 0.02 : 0), this.yaw, this.roll + this.tilt);
    const sprintK = this.sprinting ? 7 : 0;
    const fov = g.settings.fov + sprintK + this.fovKick * 18 + (this.grapple ? 10 : 0) + (this.overclock ? 4 : 0);
    if (Math.abs(cam.fov - fov) > 0.05) {
      cam.fov = damp(cam.fov, fov, 10, dt);
      cam.updateProjectionMatrix();
    }
    this.eye.copy(cam.position);

    // верёвка грэппла
    if (this.grapple) {
      const a = this.grapple.a;
      const hx = cam.position.x + cy * 0.25 - sy * 0.4, hy = cam.position.y - 0.25, hz = cam.position.z - sy * 0.25 - cy * 0.4;
      this.rope.visible = true;
      this.rope.position.set(hx, hy, hz);
      this.rope.lookAt(a.x, a.y, a.z);
      this.rope.scale.z = Math.hypot(a.x - hx, a.y - hy, a.z - hz);
    }
  }
}
