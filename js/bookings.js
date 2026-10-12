// Sofia Miyake Photography — booking behaviour (bookings.html and fall-minis.html only).
//
// Split out of js/main.js on 9 Oct 2026, so the other 23 pages stop downloading about
// 12 KB (gzipped) of code that returned early on them. Everything here runs only where
// its elements exist: the booking sheet needs a[data-sheet], the inquiry form .hb-embed,
// and the focus guard an inline HoneyBook embed.
//
// Loaded just BEFORE main.js, not after. The sheet's click listener has to be registered
// ahead of main.js's Meta Pixel listener: that one skips a calendar link only when the
// sheet has already called preventDefault on the click, and otherwise counts it as a new
// tab opening, which would take the once-per-URL schedule_start and mislabel every sheet
// opening. trackSchedule lives in main.js and is only called from here at click time, by
// when main.js has run.

// Booking sheet.
//
// The HoneyBook calendars are cross-origin pages, so nothing inside them can take
// the site's type or colours. Inline, the mini-session flow was a 1,671-2,238px frame
// with HoneyBook's own app bar ("Scheduler · PAGE 1 OF 4") in the middle of the page,
// and the wedding scheduler pulled the page down to itself as it loaded. So the pages
// show their own card, and its button opens HoneyBook in a sheet over the page, under
// a bar in the site's style.
//
//  - Triggers are ordinary links to hbportal.co with target=_blank, a data-sheet
//    title and a data-sheet-meta line (price and length, shown in the bar). Without
//    JS or <dialog>, or with a modifier key or the middle button, they open a new tab.
//  - One frame per URL, made on intent or first open and kept after closing, so a
//    visitor who closes the sheet halfway through the four booking pages comes back
//    to where they were. The strip under the calendar can restart it or open it in a
//    new tab at any time: whether HoneyBook actually works can only be inferred from
//    out here, so the way out is never hidden.
//  - Opening and closing must not move the page. The scroll position is put back
//    instantly (html has scroll-behavior:smooth), and focus goes back to the link
//    without scrolling: Safari does not focus a clicked link, so the dialog's own
//    focus return would land on <body>.
//  - Esc never reaches the page while focus is inside the frame, and the scheduler
//    focuses itself, so the close button is large and always in view.
//  - The sheet takes a history entry, so a phone's Back button closes it instead of
//    leaving the page. Steps inside HoneyBook add entries of their own after it: Back
//    walks those first, as it would on HoneyBook's own site, then closes the sheet.
(function () {
  if (!document.querySelector('a[data-sheet]') || typeof HTMLDialogElement !== 'function' ||
      !HTMLDialogElement.prototype.showModal || !('inert' in HTMLElement.prototype)) return;

  var sheet, title, meta, foot, body, status, live, frames = {}, current = null, currentUrl = '',
      trigger = null, y = 0, slowTimer = 0, liveTimer = 0, token = 0, baseKey = null, closing = false, closeGen = 0;
  var icon = function (d) { return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="' + d + '" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" fill="none"/></svg>'; };

  var build = function () {
    sheet = document.createElement('dialog');
    sheet.className = 'booking-sheet';
    sheet.setAttribute('aria-labelledby', 'booking-sheet-title');
    sheet.innerHTML =
      '<div class="booking-sheet-bar">' +
        '<div class="booking-sheet-heading">' +
          '<h2 class="booking-sheet-title" id="booking-sheet-title"></h2>' +
          '<p class="booking-sheet-note"><span class="booking-sheet-meta" id="booking-sheet-meta"></span>' +
            '<span class="booking-sheet-secure"><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="11" width="14" height="10" rx="1.5" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M8 11V8a4 4 0 0 1 8 0v3" fill="none" stroke="currentColor" stroke-width="1.6"/></svg>Secure <span class="booking-sheet-secure-long">booking </span>via HoneyBook</span></p>' +
          '<p class="visually-hidden" aria-live="polite" data-sheet-live></p>' +
        '</div>' +
        '<button type="button" class="booking-sheet-close" aria-label="Close booking" autofocus>' + icon('M5 5l14 14M19 5L5 19') + '</button>' +
      '</div>' +
      '<div class="booking-sheet-body"><div class="booking-sheet-status"></div></div>' +
      '<div class="booking-sheet-foot"></div>';
    document.body.appendChild(sheet);
    title = sheet.querySelector('.booking-sheet-title');
    meta = sheet.querySelector('.booking-sheet-meta');
    body = sheet.querySelector('.booking-sheet-body');
    status = sheet.querySelector('.booking-sheet-status');
    foot = sheet.querySelector('.booking-sheet-foot');
    live = sheet.querySelector('[data-sheet-live]');

    sheet.querySelector('.booking-sheet-close').addEventListener('click', requestClose);
    // The backdrop: a click whose press and release both land on the dialog itself
    // (its content fills it, so only the backdrop can). A drag that starts inside and
    // ends outside does not close it.
    var downOnSheet = false;
    sheet.addEventListener('pointerdown', function (e) { downOnSheet = e.target === sheet; });
    sheet.addEventListener('click', function (e) { if (downOnSheet && e.target === sheet) requestClose(); });
    // Esc closes the same way. Focus cannot go back to the link while the dialog is
    // still open (the page behind it is inert), so Esc's own close is replaced.
    sheet.addEventListener('cancel', function (e) { e.preventDefault(); requestClose(); });
    // Chrome fires a dialog's close event only with the next rendered frame, so the
    // page is put back in closeNow(); this is only a fallback.
    sheet.addEventListener('close', function () { if (!sheet.open) restore(); });
  };

  // The strip under the calendar. "Open in a new tab" is always in sight, because
  // whether HoneyBook works can only be inferred from out here. "Need help booking?"
  // opens two groups: a person (email or call Sofia) and calendar trouble (restart).
  // Restarting a calendar that has loaded clears what was entered, so it asks first;
  // one that never loaded restarts straight away.
  var footer = function (openHelp) {
    foot.innerHTML = '<button type="button" class="booking-sheet-help" aria-expanded="false" aria-controls="booking-sheet-help-actions" aria-label="Need help booking?"><span class="booking-sheet-long">Need help booking?</span><span class="booking-sheet-short">Help</span></button>' +
      '<span class="booking-sheet-foot-provider"><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="11" width="14" height="10" rx="1.5" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M8 11V8a4 4 0 0 1 8 0v3" fill="none" stroke="currentColor" stroke-width="1.6"/></svg>Via HoneyBook</span>' +
      '<a class="booking-sheet-newtab" href="' + currentUrl + '" target="_blank" rel="noopener" data-sheet-newtab aria-describedby="booking-sheet-newtab-note"><span class="booking-sheet-long">Start over in a new tab</span><span class="booking-sheet-short">New tab (starts over)</span></a>' +
      '<span class="visually-hidden" id="booking-sheet-newtab-note">Opens a separate booking; you may need to enter your details again.</span>' +
      '<div class="booking-sheet-help-actions" id="booking-sheet-help-actions" hidden>' +
        '<p><span class="booking-sheet-foot-q">Questions?</span>' +
          '<a href="mailto:contact@sofiamiyakephoto.com"><span>Email Sofia</span></a>' +
          '<a href="tel:+18054220130"><span>Call (805) 422-0130</span></a></p>' +
        '<p><span class="booking-sheet-foot-q">Calendar blank or stuck?</span>' +
          '<button type="button" data-sheet-restart>Restart booking</button></p>' +
        '<p><span class="booking-sheet-foot-q">Not ready to book?</span>' +
          '<button type="button" data-sheet-back>Back to the page</button></p>' +
        '<p class="booking-sheet-foot-note booking-sheet-foot-secure">Secure booking via HoneyBook.</p>' +
        '<p class="booking-sheet-foot-note">A new tab opens a separate booking, so you may need to enter your details again.</p>' +
      '</div>';
    var help = foot.querySelector('.booking-sheet-help'), actions = foot.querySelector('.booking-sheet-help-actions');
    var expand = function (on) { actions.hidden = !on; help.setAttribute('aria-expanded', on ? 'true' : 'false'); foot.classList.toggle('is-open', on); };
    help.addEventListener('click', function () { expand(actions.hidden); });
    if (openHelp) expand(true);
    foot.querySelector('[data-sheet-back]').addEventListener('click', requestClose);
    foot.querySelector('[data-sheet-restart]').addEventListener('click', function () {
      if (!current || !current.ready) { fresh(currentUrl, true); return; }
      foot.innerHTML = '<span class="booking-sheet-foot-q" id="booking-sheet-ask">Start this booking again? Anything you\u2019ve entered will be cleared.</span>' +
        '<button type="button" data-sheet-keep aria-describedby="booking-sheet-ask">Keep going</button>' +
        '<button type="button" data-sheet-restart-yes aria-describedby="booking-sheet-ask">Restart</button>';
      foot.classList.add('is-open');
      foot.querySelector('[data-sheet-keep]').addEventListener('click', function () {
        footer(true);
        foot.querySelector('[data-sheet-restart]').focus();
      });
      foot.querySelector('[data-sheet-restart-yes]').addEventListener('click', function () { fresh(currentUrl, true); });
      foot.querySelector('[data-sheet-keep]').focus();
    });
  };

  var restore = function () {
    closing = false;
    if (!document.documentElement.classList.contains('sheet-open')) return;
    clearTimeout(slowTimer);
    fit(false);
    clearTimeout(liveTimer);
    live.textContent = '';
    document.documentElement.classList.remove('sheet-open');
    window.scrollTo({ top: y, behavior: 'instant' });
    if (trigger) trigger.focus({ preventScroll: true });
  };

  // A short fade out (bookings.css), then close. The timer covers a page that is not
  // painting, where animationend never comes; reduced motion closes at once.
  var closeNow = function () {
    if (!sheet.open || sheet.classList.contains('is-closing')) return;
    if (window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches) { sheet.close(); restore(); return; }
    var g = ++closeGen;
    var done = function () {
      if (g !== closeGen || !sheet.classList.contains('is-closing')) return;
      sheet.classList.remove('is-closing');
      sheet.close();
      restore();
    };
    sheet.classList.add('is-closing');
    var onEnd = function (e) {
      if (e.target !== sheet || e.animationName !== 'sheet-out') return;
      sheet.removeEventListener('animationend', onEnd);
      done();
    };
    sheet.addEventListener('animationend', onEnd);
    setTimeout(function () { sheet.removeEventListener('animationend', onEnd); done(); }, 220);
  };

  // Each opening pushes one history entry marked with its own token and the link it
  // came from. HoneyBook's steps inside the frame add entries that keep the same mark,
  // so Back walks those first; the sheet closes when Back lands on an entry without its
  // mark. Close goes straight back to the entry before the sheet, so the sheet's entry
  // stays ahead in history, and Forward onto it opens the sheet again on that entry.
  var owned = function () { return !!(token && history.state && history.state.bookingSheet === token); };
  // Close at once, whatever history does. Then go straight to the entry before the
  // sheet, by key: one step if HoneyBook added nothing, past its steps if it did, so no
  // Back press is wasted later. (The entry is only pushed where the Navigation API
  // exists.) If that traversal fails, the mark is cleared so a later Back that lands on
  // it is not mistaken for an open sheet.
  var requestClose = function () {
    if (closing) return;
    closing = true;  // a second tap must not go back twice
    var mine = owned(), was = token;
    token = 0;
    closeNow();
    if (!mine) return;
    var unmark = function () {
      try { if (history.state && history.state.bookingSheet === was) history.replaceState(null, ''); } catch (err) {}
    };
    try {
      var t = navigation.traverseTo(baseKey);
      t.committed.catch(unmark);
      t.finished.catch(function () {});
    } catch (err) { unmark(); }
  };
  window.addEventListener('popstate', function () {
    var st = history.state, mark = st && st.bookingSheet && st.sheetHref ? st : null;
    if (sheet && sheet.open) {
      if (owned()) return;  // a step inside HoneyBook, still on this sheet's entry
      // Back, then Forward before the fade finished: keep this sheet open on its entry.
      if (mark && sheet.classList.contains('is-closing') && mark.sheetHref === currentUrl) {
        closeGen++;
        sheet.classList.remove('is-closing');
        closing = false;
        adopt(mark);
        return;
      }
      token = 0;
      closeNow();
      if (!mark) return;
    }
    if (!mark) return;
    var links = document.querySelectorAll('a[data-sheet]'), a = links[mark.sheetFrom];
    if (!a || a.href !== mark.sheetHref) a = [].filter.call(links, function (x) { return x.href === mark.sheetHref; })[0];
    if (!a) return;
    if (sheet && sheet.open) {  // another sheet was fading out: finish that first
      closeGen++;
      sheet.classList.remove('is-closing');
      sheet.close();
      restore();
    }
    open(a, mark);
  });
  // Take over an existing sheet entry (Forward onto it): its token, and the entry
  // before it as the place Close goes back to.
  var adopt = function (mark) {
    token = 0; baseKey = null;
    var entries = navigation.entries(), at = navigation.currentEntry.index;
    if (at > 0) { token = mark.bookingSheet; baseKey = entries[at - 1].key; }
  };

  // The loading panel stays over the frame until HoneyBook has drawn something.
  // Measured 8 Oct 2026 (twice more in round 17): the mini-session flow posts
  // hb_instant_pay_mounted 1.4-2s after opening and 1-4s before its load event, so it
  // is shown only once both have happened; a load event alone (which an error page
  // also fires) never removes its panel, and at 10s the panel offers to show it
  // anyway. The call scheduler posts nothing at all, so its load event is the only
  // signal there is: it is shown 600ms after load and announced as loaded, not ready.
  // While the panel covers a frame, the frame is inert and aria-busy, so nobody can tab
  // into a calendar they cannot see; the panel sits outside the busy frame, so what it
  // announces is heard.
  var reveal = function (f, forced) {
    if (f.ready) return;
    f.ready = true;
    f.forced = !!forced;
    if (current === f) settle();
  };
  // "Show the calendar" in the stall panel, for a frame that has loaded or been
  // confirmed but not both; added in place, without disturbing focus.
  var offerAnyway = function (f) {
    if (!f.stalled || f.ready || current !== f) return;
    var t = status.querySelector('.booking-sheet-trouble');
    if (!t || t.querySelector('[data-sheet-anyway]')) return;
    var b = document.createElement('button');
    b.type = 'button';
    b.setAttribute('data-sheet-anyway', '');
    b.textContent = 'Show the calendar';
    b.addEventListener('click', function () { reveal(f, true); });
    t.insertBefore(b, t.firstChild);
  };
  var settle = function (resumed) {
    clearTimeout(slowTimer);
    // The panel is about to go. If focus is in it: "Show the calendar" was chosen, so
    // focus goes into the calendar; anything else (a late ready under Try again) hands
    // focus to the strip.
    var intoFrame = !!(current && current.forced && status.contains(document.activeElement));
    if (!intoFrame && status.contains(document.activeElement)) foot.querySelector('.booking-sheet-help').focus({ preventScroll: true });
    var how = !current ? '' : resumed ? 'Booking resumed.' : current.verified && !current.forced ? 'Calendar ready.' : current.forced ? 'Calendar shown.' : 'Booking page loaded.';
    status.classList.add('is-done');
    status.inert = true;
    if (current) {
      current.inert = false;
      current.removeAttribute('aria-busy');
      if (sheet.open) current.presented = true;  // not when it finished loading behind a closed sheet
      if (intoFrame) current.focus({ preventScroll: true });
    }
    // The panel goes quietly; say what is there, without moving focus. "Ready" only
    // when HoneyBook said so; the scheduler's load event is announced as a loaded page,
    // and a frame the visitor chose to see as shown. The announcement is for this frame
    // only: switching or closing cancels it.
    say(how, current);
  };
  window.addEventListener('message', function (e) {
    var type = e.data && e.data.hbEvent && e.data.hbEvent.type;
    if (type !== 'hb_instant_pay_mounted' || !/^https:\/\/[a-z0-9-]+\.hbportal\.co$/.test(e.origin)) return;
    Object.keys(frames).forEach(function (k) {
      var f = frames[k];
      if (f.contentWindow !== e.source) return;
      f.verified = true;
      if (f.loaded && !f.ready) setTimeout(function () { reveal(f); }, 300);
      else offerAnyway(f);  // confirmed after the stall panel appeared
    });
  });

  // What the sheet says goes through its one polite live region, a moment after the
  // change (so the dialog is open and the region is in the accessibility tree), and only
  // while the same frame is showing.
  var say = function (text, f) {
    clearTimeout(liveTimer);
    live.textContent = '';
    liveTimer = setTimeout(function () { if (current === f && sheet.open) live.textContent = text; }, 150);
  };
  var loading = function (url) {
    say('Opening Sofia’s calendar…', current);
    status.inert = false;
    status.classList.remove('is-done');
    status.innerHTML = '<span class="booking-sheet-spinner" aria-hidden="true"></span>Opening Sofia’s calendar…';
    current.inert = true;
    current.setAttribute('aria-busy', 'true');
    clearTimeout(slowTimer);
    // A blocker or a dead connection can stop the frame loading at all: say so in
    // the panel, with a fresh try and the new tab as real buttons.
    var stall = function () {
      if (current !== frames[url] || current.ready) return;
      var f = current;
      f.stalled = true;
      say('Taking longer than usual. Try again, or start over in a new tab.', f);
      status.innerHTML = '<span>Taking longer than usual.</span>' +
        '<span class="booking-sheet-trouble">' +
          '<button type="button" data-sheet-retry>Try again</button>' +
          '<a href="' + url + '" target="_blank" rel="noopener" data-sheet-newtab>Start over in a new tab</a></span>';
      status.querySelector('[data-sheet-retry]').addEventListener('click', function () { fresh(url); });
      // Half there (mounted but still loading, or loaded but never confirmed): the
      // visitor can look for themselves rather than wait behind the panel.
      if (f.verified || f.loaded) offerAnyway(f);
    };
    if (current.stalled) stall(); else slowTimer = setTimeout(stall, 10000);
  };

  var frameFor = function (url, label) {
    if (frames[url]) return frames[url];
    if (!sheet) build();
    var f = frames[url] = document.createElement('iframe');
    f.title = label;
    f.hidden = true;
    // Lets HoneyBook's payment page offer Apple Pay or Google Pay if it supports them.
    f.setAttribute('allow', 'payment');
    // src and the listener go on before the frame is in the page, so no load event
    // for about:blank is taken for HoneyBook's.
    f.src = url;
    var confirms = url.indexOf('/public/') !== -1;  // the mini flow says when it has mounted
    f.addEventListener('load', function () {
      f.loaded = true;
      // HoneyBook's mounted message can come before anything is drawn, so a confirmed
      // frame still waits for its load event, plus 300ms.
      if (f.verified) setTimeout(function () { reveal(f); }, 300);
      else if (!confirms) setTimeout(function () { reveal(f); }, 600);
      else offerAnyway(f);  // loaded, unconfirmed, and already stalled
    });
    body.appendChild(f);
    return f;
  };

  var show = function (url, label) {
    var f = frameFor(url, label);
    Object.keys(frames).forEach(function (k) { frames[k].hidden = frames[k] !== f; });
    f.title = label;  // one call scheduler serves the wedding call and mini questions
    current = f;
    currentUrl = url;
    footer();
    if (f.ready) settle(!!f.presented); else loading(url);
  };

  // A fresh frame for the current calendar. From Help's Restart, Help stays open with
  // focus on Restart (rebuilt in place); from the stall panel's Try again, Help keeps
  // its state and focus goes to the Help toggle, which outlives the panel.
  var fresh = function (url, viaHelp) {
    var old = frames[url];
    if (!old) return;
    var helpWasOpen = !!foot.querySelector('.booking-sheet-help[aria-expanded="true"]');
    delete frames[url];
    old.remove();
    show(url, old.title);  // rebuilds the strip, closed
    if (viaHelp) {
      footer(true);
      foot.querySelector('[data-sheet-restart]').focus({ preventScroll: true });
    } else {
      if (helpWasOpen) footer(true);
      foot.querySelector('.booking-sheet-help').focus({ preventScroll: true });
    }
  };

  // The sheet follows the visual viewport when a keyboard takes part of the screen
  // (full screen on phones, inset on tablets and landscape phones), so Close and the
  // strip stay above the keyboard instead of behind it.
  var phone = window.matchMedia ? matchMedia('(max-width:700px)') : null;
  var vv = window.visualViewport;
  var fit = function (on) {
    if (!sheet) return;
    var full = phone && phone.matches;
    var zoomed = vv && Math.abs(vv.scale - 1) > 0.01;  // a pinch zoom is not a keyboard: leave the sheet alone
    var squeezed = vv && vv.height < window.innerHeight - 1;
    if (on === false || !vv || !sheet.open || zoomed || (!full && !squeezed)) { sheet.style.height = ''; sheet.style.marginTop = ''; return; }
    var inset = full ? 0 : 12;
    sheet.style.height = Math.round(vv.height - inset * 2) + 'px';
    sheet.style.marginTop = Math.round(vv.offsetTop + inset) + 'px';
  };
  // A slim bar when little height is visible (keyboard up, landscape phone).
  var compact = function () {
    if (!sheet) return;
    var h = (vv && Math.abs(vv.scale - 1) <= 0.01) ? vv.height : window.innerHeight;
    sheet.classList.toggle('is-compact', h < 520);
  };
  if (vv) { vv.addEventListener('resize', function () { fit(); compact(); }); vv.addEventListener('scroll', function () { fit(); }); }
  window.addEventListener('resize', function () { compact(); });

  // restoring: the history state of the sheet's own entry, when Forward reaches it.
  var open = function (a, restoring) {
    if (!sheet) build();
    closing = false;
    var url = a.href, label = a.getAttribute('data-sheet');
    trigger = a;
    y = window.scrollY;
    title.textContent = label;
    meta.textContent = a.getAttribute('data-sheet-meta') || '';
    meta.hidden = !meta.textContent;
    // The price and length are part of what the dialog is, so they are its description.
    if (meta.textContent) sheet.setAttribute('aria-describedby', 'booking-sheet-meta'); else sheet.removeAttribute('aria-describedby');
    show(url, label);
    document.documentElement.classList.add('sheet-open');
    sheet.showModal();
    if (current && current.ready) current.presented = true;  // a cached frame, now on screen
    fit();
    compact();
    // Back-to-close only where the history entry can be removed exactly afterwards (the
    // Navigation API: Chrome, Edge, recent Safari and Firefox). Elsewhere Back behaves as
    // it did before the sheet existed, rather than risk invisible entries.
    token = 0; baseKey = null;
    if (window.navigation && navigation.currentEntry && navigation.traverseTo) {
      if (restoring) {
        adopt(restoring);
      } else {
        token = Date.now() + Math.random();
        baseKey = navigation.currentEntry.key;
        var from = [].indexOf.call(document.querySelectorAll('a[data-sheet]'), a);
        try { history.pushState({ bookingSheet: token, sheetHref: a.href, sheetFrom: from }, ''); } catch (err) { token = 0; }
      }
    }
    if (!restoring) trackSchedule(a, 'booking_sheet');
  };

  // A reload keeps the current entry's state. If the page was reloaded with a sheet open,
  // its mark would make that entry look like a sheet's own entry, and a later Close that
  // lands on it would be taken for Forward; so a freshly loaded page starts unmarked.
  try { if (history.state && history.state.bookingSheet) history.replaceState(null, ''); } catch (err) {}

  [].forEach.call(document.querySelectorAll('a[data-sheet]'), function (a) {
    a.setAttribute('aria-haspopup', 'dialog');
    var d = (a.getAttribute('aria-describedby') || '').split(' ').filter(function (id) { return id && id !== 'opens-new-tab'; }).join(' ');
    if (d) a.setAttribute('aria-describedby', d); else a.removeAttribute('aria-describedby');
  });

  document.addEventListener('click', function (e) {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    var a = e.target.closest && e.target.closest('a[data-sheet]');
    if (!a) return;
    e.preventDefault();
    open(a);
  });

  // Start the frame on intent - a mouse resting on a button for 150ms, focus on it,
  // a finger touching it - so most of HoneyBook's 1-4s is spent before the click.
  // A mouse merely passing over a card on its way down the page loads nothing.
  var linkOf = function (e) { return e.target.closest && e.target.closest('a[data-sheet]'); };
  var warm = function (a) { if (a) frameFor(a.href, a.getAttribute('data-sheet')); };
  var dwell = 0;
  document.addEventListener('pointerover', function (e) {
    var a = linkOf(e);
    if (!a || e.pointerType !== 'mouse') return;
    clearTimeout(dwell);
    dwell = setTimeout(function () { warm(a); }, 150);
  });
  document.addEventListener('pointerout', function (e) {
    var a = linkOf(e);
    if (a && !a.contains(e.relatedTarget)) clearTimeout(dwell);
  });
  document.addEventListener('focusin', function (e) { warm(linkOf(e)); });
  document.addEventListener('touchstart', function (e) { warm(linkOf(e)); }, { passive: true });
})();

// Inquiry form loading and failure.
//
// The form arrives by HoneyBook's script, into space reserved at its measured height.
// A visible line says it is loading until HoneyBook posts hb_contact_form_loaded (from
// the form's own frame). If that has not come 12s after this script runs (a blocker,
// a dead CDN, a frame that never finishes), the space folds away and the line says
// so, above a fallback with email and phone, instead of a blank 1,000px box. A form
// that arrives late still wins: the fallback goes away again. The visible line is not
// a live region; one separate polite region speaks for the form (loading, loaded,
// failed), and only while someone is at it: focus in the card, or the card on screen.
(function () {
  var embed = document.querySelector('.hb-embed');
  if (!embed) return;
  var line = embed.querySelector('.hb-embed-status');
  var fallback = embed.querySelector('.hb-embed-fallback');
  var wrapper = embed.querySelector('[data-hb-mount]');  // HoneyBook's mount div (its class is HoneyBook's)
  var ready = false;
  embed.classList.add('is-loading');
  // The frame is see-through until it is ready (css/bookings.css), so it is inert too:
  // no tap or Tab lands in fields nobody can see yet.
  if (wrapper) wrapper.inert = true;
  // HoneyBook's frame arrives with no title, and a screen reader names a frame by it.
  var nameFrame = function () {
    var f = embed.querySelector('iframe');
    if (f && !f.title) f.title = 'Inquiry form';
    return !!f;
  };
  if (wrapper && !nameFrame() && 'MutationObserver' in window) {
    var titler = new MutationObserver(function () { if (nameFrame()) titler.disconnect(); });
    titler.observe(wrapper, { childList: true, subtree: true });
  }
  // Someone is at the form: focus is in the card, or the card is on screen.
  var here = function () {
    var r = embed.getBoundingClientRect();
    return embed.contains(document.activeElement) || (r.top < innerHeight && r.bottom > 0);
  };
  var said = document.createElement('p');
  said.className = 'visually-hidden';
  said.setAttribute('aria-live', 'polite');
  embed.appendChild(said);
  var markReady = function () {
    if (ready) return;
    ready = true;
    // Announced when someone is at the form (focus in the card, or the card on screen),
    // judged now: the focus rescue below can scroll the card out of view.
    // An earlier "Loading..." or "didn't load" is cleared either way, so a screen reader
    // coming back later never finds a status that is no longer true.
    var announce = here();
    said.textContent = '';
    setTimeout(function () { if (announce) said.textContent = 'Inquiry form loaded.'; }, 100);
    // A late form: give it back its space and interactivity, and if the visitor was
    // on a fallback link, put them on the matching contact link beside the form
    // instead of nowhere. That link moves when the form takes its space back (by a
    // whole form's height on a phone), so focus goes there once the layout has
    // settled, and the link is scrolled just into view.
    var onFallback = fallback && fallback.contains(document.activeElement) ? document.activeElement : null;
    var alt = null;
    if (onFallback || document.activeElement === line) {
      var scheme = onFallback && onFallback.href ? onFallback.href.split(':')[0] + ':' : 'mailto:';
      alt = document.querySelector('.inquire-contact-links a[href^="' + scheme + '"]') || document.querySelector('.inquire-contact-links a[href^="mailto:"]');
    }
    embed.classList.remove('is-loading', 'is-failed');
    if (wrapper) wrapper.inert = false;
    if (line) { line.textContent = ''; line.hidden = true; }
    if (fallback) fallback.hidden = true;
    if (alt) requestAnimationFrame(function () { alt.focus({ preventScroll: true }); alt.scrollIntoView({ block: 'nearest' }); });
  };
  window.addEventListener('message', function (e) {
    var type = e.data && e.data.hbEvent && e.data.hbEvent.type;
    if (type !== 'hb_contact_form_loaded' || !/^https:\/\/[a-z0-9-]+\.honeybook\.com$/.test(e.origin)) return;
    var frame = embed.querySelector('iframe');
    if (!frame || frame.contentWindow !== e.source) return;
    markReady();
  });
  // The inline listener on /bookings, registered before HoneyBook's widget starts,
  // keeps the sender of a ready message that arrives before this script runs; it
  // counts only if that sender is this form's frame.
  var early = window.__hbFormReady, earlyFrame = embed.querySelector('iframe');
  if (early && earlyFrame && earlyFrame.contentWindow === early) markReady();
  var loadingSaid = false;
  var sayLoading = function () {
    if (ready || loadingSaid || embed.classList.contains('is-failed') || !here()) return;
    loadingSaid = true;
    said.textContent = 'Loading the inquiry form\u2026';
  };
  if ('IntersectionObserver' in window) {
    var seen = new IntersectionObserver(function (entries) {
      if (entries.some(function (en) { return en.isIntersecting; })) { sayLoading(); seen.disconnect(); }
    });
    seen.observe(embed);
  }
  embed.addEventListener('focusin', sayLoading);
  setTimeout(function () {
    if (ready) return;
    // The folded form is made inert so a keyboard cannot wander into it; focus that
    // was inside it moves to the status line.
    if (wrapper && wrapper.contains(document.activeElement) && line) { line.tabIndex = -1; line.focus({ preventScroll: true }); }
    if (wrapper) wrapper.inert = true;
    // Said only to someone at the form; otherwise the region is emptied, so "Loading..."
    // does not linger.
    said.textContent = here() ? 'The inquiry form didn’t load. You can email or call instead.' : '';
    embed.classList.remove('is-loading');
    embed.classList.add('is-failed');
    if (line) line.textContent = 'The inquiry form didn’t load.';
    if (fallback) fallback.hidden = false;
  }, 12000);
})();

// HoneyBook embed engagement.
//
// The inquiry form on /bookings is a cross-origin embed, so clicks and submissions
// inside it never bubble to this document. (The schedulers used to be inline embeds
// too; they now open in the booking sheet above, which counts its own opening, and
// frames inside the sheet are left out of everything here.)
//
// A click inside a cross-origin iframe blurs the parent window and makes that
// iframe document.activeElement. That is the one signal available from out here,
// and it is only an estimate (see below), so it goes to GA as engagement and never
// to Meta as a conversion. It is NOT a completed booking: the completion still
// happens on hbportal.co and only HoneyBook can confirm it.
(function () {
  var frames = document.querySelectorAll('iframe[src*="hbportal.co"], .hb-embed iframe');
  var placement = document.querySelector('[class^="hb-p-"], [class*=" hb-p-"]');
  if (!frames.length && !placement) return;

  var sent = {};
  // Once per kind per page, so touching the inquiry form does not swallow a later
  // scheduler report.
  var report = function (which) {
    if (sent[which]) return;
    sent[which] = true;
    var ga = (typeof gtag === 'function') ? gtag : function () {};
    ga('event', which === 'honeybook_scheduler_embed' ? 'scheduler_interact' : 'inquiry_form_interact',
      { method: which, page_location: location.href });
  };

  // But a click is not the only thing that moves focus into an embed: the HoneyBook
  // scheduler focuses itself after it loads (measured 130ms to 12s after its load
  // event), and the browser then scrolls the page to it. Before this guard, /bookings
  // jumped from the top to the first calendar, and /fall-minis pulled a visitor
  // reading the gallery 2,000px down to its calendar. The schedulers now open only in
  // the booking sheet, which is fixed over the page and has nothing to scroll to; this
  // stays for whatever inline embed is left.
  //
  //  - An embed's first focus is caught as it happens (the window's blur), and by a
  //    50ms check from the embed's load as a fallback for a window without focus. It
  //    counts until 15s after the embed loads, and before it loads: the scheduler can
  //    take focus while still loading, and let go again within 40ms.
  //  - If that focus arrives without a Tab just before, and the embed was not fully
  //    in view, the page goes back to where the visitor was: the section an in-page
  //    link they clicked in the last 3s points at, or else where the page was at the
  //    focus. A click into a calendar that is fully in view never scrolls, so it is
  //    left alone; a mouse merely resting over a calendar proves nothing.
  //  - Frames in the booking sheet are not watched. The page behind the sheet is
  //    locked, and a hold here would still scroll it.
  //  - The page is then held by its content, not its scroll offset: the element in
  //    the middle of the screen is kept where it was. That undoes the browser's
  //    scroll to the embed but leaves scroll anchoring alone (a form growing above
  //    the reader). The browser's scroll is a ~560px glide starting 20-70ms after
  //    the focus (later on a slow device; 1.2s only with several browsers fighting
  //    for the CPU), so the hold waits up to 0.7s for it, then lets go once the page
  //    has been still for 400ms (2.5s at most). Any wheel, touch, key or click on
  //    the page, or a mouse moving onto an embed, ends it. A swipe or wheel over an
  //    embed never reaches the page, so one that starts within that 0.7s, or a click
  //    into a partly hidden scheduler before it has focused itself followed by an
  //    instant scroll, can be held back once.
  //  - Focus itself is never moved, and nothing is watched after an embed's first
  //    focus, so a screen reader, a keyboard user or a swipe over an embed is never
  //    fought.
  //  - Engagement goes to GA only, for a Tab into an embed, or for a focus move while
  //    a mouse that really moved onto the embed after it loaded is over it. A pointer
  //    that only appears over it because the page scrolled under it reports no
  //    movement, so it does not count. Taps cannot be seen from out here, so this
  //    undercounts; a real measure needs HoneyBook's own data.
  var overFrame = null, overAt = 0, lastTab = 0, hold = null, anchor = null, guardedAt = 0;
  var isFrame = function (el) { return el && el.tagName === 'IFRAME'; };
  var inSheet = function (el) { return !!(el && el.closest && el.closest('.booking-sheet')); };
  var tabbed = function () { return Date.now() - lastTab < 1000; };
  // A mouse really moving onto an embed is the visitor, about to click or wheel in it,
  // where the page cannot see them: let go of any hold.
  document.addEventListener('pointerover', function (e) {
    if (isFrame(e.target) && e.pointerType === 'mouse' && (e.movementX || e.movementY)) { overFrame = e.target; overAt = Date.now(); hold = null; }
  });
  document.addEventListener('pointerout', function (e) { if (e.target === overFrame) overFrame = null; });
  window.addEventListener('keydown', function (e) { if (e.key === 'Tab') lastTab = Date.now(); hold = null; }, true);
  ['pointerdown', 'wheel', 'touchstart'].forEach(function (type) {
    window.addEventListener(type, function () { hold = null; }, { capture: true, passive: true });
  });
  // Where the visitor asked to go: an in-page link (#book, #call, #inquire).
  var aim = function (hash) {
    var target = hash && hash.length > 1 && document.getElementById(decodeURIComponent(hash.slice(1)));
    if (target) anchor = { el: target, at: Date.now() };
  };
  document.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('a[href*="#"]');
    if (!(a && a.pathname === location.pathname && a.hash)) return;
    aim(a.hash);
    // The click ends any hold, but the glide of an embed that just focused itself can
    // still be to come, and would carry the page past the section. So go straight
    // there, after the browser has started its own scroll, and hold it.
    if (Date.now() - guardedAt < 2500) setTimeout(function () { var y = anchorY(); if (y !== null) holdHere(y); }, 0);
  }, true);
  window.addEventListener('hashchange', function () { aim(location.hash); });
  var anchorY = function () {
    if (!anchor || Date.now() - anchor.at > 3000) return null;
    var margin = parseFloat(getComputedStyle(anchor.el).scrollMarginTop) || 0;
    return Math.max(0, anchor.el.getBoundingClientRect().top + window.scrollY - margin);
  };
  var holdHere = function (y) {
    if (Math.abs(window.scrollY - y) > 1) window.scrollTo({ top: y, behavior: 'instant' });
    var ref = document.elementFromPoint(window.innerWidth / 2, window.innerHeight / 2) || document.body;
    // quiet starts 300ms ahead, so a still page is held for 0.7s before letting go.
    hold = { ref: ref, top: ref.getBoundingClientRect().top, quiet: Date.now() + 300, end: Date.now() + 2500 };
  };
  window.addEventListener('scroll', function () {
    if (!hold) return;
    var now = Date.now();
    if (now > hold.end || now - hold.quiet > 400) { hold = null; return; }
    var moved = hold.ref.getBoundingClientRect().top - hold.top;
    // A correction can extend the wait but not cut it short: the tail of a link's own
    // scroll would otherwise end the hold before the embed's glide arrives.
    if (Math.abs(moved) > 1) { window.scrollTo({ top: window.scrollY + moved, behavior: 'instant' }); hold.quiet = Math.max(hold.quiet, now); }
  }, { passive: true });
  var watched = function (el) {
    return !el.settled && (!el.loadedAt || Date.now() - el.loadedAt < 15000) && !inSheet(el);
  };
  // y: where the page was when the embed took focus.
  var settle = function (el, y) {
    el.settled = true;
    if (tabbed()) return;
    var r = el.getBoundingClientRect(), top = r.top + window.scrollY - y;
    if (top >= 0 && top + r.height <= window.innerHeight) return;  // fully in view: nothing to stop
    var target = anchorY();
    holdHere(target === null ? y : target);
    guardedAt = Date.now();
  };
  var watch = function (el) {
    var y = window.scrollY;
    var id = setInterval(function () {
      if (!watched(el)) { clearInterval(id); return; }
      if (document.activeElement !== el) { y = window.scrollY; return; }
      clearInterval(id);
      settle(el, y);
    }, 50);
  };
  document.addEventListener('load', function (e) {
    if (!isFrame(e.target) || inSheet(e.target)) return;
    e.target.loadedAt = Date.now();
    watch(e.target);
  }, true);

  window.addEventListener('blur', function () {
    var y = window.scrollY;
    var visitor = function (el) {
      return isFrame(el) && (tabbed() || (el === overFrame && overAt > (el.loadedAt || 0)));
    };
    // Some browsers update activeElement only after blur, so look a tick later.
    setTimeout(function () {
      var el = document.activeElement;
      if (inSheet(el)) return;
      if (isFrame(el) && watched(el)) settle(el, y);
      if (!visitor(el)) return;
      var src = el.getAttribute('src') || '';
      if (src.indexOf('hbportal.co') !== -1) report('honeybook_scheduler_embed');
      else if (el.closest && el.closest('.hb-embed')) report('honeybook_form_embed');
    }, 0);
  });
})();
