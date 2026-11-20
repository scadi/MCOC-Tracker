import type { AppState, Champion, ChampClass, Stars, Tier } from './types'

/** Формат версии 1: отдельная запись на каждую звёздность */
interface V1Champion {
  id: string
  name: string
  cls: ChampClass
  stars: Stars
  rank: number
  level?: number
  maxLevel?: number
  tier: Tier
  note?: string
  icon?: string
  hubId?: string
}

type Loose = { version: number } & Record<string, unknown>

const nameKey = (s: string) => s.toLowerCase().replace(/ё/g, 'е').replace(/[^a-zа-я0-9]+/g, ' ').trim()

/** Приводит данные любой известной версии к текущей (v2: один герой — несколько звёздностей) */
export function migrate(data: Loose): AppState {
  if (data.version === 2) return data as unknown as AppState

  const old = data as unknown as { champions: V1Champion[] } & Omit<AppState, 'champions' | 'version'>
  const merged = new Map<string, Champion & { _top: number }>()

  for (const c of old.champions) {
    const key = nameKey(c.name)
    const cur = merged.get(key)
    if (!cur) {
      merged.set(key, {
        id: c.id,
        name: c.name,
        cls: c.cls,
        ranks: { [c.stars]: c.rank },
        level: c.level,
        maxLevel: c.maxLevel,
        tier: c.tier,
        note: c.note,
        icon: c.icon,
        hubId: c.hubId,
        _top: c.stars,
      })
      continue
    }
    cur.ranks[c.stars] = c.rank
    cur.icon ??= c.icon
    cur.hubId ??= c.hubId
    cur.note ??= c.note
    if (c.stars > cur._top) {
      // группа, заметка и уровень берутся у старшей звёздности
      cur._top = c.stars
      cur.tier = c.tier
      cur.level = c.level
      cur.maxLevel = c.maxLevel
      if (c.note) cur.note = c.note
    }
  }

  const champions = [...merged.values()].map((c) => {
    const { _top, ...rest } = c
    void _top
    return rest
  })
  return { ...old, version: 2, champions }
}
