// The share card: the week as a 1080x1920 story image, drawn on-device with a canvas. No network, no stored data leaves
// the device: the file is saved or shared only when the person taps the button (blob download, or navigator.share).
import { money, formatDate, parseISODate, addDays } from '../../lib/dates'
import type { ISODate } from '../../db'
import type { WeekDigest } from './summary'
import type { NumberItem } from './weekNumbers'

export const CARD_W = 1080
export const CARD_H = 1920

export interface ShareModel {
  range: string
  tasksDone: number
  stats: { label: string; value: string }[]
  wins: string[]
  numbers: { label: string; value: string }[]
  next: string
}

export interface Palette { page: string; ink: string; ink2: string; accent: string; accentText: string; poppy: string; reward: string }

const plural = (n: number, one: string, many = `${one}s`) => (n === 1 ? one : many)

export function weekRangeLabel(weekOf: ISODate): string {
  const end = addDays(weekOf, 6)
  const same = weekOf.slice(0, 7) === end.slice(0, 7)
  return `${formatDate(weekOf)} to ${same ? parseISODate(end).getDate() : formatDate(end)}`
}

export function buildShareModel(i: { weekOf: ISODate; digest: WeekDigest; items: NumberItem[]; wins?: string; focusNext?: string; planned?: string }): ShareModel {
  const d = i.digest
  const winLines = [...d.milestones.map((m) => m.title), ...(i.wins ? i.wins.split('\n').map((l) => l.trim()).filter(Boolean) : [])].slice(0, 3)
  const numbers = i.items.filter((n) => ['weight', 'workouts', 'spend'].includes(n.key) && !n.empty).map((n) => ({ label: n.label, value: n.value })).slice(0, 3)
  return {
    range: weekRangeLabel(i.weekOf),
    tasksDone: d.tasksDone,
    stats: [
      { label: 'days with meals', value: `${d.mealDays} of 7` },
      { label: 'minutes studied', value: String(d.studyMinutes) },
      { label: plural(d.peopleContacted, 'person reached', 'people reached'), value: String(d.peopleContacted) },
      { label: 'spent', value: d.hasMoney ? money(d.spent) : 'None logged' },
    ],
    wins: winLines,
    numbers,
    next: (i.focusNext || i.planned || '').split('\n')[0].trim(),
  }
}

/** Colours come from the app's own tokens so the card always matches the palette. */
export function readPalette(el: Element = document.documentElement): Palette {
  const cs = getComputedStyle(el)
  const v = (name: string, fallback: string) => cs.getPropertyValue(name).trim() || fallback
  return {
    page: v('--page', 'black'), ink: v('--ink', 'white'), ink2: v('--ink-2', 'gray'), accent: v('--accent', 'white'),
    accentText: v('--accent-text', 'white'), poppy: v('--poppy', 'red'), reward: v('--reward', 'gold'),
  }
}

const FONT = '"Inter Variable", Inter, system-ui, -apple-system, "Segoe UI", sans-serif'

function wrap(ctx: CanvasRenderingContext2D, text: string, maxW: number, maxLines: number): string[] {
  const words = text.split(/\s+/).filter(Boolean)
  const out: string[] = []
  let line = ''
  for (const w of words) {
    const t = line ? `${line} ${w}` : w
    if (ctx.measureText(t).width <= maxW || !line) { line = t; continue }
    if (out.length === maxLines - 1) { line = `${line}...`; break }
    out.push(line); line = w
  }
  if (line) out.push(line)
  return out.slice(0, maxLines)
}

function panel(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  ctx.beginPath()
  ctx.roundRect(x, y, w, h, 44)
  ctx.fillStyle = 'rgba(255, 255, 255, 0.06)'
  ctx.fill()
  ctx.lineWidth = 2
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.14)'
  ctx.stroke()
}

