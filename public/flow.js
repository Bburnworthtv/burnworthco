/*
  "Explore my options": the question flow that replaces the free audit form.

  Three tap questions (what you want help with, where leads come from today, whether
  there is a website), a short recommendation built from the answers, then name and
  email. It posts to /api/review-request.

  Where it appears
    Inline   on the homepage (#review-form), on /start and on the AI search
             service page. The form is real HTML in those pages, written by
             scripts/sync_partials.js from render() below, so it paints with the
             page and still works as a plain form if this script never loads. A
             page can answer the first question for the visitor (render's
             "interest"), as the AI search page does.
    Modal    on every page. Any link with data-flow-open (they point at /start, so
             they work without JavaScript) opens the same flow in place. Add
             data-flow-interest="website|seo|ads|unsure" to skip the first question.
    Phones   a "Explore my options" bar fixed to the bottom once the visitor scrolls.

  To change a question or an answer: edit FLOW here, add the same value to the
  labels in api/review-request.js, then run  node scripts/sync_partials.js.

  Events (analytics.js sends them to GA4, Tag Manager and the Meta Pixel):
    flow_view          the flow came on screen or the modal opened   placement, trigger
    flow_start         first answer given                            placement
    flow_step          a question answered                           placement, step, question, answer
    flow_contact_view  reached the name and email step               placement, recommendation
    review_form_start  first keystroke in name or email              form: options_flow
    generate_lead      request sent                                  form: options_flow, placement, interest, lead_source, site
    flow_dismiss       modal closed before sending                   step
    flow_error         a send failed                                 reason
*/
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) { module.exports = api; return; }
  try { api.boot(root); } catch (error) {
    // Anything unexpected: show the plain form rather than a flow that cannot move.
    if (root.document) root.document.documentElement.classList.add('flow-plain');
    if (root.console) root.console.error(error);
  }
})(typeof window !== 'undefined' ? window : this, function () {
  'use strict';

  var EMAIL = 'Brandon@burnworthco.com';
  var PHONE_HREF = 'tel:+12088812382';
  var PHONE_TEXT = '(208) 881-2382';
  var BOOKING = 'https://calendly.com/bburnworthtv/30min';

  var ICONS = {
    site: '<rect x="3" y="4.5" width="18" height="15" rx="2.5"/><path d="M3 9h18M6.5 6.8h.01M9.2 6.8h.01"/>',
    search: '<circle cx="10.5" cy="10.5" r="6"/><path d="m15 15 5.5 5.5"/>',
    ads: '<path d="M4 10v4a1 1 0 0 0 1 1h2l5 4V5L7 9H5a1 1 0 0 0-1 1Z"/><path d="M16 9a4 4 0 0 1 0 6M18.5 6.5a7.5 7.5 0 0 1 0 11"/>',
    compass: '<circle cx="12" cy="12" r="8.5"/><path d="m15.2 8.8-1.9 4.5-4.5 1.9 1.9-4.5 4.5-1.9Z"/>',
    people: '<circle cx="9" cy="8.5" r="3"/><path d="M3.5 19a5.5 5.5 0 0 1 11 0"/><circle cx="17" cy="9.5" r="2.3"/><path d="M16 14.2a4.5 4.5 0 0 1 4.8 4.5"/>',
    pin: '<path d="M12 21s6.5-5.6 6.5-11a6.5 6.5 0 0 0-13 0c0 5.4 6.5 11 6.5 11Z"/><circle cx="12" cy="10" r="2.4"/>',
    social: '<rect x="4" y="4" width="16" height="16" rx="4.5"/><circle cx="12" cy="12" r="3.5"/><path d="M16.6 7.4h.01"/>',
    list: '<path d="M8.5 7H20M8.5 12H20M8.5 17H20M4.5 7h.01M4.5 12h.01M4.5 17h.01"/>',
    sprout: '<path d="M12 20v-8"/><path d="M12 12c0-3 2-5 6-5 0 3-2 5-6 5Z"/><path d="M12 14.2c0-2.5-1.7-4.2-5-4.2 0 2.5 1.7 4.2 5 4.2Z"/>',
    ok: '<circle cx="12" cy="12" r="8.5"/><path d="m8.5 12.2 2.4 2.4 4.6-5"/>',
    warn: '<path d="M12 4.5 3.5 19h17L12 4.5Z"/><path d="M12 10.5v4M12 16.9h.01"/>',
    plus: '<circle cx="12" cy="12" r="8.5"/><path d="M12 8.5v7M8.5 12h7"/>'
  };

  // The questions. Values are what the server receives; keep them in step with
  // the labels in api/review-request.js.
  var FLOW = {
    steps: [
      {
        key: 'interest',
        title: 'What do you want help with first?',
        options: [
          { v: 'website', label: 'A new or better website', icon: 'site' },
          { v: 'seo', label: 'Showing up on Google and Maps', icon: 'search' },
          { v: 'ads', label: 'Paid ads that pay off', icon: 'ads' },
          { v: 'unsure', label: 'Not sure yet. Show me my options', icon: 'compass' }
        ]
      },
      {
        key: 'lead_source',
        title: 'Where do most of your leads come from today?',
        options: [
          { v: 'referrals', label: 'Word of mouth and referrals', icon: 'people' },
          { v: 'google', label: 'Google search or Maps', icon: 'pin' },
          { v: 'paid_ads', label: 'Paid ads', icon: 'ads' },
          { v: 'social', label: 'Instagram or Facebook', icon: 'social' },
          { v: 'lead_sites', label: 'Lead sites like Angi, Thumbtack or Yelp', icon: 'list' },
          { v: 'none', label: 'Not many leads yet', icon: 'sprout' }
        ]
      },
      {
        key: 'site',
        title: 'Do you have a website right now?',
        options: [
          { v: 'working', label: 'Yes, and it brings in work', icon: 'ok' },
          { v: 'weak', label: 'Yes, but it does not bring in much', icon: 'warn' },
          { v: 'none', label: 'Not yet', icon: 'plus' }
        ]
      }
    ],
    // Shown as the heading of the last step when the script cannot build a
    // recommendation, and under the recommendation when it can.
    contactTitle: 'Where should we send your free audit?',
    contactAsk: 'Where should we send it?'
  };

  function esc(value) {
    return String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function icon(name) {
    return '<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">' + ICONS[name] + '</svg>';
  }

  // What the audit will cover, chosen from the answers. Plain statements about
  // the work, never a promised result.
  var SEARCH_POINTS = ['Where you show up on Google, Maps and AI answers today', 'The searches your competitors win and you do not', 'The first three fixes, in order'];
  var PLANS = {
    build: { id: 'build', title: 'Start with a website built to bring in work.', points: ['The pages your customers expect to find', 'What people nearby search for before they call', 'A scoped price. Most builds run $2,000 to $5,000'] },
    fix: { id: 'fix', title: 'Fix the website that is costing you calls.', points: ['What stops visitors from calling or asking for an estimate', 'How the site loads and reads on a phone', 'What to keep, what to fix and what a rebuild would cost'] },
    tune: { id: 'tune', title: 'Make a good website work harder.', points: ['What stops visitors from calling or asking for an estimate', 'How the site loads and reads on a phone', 'The pages worth adding next'] },
    search: { id: 'search', title: 'Get found for the jobs you want more of.', points: SEARCH_POINTS },
    reach: { id: 'reach', title: 'Get found by people who do not know you yet.', points: SEARCH_POINTS },
    own: { id: 'own', title: 'Own your leads instead of renting them.', points: ['Where you show up on Google, Maps and AI answers today', 'What it would take to bring in leads of your own', 'The first three fixes, in order'] },
    ads: { id: 'ads', title: 'Make every ad click count.', points: ['Where your ad clicks land, and why visitors leave', 'Whether calls and forms are being tracked', 'Whether search could lower what a lead costs you'] },
    attention: { id: 'attention', title: 'Turn the attention you already have into calls.', points: ['Where your clicks land, and why visitors leave', 'Whether calls and forms are being tracked', 'Where you show up on Google, Maps and AI answers today'] }
  };
  var CONTEXT = {
    referrals: 'Referrals are the best leads there are. They just do not arrive on demand.',
    google: 'You are already being found. The audit shows which searches you are missing.',
    paid_ads: 'We will look at where those clicks land and what happens next.',
    social: 'Social earns attention. We will check that your site turns it into calls.',
    lead_sites: 'Leads from those sites are often shared with other businesses. Leads from your own website are yours.',
    none: 'Then the first job is one reliable source of leads.'
  };
  function recommend(a) {
    a = a || {};
    var plan;
    if (a.site === 'none') plan = PLANS.build;
    else if (a.interest === 'website') plan = a.site === 'working' ? PLANS.tune : PLANS.fix;
    else if (a.interest === 'seo') plan = PLANS.search;
    else if (a.interest === 'ads') plan = PLANS.ads;
    else if (a.lead_source === 'lead_sites') plan = PLANS.own;
    else if (a.lead_source === 'paid_ads' || a.lead_source === 'social') plan = PLANS.attention;
    else if (a.lead_source === 'google') plan = PLANS.search;
    else plan = PLANS.reach;
    return { id: plan.id, title: plan.title, points: plan.points, context: CONTEXT[a.lead_source] || '' };
  }

  // The form. opts: placement (hero | landing | service | modal), page (path the
  // plain form returns to without JavaScript), interest (first answer chosen for
  // the visitor: the flow then opens on the second question).
  function render(opts) {
    opts = opts || {};
    var placement = opts.placement || 'hero';
    var total = FLOW.steps.length;
    var chosen = FLOW.steps[0].options.some(function (option) { return option.v === opts.interest; }) ? opts.interest : '';
    var out = [];
    out.push('<form class="flow" action="/api/review-request" method="post" data-flow data-placement="' + esc(placement) + '"' + (chosen ? ' data-interest="' + esc(chosen) + '"' : '') + '>');
    if (placement !== 'modal') out.push('<p class="flow-plain-error" id="send-error">Your request could not be sent. Please email <a href="mailto:' + EMAIL + '">' + EMAIL + '</a> or call <a href="' + PHONE_HREF + '">' + PHONE_TEXT + '</a>.</p>');
    out.push('<div class="flow-top">');
    out.push('<button class="flow-back" type="button" data-flow-back hidden><span class="icon-right" aria-hidden="true"></span><span class="sr">Back to the previous question</span></button>');
    out.push('<p class="flow-count" data-flow-count>Question 1 of ' + total + '</p>');
    out.push('<div class="flow-progress" aria-hidden="true"><span data-flow-bar></span></div>');
    out.push('</div>');
    out.push('<div class="flow-stage" data-flow-stage>');
    FLOW.steps.forEach(function (step, index) {
      out.push('<fieldset class="flow-step' + (index === 0 ? ' is-active' : '') + '" data-step="' + step.key + '">');
      out.push('<legend class="flow-q" tabindex="-1">' + esc(step.title) + '</legend>');
      out.push('<div class="flow-options flow-options-' + step.options.length + '">');
      step.options.forEach(function (option) {
        out.push('<label class="flow-option"><input type="radio" name="' + step.key + '" value="' + option.v + '"' + (index === 0 && option.v === chosen ? ' checked' : '') + '>' +
          '<span class="flow-ico">' + icon(option.icon) + '</span><span class="flow-label">' + esc(option.label) + '</span><span class="flow-tick" aria-hidden="true"></span></label>');
      });
      out.push('</div>');
      out.push('<button class="flow-next" type="button" data-flow-next hidden>Continue<span class="icon-right" aria-hidden="true"></span></button>');
      out.push('</fieldset>');
    });
    out.push('<fieldset class="flow-step flow-contact" data-step="contact">');
    out.push('<legend class="flow-q" tabindex="-1" data-flow-title>' + esc(FLOW.contactTitle) + '</legend>');
    out.push('<div class="flow-result" data-flow-result hidden></div>');
    out.push('<p class="flow-ask" data-flow-ask hidden>' + esc(FLOW.contactAsk) + '</p>');
    out.push('<div class="flow-fields">');
    out.push('<label class="flow-field">Name<input name="name" autocomplete="name" required maxlength="100"></label>');
    out.push('<label class="flow-field">Email<input type="email" name="email" autocomplete="email" inputmode="email" required maxlength="200"></label>');
    out.push('<label class="flow-field" data-flow-website>Website <span>(if you have one)</span><input name="website" inputmode="url" autocomplete="url" autocapitalize="none" spellcheck="false" placeholder="yourbusiness.com" maxlength="300"></label>');
    out.push('<label class="flow-field">Phone <span>(optional)</span><input type="tel" name="phone" autocomplete="tel" inputmode="tel" maxlength="40"></label>');
    out.push('</div>');
    // The field visitors cannot see (spam check). Its name has to mean nothing to a
    // browser's autofill or a password manager, or they fill it in for real
    // people: keep it the same as HIDDEN_FIELD in api/_deliver.js.
    out.push('<label class="hp" aria-hidden="true">Leave this empty<input name="bw_check" tabindex="-1" autocomplete="off" data-1p-ignore data-lpignore="true" data-bwignore data-form-type="other"></label>');
    out.push('<input type="hidden" name="started" value=""><input type="hidden" name="source" value="flow"><input type="hidden" name="placement" value="' + esc(placement) + '"><input type="hidden" name="page" value="' + esc(opts.page || '') + '">');
    out.push('<button class="button primary flow-submit" type="submit">Get my free audit<span class="icon-right" aria-hidden="true"></span></button>');
    out.push('<p class="form-status" role="status" aria-live="polite"></p>');
    out.push('<p class="form-fine">Free, with no obligation. Brandon reads every request. We use your details to reply, as our <a href="/privacy">privacy policy</a> explains.</p>');
    out.push('</fieldset>');
    out.push('</div>');
    out.push('</form>');
    return out.join('\n');
  }

  // Copied into the page as text by scripts/sync_partials.js and run straight
  // after an inline form, before the page is first painted. When the first answer
  // is already known (the page chose it, or an ad's link did with ?v=), the form
  // opens on the second question instead of jumping to it once this file has
  // loaded. boot() then finds the form where it would have put it. It must stay
  // self-contained, with no line comments inside: it is written out on one line.
  function early(form) {
    try {
      var asked = new URLSearchParams(location.search).get('v');
      if (asked === 'ai') asked = 'seo';
      var pick = function (value) { return /^[a-z_]+$/.test(value || '') ? form.querySelector('input[name="interest"][value="' + value + '"]') : null; };
      var input = pick(asked) || pick(form.getAttribute('data-interest'));
      var saved = {};
      try { saved = JSON.parse(sessionStorage.getItem('bw_flow') || '{}') || {}; } catch (e) {}
      var steps = form.querySelectorAll('[data-step]');
      if (!input || steps.length < 3 || saved.sent || (saved.a && saved.a.interest)) return;
      input.checked = true;
      steps[0].classList.remove('is-active');
      steps[1].classList.add('is-active');
      form.querySelector('[data-flow-back]').hidden = false;
      form.querySelector('[data-flow-count]').textContent = 'Question 2 of ' + (steps.length - 1);
      form.querySelector('[data-flow-bar]').style.transform = 'scaleX(' + 2 / steps.length + ')';
      var card = form.closest('.flow-card');
      if (card) card.classList.add('is-under-way');
    } catch (e) {}
  }

  function boot(window) {
    var document = window.document;
    if (!document || !document.querySelector) return;
    var docEl = document.documentElement;
    var track = function (name, params) { if (window.bwTrack) window.bwTrack(name, params || {}); };
    var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var finePointer = window.matchMedia && window.matchMedia('(hover: hover) and (pointer: fine)').matches;
    var STORE = 'bw_flow';
    var ATTR = 'bw_attr';
    var POPUP = 'bw_audit_popup'; // also read by older pages; "sent" or the time it was last closed
    var QUIET_DAYS = 14;
    var total = FLOW.steps.length;
    var fallback = 'Please email <a href="mailto:' + EMAIL + '">' + EMAIL + '</a> or call <a href="' + PHONE_HREF + '">' + PHONE_TEXT + '</a>.';

    var session = {
      get: function (key) { try { return JSON.parse(window.sessionStorage.getItem(key)); } catch (e) { return null; } },
      set: function (key, value) { try { window.sessionStorage.setItem(key, JSON.stringify(value)); } catch (e) {} }
    };
    var local = {
      get: function (key) { try { return window.localStorage.getItem(key); } catch (e) { return null; } },
      set: function (key, value) { try { window.localStorage.setItem(key, value); } catch (e) {} }
    };

    // Where this visit came from, kept for the session and sent with the request
    // so each lead shows which ad or page produced it.
    var attribution = session.get(ATTR);
    if (!attribution) {
      attribution = { landing: window.location.pathname };
      try {
        var query = new URLSearchParams(window.location.search);
        ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term'].forEach(function (key) {
          var value = query.get(key);
          if (value) attribution[key] = value.slice(0, 120);
        });
        if (query.get('fbclid')) attribution.ad_click = 'meta';
        else if (query.get('gclid') || query.get('gbraid') || query.get('wbraid')) attribution.ad_click = 'google';
        if (document.referrer) {
          var host = new URL(document.referrer).hostname;
          if (host && host !== window.location.hostname) attribution.referrer = host.slice(0, 120);
        }
      } catch (e) {}
      session.set(ATTR, attribution);
    }

    var state = session.get(STORE) || {};
    state.a = state.a || {};
    var remember = function () { session.set(STORE, state); };
    var instances = [];
    // When this page loaded. Every copy of the form is stamped with it: the server
    // marks a request sent within seconds of the page loading as possible spam,
    // and the pop-up, which is built when it is first opened, must not look new.
    var pageLoadedAt = String(Date.now());
    // A page can hold two copies of the flow (the one in the page and the pop-up)
    // and they share one set of answers. When one copy changes an answer, the
    // others show it too.
    var share = function (from) { instances.forEach(function (instance) { if (instance !== from) instance.sync(); }); };

    function Flow(form) {
      var self = this;
      var placement = form.getAttribute('data-placement') || 'hero';
      var stage = form.querySelector('[data-flow-stage]');
      var steps = Array.prototype.slice.call(form.querySelectorAll('[data-step]'));
      var count = form.querySelector('[data-flow-count]');
      var bar = form.querySelector('[data-flow-bar]');
      var back = form.querySelector('[data-flow-back]');
      var status = form.querySelector('.form-status');
      var submit = form.querySelector('.flow-submit');
      var result = form.querySelector('[data-flow-result]');
      var title = form.querySelector('[data-flow-title]');
      var ask = form.querySelector('[data-flow-ask]');
      var websiteField = form.querySelector('[data-flow-website]');
      var card = form.closest('.flow-card');
      var current = 0;
      var started = false;
      var typed = false;
      var sending = false;

      form.noValidate = true;
      form.elements.started.value = pageLoadedAt;
      form.elements.page.value = window.location.pathname;
      this.form = form;
      this.placement = placement;

      function setHeight(from) {
        if (reduce || !stage || from == null) return;
        stage.style.height = 'auto';
        var to = stage.offsetHeight;
        if (Math.abs(to - from) < 2) { stage.style.height = ''; return; }
        stage.style.height = from + 'px';
        stage.offsetHeight; // commit the starting height before animating
        stage.classList.add('is-sizing');
        stage.style.height = to + 'px';
        var clear = function () { stage.classList.remove('is-sizing'); stage.style.height = ''; stage.removeEventListener('transitionend', onEnd); };
        var onEnd = function (event) { if (event.target === stage) clear(); };
        stage.addEventListener('transitionend', onEnd);
        window.setTimeout(clear, 600);
      }

      // Show the shared answers in this form. Returns the first question still open.
      function fill() {
        var firstOpen = 0;
        FLOW.steps.forEach(function (step, i) {
          var value = state.a[step.key];
          var input = value && form.querySelector('input[name="' + step.key + '"][value="' + value + '"]');
          if (input) { input.checked = true; if (firstOpen === i) firstOpen = i + 1; }
        });
        return firstOpen;
      }
      // The other way round: the answers this form shows become the shared ones.
      // Run before the answers are used, so a request always carries what the form
      // it was sent from shows.
      function read() {
        var changed = false;
        FLOW.steps.forEach(function (step) {
          var input = form.querySelector('input[name="' + step.key + '"]:checked');
          if (input && state.a[step.key] !== input.value) { state.a[step.key] = input.value; changed = true; }
        });
        if (changed) { remember(); share(self); }
      }

      // The last step opens with where we would start, built from the answers.
      function showResult() {
        var plan = recommend(state.a);
        title.innerHTML = '<span class="flow-kicker">Where we would start</span>' + esc(plan.title);
        result.innerHTML = (plan.context ? '<p class="flow-result-context">' + esc(plan.context) + '</p>' : '') +
          '<p class="flow-result-lead">Your free audit will show:</p><ul>' + plan.points.map(function (point) { return '<li>' + esc(point) + '</li>'; }).join('') + '</ul>';
        result.hidden = false;
        ask.hidden = false;
        if (websiteField) websiteField.hidden = state.a.site === 'none';
        return plan;
      }

      // Keep the card in view after a step changes its height: the top under the
      // header, and the whole card on screen when it fits.
      function keepInView() {
        if (form.closest('dialog')) return;
        var box = (card || form).getBoundingClientRect();
        var room = 92;
        var move = 0;
        if (box.top < room - 30) move = box.top - room;
        else if (box.bottom > window.innerHeight - 14) move = Math.min(box.bottom - window.innerHeight + 14, box.top - room);
        if (Math.abs(move) > 6) window.scrollTo({ top: window.scrollY + move, behavior: reduce ? 'auto' : 'smooth' });
      }

      function go(index, direction, options) {
        options = options || {};
        index = Math.max(0, Math.min(steps.length - 1, index));
        var from = stage ? stage.offsetHeight : null;
        var contact = index === total;
        if (contact) {
          read();
          var plan = showResult();
          if (!options.quiet) track('flow_contact_view', { placement: placement, recommendation: plan.id });
        }
        steps.forEach(function (step, i) { step.classList.toggle('is-active', i === index); });
        form.setAttribute('data-dir', direction || 'forward');
        if (card) card.classList.toggle('is-under-way', index > 0);
        current = index;
        back.hidden = index === 0;
        count.textContent = contact ? 'Last step' : 'Question ' + (index + 1) + ' of ' + total;
        bar.style.transform = 'scaleX(' + (index + 1) / (total + 1) + ')';
        if (!contact) {
          var next = steps[index].querySelector('[data-flow-next]');
          if (next) next.hidden = !steps[index].querySelector('input:checked');
        }
        status.textContent = '';
        status.classList.remove('error');
        if (!options.instant) setHeight(from);
        state.step = index;
        remember();
        if (options.focus !== false) {
          var target = contact && finePointer ? form.elements.name : steps[index].querySelector('.flow-q');
          if (target) { try { target.focus({ preventScroll: true }); } catch (e) { target.focus(); } }
          window.setTimeout(keepInView, reduce ? 0 : 480);
        }
      }

      function answer(input) {
        var key = input.name;
        var index = -1;
        FLOW.steps.forEach(function (step, i) { if (step.key === key) index = i; });
        if (index < 0) return;
        state.a[key] = input.value;
        remember();
        share(self);
        if (!started) { started = true; track('flow_start', { placement: placement }); }
        track('flow_step', { placement: placement, step: index + 1, question: key, answer: input.value });
        var next = steps[index].querySelector('[data-flow-next]');
        if (next) next.hidden = false;
      }

      steps.forEach(function (step, index) {
        if (index >= total) return;
        step.addEventListener('change', function (event) {
          if (event.target && event.target.type === 'radio') answer(event.target);
        });
        // A tap or a mouse click moves on by itself. A choice made from the keyboard
        // waits for Continue, so arrow keys can still browse the answers.
        var pointerAt = 0;
        step.addEventListener('pointerdown', function () { pointerAt = Date.now(); });
        step.addEventListener('keydown', function () { pointerAt = 0; });
        step.addEventListener('click', function (event) {
          var input = event.target;
          // A click on the label is passed on to its radio; act on that second click.
          if (!input || input.type !== 'radio' || Date.now() - pointerAt > 1200) return;
          window.setTimeout(function () { if (input.checked && current === index) go(index + 1, 'forward'); }, reduce ? 0 : 240);
        });
        var next = step.querySelector('[data-flow-next]');
        if (next) next.addEventListener('click', function () { if (step.querySelector('input:checked')) go(index + 1, 'forward'); });
      });
      back.addEventListener('click', function () { go(current - 1, 'back'); });

      form.addEventListener('input', function (event) {
        if (!typed && event.target && /^(name|email|website|phone)$/.test(event.target.name)) {
          typed = true;
          form.setAttribute('data-started', '1');
          track('review_form_start', { form: 'options_flow', placement: placement });
        }
        if (event.target && event.target.getAttribute('aria-invalid')) { event.target.removeAttribute('aria-invalid'); event.target.removeAttribute('aria-describedby'); }
      });

      // Errors are announced (the status line is a live region) and tied to the
      // field they are about.
      status.id = 'flow-status-' + placement;
      function fail(message, field) {
        status.classList.add('error');
        status.innerHTML = message;
        if (field) { field.setAttribute('aria-invalid', 'true'); field.setAttribute('aria-describedby', status.id); field.focus(); }
      }

      function done(name, quiet) {
        var first = String(name || '').trim().split(/\s+/)[0] || '';
        var panel = document.createElement('div');
        panel.className = 'flow-done';
        panel.tabIndex = -1;
        panel.innerHTML = '<svg class="flow-done-mark" viewBox="0 0 56 56" width="56" height="56" aria-hidden="true" focusable="false"><circle cx="28" cy="28" r="25"/><path d="m17.5 28.8 7.2 7.2L39 21"/></svg>' +
          '<h3>' + (first ? 'Got it, ' + esc(first) + '.' : 'Request received.') + '</h3>' +
          '<p>Brandon reads every request personally and will email your free audit. Want to talk sooner?</p>' +
          '<a class="button primary" href="' + BOOKING + '">Book a 30-minute call<span class="icon-ne" aria-hidden="true"></span></a>' +
          '<p class="flow-done-alt">Or call <a href="' + PHONE_HREF + '">' + PHONE_TEXT + '</a></p>';
        var from = form.offsetHeight;
        if (card) card.classList.add('is-under-way');
        form.classList.add('is-done');
        form.innerHTML = '';
        form.appendChild(panel);
        if (!quiet) {
          if (!reduce) {
            form.style.height = from + 'px';
            form.offsetHeight;
            form.style.transition = 'height .45s cubic-bezier(.2,.7,.2,1)';
            form.style.height = panel.offsetHeight + 'px';
            window.setTimeout(function () { form.style.height = ''; form.style.transition = ''; }, 500);
          }
          try { panel.focus({ preventScroll: true }); } catch (e) {}
        }
      }
      this.done = done;

      form.addEventListener('submit', function (event) {
        event.preventDefault();
        if (sending) return;
        if (current < total) {
          if (steps[current].querySelector('input:checked')) go(current + 1, 'forward');
          return;
        }
        var name = form.elements.name;
        var email = form.elements.email;
        if (!name.value.trim()) return fail('Please add your name.', name);
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.value.trim())) return fail('Please check your email address.', email);

        read();
        var body = {};
        Array.prototype.forEach.call(form.elements, function (field) {
          if (!field.name || field.type === 'radio') return;
          body[field.name] = field.value;
        });
        FLOW.steps.forEach(function (step) { if (state.a[step.key]) body[step.key] = state.a[step.key]; });
        Object.keys(attribution).forEach(function (key) { body[key] = attribution[key]; });
        body.page = window.location.pathname;

        sending = true;
        submit.disabled = true;
        status.classList.remove('error');
        status.textContent = 'Sending…';
        var finish = function () { sending = false; submit.disabled = false; };
        window.fetch(form.action, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify(body)
        }).then(function (response) {
          return response.json().catch(function () { return {}; }).then(function (data) { return { ok: response.ok && data.ok, data: data }; });
        }).then(function (reply) {
          finish();
          if (reply.ok) {
            state.sent = true;
            state.name = name.value.trim();
            remember();
            local.set(POPUP, 'sent');
            track('generate_lead', { form: 'options_flow', placement: placement, interest: state.a.interest || '', lead_source: state.a.lead_source || '', site: state.a.site || '' });
            instances.forEach(function (instance) { instance.done(state.name, instance !== self); });
            docEl.classList.add('flow-sent');
          } else if (reply.data.error === 'invalid') {
            track('flow_error', { reason: 'invalid' });
            fail('Please check your name and email address.', (reply.data.fields || [])[0] === 'name' ? name : email);
          } else {
            track('flow_error', { reason: reply.data.error || 'server' });
            fail('Your request could not be sent right now. ' + fallback);
          }
        }).catch(function () {
          finish();
          track('flow_error', { reason: 'network' });
          fail('Your request could not be sent right now. ' + fallback);
        });
      });

      // Put back the answers given earlier in this visit (another page, or a reload).
      this.restore = function (options) {
        if (form.classList.contains('is-done')) return;
        if (state.sent) return done(state.name, true);
        options = options || {};
        if (options.interest && state.a.interest !== options.interest) { state.a.interest = options.interest; remember(); share(self); }
        var firstOpen = fill();
        var target = options.interest ? Math.max(1, firstOpen) : (options.resume ? firstOpen : Math.min(firstOpen, state.step || 0));
        go(target, 'forward', { instant: true, focus: false, quiet: true });
      };
      // Another copy of the flow changed an answer: show it here as well.
      this.sync = function () {
        if (form.classList.contains('is-done')) return;
        fill();
        if (current === total) showResult();
        else {
          var next = steps[current].querySelector('[data-flow-next]');
          if (next) next.hidden = !steps[current].querySelector('input:checked');
        }
      };
      this.focus = function () {
        var target = form.querySelector('.flow-done') || (steps[current] && steps[current].querySelector('.flow-q'));
        if (target) { try { target.focus({ preventScroll: true }); } catch (e) {} }
      };
      this.step = function () { return current; };
    }

    function mount(form) {
      var instance = new Flow(form);
      instances.push(instance);
      return instance;
    }

    // An ad can answer the first question in its link: /start?v=website, ?v=seo,
    // ?v=ads or ?v=ai (AI search is part of the SEO work, so it counts as "seo").
    // The landing page shows a matching headline for the same word.
    var preset = '';
    var isAnswer = function (value) { return FLOW.steps[0].options.some(function (option) { return option.v === value; }); };
    try {
      var asked = new URLSearchParams(window.location.search).get('v');
      if (asked === 'ai') asked = 'seo';
      if (isAnswer(asked)) preset = asked;
    } catch (e) {}

    // Inline flows already in the page. A page can also choose the first answer
    // itself (data-interest on the form); a link's ?v= wins over it, and an answer
    // the visitor already gave wins over both.
    var inline = Array.prototype.slice.call(document.querySelectorAll('form[data-flow]')).map(function (form) {
      var instance = mount(form);
      var first = preset || form.getAttribute('data-interest') || '';
      instance.restore(isAnswer(first) && !state.a.interest ? { interest: first } : {});
      return instance;
    });
    var inlineVisible = false;
    if (inline.length && 'IntersectionObserver' in window) {
      var seen = false;
      var watcher = new window.IntersectionObserver(function (entries) {
        inlineVisible = entries.some(function (entry) { return entry.isIntersecting; });
        if (inlineVisible && !seen) { seen = true; track('flow_view', { placement: inline[0].placement, trigger: 'page' }); }
        updateBar();
      }, { threshold: 0.25 });
      inline.forEach(function (instance) { watcher.observe(instance.form); });
    }
    // The plain form told the server which page to return to; show its outcome.
    try {
      var outcome = new URLSearchParams(window.location.search).get('review');
      if (outcome === 'sent' && inline.length) {
        state.sent = true; remember(); local.set(POPUP, 'sent');
        inline.forEach(function (instance) { instance.done(state.name, true); });
      } else if (outcome === 'error' && inline.length) {
        var note = inline[0].form.querySelector('.form-status');
        if (note) { note.classList.add('error'); note.innerHTML = 'Your request could not be sent. ' + fallback; }
      }
    } catch (e) {}

    // The modal, built on first use.
    var canModal = !!window.HTMLDialogElement;
    var dialog = null;
    var modal = null;
    var trigger = '';
    function buildDialog() {
      dialog = document.createElement('dialog');
      dialog.className = 'flow-dialog';
      dialog.setAttribute('aria-labelledby', 'flow-dialog-title');
      dialog.innerHTML = '<div class="flow-card">' +
        '<div class="flow-card-head"><p class="flow-card-title" id="flow-dialog-title">Explore your options</p><p class="flow-card-sub">Three quick questions, then a free audit.</p>' +
        '<button class="flow-close" type="button" data-flow-close aria-label="Close"><span aria-hidden="true"></span></button></div>' +
        render({ placement: 'modal', page: window.location.pathname }) + '</div>';
      document.body.appendChild(dialog);
      modal = mount(dialog.querySelector('form'));
      dialog.querySelector('[data-flow-close]').addEventListener('click', function () { dialog.close(); });
      // A click on the dimmed backdrop lands on the dialog element itself.
      dialog.addEventListener('click', function (event) { if (event.target === dialog) dialog.close(); });
      dialog.addEventListener('close', function () {
        docEl.classList.remove('flow-open');
        if (!state.sent) { local.set(POPUP, String(Date.now())); track('flow_dismiss', { step: modal.step() + 1, trigger: trigger }); }
        updateBar();
      });
    }
    function open(options) {
      options = options || {};
      if (!canModal) { window.location.href = '/start'; return; }
      if (!dialog) buildDialog();
      if (dialog.open) return;
      trigger = options.trigger || 'link';
      modal.restore({ interest: options.interest, resume: true });
      dialog.showModal();
      docEl.classList.add('flow-open');
      modal.focus();
      track('flow_view', { placement: 'modal', trigger: trigger });
      updateBar();
    }
    window.bwFlow = { open: open };

    document.addEventListener('click', function (event) {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      var link = event.target.closest && event.target.closest('[data-flow-open]');
      if (!link || !canModal) return;
      event.preventDefault();
      var interest = link.getAttribute('data-flow-interest') || '';
      // On a page with the flow already in view, use it rather than a second copy.
      if (inline.length && inlineVisible && !interest) {
        var card = inline[0].form.closest('.flow-card');
        if (card) { card.classList.remove('is-nudged'); card.offsetWidth; card.classList.add('is-nudged'); }
        inline[0].focus();
        return;
      }
      open({ interest: interest, trigger: link.closest('.sticky-cta') ? 'sticky' : 'link' });
    });

    // Phones: a bar fixed to the bottom once the visitor has scrolled.
    var barEl = null;
    var path = window.location.pathname.replace(/\/$/, '') || '/';
    var noPrompts = /^\/(start|thanks)$/.test(path);
    function updateBar() {
      if (!barEl) return;
      var doc = document.documentElement;
      var nearEnd = window.scrollY + window.innerHeight > doc.scrollHeight - 220;
      var show = window.scrollY > 520 && !inlineVisible && !nearEnd && !(dialog && dialog.open) && !docEl.classList.contains('menu-open') && !state.sent;
      barEl.classList.toggle('is-on', show);
      docEl.classList.toggle('has-sticky-cta', show);
    }
    if (!noPrompts && window.matchMedia('(max-width: 800px)').matches) {
      barEl = document.createElement('div');
      barEl.className = 'sticky-cta';
      barEl.innerHTML = '<a class="button primary" href="/start" data-flow-open>Explore my options<span class="icon-right" aria-hidden="true"></span></a>' +
        '<a class="sticky-call" href="' + PHONE_HREF + '" aria-label="Call ' + PHONE_TEXT + '"><svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M6.5 4h3l1.5 4-2 1.5a11 11 0 0 0 5.5 5.5l1.5-2 4 1.5v3a2 2 0 0 1-2.2 2A16 16 0 0 1 4.5 6.2a2 2 0 0 1 2-2.2Z"/></svg></a>';
      document.body.appendChild(barEl);
      var ticking = false;
      window.addEventListener('scroll', function () {
        if (ticking) return;
        ticking = true;
        window.requestAnimationFrame(function () { ticking = false; updateBar(); });
      }, { passive: true });
      updateBar();
    }

    // Desktop: offer the flow once when the pointer leaves through the top of the
    // window. Not on the landing pages, not beside the estimate form, not within
    // 14 days of closing it, and never after a request is sent.
    var last = local.get(POPUP);
    var quiet = last === 'sent' || (last && Date.now() - Number(last) < QUIET_DAYS * 864e5);
    if (canModal && finePointer && !noPrompts && !quiet && !document.querySelector('[data-estimate-form]')) {
      var loadedAt = Date.now();
      var onLeave = function (event) {
        if (event.relatedTarget || event.clientY > 0) return;
        if (Date.now() - loadedAt < 8000) return;
        if (state.sent || local.get(POPUP) || inlineVisible || (dialog && dialog.open)) return;
        if (inline.some(function (instance) { return instance.form.getAttribute('data-started'); })) return;
        document.removeEventListener('mouseout', onLeave);
        open({ trigger: 'exit_intent' });
      };
      document.addEventListener('mouseout', onLeave);
    }
  }

  return { FLOW: FLOW, render: render, recommend: recommend, early: early, boot: boot };
});
