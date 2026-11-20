export type ChampClass =
  | 'mystic'
  | 'tech'
  | 'science'
  | 'cosmic'
  | 'skill'
  | 'mutant'

export type Stars = 4 | 5 | 6 | 7

export const STAR_LIST: Stars[] = [4, 5, 6, 7]

/** Максимальный ранг по звёздности (при необходимости поправьте под текущую версию игры) */
export const MAX_RANK: Record<Stars, number> = { 4: 5, 5: 5, 6: 6, 7: 5 }

/** Группа по умолчанию для нового чемпиона */
export const defaultTier = (stars: Stars): Tier => (stars >= 6 ? 'roster' : 'reserve')

/** core — основа; queue — в очереди прокачки; roster — держим на R1; reserve — резерв без вложений */
export type Tier = 'core' | 'queue' | 'roster' | 'reserve'

export interface Champion {
  id: string
  name: string
  cls: ChampClass
  /** Какие звёздности есть у героя и их ранги: {6: 3, 5: 1}. Нет ключа — героя этой звёздности нет */
  ranks: Partial<Record<Stars, number>>
  /** Текущий / максимальный уровень (необязательно) */
  level?: number
  maxLevel?: number
  tier: Tier
  /** Мощь карточки по звёздности (со скриншота «Мои чемпионы»): {6: 13619} */
  power?: Partial<Record<Stars, number>>
  note?: string
  /** Своя иконка (data URL, 128px) — приоритетнее иконки из каталога */
  icon?: string
  /** id чемпиона в каталоге (public/champions.json) — по нему берётся public/icons/<id>.webp */
  hubId?: string
}

/** Звёздности, которые есть у героя, по возрастанию */
export const ownedStars = (c: Champion): Stars[] => STAR_LIST.filter((s) => c.ranks[s] !== undefined)

/** Краткая сводка: «6★ R3 · 5★ R1» (от старшей к младшей) */
export const rankSummary = (c: Champion): string =>
  [...ownedStars(c)].reverse().map((s) => `${s}★ R${c.ranks[s]}`).join(' · ') || '—'

/** Старшая из имеющихся звёздностей */
export const topStar = (c: Champion): Stars | undefined => ownedStars(c).at(-1)

/** Наибольшая известная мощь героя (по всем звёздностям); undefined — не задана */
export const championPower = (c: Champion): number | undefined => {
  const v = Object.values(c.power ?? {}).filter((n): n is number => typeof n === 'number')
  return v.length ? Math.max(...v) : undefined
}

/** 13619 → «13 619» */
export const fmtPower = (n: number): string => n.toLocaleString('ru-RU')

/** Подсказка: «6★: 13 619 · 5★: 4 200» */
export const powerSummary = (c: Champion): string =>
  [...STAR_LIST]
    .reverse()
    .filter((s) => c.power?.[s] !== undefined)
    .map((s) => `${s}★: ${fmtPower(c.power![s]!)}`)
    .join(' · ')

export interface Goal {
  id: string
  title: string
  group: 'story' | 'upgrade' | 'resource'
  done: boolean
  note?: string
}

export interface Resources {
  shards6: number
  shards6Target: number
  tokensSaved: boolean
}

export type ImportSource = 'text' | 'csv' | 'ocr' | 'manual'

export interface HistoryEntry {
  id: string
  at: string
  source: ImportSource
  summary: string
}

export interface AppState {
  version: 2
  /** ISO-дата последнего подтверждённого обновления данных */
  lastUpdated?: string
  history?: HistoryEntry[]
  profile: {
    level: number
    title: string
    currentTarget: string
  }
  champions: Champion[]
  goals: Goal[]
  resources: Resources
  notes: { id: string; title: string; body: string }[]
}

export const CLASS_LABEL: Record<ChampClass, string> = {
  mystic: 'Мистика',
  tech: 'Технологии',
  science: 'Наука',
  cosmic: 'Космос',
  skill: 'Навык',
  mutant: 'Мутант',
}

export const CLASS_COLOR: Record<ChampClass, string> = {
  mystic: '#a855f7',
  tech: '#3b82f6',
  science: '#22c55e',
  cosmic: '#f97316',
  skill: '#ef4444',
  mutant: '#eab308',
}

export const TIER_LABEL: Record<Tier, string> = {
  core: 'Основа',
  queue: 'Очередь прокачки',
  roster: 'Ростер (R1)',
  reserve: 'Резерв',
}
