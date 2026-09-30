import * as THREE from 'three';
import { basic } from '../gfx/materials.js';
import { makeHalo } from '../gfx/text.js';

const geoBolt = new THREE.BoxGeometry(0.22, 0.22, 0.7);
const geoOrb = new THREE.IcosahedronGeometry(0.3, 0);
const geoPopup = new THREE.PlaneGeometry(0.9, 0.68);

/**
 * Снаряд. owner: 'enemy' | 'player'.
 * type: 'bolt' (быстрый заряд), 'orb' (шар), 'popup' (рекламное окно), 'coin', 'data'.
 */
export class Projectile {
  constructor(ents, o) {
    this.ents = ents;
    this.game = ents.game;
    this.x = o.x; this.y = o.y; this.z = o.z;
    this.vx = o.vx; this.vy = o.vy; this.vz = o.vz;
    this.dmg = o.dmg ?? 8;
    this.r = o.r ?? 0.35;
    this.life = o.life ?? 4;
    this.owner = o.owner || 'enemy';
    this.type = o.type || 'bolt';
    this.color = o.color ?? 0xff5050;
    this.grav = o.grav ?? 0;
    this.homing = o.homing ?? 0;
    this.by = o.by || '';
    this.from = o.from || null;
    this.knock = o.knock ?? 4;
    this.onHit = o.onHit || null;
    this.ramDrain = o.ramDrain ?? 0;
    this.reflected = false;
    this.dead = false;
    this.slow = 1;
    this.trail = 0;
    this.radius = o.aoe || 0;
    const g = new THREE.Group();
    let mesh;
    if (this.type === 'popup') {
      mesh = new THREE.Mesh(geoPopup, ents.popupMat());
      this.spin = 6;
    } else if (this.type === 'bolt') mesh = new THREE.Mesh(geoBolt, basic(this.color, { fog: true }));
    else mesh = new THREE.Mesh(geoOrb, basic(this.color, { fog: true }));
    g.add(mesh);
    if (this.type !== 'popup') {
      const h = makeHalo(this.color, 1.6, 0.6);
      g.add(h);
    }
    this.mesh = mesh;
    this.group = g;
    g.position.set(this.x, this.y, this.z);
    ents.group.add(g);
  }

  reflect(toward) {
    this.owner = 'player';
    this.reflected = true;
    const sp = Math.hypot(this.vx, this.vy, this.vz) * 1.2;
    let dx = 0, dy = 0, dz = 0;
    if (toward) { dx = toward.x - this.x; dy = toward.cy - this.y; dz = toward.z - this.z; }
    else { dx = -this.vx; dy = -this.vy; dz = -this.vz; }
    const l = Math.hypot(dx, dy, dz) || 1;
    this.vx = (dx / l) * sp; this.vy = (dy / l) * sp; this.vz = (dz / l) * sp;
    this.dmg *= 2.5;
    this.color = 0x7fe9ff;
    if (this.mesh.material && this.type !== 'popup') this.mesh.material = basic(0x7fe9ff, { fog: true });
    this.life = Math.max(this.life, 2.5);
  }

  kill(spark = true) {
    if (this.dead) return;
    this.dead = true;
    if (spark) this.game.fx.burst(this.x, this.y, this.z, 6, { speed: 3, size: 0.14, color: this.color, glow: true, life: 0.3 });
  }

