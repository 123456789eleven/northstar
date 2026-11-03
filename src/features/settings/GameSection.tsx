// Settings > Game: Calm mode, haptics, sound, motion, weekly target and the XP table ("Why do I earn XP?").
// All device-local (`game.*` settings, never synced). Nothing here asks for a permission.
import { useState } from 'react'
import { Card } from '../../components/ui'
import { useGameSettings, type GameSettings } from '../game/gameSettings'
import { XP_TABLE } from '../game/engine/xpTable'
import { SKILLS } from '../game/types'
import { haptic, setHapticsEnabled } from '../../lib/haptics'
import { setSoundEnabled, tick } from '../../lib/sound'

const SKILL_LABEL: Record<string, string> = Object.fromEntries(SKILLS.map((s) => [s.id, s.label]))
const skillText = (r: (typeof XP_TABLE)[number]) => (r.skill === 'goal' ? `Goal's skill (else ${SKILL_LABEL[r.fallback ?? 'mind']})` : r.skill === 'top' ? 'Your top skill that day' : SKILL_LABEL[r.skill])

function Switch({ id, label, help, checked, onChange }: { id: string; label: string; help: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="set-pref-row">
      <div className="set-pref-text">
        <span className="set-pref-label" id={`${id}-l`}>{label}</span>
        <span className="small muted" id={`${id}-h`}>{help}</span>
      </div>
      <button type="button" role="switch" aria-checked={checked} aria-labelledby={`${id}-l`} aria-describedby={`${id}-h`} className="switch" onClick={() => onChange(!checked)}>
        <span className="switch-knob" aria-hidden />
      </button>
    </div>
  )
}

export function GameSection() {
  const g = useGameSettings()
  const [showTable, setShowTable] = useState(false)
  const set = <K extends keyof GameSettings>(k: K) => (v: GameSettings[K]) => void g.set(k, v)
  return (
    <Card title="Game">
      <p className="set-text small muted">XP, levels and daily quests come only from things you already log. Nothing is ever taken away. These settings stay on this device.</p>
      <Switch id="g-calm" label="Calm mode" help="Hide levels, quests, XP and moments. The layout and every page stay the same." checked={g.calm} onChange={set('calm')} />
      <Switch id="g-haptics" label="Haptics" help="A light tick when a quest completes, a double tick on a level-up. Phones that support vibration only." checked={g.haptics} onChange={(v) => { setHapticsEnabled(v); if (v) haptic('tick'); void g.set('haptics', v) }} />
      <Switch id="g-sound" label="Sound" help="A tiny synthesized tick on the same moments. Off by default." checked={g.sound} onChange={(v) => { setSoundEnabled(v); if (v) tick('tick'); void g.set('sound', v) }} />
      <div className="set-pref-row">
        <div className="set-pref-text">
          <span className="set-pref-label" id="g-motion">Motion</span>
          <span className="small muted">Reduced turns off springs, count-ups and moments app-wide (your system setting is always respected).</span>
        </div>
        <div className="seg" role="radiogroup" aria-labelledby="g-motion">
          {(['full', 'reduced'] as const).map((m) => (
            <button key={m} type="button" role="radio" aria-checked={g.motion === m} className="seg-btn" onClick={() => void g.set('motion', m)}>{m === 'full' ? 'Full' : 'Reduced'}</button>
          ))}
        </div>
      </div>
      <div className="set-pref-row">
        <div className="set-pref-text">
          <label className="set-pref-label" htmlFor="g-week">Active days a week</label>
          <span className="small muted">Your weekly streak target. Two rest tokens a week cover days off; a streak never resets in a day.</span>
        </div>
        <select id="g-week" className="select set-week" value={g.weekTarget} onChange={(e) => void g.set('weekTarget', Number(e.target.value))}>
          {[1, 2, 3, 4, 5, 6, 7].map((n) => <option key={n} value={n}>{n} {n === 1 ? 'day' : 'days'}</option>)}
        </select>
      </div>
      <div className="set-pref-row">
        <div className="set-pref-text">
          <span className="set-pref-label">Why do I earn XP?</span>
          <span className="small muted">Every rule, its skill, its XP and its daily cap. The same table drives the engine.</span>
        </div>
        <button type="button" className="btn btn-sm" aria-expanded={showTable} aria-controls="xp-table" onClick={() => setShowTable((v) => !v)}>{showTable ? 'Hide XP table' : 'Show XP table'}</button>
      </div>
      {showTable && (
        <div className="table-wrap set-xp" id="xp-table">
          <table className="table">
            <caption className="sr-only">XP table</caption>
            <thead><tr><th scope="col">Action</th><th scope="col">Skill</th><th scope="col" className="num">XP</th><th scope="col" className="num">Daily cap</th><th scope="col">Rule</th></tr></thead>
            <tbody>
              {XP_TABLE.map((r) => (
                <tr key={r.kind}>
                  <th scope="row">{r.label}</th>
                  <td>{skillText(r)}</td>
                  <td className="num mono set-xp-n">+{r.xp}</td>
                  <td className="num mono">{r.cap}</td>
                  <td className="small muted">{r.rule}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  )
}
