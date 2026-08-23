/* oxlint-disable react/only-export-components */
import { useMemo, useState, type ReactNode } from 'react'
import { AlertTriangle, LoaderCircle } from 'lucide-react'

export function PageHeader({
  title,
  description,
}: {
  title: string
  description: string
}) {
  return (
    <header className="page-header">
      <p className="eyebrow">MotoRaceData</p>
      <h1>{title}</h1>
      <p>{description}</p>
    </header>
  )
}

export function Loading() {
  return (
    <div className="status">
      <LoaderCircle className="spin" /> Loading race data…
    </div>
  )
}
export function ErrorState({ error }: { error: Error }) {
  return (
    <div className="status error">
      <AlertTriangle /> {error.message}
    </div>
  )
}
export function Empty({
  children = 'No results are available for this selection.',
}: {
  children?: ReactNode
}) {
  return <div className="empty">{children}</div>
}

export function Select({
  label,
  value,
  onChange,
  children,
  disabled,
}: {
  label: string
  value: string | number
  onChange: (value: string) => void
  children: ReactNode
  disabled?: boolean
}) {
  return (
    <label className="field">
      <span>{label}</span>
      <select
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
      >
        {children}
      </select>
    </label>
  )
}

type Column<T> = {
  key: string
  label: string
  value: (row: T) => ReactNode
  sort?: (row: T) => string | number
  align?: 'right' | 'center'
}
export function DataTable<T>({
  rows,
  columns,
  rowKey,
  initialSort,
  className = '',
}: {
  rows: T[]
  columns: Column<T>[]
  rowKey: (row: T) => string
  initialSort?: { key: string; desc?: boolean }
  className?: string
}) {
  const [sorting, setSorting] = useState<{ key: string; desc: boolean } | null>(
    () =>
      initialSort
        ? { key: initialSort.key, desc: initialSort.desc ?? false }
        : null,
  )
  const sorted = useMemo(() => {
    if (!sorting) return rows
    const column = columns.find((item) => item.key === sorting.key)
    if (!column?.sort) return rows
    return [...rows].sort((a, b) => {
      const av = column.sort!(a),
        bv = column.sort!(b)
      const result =
        typeof av === 'number' && typeof bv === 'number'
          ? av - bv
          : String(av).localeCompare(String(bv))
      return sorting.desc ? -result : result
    })
  }, [columns, rows, sorting])
  return (
    <div className={`table-wrap data-table ${className}`}>
      <table>
        <thead>
          <tr>
            {columns.map((column) => (
              <th key={column.key} className={column.align ?? ''}>
                {column.sort ? (
                  <button
                    onClick={() =>
                      setSorting((old) => ({
                        key: column.key,
                        desc: old?.key === column.key ? !old.desc : false,
                      }))
                    }
                  >
                    {column.label}
                    {sorting?.key === column.key
                      ? sorting.desc
                        ? ' ↓'
                        : ' ↑'
                      : ''}
                  </button>
                ) : (
                  column.label
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sorted.map((row) => (
            <tr key={rowKey(row)}>
              {columns.map((column) => (
                <td
                  key={column.key}
                  className={column.align ?? ''}
                  data-label={column.label}
                >
                  {column.value(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export const formatPoints = (value: number) =>
  Number.isInteger(value) ? String(value) : value.toFixed(1)
export const formatDate = (value: string | null, full = true) =>
  value
    ? new Intl.DateTimeFormat(
        undefined,
        full
          ? { day: '2-digit', month: 'short', year: 'numeric' }
          : { day: '2-digit', month: 'short' },
      ).format(new Date(value))
    : '—'
