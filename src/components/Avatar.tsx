import { useRef, useState } from 'react'
import { CLASS_COLOR, type Champion } from '../types'
import { iconUrl } from '../hub'

const initials = (name: string) =>
  name
    .replace(/\(.*?\)/g, ' ')
    .split(/[\s-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join('')

/** Уменьшает картинку до квадрата size×size (cover) и возвращает JPEG data URL */
async function toIcon(file: File, size = 128): Promise<string> {
  const bmp = await createImageBitmap(file)
  const side = Math.min(bmp.width, bmp.height)
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = size
  const ctx = canvas.getContext('2d')!
  ctx.drawImage(
    bmp,
    (bmp.width - side) / 2,
    (bmp.height - side) / 2,
    side,
    side,
    0,
    0,
    size,
    size,
  )
  return canvas.toDataURL('image/jpeg', 0.85)
}

interface Props {
  champ: Champion
  onChange: (icon: string | undefined) => void
}

export function Avatar({ champ, onChange }: Props) {
  const ref = useRef<HTMLInputElement>(null)
  const [failed, setFailed] = useState(false)
  const color = CLASS_COLOR[champ.cls]
  const src = champ.icon ?? (champ.hubId && !failed ? iconUrl(champ.hubId) : undefined)

  return (
    <>
      <button
        type="button"
        className="avatar"
        style={{ borderColor: color, background: src ? color + '55' : color + '33' }}
        title={champ.icon ? 'Сменить иконку' : 'Загрузить свою иконку'}
        onClick={() => ref.current?.click()}
      >
        {src ? (
          <img src={src} alt={champ.name} loading="lazy" onError={() => setFailed(true)} />
        ) : (
          <span>{initials(champ.name)}</span>
        )}
      </button>
      <input
        ref={ref}
        type="file"
        accept="image/*"
        hidden
        onChange={async (e) => {
          const f = e.target.files?.[0]
          e.target.value = ''
          if (!f) return
          try {
            onChange(await toIcon(f))
          } catch {
            alert('Не удалось прочитать изображение')
          }
        }}
      />
    </>
  )
}
