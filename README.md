# Burnworth Co.

Recovered static source for [burnworthco.com](https://burnworthco.com), with SEO and AI visibility improvements prepared September 11, 2026.

## Deployment status

The site is static HTML in `public/`. A Vercel project named `burnworthco` is connected to `Bburnworthtv/burnworthco`; its `main` commit `6cce520` deployed successfully on September 28, 2026. `vercel.json` explicitly serves `public/`. Live `burnworthco.com` responses come from Vercel and matched the repository's `main` HTML when checked. The project API's domain list returned only `vercel.app` aliases, so confirm custom-domain ownership in the dashboard before promoting this branch. No deployment is performed by local validation.

## Files

- `public/`: complete deployable site, including recovered images, styles, scripts, favicon assets and all six original page URLs.
- `docs/seo-audit-2026-09-11.md`: observed baseline, implemented improvements, limitations and the next 90 days.
- `docs/deployment.md`: Cloudflare release and rollback steps.
- `scripts/validate.py`: dependency-free static release checks.
- `scripts/sync_dates.py`: sets each sitemap `lastmod` from git history and rolls the newest date up into the sitemap index.
- `scripts/indexnow.py`: after a deploy is live, submits every sitemap URL to IndexNow (Bing, Yandex, Seznam, Naver; not Google).
- `public/analytics.js`: Google tag and click tracking. Paste a GA4 (`G-`) or Tag Manager (`GTM-`) ID into `TAG_ID`; nothing loads until then.
- `video/`: Remotion source for the homepage background video and the longer explainer. Not deployed; see `video/README.md`.
- `docs/brand-mark.md`: how the B mark is constructed from the Archivo outlines, and which file to use where.
- `docs/research/`: study template, evidence and publishing process, and an unpublished Top Tier draft.
- `video/`: Remotion source for the 15-second hero video. Not deployed; see `video/README.md`.

## Validate

Run `python3 scripts/validate.py` and `node --check public/script.js`.

This is plain HTML, CSS and JavaScript. There is no dependency installation or build step. Publish the **contents of `public/`**, not the repository root. Keep `docs/` and `scripts/` outside the deployed directory.

## Sitemaps and indexing

`/sitemap.xml` is a sitemap index (the URL already submitted in Search Console). It points to one sitemap per section: `sitemap-core.xml`, `sitemap-services.xml`, `sitemap-work.xml` and `sitemap-research.xml`, each with `lastmod` and on-page images. `robots.txt` lists all five, and `scripts/validate.py` checks that the sections together list every page exactly once.

After committing content changes, run `python3 scripts/sync_dates.py`. After a deploy is live, run `python3 scripts/indexnow.py`, then resubmit `/sitemap.xml` in Search Console and request indexing for the changed pages.

## Analytics

`public/analytics.js` loads on every page. Once `TAG_ID` is set it sends `click_to_call`, `email_click`, `book_call_click` and `cta_click`, each with `link_url`, `cta_text` and `cta_location`. Mark the first three as key events in GA4.

## Recovery boundary

Files were recovered from publicly served responses, not the original source archive. The initial recovery commit preserves those responses, including Cloudflare-injected email markup. The improved version restores ordinary email links and retains the site's established design and images.

Server code, account settings, DNS, secrets, Cloudflare rules, analytics configured outside HTML and any undiscovered routes could not be recovered from public responses. No credentials are included. The six known original pages came from the live sitemap and site links.

## Editing

Update the relevant static HTML document, then update the sitemap date only for changed pages. Keep visible business information and JSON-LD aligned. Do not claim an office location, ranking, review count, award or client outcome without evidence. Keep the original source images intact.
