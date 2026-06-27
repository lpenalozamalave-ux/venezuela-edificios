// scripts/scraper/sources/localizados.js
// Public API: GET https://localizadosvenezuela.com/api/v1/localizados?page=N&limit=100
// No auth required. CORS open.

const BASE = 'https://localizadosvenezuela.com/api/v1'

async function fetchLocalizados() {
  const personas = []
  let page = 1
  let totalPages = 1

  console.log('[localizados] Fetching...')

  while (page <= totalPages) {
    const res = await fetch(`${BASE}/localizados?page=${page}&limit=100`)
    if (!res.ok) {
      console.error(`[localizados] HTTP ${res.status} on page ${page}`)
      break
    }

    const data = await res.json()
    totalPages = data.meta?.totalPages ?? 1

    for (const r of data.data ?? []) {
      personas.push({
        id: `loc-${r.slug}`,
        nombre: r.nombreCompleto ?? '',
        edad: r.edad ? parseInt(r.edad) : null,
        genero: 'Desconocido',
        cedula: r.cedula ?? null,
        zona: r.lugarNombre ?? null,
        ultimaUbicacion: r.lugarNombre ?? r.direccion ?? null,
        foto: null,
        contacto: null,
        reportadoEn: r.publicadoEn ?? new Date().toISOString(),
        estado: 'localizado',
        fuente: 'localizados',
        fuenteUrl: 'https://localizadosvenezuela.com/'
      })
    }

    console.log(`[localizados] Page ${page}/${totalPages}: ${data.data?.length ?? 0} records`)
    page++
    await new Promise(r => setTimeout(r, 200))
  }

  return personas
}

module.exports = { fetchLocalizados }
