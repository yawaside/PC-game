// Квесты. Объективы выполняются по порядку. Типы: flag, kill, event, visit, talk, collect, reach, custom.
// auto(g) — автоматический старт, когда условие истинно. turnin: true — объектив «сдать квест».
export const QUESTS = {
  // ---------------------------------------------------------------- Акт 1
  m_first: {
    main: true, title: 'Первый запуск', giver: 'Клара', zone: 'desktop', order: 1,
    desc: 'Познакомьтесь с Кларой — остатками антивируса — и докажите, что ярлык способен не только открываться.',
    auto: (g) => g.flag('intro_done'),
    objectives: [
      { id: 'talk', text: 'Поговорить с Кларой', type: 'flag', flag: 'met_klara', npc: 'klara', zone: 'desktop' },
      { id: 'birds', text: 'Прогнать 3 Popup-птицы', type: 'kill', enemy: 'bird', n: 3, zone: 'desktop', onDone: (g) => g.setFlag('birds_done') },
      { id: 'back', text: 'Вернуться к Кларе', type: 'flag', flag: 'firewall_given', npc: 'klara', zone: 'desktop' },
    ],
    reward: { xp: 60, text: 'программа Firewall' },
  },

  // ---------------------------------------------------------------- побочные (Рабочий стол)
  s_taskman: {
    title: 'Убей 10 процессов в Диспетчере', giver: 'Диспетчер задач', zone: 'desktop',
    desc: 'Диспетчер задач просит завершить десять непослушных процессов. Любых.',
    objectives: [
      { id: 'kill', text: 'Завершить 10 процессов', type: 'kill', n: 10 },
      { id: 'report', text: 'Доложить Диспетчеру задач', type: 'flag', flag: 'taskman_reported', npc: 'taskman', zone: 'desktop', turnin: true },
    ],
    reward: { xp: 90, bytes: 60, items: { taskmgr: 1 }, text: 'taskmgr.exe' },
  },
  s_popups: {
    title: 'Похоже, вы закрываете рекламу', giver: 'Скрепыш', zone: 'desktop',
    desc: 'Скрепыш мечтает, чтобы кто-нибудь закрыл пять рекламных окон. Нажмите X, когда adware-слизни забросают вас рекламой. (Включено в настройках.)',
    objectives: [{ id: 'close', text: 'Закрыть 5 рекламных окон (X)', type: 'event', event: 'popupClosed', n: 5 }],
    reward: { xp: 50, bytes: 50, items: { plugin_ocx: 1 }, text: 'plugin.ocx' },
  },
  s_zip: {
    title: 'Сжать мусор', giver: 'Блокнот', zone: 'desktop',
    desc: 'Соберите мусор (.tmp, .log, .bak) и сожмите его в Архиваторе — он на востоке площади.',
    objectives: [{ id: 'zip', text: 'Создать .zip в Архиваторе', type: 'event', event: 'crafted', n: 1 }],
    reward: { xp: 40, items: { heal_zip: 2 }, text: '2 × patch.zip' },
  },
  s_convert: {
    title: 'Формат по-новому', giver: 'Блокнот', zone: 'desktop',
    desc: 'Улучшите любой файл в Конвертере: например, .ocx → .dll или .bmp → .png.',
    objectives: [{ id: 'conv', text: 'Конвертировать файл', type: 'event', event: 'converted', n: 1 }],
    reward: { xp: 55, items: { ram_zip: 2 }, text: '2 × ram.zip' },
  },
};

for (const [id, q] of Object.entries(QUESTS)) q.id = id;
