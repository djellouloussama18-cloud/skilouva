/* ============================================================
   Skillova — Main Script
   ------------------------------------------------------------
   Responsibilities:
     1. Navbar scroll-state (throttled, adds shadow + white bg)
     2. Mobile nav toggle (hamburger -> full-screen drawer)
     3. Close drawer on link click / outside tap
     4. Smooth-scroll anchor handling is handled by CSS
        scroll-behavior + scroll-padding-top (no JS needed).
   ============================================================ */
(function () {
  'use strict';

  /* --- Elements ------------------------------------------------ */
  var navbar = document.getElementById('navbar');
  var navbarNav = document.getElementById('navbar-nav');
  var navToggle = document.getElementById('nav-toggle');
  var navMobile = document.getElementById('navbar-mobile');

  /* Scroll threshold (px) after which the navbar gets a shadow */
  var SCROLL_THRESHOLD = 40;

  /* --- 1. Navbar scroll state (throttled) ---------------------- */
  var ticking = false;

  function updateNavbarState() {
    var scrolled = window.scrollY > SCROLL_THRESHOLD;
    if (navbar) {
      navbar.setAttribute('data-scrolled', scrolled ? 'true' : 'false');
    }
    ticking = false;
  }

  function onScroll() {
    if (!ticking) {
      // requestAnimationFrame throttles to ~once per frame,
      // avoiding excessive layout/paint work on scroll.
      window.requestAnimationFrame(updateNavbarState);
      ticking = true;
    }
  }

  if (navbar) {
    window.addEventListener('scroll', onScroll, { passive: true });
    // Correct initial state on load (in case page loads mid-scroll)
    updateNavbarState();
  }

  /* --- 2. Mobile nav toggle ------------------------------------ */
  function setMobileMenu(open) {
    if (!navToggle || !navMobile) return;

    navToggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    navToggle.setAttribute('aria-label', open ? 'إغلاق القائمة' : 'فتح القائمة');

    if (open) {
      navMobile.hidden = false;
    } else {
      navMobile.hidden = true;
    }

    // Prevent background scroll while the drawer is open
    document.body.style.overflow = open ? 'hidden' : '';
  }

  if (navToggle && navMobile) {
    navToggle.addEventListener('click', function () {
      var open = navToggle.getAttribute('aria-expanded') === 'true';
      setMobileMenu(!open);
    });

    // Close drawer when any mobile link is clicked
    var mobileLinks = navMobile.querySelectorAll('a');
    Array.prototype.forEach.call(mobileLinks, function (link) {
      link.addEventListener('click', function () {
        setMobileMenu(false);
      });
    });

    // Close drawer on window resize back to desktop (>= 900px)
    var mql = window.matchMedia('(max-width: 56.25rem)'); // 900px
    var onBreakpointChange = function (e) {
      if (!e.matches) {
        // Back to desktop: ensure drawer is closed & scroll unlocked
        setMobileMenu(false);
      }
    };
    if (mql.addEventListener) {
      mql.addEventListener('change', onBreakpointChange);
    } else if (mql.addListener) {
      // Fallback for older browsers
      mql.addListener(onBreakpointChange);
    }

    // Close drawer when clicking outside it / on the toggle area
    document.addEventListener('click', function (event) {
      if (navMobile.hidden) return;
      var withinMobile = navMobile.contains(event.target);
      var withinToggle = navToggle.contains(event.target);
      if (!withinMobile && !withinToggle) {
        setMobileMenu(false);
      }
    });

    // Close on Escape
    document.addEventListener('keydown', function (event) {
      if (event.key === 'Escape') {
        setMobileMenu(false);
      }
    });
  }

  /* ============================================================
     HERO SECTION
     ------------------------------------------------------------
     Responsibilities:
       Subtle parallax on the hero visual composition while
       scrolling (rAF-throttled, disabled for reduced-motion).
       (The proof strip is now a continuous CSS marquee — no JS.)
     Note: Hero text/visual slide/fade entrance is handled purely
     in CSS via keyframes (staggered behind the navbar entrance),
     so no JS is needed for the initial reveal.
     ============================================================ */
  var prefersReducedMotion = window.matchMedia(
    '(prefers-reduced-motion: reduce)'
  ).matches;

  /* --- 1. Subtle parallax on the hero visual ------------------- */
  var heroVisual = document.querySelector('.hero__visual');

  if (heroVisual && !prefersReducedMotion) {
    var visTicking = false;

    function updateHeroParallax() {
      var rect = heroVisual.getBoundingClientRect();
      // Only parallax while the hero is roughly on-screen
      if (rect.bottom > 0 && rect.top < window.innerHeight) {
        // Offset in the direction of the visual (range ~ +/6px)
        var rel = (rect.top + rect.height / 2) - window.innerHeight / 2;
        var offset = Math.max(-6, Math.min(6, rel * -0.04));
        heroVisual.style.transform = 'translateY(' + offset.toFixed(2) + 'px)';
      }
      visTicking = false;
    }

    function onHeroScroll() {
      if (!visTicking) {
        window.requestAnimationFrame(updateHeroParallax);
        visTicking = true;
      }
    }

    window.addEventListener('scroll', onHeroScroll, { passive: true });
    updateHeroParallax();
  }

  /* --- 2. Hero video mute/unmute control ---------------------- */
  // Custom centered mute button toggles the video's sound. Autoplay is
  // forced muted by the browser, so the button starts in the "muted"
  // icon state and invites the user to tap to unmute.
  var heroVideo = document.querySelector('.hero__media-video');
  var heroMuteBtn = document.querySelector('.hero__media-mute');
  var heroVideoWrap = document.querySelector('.hero__media');

  if (heroVideo && heroMuteBtn) {
    var heroMuteFadeTimer = null;

    function syncHeroMuteState() {
      var muted = heroVideo.muted;
      heroMuteBtn.classList.toggle('is-muted', muted);
      heroMuteBtn.setAttribute(
        'aria-label',
        muted ? 'تفعيل الصوت' : 'كتم الصوت'
      );

      // Keep the button visible while muted; fade it out shortly after
      // unmuting so it stays least intrusive, then reappear on hover/tap.
      clearTimeout(heroMuteFadeTimer);
      if (muted) {
        heroMuteBtn.classList.remove('is-faded');
        return;
      }
      heroMuteFadeTimer = setTimeout(function () {
        heroMuteBtn.classList.add('is-faded');
      }, 1500);
    }

    function onHeroMuteClick(e) {
      e.preventDefault();
      heroVideo.muted = !heroVideo.muted;
      syncHeroMuteState();
    }

    heroMuteBtn.addEventListener('click', onHeroMuteClick);
    // Reflect mute changes made via the native controls bar too.
    heroVideo.addEventListener('volumechange', syncHeroMuteState);

    if (heroVideoWrap) {
      heroVideoWrap.addEventListener('mouseenter', function () {
        clearTimeout(heroMuteFadeTimer);
        heroMuteBtn.classList.remove('is-faded');
      });
      heroVideoWrap.addEventListener('mouseleave', function () {
        if (!heroVideo.muted) syncHeroMuteState();
      });
      heroVideoWrap.addEventListener(
        'touchstart',
        function () {
          clearTimeout(heroMuteFadeTimer);
          heroMuteBtn.classList.remove('is-faded');
        },
        { passive: true }
      );
    }

    syncHeroMuteState();
  }

  /* --- 3. iOS-only native control tweak ------------------------- */
  /* Modern iOS WebKit ("modern media controls" shadow tree, iOS 16+)
     no longer honors the legacy -webkit-media-controls time pseudo-
     elements, so the native time readout can only be targeted (best-
     effort) on iOS. Detect iOS as a PLATFORM — any browser on iPhone/
     iPad, plus the iPadOS-as-Mac-Safari edge case (platform "MacIntel"
     with touch points) — and tag the video with .is-ios so the CSS
     stays scoped to iOS and never touches Android or desktop. */
  function detectIos() {
    return /iPhone|iPad|iPod/.test(navigator.userAgent)
      || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  }

  if (heroVideo && detectIos()) {
    heroVideo.classList.add('is-ios');
  }

  /* ============================================================
     PROBLEM SECTION
     ------------------------------------------------------------
     Responsibilities:
       Scroll-triggered sequential reveal of the editorial
       typographic composition:
         heading -> big statement -> each problem line (with
         stagger) -> closing lines -> big closing emphasis.
     Uses a single IntersectionObserver on the section; once the
     section scrolls mostly into view, .is-visible is added to
     every [p-reveal] element. The individual delays live in CSS
     (--reveal-delay custom property + explicit delays), so the
     whole stagger "reads like a list being revealed" as the user
     scrolls into it — clean, not flying cards.
     Falls back gracefully when IntersectionObserver is missing.
     ============================================================ */
  var problemSection = document.querySelector('.problem');

  // Collect every element carrying the p-reveal reveal class
  // (heading, big statement, problem lines, closing statements)
  var problemReveals = Array.prototype.slice.call(
    document.querySelectorAll('.problem .p-reveal')
  );

  if (problemReveals.length) {
    if (problemSection && 'IntersectionObserver' in window) {
      var problemObserver = new IntersectionObserver(
        function (entries) {
          entries.forEach(function (entry) {
            if (entry.isIntersecting) {
              // Reveal all targets once, then stop observing
              problemReveals.forEach(function (el) {
                el.classList.add('is-visible');
              });
              problemObserver.unobserve(entry.target);
            }
          });
        },
        { threshold: 0.2 }
      );

      problemObserver.observe(problemSection);
    } else {
      // Fallback: show everything immediately
      problemReveals.forEach(function (el) {
        el.classList.add('is-visible');
      });
    }
  }

  /* ============================================================
     SHARED SCROLL-FILL HELPER
     ------------------------------------------------------------
     A tiny reusable engine for the "line fills as you scroll"
     interaction used by both the Skillova Method section and the
     Career Path section. It:
       - computes scroll progress (0..1) through a track element
       - writes the progress to an overlay line (width or height,
         based on a supplied "isVertical" check)
       - invokes a per-section `render(progress)` callback so each
         section can drive its own stage states.
     Throttled with requestAnimationFrame and attached to scroll /
     resize / breakpoint / load so it stays correct everywhere.
     ============================================================ */
  function bindScrollFill(config) {
    var track = config.track;
    var fill = config.fill;
    var isVertical = config.isVertical || function () { return false; };
    var render = config.render || function () {};

    if (!track || !fill) return;

    var ticking = false;

    function update() {
      var rect = track.getBoundingClientRect();
      // 0 when the track top enters the bottom of the viewport,
      // 1 when its bottom reaches the bottom of the viewport.
      // Using rect.height keeps the fill bounded 0..1 even for
      // very tall (mobile-vertical) sections.
      var progress = (window.innerHeight - rect.top) / rect.height;
      progress = Math.max(0, Math.min(1, progress || 0));

      var pct = progress * 100;
      if (isVertical()) {
        fill.style.height = pct.toFixed(2) + '%';
        fill.style.width = '';
      } else {
        fill.style.width = pct.toFixed(2) + '%';
        fill.style.height = '';
      }

      render(progress);

      ticking = false;
    }

    function onScroll() {
      if (!ticking) {
        window.requestAnimationFrame(update);
        ticking = true;
      }
    }

    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll, { passive: true });

    // Re-check the vertical/horizontal mode when a breakpoint flips.
    var query = config.query || null;
    if (query) {
      if (query.addEventListener) {
        query.addEventListener('change', onScroll);
      } else if (query.addListener) {
        query.addListener(onScroll);
      }
    }

    // Initial paint + on load (in case the user arrives mid-scroll).
    window.addEventListener('load', onScroll);
    update();
  }

  /* ============================================================
     SKILLOVA METHOD SECTION
     ------------------------------------------------------------
     Responsibilities:
       1. Fade-up reveal of heading / subline / stages via
          IntersectionObserver (one-time, reuses m-reveal pattern).
       2. Scroll-driven progress fill of the connecting line:
          the brand-blue fill grows from 0% -> 100% as the user
          scrolls through the section, and reverses when they
          scroll back up (bound directly to scroll position).
       3. Stage activation: a stage's marker/label turns brand
          when the fill has reached its position.
     Both horizontal (desktop) and vertical (mobile) layouts share
     this same logic — the direction difference is handled by which
     CSS property the JS writes (width vs height).
     Optimized with requestAnimationFrame throttling.
     ============================================================ */
  var methodFlow = document.getElementById('method-flow');
  var methodReveals = Array.prototype.slice.call(
    document.querySelectorAll('.method .m-reveal')
  );
  var methodFill = document.querySelector('.method__line-fill');
  var methodPulse = document.querySelector('.method__pulse');
  var methodStages = Array.prototype.slice.call(
    document.querySelectorAll('.method .method__stage')
  );

  /* --- 1. One-time reveal on scroll into view ----------------- */
  if (methodReveals.length) {
    if ('IntersectionObserver' in window) {
      var methodObserver = new IntersectionObserver(
        function (entries) {
          entries.forEach(function (entry) {
            if (entry.isIntersecting) {
              methodReveals.forEach(function (el) {
                el.classList.add('is-visible');
              });
              if (methodFlow) {
                methodObserver.unobserve(methodFlow);
              }
            }
          });
        },
        { threshold: 0.15 }
      );
      if (methodFlow) {
        methodObserver.observe(methodFlow);
      }
    } else {
      methodReveals.forEach(function (el) {
        el.classList.add('is-visible');
      });
    }
  }

  /* --- 2. Scroll-driven progress fill ------------------------- */
  if (methodFlow && methodFill && methodStages.length) {
    var methodVerticalQuery = window.matchMedia('(max-width: 56.25rem)');

    bindScrollFill({
      track: methodFlow,
      fill: methodFill,
      query: methodVerticalQuery,
      isVertical: function () {
        return methodVerticalQuery.matches;
      },
      render: function (progress) {
        // Activate each stage the fill has reached (method keeps the
        // original "active once passed" behaviour).
        var activeCount = Math.round(progress * methodStages.length);
        methodStages.forEach(function (stage, i) {
          var active = i < activeCount;
          stage.setAttribute('data-active', active ? 'true' : 'false');
        });

        // Ride the traveling glow pulse on the fill's leading edge.
        // Progress runs 0..1 across the whole flow (the fill spans it
        // in both modes), so the same percent positions the head on
        // either axis. Cross-axis centering is handled in CSS via
        // logical margins / insets; here we only drive the travel axis.
        if (methodPulse) {
          var pct = (Math.max(0, Math.min(1, progress || 0)) * 100)
            .toFixed(2) + '%';
          if (methodVerticalQuery.matches) {
            // vertical rail: travel downward on the top axis
            methodPulse.style.top = pct;
            methodPulse.style.insetInlineStart = '';
          } else {
            // horizontal line: travel across with inline-start
            methodPulse.style.insetInlineStart = pct;
            methodPulse.style.top = '';
          }
        }
      }
    });
  }

  /* ============================================================
     CURRICULUM SECTION
     ------------------------------------------------------------
     Responsibilities:
       Scroll-triggered reveal of the 10 module cards, in quick
       staggered batches (waves) — NOT each card as a heavy
       separate entrance. Cards are grouped 2 at a time (matching
       the 2-column row layout) so the grid reads as a sequence of
       row "waves" fading up together with a short per-card stagger.
     A single IntersectionObserver on the grid adds .is-visible to
     the whole grid once; each card's --delay (batch index) drives
     the quick stagger in CSS. Falls back gracefully.
     ============================================================ */
  var curriculumSection = document.querySelector('.curriculum');
  var curriculumReveals = Array.prototype.slice.call(
    document.querySelectorAll('.curriculum .c-reveal')
  );

  if (curriculumReveals.length) {
    if ('IntersectionObserver' in window) {
      var curriculumObserver = new IntersectionObserver(
        function (entries) {
          entries.forEach(function (entry) {
            if (entry.isIntersecting) {
              // Reveal all cards once (wave stagger handled by CSS).
              // Assign each a --delay so the stagger is already in
              // place before .is-visible flips them all visible.
              curriculumReveals.forEach(function (card, index) {
                card.style.setProperty('--delay', String(Math.floor(index / 2)));
              });
              curriculumReveals.forEach(function (card) {
                card.classList.add('is-visible');
              });
              curriculumObserver.unobserve(entry.target);
            }
          });
        },
        { threshold: 0.1 }
      );

      if (curriculumSection) {
        curriculumObserver.observe(curriculumSection);
      }
    } else {
      curriculumReveals.forEach(function (card) {
        card.classList.add('is-visible');
      });
    }
  }

  /* ============================================================
     LIVE SESSIONS + COACHING SECTION
     ------------------------------------------------------------
     Responsibilities:
       Scroll-position-driven reveals for the split editorial parts:
         - heading fades up when scrolled in
         - each part reveals its text (fade up) and its visual
           mockup (alternating side slide-in), tied to when that
           specific part enters the viewport
         - the center connecting statement reveals last, with the
           scale-in emphasis defined in CSS
     Each target gets its own lightweight observer so everything
     is bound to scroll position. Falls back gracefully.
     ============================================================ */
  function revealOnScroll(selector) {
    var targets = Array.prototype.slice.call(
      document.querySelectorAll(selector)
    );

    targets.forEach(function (el) {
      if ('IntersectionObserver' in window) {
        var io = new IntersectionObserver(
          function (entries) {
            entries.forEach(function (entry) {
              if (entry.isIntersecting) {
                el.classList.add('is-visible');
                io.unobserve(entry.target);
              }
            });
          },
          { threshold: 0.25 }
        );
        io.observe(el);
      } else {
        // Fallback: show immediately
        el.classList.add('is-visible');
      }
    });
  }

  // Heading (reveals first, when section is reached)
  revealOnScroll('.live__heading');

  // Each editorial part: reveal its text + visual together, per part.
  // The alternative (matching CSS) is that the visual slides from the
  // opposite side. We reveal text then visual via a small stagger delay
  // applied in CSS to the visual within each part.
  Array.prototype.forEach.call(
    document.querySelectorAll('.live .live__part'),
    function (part) {
      if ('IntersectionObserver' in window) {
        var partObserver = new IntersectionObserver(
          function (entries) {
            entries.forEach(function (entry) {
              if (entry.isIntersecting) {
                var text = Array.prototype.slice.call(
                  part.querySelectorAll('.l-reveal')
                );
                var visual = Array.prototype.slice.call(
                  part.querySelectorAll('.l-visual')
                );
                // Text first
                text.forEach(function (el) { el.classList.add('is-visible'); });
                // Visual next (its slide-in delay is set in CSS)
                visual.forEach(function (el) { el.classList.add('is-visible'); });
                partObserver.unobserve(entry.target);
              }
            });
          },
          { threshold: 0.3 }
        );
        partObserver.observe(part);
      } else {
        // Fallback
        Array.prototype.forEach.call(
          part.querySelectorAll('.l-reveal, .l-visual'),
          function (el) { el.classList.add('is-visible'); }
        );
      }
    }
  );

  // Center connecting statement — reveals last, after both blocks
  revealOnScroll('.live__closing');

  /* ============================================================
     ONE-TO-ONE COACHING DASHBOARD
     ------------------------------------------------------------
     Adds the internal sequential reveal for the Coaching Progress
     panel (the .coach-panel inside the second live part). The panel
     and text column are already revealed by the live-part observer
     above; here we only choreograph the panel's internals:
       1. Each .coach-progress-row fades up and its bar animates
          width 0 -> target, one after another (via --delay).
       2. After the last bar, the "Feedback received" status line
          fades in (delay 4).
       3. Then the "Next improvement" line fades in (delay 5).
     Follows the same IntersectionObserver + per-element --delay
     stagger convention used by Career Preparation. Falls back to
     showing everything on load when IO is unavailable.
     ============================================================ */
  var liveCoaching = document.getElementById('live-coaching');
  var coachRows = liveCoaching
    ? Array.prototype.slice.call(
        liveCoaching.querySelectorAll('.coach-progress-row')
      )
    : [];
  var coachStatus = liveCoaching
    ? Array.prototype.slice.call(
        liveCoaching.querySelectorAll('.coach-status')
      )
    : [];

  if (liveCoaching) {
    // Rows reveal top-to-bottom; each bar waits its --delay.
    coachRows.forEach(function (row, i) {
      row.style.setProperty('--delay', String(i));
    });

    // Status lines come after the last row (rows.length = 4).
    coachStatus.forEach(function (line, index) {
      line.style.setProperty('--delay', String(coachRows.length + index));
    });

    var coachTargets = coachRows.concat(coachStatus);

    if ('IntersectionObserver' in window) {
      var coachObserver = new IntersectionObserver(
        function (entries) {
          entries.forEach(function (entry) {
            if (entry.isIntersecting) {
              coachTargets.forEach(function (el) {
                el.classList.add('is-visible');
              });
              coachObserver.unobserve(entry.target);
            }
          });
        },
        { threshold: 0.2 }
      );
      coachObserver.observe(liveCoaching);
    } else {
      // Fallback: show everything immediately
      coachTargets.forEach(function (el) {
        el.classList.add('is-visible');
      });
    }
  }

  /* ============================================================
     LIVE SESSIONS PANEL — STORY-DRIVEN MICRO-DEMO ANIMATION
     ------------------------------------------------------------
     A timed, looping scenario cycle that tells the story of a
     live session:
       1. Container entrance (one-time, not looped)
       2. Header + LIVE dot reveal (one-time, LIVE dot pulses)
       3. Session topic reveal (one-time)
       4. Looping scenario cycle (indefinite):
          a. Objection fades in
          b. "How would you respond?" fades in
          c. Three checkmarks reveal one by one
          d. "Feedback received" badge appears then fades
          e. Transition to next scenario
     The loop uses timed class toggles driving CSS transitions.
     Only starts once when the section enters the viewport
     (IntersectionObserver, threshold 0.25). Reduced-motion users
     see one static final state (no looping).
     ============================================================ */
  var liveSessions = document.getElementById('live-sessions');
  var sessionPanel = liveSessions
    ? liveSessions.querySelector('.session-panel')
    : null;
  var sessionQuote = liveSessions
    ? liveSessions.querySelector('.session-quote')
    : null;
  var sessionPrompt = liveSessions
    ? liveSessions.querySelector('.session-prompt')
    : null;
  var sessionFeatures = liveSessions
    ? Array.prototype.slice.call(
        liveSessions.querySelectorAll('.session-feature')
      )
    : [];
  var sessionBadge = liveSessions
    ? liveSessions.querySelector('.session-badge')
    : null;

  /* Scenario data: the three objection scenarios that cycle */
  var SESSION_SCENARIOS = [
    '\u063a\u0627\u0644\u064A',         /* غالي */
    '\u0646\u062E\u0645\u0645 \u0648\u0646\u0631\u062C\u0639\u0644\u0643.', /* نخمم ونرجعلك. */
    '\u0645\u0627 \u0639\u0646\u062F\u064A\u0634 \u0627\u0644\u0648\u0642\u062A.' /* ما عنديش الوقت. */
  ];

  /* Timing constants (ms) — each step's wait duration */
  var T_ENTRANCE    = 700;   /* container entrance duration */
  var T_HDR_DELAY   = 200;   /* delay before header starts */
  var T_HDR         = 500;   /* header fade-in duration */
  var T_TOPIC_DELAY = 400;   /* delay before topic starts */
  var T_TOPIC       = 500;   /* topic fade-in duration */
  var T_Q_WAIT      = 400;   /* wait after quote appears */
  var T_P_WAIT      = 1800;  /* pause on "How would you respond?" */
  var T_F_STAGGER   = 250;   /* gap between each feature reveal */
  var T_F_AFTER     = 700;   /* wait after stagger starts until badge
                                (2 gaps * 250 + 200 so all three
                                checkmarks finish revealing) */
  var T_BADGE_HOLD  = 1000;  /* how long badge stays visible */
  var T_BADGE_FADE  = 400;   /* badge fade-out duration */
  var T_EXIT        = 400;   /* elements fade-out duration */
  var T_NEXT_GAP    = 400;   /* pause after fade-out before next cycle */

  /* --- Reduced-motion: show static state, skip loop entirely --- */
  if (liveSessions && sessionPanel) {
    if (prefersReducedMotion) {
      /* Show everything immediately in its final state */
      sessionPanel.classList.add('is-visible');
      if (sessionQuote) sessionQuote.classList.add('sp-is-visible');
      if (sessionPrompt) sessionPrompt.classList.add('sp-is-visible');
      sessionFeatures.forEach(function (f) { f.classList.add('sp-is-visible'); });
    } else if ('IntersectionObserver' in window) {
      var sessionEntranceDone = false;
      var sessionLoopStarted = false;

      var sessionObserver = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting && !sessionEntranceDone) {
            sessionEntranceDone = true;
            sessionObserver.unobserve(entry.target);
            startSessionEntrance();
          }
        });
      }, { threshold: 0.25 });
      sessionObserver.observe(liveSessions);
    } else {
      /* Fallback: show everything immediately */
      sessionPanel.classList.add('is-visible');
      if (sessionQuote) sessionQuote.classList.add('sp-is-visible');
      if (sessionPrompt) sessionPrompt.classList.add('sp-is-visible');
      sessionFeatures.forEach(function (f) { f.classList.add('sp-is-visible'); });
    }
  }

  /* --- One-time container entrance + header + topic reveal ------ */
  function startSessionEntrance() {
    /* Step 1: container fades + scales in (700ms) */
    sessionPanel.classList.add('is-visible');

    /* Step 2: header reveals ~200ms after entrance starts */
    setTimeout(function () {
      var platform = liveSessions.querySelector('.session-platform');
      var liveInd = liveSessions.querySelector('.session-live');
      var liveDot = liveSessions.querySelector('.session-live-dot');
      var sessionHead = liveSessions.querySelector('.session-head');

      if (platform) platform.classList.add('sp-is-visible');
      if (liveInd) {
        liveInd.classList.add('sp-is-visible');
        /* Start the LIVE dot's continuous pulse */
        if (liveDot) liveDot.classList.add('is-pulsing');
      }

      /* Step 3: session topic reveals ~400ms after header */
      setTimeout(function () {
        if (sessionHead) sessionHead.classList.add('sp-is-visible');

        /* Step 4: start the repeating scenario loop ~600ms after topic */
        setTimeout(function () {
          if (!sessionLoopStarted) {
            sessionLoopStarted = true;
            startSessionLoop();
          }
        }, 600);
      }, T_TOPIC_DELAY);
    }, T_HDR_DELAY);
  }

  /* --- The repeating scenario cycle -------------------------------- */
  function startSessionLoop() {
    var scenarioIndex = 0;

    function runScenario() {
      var objection = SESSION_SCENARIOS[scenarioIndex];

      /* Clear any leftover states from the previous cycle */
      clearScenarioState();

      /* 4a: Objection text fades + scales in (450ms) */
      setTimeout(function () {
        showScenarioQuote(objection);

        /* 4b: "How would you respond?" fades in after 400ms */
        setTimeout(function () {
          showScenarioPrompt();

          /* 4c: Three checkmarks reveal one after another */
          setTimeout(function () {
            showScenarioFeatures();

            /* 4d: Badge appears after last feature */
            setTimeout(function () {
              showScenarioBadge();

              /* 4e: Transition — everything fades out, then next scenario */
              setTimeout(function () {
                hideScenarioBadge();
                setTimeout(function () {
                  hideScenarioElements();

                  /* Advance to next scenario after fade-out completes */
                  setTimeout(function () {
                    scenarioIndex = (scenarioIndex + 1) % SESSION_SCENARIOS.length;
                    runScenario();
                  }, T_NEXT_GAP);
                }, T_BADGE_FADE);
              }, T_BADGE_HOLD);
            }, T_F_AFTER);
          }, T_F_STAGGER);
        }, T_Q_WAIT);
      }, 100);
    }

    runScenario();
  }

  /* --- Scenario helper functions ----------------------------------- */
  function clearScenarioState() {
    if (sessionQuote) {
      sessionQuote.classList.remove('sp-is-visible');
      sessionQuote.textContent = '';
    }
    if (sessionPrompt) {
      sessionPrompt.classList.remove('sp-is-visible');
    }
    sessionFeatures.forEach(function (f) {
      f.classList.remove('sp-is-visible');
    });
    if (sessionBadge) {
      sessionBadge.classList.remove('sp-is-visible');
    }
  }

  function showScenarioQuote(text) {
    if (sessionQuote) {
      sessionQuote.textContent = '\u201C' + text + '\u201D';
      sessionQuote.classList.add('sp-is-visible');
    }
  }

  function showScenarioPrompt() {
    if (sessionPrompt) {
      sessionPrompt.classList.add('sp-is-visible');
    }
  }

  function showScenarioFeatures() {
    sessionFeatures.forEach(function (feature, i) {
      setTimeout(function () {
        feature.classList.add('sp-is-visible');
      }, i * T_F_STAGGER);
    });
  }

  function showScenarioBadge() {
    if (sessionBadge) {
      sessionBadge.classList.add('sp-is-visible');
    }
  }

  function hideScenarioBadge() {
    if (sessionBadge) {
      sessionBadge.classList.remove('sp-is-visible');
    }
  }

  function hideScenarioElements() {
    if (sessionQuote) sessionQuote.classList.remove('sp-is-visible');
    if (sessionPrompt) sessionPrompt.classList.remove('sp-is-visible');
    sessionFeatures.forEach(function (f) {
      f.classList.remove('sp-is-visible');
    });
  }

  /* ============================================================
     LIVE SESSIONS — TEXT COLUMN ONE-TIME REVEAL
     ------------------------------------------------------------
     Heading fades up first, paragraph follows ~100-150ms after,
     then the four tag pills reveal in sequence with a short
     stagger. Only fires once when the section enters the viewport.
     After reveal, elements stay static — no looping.
     ============================================================ */
  var liveTextCol = document.getElementById('live-text-col');
  if (liveTextCol) {
    var textReveals = Array.prototype.slice.call(
      liveTextCol.querySelectorAll('.live-text-reveal')
    );

    if ('IntersectionObserver' in window) {
      var textColObserver = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            textReveals.forEach(function (el) {
              el.classList.add('is-visible');
            });
            textColObserver.unobserve(entry.target);
          }
        });
      }, { threshold: 0.25 });
      textColObserver.observe(liveTextCol);
    } else {
      /* Fallback: show everything immediately */
      textReveals.forEach(function (el) {
        el.classList.add('is-visible');
      });
    }
  }

  /* ============================================================
     CAREER PATH SECTION
     ------------------------------------------------------------
     The signature "path to opportunity" timeline:
       - heading + steps fade up with a top-down stagger when the
         section scrolls into view (k-reveal / is-visible)
       - reuse the shared bindScrollFill helper to grow the vertical
         brand-blue line as the user scrolls through the timeline
       - the render callback maps scroll progress onto each step's
         [data-state]: 'upcoming' -> 'active' -> 'completed', so the
         current stage reads forward and past stages are confirmed.
     ============================================================ */
  var careerTimeline = document.getElementById('career-timeline');
  var careerFill = careerTimeline
    ? careerTimeline.querySelector('.career__fill')
    : null;
  var careerSteps = careerTimeline
    ? Array.prototype.slice.call(careerTimeline.querySelectorAll('.career__step'))
    : [];

  /* --- 1. Reveal heading + steps, staggered top-down ----------- */
  if (careerTimeline) {
    // Assign a per-step reveal delay so the stagger reads instantly.
    careerSteps.forEach(function (step, i) {
      step.style.setProperty('--step-delay', String(i));
      // Default all to 'upcoming' until the fill reaches them.
      if (!step.hasAttribute('data-state')) {
        step.setAttribute('data-state', 'upcoming');
      }
    });
  }

  var careerReveals = Array.prototype.slice.call(
    document.querySelectorAll('.career .k-reveal')
  );
  if (careerReveals.length) {
    if ('IntersectionObserver' in window) {
      var careerObserver = new IntersectionObserver(
        function (entries) {
          entries.forEach(function (entry) {
            if (entry.isIntersecting) {
              careerReveals.forEach(function (el) {
                el.classList.add('is-visible');
              });
              if (careerTimeline) {
                careerObserver.unobserve(careerTimeline);
              }
            }
          });
        },
        { threshold: 0.1 }
      );
      if (careerTimeline) {
        careerObserver.observe(careerTimeline);
      }
    } else {
      careerReveals.forEach(function (el) {
        el.classList.add('is-visible');
      });
    }
  }

  /* --- 2. Scroll-driven line fill + step states ---------------- */
  if (careerTimeline && careerFill && careerSteps.length) {
    // The Method/Career share the horizontal breakpoint for the
    // vertical (mobile) layout; query it just like Method does.
    var careerVerticalQuery = window.matchMedia('(max-width: 56.25rem)');

    bindScrollFill({
      track: careerTimeline,
      fill: careerFill,
      query: careerVerticalQuery,
      isVertical: function () {
        return careerVerticalQuery.matches;
      },
      render: function (progress) {
        // Map 0..1 progress across N stages. Each step owns an equal
        // band; the one containing the progress point is 'active',
        // everything before is 'completed', after is 'upcoming'.
        var band = 1 / careerSteps.length;
        careerSteps.forEach(function (step, i) {
          var centre = (i + 0.5) * band;
          var state;
          if (progress >= centre) {
            state = 'completed';
          } else if (progress + band >= centre) {
            state = 'active';
          } else {
            state = 'upcoming';
          }
          if (step.getAttribute('data-state') !== state) {
            step.setAttribute('data-state', state);
          }
        });
      }
    });
  }

  /* ============================================================
     CAREER PATH — MOBILE STRIP + MODAL
     ------------------------------------------------------------
     At ≤900px the .career__timeline is display:none and a swipeable,
     scroll-snap horizontal strip (.career__strip) renders instead.
     This block:
       1. Tracks which column is nearest the strip's visible center
          (rAF-throttled) and toggles [data-active] on the column +
          matching progress dot.
       2. Opens the single reusable modal on column activation, filling
          it from the matching desktop .career__title/.career__desc
          (index-aligned) so the Arabic text is never duplicated.
       3. Closes via the × button, backdrop tap, or Escape, restoring
          body scroll + focus to the triggering column.
     The strip/modal are display:none on desktop, so these listeners
     are inert above 900px and never affect the desktop layout.
     ============================================================ */
  var careerStrip = document.getElementById('career-strip');
  var careerCols = careerStrip
    ? Array.prototype.slice.call(careerStrip.querySelectorAll('.career__col'))
    : [];
  var careerDots = Array.prototype.slice.call(
    document.querySelectorAll('.career__dots .career__dot')
  );
  var careerModal = document.getElementById('career-modal');
  var careerModalClose = document.getElementById('career-modal-close');
  var careerModalNum = document.getElementById('career-modal-num');
  var careerModalTitle = document.getElementById('career-modal-title');
  var careerModalDesc = document.getElementById('career-modal-desc');
  var lastActiveCol = careerCols[0] || null; // for focus restoration

  function setCareerActive(index) {
    careerCols.forEach(function (col, i) {
      if (col.getAttribute('data-active') === (i === index ? 'true' : 'false')) {
        return;
      }
      col.setAttribute('data-active', i === index ? 'true' : 'false');
    });
    careerDots.forEach(function (dot, i) {
      if (dot.getAttribute('data-active') === (i === index ? 'true' : 'false')) {
        return;
      }
      dot.setAttribute('data-active', i === index ? 'true' : 'false');
    });
  }

  function updateCareerActiveFromScroll() {
    if (!careerStrip || careerStrip.offsetParent === null) return; // hidden (desktop)
    var rect = careerStrip.getBoundingClientRect();
    var containerCenter = rect.left + rect.width / 2;
    var bestIndex = 0;
    var bestDist = Infinity;
    careerCols.forEach(function (col, i) {
      var cr = col.getBoundingClientRect();
      var colCenter = cr.left + cr.width / 2;
      var dist = Math.abs(colCenter - containerCenter);
      if (dist < bestDist) {
        bestDist = dist;
        bestIndex = i;
      }
    });
    setCareerActive(bestIndex);
    lastActiveCol = careerCols[bestIndex] || lastActiveCol;
  }

  // rAF throttle for the strip scroll handler
  var careerStripTicking = false;
  var careerStripOnScroll = function () {
    if (!careerStripTicking) {
      window.requestAnimationFrame(updateCareerActiveFromScroll);
      careerStripTicking = true;
    }
  };

  if (careerStrip) {
    careerStrip.addEventListener('scroll', careerStripOnScroll, { passive: true });
    // Set initial active column on load
    updateCareerActiveFromScroll();
  }

  /* --- Modal open/close -------------------------------------- */
  function openCareerModal(col) {
    if (!careerModal || !careerModalClose) return;
    var idx = col ? col.getAttribute('data-step') : '0';
    var i = parseInt(idx, 10);
    lastActiveCol = col;

    // Number + title come from the column itself.
    var num = col ? col.querySelector('.career__col-num') : null;
    var title = col ? col.querySelector('.career__col-title') : null;
    if (careerModalNum) {
      careerModalNum.textContent = num ? num.textContent : '';
    }
    if (careerModalTitle) {
      careerModalTitle.textContent = title ? title.textContent : '';
    }

    // Description comes from the matching desktop .career__desc (if any),
    // so the longer Arabic copy lives in exactly one place.
    var desc = careerSteps[i]
      ? careerSteps[i].querySelector('.career__desc')
      : null;
    if (careerModalDesc) {
      careerModalDesc.textContent = desc ? desc.textContent : '';
    }

    // Show (with fade/scale via [data-open]).
    careerModal.hidden = false;
    // Force a reflow so the transition runs from the closed state.
    void careerModal.offsetWidth;
    careerModal.setAttribute('data-open', 'true');

    // Lock background scroll (same pattern as setMobileMenu).
    document.body.style.overflow = 'hidden';

    // Move focus to the close button for a usable dialog.
    careerModalClose.focus();
  }

  function closeCareerModal(restoreFocus) {
    if (!careerModal || careerModal.hidden) return;
    careerModal.setAttribute('data-open', 'false');
    // Unlock background scroll.
    document.body.style.overflow = '';

    // Wait for the fade/scale exit before hiding (transition cleanup).
    var onTransitionEnd = function () {
      careerModal.hidden = true;
      careerModal.removeEventListener('transitionend', onTransitionEnd);
      // Return focus to the stage that opened this modal.
      if (restoreFocus !== false && lastActiveCol && lastActiveCol.focus) {
        lastActiveCol.focus();
      }
    };
    careerModal.addEventListener('transitionend', onTransitionEnd);
  }

  // Open on column activation (click / keyboard Enter/Space via <button>).
  careerCols.forEach(function (col) {
    col.addEventListener('click', function () {
      setCareerActive(careerCols.indexOf(col));
      openCareerModal(col);
    });
  });

  if (careerModal) {
    // Close via the × button.
    careerModalClose.addEventListener('click', function () {
      closeCareerModal(true);
    });

    // Close via backdrop click (target === overlay, not the card).
    careerModal.addEventListener('click', function (event) {
      if (event.target === careerModal) {
        closeCareerModal(true);
      }
    });

    // Close via Escape.
    document.addEventListener('keydown', function (event) {
      if (
        event.key === 'Escape' &&
        careerModal &&
        !careerModal.hidden &&
        careerModal.getAttribute('data-open') === 'true'
      ) {
        closeCareerModal(true);
      }
    });
  }

  /* ============================================================
     CAREER PREPARATION SECTION
     ------------------------------------------------------------
     Step-by-step "career journey" animation synced between the
     right dashboard panel and the left text column. When the
     section scrolls into view (once):
       1. .prep__panel fades & scales in; block label appears.
       2. Each profile item (.prep__row) reveals top-to-bottom with
          its checkmark while the matching left text block
          (linked by data-key) becomes active and the previous one
          dims back.
       3. The readiness bar (.prep__fill) animates 0 -> 85% while
          the percentage counts up, then the "ready" line fades in.
       4. After a pause, the dashboard cross-fades into the final
          "CAREER READY" flow state (.prep__ready).
     Uses the branch's IntersectionObserver pattern (timed sequence,
     one-time). Reduced-motion users get the final CAREER READY
     state directly. Falls back to showing everything when IO is
     unavailable.
     ============================================================ */
  var prepSection = document.getElementById('career-preparation');
  var prepPanel = prepSection
    ? prepSection.querySelector('.prep__panel')
    : null;
  var prepBuilding = prepSection
    ? prepSection.querySelector('.prep__building')
    : null;
  var prepReady = prepSection
    ? prepSection.querySelector('.prep__ready')
    : null;
  var prepReadyTitle = prepSection
    ? prepSection.querySelector('.prep__ready-title')
    : null;
  var prepReadyLine = prepSection
    ? prepSection.querySelectorAll('.prep__ready-line')
    : [];
  var prepRows = prepSection
    ? Array.prototype.slice.call(prepSection.querySelectorAll('.prep__row'))
    : [];
  var prepNotes = prepSection
    ? Array.prototype.slice.call(prepSection.querySelectorAll('.prep__note'))
    : [];
  var prepBlockLabel = prepSection
    ? prepSection.querySelector('.prep__block-label')
    : null;
  var prepMeter = prepSection
    ? prepSection.querySelector('.prep__meter')
    : null;
  var prepFill = prepSection
    ? prepSection.querySelector('.prep__fill')
    : null;
  var prepPct = prepSection
    ? prepSection.querySelector('.prep__pct')
    : null;
  var prepBuildLabel = prepSection
    ? prepSection.querySelector('.prep__block--readiness .prep__block-label')
    : null;

  /* Ordered reveal sequence: each row's data-key + the matching text
     block's data-key (they align on purpose). */
  var PREP_ORDER = ['cv', 'linkedin', 'search', 'applications', 'remote'];

  /* Timing constants (ms) */
  var PREP_STEP_GAP   = 650;  /* between each item reveal */
  var PREP_READY_GAP  = 600;  /* pause before the readiness bar */
  var PREP_FILL_GAP   = 400;  /* pause before the ready line */
  var PREP_FINAL_PAUSE = 1300;/* pause before the final cross-fade */
  var PREP_FADE       = 500;  /* cross-fade duration */

  var prepSequenceStarted = false;

  /* --- Reduced motion: show final CAREER READY state directly --- */
  if (prepSection && prepPanel) {
    if (prefersReducedMotion) {
      showPrepReadyFinal(true);
    } else if ('IntersectionObserver' in window) {
      var prepObserver = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting && !prepSequenceStarted) {
            prepSequenceStarted = true;
            prepObserver.unobserve(entry.target);
            startPrepSequence();
          }
        });
      }, { threshold: 0.15 });
      prepObserver.observe(prepSection);
    } else {
      /* Fallback: show the final state immediately */
      showPrepReadyFinal(true);
    }
  }

  /* --- Reveal the final CAREER READY state ---------------------- */
  function showPrepReadyFinal(alsoPanel) {
    if (prepBuilding) prepBuilding.classList.add('prep-is-hidden');
    if (prepReady) {
      prepReady.hidden = false;
      prepReady.classList.add('is-visible');
    }
    if (alsoPanel && prepPanel) prepPanel.classList.add('is-visible');
    if (prepReadyTitle) prepReadyTitle.classList.add('is-visible');
    /* Reveal the ready flow (stages/arrows) + closing line */
    prepReadyLine.forEach(function (line) { line.classList.add('is-visible'); });
  }

  /* --- Run the timed building sequence --------------------------- */
  function startPrepSequence() {
    /* 1. Panel + block label appear */
    prepPanel.classList.add('is-visible');
    if (prepBlockLabel) prepBlockLabel.classList.add('is-visible');

    var t = 400;

    /* 2. Reveal each profile item + activate its matching text block */
    PREP_ORDER.forEach(function (key) {
      setTimeout(function () {
        var row = prepRows.filter(function (r) {
          return r.getAttribute('data-key') === key;
        })[0];
        if (row) {
          row.classList.add('is-visible');
          row.setAttribute('data-reached', 'true');
        }
        activatePrepNote(key);
      }, t);
      t += PREP_STEP_GAP;
    });

    /* 3. Readiness bar fills to 85% (percent counts up alongside) */
    setTimeout(function () {
      runPrepMeter();
    }, t + PREP_READY_GAP);

    /* 4. Cross-fade into the final CAREER READY flow */
    setTimeout(function () {
      if (prepBuilding) prepBuilding.classList.add('prep-is-hidden');
      if (prepReady) {
        prepReady.hidden = false;
        prepReady.classList.add('is-visible');
      }
      if (prepReadyTitle) prepReadyTitle.classList.add('is-visible');
      prepReadyLine.forEach(function (line) {
        line.classList.add('is-visible');
      });
    }, t + PREP_READY_GAP + PREP_FILL_GAP + PREP_FINAL_PAUSE + PREP_FADE);
  }

  /* --- Activate one text block, dim the rest -------------------- */
  function activatePrepNote(key) {
    prepNotes.forEach(function (note) {
      var active = note.getAttribute('data-key') === key;
      note.classList.toggle('is-active', !!active);
    });
  }

  /* --- Animate the readiness bar 0 -> 85% ------------------------ */
  function runPrepMeter() {
    if (prepBuildLabel) prepBuildLabel.classList.add('is-visible');
    if (prepMeter) prepMeter.classList.add('is-visible');

    var target = 85;
    var duration = 1400;
    var start = null;

    function frame(ts) {
      if (!start) start = ts;
      var p = Math.min(1, (ts - start) / duration);
      var eased = 1 - Math.pow(1 - p, 3); /* ease-out cubic */
      var value = Math.round(target * eased);

      if (prepFill) prepFill.style.width = value + '%';
      if (prepPct) prepPct.textContent = value + '%';
      if (prepPct) {
        var track = prepMeter ? prepMeter.querySelector('.prep__track') : null;
        if (track) track.setAttribute('aria-valuenow', String(value));
      }

      if (p < 1) {
        window.requestAnimationFrame(frame);
      } else {
        if (prepPct) prepPct.textContent = target + '%';
      }
    }

    window.requestAnimationFrame(frame);

    /* Reveal the "ready" line after the fill completes */
    setTimeout(function () {
      var line = prepSection
        ? prepSection.querySelector('.prep__block--readiness .prep__ready-line')
        : null;
      if (line) line.classList.add('is-visible');
    }, PREP_FILL_GAP + duration);
  }

  /* ============================================================
     PAID PRACTICE SECTION
     ------------------------------------------------------------
     Restrained, premium reveal for the 4-stage flow:
       1. The big typographic statement (.paid__heading) fades up
          first via IntersectionObserver (one-time).
       2. A scroll-driven fill (reuses the shared bindScrollFill
          helper) draws the thin connecting line from LEARN ->
          BUILD EXPERIENCE as the user scrolls through the flow.
          Each stage (.paid__stage) becomes emphasized ([data-active])
          once the fill has reached its position, muted before.
       3. The neutral disclaimer note (.paid__note) fades in last
          (calmly, via CSS transition-delay) — no dramatic motion.
     ============================================================ */
  var paidSection = document.getElementById('paid-practice');
  var paidFlow = paidSection
    ? paidSection.querySelector('.paid__flow')
    : null;
  var paidFill = paidSection
    ? paidSection.querySelector('.paid__fill')
    : null;
  var paidStages = paidSection
    ? Array.prototype.slice.call(paidSection.querySelectorAll('.paid__stage'))
    : [];

  /* --- 1. Fade-up reveal of statement + note (one-time) -------- */
  var paidReveals = document.querySelectorAll('.paid-reveal');
  if (paidReveals.length) {
    if ('IntersectionObserver' in window) {
      var paidObserver = new IntersectionObserver(
        function (entries) {
          entries.forEach(function (entry) {
            if (entry.isIntersecting) {
              paidReveals.forEach(function (el) {
                el.classList.add('is-visible');
              });
              paidObserver.disconnect();
            }
          });
        },
        { threshold: 0.15 }
      );
      paidReveals.forEach(function (el) { paidObserver.observe(el); });
    } else {
      paidReveals.forEach(function (el) { el.classList.add('is-visible'); });
    }
  }

  /* --- 2. Scroll-driven line fill + stage emphasis ------------- */
  if (paidFlow && paidFill && paidStages.length) {
    // Share the same horizontal/vertical breakpoint used by Method
    // and Career Path so the layout mode stays consistent on resize.
    var paidVerticalQuery = window.matchMedia('(max-width: 56.25rem)');

    bindScrollFill({
      track: paidFlow,
      fill: paidFill,
      query: paidVerticalQuery,
      isVertical: function () {
        return paidVerticalQuery.matches;
      },
      render: function (progress) {
        // Emphasize each stage once the fill has passed it
        // (simple "active once reached" behaviour, like Method).
        var activeCount = Math.round(progress * paidStages.length);
        paidStages.forEach(function (stage, i) {
          var active = i < activeCount;
          var current = stage.getAttribute('data-active');
          var next = active ? 'true' : 'false';
          if (current !== next) {
            stage.setAttribute('data-active', next);
          }
        });
      }
    });
  }

  /* ============================================================
     CAREER COMMUNITY SECTION
     ------------------------------------------------------------
     A unified "Career Board" that builds up and then plays a
     one-time filter demo before handing control to the visitor.
     One IntersectionObserver triggers the sequence once:
       1. Heading block fades up first.
       2. Board panel (+ top bar) fades in.
       3. Search bar fades in and its typewriter starts looping.
       4. Category tabs fade in (indicator settles on "All").
       5. Feed note fades in.
       6. Listing rows reveal one after another; the "New" badge
          pops in on the first row.
       7. Closing paragraph + mini bridge flow fade in.
       8. ONE-TIME demo: underline slides All -> Algeria -> Remote
          -> International -> All, filtering listings each step.
       9. Manual control enabled (never auto-runs again).
     Reduced-motion users skip the typewriter/demo and see all
     listings with "All" active, fully controllable immediately.
     Falls back to showing everything on load if IO is unavailable.
     ============================================================ */
  var communitySection = document.getElementById('career-community');
  if (communitySection) {
    var comReveals = communitySection.querySelectorAll('.community-reveal');
    var comParts = communitySection.querySelectorAll('.community-part');
    var comSearch = communitySection.querySelector('.community__search');
    var comTypeText = communitySection.querySelector('.community__typewriter-text');
    var comTabsEl = communitySection.querySelector('.community__tabs');
    var comTabs = Array.prototype.slice.call(
      communitySection.querySelectorAll('.community__tab')
    );
    var comIndicator = communitySection.querySelector('.community__tab-indicator');
    var comJobs = Array.prototype.slice.call(
      communitySection.querySelectorAll('.community__job')
    );
    var comBadge = communitySection.querySelector('.community__new-badge');

    /* Typewriter words + gentle timings (calm, readable) */
    var COM_WORDS = [
      'Sales',
      'Customer Service',
      'Appointment Setting',
      'Business Development'
    ];
    var COM_TYPE_MS = 90;    /* per char while typing  (80-120ms) */
    var COM_DELETE_MS = 50;  /* per char while deleting (40-60ms) */
    var COM_TYPED_HOLD = 1500; /* pause with full word visible (1.2-1.8s) */
    var COM_DELETED_HOLD = 400; /* pause with field empty (300-500ms) */

    var comDemoRunning = false;
    var comControlEnabled = false;
    var comAnimationStarted = false;

    /* --- Reduced motion: static board, manual from the start ------ */
    function showCommunityStatic() {
      Array.prototype.forEach.call(comReveals, function (el) {
        el.classList.add('is-visible');
      });
      Array.prototype.forEach.call(comParts, function (el) {
        el.classList.add('is-visible');
      });
      comJobs.forEach(function (job) { job.classList.add('is-visible'); });
      if (comBadge) comBadge.classList.add('is-visible');
      if (comTypeText) comTypeText.textContent = COM_WORDS[0]; /* static word */
      if (comTabsEl) comTabsEl.classList.add('is-visible');
      if (comSearch) comSearch.classList.add('is-visible');
      /* "All" active, all listings visible */
      setCommunityTab('all', false);
      comControlEnabled = true;
    }

    if (prefersReducedMotion) {
      showCommunityStatic();
    } else if ('IntersectionObserver' in window) {
      var communityObserver = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting && !comAnimationStarted) {
            comAnimationStarted = true;
            communityObserver.unobserve(entry.target);
            startCommunityBoard();
          }
        });
      }, { threshold: 0.15 });
      communityObserver.observe(communitySection);
    } else {
      /* Fallback: show the static board immediately */
      showCommunityStatic();
    }

    /* --- Timed build + demo sequence ------------------------------ */
    function startCommunityBoard() {
      var head = communitySection.querySelector('.community__head');
      var board = communitySection.querySelector('.community__board');
      var feedNote = communitySection.querySelector('.community__feed-note');
      var list = communitySection.querySelector('.community__list');
      var closing = communitySection.querySelector('.community__closing');
      var bridge = communitySection.querySelector('.community__bridge');

      step(0, function () { if (head) head.classList.add('is-visible'); });
      step(250, function () { if (board) board.classList.add('is-visible'); });
      step(650, function () {
        if (comSearch) comSearch.classList.add('is-visible');
        startCommunityTypewriter();
      });
      step(850, function () {
        if (comTabsEl) comTabsEl.classList.add('is-visible');
        setCommunityTab('all', false);
      });
      step(1000, function () { if (feedNote) feedNote.classList.add('is-visible'); });
      step(1050, function () { if (list) list.classList.add('is-visible'); });

      /* Listings stagger + "New" badge pops in on the first row */
      comJobs.forEach(function (job, i) {
        step(1200 + i * 380, function () { job.classList.add('is-visible'); });
      });
      step(1500, function () { if (comBadge) comBadge.classList.add('is-visible'); });

      /* Closing paragraph + mini bridge flow */
      step(2900, function () { if (closing) closing.classList.add('is-visible'); });
      step(3300, function () { if (bridge) bridge.classList.add('is-visible'); });

      /* One-time filter demo: All -> Algeria -> Remote -> Intl -> All */
      step(3600, function () { runCommunityDemo(); });
    }

    /* --- Tiny timeout helper (keeps the pacing readable) ---------- */
    function step(ms, fn) {
      setTimeout(fn, ms);
    }

    /* --- Typewriter: loops through COM_WORDS forever once started.
           Pure self-scheduling setTimeout chain — each step schedules
           the next, so it can never run just once or stop itself.
           Phases per keyword: type -> hold -> delete -> empty-hold
           -> advance to next keyword (and wrap back to the first).
           The caret blinks independently via CSS (communityCaret,
           continuous), so it never stops during any phase including
           the empty pause. ------------------------------------------ */
    function startCommunityTypewriter() {
      if (!comTypeText) return;

      var wordIndex = 0;

      function schedule(fn, ms) { setTimeout(fn, ms); }

      /* Type one character at a time until the word is complete. */
      function typeWord(word, i) {
        comTypeText.textContent = word.slice(0, i);
        if (i === word.length) {
          schedule(function () { holdWord(word); }, COM_TYPED_HOLD);
          return;
        }
        schedule(function () { typeWord(word, i + 1); }, COM_TYPE_MS);
      }

      /* Pause with the full word visible, then delete. */
      function holdWord(word) {
        schedule(function () { deleteWord(word, word.length); }, 0);
      }

      /* Delete one character at a time from the end until empty. */
      function deleteWord(word, i) {
        comTypeText.textContent = word.slice(0, i);
        if (i === 0) {
          schedule(function () { nextWord(); }, COM_DELETED_HOLD);
          return;
        }
        schedule(function () { deleteWord(word, i - 1); }, COM_DELETE_MS);
      }

      /* Empty pause over, advance (wrapping) and type again. */
      function nextWord() {
        wordIndex = (wordIndex + 1) % COM_WORDS.length;
        schedule(function () { typeWord(COM_WORDS[wordIndex], 0); }, 0);
      }

      /* Kick off with an empty field, typing the first keyword. */
      comTypeText.textContent = '';
      schedule(function () { typeWord(COM_WORDS[0], 0); }, 0);
    }

    /* --- Set the active tab: move underline + filter listings ----- */
    function setCommunityTab(key, fromDemo) {
      if (fromDemo && !comDemoRunning) return; /* ignore stray calls */

      var activeTab = null;
      comTabs.forEach(function (tab) {
        var isActive = tab.getAttribute('data-category') === key;
        tab.classList.toggle('is-active', isActive);
        tab.setAttribute('aria-selected', isActive ? 'true' : 'false');
        if (isActive) activeTab = tab;
      });

      if (activeTab && comIndicator) {
        /* tabs container is position:relative, so offsetLeft is
           already measured from it; align the absolute indicator. */
        comIndicator.style.transform = 'translateX(' + activeTab.offsetLeft + 'px)';
        comIndicator.style.width = activeTab.offsetWidth + 'px';
      }

      /* Filter listings: "all" shows everything, else match category */
      comJobs.forEach(function (job) {
        var show = key === 'all' || job.getAttribute('data-category') === key;
        job.classList.toggle('is-hidden', !show);
      });
    }

    /* --- One-time automatic demo cycle ---------------------------- */
    function runCommunityDemo() {
      comDemoRunning = true;
      var order = ['algeria', 'remote', 'international', 'all'];
      var i = 0;

      function next() {
        if (i >= order.length) {
          comDemoRunning = false;
          comControlEnabled = true;
          return;
        }
        setCommunityTab(order[i], true);
        i += 1;
        setTimeout(next, 1400); /* slow, calm pacing */
      }

      setTimeout(next, 1200);
    }

    /* --- Manual control (active only after the demo finishes) ----- */
    comTabs.forEach(function (tab) {
      tab.addEventListener('click', function () {
        if (comDemoRunning || !comControlEnabled) return;
        setCommunityTab(tab.getAttribute('data-category'), false);
      });
    });
  }

  /* ============================================================
     SKILL TO SERVICE SECTION
     ------------------------------------------------------------
     The "interactive-feeling" skill map. Two responsibilities:

     1. RESPONSIVE RADIAL LAYOUT
        On desktop the 8 service labels are arranged radially around
        a central "SKILL" node; 8 SVG lines connect them (all equal
        length, so one --len value drives the stroke draw). On mobile
        the labels stack vertically beneath the node with a trunk.
        positions are recomputed on resize / breakpoint flip.

     2. COORDINATED MULTI-STEP REVEAL
        One IntersectionObserver triggers, and CSS transition-delay
        orders the sequence (all on .skill__map.is-visible +
        .skill-reveal.is-visible):
          1. heading            (0s delay)
          2. core node          scales/fades in       (~0.1s)
          3. SVG lines draw outward (dashoffset->0)   (~0.45s, staged)
          4. 8 labels pop in    at end of their lines (~0.55s, staged)
          5. career path row    fades up from below   (~1.7s)
     ============================================================ */
  var skillSection = document.getElementById('skill-to-service');
  if (skillSection) {
    var skillMap = skillSection.querySelector('#skill-map');
    var skillLines = skillSection.querySelector('.skill__lines');
    var skillBranches = Array.prototype.slice.call(
      skillSection.querySelectorAll('.skill__branch')
    );
    var skillLineEls = skillLines
      ? Array.prototype.slice.call(skillLines.querySelectorAll('line'))
      : [];

    // Map each element's data-i onto a --i custom property so CSS can
    // use it for the staggered line-draw / label-pop timing.
    skillBranches.forEach(function (branch, i) {
      branch.style.setProperty('--i', String(i));
    });
    skillLineEls.forEach(function (line, i) {
      line.style.setProperty('--i', String(i));
    });

    // Share the same breakpoint used across Method/Career/Paid.
    var skillMobileQ = window.matchMedia('(max-width: 56.25rem)');

    // Recompute the radial/vertical arrangement to match the layout.
    function layoutSkillMap() {
      if (!skillMap || !skillLines) return;

      var rect = skillMap.getBoundingClientRect();

      if (skillMobileQ.matches) {
        // Mobile: clear radial inline positions (CSS handles the
        // branching map layout + trunk; the radial SVG is hidden).
        skillBranches.forEach(function (branch) {
          branch.style.left = '';
          branch.style.top = '';
          branch.style.marginInlineStart = '';
          branch.style.marginInlineEnd = '';
        });
      } else {
        // Desktop: hub-and-spoke. Center node at the middle; each of
        // the 8 spokes radiates with equal length R.
        var cx = rect.width / 2;
        var cy = rect.height / 2;
        var R = Math.min(rect.width, rect.height) * 0.34;

        // Line endpoints are shortened to R*0.85 so the line terminates
        // at the dot's position, well before the label text begins.
        // Branch positions stay at the full R so the overall radial
        // spread is unchanged — only the visible line length shrinks.
        var lineR = R * 0.85;

        // The two horizontal spokes (left i=6 "Sales Support" and right
        // i=2 "Appointment Setting") run their label directly along the
        // line's axis, so the standard R*0.85 endpoint overshoots and
        // crosses the text. Shorten only these two lines so they stop
        // with the same relative gap from their label (R - lineR) that
        // the other six spokes leave before their dot.
        var edgeGap = R - lineR;

        skillBranches.forEach(function (branch, i) {
          var angle = (Math.PI * 2 * i) / skillBranches.length - Math.PI / 2;
          var x = cx + R * Math.cos(angle);
          var y = cy + R * Math.sin(angle);

          branch.style.left = x + 'px';
          branch.style.top = y + 'px';

          if (skillLineEls[i]) {
            var eR = lineR;
            // Only the two horizontal spoke lines are shortened; the
            // nearest branch content sits R - halfW from the hub.
            if (i === 2 || i === 6) {
              var halfW = branch.offsetWidth / 2;
              var stop = R - halfW - edgeGap;
              eR = stop > 0 ? stop : lineR;
            }
            var lx = cx + eR * Math.cos(angle);
            var ly = cy + eR * Math.sin(angle);
            skillLineEls[i].setAttribute('x1', cx);
            skillLineEls[i].setAttribute('y1', cy);
            skillLineEls[i].setAttribute('x2', lx);
            skillLineEls[i].setAttribute('y2', ly);
          }
        });

        // All spokes share the same length, so one --len drives the
        // stroke-dasharray / dashoffset draw for every line.
        skillLines.style.setProperty('--len', lineR + 'px');
      }
    }

    // Reveal: trigger the whole coordinated sequence when the map
    // scrolls into view (CSS transition-delay handles the order).
    function revealSkill() {
      if (skillMap) skillMap.classList.add('is-visible');
      Array.prototype.forEach.call(
        skillSection.querySelectorAll('.skill-reveal'),
        function (el) { el.classList.add('is-visible'); }
      );
    }

    if ('IntersectionObserver' in window) {
      var skillObserver = new IntersectionObserver(
        function (entries) {
          entries.forEach(function (entry) {
            if (entry.isIntersecting) {
              revealSkill();
              skillObserver.disconnect();
            }
          });
        },
        { threshold: 0.2 }
      );
      if (skillMap) skillObserver.observe(skillMap);
    } else {
      // Fallback: reveal + layout immediately
      revealSkill();
      layoutSkillMap();
    }

    // Keep the radial/vertical arrangement correct across sizes.
    if (skillMobileQ.addEventListener) {
      skillMobileQ.addEventListener('change', layoutSkillMap);
    } else if (skillMobileQ.addListener) {
      skillMobileQ.addListener(layoutSkillMap);
    }
    window.addEventListener('resize', layoutSkillMap);
    layoutSkillMap();
  }

  /* ============================================================
     WHO IS THIS FOR SECTION
     ------------------------------------------------------------
     Reveals the audience bento grid as ONE cohesive group with a
     subtle stagger (NOT a long one-by-one sequence like the
     Curriculum grid or the Career Prep dashboard). A single
     IntersectionObserver watches the grid; on scroll-in, the heading
     fades up first, then the cards pop in as a quick block, each
     offset by a small --delay (40ms) via CSS. Drops back gracefully
     when IntersectionObserver is unavailable.
     ============================================================ */
  var audSection = document.getElementById('who-is-this-for');
  if (audSection) {
    var audReveals = Array.prototype.slice.call(
      audSection.querySelectorAll('.aud-reveal')
    );

    // Tiny per-card delay for the grouped "pop" (heading reads second
    // to last row since DOM order is heading -> cards; heading itself
    // has no delay rule so it appears immediately).
    audReveals.forEach(function (el, index) {
      el.style.setProperty('--delay', String(index));
    });

    if ('IntersectionObserver' in window) {
      var audObserver = new IntersectionObserver(
        function (entries) {
          entries.forEach(function (entry) {
            if (entry.isIntersecting) {
              audReveals.forEach(function (el) {
                el.classList.add('is-visible');
              });
              audObserver.disconnect();
            }
          });
        },
        { threshold: 0.1 }
      );
      audObserver.observe(audSection);
    } else {
      // Fallback: show everything immediately
      audReveals.forEach(function (el) {
        el.classList.add('is-visible');
      });
    }
  }

  /* ============================================================
     WHAT YOU GET SECTION
     ------------------------------------------------------------
     Program Overview reveal. Reads as one connected composition and
     is intentionally CALMER than the Curriculum grid or the Career
     Prep dashboard — no long sequential pass. Sequence:
       1. heading fades up            (delay 0)
       2. "SKILLOVA PROGRAM" hub scales+fades in (delay ~0.12s)
       3. the 4 clusters fade up in quick succession
          (0.24s + i * 0.10s)
       4. each cluster's list items get a tiny internal stagger
          (per-item --wyg-item offset of i * 0.04s)
     A single IntersectionObserver adds .is-visible to every reveal
     node at once; the timing is driven purely by CSS transition
     delays (set here as custom properties). Falls back gracefully.
     ============================================================ */
  var getSection = document.getElementById('what-you-get');
  if (getSection) {
    // Timing helpers.
    var getHeading = getSection.querySelector('.get__heading');
    var getHub = getSection.querySelector('.get__hub-wrap');
    var getClusters = Array.prototype.slice.call(
      getSection.querySelectorAll('.get__cluster')
    );

    // 1. heading reveals first.
    if (getHeading) getHeading.style.setProperty('--wyg-delay', '0s');
    // 2. hub label scales in shortly after.
    if (getHub) getHub.style.setProperty('--wyg-delay', '0.12s');
    // 3. clusters fade up in quick succession.
    getClusters.forEach(function (cluster, i) {
      cluster.style.setProperty('--wyg-delay', (0.24 + i * 0.1).toFixed(2) + 's');

      // 4. subtle internal stagger for the list items.
      var items = Array.prototype.slice.call(cluster.querySelectorAll('li'));
      items.forEach(function (item, j) {
        item.style.setProperty('--wyg-item', (j * 0.04).toFixed(2) + 's');
      });
    });

    // All reveal nodes inside the section.
    var wygReveals = Array.prototype.slice.call(
      getSection.querySelectorAll('.reveal-wyg')
    );

    if ('IntersectionObserver' in window) {
      var getObserver = new IntersectionObserver(
        function (entries) {
          entries.forEach(function (entry) {
            if (entry.isIntersecting) {
              wygReveals.forEach(function (el) {
                el.classList.add('is-visible');
              });
              getObserver.disconnect();
            }
          });
        },
        { threshold: 0.15 }
      );
      getObserver.observe(getSection);
    } else {
      // Fallback: show everything immediately
      wygReveals.forEach(function (el) {
        el.classList.add('is-visible');
      });
    }
  }

  /* ============================================================
     WHY SKILLOVA SECTION
     ------------------------------------------------------------
     A calm, PURE-TYPOGRAPHY reveal (no icons, no cards, no grid
     bounce). Sequence (rated moderate — not as intense as Career
     Path or Skill-to-Service):
       1. heading fades up                       (delay 0)
       2. SKILLOVA wordmark scales+fades in      (delay ~0.10s)
       3. the 5 principles fade up one after
          another in reading order               (0.24s + i * 0.14s)
          — each English word + Arabic description reveal together
            as one unit
       4. closing statement fades up last, with a subtle scale-in
          emphasize like .problem__close-big    (delay ~0.94s)
     Same architecture as every other section: a single
     IntersectionObserver adds .is-visible to each .w-reveal node at
     once; timing is driven only by the --why-delay CSS custom
     property set here. Calm --ease-out, no bounce. Falls back.
     ============================================================ */
  var whySection = document.getElementById('why-skillova');
  if (whySection) {
    var whyHeading = whySection.querySelector('.why__heading');
    var whyWordmark = whySection.querySelector('.why__wordmark-wrap');
    var whyPrinciples = Array.prototype.slice.call(
      whySection.querySelectorAll('.why__principle')
    );
    var whyClose = whySection.querySelector('.why__close');

    var whyStep = 0.14; // seconds between each principle

    // 1. heading reveals first.
    if (whyHeading) whyHeading.style.setProperty('--why-delay', '0s');
    // 2. wordmark anchor scales in shortly after.
    if (whyWordmark) whyWordmark.style.setProperty('--why-delay', '0.1s');
    // 3. principles stagger in reading order.
    whyPrinciples.forEach(function (principle, i) {
      principle.style.setProperty(
        '--why-delay',
        (0.24 + i * whyStep).toFixed(2) + 's'
      );
    });
    // 4. closing statement last, with emphasis.
    if (whyClose) {
      whyClose.style.setProperty(
        '--why-delay',
        (0.24 + whyPrinciples.length * whyStep).toFixed(2) + 's'
      );
    }

    // All reveal nodes inside the section.
    var whyReveals = Array.prototype.slice.call(
      whySection.querySelectorAll('.w-reveal')
    );

    if ('IntersectionObserver' in window) {
      var whyObserver = new IntersectionObserver(
        function (entries) {
          entries.forEach(function (entry) {
            if (entry.isIntersecting) {
              whyReveals.forEach(function (el) {
                el.classList.add('is-visible');
              });
              whyObserver.disconnect();
            }
          });
        },
        { threshold: 0.15 }
      );
      whyObserver.observe(whySection);
    } else {
      // Fallback: show everything immediately
      whyReveals.forEach(function (el) {
        el.classList.add('is-visible');
      });
    }
  }

  /* ============================================================
     ABOUT SKILLOVA SECTION
     ------------------------------------------------------------
     The human, calm "about" split. Animation strength is LOW (⭐⭐):
       1. visual: portrait photo fades in first (delay 0, a slower
          opacity+scale/translate entrance; the slow float + glowing
          halo start automatically in CSS once it settles)
       2. text:   each child staggers in individually — eyebrow,
          heading, tagline, lead block, then LEARN / PRACTICE /
          OPPORTUNITY one after another. Each element carries its
          own --a-delay (mapped in CSS), 100-150ms apart.
     Same architecture as every other section: one IntersectionObserver
     adds .is-visible to all .a-reveal + .about-reveal nodes at once;
     timing is driven only by the CSS --a-delay values. Falls back
     gracefully.
     ============================================================ */
  var aboutSection = document.getElementById('about-skillova');
  if (aboutSection) {
    var aboutVisual = aboutSection.querySelector('.about__visual');

    // 1. visual fades in first.
    if (aboutVisual) aboutVisual.style.setProperty('--a-delay', '0s');

    var aboutReveals = Array.prototype.slice.call(
      aboutSection.querySelectorAll('.a-reveal, .about-reveal')
    );

    if ('IntersectionObserver' in window) {
      var aboutObserver = new IntersectionObserver(
        function (entries) {
          entries.forEach(function (entry) {
            if (entry.isIntersecting) {
              aboutReveals.forEach(function (el) {
                el.classList.add('is-visible');
              });
              aboutObserver.disconnect();
            }
          });
        },
        { threshold: 0.15 }
      );
      aboutObserver.observe(aboutSection);
    } else {
      // Fallback: show everything immediately
      aboutReveals.forEach(function (el) {
        el.classList.add('is-visible');
      });
    }
  }

  /* ============================================================
     TESTIMONIALS SECTION
     ------------------------------------------------------------
     Two concerns, in the same established conventions:

     1. REVEAL (⭐⭐ light, IntersectionObserver + .is-visible like
        every other section): heading fades first, then the cards
        fade together with a small stagger — featured (center anchor)
        first, then the two side cards. Driven by --t-delay set here.

     2. MANUAL CAROUSEL (mobile only, ≤900px): the 3-column row has
        too little room, so it becomes a single-slide carousel
        starting on the featured card. Navigation is USER-TRIGGERED
        ONLY — prev/next buttons, dot indicators, and basic swipe.
        There is deliberately NO autoplay/auto-advance timer.
        When the breakpoint is crossed back to desktop, the slider
        mode is turned off so the asymmetric 3-column row returns.
     ============================================================ */
  var testiSection = document.getElementById('testimonials');
  if (testiSection) {
    var testiGrid = testiSection.querySelector('.testi__grid');
    var testiSlides = Array.prototype.slice.call(
      testiSection.querySelectorAll('.testi__slide')
    );
    var testiDots = Array.prototype.slice.call(
      testiSection.querySelectorAll('.testi__dot')
    );
    var testiPrev = testiSection.querySelector('[data-testi-prev]');
    var testiNext = testiSection.querySelector('[data-testi-next]');
    var testiMobileQ = window.matchMedia('(max-width: 56.25rem)'); /* 900px */

    // Carousel starts on the featured (center) card.
    var testiIndex = 1;
    var testiCount = testiSlides.length;
    var testiActivated = false;

    var testiShow = function (index) {
      testiIndex = (index + testiCount) % testiCount;
      testiSlides.forEach(function (slide) {
        var i = parseInt(slide.getAttribute('data-testi-index'), 10);
        slide.classList.toggle('testi__slide--active', i === testiIndex);
      });
      testiDots.forEach(function (dot) {
        var i = parseInt(dot.getAttribute('data-testi-dot'), 10);
        dot.classList.toggle('testi__dot--active', i === testiIndex);
      });
    };

    var testiUpdateCarousel = function () {
      if (testiMobileQ.matches) {
        testiGrid.classList.add('testi__slider--on');
        if (!testiActivated) {
          testiActivated = true;
          testiShow(testiIndex); // start on the featured card
        }
      } else {
        testiGrid.classList.remove('testi__slider--on');
      }
    };

    /* --- Carousel navigation (mobile only) --------------------- */
    if (testiPrev) {
      testiPrev.addEventListener('click', function () {
        if (testiMobileQ.matches) testiShow(testiIndex - 1);
      });
    }
    if (testiNext) {
      testiNext.addEventListener('click', function () {
        if (testiMobileQ.matches) testiShow(testiIndex + 1);
      });
    }
    testiDots.forEach(function (dot) {
      dot.addEventListener('click', function () {
        if (!testiMobileQ.matches) return;
        testiShow(parseInt(dot.getAttribute('data-testi-dot'), 10));
      });
    });

    /* --- Basic swipe (delta detection, no over-engineering) ---- */
    var testiStartX = 0;
    testiGrid.addEventListener('touchstart', function (e) {
      testiStartX = e.touches[0].clientX;
    }, { passive: true });
    testiGrid.addEventListener('touchend', function (e) {
      if (!testiMobileQ.matches) return;
      var deltaX = e.changedTouches[0].clientX - testiStartX;
      var threshold = 40;
      if (deltaX < -threshold) {
        testiShow(testiIndex + 1); // swipe left -> next
      } else if (deltaX > threshold) {
        testiShow(testiIndex - 1); // swipe right -> previous
      }
    }, { passive: true });

    /* --- Reveal (heading first, then cards w/ small stagger) --- */
    var testiHeading = testiSection.querySelector('.testi__heading');
    if (testiHeading) testiHeading.style.setProperty('--t-delay', '0s');
    testiSlides.forEach(function (slide) {
      var i = parseInt(slide.getAttribute('data-testi-index'), 10);
      // featured (1) reveals first, then the two sides in reading order.
      var delay = i === 1 ? 0.1 : (i === 0 ? 0.2 : 0.25);
      slide.style.setProperty('--t-delay', delay + 's');
    });

    var testiReveals = Array.prototype.slice.call(
      testiSection.querySelectorAll('.t-reveal')
    );

    if ('IntersectionObserver' in window) {
      var testiObserver = new IntersectionObserver(
        function (entries) {
          entries.forEach(function (entry) {
            if (entry.isIntersecting) {
              testiReveals.forEach(function (el) {
                el.classList.add('is-visible');
              });
              testiObserver.disconnect();
            }
          });
        },
        { threshold: 0.15 }
      );
      testiObserver.observe(testiSection);
    } else {
      testiReveals.forEach(function (el) {
        el.classList.add('is-visible');
      });
    }

    /* --- Enable/disable slider mode across breakpoints --------- */
    var testiOnQueryChange = (function () {
      var t;
      return function () {
        window.clearTimeout(t);
        t = window.setTimeout(testiUpdateCarousel, 0);
      };
    })();

    if (testiMobileQ.addEventListener) {
      testiMobileQ.addEventListener('change', testiOnQueryChange);
    } else if (testiMobileQ.addListener) {
      testiMobileQ.addListener(testiOnQueryChange);
    }
    testiUpdateCarousel();
  }

  /* ============================================================
     OFFER SECTION
     ------------------------------------------------------------
     The main conversion moment. Animation strength is LOW (⭐⭐) and
     deliberately minimal — the construction stays on ONE reveal
     entrance with no heavy internal stagger:
       1. heading fades up                        (delay 0)
       2. the white offer panel fades + scales in as a whole
                                                  (delay ~0.1s)
     Same IntersectionObserver + .is-visible convention as every
     other section; timing via the --offer-delay custom property.
     Falls back gracefully.
     ============================================================ */
  var offerSection = document.getElementById('offer');
  if (offerSection) {
    var offerHeading = offerSection.querySelector('.offer__heading');
    var offerPanel = offerSection.querySelector('.offer__panel');

    if (offerHeading) offerHeading.style.setProperty('--offer-delay', '0s');
    if (offerPanel) offerPanel.style.setProperty('--offer-delay', '0.1s');

    var offerReveals = Array.prototype.slice.call(
      offerSection.querySelectorAll('.o-reveal')
    );

    if ('IntersectionObserver' in window) {
      var offerObserver = new IntersectionObserver(
        function (entries) {
          entries.forEach(function (entry) {
            if (entry.isIntersecting) {
              offerReveals.forEach(function (el) {
                el.classList.add('is-visible');
              });
              offerObserver.disconnect();
            }
          });
        },
        { threshold: 0.15 }
      );
      offerObserver.observe(offerSection);
    } else {
      offerReveals.forEach(function (el) {
        el.classList.add('is-visible');
      });
    }
  }

  /* ============================================================
     FAQ SECTION
     ------------------------------------------------------------
     Two concerns, both following the established conventions:

     1. SCROLL REVEAL (⭐, the lowest intensity on the page — calm
        contrast after the Offer panel). A single gentle fade-up:
        intro fades first, then the accordion list (light stagger via
        --faq-delay). Same IntersectionObserver + .is-visible pattern,
        graceful fallback.

     2. ACCORDION. Each row is a <button> trigger (aria-expanded /
        aria-controls) that toggles .is-open on its .faq__item,
        flips aria-expanded on the button and aria-hidden on the
        answer region. The answer's height is animated in CSS via the
        grid-template-rows 0fr -> 1fr technique. Independent toggles
        (multiple items may be open). This wiring always works
        regardless of the scroll-reveal state.
     ============================================================ */
  var faqSection = document.getElementById('faq');
  if (faqSection) {
    /* --- Accordion -------------------------------------------- */
    var faqItems = Array.prototype.slice.call(
      faqSection.querySelectorAll('.faq__item')
    );

    faqItems.forEach(function (item) {
      var trigger = item.querySelector('.faq__trigger');
      var answer = item.querySelector('.faq__a');
      if (!trigger) return;

      trigger.addEventListener('click', function () {
        var isOpen = item.classList.toggle('is-open');
        if (trigger) trigger.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
        if (answer) answer.setAttribute('aria-hidden', isOpen ? 'false' : 'true');
      });
    });

    /* --- Scroll reveal ---------------------------------------- */
    var faqIntro = faqSection.querySelector('.faq__intro');
    var faqList = faqSection.querySelector('.faq__list');

    if (faqIntro) faqIntro.style.setProperty('--faq-delay', '0s');
    if (faqList) faqList.style.setProperty('--faq-delay', '0.1s');

    var faqReveals = Array.prototype.slice.call(
      faqSection.querySelectorAll('.faq-reveal')
    );

    if ('IntersectionObserver' in window) {
      var faqObserver = new IntersectionObserver(
        function (entries) {
          entries.forEach(function (entry) {
            if (entry.isIntersecting) {
              faqReveals.forEach(function (el) {
                el.classList.add('is-visible');
              });
              faqObserver.disconnect();
            }
          });
        },
        { threshold: 0.15 }
      );
      faqObserver.observe(faqSection);
    } else {
      faqReveals.forEach(function (el) {
        el.classList.add('is-visible');
      });
    }
  }

  /* ============================================================
     FINAL CTA SECTION
     ------------------------------------------------------------
     The page's calm emotional send-off. Moderate reveal (⭐⭐⭐):
     ONE IntersectionObserver watches the section; when it scrolls
     into view every .finalcta-reveal becomes visible. The order is
     driven purely by CSS transition-delay: JS copies each element's
     data-delay into a --delay custom property, and CSS staggers with
     --delay × 90ms so the sequence reads:
       statement(0) → lines(1..8) → kick+CTA(9) → tagline(10)
     Fallback: show everything on load if IO is unavailable.
     ============================================================ */
  var finalCtaSection = document.getElementById('final-cta');
  if (finalCtaSection) {
    var finalCtaReveals = Array.prototype.slice.call(
      finalCtaSection.querySelectorAll('.finalcta-reveal')
    );

    // Copy each data-delay into --delay to drive the CSS stagger.
    finalCtaReveals.forEach(function (el) {
      el.style.setProperty('--delay', el.getAttribute('data-delay') || '0');
    });

    if ('IntersectionObserver' in window) {
      var finalCtaObserver = new IntersectionObserver(
        function (entries) {
          entries.forEach(function (entry) {
            if (entry.isIntersecting) {
              finalCtaReveals.forEach(function (el) {
                el.classList.add('is-visible');
              });
              finalCtaObserver.disconnect();
            }
          });
        },
        { threshold: 0.15 }
      );
      finalCtaObserver.observe(finalCtaSection);
    } else {
      // Fallback: show everything immediately
      finalCtaReveals.forEach(function (el) {
        el.classList.add('is-visible');
      });
    }
  }

  /* ============================================================
     FOOTER — DYNAMIC YEAR
     ------------------------------------------------------------
     Keeps the copyright year current automatically: reads the
     element id="footer-year" and writes new Date().getFullYear().
     No hardcoded year in the markup. Runs once on load.
     ============================================================ */
  var footerYear = document.getElementById('footer-year');
  if (footerYear) {
    footerYear.textContent = new Date().getFullYear();
  }

  /* ============================================================
     QUALIFICATION FUNNEL — FULL-SCREEN OVERLAY
     ----------------------------------------------------------------
     8 qualification questions + 1 transition screen.
     goToStep(stepNumber) handles all navigation generically.
     ============================================================ */
  var funnelEl       = document.getElementById('funnel');
  var funnelClose    = document.getElementById('funnel-close');
  var funnelStepText = document.getElementById('funnel-step-count');
  var funnelProgress = document.getElementById('funnel-progress-fill');

  var funnelState = {
    current: 0,
    total:   8,
    answers: {},
    sessionId: null
  };

  /* --- Progressive-save plumbing --------------------------------
     One session_id per funnel session (generated on open, reused for every
     update_lead call and the final confirm_booking call). update-lead calls
     are fire-and-forget: they never block navigation and never surface
     errors to the user. If one is still in flight we coalesce the latest
     payload and send it right after the in-flight request resolves.
     ------------------------------------------------------------ */
  function generateSessionId() {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID();
    }
    /* Fallback for older browsers / non-secure contexts */
    return 'sess_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 10);
  }

  var progressiveSaveInFlight = false;
  var progressiveSavePending = null;

  function queueProgressiveSave(payload) {
    if (!funnelState.sessionId) return;
    if (progressiveSaveInFlight) {
      progressiveSavePending = payload;
      return;
    }
    progressiveSaveInFlight = true;
    fetch('/.netlify/functions/update-lead', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ session_id: funnelState.sessionId, data: payload })
    })
      .then(function (res) { return res.json().catch(function () { return {}; }); })
      .then(function (data) {
        if (data && data.success === false) console.warn('Progressive save error:', data.error);
      })
      .catch(function (err) { console.error('Progressive save failed:', err.message); })
      .then(function () {
        progressiveSaveInFlight = false;
        var next = progressiveSavePending;
        progressiveSavePending = null;
        if (next) queueProgressiveSave(next);
      });
  }

  function debounce(fn, wait) {
    var t = null;
    return function () {
      var args = arguments;
      var ctx = this;
      clearTimeout(t);
      t = setTimeout(function () { fn.apply(ctx, args); }, wait);
    };
  }

  /* --- Open / Close ------------------------------------------- */
  function openFunnel() {
    if (!funnelEl) return;
    if (funnelState.current === 12) {
      resetFunnelForNewRound();
    }
    /* Generate once per funnel session — reused across all steps and the
       final confirm_booking call. Kept if the funnel is re-opened mid-round. */
    if (!funnelState.sessionId) funnelState.sessionId = generateSessionId();
    funnelEl.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
    /* Keep the floating mobile CTA out of the funnel overlay */
    var floatCta = document.getElementById('float-mobile-cta');
    if (floatCta) floatCta.classList.add('is-hidden');
  }

  function closeFunnel() {
    if (!funnelEl) return;
    funnelEl.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
    /* Restore the floating mobile CTA once the overlay is gone */
    var floatCta = document.getElementById('float-mobile-cta');
    if (floatCta) floatCta.classList.remove('is-hidden');
  }

  /* Bind all [data-open-funnel] triggers */
  var funnelTriggers = document.querySelectorAll('[data-open-funnel]');
  Array.prototype.forEach.call(funnelTriggers, function (btn) {
    btn.addEventListener('click', function (e) {
      e.preventDefault();
      openFunnel();
    });
  });

  /* Close button */
  if (funnelClose) {
    funnelClose.addEventListener('click', closeFunnel);
  }

  /* Escape key */
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && funnelEl && funnelEl.getAttribute('aria-hidden') === 'false') {
      closeFunnel();
    }
  });

  /* --- goToStep ------------------------------------------------
     Accepts a 1-based step number. Steps 1–8 are qualification
     questions. Step 9 is the transition screen. Step 10 is the
     calendar step. Steps ≥ 11 are placeholders for future steps.
     The transition screen's progress bar stays at 100%/08 since it
     is a non-qualification step. ------------------------------- */
  function goToStep(stepNumber) {
    var allSteps = funnelEl.querySelectorAll('.funnel__step');
    var idx = stepNumber - 1;

    Array.prototype.forEach.call(allSteps, function (s) {
      s.classList.remove('is-active');
    });

    if (idx < allSteps.length) {
      allSteps[idx].classList.add('is-active');
    }

    funnelState.current = stepNumber;

    /* Terminal success step: hide counter/progress, fill confirm data */
    if (funnelEl) funnelEl.classList.toggle('funnel--complete', stepNumber === 12);
    if (stepNumber === 12) populateSuccess();

    /* Progress bar: 100% once past the qualification questions */
    var pct = (Math.min(stepNumber, 8) / 8) * 100;
    funnelProgress.style.width = pct + '%';

    /* Step counter text — only shows qualification step numbers */
    var counter = Math.min(stepNumber, 8);
    funnelStepText.textContent = counter < 10
      ? '0' + counter + ' / 08'
      : counter + ' / 08';

    /* Back link: hide on step 1, show on all others */
    var backLinks = funnelEl.querySelectorAll('[data-funnel-back]');
    Array.prototype.forEach.call(backLinks, function (link) {
      if (stepNumber === 1) {
        link.classList.add('is-first-step');
      } else {
        link.classList.remove('is-first-step');
      }
    });

    /* Scroll the funnel body to the top */
    var body = funnelEl.querySelector('.funnel__body');
    if (body) body.scrollTop = 0;

    /* Entering the calendar step — make sure the single all-dates
       availability fetch has been requested (cached for this session) */
    if (stepNumber === 10) ensureAvailabilityAll();
  }

  /* --- Option selection (single-choice steps) ------------------ */
  var funnelBody = funnelEl ? funnelEl.querySelector('.funnel__body') : null;

  if (funnelBody) {
    funnelBody.addEventListener('click', function (e) {
      var btn = e.target.closest('.funnel__option');
      if (!btn) return;

      var step = btn.closest('.funnel__step');
      if (!step) return;

      var stepNum = parseInt(step.getAttribute('data-step'), 10);

      /* Deselect siblings */
      var siblings = step.querySelectorAll('.funnel__option');
      Array.prototype.forEach.call(siblings, function (b) {
        b.classList.remove('is-selected');
      });

      /* Select this option */
      btn.classList.add('is-selected');

      var value = btn.getAttribute('data-value');
      funnelState.answers['step_' + stepNum] = value;

      console.log('step_' + stepNum + ':', value);

      /* Progressive save after every qualification answer (Step 4's
         "multi-skill" placeholder is saved only once confirmed via Continue) */
      if (stepNum >= 1 && stepNum <= 8 && !(stepNum === 4 && value === 'multi-skill')) {
        queueProgressiveSave(buildLeadPayload());
      }

      /* Step 10 contact preference — select but do not auto-advance */
      if (stepNum === 10) {
        funnelState.contactPreference = value;
        updateContactSubmitBtn();
        queueProgressiveSave(buildLeadPayload());
        return;
      }

      /* Step 4 multi-select branch */
      if (stepNum === 4) {
        if (value === 'multi-skill') {
          var panel = step.querySelector('.funnel__multiselect');
          if (panel) {
            panel.setAttribute('aria-hidden', 'false');
            var cbs = panel.querySelectorAll('input[type="checkbox"]');
            Array.prototype.forEach.call(cbs, function (cb) { cb.checked = false; });
            updateContinueBtn();
          }
          return;
        } else {
          var panelHide = step.querySelector('.funnel__multiselect');
          if (panelHide) panelHide.setAttribute('aria-hidden', 'true');
        }
      }

      /* Auto-advance after a short delay */
      var advanceTo = stepNum + 1;
      setTimeout(function () {
        goToStep(advanceTo);
      }, 250);
    });
  }

  /* --- Step 4 multi-select checkboxes -------------------------- */
  function updateContinueBtn() {
    var panel = funnelEl ? funnelEl.querySelector('.funnel__multiselect') : null;
    if (!panel) return;
    var btn = panel.querySelector('.funnel__continue-btn');
    if (!btn) return;
    var checked = panel.querySelectorAll('input[type="checkbox"]:checked');
    btn.disabled = checked.length === 0;
  }

  if (funnelBody) {
    funnelBody.addEventListener('change', function (e) {
      if (e.target.matches('.funnel__multiselect input[type="checkbox"]')) {
        updateContinueBtn();
      }
    });

    funnelBody.addEventListener('click', function (e) {
      var btn = e.target.closest('.funnel__continue-btn');
      if (!btn || btn.disabled) return;

      var panel = btn.closest('.funnel__multiselect');
      var step = btn.closest('.funnel__step');
      if (!panel || !step) return;

      var checked = panel.querySelectorAll('input[type="checkbox"]:checked');
      var skills = [];
      Array.prototype.forEach.call(checked, function (cb) {
        skills.push(cb.value);
      });

      funnelState.answers['step_4_multi'] = skills;
      console.log('step_4_multi:', skills);

      /* Progressive save once (only on Continue, not per checkbox toggle) */
      queueProgressiveSave(buildLeadPayload());

      setTimeout(function () {
        goToStep(5);
      }, 250);
    });
  }

  /* --- Back navigation ----------------------------------------- */
  if (funnelBody) {
    funnelBody.addEventListener('click', function (e) {
      var back = e.target.closest('[data-funnel-back]');
      if (!back) return;
      e.preventDefault();

      /* Allow explicit back target via data-back-step attribute */
      var explicitTarget = back.getAttribute('data-back-step');
      var prevStep;

      if (explicitTarget) {
        prevStep = parseInt(explicitTarget, 10);
      } else {
        prevStep = funnelState.current - 1;
      }

      if (prevStep < 1) return;

      goToStep(prevStep);

      /* Restore previous answer visual (skip for non-qualification steps) */
      if (prevStep <= 8) {
        var answer = funnelState.answers['step_' + prevStep];
        if (answer) {
          var prevStepEl = funnelEl.querySelectorAll('.funnel__step')[prevStep - 1];
          if (prevStepEl) {
            var opts = prevStepEl.querySelectorAll('.funnel__option');
            Array.prototype.forEach.call(opts, function (o) {
              if (o.getAttribute('data-value') === answer) {
                o.classList.add('is-selected');
              }
            });
          }
        }
      }
    });
  }

  /* --- Calendar button (transition screen → step 10) ---------- */
  if (funnelBody) {
    funnelBody.addEventListener('click', function (e) {
      var btn = e.target.closest('[data-funnel-action="calendar"]');
      if (!btn) return;
      goToStep(10);
    });
  }

  /* ============================================================
     CALENDAR STEP (Step 10) — date + time slot selection
     ----------------------------------------------------------------
     Reads availability from the Netlify Function on date change.
     ============================================================ */

  /* Slots: 15 × 60-min slots, 09:00 start … 23:00 start */
  var funnelSlots = [];
  for (var sH = 9; sH <= 23; sH++) {
    var hh = (sH < 10 ? '0' : '') + sH;
    funnelSlots.push(hh + ':00');
  }

  var BOOKING_WINDOW_DAYS = 14;

  var dateScroller     = document.getElementById('funnel-date-scroller');
  var timeslotsEl      = document.getElementById('funnel-timeslots');
  var loadingEl        = document.getElementById('funnel-timeslots-loading');
  var errorEl          = document.getElementById('funnel-timeslots-error');
  var retryBtn         = document.getElementById('funnel-timeslots-retry');
  var confirmBtn       = document.getElementById('funnel-calendar-confirm');
  var slotNotice       = document.getElementById('funnel-timeslots-notice');

  var calendarState = {
    selectedDate: null,     // YYYY-MM-DD
    selectedTime: null,     // "HH:00"
    buildsInited: false
  };

  /* Single all-dates availability map, fetched once per funnel session:
     { "YYYY-MM-DD": ["09:00", "10:00", ...] } — arrays of OPEN start times.
     Date switching after the first fetch is instant (local lookup). */
  var availabilityMap = null;
  var availabilityLoading = false;

  function pad2(n) { return (n < 10 ? '0' : '') + n; }

  function fmtDate(d) {
    return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
  }

  /* Use Intl.DateTimeFormat for locale-correct Arabic names */
  var arDayFmt   = new Intl.DateTimeFormat('ar-DZ', { weekday: 'long' });
  var arMonthFmt = new Intl.DateTimeFormat('ar-DZ', { month: 'long' });

  var funnelDatePills = [];

  function buildDateScroller() {
    if (!dateScroller || calendarState.buildsInited) return;
    calendarState.buildsInited = true;

    dateScroller.textContent = '';

    var today = new Date();
    today.setHours(0, 0, 0, 0);

    for (var i = 0; i < BOOKING_WINDOW_DAYS; i++) {
      (function (offset) {
        var d = new Date(today);
        d.setDate(d.getDate() + offset);

        var pill = document.createElement('button');
        pill.type = 'button';
        pill.className = 'funnel__date-pill';
        pill.setAttribute('data-date', fmtDate(d));

        var dayEl = document.createElement('span');
        dayEl.className = 'funnel__date-pill-day';
        dayEl.textContent = arDayFmt.format(d);

        var numEl = document.createElement('span');
        numEl.className = 'funnel__date-pill-num';
        numEl.textContent = d.getDate() + ' ' + arMonthFmt.format(d);

        pill.appendChild(dayEl);
        pill.appendChild(numEl);

        pill.addEventListener('click', function () {
          selectDate(pill);
        });

        dateScroller.appendChild(pill);
        funnelDatePills.push(pill);
      })(i);
    }
  }

  function selectDate(pill) {
    funnelDatePills.forEach(function (p) {
      p.classList.remove('is-selected');
    });
    pill.classList.add('is-selected');

    calendarState.selectedDate = pill.getAttribute('data-date');
    calendarState.selectedTime = null;

    /* Hide the time list & confirm button */
    timeslotsEl.style.display = 'none';
    confirmBtn.disabled = true;

    renderTimeSlots();
  }

  /* Fetch the FULL availability map once for the whole booking window.
     Date switching afterwards is instant with no per-date network calls. */
  function loadAvailabilityAll() {
    availabilityLoading = true;
    calendarState.selectedTime = null;
    confirmBtn.disabled = true;
    timeslotsEl.style.display = 'none';
    errorEl.style.display = 'none';
    loadingEl.style.display = 'grid';

    fetch('/.netlify/functions/get-availability')
      .then(function (res) {
        if (!res.ok) throw new Error('bad status ' + res.status);
        return res.json();
      })
      .then(function (data) {
        if (data && data.error) throw new Error(data.error);

        availabilityLoading = false;
        loadingEl.style.display = 'none';

        availabilityMap = data.availability || {};

        /* Restore the "pick a day first" area */
        timeslotsEl.style.display = 'grid';

        /* If the user already picked a date while loading, re-render against
           the fresh map */
        if (calendarState.selectedDate) renderTimeSlots();
      })
      .catch(function (err) {
        availabilityLoading = false;
        loadingEl.style.display = 'none';
        errorEl.style.display = 'grid';
        console.error('Availability fetch failed:', err.message);
      });
  }

  /* Called on every entry to the calendar step — fetches only once per
     session, then serves dates instantly from the cached map. */
  function ensureAvailabilityAll() {
    if (availabilityMap || availabilityLoading) return;
    loadAvailabilityAll();
  }

  function renderTimeSlots() {
    timeslotsEl.style.display = 'grid';
    timeslotsEl.textContent = '';

    /* Times NOT listed for the selected date are treated as unavailable
       (booked / not offered). A missing date => empty array => all greyed. */
    var availForDate = availabilityMap ? (availabilityMap[calendarState.selectedDate] || []) : [];

    funnelSlots.forEach(function (slot) {
      var isAvailable = availForDate.indexOf(slot) !== -1;

      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'funnel__timeslot' + (isAvailable ? '' : ' funnel__timeslot--booked');
      btn.textContent = slot;
      btn.disabled = !isAvailable;

      if (isAvailable) {
        btn.addEventListener('click', function () {
          selectTime(slot);
        });
      }

      timeslotsEl.appendChild(btn);
    });

    hideSlotNotice();
  }

  function selectTime(slot) {
    calendarState.selectedTime = null;
    confirmBtn.disabled = true;

    var slotBtns = timeslotsEl.querySelectorAll('.funnel__timeslot');
    Array.prototype.forEach.call(slotBtns, function (b) {
      b.classList.remove('is-selected');
    });

    var target = Array.prototype.find.call(slotBtns, function (b) {
      return b.textContent === slot;
    });
    if (target) target.classList.add('is-selected');

    calendarState.selectedTime = slot;
    updateCalendarConfirmBtn();

    /* Progressive save — date + time now chosen */
    queueProgressiveSave(buildLeadPayload());

    /* Freshness double-check on the picked slot (cached map may be stale) */
    verifySlot(calendarState.selectedDate, slot);
  }

  function updateCalendarConfirmBtn() {
    confirmBtn.disabled = !(calendarState.selectedDate && calendarState.selectedTime);
  }

  function showSlotNotice() {
    if (slotNotice) slotNotice.hidden = false;
  }

  function hideSlotNotice() {
    if (slotNotice) slotNotice.hidden = true;
  }

  /* Extra safety net: double-check the picked slot on the backend before the
     user leaves the calendar. If it was taken meanwhile, drop it from the
     local map, reset the selection and show an inline message — no need to
     re-fetch the whole availability map. */
  function verifySlot(date, time) {
    if (!date || !time) return;

    fetch('/.netlify/functions/check-slot', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ data: { date: date, time: time } })
    })
      .then(function (res) { return res.json().catch(function () { return null; }); })
      .then(function (data) {
        if (data && data.available === false) {
          var arr = availabilityMap ? availabilityMap[date] : null;
          if (arr) {
            var i = arr.indexOf(time);
            if (i !== -1) arr.splice(i, 1);
          }
          calendarState.selectedTime = null;
          confirmBtn.disabled = true;
          renderTimeSlots();
          showSlotNotice();
        } else {
          hideSlotNotice();
        }
      })
      .catch(function (err) {
        hideSlotNotice();
        console.error('Slot check failed:', err.message);
      });
  }

  /* Wire confirm button */
  if (confirmBtn) {
    confirmBtn.addEventListener('click', function () {
      if (confirmBtn.disabled) return;

      funnelState.appointmentDate = calendarState.selectedDate;
      funnelState.appointmentTime = calendarState.selectedTime;

      goToStep(11);
      updateContactSubmitBtn();
    });
  }

  /* Wire retry button — re-fetches the whole availability map */
  if (retryBtn) {
    retryBtn.addEventListener('click', function () {
      loadAvailabilityAll();
    });
  }

  /* ============================================================
     CONTACT STEP (Step 11) — form validation + lead submission
     ============================================================ */
  var contactForm       = document.getElementById('funnel-contact-form');
  var contactName       = document.getElementById('funnel-contact-name');
  var contactPhone      = document.getElementById('funnel-contact-phone');
  var contactEmail      = document.getElementById('funnel-contact-email');
  var contactNotes      = document.getElementById('funnel-contact-notes');
  var contactSubmit     = document.getElementById('funnel-contact-submit');
  var contactError      = document.getElementById('funnel-contact-error');
  var contactErrorText  = document.getElementById('funnel-contact-error-text');
  var contactRebook     = document.getElementById('funnel-contact-back-to-slots');
  var contactSubmitting = false;

  var contactFields = {
    name: {
      input: contactName,
      error: document.getElementById('funnel-contact-name-error'),
      test: function (v) { return v.trim().length >= 2; },
      msg: 'أدخل اسمك الكامل'
    },
    phone: {
      input: contactPhone,
      error: document.getElementById('funnel-contact-phone-error'),
      test: function (v) {
        var d = v.replace(/[^\d+]/g, '');
        return /^\+?\d+$/.test(d) && d.length >= 9 && d.length <= 15;
      },
      msg: 'أدخل رقم هاتف صحيح (مثلاً +213 5 55 55 55 55)'
    },
    email: {
      input: contactEmail,
      error: document.getElementById('funnel-contact-email-error'),
      test: function (v) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim()); },
      msg: 'أدخل بريد إلكتروني صحيح'
    }
  };

  function validateContactField(key) {
    var f = contactFields[key];
    if (!f || !f.input) return true;
    var value = f.input.value.trim();
    var ok = f.test(value);
    f.input.classList.toggle('is-invalid', !ok && value !== '');
    if (f.error) {
      f.error.textContent = f.msg;
      f.error.hidden = ok || value === '';
    }
    return ok;
  }

  function validateContact() {
    var nameOk  = validateContactField('name');
    var phoneOk = validateContactField('phone');
    var emailOk = validateContactField('email');
    var prefOk  = !!funnelState.contactPreference;

    var prefErr = document.getElementById('funnel-contact-pref-error');
    if (prefErr) {
      prefErr.textContent = 'اختار طريقة التواصل المفضلة';
      prefErr.hidden = prefOk;
    }
    return nameOk && phoneOk && emailOk && prefOk;
  }

  function updateContactSubmitBtn() {
    if (!contactSubmit) return;
    contactSubmit.disabled = !validateContact();
  }

  function hideContactError() {
    if (contactError) contactError.hidden = true;
  }

  function showContactError(text, withRebook) {
    if (!contactError || !contactErrorText) return;
    contactErrorText.textContent = text;
    contactError.hidden = false;
    if (contactRebook) contactRebook.hidden = !withRebook;
  }

  function restoreSubmitButton() {
    contactSubmitting = false;
    if (contactSubmit) {
      contactSubmit.classList.remove('is-loading');
      contactSubmit.textContent = 'تأكيد موعدي 🚀';
      contactSubmit.disabled = !validateContact();
    }
  }

  function getQueryParam(name) {
    if (typeof location === 'undefined' || !location.search) return '';
    var esc = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    var m = new RegExp('[?&]' + esc + '=([^&]*)').exec(location.search);
    return m ? decodeURIComponent(m[1].replace(/\+/g, ' ')) : '';
  }

  /* --- Arabic label translation maps -------------------------------
     Maps each internal slug (data-value) used for step logic/branching
     to the human-readable Arabic label the user actually saw and selected.
     Translation happens ONLY here at the point of building the payload
     that is sent to update-lead / confirm-booking. The internal slugs are
     left untouched everywhere else (branching, selected-state styling,
     "أخرى" detection, multi-select trigger). --------------------------- */
  var ARABIC_LABELS = {
    step_1: {
      'student': '🎓 طالب',
      'graduate': '🎓 خريج جامعي',
      'employee': '💼 موظف',
      'looking': '🔍 نبحث على خدمة',
      'business-owner': '🚀 صاحب مشروع',
      'freelancer': '💻 Freelancer',
      'career-change': '🔄 حاب نبدل المجال المهني',
      'other': 'أخرى'
    },
    step_2: {
      'first-job': '💼 نلقى أول وظيفة',
      'career-switch': '🔄 نبدل المجال المهني',
      'improve-sales': '📈 نطور مستواي في Sales',
      'master-closing': '🎯 نولي محترف في Closing',
      'improve-cs': '🤝 نطور Customer Service',
      'freelance': '💻 نبدأ نخدم Freelance',
      'remote': '🌍 نبحث على Remote / International Opportunities',
      'grow-business': '🚀 نطور الـBusiness تاعي'
    },
    step_3: {
      'complete-beginner': '🌱 مبتدئ تمامًا',
      'basic-knowledge': '🟢 عندي معرفة بسيطة',
      'tried-before': '🟡 جربت نخدم في المجال من قبل',
      'currently-working': '🔵 نخدم حاليًا في Sales / Customer Service',
      'experienced': '🟣 عندي خبرة جيدة وحاب نطور مستواي'
    },
    step_4: {
      'sales': '💰 Sales',
      'closing': '🎯 Closing',
      'customer-service': '📞 Customer Service',
      'appointment-setting': '📅 Appointment Setting',
      'communication': '🧠 Communication',
      'lead-qualification': '🔎 Lead Qualification',
      'multi-skill': '🔥 أكثر من Skill'
    },
    step_5: {
      'no-clear-skills': 'ما عنديش Skill واضحة نقدر نعتمد عليها',
      'no-experience': 'ما عنديش خبرة عملية',
      'dont-know-where': 'ما نعرفش منين نبدأ',
      'communication-difficulty': 'نلقى صعوبة في التواصل مع العملاء',
      'fear-of-rejection': 'نخاف من البيع ورفض العملاء',
      'closing-difficulty': 'نلقى صعوبة في Closing',
      'cant-find-jobs': 'ما نعرفش كيفاش نلقى فرص العمل',
      'cant-present-skills': 'عندي Skills بصح ما نعرفش كيفاش نقدم نفسي للشركات',
      'need-coaching': 'نحتاج Coaching ومتابعة',
      'other': 'أخرى'
    },
    step_6: {
      'under-2h': 'أقل من ساعتين',
      '2-4h': '2 – 4 ساعات',
      '4-7h': '4 – 7 ساعات',
      'over-7h': 'أكثر من 7 ساعات',
      'flexible': 'حسب وقتي المتاح'
    },
    step_7: {
      'ready-now': '🚀 نعم، مستعد نبدأ ونطبق من اليوم',
      'ready-with-guidance': '💪 نعم، بصح نحتاج شوية توجيه في البداية',
      'later': '🕐 حاب نبدأ، بصح مازال ماشي الوقت المناسب',
      'need-understanding': '🤔 مازال نحتاج نفهم أكثر قبل ما نقرر',
      'not-ready': '❌ حاليًا ما نيش مستعد نبدأ'
    },
    step_8: {
      'ready': '✅ نعم، مستعد نبدأ',
      'if-suitable': '👍 نعم، إذا كان البرنامج مناسب لاحتياجاتي',
      'need-more-info': 'ℹ️ نحتاج نعرف تفاصيل أكثر قبل ما نقرر',
      'cant-invest': '❌ حاليًا ما نقدرش نستثمر'
    },
    contact: {
      'whatsapp': 'WhatsApp',
      'phone-call': 'مكالمة هاتفية'
    }
  };

  /* Translate a single slug to its Arabic label. Falls back to the raw
     slug if unknown (so an unmapped value still gets stored). */
  function translateLabel(map, value) {
    if (value === undefined || value === null || value === '') return '';
    return (map && map[value]) ? map[value] : value;
  }

  function buildLeadPayload() {
    var amap = funnelState.answers || {};

    /* Step 4 skill interest: multi-select joins each translated label;
       single-select translates the single slug. */
    var skillRaw = Array.isArray(amap['step_4_multi']) && amap['step_4_multi'].length
      ? amap['step_4_multi']
      : (amap['step_4'] ? [amap['step_4']] : []);
    var skillInterest = skillRaw
      .map(function (slug) { return translateLabel(ARABIC_LABELS.step_4, slug); })
      .join(', ');

    var source = getQueryParam('source') || getQueryParam('utm_source') || '';
    var utmParts = [];
    ['utm_source', 'utm_medium', 'utm_campaign'].forEach(function (k) {
      var v = getQueryParam(k);
      if (v) utmParts.push(k + '=' + v);
    });

    return {
      fullName:            contactName ? contactName.value.trim() : '',
      phone:               contactPhone ? contactPhone.value.trim() : '',
      email:               contactEmail ? contactEmail.value.trim() : '',
      contactPreference:   translateLabel(ARABIC_LABELS.contact, funnelState.contactPreference),
      notes:               contactNotes ? contactNotes.value.trim() : '',
      currentStatus:       translateLabel(ARABIC_LABELS.step_1, amap['step_1']),
      careerGoal:          translateLabel(ARABIC_LABELS.step_2, amap['step_2']),
      experienceLevel:     translateLabel(ARABIC_LABELS.step_3, amap['step_3']),
      skillInterest:       skillInterest,
      mainChallenge:       translateLabel(ARABIC_LABELS.step_5, amap['step_5']),
      weeklyTime:          translateLabel(ARABIC_LABELS.step_6, amap['step_6']),
      readinessToStart:    translateLabel(ARABIC_LABELS.step_7, amap['step_7']),
      investmentReadiness: translateLabel(ARABIC_LABELS.step_8, amap['step_8']),
      appointmentDate:     funnelState.appointmentDate || '',
      appointmentTime:     funnelState.appointmentTime || '',
      source:              source,
      utm:                 utmParts.join('; ')
    };
  }

  /* Progressive save debounce for free-text contact fields */
  var saveContactProgressively = debounce(function () {
    queueProgressiveSave(buildLeadPayload());
  }, 600);

  /* Live validation + debounced progressive save on contact input */
  ['name', 'phone', 'email'].forEach(function (key) {
    var f = contactFields[key];
    if (!f || !f.input) return;
    f.input.addEventListener('input', function () {
      validateContactField(key);
      updateContactSubmitBtn();
      saveContactProgressively();
    });
  });

  /* Editing the phone clears any duplicate-phone notice shown earlier */
  if (contactPhone) {
    contactPhone.addEventListener('input', hideContactDuplicate);
  }
  if (contactNotes) {
    contactNotes.addEventListener('input', saveContactProgressively);
  }

  /* Submit flow — duplicate-phone guard → slot freshness guard → confirm-booking */
  if (contactForm) {
    contactForm.addEventListener('submit', function (e) {
      e.preventDefault();
      if (contactSubmitting) return;
      if (contactSubmit && contactSubmit.disabled) return;

      if (!validateContact()) {
        updateContactSubmitBtn();
        return;
      }

      hideContactDuplicate();
      contactSubmitting = true;
      contactSubmit.disabled = true;
      contactSubmit.classList.add('is-loading');
      contactSubmit.textContent = 'جاري التأكيد...';
      hideContactError();

      var phoneValue = contactPhone ? String(contactPhone.value || '').trim() : '';

      fetch('/.netlify/functions/check-duplicate-phone', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data: { phone: phoneValue } })
      })
        .then(function (res) { return res.json().catch(function () { return {}; }); })
        .then(function (data) {
          if (data && data.isDuplicate === true) {
            showContactDuplicate();
            restoreSubmitButton();
            return;
          }
          proceedToConfirmBooking();
        })
        .catch(function () {
          /* Duplicate-check failure must not block booking */
          proceedToConfirmBooking();
        });
    });
  }

  /* "اختار موعد آخر" → back to calendar, contact data preserved */
  if (contactRebook) {
    contactRebook.addEventListener('click', function () {
      hideContactError();
      goToStep(10);
    });
  }

  /* Duplicate-phone friendly notice + dismiss */
  var contactDuplicate         = document.getElementById('funnel-contact-duplicate');
  var contactDuplicateDismiss  = document.getElementById('funnel-contact-duplicate-dismiss');

  function showContactDuplicate() {
    if (!contactDuplicate) return;
    contactDuplicate.hidden = false;
  }

  function hideContactDuplicate() {
    if (contactDuplicate) contactDuplicate.hidden = true;
  }

  if (contactDuplicateDismiss) {
    contactDuplicateDismiss.addEventListener('click', function () {
      hideContactDuplicate();
    });
  }

  /* After the duplicate guard passes: one final freshness check on the exact
     slot, then confirm the booking server-side. Rather than blocking on a
     stale cached map, this gives the same "slot taken → pick another" UX as
     the old SLOT_ALREADY_BOOKED error. */
  function proceedToConfirmBooking() {
    var date = funnelState.appointmentDate || '';
    var time = funnelState.appointmentTime || '';

    fetch('/.netlify/functions/check-slot', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ data: { date: date, time: time } })
    })
      .then(function (res) { return res.json().catch(function () { return {}; }); })
      .then(function (data) {
        if (data && data.available === false) {
          var arr = availabilityMap ? availabilityMap[date] : null;
          if (arr) {
            var i = arr.indexOf(time);
            if (i !== -1) arr.splice(i, 1);
          }
          restoreSubmitButton();
          showContactError('هذا الموعد أصبح محجوز، اختار موعد آخر', true);
          return;
        }
        confirmBookingRequest();
      })
      .catch(function () {
        confirmBookingRequest();
      });
  }

  function confirmBookingRequest() {
    var payload = buildLeadPayload();

    fetch('/.netlify/functions/confirm-booking', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ session_id: funnelState.sessionId, data: payload })
    })
      .then(function (res) {
        return res.json().catch(function () {
          return { success: false, error: 'BAD_RESPONSE' };
        });
      })
      .then(function (data) {
        if (data && data.success === true) {
          if (data.appointmentDate) funnelState.appointmentDate = data.appointmentDate;
          if (data.appointmentTime) funnelState.appointmentTime = data.appointmentTime;
          funnelState.fullName = payload.fullName;
          funnelState.phone = payload.phone;
          funnelState.email = payload.email;
          funnelState.notes = payload.notes;
          funnelState.submitted = true;
          goToStep(12);
          return;
        }
        if (data && data.error === 'SLOT_ALREADY_BOOKED') {
          showContactError('عذرًا، هذا الموعد أصبح محجوز، اختار موعد آخر', true);
        } else {
          showContactError('صار خطأ، حاول مرة أخرى', false);
        }
        restoreSubmitButton();
      })
      .catch(function () {
        showContactError('صار خطأ، حاول مرة أخرى', false);
        restoreSubmitButton();
      });
  }

  /* ============================================================
     SUCCESS STEP (Step 12) — confirmation screen
     ============================================================ */
  function populateSuccess() {
    var dateEl = document.getElementById('funnel-success-date');
    if (!dateEl) return;

    var dateStr = funnelState.appointmentDate || '';
    var timeStr = funnelState.appointmentTime || '';

    if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
      var parts = dateStr.split('-');
      var d = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
      dateEl.textContent = arDayFmt.format(d) + ' ' + d.getDate() + ' ' +
        arMonthFmt.format(d) + ' ' + parts[0] + (timeStr ? ' — ' + timeStr : '');
    } else {
      dateEl.textContent = dateStr + (timeStr ? ' — ' + timeStr : '');
    }

    var prefEl = document.getElementById('funnel-success-pref');
    if (prefEl) {
      var pref = funnelState.contactPreference;
      prefEl.textContent = pref === 'phone-call' ? 'مكالمة هاتفية' : (pref === 'whatsapp' ? 'WhatsApp' : (pref || ''));
    }
  }

  var successClose = document.getElementById('funnel-success-close');
  if (successClose) {
    successClose.addEventListener('click', closeFunnel);
  }

  /* Fresh UI state when the funnel is reopened after a completed round */
  function resetFunnelForNewRound() {
    funnelState.current = 0;
    funnelState.answers = {};
    funnelState.sessionId = null;
    funnelState.appointmentDate = null;
    funnelState.appointmentTime = null;
    funnelState.contactPreference = null;
    funnelState.submitted = false;

    ['name', 'phone', 'email'].forEach(function (key) {
      var f = contactFields[key];
      if (f && f.input) {
        f.input.value = '';
        f.input.classList.remove('is-invalid');
        if (f.error) f.error.hidden = true;
      }
    });
    if (contactNotes) contactNotes.value = '';
    if (contactSubmit) {
      contactSubmit.classList.remove('is-loading');
      contactSubmit.textContent = 'تأكيد موعدي 🚀';
      contactSubmit.disabled = true;
    }
    contactSubmitting = false;
    hideContactError();

    if (funnelEl) {
      var prefOptions = funnelEl.querySelectorAll('.funnel__step--contact .funnel__option[data-contact-pref]');
      Array.prototype.forEach.call(prefOptions, function (o) {
        o.classList.remove('is-selected');
      });
    }

    if (calendarState) {
      calendarState.selectedDate = null;
      calendarState.selectedTime = null;
    }
    /* Drop the cached availability map so the next funnel round re-fetches */
    availabilityMap = null;
    availabilityLoading = false;
    hideSlotNotice();
    hideContactDuplicate();
    funnelDatePills.forEach(function (p) { p.classList.remove('is-selected'); });
    if (confirmBtn) confirmBtn.disabled = true;
    if (timeslotsEl) {
      timeslotsEl.style.display = 'grid';
      timeslotsEl.textContent = '';
      var placeholder = document.createElement('p');
      placeholder.className = 'funnel__timeslots-placeholder';
      placeholder.textContent = 'اختار يوم أولاً باش تشوف المواعيد المتاحة';
      timeslotsEl.appendChild(placeholder);
    }

    goToStep(1);
  }

  /* Build the date scroller once */
  buildDateScroller();

  /* Initialize to step 1 */
  goToStep(1);
})();
