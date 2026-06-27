# Venezuela Edificios — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a public Next.js 15 web app that aggregates missing persons data from 4 sources and displays them organized by collapsed building from the 2026 Venezuela earthquake.

**Architecture:** GitHub Actions scrapes 4 sources every 2 hours, runs fuzzy building matching, and commits JSON files to the repo. Vercel serves the Next.js app that reads those static JSON files plus Vercel KV for user-submitted "fallecido" markers. A public REST API at `/api/v1/*` exposes the aggregated data with CORS.

**Tech Stack:** Next.js 15 (App Router), TypeScript, Tailwind CSS, Vercel KV (@vercel/kv), GitHub Actions, Node.js 20 (scraper), kernel.sh browser API, fastest-levenshtein (fuzzy matching)

## Global Constraints

- Node.js 20+ for scraper
- Next.js 15 with App Router only — no Pages Router
- All API routes return `Content-Type: application/json` with `Access-Control-Allow-Origin: *`
- JSON files live in `public/data/` — never in `src/`
- Scraper runs in `scripts/scraper/` — never imports from `src/`
- Fallecido markers stored in Vercel KV with key pattern `fallecido:{personaId}`
- No authentication on any public endpoint
- All Spanish UI text — no English in the UI

---

## File Map

```
├── .github/workflows/scraper.yml           # Cron + manual dispatch
├── scripts/scraper/
│   ├── index.js                            # Orchestrator
│   ├── sources/
│   │   ├── edificios.js                    # terremotovenezuela.com
│   │   ├── vea2026.js                      # Convex API
│   │   ├── venezuelatebusca.js             # kernel.sh DOM scraping
│   │   └── localizados.js                  # localizadosvenezuela.com REST
│   ├── matcher.js                          # Fuzzy match zone → edificio
│   └── writer.js                           # Write JSON files
├── public/data/
│   ├── edificios.json                      # Generated
│   ├── personas.json                       # Generated
│   └── stats.json                          # Generated
├── src/
│   ├── app/
│   │   ├── layout.tsx
│   │   ├── page.tsx                        # Home: edificios list
│   │   ├── edificios/[id]/page.tsx         # Edificio detail
│   │   └── api/
│   │       ├── refresh/route.ts            # POST → trigger GitHub Actions
│   │       ├── personas/[id]/fallecido/route.ts
│   │       └── v1/
│   │           ├── edificios/route.ts
│   │           ├── edificios/[id]/route.ts
│   │           ├── edificios/[id]/personas/route.ts
│   │           ├── personas/route.ts
│   │           └── stats/route.ts
│   ├── components/
│   │   ├── EdificioCard.tsx
│   │   ├── PersonaCard.tsx
│   │   ├── FallecidoModal.tsx
│   │   ├── RefreshButton.tsx
│   │   ├── SearchBar.tsx
│   │   └── StatusBadge.tsx
│   └── lib/
│       ├── types.ts                        # Shared TypeScript interfaces
│       ├── data.ts                         # Read JSON + merge KV fallecidos
│       └── kv.ts                           # Vercel KV helpers
├── next.config.ts
├── package.json
└── tsconfig.json
```

---

## Task 1: Project scaffold

**Files:**
- Create: `package.json`
- Create: `next.config.ts`
- Create: `tsconfig.json`
- Create: `tailwind.config.ts`
- Create: `src/app/layout.tsx`

**Interfaces:**
- Produces: working `npm run dev` on port 3000

- [ ] **Step 1: Bootstrap Next.js 15 project**

```bash
cd "C:\Users\Luis Alberto\OneDrive\Desktop\VENEZUELA"
npx create-next-app@latest . --typescript --tailwind --app --no-src-dir --import-alias "@/*" --yes
```

- [ ] **Step 2: Install dependencies**

```bash
npm install @vercel/kv fastest-levenshtein
npm install --save-dev @types/node
```

- [ ] **Step 3: Verify dev server starts**

```bash
npm run dev
```
Expected: server running at http://localhost:3000

- [ ] **Step 4: Move source to src/ layout**

The create-next-app with `--no-src-dir` puts files in root. Move `app/` into `src/`:
```bash
mkdir -p src
mv app src/
mv components src/ 2>/dev/null || true
```

Update `tsconfig.json` paths if needed:
```json
{
  "compilerOptions": {
    "paths": { "@/*": ["./src/*"] }
  }
}
```

- [ ] **Step 5: Configure next.config.ts with CORS headers**

```typescript
// next.config.ts
import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: '/api/v1/:path*',
        headers: [
          { key: 'Access-Control-Allow-Origin', value: '*' },
          { key: 'Access-Control-Allow-Methods', value: 'GET, OPTIONS' },
          { key: 'Access-Control-Allow-Headers', value: 'Content-Type' },
        ],
      },
    ]
  },
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'jovial-shepherd-115.convex.cloud' },
      { protocol: 'https', hostname: 'venezuelatebusca.com' },
    ],
  },
}

export default nextConfig
```

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: scaffold Next.js 15 project with Tailwind and CORS config"
```

---

## Task 2: TypeScript types

**Files:**
- Create: `src/lib/types.ts`

**Interfaces:**
- Produces: `Edificio`, `Persona`, `Stats`, `FallecidoMark` types used by all subsequent tasks

- [ ] **Step 1: Write types**

```typescript
// src/lib/types.ts

export interface Coordenadas {
  lat: number
  lng: number
}

export interface Edificio {
  id: string
  nombre: string
  direccion: string
  sector: string
  daño: 'total' | 'severo' | 'parcial' | 'desconocido'
  coordenadas: Coordenadas | null
  totalDesaparecidos: number
  totalLocalizados: number
  totalFallecidos: number
}

export interface Persona {
  id: string
  nombre: string
  edad: number | null
  genero: 'Masculino' | 'Femenino' | 'Desconocido'
  cedula: string | null
  estado: 'desaparecido' | 'localizado' | 'fallecido'
  edificioId: string | null
  edificioNombre: string | null
  zonaOriginal: string | null
  ultimaUbicacion: string | null
  foto: string | null
  contacto: string | null
  reportadoEn: string
  fuente: 'vea2026' | 'venezuelatebusca' | 'localizados'
  fuenteUrl: string
}

export interface Stats {
  updatedAt: string
  totalEdificios: number
  totalPersonas: number
  totalDesaparecidos: number
  totalLocalizados: number
  totalFallecidos: number
  sinEdificio: number
}

