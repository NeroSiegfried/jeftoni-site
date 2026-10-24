/* ==========================================================================
   SET-OUT — behaviour
   This file contains NO styling decisions. It only sets data-* attributes and
   hides rows; CSS decides what any of that looks like.

   Everything here is progressive enhancement. Every page — including the
   189-row register — is fully readable and usable with this file absent.

   Written as ES5-compatible plain script on purpose: it has to survive being
   pasted into a Wix custom-code block or a Velo custom element with no build
   step of any kind. See wix/MIGRATION.md.
   ========================================================================== */

(function () {
  'use strict';

  document.documentElement.classList.remove('no-js');

  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---- Reveal on scroll -------------------------------------------------
     One shared observer for the whole document, not one per element.
     Fires once, then unobserves. */
  function initReveals() {
    var pending = Array.prototype.slice.call(document.querySelectorAll('[data-reveal]'));
    if (!pending.length) return;

    if (reduceMotion || !('IntersectionObserver' in window)) {
      pending.forEach(function (el) { el.setAttribute('data-revealed', 'true'); });
      return;
    }

    function reveal(el) {
      el.setAttribute('data-revealed', 'true');
      observer.unobserve(el);
      var i = pending.indexOf(el);
      if (i > -1) pending.splice(i, 1);
      if (!pending.length) {
        observer.disconnect();
        window.removeEventListener('scroll', onScroll);
      }
    }

    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) reveal(entry.target);
      });
    // A large negative bottom margin strands elements that sit in the last
    // screenful — they can never reach the threshold once scrolling bottoms
    // out. A small fixed inset gives the reveal a beat without that risk.
    }, { threshold: 0.1, rootMargin: '0px 0px -40px 0px' });

    pending.forEach(function (el) { observer.observe(el); });
    document.documentElement.setAttribute('data-reveal-ready', 'true');

    /* The observer alone is not enough. It reports threshold CROSSINGS, so an
       element that goes from entirely below the viewport to entirely above it
       in one step — End key, a jump to a fragment, a restored scroll position
       on reload — never produces a callback and would stay at opacity 0 for
       good. This sweep reveals anything the viewport has reached or passed,
       and both it and the observer detach once nothing is left pending. */
    var ticking = false;

    function sweep() {
      ticking = false;
      var vh = window.innerHeight;
      pending.slice().forEach(function (el) {
        if (el.getBoundingClientRect().top < vh) reveal(el);
      });
    }

    function onScroll() {
      if (ticking) return;
      ticking = true;
      window.requestAnimationFrame(sweep);
    }

    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll, { passive: true });
  }

  /* ---- Staggered groups --------------------------------------------------
     Delay is passed to CSS as a custom property — the only permitted use of an
     inline style, because the value is index-dependent. Capped at 8 so a long
     list never crawls. */
  function initStagger() {
    Array.prototype.forEach.call(document.querySelectorAll('[data-stagger]'), function (group) {
      var step = parseInt(group.getAttribute('data-stagger'), 10) || 60;
      Array.prototype.forEach.call(group.querySelectorAll('[data-reveal]'), function (item, i) {
        item.style.setProperty('--reveal-delay', Math.min(i, 8) * step + 'ms');
      });
    });
  }

  /* ---- Capability preview -------------------------------------------------
     Pointing at a capability brings up the frame that shows it. Enhancement
     only: the base photograph is in the markup, so with scripting off the band
     is a photograph with a list on it and nothing is missing. Pointer, keyboard
     focus and touch all drive the same state. */
  function initPhotoLists() {
    Array.prototype.forEach.call(document.querySelectorAll('[data-photo-list]'), function (root) {
      var frames = root.querySelectorAll('[data-photo-for]');
      if (!frames.length) return;

      function show(key) {
        Array.prototype.forEach.call(frames, function (f) {
          if (key && f.getAttribute('data-photo-for') === key) f.setAttribute('data-active', '');
          else f.removeAttribute('data-active');
        });
      }

      Array.prototype.forEach.call(root.querySelectorAll('[data-photo-key]'), function (item) {
        var key = item.getAttribute('data-photo-key');
        item.addEventListener('pointerenter', function () { show(key); });
        item.addEventListener('focus', function () { show(key); });
      });

      var list = root.querySelector('.photo-list__items');
      if (list) {
        list.addEventListener('pointerleave', function () { show(null); });
        list.addEventListener('focusout', function (e) {
          if (!list.contains(e.relatedTarget)) show(null);
        });
      }
    });
  }

  /* ---- Current-section rail ----------------------------------------------
     design-language.md §2.4. The rail is ink by default and Jeftoni blue only
     on the section the visitor is in, so the accent marks position instead of
     accumulating into a texture down the page.

     Enhancement only: with JavaScript off every rail stays ink, which is the
     correct resting state, and no information is lost — the label text is in
     the markup either way. */
  function initSectionRails() {
    var labels = Array.prototype.slice.call(document.querySelectorAll('.section-label'));
    if (!labels.length || !('IntersectionObserver' in window)) return;

    var sections = labels.map(function (l) { return l.closest('.section'); }).filter(Boolean);
    if (!sections.length) return;

    var visible = [];

    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        var i = visible.indexOf(entry.target);
        if (entry.isIntersecting && i === -1) visible.push(entry.target);
        else if (!entry.isIntersecting && i !== -1) visible.splice(i, 1);
      });

      /* Topmost intersecting section wins, so the marker never jumps backwards
         when two sections straddle the band. */
      var current = null;
      visible.forEach(function (s) {
        if (!current || s.getBoundingClientRect().top < current.getBoundingClientRect().top) current = s;
      });

      sections.forEach(function (s) {
        var label = s.querySelector('.section-label');
        if (!label) return;
        if (s === current) label.setAttribute('data-current', 'true');
        else label.removeAttribute('data-current');
      });
    }, { rootMargin: '-45% 0px -45% 0px' });

    sections.forEach(function (s) { observer.observe(s); });
  }

  /* ---- Nav scroll state --------------------------------------------------
     Sets an attribute at a threshold; CSS owns the transition. */
  function initNav() {
    var nav = document.querySelector('[data-nav]');
    if (!nav) return;

    var THRESHOLD = 80;
    var ticking = false;

    function update() {
      nav.setAttribute('data-scrolled', window.scrollY > THRESHOLD ? 'true' : 'false');
      ticking = false;
    }

    window.addEventListener('scroll', function () {
      if (ticking) return;
      ticking = true;
      window.requestAnimationFrame(update);
    }, { passive: true });

    update();
  }

  /* ---- Tree disclosures --------------------------------------------------
     Every sublist is SERVED OPEN, so with this file absent the panel is one
     long, complete list of the site. This collapses them and turns each
     heading into a real disclosure — except the branch the visitor is already
     inside, which stays open, so opening the menu shows you where you are
     without a single press.

     The button owns aria-expanded; CSS reads it for which arrow to show, and
     `hidden` on the list keeps the collapsed rows out of the tab order.

     One open at a time. The tree is an index, not a set of independent
     accordions: with two branches open the rows below the second one are pushed
     off the panel, and the thing the menu exists to show — the shape of the
     site — stops fitting on the screen. Opening one therefore closes the rest,
     so the panel's height only ever answers for one branch. */
  function initTree() {
    var branches = Array.prototype.slice.call(document.querySelectorAll('[data-branch]'));
    if (!branches.length) return;

    var setters = [];

    branches.forEach(function (branch) {
      var toggle = branch.querySelector('[data-branch-toggle]');
      var sub = branch.querySelector('.nav-tree__reveal');
      if (!toggle || !sub) return;

      function set(open) {
        toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
        // An attribute, not `hidden`: `hidden` cannot be transitioned, and the
        // CSS needs the collapsed state to animate out of. `inert` keeps the
        // collapsed links off the tab order in browsers that have it; the
        // stylesheet's visibility:hidden covers the rest.
        if (open) branch.removeAttribute('data-collapsed');
        else branch.setAttribute('data-collapsed', '');
        if ('inert' in sub) sub.inert = !open;
      }

      setters.push(set);

      // Open if this branch holds the current route, at either level.
      set(!!branch.querySelector('[data-state]'));

      toggle.addEventListener('click', function () {
        var open = toggle.getAttribute('aria-expanded') !== 'true';
        // Collapse the others first, so an expand and a collapse animate
        // together and the panel resolves to its new height in one movement.
        if (open) {
          setters.forEach(function (other) { if (other !== set) other(false); });
        }
        set(open);
      });
    });
  }

  /* ---- Menu preview ------------------------------------------------------
     Pointing at a route in the menu brings up the frame that shows it — the
     photograph the old dropdown carried, in the place the tree now lives.
     Enhancement only: every frame is server-rendered and the resting one is
     already showing, so with this absent the pane is a photograph and nothing
     is missing. Pointer and keyboard focus drive the same state. */
  function initMenuPreview() {
    var pane = document.querySelector('[data-preview-pane]');
    if (!pane) return;
    var frames = pane.querySelectorAll('[data-preview-for]');
    var tree = document.querySelector('.nav-tree');
    if (!frames.length || !tree) return;

    function show(href) {
      var matched = false;
      Array.prototype.forEach.call(frames, function (f) {
        var on = f.getAttribute('data-preview-for') === href;
        if (on) matched = true;
        if (on) f.setAttribute('data-active', '');
        else f.removeAttribute('data-active');
      });
      // A route with no frame of its own falls back to the resting one rather
      // than borrowing a photograph that would assert something about it.
      if (!matched) frames[0].setAttribute('data-active', '');
    }

    Array.prototype.forEach.call(tree.querySelectorAll('[data-preview]'), function (row) {
      var href = row.getAttribute('data-preview');
      row.addEventListener('pointerenter', function () { show(href); });
      row.addEventListener('focus', function () { show(href); });
    });

    tree.addEventListener('pointerleave', function () { show(''); });
    tree.addEventListener('focusout', function (e) {
      if (!tree.contains(e.relatedTarget)) show('');
    });
  }

  /* ---- Mobile nav panel --------------------------------------------------
     Full-screen overlay with a focus trap, Escape to close and focus restored
     on close — docs/engineering-standards.md §Accessibility. */
  function initNavPanel() {
    var toggle = document.querySelector('[data-nav-toggle]');
    var panel = document.querySelector('[data-nav-panel]');
    if (!toggle || !panel) return;

    var FOCUSABLE = 'a[href], button:not([disabled]), input, textarea, select, [tabindex]:not([tabindex="-1"])';
    var lastFocused = null;

    function open() {
      lastFocused = document.activeElement;
      panel.hidden = false;
      // Next frame, so the opacity transition has a starting value to run from.
      window.requestAnimationFrame(function () { panel.setAttribute('data-state', 'open'); });
      toggle.setAttribute('aria-expanded', 'true');
      document.body.style.setProperty('overflow', 'hidden');
      var first = panel.querySelector(FOCUSABLE);
      if (first) first.focus();
    }

    function close() {
      panel.setAttribute('data-state', 'closed');
      toggle.setAttribute('aria-expanded', 'false');
      document.body.style.removeProperty('overflow');
      panel.hidden = true;
      if (lastFocused) lastFocused.focus();
    }

    function isOpen() { return toggle.getAttribute('aria-expanded') === 'true'; }

    toggle.addEventListener('click', function () { isOpen() ? close() : open(); });

    panel.addEventListener('click', function (e) {
      if (e.target.closest('a')) close();
    });

    document.addEventListener('keydown', function (e) {
      if (!isOpen()) return;

      if (e.key === 'Escape') { close(); return; }
      if (e.key !== 'Tab') return;

      var items = panel.querySelectorAll(FOCUSABLE);
      if (!items.length) return;
      var first = items[0];
      var last = items[items.length - 1];

      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    });

    /* No resize guard any more: the panel is the site index at every width, so
       crossing a breakpoint with it open is not an orphaned state, it is the
       same menu in a wider grid. It used to be compact-only and had to be shut. */
  }

  /* ---- Contact map -------------------------------------------------------
     The verified head-office map is server-rendered and visible immediately.
     These controls switch the same frame to the second verified location.
     Abuja has no control because its address is incomplete. */
  function initMap() {
    var root = document.querySelector('[data-map-root]');
    if (!root) return;
    var canvas = root.querySelector('[data-map-canvas]');
    if (!canvas) return;
    var frame = canvas.querySelector('iframe');

    Array.prototype.forEach.call(root.querySelectorAll('[data-map-load]'), function (control) {
      control.addEventListener('click', function () {
        if (!frame) {
          frame = document.createElement('iframe');
          frame.setAttribute('loading', 'eager');
          frame.setAttribute('referrerpolicy', 'no-referrer-when-downgrade');
          frame.setAttribute('allowfullscreen', '');
          canvas.appendChild(frame);
        }
        frame.setAttribute('title', control.getAttribute('data-map-label') + ' map');
        frame.setAttribute('src', control.getAttribute('data-map-src'));
        canvas.setAttribute('data-loaded', 'true');
      });
    });
  }

  /* ---- Register filtering ------------------------------------------------
     The full table is server-rendered. This only hides rows that are already
     in the DOM, so the page works without JS and stays crawlable.

     Filter state is mirrored into the query string so a filtered view can be
     linked, bookmarked and shared — docs/engineering-standards.md §Behaviour. */
  function initFilters() {
    var root = document.querySelector('[data-filter-root]');
    if (!root) return;

    var chips = root.querySelectorAll('[data-filter-field]');
    var search = root.querySelector('[data-filter-search]');
    var rows = root.querySelectorAll('tr[data-row-state]');
    var groupRows = root.querySelectorAll('tr[data-group]');
    var count = root.querySelector('[data-filter-count]');
    var empty = root.querySelector('[data-filter-empty]');
    var reset = root.querySelector('[data-filter-reset]');
    var form = root.querySelector('[data-filter-form]');
    if (!rows.length) return;

    /* The resting view is a preview, not the whole register. Every row is in
       the document — that is what makes the page crawlable and usable with this
       file absent — but 189 of them is about fifteen screens to scroll past for
       anyone who came for something else on the page. So the resting table is
       capped, and the cap lifts the moment the visitor shows interest in it:
       by pressing the control, or by searching or filtering, which is the same
       statement made a different way. */
    var PREVIEW_ROWS = 12;
    var expandWrap = root.querySelector('[data-register-expand]');
    var expandButton = root.querySelector('[data-register-toggle]');
    var expandLabel = root.querySelector('[data-register-toggle-label]');
    var expanded = !expandButton;

    var state = { state: 'all', decade: 'all', q: '' };

    /* Submitting would reload the page and throw the filter away — the form
       element exists so the controls are grouped and labelled, not to post. */
    if (form) form.addEventListener('submit', function (e) { e.preventDefault(); });

    function matches(row) {
      if (state.state !== 'all' && row.getAttribute('data-row-state') !== state.state) return false;

      if (state.decade === 'ongoing') {
        if (!row.hasAttribute('data-row-status')) return false;
      } else if (state.decade !== 'all') {
        if (row.getAttribute('data-row-decade') !== state.decade) return false;
      }

      if (state.q && (row.getAttribute('data-row-text') || '').indexOf(state.q) === -1) return false;

      return true;
    }

    function apply() {
      var dirty = state.state !== 'all' || state.decade !== 'all' || !!state.q;
      // Filtering IS an expression of interest in the table, so it lifts the cap.
      var capped = !expanded && !dirty;

      var matched = 0;
      var shown = 0;
      var perGroup = {};

      Array.prototype.forEach.call(rows, function (row) {
        var ok = matches(row);
        if (ok) matched++;
        // Rows past the cap are matches that are not being drawn — which is
        // why `shown` and `matched` are counted separately below.
        var visible = ok && (!capped || matched <= PREVIEW_ROWS);
        row.hidden = !visible;
        if (!visible) return;
        shown++;
        var g = row.getAttribute('data-row-state');
        perGroup[g] = (perGroup[g] || 0) + 1;
      });

      // A group heading with nothing under it is noise.
      Array.prototype.forEach.call(groupRows, function (header) {
        header.hidden = !perGroup[header.getAttribute('data-group')];
      });

      /* The control is only meaningful while there is something behind the cap,
         so it goes away once a filter has narrowed the register to less than a
         screenful — there is nothing left to expand into. */
      if (expandWrap) expandWrap.hidden = !(capped ? matched > PREVIEW_ROWS : expanded);
      if (expandButton) expandButton.setAttribute('aria-expanded', expanded ? 'true' : 'false');
      if (expandLabel) {
        expandLabel.textContent = expanded
          ? 'Show fewer records'
          : 'Show all ' + matched.toLocaleString('en-NG') + ' records';
      }

      // The status reports what is on screen, which under a cap is not the same
      // as what matched — saying "189" over twelve visible rows reads as a bug.
      if (count) count.textContent = shown.toLocaleString('en-NG');
      if (empty) empty.hidden = shown > 0;

      Array.prototype.forEach.call(chips, function (chip) {
        var field = chip.getAttribute('data-filter-field');
        chip.setAttribute('aria-pressed', state[field] === chip.getAttribute('data-filter-value') ? 'true' : 'false');
      });

      if (reset) reset.hidden = !dirty;

      syncUrl(dirty);
    }

    function syncUrl(dirty) {
      if (!window.history || !window.history.replaceState) return;
      var params = new URLSearchParams();
      if (state.state !== 'all') params.set('state', state.state);
      if (state.decade !== 'all') params.set('period', state.decade);
      if (state.q) params.set('q', state.q);
      var qs = params.toString();
      window.history.replaceState(null, '', qs ? '?' + qs : window.location.pathname);
    }

    function readUrl() {
      var params = new URLSearchParams(window.location.search);
      if (params.get('state')) state.state = params.get('state');
      if (params.get('period')) state.decade = params.get('period');
      if (params.get('q')) {
        state.q = params.get('q').toLowerCase();
        if (search) search.value = params.get('q');
      }
    }

    Array.prototype.forEach.call(chips, function (chip) {
      chip.addEventListener('click', function () {
        state[chip.getAttribute('data-filter-field')] = chip.getAttribute('data-filter-value');
        apply();
      });
    });

    if (search) {
      var timer = null;
      search.addEventListener('input', function () {
        window.clearTimeout(timer);
        timer = window.setTimeout(function () {
          state.q = search.value.trim().toLowerCase();
          apply();
        }, 140);
      });
    }

    if (reset) {
      reset.addEventListener('click', function () {
        state.state = 'all';
        state.decade = 'all';
        state.q = '';
        if (search) search.value = '';
        apply();
      });
    }

    if (expandButton) {
      expandButton.addEventListener('click', function () {
        expanded = !expanded;
        apply();
        /* Collapsing from the bottom of fifteen screens would otherwise leave
           the visitor stranded below a table that no longer reaches them. */
        if (!expanded) {
          root.scrollIntoView({ block: 'start', behavior: reduceMotion ? 'auto' : 'smooth' });
        }
      });
    }

    readUrl();
    apply();
  }

  /* ---- Parallax ----------------------------------------------------------
     transform only, single rAF loop. Never background-position, never top.
     No scrolljacking.

     Travel is measured against the FRAME, not the image. The image is
     deliberately taller than its frame by --parallax-overscan on each side
     (components.css), so measuring the image would scale the offset up by the
     overscan and push it past the very margin the overscan exists to provide —
     which is what opened a gap at the top and bottom of the scroll range. */
  var PARALLAX_MAX = 0.04;   /* == --parallax-range */

  function initParallax() {
    if (reduceMotion) return;

    var items = Array.prototype.slice.call(document.querySelectorAll('[data-parallax]'))
      .map(function (el) { return { el: el, frame: el.parentElement || el }; })
      .filter(function (it) { return it.frame !== it.el; });
    if (!items.length) return;

    var ticking = false;

    function update() {
      var vh = window.innerHeight;

      items.forEach(function (it) {
        var rect = it.frame.getBoundingClientRect();
        if (rect.bottom < 0 || rect.top > vh) return;

        var strength = parseFloat(it.el.getAttribute('data-parallax')) || PARALLAX_MAX;
        strength = Math.min(Math.abs(strength), PARALLAX_MAX);

        // -1 .. 1 across the viewport
        var progress = (rect.top + rect.height / 2 - vh / 2) / (vh / 2 + rect.height / 2);
        progress = Math.max(-1, Math.min(1, progress));

        // |offset| <= strength * frameHeight <= the overscan CSS reserved.
        var offset = progress * strength * rect.height;

        it.el.style.setProperty('--parallax-y', offset.toFixed(2) + 'px');
      });

      ticking = false;
    }

    window.addEventListener('scroll', function () {
      if (ticking) return;
      ticking = true;
      window.requestAnimationFrame(update);
    }, { passive: true });

    window.addEventListener('resize', update, { passive: true });
    update();
  }

  /* ---- Image strip controls -----------------------------------------------
     A centred, looping carousel built on the native scroller the strip
     already had — prev/next, dots and autoplay all just call scrollTo on it,
     none of them replace it, so touch, trackpad, wheel and the no-JS
     fallback all still work exactly as before any of this existed.

     "Active" is whichever real frame is closest to the viewport centre right
     now, recomputed from actual scroll position on every scroll event — not
     a counter this code just increments — so it stays correct whether the
     move came from a button, autoplay, or the user's own drag or swipe.

     The loop: the track is three copies of the sequence — clones, the real
     items, clones again (imageStrip in sections.mjs) — with the real copy
     the resting range. Advancing off either end keeps scrolling into the
     identical-looking clones on that side; once the active frame is inside a
     clone range, scrollLeft is silently shifted by exactly one set's width,
     landing on the pixel-identical real frame. Because the two are
     pixel-identical, that shift is invisible in both directions, which is
     what makes it read as one continuous loop rather than a snap back to
     frame one. (A single trailing clone set was tried first and dropped: the
     real first frame had nothing to its left to scroll into, so it could
     never actually reach centre, and "previous" from it had nowhere to go.) */
  function initStrips() {
    var AUTOPLAY_MS = 4200;
    var SETTLE_MS = 120;

    Array.prototype.forEach.call(document.querySelectorAll('[data-strip-auto]'), function (wrap) {
      var scroller = wrap.querySelector('.strip');
      var allItems = Array.prototype.slice.call(wrap.querySelectorAll('.strip__item'));
      var count = parseInt(wrap.getAttribute('data-strip-count'), 10) || Math.floor(allItems.length / 3);
      var prev = wrap.querySelector('[data-strip-prev]');
      var next = wrap.querySelector('[data-strip-next]');
      var dots = Array.prototype.slice.call(wrap.querySelectorAll('[data-strip-dot]'));
      if (!scroller || allItems.length < count * 3 || !count) return;

      var cycleWidth = allItems[count].offsetLeft - allItems[0].offsetLeft;

      function centerOffset(item) {
        return item.offsetLeft + item.offsetWidth / 2 - scroller.clientWidth / 2;
      }

      function closestIndex() {
        var center = scroller.scrollLeft + scroller.clientWidth / 2;
        var best = 0;
        var bestDist = Infinity;
        allItems.forEach(function (it, i) {
          var d = Math.abs(it.offsetLeft + it.offsetWidth / 2 - center);
          if (d < bestDist) { bestDist = d; best = i; }
        });
        return best;
      }

      function setActive(index) {
        allItems.forEach(function (it, i) { it.classList.toggle('strip__item--active', i === index); });
        var real = ((index % count) + count) % count;
        dots.forEach(function (d, i) { d.classList.toggle('strip__dot--active', i === real); });
      }

      /* Runs after scrolling has actually stopped (button, autoplay, or the
         user's own hand), so a rebase never lands mid-gesture. */
      function settle() {
        var idx = closestIndex();
        if (idx < count) scroller.scrollLeft += cycleWidth;
        else if (idx >= count * 2) scroller.scrollLeft -= cycleWidth;
        setActive(closestIndex());
      }

      var settleTimer = null;
      var rafPending = false;
      scroller.addEventListener('scroll', function () {
        if (rafPending) return;
        rafPending = true;
        window.requestAnimationFrame(function () {
          rafPending = false;
          setActive(closestIndex());
        });
        window.clearTimeout(settleTimer);
        settleTimer = window.setTimeout(settle, SETTLE_MS);
      }, { passive: true });

      function goTo(index, instant) {
        scroller.scrollTo({ left: centerOffset(allItems[index]), behavior: instant || reduceMotion ? 'auto' : 'smooth' });
      }

      function advance(dir) { goTo(closestIndex() + dir); }

      if (prev) prev.addEventListener('click', function () { advance(-1); restart(); });
      if (next) next.addEventListener('click', function () { advance(1); restart(); });

      dots.forEach(function (dot, i) {
        dot.addEventListener('click', function () {
          var current = closestIndex();
          var real = ((current % count) + count) % count;
          var delta = i - real;
          if (Math.abs(delta) > count / 2) delta += delta > 0 ? -count : count;
          goTo(current + delta);
          restart();
        });
      });

      var timer = null;
      function stop() {
        if (timer) { window.clearInterval(timer); timer = null; }
      }
      function restart() {
        stop();
        if (reduceMotion) return;
        timer = window.setInterval(function () { advance(1); }, AUTOPLAY_MS);
      }

      wrap.addEventListener('pointerenter', stop);
      wrap.addEventListener('pointerleave', restart);
      wrap.addEventListener('touchstart', stop, { passive: true });
      wrap.addEventListener('focusin', stop);
      wrap.addEventListener('focusout', function (e) {
        if (!wrap.contains(e.relatedTarget)) restart();
      });

      goTo(count, true);
      setActive(count);
      restart();
    });
  }

  /* ---- Video ------------------------------------------------------------
     Two jobs, and both of them are about NOT downloading things.

     Ambient loops carry their source on `data-src`, so the markup alone can
     never start a fetch. This promotes it to `src` only once the band is
     approaching the viewport, and only if the visitor has not asked to be left
     alone — reduced motion — and the browser is not reporting a metered or slow
     connection. Until then, and for ever if none of that is true, the poster
     image that is already on screen is the band. Nothing is missing; it is a
     full-bleed photograph, which is what the design language specified before
     there was any footage at all.

     Feature and clip videos already have a real `src` and `preload="none"`, so
     they cost nothing until played and work with this file absent. All this
     adds is the site's own play control in place of the browser's, and hiding
     the poster once playback actually starts rather than on click — a slow
     connection would otherwise show black while the first bytes arrive. */
  function initVideo() {
    var frames = Array.prototype.slice.call(document.querySelectorAll('[data-video]'));
    if (!frames.length) return;

    /* Save-Data and the effective connection type are Chromium-only; absence of
       the API is treated as "no objection", not as "slow". */
    var conn = navigator.connection || {};
    var thrifty = conn.saveData === true || /^(slow-)?2g$/.test(conn.effectiveType || '');

    frames.forEach(function (frame) {
      var el = frame.querySelector('video');
      if (!el) return;

      /* Whatever starts playing, the poster fades out over it — never before,
         so a stalled load leaves a photograph rather than a black rectangle. */
      el.addEventListener('playing', function () {
        frame.setAttribute('data-video-playing', 'true');
      });
      el.addEventListener('pause', function () {
        if (frame.getAttribute('data-video') !== 'ambient') {
          frame.removeAttribute('data-video-playing');
        }
      });

      if (frame.getAttribute('data-video') === 'ambient') {
        initAmbient(frame, el);
      } else {
        initPlayButton(frame, el);
      }
    });

    function initAmbient(frame, el) {
      if (reduceMotion || thrifty) return;

      /* A phone cannot resolve the desktop rendition, and mobile data is the
         connection least able to afford it. Evaluated once, at load — a
         viewport that crosses the breakpoint mid-visit keeps the file it
         already has rather than fetching a second one. */
      var narrow = window.matchMedia('(max-width: 47.99rem)').matches;

      var started = false;
      function load() {
        if (started) return;
        started = true;
        Array.prototype.forEach.call(el.querySelectorAll('source[data-src]'), function (s) {
          var small = s.getAttribute('data-src-sm');
          s.setAttribute('src', narrow && small ? small : s.getAttribute('data-src'));
          s.removeAttribute('data-src');
          s.removeAttribute('data-src-sm');
        });
        el.load();
        var attempt = el.play();
        /* A rejected play() is a normal outcome, not an error: some browsers
           refuse until the visitor has interacted with the page. The poster
           stays, which is the correct resting state anyway. */
        if (attempt && attempt.catch) attempt.catch(function () {});
      }

      if (!('IntersectionObserver' in window)) { load(); return; }
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) return;
          io.disconnect();
          load();
        });
      /* Start fetching a little before the band arrives so the fade lands as
         it comes into view rather than a beat after it. */
      }, { rootMargin: '200px 0px' });
      io.observe(frame);

      /* A background tab has no reason to keep decoding frames. */
      document.addEventListener('visibilitychange', function () {
        if (!started) return;
        if (document.hidden) el.pause();
        else { var a = el.play(); if (a && a.catch) a.catch(function () {}); }
      });
    }

    function initPlayButton(frame, el) {
      var button = frame.querySelector('[data-video-play]');
      if (!button) return;
      button.addEventListener('click', function () {
        var attempt = el.play();
        if (attempt && attempt.catch) attempt.catch(function () {});
        el.focus();
      });
    }
  }

  function init() {
    initStagger();
    initReveals();
    initSectionRails();
    initPhotoLists();
    initNav();
    initTree();
    initMenuPreview();
    initNavPanel();
    initFilters();
    initMap();
    initParallax();
    initStrips();
    initVideo();
  }

  var bound = false;

  function bindOnce() {
    if (bound) return;
    bound = true;
    init();
  }

  /* True once this build's markup is actually in the document. Under Route A
     the Wix page shell fires DOMContentLoaded while the document still holds
     none of it, and binding then would burn the single run below on an empty
     page — leaving nothing bound when the markup does arrive. */
  function markupPresent() {
    return !!document.querySelector('[data-nav], [data-reveal], main#main');
  }

  /* On a static page the markup is already in the document and the
     DOMContentLoaded run below does all the work.

     Under Route A the markup arrives later: a Velo custom element sets its
     innerHTML after this script has already run, so that first run finds an
     empty document, binds nothing, and every reveal, the nav, the parallax
     and the video would stay dead. The element calls this once, after
     injecting, to bind them. See wix/MIGRATION.md.

     None of the init* functions above guard against re-binding — they select
     across the whole document and attach listeners unconditionally — so this
     deliberately binds exactly once per page load and is a no-op after that.
     Inject the page markup in a single pass before calling it. */
  window.jeftoniInit = bindOnce;

  function autoBind() {
    if (markupPresent()) bindOnce();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', autoBind);
  } else {
    autoBind();
  }
})();
