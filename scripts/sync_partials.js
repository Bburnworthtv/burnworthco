#!/usr/bin/env node
/*
  Writes the parts every page shares into the HTML files in public/: the header,
  the footer, the shared <head> lines, the shared scripts, and the question flow.
  Pages are still plain HTML that deploy as they are; this only keeps the copies
  identical, so a link added to the footer cannot be missed on one page.

    node scripts/sync_partials.js           rewrite the pages
    node scripts/sync_partials.js --check   exit 1 if any page is out of date

  A region is whatever sits between a pair of comments. Edit the templates below,
  never the text between the comments:

    <!-- head -->            ... <!-- /head -->       script flag, font preloads, stylesheet
    <!-- header -->          ... <!-- /header -->     site header and menu
    <!-- header:minimal -->  ... <!-- /header -->     logo and phone only (landing pages)
    <!-- footer -->          ... <!-- /footer -->
    <!-- footer:minimal -->  ... <!-- /footer -->
    <!-- flow:hero -->       ... <!-- /flow -->       the question flow, from public/flow.js
    <!-- flow:landing -->    ... <!-- /flow -->
    <!-- builds -->          ... <!-- /builds -->     the row of sites we built, to swipe through
    <!-- builds:column -->   ... <!-- /builds -->     the same row inside a narrow text column
    <!-- terms -->           ... <!-- /terms -->      what SEO, AEO and GEO mean, and that all three
                                                      are in every SEO package
    <!-- scripts -->         ... <!-- /scripts -->

  --check also confirms the answers accepted by api/review-request.js match the
  questions in public/flow.js.
*/
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const PUBLIC = path.join(ROOT, 'public');
const flow = require(path.join(PUBLIC, 'flow.js'));
const {ANSWERS} = require(path.join(ROOT, 'api', 'review-request.js'));

const EMAIL = 'Brandon@burnworthco.com';
const PHONE_HREF = 'tel:+12088812382';
const PHONE_TEXT = '(208) 881-2382';
const BOOKING = 'https://calendly.com/bburnworthtv/30min';
const INSTAGRAM = 'https://www.instagram.com/burnworthco/';
const YEAR = 2026;

// "Burnworth Co." outlined from Lora 600; see docs/brand-mark.md.
const WORDMARK_PATH = fs.readFileSync(path.join(__dirname, 'wordmark-path.txt'), 'utf8').trim();
const wordmark = (label) => `<a class="wordmark" href="/"${label ? ' aria-label="Burnworth Co. home"' : ''}><svg class="wordmark-logo" viewBox="0 0 670.5 77" aria-hidden="true" focusable="false"><path fill="currentColor" d="${WORDMARK_PATH}"/><circle fill="#e2462f" cx="663.3" cy="68.3" r="7.2"/></svg><span class="wordmark-text">Burnworth Co.</span></a>`;

// Menu links, and the pages that sit under each one.
const NAV = [
  {href: '/web-development', label: 'Websites', section: []},
  {href: '/contractor-seo', label: 'Contractors', section: ['/seo-for-flooring-companies']},
  {href: '/services', label: 'Services', section: ['/search-visibility-audit', '/generative-engine-optimization']},
  {href: '/work', label: 'Work', section: ['/work-top-tier-custom-floors', '/work-los-angeles-production-company']},
  {href: '/research', label: 'Research', section: ['/research/state-of-search-2026', '/research/methodology', '/ai-visibility-business-results']},
  {href: '/about', label: 'About', section: []},
];

const arrow = '<span class="icon-right" aria-hidden="true"></span>';
const arrowOut = '<span class="icon-ne" aria-hidden="true"></span>';

