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

const render = {
  head,
  header,
  footer,
  scripts,
  flow: (route, variant) => flow.render({placement: variant || 'hero', page: route}),
};

const REGION = /<!-- (head|header|footer|scripts|flow)(?::([a-z]+))? -->[\s\S]*?<!-- \/\1 -->/g;

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
