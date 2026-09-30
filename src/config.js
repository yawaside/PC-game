// Все «ручки» баланса и управления собраны здесь.
export const CFG = {
  // --- игрок ---
  eye: 1.62,
  radius: 0.36,
  height: 1.8,
  step: 0.6,
  gravity: 31,
  jumpV: 11.4,
  doubleJumpV: 10.4,
  maxFall: 48,
  walk: 7.4,
  sprintMul: 1.42,
  groundAccel: 75,
  airAccel: 26,
  friction: 13,
  coyote: 0.12,
  jumpBuffer: 0.13,
  dashDist: 8.5,
  dashCd: 1.5,
  grappleRange: 62,
  grappleSpeed: 44,
  // --- бой ---
  lightDmg: 12,
  heavyDmg: 32,
  meleeRange: 3.3,
  baseHp: 100,
  baseRam: 50,
  // --- мир ---
  voidY: -60,
  maxDt: 1 / 30,
};

export const STATS = ['cpu', 'ram', 'storage', 'bandwidth'];

export const STAT_INFO = {
  cpu: { name: 'CPU', icon: 'cpu', desc: 'Сила атаки: +10% урона за очко' },
  ram: { name: 'RAM', icon: 'ram', desc: 'Запас программ: +8 к максимуму и быстрее восстановление' },
  storage: { name: 'Storage', icon: 'disk', desc: 'Размер инвентаря: +2 слота за очко' },
  bandwidth: { name: 'Bandwidth', icon: 'net', desc: 'Скорость бега и дальность ударов: +2.5% за очко' },
};

export const VERSION = '0.1.0';