function header(route, variant) {
  if (variant === 'minimal') {
    return `<header class="site-header site-header-minimal" data-header>
    ${wordmark(true)}
    <a class="header-call" href="${PHONE_HREF}">${PHONE_TEXT}</a>
  </header>`;
  }
  const links = NAV.map((item) => {
    const state = item.href === route ? ' aria-current="page"' : item.section.includes(route) ? ' class="is-section"' : '';
    return `<a href="${item.href}"${state}>${item.label}</a>`;
  }).join('');
  return `<header class="site-header" data-header>
    ${wordmark(true)}
    <nav class="site-nav" id="site-nav" aria-label="Primary navigation">
      ${links}
      <div class="nav-extra">
        <a class="button primary" href="/start" data-flow-open>Explore my options${arrow}</a>
        <a class="button ghost" href="${BOOKING}">Book a 30-minute call${arrowOut}</a>
        <p class="nav-contact"><a href="${PHONE_HREF}">${PHONE_TEXT}</a><a href="mailto:${EMAIL}">${EMAIL}</a></p>
      </div>
    </nav>
    <div class="header-ctas">
      <a class="header-call" href="${BOOKING}">Book a call${arrowOut}</a>
      <a class="button primary header-cta" href="/start" data-flow-open><span class="cta-long">Explore my options</span><span class="cta-short">Free audit</span>${arrow}</a>
      <button class="menu-toggle" type="button" aria-expanded="false" aria-controls="site-nav"><span class="sr">Menu</span><span class="menu-bars" aria-hidden="true"><i></i><i></i></span></button>
    </div>
  </header>`;
}

function footer(route, variant) {
  const legal = `<div class="footer-legal"><small>© ${YEAR} Burnworth Co.</small><nav aria-label="Legal"><a href="/privacy">Privacy</a><a href="/terms">Terms</a><a href="/accessibility">Accessibility</a></nav></div>`;
  if (variant === 'minimal') {
    return `<footer class="site-footer site-footer-minimal">
    <p class="footer-line"><a href="/">burnworthco.com</a><a href="${PHONE_HREF}">${PHONE_TEXT}</a><a href="mailto:${EMAIL}">${EMAIL}</a></p>
    ${legal}
  </footer>`;
  }
  return `<footer class="site-footer">
    <div class="footer-main">
      <div class="footer-brand">
        ${wordmark(false)}
        <p>Founder-led websites, SEO and AI visibility for contractors and service businesses.</p>
        <p class="footer-place">Oceanside, California. Working with clients across the United States.</p>
      </div>
      <nav class="footer-col" aria-label="Services">
        <p class="footer-title">Services</p>
        <a href="/web-development">Websites</a><a href="/contractor-seo">Contractor SEO</a><a href="/seo-for-flooring-companies">Flooring SEO</a><a href="/search-visibility-audit">Search and AI audit</a><a href="/services">All services</a>
      </nav>
      <nav class="footer-col" aria-label="Company">
        <p class="footer-title">Company</p>
        <a href="/work">Work</a><a href="/about">About</a><a href="/research">Research</a><a href="/start" data-flow-open>Free audit</a>
      </nav>
      <div class="footer-col">
        <p class="footer-title">Contact</p>
        <a href="mailto:${EMAIL}">${EMAIL}</a><a href="${PHONE_HREF}">${PHONE_TEXT}</a><a href="${BOOKING}">Book a call</a><a href="${INSTAGRAM}" rel="me noopener">Instagram</a>
      </div>
    </div>
    ${legal}
  </footer>`;
}

// The class goes on <html> before the stylesheet loads, so the first paint already
// shows the stepped flow and the collapsed phone menu.
const head = () => `<script>document.documentElement.classList.add('js')</script>
  <link rel="preload" as="font" type="font/woff2" href="/assets/archivo-latin.woff2" crossorigin>
  <link rel="preload" as="font" type="font/woff2" href="/assets/accent-italic.woff2" crossorigin>
  <link rel="stylesheet" href="/styles.css">`;

// If flow.js cannot load, the class turns the flow back into a plain form.
const scripts = () => `<script src="/script.js" defer></script>
  <script src="/flow.js" defer onerror="document.documentElement.classList.add('flow-plain')"></script>`;

