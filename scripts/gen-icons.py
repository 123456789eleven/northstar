"""Regenerates the powder-blue-brand PNG icons from the geometry of public/icon.svg (needs Pillow).

Writes public/icon-192.png, icon-512.png, icon-maskable-512.png, favicon-32.png and apple-touch-icon.png (180, opaque),
plus the copies in site/ (favicon-32.png, apple-touch-icon.png, icons/icon-192.png, icons/icon-512.png).
Run from the repo root: python scripts/gen-icons.py
"""
from PIL import Image, ImageDraw

BG = (8, 9, 12, 255)          # raven black #08090c (--page)
AC = (156, 200, 230, 255)     # powder blue #9cc8e6 (--accent)
LINE = tuple(int(b + (a - b) * .4) for a, b in zip(AC[:3], BG[:3])) + (255,)  # the 40% crossbar, pre-blended on raven


def render(size, kind):
    """kind: 'any' (rounded tile on transparent), 'maskable' (full bleed, mark inside the 80% safe zone), 'opaque' (full bleed square)."""
    S = size * 4
    im = Image.new('RGBA', (S, S), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    if kind == 'maskable':
        # Mark spans 44/64 of its box vertically; at 0.8 scale it is ~55% of the canvas height, well inside the 80% safe circle.
        d.rectangle([0, 0, S, S], fill=BG)
        k = S / 64 * 0.8
        o = S * 0.1
    elif kind == 'opaque':
        d.rectangle([0, 0, S, S], fill=BG)
        k = S / 64 * 0.82
        o = S * 0.09
    else:
        d.rounded_rectangle([0, 0, S - 1, S - 1], radius=S * 14 / 64, fill=BG)
        k = S / 64
        o = 0
    P = lambda x, y: (o + x * k, o + y * k)
    d.line([P(14, 32), P(50, 32)], fill=LINE, width=max(1, int(2 * k)))
    d.polygon([P(32, 10), P(37, 32), P(32, 54), P(27, 32)], fill=AC)
    return im.resize((size, size), Image.LANCZOS)


outputs = {
    'public/icon-192.png': (192, 'any'),
    'public/icon-512.png': (512, 'any'),
    'public/icon-maskable-512.png': (512, 'maskable'),
    'public/favicon-32.png': (32, 'any'),
    'public/apple-touch-icon.png': (180, 'opaque'),
    'site/favicon-32.png': (32, 'any'),
    'site/apple-touch-icon.png': (180, 'opaque'),
    'site/icons/icon-192.png': (192, 'any'),
    'site/icons/icon-512.png': (512, 'any'),
}
for path, (size, kind) in outputs.items():
    render(size, kind).save(path)
    print('wrote', path)
