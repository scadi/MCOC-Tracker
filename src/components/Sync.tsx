import { useRef, useState } from 'react'
import type { AppState, ImportSource } from '../types'
import {
  applyDiff,
  buildDiff,
  daysSince,
  ocrImages,
  parseInput,
  type DiffItem,
} from '../sync'

interface Props {
  state: AppState
  setState: React.Dispatch<React.SetStateAction<AppState>>
}

const SOURCE_LABEL: Record<ImportSource, string> = {
  text: 'Текст',
  csv: 'CSV',
  ocr: 'Скриншот (OCR)',
  manual: 'Вручную',
}

export function Sync({ state, setState }: Props) {
  const [text, setText] = useState('')
  const [source, setSource] = useState<ImportSource>('text')
  const [diff, setDiff] = useState<DiffItem[] | null>(null)
  const [busy, setBusy] = useState<number | null>(null)
  const [batch, setBatch] = useState<{ index: number; total: number } | null>(null)
  const [error, setError] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)
  const abortRef = useRef<AbortController | null>(null)

  const days = daysSince(state.lastUpdated)

  const analyze = (src: ImportSource, value = text) => {
    setError('')
    const entries = parseInput(value)
    if (!entries.length) {
      setDiff(null)
      setError('Не удалось распознать ни одной строки.')
      return
    }
    setSource(src)
    setDiff(buildDiff(entries, state.champions))
  }

  const onFiles = async (files: File[]) => {
    setError('')
    try {
      const images = files.filter((f) => f.type.startsWith('image/'))
      const others = files.filter((f) => !f.type.startsWith('image/'))
      const parts: string[] = []
      const problems: string[] = []

      for (const f of others) parts.push(await f.text())

      if (images.length) {
        setBusy(0)
        setBatch({ index: 0, total: images.length })
        const ctl = new AbortController()
        abortRef.current = ctl
        const r = await ocrImages(
          images,
          (p, index, total) => {
            setBusy(p)
            setBatch({ index, total })
          },
          state.champions,
          ctl.signal,
        )
        if (ctl.signal.aborted && !r.text) return
        if (r.text) parts.push(r.text)
        problems.push(...r.failed.map((f) => `${f.name}: ${f.error}`))
      }

      const out = parts.join('\n')
      setText(out)
      const src: ImportSource =
        others.length === 0
          ? 'ocr'
          : images.length === 0 && others.length === 1 && /\.csv$/i.test(others[0].name)
            ? 'csv'
            : 'text'
      analyze(src, out)
      if (problems.length) setError((e) => `${e ? e + ' ' : ''}Не удалось обработать: ${problems.join('; ')}`)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ошибка чтения файла')
    } finally {
      abortRef.current = null
      setBusy(null)
      setBatch(null)
    }
  }

  const toggle = (id: string) =>
    setDiff((d) => d?.map((i) => (i.id === id ? { ...i, apply: !i.apply } : i)) ?? null)

  const apply = () => {
    if (!diff) return
    setState((s) => applyDiff(s, diff, source))
    setDiff(null)
    setText('')
  }

  const touch = () =>
    setState((s) => ({
      ...s,
      lastUpdated: new Date().toISOString(),
      history: [
        { id: Math.random().toString(36).slice(2, 10), at: new Date().toISOString(), source: 'manual' as const, summary: 'Данные подтверждены без изменений' },
        ...(s.history ?? []),
      ].slice(0, 50),
    }))

  const nApply = diff?.filter((i) => i.apply && i.kind !== 'same').length ?? 0

  return (
    <div>
      <div className="card">
        <h3>Последнее обновление</h3>
        <div>
          {state.lastUpdated
            ? `${new Date(state.lastUpdated).toLocaleString('ru-RU')} (${days} дн. назад)`
            : 'Ещё не обновлялось'}
        </div>
        <div className="row" style={{ marginTop: '.5rem' }}>
          <button onClick={touch}>Данные актуальны</button>
        </div>
      </div>

      <div className="card">
        <h3>Массовое обновление ростера</h3>
        <p className="muted">
          Вставьте список (например «Серси 6★ R2» на строку; звёздность 4–7) или CSV с колонками
          name, stars, rank, class, power (мощь). Можно выбрать сразу несколько скриншотов «Мои чемпионы» (например, прокрутку списка): повторы объединяются. Со скриншота читаются имена и
          мощь; звёзды и ранг на нём нарисованы иконками и не распознаются. Распознавание идёт
          в браузере, но языковые модели загружаются с CDN.
        </p>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={'Серси 6★ R2\nГорр, 6, 1\n\nили CSV:\nname;stars;rank;class\nСерси;6;2;Космос'}
        />
        <div className="row" style={{ marginTop: '.5rem' }}>
          <button onClick={() => analyze(text.includes(';') || text.includes('\t') ? 'csv' : 'text')}>
            Разобрать
          </button>
          <button onClick={() => fileRef.current?.click()} disabled={busy !== null}>
            Загрузить CSV / скриншоты
          </button>
          <input
            ref={fileRef}
            type="file"
            hidden
            multiple
            accept=".csv,.txt,text/*,image/*"
            onChange={(e) => {
              const picked = Array.from(e.target.files ?? [])
              e.target.value = ''
              if (picked.length) void onFiles(picked)
            }}
          />
          {busy !== null && (
            <span className="muted">
              Распознавание…{batch && batch.total > 1 ? ` файл ${batch.index + 1} из ${batch.total},` : ''} {Math.round(busy * 100)}%
            </span>
          )}
          {busy !== null && <button onClick={() => abortRef.current?.abort()}>Отмена</button>}
        </div>
        {error && <div style={{ color: 'var(--accent)', marginTop: '.5rem' }}>{error}</div>}
      </div>

      {diff && (
        <div className="card">
          <h3>Предпросмотр изменений ({SOURCE_LABEL[source]})</h3>
          <p className="muted">Проверьте результат — OCR может ошибаться. Снимите галочки с неверных строк.</p>
          {diff.map((i) => (
            <div key={i.id} className={`goal ${i.kind === 'same' ? 'done' : ''}`}>
              <input
                type="checkbox"
                checked={i.apply}
                disabled={i.kind === 'same'}
                onChange={() => toggle(i.id)}
              />
              <div style={{ flex: 1 }}>
                <div className="t">
                  {i.match ? i.match.name : i.entry.name}{' '}
                  <span className="badge">
                    {i.kind === 'new' ? 'новый' : i.kind === 'change' ? 'изменение' : 'без изменений'}
                  </span>
                </div>
                <div className="muted">
                  {i.changes.join(', ') || 'совпадает с текущими данными'}
                  {i.match && i.match.name !== i.entry.name && ` · распознано как «${i.entry.name}»`}
                </div>
              </div>
            </div>
          ))}
          <div className="row" style={{ marginTop: '.75rem' }}>
            <button onClick={apply} disabled={!nApply} style={{ background: 'var(--accent)' }}>
              Применить ({nApply})
            </button>
            <button onClick={() => setDiff(null)}>Отмена</button>
          </div>
        </div>
      )}

      <div className="card">
        <h3>История обновлений</h3>
        {(state.history ?? []).length === 0 && <div className="muted">Пока пусто</div>}
        {(state.history ?? []).map((h) => (
          <div key={h.id} className="goal">
            <div style={{ flex: 1 }}>
              <div>{h.summary}</div>
              <div className="muted">
                {new Date(h.at).toLocaleString('ru-RU')} · {SOURCE_LABEL[h.source]}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
