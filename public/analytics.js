/*
  Measurement for burnworthco.com. Loaded on every page.

    GA4_ID         GA4 measurement ID (G-XXXXXXXXXX). Loads gtag.js and sends page
                   views and the events below straight to GA4.
    GTM_ID         Tag Manager container ID (GTM-XXXXXXX). Loads the container, and
                   every event below is also pushed to the dataLayer as
                   {event: name, ...params} for GTM "Custom Event" triggers.
    META_PIXEL_ID  Meta Pixel ID (digits only, from Meta Events Manager). Loads the
                   pixel so Instagram and Facebook ads can count, and optimise for,
                   the leads they produce. Leave empty until you have the ID.
  Any of them can be left empty. Do not also add the same GA4 tag or the same
  pixel inside Tag Manager, or everything is counted twice.

  The pixel is not loaded for a visitor whose browser sends Global Privacy Control
  or Do Not Track; the privacy policy says so.

  Events (mark generate_lead, click_to_call, email_click, book_call_click and
  free_audit_click as key events in GA4):
    click_to_call      tel: links                       link_url, cta_text, cta_location
    email_click        mailto: links                    link_url, cta_text, cta_location
    book_call_click    Calendly booking links           link_url, cta_text, cta_location
    free_audit_click   links that open the question     link_url, cta_text, cta_location
                       flow ("Explore my options")
    cta_click          other buttons and calls to action
    page_not_found     the 404 page was shown           missing_path, came_from
  From flow.js, the question flow:
    flow_view, flow_start, flow_step, flow_contact_view, review_form_start,
    generate_lead (request sent), flow_dismiss, flow_error
  From script.js and estimate.js:
    overview_video_start, overview_video_complete, estimate_form_start,
    generate_lead (form: website_estimate)

  What the Meta Pixel is sent:
    every page          PageView
    generate_lead       Lead            the conversion to optimise ads for
    flow_start          FlowStart       custom: someone answered the first question
    flow_contact_view   FlowContact     custom: reached the name and email step
    book_call_click     Schedule
    click_to_call, email_click          Contact
  Only the event and the name of the form are sent, never an answer or a contact detail.
*/
(function () {
  var GA4_ID = 'G-WJL1CE5Z1Z';
  var GTM_ID = 'GTM-M6S6RWJP';
  var META_PIXEL_ID = '';

  window.dataLayer = window.dataLayer || [];
  var useGA4 = /^G-[A-Z0-9]+$/.test(GA4_ID);
  var useGTM = /^GTM-[A-Z0-9]+$/.test(GTM_ID);
  var optedOut = navigator.globalPrivacyControl === true || navigator.doNotTrack === '1' || window.doNotTrack === '1';
  var useMeta = /^\d{6,20}$/.test(META_PIXEL_ID) && !optedOut;

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
  if (useMeta) {
    // The standard pixel stub: calls queue here until fbevents.js has loaded.
    var fbq = window.fbq = function () { fbq.callMethod ? fbq.callMethod.apply(fbq, arguments) : fbq.queue.push(arguments); };
    if (!window._fbq) window._fbq = fbq;
    fbq.push = fbq;
    fbq.loaded = true;
    fbq.version = '2.0';
    fbq.queue = [];
    load('https://connect.facebook.net/en_US/fbevents.js');
    fbq('init', META_PIXEL_ID);
    fbq('track', 'PageView');
  }

  var META_EVENTS = {
    generate_lead: ['track', 'Lead'],
    book_call_click: ['track', 'Schedule'],
    click_to_call: ['track', 'Contact'],
    email_click: ['track', 'Contact'],
    flow_start: ['trackCustom', 'FlowStart'],
    flow_contact_view: ['trackCustom', 'FlowContact']
  };

  function send(name, params) {
    if (useGA4) gtag('event', name, params);
    if (useGTM) window.dataLayer.push(Object.assign({event: name}, params));
    if (useMeta && META_EVENTS[name]) {
      window.fbq(META_EVENTS[name][0], META_EVENTS[name][1], {content_name: (params && (params.form || params.placement)) || name});
    }
  }
  // Used by flow.js, script.js and estimate.js.
  window.bwTrack = function (name, params) { send(name, Object.assign({page_path: location.pathname}, params || {})); };

  // Where on the page the click happened.
  function locationOf(el) {
    if (el.closest('.sticky-cta')) return 'phone_bar';
    if (el.closest('dialog')) return 'dialog';
    if (el.closest('header.site-header')) return 'header';
    if (el.closest('footer')) return 'footer';
    var section = el.closest('section[id], section[class], nav[class]');
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
      cta_text: (link.innerText || link.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 100),
      cta_location: locationOf(link)
    };
    if (href.indexOf('tel:') === 0) send('click_to_call', params);
    else if (href.indexOf('mailto:') === 0) send('email_click', params);
    else if (href.indexOf('calendly.com') !== -1) send('book_call_click', params);
    else if (link.hasAttribute('data-flow-open') || /^\/start([?#]|$)/.test(href)) send('free_audit_click', params);
    else if (link.matches('.button, .header-call, .text-link, .route, .founder-chip, .link-list a')) send('cta_click', params);
  }, true);
})();
