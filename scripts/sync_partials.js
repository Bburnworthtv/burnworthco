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
    <!-- flow:service -->    ... <!-- /flow -->       the flow on a service page, opening on
                                                      the second question (first answer: SEO)
    <!-- builds -->          ... <!-- /builds -->     the row of sites we built, to swipe through
    <!-- builds:column -->   ... <!-- /builds -->     the same row inside a narrow text column
    <!-- builds:local -->    ... <!-- /builds -->     only the sites built for San Diego County clients
    <!-- area -->            ... <!-- /area -->       a map of San Diego County and the places in it,
                                                      on the two San Diego pages
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
// The two pages about working in San Diego County.
const SAN_DIEGO = '/san-diego-seo';
const SAN_DIEGO_CONTRACTORS = '/contractor-seo-san-diego';
const YEAR = 2026;

// "Burnworth Co." outlined from Lora 600; see docs/brand-mark.md.
const WORDMARK_PATH = fs.readFileSync(path.join(__dirname, 'wordmark-path.txt'), 'utf8').trim();
const wordmark = (label) => `<a class="wordmark" href="/"${label ? ' aria-label="Burnworth Co. home"' : ''}><svg class="wordmark-logo" viewBox="0 0 670.5 77" aria-hidden="true" focusable="false"><path fill="currentColor" d="${WORDMARK_PATH}"/><circle fill="#e2462f" cx="663.3" cy="68.3" r="7.2"/></svg><span class="wordmark-text">Burnworth Co.</span></a>`;