export function drawShareCard(ctx: CanvasRenderingContext2D, m: ShareModel, p: Palette, w = CARD_W, h = CARD_H): void {
  const M = 72
  ctx.clearRect(0, 0, w, h)
  ctx.fillStyle = p.page
  ctx.fillRect(0, 0, w, h)
  // Ambient glow: powder top left, a little poppy ember low right, like the app backdrop.
  const g1 = ctx.createRadialGradient(240, 220, 0, 240, 220, 980)
  g1.addColorStop(0, p.accent); g1.addColorStop(1, 'transparent')
  ctx.globalAlpha = 0.26; ctx.fillStyle = g1; ctx.fillRect(0, 0, w, h)
  const g2 = ctx.createRadialGradient(w - 120, h - 200, 0, w - 120, h - 200, 760)
  g2.addColorStop(0, p.poppy); g2.addColorStop(1, 'transparent')
  ctx.globalAlpha = 0.14; ctx.fillStyle = g2; ctx.fillRect(0, 0, w, h)
  ctx.globalAlpha = 1
  ctx.textBaseline = 'alphabetic'
  ctx.textAlign = 'left'

  ctx.fillStyle = p.accentText; ctx.font = `600 38px ${FONT}`
  ctx.fillText('YOUR WEEK', M, 150)
  ctx.fillStyle = p.ink2; ctx.font = `500 44px ${FONT}`
  ctx.fillText(m.range, M, 212)

  ctx.fillStyle = p.ink; ctx.font = `700 330px ${FONT}`
  ctx.fillText(String(m.tasksDone), M - 8, 560)
  ctx.fillStyle = p.ink2; ctx.font = `500 54px ${FONT}`
  ctx.fillText(m.tasksDone === 1 ? 'task done' : 'tasks done', M, 640)

  const tw = (w - M * 2 - 24) / 2
  let y = 700
  m.stats.forEach((s, i) => {
    const x = M + (i % 2) * (tw + 24)
    const yy = y + Math.floor(i / 2) * 188
    panel(ctx, x, yy, tw, 164)
    ctx.fillStyle = p.ink; ctx.font = `650 64px ${FONT}`
    ctx.fillText(s.value, x + 40, yy + 90)
    ctx.fillStyle = p.ink2; ctx.font = `500 32px ${FONT}`
    ctx.fillText(s.label, x + 40, yy + 136)
  })
  y += 2 * 188 + 20

  if (m.wins.length) {
    ctx.font = `500 42px ${FONT}`
    const rows = m.wins.map((t) => wrap(ctx, t, w - M * 2 - 140, 2))
    const hh = 110 + rows.reduce((a, r) => a + r.length * 56 + 14, 0)
    panel(ctx, M, y, w - M * 2, hh)
    ctx.fillStyle = p.accentText; ctx.font = `600 32px ${FONT}`
    ctx.fillText('WINS', M + 44, y + 68)
    let ry = y + 128
    rows.forEach((lines) => {
      ctx.fillStyle = p.reward
      ctx.beginPath(); ctx.arc(M + 56, ry - 14, 9, 0, Math.PI * 2); ctx.fill()
      ctx.fillStyle = p.ink; ctx.font = `500 42px ${FONT}`
      lines.forEach((l, i) => ctx.fillText(l, M + 96, ry + i * 56))
      ry += lines.length * 56 + 14
    })
    y += hh + 24
  }

  if (m.numbers.length) {
    const hh = 60 + m.numbers.length * 84
    panel(ctx, M, y, w - M * 2, hh)
    m.numbers.forEach((n, i) => {
      const ry = y + 78 + i * 84
      ctx.fillStyle = p.ink2; ctx.font = `500 38px ${FONT}`; ctx.textAlign = 'left'
      ctx.fillText(n.label, M + 44, ry)
      ctx.fillStyle = p.ink; ctx.font = `650 44px ${FONT}`; ctx.textAlign = 'right'
      ctx.fillText(n.value, w - M - 44, ry)
    })
    ctx.textAlign = 'left'
    y += hh + 24
  }

  if (m.next) {
    ctx.font = `500 42px ${FONT}`
    const lines = wrap(ctx, m.next, w - M * 2 - 88, 2)
    const hh = 110 + lines.length * 56
    panel(ctx, M, y, w - M * 2, hh)
    ctx.fillStyle = p.accentText; ctx.font = `600 32px ${FONT}`
    ctx.fillText('NEXT WEEK', M + 44, y + 68)
    ctx.fillStyle = p.ink; ctx.font = `500 42px ${FONT}`
    lines.forEach((l, i) => ctx.fillText(l, M + 44, y + 128 + i * 56))
  }

  ctx.fillStyle = p.ink2; ctx.font = `600 34px ${FONT}`
  ctx.fillText('Northstar', M, h - 84)
}

/** Draws the card on an offscreen canvas and returns a PNG blob. Null when canvas is unavailable. */
export async function renderShareCard(m: ShareModel): Promise<Blob | null> {
  if (typeof document === 'undefined') return null
  try { await document.fonts?.ready } catch { /* system font fallback */ }
  const c = document.createElement('canvas')
  c.width = CARD_W; c.height = CARD_H
  const ctx = c.getContext('2d')
  if (!ctx) return null
  drawShareCard(ctx, m, readPalette())
  return new Promise((res) => c.toBlob((b) => res(b), 'image/png'))
}

/** Share the file when the browser can, else download it. Always from a user click. */
export async function saveShareCard(blob: Blob, name: string): Promise<'shared' | 'saved'> {
  const file = new File([blob], name, { type: 'image/png' })
  const nav = navigator as Navigator & { canShare?: (d: { files: File[] }) => boolean }
  if (typeof nav.share === 'function' && nav.canShare?.({ files: [file] })) {
    try { await nav.share({ files: [file], title: 'My week' }); return 'shared' } catch (e) { if ((e as Error).name === 'AbortError') return 'shared' }
  }
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = name
  document.body.appendChild(a); a.click(); a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 4000)
  return 'saved'
}