// What SEO, AEO and GEO mean, in one sentence each, and where each shows up.
// The block ends with the line that GEO and AEO are part of every SEO package:
// that is a promise about what we sell, so change it here and nowhere else.
const GUIDE = '/generative-engine-optimization';
const TERMS = [
  {
    abbr: 'SEO',
    name: 'Search engine optimization',
    text: 'Showing up when someone searches Google or Maps for the work you do.',
    where: ['Google', 'Google Maps', 'Bing'],
    icon: '<circle cx="11" cy="11" r="6.5"/><path d="m16 16 4.5 4.5"/>',
  },
  {
    abbr: 'AEO',
    name: 'Answer engine optimization',
    text: 'Being the answer when someone asks a full question instead of typing keywords.',
    where: ['Answer boxes on Google', 'People also ask', 'Voice assistants'],
    icon: '<path d="M5 5.5h14A1.5 1.5 0 0 1 20.5 7v8a1.5 1.5 0 0 1-1.5 1.5h-6.2L8.5 20v-3.5H5A1.5 1.5 0 0 1 3.5 15V7A1.5 1.5 0 0 1 5 5.5Z"/><path d="m9 11 2.2 2.2L15.2 9"/>',
  },
  {
    abbr: 'GEO',
    name: 'Generative engine optimization',
    text: 'Being named, and described correctly, when an AI tool writes the answer.',
    where: ['ChatGPT', 'Gemini', 'Perplexity', 'Google’s AI Overviews'],
    icon: '<path d="M11 4.5 12.7 9l4.5 1.7-4.5 1.7L11 17l-1.7-4.6-4.5-1.7L9.3 9Z"/><path d="m18.2 14.6.8 2 2 .8-2 .8-.8 2-.8-2-2-.8 2-.8Z"/>',
  },
];

function terms(route) {
  const items = TERMS.map((term) => `<div class="term">
        <dt><span class="term-ico" aria-hidden="true"><svg viewBox="0 0 24 24" focusable="false">${term.icon}</svg></span><span class="term-abbr">${term.abbr}</span><span class="term-name">${term.name}</span></dt>
        <dd><span class="term-text">${term.text}</span><ul class="term-where" aria-label="Where ${term.abbr} shows up">${term.where.map((place) => `<li>${place}</li>`).join('')}</ul></dd>
      </div>`).join('\n      ');
  const more = route === GUIDE
    ? `<a class="text-link" href="/contractor-seo#pricing">SEO price and terms${arrow}</a>`
    : `<a class="text-link" href="${GUIDE}">How GEO and AEO work${arrow}</a>`;
  return `<div class="terms">
    <dl class="terms-list">
      ${items}
    </dl>
    <p class="terms-included"><span class="terms-tick" aria-hidden="true"></span><span><strong>GEO and AEO are included in every SEO package.</strong> One program covers all three. Neither is sold as an add-on.</span>${more}</p>
  </div>`;
}

