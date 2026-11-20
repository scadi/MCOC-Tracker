import { useRef, useState } from 'react'
import { exportState, parseImport, useAppState } from './store'
import { Dashboard } from './components/Dashboard'
import { Roster } from './components/Roster'
import { Goals } from './components/Goals'
import { Notes } from './components/Notes'
import { Sync } from './components/Sync'
import { Catalog } from './components/Catalog'
import { STALE_DAYS, daysSince } from './sync'
import './App.css'

const TABS = [
  { key: 'dash', label: 'Обзор' },
  { key: 'roster', label: 'Ростер' },
  { key: 'catalog', label: 'Каталог' },
  { key: 'sync', label: 'Обновление' },
  { key: 'goals', label: 'Цели' },
  { key: 'notes', label: 'Заметки' },
] as const

type TabKey = (typeof TABS)[number]['key']

export default function App() {
  const { state, setState, reset } = useAppState()
  const [tab, setTab] = useState<TabKey>('dash')
  const fileRef = useRef<HTMLInputElement>(null)
  const days = daysSince(state.lastUpdated)
  const stale = tab !== 'sync' && (days === null || days >= STALE_DAYS)

  return (
    <>
      <header className="top">
        <div>
          <h1>MCOC Tracker</h1>
          <div className="muted">Marvel: Битва чемпионов — трекер аккаунта</div>
        </div>
        <div className="row">
          <button onClick={() => exportState(state)}>Экспорт JSON</button>
          <button onClick={() => fileRef.current?.click()}>Импорт JSON</button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            hidden
            onChange={async (e) => {
              const file = e.target.files?.[0]
              e.target.value = ''
              if (!file) return
              try {
                const data = await parseImport(file)
                if (confirm('Заменить текущие данные импортированными?')) setState(data)
              } catch (err) {
                alert(err instanceof Error ? err.message : 'Не удалось прочитать файл')
              }
            }}
          />
          <button
            onClick={() => {
              if (confirm('Сбросить все данные к начальным?')) reset()
            }}
          >
            Сбросить
          </button>
        </div>
      </header>

      <nav className="tabs">
        {TABS.map((t) => (
          <button key={t.key} className={tab === t.key ? 'active' : ''} onClick={() => setTab(t.key)}>
            {t.label}
          </button>
        ))}
      </nav>

      {stale && (
        <div className="card" style={{ borderColor: 'var(--accent)' }}>
          {days === null
            ? 'Данные ещё ни разу не обновлялись из игры. '
            : `Данные не обновлялись ${days} дн. `}
          <button onClick={() => setTab('sync')}>Обновить</button>
        </div>
      )}

      {tab === 'dash' && <Dashboard state={state} setState={setState} />}
      {tab === 'catalog' && <Catalog state={state} setState={setState} />}
      {tab === 'sync' && <Sync state={state} setState={setState} />}
      {tab === 'roster' && <Roster state={state} setState={setState} />}
      {tab === 'goals' && <Goals state={state} setState={setState} />}
      {tab === 'notes' && <Notes state={state} setState={setState} />}
    </>
  )
}
