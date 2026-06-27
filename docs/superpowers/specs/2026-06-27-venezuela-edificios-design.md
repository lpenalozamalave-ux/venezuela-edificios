# Venezuela Edificios — Diseño del sistema

**Fecha:** 2026-06-27  
**Stack:** Next.js 15 · Vercel · GitHub Actions · Vercel KV  
**Dominio:** Clasificación de personas desaparecidas por edificio — terremoto Venezuela 2026

---

## Objetivo

Página web pública que muestra personas desaparecidas, localizadas y fallecidas organizadas por edificio derrumbado. Agrega datos de 4 fuentes externas. Expone API pública para que otros proyectos consuman los datos consolidados.

---

## Arquitectura

```
[Fuentes externas]
  terremotovenezuela.com   → edificios (803, DOM scraping)
  vea2026.com              → desaparecidos (~52k, Convex API)
  venezuelatebusca.com     → desaparecidos (~35k, DOM scraping via kernel.sh)
  localizadosvenezuela.com → localizados (~2k, REST API pública)
        ↓
[GitHub Actions — scraper.js]
  Corre: automático cada 2h + manual via botón web
  Produce: edificios.json · personas.json · stats.json
  Commit → Vercel redespliega (~1 min)
        ↓
[Vercel — Next.js App]
  /public/data/        → JSON estático (datos scrapeados)
  Vercel KV (Redis)    → estados fallecido (user-generated)
  /api/v1/...          → API pública CORS abierto
  /                    → Frontend (lista edificios → personas)
```

---

## Fuentes de datos

| Fuente | Método | Campo edificio | Volumen |
|--------|--------|---------------|---------|
| terremotovenezuela.com | DOM scraping | nombre estructurado | 803 edificios |
| vea2026.com | Convex API (`people:list`) | `zone` (semi-estructurado) | ~52k personas |
| venezuelatebusca.com | DOM scraping via kernel.sh | texto libre | ~35k personas |
| localizadosvenezuela.com | `GET /api/v1/localizados` | `lugarNombre` (hospital) | ~2k personas |

**Notas de integración:**
- vea2026.com: endpoint Convex `jovial-shepherd-115.convex.cloud/api/query`, función `people:list`, paginado por cursor. Sin auth.
- localizadosvenezuela.com: `GET /api/v1/localizados?page=N&limit=100`. Sin auth. CORS abierto.
- venezuelatebusca.com: requiere browser headless (kernel.sh) — bloquea fetch directo.
- terremotovenezuela.com: scraping DOM, lista paginada de edificios.

---

## Matching fuzzy edificio → persona

El campo de ubicación en las fuentes es texto libre. Se normaliza usando similitud de strings (Levenshtein + tokenización).

- Umbral de confianza: **0.75** — por encima se asigna edificio, por debajo queda sin clasificar.
- Personas sin match: visibles en categoría **"Sin edificio identificado"** — no se descartan.
- El matching corre dentro del scraper (GitHub Actions), no en runtime de Vercel.

---

## Esquema de datos

### `public/data/edificios.json`
```json
{
  "updatedAt": "2026-06-27T03:00:00Z",
  "total": 803,
  "edificios": [{
    "id": "243ac101-b70c-49bb-a540-5474cba820aa",
    "nombre": "El Palmar Este",
    "direccion": "Blvr. Niza, Caraballeda 1165, La Guaira",
    "sector": "Caraballeda",
    "daño": "total",
    "coordenadas": { "lat": 10.617, "lng": -66.847 },
    "totalDesaparecidos": 47,
    "totalLocalizados": 3,
    "totalFallecidos": 1
  }]
}
```

### `public/data/personas.json`
```json
{
  "updatedAt": "2026-06-27T03:00:00Z",
  "total": 89000,
  "personas": [{
    "id": "j970nr2tc1wb0nqyegw9sk11fh89f63k",
    "nombre": "Amilcar Jose Gonzalez",
    "edad": 60,
    "genero": "Masculino",
    "cedula": "6491614",
    "estado": "desaparecido",
    "edificioId": "243ac101-b70c-49bb-a540-5474cba820aa",
    "edificioNombre": "Edificios la Páez",
    "zonaOriginal": "Edificios la Páez",
    "ultimaUbicacion": "Catia la Mar",
    "foto": "https://jovial-shepherd-115.convex.cloud/api/storage/...",
    "contacto": "04145712615",
    "reportadoEn": "2026-06-26T23:09:00Z",
    "fuente": "vea2026",
    "fuenteUrl": "https://www.vea2026.com/"
  }]
}
```

