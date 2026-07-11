/*
 * IBA 11.0.8 — Desktop Time Identity Clock
 * Purpose: replace desktop sidebar user profile card visuals with a live analog clock.
 * Scope: UI only. No Firebase, no permissions, no workflow logic.
 */
(function () {
  'use strict';

  const STYLE_ID = 'iba-time-clock-style';
  const CLOCK_CLASS = 'iba-sidebar-time-clock';
  let timer = null;

  function isDesktop() {
    return !window.matchMedia || window.matchMedia('(min-width: 769px)').matches;
  }

  function pad(n) {
    return String(n).padStart(2, '0');
  }

  function getTimePhase(date) {
    const hour = date.getHours();
    if (hour >= 5 && hour < 12) {
      return { key: 'morning', label: 'Morning' };
    }
    if (hour >= 12 && hour < 18) {
      return { key: 'day', label: 'Day' };
    }
    return { key: 'evening', label: 'Evening' };
  }

  function ensureStyles() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      @media (min-width: 769px) {
        /* Hide the original profile card on desktop and place the clock as a clean sibling.
           This removes the old square/card background completely. */
        .workdesk-sidebar .wd-user-profile.iba-time-profile-source,
        aside.workdesk-sidebar .wd-user-profile.iba-time-profile-source,
        .workdesk-sidebar .wd-user-profile.iba-time-profile,
        aside.workdesk-sidebar .wd-user-profile.iba-time-profile {
          display: none !important;
          background: none !important;
          background-image: none !important;
          background-color: transparent !important;
          border: 0 !important;
          outline: 0 !important;
          box-shadow: none !important;
        }
        .workdesk-sidebar > .iba-sidebar-time-clock,
        aside.workdesk-sidebar > .iba-sidebar-time-clock,
        .iba-sidebar-time-clock {
          --iba-clock-size: 178px;
          width: min(100%, 208px);
          min-height: 218px;
          margin: 2px auto 18px !important;
          padding: 4px 0 12px !important;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 8px;
          font-family: Inter, Arial, sans-serif;
          user-select: none;
          background: none !important;
          background-image: none !important;
          background-color: transparent !important;
          border: 0 !important;
          outline: 0 !important;
          box-shadow: none !important;
          border-radius: 0 !important;
          backdrop-filter: none !important;
          -webkit-backdrop-filter: none !important;
        }
        .workdesk-sidebar > .iba-sidebar-time-clock::before,
        .workdesk-sidebar > .iba-sidebar-time-clock::after,
        aside.workdesk-sidebar > .iba-sidebar-time-clock::before,
        aside.workdesk-sidebar > .iba-sidebar-time-clock::after {
          content: none !important;
          display: none !important;
        }
        .iba-time-face {
          width: var(--iba-clock-size);
          height: var(--iba-clock-size);
          border-radius: 50%;
          position: relative;
          display: block;
          box-sizing: border-box;
          background:
            radial-gradient(circle at 48% 46%, #ffffff 0%, #ffffff 54%, #f1f3f5 77%, #e3e5e8 100%);
          border: 7px solid #141414;
          box-shadow:
            0 12px 26px rgba(0,0,0,.30),
            inset 0 0 0 2px rgba(255,255,255,.92),
            inset 0 0 20px rgba(0,0,0,.10);
        }
        .iba-time-face::before {
          content: '';
          position: absolute;
          inset: 9px;
          border-radius: 50%;
          border: 1px solid rgba(0,0,0,.10);
          pointer-events: none;
          z-index: 1;
        }
        .iba-time-face::after {
          content: '';
          position: absolute;
          left: 20%;
          top: 11%;
          width: 52%;
          height: 31%;
          border-radius: 50%;
          background: linear-gradient(145deg, rgba(255,255,255,.34), rgba(255,255,255,0));
          transform: rotate(-12deg);
          pointer-events: none;
          z-index: 5;
        }
        .iba-time-phase-morning .iba-time-face {
          box-shadow:
            0 12px 26px rgba(0,0,0,.30),
            0 0 24px rgba(255,193,89,.52),
            0 0 52px rgba(255,225,136,.20),
            inset 0 0 0 2px rgba(255,255,255,.92),
            inset 0 0 20px rgba(0,0,0,.10);
        }
        .iba-time-phase-day .iba-time-face {
          box-shadow:
            0 12px 26px rgba(0,0,0,.30),
            0 0 22px rgba(110,210,255,.36),
            inset 0 0 0 2px rgba(255,255,255,.92),
            inset 0 0 20px rgba(0,0,0,.10);
        }
        .iba-time-phase-evening .iba-time-face {
          box-shadow:
            0 12px 26px rgba(0,0,0,.33),
            0 0 25px rgba(150,172,255,.38),
            0 0 58px rgba(75,92,190,.22),
            inset 0 0 0 2px rgba(255,255,255,.92),
            inset 0 0 20px rgba(0,0,0,.10);
        }
        .iba-time-mark {
          position: absolute;
          left: 50%;
          top: 50%;
          width: 1.5px;
          height: 7px;
          margin-left: -.75px;
          margin-top: -3.5px;
          border-radius: 999px;
          background: #111;
          transform: rotate(var(--iba-mark-angle)) translateY(calc(var(--iba-clock-size) * -.435));
          transform-origin: center center;
          z-index: 2;
          opacity: .82;
        }
        .iba-time-mark.major {
          width: 4px;
          height: 13px;
          margin-left: -2px;
          margin-top: -6.5px;
          transform: rotate(var(--iba-mark-angle)) translateY(calc(var(--iba-clock-size) * -.414));
          opacity: .96;
        }
        .iba-time-number {
          position: absolute;
          left: var(--iba-number-x);
          top: var(--iba-number-y);
          transform: translate(-50%, -50%);
          z-index: 4;
          color: #151515;
          font-family: Arial, Helvetica, sans-serif;
          font-size: 22px;
          line-height: 1;
          font-weight: 1000;
          letter-spacing: -.04em;
          text-shadow: 0 1px 0 rgba(255,255,255,.75);
        }
        .iba-time-number[data-number='10'],
        .iba-time-number[data-number='11'],
        .iba-time-number[data-number='12'] {
          font-size: 23px;
        }
        .iba-time-hand {
          position: absolute;
          left: 50%;
          bottom: 50%;
          transform-origin: 50% 100%;
          border-radius: 999px;
          z-index: 7;
          box-shadow: 0 2px 4px rgba(0,0,0,.20);
        }
        .iba-time-hand.hour {
          width: 9px;
          height: 46px;
          margin-left: -4.5px;
          background: #111;
        }
        .iba-time-hand.minute {
          width: 7px;
          height: 64px;
          margin-left: -3.5px;
          background: #111;
        }
        .iba-time-hand.second {
          width: 3px;
          height: 67px;
          margin-left: -1.5px;
          background: #d71920;
          box-shadow: 0 0 5px rgba(215,25,32,.32);
          z-index: 8;
        }
        .iba-time-hand.second::after {
          content: '';
          position: absolute;
          left: 50%;
          bottom: -16px;
          width: 3px;
          height: 18px;
          margin-left: -1.5px;
          border-radius: 999px;
          background: #d71920;
        }
        .iba-time-center {
          position: absolute;
          width: 17px;
          height: 17px;
          left: 50%;
          top: 50%;
          margin-left: -8.5px;
          margin-top: -8.5px;
          border-radius: 50%;
          background: #111;
          border: 3px solid #d71920;
          z-index: 9;
          box-shadow: 0 0 7px rgba(0,0,0,.18);
        }
        .iba-time-brand {
          position: absolute;
          left: 50%;
          top: 64%;
          transform: translateX(-50%);
          z-index: 3;
          font-size: 9px;
          font-weight: 900;
          letter-spacing: .09em;
          color: rgba(0,55,90,.62);
          text-transform: uppercase;
          white-space: nowrap;
          pointer-events: none;
        }
        .iba-time-meta {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 2px;
          line-height: 1.05;
          background: transparent !important;
          border: 0 !important;
          box-shadow: none !important;
        }
        .iba-time-label {
          font-size: 12px;
          font-weight: 1000;
          letter-spacing: .15em;
          text-transform: uppercase;
          color: rgba(255,255,255,.92);
          text-shadow: 0 2px 8px rgba(0,0,0,.32);
        }
        .iba-time-digital {
          font-size: 18px;
          font-weight: 1000;
          color: #fff;
          text-shadow: 0 2px 10px rgba(0,0,0,.40);
          white-space: nowrap;
        }
        .iba-time-phase-morning .iba-time-label { color: #ffe8ae; }
        .iba-time-phase-day .iba-time-label { color: #dff7ff; }
        .iba-time-phase-evening .iba-time-label { color: #dce4ff; }
      }
      @media (max-width: 768px) {
        .iba-sidebar-time-clock { display: none !important; }
      }
    `;
    document.head.appendChild(style);
  }

  function createMarks(face) {
    for (let i = 0; i < 60; i += 1) {
      const mark = document.createElement('span');
      mark.className = 'iba-time-mark' + (i % 5 === 0 ? ' major' : '');
      mark.style.setProperty('--iba-mark-angle', (i * 6) + 'deg');
      face.appendChild(mark);
    }
  }

  function createNumbers(face) {
    for (let n = 1; n <= 12; n += 1) {
      const number = document.createElement('span');
      number.className = 'iba-time-number';
      number.dataset.number = String(n);
      number.textContent = String(n);
      const angle = (n * 30) * Math.PI / 180;
      const radius = 36.5;
      const x = 50 + radius * Math.sin(angle);
      const y = 50 - radius * Math.cos(angle);
      number.style.setProperty('--iba-number-x', x.toFixed(3) + '%');
      number.style.setProperty('--iba-number-y', y.toFixed(3) + '%');
      face.appendChild(number);
    }
  }

  function buildClock() {
    const wrap = document.createElement('div');
    wrap.className = CLOCK_CLASS;
    wrap.setAttribute('aria-label', 'Current time');
    wrap.innerHTML = `
      <div class="iba-time-face">
        <span class="iba-time-brand">IBA TIME</span>
        <span class="iba-time-hand hour"></span>
        <span class="iba-time-hand minute"></span>
        <span class="iba-time-hand second"></span>
        <span class="iba-time-center"></span>
      </div>
      <div class="iba-time-meta">
        <span class="iba-time-label">Time</span>
        <span class="iba-time-digital">--:-- --</span>
      </div>
    `;
    const face = wrap.querySelector('.iba-time-face');
    if (face) {
      createMarks(face);
      createNumbers(face);
    }
    return wrap;
  }

  function clearBoxStyle(el) {
    if (!el || !el.style) return;
    el.style.setProperty('background', 'none', 'important');
    el.style.setProperty('background-image', 'none', 'important');
    el.style.setProperty('background-color', 'transparent', 'important');
    el.style.setProperty('border', '0', 'important');
    el.style.setProperty('outline', '0', 'important');
    el.style.setProperty('box-shadow', 'none', 'important');
    el.style.setProperty('border-radius', '0', 'important');
  }

  function installClockIntoProfiles() {
    ensureStyles();
    if (!isDesktop()) return;
    document.querySelectorAll('.wd-user-profile').forEach(function (profile) {
      if (!profile) return;
      profile.classList.add('iba-time-profile-source');
      profile.classList.add('iba-time-profile'); // legacy class kept hidden for older cached styles
      clearBoxStyle(profile);

      if (profile.dataset.ibaTimeClock === '1') return;
      profile.dataset.ibaTimeClock = '1';

      const clock = buildClock();
      clock.dataset.ibaClockForProfile = '1';
      clearBoxStyle(clock);
      if (profile.parentNode) {
        profile.parentNode.insertBefore(clock, profile);
      }
    });
    updateClocks();
    if (!timer) timer = setInterval(updateClocks, 1000);
  }

  function updateClocks() {
    const now = new Date();
    const phase = getTimePhase(now);
    const hour = now.getHours();
    const minute = now.getMinutes();
    const second = now.getSeconds();
    const ms = now.getMilliseconds();

    const secondDeg = ((second + ms / 1000) * 6);
    const minuteDeg = ((minute + second / 60) * 6);
    const hourDeg = (((hour % 12) + minute / 60) * 30);
    const digitalHour = hour % 12 || 12;
    const digital = pad(digitalHour) + ':' + pad(minute) + ' ' + (hour >= 12 ? 'PM' : 'AM');

    document.querySelectorAll('.' + CLOCK_CLASS).forEach(function (clock) {
      clock.classList.remove('iba-time-phase-morning', 'iba-time-phase-day', 'iba-time-phase-evening');
      clock.classList.add('iba-time-phase-' + phase.key);
      const hourHand = clock.querySelector('.iba-time-hand.hour');
      const minuteHand = clock.querySelector('.iba-time-hand.minute');
      const secondHand = clock.querySelector('.iba-time-hand.second');
      const label = clock.querySelector('.iba-time-label');
      const digitalEl = clock.querySelector('.iba-time-digital');
      if (hourHand) hourHand.style.transform = 'rotate(' + hourDeg + 'deg)';
      if (minuteHand) minuteHand.style.transform = 'rotate(' + minuteDeg + 'deg)';
      if (secondHand) secondHand.style.transform = 'rotate(' + secondDeg + 'deg)';
      if (label) label.textContent = phase.label;
      if (digitalEl) digitalEl.textContent = digital;
      clock.setAttribute('aria-label', phase.label + ' current time ' + digital);
    });
  }

  function boot() {
    installClockIntoProfiles();
    // Some module cards are created/touched after login; repeat lightly without Firebase use.
    setTimeout(installClockIntoProfiles, 250);
    setTimeout(installClockIntoProfiles, 1000);
    if (!window.__ibaTimeClockMutationBound) {
      window.__ibaTimeClockMutationBound = true;
      const observer = new MutationObserver(function () {
        clearTimeout(window.__ibaTimeClockMutationTimer);
        window.__ibaTimeClockMutationTimer = setTimeout(installClockIntoProfiles, 120);
      });
      observer.observe(document.body, { childList: true, subtree: true });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }

  window.ibaInstallDesktopTimeClock = installClockIntoProfiles;
})();
