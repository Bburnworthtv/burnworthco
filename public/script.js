const header = document.querySelector('.site-header:not(.solid)');
if (header) {
  const updateHeader = () => header.classList.toggle('scrolled', window.scrollY > 100);
  updateHeader();
  window.addEventListener('scroll', updateHeader, { passive: true });
}

// Hero background video. Kept off small screens, data-saver and reduced-motion,
// where the poster image stays. Sources are attached only when it will play.
const heroVideo = document.querySelector('[data-hero-video]');
if (heroVideo) {
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const small = window.matchMedia('(max-width: 799px)').matches;
  const saveData = navigator.connection && navigator.connection.saveData;
  if (!reduce && !small && !saveData) {
    [['srcWebm', 'video/webm'], ['srcMp4', 'video/mp4']].forEach(([key, type]) => {
      const source = document.createElement('source');
      source.src = heroVideo.dataset[key];
      source.type = type;
      heroVideo.appendChild(source);
    });
    heroVideo.muted = true;
    heroVideo.addEventListener('playing', () => heroVideo.classList.add('is-playing'), { once: true });
    heroVideo.load();
    heroVideo.play().catch(() => {});
  }
}
