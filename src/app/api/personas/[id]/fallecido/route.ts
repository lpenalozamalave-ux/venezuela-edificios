import { NextResponse } from 'next/server'
import { markFallecido } from '@/lib/kv'

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  if (!id) {
    return NextResponse.json({ error: 'id requerido' }, { status: 400 })
  }
  await markFallecido(id)
  return NextResponse.json({ ok: true })
}
