/*
  POST /api/review-request - free visibility review requests from the homepage form.

  Sends one plain-text email per request through Resend (https://resend.com).
  Vercel environment variables:
    RESEND_API_KEY  required. Without it the form answers 503 and shows the email/phone fallback.
    REVIEW_TO       optional, defaults to Brandon@burnworthco.com.
    REVIEW_FROM     optional. Until burnworthco.com is verified in Resend, the default
                    onboarding@resend.dev sender only delivers to the Resend account's own email.

  Answers JSON when the request asks for it (the page's script does); otherwise it
  redirects back to the homepage, so the form still works without JavaScript.
*/
const TO = process.env.REVIEW_TO || 'Brandon@burnworthco.com';
const FROM = process.env.REVIEW_FROM || 'Burnworth Co <onboarding@resend.dev>';

const line = (value, max) => String(value ?? '').replace(/[\r\n\t]+/g, ' ').trim().slice(0, max);
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

module.exports = async (req, res) => {
  const wantsJson = String(req.headers.accept || '').includes('application/json');
  const reply = (status, body) => {
    if (wantsJson) return res.status(status).json(body);
    res.statusCode = 303;
    res.setHeader('Location', body.ok ? '/?review=sent#review' : '/?review=error#review');
    return res.end();
  };

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ok: false, error: 'method_not_allowed'});
  }

  const body = typeof req.body === 'string' ? Object.fromEntries(new URLSearchParams(req.body)) : req.body || {};

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

  const missing = [!name && 'name', !EMAIL.test(email) && 'email', !website && 'website'].filter(Boolean);
  if (missing.length) return reply(400, {ok: false, error: 'invalid', fields: missing});

  if (!process.env.RESEND_API_KEY) return reply(503, {ok: false, error: 'not_configured'});

  const text = [
    'New free visibility review request from burnworthco.com',
    '',
    `Name:     ${name}`,
    `Email:    ${email}`,
    `Phone:    ${phone || '-'}`,
    `Website:  ${website}`,
    '',
    'What they want more of:',
    message || '-',
  ].join('\n');

  try {
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json'},
      body: JSON.stringify({
        from: FROM,
        to: [TO],
        reply_to: email,
        subject: `Visibility review request: ${website}`,
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
