import type {
  AppState,
  Champion,
  ChampClass,
  HistoryEntry,
  ImportSource,
  Stars,
} from './types'
import { defaultTier, fmtPower, topStar } from './types'
import { uid } from './store'
import type { Worker } from 'tesseract.js'
import type { OcrCard } from './ocr'

export interface ParsedEntry {
  name: string
  stars?: Stars
  rank?: number
  cls?: ChampClass
  /** Мощь карточки (например 13619) */
  power?: number
  /** Исходная строка — для отображения */
  raw: string
}

export interface DiffItem {
  id: string
  entry: ParsedEntry
  /** Звёздность, к которой относится изменение (из записи или старшая у героя) */
  stars?: Stars
  match?: Champion
  kind: 'new' | 'change' | 'same'
  changes: string[]
  apply: boolean
}

const CLASS_ALIASES: Record<string, ChampClass> = {
  mystic: 'mystic', мистика: 'mystic', мист: 'mystic',
  tech: 'tech', technology: 'tech', технологии: 'tech', техно: 'tech',
  science: 'science', наука: 'science',
  cosmic: 'cosmic', космос: 'cosmic',
  skill: 'skill', навык: 'skill',
  mutant: 'mutant', мутант: 'mutant',
}

export const normalize = (s: string) =>
  s
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/\(.*?\)/g, ' ')
    .replace(/[^a-zа-я0-9]+/g, ' ')
    .trim()

function levenshtein(a: string, b: string): number {
  const dp = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)])
  for (let j = 0; j <= b.length; j++) dp[0][j] = j
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++)
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
      )
  return dp[a.length][b.length]
}

const toStars = (v: string | undefined): Stars | undefined => {
  const n = Number(v?.replace(/\D/g, ''))
  return n === 4 || n === 5 || n === 6 || n === 7 ? n : undefined
}
const toRank = (v: string | undefined) => {
  const n = Number(v?.replace(/\D/g, ''))
  return n >= 1 && n <= 6 ? n : undefined
}
const toClass = (v: string | undefined) => (v ? CLASS_ALIASES[normalize(v)] : undefined)
/** «13 619», «13619», «13.619» → 13619; вне разумного диапазона — undefined */
const toPower = (v: string | undefined) => {
  const n = Number(v?.replace(/\D/g, ''))
  return n >= 1000 && n <= 99999 ? n : undefined
}

/** Разбор CSV с заголовком: name/имя, stars/звёзды, rank/ранг, class/класс */
function parseCsv(text: string): ParsedEntry[] | null {
  const lines = text.split(/\r?\n/).filter((l) => l.trim())
  if (lines.length < 2) return null
  const delim = [';', '\t', ','].find((d) => lines[0].includes(d))
  if (!delim) return null
  const head = lines[0].split(delim).map((h) => normalize(h))
  const idx = (...keys: string[]) => head.findIndex((h) => keys.includes(h))
  const iName = idx('name', 'имя', 'champion', 'чемпион', 'название')
  if (iName < 0) return null
  const iStars = idx('stars', 'star', 'звезды', 'звезд')
  const iRank = idx('rank', 'ранг')
  const iClass = idx('class', 'класс')
  const iPower = idx('power', 'мощь', 'мощность')

  return lines.slice(1).flatMap((line) => {
    const c = line.split(delim).map((x) => x.trim().replace(/^"|"$/g, ''))
    const name = c[iName]
    if (!name) return []
    return [
      {
        name,
        stars: iStars >= 0 ? toStars(c[iStars]) : undefined,
        rank: iRank >= 0 ? toRank(c[iRank]) : undefined,
        cls: iClass >= 0 ? toClass(c[iClass]) : undefined,
        power: iPower >= 0 ? toPower(c[iPower]) : undefined,
        raw: line,
      },
    ]
  })
}

