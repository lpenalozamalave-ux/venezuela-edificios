// scripts/scraper/index.js
const { fetchEdificios } = require('./sources/edificios')
const { fetchVea2026 } = require('./sources/vea2026')
const { fetchVenezuelaTeBusca } = require('./sources/venezuelatebusca')
const { fetchLocalizados } = require('./sources/localizados')
const { matchEdificio } = require('./matcher')
const { writeJson } = require('./writer')

async function run() {
  console.log('=== Venezuela Edificios Scraper ===')
  const updatedAt = new Date().toISOString()

  // 1. Fetch edificios first (needed for matching)
  console.log('\n[1/4] Fetching edificios...')
  const edificios = await fetchEdificios()
  console.log(`✓ ${edificios.length} edificios`)

  // 2. Fetch all person sources in parallel
  console.log('\n[2/4] Fetching person sources in parallel...')
  const [vea2026, vtb, localizados] = await Promise.allSettled([
    fetchVea2026('missing'),
    fetchVenezuelaTeBusca(),
    fetchLocalizados()
  ])

  if (vea2026.status === 'rejected') console.error('[vea2026] Failed:', vea2026.reason?.message)
  if (vtb.status === 'rejected') console.error('[venezuelatebusca] Failed:', vtb.reason?.message)
  if (localizados.status === 'rejected') console.error('[localizados] Failed:', localizados.reason?.message)

  const rawPersonas = [
    ...(vea2026.status === 'fulfilled' ? vea2026.value : []),
    ...(vtb.status === 'fulfilled' ? vtb.value : []),
    ...(localizados.status === 'fulfilled' ? localizados.value : []),
  ]
  console.log(`✓ ${rawPersonas.length} personas total`)

  // 3. Fuzzy match each persona to an edificio
  console.log('\n[3/4] Running fuzzy matching...')
  let matched = 0
  const personas = rawPersonas.map(p => {
    const match = matchEdificio(p.zona, edificios)
    if (match) {
      matched++
      return { ...p, edificioId: match.edificioId, edificioNombre: match.edificioNombre }
    }
    return { ...p, edificioId: null, edificioNombre: null }
  })

  const matchPct = personas.length > 0 ? Math.round(matched / personas.length * 100) : 0
  console.log(`✓ ${matched}/${personas.length} personas matched to buildings (${matchPct}%)`)

  // 4. Compute totals per edificio
  console.log('\n[4/4] Computing stats and writing JSON...')
  const countsByEdificio = {}
  for (const p of personas) {
    if (!p.edificioId) continue
    if (!countsByEdificio[p.edificioId]) {
      countsByEdificio[p.edificioId] = { totalDesaparecidos: 0, totalLocalizados: 0, totalFallecidos: 0 }
    }
    if (p.estado === 'desaparecido') countsByEdificio[p.edificioId].totalDesaparecidos++
    else if (p.estado === 'localizado') countsByEdificio[p.edificioId].totalLocalizados++
    else if (p.estado === 'fallecido') countsByEdificio[p.edificioId].totalFallecidos++
  }

  const edificiosWithCounts = edificios.map(e => ({
    ...e,
    ...(countsByEdificio[e.id] ?? { totalDesaparecidos: 0, totalLocalizados: 0, totalFallecidos: 0 })
  })).sort((a, b) => b.totalDesaparecidos - a.totalDesaparecidos)

  const stats = {
    updatedAt,
    totalEdificios: edificios.length,
    totalPersonas: personas.length,
    totalDesaparecidos: personas.filter(p => p.estado === 'desaparecido').length,
    totalLocalizados: personas.filter(p => p.estado === 'localizado').length,
    totalFallecidos: 0,
    sinEdificio: personas.filter(p => !p.edificioId).length
  }

  writeJson('edificios.json', { updatedAt, total: edificiosWithCounts.length, edificios: edificiosWithCounts })
  writeJson('personas.json', { updatedAt, total: personas.length, personas })
  writeJson('stats.json', stats)

  console.log('\n=== Done ===')
  console.log(JSON.stringify(stats, null, 2))
}

run().catch(err => {
  console.error('Scraper failed:', err)
  process.exit(1)
})
