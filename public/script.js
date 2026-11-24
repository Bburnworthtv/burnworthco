/*
  Page behaviour shared by every page: the header and phone menu, content that
  rises in as it scrolls into view, counting numbers, the contents rail on long
  pages, the pointer light on dark tiles and the overview video. The question
  flow is in flow.js.

  Everything here is an enhancement. With this file missing, the pages read and
  work the same; they only lose the motion.
*/
(() => {
  const doc = document.documentElement;
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  // Events for analytics.js; a no-op until it has loaded.
  const track = (name, params = {}) => { if (window.bwTrack) window.bwTrack(name, params); };

  // Header: a stronger shadow once the page has moved.
  const header = document.querySelector('[data-header]');
  if (header) {
    const onScroll = () => header.classList.toggle('is-scrolled', window.scrollY > 12);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
  }

  // Phone menu.
  const toggle = document.querySelector('.menu-toggle');
  const nav = document.getElementById('site-nav');
  if (toggle && nav) {
    const setOpen = (open) => {
      doc.classList.toggle('menu-open', open);
      toggle.setAttribute('aria-expanded', String(open));
      toggle.querySelector('.sr').textContent = open ? 'Close menu' : 'Menu';
      // The links come before the button in the page, so send the keyboard to
      // the first one; otherwise Tab would carry on into the page behind.
      if (open) { const first = nav.querySelector('a'); if (first) first.focus({ preventScroll: true }); }
    };
    toggle.addEventListener('click', () => setOpen(!doc.classList.contains('menu-open')));
    // Tabbing out of the header closes the menu.
    if (header) header.addEventListener('focusout', (event) => {
      if (doc.classList.contains('menu-open') && event.relatedTarget && !header.contains(event.relatedTarget)) setOpen(false);
    });
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && doc.classList.contains('menu-open')) { setOpen(false); toggle.focus(); }
    });
    // Close on a link, on a tap outside the bar, and when the window grows past phone width.
    document.addEventListener('click', (event) => {
      if (!doc.classList.contains('menu-open')) return;
      if (event.target.closest('#site-nav a') || !event.target.closest('[data-header]')) setOpen(false);
    });
    window.matchMedia('(min-width: 961px)').addEventListener('change', (event) => { if (event.matches) setOpen(false); });
  }

  // Rise in on scroll. The class that hides content is added here, so content
  // is never hidden unless this observer is running.
  const revealables = document.querySelectorAll('[data-reveal]');
  if (revealables.length && 'IntersectionObserver' in window && !reduce) {
    doc.classList.add('reveal-on');
    const seen = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-in');
        seen.unobserve(entry.target);
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.12 });
    revealables.forEach((el) => seen.observe(el));
  } else {
    revealables.forEach((el) => el.classList.add('is-in'));
  }

  // Numbers count up once, the first time they are seen.
  const counters = document.querySelectorAll('[data-count]');
  if (counters.length && 'IntersectionObserver' in window && !reduce) {
    const run = (el) => {
      const end = Number(el.dataset.count);
      const decimals = Number(el.dataset.decimals || 0);
      const start = performance.now();
      const length = 1300;
      const frame = (now) => {
        const t = Math.min(1, (now - start) / length);
        const eased = 1 - Math.pow(1 - t, 4);
        el.textContent = (end * eased).toFixed(decimals);
        if (t < 1) requestAnimationFrame(frame);
        else el.textContent = end.toFixed(decimals);
      };
      requestAnimationFrame(frame);
    };
    const counted = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        counted.unobserve(entry.target);
        run(entry.target);
      });
    }, { threshold: 0.6 });
    counters.forEach((el) => counted.observe(el));
  }

  // Long pages: mark the section being read in the contents rail.
  const rail = document.querySelector('.report-body .rail');
  if (rail && 'IntersectionObserver' in window) {
    const links = new Map();
    rail.querySelectorAll('a[href^="#"]').forEach((link) => {
      const section = document.getElementById(link.getAttribute('href').slice(1));
      if (section) links.set(section, link);
    });
    const spy = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        links.forEach((link) => link.removeAttribute('aria-current'));
        links.get(entry.target).setAttribute('aria-current', 'true');
      });
    }, { rootMargin: '-25% 0px -65% 0px' });
    links.forEach((link, section) => spy.observe(section));
  }

  // A soft light follows the pointer across dark tiles.
  if (window.matchMedia('(hover: hover) and (pointer: fine)').matches) {
    document.querySelectorAll('.spot').forEach((el) => {
      el.addEventListener('pointermove', (event) => {
        const box = el.getBoundingClientRect();
        el.style.setProperty('--mx', `${event.clientX - box.left}px`);
        el.style.setProperty('--my', `${event.clientY - box.top}px`);
      });
    });
  }

  // Overview video. Nothing is downloaded until the visitor opens it.
  const videoDialog = document.querySelector('[data-video-dialog]');
  const film = videoDialog && videoDialog.querySelector('[data-film]');
  if (film && window.HTMLDialogElement) {
    const END_CARD_AT = 22.4; // seconds: the closing card of the video starts here
    let started = false;
    let finished = false;
    const attach = () => {
      if (film.src) return;
      const phone = window.matchMedia('(max-width: 799px)').matches;
      // H.264 MP4 plays almost everywhere and is smaller; WebM covers browsers without it.
      const mp4 = film.canPlayType('video/mp4; codecs="avc1.42E01E"') !== '';
      film.src = mp4 ? (phone ? film.dataset.srcMobile : film.dataset.src) : (phone ? film.dataset.srcMobileWebm : film.dataset.srcWebm);
    };
    document.querySelectorAll('[data-video-open]').forEach((button) => {
      button.addEventListener('click', () => {
        attach();
        videoDialog.showModal();
        film.play().catch(() => {});
      });
    });
    const close = () => videoDialog.close();
    videoDialog.querySelector('[data-video-close]').addEventListener('click', close);
    videoDialog.addEventListener('click', (event) => { if (event.target === videoDialog || event.target.closest('[data-flow-open]')) close(); });
    videoDialog.addEventListener('close', () => film.pause());
    film.addEventListener('playing', () => { if (!started) { started = true; track('overview_video_start'); } });
    film.addEventListener('timeupdate', () => {
      if (!finished && film.currentTime >= END_CARD_AT) { finished = true; track('overview_video_complete'); }
    });
  }

  // A page that does not exist: record which address was asked for, and where
  // the link came from, so broken links can be found and fixed.
  if (document.body.hasAttribute('data-not-found')) {
    track('page_not_found', { missing_path: window.location.pathname.slice(0, 200), came_from: (document.referrer || '').slice(0, 200) });
  }
})();
