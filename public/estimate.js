/* Website build estimate form on /web-development#estimate.
   Posts to /api/estimate-request; without JavaScript the same form posts
   normally and the server redirects back here. */
(() => {
  const form = document.querySelector('[data-estimate-form]');
  if (!form) return;
  const track = (name, params = {}) => { if (window.bwTrack) window.bwTrack(name, params); };
  const status = form.querySelector('.form-status');
  const submit = form.querySelector('button[type="submit"]');
  const fallback = 'Please email <a href="mailto:Brandon@burnworthco.com">Brandon@burnworthco.com</a> or call <a href="tel:+12088812382">(208) 881-2382</a>.';

  const thanks = () => {
    form.classList.add('review-thanks');
    form.innerHTML = '<h3>Request received.</h3><p>Thanks. Brandon will reply by email with questions or a scoped estimate for your website.</p>';
  };
  const fail = (text) => { status.classList.add('error'); status.innerHTML = `${text} ${fallback}`; };

  form.elements.started.value = String(Date.now());
  const params = new URLSearchParams(window.location.search);
  if (params.get('estimate') === 'sent') thanks();
  else if (params.get('estimate') === 'error') fail('Your request could not be sent.');

  let started = false;
  form.addEventListener('input', () => {
    if (!started) { started = true; form.dataset.started = '1'; track('estimate_form_start', { form: 'website_estimate' }); }
  });

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!form.reportValidity()) return;
    status.classList.remove('error');
    status.textContent = 'Sending…';
    submit.disabled = true;
    const data = new FormData(form);
    const body = Object.fromEntries(data);
    body.features = data.getAll('features');
    try {
      const response = await fetch(form.action, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(body),
      });
      const result = await response.json().catch(() => ({}));
      if (response.ok && result.ok) {
        track('generate_lead', { form: 'website_estimate', project: body.project || '' });
        thanks();
      } else if (result.error === 'invalid') {
        fail('Please check your name, email and project type.');
      } else {
        fail('Your request could not be sent right now.');
      }
    } catch {
      fail('Your request could not be sent right now.');
    } finally {
      submit.disabled = false;
    }
  });
})();
