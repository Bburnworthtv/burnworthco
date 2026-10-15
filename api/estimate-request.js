/*
  POST /api/estimate-request - website build estimate requests from /web-development#estimate.

  Sends one plain-text email per request through Resend, with the same Vercel
  environment variables as api/review-request.js:
    RESEND_API_KEY  required. Without it the form answers 503 and shows the email/phone fallback.
    REVIEW_TO       optional, defaults to Brandon@burnworthco.com.
    REVIEW_FROM     optional verified sender.

  Answers JSON when the request asks for it (the page's script does); otherwise it
  redirects back to the form, so it still works without JavaScript.
*/
const TO = process.env.REVIEW_TO || 'Brandon@burnworthco.com';
const FROM = process.env.REVIEW_FROM || 'Burnworth Co <onboarding@resend.dev>';

const line = (value, max) => String(value ?? '').replace(/[\r\n\t]+/g, ' ').trim().slice(0, max);
const list = (value) => (Array.isArray(value) ? value : String(value ?? '').split(','))
  .map((v) => line(v, 80)).filter(Boolean).slice(0, 12);
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

// Only these answers are accepted for the choice fields; anything else is dropped.
const PROJECTS = ['New website', 'Redesign of an existing site', 'Landing or sales pages', 'Fixes to an existing site'];
const PAGES = ['1-5', '6-15', '16-30', '30+', 'Not sure'];
const TIMELINES = ['As soon as possible', 'Within 1-3 months', 'In 3-6 months', 'Flexible'];
const BUDGETS = ['$2,500-$3,500', '$5,000', '$10,000-$20,000', '$20,000+', 'Other', 'Not sure yet'];
const FEATURES = ['Contact or quote forms', 'Online booking or scheduling', 'Photo gallery or project portfolio',
  'Blog or news', 'Online payments or e-commerce', 'Multiple locations or service areas', 'Help writing the content'];
const pick = (value, allowed) => (allowed.includes(line(value, 80)) ? line(value, 80) : '');

const parse = (req) => {
  if (typeof req.body !== 'string') return req.body || {};
  const params = new URLSearchParams(req.body);
  const out = Object.fromEntries(params);
  out.features = params.getAll('features');
  return out;
};

module.exports = async (req, res) => {
  const wantsJson = String(req.headers.accept || '').includes('application/json');
  const reply = (status, body) => {
    if (wantsJson) return res.status(status).json(body);
    res.statusCode = 303;
    res.setHeader('Location', body.ok ? '/web-development?estimate=sent#estimate' : '/web-development?estimate=error#estimate');
    return res.end();
  };

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ok: false, error: 'method_not_allowed'});
  }

  const body = parse(req);

  // Spam: a hidden field people never fill, and a minimum time on the page.
  if (line(body.company, 200)) return reply(200, {ok: true});
  const started = Number(body.started);
  if (started && Date.now() - started < 4000) return reply(200, {ok: true});

  const name = line(body.name, 100);
  const email = line(body.email, 200);
  const phone = line(body.phone, 40);
  const business = line(body.business, 150);
  let website = line(body.website, 300);
  if (website && !/^https?:\/\//i.test(website) && /\./.test(website)) website = 'https://' + website;
  const project = pick(body.project, PROJECTS);
  const pages = pick(body.pages, PAGES);
  const timeline = pick(body.timeline, TIMELINES);
  // "Other" comes with a written-in amount; a written-in amount is kept even if
  // the visitor forgot to choose "Other".
  const budgetOther = line(body.budget_other, 100);
  let budget = pick(body.budget, BUDGETS);
  if (budgetOther && (budget === 'Other' || !budget)) budget = `Other: ${budgetOther}`;
  else if (budget === 'Other') budget = 'Other (not specified)';
  const features = list(body.features).filter((f) => FEATURES.includes(f));
  const details = String(body.details ?? '').trim().slice(0, 3000);

  const missing = [!name && 'name', !EMAIL.test(email) && 'email', !project && 'project'].filter(Boolean);
  if (missing.length) return reply(400, {ok: false, error: 'invalid', fields: missing});

  if (!process.env.RESEND_API_KEY) return reply(503, {ok: false, error: 'not_configured'});

  const text = [
    'New website build estimate request from burnworthco.com',
    '',
    `Name:      ${name}`,
    `Email:     ${email}`,
    `Phone:     ${phone || '-'}`,
    `Business:  ${business || '-'}`,
    `Website:   ${website || '-'}`,
    '',
    `Project:   ${project}`,
    `Pages:     ${pages || '-'}`,
    `Timeline:  ${timeline || '-'}`,
    `Budget:    ${budget || '-'}`,
    `Features:  ${features.length ? features.join(', ') : '-'}`,
    '',
    'Project details:',
    details || '-',
  ].join('\n');

  try {
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json'},
      body: JSON.stringify({
        from: FROM,
        to: [TO],
        reply_to: email,
        subject: `Website estimate request: ${business || name} (${project})`,
        text,
      }),
    });
    if (!r.ok) {
      console.error('Resend rejected the email', r.status, await r.text());
      return reply(502, {ok: false, error: 'send_failed'});
    }
  } catch (err) {
    console.error('Resend request failed', err);
    return reply(502, {ok: false, error: 'send_failed'});
  }
  return reply(200, {ok: true});
};
