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
