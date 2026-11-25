#!/usr/bin/env node
/*
  Tests for the two form endpoints, with no network: fetch is replaced by a
  stand-in that plays Resend and Burnworth OS.

    node scripts/test_api.js

  Covers what a visitor sees for good and bad input, spam, each mix of the two
  delivery channels working or failing, and what is sent on to each channel.
*/
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const INTAKE = 'https://os.example/api/leads/intake';

let calls = [];
let fail = {resend: false, intake: false};
global.fetch = async (url, options) => {
  const target = String(url).includes('resend.com') ? 'resend' : 'intake';
  calls.push({target, headers: options.headers, body: JSON.parse(options.body)});
  if (fail[target] === 'throw') throw new Error('network down');
  return {ok: !fail[target], status: fail[target] ? 500 : 200, text: async () => 'failed', json: async () => ({})};
};
const quiet = () => {};
console.error = quiet;
console.warn = quiet;

function load(file, env) {
  for (const key of ['RESEND_API_KEY', 'OS_INTAKE_URL', 'OS_INTAKE_SECRET', 'REVIEW_TO', 'REVIEW_FROM']) delete process.env[key];
  Object.assign(process.env, env);
  for (const key of Object.keys(require.cache)) if (key.startsWith(path.join(ROOT, 'api'))) delete require.cache[key];
  return require(path.join(ROOT, 'api', file));
}
const BOTH = {RESEND_API_KEY: 'key', OS_INTAKE_URL: INTAKE, OS_INTAKE_SECRET: 'secret'};

async function post(handler, body, {json = true, method = 'POST', form = false} = {}) {
  calls = [];
  const out = {status: 200, headers: {}, body: null};
  const res = {
    statusCode: 200,
    status(code) { this.statusCode = code; return this; },
    json(value) { out.body = value; return this; },
    setHeader(name, value) { out.headers[name.toLowerCase()] = value; },
    end() {},
  };
  const req = {
    method,
    headers: {accept: json ? 'application/json' : 'text/html'},
    body: form ? new URLSearchParams(body).toString() : body,
  };
  await handler(req, res);
  out.status = res.statusCode;
  return out;
}

const tests = [];
const test = (name, fn) => tests.push([name, fn]);
const lead = (extra = {}) => ({name: 'Sam Rivera', email: 'sam@example.com', source: 'flow', placement: 'hero', page: '/', ...extra});

// ---- free audit requests -------------------------------------------------
test('a complete flow request is emailed and filed', async () => {
  const handler = load('review-request.js', BOTH);
  fail = {resend: false, intake: false};
  const r = await post(handler, lead({website: 'riveraroofing.com', phone: '555-0100', interest: 'seo', lead_source: 'lead_sites', site: 'weak', utm_source: 'instagram', utm_campaign: 'nov', ad_click: 'meta', landing: '/start', referrer: 'l.instagram.com'}));
  assert.deepStrictEqual(r.body, {ok: true});
  const email = calls.find((c) => c.target === 'resend').body;
  const filed = calls.find((c) => c.target === 'intake');
  assert.strictEqual(email.reply_to, 'sam@example.com');
  assert.match(email.subject, /Free audit request: Sam Rivera \(https:\/\/riveraroofing\.com\)/);
  for (const line of ['Showing up on Google and Maps', 'Lead sites (Angi, Thumbtack, Yelp)', 'Has one that does not bring in much', 'instagram / nov', 'Meta ad (Instagram or Facebook)', 'l.instagram.com', '/start', 'Question flow (homepage) on /']) {
    assert.ok(email.text.includes(line), `email should mention "${line}"`);
  }
  assert.strictEqual(filed.headers.Authorization, 'Bearer secret');
  assert.strictEqual(filed.body.form, 'audit');
  assert.strictEqual(filed.body.website, 'https://riveraroofing.com');
  assert.strictEqual(filed.body.details['Wants help with'], 'Showing up on Google and Maps');
  assert.strictEqual(filed.body.details['Ad click'], 'Meta ad (Instagram or Facebook)');
  assert.match(filed.body.message, /Leads come from: Lead sites/);
});

