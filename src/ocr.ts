/**
 * Разбор результата OCR по координатам слов.
 *
 * Скриншот игры — это не страница текста: вокруг имён иконки, рамки и фон.
 * Поэтому вместо «сырого» текста Tesseract берём слова с координатами,
 * собираем из них блоки-имена и оставляем только те, под которыми есть
 * число (сила чемпиона) — так отсекаются заголовки, ник игрока и мусор.
 */

export interface OcrWord {
  text: string
  confidence: number
  bbox: { x0: number; y0: number; x1: number; y1: number }
}

interface W {
  text: string
  conf: number
  x0: number
  y0: number
  x1: number
  y1: number
  h: number
}

interface Line {
  words: W[]
  x0: number
  y0: number
  x1: number
  y1: number
  h: number
}

interface Block {
  lines: Line[]
  x0: number
  x1: number
  y1: number
  h: number
}

const MIN_CONF = 40
const LETTER = /[A-Za-zА-Яа-яЁё]/g

const letters = (s: string) => (s.match(LETTER) ?? []).length

/** Латинские двойники кириллицы: игра русская, Tesseract часто путает «КОЛОСС» и «KOAOCC» */
const LOOKALIKE: Record<string, string> = {
  A: 'А', B: 'В', C: 'С', E: 'Е', H: 'Н', K: 'К', M: 'М', O: 'О', P: 'Р', T: 'Т', X: 'Х', Y: 'У',
  a: 'а', c: 'с', e: 'е', o: 'о', p: 'р', x: 'х', y: 'у',
}

/** Если все латинские буквы слова имеют кириллического двойника — считаем слово русским */
function fixScript(s: string): string {
  const latin = s.match(/[A-Za-z]/g)
  if (!latin) return s
  if (!latin.every((ch) => LOOKALIKE[ch])) return s
  return s.replace(/[A-Za-z]/g, (ch) => LOOKALIKE[ch])
}

/** Слово-кандидат в имя: в основном буквы, без одиночного мусора */
function toNameWord(w: OcrWord): W | null {
  const text = w.text.replace(/^[^A-Za-zА-Яа-яЁё]+|[^A-Za-zА-Яа-яЁё.]+$/g, '')
  if (w.confidence < MIN_CONF) return null
  if (letters(text) < 2 || letters(text) / text.length < 0.8) return null
  const { x0, y0, x1, y1 } = w.bbox
  const h = y1 - y0
  // Слишком высокие «слова» — это рамки и иконки, распознанные как текст
  if (h < 8 || h > 60 || x1 - x0 < h * 0.5) return null
  return { text: fixScript(text), conf: w.confidence, x0, y0, x1, y1, h }
}

/** Число (сила чемпиона) — якорь под именем */
function toNumberWord(w: OcrWord): W | null {
  if (w.confidence < 40) return null
  // Tesseract часто режет «9 287» на «9» и «287», поэтому достаточно одной цифры
  const digits = (w.text.match(/\d/g) ?? []).length
  if (digits < 1 || digits / w.text.replace(/\s/g, '').length < 0.5) return null
  const { x0, y0, x1, y1 } = w.bbox
  return { text: w.text, conf: w.confidence, x0, y0, x1, y1, h: y1 - y0 }
}

function groupLines(words: W[]): Line[] {
  const sorted = [...words].sort((a, b) => a.y0 - b.y0 || a.x0 - b.x0)
  const lines: Line[] = []
  for (const w of sorted) {
    const cy = (w.y0 + w.y1) / 2
    const line = lines.find((l) => {
      const lcy = (l.y0 + l.y1) / 2
      const last = l.words[l.words.length - 1]
      return (
        Math.abs(cy - lcy) < Math.min(l.h, w.h) * 0.5 &&
        Math.max(l.h, w.h) / Math.min(l.h, w.h) < 1.5 &&
        w.x0 - last.x1 < Math.max(l.h, w.h) * 1.6 &&
        w.x0 >= last.x0
      )
    })
    if (line) {
      line.words.push(w)
      line.x0 = Math.min(line.x0, w.x0)
      line.x1 = Math.max(line.x1, w.x1)
      line.y0 = Math.min(line.y0, w.y0)
      line.y1 = Math.max(line.y1, w.y1)
      line.h = Math.max(line.h, w.h)
    } else {
      lines.push({ words: [w], x0: w.x0, y0: w.y0, x1: w.x1, y1: w.y1, h: w.h })
    }
  }
  return lines
}

