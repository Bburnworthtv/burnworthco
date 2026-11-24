# Burnworth Co.

Recovered static source for [burnworthco.com](https://burnworthco.com), with SEO and AI visibility improvements prepared September 11, 2026.

## Deployment status

The site is static HTML in `public/`. A Vercel project named `burnworthco` is connected to `Bburnworthtv/burnworthco`; its `main` commit `6cce520` deployed successfully on September 28, 2026. `vercel.json` explicitly serves `public/`. Live `burnworthco.com` responses come from Vercel and matched the repository's `main` HTML when checked. The project API's domain list returned only `vercel.app` aliases, so confirm custom-domain ownership in the dashboard before promoting this branch. No deployment is performed by local validation.

## Files

- `public/`: complete deployable site, including images, styles, scripts, favicon assets and every page URL.
- `public/styles.css`: one stylesheet for every page, in numbered sections (tokens, header, buttons, question flow, homepage, report pages and so on). See "Design system" below.
- `public/flow.js`: the "Explore my options" question flow, the main way a visitor asks for a free audit. See "Free audit: the question flow".
- `public/script.js`: page behaviour (menu, scroll-in motion, counting numbers, contents rail, video).
- `public/analytics.js`: GA4, Google Tag Manager and an optional Meta Pixel, plus click tracking, on every page.
- `api/review-request.js`, `api/estimate-request.js`: the two form endpoints (Vercel functions). `api/_os-intake.js` files each request in Burnworth OS.
- `scripts/sync_partials.js`: writes the shared header, footer, `<head>` lines, scripts and the question flow into every page. See "Shared parts of every page".
- `scripts/validate.py`: dependency-free static release checks. `scripts/test_api.js`: tests for the form endpoints.
- `scripts/sync_dates.py`: sets each sitemap `lastmod` from git history and rolls the newest date up into the sitemap index.
- `scripts/indexnow.py`: after a deploy is live, submits every sitemap URL to IndexNow (Bing, Yandex, Seznam, Naver; not Google).
- `scripts/build_art.js`: draws the contour-line artwork and the share card. `scripts/build_logo.py`: regenerates the wordmark and mark SVGs (needs fontTools and Lora).
- `docs/seo-audit-2026-09-11.md`: observed baseline, implemented improvements, limitations and the next 90 days.
- `docs/deployment.md`: Cloudflare release and rollback steps (historical).
- `docs/brand-mark.md`: how the "Burnworth Co." serif wordmark and B. mark are built from Lora outlines, and which file to use where.
- `docs/research/`: study template, evidence and publishing process, and an unpublished Top Tier draft.
- `video/`: Remotion source for the overview video. Not deployed; see `video/README.md`.

## Validate

```
python3 scripts/validate.py     # pages, links, anchors, assets, metadata, sitemaps, and the shared-parts check
node scripts/test_api.js        # the two form endpoints, with no network
node --check public/script.js && node --check public/flow.js
```

This is plain HTML, CSS and JavaScript. There is no dependency installation and no build step: the pages in `public/` deploy exactly as they are. Publish the **contents of `public/`**, not the repository root. Keep `docs/` and `scripts/` outside the deployed directory.

## Shared parts of every page

The header, footer, shared `<head>` lines, shared scripts, the question flow and the row of sites we built are the same wherever they appear. They are written into the pages by `scripts/sync_partials.js`, between pairs of comments such as `<!-- header -->` and `<!-- /header -->`.

- To change the menu, the footer links, the phone number or the booking link: edit the templates at the top of `scripts/sync_partials.js`, then run `node scripts/sync_partials.js`. Do not edit the text between the comments; the next run replaces it.
- A new page needs the four regions `head`, `header`, `footer` and `scripts`. Copy them from an existing page (empty is fine) and run the script. Use `<!-- header:minimal -->` and `<!-- footer:minimal -->` for a landing page with no menu.
- `node scripts/sync_partials.js --check` fails if any page is out of date. `scripts/validate.py` runs it for you.

## Sitemaps and indexing

`/sitemap.xml` is a sitemap index (the URL already submitted in Search Console). It points to one sitemap per section: `sitemap-core.xml`, `sitemap-services.xml`, `sitemap-work.xml` and `sitemap-research.xml`, each with `lastmod` and on-page images. `robots.txt` lists all five, and `scripts/validate.py` checks that the sections together list every page exactly once.

After committing content changes, run `python3 scripts/sync_dates.py`. After a deploy is live, run `python3 scripts/indexnow.py`, then resubmit `/sitemap.xml` in Search Console and request indexing for the changed pages.

## Free audit: the question flow

The free audit is requested through three tap questions instead of a form: what the visitor wants help with (website, SEO, paid ads, or "not sure"), where their leads come from today, and whether they have a website. The last step shows where we would start, built from those answers, and asks for a name and email (website and phone are optional). It is defined in `public/flow.js` and posts to `api/review-request.js`.

Where it appears:

- **Homepage** (`/#review-form`) and **`/start`**: the flow is in the page, in the first screen on a phone.
- **Every other page**: any link with `data-flow-open` opens the same flow in a pop-up. The links point at `/start`, so they still work if the script does not run. Add `data-flow-interest="website"`, `"seo"`, `"ads"` or `"unsure"` to answer the first question for the visitor, as the service cards on the homepage do.
- **Phones**: an "Explore my options" bar with a call button is fixed to the bottom of the screen once the visitor scrolls.
- **Desktop**: the pop-up is offered once when the pointer leaves through the top of the window, not within 14 days of being closed, and never after a request is sent. There is no timed pop-up.

How it behaves:

- A tap moves to the next question by itself. With a keyboard, arrow keys choose and a Continue button moves on. Answers are kept while the tab is open, so the flow resumes on another page.
- Without JavaScript, or if `flow.js` fails to load, the same markup is an ordinary form with every question showing. It posts normally and the server redirects to `/thanks`.
- Each request carries where the visit came from: campaign tags (`utm_source` and so on), whether it was a Meta or Google ad click, the referring site and the first page seen. They appear in the email and in Burnworth OS.
- Spam protection is a hidden field plus a minimum time on the page.

To change a question or an answer: edit `FLOW` in `public/flow.js`, add the same value to `ANSWERS` in `api/review-request.js`, then run `node scripts/sync_partials.js` (it rewrites the markup in the two pages and checks the two lists match). The text shown on the last step comes from `PLANS` and `CONTEXT` in `flow.js`; keep it to what the audit covers and never promise a result.

Environment variables (Vercel → Project → Settings → Environment Variables, Production), then redeploy:

- `RESEND_API_KEY`: sends each request as an email through [Resend](https://resend.com). `REVIEW_TO` (optional, defaults to `Brandon@burnworthco.com`) and `REVIEW_FROM` (optional). Until `burnworthco.com` is verified in Resend, the default `onboarding@resend.dev` sender only delivers to the Resend account's own email.
- `OS_INTAKE_URL` and `OS_INTAKE_SECRET`: file each request as a lead in Burnworth OS (see "Leads in Burnworth OS").

A request counts as received when **either** the email or the CRM filing succeeds, so a problem with one never shows a real lead an error. Only when both fail does the visitor see the email and phone fallback. Set both so there is always a second copy.

## Ad landing page

`/start` is the page to send paid traffic to (Instagram, Facebook, Google). It has no menu, one headline, the question flow and three proof tiles. It is `noindex` and is not in the sitemaps; `/thanks` is its plain confirmation page.

- Match the headline to the ad with `?v=`: `/start?v=website`, `/start?v=seo` or `/start?v=ads`. Each shows its own headline (edit them in the `landing-variants` block in `public/start.html`) and answers the first question, so the visitor starts on the second.
- Tag the link so each lead shows its ad: `https://burnworthco.com/start?v=seo&utm_source=instagram&utm_medium=paid_social&utm_campaign=<campaign>&utm_content=<ad name>`.

## Website build estimate form

The web development page has a website build estimate form at `/web-development#estimate`. It posts to `api/estimate-request.js`, which emails each request through Resend using the same `RESEND_API_KEY`, `REVIEW_TO` and `REVIEW_FROM` variables as the free audit. `public/estimate.js` handles the in-page submission, and the form also works without JavaScript (the function redirects back to `/web-development?estimate=sent#estimate`).

- Required: name, email and project type. Optional: phone, business, current website, page count, timeline, features, budget and details. The choice fields only accept the listed answers.
- The budget ranges are in two places: the `<select name="budget">` in `web-development.html` and `BUDGETS` in `api/estimate-request.js`. Change both together.
- Events: `estimate_form_start` and `generate_lead` with `form: website_estimate`. Mark `generate_lead` as a key event in GA4 if it isn't already.
- Like the audit endpoint, it succeeds when either the email or the Burnworth OS filing succeeds.
- The question flow's desktop pop-up does not offer itself on this page.

Website builds are offered across the site: "Websites" in the main menu, a "Website builds" section and Web Development listed first on the homepage, and "Get a website estimate" buttons on the homepage, services page and web development page.

## Leads in Burnworth OS

Both forms also file each valid request as a lead in Burnworth OS, the agency's CRM, through `api/_os-intake.js` (not a route; Vercel ignores `api` files that start with an underscore). Set these in Vercel → Project → Settings → Environment Variables (Production), then redeploy:

- `OS_INTAKE_URL`: `https://burnworth-co-os.vercel.app/api/leads/intake`.
- `OS_INTAKE_SECRET`: the same value as `LEAD_INTAKE_SECRET` in the Burnworth OS project.

Without both, nothing is filed. Filing waits at most four seconds and never stops the email. Each lead carries the visitor's answers and where the visit came from in `details`, and a one-line summary in `message`. Spam caught by the hidden field or the time check is not filed.

## Design system

One stylesheet, `public/styles.css`, in numbered sections. Pages are light "paper" with ink panels set into them; corners are rounded, buttons are pills.

- **Tokens** are at the top: colours, radii, spacing, shadows and easing. `--red` is the brand red for the logo, large type and marks. White text sits on `--red-deep`, small red text on light uses `--red-ink`, and red text on ink uses `--red-soft`; each passes WCAG AA where it is used.
- **Dark surfaces** are listed once, in section 2. Add a new dark block to that list and its text, rules, eyebrows and buttons follow. Buttons fill from the left on hover or keyboard focus; the fill colour comes from `--btn-sweep`, which the dark-surface rule sets.
- **Type** is Archivo (self-hosted, variable). The emphasised words in headings (`<em>`) are set in the italic behind "Co" in the wordmark: Lora Italic 500, cut down to basic Latin and renamed as its license asks (`assets/accent-italic.woff2`, `assets/lora-OFL.txt`).
- **Motion**: content rises in as it scrolls into view (`data-reveal`, staggered with `style="--i:1"`), numbers count up (`data-count`), charts draw, and pages cross-fade where the browser supports it. All of it is switched off for visitors who ask for reduced motion, and none of it hides content if a script fails.
- **Alignment**: everything hangs on one pair of lines, `--pad` in from each side of the window (`--wrap` wide at most). Page sections use `padding-inline: var(--pad)`. The header bar is exactly that wide, so its ends sit on the same lines as the cards below. Ink panels sit `--edge` from the window and use `--panel-pad` so their content lands on the same lines (`--panel-pad-in` for a child of a panel that has no side padding of its own). On article pages the text starts on the left line under the page heading and the contents rail sits on the right line.
- **Buttons** come in three heights: `--btn-lg` (52px, the default `.button`), `--btn-md` (48px: the header button, the menu button, the phone bar) and `--btn-sm` (44px: `.button.small`, the header on phones, arrows and other round controls). Use the tokens, not new numbers. In the header the button sits 8px inside the bar on every side.
- **Header**: links, "Book a call" and the button from 1200px; without "Book a call" from 1101px; at 1100px and under the links move into the menu (the same number is in `script.js`). On phones the button reads "Free audit" and the logo scales with the screen so the three parts always fit.
- **Article pages** (`.report`): plain lists become ruled checklists. Use `<dl class="facts">` for labelled facts such as price and terms, `<div class="cards">` for a row of short cards, `<div class="faq-list">` with `<details name="faq">` for questions, and the `.tile` blocks for a headline number.

## Website showcase

The homepage, the work page and the web development page show the sites we designed and built as one row to swipe through: Top Tier Custom Floors, Pacific Earthworks, Model Home, Inc., Fluid Pictures and Go Virtuality. Each card is a real screenshot of the site in a browser window and a phone, a two or three word note on its look, who the client is, and a "Visit site" link where the site is live on its own domain.

- The list is `BUILDS` in `scripts/sync_partials.js`. The row is written into a page between `<!-- builds -->` and `<!-- /builds -->` (`<!-- builds:column -->` inside a column of text). To add a site, save its screenshots, add an entry to `BUILDS` and run `node scripts/sync_partials.js`. Only show sites Burnworth Co. built, and take the description from the client's own site.
- Screenshots: a 1280 x 800 window saved as `public/assets/<slug>-home-1600.webp`, `-home-960.webp` and `-home-1280.jpg`, and a 390 x 737 phone saved as `<slug>-phone-480.webp`, `-phone-300.webp` and `-phone-480.jpg`. The frames around them are CSS (`.browser`, `.phone`, `.stage`).
- Top Tier Custom Floors, Model Home and Fluid Pictures were captured from their live sites (toptierfloors.com, modelhomeinc.com, fluidpicturesinc.com), and Pacific Earthworks and Go Virtuality from pacific-earthworks.vercel.app and govirtuality-crm.vercel.app, all on November 24, 2026. Go Virtuality had not relaunched on its own domain then, so it is marked "Launching soon": give it a `url` in `BUILDS` and remove `status` once it is live. Give Pacific Earthworks a `url` once its own domain serves the new site.
- The row scrolls by itself: swipe on a phone, trackpad or arrow keys on a computer, and a visible scrollbar if the script does not load. `script.js` adds the arrow buttons, the progress bar, the "2 / 5" count and dragging with a mouse (`.reel` in `styles.css`).
- Fluid Pictures is named here as a website build. The ranking case study at `/work-los-angeles-production-company` still describes its client only as a Los Angeles production company; change the two together if that should change.
- `public/assets/pacific-earthworks-services-*` is the services-page screenshot used further down the web development page.

## Artwork and charts

- `node scripts/build_art.js` draws the contour-line ("topographic") artwork from a seeded noise field, in ink, paper and brand red: `assets/art-topo-dark-*.webp` and `art-topo-light-1400.webp`. It also renders the share card used for link previews, `assets/og-burnworth-1200.jpg`. It needs Playwright with Chromium at build time only.
- The four drawings on the homepage service cards are inline SVG, styled by the `.a-*` rules in `styles.css`. Keep all four in that one style.
- The small charts are HTML and CSS: `.meter` for one share of a whole, `.dots` for "1 in 100", `.milestones` for dated points on a line, and `.figure` for a headline number. Every number shown is one already stated in the page text with its source. A number that is the whole story is shown as a number, not forced into a chart.

## Analytics

`public/analytics.js` loads on every page. It sends to GA4 directly through `GA4_ID` (`G-WJL1CE5Z1Z`), loads Tag Manager through `GTM_ID` (`GTM-M6S6RWJP`) and pushes every event to the `dataLayer` as `{event: name, ...params}` for GTM Custom Event triggers. With both set, do not add a GA4 Google tag for the same ID inside GTM, or page views double count.

**Meta Pixel (Instagram and Facebook ads).** Put the pixel ID in `META_PIXEL_ID` at the top of `analytics.js`. It is empty until then, and no pixel was present on the site before this change, so Meta could not see which ads produced leads. With the ID set, every page sends `PageView` and a sent request sends `Lead`: choose "Leads" as the campaign's conversion so Meta optimises for requests rather than clicks. Starting the questions sends the custom event `FlowStart` and reaching the last step sends `FlowContact`, which are useful as conversions while lead volume is low. The pixel is not loaded for a visitor whose browser sends Global Privacy Control or Do Not Track; the privacy policy says so. Do not add the same pixel inside Tag Manager as well.

Events:

- Clicks: `click_to_call`, `email_click`, `book_call_click`, `free_audit_click` (any link that opens the question flow) and `cta_click`, each with `link_url`, `cta_text` and `cta_location`.
- Question flow: `flow_view`, `flow_start`, `flow_step` (with `step`, `question` and `answer`), `flow_contact_view`, `review_form_start`, `generate_lead` (with `form: options_flow`, `placement`, `interest`, `lead_source` and `site`), `flow_dismiss` and `flow_error`. In GA4, a funnel of `flow_view` → `flow_start` → `flow_contact_view` → `generate_lead` shows where visitors stop.
- Other: `overview_video_start`, `overview_video_complete`, `showcase_swipe` (the first time a visitor moves the row of sites), `estimate_form_start`, `generate_lead` with `form: website_estimate`, and `page_not_found` (with the missing address and where the link came from).

Mark `generate_lead`, `click_to_call`, `email_click`, `book_call_click` and `free_audit_click` as key events in GA4.

## Legal pages and accessibility

- `/privacy` covers the question flow, visit attribution, ad measurement (Meta Pixel), browser privacy signals and California residents, as well as Burnworth OS and QuickBooks. Update it, and its date, whenever what the site collects changes. It is a plain-language policy, not legal advice; have a lawyer review it if the business grows into laws that set thresholds, such as the CCPA.
- `/terms` covers use of the site and the Burnworth OS license.
- `/accessibility` states what the site aims for (WCAG 2.2 AA), what was tested and how to report a barrier. Update the date when you retest.
- `404.html` is the page shown for any address that does not exist. It records a `page_not_found` event so broken links can be found.

## Recovery boundary

Files were recovered from publicly served responses, not the original source archive. The initial recovery commit preserves those responses, including Cloudflare-injected email markup. The improved version restores ordinary email links and retains the site's established design and images.

Server code, account settings, DNS, secrets, Cloudflare rules, analytics configured outside HTML and any undiscovered routes could not be recovered from public responses. No credentials are included. The six known original pages came from the live sitemap and site links.

## Editing

Update the relevant static HTML document, then update the sitemap date only for changed pages. Keep visible business information and JSON-LD aligned. Do not claim an office location, ranking, review count, award or client outcome without evidence. Keep the original source images intact.
