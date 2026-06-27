export interface Coordenadas {
  lat: number
  lng: number
}

export interface Edificio {
  id: string
  nombre: string
  direccion: string
  sector: string
  daño: 'total' | 'severo' | 'parcial' | 'desconocido'
  coordenadas: Coordenadas | null
  totalDesaparecidos: number
  totalLocalizados: number
  totalFallecidos: number
}

export interface Persona {
  id: string
  nombre: string
  edad: number | null
  genero: 'Masculino' | 'Femenino' | 'Desconocido'
  cedula: string | null
  estado: 'desaparecido' | 'localizado' | 'fallecido'
  edificioId: string | null
  edificioNombre: string | null
  zonaOriginal: string | null
  ultimaUbicacion: string | null
  foto: string | null
  contacto: string | null
  reportadoEn: string
  fuente: 'vea2026' | 'venezuelatebusca' | 'localizados'
  fuenteUrl: string
}

export interface Stats {
  updatedAt: string
  totalEdificios: number
  totalPersonas: number
  totalDesaparecidos: number
  totalLocalizados: number
  totalFallecidos: number
  sinEdificio: number
}

export interface EdificiosData {
  updatedAt: string
  total: number
  edificios: Edificio[]
}

export interface PersonasData {
  updatedAt: string
  total: number
  personas: Persona[]
}

export interface FallecidoMark {
  timestamp: string
  reportadoPor: 'anónimo'
}
