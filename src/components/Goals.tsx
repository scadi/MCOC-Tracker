import { useState } from 'react'
import type { AppState, Goal } from '../types'
import { uid } from '../store'

interface Props {
  state: AppState
  setState: React.Dispatch<React.SetStateAction<AppState>>
}

const GROUPS: { key: Goal['group']; label: string }[] = [
  { key: 'story', label: 'Сюжет' },
  { key: 'upgrade', label: 'Прокачка' },
  { key: 'resource', label: 'Ресурсы и стратегия' },
]

export function Goals({ state, setState }: Props) {
  const [title, setTitle] = useState('')
  const [group, setGroup] = useState<Goal['group']>('story')

  const toggle = (id: string) =>
    setState((s) => ({
      ...s,
      goals: s.goals.map((g) => (g.id === id ? { ...g, done: !g.done } : g)),
    }))

  const remove = (id: string) =>
    setState((s) => ({ ...s, goals: s.goals.filter((g) => g.id !== id) }))

  const add = () => {
    if (!title.trim()) return
    setState((s) => ({
      ...s,
      goals: [...s.goals, { id: uid(), title: title.trim(), group, done: false }],
    }))
    setTitle('')
  }

  return (
    <div>
      {GROUPS.map(({ key, label }) => (
        <div className="card" key={key}>
          <h3>{label}</h3>
          {state.goals.filter((g) => g.group === key).map((g) => (
            <div key={g.id} className={`goal ${g.done ? 'done' : ''}`}>
              <input type="checkbox" checked={g.done} onChange={() => toggle(g.id)} />
              <div style={{ flex: 1 }}>
                <div className="t">{g.title}</div>
                {g.note && <div className="muted">{g.note}</div>}
              </div>
              <button onClick={() => remove(g.id)}>✕</button>
            </div>
          ))}
        </div>
      ))}
      <div className="card row">
        <input style={{ flex: 1 }} placeholder="Новая цель" value={title} onChange={(e) => setTitle(e.target.value)} />
        <select value={group} onChange={(e) => setGroup(e.target.value as Goal['group'])}>
          {GROUPS.map((g) => <option key={g.key} value={g.key}>{g.label}</option>)}
        </select>
        <button onClick={add}>Добавить</button>
      </div>
    </div>
  )
}
