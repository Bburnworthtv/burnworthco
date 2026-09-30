/*
  Google tag and conversion tracking for burnworthco.com.

  Paste ONE ID below and deploy:
    - a GA4 measurement ID (G-XXXXXXXXXX) loads gtag.js directly, or
    - a Tag Manager container ID (GTM-XXXXXXX) loads the container.
  While TAG_ID is empty nothing is loaded and nothing is sent.

  Events sent on click (mark the first three as key events in GA4):
    click_to_call    tel: links                 link_url, cta_location
    email_click      mailto: links              link_url, cta_location
    book_call_click  Calendly booking links     link_url, cta_text, cta_location
    cta_click        other buttons and CTAs     link_url, cta_text, cta_location
  And from script.js on the homepage:
    overview_video_start, overview_video_complete   the hero video
    review_form_start                               first keystroke in the review form
    generate_lead                                   review request sent (mark as a key event)
*/
(function () {
  var TAG_ID = '';

  window.dataLayer = window.dataLayer || [];
  var isGA4 = /^G-[A-Z0-9]+$/.test(TAG_ID);
  var isGTM = /^GTM-[A-Z0-9]+$/.test(TAG_ID);
  if (!isGA4 && !isGTM) return;

  function load(src) {
    var s = document.createElement('script');
    s.async = true;
    s.src = src;
    document.head.appendChild(s);
  }

  function gtag() { window.dataLayer.push(arguments); }
  if (isGA4) {
    window.gtag = gtag;
    load('https://www.googletagmanager.com/gtag/js?id=' + TAG_ID);
    gtag('js', new Date());
    gtag('config', TAG_ID);
  } else {
    window.dataLayer.push({'gtm.start': Date.now(), event: 'gtm.js'});
    load('https://www.googletagmanager.com/gtm.js?id=' + TAG_ID);
  }

  function send(name, params) {
    if (isGA4) gtag('event', name, params);
    else window.dataLayer.push(Object.assign({event: name}, params));
  }
  // Used by script.js for video and form events.
  window.bwTrack = function (name, params) { send(name, Object.assign({page_path: location.pathname}, params || {})); };

  // Where on the page the click happened: header, footer, or the nearest section.
  function locationOf(el) {
    if (el.closest('header.site-header')) return 'header';
    if (el.closest('footer')) return 'footer';
    var section = el.closest('section[id], section[class]');
    if (!section) return 'page';
    if (section.id === 'top') return 'hero';
    return section.id || section.className.split(' ')[0];
  }

  document.addEventListener('click', function (event) {
    var link = event.target.closest && event.target.closest('a[href]');
    if (!link) return;
    var href = link.getAttribute('href');
    var params = {
      link_url: href,
      cta_text: (link.textContent || '').trim().slice(0, 100),
      cta_location: locationOf(link)
    };
    if (href.indexOf('tel:') === 0) send('click_to_call', params);
    else if (href.indexOf('mailto:') === 0) send('email_click', params);
    else if (href.indexOf('calendly.com') !== -1) send('book_call_click', params);
    else if (link.matches('.button, .header-cta, .text-link, .film-cta')) send('cta_click', params);
  }, true);
})();
