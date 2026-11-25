/*
  POST /api/review-request - free audit requests.

  Sent by the "Explore my options" question flow (public/flow.js) on the homepage,
  on /start, on the AI search service page and in the modal on every page. Older forms that post only name, email,
  website and a message are still accepted.

  Each valid request goes to two places:
    1. An email through Resend (https://resend.com).
    2. A lead in Burnworth OS, the studio's CRM; see api/_os-intake.js.
  The visitor sees "received" when either one succeeds, so a problem with one
  channel never tells a real lead their request failed. Only when both fail does
  the form show the email and phone fallback.

  Vercel environment variables:
    RESEND_API_KEY    without it no email is sent (the lead is still filed in Burnworth OS).
    REVIEW_TO         optional, defaults to Brandon@burnworthco.com.
    REVIEW_FROM       optional. Until burnworthco.com is verified in Resend, the default
                      onboarding@resend.dev sender only delivers to the Resend account's own email.
    OS_INTAKE_URL, OS_INTAKE_SECRET   see api/_os-intake.js.

  Answers JSON when the request asks for it (the page's script does). A plain form
  post, with JavaScript off, is redirected to /thanks, or back to the form on an error.
*/
const fileInOs = require('./_os-intake.js');

const TO = process.env.REVIEW_TO || 'Brandon@burnworthco.com';
const FROM = process.env.REVIEW_FROM || 'Burnworth Co <onboarding@resend.dev>';

const line = (value, max) => String(value ?? '').replace(/[\r\n\t]+/g, ' ').trim().slice(0, max);
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

// Answers from the question flow. The keys are the values in FLOW in
// public/flow.js; anything else is dropped. scripts/sync_partials.js --check
// fails if the two lists drift apart.
const ANSWERS = {
  interest: {
    label: 'Wants help with',
    values: {website: 'A new or better website', seo: 'Showing up on Google and Maps', ads: 'Paid ads', unsure: 'Not sure yet'},
  },
  lead_source: {
    label: 'Leads come from',
    values: {
      referrals: 'Word of mouth and referrals',
      google: 'Google search or Maps',
      paid_ads: 'Paid ads',
      social: 'Instagram or Facebook',
      lead_sites: 'Lead sites (Angi, Thumbtack, Yelp)',
      none: 'Not many leads yet',
    },
  },
  site: {
    label: 'Website today',
    values: {working: 'Has one that brings in work', weak: 'Has one that does not bring in much', none: 'No website yet'},
  },
};
const PLACEMENTS = {hero: 'homepage', landing: 'landing page', service: 'service page', modal: 'pop-up'};
// Pages the plain (no JavaScript) form may send a visitor back to.
const RETURN_TO = ['/', '/start', '/ai-search-optimization'];

async function sendEmail({subject, text, replyTo}) {
  if (!process.env.RESEND_API_KEY) {
    console.warn('RESEND_API_KEY is not set: no email sent for this request');
    return false;
  }
  try {
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json'},
      body: JSON.stringify({from: FROM, to: [TO], reply_to: replyTo, subject, text}),
    });
    if (!r.ok) {
      console.error('Resend rejected the email', r.status, await r.text());
      return false;
    }
    return true;
  } catch (err) {
    console.error('Resend request failed', err);
    return false;
  }
}

