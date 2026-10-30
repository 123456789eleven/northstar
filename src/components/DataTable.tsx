// DataTable<T>: columns {key, header, render(row), align?, primary?, value?}, rows, rowKey(row).
// selectable + selected(Set) + onSelectedChange => checkbox column. onRow + activeKey => click/Enter row, highlighted when active.
// Keyboard: Up/Down move between rows, Enter activates. Phone (<=819px): renders as a ListRow-style stack (primary column = title,
// `value` column on the right, remaining columns as meta). Never scrolls sideways.
import type { KeyboardEvent, ReactNode } from 'react'

export interface Column<T> { key: string; header: string; render: (row: T) => ReactNode; align?: 'right'; primary?: boolean; value?: boolean }
type Key = string | number

export default function DataTable<T>({ columns, rows, rowKey, selectable, selected, onSelectedChange, onRow, activeKey, empty, label }: {
  columns: Column<T>[]; rows: T[]; rowKey: (r: T) => Key
  selectable?: boolean; selected?: Set<Key>; onSelectedChange?: (s: Set<Key>) => void
  onRow?: (r: T) => void; activeKey?: Key | null; empty?: ReactNode; label?: string
}) {
  const sel = selected ?? new Set<Key>()
  const toggle = (k: Key) => {
    const n = new Set(sel)
    if (n.has(k)) n.delete(k)
    else n.add(k)
    onSelectedChange?.(n)
  }
  const allOn = rows.length > 0 && rows.every((r) => sel.has(rowKey(r)))
  const primary = columns.find((c) => c.primary) ?? columns[0]
  const value = columns.find((c) => c.value) ?? (columns.length > 1 ? columns[columns.length - 1] : undefined)
  const metas = columns.filter((c) => c !== primary && c !== value)

  const onKey = (e: KeyboardEvent<HTMLElement>, r: T) => {
    if (e.key === 'Enter' && onRow && e.target === e.currentTarget) { e.preventDefault(); onRow(r) }
    else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      const sib = (e.key === 'ArrowDown' ? e.currentTarget.nextElementSibling : e.currentTarget.previousElementSibling) as HTMLElement | null
      if (sib && sib.tabIndex === 0) { e.preventDefault(); sib.focus() }
    }
  }
  if (rows.length === 0) return <div className="empty">{empty ?? 'Nothing here yet.'}</div>

  return (
    <div className="dt">
      <table className="dt-table" aria-label={label}>
        <thead>
          <tr>
            {selectable && (
              <th className="dt-check"><input type="checkbox" className="check" aria-label="Select all" checked={allOn} onChange={() => onSelectedChange?.(allOn ? new Set() : new Set(rows.map(rowKey)))} /></th>
            )}
            {columns.map((c) => <th key={c.key} className={c.align === 'right' ? 'num' : ''}>{c.header || <span className="sr-only">{c.key === 'act' ? 'Action' : c.key}</span>}</th>)}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const k = rowKey(r)
            return (
              <tr key={k} tabIndex={0} className={`${onRow ? 'dt-click' : ''} ${activeKey === k ? 'selected' : ''}`} onClick={() => onRow?.(r)} onKeyDown={(e) => onKey(e, r)}>
                {selectable && <td className="dt-check" onClick={(e) => e.stopPropagation()}><input type="checkbox" className="check" aria-label="Select row" checked={sel.has(k)} onChange={() => toggle(k)} /></td>}
                {columns.map((c) => <td key={c.key} className={c.align === 'right' ? 'num' : ''}>{c.render(r)}</td>)}
              </tr>
            )
          })}
        </tbody>
      </table>
      <div className="dt-list" role="list" aria-label={label}>
        {rows.map((r) => {
          const k = rowKey(r)
          return (
            <div key={k} role="listitem" tabIndex={0} className={`list-row ${onRow ? 'lr-btn' : ''} ${activeKey === k ? 'selected' : ''}`} onClick={() => onRow?.(r)} onKeyDown={(e) => onKey(e, r)}>
              {selectable && <span className="lr-lead" onClick={(e) => e.stopPropagation()}><input type="checkbox" className="check" aria-label="Select row" checked={sel.has(k)} onChange={() => toggle(k)} /></span>}
              <span className="lr-main">
                <span className="lr-title">{primary.render(r)}</span>
                {metas.length > 0 && <span className="lr-meta">{metas.map((c) => <span key={c.key}>{c.render(r)}</span>)}</span>}
              </span>
              {value && <span className="lr-trail mono">{value.render(r)}</span>}
            </div>
          )
        })}
      </div>
    </div>
  )
}
