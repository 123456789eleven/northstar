// Liquid v2 runtime, mounted once by the shell. Sets html[data-lens] when real refraction is available (Chromium, not reduced
// transparency), auto-registers `.lens[data-lens-preset]` elements (src/lib/lens.ts builds one SVG filter per element, max 3)
// and installs the global press squash for .btn .chip .tab-item (src/lib/press.ts). Off Chromium nothing is registered and the CSS
// falls back to plain blur + --lg-body + --lg-depth.
import { useEffect } from 'react'
import { installLensScanner, lensSupported } from '../lib/lens'

export function GlassDefs() {
  useEffect(() => {
    const root = document.documentElement
    if (lensSupported()) root.setAttribute('data-lens', '')
    const stopScan = installLensScanner()
    return () => { stopScan(); root.removeAttribute('data-lens') }
  }, [])
  return null
}
