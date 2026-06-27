import { NextResponse } from 'next/server'
import { searchPersonas } from '@/lib/data'

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const q = searchParams.get('q') ?? ''
  const page = parseInt(searchParams.get('page') ?? '1')
  const limit = Math.min(parseInt(searchParams.get('limit') ?? '50'), 100)
  if (!q) return NextResponse.json({ error: 'Parámetro q requerido' }, { status: 400 })
  const result = await searchPersonas(q, page, limit)
  return NextResponse.json({ ...result, page, q })
}
