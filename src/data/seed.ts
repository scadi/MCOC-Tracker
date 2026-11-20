import type { AppState, Champion, ChampClass, Stars, Tier } from '../types'

let n = 0
const c = (
  name: string,
  cls: ChampClass,
  stars: Stars,
  rank: number,
  tier: Tier,
  extra: Partial<Champion> = {},
): Champion => ({
  id: `seed-${++n}`,
  name,
  cls,
  ranks: { [stars]: rank },
  tier,
  ...extra,
})

const r1 = { level: 25, maxLevel: 25 }

const champions: Champion[] = [
  // 6★ основа (R3)
  c('Ринтра', 'mystic', 6, 3, 'core', { note: 'Закрывает Мистику' }),
  c('Леди Смертельный Удар', 'tech', 6, 3, 'core', { note: 'Закрывает Технологии' }),
  c('Кэсси Лэнг', 'science', 6, 3, 'core', { note: 'Закрывает Науку' }),

  // 6★ очередь прокачки (Космос)
  c('Серси', 'cosmic', 6, 1, 'queue', {
    note: 'Приоритет №1: живучий танк-универсал',
  }),
  c('Горр', 'cosmic', 6, 1, 'queue', {
    note: 'Приоритет №2: боссы с иммунитетами',
  }),

  // 6★ ростер R1 25/25
  c('Арним Зола', 'tech', 6, 1, 'roster', { ...r1, note: 'Топ-защитник и танк' }),
  c('Небула', 'tech', 6, 1, 'roster', { ...r1, note: 'Контр-пик против Ультрона (5.4.6)' }),
  c('Мистер Фантастик', 'science', 6, 1, 'roster', { ...r1, note: 'Саппорт: пре-бойные ослабления' }),
  c('Мистер Негатив', 'science', 6, 1, 'roster', r1),
  c('Сокол (Хоакин Торрес)', 'science', 6, 1, 'roster', r1),
  c('Существо', 'science', 6, 1, 'roster', r1),
  c('Невидимая Леди', 'science', 6, 1, 'roster', r1),
  c('Верховный Симбиот', 'mystic', 6, 1, 'roster', r1),
  c('Киндред', 'mystic', 6, 1, 'roster', r1),
  c('Вижн (Ааркус)', 'cosmic', 6, 1, 'roster', r1),
  c('Девушка-Белка', 'skill', 6, 1, 'roster', r1),

  // 5★ прокачанные (ситуативный инструмент)
  c('Гиперион', 'cosmic', 5, 5, 'core'),
  c('Космический Призрачный Гонщик', 'cosmic', 5, 4, 'core', { note: 'Возвышенный (Ascended)' }),
  c('Чаровница', 'mystic', 5, 1, 'core', { note: 'Прокачана' }),

  // 5★ резерв без вложений
  c('Геркулес', 'cosmic', 5, 1, 'reserve'),
  c('Халклинг', 'science', 5, 1, 'reserve'),
  c('Ник Фьюри', 'tech', 5, 1, 'reserve'),
  c('Мэджик', 'mystic', 5, 1, 'reserve'),
  c('Кассандра Нова', 'mutant', 5, 1, 'reserve'),
  c('Вокс', 'mystic', 5, 1, 'reserve'),
  c('Санспот', 'mutant', 5, 1, 'reserve'),
  c('Барон Земо', 'skill', 5, 1, 'reserve'),
  c('Скорпион', 'skill', 5, 1, 'reserve'),
  c('Нимрод', 'tech', 5, 1, 'reserve'),
  c('Человек-Муравей (Будущее)', 'science', 5, 1, 'reserve'),
  c('Налл', 'cosmic', 5, 1, 'reserve'),
  c('Джаггернаут', 'mutant', 5, 1, 'reserve'),
  c('Черная Вдова (Клэр Воянт)', 'skill', 5, 1, 'reserve'),
  c('Антивеном', 'mystic', 5, 1, 'reserve'),
  c('Дрожь', 'skill', 5, 1, 'reserve'),
]

export const seedState: AppState = {
  version: 2,
  profile: {
    level: 41,
    title: 'Сборщик (Uncollected)',
    currentTarget: 'Акт 5: главы 5.3 и 5.4 по прямой линии, затем Акт 6 (титул «Рыцарь»)',
  },
  champions,
  goals: [
    { id: 'g1', group: 'story', done: true, title: '5.2.6 — победить Коллекционера', note: 'Получен титул «Сборщик»' },
    { id: 'g2', group: 'story', done: false, title: 'Акт 5, глава 3 (5.3) — прямая линия' },
    { id: 'g3', group: 'story', done: false, title: 'Акт 5, глава 4 (5.4) — прямая линия', note: '5.4.6 Ультрон: контр-пик Небула' },
    { id: 'g4', group: 'story', done: false, title: 'Акт 6 — титул «Рыцарь»' },
    { id: 'g5', group: 'upgrade', done: false, title: 'Серси 6★ → R2/R3', note: 'Космос, живучий танк-универсал' },
    { id: 'g6', group: 'upgrade', done: false, title: 'Горр 6★ → R2/R3', note: 'Под боссов с иммунитетами' },
    { id: 'g7', group: 'resource', done: false, title: 'Открывать только базовые 6★ кристаллы (10 000 осколков)' },
    { id: 'g8', group: 'resource', done: false, title: 'Беречь жетоны до Cyber Weekend / Банкета (ноябрь–декабрь)' },
  ],
  resources: { shards6: 0, shards6Target: 10000, tokensSaved: true },
  notes: [
    {
      id: 'n1',
      title: 'Стратегия',
      body:
        '- Вкладываемся только в 6★; остальные 6★ держим на R1 25/25.\n' +
        '- 5★ резерв без вложений.\n' +
        '- Базовые 6★ кристаллы за 10 000 осколков; жетоны копим на распродажи.',
    },
    {
      id: 'n2',
      title: 'Война Союзов: Рикошет / Стабилизация',
      body:
        'Защитная тактика «Рикошет» и её контр-тактика «Стабилизация» — разобрано.\n' +
        'Добавьте сюда свои выводы и расстановки.',
    },
  ],
}
