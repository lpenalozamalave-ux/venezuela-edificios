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
    setPersona(p => ({ ...p, estado: 'fallecido' as const }))
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
