/*
  POST /api/estimate-request - website build estimate requests from /web-development#estimate.

  Each valid request is emailed through Resend and filed as a lead in Burnworth
  OS, like api/review-request.js. The visitor sees "received" only when the email
  was accepted; if it was not, the form shows the email and phone fallback. A
  request that trips the spam check is still emailed, marked "Possible spam". The
  rules, and the environment variables, are in api/_deliver.js and api/_os-intake.js.

  Answers JSON when the request asks for it (the page's script does); otherwise it
  redirects back to the form, so it still works without JavaScript.
*/
const {deliver, spamSigns} = require('./_deliver.js');

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

  // Signs of a bot: the hidden field filled in, or sent within 4 seconds.
  // They mark the email; they never stop it. See api/_deliver.js.
  const signs = spamSigns(body, 4000);

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

  const lead = {
    form: 'estimate',
    name,
    email,
    phone,
    business,
    website,
    message: details.slice(0, 2000),
    page: '/web-development',
    details: {
      Project: project,
      Pages: pages,
      Timeline: timeline,
      Budget: budget,
      Features: features.join(', ').slice(0, 500),
    },
  };
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

  // The email and the lead go out together; the reply waits for both.
  const [status, answer] = await deliver({
    kind: 'website estimate request',
    subject: `Website estimate request: ${business || name} (${project})`,
    text,
    replyTo: email,
    signs,
    lead,
  });
  return reply(status, answer);
};