  update(dt) {
    const g = this.game;
    const p = g.player;
    const s = dt * this.slow;
    this.life -= dt;
    if (this.life <= 0) return this.kill(false);
    // наведение
    if (this.homing > 0 && this.owner === 'enemy') {
      const dx = p.x - this.x, dy = p.center - this.y, dz = p.z - this.z;
      const l = Math.hypot(dx, dy, dz) || 1;
      const sp = Math.hypot(this.vx, this.vy, this.vz);
      const k = Math.min(1, this.homing * s);
      this.vx += (dx / l * sp - this.vx) * k; this.vy += (dy / l * sp - this.vy) * k; this.vz += (dz / l * sp - this.vz) * k;
    }
    if (this.grav) this.vy -= this.grav * s;
    const nx = this.x + this.vx * s, ny = this.y + this.vy * s, nz = this.z + this.vz * s;
    // стены
    const w = g.zone.world;
    const dx = nx - this.x, dy = ny - this.y, dz = nz - this.z;
    const len = Math.hypot(dx, dy, dz);
    if (len > 1e-5) {
      const hit = w.raycast(this.x, this.y, this.z, dx / len, dy / len, dz / len, len + this.r * 0.5, true);
      if (hit) {
        this.x = hit.x; this.y = hit.y; this.z = hit.z;
        if (this.radius) this.explode();
        return this.kill(true);
      }
    }
    this.x = nx; this.y = ny; this.z = nz;
    this.group.position.set(this.x, this.y, this.z);
    if (this.spin) {
      this.mesh.lookAt(g.camera.position);
      this.mesh.rotateZ(Math.sin(g.clockT * 6) * 0.2);
    } else if (this.type === 'bolt') this.mesh.lookAt(this.x + this.vx, this.y + this.vy, this.z + this.vz);
    this.trail -= dt;
    if (this.trail <= 0) {
      this.trail = 0.05;
      g.fx.emit(this.x, this.y, this.z, { vx: 0, vy: 0, vz: 0, life: 0.25, size: 0.14, size1: 0, color: this.color, glow: true });
    }
    if (this.owner === 'enemy') {
      // щит Firewall
      if (g.combat.shieldTest(this)) return;
      // игрок
      const py = p.body.y;
      if (this.y > py - 0.2 && this.y < py + 2.1) {
        const d = Math.hypot(this.x - p.x, this.z - p.z);
        if (d < this.r + 0.42) {
          this.hitPlayer();
          return;
        }
      }
    } else {
      // снаряды игрока / отражённые — по врагам
      for (const e of this.ents.enemies) {
        if (e.dead || e.intangible) continue;
        const d = Math.hypot(this.x - e.x, this.z - e.z);
        if (d < this.r + e.def.r && this.y > e.y - 0.2 && this.y < e.y + e.def.h + 0.3) {
          e.takeHit(this.dmg, { from: { x: this.x, z: this.z }, knock: 5, aoe: true, type: 'reflect', noHitstop: true });
          g.fx.burst(this.x, this.y, this.z, 10, { speed: 4, size: 0.18, color: 0x7fe9ff, glow: true, life: 0.35 });
          return this.kill(true);
        }
      }
    }
  }

  hitPlayer() {
    const g = this.game;
    const p = g.player;
    this.dead = true;
    g.fx.burst(this.x, this.y, this.z, 8, { speed: 3.5, size: 0.16, color: this.color, glow: true, life: 0.35 });
    const dealt = p.hurt(this.dmg, { from: { x: this.x, z: this.z }, knock: this.knock, type: 'proj', by: this.by });
    if (this.ramDrain) p.ram = Math.max(0, p.ram - this.ramDrain);
    this.onHit?.(this, dealt);
  }

  explode() {
    const g = this.game;
    const p = g.player;
    g.fx.burst(this.x, this.y, this.z, 22, { speed: 6, size: 0.25, color: this.color, glow: true, life: 0.5 });
    g.audio.sfx('boom');
    if (Math.hypot(p.x - this.x, p.center - this.y, p.z - this.z) < this.radius && this.owner === 'enemy') {
      p.hurt(this.dmg, { from: { x: this.x, z: this.z }, knock: 8, type: 'blast', by: this.by });
    }
  }

  dispose() {
    this.ents.group.remove(this.group);
    this.group.traverse((o) => {
      if (o.isSprite && o.material) o.material.dispose?.();
    });
  }
}
