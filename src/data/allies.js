// Союзники: освобождённые и вновь обретённые программы. bonus — пассивные бонусы игроку.
export const ALLIES = {
  prisoner: { name: 'Узник Автозагрузки', look: { body: 0x7d8a5a, acc: 0xffb066, shape: 'soldier', scale: 1.0 }, bonus: { hp: 8 }, dmg: 8, desc: '+8 к HP за каждого' },
  sapper: { name: 'Сапёр', look: { body: 0xc0c0c0, acc: 0xd93025, shape: 'mine', scale: 1.0 }, bonus: { cpu: 1 }, dmg: 9, desc: '+1 CPU' },
  solitaire: { name: 'Косынка', look: { body: 0xf4f4f4, acc: 0xd93025, shape: 'card', scale: 1.0 }, bonus: { ram: 1 }, dmg: 6, desc: '+1 RAM' },
  exlord: { name: 'Бывший Лорд', look: { body: 0xb02030, acc: 0xffd23f, shape: 'bin', scale: 1.1 }, bonus: { dmg: 0.06 }, dmg: 12, desc: '+6% урона' },
  driver: { name: 'Старый драйвер', look: { body: 0xe8e0c8, acc: 0x7a6a3a, shape: 'chip', scale: 0.8 }, bonus: { bandwidth: 1 }, dmg: 7, desc: '+1 Bandwidth' },
};
