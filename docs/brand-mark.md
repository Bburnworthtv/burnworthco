# The wordmark and the B. mark

The wordmark is **Burnworth Co.**: "Burnworth" in Lora 600, "Co" in Lora 600
Italic, and a round red period. The mark is the same idea compressed to a
square: the serif B and the red period.

Every curve comes from the font. Nothing is redrawn by hand. The glyphs are
converted to outlines, so no font is loaded for the logo.

## How it is used on the site

The header and footer of every page use an inline SVG, not an image file:

```html
<a class="wordmark" href="/">
  <svg class="wordmark-logo" viewBox="0 0 670.5 77" aria-hidden="true" focusable="false">…</svg>
  <span class="wordmark-text">Burnworth Co.</span>
</a>
```

- The letters use `fill="currentColor"`, so they follow the link colour (white
  on the ink header and footer). The period is always `#e2462f`.
- The company name stays in the HTML as real text (`.wordmark-text`, visually
  hidden). Crawlers, AI readers and screen readers read "Burnworth Co." even
  when they ignore the SVG.
- Sizes are set in `styles.css` under "Serif wordmark": 23px tall on desktop,
  21px in the footer, 20px under 800px wide, 17px in the header under 400px.

## Construction

Source: Lora variable font, instantiated at `wght=600` (roman and italic).
Units per em: 1000. Viewbox units are font units x 0.1.

- Tracking: -8 units between letters, plus 22 units between "r" and "n" so
  "Burnworth" never reads as "Bumworth" at small sizes.
- Gap between "Burnworth" and "Co": 150 units.
- Period: a circle of radius 72 units, 40 units after the "o", sitting on the
  baseline.
- The B. mark: B cap height is 0.56 of the tile, the period is 1.25 x the
  wordmark's period, and the pair is centred. The maskable icon uses a 0.42 cap
  so Android's circular crop clears it.

`scripts/build_logo.py` regenerates every SVG listed below. It needs
`fontTools` and the Lora variable fonts (set `LORA` and `LORA_ITALIC` to their
paths).

## Files

Site icons:

| file                                  | size           | notes                                      |
| ------------------------------------- | -------------- | ------------------------------------------ |
| `favicon.svg`                         | vector         | what modern browsers use in the tab        |
| `favicon.ico`                         | 16, 32, 48     | three real renders, not one image downscaled |
| `favicon-192.png`, `favicon-512.png`  | manifest icons | `favicon-512.png` is also the JSON-LD logo |
| `favicon-maskable-512.png`            | 512            | smaller cap for the circular crop          |
| `apple-touch-icon.png`                | 180            | opaque, as iOS requires                    |

Reusable versions under `public/assets/`:

| file                                                         | background  | colour     |
| ------------------------------------------------------------ | ----------- | ---------- |
| `burnworth-wordmark.svg`, `-1024.png`, `-2048.png`            | transparent | ink + red  |
| `burnworth-wordmark-light.svg`, `-1024.png`, `-2048.png`      | transparent | paper + red |
| `burnworth-mark.svg`, `burnworth-mark-1024.png`               | ink square  | paper + red |
| `burnworth-mark-ink.svg`, `burnworth-mark-ink-1024.png`       | transparent | ink + red  |
| `burnworth-mark-light.svg`, `burnworth-mark-light-1024.png`   | transparent | paper + red |

Use the ink versions on paper and light photography, the light versions on ink
and dark photography, and the tile where the mark needs its own edge. Prefer
the SVGs; the PNGs are for places that cannot take vector files.

## Colours

`#11100f` ink, `#fbfaf6` paper, `#e2462f` red. The same three values as
`styles.css`.

## Licence

Lora is licensed under the SIL Open Font License 1.1. The logo uses outlines
of its glyphs; the font itself is not shipped with the site.
