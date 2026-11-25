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
- `api/review-request.js`, `api/estimate-request.js`: the two form endpoints (Vercel functions). `api/_deliver.js` holds what they share: the email, the spam check and the rule for what the visitor is told. `api/_os-intake.js` files each request in Burnworth OS.
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

The header, footer, shared `<head>` lines, shared scripts, the question flow, the row of sites we built, the SEO, AEO and GEO explainer and the San Diego County map are the same wherever they appear. They are written into the pages by `scripts/sync_partials.js`, between pairs of comments such as `<!-- header -->` and `<!-- /header -->`.

- To change the menu, the footer links, the phone number or the booking link: edit the templates at the top of `scripts/sync_partials.js`, then run `node scripts/sync_partials.js`. Do not edit the text between the comments; the next run replaces it.
- A new page needs the four regions `head`, `header`, `footer` and `scripts`. Copy them from an existing page (empty is fine) and run the script. Use `<!-- header:minimal -->` and `<!-- footer:minimal -->` for a landing page with no menu.
- `node scripts/sync_partials.js --check` fails if any page is out of date. `scripts/validate.py` runs it for you.

## Sitemaps and indexing

`/sitemap.xml` is a sitemap index (the URL already submitted in Search Console). It points to one sitemap per section: `sitemap-core.xml`, `sitemap-services.xml`, `sitemap-work.xml` and `sitemap-research.xml`, each with `lastmod` and on-page images. `robots.txt` lists all five, and `scripts/validate.py` checks that the sections together list every page exactly once.

After committing content changes, run `python3 scripts/sync_dates.py`. After a deploy is live, run `python3 scripts/indexnow.py`, then resubmit `/sitemap.xml` in Search Console and request indexing for the changed pages.

Dates are Pacific time: the `lastmod` values `sync_dates.py` writes, `dateModified` in a page's structured data, and any "Updated" date a visitor sees. A machine on UTC is a day ahead every evening, and a date that has not started yet in California gets a page flagged in Search Console ("Invalid datetime value").

## Free audit: the question flow

The free audit is requested through three tap questions instead of a form: what the visitor wants help with (website, SEO, paid ads, or "not sure"), where their leads come from today, and whether they have a website. The last step shows where we would start, built from those answers, and asks for a name and email (website and phone are optional). It is defined in `public/flow.js` and posts to `api/review-request.js`.

Where it appears:

- **Homepage** (`/#review-form`), **`/start`**, **`/ai-search-optimization`** and the two San Diego pages (**`/san-diego-seo`**, **`/contractor-seo-san-diego`**): the flow is in the page, in the first screen on a phone. On the service pages the first question is already answered (SEO), so it opens on the second; the region there is `<!-- flow:service -->`. On those pages and on `/start`, a few lines from `early()` in `flow.js` are written into the page after the form and open it on the second question before the page is painted, so nothing jumps when `flow.js` loads.
- **Every other page**: any link with `data-flow-open` opens the same flow in a pop-up. The links point at `/start`, so they still work if the script does not run. Add `data-flow-interest="website"`, `"seo"`, `"ads"` or `"unsure"` to answer the first question for the visitor, as the service cards on the homepage do.
- **Phones**: an "Explore my options" bar with a call button is fixed to the bottom of the screen once the visitor scrolls.
- **Desktop**: the pop-up is offered once when the pointer leaves through the top of the window, not within 14 days of being closed, and never after a request is sent. There is no timed pop-up.

How it behaves:

- A tap moves to the next question by itself. With a keyboard, arrow keys choose and a Continue button moves on. Answers are kept while the tab is open, so the flow resumes on another page.
- A page can hold two copies of the flow: the one in the page and the pop-up. They share one set of answers. An answer changed in one shows in the other straight away, and a request is always read from the form that sent it, so the email and Burnworth OS get what the visitor saw.
- Without JavaScript, or if `flow.js` fails to load, the same markup is an ordinary form with every question showing. It posts normally and the server redirects to `/thanks`.
- Each request carries where the visit came from: campaign tags (`utm_source` and so on), whether it was a Meta or Google ad click, the referring site and the first page seen. They appear in the email and in Burnworth OS.
- The spam check is a field visitors cannot see plus the time since the page loaded. It marks an email as possible spam; it never stops one (see "What the visitor is told, and the spam check" below).

