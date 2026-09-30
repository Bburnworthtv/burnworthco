# Hero video

Two [Remotion](https://www.remotion.dev/) compositions, 1920x1080 at 30 fps. This is a separate project, not part of the deployed site. Only rendered files belong in `public/`.

| Composition | Length | Use |
| ----------- | ------ | --- |
| `SeoHero` | about 26 s | Explainer or ad. Has its own headlines and end card. |
| `SeoHeroBackground` | 12 s, seamless loop | Behind the site's HTML hero on screens 800px and wider. No copy; the left side stays calm for the headline and a real, clickable button. |
| `SeoHeroBackgroundPortrait` | 12 s, seamless loop | The same loop at 1080x1920 for phones, pin beside the headline's last line. Shipped at 540x960. |

## Commands

```
npm install
npm run studio      # preview and edit props live
npm run render      # out/seo-hero.mp4
npm run render:bg   # out/seo-hero-background.mp4
npm run render:bg-portrait   # out/seo-hero-background-portrait.mp4
npm run poster      # explainer poster frame
npm run poster:bg   # background poster frame
npm run typecheck
```

## Explainer structure

| Scene | Frames | Content |
| ----- | ------ | ------- |
| 1 Opportunity | 0-135 | "Your next customer is searching." with the searches customers type |
| 2 Found in search | 123-258 | "We get you found." with the listing moving to the top |
| 3 Search, Maps and AI | 246-381 | "Build visibility across search, Maps, and AI answers." |
| 4-5 Finale | 369-789 | Phone search ends in a sent estimate request; push into its map; local map with "Understand how customers find you. Track the inquiries that follow."; Burnworth Co. end card with the review offer |

Finale beats live in `FIN` at the top of `src/SeoAnimation.tsx`; all copy is in `defaultSeoProps`.
The phone's map is the same `LocalMap` render as the full-screen map, scaled down, so the push-in hand-off is exact.

## Copy rules

The README at the repository root applies: no ranking, review or outcome claims without evidence.

- No simulated metrics: no counters, percentages or "live" data labels. Map activity and inquiry cards are illustrations, not reported results.
- No placement promises: the AI line is "Build visibility across search, Maps, and AI answers."
- The end card offer lists what the review covers. Use it only if those are the deliverables, and make sure "free" matches `search-visibility-audit.html`, which currently says pricing depends on scope.

## Embedding

For the site hero, keep the headline and button in HTML and use `SeoHeroBackground` as a muted, looping, `playsinline` video with its poster frame. Show the poster alone under `prefers-reduced-motion`. Use `SeoHero` where people choose to watch it, such as a section video or an ad.
