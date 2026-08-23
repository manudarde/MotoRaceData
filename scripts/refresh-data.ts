import { mkdir, readFile, readdir, rename, rm, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { z } from 'zod'

const API = 'https://api.motogp.pulselive.com/motogp/v1'
const output = join(process.cwd(), 'public', 'data')
const seasonSchema = z.object({ id: z.string(), year: z.number(), current: z.boolean() })
const categorySchema = z.object({ id: z.string(), name: z.string(), legacy_id: z.number() })
const safeText = z.string().nullish().transform((value) => value ?? '')
const eventSchema = z.object({ id: z.string(), sponsored_name: safeText.transform((value) => value || 'Unknown event'), test: z.boolean().optional().default(false), date_start: z.string().nullable().optional(), date_end: z.string().nullable().optional(), circuit: z.object({ name: safeText }).default({ name: '' }), country: z.object({ name: safeText }).default({ name: '' }) })
const sessionSchema = z.object({ id: z.string(), type: z.string(), number: z.number().nullable().optional(), status: z.string().default(''), date: z.string().nullable().optional() })

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))
async function request(path: string, optional = false): Promise<unknown> {
  for (let attempt = 0; attempt < 5; attempt++) {
    const controller = new AbortController(); const timeout = setTimeout(() => controller.abort(), 20_000)
    try {
      const response = await fetch(`${API}/${path}`, { signal: controller.signal, headers: { accept: 'application/json', 'user-agent': 'MotoRaceData/2.0' } })
      if (optional && [204, 400, 403, 404].includes(response.status)) return null
      if (response.ok) { const data = await response.json(); await wait(100); return data }
      if (response.status !== 429 && response.status < 500) throw new Error(`${path}: HTTP ${response.status}`)
      await wait(Number(response.headers.get('retry-after') ?? 2 ** attempt) * 1000)
    } finally { clearTimeout(timeout) }
  }
  if (optional) {
    console.warn(`${path}: unavailable after 3 attempts; keeping previous data when present`)
    return null
  }
  throw new Error(`${path}: failed after 3 attempts`)
}

async function pool<T, R>(items: T[], worker: (item: T) => Promise<R>, limit = 1): Promise<R[]> {
  const result: R[] = new Array(items.length); let cursor = 0
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, async () => { while (cursor < items.length) { const index = cursor++; result[index] = await worker(items[index]) } }))
  return result
}

function normalizeResult(raw: any) {
  return { position: raw?.position ?? null, riderName: raw?.rider?.full_name ?? '', riderNumber: raw?.rider?.number ?? null, teamName: raw?.team?.name ?? '', constructorName: raw?.constructor?.name ?? '', totalLaps: raw?.total_laps ?? null, time: raw?.best_lap?.time ?? '', totalTime: raw?.time ?? '', topSpeed: raw?.top_speed ?? null, gapFirst: raw?.gap?.first ?? '', gapPrevious: raw?.gap?.prev ?? '' }
}

async function previousClassification(year: number, eventId: string, category: number, sessionId: string) {
  try { const old = JSON.parse(await readFile(join(output, 'seasons', String(year), 'events', eventId, `${category}.json`), 'utf8')); return old.sessions?.find((item: any) => item.id === sessionId)?.classification ?? [] } catch { return [] }
}

async function generateSeason(season: z.infer<typeof seasonSchema>) {
  const stage = join(output, '.staging', String(season.year)); await rm(stage, { recursive: true, force: true }); await mkdir(stage, { recursive: true })
  const categories = z.array(categorySchema).parse(await request(`results/categories?seasonUuid=${season.id}`)).filter((item) => [1, 2, 3].includes(item.legacy_id))
  const events = z.array(eventSchema).parse(await request(`results/events?seasonUuid=${season.id}`))
  const normalizedEvents = events.map((event) => ({ id: event.id, name: event.sponsored_name, circuit: event.circuit.name, country: event.country.name, startDate: event.date_start ?? null, endDate: event.date_end ?? null, test: event.test }))
  const normalizedCategories = categories.map((item) => ({ id: item.id, name: item.name, legacyId: item.legacy_id }))
  await writeJson(join(stage, 'index.json'), { schemaVersion: 1, year: season.year, seasonId: season.id, categories: normalizedCategories, events: normalizedEvents })

  for (const category of normalizedCategories) {
    const eventBundles = await pool(normalizedEvents, async (event) => {
      const rawSessions = z.array(sessionSchema).parse((await request(`results/sessions?eventUuid=${event.id}&categoryUuid=${category.id}`, true)) ?? [])
      const relevantSessions = season.year < 2020 ? rawSessions.filter((session) => {
        const type = session.type.toUpperCase()
        return type === 'RAC' || ['SPR', 'SPRINT', 'Q2'].includes(type) || (type === 'Q' && session.number === 2)
      }) : rawSessions
      const sessions = await pool(relevantSessions, async (session) => {
        const raw: any = await request(`results/session/${session.id}/classification?seasonYear=${season.year}&test=false`, true)
        let classification = (raw?.classification ?? []).map(normalizeResult)
        if (!classification.length) classification = await previousClassification(season.year, event.id, category.legacyId, session.id)
        return { id: session.id, type: session.type, number: session.number ?? null, status: session.status, date: session.date ?? null, classification }
      })
      const bundle = { schemaVersion: 1, year: season.year, event, category, sessions }
      await writeJson(join(stage, 'events', event.id, `${category.legacyId}.json`), bundle)
      return { ...event, sessions: sessions.filter((item) => ['RAC', 'SPR', 'SPRINT'].includes(item.type.toUpperCase())) }
    })
    await writeJson(join(stage, 'race', `${category.legacyId}.json`), { schemaVersion: 1, year: season.year, category, events: eventBundles.filter((item) => !item.test) })
  }
  const final = join(output, 'seasons', String(season.year)); const backup = `${final}.backup`
  await mkdir(join(output, 'seasons'), { recursive: true }); await rm(backup, { recursive: true, force: true })
  try { await rename(final, backup) } catch {}
  await rename(stage, final); await rm(backup, { recursive: true, force: true })
}

async function writeJson(path: string, value: unknown) { await mkdir(dirname(path), { recursive: true }); await writeFile(path, `${JSON.stringify(value, null, 2)}\n`) }

async function main() {
  const seasons = z.array(seasonSchema).parse(await request('results/seasons'))
  const requested = process.argv.find((arg) => arg.startsWith('--years='))?.split('=')[1]?.split(',').map(Number)
  const selected = seasons.filter((season) => season.year >= 2012 && (requested ? requested.includes(season.year) : season.current))
  for (const season of selected) await generateSeason(season)
  const available = (await readdir(join(output, 'seasons'), { withFileTypes: true })).filter((item) => item.isDirectory() && /^\d{4}$/.test(item.name)).map((item) => Number(item.name)).sort()
  const listed = seasons.filter((season) => available.includes(season.year))
  const current = seasons.find((season) => season.current)?.year ?? Math.max(...available)
  const generatedAt = new Date().toISOString()
  await writeJson(join(output, 'manifest.json'), { schemaVersion: 1, revision: generatedAt.replace(/\D/g, '').slice(0, 14), generatedAt, source: API, currentSeason: available.includes(current) ? current : Math.max(...available), seasons: listed.map((season) => ({ year: season.year, id: season.id, current: season.current })) })
}

main().catch((error) => { console.error(error); process.exitCode = 1 })
