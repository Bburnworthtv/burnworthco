# Hero video

A 15-second, 1920x1080, 30 fps hero animation built with [Remotion](https://www.remotion.dev/).
It is a separate project, not part of the deployed site. Only the rendered file belongs in `public/`.

## Commands

```
npm install
npm run studio     # preview and edit props live
npm run render     # out/seo-hero.mp4
npm run poster     # out/seo-hero-poster.jpg (frame 66, a finished scene)
npm run typecheck
```

## Structure

- `src/Root.tsx` registers the `SeoHero` composition.
- `src/SeoAnimation.tsx` holds all five scenes, the timeline and the default copy (`defaultSeoProps`).
- `public/archivo-latin.woff2` is the site's own Archivo file, copied from `../public/assets/`. Licence: `public/archivo-OFL.txt`.

| Scene | Frames | Content |
| ----- | ------ | ------- |
| 1 Problem | 0-90 | Hook, falling visibility chart, position counter |
| 2 Solution | 78-168 | Search bar, your listing climbs, rising bar chart |
| 3 AI answers | 156-228 | Prompt, AI answer, your domain cited as a source |
| 4-5 Finale | 216-450 | One camera move: heatmap zoom, phone "near me" search, push into the phone's map, pull back over the city as phones drive to your pin, out to the data globe, then the CTA over the globe |

The phone's map is the same `CityMap` render as the full-screen city, scaled down, so the push-in hand-off is exact.
Beat timings for the finale live in `FIN` at the top of `src/SeoAnimation.tsx`.

Scenes overlap by 12 frames for cross-dissolves. The last frame fades to ink, so the loop is seamless.

## Copy rules

The README at the repository root applies: no ranking, review or outcome claims without evidence.
The site's local SEO FAQ says Burnworth Co. does not guarantee first place, so the default copy does not say "#1".
Before publishing, make sure the CTA offer ("free audit") matches `search-visibility-audit.html`, which currently says audit pricing depends on scope.

## Embedding

Render a smaller web copy (for example `--crf=28`) and a WebM, then use a muted, looping, `playsinline` video with the poster frame.
Respect `prefers-reduced-motion` by showing the poster instead, and keep the page's real H1 and CTA in HTML.
