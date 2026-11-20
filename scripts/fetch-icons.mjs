// Скачивает портреты из public/champions.json в public/icons/<id>.webp
// Запуск: npm run fetch:icons   (сначала npm run fetch:champions)
import { mkdir, readFile, writeFile, access } from 'node:fs/promises'

const { champions } = JSON.parse(await readFile('public/champions.json', 'utf8'))
await mkdir('public/icons', { recursive: true })

const exists = (p) => access(p).then(() => true, () => false)
let ok = 0, skipped = 0
const failed = []

async function one(c) {
  const file = `public/icons/${c.id}.webp`
  if (await exists(file)) { skipped++; return }
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await fetch(c.portrait, { headers: { 'User-Agent': 'mcoc-tracker (personal use)' } })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const type = res.headers.get('content-type') ?? ''
      if (!type.startsWith('image/')) throw new Error(`не изображение: ${type}`)
      await writeFile(file, Buffer.from(await res.arrayBuffer()))
      ok++
      return
    } catch (e) {
      if (attempt === 3) failed.push(`${c.id}: ${e.message}`)
      else await new Promise((r) => setTimeout(r, 500 * attempt))
    }
  }
}

// Не больше 6 запросов одновременно, чтобы не нагружать CDN
const queue = [...champions]
await Promise.all(
  Array.from({ length: 6 }, async () => {
    while (queue.length) await one(queue.shift())
  }),
)

console.log(`Скачано: ${ok}, уже было: ${skipped}, ошибок: ${failed.length}`)
if (failed.length) console.log(failed.join('\n'))
