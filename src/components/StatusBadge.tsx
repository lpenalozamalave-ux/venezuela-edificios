type Estado = 'desaparecido' | 'localizado' | 'fallecido'

const CONFIG: Record<Estado, { label: string; className: string }> = {
  desaparecido: { label: 'Desaparecido', className: 'bg-red-100 text-red-800' },
  localizado:   { label: 'Localizado',   className: 'bg-green-100 text-green-800' },
  fallecido:    { label: 'Fallecido',     className: 'bg-gray-100 text-gray-600' },
}

export function StatusBadge({ estado }: { estado: Estado }) {
  const { label, className } = CONFIG[estado] ?? CONFIG.desaparecido
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${className}`}>
      <span className="w-1.5 h-1.5 rounded-full bg-current mr-1.5" />
      {label}
    </span>
  )
}
