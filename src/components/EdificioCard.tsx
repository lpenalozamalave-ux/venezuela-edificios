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
