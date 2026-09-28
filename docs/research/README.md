# Burnworth Co. research publishing

The live site is static HTML. `/research` is the index, `/research/methodology` is the shared method, and individual studies live at `/research/<study-slug>`. The existing 2026 search briefing lives at `/research/state-of-search-2026`.

## Publish a study

1. Copy `study-template.md` to a working draft in this directory. Complete the evidence register before writing a headline result. Keep exports and private client information outside `public/` and outside Git.
2. Obtain client approval for names, quotes, screenshots and results. Identify the first valid measurement date for each source and log significant changes.
3. Check every figure against its source, date range, filter and denominator. Label analytics observations, sampled answers, client reports and interpretations separately.
4. Create `public/research/<study-slug>.html` from the existing research page structure. Use the current header, footer, stylesheet, canonical host, `WebPage` and `Article` data where appropriate, and a visible author/date/revision note. Add `Dataset` only when there is a real documented dataset.
5. Add the study to `public/research.html`, `public/sitemap.xml`, `public/_headers` and the nested research cache rule in `vercel.json` (already covers all nested research pages). Keep the page's canonical and graph URLs aligned with its path. Do not publish the draft with empty placeholders.
6. Run `python3 scripts/validate.py` and `node --check public/script.js`. Review the complete page at mobile and desktop widths before release. Deployment and submission to search engines are separate steps.

### Source register fields

`claim_id | evidence class | source/property | measurement dates | export date | filters | calculation/denominator | file or screenshot reference | client permission | reviewer | public wording`

Evidence classes: **analytics observed**, **test observed**, **client reported**, **interpretation**. A click on a telephone link is not a completed call. A manual AI mention is a sample observation, not a platform ranking.

### Update policy

Keep the same URL for meaningful 90-day, six-month and twelve-month follow-ups. Add a dated update history, state what changed in the method, and preserve corrections visibly. Do not silently replace an earlier result with a later one.

### Automation boundary

Scripts or AI may import exports, normalize dates, calculate figures, flag missing provenance and draft charts or text. A person must approve client disclosures, calculations, interpretations and the final page. Do not place GA4, GSC, GBP or client exports in the public directory.
