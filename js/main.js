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

    // Phones: Bookings lives inside the collapsed menu, so a small "Book" pill sits
    // beside the menu button (style.css "Header Bookings pill"). Not on /bookings
    // itself, where the nav link is already marked active.
    var bookLink = nav.querySelector(':scope > a[href="/bookings"]');
    // Bookings ends the row, where every reference site puts its booking button; moving
    // the element (not just CSS order) keeps the tab order the same as the visual order.
    if (bookLink) nav.appendChild(bookLink);
    if (bookLink && !bookLink.classList.contains('active')) {
      var bookPill = document.createElement('a');
      bookPill.className = 'header-book';
      bookPill.href = '/bookings';
      bookPill.textContent = 'Book';
      header.insertBefore(bookPill, toggle);
    }

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
  //
  // PROMO_ENDS retires the bar by itself once the offer is over (the last mini
  // session is 25 Oct). The homepage's head script repeats both values to show the
  // bar before first paint (html.promo-on); keep the three in step.
  var PROMO_ID = 'fall-minis-2026';
  var PROMO_ENDS = Date.UTC(2026, 9, 26, 7);   // 26 Oct 2026, 00:00 Pacific
  var promo = document.getElementById('promo-bar');
  if (promo) {
    var promoKey = 'promo-dismissed:' + PROMO_ID;
    var wasDismissed = false;
    try { wasDismissed = localStorage.getItem(promoKey) === '1'; } catch (e) {}
    if (!wasDismissed && Date.now() < PROMO_ENDS) {
      promo.hidden = false;
      // A tab left open past the deadline retires the bar too: at the deadline, and on
      // coming back to the tab (hidden tabs can throttle or freeze timers).
      var retirePromo = function () {
        if (Date.now() < PROMO_ENDS || promo.hidden) return;
        var title = document.querySelector('.site-title a');
        if (title && promo.contains(document.activeElement)) title.focus({ preventScroll: true });
        promo.hidden = true;
        document.documentElement.classList.remove('promo-on');
      };
      if (PROMO_ENDS - Date.now() < 2147483647) setTimeout(retirePromo, PROMO_ENDS - Date.now() + 1000);
      document.addEventListener('visibilitychange', function () { if (!document.hidden) retirePromo(); });
    } else document.documentElement.classList.remove('promo-on');
    var promoClose = promo.querySelector('.promo-dismiss');
    if (promoClose) {
      promoClose.addEventListener('click', function () {
        // The button is about to disappear; move keyboard focus somewhere that stays.
        var title = document.querySelector('.site-title a');
        if (document.activeElement === promoClose && title) title.focus({ preventScroll: true });
        promo.hidden = true;
        document.documentElement.classList.remove('promo-on');
        try { localStorage.setItem(promoKey, '1'); } catch (e) {}
      });
    }
  }

  // Hero carousel (homepage): three slides, each a photograph with its own cream plate,
  // crossfading every 3s (Landin, 9 Oct: the three-slide cover back, the lead photo as it
  // was, the plate moving with each slide). Slides two and three fetch their photographs
  // only once the page has loaded (.is-armed), and the rotation waits until the next one
  // has arrived, so a slow phone never sees an empty frame or a slower lead photo.
  document.querySelectorAll('[data-hero-carousel]').forEach(function (hero) {
    var slides = Array.prototype.slice.call(hero.querySelectorAll('.hero-slide'));
    // A dated slide (the fall minis) is already hidden from the first paint once its date
    // has passed (html.minis-expired); leave it out of the rotation too.
    if (document.documentElement.classList.contains('minis-expired')) {
      slides = slides.filter(function (s) {
        if (!s.hasAttribute('data-expires')) return true;
        s.parentNode.removeChild(s);
        return false;
      });
    }
    if (slides.length < 2) return;

    var motion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)');
    var reduced = !!(motion && motion.matches);
    var DELAY = 3000;
    var index = 0, timer = 0, turn = 0;
    // Reduced motion switched on mid-visit stops the rotation (the fade itself is turned
    // off in CSS); switched off again, it resumes.
    if (motion) {
      var onMotion = function (e) { reduced = e.matches; if (reduced) stop(); else schedule(); };
      if (motion.addEventListener) motion.addEventListener('change', onMotion);
      else if (motion.addListener) motion.addListener(onMotion);
    }

    // The tabs row is in the page from the start (its space reserved, so nothing below moves
    // when the tabs arrive); a page without it gets one.
    var dots = hero.querySelector('.hero-dots');
    if (!dots) { dots = document.createElement('div'); dots.className = 'hero-dots'; hero.appendChild(dots); }
    dots.setAttribute('role', 'tablist');
    dots.setAttribute('aria-label', 'Featured slides');
    var buttons = slides.map(function (slide, i) {
      if (!slide.id) slide.id = 'hero-slide-' + (i + 1);
      var b = document.createElement('button');
      b.type = 'button';
      b.id = slide.id + '-tab';
      b.setAttribute('role', 'tab');
      b.setAttribute('aria-controls', slide.id);
      b.setAttribute('aria-label', slide.getAttribute('data-label') || 'Slide');
      slide.setAttribute('role', 'tabpanel');
      slide.setAttribute('aria-labelledby', b.id);
      b.addEventListener('click', function () { show(slide); });
      dots.appendChild(b);
      return b;
    });

    // The photograph behind a slide. A slide painted with the page (the lead) is ready as
    // it is; the others get .is-armed, which gives them their background, and that exact
    // file is fetched. Each wait is for one file: after a phone turns or a window crosses a
    // breakpoint, the slide's background changes and the next turn waits for the new file.
    // Resolves when it has loaded or failed, or after 8s on a slow connection, when the
    // slide shows rather than stall the show.
    function ready(slide) {
      var bg = slide.querySelector('.hero-bg');
      if (!bg) return Promise.resolve(true);
      if (!slide.readyFor && getComputedStyle(bg).backgroundImage !== 'none') {
        slide.readyFor = getComputedStyle(bg).backgroundImage;
        return (slide.readyP = Promise.resolve(true));
      }
      slide.classList.add('is-armed');
      var css = getComputedStyle(bg).backgroundImage;
      if (slide.readyP && slide.readyFor === css) return slide.readyP;
      slide.readyFor = css;
      // An image-set() becomes the same candidates as a srcset, so the browser picks the
      // file for this screen's density exactly as it does for the background.
      var set = /image-set\((.*)\)/.exec(css), m = /url\(["']?([^"')]+)["']?\)/.exec(css);
      slide.readyP = new Promise(function (res) {
        if (!m) { res(true); return; }
        var img = new Image();
        img.onload = function () { res(true); };
        img.onerror = function () { res(false); };
        // Chrome reports the densities as "2dppx"; a srcset only takes "2x".
        if (set) img.srcset = set[1].replace(/url\(["']?([^"')]+)["']?\)/g, '$1').replace(/(\d*\.?\d+)dppx/g, '$1x');
        else img.src = m[1];
      });
      return slide.readyP;
    }

    // A wait capped at ms: resolves with the photo's result, or null if it is still loading.
    function within(p, ms) {
      return Promise.race([p, new Promise(function (res) { setTimeout(function () { res(null); }, ms); })]);
    }

    // A slide removed while the page is open (the minis, at midnight on 26 Oct) leaves the
    // rotation along with its tab.
    function prune() {
      for (var i = slides.length - 1; i >= 0; i--) {
        if (slides[i].isConnected) continue;
        dots.removeChild(buttons[i]);
        slides.splice(i, 1); buttons.splice(i, 1);
        if (index >= i && index > 0) index--;
      }
      dots.hidden = slides.length < 2;
    }

    function go(n) {
      prune();
      if (!slides.length) return;
      index = (n + slides.length) % slides.length;
      ready(slides[index]);
      slides.forEach(function (s, i) {
        var on = i === index;
        s.classList.toggle('is-active', on);
        // The hidden slides leave the tab order and the accessibility tree, except the
        // page's one h1 (on the lead), which stays readable while its slide is out of view.
        var parts = s.querySelector('h1') ? s.querySelectorAll('.hero-photo, .hero-credit, .hero-plate > :not(h1)') : [s];
        Array.prototype.forEach.call(parts, function (p) {
          if (on) p.removeAttribute('aria-hidden'); else p.setAttribute('aria-hidden', 'true');
          p.inert = !on;
        });
      });
      buttons.forEach(function (b, i) {
        b.setAttribute('aria-selected', i === index ? 'true' : 'false');
        b.tabIndex = i === index ? 0 : -1;
      });
    }

    // Rotation holds for keyboard focus inside the cover and for a hidden tab, tracked
    // separately so one releasing cannot override the other. No hover pause (Landin's
    // call): the cover fills the screen, so the pointer is over it most of the time.
    var focusHeld = false;
    function canRun() { return !reduced && !focusHeld && !document.hidden && slides.length > 1; }
    // Each wait carries a turn number, so a tab click or a hold while the next photo is
    // still arriving cancels that step instead of letting it land late.
    function schedule() {
      clearTimeout(timer); timer = 0;
      if (canRun()) timer = setTimeout(advance, DELAY);
    }
    function advance() {
      timer = 0;
      prune();
      if (slides.length < 2) return;
      var t = ++turn, next = (index + 1) % slides.length;
      // A slide whose photo failed to load is passed over: it would show an empty frame.
      for (var k = 0; k < slides.length && slides[next].failed; k++) next = (next + 1) % slides.length;
      if (next === index) return;
      // Never before the page itself has loaded: on a slow phone the first turn waits, so
      // the next photo does not compete with the page's own images. Still loading after 8s,
      // the turn is skipped and tried again; failed, the slide leaves the rotation.
      var step = function () {
        if (t !== turn) return;
        within(ready(slides[next]), 8000).then(function (ok) {
          if (t !== turn || !canRun()) return;
          if (ok === false) slides[next].failed = true;
          if (ok) go(next);
          schedule();
        });
      };
      if (document.readyState === 'complete') step(); else window.addEventListener('load', step);
    }
    function stop() { turn++; clearTimeout(timer); timer = 0; }
    // A slide asked for by a tab or an arrow key: shown once its photo is in (at once after
    // the page has loaded), then the rotation carries on from it.
    function show(target) {
      stop();
      var t = turn;
      within(ready(target), 8000).then(function () {
        if (t !== turn) return;
        go(slides.indexOf(target));
        schedule();
      });
    }

    // Hold only for keyboard focus. A mouse click or tap also focuses a tab, and treating
    // that as a hold froze the show after any click.
    hero.addEventListener('focusin', function (e) {
      var keyboard = true;
      try { keyboard = e.target.matches(':focus-visible'); } catch (err) {}
      if (!keyboard) return;
      focusHeld = true; stop();
    });
    hero.addEventListener('focusout', function (e) {
      if (e.relatedTarget && hero.contains(e.relatedTarget)) return;   // moving within the cover
      if (focusHeld) { focusHeld = false; schedule(); }
    });
    document.addEventListener('visibilitychange', function () {
      if (document.hidden) stop(); else schedule();
    });
    // Arrow keys, Home and End move between the tabs, as in any tab set. Only on the tabs:
    // on a link inside a slide they would swap that slide (and the focus in it) away. Alt,
    // Ctrl, Cmd and Shift combinations stay the browser's (Alt+Left is Back).
    dots.addEventListener('keydown', function (e) {
      if (e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
      var n = e.key === 'ArrowLeft' ? index - 1 : e.key === 'ArrowRight' ? index + 1 :
        e.key === 'Home' ? 0 : e.key === 'End' ? slides.length - 1 : null;
      if (n === null) return;
      e.preventDefault();
      var target = slides[(n + slides.length) % slides.length];
      buttons[slides.indexOf(target)].focus();
      show(target);
    });

    // The slide on show removed (the minis at midnight on 26 Oct, while showing): another
    // takes its place at once rather than leaving the cover empty until the next turn.
    if (window.MutationObserver) {
      new MutationObserver(function () {
        var had = slides.length;
        prune();
        if (slides.length !== had) go(index);
      }).observe(slides[0].parentNode, { childList: true });
    }

    go(0);
    schedule();
    // Fetch the other slides' photographs once the page itself has finished loading.
    var arm = function () { slides.forEach(function (s) { ready(s); }); };
    if (document.readyState === 'complete') arm(); else window.addEventListener('load', arm);
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
    if (gallery.getAttribute('data-fade-gallery') === 'pools') { runPooled(gallery); return; }  // homepage (see below)
    var motion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)');
    if (motion && motion.matches) return;
    var SHOWN = 3, FADE = 900, SETTLE = 1600, FIRST = 500;   // ms; match the CSS
    var items = Array.prototype.slice.call(gallery.children);
    if (items.length <= SHOWN) return;
    // Turning reduced motion on mid-visit stops the gallery and puts every photo
    // back in the still grid, exactly as a visit that started with it on.
    var still = gallery.innerHTML, stopped = false;
    if (motion) {
      var stop = function (e) {
        if (!e.matches || stopped) return;
        stopped = true; clearTimeout(timer); timer = 0;
        gallery.innerHTML = still;
        gallery.classList.remove('is-live');
      };
      if (motion.addEventListener) motion.addEventListener('change', stop);
      else if (motion.addListener) motion.addListener(stop);
    }
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
    var live = function () { return !stopped && onScreen && !document.hidden; };
    function schedule(ms) {
      clearTimeout(timer);
      timer = live() ? setTimeout(swap, ms) : 0;
    }
    // Load and decode an image that is not in the page. Lazy images outside the
    // document never load, so it is switched to eager first. Still loading after 8s, it
    // rejects with {slow: true}: slow, not broken, and the download carries on.
    function ready(img) {
      img.loading = 'eager';
      var done = img.decode ? img.decode() : new Promise(function (res, rej) {
        if (img.complete) { if (img.naturalWidth) res(); else rej(new Error('image failed')); }
        else { img.onload = res; img.onerror = rej; }
      });
      var giveUp;
      var timeout = new Promise(function (res, rej) { giveUp = setTimeout(function () { rej({ slow: true }); }, 8000); });
      return Promise.race([done, timeout]).then(
        function () { clearTimeout(giveUp); },
        function (e) { clearTimeout(giveUp); throw e; });
    }
    // Run fn once the element's transition on prop has ended, or after ms if the
    // browser never reports it (a hidden tab, a busy page). Tying cleanup to the
    // transition, not the clock, means a fade that starts late is never cut short.
    function after(el, prop, ms, fn) {
      var done = false, t;
      var end = function (e) { if (e.target === el && e.propertyName === prop) finish(); };
      var finish = function () { if (done) return; done = true; clearTimeout(t); el.removeEventListener('transitionend', end); fn(); };
      // The fallback must not cut short a fade that started late: if the transition
      // is still pending or running when it fires, wait for it to finish instead.
      var fallback = function () {
        var running = el.getAnimations && el.getAnimations().filter(function (a) {
          return a.transitionProperty === prop && a.playState !== 'finished';
        })[0];
        if (running) running.finished.then(finish, finish); else finish();
      };
      el.addEventListener('transitionend', end);
      t = setTimeout(fallback, ms);
    }
    function swap() {
      timer = 0;
      if (busy || !live()) return;
      // A set of exactly four can have its only queued photo still on screen,
      // fading out, if the gallery restarts quickly; try again shortly.
      if (!queue.length) { schedule(FIRST); return; }
      busy = true;
      var incoming = queue.shift();
      // Detached images never re-pick from srcset when the window changes size, so
      // ask again now: a photo queued at phone width comes back sharp on a desktop.
      if (incoming.srcset) incoming.srcset = incoming.srcset;
      ready(incoming).then(function () {
        busy = false;
        incoming.failures = 0;
        if (!live()) { queue.unshift(incoming); return; }   // left while it loaded
        var slots = [0, 1, 2].filter(function (i) { return i !== lastSlot && frames[i] !== hovered; });
        var slot = slots[Math.floor(Math.random() * slots.length)];
        var frame = frames[slot], outgoing = frame.querySelector('img');
        incoming.classList.add('fade-gallery-in');
        frame.appendChild(incoming);
        incoming.getBoundingClientRect();                     // commit opacity 0 before fading
        incoming.classList.add('is-shown');
        after(incoming, 'opacity', FADE + 600, function () {   // fully covered: drop it
          if (stopped) return;
          frame.removeChild(outgoing);
          queue.push(outgoing);
        });
        after(incoming, 'transform', SETTLE + 600, function () { // settled: back to a plain photo
          if (stopped) return;
          incoming.classList.remove('fade-gallery-in', 'is-shown');
        });
        lastSlot = slot;
        if (queue[0]) ready(queue[0]).catch(function () {});  // fetch the next one now
        schedule(wait());
      }, function (e) {
        // Still loading after 8s (a slow connection): back of the queue with no strike, and
        // a pause before the next photo. A real load or decode error goes straight on to the
        // next photo, and two in a row leave this one out for the rest of the visit.
        busy = false;
        if (e && e.slow) { queue.push(incoming); schedule(3000); return; }
        incoming.failures = (incoming.failures || 0) + 1;
        if (incoming.failures < 2) queue.push(incoming);
        schedule(300);
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

  // == Homepage 2026-10: pooled fade gallery ==
  // The homepage's Selected work (data-fade-gallery="pools"): three frames, each with
  // its own pool of photos in a <template> (families and births, weddings and
  // engagements, portraits and seniors), so three kinds of work are always on screen
  // and each frame's caption stays true. Timing, crossfade, decode-before-fade and
  // hover-skip match the shared galleries above. Pool images are lazy and outside the
  // document, so none downloads until its turn comes. Without JavaScript, or with
  // reduced motion, the three first photos simply stay.
  function runPooled(gallery) {
    var motion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)');
    if (motion && motion.matches) return;
    var FADE = 900, SETTLE = 1600, FIRST = 500;   // ms; match the CSS
    var slotEls = Array.prototype.slice.call(gallery.querySelectorAll('.fade-slot'));
    var frames = [], queues = [];
    slotEls.forEach(function (slot, i) {
      frames[i] = slot.querySelector('.img-frame');
      var pool = slot.querySelector('template.fade-pool');
      queues[i] = pool ? Array.prototype.slice.call(document.importNode(pool.content, true).querySelectorAll('img')) : [];
    });
    if (!queues.some(function (q) { return q.length; })) return;
    var stopped = false, timer = 0, io = null, linkTimers = [], onVisibility = null;
    // Point a frame at the photo it shows: the overlay link's href, and the matching
    // caption link marked current (Weddings or Engagements, Portraits or Seniors).
    function pointAt(i, img) {
      var href = img && img.getAttribute('data-href');
      if (!href) return;
      var link = frames[i].querySelector('.frame-link');
      if (link) link.setAttribute('href', href);
      Array.prototype.forEach.call(slotEls[i].querySelectorAll('figcaption a'), function (a) {
        var on = a.getAttribute('href') === href;
        a.classList.toggle('is-current', on);
        if (on) a.setAttribute('aria-current', 'true'); else a.removeAttribute('aria-current');
      });
    }
    frames.forEach(function (frame, i) { pointAt(i, frame.querySelector('img')); });
    if (motion) {
      // Reduced motion switched on mid-visit: each frame settles on the photo it shows, in
      // place (rebuilding the markup would drop a focused caption link), and the observer
      // and timers are released.
      var stop = function (e) {
        if (!e.matches || stopped) return;
        stopped = true; clearTimeout(timer); timer = 0;
        if (io) io.disconnect();
        linkTimers.forEach(clearTimeout);
        if (motion.removeEventListener) motion.removeEventListener('change', stop);
        else if (motion.removeListener) motion.removeListener(stop);
        if (onVisibility) document.removeEventListener('visibilitychange', onVisibility);
        queues.forEach(function (q) { q.length = 0; });
        frames.forEach(function (frame, i) {
          var imgs = Array.prototype.slice.call(frame.querySelectorAll('img'));
          var kept = imgs[imgs.length - 1];
          // mid-fade, the incoming photo is kept only once it is the more visible one
          if (imgs.length > 1 && parseFloat(getComputedStyle(kept).opacity) < 0.5) kept = imgs[imgs.length - 2];
          imgs.forEach(function (im) { if (im !== kept) frame.removeChild(im); });
          if (kept) { kept.classList.remove('fade-gallery-in', 'is-shown'); kept.removeAttribute('aria-hidden'); pointAt(i, kept); }
        });
        gallery.classList.remove('is-live');
      };
      if (motion.addEventListener) motion.addEventListener('change', stop);
      else if (motion.addListener) motion.addListener(stop);
    }
    gallery.classList.add('is-live');

    var busy = false, onScreen = false, lastSlot = -1, hovered = null, focusHeld = false;
    var wait = function () { return 1300 + Math.random() * 1000; };
    var live = function () { return !stopped && onScreen && !focusHeld && !document.hidden; };
    function schedule(ms) {
      clearTimeout(timer);
      timer = live() ? setTimeout(swap, ms) : 0;
    }
    function ready(img) {
      img.loading = 'eager';
      var done = img.decode ? img.decode() : new Promise(function (res, rej) {
        if (img.complete) { if (img.naturalWidth) res(); else rej(new Error('image failed')); }
        else { img.onload = res; img.onerror = rej; }
      });
      var giveUp;
      var timeout = new Promise(function (res, rej) { giveUp = setTimeout(function () { rej({ slow: true }); }, 8000); });
      return Promise.race([done, timeout]).then(
        function () { clearTimeout(giveUp); },
        function (e) { clearTimeout(giveUp); throw e; });
    }
    function after(el, prop, ms, fn) {
      var done = false, t;
      var end = function (e) { if (e.target === el && e.propertyName === prop) finish(); };
      var finish = function () { if (done) return; done = true; clearTimeout(t); el.removeEventListener('transitionend', end); fn(); };
      var fallback = function () {
        var running = el.getAnimations && el.getAnimations().filter(function (a) {
          return a.transitionProperty === prop && a.playState !== 'finished';
        })[0];
        if (running) running.finished.then(finish, finish); else finish();
      };
      el.addEventListener('transitionend', end);
      t = setTimeout(fallback, ms);
    }
    // One decode per photo at the current width, shared by warm() and swap(). A failure,
    // a resize, or the photo going back into its queue starts it over.
    function readyOnce(img) {
      if (!img.readyP || img.readyW !== innerWidth) {
        if (img.srcset && img.readyW && img.readyW !== innerWidth) img.srcset = img.srcset;  // re-pick for the new width
        img.readyW = innerWidth;
        img.readyP = ready(img).catch(function (e) { img.readyP = null; throw e; });
      }
      return img.readyP;
    }
    // Fetch and decode a queued photo ahead of its turn, at low priority so it never
    // competes with the page's own images.
    function warm(img) {
      if (stopped) return;
      img.fetchPriority = 'low';
      readyOnce(img).catch(function () {});
    }
    function swap() {
      timer = 0;
      if (busy || !live()) return;
      // Any frame but the last one to change, unless it is the only one that can.
      var choices = [], last = -1;
      for (var i = 0; i < frames.length; i++) {
        if (frames[i] === hovered || !queues[i].length) continue;
        if (i === lastSlot) last = i; else choices.push(i);
      }
      if (!choices.length && last >= 0) choices.push(last);
      if (!choices.length) {
        if (!queues.some(function (q) { return q.length; })) return;  // every pool failed: stop
        schedule(FIRST); return;
      }
      var slot = choices[Math.floor(Math.random() * choices.length)];
      busy = true;
      var incoming = queues[slot].shift();
      readyOnce(incoming).then(function () {
        busy = false;
        if (stopped) return;
        incoming.failures = 0;
        if (!live() || frames[slot] === hovered) { queues[slot].unshift(incoming); schedule(FIRST); return; }
        var frame = frames[slot], outgoing = frame.querySelector('img');
        incoming.classList.add('fade-gallery-in');
        incoming.setAttribute('aria-hidden', 'true');
        frame.appendChild(incoming);
        // The frame follows the photo it shows (a ring close-up points at engagements, a
        // graduate at seniors), switched halfway through the fade, when the incoming photo
        // is the one on screen.
        linkTimers.push(setTimeout(function () {
          if (stopped || incoming.parentNode !== frame) return;
          incoming.removeAttribute('aria-hidden');
          if (outgoing && outgoing.parentNode === frame) outgoing.setAttribute('aria-hidden', 'true');
          pointAt(slot, incoming);
        }, FADE / 2));
        if (linkTimers.length > 6) linkTimers.shift();
        incoming.getBoundingClientRect();                     // commit opacity 0 before fading
        incoming.classList.add('is-shown');
        after(incoming, 'opacity', FADE + 600, function () {   // fully covered: drop it
          if (stopped) return;
          if (outgoing && outgoing.parentNode === frame) frame.removeChild(outgoing);
          if (outgoing) { outgoing.readyP = null; outgoing.removeAttribute('aria-hidden'); queues[slot].push(outgoing); }
        });
        after(incoming, 'transform', SETTLE + 600, function () { // settled: a plain photo again
          if (stopped) return;
          incoming.classList.remove('fade-gallery-in', 'is-shown');
        });
        lastSlot = slot;
        if (queues[slot][0]) warm(queues[slot][0]);           // fetch what this frame shows next
        schedule(wait());
      }, function (e) {
        // Slow is not broken: a photo still loading after 8s goes to the back of its pool
        // with no strike. Two real errors in a row leave it out for the rest of the visit.
        busy = false;
        if (stopped) return;
        if (e && e.slow) { queues[slot].push(incoming); schedule(3000); return; }
        incoming.failures = (incoming.failures || 0) + 1;
        if (incoming.failures < 2) queues[slot].push(incoming);
        schedule(300);
      });
    }
    // Keyboard focus on a caption link holds the whole gallery, as on the shared
    // galleries above; a mouse click or tap does not count as a hold.
    gallery.addEventListener('focusin', function (e) {
      var keyboard = true;
      try { keyboard = e.target.matches(':focus-visible'); } catch (err) {}
      if (keyboard) { focusHeld = true; clearTimeout(timer); timer = 0; }
    });
    gallery.addEventListener('focusout', function (e) {
      if (e.relatedTarget && gallery.contains(e.relatedTarget)) return;
      if (focusHeld) { focusHeld = false; if (live() && !timer && !busy) schedule(FIRST); }
    });
    frames.forEach(function (frame) {
      frame.addEventListener('pointerenter', function (e) { if (e.pointerType === 'mouse') hovered = frame; });
      frame.addEventListener('pointerleave', function () { if (hovered === frame) hovered = null; });
      var link = frame.querySelector('.frame-link');
      if (!link) return;
      link.addEventListener('pointerdown', function (e) {
        link.tapHref = link.getAttribute('href');
        if (e.pointerType !== 'mouse') hovered = frame;
      });
      var release = function (e) { if (e.pointerType !== 'mouse' && hovered === frame) hovered = null; };
      link.addEventListener('pointerup', release);
      link.addEventListener('pointercancel', function (e) { link.tapHref = null; release(e); });
      // Use the pointerdown destination for this activation only, then put the frame's
      // current one back (a Ctrl or Cmd click leaves this tab open on the frame).
      var useTap = function (e) {
        if (e.type === 'auxclick' && e.button !== 1) return;   // middle button only
        var tap = link.tapHref, now = link.getAttribute('href');
        link.tapHref = null;
        if (!tap || tap === now) return;
        link.setAttribute('href', tap);
        setTimeout(function () { if (link.getAttribute('href') === tap) link.setAttribute('href', now); }, 0);
      };
      link.addEventListener('click', useTap);
      link.addEventListener('auxclick', useTap);
    });
    if ('IntersectionObserver' in window) {
      io = new IntersectionObserver(function (entries) {
        var e = entries[entries.length - 1];
        onScreen = e.isIntersecting && (e.intersectionRatio >= 0.3 ||
          (!!e.rootBounds && e.intersectionRect.height >= e.rootBounds.height * 0.5));
        if (onScreen) {
          queues.forEach(function (q) { if (q[0]) warm(q[0]); });  // the first photo each frame will show
          if (!timer && !busy) schedule(FIRST);
        } else { clearTimeout(timer); timer = 0; }
      }, { threshold: [0, 0.1, 0.2, 0.3] });
      io.observe(gallery);
    } else { onScreen = true; schedule(FIRST); }
    onVisibility = function () {
      if (document.hidden) { clearTimeout(timer); timer = 0; } else if (live() && !timer && !busy) schedule(FIRST);
    };
    document.addEventListener('visibilitychange', onVisibility);
  }

  // Date-limited lines: anything marked data-expires="YYYY-MM-DD" is removed from that
  // date on (Pacific time), so a seasonal line cannot outlive its season.
  // A tab left open is checked again at the next Pacific midnight and whenever it is shown.
  (function () {
    if (!document.querySelector('[data-expires]') || !window.Intl) return;
    var fmt = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Los_Angeles', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23', calendar: 'gregory', numberingSystem: 'latn' });
    var midnight = 0;
    function sweep() {
      var parts = {};
      fmt.formatToParts(new Date()).forEach(function (p) { parts[p.type] = p.value; });
      var today = parts.year + '-' + parts.month + '-' + parts.day;
      var els = document.querySelectorAll('[data-expires]');
      Array.prototype.forEach.call(els, function (el) {
        if (today < el.getAttribute('data-expires')) return;
        if (el.contains(document.activeElement)) {
          var stay = (el.id && document.querySelector('.hero-dots [role="tab"]:not([aria-controls="' + el.id + '"])')) ||
            document.querySelector('.tiles-note .btn');
          if (stay) stay.focus({ preventScroll: true }); else document.activeElement.blur();
        }
        el.parentNode.removeChild(el);
      });
      clearTimeout(midnight);
      if (!document.querySelector('[data-expires]')) { document.removeEventListener('visibilitychange', onShow); return; }
      var into = (+parts.hour * 3600 + +parts.minute * 60 + +parts.second) * 1000;
      midnight = setTimeout(sweep, 86400000 - into + 1000);
    }
    function onShow() { if (!document.hidden) sweep(); }
    document.addEventListener('visibilitychange', onShow);
    sweep();
  })();
  // == end Homepage 2026-10 ==

});

