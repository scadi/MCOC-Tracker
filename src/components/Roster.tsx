import { useState } from 'react'
import {
  CLASS_COLOR,
  CLASS_LABEL,
  TIER_LABEL,
  STAR_LIST,
  defaultTier,
  championPower,
  fmtPower,
  powerSummary,
  type AppState,
  type Stars,
  type ChampClass,
  type Champion,
  type Tier,
} from '../types'
import { uid } from '../store'
import { Avatar } from './Avatar'
import { StarRanks } from './StarRanks'

interface Props {
  state: AppState
  setState: React.Dispatch<React.SetStateAction<AppState>>
}

export function Roster({ state, setState }: Props) {
  const [cls, setCls] = useState<ChampClass | ''>('')
  const [tier, setTier] = useState<Tier | ''>('')
  const [stars, setStars] = useState<'' | '4' | '5' | '6' | '7'>('')
  const [q, setQ] = useState('')
  const [sort, setSort] = useState<'power' | 'name' | 'added'>('power')
  const [newName, setNewName] = useState('')
  const [newStars, setNewStars] = useState<Stars>(6)

  const update = (id: string, patch: Partial<Champion>) =>
    setState((s) => ({
      ...s,
      champions: s.champions.map((c) => (c.id === id ? { ...c, ...patch } : c)),
    }))

  /** rank === undefined — убрать звёздность. Если не осталось ни одной — героя оставляем, но без звёзд (можно добавить снова) */
  const setRank = (id: string, st: Stars, rank: number | undefined) =>
    setState((s) => ({
      ...s,
      champions: s.champions.map((c) => {
        if (c.id !== id) return c
        const ranks = { ...c.ranks }
        if (rank === undefined) delete ranks[st]
        else ranks[st] = rank
        return { ...c, ranks }
      }),
    }))

  const remove = (id: string) =>
    setState((s) => ({ ...s, champions: s.champions.filter((c) => c.id !== id) }))

  const add = () => {
    if (!newName.trim()) return
    setState((s) => ({
      ...s,
      champions: [
        ...s.champions,
        { id: uid(), name: newName.trim(), cls: 'science', ranks: { [newStars]: 1 }, tier: defaultTier(newStars) },
      ],
    }))
    setNewName('')
  }

  /** Мощь для сортировки: при фильтре по звёздам — мощь именно этой звёздности */
  const powerOf = (c: Champion) =>
    stars ? c.power?.[Number(stars) as Stars] : championPower(c)

  const list = state.champions
    .filter(
      (c) =>
        (!cls || c.cls === cls) &&
        (!tier || c.tier === tier) &&
        (!stars || c.ranks[Number(stars) as Stars] !== undefined) &&
        c.name.toLowerCase().includes(q.toLowerCase()),
    )
    .sort((a, b) => {
      if (sort === 'added') return 0
      if (sort === 'name') return a.name.localeCompare(b.name, 'ru')
      // Без мощи — в конец списка, между собой по имени
      const pa = powerOf(a)
      const pb = powerOf(b)
      if (pa === undefined && pb === undefined) return a.name.localeCompare(b.name, 'ru')
      if (pa === undefined) return 1
      if (pb === undefined) return -1
      return pb - pa || a.name.localeCompare(b.name, 'ru')
    })

  return (
    <div>
      <div className="filters">
        <input placeholder="Поиск…" value={q} onChange={(e) => setQ(e.target.value)} />
        <select value={cls} onChange={(e) => setCls(e.target.value as ChampClass | '')}>
          <option value="">Все классы</option>
          {Object.entries(CLASS_LABEL).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
        <select value={tier} onChange={(e) => setTier(e.target.value as Tier | '')}>
          <option value="">Все группы</option>
          {Object.entries(TIER_LABEL).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
        <select value={stars} onChange={(e) => setStars(e.target.value as '' | '4' | '5' | '6' | '7')}>
          <option value="">Любые звёзды</option>
          {[...STAR_LIST].reverse().map((n) => (
            <option key={n} value={n}>{n}★</option>
          ))}
        </select>
        <select value={sort} onChange={(e) => setSort(e.target.value as 'power' | 'name' | 'added')}>
          <option value="power">По мощи ↓</option>
          <option value="name">По имени</option>
          <option value="added">По порядку добавления</option>
        </select>
        <span className="muted">Показано: {list.length}</span>
      </div>

      <div className="grid">
        {list.map((c) => (
          <div key={c.id} className="champ" style={{ borderLeftColor: CLASS_COLOR[c.cls] }}>
            <div className="champ-head">
              <Avatar champ={c} onChange={(icon) => update(c.id, { icon })} />
              <div className="champ-info">
                <div className="name" title={c.name}>{c.name}</div>
                <div className="meta">
                  <span className="badge" style={{ background: CLASS_COLOR[c.cls] + '44' }}>
                    {CLASS_LABEL[c.cls]}
                  </span>
                  {c.level && <span className="badge">{c.level}/{c.maxLevel}</span>}
                  {powerOf(c) !== undefined && (
                    <span className="badge" title={powerSummary(c)} style={{ background: '#f59e0b33' }}>
                      ⚡ {fmtPower(powerOf(c)!)}
                    </span>
                  )}
                </div>
              </div>
              <button className="icon-btn" onClick={() => remove(c.id)} title="Удалить">✕</button>
            </div>
            {c.note && <div className="note">{c.note}</div>}
            <StarRanks champ={c} onChange={(st, rank) => setRank(c.id, st, rank)} />
            <select value={c.tier} onChange={(e) => update(c.id, { tier: e.target.value as Tier })}>
              {Object.entries(TIER_LABEL).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </div>
        ))}
      </div>

      <div className="card row" style={{ marginTop: '1rem' }}>
        <input placeholder="Новый чемпион (R1)" value={newName} onChange={(e) => setNewName(e.target.value)} />
        <select value={newStars} onChange={(e) => setNewStars(Number(e.target.value) as Stars)}>
          {STAR_LIST.map((n) => (
            <option key={n} value={n}>{n}★</option>
          ))}
        </select>
        <button onClick={add}>Добавить</button>
      </div>
    </div>
  )
}
