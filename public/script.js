const header = document.querySelector('.site-header:not(.solid)');
if (header) {
  const updateHeader = () => header.classList.toggle('scrolled', window.scrollY > 100);
  updateHeader();
  window.addEventListener('scroll', updateHeader, { passive: true });
}

// Events for analytics.js; a no-op until a Google tag ID is set there.
const track = (name, params = {}) => { if (window.bwTrack) window.bwTrack(name, params); };

// Homepage overview video. The poster paints first; the video is attached after the
// page has loaded. It plays once and holds on its end card, where the drawn
// "Get my visibility review" button becomes a real link to the form below.
const film = document.querySelector('[data-film]');
if (film) {
  const frame = film.closest('.film');
  const cta = frame.querySelector('.film-cta');
  const toggle = frame.querySelector('[data-film-toggle]');
  const review = document.getElementById('review');
  const END_CARD_AT = 22.4; // seconds: the end card's button is on screen from here
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const connection = navigator.connection || {};
  const slow = connection.saveData || /(^|-)2g$/.test(connection.effectiveType || '');
  let userPaused = false;
  let started = false;
  let reachedEnd = false;

  const label = (text) => { toggle.textContent = text; toggle.setAttribute('aria-label', `${text} video`); };
  const attach = () => {
    if (film.src) return;
    const phone = window.matchMedia('(max-width: 799px)').matches;
    // H.264 MP4 plays almost everywhere and is smaller; WebM covers browsers without it.
    const mp4 = film.canPlayType('video/mp4; codecs="avc1.42E01E"') !== '';
    film.src = mp4 ? (phone ? film.dataset.srcMobile : film.dataset.src) : (phone ? film.dataset.srcMobileWebm : film.dataset.srcWebm);
    film.muted = true;
  };
  const play = () => { attach(); film.play().catch(() => label('Play')); };

  film.addEventListener('playing', () => {
    frame.classList.add('is-playing');
    frame.classList.remove('is-ended');
    label('Pause');
    if (!started) { started = true; track('overview_video_start'); }
  });
  film.addEventListener('pause', () => { if (!film.ended) label('Play'); });
  film.addEventListener('timeupdate', () => {
    const onEndCard = film.currentTime >= END_CARD_AT;
    cta.hidden = !onEndCard;
    if (onEndCard && !reachedEnd) {
      reachedEnd = true;
      if (review) review.classList.add('is-invited');
      track('overview_video_complete');
    }
  });
  film.addEventListener('ended', () => { frame.classList.add('is-ended'); cta.hidden = false; label('Replay'); });

  toggle.hidden = false;
  toggle.addEventListener('click', () => {
    if (film.ended) { film.currentTime = 0; userPaused = false; play(); }
    else if (film.paused || !film.src) { userPaused = false; play(); }
    else { userPaused = true; film.pause(); }
  });
  cta.addEventListener('click', () => {
    const first = document.querySelector('#review-form input[name="name"]');
    if (first) setTimeout(() => first.focus({ preventScroll: true }), 400);
  });

  // Pause while scrolled away; resume on return unless the visitor paused it.
  new IntersectionObserver(([entry]) => {
    if (!film.src || film.ended) return;
    if (!entry.isIntersecting) film.pause();
    else if (!userPaused) film.play().catch(() => {});
  }).observe(frame);

  if (reduce || slow) {
    label('Play');
  } else {
    const idle = window.requestIdleCallback || ((fn) => setTimeout(fn, 200));
    const start = () => idle(play);
    if (document.readyState === 'complete') start();
    else window.addEventListener('load', start, { once: true });
  }
}

// Free visibility review form. Posts to /api/review-request; without JavaScript
// the same form posts normally and the server redirects back here.
const reviewForm = document.querySelector('[data-review-form]');
if (reviewForm) {
  const status = reviewForm.querySelector('.form-status');
  const submit = reviewForm.querySelector('button[type="submit"]');
  const fallback = 'Please email <a href="mailto:Brandon@burnworthco.com">Brandon@burnworthco.com</a> or call <a href="tel:+12088812382">(208) 881-2382</a>.';
  const thanks = () => {
    reviewForm.classList.add('review-thanks');
    reviewForm.innerHTML = '<h2>Request received.</h2><p>Thanks. Brandon will reply by email with your visibility review.</p>';
  };
  const fail = (text) => { status.classList.add('error'); status.innerHTML = `${text} ${fallback}`; };

  reviewForm.elements.started.value = String(Date.now());
  const params = new URLSearchParams(window.location.search);
  if (params.get('review') === 'sent') thanks();
  else if (params.get('review') === 'error') fail('Your request could not be sent.');

  let formStarted = false;
  reviewForm.addEventListener('input', () => {
    if (!formStarted) { formStarted = true; track('review_form_start', { form: 'visibility_review' }); }
  });

  reviewForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!reviewForm.reportValidity()) return;
    status.classList.remove('error');
    status.textContent = 'Sending…';
    submit.disabled = true;
    try {
      const response = await fetch(reviewForm.action, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(Object.fromEntries(new FormData(reviewForm))),
      });
      const result = await response.json().catch(() => ({}));
      if (response.ok && result.ok) {
        track('generate_lead', { form: 'visibility_review' });
        thanks();
      } else if (result.error === 'invalid') {
        fail('Please check your name, email and website.');
      } else {
        fail('Your request could not be sent right now.');
      }
    } catch {
      fail('Your request could not be sent right now.');
    } finally {
      submit.disabled = false;
    }
  });
}
