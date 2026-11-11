// Highlight share card: one reel card as a 1080x1350 image, drawn on-device with a canvas. No network; saved or shared
// only when the person taps Share. Reuses the palette and save helpers from the weekly share card.
import { readPalette, saveShareCard, type Palette } from '../review/shareCard'
import type { Highlight } from './highlights'

export const HCARD_W = 1080
export const HCARD_H = 1350

const FONT = '"Inter Variable", Inter, system-ui, -apple-system, "Segoe UI", sans-serif'

/** Greedy word wrap; the last allowed line is truncated with an ellipsis. */
export function wrapLines(measure: (t: string) => number, text: string, maxW: number, maxLines: number): string[] {
  const out: string[] = []
  let line = ''
  for (const w of text.split(/\s+/).filter(Boolean)) {
    const t = line ? `${line} ${w}` : w
    if (measure(t) <= maxW || !line) { line = t; continue }
    if (out.length === maxLines - 1) { line = `${line}...`; break }
    out.push(line); line = w
  }
  if (line) out.push(line)
  return out.slice(0, maxLines)
}

function drawVisual(ctx: CanvasRenderingContext2D, h: Highlight, p: Palette, x: number, y: number, w: number, hh: number) {
  const v = h.visual.values
  if (!v.length) return
  ctx.save()
  if (h.visual.type === 'dots') {
    const n = Math.min(14, Math.max(1, Math.round(v[0])))
    const gap = w / n
    for (let i = 0; i < n; i++) {
      ctx.beginPath(); ctx.arc(x + gap * i + gap / 2, y + hh / 2, Math.min(22, gap / 2 - 4), 0, Math.PI * 2)
      ctx.fillStyle = i === n - 1 ? p.reward : p.accent; ctx.globalAlpha = i === n - 1 ? 1 : 0.5; ctx.fill()
    }
  } else if (h.visual.type === 'line' && v.length > 1) {
    const lo = Math.min(...v), hi = Math.max(...v), span = hi - lo || 1
    ctx.beginPath()
    v.forEach((n, i) => {
      const px = x + (w * i) / (v.length - 1), py = y + hh - ((n - lo) / span) * hh
      if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py)
    })
    ctx.strokeStyle = p.accent; ctx.lineWidth = 8; ctx.lineJoin = 'round'; ctx.lineCap = 'round'; ctx.stroke()
  } else {
    const hi = Math.max(...v.map(Math.abs), 1)
    const bw = Math.min(90, w / (v.length * 1.6))
    const gap = (w - bw * v.length) / Math.max(1, v.length - 1)
    v.forEach((n, i) => {
      const bh = Math.max(8, (Math.abs(n) / hi) * hh)
      ctx.fillStyle = i === v.length - 1 ? p.reward : p.accent
      ctx.globalAlpha = i === v.length - 1 ? 1 : 0.45
      ctx.beginPath(); ctx.roundRect(x + i * (bw + gap), y + hh - bh, bw, bh, 12); ctx.fill()
    })
  }
  ctx.restore()
}

export function drawHighlightCard(ctx: CanvasRenderingContext2D, h: Highlight, p: Palette, w = HCARD_W, ht = HCARD_H): void {
  const M = 84
  ctx.clearRect(0, 0, w, ht)
  ctx.fillStyle = p.page; ctx.fillRect(0, 0, w, ht)
  const g1 = ctx.createRadialGradient(240, 200, 0, 240, 200, 900)
  g1.addColorStop(0, p.accent); g1.addColorStop(1, 'transparent')
  ctx.globalAlpha = 0.24; ctx.fillStyle = g1; ctx.fillRect(0, 0, w, ht)
  ctx.globalAlpha = 1
  ctx.textBaseline = 'alphabetic'; ctx.textAlign = 'left'
  ctx.fillStyle = p.accentText; ctx.font = `600 36px ${FONT}`
  ctx.fillText('HIGHLIGHT', M, 140)
  ctx.fillStyle = p.ink2; ctx.font = `500 40px ${FONT}`
  ctx.fillText(h.dateLabel, M, 196)

  ctx.font = `700 92px ${FONT}`
  const lines = wrapLines((t) => ctx.measureText(t).width, h.headline, w - M * 2, 5)
  ctx.fillStyle = p.ink
  lines.forEach((l, i) => ctx.fillText(l, M, 380 + i * 112))
  const after = 380 + lines.length * 112
  ctx.font = `500 44px ${FONT}`; ctx.fillStyle = p.ink2
  wrapLines((t) => ctx.measureText(t).width, h.detail, w - M * 2, 2).forEach((l, i) => ctx.fillText(l, M, after + 40 + i * 58))

  drawVisual(ctx, h, p, M, ht - 460, w - M * 2, 260)
  ctx.fillStyle = p.ink2; ctx.font = `600 34px ${FONT}`
  ctx.fillText('Northstar', M, ht - 90)
}

export async function renderHighlightCard(h: Highlight): Promise<Blob | null> {
  if (typeof document === 'undefined') return null
  try { await document.fonts?.ready } catch { /* system font fallback */ }
  const c = document.createElement('canvas')
  c.width = HCARD_W; c.height = HCARD_H
  const ctx = c.getContext('2d')
  if (!ctx) return null
  drawHighlightCard(ctx, h, readPalette())
  return new Promise((res) => c.toBlob((b) => res(b), 'image/png'))
}

export { saveShareCard }
