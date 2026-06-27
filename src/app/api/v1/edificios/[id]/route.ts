import { NextResponse } from 'next/server'
import { getEdificios } from '@/lib/data'

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const { edificios } = getEdificios()
  const edificio = edificios.find(e => e.id === id)
  if (!edificio) return NextResponse.json({ error: 'No encontrado' }, { status: 404 })
  return NextResponse.json(edificio)
}
