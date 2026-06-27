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