/** Свободный текст: «Серси 6★ R2 мощь 9 686», «Gorr 6* rank 3», «Небула, 6, 1» */
function parseFreeText(text: string): ParsedEntry[] {
  return text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .flatMap((raw) => {
      let rest = raw
      let stars: Stars | undefined
      let rank: number | undefined
      let cls: ChampClass | undefined
      let power: number | undefined

      // «мощь 13 619» — достаём первой, чтобы цифры не принять за звёзды и ранг
      const mPower = rest.match(/(?:мощь|мощность|power)\s*[:=]?\s*(\d{1,2}[\s ]\d{3}|\d{4,5})/i)
      if (mPower) {
        power = toPower(mPower[1])
        rest = rest.replace(mPower[0], ' ')
      }
      const mStars = rest.match(/\b([4-7])\s*(?:[★*☆]|зв\w*|star\w*)/i)
      if (mStars) {
        stars = toStars(mStars[1])
        rest = rest.replace(mStars[0], ' ')
      }
      const mRank = rest.match(/(?:\bR|\bР|ранг\s*|rank\s*)\s*([1-6])\b/i)
      if (mRank) {
        rank = toRank(mRank[1])
        rest = rest.replace(mRank[0], ' ')
      }
      for (const [alias, c] of Object.entries(CLASS_ALIASES)) {
        const re = new RegExp(`(^|[\\s,;(])${alias}(?=$|[\\s,;)])`, 'i')
        if (re.test(rest)) {
          cls = c
          rest = rest.replace(re, ' ')
          break
        }
      }
      // «Имя, 6, 2»
      const mCsv = rest.match(/^(.*?)[,;]\s*([4-7])\s*[,;]\s*([1-6])\s*$/)
      if (mCsv) {
        rest = mCsv[1]
        stars ??= toStars(mCsv[2])
        rank ??= toRank(mCsv[3])
      }
      const name = rest.replace(/[,;|:\-–—]+\s*$/g, '').replace(/^[\s\-•*\d.)]+(?=[A-Za-zА-Яа-я])/, '').trim()
      if (normalize(name).length < 2) return []
      return [{ name, stars, rank, cls, power, raw }]
    })
}

export function parseInput(text: string): ParsedEntry[] {
  return parseCsv(text) ?? parseFreeText(text)
}

/** Английские названия → русские имена из ростера */
export const EN_ALIASES: Record<string, string> = {
  rintrah: 'Ринтра', 'lady deathstrike': 'Леди Смертельный Удар', 'cassie lang': 'Кэсси Лэнг',
  cersei: 'Серси', gorr: 'Горр', 'arnim zola': 'Арним Зола', nebula: 'Небула',
  'mister fantastic': 'Мистер Фантастик', 'mr fantastic': 'Мистер Фантастик',
  'mister negative': 'Мистер Негатив', 'mr negative': 'Мистер Негатив',
  'falcon joaquin torres': 'Сокол (Хоакин Торрес)', 'joaquin torres': 'Сокол (Хоакин Торрес)',
  'the thing': 'Существо', thing: 'Существо', 'invisible woman': 'Невидимая Леди',
  'symbiote supreme': 'Верховный Симбиот', kindred: 'Киндред', 'vision aarkus': 'Вижн (Ааркус)',
  'squirrel girl': 'Девушка-Белка', hyperion: 'Гиперион', 'cosmic ghost rider': 'Космический Призрачный Гонщик',
  enchantress: 'Чаровница', hercules: 'Геркулес', hulkling: 'Халклинг', 'nick fury': 'Ник Фьюри',
  magik: 'Мэджик', 'cassandra nova': 'Кассандра Нова', vox: 'Вокс', sunspot: 'Санспот',
  'baron zemo': 'Барон Земо', scorpion: 'Скорпион', nimrod: 'Нимрод',
  'ant man future': 'Человек-Муравей (Будущее)', knull: 'Налл', juggernaut: 'Джаггернаут',
  'black widow claire voyant': 'Черная Вдова (Клэр Воянт)', 'anti venom': 'Антивеном', tremor: 'Дрожь',
}

/**
 * Русские названия, которых может не быть в ростере. Нужны, чтобы исправлять ошибки OCR
 * («КОАОСС» → «Колосс») при добавлении новых чемпионов.
 */
