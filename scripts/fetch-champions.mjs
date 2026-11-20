// Выгружает список чемпионов (id, имя, класс, URL портрета) со страницы mcoc.help
// в public/champions.json. Запуск: npm run fetch:champions
import { mkdir, writeFile } from 'node:fs/promises'

const URL_PAGE = 'https://www.mcoc.help/champions/'

const res = await fetch(URL_PAGE, { headers: { 'User-Agent': 'mcoc-tracker (personal use)' } })
if (!res.ok) throw new Error(`HTTP ${res.status}`)
const html = await res.text()

// Next.js RSC: данные лежат в строках self.__next_f.push([1,"..."])
let payload = ''
for (const m of html.matchAll(/self\.__next_f\.push\(\[1,("(?:[^"\\]|\\.)*")\]\)/g)) {
  payload += JSON.parse(m[1])
}

const start = payload.indexOf('"champions":[')
if (start < 0) throw new Error('Массив champions не найден — структура страницы изменилась')

// Вырезаем сбалансированный JSON-массив
let i = payload.indexOf('[', start)
const from = i
let depth = 0
let inStr = false
for (; i < payload.length; i++) {
  const ch = payload[i]
  if (inStr) {
    if (ch === '\\') i++
    else if (ch === '"') inStr = false
  } else if (ch === '"') inStr = true
  else if (ch === '[') depth++
  else if (ch === ']' && --depth === 0) break
}
const raw = JSON.parse(payload.slice(from, i + 1))

const champions = raw
  .filter((c) => c.id && c.name && c.portraitUrl)
  .map((c) => ({
    id: c.id,
    name: c.name,
    class: String(c.class).toLowerCase(),
    portrait: c.portraitUrl,
  }))

await mkdir('public', { recursive: true })
await writeFile(
  'public/champions.json',
  JSON.stringify({ source: URL_PAGE, fetchedAt: new Date().toISOString(), champions }, null, 1),
)
console.log(`Сохранено чемпионов: ${champions.length}`)
