# The B mark

The wordmark is `BURNWORTH.` set in Archivo 600 with a red period. The mark is
that lockup compressed to a square: the first letter, one gap, the period.

Every curve comes from the font. Nothing is redrawn by hand.

## Construction

Source: `public/assets/archivo-latin.woff2`, the same file the site loads,
instantiated at `wght=600` — the weight `.wordmark` renders at. Units per em: 1000.

| glyph  | ink box                   | advance | left sidebearing |
| ------ | ------------------------- | ------- | ---------------- |
| B      | 585 wide x 686 tall (cap) | 706     | 76               |
| period | 127 x 128, a square       | 300     | 86               |

Archivo's period is a square, not a circle. The favicon it replaced used a
circle, which never matched the wordmark in the header.

Gap between the B's right edge and the period's left edge, when `B.` is simply
set: `706 + 86 - 661 = 131` units. The mark keeps that spacing.

## Proportions on the 512 tile

- Cap height: `0.625 x 512 = 320`. Scale factor from font units: `320 / 686`.
- Ink group: `585 x s + 131 x s + dot = 414` wide, centred, so 49 px each side.
- Baseline at 416, cap band centred vertically, so 96 px above and below.
- Red square: 80 px, `0.25` of cap height.

That dot is the one deliberate departure from the typeset proportion, which
would be `128 / 686 = 0.187`. At 16 px a typographic period covers under two
pixels and reads as dirt on the tile. The mark it replaced already carried a
dot at `0.28` of cap height, so enlarging it is consistent with the identity
rather than a break from it. Everything else is the font's own geometry.

## Files

Site icons, all cut from `public/favicon.svg`:

| file                              | size          | notes                                      |
| --------------------------------- | ------------- | ------------------------------------------ |
| `favicon.svg`                      | vector        | what modern browsers use in the tab        |
| `favicon.ico`                      | 16, 32, 48    | three real renders, not one image downscaled |
| `favicon-192.png`, `favicon-512.png` | manifest icons |                                          |
| `favicon-maskable-512.png`         | 512           | smaller cap so Android's circular crop clears it |
| `apple-touch-icon.png`             | 180           | opaque, as iOS requires                    |

Reusable versions under `public/assets/`:

| file                                                    | background  | glyph |
| ------------------------------------------------------- | ----------- | ----- |
| `burnworth-mark.svg`, `burnworth-mark-1024.png`           | ink square  | paper |
| `burnworth-mark-ink.svg`, `burnworth-mark-ink-1024.png`   | transparent | ink   |
| `burnworth-mark-light.svg`, `burnworth-mark-light-1024.png` | transparent | paper |

Use the ink version on paper and light photography, the light version on ink
and dark photography, the tile where the mark needs its own edge.

## Colours

`#11100f` ink, `#fbfaf6` paper, `#e2462f` red. The same three values as
`styles.css`.

## Licence

Archivo is licensed under the SIL Open Font License 1.1. The licence text ships
with the font at `public/assets/archivo-OFL.txt`. The mark is an outline of one
glyph, which the OFL permits; the resulting logo is Burnworth Co.'s own.