/** Склеивает строки в блоки: имя может занимать две строки («ЛЕДИ СМЕРТЕЛЬНЫЙ / УДАР») */
function groupBlocks(lines: Line[]): Block[] {
  const sorted = [...lines].sort((a, b) => a.y0 - b.y0 || a.x0 - b.x0)
  const blocks: Block[] = []
  for (const l of sorted) {
    const b = blocks.find((bl) => {
      const gap = l.y0 - bl.y1
      return (
        gap > -bl.h * 0.3 &&
        gap < bl.h * 0.8 &&
        Math.abs(l.x0 - bl.x0) < bl.h * 1.2 &&
        Math.max(l.h, bl.h) / Math.min(l.h, bl.h) < 1.5
      )
    })
    if (b) {
      b.lines.push(l)
      b.x1 = Math.max(b.x1, l.x1)
      b.y1 = Math.max(b.y1, l.y1)
      b.h = Math.max(b.h, l.h)
    } else {
      blocks.push({ lines: [l], x0: l.x0, x1: l.x1, y1: l.y1, h: l.h })
    }
  }
  return blocks
}

const CYR = /[А-Яа-яЁё]/

/** Слова блока; в русском имени выкидываем латинский шум («КЭССИ ASHI» → «КЭССИ») */
function blockWords(b: Block): W[] {
  const all = b.lines.flatMap((l) => l.words)
  return all.some((w) => CYR.test(w.text)) ? all.filter((w) => CYR.test(w.text)) : all
}

/** «МИСТЕР НЕГАТИВ» → «Мистер Негатив»: так имена выглядят в ростере */
const titleCase = (s: string) => s.toLowerCase().replace(/(^|[\s-])(\S)/g, (_, a: string, b: string) => a + b.toUpperCase())

const blockText = (b: Block) => titleCase(blockWords(b).map((w) => w.text).join(' '))

/** Уверенно распознанное крупное капсовое имя — признак карточки даже без числа под ним */
function looksLikeName(b: Block): boolean {
  const ws = blockWords(b)
  const text = ws.map((w) => w.text).join('')
  if (letters(text) < 4) return false
  const conf = ws.reduce((a, w) => a + w.conf, 0) / ws.length
  return conf >= 85 && text === text.toUpperCase()
}

/** Карточка чемпиона, найденная на скриншоте */
export interface OcrCard {
  name: string
  /** Варианты мощи под именем — заполняются отдельным проходом по вырезанной области (см. sync.ts) */
  powers: number[]
  /** Положение имени в пикселях исходного скриншота: слева, низ, высота строки */
  box: { x0: number; y1: number; h: number }
}

/**
 * Возвращает карточки чемпионов (имя + мощь) сверху вниз.
 * Если на скриншоте нет чисел под именами (другая раскладка) — возвращает все блоки.
 */
export function extractCards(words: OcrWord[]): OcrCard[] {
  const nameWords = words.map(toNameWord).filter((w): w is W => !!w)
  const numbers = words.map(toNumberWord).filter((w): w is W => !!w)
  const blocks = groupBlocks(groupLines(nameWords))

  const hasNumber = (b: Block) =>
    numbers.some(
      (n) =>
        n.y0 >= b.y1 - b.h * 0.3 &&
        n.y0 <= b.y1 + b.h * 2.5 &&
        n.x0 >= b.x0 - b.h * 1.5 &&
        n.x0 <= b.x1 + b.h,
    )
  const strict = blocks.filter(hasNumber)
  // Шапка и вкладки («МОИ ЧЕМПИОНЫ») выше первой карточки — их не берём
  const top = strict.length ? Math.min(...strict.map((b) => b.lines[0].y0)) : Infinity
  const anchored = blocks.filter(
    (b) => hasNumber(b) || (looksLikeName(b) && b.lines[0].y0 >= top - b.h),
  )

  const chosen = anchored.length >= 3 ? anchored : blocks
  const cards: OcrCard[] = chosen
    .sort((a, b) => a.lines[0].y0 - b.lines[0].y0 || a.x0 - b.x0)
    .map((b) => ({
      name: blockText(b),
      powers: [],
      box: { x0: b.x0, y1: b.y1, h: b.h },
    }))
  // Строка мощи у всех карточек ряда на одной высоте, а нижний край имени зависит от числа
  // строк в названии («РИНТРА» против «ЛЕДИ СМЕРТЕЛЬНЫЙ / УДАР»). Берём самый нижний край в ряду.
  const real = (c: OcrCard) => letters(c.name) >= 4 && /[А-Яа-яЁё]/.test(c.name)
  const base = cards.map((c) => c.box.y1)
  cards.forEach((c, i) => {
    const row = cards.filter((o, j) => real(o) && Math.abs(base[j] - base[i]) < c.box.h * 3)
    if (row.length) c.box.y1 = Math.max(...row.map((o) => o.box.y1))
  })
  return cards
}
