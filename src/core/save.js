// Сохранения и настройки в localStorage. Любая ошибка хранилища не должна ронять игру.
const SAVE_KEY = 'desktopia.save.v1';
const SETTINGS_KEY = 'desktopia.settings.v1';
const RECORDS_KEY = 'desktopia.records.v1';

const read = (key) => {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};
const write = (key, val) => {
  try {
    localStorage.setItem(key, JSON.stringify(val));
    return true;
  } catch {
    return false;
  }
};

export const Save = {
  exists: () => !!read(SAVE_KEY),
  load: () => read(SAVE_KEY),
  write: (data) => write(SAVE_KEY, data),
  clear: () => {
    try {
      localStorage.removeItem(SAVE_KEY);
    } catch {
      /* ignore */
    }
  },
};

export const DEFAULT_SETTINGS = {
  master: 0.8,
  music: 0.55,
  sfx: 0.9,
  sens: 1,
  fov: 80,
  quality: 'pixel', // pixel | medium | high
  bob: true,
  shake: true,
  popups: true,
  invertY: false,
};

export const Settings = {
  load: () => ({ ...DEFAULT_SETTINGS, ...(read(SETTINGS_KEY) || {}) }),
  write: (s) => write(SETTINGS_KEY, s),
};

export const Records = {
  load: () => read(RECORDS_KEY) || { bestSpeedrun: null, endings: [], runs: 0 },
  write: (r) => write(RECORDS_KEY, r),
};