// Sites we designed and built, in the order they are shown. To add one, save its
// screenshots as public/assets/<slug>-home-1600.webp, -home-960.webp, -home-1280.jpg
// (a 1280 x 800 window) and <slug>-phone-480.webp, -phone-300.webp, -phone-480.jpg
// (a 390 x 737 phone), add it here and run this script. Only sites we built.
//   look  two or three words for the visual style, shown above the name
//   text  who the client is, in their own words where possible
//   url   the live site; leave out until the site is on its own domain
const BUILDS = [
  {
    slug: 'top-tier-custom-floors',
    name: 'Top Tier Custom Floors',
    look: 'Black and gold',
    text: 'Owner-operated flooring contractor in San Diego County.',
    url: 'https://www.toptierfloors.com/',
    desk: 'Top Tier Custom Floors homepage on a laptop: the heading Custom Flooring Installation in San Diego County in white and gold on black, beside two photos of a wood staircase.',
    phone: 'The same Top Tier Custom Floors homepage on a phone, with the call button in view.',
  },
  {
    slug: 'pacific-earthworks',
    name: 'Pacific Earthworks',
    look: 'Bold and industrial',
    text: 'Grading and excavation contractor in San Diego County.',
    desk: 'Pacific Earthworks homepage on a laptop: a wheel loader on a graded site under the heading Grading and Excavation, San Diego County.',
    phone: 'The same Pacific Earthworks homepage on a phone, with the estimate button in view.',
  },
  {
    slug: 'model-home',
    name: 'Model Home, Inc.',
    look: 'Warm showroom',
    text: 'Flooring contractor and cabinet showroom in San Marcos.',
    url: 'https://www.modelhomeinc.com/',
    desk: 'Model Home homepage on a laptop: the heading Flooring Contractor and Cabinet Showroom in San Marcos, CA over a photo of a wood floor being laid.',
    phone: 'The same Model Home homepage on a phone, with the Get a Free Estimate button in view.',
  },
  {
    slug: 'fluid-pictures',
    name: 'Fluid Pictures',
    look: 'Dark and cinematic',
    text: 'Specialty camera rentals for live television and film in Los Angeles.',
    url: 'https://www.fluidpicturesinc.com/',
    desk: 'Fluid Pictures homepage on a laptop: the heading Trusted by Television’s Biggest Shows beside a photo of a camera tower on a stage lit in blue.',
    phone: 'The same Fluid Pictures homepage on a phone, with the heading and the stage photo in view.',
  },
  {
    slug: 'go-virtuality',
    name: 'Go Virtuality',
    look: 'Bright and video-led',
    text: 'Real estate photography, staging and 3D tours in Orange County.',
    status: 'Launching soon',
    desk: 'Go Virtuality homepage on a laptop: the heading Real Estate Media over a video of a bright dining room that opens onto a patio.',
    phone: 'The same Go Virtuality homepage on a phone, with the Order Now and Schedule a Shoot buttons in view.',
  },
];

// The row of builds. Each is a real screenshot in a browser window and a phone;
// the frames are CSS. "column" is the row inside a text column, where a card is
// narrower, so the browser asks for smaller images.
function builds(route, variant) {
  const column = variant === 'column';
  const deskSizes = column ? '(max-width: 700px) 70vw, 520px' : '(max-width: 700px) 70vw, (max-width: 1260px) 50vw, 640px';
  const phoneSizes = column ? '(max-width: 700px) 17vw, 125px' : '(max-width: 700px) 17vw, (max-width: 1260px) 12vw, 150px';
  const items = BUILDS.map((site) => {
    const a = `/assets/${site.slug}`;
    const action = site.url
      ? `<a class="stage-visit" href="${site.url}" target="_blank" rel="noopener" aria-label="Visit site: ${site.name} (opens in a new tab)"><span class="stage-visit-label">Visit site</span>${arrowOut}</a>`
      : site.status ? `<span class="stage-status">${site.status}</span>` : '';
    return `<li class="reel-item"><figure class="stage">
        <div class="stage-devices">
          <div class="browser"><div class="browser-bar" aria-hidden="true"><i></i><i></i><i></i><span>${site.name}</span></div><picture><source type="image/webp" srcset="${a}-home-960.webp 960w, ${a}-home-1600.webp 1600w" sizes="${deskSizes}"><img src="${a}-home-1280.jpg" width="1280" height="800" alt="${site.desk}" loading="lazy" decoding="async" draggable="false"></picture></div>
          <div class="phone"><picture><source type="image/webp" srcset="${a}-phone-300.webp 300w, ${a}-phone-480.webp 480w" sizes="${phoneSizes}"><img src="${a}-phone-480.jpg" width="480" height="907" alt="${site.phone}" loading="lazy" decoding="async" draggable="false"></picture></div>
        </div>
        <figcaption><span class="stage-look">${site.look}</span><strong>${site.name}</strong><span class="stage-text">${site.text}</span>${action}</figcaption>
      </figure></li>`;
  }).join('\n      ');
  return `<div class="reel${column ? ' reel-column' : ''}" data-reel>
    <ul class="reel-track" id="builds-track" data-reel-track tabindex="0" aria-label="Websites we designed and built. ${BUILDS.length} sites; scroll sideways to see them all.">
      ${items}
    </ul>
    <div class="reel-controls">
      <p class="reel-count" aria-hidden="true"><span data-reel-now>1</span> / ${BUILDS.length}</p>
      <div class="reel-bar" aria-hidden="true"><span data-reel-thumb></span></div>
      <button class="reel-btn" type="button" data-reel-prev aria-controls="builds-track" disabled><span class="sr">Previous website</span><span class="icon-right" aria-hidden="true"></span></button>
      <button class="reel-btn" type="button" data-reel-next aria-controls="builds-track"><span class="sr">Next website</span><span class="icon-right" aria-hidden="true"></span></button>
    </div>
  </div>`;
}

