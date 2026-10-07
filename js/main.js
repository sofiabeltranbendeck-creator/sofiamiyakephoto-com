// Sofia Miyake Photography — site behavior

// Signals that this file actually arrived and parsed. The inline script in each
// <head> adds the `js` class (which is what hides .reveal content) and then
// starts a timer; if that timer fires without seeing `js-ready`, it removes `js`
// again and everything becomes visible. Without this, a dropped request or a
// parse error here leaves 169 reveal elements stuck at opacity:0 site-wide —
// `html:not(.js)` only covers JavaScript being switched off, not this file
// failing to load.
document.documentElement.classList.add('js-ready');

document.addEventListener('DOMContentLoaded', function () {

  // Reveal-on-scroll
  var targets = document.querySelectorAll('.reveal, .reveal-group');
  if ('IntersectionObserver' in window && targets.length) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('in-view');
          io.unobserve(entry.target);
        }
      });
    // threshold:0 , NOT 0.15. A threshold is a percentage of the TARGET, so an
    // element taller than the root can never exceed root/element however far you
    // scroll - anything taller than root/0.15 is simply unreachable. The homepage
    // gallery stacks to one 3,721px column at 375px wide; on a 568px-tall phone
    // the root is 508px, capping the ratio at 0.1365, so it never revealed and the
    // visitor scrolled past 3,721px of blank page. With 0 it fires as soon as the
    // top edge clears the bottom margin, which is what -60px already expressed.
    }, { threshold: 0, rootMargin: '0px 0px -60px 0px' });
    targets.forEach(function (t) { io.observe(t); });
  } else {
    targets.forEach(function (t) { t.classList.add('in-view'); });
  }

  // Mobile nav toggle
  var header = document.querySelector('.header-inner');
  var nav = document.querySelector('.main-nav');
  if (header && nav) {
    var toggle = document.createElement('button');
    toggle.className = 'nav-toggle';
    toggle.setAttribute('aria-label', 'Toggle navigation');
    toggle.setAttribute('aria-expanded', 'false');
    toggle.setAttribute('aria-controls', 'site-nav');
    nav.id = 'site-nav';
    toggle.innerHTML = '<span></span><span></span><span></span>';
    header.insertBefore(toggle, nav);

    // Collapsed by max-height alone still leaves every link keyboard-focusable,
    // so the closed panel is also made inert. Only below the 700px breakpoint:
    // above it the nav is the ordinary horizontal bar and must stay reachable.
    var mq = window.matchMedia('(max-width:700px)');

    var measure = function () {
      var top = nav.getBoundingClientRect().top;
      var vh = (window.visualViewport && window.visualViewport.height) || window.innerHeight;
      nav.style.setProperty('--nav-available-height', Math.max(0, vh - top) + 'px');
    };

    var sync = function (open) {
      header.classList.toggle('nav-open', open);
      toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
      nav.inert = mq.matches && !open;
      if (open) measure();
    };

    sync(false);

    toggle.addEventListener('click', function () {
      sync(!header.classList.contains('nav-open'));
    });

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && header.classList.contains('nav-open')) {
        sync(false);
        toggle.focus();
      }
    });

    nav.querySelectorAll('a').forEach(function (link) {
      link.addEventListener('click', function () { sync(false); });
    });

    var onViewport = function () {
      if (header.classList.contains('nav-open')) measure();
      nav.inert = mq.matches && !header.classList.contains('nav-open');
    };
    window.addEventListener('resize', onViewport);
    if (mq.addEventListener) mq.addEventListener('change', onViewport);
    else if (mq.addListener) mq.addListener(onViewport);
  }

  // Nav dropdown accessibility (aria-expanded + click/touch toggle)
  document.querySelectorAll('.nav-group').forEach(function (group) {
    var btn = group.querySelector('.nav-group-toggle');
    if (!btn) return;
    btn.setAttribute('aria-haspopup', 'true');
    btn.setAttribute('aria-expanded', 'false');
    var sync = function (open) { btn.setAttribute('aria-expanded', open ? 'true' : 'false'); };
    group.addEventListener('mouseenter', function () { sync(true); });
    group.addEventListener('mouseleave', function () { sync(false); });
    group.addEventListener('focusin', function () { sync(true); });
    group.addEventListener('focusout', function () { sync(false); });
  });

  // Promo bar — the current offer, dismissed once and then stays gone.
  //
  // PROMO_ID is part of the storage key, so when the deal changes, bump it and
  // the bar comes back for everyone, including people who dismissed the last
  // one. A plain "promo-dismissed" key would silently hide every future offer
  // from your most engaged visitors.
  //
  // Every storage call is wrapped: Safari private mode throws on setItem, and
  // a thrown error here would stop the rest of this file from running.
  var PROMO_ID = 'fall-minis-2026';
  var promo = document.getElementById('promo-bar');
  if (promo) {
    var promoKey = 'promo-dismissed:' + PROMO_ID;
    var wasDismissed = false;
    try { wasDismissed = localStorage.getItem(promoKey) === '1'; } catch (e) {}
    if (!wasDismissed) promo.hidden = false;
    var promoClose = promo.querySelector('.promo-dismiss');
    if (promoClose) {
      promoClose.addEventListener('click', function () {
        promo.hidden = true;
        try { localStorage.setItem(promoKey, '1'); } catch (e) {}
      });
    }
  }

  // Hero carousel (homepage) — crossfading slides with dots
  document.querySelectorAll('[data-hero-carousel]').forEach(function (hero) {
    var slides = Array.prototype.slice.call(hero.querySelectorAll('.hero-slide'));
    if (slides.length < 2) return;

    var reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var DELAY = 3000;
    var index = 0, timer = null;

    var dots = document.createElement('div');
    dots.className = 'hero-dots';
    dots.setAttribute('role', 'tablist');
    dots.setAttribute('aria-label', 'Featured slides');

    var buttons = slides.map(function (slide, i) {
      var b = document.createElement('button');
      b.type = 'button';
      b.setAttribute('role', 'tab');
      var label = slide.getAttribute('data-label') || ('Slide ' + (i + 1));
      b.setAttribute('aria-label', label);
      b.setAttribute('aria-selected', i === 0 ? 'true' : 'false');
      b.addEventListener('click', function () { go(i); restart(); });
      dots.appendChild(b);
      return b;
    });
    hero.appendChild(dots);

    // All three slide backgrounds are CSS now, so there is nothing to apply
    // lazily. Kept as a no-op guard in case a slide ever carries data-bg again.
    function applyBg(slide) {
      var el = slide && slide.querySelector('.hero-bg[data-bg]');
      if (!el) return;
      el.style.backgroundImage = "url('" + el.dataset.bg + "')";
      el.removeAttribute('data-bg');
    }

    function go(n) {
      index = (n + slides.length) % slides.length;
      applyBg(slides[index]);
      slides.forEach(function (s, i) {
        s.classList.toggle('is-active', i === index);
        s.setAttribute('aria-hidden', i === index ? 'false' : 'true');
      });
      buttons.forEach(function (b, i) {
        b.setAttribute('aria-selected', i === index ? 'true' : 'false');
      });
    }

    // Rotation holds for keyboard focus inside the hero and for a hidden tab,
    // tracked separately so one releasing cannot override the other. Hovering
    // does not pause: the hero is 88vh, so on a desktop the pointer is over it
    // most of the time and a hover pause meant the carousel never advanced.
    var focusHeld = false;

    // The !timer guard matters: without it a second start() orphans the first
    // interval and runs a full-viewport crossfade forever.
    function canRun() { return !reduced && !focusHeld && !document.hidden; }
    function start() { if (canRun() && !timer) timer = setInterval(function () { go(index + 1); }, DELAY); }
    function stop() { if (timer) { clearInterval(timer); timer = null; } }
    function restart() { stop(); start(); }

    // Hold only for keyboard focus. A mouse click or tap also focuses a button,
    // and treating that as a hold froze the show after any click on a dot.
    hero.addEventListener('focusin', function (e) {
      var keyboard = true;
      try { keyboard = e.target.matches(':focus-visible'); } catch (err) {}
      if (!keyboard) return;
      focusHeld = true; stop();
    });
    hero.addEventListener('focusout', function (e) {
      // Ignore focus moving between controls inside the hero.
      if (e.relatedTarget && hero.contains(e.relatedTarget)) return;
      focusHeld = false; start();
    });
    document.addEventListener('visibilitychange', function () {
      if (document.hidden) { stop(); } else { start(); }
    });

    hero.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowLeft') { e.preventDefault(); go(index - 1); restart(); }
      if (e.key === 'ArrowRight') { e.preventDefault(); go(index + 1); restart(); }
    });

    go(0);
    start();

    // Warm the deferred slides once the page is idle, so the 1.1s crossfade
    // never plays against an empty slide. go() also applies on demand, which
    // covers a dot click that lands before this runs.
    var warm = function () { slides.forEach(applyBg); };
    if (window.requestIdleCallback) { requestIdleCallback(warm, { timeout: 3000 }); }
    else { setTimeout(warm, 2000); }
  });

  // Fade gallery (data-fade-gallery). Three photos on show; every 1.3 to 2.3
  // seconds one of the three frames, picked at random, crossfades to whichever
  // photo has been out of view longest, so every photo in the set takes its turn.
  // The incoming photo is fully decoded before its fade starts, so a frame never
  // flashes empty, and the one after it is fetched in the background meanwhile.
  // A frame under the mouse is skipped, not paused: the other two keep changing.
  // Runs only while the gallery is on screen in a visible tab. Without JavaScript,
  // or with reduced motion, every photo simply shows in the grid.
  document.querySelectorAll('[data-fade-gallery]').forEach(function (gallery) {
    if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    var SHOWN = 3, FADE = 900, SETTLE = 1600, FIRST = 500;   // ms; match the CSS
    var items = Array.prototype.slice.call(gallery.children);
    if (items.length <= SHOWN) return;
    var frames = items.slice(0, SHOWN);
    // The rest leave the page and wait in line: oldest first.
    var queue = items.slice(SHOWN).map(function (item) {
      var img = item.querySelector('img');
      gallery.removeChild(item);
      return img;
    });
    gallery.classList.add('is-live');

    var timer = 0, busy = false, onScreen = false, lastSlot = -1, hovered = null;
    var wait = function () { return 1300 + Math.random() * 1000; };
    var live = function () { return onScreen && !document.hidden; };
    function schedule(ms) {
      clearTimeout(timer);
      timer = live() ? setTimeout(swap, ms) : 0;
    }
    // Load and decode an image that is not in the page. Lazy images outside the
    // document never load, so it is switched to eager first. Gives up after 8s.
    function ready(img) {
      img.loading = 'eager';
      var done = img.decode ? img.decode() : new Promise(function (res, rej) {
        if (img.complete) { res(); } else { img.onload = res; img.onerror = rej; }
      });
      return Promise.race([done, new Promise(function (res, rej) { setTimeout(rej, 8000); })]);
    }
    function swap() {
      timer = 0;
      if (busy || !live()) return;
      busy = true;
      var incoming = queue.shift();
      ready(incoming).then(function () {
        busy = false;
        if (!live()) { queue.unshift(incoming); return; }   // left while it loaded
        var slots = [0, 1, 2].filter(function (i) { return i !== lastSlot && frames[i] !== hovered; });
        var slot = slots[Math.floor(Math.random() * slots.length)];
        var frame = frames[slot], outgoing = frame.querySelector('img');
        incoming.classList.add('fade-gallery-in');
        frame.appendChild(incoming);
        incoming.getBoundingClientRect();                     // commit opacity 0 before fading
        incoming.classList.add('is-shown');
        setTimeout(function () {                              // fully covered: drop it
          frame.removeChild(outgoing);
          queue.push(outgoing);
        }, FADE + 100);
        setTimeout(function () {                              // zoom settled: back to a plain photo
          incoming.classList.remove('fade-gallery-in', 'is-shown');
        }, SETTLE + 100);
        lastSlot = slot;
        if (queue[0]) ready(queue[0]).catch(function () {});  // fetch the next one now
        schedule(wait());
      }, function () {
        busy = false;                                         // failed to load: back of the line
        queue.push(incoming);
        schedule(wait());
      });
    }

    frames.forEach(function (frame) {
      frame.addEventListener('pointerenter', function (e) { if (e.pointerType === 'mouse') hovered = frame; });
      frame.addEventListener('pointerleave', function () { if (hovered === frame) hovered = null; });
    });
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (entries) {
        onScreen = entries[entries.length - 1].isIntersecting;
        if (onScreen) { if (!timer && !busy) schedule(FIRST); } else { clearTimeout(timer); timer = 0; }
      }, { threshold: 0.3 }).observe(gallery);
    } else { onScreen = true; schedule(FIRST); }
    document.addEventListener('visibilitychange', function () {
      if (document.hidden) { clearTimeout(timer); timer = 0; } else if (live() && !timer && !busy) schedule(FIRST);
    });
  });

});

