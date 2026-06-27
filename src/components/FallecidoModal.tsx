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