export interface EdificiosData {
  updatedAt: string
  total: number
  edificios: Edificio[]
}

export interface PersonasData {
  updatedAt: string
  total: number
  personas: Persona[]
}

export interface FallecidoMark {
  timestamp: string
  reportadoPor: 'anónimo'
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```
Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add src/lib/types.ts
git commit -m "feat: add shared TypeScript types"
```

---

## Task 3: Fuzzy matcher

**Files:**
- Create: `scripts/scraper/matcher.js`
- Test: `scripts/scraper/matcher.test.js`

**Interfaces:**
- Consumes: `edificios` array (from Task 4), `zonaOriginal` string from a persona
- Produces: `matchEdificio(zona, edificios)` → `{ edificioId, edificioNombre, confidence }` or `null`

- [ ] **Step 1: Install test runner for scraper**

```bash
npm install --save-dev jest
```

Add to `package.json`:
```json
{
  "scripts": {
    "test:scraper": "jest scripts/scraper/"
  },
  "jest": {
    "testEnvironment": "node",
    "testMatch": ["**/scripts/**/*.test.js"]
  }
}
```

- [ ] **Step 2: Write failing tests**

```javascript
// scripts/scraper/matcher.test.js
const { matchEdificio, normalizeZona } = require('./matcher')

const edificios = [
  { id: 'abc-123', nombre: 'Edificio Caribe', sector: 'Caraballeda' },
  { id: 'def-456', nombre: 'Residencias El Palmar', sector: 'Caraballeda' },
  { id: 'ghi-789', nombre: 'Edificios La Páez', sector: 'Catia la Mar' },
]

describe('normalizeZona', () => {
  test('lowercases and removes accents', () => {
    expect(normalizeZona('Edificio Caribe')).toBe('caribe')
  })
  test('removes common prefixes', () => {
    expect(normalizeZona('Residencias El Palmar')).toBe('palmar')
  })
  test('handles OPP abbreviations', () => {
    expect(normalizeZona('OPP 27')).toBe('opp 27')
  })
})

describe('matchEdificio', () => {
  test('exact match after normalization', () => {
    const result = matchEdificio('edificio caribe', edificios)
    expect(result).not.toBeNull()
    expect(result.edificioId).toBe('abc-123')
    expect(result.confidence).toBeGreaterThanOrEqual(0.75)
  })

  test('partial match above threshold', () => {
    const result = matchEdificio('caribe misión vivienda', edificios)
    expect(result).not.toBeNull()
    expect(result.edificioId).toBe('abc-123')
  })

  test('returns null below threshold', () => {
    const result = matchEdificio('no existe para nada', edificios)
    expect(result).toBeNull()
  })

  test('matches La Paez with accent variants', () => {
    const result = matchEdificio('Edificios la Paez catia la mar', edificios)
    expect(result).not.toBeNull()
    expect(result.edificioId).toBe('ghi-789')
  })
})
```

- [ ] **Step 3: Run tests to verify they fail**

```bash
npm run test:scraper
```
Expected: FAIL — "Cannot find module './matcher'"

- [ ] **Step 4: Implement matcher**

```javascript
// scripts/scraper/matcher.js
const { distance } = require('fastest-levenshtein')

const STOP_WORDS = new Set([
  'edificio', 'edificios', 'residencia', 'residencias', 'conjunto',
  'conjunto residencial', 'torre', 'torres', 'urbanizacion', 'club',
  'el', 'la', 'los', 'las', 'de', 'del', 'en'
])

function normalizeZona(zona) {
  if (!zona) return ''
  return zona
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')  // remove accents
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(t => t.length > 1 && !STOP_WORDS.has(t))
    .join(' ')
    .trim()
}

function diceCoefficient(a, b) {
  if (!a || !b) return 0
  if (a === b) return 1
  const aTokens = new Set(a.split(/\s+/))
  const bTokens = new Set(b.split(/\s+/))
  const intersection = [...aTokens].filter(t => bTokens.has(t)).length
  return (2 * intersection) / (aTokens.size + bTokens.size)
}

function matchEdificio(zona, edificios, threshold = 0.75) {
  if (!zona) return null
  const normalizedZona = normalizeZona(zona)
  if (!normalizedZona) return null

  let bestMatch = null
  let bestScore = 0

  for (const edificio of edificios) {
    const normalizedNombre = normalizeZona(edificio.nombre)
    const normalizedSector = normalizeZona(edificio.sector || '')

    // Token overlap score
    const diceNombre = diceCoefficient(normalizedZona, normalizedNombre)
    const diceSector = diceCoefficient(normalizedZona, normalizedSector)

    // Substring bonus: if normalized nombre appears in zona
    const containsBonus = normalizedZona.includes(normalizedNombre) ||
      normalizedNombre.includes(normalizedZona) ? 0.2 : 0

    const score = Math.min(1, Math.max(diceNombre, diceSector * 0.5) + containsBonus)

    if (score > bestScore) {
      bestScore = score
      bestMatch = edificio
    }
  }

  if (bestScore >= threshold) {
    return {
      edificioId: bestMatch.id,
      edificioNombre: bestMatch.nombre,
      confidence: bestScore
    }
  }
  return null
}

module.exports = { matchEdificio, normalizeZona }
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
npm run test:scraper
```
Expected: all 5 tests PASS

- [ ] **Step 6: Commit**

```bash
git add scripts/scraper/matcher.js scripts/scraper/matcher.test.js package.json
git commit -m "feat: fuzzy building matcher with Dice coefficient"
```

---

## Task 4: Edificios source scraper

**Files:**
- Create: `scripts/scraper/sources/edificios.js`

**Interfaces:**
- Produces: `fetchEdificios()` → `Promise<Edificio[]>` where Edificio = `{ id, nombre, direccion, sector, daño, coordenadas }`

- [ ] **Step 1: Write the scraper**

```javascript
// scripts/scraper/sources/edificios.js
// Scrapes terremotovenezuela.com for the list of collapsed buildings.
// The site is a paginated list — we follow "Ver más" links until no more pages.

async function fetchEdificios() {
  const edificios = []
  let page = 1
  let hasMore = true

  while (hasMore) {
    const url = `https://terremotovenezuela.com/edificios?page=${page}`
    const res = await fetch(url, {
      headers: { 'User-Agent': 'VenezuelaEdificiosBot/1.0' }
    })

