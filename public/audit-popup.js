/* Free audit popup, loaded on every page except 404. */
// Free audit popup. Built here rather than in each page's HTML so crawlers and
// AI readers see the page content, not a duplicate form on every URL.
//
// Opens automatically at most once: after the visitor has scrolled half the page
// and spent 20 seconds on it, or (mouse users) when the pointer leaves through the
// top of the window after 8 seconds. Never while the homepage form is on screen,
// never again for 14 days after it is closed, and never after a request is sent.
// On pages other than the homepage, "Free audit" links open it instead of
// leaving the page.
(() => {
  if (!window.HTMLDialogElement) return;
  // Events for analytics.js (GA4 + Tag Manager).
  const track = (name, params = {}) => { if (window.bwTrack) window.bwTrack(name, params); };
  const KEY = 'bw_audit_popup';
  const QUIET_DAYS = 14;
  const read = () => { try { return localStorage.getItem(KEY); } catch { return null; } };
  const write = (value) => { try { localStorage.setItem(KEY, value); } catch {} };
  const onHome = location.pathname === '/' || location.pathname === '/index.html';
  const inlineForm = document.querySelector('[data-review-form]');
  const auditLink = /#review(-form)?$/;
  const fallback = 'Please email <a href="mailto:Brandon@burnworthco.com">Brandon@burnworthco.com</a> or call <a href="tel:+12088812382">(208) 881-2382</a>.';

  const dialog = document.createElement('dialog');
  dialog.className = 'audit-pop';
  dialog.setAttribute('aria-labelledby', 'audit-pop-title');
  dialog.innerHTML = `
    <button class="audit-pop-close" type="button" aria-label="Close" data-audit-close>&times;</button>
    <form class="review-form audit-pop-form" action="/api/review-request" method="post">
      <p class="eyebrow">Free visibility review</p>
      <h2 id="audit-pop-title">Are customers finding you, or your competitors?</h2>
      <p class="review-what">See where your business appears, what may be holding it back, and which improvements to prioritize.</p>
      <label>Name<input name="name" autocomplete="name" required maxlength="100"></label>
      <label>Email<input type="email" name="email" autocomplete="email" required maxlength="200"></label>
      <label>Website<input name="website" inputmode="url" autocomplete="url" placeholder="yourbusiness.com" required maxlength="300"></label>
      <label class="hp" aria-hidden="true">Leave this empty<input name="company" tabindex="-1" autocomplete="off"></label>
      <input type="hidden" name="started" value="">
      <input type="hidden" name="source" value="popup">
      <input type="hidden" name="page" value="">
      <button class="button primary" type="submit">Request my free review<span class="icon-right" aria-hidden="true"></span></button>
      <p class="form-status" role="status" aria-live="polite"></p>
      <p class="form-fine">Brandon reads every request. Your details are only used to reply.</p>
      <button class="audit-pop-skip" type="button" data-audit-close>No thanks</button>
    </form>`;
  document.body.appendChild(dialog);

  const form = dialog.querySelector('form');
  const status = form.querySelector('.form-status');
  const submit = form.querySelector('button[type="submit"]');
  let how = '';
  let started = false;
  let sent = false;

  const open = (trigger) => {
    if (dialog.open) return;
    how = trigger;
    form.elements.started.value = String(Date.now());
    form.elements.page.value = location.pathname;
    dialog.showModal();
    // Keyboard focus on the first field only when the visitor asked for the form;
    // an automatic open should not pop up a phone keyboard.
    if (trigger === 'link') form.elements.name.focus();
    track('audit_popup_view', { trigger });
  };
  const close = () => {
    if (!dialog.open) return;
    dialog.close();
  };
  dialog.addEventListener('close', () => {
    if (!sent) { write(String(Date.now())); track('audit_popup_dismiss', { trigger: how }); }
  });
  dialog.querySelectorAll('[data-audit-close]').forEach((b) => b.addEventListener('click', close));
  // A click on the dimmed backdrop lands on the dialog element itself.
  dialog.addEventListener('click', (event) => { if (event.target === dialog) close(); });

  form.addEventListener('input', () => {
    if (!started) { started = true; track('review_form_start', { form: 'audit_popup' }); }
  });
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!form.reportValidity()) return;
    status.classList.remove('error');
    status.textContent = 'Sending…';
    submit.disabled = true;
    try {
      const response = await fetch(form.action, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(Object.fromEntries(new FormData(form))),
      });
      const result = await response.json().catch(() => ({}));
      if (response.ok && result.ok) {
        sent = true;
        write('sent');
        track('generate_lead', { form: 'audit_popup' });
        form.classList.add('review-thanks');
        form.innerHTML = '<p class="eyebrow">Free visibility review</p><h2 id="audit-pop-title">Request received.</h2><p>Thanks. Brandon will reply by email with your visibility review.</p><button class="button dark" type="button" data-audit-close>Close</button>';
        form.querySelector('[data-audit-close]').addEventListener('click', close);
      } else {
        status.classList.add('error');
        status.innerHTML = `${result.error === 'invalid' ? 'Please check your name, email and website.' : 'Your request could not be sent right now.'} ${fallback}`;
      }
    } catch {
      status.classList.add('error');
      status.innerHTML = `Your request could not be sent right now. ${fallback}`;
    } finally {
      submit.disabled = false;
    }
  });

  // "Free audit" links on other pages open the popup in place.
  if (!onHome) {
    document.addEventListener('click', (event) => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const link = event.target.closest && event.target.closest('a[href]');
      if (!link || dialog.contains(link) || !auditLink.test(link.getAttribute('href'))) return;
      event.preventDefault();
      open('link');
    });
  }

  // Automatic open.
  const state = read();
  if (state === 'sent') return;
  if (state && Date.now() - Number(state) < QUIET_DAYS * 864e5) return;

  const loadedAt = Date.now();
  let inlineVisible = false;
  if (inlineForm) {
    new IntersectionObserver(([entry]) => { inlineVisible = entry.isIntersecting; }).observe(inlineForm);
  }
  let done = false;
  const maybeOpen = (trigger) => {
    if (done || dialog.open || inlineVisible) return;
    if (read()) return; // closed or sent in another tab
    if (inlineForm && (inlineForm.dataset.started || inlineForm.classList.contains('review-thanks'))) return;
    done = true;
    window.removeEventListener('scroll', onScroll);
    document.removeEventListener('mouseout', onLeave);
    open(trigger);
  };

  // Half the page read; if that happens before 20 seconds, wait out the rest.
  // If the homepage form is on screen at that moment, try again on a later scroll.
  let pending = false;
  const onScroll = () => {
    if (pending) return;
    const depth = (window.scrollY + window.innerHeight) / document.documentElement.scrollHeight;
    if (depth < 0.5) return;
    pending = true;
    setTimeout(() => { maybeOpen('engaged'); pending = false; }, Math.max(0, 20000 - (Date.now() - loadedAt)));
  };
  const onLeave = (event) => {
    if (event.relatedTarget || event.clientY > 0) return;
    if (Date.now() - loadedAt < 8000) return;
    maybeOpen('exit_intent');
  };
  window.addEventListener('scroll', onScroll, { passive: true });
  if (window.matchMedia('(hover: hover) and (pointer: fine)').matches) document.addEventListener('mouseout', onLeave);
})();
