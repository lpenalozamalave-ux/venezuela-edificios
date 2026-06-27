import fs from 'fs'
import path from 'path'
import type { EdificiosData, PersonasData, Stats, Persona } from './types'
import { getFallecidos } from './kv'

const DATA_DIR = path.join(process.cwd(), 'public/data')

function readJson<T>(filename: string): T {
  const filepath = path.join(DATA_DIR, filename)
  const content = fs.readFileSync(filepath, 'utf8')
  return JSON.parse(content) as T
}

export function getEdificios(): EdificiosData {
  return readJson<EdificiosData>('edificios.json')
}

export function getStats(): Stats {
  return readJson<Stats>('stats.json')
}

export async function getPersonasByEdificio(
  edificioId: string,
  page = 1,
  limit = 50
): Promise<{ personas: Persona[]; total: number }> {
  const { personas: all } = readJson<PersonasData>('personas.json')
  const fallecidos = await getFallecidos()

  const filtered = all
    .filter(p => p.edificioId === edificioId)
    .map(p => fallecidos.has(p.id) ? { ...p, estado: 'fallecido' as const } : p)

  const start = (page - 1) * limit
  return {
    personas: filtered.slice(start, start + limit),
    total: filtered.length
  }
}

export async function searchPersonas(
  q: string,
  page = 1,
  limit = 50
): Promise<{ personas: Persona[]; total: number }> {
  const { personas: all } = readJson<PersonasData>('personas.json')
  const fallecidos = await getFallecidos()
  const query = q.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')

  const filtered = all
    .filter(p => {
      const name = p.nombre.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
      const zona = (p.zonaOriginal ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
      return name.includes(query) || zona.includes(query)
    })
    .map(p => fallecidos.has(p.id) ? { ...p, estado: 'fallecido' as const } : p)

  const start = (page - 1) * limit
  return {
    personas: filtered.slice(start, start + limit),
    total: filtered.length
  }
}

export async function getPersonasSinEdificio(
  page = 1,
  limit = 50
): Promise<{ personas: Persona[]; total: number }> {
  const { personas: all } = readJson<PersonasData>('personas.json')
  const fallecidos = await getFallecidos()

  const filtered = all
    .filter(p => !p.edificioId)
    .map(p => fallecidos.has(p.id) ? { ...p, estado: 'fallecido' as const } : p)

  const start = (page - 1) * limit
  return {
    personas: filtered.slice(start, start + limit),
    total: filtered.length
  }
}
