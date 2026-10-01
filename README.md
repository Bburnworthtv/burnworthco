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
- `public/analytics.js`: GA4 and Google Tag Manager, plus click tracking, on every page. GA4 (`GA4_ID`) is live; paste the Tag Manager container ID into `GTM_ID` to load GTM alongside it.
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

## Visibility review form

The homepage form posts to `api/review-request.js`, a Vercel function that emails each request through [Resend](https://resend.com). Set these in Vercel → Project → Settings → Environment Variables (Production), then redeploy:

- `RESEND_API_KEY` (required). Without it the form shows visitors the email and phone fallback instead.
- `REVIEW_TO` (optional, defaults to `Brandon@burnworthco.com`).
- `REVIEW_FROM` (optional). Until `burnworthco.com` is verified in Resend, the default `onboarding@resend.dev` sender only delivers to the Resend account's own email, so sign up to Resend with `Brandon@burnworthco.com` or verify the domain.

Spam protection is a hidden field plus a minimum time on the page. The form also works without JavaScript: the function redirects back to `/?review=sent#review`.

## Analytics

`public/analytics.js` loads on every page. It sends to GA4 directly through `GA4_ID` (`G-WJL1CE5Z1Z`) and, once `GTM_ID` holds a `GTM-` container ID, also loads Tag Manager and pushes every event to the `dataLayer` as `{event: name, ...params}` for GTM Custom Event triggers. With both set, do not add a GA4 Google tag for the same ID inside GTM, or page views double count.

Click events: `click_to_call`, `email_click`, `book_call_click`, `free_audit_click` (any link to the free audit form at `/#review-form`) and `cta_click`, each with `link_url`, `cta_text` and `cta_location`. The homepage also sends `overview_video_start`, `overview_video_complete`, `review_form_start` and `generate_lead` (free audit form submitted). Mark `generate_lead`, `click_to_call`, `email_click`, `book_call_click` and `free_audit_click` as key events in GA4.

Every "Book a call" link is paired with a free audit link: a red "Free audit" chip in each page header and a "Get a free audit" button beside each booking button in the page body.

## Recovery boundary

Files were recovered from publicly served responses, not the original source archive. The initial recovery commit preserves those responses, including Cloudflare-injected email markup. The improved version restores ordinary email links and retains the site's established design and images.

Server code, account settings, DNS, secrets, Cloudflare rules, analytics configured outside HTML and any undiscovered routes could not be recovered from public responses. No credentials are included. The six known original pages came from the live sitemap and site links.

## Editing

Update the relevant static HTML document, then update the sitemap date only for changed pages. Keep visible business information and JSON-LD aligned. Do not claim an office location, ranking, review count, award or client outcome without evidence. Keep the original source images intact.
