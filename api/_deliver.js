/*
  Shared by the two form endpoints (review-request.js and estimate-request.js):
  the spam check, the email, and the rule for what the visitor is told.

  Two rules, both there so that a real request is never lost without anyone
  knowing:

    1. The spam check never stops a request. A request that trips it is emailed
       like any other, with "Possible spam" at the front of the subject and the
       reason at the top, and is kept out of Burnworth OS.
    2. The visitor is told "sent" only when the email was accepted by Resend.
       The email is how the studio hears about a request, so a request that is
       only in Burnworth OS still shows the visitor the email and phone fallback.

  Why: until November 2026 a tripped spam check answered "ok" and sent nothing.
  The hidden field was named "company", and a browser's autofill filled it with
  the visitor's company name (Chrome ignores autocomplete="off" for this), so
  real visitors saw "Got it" and their request went nowhere.

  Vercel environment variables:
    RESEND_API_KEY   sends the email through Resend (https://resend.com).
    REVIEW_TO        optional, defaults to Brandon@burnworthco.com. Several
                     addresses can be listed, separated by commas.
    REVIEW_FROM      optional. Until burnworthco.com is verified in Resend, the
                     default onboarding@resend.dev sender only delivers to the
                     Resend account's own email.

  Not a route: Vercel ignores `api` files that start with an underscore.
*/
const fileInOs = require('./_os-intake.js');

const TO = (process.env.REVIEW_TO || 'Brandon@burnworthco.com').split(',').map((address) => address.trim()).filter(Boolean);
const FROM = process.env.REVIEW_FROM || 'Burnworth Co <onboarding@resend.dev>';

const line = (value, max) => String(value ?? '').replace(/[\r\n\t]+/g, ' ').trim().slice(0, max);

// The field visitors cannot see. Its name must mean nothing to a browser's
// autofill or to a password manager: no "company", "name", "email", "phone",
// "address" or "url" in it. The same name is in public/flow.js and in the
// estimate form in public/web-development.html; scripts/test_api.js checks the
// three agree. "company" is the name it had before, still sent by a page that
// has been open in a tab since then.
const HIDDEN_FIELD = 'bw_check';
const OLD_HIDDEN_FIELD = 'company';

// Reasons a request looks automated, in words for the email. Empty for most.
function spamSigns(body, quickestMs) {
  const signs = [];
  const hidden = line(body[HIDDEN_FIELD], 80) || line(body[OLD_HIDDEN_FIELD], 80);
  if (hidden) signs.push(`a field that visitors cannot see was filled in ("${hidden}")`);
  // The start time comes from the visitor's own clock. A clock that runs ahead
  // of this server gives a time below zero, which says nothing, so it is ignored.
  const started = Number(body.started);
  const took = started ? Date.now() - started : NaN;
  if (took >= 0 && took < quickestMs) signs.push(`it was sent ${(took / 1000).toFixed(1)} seconds after the page loaded`);
  return signs;
}

async function sendEmail({subject, text, replyTo}) {
  if (!process.env.RESEND_API_KEY) {
    console.warn('RESEND_API_KEY is not set: no email sent for this request');
    return false;
  }
  try {
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json'},
      body: JSON.stringify({from: FROM, to: TO, reply_to: replyTo, subject, text}),
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

/*
  Sends one valid request: the email and, unless it tripped the spam check, the
  lead in Burnworth OS, at the same time. Resolves to [status, body] to answer
  the visitor with.

    kind     what to call it in the log, for example "free audit request"
    subject  the email subject
    text     the email text
    replyTo  the visitor's email address
    signs    from spamSigns()
    lead     what to file in Burnworth OS; see api/_os-intake.js
*/
async function deliver({kind, subject, text, replyTo, signs, lead}) {
  const flagged = signs.length > 0;
  const note = flagged
    ? [
      `POSSIBLE SPAM: ${signs.join(', and ')}.`,
      'Bots do this, and so can a browser filling in a form for a real person, so it was sent to you anyway. It was not added to Burnworth OS.',
      '',
    ]
    : [];
  const [emailed, filed] = await Promise.all([
    sendEmail({subject: flagged ? `Possible spam: ${subject}` : subject, text: [...note, text].join('\n'), replyTo}),
    flagged ? false : fileInOs(lead),
  ]);
  // One line per request, with nothing personal in it, so the function's log
  // shows that a request arrived and what became of it.
  const outcome = `${kind}: email ${emailed ? 'sent' : 'NOT sent'}, Burnworth OS ${filed ? 'filed' : 'not filed'}${flagged ? ', flagged as possible spam' : ''}`;
  if (emailed) console.info(outcome);
  else console.error(outcome);

  if (emailed) return [200, {ok: true}];
  return process.env.RESEND_API_KEY ? [502, {ok: false, error: 'send_failed'}] : [503, {ok: false, error: 'not_configured'}];
}

module.exports = {deliver, spamSigns, HIDDEN_FIELD};
