# Task 6 Report — venezuelatebusca.js

## Status: DONE

## File created
`scripts/scraper/sources/venezuelatebusca.js`

## What was implemented

- `fetchVenezuelaTeBusca()` → `Promise<RawPersona[]>` (CommonJS, `module.exports`)
- `createBrowser(apiKey)` — POSTs to `https://api.onkernel.com/browsers` with `{ timeout_seconds: 300 }`, returns `session_id`
- `runPlaywright(apiKey, sessionId, code, timeoutSec)` — POSTs Playwright code to `/browsers/{sessionId}/playwright/execute`
- `KERNEL_API_KEY` read from `process.env` only — never hardcoded
- Two-phase scrape: (1) get total count from homepage text; (2) paginate `?page=N` extracting person cards
- Pagination stops on: `hasNext === false`, `consecutiveEmptyPages >= 3`, or `personas.length >= total`
- DOM extraction uses a waterfall of selectors (`[class*="card"]`, `article`, `[data-id]`, etc.) and picks the first that returns 3–500 elements, resilient to site CSS changes
- `makeId(nombre, fecha)` → `vtb-` + first 20 chars of `base64(nombre + fecha)` — matches global constraint exactly
- Each persona: `{ id, nombre, edad, genero, cedula: null, zona, ultimaUbicacion, foto: null, contacto: null, reportadoEn, estado: 'desaparecido', fuente: 'venezuelatebusca', fuenteUrl }`
- `zonaOriginal` is NOT set here — it is set by the orchestrator (index.js) which calls it `zona`; the matcher reads `p.zona`

## Bug fixes vs plan spec

1. **`hasMore` inside evaluate**: plan had `document.querySelector(...)` outside `page.evaluate()` (would run in Node context, not browser). Fixed: moved into `evaluate()` block.
2. **Template literal in Playwright string**: `page=${pageNum + 1}` inside the code string was computed in Node before being sent (correct), but the plan's scrapeCode was a template literal inside a while loop — factored into `buildScrapePageCode(pageNum)` for clarity and correctness.
3. **Graceful degradation**: if count fetch fails, falls back to 35000 upper bound (noted in task context as ~35k personas). If a page fails, logs and continues rather than crashing.

## Smoke test results

```
exports: [ 'fetchVenezuelaTeBusca' ]
fetchVenezuelaTeBusca type: function
Sample id: vtb-SnVhbiBQZXJlejIwMjYt
PASS: throws correct error when KERNEL_API_KEY missing: KERNEL_API_KEY env var required
Import destructuring: OK, type = function
Returns Promise: YES
```

All 4 assertions pass. Full scrape test requires a real `KERNEL_API_KEY` (GitHub Secret at runtime).

## Concerns

None blocking. One note: venezuelatebusca.com DOM structure is unknown without a real browser run — the selector waterfall strategy is resilient but may need tuning after first live execution if the site uses unusual markup.
