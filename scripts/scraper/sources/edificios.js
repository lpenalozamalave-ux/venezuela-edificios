// scripts/scraper/sources/edificios.js
// Fetches collapsed/damaged buildings from terremotovenezuela.com via its Supabase backend.
// The site is a React SPA backed by Supabase (jckifxsdlnsvbztxydes.supabase.co).
// The anon/publishable key is embedded in the frontend bundle — no auth required.
//
// Table: buildings
// Relevant fields: id, name, address, city, zone, lat, lng, damage_level, status

const SUPABASE_URL = 'https://jckifxsdlnsvbztxydes.supabase.co'
const ANON_KEY = 'sb_publishable_i7iEDrCVZcSt0k3RGFrY4g_WrtZBB4w'
const PAGE_SIZE = 200

async function fetchEdificios() {
  const edificios = []
  let offset = 0
  let total = null

  console.log('[edificios] Fetching from terremotovenezuela.com (Supabase)...')

  while (total === null || offset < total) {
    const url = `${SUPABASE_URL}/rest/v1/buildings?select=id,name,address,city,zone,lat,lng,damage_level,status&order=name.asc&limit=${PAGE_SIZE}&offset=${offset}`

    const res = await fetch(url, {
      headers: {
        'apikey': ANON_KEY,
        'Authorization': `Bearer ${ANON_KEY}`,
        'Accept': 'application/json',
        'Prefer': 'count=exact'
      }
    })

    if (!res.ok) {
      console.error(`[edificios] HTTP ${res.status} at offset ${offset}`)
      break
    }

    // Parse Content-Range: 0-199/806
    if (total === null) {
      const contentRange = res.headers.get('content-range') || ''
      const rangeMatch = contentRange.match(/\/(\d+)$/)
      total = rangeMatch ? parseInt(rangeMatch[1]) : 0
      console.log(`[edificios] Total buildings: ${total}`)
    }

    const records = await res.json()

    for (const r of records) {
      edificios.push({
        id: r.id,
        nombre: r.name,
        direccion: r.address || '',
        sector: r.zone || r.city || '',
        daño: normalizeDano(r.damage_level),
        coordenadas: (r.lat && r.lng) ? { lat: r.lat, lng: r.lng } : null,
        totalDesaparecidos: 0,
        totalLocalizados: 0,
        totalFallecidos: 0
      })
    }

    console.log(`[edificios] Fetched ${edificios.length}/${total}`)
    offset += PAGE_SIZE

    if (records.length < PAGE_SIZE) break

    // Rate limit
    await new Promise(r => setTimeout(r, 300))
  }

  return edificios
}

function normalizeDano(level) {
  if (!level) return 'desconocido'
  const l = level.toLowerCase()
  if (l.includes('total') || l.includes('colapso')) return 'total'
  if (l.includes('sev') || l.includes('grave') || l.includes('mayor')) return 'severo'
  if (l.includes('parc') || l.includes('menor') || l.includes('leve')) return 'parcial'
  return 'desconocido'
}

module.exports = { fetchEdificios }