test('a website is not required (many visitors have none)', async () => {
  const handler = load('review-request.js', BOTH);
  const r = await post(handler, lead({site: 'none'}));
  assert.deepStrictEqual(r.body, {ok: true});
  assert.strictEqual(calls.find((c) => c.target === 'intake').body.website, '');
});

test('name and a real email are required', async () => {
  const handler = load('review-request.js', BOTH);
  let r = await post(handler, lead({email: 'sam@'}));
  assert.strictEqual(r.status, 400);
  assert.deepStrictEqual(r.body.fields, ['email']);
  r = await post(handler, lead({name: '  '}));
  assert.deepStrictEqual(r.body.fields, ['name']);
  assert.strictEqual(calls.length, 0, 'nothing is sent for an invalid request');
});

test('answers the server does not know are dropped', async () => {
  const handler = load('review-request.js', BOTH);
  await post(handler, lead({interest: '<script>alert(1)</script>', lead_source: 'made_up', site: 'none', page: 'https://evil.example/', landing: 'javascript:alert(1)'}));
  const filed = calls.find((c) => c.target === 'intake').body;
  assert.deepStrictEqual(Object.keys(filed.details), ['Form', 'Website today']);
  assert.strictEqual(filed.page, '/');
  assert.ok(!JSON.stringify(calls).includes('script'), 'no markup reaches the email or the CRM');
});

test('spam is answered "ok" and goes nowhere', async () => {
  const handler = load('review-request.js', BOTH);
  let r = await post(handler, lead({company: 'Acme SEO'}));
  assert.deepStrictEqual(r.body, {ok: true});
  assert.strictEqual(calls.length, 0);
  r = await post(handler, lead({started: String(Date.now())}));
  assert.deepStrictEqual(r.body, {ok: true});
  assert.strictEqual(calls.length, 0, 'a form sent within 2.5 seconds is a bot');
});

test('the email failing does not fail a lead the CRM has', async () => {
  const handler = load('review-request.js', BOTH);
  fail = {resend: true, intake: false};
  assert.deepStrictEqual((await post(handler, lead())).body, {ok: true});
  fail = {resend: 'throw', intake: false};
  assert.deepStrictEqual((await post(handler, lead())).body, {ok: true});
});

test('the CRM failing does not fail a lead that was emailed', async () => {
  const handler = load('review-request.js', BOTH);
  fail = {resend: false, intake: true};
  assert.deepStrictEqual((await post(handler, lead())).body, {ok: true});
});

test('no email key: the lead is still filed and the visitor sees success', async () => {
  const handler = load('review-request.js', {OS_INTAKE_URL: INTAKE, OS_INTAKE_SECRET: 'secret'});
  fail = {resend: false, intake: false};
  const r = await post(handler, lead());
  assert.deepStrictEqual(r.body, {ok: true});
  assert.deepStrictEqual(calls.map((c) => c.target), ['intake']);
});

test('both channels failing shows the fallback', async () => {
  const handler = load('review-request.js', BOTH);
  fail = {resend: true, intake: true};
  const r = await post(handler, lead());
  assert.strictEqual(r.status, 502);
  assert.deepStrictEqual(r.body, {ok: false, error: 'send_failed'});
  fail = {resend: false, intake: false};
});

test('nothing configured answers 503', async () => {
  const handler = load('review-request.js', {});
  const r = await post(handler, lead());
  assert.strictEqual(r.status, 503);
  assert.strictEqual(r.body.error, 'not_configured');
});

test('a plain form post is redirected, and only to this site', async () => {
  const handler = load('review-request.js', BOTH);
  let r = await post(handler, lead({page: '/start'}), {json: false, form: true});
  assert.strictEqual(r.status, 303);
  assert.strictEqual(r.headers.location, '/thanks');
  r = await post(handler, {name: '', email: 'x', page: '/start'}, {json: false, form: true});
  assert.strictEqual(r.headers.location, '/start?review=error#send-error');
  r = await post(handler, {name: '', email: 'x', page: 'https://evil.example'}, {json: false, form: true});
  assert.strictEqual(r.headers.location, '/?review=error#send-error');
});

