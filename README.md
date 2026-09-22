# Burnworth Co.

Recovered static source for [burnworthco.com](https://burnworthco.com), with SEO and AI visibility improvements prepared September 11, 2026.

## Deployment status

The repository is not a Cloudflare deployment. The existing live site has not been changed by this work. Cloudflare project access and a verified release are still required.

## Files

- `public/`: complete deployable site, including recovered images, styles, scripts, favicon assets and all six original page URLs.
- `docs/seo-audit-2026-09-11.md`: observed baseline, implemented improvements, limitations and the next 90 days.
- `docs/deployment.md`: Cloudflare release and rollback steps.
- `scripts/validate.py`: dependency-free static release checks.
- `docs/brand-mark.md`: how the B mark is constructed from the Archivo outlines, and which file to use where.

## Validate

Run `python3 scripts/validate.py` and `node --check public/script.js`.

This is plain HTML, CSS and JavaScript. There is no dependency installation or build step. Publish the **contents of `public/`**, not the repository root. Keep `docs/` and `scripts/` outside the deployed directory.

## Recovery boundary

Files were recovered from publicly served responses, not the original source archive. The initial recovery commit preserves those responses, including Cloudflare-injected email markup. The improved version restores ordinary email links and retains the site's established design and images.

Server code, account settings, DNS, secrets, Cloudflare rules, analytics configured outside HTML and any undiscovered routes could not be recovered from public responses. No credentials are included. The six known original pages came from the live sitemap and site links.

## Editing

Update the relevant static HTML document, then update the sitemap date only for changed pages. Keep visible business information and JSON-LD aligned. Do not claim an office location, ranking, review count, award or client outcome without evidence. Keep the original source images intact.
