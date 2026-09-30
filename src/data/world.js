import { versionName } from '../player/stats.js';

// Карта мира: названия зон, рекомендуемые уровни, условия входа.
export const GATES = {
  documents: { name: 'Мои документы', level: 1, path: 'C:\\Users\\Shortcut\\Мои документы' },
  recycle: { name: 'Корзина', level: 4, path: 'C:\\$Recycle.Bin' },
  temp: { name: 'Папка Temp', level: 7, path: 'C:\\Windows\\Temp' },
  autorun: { name: 'Автозагрузка', level: 6, path: 'C:\\ProgramData\\Startup' },
  registry: { name: 'Реестр', level: 9, path: 'HKEY_LOCAL_MACHINE\\SOFTWARE' },
  diskd: { name: 'Диск D:', level: 11, path: 'D:\\' },
  internet: { name: 'Интернет', level: 14, path: 'http://www.' },
  bios: { name: 'BIOS', level: 18, path: 'BIOS\\SETUP' },
  sysvol: { name: 'System Volume Information', level: 1, path: 'C:\\System Volume Information' },
};
for (const g of Object.values(GATES)) g.rec = versionName(g.level);

export const HIDDEN_FILES = [
  { id: 'hidden_desktop', zone: 'desktop', name: 'wallpaper.bmp', hint: 'где-то за трещиной в обоях' },
  { id: 'hidden_start', zone: 'desktop', name: 'startup.snd', hint: 'на крыше кнопки «Пуск»' },
  { id: 'hidden_docs', zone: 'documents', name: 'diary.txt', hint: 'на крыше самой высокой папки' },
  { id: 'hidden_recycle', zone: 'recycle', name: 'lost.jpg', hint: 'на дне самой глубокой кучи' },
  { id: 'hidden_temp', zone: 'temp', name: '~temp.tmp', hint: 'там, где кончается болото' },
  { id: 'hidden_registry', zone: 'registry', name: 'secret.reg', hint: 'в тупике лабиринта' },
  { id: 'hidden_autorun', zone: 'autorun', name: 'autorun.inf', hint: 'в карцере' },
  { id: 'hidden_diskd', zone: 'diskd', name: 'savegame.sav', hint: 'на кладбище игр' },
  { id: 'hidden_internet', zone: 'internet', name: 'cookies.dat', hint: 'на отдалённом острове сайта' },
  { id: 'hidden_bios', zone: 'bios', name: 'setup.cmos', hint: 'за алтарём первого драйвера' },
  { id: 'hidden_sysvol', zone: 'sysvol', name: 'cloud.key', hint: 'в самом сердце тома' },
];
/** Сколько скрытых файлов открывают секретную папку (System Volume Information). */
export const HIDDEN_NEEDED = 8;
/** Все файлы — нужны для «Облачной» (жёлтой) концовки. */
export const HIDDEN_TOTAL = HIDDEN_FILES.length;

/**
 * Возвращает строку-причину, если проход закрыт, иначе null.
 */
export function gateLock(g, id) {
  const f = g.flags;
  if (g.mode === 'speedrun') {
    if (id === 'bios') return null;
    if (id === 'sysvol') return 'В режиме «Быстрая загрузка» недоступно';
    return null;
  }
  switch (id) {
    case 'documents':
      return null;
    case 'recycle':
      return g.stats.moves.doubleJump ? null : 'Нужен «Драйвер прыжка v2.0» — он у Трояна из «Моих документов»';
    case 'temp':
      return g.stats.moves.dash ? null : 'Нужен «Буфер обмена» (рывок) — награда за Корзину';
    case 'autorun':
    case 'registry':
    case 'diskd':
      return g.act >= 2 ? null : 'Сначала разберитесь с Троянским Конём';
    case 'internet':
      return g.stats.moves.grapple ? null : 'Нужна «Ссылка» (Link.dll) — она спрятана на Диске D:';
    case 'bios':
      return g.act >= 3 ? null : 'BIOS закрыт паролем. Пока что.';
    case 'sysvol':
      return g.hiddenCount >= HIDDEN_NEEDED ? null : `Доступ запрещён. Скрытых файлов найдено: ${g.hiddenCount}/${HIDDEN_NEEDED}`;
  }
  void f;
  return null;
}