test('a request from a service page says which page and returns there', async () => {
  const handler = load('review-request.js', BOTH);
  fail = {resend: false, intake: false};
  const r = await post(handler, lead({placement: 'service', page: '/ai-search-optimization', interest: 'seo', lead_source: 'google', site: 'working'}));
  assert.deepStrictEqual(r.body, {ok: true});
  const email = calls.find((c) => c.target === 'resend').body;
  assert.ok(email.text.includes('Question flow (service page) on /ai-search-optimization'), 'the email names the placement and the page');
  assert.strictEqual(calls.find((c) => c.target === 'intake').body.page, '/ai-search-optimization');
  // without JavaScript, an invalid post goes back to the same page
  const back = await post(handler, {name: '', email: 'x', page: '/ai-search-optimization'}, {json: false, form: true});
  assert.strictEqual(back.headers.location, '/ai-search-optimization?review=error#send-error');
});

test('a plain post from each page that carries the flow returns to that page', async () => {
  const handler = load('review-request.js', BOTH);
  // every page with <!-- flow:... --> in it must be on the server's list
  const dir = path.join(__dirname, '..', 'public');
  const pages = fs.readdirSync(dir).filter((file) => file.endsWith('.html') && /<!-- flow:(hero|landing|service) -->/.test(fs.readFileSync(path.join(dir, file), 'utf8')));
  assert.ok(pages.includes('san-diego-seo.html') && pages.includes('contractor-seo-san-diego.html'), 'the San Diego pages carry the flow');
  for (const file of pages) {
    const route = file === 'index.html' ? '/' : '/' + file.replace(/\.html$/, '');
    const back = await post(handler, {name: '', email: 'x', page: route}, {json: false, form: true});
    assert.strictEqual(back.headers.location, `${route}?review=error#send-error`, `${route} is missing from RETURN_TO in api/review-request.js`);
  }
});

test('only POST is accepted', async () => {
  const handler = load('review-request.js', BOTH);
  const r = await post(handler, {}, {method: 'GET'});
  assert.strictEqual(r.status, 405);
});

test('older forms (name, email, website, message) still work', async () => {
  const handler = load('review-request.js', BOTH);
  const r = await post(handler, {name: 'Old Form', email: 'old@example.com', website: 'old.example', message: 'More hardwood jobs', source: 'popup', page: '/services'});
  assert.deepStrictEqual(r.body, {ok: true});
  const email = calls.find((c) => c.target === 'resend').body;
  assert.ok(email.text.includes('More hardwood jobs') && email.text.includes('Popup on /services'));
});

// ---- website estimate requests ---------------------------------------------
const estimate = (extra = {}) => ({name: 'Dana Lee', email: 'dana@example.com', project: 'New website', pages: '6-15', budget: '$5,000', features: ['Blog or news', 'Not a real feature'], ...extra});

test('an estimate request is emailed and filed', async () => {
  const handler = load('estimate-request.js', BOTH);
  const r = await post(handler, estimate());
  assert.deepStrictEqual(r.body, {ok: true});
  const filed = calls.find((c) => c.target === 'intake').body;
  assert.strictEqual(filed.form, 'estimate');
  assert.strictEqual(filed.details.Features, 'Blog or news');
});

test('an estimate needs a project type', async () => {
  const handler = load('estimate-request.js', BOTH);
  const r = await post(handler, estimate({project: 'Something else'}));
  assert.strictEqual(r.status, 400);
  assert.deepStrictEqual(r.body.fields, ['project']);
});

test('an estimate with no email key is still filed and succeeds', async () => {
  const handler = load('estimate-request.js', {OS_INTAKE_URL: INTAKE, OS_INTAKE_SECRET: 'secret'});
  const r = await post(handler, estimate());
  assert.deepStrictEqual(r.body, {ok: true});
});

test('an estimate with both channels failing shows the fallback', async () => {
  const handler = load('estimate-request.js', BOTH);
  fail = {resend: true, intake: true};
  const r = await post(handler, estimate());
  assert.strictEqual(r.status, 502);
  fail = {resend: false, intake: false};
});

(async () => {
  let failed = 0;
  for (const [name, fn] of tests) {
    try { await fn(); console.log(`  ok    ${name}`); }
    catch (error) { failed++; console.log(`  FAIL  ${name}\n        ${error.message}`); }
  }
  console.log(failed ? `\n${failed} of ${tests.length} failed` : `\nPASS: ${tests.length} endpoint tests`);
  process.exit(failed ? 1 : 0);
})();
