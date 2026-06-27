import { NextResponse } from 'next/server'
import { getEdificios } from '@/lib/data'

export async function GET() {
  const data = getEdificios()
  return NextResponse.json(data)
}
