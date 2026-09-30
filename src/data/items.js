// Предметы. Файлы — это снаряжение: .exe — оружие, .dll — аксессуары, .sys — броня, .zip — баффы.
// mods: dmg (доля), speed (скорость удара), range, hp, armor, cpu/ram/storage/bandwidth (очки), move (доля),
//       dashCd (доля), grapple (доля), lifesteal, bossDmg.

export const SLOT_NAMES = {
  weapon: 'Оружие (.exe)',
  accessory: 'Аксессуар (.dll)',
  armor: 'Броня (.sys)',
  zip: 'Контейнер (.zip)',
  junk: 'Мусор',
  code: 'Фрагмент кода',
  quest: 'Ключевой файл',
};

export const ITEMS = {
  // ---------------- оружие ----------------
  cursor: { name: 'cursor.cur', slot: 'weapon', tier: 1, color: 0xffffff, w: { dmg: 1, speed: 1, range: 1 }, value: 0, desc: 'Родной курсор-меч Шортката. Указывает путь и направление удара.' },
  notepad: { name: 'notepad.exe', slot: 'weapon', tier: 1, color: 0xffe066, w: { dmg: 1.12, speed: 1, range: 1 }, value: 40, desc: 'Простой, как блокнот. Острый, как слово «Сохранить?»' },
  macro: { name: 'macro.bat', slot: 'weapon', tier: 1, color: 0xb0b0b0, w: { dmg: 1.05, speed: 1.1, range: 1 }, value: 25, convert: { to: 'macro_exe', cost: { bak: 2, tmp: 2 } }, desc: 'Пакетный файл. Делает всё сам, но без изящества. Можно конвертировать в .exe.' },
  cmd: { name: 'cmd.exe', slot: 'weapon', tier: 2, color: 0x222222, w: { dmg: 0.95, speed: 1.28, range: 0.95 }, value: 120, desc: 'Чёрный экран, белые буквы, быстрые удары.' },
  paint: { name: 'paint.exe', slot: 'weapon', tier: 2, color: 0xff5ea8, w: { dmg: 1.2, speed: 1, range: 1.12, fx: 'paint' }, value: 160, desc: 'Заливка — любимый инструмент. Удары брызгают краской.' },
  macro_exe: { name: 'macro.exe', slot: 'weapon', tier: 3, color: 0x70d7ff, w: { dmg: 1.4, speed: 1.12, range: 1.05 }, value: 220, desc: 'Скомпилированный макрос. Всё ещё без изящества, но теперь быстро.' },
  calc: { name: 'calc.exe', slot: 'weapon', tier: 3, color: 0x9ad07a, w: { dmg: 1.5, speed: 0.85, range: 1 }, value: 260, desc: '2+2=4 урона… помноженное на десять. Медленно, но считает верно.' },
  taskmgr: { name: 'taskmgr.exe', slot: 'weapon', tier: 3, color: 0x7fb6ff, w: { dmg: 1.25, speed: 1.05, range: 1, bossDmg: 0.25 }, value: 300, desc: 'Завершает процессы. Особенно непослушные и очень большие.' },
  regedit: { name: 'regedit.exe', slot: 'weapon', tier: 4, color: 0xffb347, w: { dmg: 1.45, speed: 1.1, range: 1.05, crit: 0.15 }, value: 420, desc: 'Правит реальность по ключам. 15% ударов — критические.' },
  ransom: { name: 'ransom.exe', slot: 'weapon', tier: 4, color: 0xff3b5c, w: { dmg: 1.75, speed: 1, range: 1, lifesteal: 0.05 }, value: 0, desc: 'Трофей шифровальщика. Высасывает 5% нанесённого урона в ваше здоровье.' },
  defender: { name: 'defender.exe', slot: 'weapon', tier: 4, color: 0x5ad1ff, w: { dmg: 1.55, speed: 1.05, range: 1.1 }, value: 480, desc: 'Защитник-ветеран. Работает даже без подписки.' },

  // ---------------- аксессуары ----------------
  plugin_ocx: { name: 'plugin.ocx', slot: 'accessory', tier: 1, mods: { ram: 1 }, value: 30, convert: { to: 'plugin_dll', cost: { tmp: 3, log: 1 } }, desc: 'Старый ActiveX-компонент. Можно конвертировать в .dll.' },
  user32: { name: 'user32.dll', slot: 'accessory', tier: 1, mods: { bandwidth: 2 }, value: 60, desc: 'Окна, кнопки, отзывчивость.' },
  gdi32: { name: 'gdi32.dll', slot: 'accessory', tier: 1, mods: { cpu: 2 }, value: 60, desc: 'Рисует всё, включая врагов поменьше.' },
  msvcrt: { name: 'msvcrt.dll', slot: 'accessory', tier: 2, mods: { storage: 3 }, value: 90, desc: 'Среда выполнения. Освобождает место в рюкзаке.' },
  ntdll: { name: 'ntdll.dll', slot: 'accessory', tier: 2, mods: { hp: 25 }, value: 110, desc: 'Ядро ядра. Прибавляет целостности.' },
  plugin_dll: { name: 'plugin.dll', slot: 'accessory', tier: 3, mods: { ram: 3, cpu: 1 }, value: 160, desc: 'Плагин, переставший быть плагином.' },
  d3d9: { name: 'd3d9.dll', slot: 'accessory', tier: 3, mods: { dashCd: -0.3 }, value: 200, desc: 'Ускоряет перезарядку «Буфера обмена» на 30%.' },
  wininet: { name: 'wininet.dll', slot: 'accessory', tier: 3, mods: { grapple: 0.3, bandwidth: 1 }, value: 210, desc: 'Ссылки стали длиннее: дальность «Ссылки» +30%.' },
  mfc42: { name: 'mfc42.dll', slot: 'accessory', tier: 4, mods: { ram: 3, cpu: 3, bandwidth: 1 }, value: 340, desc: 'Библиотека старых классов. Очень классная.' },

  // ---------------- броня ----------------
  skin_bmp: { name: 'skin.bmp', slot: 'armor', tier: 1, mods: { armor: 3 }, value: 40, convert: { to: 'skin_png', cost: { tmp: 3, bak: 1 } }, desc: 'Растровая лёгкая броня. Без сжатия — без защиты от больших проблем.' },
  skin_png: { name: 'skin.png', slot: 'armor', tier: 2, mods: { armor: 7 }, value: 110, convert: { to: 'skin_svg', cost: { bak: 3, chk: 2 } }, desc: 'Сжатая без потерь. Улучшенная броня.' },
  tcpip: { name: 'tcpip.sys', slot: 'armor', tier: 3, mods: { armor: 8, bandwidth: 3 }, value: 240, desc: 'Сетевой стек. Пакеты отскакивают как надо.' },
  hal: { name: 'hal.sys', slot: 'armor', tier: 3, mods: { armor: 11, hp: 20, move: -0.05 }, value: 260, desc: 'Уровень абстракции железа. Тяжеловата.' },
  skin_svg: { name: 'skin.svg', slot: 'armor', tier: 4, mods: { armor: 12, move: 0.03 }, value: 300, desc: 'Векторная броня — масштабируется вместе с проблемами.' },
  ntfs: { name: 'ntfs.sys', slot: 'armor', tier: 4, mods: { armor: 15, hp: 30 }, value: 420, desc: 'Журналируемая файловая броня. Никогда не забывает ударов.' },
  win32k: { name: 'win32k.sys', slot: 'armor', tier: 5, mods: { armor: 19, hp: 40, move: -0.08 }, value: 640, desc: 'Тот самый драйвер, что роняет системы. Теперь — вас не уронит.' },

  // ---------------- архивы (расходники) ----------------
  heal_zip: { name: 'patch.zip', slot: 'zip', tier: 1, use: { heal: 60 }, value: 35, stack: 20, desc: 'Патч целостности: +60 HP.' },
  ram_zip: { name: 'ram.zip', slot: 'zip', tier: 1, use: { ram: 70 }, value: 35, stack: 20, desc: 'Скачать больше оперативной памяти: +70 RAM.' },
  cpu_zip: { name: 'overclock.zip', slot: 'zip', tier: 2, use: { buff: 'dmg', mult: 1.3, dur: 60 }, value: 55, stack: 20, desc: '+30% к урону на 60 секунд.' },
  bw_zip: { name: 'channel.zip', slot: 'zip', tier: 2, use: { buff: 'speed', mult: 1.25, dur: 60 }, value: 55, stack: 20, desc: '+25% к скорости на 60 секунд.' },
  shield_zip: { name: 'shield.zip', slot: 'zip', tier: 3, use: { buff: 'armor', mult: 0.6, dur: 45 }, value: 80, stack: 20, desc: 'Получаемый урон −40% на 45 секунд.' },

  // ---------------- мусор (сырьё для Архиватора) ----------------
  tmp: { name: 'Временный файл .tmp', slot: 'junk', tier: 1, value: 4, stack: 99, desc: 'Никому не нужен. Идеальное сырьё для сжатия.' },
  log: { name: 'Лог-файл .log', slot: 'junk', tier: 1, value: 4, stack: 99, desc: '«Ошибка: всё плохо». Подробнее — в следующем логе.' },
  bak: { name: 'Резервная копия .bak', slot: 'junk', tier: 1, value: 6, stack: 99, desc: 'Копия копии копии. Удалять жалко.' },
  chk: { name: 'Потерянный кластер .chk', slot: 'junk', tier: 2, value: 8, stack: 99, desc: 'FILE0001.CHK. Кто-то когда-то это терял.' },

  // ---------------- фрагменты кода (сырьё для Компилятора) ----------------
  frag_if: { name: 'if.c', slot: 'code', tier: 2, value: 20, stack: 20, desc: 'Фрагмент: условие. «Если что — я пошёл».' },
  frag_loop: { name: 'loop.c', slot: 'code', tier: 2, value: 20, stack: 20, desc: 'Фрагмент: цикл. См. «цикл».' },
  frag_ptr: { name: 'ptr.c', slot: 'code', tier: 2, value: 20, stack: 20, desc: 'Фрагмент: указатель. Указывает на другой указатель.' },
  frag_async: { name: 'async.c', slot: 'code', tier: 2, value: 20, stack: 20, desc: 'Фрагмент: асинхронность. Результат будет потом.' },
  frag_null: { name: 'null.c', slot: 'code', tier: 2, value: 20, stack: 20, desc: 'Фрагмент: ничего. Очень ценный.' },

  // ---------------- квестовые ----------------
  kernel32: { name: 'kernel32.dll', slot: 'quest', tier: 1, value: 0, desc: 'Пропавшая библиотека Клары. Без неё антивирус не загружается.' },
  license_key: { name: 'license.key', slot: 'quest', tier: 1, value: 0, desc: 'Лицензионный ключ. Редкость: он настоящий.' },
  router_packet: { name: 'packet.dat', slot: 'quest', tier: 1, value: 0, desc: 'Пакет данных для маршрутизатора. Не терять — не проходит повторно.' },
};

