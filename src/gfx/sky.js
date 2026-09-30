import * as THREE from 'three';

// Небо = «обои» рабочего стола. Параметры плавно перетекают (настроение системы).
const vert = /* glsl */ `
  varying vec3 vDir;
  void main() {
    vDir = normalize(position);
    vec4 p = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * p;
    gl_Position.z = gl_Position.w; // всегда на дальней плоскости
  }
`;

const frag = /* glsl */ `
  uniform vec3 uTop; uniform vec3 uMid; uniform vec3 uBot;
  uniform vec3 uSun; uniform vec3 uSunCol; uniform float uSunSize; uniform float uStripes;
  uniform vec3 uCloudCol; uniform float uClouds; uniform float uStars;
  uniform float uTime; uniform float uCrack; uniform float uGlitch; uniform float uGrid;
  varying vec3 vDir;

  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float noise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y);
  }
  float fbm(vec2 p) {
    float v = 0.0, a = 0.5;
    for (int i = 0; i < 4; i++) { v += a * noise(p); p *= 2.03; a *= 0.5; }
    return v;
  }

  void main() {
    vec3 d = normalize(vDir);
    float h = d.y;
    vec3 col = h > 0.0 ? mix(uMid, uTop, pow(h, 0.5)) : mix(uMid, uBot, pow(-h, 0.45));

    // солнце
    float sd = max(dot(d, uSun), 0.0);
    float disc = smoothstep(uSunSize, uSunSize + 0.0025, sd);
    if (uStripes > 0.5) {
      // полосы ретровейв-солнца
      float y = (d.y - uSun.y) * 40.0;
      float cut = step(0.0, sin(y * 3.0 + 1.0) + (y + 1.0) * 0.6);
      disc *= mix(1.0, cut, step(d.y, uSun.y + 0.12));
    }
    col = mix(col, uSunCol, disc);
    col += uSunCol * pow(sd, 18.0) * 0.45 + uSunCol * pow(sd, 4.0) * 0.12;

    // облака
    if (uClouds > 0.0 && h > 0.0) {
      vec2 uv = d.xz / (h + 0.18) * 1.15 + vec2(uTime * 0.012, uTime * 0.004);
      float c = fbm(uv);
      c = smoothstep(0.48, 0.78, c) * uClouds * smoothstep(0.0, 0.22, h);
      col = mix(col, uCloudCol, c);
    }
    // звёзды
    if (uStars > 0.0 && h > 0.0) {
      vec2 sp = floor(d.xz / (h + 0.3) * 90.0);
      float s = step(0.992, hash(sp)) * (0.5 + 0.5 * sin(uTime * 2.0 + hash(sp + 3.0) * 20.0));
      col += vec3(s) * uStars * smoothstep(0.0, 0.3, h);
    }
    // сетка (ретровейв-горизонт)
    if (uGrid > 0.0 && h < 0.0) {
      vec2 gp = d.xz / (-h + 0.02);
      vec2 g = abs(fract(gp * 0.5 + vec2(0.0, uTime * 0.3)) - 0.5);
      float line = 1.0 - smoothstep(0.0, 0.04 + 0.06 * (-h), min(g.x, g.y));
      col += uSunCol * line * uGrid * smoothstep(0.0, 0.35, -h) * 0.6;
    }
    // трещины «Великого Обновления»
    if (uCrack > 0.0) {
      vec2 cp = d.xz / (abs(h) + 0.25) * 3.0 + d.y * 2.0;
      float cr = abs(noise(cp * 1.7) - 0.5);
      float line = 1.0 - smoothstep(0.0, 0.018, cr);
      col = mix(col, vec3(1.0, 0.25, 0.3), line * uCrack);
      col *= 1.0 - 0.25 * uCrack;
    }
    // глитч-полосы
    if (uGlitch > 0.0) {
      float band = step(0.93, hash(vec2(floor(d.y * 40.0), floor(uTime * 6.0))));
      col = mix(col, col.bgr * 1.4, band * uGlitch);
    }
    gl_FragColor = vec4(col, 1.0);
    #include <colorspace_fragment>
  }
`;