export const KNOWN_RU_NAMES = [
  'Колосс', 'Росомаха', 'Человек-Паук', 'Дэдпул', 'Танос', 'Тор', 'Железный Человек',
  'Капитан Америка', 'Халк', 'Доктор Стрэндж', 'Доктор Дум', 'Черная Пантера', 'Гамбит',
  'Циклоп', 'Магнето', 'Шторм', 'Зверь', 'Ртуть', 'Гроот', 'Ракета', 'Гамора', 'Дракс',
  'Звездный Лорд', 'Ванда', 'Алая Ведьма', 'Вижн', 'Соколиный Глаз', 'Черная Вдова',
  'Электра', 'Сорвиголова', 'Каратель', 'Венома', 'Веном', 'Карнаж', 'Локи', 'Хела',
  'Капитан Марвел', 'Мисс Марвел', 'Мордо', 'Апокалипсис', 'Дормамму', 'Галактус',
]

/** Исправляет ошибки OCR в имени нового чемпиона по ростеру и словарю известных имён */
export function canonicalName(name: string, champions: Champion[]): string {
  const key = normalize(name)
  if (key.length < 4) return name
  const pool = [...champions.map((c) => c.name), ...KNOWN_RU_NAMES]
  let best: string | undefined
  let bestD = Infinity
  for (const cand of pool) {
    const d = levenshtein(key, normalize(cand))
    if (d < bestD) {
      bestD = d
      best = cand
    }
  }
  return best && bestD <= (key.length >= 8 ? 2 : 1) ? best : name
}

/** Подбирает чемпиона из ростера: точное совпадение, вхождение, затем близкое (OCR-шум) */
export function findChampion(
  entry: ParsedEntry,
  champions: Champion[],
): Champion | undefined {
  const key = normalize(EN_ALIASES[normalize(entry.name)] ?? entry.name)
  if (!key) return undefined
  const exact = champions.find((c) => normalize(c.name) === key)
  if (exact) return exact
  const part = champions.find((c) => {
    const n = normalize(c.name)
    return n.length >= 4 && key.length >= 4 && (n.includes(key) || key.includes(n))
  })
  if (part) return part
  let best: Champion | undefined
  let bestD = Infinity
  for (const c of champions) {
    const n = normalize(c.name)
    const d = levenshtein(key, n)
    if (d < bestD) {
      bestD = d
      best = c
    }
  }
  const limit = key.length >= 8 ? 2 : 1
  return best && bestD <= limit ? best : undefined
}

export function buildDiff(entries: ParsedEntry[], champions: Champion[]): DiffItem[] {
  const seen = new Set<string>()
  return entries.flatMap((rawEntry): DiffItem[] => {
    let entry = rawEntry
    const match = findChampion(entry, champions)
    const stars = entry.stars ?? (match ? topStar(match) : undefined)
    const dedupe = `${match ? match.id : `new:${normalize(entry.name)}`}:${stars ?? ''}`
    if (seen.has(dedupe)) return []
    seen.add(dedupe)

    if (!match) {
      const fixed = canonicalName(entry.name, champions)
      if (fixed !== entry.name) entry = { ...entry, name: fixed }
      const label = `${entry.stars ?? 6}★ R${entry.rank ?? 1}${entry.power ? `, мощь ${fmtPower(entry.power)}` : ''}`
      return [{ id: uid(), entry, stars, kind: 'new', changes: [`добавить в ростер: ${label}`], apply: true }]
    }

    const changes: string[] = []
    if (stars) {
      const cur = match.ranks[stars]
      if (cur === undefined) changes.push(`добавить ${stars}★ R${entry.rank ?? 1}`)
      else if (entry.rank && entry.rank !== cur) changes.push(`${stars}★: R${cur} → R${entry.rank}`)
    }
    if (entry.cls && entry.cls !== match.cls) changes.push(`класс ${match.cls} → ${entry.cls}`)
    if (entry.power && stars) {
      const cur = match.power?.[stars]
      if (cur !== entry.power)
        changes.push(`мощь${stars ? ` ${stars}★` : ''}: ${cur ? fmtPower(cur) : '—'} → ${fmtPower(entry.power)}`)
    }
    return [
      {
        id: uid(),
        entry,
        stars,
        match,
        kind: changes.length ? 'change' : 'same',
        changes,
        apply: changes.length > 0,
      },
    ]
  })
}