// Menu links, and the pages that sit under each one.
const NAV = [
  {href: '/web-development', label: 'Websites', section: []},
  {href: '/contractor-seo', label: 'Contractors', section: ['/seo-for-flooring-companies', '/contractor-seo-san-diego']},
  {href: '/services', label: 'Services', section: ['/san-diego-seo', '/ai-search-optimization', '/search-visibility-audit', '/generative-engine-optimization']},
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
        <p class="footer-place">Oceanside, California. Working with clients across San Diego County and the United States.</p>
      </div>
      <nav class="footer-col" aria-label="Services">
        <p class="footer-title">Services</p>
        <a href="/web-development">Websites</a><a href="/contractor-seo">Contractor SEO</a><a href="/seo-for-flooring-companies">Flooring SEO</a><a href="/ai-search-optimization">AI search (GEO and AEO)</a><a href="/search-visibility-audit">Search and AI audit</a><a href="/services">All services</a>
      </nav>
      <div class="footer-stack">
        <nav class="footer-col" aria-label="Company">
          <p class="footer-title">Company</p>
          <a href="/work">Work</a><a href="/about">About</a><a href="/research">Research</a><a href="/start" data-flow-open>Free audit</a>
        </nav>
        <nav class="footer-col" aria-label="San Diego County">
          <p class="footer-title">San Diego County</p>
          <a href="${SAN_DIEGO}">San Diego SEO</a><a href="${SAN_DIEGO_CONTRACTORS}">Contractor SEO in San Diego</a>
        </nav>
      </div>
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
const AI_SEARCH = '/ai-search-optimization';
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
    where: ['Answer boxes on Google', 'People also ask', 'Voice and AI assistants'],
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
    ? `<a class="text-link" href="${AI_SEARCH}">GEO and AEO services${arrow}</a>`
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
//   county  true for a client in San Diego County; those are the row on the two San Diego pages
const BUILDS = [
  {
    slug: 'top-tier-custom-floors',
    name: 'Top Tier Custom Floors',
    look: 'Black and gold',
    text: 'Owner-operated flooring contractor in San Diego County.',
    county: true,
    url: 'https://www.toptierfloors.com/',
    desk: 'Top Tier Custom Floors homepage on a laptop: the heading Custom Flooring Installation in San Diego County in white and gold on black, beside two photos of a wood staircase.',
    phone: 'The same Top Tier Custom Floors homepage on a phone, with the call button in view.',
  },
  {
    slug: 'pacific-earthworks',
    name: 'Pacific Earthworks',
    look: 'Bold and industrial',
    text: 'Grading and excavation contractor in San Diego County.',
    county: true,
    desk: 'Pacific Earthworks homepage on a laptop: a wheel loader on a graded site under the heading Grading and Excavation, San Diego County.',
    phone: 'The same Pacific Earthworks homepage on a phone, with the estimate button in view.',
  },
  {
    slug: 'model-home',
    name: 'Model Home, Inc.',
    look: 'Warm showroom',
    text: 'Flooring contractor and cabinet showroom in San Marcos.',
    county: true,
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
// narrower, so the browser asks for smaller images. "local" is only the San Diego
// County clients, three across on a wide screen.
function builds(route, variant) {
  const column = variant === 'column';
  const local = variant === 'local';
  const sites = local ? BUILDS.filter((site) => site.county) : BUILDS;
  const deskSizes = column ? '(max-width: 700px) 70vw, 520px' : local ? '(max-width: 700px) 70vw, (max-width: 1099px) 50vw, 330px' : '(max-width: 700px) 70vw, (max-width: 1260px) 50vw, 640px';
  const phoneSizes = column ? '(max-width: 700px) 17vw, 125px' : local ? '(max-width: 700px) 17vw, (max-width: 1099px) 12vw, 80px' : '(max-width: 700px) 17vw, (max-width: 1260px) 12vw, 150px';
  const what = local ? 'Websites we designed and built for clients in San Diego County.' : 'Websites we designed and built.';
  const items = sites.map((site) => {
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
  return `<div class="reel${column ? ' reel-column' : ''}${local ? ' reel-local' : ''}" data-reel>
    <ul class="reel-track" id="builds-track" data-reel-track tabindex="0" aria-label="${what} ${sites.length} sites; scroll sideways to see them all.">
      ${items}
    </ul>
    <div class="reel-controls">
      <p class="reel-count" aria-hidden="true"><span data-reel-now>1</span> / ${sites.length}</p>
      <div class="reel-bar" aria-hidden="true"><span data-reel-thumb></span></div>
      <button class="reel-btn" type="button" data-reel-prev aria-controls="builds-track" disabled><span class="sr">Previous website</span><span class="icon-right" aria-hidden="true"></span></button>
      <button class="reel-btn" type="button" data-reel-next aria-controls="builds-track"><span class="sr">Next website</span><span class="icon-right" aria-hidden="true"></span></button>
    </div>
  </div>`;
}

// San Diego County, drawn from real coordinates: the coast, where we are, where
// our clients are and the cities around them. Positions come from latitude and
// longitude, so a place added here lands in the right spot.
//   kind  home (us), client, city (labelled) or dot (unlabelled)
//   side  which side of the dot the label sits on: l is out over the ocean
//   dy    nudges a label up or down where two would touch
const MAP = {w: 460, h: 500, west: -117.62, north: 33.45, scale: 537.6};
const point = ([lat, lon]) => [
  Math.round((lon - MAP.west) * Math.cos(33 * Math.PI / 180) * MAP.scale * 10) / 10,
  Math.round((MAP.north - lat) * MAP.scale * 10) / 10,
];
// North to south, from the Orange County line to the border.
const COAST = [
  [33.45, -117.645], [33.386, -117.578], [33.31, -117.49], [33.25, -117.435], [33.196, -117.388],
  [33.158, -117.357], [33.115, -117.33], [33.075, -117.312], [33.037, -117.298], [32.99, -117.279],
  [32.959, -117.271], [32.92, -117.262], [32.889, -117.256], [32.866, -117.258], [32.851, -117.276],
  [32.838, -117.284], [32.815, -117.276], [32.797, -117.26], [32.772, -117.255], [32.752, -117.257],
  [32.72, -117.26], [32.69, -117.252], [32.666, -117.244], [32.672, -117.226], [32.692, -117.203],
  [32.683, -117.19], [32.65, -117.155], [32.6, -117.135], [32.578, -117.134], [32.534, -117.124],
];
const PLACES = [
  {name: 'Oceanside', at: [33.1959, -117.3795], kind: 'home', side: 'l', sub: 'Burnworth Co.'},
  {name: 'Valley Center', at: [33.2184, -117.0342], kind: 'client', side: 'r'},
  {name: 'San Marcos', at: [33.1434, -117.1661], kind: 'client', side: 'r', dy: -6},
  {name: 'Fallbrook', at: [33.3764, -117.2511], kind: 'city', side: 'r'},
  {name: 'Vista', at: [33.2, -117.2425], kind: 'city', side: 'r'},
  {name: 'Carlsbad', at: [33.1581, -117.3506], kind: 'city', side: 'r', dy: 9},
  {name: 'Escondido', at: [33.1192, -117.0864], kind: 'city', side: 'r', dy: 7},
  {name: 'Encinitas', at: [33.037, -117.292], kind: 'city', side: 'l'},
  {name: 'Poway', at: [32.9628, -117.0359], kind: 'city', side: 'r'},
  {name: 'La Jolla', at: [32.8328, -117.2713], kind: 'city', side: 'l'},
  {name: 'El Cajon', at: [32.7948, -116.9625], kind: 'city', side: 'r'},
  {name: 'San Diego', at: [32.7157, -117.1611], kind: 'city', side: 'r', strong: true},
  {name: 'Chula Vista', at: [32.6401, -117.0842], kind: 'city', side: 'r'},
  {name: 'Solana Beach', at: [32.9912, -117.2711], kind: 'dot'},
  {name: 'Del Mar', at: [32.9595, -117.2653], kind: 'dot'},
  {name: 'Rancho Bernardo', at: [33.0186, -117.061], kind: 'dot'},
  {name: 'Carmel Valley', at: [32.937, -117.213], kind: 'dot'},
  {name: 'Ramona', at: [33.0417, -116.8681], kind: 'dot'},
  {name: 'Pacific Beach', at: [32.7978, -117.24], kind: 'dot'},
  {name: 'Santee', at: [32.8384, -116.9739], kind: 'dot'},
  {name: 'Lakeside', at: [32.8573, -116.9222], kind: 'dot'},
  {name: 'La Mesa', at: [32.7678, -117.0231], kind: 'dot'},
  {name: 'Coronado', at: [32.6859, -117.1831], kind: 'dot'},
  {name: 'National City', at: [32.6781, -117.0992], kind: 'dot'},
  {name: 'Imperial Beach', at: [32.5839, -117.1131], kind: 'dot'},
];
// The same places as a list, by the names people use for each part of the county.
const REGIONS = [
  ['North County coast', ['Oceanside', 'Carlsbad', 'Encinitas', 'Solana Beach', 'Del Mar']],
  ['North County inland', ['Vista', 'San Marcos', 'Escondido', 'Poway', 'Valley Center', 'Fallbrook']],
  ['City of San Diego', ['Downtown', 'La Jolla', 'Pacific Beach', 'North Park', 'Kearny Mesa', 'Carmel Valley', 'Rancho Bernardo']],
  ['East County', ['El Cajon', 'La Mesa', 'Santee', 'Lakeside']],
  ['South Bay', ['Chula Vista', 'National City', 'Imperial Beach', 'Coronado']],
];

// A smooth line through the points (Catmull-Rom, written as cubic curves).
function smooth(points) {
  const at = (i) => points[Math.max(0, Math.min(points.length - 1, i))];
  const n = (value) => Math.round(value * 10) / 10;
  let d = `M${points[0][0]} ${points[0][1]}`;
  for (let i = 0; i < points.length - 1; i++) {
    const [p0, p1, p2, p3] = [at(i - 1), at(i), at(i + 1), at(i + 2)];
    d += `C${n(p1[0] + (p2[0] - p0[0]) / 6)} ${n(p1[1] + (p2[1] - p0[1]) / 6)} ${n(p2[0] - (p3[0] - p1[0]) / 6)} ${n(p2[1] - (p3[1] - p1[1]) / 6)} ${p2[0]} ${p2[1]}`;
  }
  return d;
}

function area(route) {
  const who = route === SAN_DIEGO_CONTRACTORS ? 'contractors' : 'service businesses';
  const coast = smooth(COAST.map(point));
  // The drawing's background is the land; the ocean is a shape that runs on past
  // the left edge. A map shown wider than it is tall then has land to the east and
  // ocean to the west, and nothing reaches past the right edge of the page.
  const start = point(COAST[0]);
  const end = point(COAST[COAST.length - 1]);
  const marks = PLACES.map((place) => {
    const [x, y] = point(place.at);
    if (place.kind === 'dot') return `<circle class="map-dot" cx="${x}" cy="${y}" r="2.2"/>`;
    const left = place.side === 'l';
    const tx = left ? x - 11 : x + 11;
    const anchor = left ? ' text-anchor="end"' : '';
    const label = `<text class="map-label${place.kind === 'city' && !place.strong ? '' : ' is-strong'}" x="${tx}" y="${Math.round((y + 4.5 + (place.dy || 0)) * 10) / 10}"${anchor}>${place.name}</text>`;
    if (place.kind === 'home') {
      return `<circle class="map-ring" cx="${x}" cy="${y}" r="7"/><circle class="map-home" cx="${x}" cy="${y}" r="6"/>${label}<text class="map-sub" x="${tx}" y="${y + 20.5}"${anchor}>${place.sub}</text>`;
    }
    if (place.kind === 'client') return `<circle class="map-halo" cx="${x}" cy="${y}" r="10"/><circle class="map-client" cx="${x}" cy="${y}" r="5"/>${label}`;
    return `<circle class="map-city" cx="${x}" cy="${y}" r="3.2"/>${label}`;
  }).join('');
  const regions = REGIONS.map(([name, places]) => `<div><dt>${name}</dt><dd><ul>${places.map((place) => `<li>${place}</li>`).join('')}</ul></dd></div>`).join('\n        ');
  return `<div class="area" data-reveal>
    <figure class="area-map">
      <svg viewBox="0 0 ${MAP.w} ${MAP.h}" role="img" aria-label="Map of San Diego County. Burnworth Co. is marked in Oceanside, on the north coast. Clients are marked in Valley Center and San Marcos. Other places shown include Carlsbad, Escondido, La Jolla, San Diego, El Cajon and Chula Vista." focusable="false">
        <path class="map-water" d="${coast}V${MAP.h + 1000}H-3000V-1000H${start[0]}Z"/>
        <path class="map-coast" d="${coast}"/>
        <text class="map-sea" x="22" y="${end[1] - 46}">Pacific Ocean</text>
        ${marks}
      </svg>
      <figcaption class="area-key"><span class="key-home">Burnworth Co., Oceanside</span><span class="key-client">Clients in Valley Center and San Marcos</span></figcaption>
    </figure>
    <div class="area-places">
      <h3>Anywhere in <em>San Diego County.</em></h3>
      <p>Our desk is in Oceanside. Our clients include Top Tier Custom Floors in Valley Center and Model Home, Inc. in San Marcos. We take on ${who} in any of these places, and in the rest of the county.</p>
      <dl class="area-list">
        ${regions}
      </dl>
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
  area,
  // On a service page the first question is already answered: the page is about
  // search. There, and on the ad landing page (where the link can answer it with
  // ?v=), a few inline lines from flow.js open the form on the second question
  // before the page is painted, so nothing moves when flow.js loads.
  flow: (route, variant) => flow.render({placement: variant || 'hero', page: route, interest: variant === 'service' ? 'seo' : ''})
    + (variant === 'service' || variant === 'landing' ? `\n<script>(${flow.early.toString().replace(/\n\s*/g, ' ')})(document.currentScript.previousElementSibling)</script>` : ''),
};

const REGION = /<!-- (head|header|footer|scripts|flow|builds|terms|area)(?::([a-z]+))? -->[\s\S]*?<!-- \/\1 -->/g;

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
