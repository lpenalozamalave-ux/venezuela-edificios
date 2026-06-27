// scripts/scraper/sources/venezuelatebusca.js
// Uses kernel.sh cloud browser to scrape venezuelatebusca.com
// The site loads via Remix SSR and blocks direct fetch (403).
// We drive it with Playwright via the kernel.sh browser API.
//
// kernel.sh endpoints:
//   POST https://api.onkernel.com/browsers
//     body: { timeout_seconds: 300 }
//     → { session_id: string }
//
//   POST https://api.onkernel.com/browsers/{sessionId}/playwright/execute
//     body: { code: string, timeout_sec: number }
//     → { success: boolean, result: any }

const KERNEL_API = 'https://api.onkernel.com'

// --- kernel.sh helpers ---

async function createBrowser(apiKey) {
  const res = await fetch(`${KERNEL_API}/browsers`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ timeout_seconds: 300 }),
  })
  if (!res.ok) {
    const body = await res.text()
    throw new Error(`[venezuelatebusca] createBrowser HTTP ${res.status}: ${body}`)
  }
  const data = await res.json()
  if (!data.session_id) throw new Error(`[venezuelatebusca] createBrowser: no session_id in response`)
  return data.session_id
}

async function runPlaywright(apiKey, sessionId, code, timeoutSec = 120) {
  const res = await fetch(`${KERNEL_API}/browsers/${sessionId}/playwright/execute`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ code, timeout_sec: timeoutSec }),
  })
  if (!res.ok) {
    const body = await res.text()
    throw new Error(`[venezuelatebusca] runPlaywright HTTP ${res.status}: ${body}`)
  }
  const data = await res.json()
  if (!data.success) {
    throw new Error(`[venezuelatebusca] Playwright execution failed: ${JSON.stringify(data)}`)
  }
  return data.result
}

// --- ID generation ---
// id = 'vtb-' + first 20 chars of base64(nombre + fecha)

function makeId(nombre, fecha) {
  const raw = (nombre || '') + (fecha || '')
  return 'vtb-' + Buffer.from(raw).toString('base64').slice(0, 20)
}

// --- Card parser ---
// Parses a raw card object extracted from the DOM into a RawPersona

function parseCard(card) {
  if (!card || !card.nombre) return null

  // Try to extract age and gender from info line e.g. "34 años · Masculino"
  const ageGenderMatch = (card.info || '').match(/(\d+)\s*a[ñn]os?\s*[·•\-]?\s*(Masculino|Femenino)/i)
  const edad = ageGenderMatch ? parseInt(ageGenderMatch[1], 10) : null
  const generoRaw = ageGenderMatch ? ageGenderMatch[2] : null
  const genero =
    generoRaw === 'Femenino' ? 'Femenino'
    : generoRaw === 'Masculino' ? 'Masculino'
    : 'Desconocido'

  const nombre = (card.nombre || '').trim()
  const fecha = (card.fecha || '').trim() || new Date().toISOString()
  const zona = (card.ubicacion || '').trim() || null

  return {
    id: makeId(nombre, fecha),
    nombre,
    edad,
    genero,
    cedula: null,
    zona,
    ultimaUbicacion: zona,
    foto: null,
    contacto: null,
    reportadoEn: fecha ? (() => {
      try { return new Date(fecha).toISOString() } catch { return new Date().toISOString() }
    })() : new Date().toISOString(),
    estado: 'desaparecido',
    fuente: 'venezuelatebusca',
    fuenteUrl: 'https://venezuelatebusca.com/',
  }
}

// --- Playwright code builders ---
// These return strings of JS that run inside the kernel.sh Playwright context.
// The `page` variable is pre-injected by kernel.sh.

function buildGetTotalCode() {
  return `
    await page.goto('https://venezuelatebusca.com/', { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(2000);
    const text = await page.evaluate(() => document.body.innerText);
    const match = text.match(/([\\d.,]+)\\s*Personas registradas/i);
    return { total: match ? parseInt(match[1].replace(/[.,]/g, '')) : 0, text: text.slice(0, 500) };
  `
}

