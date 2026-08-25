/* oxlint-disable react/only-export-components */
import { useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useManifest, useSeason } from '../domain/data'
import { Select } from './ui'

export function useFilterState() {
  const manifest = useManifest()
  const [params, setParams] = useSearchParams()
  const year = Number(params.get('season')) || manifest.data?.currentSeason
  const season = useSeason(year)
  const category = Number(params.get('category')) || 3
  useEffect(() => {
    if (!params.get('season') && manifest.data) {
      const next = new URLSearchParams(params)
      next.set('season', String(manifest.data.currentSeason))
      setParams(next, { replace: true })
    }
  }, [manifest.data, params, setParams])
  const set = (key: string, value: string, clear: string[] = []) => {
    const next = new URLSearchParams(params)
    if (value) next.set(key, value)
    else next.delete(key)
    clear.forEach((item) => next.delete(item))
    setParams(next)
  }
  return { manifest, season, params, year, category, set }
}

export function BaseFilters({
  event = false,
  session = false,
  eventAsCircuit = false,
}: {
  event?: boolean
  session?: boolean
  eventAsCircuit?: boolean
}) {
  const { manifest, season, params, year, category, set } = useFilterState()
  return (
    <div className="filters">
      <Select
        label="Season"
        value={year ?? ''}
        onChange={(value) => set('season', value, ['event', 'session'])}
      >
        {manifest.data?.seasons
          .slice()
          .reverse()
          .map((item) => (
            <option key={item.year} value={item.year}>
              {item.year}
            </option>
          ))}
      </Select>
      <Select
        label="Category"
        value={category}
        onChange={(value) => set('category', value, ['session'])}
      >
        {season.data?.categories
          .filter((item) => [1, 2, 3].includes(item.legacyId))
          .map((item) => (
            <option key={item.id} value={item.legacyId}>
              {item.name}
            </option>
          ))}
      </Select>
      {event && (
        <Select
          label={eventAsCircuit ? 'Circuit' : 'Race / circuit'}
          value={params.get('event') ?? ''}
          onChange={(value) => set('event', value, ['session'])}
        >
          <option value="">
            Select {eventAsCircuit ? 'a circuit' : 'an event'}
          </option>
          {season.data?.events
            .filter((item) => !item.test)
            .map((item) => (
              <option key={item.id} value={item.id}>
                {eventAsCircuit
                  ? item.circuit
                  : `${item.name} — ${item.circuit}`}
              </option>
            ))}
        </Select>
      )}
      {session && (
        <span className="field-hint">
          Choose a category and event to load sessions.
        </span>
      )}
    </div>
  )
}