const render = {
  head,
  header,
  footer,
  scripts,
  builds,
  terms,
  flow: (route, variant) => flow.render({placement: variant || 'hero', page: route}),
};

const REGION = /<!-- (head|header|footer|scripts|flow|builds|terms)(?::([a-z]+))? -->[\s\S]*?<!-- \/\1 -->/g;

function pages(dir = PUBLIC) {
  return fs.readdirSync(dir, {withFileTypes: true}).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return pages(full);
    // Search Console verification files are not pages and must stay byte-exact.
    return entry.name.endsWith('.html') && !/^google[0-9a-f]+\.html$/.test(entry.name) ? [full] : [];
  });
}

const routeOf = (file) => {
  const rel = path.relative(PUBLIC, file).replace(/\\/g, '/').replace(/\.html$/, '');
  return rel === 'index' ? '/' : '/' + rel;
};

const check = process.argv.includes('--check');
const stale = [];
const problems = [];

for (const file of pages()) {
  const route = routeOf(file);
  const before = fs.readFileSync(file, 'utf8');
  const found = new Set();
  const after = before.replace(REGION, (match, name, variant) => {
    found.add(name);
    return `<!-- ${name}${variant ? ':' + variant : ''} -->\n  ${render[name](route, variant)}\n  <!-- /${name} -->`;
  });
  for (const name of ['head', 'header', 'footer', 'scripts']) {
    if (!found.has(name)) problems.push(`${path.relative(ROOT, file)}: no <!-- ${name} --> region`);
  }
  if (after !== before) {
    stale.push(path.relative(ROOT, file));
    if (!check) fs.writeFileSync(file, after);
  }
}

// The server only accepts the answers it knows; a new answer must be added in both places.
for (const step of flow.FLOW.steps) {
  const allowed = Object.keys((ANSWERS[step.key] || {values: {}}).values).sort().join(',');
  const asked = step.options.map((option) => option.v).sort().join(',');
  if (allowed !== asked) problems.push(`"${step.key}" answers differ: public/flow.js has [${asked}], api/review-request.js has [${allowed}]`);
}
for (const key of Object.keys(ANSWERS)) {
  if (!flow.FLOW.steps.some((step) => step.key === key)) problems.push(`api/review-request.js accepts "${key}", which public/flow.js no longer asks`);
}

if (problems.length) {
  console.error(problems.join('\n'));
  process.exit(1);
}
if (check && stale.length) {
  console.error(`Out of date, run "node scripts/sync_partials.js":\n  ${stale.join('\n  ')}`);
  process.exit(1);
}
console.log(check ? `PASS: shared parts are in step on ${pages().length} pages; flow answers match the API.` : stale.length ? `Updated ${stale.length} page(s):\n  ${stale.join('\n  ')}` : 'Nothing to update.');
