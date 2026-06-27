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
    .replace(/[̀-ͯ]/g, '')  // remove combining accent marks (Unicode combining diacritics block)
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

/**
 * Token containment score: how many tokens of `query` appear in `target`
 * Returns fraction of query tokens found in target token set
 */
function tokenContainmentScore(query, target) {
  if (!query || !target) return 0
  const qTokens = query.split(/\s+/).filter(Boolean)
  const tTokens = new Set(target.split(/\s+/).filter(Boolean))
  if (qTokens.length === 0) return 0
  const hits = qTokens.filter(t => tTokens.has(t)).length
  return hits / qTokens.length
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

    // 1. Dice coefficient between zone and building name
    const diceNombre = diceCoefficient(normalizedZona, normalizedNombre)

    // 2. Dice coefficient between zone and sector
    const diceSector = diceCoefficient(normalizedZona, normalizedSector)

    // 3. Token containment: what fraction of building-name tokens appear in zone?
    //    (e.g. "caribe" found in "caribe mision vivienda" → 1.0)
    const nombreContainment = tokenContainmentScore(normalizedNombre, normalizedZona)

    // 4. Token containment: what fraction of sector tokens appear in zone?
    const sectorContainment = tokenContainmentScore(normalizedSector, normalizedZona)

    // Combine signals:
    // - Direct dice on nombre is the primary signal
    // - Nombre token containment gives strong evidence when all building-name
    //   tokens appear in the zone
    // - Sector reinforces matches when zone includes location tokens
    const score = Math.min(1,
      Math.max(
        diceNombre,
        nombreContainment * 0.9,        // all nombre tokens found in zone → strong
        diceSector * 0.6                 // sector overlap as reinforcement
      )
      + (sectorContainment > 0.5 ? sectorContainment * 0.15 : 0)  // sector bonus
    )

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