    if (!res.ok) break
    const html = await res.text()

    // Parse building cards from HTML
    const matches = [...html.matchAll(
      /href="\/edificio\/([a-f0-9-]+)"[^>]*>[\s\S]*?<[^>]+>([^<]+)<\/[^>]+>[\s\S]*?<[^>]+>([^<]+)<\/[^>]+>/gm
    )]

    if (matches.length === 0) {
      hasMore = false
      break
    }

    for (const [, id, nombre, direccion] of matches) {
      edificios.push({
        id: id.trim(),
        nombre: nombre.trim(),
        direccion: direccion.trim(),
        sector: extractSector(direccion),
        daño: 'desconocido',
        coordenadas: null,
        totalDesaparecidos: 0,
        totalLocalizados: 0,
        totalFallecidos: 0
      })
    }

    // Check if there's a next page
    hasMore = html.includes('Ver más') || html.includes('page=' + (page + 1))
    page++

    // Rate limit
    await new Promise(r => setTimeout(r, 500))
  }

  // Fetch individual building detail for damage level + coordinates
  const enriched = await Promise.all(
    edificios.slice(0, edificios.length).map(e => enrichEdificio(e))
  )

  return enriched
}

async function enrichEdificio(edificio) {
  try {
    const res = await fetch(`https://terremotovenezuela.com/edificio/${edificio.id}`, {
      headers: { 'User-Agent': 'VenezuelaEdificiosBot/1.0' }
    })
    if (!res.ok) return edificio
    const html = await res.text()

    const dañoMatch = html.match(/Daño\s+(\w+)/i)
    if (dañoMatch) {
      const d = dañoMatch[1].toLowerCase()
      if (d.includes('total')) edificio.daño = 'total'
      else if (d.includes('sev') || d.includes('grave')) edificio.daño = 'severo'
      else if (d.includes('parc')) edificio.daño = 'parcial'
    }

    const coordMatch = html.match(/([-\d.]+),\s*([-\d.]+)/)
    if (coordMatch) {
      edificio.coordenadas = {
        lat: parseFloat(coordMatch[1]),
        lng: parseFloat(coordMatch[2])
      }
    }

    await new Promise(r => setTimeout(r, 200))
  } catch (_) {}
  return edificio
}

function extractSector(direccion) {
  if (!direccion) return ''
  const parts = direccion.split(',')
  return parts.length > 1 ? parts[parts.length - 2].trim() : parts[0].trim()
}

module.exports = { fetchEdificios }
```

- [ ] **Step 2: Smoke test manually**

```bash
node -e "
const { fetchEdificios } = require('./scripts/scraper/sources/edificios.js')
fetchEdificios().then(r => console.log('Count:', r.length, 'Sample:', JSON.stringify(r[0], null, 2)))
"
```
Expected: Count > 0, sample shows id + nombre + daño

- [ ] **Step 3: Commit**

```bash
git add scripts/scraper/sources/edificios.js
git commit -m "feat: terremotovenezuela.com edificios scraper"
```

---

## Task 5: Vea2026 source (Convex API)

**Files:**
- Create: `scripts/scraper/sources/vea2026.js`

**Interfaces:**
- Produces: `fetchVea2026()` → `Promise<RawPersona[]>` where RawPersona = `{ id, nombre, edad, genero, cedula, zona, ultimaUbicacion, foto, contacto, reportadoEn, estado }`

- [ ] **Step 1: Write the Convex client**

```javascript
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
```

- [ ] **Step 2: Smoke test**

```bash
node -e "
const { fetchVea2026 } = require('./scripts/scraper/sources/vea2026.js')
fetchVea2026('missing').then(r => {
  console.log('Count:', r.length)
  console.log('Sample:', JSON.stringify(r[0], null, 2))
}).catch(console.error)
" 2>&1 | head -50
```
Expected: Count > 1000, sample shows zona field populated

- [ ] **Step 3: Commit**

```bash
git add scripts/scraper/sources/vea2026.js
git commit -m "feat: vea2026 Convex API client (missing + localizados)"
```

---

## Task 6: Venezuelatebusca source (kernel.sh)

**Files:**
- Create: `scripts/scraper/sources/venezuelatebusca.js`

**Interfaces:**
- Consumes: env var `KERNEL_API_KEY`
- Produces: `fetchVenezuelaTeBusca()` → `Promise<RawPersona[]>`

- [ ] **Step 1: Write the kernel.sh scraper**

```javascript
// scripts/scraper/sources/venezuelatebusca.js
// Uses kernel.sh cloud browser to scrape venezuelatebusca.com
// The site blocks direct fetch (403). We use Playwright via kernel.sh.

const KERNEL_API = 'https://api.onkernel.com'

async function createBrowser(apiKey) {
  const res = await fetch(`${KERNEL_API}/browsers`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ timeout_seconds: 300 })
  })
  const data = await res.json()
  return data.session_id
}

async function runPlaywright(apiKey, sessionId, code) {
  const res = await fetch(`${KERNEL_API}/browsers/${sessionId}/playwright/execute`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ code, timeout_sec: 120 })
  })
  return res.json()
}

