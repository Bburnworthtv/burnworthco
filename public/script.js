const header = document.querySelector('.site-header:not(.solid)');
if (header) {
  const updateHeader = () => header.classList.toggle('scrolled', window.scrollY > 100);
  updateHeader();
  window.addEventListener('scroll', updateHeader, { passive: true });
}