export function applyDiff(
  state: AppState,
  items: DiffItem[],
  source: ImportSource,
): AppState {
  const active = items.filter((i) => i.apply && i.kind !== 'same')
  if (!active.length) return state

  const updated = state.champions.map((c) => {
    const mine = active.filter((i) => i.match?.id === c.id)
    if (!mine.length) return c
    const next: Champion = { ...c, ranks: { ...c.ranks } }
    for (const i of mine) {
      if (i.entry.cls) next.cls = i.entry.cls
      if (i.stars) next.ranks[i.stars] = i.entry.rank ?? next.ranks[i.stars] ?? 1
      if (i.stars && i.entry.power) next.power = { ...next.power, [i.stars]: i.entry.power }
    }
    return next
  })

  // Несколько строк про одного нового героя (разные звёзды) объединяем в одну карточку
  const fresh = new Map<string, Champion>()
  for (const i of active.filter((x) => x.kind === 'new')) {
    const stars: Stars = i.entry.stars ?? 6
    const k = normalize(i.entry.name)
    const cur = fresh.get(k)
    if (cur) {
      cur.ranks[stars] = i.entry.rank ?? 1
      if (i.entry.power) cur.power = { ...cur.power, [stars]: i.entry.power }
      continue
    }
    fresh.set(k, {
      id: uid(),
      name: i.entry.name,
      cls: i.entry.cls ?? 'science',
      ranks: { [stars]: i.entry.rank ?? 1 },
      power: i.entry.power ? { [stars]: i.entry.power } : undefined,
      tier: defaultTier(stars),
      note: i.entry.cls ? undefined : 'Класс не определён — проверьте',
    })
  }
  const added = [...fresh.values()]

  const nChanged = active.filter((i) => i.kind === 'change').length
  const summary = `Изменено: ${nChanged}, добавлено: ${added.length}`
  const now = new Date().toISOString()
  const entry: HistoryEntry = { id: uid(), at: now, source, summary }

  return {
    ...state,
    champions: [...updated, ...added],
    lastUpdated: now,
    history: [entry, ...(state.history ?? [])].slice(0, 50),
  }
}

/**
 * Масштабы для проходов OCR. Tesseract заметно «плавает» от масштаба к масштабу
 * (на одном скриншоте 8–11 из 12 имён), поэтому берём несколько проходов и голосуем.
 */
const OCR_SCALES = [1.5, 2, 2.5]

/** Лимит времени на один скриншот: зависший файл пропускается, а worker пересоздаётся */
const FILE_TIMEOUT_MS = 180_000

/** На экране ростера помещается десяток-другой карточек; больше — почти наверняка шум */
const MAX_CARDS = 40

/** Серый + отсечение тёмного фона + растяжение контраста (светлый текст на тёмном) */
function enhance(canvas: HTMLCanvasElement) {
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!
  const img = ctx.getImageData(0, 0, canvas.width, canvas.height)
  const d = img.data
  for (let i = 0; i < d.length; i += 4) {
    const g = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]
    d[i] = d[i + 1] = d[i + 2] = Math.max(0, Math.min(255, (g - 60) * 1.6))
  }
  ctx.putImageData(img, 0, 0)
}

function prepareForOcr(bmp: ImageBitmap, scale: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(bmp.width * scale)
  canvas.height = Math.round(bmp.height * scale)
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(bmp, 0, 0, canvas.width, canvas.height)
  enhance(canvas)
  return canvas
}

/**
 * «13 619» (+ иконка класса, которую Tesseract читает как лишнюю цифру: «13 6192»).
 * Берём 1–2 цифры, пробел и ровно три цифры; всё после них отбрасываем.
 */
export function parsePowerText(t: string): number | undefined {
  const m = t.match(/(\d{1,2})\s+(\d{3})/)
  const n = m ? Number(m[1] + m[2]) : NaN
  return n >= 1000 && n <= 99999 ? n : undefined
}

