// Refraction for the chrome tier on Chromium: an SVG displacement map that bends the backdrop only near the edges, like a lens.
// Feature-detected (Chromium only, not reduced transparency); everywhere else the CSS falls back to plain blur and nothing changes.
import { useEffect } from 'react'

const MAP =
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="200" height="100" viewBox="0 0 200 100" preserveAspectRatio="none">' +
      '<defs><linearGradient id="r" x1="0" x2="1" y1="0" y2="0"><stop offset="0" stop-color="#000"/><stop offset=".07" stop-color="#800000"/><stop offset=".93" stop-color="#800000"/><stop offset="1" stop-color="#f00"/></linearGradient>' +
      '<linearGradient id="g" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#000"/><stop offset=".16" stop-color="#008000"/><stop offset=".84" stop-color="#008000"/><stop offset="1" stop-color="#0f0"/></linearGradient></defs>' +
      '<rect width="200" height="100" fill="#000"/><rect width="200" height="100" fill="url(#r)"/><rect width="200" height="100" fill="url(#g)" style="mix-blend-mode:screen"/></svg>',
  )

export function GlassDefs() {
  useEffect(() => {
    const nav = navigator as Navigator & { userAgentData?: { brands: { brand: string }[] } }
    const chromium = !!nav.userAgentData?.brands?.some((b) => b.brand === 'Chromium')
    const reduced = window.matchMedia?.('(prefers-reduced-transparency: reduce)').matches
    if (chromium && !reduced) document.documentElement.setAttribute('data-lens', '')
    return () => document.documentElement.removeAttribute('data-lens')
  }, [])
  return (
    <svg width="0" height="0" aria-hidden focusable="false" style={{ position: 'absolute' }}>
      <filter id="ns-lens" x="0" y="0" width="100%" height="100%" colorInterpolationFilters="sRGB">
        <feImage href={MAP} x="0" y="0" width="100%" height="100%" preserveAspectRatio="none" result="map" />
        <feDisplacementMap in="SourceGraphic" in2="map" scale="26" xChannelSelector="R" yChannelSelector="G" />
      </filter>
    </svg>
  )
}
