/* =========================================================
   Edo Daves — site behaviour (no dependencies)
   ========================================================= */

(() => {
  'use strict';

  // The contact form is delivered by FormSubmit (formsubmit.co) to this inbox.
  // Leave it empty and the form only validates, it sends nothing.
  const FORM_EMAIL = 'edoardodaves.06@gmail.com';
  const FORM_ENDPOINT = FORM_EMAIL ? `https://formsubmit.co/ajax/${encodeURIComponent(FORM_EMAIL)}` : '';

  // Show the venture pop-up this long after the page has revealed.
  const VENTURE_DELAY_MS = 2200;

  const body = document.body;
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const desktop = window.matchMedia('(min-width: 992px)');
  const clamp = (v, min, max) => Math.min(max, Math.max(min, v));

  const store = {
    get(key) { try { return window.sessionStorage.getItem(key); } catch (_) { return null; } },
    set(key, value) { try { window.sessionStorage.setItem(key, value); } catch (_) { /* storage unavailable */ } },
  };

  /* ---------- Preloader ---------- */

  function runPreloader() {
    const count = document.querySelector('.preloader__count');
    const bar = document.querySelector('.preloader__bar');
    // Phones get a quick count: people leave fast on mobile data.
    const duration = reduceMotion ? 0 : (desktop.matches ? 1500 : 600);

    const pageLoaded = new Promise((resolve) => {
      if (document.readyState === 'complete') resolve();
      else window.addEventListener('load', resolve, { once: true });
    });
    // Never hold the page hostage to a slow asset.
    const loadedOrTimeout = Promise.race([pageLoaded, new Promise((r) => setTimeout(r, 4000))]);

    const counted = new Promise((resolve) => {
      if (!duration) { resolve(); return; }
      const start = performance.now();
      const tick = (now) => {
        const t = clamp((now - start) / duration, 0, 1);
        const eased = 1 - Math.pow(1 - t, 3);
        const value = Math.round(eased * 100);
        if (count) count.textContent = String(value);
        if (bar) bar.style.setProperty('--progress', String(eased));
        if (t < 1) requestAnimationFrame(tick);
        else resolve();
      };
      requestAnimationFrame(tick);
    });

    return Promise.all([counted, loadedOrTimeout]).then(() => {
      if (count) count.textContent = '100';
      if (bar) bar.style.setProperty('--progress', '1');
      body.classList.remove('is-loading');
      body.classList.add('is-ready');
    });
  }

  /* ---------- Big name: always spans the full width ---------- */

  const nameEl = document.querySelector('.stage__name');
  const nameSpan = nameEl && nameEl.querySelector('span');

  function fitName() {
    if (!nameEl || !nameSpan) return;
    const cs = getComputedStyle(nameEl);
    const gutter = parseFloat(cs.left) || parseFloat(cs.paddingLeft) || 0;
    const available = document.documentElement.clientWidth - gutter * 2;
    nameEl.style.fontSize = '100px';
    // Measure the letters themselves (not the span's padding), so the name
    // ends exactly on the right margin.
    const range = document.createRange();
    range.selectNodeContents(nameSpan);
    const natural = range.getBoundingClientRect().width;
    if (natural > 0) nameEl.style.fontSize = `${(available / natural) * 100}px`;
  }

  /* ---------- Portrait drifts left as the About text arrives ---------- */

  const stage = document.querySelector('.stage');
  const about = document.querySelector('.about');
  let ticking = false;

  function updateStage() {
    ticking = false;
    if (!stage || !about) return;
    const vh = window.innerHeight;
    const top = about.getBoundingClientRect().top;
    // 0 while the hero fills the screen, 1 once the About text is well in view
    const progress = clamp((vh * 0.95 - top) / (vh * 0.6), 0, 1);
    const eased = progress * progress * (3 - 2 * progress);

    if (!desktop.matches) {
      // Phone: the pinned portrait stays put and darkens under the bio.
      stage.style.removeProperty('--shift');
      stage.style.removeProperty('--name-shift');
      stage.style.removeProperty('--name-opacity');
      stage.style.setProperty('--dim', (eased * 0.68).toFixed(3));
      return;
    }
    stage.style.removeProperty('--dim');
    if (reduceMotion) {
      stage.style.removeProperty('--shift');
      stage.style.removeProperty('--name-shift');
      stage.style.removeProperty('--name-opacity');
      return;
    }
    stage.style.setProperty('--shift', `${(-eased * window.innerWidth * 0.2).toFixed(1)}px`);
    stage.style.setProperty('--name-shift', `${(-eased * window.innerWidth * 0.04).toFixed(1)}px`);
    // Let the name recede so the bio on top of it stays readable
    stage.style.setProperty('--name-opacity', (1 - eased * 0.82).toFixed(3));
  }

  /* ---------- Header state + active nav link ---------- */

  const header = document.querySelector('.site-header');
  const navLinks = Array.from(document.querySelectorAll('.nav a'));
  const sections = navLinks
    .map((a) => document.querySelector(a.getAttribute('href')))
    .filter(Boolean);

  function updateHeader() {
    if (header) header.classList.toggle('is-scrolled', window.scrollY > 8);
    const marker = window.innerHeight * 0.4;
    let current = null;
    sections.forEach((section) => {
      if (section.getBoundingClientRect().top <= marker) current = section.id;
    });
    navLinks.forEach((a) => a.classList.toggle('is-active', a.getAttribute('href') === `#${current}`));
  }

  function onScroll() {
    updateHeader();
    if (!ticking) {
      ticking = true;
      requestAnimationFrame(updateStage);
    }
  }

  /* ---------- Mobile menu ---------- */

  const toggle = document.querySelector('.menu-toggle');
  const menu = document.getElementById('mobile-menu');

  function setMenu(open) {
    if (!toggle || !menu) return;
    toggle.setAttribute('aria-expanded', String(open));
    toggle.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
    body.classList.toggle('is-locked', open);
    if (open) {
      menu.hidden = false;
      requestAnimationFrame(() => menu.classList.add('is-open'));
    } else {
      menu.classList.remove('is-open');
      setTimeout(() => { if (!menu.classList.contains('is-open')) menu.hidden = true; }, 350);
    }
  }

  if (toggle && menu) {
    toggle.addEventListener('click', () => setMenu(toggle.getAttribute('aria-expanded') !== 'true'));
    menu.querySelectorAll('a').forEach((a) => a.addEventListener('click', () => setMenu(false)));
    desktop.addEventListener('change', (e) => { if (e.matches) setMenu(false); });
  }

  /* ---------- Modals (venture pop-up, imprint) ---------- */

  let openModal = null;
  let lastFocus = null;

  function showModal(modal) {
    if (!modal || openModal === modal) return;
    if (openModal) hideModal(true);
    lastFocus = document.activeElement;
    openModal = modal;
    modal.hidden = false;
    body.classList.add('has-modal');
    if (modal.classList.contains('modal--sheet')) body.classList.add('is-locked');
    requestAnimationFrame(() => {
      modal.classList.add('is-open');
      const close = modal.querySelector('.modal__close');
      if (close) close.focus({ preventScroll: true });
    });
  }

  function hideModal(immediate) {
    const modal = openModal;
    if (!modal) return;
    openModal = null;
    modal.classList.remove('is-open');
    body.classList.remove('has-modal');
    if (!menu || menu.hidden) body.classList.remove('is-locked');
    if (modal.id === 'venture') store.set('venture-seen', '1');
    const done = () => { if (!modal.classList.contains('is-open')) modal.hidden = true; };
    if (immediate) done(); else setTimeout(done, 450);
    if (lastFocus && typeof lastFocus.focus === 'function') lastFocus.focus({ preventScroll: true });
  }

  document.addEventListener('click', (e) => {
    const opener = e.target.closest('[data-open]');
    if (opener) {
      e.preventDefault();
      showModal(document.getElementById(opener.dataset.open));
      return;
    }
    const closer = e.target.closest('[data-close]');
    if (closer) {
      // "Join the venture" closes the pop-up and still follows its #contact link.
      if (!closer.getAttribute('href')) e.preventDefault();
      hideModal();
    }
  });

  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    if (openModal) hideModal();
    else if (toggle && toggle.getAttribute('aria-expanded') === 'true') setMenu(false);
  });

  /* ---------- Scroll reveal ---------- */

  function setupReveal() {
    const items = document.querySelectorAll('[data-reveal]');
    if (!('IntersectionObserver' in window) || reduceMotion) {
      items.forEach((el) => el.classList.add('is-visible'));
      return;
    }
    const io = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-visible');
        io.unobserve(entry.target);
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.12 });
    items.forEach((el) => io.observe(el));
  }

  /* ---------- Background reel: only plays while on screen ---------- */

  function setupReel() {
    const video = document.querySelector('.reel video');
    if (!video) return;

    // Phones get the light 720p, 4:5 cut (1.5 MB instead of 5.8 MB).
    const phone = !desktop.matches;
    const src = (phone && video.dataset.srcMobile) || video.dataset.src;
    if (phone && video.dataset.posterMobile) video.poster = video.dataset.posterMobile;
    if (src && !video.getAttribute('src')) video.src = src;

    if (reduceMotion) {
      video.removeAttribute('autoplay');
      video.pause();
      return;
    }
    if (!('IntersectionObserver' in window)) return;
    const io = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        const p = video.play();
        if (p && typeof p.catch === 'function') p.catch(() => {});
      } else {
        video.pause();
      }
    }, { threshold: 0.15 });
    io.observe(video);
  }

  /* ---------- Testimonials: tap to play with sound, one at a time ---------- */

  function setupStories() {
    const stories = Array.from(document.querySelectorAll('.story'));
    const stopAll = (except) => {
      stories.forEach((story) => {
        if (story === except) return;
        const v = story.querySelector('video');
        if (v && !v.paused) v.pause();
      });
    };

    stories.forEach((story) => {
      const button = story.querySelector('.story__media');
      const video = story.querySelector('video');
      if (!button || !video) return;

      video.addEventListener('play', () => {
        story.classList.add('is-playing');
        stopAll(story);
      });
      video.addEventListener('pause', () => story.classList.remove('is-playing'));
      video.addEventListener('ended', () => {
        story.classList.remove('is-playing');
        video.controls = false;
        video.currentTime = 0;
      });

      button.addEventListener('click', (e) => {
        // Once the native controls are showing, let them handle taps.
        if (video.controls && e.target === video) return;
        e.preventDefault();
        if (video.paused) {
          video.muted = false;
          video.controls = true;
          const p = video.play();
          if (p && typeof p.catch === 'function') p.catch(() => {});
        } else {
          video.pause();
        }
      });
    });

    // Pause a story that scrolls out of view.
    if ('IntersectionObserver' in window) {
      const io = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          const v = entry.target.querySelector('video');
          if (!entry.isIntersecting && v && !v.paused) v.pause();
        });
      }, { threshold: 0.25 });
      stories.forEach((s) => io.observe(s));
    }
  }

  /* ---------- Client results: endless, slowly drifting carousel ---------- */

  function setupCarousel() {
    const root = document.querySelector('[data-carousel]');
    if (!root) return;
    const track = root.querySelector('.carousel__track');
    const originals = Array.from(track.children);
    if (!originals.length) return;

    // A second copy of the cards makes the loop seamless.
    originals.forEach((card) => {
      const clone = card.cloneNode(true);
      clone.setAttribute('aria-hidden', 'true');
      clone.setAttribute('tabindex', '-1');
      clone.querySelectorAll('a, img').forEach((el) => el.setAttribute('tabindex', '-1'));
      track.appendChild(clone);
    });

    const SPEED = 26; // px per second
    let loop = 0;
    let pos = 0;
    let last = 0;
    let visible = false;
    let holdUntil = 0;
    let hovering = false;
    let dragging = false;

    const measure = () => {
      loop = track.children[originals.length].offsetLeft - track.children[0].offsetLeft;
    };
    const wrap = (x) => {
      if (!loop) return x;
      while (x >= loop) x -= loop;
      while (x < 0) x += loop;
      return x;
    };
    const hold = (ms) => { holdUntil = performance.now() + ms; };
    const paused = (now) => reduceMotion || hovering || dragging || now < holdUntil || root.contains(document.activeElement);

    const frame = (now) => {
      const dt = last ? Math.min(0.05, (now - last) / 1000) : 0;
      last = now;
      if (visible) {
        if (paused(now)) {
          pos = track.scrollLeft;
          if (loop && (pos >= loop || pos <= 0)) {
            pos = wrap(pos);
            if (pos === 0 && track.scrollLeft <= 0) pos = loop; // let "previous" keep going left
            if (!dragging) track.scrollLeft = pos;
          }
        } else {
          pos = wrap(pos + SPEED * dt);
          track.scrollLeft = pos;
        }
      }
      requestAnimationFrame(frame);
    };

    measure();
    window.addEventListener('resize', measure);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(measure);
    track.querySelectorAll('img').forEach((img) => img.addEventListener('load', measure, { once: true }));

    if ('IntersectionObserver' in window) {
      new IntersectionObserver(([entry]) => {
        visible = entry.isIntersecting;
        last = 0;
        if (visible) pos = track.scrollLeft;
      }).observe(track);
    } else {
      visible = true;
    }

    // Pause while the visitor is looking or touching; resume shortly after.
    track.addEventListener('pointerenter', (e) => { if (e.pointerType === 'mouse') hovering = true; });
    track.addEventListener('pointerleave', (e) => { if (e.pointerType === 'mouse') { hovering = false; hold(600); } });
    track.addEventListener('touchstart', () => hold(4000), { passive: true });
    track.addEventListener('wheel', () => hold(2500), { passive: true });

    // Drag with the mouse on desktop (touch scrolls natively).
    let startX = 0;
    let startScroll = 0;
    let moved = false;
    track.addEventListener('pointerdown', (e) => {
      if (e.pointerType !== 'mouse' || e.button !== 0) return;
      dragging = true;
      moved = false;
      startX = e.clientX;
      startScroll = track.scrollLeft;
      track.setPointerCapture(e.pointerId);
    });
    track.addEventListener('pointermove', (e) => {
      if (!dragging) return;
      const dx = e.clientX - startX;
      if (Math.abs(dx) > 4) { moved = true; track.classList.add('is-dragging'); }
      track.scrollLeft = startScroll - dx;
    });
    const endDrag = () => {
      if (!dragging) return;
      dragging = false;
      track.classList.remove('is-dragging');
      hold(1500);
    };
    track.addEventListener('pointerup', endDrag);
    track.addEventListener('pointercancel', endDrag);
    // A drag should not open the Instagram post underneath.
    track.addEventListener('click', (e) => {
      if (moved) { e.preventDefault(); moved = false; }
    }, true);

    // Arrow buttons move one card.
    root.querySelectorAll('.carousel__btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const dir = Number(btn.dataset.dir) || 1;
        const card = track.children[0];
        const step = card.getBoundingClientRect().width + parseFloat(getComputedStyle(track).columnGap || 0);
        if (dir < 0 && track.scrollLeft - step < 0) track.scrollLeft += loop;
        hold(3500);
        track.scrollBy({ left: dir * step, behavior: reduceMotion ? 'auto' : 'smooth' });
      });
    });

    requestAnimationFrame(frame);
  }

  /* ---------- Numbers count up when they come into view ---------- */

  function setupStats() {
    const values = Array.from(document.querySelectorAll('[data-count]'));
    if (!values.length) return;
    const format = (el, n) => (el.dataset.format === 'thousands' ? n.toLocaleString('en-US') : String(n));
    if (reduceMotion || !('IntersectionObserver' in window)) return;

    values.forEach((el) => { el.textContent = format(el, 0); });
    const io = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        io.unobserve(entry.target);
        const el = entry.target;
        const target = Number(el.dataset.count) || 0;
        const start = performance.now();
        const duration = 1400;
        const tick = (now) => {
          const t = clamp((now - start) / duration, 0, 1);
          const eased = 1 - Math.pow(1 - t, 3);
          el.textContent = format(el, Math.round(eased * target));
          if (t < 1) requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      });
    }, { threshold: 0.6 });
    values.forEach((el) => io.observe(el));
  }

  /* ---------- "Apply" buttons pre-select the topic in the form ---------- */

  function setupInterest() {
    const select = document.querySelector('.form select[name="interest"]');
    if (!select) return;
    const sync = () => select.classList.toggle('is-empty', !select.value);
    select.addEventListener('change', sync);
    sync();
    document.querySelectorAll('[data-interest]').forEach((link) => {
      link.addEventListener('click', () => {
        select.value = link.dataset.interest;
        sync();
      });
    });
  }

  /* ---------- Contact form ---------- */

  function setupForm() {
    const form = document.querySelector('.form');
    if (!form) return;
    const status = form.querySelector('.form__status');
    const consent = form.querySelector('.consent');

    const say = (text, isError) => {
      if (!status) return;
      status.textContent = text;
      status.classList.toggle('is-error', Boolean(isError));
    };

    form.addEventListener('input', (e) => {
      if (e.target.matches('input, textarea')) e.target.classList.remove('is-invalid');
      if (e.target.name === 'consent' && consent) consent.classList.remove('is-invalid');
    });

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      let valid = true;
      form.querySelectorAll('.field input, .field textarea').forEach((field) => {
        const ok = field.checkValidity() && field.value.trim() !== '';
        field.classList.toggle('is-invalid', !ok);
        if (!ok) valid = false;
      });
      const consentBox = form.querySelector('input[name="consent"]');
      if (consentBox && !consentBox.checked) {
        valid = false;
        if (consent) consent.classList.add('is-invalid');
      }
      if (!valid) {
        say('Please fill in every field and accept the privacy note.', true);
        return;
      }

      if (!FORM_ENDPOINT) {
        say('Thanks! The form is not connected yet, so nothing was sent.', true);
        return;
      }

      const button = form.querySelector('button[type="submit"]');
      if (button) button.disabled = true;
      say('Sending…');
      try {
        const fields = Object.fromEntries(new FormData(form).entries());
        const data = {
          Name: fields.name,
          email: fields.email, // FormSubmit uses this as the reply-to address
          'Phone or IG handle': fields.contact,
          Topic: fields.interest || 'Not specified',
          Message: fields.message,
          _subject: `New message from ${fields.name} (edodaves site)`,
          _template: 'table',
          _captcha: 'false',
          _honey: fields._honey || '',
        };
        const res = await fetch(FORM_ENDPOINT, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify(data),
        });
        const reply = await res.json().catch(() => ({}));
        if (res.ok && /activat/i.test(String(reply.message || ''))) {
          // FormSubmit has not been activated for this inbox yet.
          say('The form is waiting for activation. Please reach out on Instagram for now.', true);
          return;
        }
        if (!res.ok || String(reply.success) === 'false') throw new Error(reply.message || String(res.status));
        form.reset();
        const topic = form.querySelector('select[name="interest"]');
        if (topic) topic.classList.add('is-empty');
        say('Thank you, we’ll reach out to you in the next 48 hours.');
      } catch (_) {
        say('Something went wrong. Please try again, or reach out on Instagram.', true);
      } finally {
        if (button) button.disabled = false;
      }
    });
  }

  /* ---------- Boot ---------- */

  fitName();
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(fitName);

  window.addEventListener('resize', () => {
    fitName();
    updateStage();
  });
  window.addEventListener('scroll', onScroll, { passive: true });

  setupReveal();
  setupReel();
  setupForm();
  setupStories();
  setupCarousel();
  setupStats();
  setupInterest();
  updateHeader();
  updateStage();

  function scheduleVenture() {
    if (store.get('venture-seen')) return;
    const venture = document.getElementById('venture');
    const show = () => { if (!openModal && !store.get('venture-seen')) showModal(venture); };

    if (desktop.matches) {
      setTimeout(show, VENTURE_DELAY_MS);
      return;
    }
    // On a phone, wait until the visitor has scrolled past the first screen,
    // so the sheet never covers the page before they know who you are.
    const onPhoneScroll = () => {
      if (window.scrollY < window.innerHeight * 0.9) return;
      window.removeEventListener('scroll', onPhoneScroll);
      setTimeout(show, 600);
    };
    window.addEventListener('scroll', onPhoneScroll, { passive: true });
  }

  runPreloader().then(() => {
    fitName();
    scheduleVenture();
  });
})();