// Meta Pixel conversion events
document.addEventListener('click', function (e) {
  if (typeof fbq !== 'function') { window.fbq = function () {}; }
  var a = e.target.closest && e.target.closest('a');
  if (!a || !a.href) return;
  var ga = (typeof gtag === 'function') ? gtag : function () {};
  if (a.href.indexOf('hbportal.co') !== -1) {
    fbq('track', 'Schedule'); // opened booking scheduler — NOT a completed inquiry.
                              // 'Lead' fires only on thank-you.html, after the form is submitted.
    ga('event', 'schedule_start', { method: 'honeybook_scheduler', link_url: a.href, page_location: location.href });
  } else if (a.href.indexOf('mailto:') === 0) {
    fbq('track', 'Contact');
    ga('event', 'contact_click', { method: 'email' });
  } else if (a.href.indexOf('tel:') === 0) {
    fbq('track', 'Contact');
    ga('event', 'contact_click', { method: 'phone' });
  }
});

// HoneyBook embed engagement.
//
// The schedulers and the inquiry form are cross-origin embeds, so clicks and
// submissions inside them never bubble to this document. The click handler above
// therefore only ever sees the secondary "Open scheduler in a new tab" anchors,
// not the embed most visitors actually use — which left the single highest-intent
// action on the site completely unmeasured.
//
// A click inside a cross-origin iframe blurs the parent window and makes that
// iframe document.activeElement. That is the one signal available from out here.
// It reports engagement, NOT a completed booking: the completion still happens on
// hbportal.co and only HoneyBook can confirm it.
(function () {
  var frames = document.querySelectorAll('iframe[src*="hbportal.co"], .hb-embed iframe');
  var placement = document.querySelector('[class^="hb-p-"], [class*=" hb-p-"]');
  if (!frames.length && !placement) return;

  var sent = {};
  // Once per kind per page, so touching the inquiry form does not swallow a later
  // scheduler report. Only the scheduler is a Meta 'Schedule': the contact form
  // is an inquiry, and counting it as a booking would corrupt that conversion.
  var report = function (which) {
    if (sent[which]) return;
    sent[which] = true;
    var ga = (typeof gtag === 'function') ? gtag : function () {};
    if (typeof fbq !== 'function') { window.fbq = function () {}; }
    if (which === 'honeybook_scheduler_embed') {
      fbq('track', 'Schedule');
      ga('event', 'scheduler_interact', { method: which, page_location: location.href });
    } else {
      fbq('trackCustom', 'InquiryFormInteract');
      ga('event', 'inquiry_form_interact', { method: which, page_location: location.href });
    }
  };

  window.addEventListener('blur', function () {
    var el = document.activeElement;
    if (!el || el.tagName !== 'IFRAME') return;
    var src = el.getAttribute('src') || '';
    if (src.indexOf('hbportal.co') !== -1) report('honeybook_scheduler_embed');
    else if (el.closest && el.closest('.hb-embed')) report('honeybook_form_embed');
  });
})();
