import { useState } from 'react'
import { Empty, Modal } from '../../components/ui'
import { optNum, saveTemplates } from './foodData'
import { type MealTemplate } from './foodLogic'
import { useTemplates } from './useTemplates'

function TemplateRow({ t, all }: { t: MealTemplate; all: MealTemplate[] }) {
  const [name, setName] = useState(t.name)
  const [items, setItems] = useState(t.items)
  const dirty = name.trim() !== t.name || JSON.stringify(items) !== JSON.stringify(t.items)
  const patch = (i: number, p: Partial<MealTemplate['items'][number]>) => setItems(items.map((x, j) => (j === i ? { ...x, ...p } : x)))
  return (
    <div className="food-tpl stack">
      <div className="row">
        <input className="input grow" value={name} onChange={(e) => setName(e.target.value)} aria-label="Template name" />
        <button className="btn btn-sm" disabled={!dirty || !name.trim() || !items.length} onClick={() => void saveTemplates(all.map((x) => (x.id === t.id ? { ...t, name: name.trim(), items } : x)))}>
          Save
        </button>
        <button className="btn btn-ghost btn-sm btn-danger" onClick={() => void saveTemplates(all.filter((x) => x.id !== t.id))}>
          Delete
        </button>
      </div>
      {items.map((it, i) => (
        <div key={i} className="row food-tpl-item">
          <input className="input grow" value={it.name} onChange={(e) => patch(i, { name: e.target.value })} aria-label="Item name" />
          <input className="input food-add-num" inputMode="numeric" placeholder="kcal" defaultValue={it.calories ?? ''} onChange={(e) => patch(i, { calories: optNum(e.target.value) })} aria-label="Calories" />
          <input className="input food-add-num" inputMode="numeric" placeholder="prot g" defaultValue={it.protein ?? ''} onChange={(e) => patch(i, { protein: optNum(e.target.value) })} aria-label="Protein" />
          <button className="btn btn-ghost btn-sm food-x" aria-label={`Remove ${it.name}`} onClick={() => setItems(items.filter((_, j) => j !== i))}>
            ×
          </button>
        </div>
      ))}
    </div>
  )
}

export default function TemplatesModal({ onClose }: { onClose: () => void }) {
  const all = useTemplates()
  return (
    <Modal title="Meal templates" onClose={onClose}>
      {all.length === 0 ? (
        <Empty>No templates yet. Use “Save as template” on a meal slot that has several items.</Empty>
      ) : (
        <div className="stack">
          {all.map((t) => (
            <TemplateRow key={t.id + JSON.stringify(t)} t={t} all={all} />
          ))}
        </div>
      )}
      <div className="row" style={{ justifyContent: 'flex-end', marginTop: 12 }}>
        <button className="btn" onClick={onClose}>
          Done
        </button>
      </div>
    </Modal>
  )
}
