import type {
  PointEntry,
  RaceBundle,
  RaceEvent,
  Result,
  Standing,
  Statistics,
} from './types'

export const racePoints = (position: number) =>
  [25, 20, 16, 13, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1][position - 1] ?? 0

export const sprintPoints = (position: number) =>
  [12, 9, 7, 6, 5, 4, 3, 2, 1][position - 1] ?? 0

const ignoredTeamWords = new Set([
  'team',
  'motogp',
  'moto2',
  'moto3',
  'racing',
  'factory',
])
const teamWords = (name: string) =>
  new Set(
    name
      .toLowerCase()
      .split(/[\s\-_/.,]+/)
      .filter((word) => word && !ignoredTeamWords.has(word)),
  )
export function sameTeam(a: string, b: string, threshold = 0.8) {
  const aw = teamWords(a),
    bw = teamWords(b)
  if (!aw.size || !bw.size) return false
  const smaller = aw.size <= bw.size ? aw : bw,
    larger = aw.size <= bw.size ? bw : aw
  return (
    [...smaller].filter((word) => larger.has(word)).length / smaller.size >=
    threshold
  )
}
export function canonicalTeams(names: string[]) {
  const unique = [...new Set(names.filter(Boolean).map((name) => name.trim()))]
  const map = new Map<string, string>()
  unique.forEach((name) => {
    const matches = unique.filter(
      (other) => name === other || sameTeam(name, other),
    )
    const canonical =
      matches.sort(
        (a, b) => teamWords(a).size - teamWords(b).size || a.length - b.length,
      )[0] ?? name
    matches.forEach((match) => map.set(match, canonical))
  })
  return map
}

const isRace = (type: string) => type.toUpperCase() === 'RAC'
const isSprint = (type: string) =>
  ['SPR', 'SPRINT'].includes(type.toUpperCase())

export function pointEntries(bundle: RaceBundle): PointEntry[] {
  const entries = bundle.events.flatMap((event) => {
    const hasRace2 = event.sessions.some(
      (session) => isRace(session.type) && session.number === 2,
    )
    return event.sessions.flatMap((session) => {
      const race = isRace(session.type)
      const sprint = isSprint(session.type)
      if ((!race && !sprint) || (hasRace2 && race && session.number !== 2))
        return []
      return session.classification
        .filter(
          (result): result is Result & { position: number } =>
            result.position !== null,
        )
        .map((result) => {
          let points = race
            ? racePoints(result.position)
            : sprintPoints(result.position)
          if (bundle.category.legacyId === 2 && race && session.number === 2)
            points /= 2
          return {
            ...result,
            eventId: event.id,
            eventName: event.name,
            eventDate: event.startDate,
            sessionId: session.id,
            isRace: race,
            isSprint: sprint,
            points,
          }
        })
    })
  })
  const teams = canonicalTeams(entries.map((entry) => entry.teamName))
  return entries.map((entry) => ({
    ...entry,
    teamName: teams.get(entry.teamName) ?? entry.teamName,
  }))
}

function aggregate(
  entries: PointEntry[],
  key: (entry: PointEntry) => string,
): Standing[] {
  const groups = new Map<string, PointEntry[]>()
  entries.forEach((entry) =>
    groups.set(key(entry), [...(groups.get(key(entry)) ?? []), entry]),
  )
  const rows = [...groups.entries()]
    .filter(([name]) => name.trim())
    .map(([name, values]) => {
      const latest = values.at(-1)!
      return {
        position: 0,
        name,
        riderNumber: latest.riderNumber,
        teamName: latest.teamName,
        bikeName: latest.constructorName,
        points: values.reduce((sum, value) => sum + value.points, 0),
        gapToPrevious: 0,
        gapToFirst: 0,
      }
    })
    .sort((a, b) => b.points - a.points || a.name.localeCompare(b.name))
  const leader = rows[0]?.points ?? 0
  return rows.map((row, index) => ({
    ...row,
    position: index + 1,
    gapToPrevious: index ? rows[index - 1].points - row.points : 0,
    gapToFirst: leader - row.points,
  }))
}

