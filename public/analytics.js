/*
  Google Analytics 4 and Google Tag Manager for burnworthco.com. Loaded on every page.

    GA4_ID  GA4 measurement ID (G-XXXXXXXXXX). Loads gtag.js and sends page views
            and the events below straight to GA4.
    GTM_ID  Tag Manager container ID (GTM-XXXXXXX). Loads the container, and every
            event below is also pushed to the dataLayer as {event: name, ...params}
            so GTM triggers ("Custom Event") can use them.
  Either can be left empty. With both set, do not also add a GA4 Google tag for
  the same G- ID inside GTM, or page views will be counted twice.

  Events sent on click (mark generate_lead, click_to_call, email_click,
  book_call_click and free_audit_click as key events in GA4):
    click_to_call     tel: links                  link_url, cta_text, cta_location
    email_click       mailto: links               link_url, cta_text, cta_location
    book_call_click   Calendly booking links      link_url, cta_text, cta_location
    free_audit_click  links to the free audit     link_url, cta_text, cta_location
                      form (/#review-form)
    cta_click         other buttons and CTAs      link_url, cta_text, cta_location
  And from script.js on the homepage:
    overview_video_start, overview_video_complete   the hero video
    review_form_start                               first keystroke in the free audit form
    generate_lead                                   free audit request sent
*/
(function () {
  var GA4_ID = 'G-WJL1CE5Z1Z';
  var GTM_ID = 'GTM-M6S6RWJP';

  window.dataLayer = window.dataLayer || [];
  var useGA4 = /^G-[A-Z0-9]+$/.test(GA4_ID);
  var useGTM = /^GTM-[A-Z0-9]+$/.test(GTM_ID);
  if (!useGA4 && !useGTM) return;

  function load(src) {
    var s = document.createElement('script');
    s.async = true;
    s.src = src;
    document.head.appendChild(s);
  }

  function gtag() { window.dataLayer.push(arguments); }
  if (useGTM) {
    window.dataLayer.push({'gtm.start': Date.now(), event: 'gtm.js'});
    load('https://www.googletagmanager.com/gtm.js?id=' + GTM_ID);
  }
  if (useGA4) {
    window.gtag = gtag;
    load('https://www.googletagmanager.com/gtag/js?id=' + GA4_ID);
    gtag('js', new Date());
    gtag('config', GA4_ID);
  }

  function send(name, params) {
    if (useGA4) gtag('event', name, params);
    if (useGTM) window.dataLayer.push(Object.assign({event: name}, params));
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
    else if (/#review(-form)?$/.test(href)) send('free_audit_click', params);
    else if (link.matches('.button, .header-cta, .text-link, .film-cta')) send('cta_click', params);
  }, true);
})();
