'use client'
import { useRouter, useSearchParams } from 'next/navigation'
import { useTransition } from 'react'

export function SearchBar({ defaultValue = '' }: { defaultValue?: string }) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [isPending, startTransition] = useTransition()

  function handleSearch(term: string) {
    const params = new URLSearchParams(searchParams.toString())
    if (term) params.set('q', term)
    else params.delete('q')
    params.delete('page')
    startTransition(() => router.push(`/?${params.toString()}`))
  }

  return (
    <div className="relative">
      <input
        type="search"
        defaultValue={defaultValue}
        onChange={e => handleSearch(e.target.value)}
        placeholder="Buscar persona o edificio..."
        className="w-full pl-10 pr-4 py-2.5 border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-black"
      />
      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">🔍</span>
      {isPending && <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs">...</span>}
    </div>
  )
}
