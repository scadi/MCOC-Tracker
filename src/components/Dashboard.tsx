import { CLASS_COLOR, CLASS_LABEL, rankSummary, type AppState, type ChampClass, type Champion, type Stars } from '../types'

interface Props {
  state: AppState
  setState: React.Dispatch<React.SetStateAction<AppState>>
}

const CLASSES: ChampClass[] = ['mystic', 'tech', 'science', 'cosmic', 'skill']

export function Dashboard({ state, setState }: Props) {
  const { champions, goals, resources, profile } = state
  const has = (c: Champion, s: Stars) => c.ranks[s] !== undefined
  const count = (s: Stars) => champions.filter((c) => has(c, s)).length
  const six = champions.filter((c) => has(c, 6))
  const r3 = six.filter((c) => (c.ranks[6] ?? 0) >= 3)
  const doneGoals = goals.filter((g) => g.done).length
  const pct = Math.min(100, Math.round((resources.shards6 / resources.shards6Target) * 100))
  const queue = champions.filter((c) => c.tier === 'queue')

  const setRes = (patch: Partial<typeof resources>) =>
    setState((s) => ({ ...s, resources: { ...s.resources, ...patch } }))

  return (
    <div>
      <div className="card">
        <h3>Текущая цель</h3>
        <div>{profile.currentTarget}</div>
        <div className="row" style={{ marginTop: '.5rem' }}>
          <span className="muted">Уровень аккаунта</span>
          <input
            type="number"
            style={{ width: 80 }}
            value={profile.level}
            onChange={(e) =>
              setState((s) => ({ ...s, profile: { ...s.profile, level: Number(e.target.value) } }))
            }
          />
          <span className="badge">{profile.title}</span>
        </div>
      </div>

      <div className="grid">
        <div className="card"><div className="muted">6★ в ростере</div><div className="stat">{six.length}</div></div>
        <div className="card"><div className="muted">6★ Ранг 3+</div><div className="stat">{r3.length}</div></div>
        <div className="card"><div className="muted">Цели выполнены</div><div className="stat">{doneGoals}/{goals.length}</div></div>
        <div className="card"><div className="muted">7★ в ростере</div><div className="stat">{count(7)}</div></div>
        <div className="card"><div className="muted">5★ всего</div><div className="stat">{count(5)}</div></div>
        <div className="card"><div className="muted">4★ всего</div><div className="stat">{count(4)}</div></div>
      </div>

      <div className="card">
        <h3>Закрытые классы (6★ R3)</h3>
        <div className="row">
          {CLASSES.map((cl) => {
            const has = r3.some((c) => c.cls === cl)
            return (
              <span
                key={cl}
                className="badge"
                style={{ background: has ? CLASS_COLOR[cl] : undefined, opacity: has ? 1 : 0.6 }}
              >
                {CLASS_LABEL[cl]} {has ? '✓' : '—'}
              </span>
            )
          })}
        </div>
      </div>

      <div className="card">
        <h3>Очередь прокачки</h3>
        {queue.length === 0 && <div className="muted">Пусто</div>}
        {queue.map((c, i) => (
          <div key={c.id} className="goal">
            <b>{i + 1}.</b>
            <div>
              {c.name} <span className="badge">{rankSummary(c)}</span>
              {c.note && <div className="muted">{c.note}</div>}
            </div>
          </div>
        ))}
      </div>

      <div className="card">
        <h3>Осколки 6★ кристалла</h3>
        <div className="bar"><div style={{ width: `${pct}%` }} /></div>
        <div className="row" style={{ marginTop: '.5rem' }}>
          <input
            type="number"
            style={{ width: 110 }}
            value={resources.shards6}
            onChange={(e) => setRes({ shards6: Number(e.target.value) })}
          />
          <span className="muted">/ {resources.shards6Target} ({pct}%)</span>
          <label className="row">
            <input
              type="checkbox"
              checked={resources.tokensSaved}
              onChange={(e) => setRes({ tokensSaved: e.target.checked })}
            />
            Жетоны сберегаются до распродаж
          </label>
        </div>
      </div>
    </div>
  )
}
