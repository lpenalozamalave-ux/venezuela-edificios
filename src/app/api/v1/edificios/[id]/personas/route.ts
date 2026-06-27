import { NextResponse } from 'next/server'
import { getPersonasByEdificio } from '@/lib/data'

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const { searchParams } = new URL(req.url)
  const page = parseInt(searchParams.get('page') ?? '1')
  const limit = Math.min(parseInt(searchParams.get('limit') ?? '50'), 100)
  const result = await getPersonasByEdificio(id, page, limit)
  return NextResponse.json({ ...result, page, limit })
}
