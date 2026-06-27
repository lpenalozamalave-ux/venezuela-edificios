import type { FallecidoMark } from './types'

function getKv() {
  if (!process.env.KV_REST_API_URL || !process.env.KV_REST_API_TOKEN) return null
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require('@vercel/kv').kv
}

export async function markFallecido(personaId: string): Promise<void> {
  const kv = getKv()
  if (!kv) throw new Error('KV store not configured')
  const mark: FallecidoMark = {
    timestamp: new Date().toISOString(),
    reportadoPor: 'anónimo'
  }
  await kv.set(`fallecido:${personaId}`, mark)
}

export async function getFallecidos(): Promise<Set<string>> {
  const kv = getKv()
  if (!kv) return new Set()
  const keys = await kv.keys('fallecido:*')
  const ids = keys.map((k: string) => k.replace('fallecido:', ''))
  return new Set(ids)
}

export async function isFallecido(personaId: string): Promise<boolean> {
  const kv = getKv()
  if (!kv) return false
  const val = await kv.get(`fallecido:${personaId}`)
  return val !== null
}