const handler = async (req, res) => {
  const wantsJson = String(req.headers.accept || '').includes('application/json');
  let returnTo = '/';
  const reply = (status, body) => {
    if (wantsJson) return res.status(status).json(body);
    res.statusCode = 303;
    res.setHeader('Location', body.ok ? '/thanks' : `${returnTo}?review=error#send-error`);
    return res.end();
  };

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ok: false, error: 'method_not_allowed'});
  }

  const body = typeof req.body === 'string' ? Object.fromEntries(new URLSearchParams(req.body)) : req.body || {};
  // The page the form was on: a path on this site, nothing else.
  const page = /^\/[\w\-./]*$/.test(line(body.page, 200)) ? line(body.page, 200) : '';
  if (RETURN_TO.includes(page)) returnTo = page;

  // Spam: a hidden field people never fill, and a minimum time on the page.
  // Both answer "ok" so bots learn nothing.
  if (line(body.company, 200)) return reply(200, {ok: true});
  const started = Number(body.started);
  if (started && Date.now() - started < 2500) return reply(200, {ok: true});

  const name = line(body.name, 100);
  const email = line(body.email, 200);
  const phone = line(body.phone, 40);
  let website = line(body.website, 300);
  const message = String(body.message ?? '').trim().slice(0, 2000);
  if (website && !/^https?:\/\//i.test(website)) website = 'https://' + website;

  const missing = [!name && 'name', !EMAIL.test(email) && 'email'].filter(Boolean);
  if (missing.length) return reply(400, {ok: false, error: 'invalid', fields: missing});

  // Flow answers, as [label, text] pairs in question order.
  const answers = Object.entries(ANSWERS)
    .map(([key, question]) => [question.label, question.values[line(body[key], 40)] || ''])
    .filter(([, text]) => text);
  const fromFlow = line(body.source, 40) === 'flow';
  const placement = PLACEMENTS[line(body.placement, 20)] || '';
  const form = fromFlow ? `Question flow${placement ? ` (${placement})` : ''}` : line(body.source, 40) === 'popup' ? 'Popup' : 'Homepage form';

  // Where the visit came from, when the page could tell.
  const campaign = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term']
    .map((key) => line(body[key], 120)).filter(Boolean).join(' / ');
  const adClick = {meta: 'Meta ad (Instagram or Facebook)', google: 'Google ad'}[line(body.ad_click, 20)] || '';
  const visit = [
    ['Campaign', campaign],
    ['Ad click', adClick],
    ['Referrer', line(body.referrer, 120)],
    ['Landed on', /^\/[\w\-./]*$/.test(line(body.landing, 200)) ? line(body.landing, 200) : ''],
  ].filter(([, text]) => text);

  // File the lead in the CRM while the email is sent; the reply waits for both.
  const summary = answers.map(([label, text]) => `${label}: ${text}.`).join(' ');
  const filing = fileInOs({
    form: 'audit',
    name,
    email,
    phone,
    website,
    message: [summary, message].filter(Boolean).join('\n\n').slice(0, 2000),
    page: page || '/',
    details: Object.fromEntries([['Form', form], ...answers, ...visit].map(([label, text]) => [label, text.slice(0, 300)])),
  });

  const pad = (label) => `${label}:`.padEnd(18);
  const text = [
    'New free audit request from burnworthco.com',
    '',
    `${pad('Name')}${name}`,
    `${pad('Email')}${email}`,
    `${pad('Phone')}${phone || '-'}`,
    `${pad('Website')}${website || '-'}`,
    ...(answers.length ? ['', ...answers.map(([label, value]) => `${pad(label)}${value}`)] : []),
    '',
    `${pad('Form')}${form}${page ? ` on ${page}` : ''}`,
    ...visit.map(([label, value]) => `${pad(label)}${value}`),
    ...(message ? ['', 'Message:', message] : []),
  ].join('\n');

  const [emailed, filed] = await Promise.all([
    sendEmail({subject: `Free audit request: ${name}${website ? ` (${website})` : ''}`, text, replyTo: email}),
    filing,
  ]);
  if (emailed || filed) return reply(200, {ok: true});
  const configured = process.env.RESEND_API_KEY || (process.env.OS_INTAKE_URL && process.env.OS_INTAKE_SECRET);
  return configured ? reply(502, {ok: false, error: 'send_failed'}) : reply(503, {ok: false, error: 'not_configured'});
};

module.exports = handler;
// Read by scripts/sync_partials.js to check the lists against public/flow.js.
module.exports.ANSWERS = ANSWERS;
