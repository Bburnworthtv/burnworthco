"""Build the Burnworth Co. serif wordmark + B. mark for burnworthco.com.

Usage: python3 scripts/build_logo.py OUT_DIR  (then copy the SVGs into public/)

Outputs SVG markup with every glyph converted to outlines (no font dependency),
real text kept in <title> and in the page HTML for crawlers and AI readers.
"""
import json, os, re, sys
from fontTools.ttLib import TTFont
from fontTools.varLib import instancer
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen
from fontTools.pens.boundsPen import BoundsPen

INK, PAPER, RED = '#11100f', '#fbfaf6', '#e2462f'
LORA = os.environ.get('LORA', '/usr/share/fonts/truetype/google-fonts/Lora-Variable.ttf')
LORA_I = os.environ.get('LORA_ITALIC', '/usr/share/fonts/truetype/google-fonts/Lora-Italic-Variable.ttf')


def inst(p, w=600):
    f = instancer.instantiateVariableFont(TTFont(p), {'wght': w})
    return f, f.getGlyphSet(), f.getBestCmap()


roman = inst(LORA)
italic = inst(LORA_I)


def fmt(v):
    s = f'{v:.1f}'.rstrip('0').rstrip('.')
    return '0' if s in ('-0', '') else s


class RoundPen(SVGPathPen):
    def __init__(self):
        super().__init__(None, ntos=fmt)


def glyph_path(font, ch, x, y, s):
    f, gs, cmap = font
    pen = RoundPen()
    gs[cmap[ord(ch)]].draw(TransformPen(pen, (s, 0, 0, -s, x, y)))
    return pen.getCommands(), gs[cmap[ord(ch)]].width


def bounds(font, ch):
    f, gs, cmap = font
    p = BoundsPen(gs); gs[cmap[ord(ch)]].draw(p); return p.bounds


# ---------- wordmark geometry (font units; 1000 upm for Lora)
S = 0.1                       # font units -> viewBox units
CAP = roman[0]['OS/2'].sCapHeight
TRACK = -8
KERN = {('r', 'n'): 22}       # keeps "rn" from reading as "m"
CO_GAP = 150
DOT_R = 72
DOT_GAP = 40


def wordmark_parts():
    """Return (letters_path, dot (cx, cy, r), width, height) in viewBox units."""
    ascent = max(bounds(roman, c)[3] for c in 'Bh')   # tallest ink: the h ascender
    descent = 0
    base = ascent * S
    d, cx, prev = [], 0.0, None
    for ch in 'Burnworth':
        if prev:
            cx += TRACK + KERN.get((prev, ch), 0)
        p, adv = glyph_path(roman, ch, cx * S, base, S)
        d.append(p); cx += adv; prev = ch
    cx += CO_GAP
    for i, ch in enumerate('Co'):
        if i:
            cx += -6
        p, adv = glyph_path(italic, ch, cx * S, base, S)
        d.append(p); cx += adv
    cx += DOT_GAP
    dot = (fmt((cx + DOT_R) * S), fmt(base - DOT_R * S), fmt(DOT_R * S))
    width = (cx + 2 * DOT_R) * S
    height = (ascent + descent) * S + 1.5   # o/C overshoot below baseline
    return ''.join(d), dot, width, height


LETTERS, DOT, WM_W, WM_H = wordmark_parts()
VB = f'0 0 {fmt(WM_W)} {fmt(WM_H)}'


def inline_wordmark():
    """Inline SVG for page headers/footers. Letters take the link's text colour."""
    cx, cy, r = DOT
    return (f'<svg class="wordmark-logo" viewBox="{VB}" aria-hidden="true" focusable="false">'
            f'<path fill="currentColor" d="{LETTERS}"/>'
            f'<circle fill="{RED}" cx="{cx}" cy="{cy}" r="{r}"/></svg>')


def standalone_wordmark(fg, pad=0):
    cx, cy, r = DOT
    w, h = WM_W + 2 * pad, WM_H + 2 * pad
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{fmt(-pad)} {fmt(-pad)} {fmt(w)} {fmt(h)}" '
            f'width="{fmt(w * 10)}" height="{fmt(h * 10)}" role="img" aria-label="Burnworth Co.">\n'
            f'  <title>Burnworth Co.</title>\n'
            f'  <path fill="{fg}" d="{LETTERS}"/>\n'
            f'  <circle fill="{RED}" cx="{cx}" cy="{cy}" r="{r}"/>\n</svg>\n')


# ---------- B. mark
def mark(bg, fg, size=512, cap_ratio=0.56):
    b = bounds(roman, 'B')
    s = size * cap_ratio / (b[3] - b[1])
    r = DOT_R * 1.25 * s
    gap = DOT_GAP * s
    total = (b[2] - b[0]) * s + gap + 2 * r
    x = (size - total) / 2 - b[0] * s
    y = (size + (b[3] - b[1]) * s) / 2
    p, _ = glyph_path(roman, 'B', x, y, s)
    bgel = f'  <rect width="{size}" height="{size}" fill="{bg}"/>\n' if bg else ''
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {size} {size}" width="{size}" height="{size}" '
            f'role="img" aria-label="Burnworth Co.">\n  <title>Burnworth Co.</title>\n{bgel}'
            f'  <path fill="{fg}" d="{p}"/>\n'
            f'  <circle fill="{RED}" cx="{fmt(x + b[2] * s + gap + r)}" cy="{fmt(y - r)}" r="{fmt(r)}"/>\n</svg>\n')


if __name__ == '__main__':
    out = sys.argv[1] if len(sys.argv) > 1 else "build-logo"
    os.makedirs(out, exist_ok=True)
    files = {
        'inline-wordmark.html': inline_wordmark(),
        'burnworth-wordmark.svg': standalone_wordmark(INK, pad=2),
        'burnworth-wordmark-light.svg': standalone_wordmark(PAPER, pad=2),
        'favicon.svg': mark(INK, PAPER),
        'favicon-maskable.svg': mark(INK, PAPER, cap_ratio=0.42),
        'burnworth-mark.svg': mark(INK, PAPER),
        'burnworth-mark-ink.svg': mark(None, INK, cap_ratio=0.7),
        'burnworth-mark-light.svg': mark(None, PAPER, cap_ratio=0.7),
    }
    for n, d in files.items():
        open(os.path.join(out, n), 'w').write(d)
    print(json.dumps({'viewBox': VB, 'inline_bytes': len(files['inline-wordmark.html']), 'aspect': WM_W / WM_H}))
