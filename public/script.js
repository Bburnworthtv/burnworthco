const header = document.querySelector('.site-header:not(.solid)');
if (header) {
  const updateHeader = () => header.classList.toggle('scrolled', window.scrollY > 100);
  updateHeader();
  window.addEventListener('scroll', updateHeader, { passive: true });
}

// Hero background video. The poster image paints first; the video is attached
// only after the page has loaded, and never with reduced motion, data saver or
// a slow connection. Phones get a 540x960 portrait loop, wider screens 1280x720.
const heroVideo = document.querySelector('[data-hero-video]');
if (heroVideo) {
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const connection = navigator.connection || {};
  const slow = connection.saveData || /(^|-)2g$/.test(connection.effectiveType || '');
  if (!reduce && !slow) {
    const start = () => {
      const phone = window.matchMedia('(max-width: 799px)').matches;
      const sources = phone
        ? [['srcMobileWebm', 'video/webm'], ['srcMobileMp4', 'video/mp4']]
        : [['srcWebm', 'video/webm'], ['srcMp4', 'video/mp4']];
      sources.forEach(([key, type]) => {
        const source = document.createElement('source');
        source.src = heroVideo.dataset[key];
        source.type = type;
        heroVideo.appendChild(source);
      });
      heroVideo.muted = true;
      heroVideo.addEventListener('playing', () => heroVideo.classList.add('is-playing'), { once: true });
      heroVideo.load();
      // Play only while the hero is on screen, to spare battery and CPU.
      new IntersectionObserver(([entry]) => {
        if (entry.isIntersecting) heroVideo.play().catch(() => {});
        else heroVideo.pause();
      }).observe(heroVideo);
    };
    const idle = window.requestIdleCallback || ((fn) => setTimeout(fn, 200));
    if (document.readyState === 'complete') idle(start);
    else window.addEventListener('load', () => idle(start), { once: true });
  }
}
