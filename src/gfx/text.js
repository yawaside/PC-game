import * as THREE from 'three';

// Вывески и подписи в мире: текст рисуется на canvas и превращается в текстуру.
export const FONT = '"Pixelify Sans", "Tahoma", "Verdana", sans-serif';

export async function loadFonts() {
  try {
    await Promise.all([document.fonts.load(`400 24px ${FONT}`, 'Аа Aa'), document.fonts.load(`700 24px ${FONT}`, 'Аа Aa')]);
  } catch {
    /* шрифт не критичен */
  }
}

const cache = new Map();

/**
 * Текстура с текстом. o: {w,h,color,bg,border,size,weight,align,shadow}
 * Многострочность через \n. Результат кешируется по параметрам.
 */
export function textTexture(text, o = {}) {
  const key = JSON.stringify([text, o]);
  if (cache.has(key)) return cache.get(key);
  const w = o.w ?? 512;
  const h = o.h ?? 128;
  const cv = document.createElement('canvas');
  cv.width = w;
  cv.height = h;
  const g = cv.getContext('2d');
  if (o.bg) {
    g.fillStyle = o.bg;
    g.fillRect(0, 0, w, h);
  }
  if (o.border) {
    g.strokeStyle = o.border;
    g.lineWidth = o.borderW ?? 6;
    g.strokeRect(g.lineWidth / 2, g.lineWidth / 2, w - g.lineWidth, h - g.lineWidth);
  }
  const lines = String(text).split('\n');
  const size = o.size ?? Math.min(h / lines.length * 0.72, 64);
  g.font = `${o.weight ?? 700} ${size}px ${FONT}`;
  g.textBaseline = 'middle';
  g.textAlign = o.align ?? 'center';
  const x = g.textAlign === 'center' ? w / 2 : g.textAlign === 'left' ? 16 : w - 16;
  const lh = size * 1.15;
  const y0 = h / 2 - ((lines.length - 1) * lh) / 2;
  lines.forEach((ln, i) => {
    if (o.shadow !== false) {
      g.fillStyle = o.shadow || 'rgba(0,0,0,0.55)';
      g.fillText(ln, x + size * 0.06, y0 + i * lh + size * 0.06);
    }
    g.fillStyle = o.color ?? '#ffffff';
    g.fillText(ln, x, y0 + i * lh);
  });
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  tex.userData.shared = true;
  cache.set(key, tex);
  return tex;
}

/** Плоская вывеска (Mesh). width — ширина в метрах. */
export function makeSign(text, width, o = {}) {
  const w = o.w ?? 512;
  const h = o.h ?? 128;
  const tex = textTexture(text, { ...o, w, h });
  const mat = new THREE.MeshBasicMaterial({
    map: tex,
    transparent: true,
    side: o.double ? THREE.DoubleSide : THREE.FrontSide,
    fog: o.fog ?? true,
    depthWrite: false,
    alphaTest: 0.02,
  });
  const m = new THREE.Mesh(new THREE.PlaneGeometry(width, (width * h) / w), mat);
  m.renderOrder = 2;
  return m;
}

/** Подпись-спрайт, всегда повёрнутая к камере (имена NPC, враги). */
export function makeLabel(text, o = {}) {
  const w = o.w ?? 384;
  const h = o.h ?? 96;
  const tex = textTexture(text, { size: o.size ?? 44, ...o, w, h });
  const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, fog: false, depthTest: o.depthTest ?? true });
  const s = new THREE.Sprite(mat);
  const width = o.width ?? 2.4;
  s.scale.set(width, (width * h) / w, 1);
  s.renderOrder = 6;
  return s;
}

/** Канвас-текстура с произвольной отрисовкой (часы, экраны терминалов). */
export function canvasTexture(w, h, draw) {
  const cv = document.createElement('canvas');
  cv.width = w;
  cv.height = h;
  const g = cv.getContext('2d');
  draw(g, w, h);
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.userData.canvas = cv;
  return tex;
}

/** Радиальный градиент для «ореолов» вокруг огней. */
let haloTex = null;
export function haloTexture() {
  if (haloTex) return haloTex;
  haloTex = canvasTexture(64, 64, (g, w, h) => {
    const grd = g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
    grd.addColorStop(0, 'rgba(255,255,255,1)');
    grd.addColorStop(0.35, 'rgba(255,255,255,0.35)');
    grd.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grd;
    g.fillRect(0, 0, w, h);
  });
  haloTex.userData.shared = true;
  return haloTex;
}

/** Светящийся ореол-спрайт. */
export function makeHalo(color, size = 3, opacity = 0.8) {
  const m = new THREE.SpriteMaterial({ map: haloTexture(), color, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false, fog: false });
  const s = new THREE.Sprite(m);
  s.scale.set(size, size, 1);
  s.renderOrder = 3;
  return s;
}
