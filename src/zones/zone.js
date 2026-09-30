import * as THREE from 'three';
import { MeshBuilder } from '../gfx/meshbuilder.js';
import { CollisionWorld } from '../physics/collision.js';
import { makeTerrain } from '../gfx/terrain.js';
import { makeSign, makeLabel, makeHalo } from '../gfx/text.js';
import { basic } from '../gfx/materials.js';
import { makeRng } from '../core/rng.js';

/**
 * Зона — один «биом» мира. Модуль зоны вызывает методы этого класса, чтобы описать
 * геометрию и содержимое; сами сущности создаёт EntityManager после входа в зону.
 */
export class Zone {
  constructor(game, def) {
    this.game = game;
    this.def = def;
    this.id = def.id;
    this.name = def.name;
    this.group = new THREE.Group();
    this.b = new MeshBuilder();
    this.world = new CollisionWorld(def.cell ?? 6);
    this.rng = makeRng(game.seedFor(def.id));
    this.spawns = { default: { x: 0, y: 1, z: 0, yaw: 0 } };
    this.portals = [];
    this.interacts = [];
    this.anchors = [];
    this.npcDefs = [];
    this.enemyDefs = [];
    this.pickupDefs = [];
    this.targetDefs = [];
    this.updaters = [];
    this.animated = [];
    this.platforms = [];
    this.destructibles = [];
    this.checkpoints = [];
    this.dynamicMeshes = [];
    this.speedAt = null;
    this.voidY = def.voidY;
    this.waterY = null;
    this.radarWalls = null;
    this.nav = null;
    this.disposables = [];
    this.terrainFn = null;
    this.t = 0;
    this.extra = {};
  }

  // ------------------------------------------------------------------ геометрия
  add(obj) {
    this.group.add(obj);
    return obj;
  }

  /** Рельеф по функции высоты. colorFn(x,z,y,ny)->hex. */
  terrain(o) {
    this.terrainFn = o.height;
    this.world.groundFn = o.height;
    const mesh = makeTerrain(o);
    this.group.add(mesh);
    return mesh;
  }

  /** Плоская земля без рельефа (значение y). */
  flatGround(y = 0) {
    this.world.groundFn = () => y;
    this.terrainFn = () => y;
  }

  bounds(minX, maxX, minZ, maxZ) {
    this.world.bounds = { minX, maxX, minZ, maxZ };
    this.extra.bounds = { minX, maxX, minZ, maxZ };
  }

  spawn(key, x, y, z, yaw = 0) {
    this.spawns[key] = { x, y, z, yaw };
  }

  sign(text, x, y, z, width, yaw = 0, o = {}) {
    const s = makeSign(text, width, o);
    s.position.set(x, y, z);
    s.rotation.y = yaw;
    this.group.add(s);
    return s;
  }

  label(text, x, y, z, o = {}) {
    const s = makeLabel(text, o);
    s.position.set(x, y, z);
    this.group.add(s);
    return s;
  }

  light(x, y, z, color, size = 4, opacity = 0.7) {
    const h = makeHalo(color, size, opacity);
    h.position.set(x, y, z);
    this.group.add(h);
    return h;
  }

  /** Простой меш (не статический): возвращает Mesh, добавленный в зону. */
  mesh(geo, mat, x, y, z, o = {}) {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    if (o.s) m.scale.setScalar(o.s);
    if (o.sx !== undefined) m.scale.set(o.sx, o.sy ?? o.sx, o.sz ?? o.sx);
    if (o.ry) m.rotation.y = o.ry;
    if (o.rx) m.rotation.x = o.rx;
    if (o.rz) m.rotation.z = o.rz;
    this.group.add(m);
    return m;
  }

  /** Анимация по времени: fn(t, dt). */
  animate(fn) {
    this.animated.push(fn);
  }
  onUpdate(fn) {
    this.updaters.push(fn);
  }