export const riderStandings = (entries: PointEntry[]) =>
  aggregate(entries, (entry) => entry.riderName)
export const teamStandings = (entries: PointEntry[]) =>
  aggregate(entries, (entry) => entry.teamName)
export const bikeStandings = (entries: PointEntry[]) =>
  aggregate(entries, (entry) => entry.constructorName)

export function riderStatistics(entries: PointEntry[]): Statistics[] {
  const standings = riderStandings(entries)
  return standings.map((standing) => {
    const rows = entries.filter((entry) => entry.riderName === standing.name)
    return {
      ...standing,
      starts: rows.filter((entry) => entry.isRace).length,
      wins: rows.filter((entry) => entry.isRace && entry.position === 1).length,
      secondPlaces: rows.filter((entry) => entry.isRace && entry.position === 2)
        .length,
      thirdPlaces: rows.filter((entry) => entry.isRace && entry.position === 3)
        .length,
      podiums: rows.filter(
        (entry) => entry.isRace && (entry.position ?? 99) <= 3,
      ).length,
      sprintWins: rows.filter((entry) => entry.isSprint && entry.position === 1)
        .length,
      racePoints: rows
        .filter((entry) => entry.isRace)
        .reduce((sum, entry) => sum + entry.points, 0),
      sprintPoints: rows
        .filter((entry) => entry.isSprint)
        .reduce((sum, entry) => sum + entry.points, 0),
    }
  })
}

export function groupedStatistics(
  entries: PointEntry[],
  kind: 'team' | 'bike',
): Statistics[] {
  const key = (entry: PointEntry) =>
    kind === 'team' ? entry.teamName : entry.constructorName
  return aggregate(entries, key).map((standing) => {
    const rows = entries.filter((entry) => key(entry) === standing.name)
    return {
      ...standing,
      starts: rows.filter((e) => e.isRace).length,
      wins: rows.filter((e) => e.isRace && e.position === 1).length,
      secondPlaces: rows.filter((e) => e.isRace && e.position === 2).length,
      thirdPlaces: rows.filter((e) => e.isRace && e.position === 3).length,
      podiums: rows.filter((e) => e.isRace && (e.position ?? 99) <= 3).length,
      sprintWins: rows.filter((e) => e.isSprint && e.position === 1).length,
      racePoints: rows
        .filter((e) => e.isRace)
        .reduce((sum, e) => sum + e.points, 0),
      sprintPoints: rows
        .filter((e) => e.isSprint)
        .reduce((sum, e) => sum + e.points, 0),
    }
  })
}

export function eventPoints(entries: PointEntry[], eventId: string) {
  return riderStandings(entries.filter((entry) => entry.eventId === eventId))
}

export function riderEventPositions(entries: PointEntry[]) {
  const riders = [...new Set(entries.map((entry) => entry.riderName))]
  const events = [
    ...new Map(
      entries.map((entry) => [
        entry.eventId,
        { id: entry.eventId, name: entry.eventName, date: entry.eventDate },
      ]),
    ).values(),
  ]
  return { riders, events }
}

export function riderPointsToLeader(
  entries: PointEntry[],
  events: Pick<RaceEvent, 'id' | 'name' | 'circuit'>[],
  rider: string,
) {
  const entriesByEvent = new Map<string, PointEntry[]>()
  entries.forEach((entry) =>
    entriesByEvent.set(entry.eventId, [
      ...(entriesByEvent.get(entry.eventId) ?? []),
      entry,
    ]),
  )
  const totals = new Map<string, number>()

  return events.flatMap((event) => {
    const eventEntries = entriesByEvent.get(event.id) ?? []
    if (!eventEntries.length) return []

    eventEntries.forEach((entry) =>
      totals.set(
        entry.riderName,
        (totals.get(entry.riderName) ?? 0) + entry.points,
      ),
    )
    const leaderPoints = Math.max(0, ...totals.values())
    const riderPoints = totals.get(rider) ?? 0

    return [
      {
        eventId: event.id,
        event: event.name,
        circuit: event.circuit,
        leaderPoints,
        riderPoints,
        pointsToLeader: riderPoints - leaderPoints,
      },
    ]
  })
}
