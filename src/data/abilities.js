// «Установленные программы» — способности Шортката и улучшения из Компилятора.

export const ABILITIES = {
  firewall: {
    id: 'firewall', key: 1, name: 'Firewall', icon: 'shield', color: '#4fc3ff', cost: 15, cd: 6,
    desc: 'Щит перед вами: блокирует снаряды и гасит 70% урона спереди. Держится 4 секунды.',
    mod: { name: 'Firewall 2.0', recipe: { frag_if: 1, frag_loop: 1 }, desc: 'Щит держится дольше и отражает снаряды обратно во врагов.' },
  },
  defrag: {
    id: 'defrag', key: 2, name: 'Defrag', icon: 'flame', color: '#ff8a3d', cost: 35, cd: 10,
    desc: 'Упорядочивает врагов вокруг в ровную линию — и взрывает по очереди.',
    mod: { name: 'Defrag 2.0', recipe: { frag_loop: 1, frag_ptr: 1 }, desc: 'Радиус захвата +40%, взрывы сильнее.' },
  },
  sleep: {
    id: 'sleep', key: 3, name: 'Sleep Mode', icon: 'moon', color: '#8fa8ff', cost: 25, cd: 12,
    desc: 'Усыпляет всех врагов рядом на 5 секунд. Боссы лишь замедляются.',
    mod: { name: 'Sleep Mode 2.0', recipe: { frag_async: 1, frag_null: 1 }, desc: 'Сон длится на 60% дольше, радиус больше.' },
  },
  overclock: {
    id: 'overclock', key: 4, name: 'Overclock', icon: 'bolt', color: '#ffd23f', cost: 20, cd: 18,
    desc: 'Атаки и бег быстрее, но растёт перегрев: выше 70% — вы получаете урон. Повторное нажатие — отмена.',
    mod: { name: 'Overclock 2.0', recipe: { frag_if: 1, frag_async: 1 }, desc: 'Перегрев растёт на 35% медленнее.' },
  },
  delete: {
    id: 'delete', key: 5, name: 'Delete', icon: 'trash', color: '#ff4d6d', cost: 70, cd: 40,
    desc: 'Мощнейшая атака. «Вы действительно хотите удалить эти объекты?» — Да.',
    mod: { name: 'Delete 2.0', recipe: { frag_ptr: 1, frag_null: 1, frag_async: 1 }, desc: 'Перезарядка короче на 30%, урон выше.' },
  },
  safemode: {
    id: 'safemode', key: 6, name: 'Safe Mode', icon: 'lock', color: '#b7f06b', cost: 30, cd: 25,
    desc: 'Безопасный режим: 4 секунды неуязвимости. (Доступно после «Чистой установки».)',
    mod: null,
  },
};

export const ABILITY_ORDER = ['firewall', 'defrag', 'sleep', 'overclock', 'delete', 'safemode'];

/** Улучшения (Компилятор) — по id способности. */
export const MODS = Object.fromEntries(
  Object.values(ABILITIES)
    .filter((a) => a.mod)
    .map((a) => [a.id, a.mod]),
);