/**
 * Режим «строка» хорошо видит структуру («13 619», «7 2824»), но путает последнюю цифру;
 * режим «слово» читает цифры точнее, но склеивает число с иконкой («72824»).
 * Поэтому длину первой группы берём из строки, а цифры — из слова.
 */
export function combinePower(line: string, word: string): number | undefined {
  // Строка вида «10 240» целиком совпала со структурой — ей и верим (слово путает 0 и 9)
  const exact = line.trim().match(/^(\d{1,2}) (\d{3})$/)
  if (exact) return parsePowerText(line)
  const m = line.match(/(\d{1,2})\s+\d{3}/)
  const digits = word.replace(/\D/g, '')
  if (m) {
    const len = m[1].length + 3
    const n = Number(digits.slice(0, len))
    if (digits.length >= len && n >= 1000 && n <= 99999) return n
  }
  return parsePowerText(line) ?? parsePowerText(word)
}

/**
 * Читает мощь отдельным проходом по вырезанной области под именем: одна строка, только цифры.
 * Размеры считаем от высоты скриншота — интерфейс игры масштабируется по высоте.
 */
async function readPowerCrop(
  worker: Worker,
  bmp: ImageBitmap,
  box: OcrCard['box'],
  k: number,
): Promise<number | undefined> {
  const H = bmp.height
  const x = Math.max(0, box.x0 - 0.005 * H)
  const y = Math.min(H - 1, box.y1 + 0.003 * H)
  const w = Math.min(bmp.width - x, 0.15 * H)
  const h = Math.min(H - y, 0.045 * H)
  if (w < 4 || h < 4) return undefined
  const pad = 24
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(w * k) + pad * 2
  canvas.height = Math.round(h * k) + pad * 2
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!
  ctx.fillStyle = '#000'
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(bmp, x, y, w, h, pad, pad, Math.round(w * k), Math.round(h * k))
  enhance(canvas)
  await worker.setParameters({ tessedit_pageseg_mode: PSM_SINGLE_LINE })
  const line = (await worker.recognize(canvas)).data.text
  await worker.setParameters({ tessedit_pageseg_mode: PSM_SINGLE_WORD })
  const word = (await worker.recognize(canvas)).data.text
  return combinePower(line, word)
}

/** Режимы сегментации Tesseract (значения PSM); импортировать enum нельзя — библиотека грузится лениво */
const PSM_SINGLE_LINE = '7' as never
const PSM_SINGLE_WORD = '8' as never

/** Увеличения вырезки с мощью: каждое даёт независимый «голос», итог — самое частое значение */
const POWER_ZOOM = [3, 4, 6]

const UI_WORDS = new Set(['мои', 'чемпионы', 'реликвии', 'коллективы'])

/**
 * Объединяет карточки из нескольких проходов OCR.
 * Известные чемпионы ростера принимаются сразу. Остальные — только если есть кириллица,
 * не меньше 4 букв и имя встретилось минимум в двух проходах (одиночный мусор отсеивается).
 * Мощь выбирается голосованием: самое частое значение среди проходов.
 * Результат — строки «Имя мощь 13619», которые понимает parseInput.
 */