// One schedule_start (GA) / BookingStart (Meta) per booking type per page view and per
// tracker, whichever way the calendar was opened (the booking sheet, or a modified or
// middle click to a new tab). The type comes from the link's data-booking-type, since
// one call calendar serves the wedding call and mini-session questions. Opening a
// calendar is NOT a booking, which completes on hbportal.co, so Meta gets a custom
// event rather than its standard Schedule event.
var scheduleSent = { fb: {}, ga: {} };
var trackSchedule = function (a, method) {
  var url = a.href;
  var type = a.getAttribute('data-booking-type') || (url.indexOf('/public/') !== -1 ? 'mini_session' : 'call');
  var key = url + '|' + type;
  if (typeof window.fbq === 'function' && !scheduleSent.fb[key]) { scheduleSent.fb[key] = true; window.fbq('trackCustom', 'BookingStart', { method: method, booking_type: type }); }
  if (typeof window.gtag === 'function' && !scheduleSent.ga[key]) { scheduleSent.ga[key] = true; window.gtag('event', 'schedule_start', { method: method, booking_type: type, link_url: url, page_location: location.href }); }
};

// The booking sheet, the inquiry form and the HoneyBook focus guard are in js/bookings.js,
// loaded on /bookings and /fall-minis only, just before this file (see its header).