  // ------------------------------------------------------------------ контент
  /** Портал-ярлык. to: id зоны, spawn: ключ точки появления. lock(game) -> строка причины | null */
  portal(o) {
    this.portals.push({ w: 2.6, h: 4.2, d: 1.6, yaw: 0, ...o });
    return o;
  }

  interact(o) {
    this.interacts.push({ r: 2.6, ...o });
    return o;
  }

  /** Якорь-гиперссылка для грэппла «Ссылка». */
  anchor(x, y, z, label = 'http://') {
    const g = new THREE.Group();
    g.position.set(x, y, z);
    const s = makeSign(label, 3.4, { w: 384, h: 96, color: '#5b8cff', size: 46, shadow: 'rgba(0,0,0,0.6)', double: true, fog: false });
    // подчёркивание
    const ul = new THREE.Mesh(new THREE.PlaneGeometry(3.0, 0.08), basic(0x5b8cff, { fog: false }));
    ul.position.set(0, -0.55, 0.01);
    g.add(s, ul);
    const halo = makeHalo(0x5b8cff, 4.2, 0.55);
    halo.position.z = -0.05;
    g.add(halo);
    const a = { x, y, z, mesh: g, hot: false, halo, ul, baseY: y };
    this.group.add(g);
    this.anchors.push(a);
    this.animate((t) => {
      g.position.y = a.baseY + Math.sin(t * 1.6 + x) * 0.25;
      a.y = g.position.y;
      const cam = this.game.camera.position;
      g.rotation.y = Math.atan2(cam.x - g.position.x, cam.z - g.position.z);
      const k = a.hot ? 1.35 : 1;
      g.scale.setScalar(g.scale.x + (k - g.scale.x) * 0.2);
      halo.material.opacity = a.hot ? 0.95 : 0.5;
    });
    return a;
  }

  npc(id, x, z, yaw = 0, o = {}) {
    this.npcDefs.push({ id, x, z, yaw, ...o });
  }
  enemy(type, x, z, o = {}) {
    this.enemyDefs.push({ type, x, z, ...o });
  }
  /** Группа врагов вокруг точки. */
  pack(type, cx, cz, n, radius = 6, o = {}) {
    for (let i = 0; i < n; i++) {
      const a = this.rng.range(0, Math.PI * 2);
      const r = Math.sqrt(this.rng.next()) * radius;
      this.enemyDefs.push({ type, x: cx + Math.cos(a) * r, z: cz + Math.sin(a) * r, ...o });
    }
  }
  pickup(kind, x, y, z, o = {}) {
    this.pickupDefs.push({ kind, x, y, z, ...o });
  }
  /** Цель, по которой можно бить (кристаллы, замки, пилоны). */
  target(o) {
    this.targetDefs.push(o);
  }

  /** Сундук-архив: loot = таблица или список [id,n]. id — для сохранения «уже открыт». */
  chest(id, x, y, z, o = {}) {
    this.pickupDefs.push({ kind: 'chest', chestId: id, x, y, z, ...o });
  }

  /** Скрытый файл (коллекционный). Виден только при включённом «показе скрытых файлов». */
  hiddenFile(id, x, y, z) {
    this.pickupDefs.push({ kind: 'hidden', hiddenId: id, x, y, z });
  }

  /** Точка восстановления (сохранение/отдых). */
  checkpoint(x, y, z, id = null) {
    this.checkpoints.push({ x, y, z, id: id || `${this.id}_${this.checkpoints.length}` });
  }

  /** Движущаяся платформа. path: [[x,y,z],...] (пинг-понг). Возвращает объект платформы. */
  movingPlatform(o) {
    const { x, y, z, sx, sy, sz, path, speed = 3, color = 0x8899aa, top } = o;
    const geo = new THREE.BoxGeometry(sx, sy, sz);
    const mat = new THREE.MeshLambertMaterial({ color, flatShading: true });
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    this.group.add(m);
    if (top !== undefined) {
      const cap = new THREE.Mesh(new THREE.BoxGeometry(sx * 0.96, 0.08, sz * 0.96), basic(top));
      cap.position.y = sy / 2 + 0.03;
      m.add(cap);
    }
    const box = this.world.addDynamic({ minX: x - sx / 2, maxX: x + sx / 2, minY: y - sy / 2, maxY: y + sy / 2, minZ: z - sz / 2, maxZ: z + sz / 2 });
    const pts = path || [[x, y, z]];
    const plat = { box, mesh: m, pts, speed, seg: 0, t: 0, dir: 1, x, y, z, wait: o.wait ?? 0.6, waitT: 0, stop: false };
    this.platforms.push(plat);
    return plat;
  }

