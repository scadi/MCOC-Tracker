import { useEffect, useRef, useState } from 'react'
import { MAX_RANK, STAR_LIST, type Champion, type Stars } from '../types'

interface Props {
  champ: Champion
  /** rank === undefined — убрать звёздность у героя */
  onChange: (stars: Stars, rank: number | undefined) => void
}

function StarIcon({ filled }: { filled: boolean }) {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
      <path
        d="M12 2.5l2.9 6.1 6.6.8-4.9 4.6 1.3 6.6L12 17.2 6.1 20.6l1.3-6.6L2.5 9.4l6.6-.8z"
        fill={filled ? 'currentColor' : 'none'}
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
    </svg>
  )
}

/**
 * Строка звёзд 4–7: заливка — звёздность есть у героя, контур — нет.
 * Под каждой звездой ранг. Клик по звезде открывает выбор ранга (поповер поверх карточки,
 * поэтому карточка не растёт).
 */
export function StarRanks({ champ, onChange }: Props) {
  const [open, setOpen] = useState<Stars | null>(null)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (open === null) return
    const away = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(null)
    }
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(null)
    document.addEventListener('mousedown', away)
    document.addEventListener('keydown', esc)
    return () => {
      document.removeEventListener('mousedown', away)
      document.removeEventListener('keydown', esc)
    }
  }, [open])

  const click = (s: Stars) => {
    if (champ.ranks[s] === undefined) onChange(s, 1) // нет звёздности — добавляем R1 и сразу даём выбрать ранг
    setOpen(open === s ? null : s)
  }

  return (
    <div className="stars" ref={ref}>
      {STAR_LIST.map((s) => {
        const rank = champ.ranks[s]
        const owned = rank !== undefined
        return (
          <div key={s} className="star-cell">
            <button
              type="button"
              className={`star-btn ${owned ? 'on' : 'off'} ${open === s ? 'open' : ''}`}
              onClick={() => click(s)}
              title={owned ? `${s}★, ранг R${rank} — изменить` : `${s}★ нет — добавить`}
              aria-expanded={open === s}
            >
              <StarIcon filled={owned} />
              <span>{s}</span>
            </button>
            <span className={`star-rank ${owned ? '' : 'none'}`}>{owned ? `R${rank}` : '—'}</span>

            {open === s && owned && (
              <div className="rank-pop" role="dialog" aria-label={`Ранг ${s}★`}>
                <div className="rank-pills">
                  {Array.from({ length: MAX_RANK[s] }, (_, i) => i + 1).map((r) => (
                    <button
                      key={r}
                      type="button"
                      className={r === rank ? 'active' : ''}
                      onClick={() => {
                        onChange(s, r)
                        setOpen(null)
                      }}
                    >
                      {r}
                    </button>
                  ))}
                </div>
                <button
                  type="button"
                  className="rank-remove"
                  onClick={() => {
                    onChange(s, undefined)
                    setOpen(null)
                  }}
                >
                  Убрать {s}★
                </button>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
