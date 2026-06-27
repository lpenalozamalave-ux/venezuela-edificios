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
          <p className="text-sm text-gray-500 mb-3">{searchResults.total} resultados para &quot;{q}&quot;</p>
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
