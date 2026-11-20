import { useEffect, useState } from 'react'
import { defaultTier, type AppState, type ChampClass, type Champion, type Stars } from './types'
import { EN_ALIASES } from './sync'
import { uid } from './store'

/** Каталог и иконки лежат в public/: champions.json и icons/<id>.webp (см. scripts/fetch-*.mjs) */
const BASE = import.meta.env.BASE_URL

export interface HubChampion {
  id: string
  name: string
  cls: ChampClass
}

export interface Catalog {
  fetchedAt: string
  source: string
  champions: HubChampion[]
}

export const iconUrl = (id: string) => `${BASE}icons/${encodeURIComponent(id)}.webp`

const CLASSES: ChampClass[] = ['mystic', 'tech', 'science', 'cosmic', 'skill', 'mutant']

export async function loadCatalog(): Promise<Catalog> {
  const res = await fetch(`${BASE}champions.json`)
  if (!res.ok) throw new Error('champions.json не найден. Выполните: npm run fetch:champions')
  const d = (await res.json()) as {
    source: string
    fetchedAt: string
    champions: { id: string; name: string; class: string }[]
  }
  return {
    source: d.source,
    fetchedAt: d.fetchedAt,
    champions: d.champions.map((c) => ({
      id: c.id,
      name: c.name,
      cls: CLASSES.includes(c.class as ChampClass) ? (c.class as ChampClass) : 'skill',
    })),
  }
}

export function useCatalog() {
  const [catalog, setCatalog] = useState<Catalog | null>(null)
  const [error, setError] = useState('')
  useEffect(() => {
    loadCatalog().then(setCatalog, (e: Error) => setError(e.message))
  }, [])
  return { catalog, error }
}

/** Ключ для сравнения имён: скобки сохраняются («Ant-Man (Future)» ≠ «Ant-Man») */
const key = (s: string) =>
  s.toLowerCase().replace(/ё/g, 'е').replace(/[^a-zа-я0-9]+/g, ' ').trim()

/** Находит запись каталога для чемпиона из ростера */
export function matchHub(champ: Champion, catalog: HubChampion[]): HubChampion | undefined {
  if (champ.hubId) return catalog.find((h) => h.id === champ.hubId)
  const mine = key(champ.name)
  for (const h of catalog) {
    const hk = key(h.name)
    if (hk === mine) return h
    const ru = EN_ALIASES[hk]
    if (ru && key(ru) === mine) return h
  }
  return undefined
}

export interface LinkResult {
  state: AppState
  linked: number
  unmatched: Champion[]
}

/** Проставляет hubId у чемпионов ростера, чтобы подтянулись иконки */
export function linkRoster(state: AppState, catalog: HubChampion[]): LinkResult {
  let linked = 0
  const unmatched: Champion[] = []
  const champions = state.champions.map((c) => {
    if (c.hubId) return c
    const h = matchHub(c, catalog)
    if (!h) {
      unmatched.push(c)
      return c
    }
    linked++
    return { ...c, hubId: h.id }
  })
  return { state: { ...state, champions }, linked, unmatched }
}

/** Добавляет героя или (если он уже есть в ростере) новую звёздность к существующей карточке */
export function addFromHub(state: AppState, h: HubChampion, stars: Stars): AppState {
  const existing = state.champions.find((c) => matchHub(c, [h]))
  if (existing) {
    if (existing.ranks[stars] !== undefined) return state
    return {
      ...state,
      champions: state.champions.map((c) =>
        c.id === existing.id ? { ...c, hubId: c.hubId ?? h.id, ranks: { ...c.ranks, [stars]: 1 } } : c,
      ),
    }
  }
  const ru = EN_ALIASES[key(h.name)]
  return {
    ...state,
    champions: [
      ...state.champions,
      {
        id: uid(),
        name: ru ?? h.name,
        cls: h.cls,
        ranks: { [stars]: 1 },
        tier: defaultTier(stars),
        hubId: h.id,
      },
    ],
  }
}
