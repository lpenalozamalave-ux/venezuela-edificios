// src/app/api/refresh/route.ts
import { NextResponse } from 'next/server'

export async function POST() {
  const token = process.env.GH_PAT
  const owner = process.env.GITHUB_OWNER
  const repo = process.env.GITHUB_REPO

  if (!token || !owner || !repo) {
    return NextResponse.json({ error: 'GitHub config missing' }, { status: 500 })
  }

  const res = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/actions/workflows/scraper.yml/dispatches`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/vnd.github+json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ ref: 'main' }),
    }
  )

  if (res.status === 204) {
    return NextResponse.json({ ok: true, message: 'Scraping iniciado' })
  }

  const err = await res.text()
  return NextResponse.json({ error: err }, { status: res.status })
}