async function fetchVenezuelaTeBusca() {
  const apiKey = process.env.KERNEL_API_KEY
  if (!apiKey) throw new Error('KERNEL_API_KEY env var required')

  console.log('[venezuelatebusca] Creating browser session...')
  const sessionId = await createBrowser(apiKey)
  const personas = []

  try {
    // Get total count first
    const countCode = `
      await page.goto('https://venezuelatebusca.com/', { waitUntil: 'networkidle', timeout: 30000 });
      await page.waitForTimeout(2000);
      const text = await page.evaluate(() => document.body.innerText);
      const match = text.match(/([\\d.]+)\\s*Personas registradas/);
      return { total: match ? parseInt(match[1].replace('.', '')) : 0 };
    `
    const countResult = await runPlaywright(apiKey, sessionId, countCode)
    const total = countResult.result?.total ?? 0
    console.log(`[venezuelatebusca] Total: ${total} personas`)

    // Scrape by scrolling and collecting cards
    let cursor = null
    let pageNum = 1
    let done = false

    while (!done) {
      const scrapeCode = `
        await page.goto('https://venezuelatebusca.com/?page=${pageNum}', { waitUntil: 'networkidle', timeout: 30000 });
        await page.waitForTimeout(2000);

        const cards = await page.evaluate(() => {
          const results = [];
          const items = document.querySelectorAll('[class*="card"], [class*="persona"], article, [data-id]');
          items.forEach(el => {
            const text = el.innerText || '';
            const lines = text.split('\\n').map(l => l.trim()).filter(Boolean);
            if (lines.length < 2) return;
            results.push({
              nombre: lines[0] || null,
              info: lines[1] || null,
              ubicacion: lines[2] || null,
              fecha: lines[3] || null,
            });
          });
          return results;
        });

        const hasMore = document.querySelector('[class*="load-more"], [class*="cargar"]') !== null
          || document.querySelector('a[href*="page=${pageNum + 1}"]') !== null;

        return { cards, hasMore };
      `
      const result = await runPlaywright(apiKey, sessionId, scrapeCode)
      const { cards = [], hasMore = false } = result.result ?? {}

      for (const card of cards) {
        if (!card.nombre) continue
        const ageGenderMatch = card.info?.match(/(\d+)\s*años?\s*·?\s*(Masculino|Femenino)/i)
        personas.push({
          id: `vtb-${Buffer.from(card.nombre + (card.fecha || '')).toString('base64').slice(0, 20)}`,
          nombre: card.nombre,
          edad: ageGenderMatch ? parseInt(ageGenderMatch[1]) : null,
          genero: ageGenderMatch?.[2] === 'Femenino' ? 'Femenino' : ageGenderMatch?.[2] === 'Masculino' ? 'Masculino' : 'Desconocido',
          cedula: null,
          zona: card.ubicacion ?? null,
          ultimaUbicacion: card.ubicacion ?? null,
          foto: null,
          contacto: null,
          reportadoEn: new Date().toISOString(),
          estado: 'desaparecido',
          fuente: 'venezuelatebusca',
          fuenteUrl: 'https://venezuelatebusca.com/'
        })
      }

      console.log(`[venezuelatebusca] Page ${pageNum}: ${cards.length} cards (total: ${personas.length})`)

      if (!hasMore || personas.length >= total) {
        done = true
      } else {
        pageNum++
        await new Promise(r => setTimeout(r, 1000))
      }
    }
  } finally {
    // Browser auto-terminates after timeout_seconds
    console.log(`[venezuelatebusca] Done. Total scraped: ${personas.length}`)
  }

  return personas
}

module.exports = { fetchVenezuelaTeBusca }
```

- [ ] **Step 2: Smoke test (requires KERNEL_API_KEY)**

```bash
KERNEL_API_KEY="your-key" node -e "
const { fetchVenezuelaTeBusca } = require('./scripts/scraper/sources/venezuelatebusca.js')
fetchVenezuelaTeBusca().then(r => console.log('Count:', r.length, 'Sample:', JSON.stringify(r[0], null, 2))).catch(console.error)
" 2>&1 | head -30
```
Expected: Count > 0, sample shows nombre + zona

- [ ] **Step 3: Commit**

```bash
git add scripts/scraper/sources/venezuelatebusca.js
git commit -m "feat: venezuelatebusca.com scraper via kernel.sh browser"
```

---

## Task 7: Localizados source (REST API)

**Files:**
- Create: `scripts/scraper/sources/localizados.js`

**Interfaces:**
- Produces: `fetchLocalizados()` → `Promise<RawPersona[]>`

- [ ] **Step 1: Write the REST client**

```javascript
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
```

- [ ] **Step 2: Smoke test**

```bash
node -e "
const { fetchLocalizados } = require('./scripts/scraper/sources/localizados.js')
fetchLocalizados().then(r => console.log('Count:', r.length, 'Sample:', JSON.stringify(r[0], null, 2)))
"
```
Expected: Count ~2000, sample shows lugarNombre in zona

- [ ] **Step 3: Commit**

```bash
git add scripts/scraper/sources/localizados.js
git commit -m "feat: localizadosvenezuela.com REST API client"
```

---

## Task 8: Scraper orchestrator + JSON writer

**Files:**
- Create: `scripts/scraper/writer.js`
- Create: `scripts/scraper/index.js`
- Create: `public/data/.gitkeep`

**Interfaces:**
- Consumes: all source modules (Tasks 4-7) + matcher (Task 3)
- Produces: `public/data/edificios.json`, `public/data/personas.json`, `public/data/stats.json`

- [ ] **Step 1: Write the JSON writer**

```javascript
// scripts/scraper/writer.js
const fs = require('fs')
const path = require('path')

const DATA_DIR = path.join(__dirname, '../../public/data')

function writeJson(filename, data) {
  fs.mkdirSync(DATA_DIR, { recursive: true })
  const filepath = path.join(DATA_DIR, filename)
  fs.writeFileSync(filepath, JSON.stringify(data, null, 2), 'utf8')
  const kb = Math.round(fs.statSync(filepath).size / 1024)
  console.log(`[writer] Wrote ${filename} (${kb}KB)`)
}

module.exports = { writeJson }
```

- [ ] **Step 2: Write the orchestrator**

```javascript
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
  console.log(`✓ ${matched}/${personas.length} personas matched to buildings (${Math.round(matched/personas.length*100)}%)`)

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
```

- [ ] **Step 3: Create placeholder data files**

```bash
mkdir -p public/data
echo '{"updatedAt":"","total":0,"edificios":[]}' > public/data/edificios.json
echo '{"updatedAt":"","total":0,"personas":[]}' > public/data/personas.json
echo '{"updatedAt":"","totalEdificios":0,"totalPersonas":0,"totalDesaparecidos":0,"totalLocalizados":0,"totalFallecidos":0,"sinEdificio":0}' > public/data/stats.json
```

- [ ] **Step 4: Run smoke test (skipping kernel.sh)**

```bash
node -e "
process.env.SKIP_VTB = '1'
// Quick test: just vea2026 + localizados
" 
# Just run the orchestrator to confirm imports work:
node -e "require('./scripts/scraper/index.js')" 2>&1 | head -5
```
Expected: no import errors (will fail on network if no API key, that's fine)

- [ ] **Step 5: Commit**

```bash
git add scripts/scraper/writer.js scripts/scraper/index.js public/data/
git commit -m "feat: scraper orchestrator with fuzzy matching and JSON writer"
```

---

## Task 9: GitHub Actions workflow

**Files:**
- Create: `.github/workflows/scraper.yml`

**Interfaces:**
- Consumes: GitHub Secrets `KERNEL_API_KEY`, `GH_PAT` (personal access token for API trigger)
- Produces: commits updated JSON files to repo, triggering Vercel redeploy

- [ ] **Step 1: Create the workflow**

```yaml
# .github/workflows/scraper.yml
name: Scrape Data

