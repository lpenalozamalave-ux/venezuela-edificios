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