  /** Разрушаемый блок (червяки едят платформы). */
  destructible(x, y, z, sx, sy, sz, color = 0x6a7a66) {
    const geo = new THREE.BoxGeometry(sx, sy, sz);
    const mat = new THREE.MeshLambertMaterial({ color, flatShading: true });
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    this.group.add(m);
    const box = this.world.addDynamic({ minX: x - sx / 2, maxX: x + sx / 2, minY: y - sy / 2, maxY: y + sy / 2, minZ: z - sz / 2, maxZ: z + sz / 2 });
    const d = { x, y, z, sx, sy, sz, box, mesh: m, hp: 100, max: 100, alive: true, respawn: 0 };
    this.destructibles.push(d);
    return d;
  }

  // ------------------------------------------------------------------ завершение
  finish() {
    const built = this.b.build();
    this.group.add(built);
    this.world.addAll(this.b.colliders);
    this.group.updateMatrixWorld(true);
  }

  /** Обновление динамики зоны (вызывается Game каждый кадр в режиме игры). */
  update(dt) {
    this.t += dt;
    for (const a of this.animated) a(this.t, dt);
    for (const u of this.updaters) u(dt, this);
    // движущиеся платформы
    for (const p of this.platforms) {
      let dx = 0, dy = 0, dz = 0;
      if (p.pts.length > 1 && !p.stop) {
        if (p.waitT > 0) p.waitT -= dt;
        else {
          const a = p.pts[p.seg], b = p.pts[p.seg + p.dir];
          const len = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]) || 1;
          p.t += (p.speed * dt) / len;
          if (p.t >= 1) {
            p.t = 0;
            p.seg += p.dir;
            if (p.seg + p.dir < 0 || p.seg + p.dir >= p.pts.length) {
              p.dir *= -1;
              p.waitT = p.wait;
            }
          }
          const a2 = p.pts[p.seg], b2 = p.pts[Math.max(0, Math.min(p.pts.length - 1, p.seg + p.dir))];
          const nx = a2[0] + (b2[0] - a2[0]) * p.t, ny = a2[1] + (b2[1] - a2[1]) * p.t, nz = a2[2] + (b2[2] - a2[2]) * p.t;
          dx = nx - p.x; dy = ny - p.y; dz = nz - p.z;
          p.x = nx; p.y = ny; p.z = nz;
        }
      }
      this.world.translate(p.box, dx, dy, dz);
      p.mesh.position.set(p.x, p.y, p.z);
    }
    // разрушаемые блоки
    for (const d of this.destructibles) {
      if (!d.alive) {
        d.respawn -= dt;
        if (d.respawn <= 0) {
          d.alive = true; d.hp = d.max; d.box.enabled = true; d.mesh.visible = true; d.mesh.scale.setScalar(1);
        }
      } else if (d.hp < d.max) {
        d.mesh.scale.y = 0.4 + 0.6 * (d.hp / d.max);
        d.mesh.material.emissive?.setHex(0x330000);
      }
    }
  }

  dispose() {
    this.group.traverse((o) => {
      if (o.isMesh || o.isSprite || o.isPoints) {
        if (o.geometry && (o.userData.ownGeometry || !o.geometry.userData?.shared)) {
          // геометрии из GEO — общие, их не трогаем
          if (o.userData.ownGeometry) o.geometry.dispose();
        }
        const m = o.material;
        if (m && o.userData.ownMaterial) m.dispose?.();
      }
    });
    for (const d of this.disposables) d.dispose?.();
  }
}
