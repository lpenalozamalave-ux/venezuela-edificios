// scripts/scraper/sources/vea2026.js
// Queries the Convex backend of vea2026.com directly.
// Endpoint: POST https://jovial-shepherd-115.convex.cloud/api/query
// Function: people:list — paginated by cursor

const CONVEX_URL = 'https://jovial-shepherd-115.convex.cloud/api/query'

async function fetchVea2026(status = 'missing') {
  const personas = []
  let cursor = null
  let page = 1

  console.log(`[vea2026] Fetching status="${status}"...`)

  while (true) {
    const body = JSON.stringify({
      path: 'people:list',
      args: {
        paginationOpts: { cursor, id: page, numItems: 100 },
        status
      },
      format: 'json'
    })

    const res = await fetch(CONVEX_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body
    })

    if (!res.ok) {
      console.error(`[vea2026] HTTP ${res.status} on page ${page}`)
      break
    }

    const data = await res.json()
    if (data.status !== 'success') {
      console.error(`[vea2026] Error:`, data.errorMessage)
      break
    }

    const { page: records, continueCursor, isDone } = data.value

    for (const r of records) {
      personas.push({
        id: r._id,
        nombre: r.fullName || r.normalizedName || '',
        edad: r.age ?? null,
        genero: normalizeGenero(r.gender),
        cedula: r.documentId ?? null,
        zona: r.zone ?? r.lastSeenLocation ?? null,
        ultimaUbicacion: r.lastSeenLocation ?? null,
        foto: r.images?.[0]?.url ?? null,
        contacto: r.contacts?.[0]?.phone ?? null,
        reportadoEn: new Date(r.reportedAt).toISOString(),
        estado: status === 'missing' ? 'desaparecido' : 'localizado',
        fuente: 'vea2026',
        fuenteUrl: 'https://www.vea2026.com/'
      })
    }

    console.log(`[vea2026] Page ${page}: ${records.length} records (total so far: ${personas.length})`)

    if (isDone || !continueCursor) break
    cursor = continueCursor
    page++

    await new Promise(r => setTimeout(r, 100))
  }

  return personas
}

function normalizeGenero(g) {
  if (!g) return 'Desconocido'
  const lower = g.toLowerCase()
  if (lower.includes('masc') || lower === 'm') return 'Masculino'
  if (lower.includes('fem') || lower === 'f') return 'Femenino'
  return 'Desconocido'
}

module.exports = { fetchVea2026 }
