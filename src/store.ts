import { useEffect, useState } from 'react'
import { seedState } from './data/seed'
import { migrate } from './migrate'
import type { AppState } from './types'

const KEY = 'mcoc-tracker-v1'

function load(): AppState {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as { version: number } & Record<string, unknown>
      if (parsed.version === 1 || parsed.version === 2) return migrate(parsed)
    }
  } catch {
    // повреждённые данные — используем seed
  }
  return structuredClone(seedState)
}

export function useAppState() {
  const [state, setState] = useState<AppState>(load)

  useEffect(() => {
    localStorage.setItem(KEY, JSON.stringify(state))
  }, [state])

  const reset = () => setState(structuredClone(seedState))
  return { state, setState, reset }
}

export function exportState(state: AppState) {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `mcoc-tracker-${new Date().toISOString().slice(0, 10)}.json`
  a.click()
  URL.revokeObjectURL(url)
}

export async function parseImport(file: File): Promise<AppState> {
  const data = JSON.parse(await file.text()) as { version: number } & Record<string, unknown>
  if (
    (data.version !== 1 && data.version !== 2) ||
    !Array.isArray(data.champions) ||
    !Array.isArray(data.goals)
  ) {
    throw new Error('Неверный формат файла')
  }
  return migrate(data)
}

export const uid = () => Math.random().toString(36).slice(2, 10)