const C = (hex) => new THREE.Color(hex);

export const SKY_PRESETS = {
  desktop: { top: 0x2f7fe0, mid: 0xbfe6ff, bot: 0x6fae5a, sun: 0xfff4c2, clouds: 0.9, cloudCol: 0xffffff, stars: 0 },
  faded: { top: 0x5a7a9c, mid: 0xb8c4cc, bot: 0x6b7f63, sun: 0xe8e2c8, clouds: 0.8, cloudCol: 0xdde3e8, stars: 0 },
};

export class Sky {
  constructor() {
    const geo = new THREE.SphereGeometry(800, 32, 18);
    this.uniforms = {
      uTop: { value: C(0x2f7fe0) },
      uMid: { value: C(0xbfe6ff) },
      uBot: { value: C(0x6fae5a) },
      uSun: { value: new THREE.Vector3(0.4, 0.5, -0.6).normalize() },
      uSunCol: { value: C(0xfff4c2) },
      uSunSize: { value: 0.9985 },
      uStripes: { value: 0 },
      uCloudCol: { value: C(0xffffff) },
      uClouds: { value: 0.8 },
      uStars: { value: 0 },
      uTime: { value: 0 },
      uCrack: { value: 0 },
      uGlitch: { value: 0 },
      uGrid: { value: 0 },
    };
    this.mat = new THREE.ShaderMaterial({
      vertexShader: vert,
      fragmentShader: frag,
      uniforms: this.uniforms,
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
    });
    this.mesh = new THREE.Mesh(geo, this.mat);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = -10;
    this.target = {};
    this.colors = ['uTop', 'uMid', 'uBot', 'uSunCol', 'uCloudCol'];
    this.scalars = ['uSunSize', 'uStripes', 'uClouds', 'uStars', 'uCrack', 'uGlitch', 'uGrid'];
  }

  /** Мгновенно применить пресет. p: {top, mid, bot, sun, sunDir:[x,y,z], clouds, cloudCol, stars, stripes, sunSize, grid} */
  apply(p, instant = true) {
    const t = {
      uTop: C(p.top ?? 0x2f7fe0),
      uMid: C(p.mid ?? 0xbfe6ff),
      uBot: C(p.bot ?? p.mid ?? 0x6fae5a),
      uSunCol: C(p.sun ?? 0xfff4c2),
      uCloudCol: C(p.cloudCol ?? 0xffffff),
      uSunSize: p.sunSize ?? 0.9985,
      uStripes: p.stripes ?? 0,
      uClouds: p.clouds ?? 0,
      uStars: p.stars ?? 0,
      uCrack: p.crack ?? 0,
      uGlitch: p.glitch ?? 0,
      uGrid: p.grid ?? 0,
    };
    if (p.sunDir) this.uniforms.uSun.value.set(...p.sunDir).normalize();
    this.target = t;
    if (instant) {
      for (const k of this.colors) this.uniforms[k].value.copy(t[k]);
      for (const k of this.scalars) this.uniforms[k].value = t[k];
    }
  }

  /** Тонкая подстройка цели (настроение системы). */
  tint(key, val) {
    if (this.target[key] === undefined) return;
    if (this.target[key].isColor) this.target[key].set(val);
    else this.target[key] = val;
  }

  update(dt, camPos) {
    this.uniforms.uTime.value += dt;
    this.mesh.position.copy(camPos);
    const k = 1 - Math.exp(-2.2 * dt);
    for (const c of this.colors) if (this.target[c]) this.uniforms[c].value.lerp(this.target[c], k);
    for (const s of this.scalars) if (this.target[s] !== undefined) this.uniforms[s].value += (this.target[s] - this.uniforms[s].value) * k;
  }
}