for (const [id, it] of Object.entries(ITEMS)) it.id = id;

export const EQUIP_SLOTS = ['weapon', 'accessory', 'armor'];
export const STACKABLE = (id) => (ITEMS[id]?.stack ?? 1) > 1;

/** Таблицы добычи по «качеству» зоны: [id, вес] */
export const LOOT = {
  common: [
    ['tmp', 30], ['log', 22], ['bak', 18], ['chk', 6],
    ['heal_zip', 8], ['ram_zip', 6], ['skin_bmp', 2], ['plugin_ocx', 2], ['macro', 2],
  ],
  mid: [
    ['tmp', 16], ['log', 14], ['bak', 14], ['chk', 12],
    ['heal_zip', 10], ['ram_zip', 8], ['cpu_zip', 4], ['bw_zip', 4],
    ['frag_if', 4], ['frag_loop', 4], ['frag_ptr', 4], ['frag_async', 4], ['frag_null', 4],
    ['notepad', 3], ['cmd', 2], ['paint', 2], ['user32', 3], ['gdi32', 3], ['msvcrt', 2], ['ntdll', 2], ['skin_png', 2],
  ],
  rich: [
    ['chk', 10], ['bak', 10], ['heal_zip', 10], ['ram_zip', 8], ['cpu_zip', 6], ['bw_zip', 6], ['shield_zip', 4],
    ['frag_if', 6], ['frag_loop', 6], ['frag_ptr', 6], ['frag_async', 6], ['frag_null', 6],
    ['calc', 3], ['taskmgr', 3], ['regedit', 2], ['defender', 2], ['macro_exe', 2],
    ['d3d9', 3], ['wininet', 3], ['plugin_dll', 3], ['mfc42', 2], ['tcpip', 3], ['hal', 3], ['ntfs', 2], ['win32k', 1],
  ],
};

export function rollLoot(table, rng = Math.random) {
  const list = LOOT[table] || LOOT.common;
  let total = 0;
  for (const [, w] of list) total += w;
  let r = rng() * total;
  for (const [id, w] of list) {
    r -= w;
    if (r <= 0) return id;
  }
  return list[0][0];
}