export function mergeOcrPasses(passes: OcrCard[][], champions: Champion[]): string[] {
  type Votes = Map<number, number>
  const vote = (v: Votes, p?: number) => p && v.set(p, (v.get(p) ?? 0) + 1)
  const best = (v: Votes) => [...v.entries()].sort((a, b) => b[1] - a[1] || b[0] - a[0])[0]?.[0]

  const known = new Map<string, { name: string; votes: Votes }>()
  const unknown: { name: string; key: string; passes: Set<number>; votes: Votes }[] = []

  passes.forEach((cards, pi) => {
    for (const { name, powers } of cards) {
      const key = normalize(name)
      if (key.length < 4 || !/[а-я]/.test(key)) continue
      if (key.split(' ').some((t) => UI_WORDS.has(t))) continue
      const match = findChampion({ name, raw: name }, champions)
      if (match) {
        const k = known.get(match.id) ?? { name: match.name, votes: new Map() }
        powers.forEach((p) => vote(k.votes, p))
        known.set(match.id, k)
        continue
      }
      const limit = key.length >= 8 ? 2 : 1
      const g = unknown.find((u) => levenshtein(u.key, key) <= limit)
      if (g) {
        g.passes.add(pi)
        powers.forEach((p) => vote(g.votes, p))
      } else {
        const u = { name, key, passes: new Set([pi]), votes: new Map() as Votes }
        powers.forEach((p) => vote(u.votes, p))
        unknown.push(u)
      }
    }
  })

  const line = (name: string, votes: Votes) => {
    const p = best(votes)
    return p ? `${name} мощь ${p}` : name
  }
  const fresh = unknown
    .filter((u) => u.passes.size >= 2)
    .map((u) => ({ name: canonicalName(u.name, champions), votes: u.votes }))
    .filter((u) => !champions.some((c) => normalize(c.name) === normalize(u.name)))
  const seen = new Set<string>()
  return [
    ...[...known.values()].map((k) => line(k.name, k.votes)),
    ...fresh.filter((u) => !seen.has(u.name) && seen.add(u.name)).map((u) => line(u.name, u.votes)),
  ]
}

export const STALE_DAYS = 14

export function daysSince(iso?: string): number | null {
  if (!iso) return null
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000)
}

/** Результат пакетного распознавания */
export interface OcrBatchResult {
  /** Объединённый текст (по чемпиону на строку), дубли между скриншотами убраны */
  text: string
  /** Файлы, которые не удалось распознать */
  failed: { name: string; error: string }[]
}

type TesseractWorker = Awaited<ReturnType<(typeof import('tesseract.js'))['createWorker']>>

/** Один скриншот: несколько проходов по масштабам, затем голосование. onProgress — 0..1 в пределах файла. */
async function ocrOne(
  worker: TesseractWorker,
  PSM: (typeof import('tesseract.js'))['PSM'],
  extractCards: typeof import('./ocr')['extractCards'],
  file: File,
  champions: Champion[],
  onProgress: (p: number) => void,
  setPageHandler: (h: ((p: number) => void) | null) => void,
  signal: AbortSignal,
): Promise<string[]> {
  const check = () => {
    if (signal.aborted) throw new Error('прервано')
  }
  // Единый прогресс 0..1: не убывает и обновляется только при смене целого процента.
  let pass = 0
  let shown = -1
  const report = (inPass: number) => {
    const total = (pass + Math.min(1, Math.max(0, inPass))) / OCR_SCALES.length
    const pct = Math.min(99, Math.floor(total * 100))
    if (pct > shown) {
      shown = pct
      onProgress(pct / 100)
    }
  }
  const PAGE_SHARE = 0.4
  await worker.setParameters({
    tessedit_pageseg_mode: PSM.SPARSE_TEXT,
    tessedit_char_whitelist: '',
  })
  const bmp = await createImageBitmap(file)
  try {
    const passes: OcrCard[][] = []
    for (const scale of OCR_SCALES) {
      check()
      const canvas = prepareForOcr(bmp, scale)
      setPageHandler((p) => report(p * PAGE_SHARE))
      report(0)
      const { data } = await worker.recognize(canvas, {}, { blocks: true })
      setPageHandler(null)
      report(PAGE_SHARE)
      const words = (data.blocks ?? [])
        .flatMap((b) => b.paragraphs.flatMap((p) => p.lines.flatMap((l) => l.words)))
        .map((w) => ({
          text: w.text,
          confidence: w.confidence,
          bbox: {
            x0: w.bbox.x0 / scale,
            y0: w.bbox.y0 / scale,
            x1: w.bbox.x1 / scale,
            y1: w.bbox.y1 / scale,
          },
        }))
      const cards = extractCards(words).slice(0, MAX_CARDS)
      // Мощь читаем отдельно: одна строка, только цифры — так Tesseract не путает иконку класса с цифрой
      await worker.setParameters({ tessedit_char_whitelist: '0123456789 ' })
      for (const [i, c] of cards.entries()) {
        for (const zoom of POWER_ZOOM) {
          check()
          const p = await readPowerCrop(worker, bmp, c.box, zoom)
          if (p) c.powers.push(p)
        }
        report(PAGE_SHARE + ((i + 1) / cards.length) * (1 - PAGE_SHARE))
      }
      await worker.setParameters({
        tessedit_pageseg_mode: PSM.SPARSE_TEXT,
        tessedit_char_whitelist: '',
      })
      passes.push(cards)
      pass++
    }
    return mergeOcrPasses(passes, champions)
  } finally {
    bmp.close()
  }
}

