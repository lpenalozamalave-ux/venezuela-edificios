import { kv } from '@vercel/kv'
import type { FallecidoMark } from './types'

export async function markFallecido(personaId: string): Promise<void> {
  const mark: FallecidoMark = {
    timestamp: new Date().toISOString(),
    reportadoPor: 'anónimo'
  }
  await kv.set(`fallecido:${personaId}`, mark)
}

export async function getFallecidos(): Promise<Set<string>> {
  const keys = await kv.keys('fallecido:*')
  const ids = keys.map(k => k.replace('fallecido:', ''))
  return new Set(ids)
}

export async function isFallecido(personaId: string): Promise<boolean> {
  const val = await kv.get(`fallecido:${personaId}`)
  return val !== null
}
