// Крошечная шина событий: игровые системы общаются через неё (квесты, HUD, музыка).
export class Emitter {
  constructor() {
    this.map = new Map();
  }
  on(evt, fn) {
    let set = this.map.get(evt);
    if (!set) this.map.set(evt, (set = new Set()));
    set.add(fn);
    return () => set.delete(fn);
  }
  off(evt, fn) {
    this.map.get(evt)?.delete(fn);
  }
  emit(evt, ...args) {
    const set = this.map.get(evt);
    if (!set) return;
    for (const fn of [...set]) {
      try {
        fn(...args);
      } catch (e) {
        console.error(`[event ${evt}]`, e);
      }
    }
  }
  clear() {
    this.map.clear();
  }
}