// Meta Pixel conversion events
document.addEventListener('click', function (e) {
  var a = e.target.closest && e.target.closest('a');
  if (!a || !a.href) return;
  // Local stand-ins only: a global no-op fbq would stop a Pixel that loads later,
  // because its snippet returns early when fbq already exists.
  var fbq = (typeof window.fbq === 'function') ? window.fbq : function () {};
  var ga = (typeof gtag === 'function') ? gtag : function () {};
  // Homepage booking buttons say which one was used (data-cta: home-hero, home-services,
  // home-minis, home-close), so the placement can be judged from GA.
  if (a.hasAttribute('data-cta')) ga('event', 'cta_click', { cta: a.getAttribute('data-cta'), link_url: a.href });
  // The booking sheet counts its own opening, once per URL; its "open in a new tab"
  // links are the same visit, not another one.
  if (a.hasAttribute('data-sheet-newtab') || (e.defaultPrevented && a.hasAttribute('data-sheet'))) return;
  if (a.href.indexOf('hbportal.co') !== -1) {
    // Opened a booking calendar in a new tab — NOT a completed inquiry. 'Lead' fires
    // only on thank-you.html, after the form is submitted.
    trackSchedule(a, 'honeybook_scheduler');
  } else if (a.href.indexOf('sms:') === 0) {
    fbq('track', 'Contact');
    ga('event', 'contact_click', { method: 'sms' });
  } else if (a.href.indexOf('mailto:') === 0) {
    fbq('track', 'Contact');
    ga('event', 'contact_click', { method: 'email' });
  } else if (a.href.indexOf('tel:') === 0) {
    fbq('track', 'Contact');
    ga('event', 'contact_click', { method: 'phone' });
  }
});

// A middle-click opens a calendar in a new tab without a click event; count it like one.
document.addEventListener('auxclick', function (e) {
  var a = e.button === 1 && e.target.closest && e.target.closest('a[href*="hbportal.co"]');
  if (a && !a.hasAttribute('data-sheet-newtab')) trackSchedule(a, 'honeybook_scheduler');
});



