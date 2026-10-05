// Sofia Miyake Photography — site behavior

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
    }, { threshold: 0.15, rootMargin: '0px 0px -60px 0px' });
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

    toggle.addEventListener('click', function () {
      var open = header.classList.toggle('nav-open');
      toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    });

    nav.querySelectorAll('a').forEach(function (link) {
      link.addEventListener('click', function () {
        header.classList.remove('nav-open');
        toggle.setAttribute('aria-expanded', 'false');
      });
    });
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

  // Simple booking form handler (bookings.html)
  var form = document.querySelector('.booking-form');
  if (form) {
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var msg = form.querySelector('.form-message');
      if (msg) {
        msg.setAttribute('role', 'status');
        msg.textContent = "Thank you! Your inquiry has been received — I'll be in touch within 1–2 business days.";
      }
      form.reset();
    });
  }

  // Hero carousel (homepage) — crossfading slides with dots
  document.querySelectorAll('[data-hero-carousel]').forEach(function (hero) {
    var slides = Array.prototype.slice.call(hero.querySelectorAll('.hero-slide'));
    if (slides.length < 2) return;

    var reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var DELAY = 9000;
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

    // Slides 2+ carry their image in data-bg, not an inline background-image.
    // A visibility:hidden box still generates a layout box, so the browser
    // fetches its background in the same style-recalc tick as the LCP image —
    // slides nobody sees for 9 and 18 seconds competing for the same bandwidth.
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

    // The !timer guard matters: hover fires stop(), then a tab switch and
    // return fires start(), then mouseleave fires start() again — without it
    // the first interval is orphaned and runs a full-viewport crossfade forever.
    function start() { if (!reduced && !timer) timer = setInterval(function () { go(index + 1); }, DELAY); }
    function stop() { if (timer) { clearInterval(timer); timer = null; } }
    function restart() { stop(); start(); }

    hero.addEventListener('mouseenter', stop);
    hero.addEventListener('mouseleave', start);
    hero.addEventListener('focusin', stop);
    hero.addEventListener('focusout', start);
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

  // Gallery carousel arrows
  document.querySelectorAll('[data-carousel]').forEach(function (carousel) {
    var track = carousel.querySelector('.carousel-track');
    carousel.setAttribute('role', 'region');
    if (!carousel.hasAttribute('aria-label')) carousel.setAttribute('aria-label', 'Image gallery');
    track.setAttribute('tabindex', '0');
    track.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowLeft') { e.preventDefault(); carousel.querySelector('.prev').click(); }
      if (e.key === 'ArrowRight') { e.preventDefault(); carousel.querySelector('.next').click(); }
    });
    var step = function () {
      var slide = track.querySelector('.carousel-slide');
      return slide ? slide.getBoundingClientRect().width + 24 : 300;
    };
    carousel.querySelector('.prev').addEventListener('click', function () {
      track.scrollBy({ left: -step(), behavior: 'smooth' });
    });
    carousel.querySelector('.next').addEventListener('click', function () {
      track.scrollBy({ left: step(), behavior: 'smooth' });
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