/**
 * Пакетно распознаёт несколько скриншотов ростера одним worker'ом (модели грузятся один раз).
 * Скриншот игры — не страница текста, поэтому: sparse-режим Tesseract, слова с координатами,
 * отбор блоков-имён (ocr.ts) и голосование по нескольким масштабам.
 * Скриншоты обрабатываются по очереди; перекрывающиеся чемпионы (прокрутка списка) объединяются,
 * ошибка в одном файле не прерывает остальные.
 * onProgress(общий прогресс 0..1, индекс текущего файла, всего файлов).
 */
export async function ocrImages(
  files: File[],
  onProgress: (p: number, index: number, total: number) => void,
  champions: Champion[] = [],
  signal?: AbortSignal,
): Promise<OcrBatchResult> {
  const [{ createWorker, PSM }, { extractCards }] = await Promise.all([
    import('tesseract.js'),
    import('./ocr'),
  ])
  const total = files.length
  let pageHandler: ((p: number) => void) | null = null
  const makeWorker = () =>
    createWorker(['rus', 'eng'], 1, {
      logger: (m: { status: string; progress: number }) => {
        if (m.status === 'recognizing text') pageHandler?.(m.progress)
      },
    })
  let worker = await makeWorker()
  const lines = new Map<string, string>()
  const failed: OcrBatchResult['failed'] = []
  try {
    for (const [i, file] of files.entries()) {
      if (signal?.aborted) break
      onProgress(i / total, i, total)

      // Отдельный контроллер на файл: срабатывает по таймауту или по отмене пользователем
      const ctl = new AbortController()
      const onUserAbort = () => ctl.abort()
      signal?.addEventListener('abort', onUserAbort)
      const timer = setTimeout(() => ctl.abort(), FILE_TIMEOUT_MS)
      const aborted = new Promise<never>((_, reject) =>
        ctl.signal.addEventListener('abort', () =>
          reject(new Error(signal?.aborted ? 'отменено' : 'превышено время ожидания')),
        ),
      )
      try {
        const out = await Promise.race([
          ocrOne(
            worker,
            PSM,
            extractCards,
            file,
            champions,
            (p) => onProgress((i + p) / total, i, total),
            (h) => {
              pageHandler = h
            },
            ctl.signal,
          ),
          aborted,
        ])
        for (const line of out) {
          const key = normalize(line.replace(/\s+мощь\s+\d+\s*$/, ''))
          const prev = lines.get(key)
          // при дубле предпочитаем строку с мощью
          if (!prev || (!/мощь/.test(prev) && /мощь/.test(line))) lines.set(key, line)
        }
      } catch (e) {
        pageHandler = null
        if (signal?.aborted) break
        failed.push({ name: file.name, error: e instanceof Error ? e.message : 'ошибка распознавания' })
        if (ctl.signal.aborted) {
          // worker мог зависнуть посреди распознавания — заменяем его новым
          await worker.terminate().catch(() => undefined)
          worker = await makeWorker()
        }
      } finally {
        clearTimeout(timer)
        signal?.removeEventListener('abort', onUserAbort)
      }
    }
    if (!signal?.aborted) onProgress(1, total - 1, total)
    return { text: [...lines.values()].join('\n'), failed }
  } finally {
    await worker.terminate().catch(() => undefined)
  }
}

/** Распознаёт один скриншот (обёртка над ocrImages) */
export async function ocrImage(
  file: File,
  onProgress: (p: number) => void,
  champions: Champion[] = [],
): Promise<string> {
  const r = await ocrImages([file], (p) => onProgress(p), champions)
  if (r.failed.length) throw new Error(r.failed[0].error)
  return r.text
}