function buildScrapePageCode(pageNum) {
  const nextPageNum = pageNum + 1
  return `
    await page.goto('https://venezuelatebusca.com/?page=${pageNum}', { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(2000);

    const result = await page.evaluate(() => {
      const cards = [];

      // Try multiple selector strategies for person cards
      const selectors = [
        '[class*="card"]',
        '[class*="persona"]',
        '[class*="person"]',
        'article',
        '[data-id]',
        '[class*="result"]',
        '[class*="item"]',
        'li[class]',
      ];

      let items = [];
      for (const sel of selectors) {
        const found = Array.from(document.querySelectorAll(sel));
        // Only use if we find a reasonable number (likely person cards, not nav/footer)
        if (found.length >= 3 && found.length <= 500) {
          items = found;
          break;
        }
      }

      items.forEach(el => {
        const text = (el.innerText || '').trim();
        const lines = text.split('\\n').map(l => l.trim()).filter(Boolean);
        if (lines.length < 1) return;
        if (lines[0].length < 3 || lines[0].length > 100) return; // likely not a name

        cards.push({
          nombre: lines[0] || null,
          info: lines[1] || null,
          ubicacion: lines[2] || null,
          fecha: lines[3] || null,
        });
      });

      // Check if next page exists
      const hasNext =
        document.querySelector('a[href*="page=${nextPageNum}"]') !== null ||
        document.querySelector('[class*="next"]') !== null ||
        document.querySelector('[class*="cargar"]') !== null ||
        document.querySelector('[class*="load-more"]') !== null;

      return { cards, hasNext };
    });

    return result;
  `
}

// --- Main export ---

async function fetchVenezuelaTeBusca() {
  const apiKey = process.env.KERNEL_API_KEY
  if (!apiKey) throw new Error('KERNEL_API_KEY env var required')

  console.log('[venezuelatebusca] Creating browser session...')
  const sessionId = await createBrowser(apiKey)
  console.log(`[venezuelatebusca] Session: ${sessionId}`)

  const personas = []

  try {
    // Step 1: Get total count
    let total = 0
    try {
      const countResult = await runPlaywright(apiKey, sessionId, buildGetTotalCode(), 60)
      total = (countResult && countResult.total) ? countResult.total : 0
      console.log(`[venezuelatebusca] Reported total: ${total} personas`)
    } catch (err) {
      console.warn(`[venezuelatebusca] Could not get total count: ${err.message}`)
      total = 35000 // fallback upper bound from task context
    }

    // Step 2: Paginate through person cards
    let pageNum = 1
    let consecutiveEmptyPages = 0
    const MAX_EMPTY = 3
    const MAX_PAGES = Math.ceil(total / 20) + 10 // generous upper bound

    while (pageNum <= MAX_PAGES && consecutiveEmptyPages < MAX_EMPTY) {
      let result
      try {
        result = await runPlaywright(apiKey, sessionId, buildScrapePageCode(pageNum), 120)
      } catch (err) {
        console.error(`[venezuelatebusca] Page ${pageNum} error: ${err.message}`)
        consecutiveEmptyPages++
        pageNum++
        continue
      }

      const cards = (result && result.cards) ? result.cards : []
      const hasNext = (result && result.hasNext) ? result.hasNext : false

      if (cards.length === 0) {
        consecutiveEmptyPages++
        console.log(`[venezuelatebusca] Page ${pageNum}: 0 cards (empty #${consecutiveEmptyPages})`)
      } else {
        consecutiveEmptyPages = 0
        let parsed = 0
        for (const card of cards) {
          const persona = parseCard(card)
          if (persona) {
            personas.push(persona)
            parsed++
          }
        }
        console.log(`[venezuelatebusca] Page ${pageNum}: ${parsed}/${cards.length} cards parsed (total: ${personas.length})`)
      }

      // Stop if no next-page signal or we've exceeded expected count
      if (!hasNext && pageNum > 1) {
        console.log(`[venezuelatebusca] No next page detected after page ${pageNum}. Stopping.`)
        break
      }

      if (total > 0 && personas.length >= total) {
        console.log(`[venezuelatebusca] Reached reported total (${total}). Stopping.`)
        break
      }

      pageNum++
      // Polite delay between pages
      await new Promise(r => setTimeout(r, 1000))
    }
  } finally {
    // Browser auto-terminates after timeout_seconds — no explicit close needed
    console.log(`[venezuelatebusca] Done. Total scraped: ${personas.length}`)
  }

  return personas
}

module.exports = { fetchVenezuelaTeBusca }
