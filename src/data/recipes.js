// Рецепты Архиватора: мусор → .zip-контейнеры.
export const RECIPES_ARCHIVER = [
  { out: 'heal_zip', n: 1, req: { tmp: 3, log: 1 } },
  { out: 'ram_zip', n: 1, req: { log: 2, bak: 2 } },
  { out: 'cpu_zip', n: 1, req: { bak: 2, chk: 2, tmp: 1 } },
  { out: 'bw_zip', n: 1, req: { tmp: 3, chk: 2 } },
  { out: 'shield_zip', n: 1, req: { chk: 4, bak: 2, log: 1 } },
  { out: 'heal_zip', n: 3, req: { tmp: 8, log: 3, bak: 1 } },
];