To change a question or an answer: edit `FLOW` in `public/flow.js`, add the same value to `ANSWERS` in `api/review-request.js`, then run `node scripts/sync_partials.js` (it rewrites the markup in the two pages and checks the two lists match). The text shown on the last step comes from `PLANS` and `CONTEXT` in `flow.js`; keep it to what the audit covers and never promise a result.

Environment variables (Vercel → Project → Settings → Environment Variables, Production), then redeploy:

- `RESEND_API_KEY`: sends each request as an email through [Resend](https://resend.com). `REVIEW_TO` (optional, defaults to `Brandon@burnworthco.com`; several addresses can be listed, separated by commas) and `REVIEW_FROM` (optional). Until `burnworthco.com` is verified in Resend, the default `onboarding@resend.dev` sender only delivers to the Resend account's own email.
- `OS_INTAKE_URL` and `OS_INTAKE_SECRET`: file each request as a lead in Burnworth OS (see "Leads in Burnworth OS").

### What the visitor is told, and the spam check

Both forms follow two rules, in `api/_deliver.js`. They exist so that a real request is never lost without anyone knowing.

1. **"Sent" means the email went out.** The visitor sees the confirmation only when Resend accepted the email. If it did not, the form shows the email and phone fallback, even when Burnworth OS has the lead, because the email is how the studio hears about a request. Set the Burnworth OS variables as well so there is a second copy.
2. **The spam check never stops a request.** A request that trips it (the hidden field is filled in, or it arrives within a few seconds of the page loading) is emailed like any other with "Possible spam:" at the front of the subject and the reason at the top. It is not filed in Burnworth OS. To keep these out of the inbox, filter on that subject; do not go back to dropping them.

Why: until November 25, 2026 a tripped check answered "ok" and sent nothing. The hidden field was named `company`, and Chrome's autofill filled it with the visitor's company name (Chrome ignores `autocomplete="off"` for this), so a visitor who used autofill saw "Got it" and the request went nowhere. The field is now named `bw_check`; the name is in `HIDDEN_FIELD` in `api/_deliver.js`, in `public/flow.js` and in the estimate form in `public/web-development.html`. Never give it a name a browser fills in (anything with "company", "name", "email", "phone", "address" or "url" in it); `scripts/test_api.js` fails if the three places differ or the name looks like one of those.

To check that requests arrive: send one through the form on the live site and look for the email. Each request also writes one line to the function's log in Vercel (for example `free audit request: email sent, Burnworth OS filed`), with nothing personal in it. In GA4 the `generate_lead` event counts the confirmations visitors saw; read it for the host name `burnworthco.com` only, because preview addresses report to the same property.

## Ad landing page

`/start` is the page to send paid traffic to (Instagram, Facebook, Google). It has no menu, one headline, the question flow and three proof tiles. It is `noindex` and is not in the sitemaps; `/thanks` is its plain confirmation page.

- Match the headline to the ad with `?v=`: `/start?v=website`, `/start?v=seo`, `/start?v=ads` or `/start?v=ai` (for ads about AI search; it counts as SEO in the flow). Each shows its own headline (edit them in the `landing-variants` block in `public/start.html`) and answers the first question, so the visitor starts on the second.
- Tag the link so each lead shows its ad: `https://burnworthco.com/start?v=seo&utm_source=instagram&utm_medium=paid_social&utm_campaign=<campaign>&utm_content=<ad name>`.

## Website build estimate form

The web development page has a website build estimate form at `/web-development#estimate`. It posts to `api/estimate-request.js`, which emails each request through Resend using the same `RESEND_API_KEY`, `REVIEW_TO` and `REVIEW_FROM` variables as the free audit. `public/estimate.js` handles the in-page submission, and the form also works without JavaScript (the function redirects back to `/web-development?estimate=sent#estimate`).

- Required: name, email and project type. Optional: phone, business, current website, page count, timeline, features, budget and details. The choice fields only accept the listed answers.
- The budget ranges are in two places: the `<select name="budget">` in `web-development.html` and `BUDGETS` in `api/estimate-request.js`. Change both together.
- Events: `estimate_form_start` and `generate_lead` with `form: website_estimate`. Mark `generate_lead` as a key event in GA4 if it isn't already.
- It follows the same two rules as the audit endpoint: "sent" means the email went out, and the spam check marks an email but never stops one.
- The question flow's desktop pop-up does not offer itself on this page.

Website builds are offered across the site: "Websites" in the main menu, a "Website builds" section and Web Development listed first on the homepage, and "Get a website estimate" buttons on the homepage, services page and web development page.

## Leads in Burnworth OS

Both forms also file each valid request as a lead in Burnworth OS, the studio's CRM, through `api/_os-intake.js` (not a route; Vercel ignores `api` files that start with an underscore). Set these in Vercel → Project → Settings → Environment Variables (Production), then redeploy:

- `OS_INTAKE_URL`: `https://burnworth-co-os.vercel.app/api/leads/intake`.
- `OS_INTAKE_SECRET`: the same value as `LEAD_INTAKE_SECRET` in the Burnworth OS project.

Without both, nothing is filed. Filing waits at most four seconds and never stops the email. Each lead carries the visitor's answers and where the visit came from in `details`, and a one-line summary in `message`. A request the spam check marked is emailed but not filed.

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

- The list is `BUILDS` in `scripts/sync_partials.js`. The row is written into a page between `<!-- builds -->` and `<!-- /builds -->` (`<!-- builds:column -->` inside a column of text; `<!-- builds:local -->` for only the San Diego County clients, the entries marked `county: true`, which sit three across on a wide screen). To add a site, save its screenshots, add an entry to `BUILDS` and run `node scripts/sync_partials.js`. Only show sites Burnworth Co. built, and take the description from the client's own site.
- Screenshots: a 1280 x 800 window saved as `public/assets/<slug>-home-1600.webp`, `-home-960.webp` and `-home-1280.jpg`, and a 390 x 737 phone saved as `<slug>-phone-480.webp`, `-phone-300.webp` and `-phone-480.jpg`. The frames around them are CSS (`.browser`, `.phone`, `.stage`).
- Top Tier Custom Floors, Model Home and Fluid Pictures were captured from their live sites (toptierfloors.com, modelhomeinc.com, fluidpicturesinc.com), and Pacific Earthworks and Go Virtuality from pacific-earthworks.vercel.app and govirtuality-crm.vercel.app, all on November 24, 2026. Go Virtuality had not relaunched on its own domain then, so it is marked "Launching soon": give it a `url` in `BUILDS` and remove `status` once it is live. Give Pacific Earthworks a `url` once its own domain serves the new site.
- The row scrolls by itself: swipe on a phone, trackpad or arrow keys on a computer, and a visible scrollbar if the script does not load. `script.js` adds the arrow buttons, the progress bar, the "2 / 5" count and dragging with a mouse (`.reel` in `styles.css`).
- Fluid Pictures is named here as a website build. The ranking case study at `/work-los-angeles-production-company` still describes its client only as a Los Angeles production company; change the two together if that should change.
- `public/assets/pacific-earthworks-services-*` is the services-page screenshot used further down the web development page.

## GEO and AEO

The site explains three names in the same words everywhere: SEO (search engine optimization), AEO (answer engine optimization) and GEO (generative engine optimization). **GEO and AEO are included in every SEO package and are never sold as an add-on.** That is a statement about what we sell, so keep every copy of it in step.

- The three definitions and the "included" line are `TERMS` and `terms()` in `scripts/sync_partials.js`. They are written into a page between `<!-- terms -->` and `<!-- /terms -->`: on the homepage (under "How search changed"), `/ai-search-optimization`, `/san-diego-seo`, `/contractor-seo`, `/services` and the guide. Edit them there and run `node scripts/sync_partials.js`. The block lays itself out by its own width (`.terms` in `styles.css`), so it can go in a full-width section or a column of text.
- `/ai-search-optimization` is the service page, and the page to link to when someone wants to buy this: the question flow in the first screen, what the work includes, proof, price and questions. `/generative-engine-optimization` is the guide: what each name means, a comparison table, the other names, how to show up in ChatGPT and Google's AI answers, and questions.
- The same promise is also written by hand in these places. If the offer changes, change all of them: the price table and the questions on `/ai-search-optimization`; the last "what the work includes" card, one row of facts and one question on each of `/san-diego-seo` and `/contractor-seo-san-diego`, and one row of the choosing table on `/san-diego-seo`; the "GEO and AEO" row in the price tables on `/contractor-seo` and `/seo-for-flooring-companies`; the last item of each "what the work includes" list on those two pages; one question in the FAQ on the homepage, `/contractor-seo`, `/seo-for-flooring-companies` and the guide; the two SEO cards on the homepage; the Grow, Prove and Measure sections of `/services` and its description; one sentence on `/search-visibility-audit`; and "Price and terms" in `public/llms.txt`.
- Wherever a page has questions, the visible answer and the `FAQPage` JSON-LD must match word for word.
- Keep it honest. The pages say what the names mean and what the work is. They never promise a place in an AI answer; "No one can promise that, and we do not" stays.

### Which page answers which search

People search for this work under many names. Each family of phrases has one page, so two pages never compete for the same search. Keep the phrase in that page's title or headings, and link to that page when the phrase comes up elsewhere.

| Searches like | Page | Where the phrase sits |
| --- | --- | --- |
| "AI search optimization services", "AI SEO services", "AI SEO agency", "GEO services", "AEO services", "GEO agency", "LLM SEO services", "ChatGPT SEO services" | `/ai-search-optimization` | Title, first heading, the "Also called" strip, "What our GEO and AEO services include", the questions |
| "generative engine optimization", "answer engine optimization", "what is GEO", "what is AEO", "GEO vs SEO", "AEO vs SEO", "AEO vs GEO", "AI SEO", "LLM SEO", "LLMO", "GAIO", "how to rank in ChatGPT", "how to get cited by ChatGPT" | `/generative-engine-optimization` | Title, the "What is ...?" headings, the comparison table, "Other names", "How to show up in ChatGPT", the questions |
| "AI visibility audit", "GEO audit", "AI SEO audit" | `/search-visibility-audit` | Title, "How AI visibility is tested" |
| "GEO for contractors", "AI SEO for contractors" | `/contractor-seo` | "GEO and AEO for contractors" |

The list came from Google Ads keyword estimates and Google's United States results on November 25, 2026. At that time "AI SEO agency", "AI search optimization services" and "what is AEO" were growing fastest, and the service searches returned a mix of agency pages and "best agencies" lists, with an AI answer that named what the service includes. "GEO" and "AEO" alone are too broad to aim at: most people typing them mean something else. In local SEO, "geo" also means geo-targeting, and the guide says so.

## San Diego pages

Two pages are written for people looking for this work locally. Both are service pages with the question flow in the first screen, like `/ai-search-optimization`.

| Searches like | Page | Where the phrase sits |
| --- | --- | --- |
| "contractor SEO San Diego", "SEO for contractors in San Diego", "San Diego contractor SEO", a trade plus "SEO San Diego" | `/contractor-seo-san-diego` | Title, first heading, "Who does contractor SEO in San Diego?", the price heading, the questions |
| "SEO agency San Diego", "SEO company San Diego", "San Diego SEO", "SEO services San Diego", "local SEO San Diego", "SEO consultant San Diego", "best SEO company San Diego" | `/san-diego-seo` | Title, first heading, the "Also searched as" strip, "What our San Diego SEO services include", "How to choose an SEO company in San Diego", the questions |

`/contractor-seo` stays the page for "SEO for contractors" with no place in the search, and links to the local page.

- **Say where we are.** Burnworth Co. is in Oceanside, in San Diego's North County, and works across San Diego County. Never write or imply an office in the city of San Diego. "A San Diego SEO company" is the heading on `/san-diego-seo` because that is what people search for and Oceanside is in San Diego County; the sentence under it says Oceanside, and so do the facts table and two of the questions.
- **"Agency" is the visitor's word.** Google counts "SEO agency San Diego" and "SEO company San Diego" as one search, so the headings say "company". "Agency" appears in the "Also searched as" strip, in the question "Are you an SEO agency in San Diego?" and as a comparison ("not a downtown agency").
- **Local proof only.** The clients named are the ones in the county: Top Tier Custom Floors (Valley Center), Model Home, Inc. (San Marcos) and Pacific Earthworks. Results are the clients' own reports, labelled as such. The trades in the strip on the contractor page are who the work is built for; the questions say which trades our clients are actually in.
- **The map** is `area()` in `scripts/sync_partials.js`, written between `<!-- area -->` and `<!-- /area -->`. It is drawn from latitude and longitude (`COAST`, `PLACES`), so a place added to `PLACES` lands in the right spot; `side` and `dy` move a label that would touch another. `REGIONS` is the list beside it. A new client in the county gets `kind: 'client'` there, a line in the paragraph under "Anywhere in San Diego County" and, if we built the site, `county: true` in `BUILDS`.
- **Answer first.** Each section opens with a sentence that answers a question someone would type or ask an AI tool, and the tables ("Why you rank in one city and not the next", "How to choose an SEO company in San Diego") and the "at a glance" facts are there to be quoted. Outside sources are linked where a claim rests on them: Google on local ranking and on guarantees, and the state's contractor license lookup.
- **Structured data.** Each page has a `Service` with `areaServed` (the county and its larger cities) and a `FAQPage` that matches the visible questions word for word. The `Organization` on every page lists San Diego County and the United States as the area served.
- Both pages are linked from the footer of every page ("San Diego County"), and from the homepage, `/services`, `/contractor-seo`, `/seo-for-flooring-companies` and the Top Tier project. A page that carries the question flow must be listed in `RETURN_TO` in `api/review-request.js`; `scripts/test_api.js` fails if one is missing.
- The searches came from Google Ads keyword estimates and Google's results on November 24, 2026. "SEO agency San Diego" and "SEO company San Diego" had about 1,900 searches a month; the contractor searches had too few to measure. The map results for these searches go to businesses with a Google Business Profile near the searcher, which these pages cannot change: that needs a profile, reviews and links from other sites.

## Artwork and charts

- `node scripts/build_art.js` draws the contour-line ("topographic") artwork from a seeded noise field, in ink, paper and brand red: `assets/art-topo-dark-*.webp` and `art-topo-light-1400.webp`. It also renders the share card used for link previews, `assets/og-burnworth-1200.jpg`. It needs Playwright with Chromium at build time only.
- The four drawings on the homepage service cards are inline SVG, styled by the `.a-*` rules in `styles.css`. Keep all four in that one style.
- The small charts are HTML and CSS: `.meter` for one share of a whole, `.dots` for "1 in 100", `.milestones` for dated points on a line, and `.figure` for a headline number. Every number shown is one already stated in the page text with its source. A number that is the whole story is shown as a number, not forced into a chart.

## Analytics

`public/analytics.js` loads on every page. It sends to GA4 directly through `GA4_ID` (`G-WJL1CE5Z1Z`), loads Tag Manager through `GTM_ID` (`GTM-M6S6RWJP`) and pushes every event to the `dataLayer` as `{event: name, ...params}` for GTM Custom Event triggers. With both set, do not add a GA4 Google tag for the same ID inside GTM, or page views double count.

**Meta Pixel (Instagram and Facebook ads).** Put the pixel ID in `META_PIXEL_ID` at the top of `analytics.js`. It is empty until then, and no pixel was present on the site before this change, so Meta could not see which ads produced leads. With the ID set, every page sends `PageView` and a sent request sends `Lead`: choose "Leads" as the campaign's conversion so Meta optimises for requests rather than clicks. Starting the questions sends the custom event `FlowStart` and reaching the last step sends `FlowContact`, which are useful as conversions while lead volume is low. The pixel is not loaded for a visitor whose browser sends Global Privacy Control or Do Not Track; the privacy policy says so. Do not add the same pixel inside Tag Manager as well.

Events:

- Clicks: `click_to_call`, `email_click`, `book_call_click`, `free_audit_click` (any link that opens the question flow) and `cta_click`, each with `link_url`, `cta_text` and `cta_location`.
- Question flow: `flow_view`, `flow_start`, `flow_step` (with `step`, `question` and `answer`), `flow_contact_view`, `review_form_start`, `generate_lead` (with `form: options_flow`, `placement` (`hero`, `landing`, `service` or `modal`), `interest`, `lead_source` and `site`), `flow_dismiss` and `flow_error`. In GA4, a funnel of `flow_view` → `flow_start` → `flow_contact_view` → `generate_lead` shows where visitors stop.
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

How we describe the business: Burnworth Co. is a small studio focused on consistent client results. Say "small studio" and never give a head count ("two-person studio", "two founders"): the owners do not want the size of the team spelled out. Naming Brandon and Zenande and what each of them does is fine. Use "studio", not "agency". "Agency" appears only where it is the visitor's word (the question "Are you a GEO, AEO or AI SEO agency?" is there because people search for it) or a comparison ("the work an agency sells"). "Consistent client results" is what we focus on, not a promise: keep each result labelled as one client's, reported by them.

The line we lead with: "Work with a company that owns the results. A small studio where the founders make every plan, to keep results consistent. No handoffs." It is on the homepage (the tile with the founders' faces), on `/start` (the "Who does the work" tile), above the proof on `/ai-search-optimization` and `/contractor-seo-san-diego`, and in the first heading of `/san-diego-seo`. Keep the copies in step. Write "to keep results consistent", never "ensure" or "guarantee": owning the results means answering for them, not promising them.
