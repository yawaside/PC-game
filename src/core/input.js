// Ввод: клавиатура, мышь, захват указателя.
// Запасной режим: если захват мыши недоступен (например, превью во фрейме),
// взгляд управляется движением мыши без захвата и стрелками на клавиатуре.
export const DEFAULT_BINDINGS = {
  forward: ['KeyW'],
  back: ['KeyS'],
  left: ['KeyA'],
  right: ['KeyD'],
  jump: ['Space'],
  sprint: ['ShiftLeft', 'ShiftRight'],
  dash: ['KeyQ'],
  grapple: ['KeyF'],
  interact: ['KeyE'],
  heal: ['KeyR'],
  ability1: ['Digit1'],
  ability2: ['Digit2'],
  ability3: ['Digit3'],
  ability4: ['Digit4'],
  ability5: ['Digit5'],
  ability6: ['Digit6'],
  inventory: ['Tab', 'KeyI'],
  quests: ['KeyJ'],
  closePopup: ['KeyX'],
  hidden: ['KeyH'],
  mute: ['KeyM'],
  pause: ['Escape', 'KeyP'],
  confirm: ['Enter', 'Space', 'KeyE'],
  lookLeft: ['ArrowLeft'],
  lookRight: ['ArrowRight'],
  lookUp: ['ArrowUp'],
  lookDown: ['ArrowDown'],
};

const PREVENT = new Set(['Tab', 'Space', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown']);

export class Input {
  constructor(el) {
    this.el = el;
    this.bindings = DEFAULT_BINDINGS;
    this.keys = new Set();
    this.hit = new Set();
    this.released = new Set();
    this.mouse = [false, false, false];
    this.mouseHit = [false, false, false];
    this.mouseReleased = [false, false, false];
    this.dx = 0;
    this.dy = 0;
    this.locked = false;
    this.freeLook = false;
    this.lockFailed = false;
    this.enabled = true; // false — игнорировать ввод геймплея (меню, диалоги)
    this.onLockChange = null;
    this.onAnyKey = null;
    this._typing = () => {
      const a = document.activeElement;
      return a && (a.tagName === 'INPUT' || a.tagName === 'TEXTAREA');
    };

    window.addEventListener('keydown', (e) => this._kd(e));
    window.addEventListener('keyup', (e) => this._ku(e));
    window.addEventListener('blur', () => this.reset());
    el.addEventListener('mousedown', (e) => this._md(e));
    window.addEventListener('mouseup', (e) => this._mu(e));
    window.addEventListener('mousemove', (e) => this._mm(e));
    window.addEventListener('contextmenu', (e) => {
      if (this.locked || e.target === el) e.preventDefault();
    });
    document.addEventListener('pointerlockchange', () => {
      this.locked = document.pointerLockElement === el;
      if (this.locked) this.freeLook = false;
      this.onLockChange?.(this.locked);
    });
    document.addEventListener('pointerlockerror', () => {
      this.lockFailed = true;
      this.freeLook = true;
      this.onLockChange?.(false, true);
    });
  }

  reset() {
    this.keys.clear();
    this.mouse.fill(false);
  }

  requestLock() {
    if (this.locked) return;
    try {
      const p = this.el.requestPointerLock?.();
      if (p && p.catch) {
        p.catch(() => {
          this.lockFailed = true;
          this.freeLook = true;
        });
      }
    } catch {
      this.lockFailed = true;
      this.freeLook = true;
    }
  }

  exitLock() {
    if (document.pointerLockElement) document.exitPointerLock();
  }

  _kd(e) {
    if (this._typing()) return;
    if (PREVENT.has(e.code)) e.preventDefault();
    if (e.repeat) return;
    this.keys.add(e.code);
    this.hit.add(e.code);
    this.onAnyKey?.(e);
  }
  _ku(e) {
    this.keys.delete(e.code);
    this.released.add(e.code);
  }
  _md(e) {
    if (e.button > 2) return;
    this.mouse[e.button] = true;
    this.mouseHit[e.button] = true;
    if (!this.locked && this.enabled && this.lockFailed) this.freeLook = true;
  }
  _mu(e) {
    if (e.button > 2) return;
    this.mouse[e.button] = false;
    this.mouseReleased[e.button] = true;
  }
  _mm(e) {
    if (this.locked || (this.freeLook && this.enabled)) {
      this.dx += e.movementX || 0;
      this.dy += e.movementY || 0;
    }
  }

  /** Действие зажато. */
  act(name) {
    if (!this.enabled) return false;
    const b = this.bindings[name];
    for (let i = 0; i < b.length; i++) if (this.keys.has(b[i])) return true;
    return false;
  }
  /** Действие нажато в этом кадре. */
  actHit(name) {
    if (!this.enabled) return false;
    const b = this.bindings[name];
    for (let i = 0; i < b.length; i++) if (this.hit.has(b[i])) return true;
    return false;
  }
  /** Нажатие независимо от enabled (для меню/диалогов). */
  rawHit(name) {
    const b = this.bindings[name];
    for (let i = 0; i < b.length; i++) if (this.hit.has(b[i])) return true;
    return false;
  }
  codeHit(code) {
    return this.hit.has(code);
  }
  held(button) {
    return this.enabled && this.mouse[button];
  }
  clicked(button) {
    return this.enabled && this.mouseHit[button];
  }
  releasedBtn(button) {
    return this.enabled && this.mouseReleased[button];
  }

  /** Накопленное движение взгляда (пиксели) за кадр. */
  takeLook(dt) {
    let { dx, dy } = this;
    if (this.enabled) {
      const k = 900 * dt;
      if (this.act('lookLeft')) dx -= k;
      if (this.act('lookRight')) dx += k;
      if (this.act('lookUp')) dy -= k * 0.7;
      if (this.act('lookDown')) dy += k * 0.7;
    }
    return { dx, dy };
  }

  endFrame() {
    this.hit.clear();
    this.released.clear();
    this.mouseHit.fill(false);
    this.mouseReleased.fill(false);
    this.dx = 0;
    this.dy = 0;
  }
}