### Vercel KV — estados fallecido
```
KEY:   fallecido:{personaId}
VALUE: { timestamp, reportadoPor: "anónimo" }
```

---

## Actualización de datos

- **Automática:** GitHub Actions cron `0 */2 * * *` (cada 2 horas)
- **Manual:** botón "Actualizar datos" en la web → `POST /api/refresh` → llama GitHub API para disparar workflow
- **Flujo completo:**
  1. Actions corre `scraper.js`
  2. Fetcha las 4 fuentes (paralelo donde posible)
  3. Corre matching fuzzy
  4. Escribe los 3 JSON en `public/data/`
  5. Commit + push → Vercel redespliega (~1 min)
- **Indicador en la web:** muestra "Actualizando..." mientras el workflow corre. Refresca automáticamente cuando termina.

---

## Frontend

### Vista principal (lista de edificios)
- Header: nombre del sitio + botón "Actualizar datos" + timestamp última actualización + countdown próxima actualización
- Buscador global: busca por nombre de persona o edificio
- Filtros: estado (todos / desaparecido / localizado / fallecido)
- Lista de edificios ordenada por cantidad de desaparecidos (desc)
- Cada edificio muestra barra de conteo: desaparecidos / localizados / fallecidos
- Al final: tarjeta "Sin edificio identificado" con total de personas no clasificadas

### Vista de edificio (personas)
- Breadcrumb: Edificios → [Nombre edificio]
- Resumen: totales por estado
- Tarjetas de personas con: foto (si disponible), nombre, edad, género, cédula, estado, última ubicación, fecha reporte, fuente con link, teléfono de contacto
- Botón "Marcar como Fallecido" en cada tarjeta con confirmación

### Botón "Marcar como Fallecido"
1. Click → modal: "¿Confirmar que [nombre] ha fallecido? Esta acción es pública."
2. Confirm → `POST /api/personas/:id/fallecido`
3. Vercel KV guarda: `{ timestamp, reportadoPor: "anónimo" }`
4. Tarjeta actualiza estado en tiempo real (sin reload)

---

## API pública

Base URL: `https://[dominio]/api/v1`  
Autenticación: ninguna  
CORS: `Access-Control-Allow-Origin: *`

| Endpoint | Descripción |
|----------|-------------|
| `GET /api/v1/edificios` | Lista edificios con conteos |
| `GET /api/v1/edificios/:id` | Detalle de un edificio |
| `GET /api/v1/edificios/:id/personas` | Personas de un edificio (paginado) |
| `GET /api/v1/personas?q=...&page=1` | Búsqueda global de personas |
| `GET /api/v1/stats` | Totales generales |

Todos los endpoints leen de los JSON estáticos + combinan con Vercel KV para el estado fallecido. Respuesta en JSON.

---

## Secrets y variables de entorno

| Variable | Dónde se configura | Uso |
|----------|--------------------|-----|
| `KERNEL_API_KEY` | GitHub Secret | kernel.sh browser para venezuelatebusca.com |
| `GITHUB_TOKEN` | GitHub Secret (automático) | Disparar workflow desde Vercel API route |
| `KV_REST_API_URL` | Vercel Environment Variable | Vercel KV (fallecidos) |
| `KV_REST_API_TOKEN` | Vercel Environment Variable | Vercel KV (fallecidos) |

---

## Criterios de éxito

1. La página carga en menos de 2s (datos servidos como JSON estático desde Vercel CDN)
2. El botón "Actualizar" dispara el scraping y la web refleja datos nuevos en menos de 20 minutos
3. Marcar fallecido persiste entre recargas de página
4. La API pública responde con CORS correcto y sin auth
5. Personas sin edificio identificado son visibles (no se pierden datos)
