/*
  Files a form enquiry as a lead in Burnworth OS, the agency's CRM, alongside
  the email. Not a route: Vercel ignores api files that start with an underscore.

  Vercel environment variables (both optional; without them nothing is sent):
    OS_INTAKE_URL     https://burnworth-co-os.vercel.app/api/leads/intake
    OS_INTAKE_SECRET  the same value as LEAD_INTAKE_SECRET in the Burnworth OS project.

  Best effort: it never throws and never holds the visitor up for more than a
  few seconds, so a CRM problem can't break the form or the email.
*/
const TIMEOUT_MS = 4000;

module.exports = async function fileInOs(enquiry) {
  const url = (process.env.OS_INTAKE_URL || '').trim();
  const secret = (process.env.OS_INTAKE_SECRET || '').trim();
  if (!url || !secret) return false;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const r = await fetch(url, {
      method: 'POST',
      headers: {Authorization: `Bearer ${secret}`, 'Content-Type': 'application/json'},
      body: JSON.stringify(enquiry),
      signal: controller.signal,
    });
    if (!r.ok) console.error('Burnworth OS did not file the enquiry', r.status);
    return r.ok;
  } catch (err) {
    // Only the kind of failure: the request carries the secret in a header.
    console.error('Burnworth OS could not be reached', err && err.name);
    return false;
  } finally {
    clearTimeout(timer);
  }
};
