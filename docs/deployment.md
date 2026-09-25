# Cloudflare release

Prepared September 11, 2026. **Not deployed.**

## Identify the existing project first

The public response headers establish Cloudflare delivery but do not identify the account, project name or whether a Worker intercepts requests. Check the existing `burnworthco.com` project under Workers & Pages. Preserve the custom domain, DNS and current deployment until the replacement is verified.

## If it is a Pages Direct Upload project

1. Use the existing project and create a new deployment. Upload the contents of `public/`, with `index.html`, `404.html`, `_headers` and `_redirects` at the upload root.
2. Use a preview deployment where available and verify the pages and contact actions before production promotion. Cloudflare Pages adds a noindex header to preview responses; keep previews out of search.
3. Confirm all six original paths still resolve, plus the five new paths in the sitemap.
4. Confirm a nonexistent path now returns HTTP 404 instead of the homepage with HTTP 200. A Worker or account-level rewrite could override static behavior and must be checked.
5. Confirm `/services.html` redirects to `/services` and the canonical host is `https://burnworthco.com`. Configure HTTP-to-HTTPS at the zone if necessary. The recovered site did not reveal all host-level rules.
6. Check the homepage, services, work pages, email, telephone and Calendly links on phone and desktop.
7. Verify assets, favicon and social image, and confirm no sitewide `noindex` header or Cloudflare challenge on production.

A Pages Direct Upload project cannot be switched to Git integration in place. Keep direct uploads, deploy from CI using the existing project, or create a separate Git-integrated Pages project and migrate the domain after verification. Do not delete the existing project to connect GitHub.

For an authenticated Wrangler installation, the release command is `wrangler pages deploy public --project-name <verified-existing-project-name>`. Do not guess the name or use an unverified target. No deployment credentials or automated publishing workflow have been added here.

## If it is Workers Static Assets

Retain the existing Worker configuration and its bindings. Point its asset directory at `public/` and verify the existing HTML routing and not-found handling. Do not replace the Worker with this static directory without checking its current responsibilities. Server-side behavior cannot be recovered from a public page.

## Vercel preview (temporary)

`burnworthco-preview.vercel.app` is a scratch preview host. It is not the
production site; `burnworthco.com` remains on Cloudflare and is unaffected by
anything in this section.

Connect the existing Vercel project to this repository rather than uploading
files by hand:

1. Project > Settings > Git: connect `Bburnworthtv/burnworthco`.
2. Project > Settings > Build and Deployment: Framework Preset `Other`,
   Build Command empty (override on, left blank), Install Command empty,
   Output Directory `public`. Root Directory stays at the repository root so
   `vercel.json` is read.
3. Project > Settings > Git > Production Branch: set to the branch whose work
   should appear at the bare `burnworthco-preview.vercel.app` hostname. That
   hostname is the project's production alias; other branches deploy to their
   own generated URLs instead.

`_headers` and `_redirects` are Cloudflare Pages files and are ignored by
Vercel. `vercel.json` at the repository root covers the equivalent behaviour:
extensionless URLs matching the sitemap and canonical tags, and the two
security headers. Cloudflare ignores `vercel.json`, so the two hosts do not
interfere.

`vercel.json` also sends `X-Robots-Tag: noindex, nofollow` on every response so
the preview cannot compete with `burnworthco.com` in search. **Remove that
header before serving production traffic from Vercel.**

## After production release

- Fetch all sitemap URLs and confirm HTTP 200, self-canonicals and correct titles.
- Fetch a random nonexistent path and confirm HTTP 404.
- Inspect Google Search Console indexing and the generative AI inclusion setting; submit the sitemap and request inspection of priority pages. These account-level actions have not been performed.
- Check Bing Webmaster Tools crawl/index coverage and available AI Performance reporting.
- Test any existing analytics before adding a new tag. None was visible in recovered HTML, but Cloudflare may inject tracking separately. Avoid creating duplicate tracking.
- Verify that `Brandon@burnworthco.com`, the published telephone number and the Calendly account are current. They were preserved from the live site; inbox delivery and booking completion were not tested.
- Record the release date as the start of a comparison period. Deployment is not evidence of indexing or ranking improvement.

## Rollback

Retain the old Cloudflare deployment and use its rollback control if a live check fails. The Git recovery commit preserves the original public responses. Do not revert unrelated DNS or account changes.

## References

- [Pages serving behavior and automatic clean URLs](https://developers.cloudflare.com/pages/configuration/serving-pages/)
- [Pages Direct Upload](https://developers.cloudflare.com/pages/get-started/direct-upload/)
- [Direct Upload with continuous integration](https://developers.cloudflare.com/pages/how-to/use-direct-upload-with-continuous-integration/)
