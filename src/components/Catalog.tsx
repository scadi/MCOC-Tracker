import { useMemo, useState } from 'react'
import { CLASS_COLOR, CLASS_LABEL, STAR_LIST, type AppState, type ChampClass, type Champion, type Stars } from '../types'
import {
  addFromHub,
  iconUrl,
  linkRoster,
  matchHub,
  useCatalog,
  type HubChampion,
} from '../hub'

interface Props {
  state: AppState
  setState: React.Dispatch<React.SetStateAction<AppState>>
}

export function Catalog({ state, setState }: Props) {
  const { catalog: cache, error } = useCatalog()
  const [msg, setMsg] = useState('')
  const [q, setQ] = useState('')
  const [cls, setCls] = useState<ChampClass | ''>('')
  const [onlyNew, setOnlyNew] = useState(false)
  const [limit, setLimit] = useState(60)

  const catalog = useMemo(() => cache?.champions ?? [], [cache])

  /** id каталога → герой из ростера */
  const inRoster = useMemo(() => {
    const m = new Map<string, Champion>()
    for (const c of state.champions) {
      const h = matchHub(c, catalog)
      if (h) m.set(h.id, c)
    }
    return m
  }, [state.champions, catalog])

  const link = () => {
    const r = linkRoster(state, catalog)
    setState(r.state)
    setMsg(
      `Иконки подключены: ${r.linked}.` +
        (r.unmatched.length ? ` Не найдены в каталоге: ${r.unmatched.map((c) => c.name).join(', ')}` : ''),
    )
  }

  const list = useMemo(() => {
    const s = q.toLowerCase()
    return catalog.filter(
      (h) =>
        (!cls || h.cls === cls) &&
        (!onlyNew || !inRoster.has(h.id)) &&
        (!s || h.name.toLowerCase().includes(s) || h.id.includes(s)),
    )
  }, [catalog, q, cls, onlyNew, inRoster])

  const unlinked = state.champions.filter((c) => !c.hubId).length

  return (
    <div>
      <div className="card">
        <h3>Каталог чемпионов</h3>
        <p className="muted">
          Список и иконки загружены локально (public/champions.json и public/icons) со страницы{' '}
          <a href="https://www.mcoc.help/champions/" target="_blank" rel="noreferrer">mcoc.help</a>.
          Обновить: <code>npm run fetch:champions</code> и <code>npm run fetch:icons</code>.
        </p>
        {cache && (
          <div className="muted">
            В каталоге: {catalog.length} · обновлено {new Date(cache.fetchedAt).toLocaleString('ru-RU')}
          </div>
        )}
        {!cache && !error && <div className="muted">Загрузка…</div>}
        {error && <div style={{ color: 'var(--accent)' }}>{error}</div>}
        {msg && <div style={{ color: 'var(--ok)', marginTop: '.5rem' }}>{msg}</div>}
      </div>

      {cache && (
        <>
          <div className="card">
            <h3>Иконки для текущего ростера</h3>
            <p className="muted">
              Сопоставляет чемпионов ростера с каталогом и подключает их иконки. Без привязки: {unlinked}.
              Свои загруженные иконки не затрагиваются.
            </p>
            <button onClick={link} disabled={!unlinked}>Подключить иконки</button>
          </div>

          <div className="card">
            <h3>Добавить в ростер</h3>
            <div className="filters">
              <input placeholder="Поиск…" value={q} onChange={(e) => setQ(e.target.value)} />
              <select value={cls} onChange={(e) => setCls(e.target.value as ChampClass | '')}>
                <option value="">Все классы</option>
                {Object.entries(CLASS_LABEL).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
              <label className="row">
                <input type="checkbox" checked={onlyNew} onChange={(e) => setOnlyNew(e.target.checked)} />
                Скрыть тех, кто уже в ростере
              </label>
              <span className="muted">Найдено: {list.length}</span>
            </div>

            <div className="grid">
              {list.slice(0, limit).map((h) => (
                <HubCard
                  key={h.id}
                  h={h}
                  owner={inRoster.get(h.id)}
                  onAdd={(stars) => setState((s) => addFromHub(s, h, stars))}
                />
              ))}
            </div>
            {list.length > limit && (
              <div className="row" style={{ marginTop: '.75rem' }}>
                <button onClick={() => setLimit((l) => l + 60)}>
                  Показать ещё ({list.length - limit})
                </button>
              </div>
            )}
          </div>
        </>
      )}

      <div className="muted" style={{ marginTop: '1rem' }}>
        Данные и иконки: <a href="https://www.mcoc.help/champions/" target="_blank" rel="noreferrer">mcoc.help</a> · изображения принадлежат Marvel / Kabam
      </div>
    </div>
  )
}

function HubCard({
  h,
  owner,
  onAdd,
}: {
  h: HubChampion
  owner?: Champion
  onAdd: (stars: Stars) => void
}) {
  const color = CLASS_COLOR[h.cls]
  return (
    <div className="champ" style={{ borderLeftColor: color }}>
      <div className="champ-head">
        <div className="avatar" style={{ borderColor: color, background: color + '55' }}>
          <img src={iconUrl(h.id)} alt={h.name} loading="lazy" />
        </div>
        <div className="champ-info">
          <div className="name" title={h.name}>{h.name}</div>
          <div className="meta">
            <span className="badge" style={{ background: color + '44' }}>{CLASS_LABEL[h.cls]}</span>
            {owner && <span className="badge">в ростере</span>}
          </div>
        </div>
      </div>
      <div className="actions">
        {STAR_LIST.map((n) => (
          <button
            key={n}
            className={`add-star ${owner?.ranks[n] !== undefined ? 'have' : ''}`}
            disabled={owner?.ranks[n] !== undefined}
            onClick={() => onAdd(n)}
            title={owner?.ranks[n] !== undefined ? `${n}★ уже есть` : `Добавить ${n}★`}
          >
            {owner?.ranks[n] !== undefined ? '★' : '☆'}{n}
          </button>
        ))}
      </div>
    </div>
  )
}
