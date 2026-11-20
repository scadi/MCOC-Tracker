import { useState } from 'react'
import type { AppState } from '../types'
import { uid } from '../store'

interface Props {
  state: AppState
  setState: React.Dispatch<React.SetStateAction<AppState>>
}

export function Notes({ state, setState }: Props) {
  const [title, setTitle] = useState('')

  const patch = (id: string, p: Partial<AppState['notes'][number]>) =>
    setState((s) => ({ ...s, notes: s.notes.map((n) => (n.id === id ? { ...n, ...p } : n)) }))

  return (
    <div>
      {state.notes.map((n) => (
        <div className="card" key={n.id}>
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <input value={n.title} onChange={(e) => patch(n.id, { title: e.target.value })} />
            <button onClick={() => setState((s) => ({ ...s, notes: s.notes.filter((x) => x.id !== n.id) }))}>✕</button>
          </div>
          <textarea value={n.body} onChange={(e) => patch(n.id, { body: e.target.value })} />
        </div>
      ))}
      <div className="card row">
        <input style={{ flex: 1 }} placeholder="Заголовок новой заметки" value={title} onChange={(e) => setTitle(e.target.value)} />
        <button
          onClick={() => {
            if (!title.trim()) return
            setState((s) => ({ ...s, notes: [...s.notes, { id: uid(), title: title.trim(), body: '' }] }))
            setTitle('')
          }}
        >
          Добавить
        </button>
      </div>
    </div>
  )
}