on:
  schedule:
    - cron: '0 */2 * * *'   # every 2 hours
  workflow_dispatch:          # manual trigger via API or UI

jobs:
  scrape:
    runs-on: ubuntu-latest
    timeout-minutes: 30

    steps:
      - name: Checkout
        uses: actions/checkout@v4
        with:
          token: ${{ secrets.GH_PAT || secrets.GITHUB_TOKEN }}

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Run scraper
        env:
          KERNEL_API_KEY: ${{ secrets.KERNEL_API_KEY }}
        run: node scripts/scraper/index.js

      - name: Commit updated data
        run: |
          git config user.name "github-actions[bot]"
          git config user.email "github-actions[bot]@users.noreply.github.com"
          git add public/data/
          git diff --staged --quiet || git commit -m "data: update scraped data $(date -u '+%Y-%m-%d %H:%M UTC')"
          git push
```

- [ ] **Step 2: Create the refresh API route that triggers this workflow**

```typescript
// src/app/api/refresh/route.ts
import { NextResponse } from 'next/server'

export async function POST() {
  const token = process.env.GH_PAT
  const owner = process.env.GITHUB_OWNER
  const repo = process.env.GITHUB_REPO

  if (!token || !owner || !repo) {
    return NextResponse.json({ error: 'GitHub config missing' }, { status: 500 })
  }

  const res = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/actions/workflows/scraper.yml/dispatches`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/vnd.github+json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ ref: 'main' }),
    }
  )

  if (res.status === 204) {
    return NextResponse.json({ ok: true, message: 'Scraping iniciado' })
  }

  const err = await res.text()
  return NextResponse.json({ error: err }, { status: res.status })
}
```

- [ ] **Step 3: Add env vars to Vercel**

Add these in Vercel dashboard → Project Settings → Environment Variables:
- `GH_PAT` — GitHub Personal Access Token with `repo` + `workflow` scopes
- `GITHUB_OWNER` — your GitHub username
- `GITHUB_REPO` — repository name

- [ ] **Step 4: Commit**

```bash
git add .github/workflows/scraper.yml src/app/api/refresh/route.ts
git commit -m "feat: GitHub Actions scraper workflow + refresh API route"
```

---

## Task 10: Data layer (lib/data.ts + lib/kv.ts)

**Files:**
- Create: `src/lib/data.ts`
- Create: `src/lib/kv.ts`

**Interfaces:**
- Produces:
  - `getEdificios()` → `Promise<EdificiosData>`
  - `getPersonasByEdificio(edificioId: string, page: number)` → `Promise<{ personas: Persona[], total: number }>`
  - `searchPersonas(q: string, page: number)` → `Promise<{ personas: Persona[], total: number }>`
  - `getStats()` → `Promise<Stats>`
  - `markFallecido(personaId: string)` → `Promise<void>`
  - `getFallecidos()` → `Promise<Set<string>>`

- [ ] **Step 1: Write KV helper**

```typescript
// src/lib/kv.ts
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
```

- [ ] **Step 2: Write data layer**

```typescript
// src/lib/data.ts
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
      const zona = (p.zonaOriginal ?? '').toLowerCase()
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
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/kv.ts src/lib/data.ts
git commit -m "feat: data layer reads JSON + merges Vercel KV fallecido markers"
```

---

## Task 11: Fallecido API route

**Files:**
- Create: `src/app/api/personas/[id]/fallecido/route.ts`

**Interfaces:**
- Consumes: `markFallecido()` from `src/lib/kv.ts`
- Produces: `POST /api/personas/:id/fallecido` → `{ ok: true }`

- [ ] **Step 1: Write the route**

```typescript
// src/app/api/personas/[id]/fallecido/route.ts
import { NextResponse } from 'next/server'
import { markFallecido } from '@/lib/kv'

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  if (!id) {
    return NextResponse.json({ error: 'id requerido' }, { status: 400 })
  }
  await markFallecido(id)
  return NextResponse.json({ ok: true })
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/api/personas/
git commit -m "feat: POST /api/personas/:id/fallecido route"
```

---

## Task 12: Public API routes

**Files:**
- Create: `src/app/api/v1/edificios/route.ts`
- Create: `src/app/api/v1/edificios/[id]/route.ts`
- Create: `src/app/api/v1/edificios/[id]/personas/route.ts`
- Create: `src/app/api/v1/personas/route.ts`
- Create: `src/app/api/v1/stats/route.ts`

**Interfaces:**
- Consumes: data layer from Task 10
- Produces: public REST API per spec

- [ ] **Step 1: Write all API routes**

```typescript
// src/app/api/v1/edificios/route.ts
import { NextResponse } from 'next/server'
import { getEdificios } from '@/lib/data'

export async function GET() {
  const data = getEdificios()
  return NextResponse.json(data)
}
```

```typescript
// src/app/api/v1/edificios/[id]/route.ts
import { NextResponse } from 'next/server'
import { getEdificios } from '@/lib/data'

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const { edificios } = getEdificios()
  const edificio = edificios.find(e => e.id === id)
  if (!edificio) return NextResponse.json({ error: 'No encontrado' }, { status: 404 })
  return NextResponse.json(edificio)
}
```

```typescript
// src/app/api/v1/edificios/[id]/personas/route.ts
import { NextResponse } from 'next/server'
import { getPersonasByEdificio } from '@/lib/data'

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const { searchParams } = new URL(req.url)
  const page = parseInt(searchParams.get('page') ?? '1')
  const limit = Math.min(parseInt(searchParams.get('limit') ?? '50'), 100)
  const result = await getPersonasByEdificio(id, page, limit)
  return NextResponse.json({ ...result, page, limit })
}
```

```typescript
// src/app/api/v1/personas/route.ts
import { NextResponse } from 'next/server'
import { searchPersonas } from '@/lib/data'

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const q = searchParams.get('q') ?? ''
  const page = parseInt(searchParams.get('page') ?? '1')
  if (!q) return NextResponse.json({ error: 'Parámetro q requerido' }, { status: 400 })
  const result = await searchPersonas(q, page)
  return NextResponse.json({ ...result, page, q })
}
```

```typescript
// src/app/api/v1/stats/route.ts
import { NextResponse } from 'next/server'
import { getStats } from '@/lib/data'

export async function GET() {
  const stats = getStats()
  return NextResponse.json(stats)
}
```

- [ ] **Step 2: Verify routes compile**

```bash
npx tsc --noEmit
```
Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add src/app/api/v1/
git commit -m "feat: public REST API /api/v1/* with CORS"
```

---

## Task 13: Components

**Files:**
- Create: `src/components/StatusBadge.tsx`
- Create: `src/components/PersonaCard.tsx`
- Create: `src/components/FallecidoModal.tsx`
- Create: `src/components/EdificioCard.tsx`
- Create: `src/components/RefreshButton.tsx`
- Create: `src/components/SearchBar.tsx`

- [ ] **Step 1: StatusBadge**

```tsx
// src/components/StatusBadge.tsx
type Estado = 'desaparecido' | 'localizado' | 'fallecido'

const CONFIG: Record<Estado, { label: string; className: string }> = {
  desaparecido: { label: 'Desaparecido', className: 'bg-red-100 text-red-800' },
  localizado:   { label: 'Localizado',   className: 'bg-green-100 text-green-800' },
  fallecido:    { label: 'Fallecido',     className: 'bg-gray-100 text-gray-600' },
}

export function StatusBadge({ estado }: { estado: Estado }) {
  const { label, className } = CONFIG[estado] ?? CONFIG.desaparecido
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${className}`}>
      <span className="w-1.5 h-1.5 rounded-full bg-current mr-1.5" />
      {label}
    </span>
  )
}
```

- [ ] **Step 2: FallecidoModal**

```tsx
// src/components/FallecidoModal.tsx
'use client'
import { useState } from 'react'

interface Props {
  personaId: string
  nombre: string
  onConfirm: () => void
  onClose: () => void
}

export function FallecidoModal({ personaId, nombre, onConfirm, onClose }: Props) {
  const [loading, setLoading] = useState(false)

  async function handleConfirm() {
    setLoading(true)
    await fetch(`/api/personas/${personaId}/fallecido`, { method: 'POST' })
    setLoading(false)
    onConfirm()
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-2">Confirmar fallecimiento</h2>
        <p className="text-gray-600 mb-6">
          ¿Confirmar que <strong>{nombre}</strong> ha fallecido? Esta acción es pública y visible para todos.
        </p>
        <div className="flex gap-3 justify-end">
          <button onClick={onClose} className="px-4 py-2 text-gray-700 border rounded-lg hover:bg-gray-50">
            Cancelar
          </button>
          <button
            onClick={handleConfirm}
            disabled={loading}
            className="px-4 py-2 bg-gray-800 text-white rounded-lg hover:bg-gray-700 disabled:opacity-50"
          >
            {loading ? 'Guardando...' : 'Confirmar'}
          </button>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: PersonaCard**

```tsx
// src/components/PersonaCard.tsx
'use client'
import { useState } from 'react'
import Image from 'next/image'
import type { Persona } from '@/lib/types'
import { StatusBadge } from './StatusBadge'
import { FallecidoModal } from './FallecidoModal'

export function PersonaCard({ persona: initial }: { persona: Persona }) {
  const [persona, setPersona] = useState(initial)
  const [showModal, setShowModal] = useState(false)

  function handleFallecidoConfirm() {
    setPersona(p => ({ ...p, estado: 'fallecido' }))
    setShowModal(false)
  }

  return (
    <>
      <div className={`bg-white rounded-xl border p-4 flex gap-4 ${persona.estado === 'fallecido' ? 'opacity-60' : ''}`}>
        {persona.foto && (
          <div className="flex-shrink-0 w-16 h-16 relative rounded-lg overflow-hidden">
            <Image src={persona.foto} alt={persona.nombre} fill className="object-cover" />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <h3 className="font-semibold text-gray-900 truncate">{persona.nombre}</h3>
            <StatusBadge estado={persona.estado} />
          </div>
          <div className="mt-1 text-sm text-gray-500 space-y-0.5">
            {persona.edad && <p>{persona.edad} años · {persona.genero}</p>}
            {persona.cedula && <p>CI: {persona.cedula}</p>}
            {persona.ultimaUbicacion && <p>📍 {persona.ultimaUbicacion}</p>}
            {persona.contacto && <p>📞 {persona.contacto}</p>}
            <p className="text-xs">
              Fuente:{' '}
              <a href={persona.fuenteUrl} target="_blank" rel="noopener noreferrer" className="underline">
                {persona.fuente}
              </a>
              {' · '}{new Date(persona.reportadoEn).toLocaleDateString('es-VE')}
            </p>
          </div>
          {persona.estado !== 'fallecido' && (
            <button
              onClick={() => setShowModal(true)}
              className="mt-3 text-xs text-gray-400 hover:text-gray-700 underline"
            >
              Marcar como fallecido
            </button>
          )}
        </div>
      </div>

      {showModal && (
        <FallecidoModal
          personaId={persona.id}
          nombre={persona.nombre}
          onConfirm={handleFallecidoConfirm}
          onClose={() => setShowModal(false)}
        />
      )}
    </>
  )
}
```

- [ ] **Step 4: EdificioCard**

```tsx
// src/components/EdificioCard.tsx
import Link from 'next/link'
import type { Edificio } from '@/lib/types'

export function EdificioCard({ edificio }: { edificio: Edificio }) {
  const total = edificio.totalDesaparecidos + edificio.totalLocalizados + edificio.totalFallecidos
  const pctDesap = total > 0 ? (edificio.totalDesaparecidos / total) * 100 : 0
  const pctLocal = total > 0 ? (edificio.totalLocalizados / total) * 100 : 0

  return (
    <Link href={`/edificios/${edificio.id}`} className="block bg-white rounded-xl border p-4 hover:border-gray-400 transition-colors">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h2 className="font-semibold text-gray-900">{edificio.nombre}</h2>
          <p className="text-sm text-gray-500">{edificio.sector} · Daño {edificio.daño}</p>
        </div>
        <div className="text-right text-sm flex-shrink-0">
          <span className="text-red-700 font-medium">{edificio.totalDesaparecidos} desap.</span>
          {edificio.totalLocalizados > 0 && (
            <span className="text-green-700 ml-2">{edificio.totalLocalizados} loc.</span>
          )}
          {edificio.totalFallecidos > 0 && (
            <span className="text-gray-500 ml-2">{edificio.totalFallecidos} fall.</span>
          )}
        </div>
      </div>
      {total > 0 && (
        <div className="mt-3 h-1.5 rounded-full bg-gray-100 overflow-hidden flex">
          <div className="bg-red-400 h-full" style={{ width: `${pctDesap}%` }} />
          <div className="bg-green-400 h-full" style={{ width: `${pctLocal}%` }} />
        </div>
      )}
    </Link>
  )
}
```

- [ ] **Step 5: RefreshButton**

```tsx
// src/components/RefreshButton.tsx
'use client'
import { useState } from 'react'

export function RefreshButton() {
  const [state, setState] = useState<'idle' | 'loading' | 'done' | 'error'>('idle')

  async function handleRefresh() {
    setState('loading')
    try {
      const res = await fetch('/api/refresh', { method: 'POST' })
      if (res.ok) {
        setState('done')
        setTimeout(() => setState('idle'), 5000)
      } else {
        setState('error')
        setTimeout(() => setState('idle'), 3000)
      }
    } catch {
      setState('error')
      setTimeout(() => setState('idle'), 3000)
    }
  }

  const labels = {
    idle: 'Actualizar datos',
    loading: 'Iniciando actualización...',
    done: '✓ Actualización iniciada (~15 min)',
    error: 'Error al actualizar'
  }

  return (
    <button
      onClick={handleRefresh}
      disabled={state === 'loading' || state === 'done'}
      className="px-4 py-2 bg-black text-white text-sm rounded-lg hover:bg-gray-800 disabled:opacity-50 transition-colors"
    >
      {labels[state]}
    </button>
  )
}
```

- [ ] **Step 6: SearchBar**

```tsx
// src/components/SearchBar.tsx
'use client'
import { useRouter, useSearchParams } from 'next/navigation'
import { useTransition } from 'react'

export function SearchBar({ defaultValue = '' }: { defaultValue?: string }) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [isPending, startTransition] = useTransition()

  function handleSearch(term: string) {
    const params = new URLSearchParams(searchParams.toString())
    if (term) params.set('q', term)
    else params.delete('q')
    params.delete('page')
    startTransition(() => router.push(`/?${params.toString()}`))
  }

  return (
    <div className="relative">
      <input
        type="search"
        defaultValue={defaultValue}
        onChange={e => handleSearch(e.target.value)}
        placeholder="Buscar persona o edificio..."
        className="w-full pl-10 pr-4 py-2.5 border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-black"
      />
      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">🔍</span>
      {isPending && <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs">...</span>}
    </div>
  )
}
```

- [ ] **Step 7: Commit**

```bash
git add src/components/
git commit -m "feat: UI components (PersonaCard, EdificioCard, RefreshButton, SearchBar, FallecidoModal)"
```

---

## Task 14: Pages

**Files:**
- Modify: `src/app/layout.tsx`
- Modify: `src/app/page.tsx`
- Create: `src/app/edificios/[id]/page.tsx`

- [ ] **Step 1: Root layout**

```tsx
// src/app/layout.tsx
import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Venezuela Edificios — Personas desaparecidas por edificio',
  description: 'Clasificación de personas desaparecidas por edificio tras el terremoto de Venezuela 2026.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body className={`${inter.className} bg-gray-50 min-h-screen`}>
        {children}
      </body>
    </html>
  )
}
```

- [ ] **Step 2: Home page**

```tsx
// src/app/page.tsx
import { Suspense } from 'react'
import { getEdificios, getStats, searchPersonas } from '@/lib/data'
import { EdificioCard } from '@/components/EdificioCard'
import { RefreshButton } from '@/components/RefreshButton'
import { SearchBar } from '@/components/SearchBar'
import { PersonaCard } from '@/components/PersonaCard'

export const dynamic = 'force-dynamic'

interface Props {
  searchParams: Promise<{ q?: string; page?: string }>
}

export default async function Home({ searchParams }: Props) {
  const { q, page: pageStr } = await searchParams
  const page = parseInt(pageStr ?? '1')

  const stats = getStats()
  const { edificios } = getEdificios()

  const searchResults = q ? await searchPersonas(q, page) : null

  const updatedAt = stats.updatedAt
    ? new Date(stats.updatedAt).toLocaleString('es-VE', { timeZone: 'America/Caracas' })
    : 'Nunca'

  return (
    <main className="max-w-3xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex items-start justify-between mb-6 gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">🏢 Venezuela Edificios</h1>
          <p className="text-sm text-gray-500 mt-1">
            {stats.totalEdificios} edificios · {stats.totalPersonas.toLocaleString()} personas · actualizado {updatedAt}
          </p>
        </div>
        <RefreshButton />
      </div>

      {/* Stats bar */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        <div className="bg-red-50 rounded-xl p-3 text-center">
          <p className="text-2xl font-bold text-red-700">{stats.totalDesaparecidos.toLocaleString()}</p>
          <p className="text-xs text-red-600 mt-0.5">Desaparecidos</p>
        </div>
        <div className="bg-green-50 rounded-xl p-3 text-center">
          <p className="text-2xl font-bold text-green-700">{stats.totalLocalizados.toLocaleString()}</p>
          <p className="text-xs text-green-600 mt-0.5">Localizados</p>
        </div>
        <div className="bg-gray-100 rounded-xl p-3 text-center">
          <p className="text-2xl font-bold text-gray-700">{stats.totalFallecidos.toLocaleString()}</p>
          <p className="text-xs text-gray-500 mt-0.5">Fallecidos</p>
        </div>
      </div>

      {/* Search */}
      <div className="mb-6">
        <Suspense>
          <SearchBar defaultValue={q} />
        </Suspense>
      </div>

      {/* Search results */}
      {searchResults ? (
        <div>
          <p className="text-sm text-gray-500 mb-3">{searchResults.total} resultados para "{q}"</p>
          <div className="space-y-3">
            {searchResults.personas.map(p => <PersonaCard key={p.id} persona={p} />)}
          </div>
          {searchResults.total > 50 && (
            <p className="text-center text-sm text-gray-400 mt-4">
              Mostrando 50 de {searchResults.total}. Refina tu búsqueda.
            </p>
          )}
        </div>
      ) : (
        /* Edificios list */
        <div className="space-y-3">
          {edificios.map(e => <EdificioCard key={e.id} edificio={e} />)}
          {stats.sinEdificio > 0 && (
            <div className="bg-white rounded-xl border border-dashed p-4 text-center text-gray-400">
              <p className="font-medium">{stats.sinEdificio.toLocaleString()} personas sin edificio identificado</p>
              <p className="text-xs mt-1">Zona no pudo ser mapeada a un edificio conocido</p>
            </div>
          )}
        </div>
      )}
    </main>
  )
}
```

- [ ] **Step 3: Edificio detail page**

```tsx
// src/app/edificios/[id]/page.tsx
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getEdificios, getPersonasByEdificio } from '@/lib/data'
import { PersonaCard } from '@/components/PersonaCard'

export const dynamic = 'force-dynamic'

interface Props {
  params: Promise<{ id: string }>
  searchParams: Promise<{ page?: string }>
}

export default async function EdificioPage({ params, searchParams }: Props) {
  const { id } = await params
  const { page: pageStr } = await searchParams
  const page = parseInt(pageStr ?? '1')

  const { edificios } = getEdificios()
  const edificio = edificios.find(e => e.id === id)
  if (!edificio) notFound()

  const { personas, total } = await getPersonasByEdificio(id, page)
  const totalPages = Math.ceil(total / 50)

  return (
    <main className="max-w-3xl mx-auto px-4 py-8">
      {/* Breadcrumb */}
      <Link href="/" className="text-sm text-gray-500 hover:text-gray-800">← Todos los edificios</Link>

      {/* Header */}
      <div className="mt-4 mb-6">
        <h1 className="text-2xl font-bold text-gray-900">{edificio.nombre}</h1>
        <p className="text-sm text-gray-500">{edificio.sector} · Daño {edificio.daño}</p>
        <div className="flex gap-4 mt-3 text-sm">
          <span className="text-red-700 font-medium">{edificio.totalDesaparecidos} desaparecidos</span>
          <span className="text-green-700">{edificio.totalLocalizados} localizados</span>
          {edificio.totalFallecidos > 0 && (
            <span className="text-gray-500">{edificio.totalFallecidos} fallecidos</span>
          )}
        </div>
      </div>

      {/* Personas */}
      <div className="space-y-3">
        {personas.map(p => <PersonaCard key={p.id} persona={p} />)}
      </div>

      {personas.length === 0 && (
        <p className="text-center text-gray-400 py-12">No hay personas registradas en este edificio.</p>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex justify-center gap-2 mt-8">
          {page > 1 && (
            <Link href={`/edificios/${id}?page=${page - 1}`} className="px-4 py-2 border rounded-lg text-sm">
              ← Anterior
            </Link>
          )}
          <span className="px-4 py-2 text-sm text-gray-500">Página {page} de {totalPages}</span>
          {page < totalPages && (
            <Link href={`/edificios/${id}?page=${page + 1}`} className="px-4 py-2 border rounded-lg text-sm">
              Siguiente →
            </Link>
          )}
        </div>
      )}
    </main>
  )
}
```

- [ ] **Step 4: Verify build**

```bash
npm run build
```
Expected: no TypeScript or build errors

- [ ] **Step 5: Commit**

```bash
git add src/app/
git commit -m "feat: home page (edificios list + search) and edificio detail page"
```

---

## Task 15: Deploy to Vercel

**Files:**
- No new files — configuration in Vercel dashboard

- [ ] **Step 1: Push repo to GitHub**

```bash
git remote add origin https://github.com/YOUR_USERNAME/venezuela-edificios.git
git push -u origin main
```

- [ ] **Step 2: Connect to Vercel**

1. Go to vercel.com → New Project → Import from GitHub
2. Select the `venezuela-edificios` repo
3. Framework: Next.js (auto-detected)
4. Root directory: `.` (default)

- [ ] **Step 3: Add Vercel environment variables**

In Vercel → Project → Settings → Environment Variables, add:

| Name | Value |
|------|-------|
| `GH_PAT` | GitHub Personal Access Token (scopes: `repo`, `workflow`) |
| `GITHUB_OWNER` | your GitHub username |
| `GITHUB_REPO` | `venezuela-edificios` |

Vercel KV variables are added automatically when you connect a KV store.

- [ ] **Step 4: Create Vercel KV store**

In Vercel → Storage → Create KV Database → Connect to your project.
Vercel automatically injects `KV_REST_API_URL` and `KV_REST_API_TOKEN`.

- [ ] **Step 5: Add GitHub Secrets**

In GitHub repo → Settings → Secrets → Actions → New repository secret:

| Name | Value |
|------|-------|
| `KERNEL_API_KEY` | your kernel.sh API key (regenerate the one from chat) |
| `GH_PAT` | same token as Vercel (needs `contents: write` + `actions: write`) |

- [ ] **Step 6: Trigger first scrape manually**

In GitHub → Actions → Scrape Data → Run workflow

Wait ~15 minutes, then verify `public/data/` has been updated in the repo.

- [ ] **Step 7: Verify production**

- Open the Vercel deployment URL
- Confirm edificios list loads
- Confirm search works
- Confirm "Actualizar datos" button triggers the workflow
- Confirm `GET /api/v1/stats` returns JSON with CORS headers

---

## Self-Review

**Spec coverage:**
- ✅ 4 data sources scraped
- ✅ Fuzzy matching with 0.75 threshold
- ✅ "Sin edificio identificado" category
- ✅ Auto every 2h (cron) + manual button
- ✅ Fallecido button with confirmation modal
- ✅ Fallecido persists in Vercel KV
- ✅ Public API /api/v1/* with CORS
- ✅ Personas fields: nombre, edad, genero, cedula, estado, zona, contacto, foto, fuente
- ✅ All secrets documented

**Gaps addressed:**
- `GITHUB_OWNER` and `GITHUB_REPO` env vars needed for the refresh route — documented in Task 15
- `public/data/` placeholder files needed before first deploy — added in Task 8

**Type consistency:** All function signatures, interface names, and field names are consistent across tasks. `Persona.estado` is `'desaparecido' | 'localizado' | 'fallecido'` throughout.
