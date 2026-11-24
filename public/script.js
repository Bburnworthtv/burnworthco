/*
  Page behaviour shared by every page: the header and phone menu, content that
  rises in as it scrolls into view, counting numbers, the contents rail on long
  pages, the row of sites we built, the pointer light on dark tiles and the
  overview video. The question flow is in flow.js.

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
    // Close on a link, on a tap outside the bar, and when the window grows wide enough for the links.
    document.addEventListener('click', (event) => {
      if (!doc.classList.contains('menu-open')) return;
      if (event.target.closest('#site-nav a') || !event.target.closest('[data-header]')) setOpen(false);
    });
    // The width where the links move back into the bar; the same number is in styles.css.
    window.matchMedia('(min-width: 1101px)').addEventListener('change', (event) => { if (event.matches) setOpen(false); });
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

  // Long pages: mark the section being read in the contents rail. The section
  // being read is the last one whose top has passed a line 30% down the window;
  // above the first section nothing is marked.
  const rail = document.querySelector('.report-body .rail');
  if (rail) {
    const pairs = [];
    rail.querySelectorAll('a[href^="#"]').forEach((link) => {
      const section = document.getElementById(link.getAttribute('href').slice(1));
      if (section) pairs.push([section, link]);
    });
    let waiting = false;
    const mark = () => {
      waiting = false;
      const line = window.innerHeight * 0.3;
      let current = null;
      pairs.forEach(([section, link]) => { if (section.getBoundingClientRect().top <= line) current = link; });
      pairs.forEach(([, link]) => { if (link === current) link.setAttribute('aria-current', 'true'); else link.removeAttribute('aria-current'); });
    };
    if (pairs.length) {
      window.addEventListener('scroll', () => { if (!waiting) { waiting = true; requestAnimationFrame(mark); } }, { passive: true });
      mark();
    }
  }

  // The row of sites we built. It scrolls sideways on its own (swipe, trackpad,
  // arrow keys, the scrollbar when this script is missing). This adds the two
  // arrow buttons, the progress bar, the "2 / 5" count and dragging with a mouse.
  document.querySelectorAll('[data-reel]').forEach((reel) => {
    const strip = reel.querySelector('[data-reel-track]');
    const prev = reel.querySelector('[data-reel-prev]');
    const next = reel.querySelector('[data-reel-next]');
    const thumb = reel.querySelector('[data-reel-thumb]');
    const now = reel.querySelector('[data-reel-now]');
    if (!strip || !prev || !next) return;
    const items = Array.from(strip.children);
    // Distance from one card to the next.
    const step = () => (items.length > 1 ? items[1].offsetLeft - items[0].offsetLeft : strip.clientWidth);
    const farthest = () => strip.scrollWidth - strip.clientWidth;
    let queued = false;
    let reported = false;
    const update = () => {
      queued = false;
      const max = farthest();
      const x = Math.max(0, Math.min(max, strip.scrollLeft));
      const atEnd = x >= max - 2;
      reel.classList.toggle('is-static', max <= 2);
      prev.disabled = x <= 2;
      next.disabled = atEnd;
      if (thumb) {
        const share = strip.clientWidth / strip.scrollWidth;
        thumb.style.width = `${share * 100}%`;
        thumb.style.transform = `translateX(${max > 0 ? (x / max) * ((1 - share) / share) * 100 : 0}%)`;
      }
      if (now) now.textContent = String(atEnd ? items.length : Math.min(items.length, Math.round(x / step()) + 1));
    };
    const settle = (left) => strip.scrollTo({ left: Math.max(0, Math.min(farthest(), left)), behavior: reduce ? 'auto' : 'smooth' });
    // The arrows go to the card before or after the one at the left edge. At the
    // far end the row rests between two cards, hence the rounding up and down.
    prev.addEventListener('click', () => settle((Math.ceil(strip.scrollLeft / step() - 0.05) - 1) * step()));
    next.addEventListener('click', () => settle((Math.floor(strip.scrollLeft / step() + 0.05) + 1) * step()));
    strip.addEventListener('scroll', () => {
      if (!queued) { queued = true; requestAnimationFrame(update); }
      if (!reported && strip.scrollLeft > 40) { reported = true; track('showcase_swipe'); }
    }, { passive: true });
    if ('ResizeObserver' in window) new ResizeObserver(update).observe(strip);
    update();

    // Drag with a mouse. Touch and pen already scroll the row natively.
    let drag = null;
    let dragged = false;
    strip.addEventListener('pointerdown', (event) => {
      if (event.pointerType !== 'mouse' || event.button !== 0) return;
      drag = { x: event.clientX, left: strip.scrollLeft, last: event.clientX, dir: 0, moved: false };
    });
    window.addEventListener('pointermove', (event) => {
      if (!drag) return;
      const dx = event.clientX - drag.x;
      if (!drag.moved) {
        if (Math.abs(dx) < 6) return;
        drag.moved = true;
        strip.classList.add('is-dragging');
      }
      if (event.clientX !== drag.last) drag.dir = event.clientX < drag.last ? 1 : -1;
      drag.last = event.clientX;
      strip.scrollLeft = drag.left - dx;
    });
    const release = () => {
      if (!drag) return;
      const { moved, dir } = drag;
      drag = null;
      if (!moved) return;
      dragged = true;
      // Come to rest on a card: the next one in the direction of travel.
      const at = strip.scrollLeft / step();
      const target = (dir > 0 ? Math.ceil(at - 0.15) : Math.floor(at + 0.15)) * step();
      settle(target);
      // Snapping is off while dragging; turn it back on once the row has settled.
      let done = false;
      const finish = () => { if (done) return; done = true; strip.classList.remove('is-dragging'); strip.removeEventListener('scrollend', finish); };
      strip.addEventListener('scrollend', finish);
      setTimeout(finish, reduce ? 0 : 700);
    };
    window.addEventListener('pointerup', release);
    window.addEventListener('pointercancel', release);
    // A drag that ends over a link is not a click on it.
    strip.addEventListener('click', (event) => { if (dragged) { dragged = false; event.preventDefault(); event.stopPropagation(); } }, true);
    strip.addEventListener('pointerdown', () => { dragged = false; }, true);
    strip.addEventListener('dragstart', (event) => event.preventDefault());
  });

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
