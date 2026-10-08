/*
   IBA WorkDesk — Celebration Banner Module
   Version: 8.0.1
   Cleanup: moved out of app.js in 8.0.1.
   Scope: celebration banner display + Super Admin celebration settings helpers only.
*/

// =================================================================================================
// #region BLOCK 10 — CELEBRATION BANNER MODULE
// Purpose: Qatar date helpers, active date checks, particles, fireworks audio, banner show/hide.
// =================================================================================================

// ================================
// Celebration Banner Overlay (configurable)
// - Trigger: successful login
// - Config source: Firebase RTDB `system_settings/celebration_banner`
// - Date window uses Asia/Qatar
// - Frequency: every login OR once per device (per config.version)
// ================================

function getQatarNowParts() {
    // Returns {year, month, day, hour, minute} in Asia/Qatar without relying on device timezone.
    const fmt = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Qatar',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
    });
    const parts = fmt.formatToParts(new Date());
    const map = Object.fromEntries(parts.map(p => [p.type, p.value]));
    return {
        year: Number(map.year),
        month: Number(map.month),
        day: Number(map.day),
        hour: Number(map.hour),
        minute: Number(map.minute)
    };
}

function ymdToInt(ymd) {
    // ymd: 'YYYY-MM-DD'
    if (!ymd || typeof ymd !== 'string') return null;
    const m = ymd.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!m) return null;
    return Number(m[1] + m[2] + m[3]);
}

function getQatarTodayInt() {
    const p = getQatarNowParts();
    const mm = String(p.month).padStart(2, '0');
    const dd = String(p.day).padStart(2, '0');
    return Number(String(p.year) + mm + dd);
}

function normalizeCelebrationConfig(raw) {
    const defaults = {
        enabled: true,
        title: 'Happy New Year 2026',
        subtitle: 'Welcome back — wishing you a successful year.',
        emoji: '🎆',
        startDate: '2026-01-01',
        endDate: '2026-01-02',
        showMode: 'every_login', // 'every_login' | 'once_per_device'
        soundEnabled: true,
        // Optional external sound (e.g., Firebase Storage mp3). If empty, a built-in sound plays.
        soundUrl: 'https://raw.githubusercontent.com/DC-database/hub/refs/heads/main/fireworks.mp3',
        soundVolume: 0.75,
        durationMs: 5200,
        version: 'default-ny2026'
    };

    if (!raw || typeof raw !== 'object') return defaults;

    const cfg = { ...defaults, ...raw };

    // Defensive cleanup
    cfg.enabled = cfg.enabled === true || cfg.enabled === 'true' || cfg.enabled === 'Yes';
    cfg.title = String(cfg.title || defaults.title);
    cfg.subtitle = String(cfg.subtitle || defaults.subtitle);
    cfg.emoji = String(cfg.emoji || defaults.emoji).trim() || defaults.emoji;
    cfg.showMode = (cfg.showMode === 'once_per_device') ? 'once_per_device' : 'every_login';
    cfg.soundEnabled = cfg.soundEnabled === true || cfg.soundEnabled === 'true' || cfg.soundEnabled === 'Yes';
    cfg.soundUrl = String(cfg.soundUrl || '').trim();
    cfg.soundVolume = Number(cfg.soundVolume ?? defaults.soundVolume);
    if (!Number.isFinite(cfg.soundVolume) || cfg.soundVolume <= 0 || cfg.soundVolume > 1) cfg.soundVolume = defaults.soundVolume;
    cfg.durationMs = Number(cfg.durationMs || defaults.durationMs);
    if (!Number.isFinite(cfg.durationMs) || cfg.durationMs < 1200) cfg.durationMs = defaults.durationMs;
    cfg.version = String(cfg.version || defaults.version);

    return cfg;
}

async function fetchCelebrationConfig() {
    // If DB is unavailable, return null and fallback to defaults (NY2026 only).
    try {
        if (!db || typeof db.ref !== 'function') return null;
        const snap = await db.ref('system_settings/celebration_banner').once('value');
        return snap.val();
    } catch (e) {
        console.log('Celebration config fetch failed:', e);
        return null;
    }
}

function isConfigActiveNow(cfg) {
    if (!cfg?.enabled) return false;

    const today = getQatarTodayInt();
    const start = ymdToInt(cfg.startDate);
    const end = ymdToInt(cfg.endDate);

    if (start && today < start) return false;
    if (end && today > end) return false;

    return true;
}

function buildCelebrationParticles(container) {
    if (!container) return;

    // Clear previous effects
    container.innerHTML = '';

    const colors = ['#ff4d4d', '#ffd24d', '#4dd2ff', '#7dff4d', '#c44dff', '#ffffff'];

    // -----------------------------
    // 1) Confetti (falling pieces)
    // -----------------------------
    const confettiCount = 70;

    for (let i = 0; i < confettiCount; i++) {
        const s = document.createElement('span');
        s.className = 'confetti';

        const left = Math.random() * 100;
        const delay = Math.random() * 0.7;
        const duration = 3.5 + Math.random() * 1.7;
        const sizeW = 6 + Math.random() * 6;
        const sizeH = 10 + Math.random() * 10;

        s.style.left = left + 'vw';
        s.style.top = (-10 - Math.random() * 30) + 'vh';
        s.style.background = colors[Math.floor(Math.random() * colors.length)];
        s.style.width = sizeW + 'px';
        s.style.height = sizeH + 'px';
        s.style.animationDuration = duration + 's';
        s.style.animationDelay = delay + 's';
        s.style.transform = `translateY(-10vh) rotate(${Math.random() * 180}deg)`;

        container.appendChild(s);
    }

    // -----------------------------
    // 2) Fireworks (spark bursts)
    // -----------------------------
    // Lightweight CSS-based bursts (no canvas) that appear behind the banner.
    const burstCount = 10;          // number of firework bursts
    const sparksPerBurst = 14;      // sparks in each burst

    for (let b = 0; b < burstCount; b++) {
        const fw = document.createElement('div');
        fw.className = 'firework';

        // Keep fireworks mostly in the upper/middle area so they don't distract from buttons.
        const x = 10 + Math.random() * 80;      // vw
        const y = 12 + Math.random() * 50;      // vh

        fw.style.left = x + 'vw';
        fw.style.top = y + 'vh';

        // Spread bursts across the banner duration (default ~5.2s)
        const baseDelay = Math.random() * 2.8;  // seconds
        const dur = 0.75 + Math.random() * 0.55;

        for (let i = 0; i < sparksPerBurst; i++) {
            const sp = document.createElement('span');
            sp.className = 'spark';

            const angle = (Math.PI * 2 * i / sparksPerBurst) + (Math.random() * 0.35);
            const dist = 36 + Math.random() * 80;

            const dx = Math.cos(angle) * dist;
            const dy = Math.sin(angle) * dist;

            const c = colors[Math.floor(Math.random() * colors.length)];

            sp.style.setProperty('--dx', dx.toFixed(1) + 'px');
            sp.style.setProperty('--dy', dy.toFixed(1) + 'px');
            sp.style.setProperty('--c', c);
            sp.style.setProperty('--dur', dur.toFixed(2) + 's');
            sp.style.setProperty('--d', (baseDelay + Math.random() * 0.18).toFixed(2) + 's');

            // Slight size variation
            const size = 2.5 + Math.random() * 2.5;
            sp.style.width = size.toFixed(1) + 'px';
            sp.style.height = size.toFixed(1) + 'px';

            fw.appendChild(sp);
        }

        container.appendChild(fw);
    }
}

function tryPlayFireworksSound(volume = 0.5) {
    // Lightweight synthesized "firework pops" using WebAudio (no external file).
    try {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (!AudioCtx) return { ok: false, reason: 'no_audio_context' };

        if (!window.__ibaFireworkAudioCtx) {
            window.__ibaFireworkAudioCtx = new AudioCtx();
        }
        const ctx = window.__ibaFireworkAudioCtx;

        // Resume may fail on mobile until a user gesture happens.
        if (ctx.state === 'suspended') {
            const p = ctx.resume();
            if (p && typeof p.then === 'function') {
                // We'll still attempt to schedule; if resume fails, catch below.
            }
        }

        const now = ctx.currentTime;

        for (let i = 0; i < 6; i++) {
            const t = now + i * (0.12 + Math.random() * 0.05);
            const dur = 0.12 + Math.random() * 0.10;
            const len = Math.floor(ctx.sampleRate * dur);
            const buf = ctx.createBuffer(1, len, ctx.sampleRate);
            const data = buf.getChannelData(0);

            // Exponential decay noise burst
            for (let j = 0; j < len; j++) {
                const decay = Math.exp(-j / (len / 6));
                data[j] = (Math.random() * 2 - 1) * decay;
            }

            const src = ctx.createBufferSource();
            src.buffer = buf;

            const bp = ctx.createBiquadFilter();
            bp.type = 'bandpass';
            bp.frequency.value = 900 + Math.random() * 1600;
            bp.Q.value = 2.5 + Math.random() * 2;

            const gain = ctx.createGain();
            gain.gain.setValueAtTime(0.0001, t);
            gain.gain.exponentialRampToValueAtTime(volume, t + 0.02);
            gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);

            src.connect(bp);
            bp.connect(gain);
            gain.connect(ctx.destination);

            src.start(t);
            src.stop(t + dur + 0.01);
        }

        return { ok: true };
    } catch (e) {
        return { ok: false, reason: e?.message || 'unknown' };
    }
}

async function tryPlayFireworksSoundFromUrl(url, volume = 0.75) {
    // External mp3 (recommended for "real" fireworks). Returns ok=false if autoplay is blocked.
    try {
        const cleanUrl = String(url || '').trim();
        if (!cleanUrl) return { ok: false, reason: 'no_url' };

        // Reuse a single audio element to avoid creating many instances.
        if (!window.__ibaCelebrationAudio || window.__ibaCelebrationAudio.src !== cleanUrl) {
            const a = new Audio(cleanUrl);
            a.preload = 'auto';
            // Not all browsers honor this for cross-origin mp3, but it doesn't hurt.
            a.crossOrigin = 'anonymous';
            window.__ibaCelebrationAudio = a;
        }

        const audio = window.__ibaCelebrationAudio;
        audio.volume = Math.min(1, Math.max(0, Number(volume) || 0.75));
        try { audio.currentTime = 0; } catch (_) {}

        const p = audio.play();
        if (p && typeof p.then === 'function') {
            await p;
        }
        return { ok: true };
    } catch (e) {
        return { ok: false, reason: e?.name || e?.message || 'unknown' };
    }
}

function stopCelebrationAudio() {
    try {
        if (window.__ibaCelebrationAudio) {
            window.__ibaCelebrationAudio.pause();
            try { window.__ibaCelebrationAudio.currentTime = 0; } catch (_) {}
        }
    } catch (_) {}
}

function showCelebrationBannerFromConfig(cfg, opts = {}) {
    const overlay = document.getElementById('celebration-overlay');
    const closeBtn = document.getElementById('celebration-close-btn');
    const particles = document.getElementById('celebration-particles');
    const titleEl = document.getElementById('celebration-title');
    const subEl = document.getElementById('celebration-sub');
    const emojiEl = document.getElementById('celebration-emoji');
    const soundHint = document.getElementById('celebration-sound-hint');

    if (!overlay || !closeBtn || !titleEl || !subEl || !emojiEl) return;

    titleEl.textContent = cfg.title || '';
    subEl.textContent = cfg.subtitle || '';
    emojiEl.textContent = cfg.emoji || '🎉';

    buildCelebrationParticles(particles);

    overlay.classList.remove('hidden');
    overlay.setAttribute('aria-hidden', 'false');

    const hide = () => {
        overlay.classList.add('hidden');
        overlay.setAttribute('aria-hidden', 'true');
        if (soundHint) soundHint.classList.add('hidden');
        stopCelebrationAudio();
    };

    // Close actions
    const escHandler = (ev) => {
        if (ev.key === 'Escape') {
            hide();
            document.removeEventListener('keydown', escHandler);
        }
    };
    document.addEventListener('keydown', escHandler);

    const clickOutsideHandler = (ev) => {
        // Click outside the banner closes too
        const banner = document.getElementById('celebration-banner');
        if (banner && !banner.contains(ev.target)) {
            hide();
            overlay.removeEventListener('click', clickOutsideHandler);
            document.removeEventListener('keydown', escHandler);
        }
    };

    closeBtn.onclick = () => {
        hide();
        overlay.removeEventListener('click', clickOutsideHandler);
        document.removeEventListener('keydown', escHandler);
    };
    overlay.addEventListener('click', clickOutsideHandler);

    // Sound: try autoplay; if blocked, request a tap
    if (cfg.soundEnabled) {
        const volume = Math.min(1, Math.max(0, Number(cfg.soundVolume) || 0.75));

        const attemptPlay = async () => {
            // Prefer external mp3 if configured, else fallback to built-in synth.
            if (cfg.soundUrl) {
                const r1 = await tryPlayFireworksSoundFromUrl(cfg.soundUrl, volume);
                if (r1.ok) return r1;
                // If it failed for a non-autoplay reason (e.g., bad URL/network), fallback to synth.
                if (String(r1.reason || '').toLowerCase().includes('notallowed')) return r1;
                const r2 = tryPlayFireworksSound(Math.max(0.35, volume * 0.75));
                return r2.ok ? r2 : r1;
            }
            return tryPlayFireworksSound(Math.max(0.35, volume * 0.75));
        };

        attemptPlay().then((res) => {
            if (res?.ok) return;
            if (soundHint) soundHint.classList.remove('hidden');

            const gesturePlay = async () => {
                const r = await attemptPlay();
                if (r?.ok && soundHint) soundHint.classList.add('hidden');
                overlay.removeEventListener('pointerdown', gesturePlay);
            };
            overlay.addEventListener('pointerdown', gesturePlay, { once: true });
        }).catch(() => {
            if (soundHint) soundHint.classList.remove('hidden');
        });
    }

    // Auto-close
    const duration = Number(cfg.durationMs || 5200);
    setTimeout(() => {
        hide();
        overlay.removeEventListener('click', clickOutsideHandler);
        document.removeEventListener('keydown', escHandler);
    }, duration);
}

async function showCelebrationBannerIfNeeded() {
    // 1) Fetch config (DB) or fallback.
    const raw = await fetchCelebrationConfig();
    const cfg = normalizeCelebrationConfig(raw);

    // If no DB config exists, only show the built-in default during its own date window.
    if (!raw && !isConfigActiveNow(cfg)) return;

    // If DB config exists, still respect the date window.
    if (raw && !isConfigActiveNow(cfg)) return;

    // 2) Frequency rule
    const storageKey = `celebration_shown_${cfg.version}`;
    if (cfg.showMode === 'once_per_device' && localStorage.getItem(storageKey) === '1') {
        return;
    }

    // Mark shown before rendering (prevents loops on refresh)
    if (cfg.showMode === 'once_per_device') {
        localStorage.setItem(storageKey, '1');
    }

    showCelebrationBannerFromConfig(cfg);
}

// ================================
// End Celebration Banner Overlay
// ================================




// #endregion BLOCK 10 — CELEBRATION BANNER MODULE




// =================================================================================================
// Celebration Banner Settings Helpers (moved from app.js)
// =================================================================================================

async function populateCelebrationSettingsForm() {
    if (!celebrationSettingsContainer) return;

    const allowed = isCurrentUserSuperAdmin();
    celebrationSettingsContainer.classList.toggle('hidden', !allowed);
    if (!allowed) return;

    // Load current config
    const raw = await fetchCelebrationConfig();
    const cfg = normalizeCelebrationConfig(raw);

    if (celebrationEnabledCheckbox) celebrationEnabledCheckbox.checked = !!cfg.enabled;
    if (celebrationTitleInput) celebrationTitleInput.value = cfg.title || '';
    if (celebrationSubtitleInput) celebrationSubtitleInput.value = cfg.subtitle || '';
    if (celebrationEmojiInput) celebrationEmojiInput.value = cfg.emoji || '🎉';
    if (celebrationStartDateInput) celebrationStartDateInput.value = cfg.startDate || '';
    if (celebrationEndDateInput) celebrationEndDateInput.value = cfg.endDate || '';
    if (celebrationShowModeSelect) celebrationShowModeSelect.value = cfg.showMode || 'every_login';
    if (celebrationSoundEnabledCheckbox) celebrationSoundEnabledCheckbox.checked = !!cfg.soundEnabled;
    if (celebrationSoundUrlInput) celebrationSoundUrlInput.value = cfg.soundUrl || '';

    if (celebrationSettingsMessage) {
        celebrationSettingsMessage.textContent = '';
        celebrationSettingsMessage.className = 'error-message';
    }
}

function readCelebrationConfigFromUI() {
    const cfg = {
        enabled: celebrationEnabledCheckbox?.checked === true,
        title: (celebrationTitleInput?.value || '').trim(),
        subtitle: (celebrationSubtitleInput?.value || '').trim(),
        emoji: (celebrationEmojiInput?.value || '🎉').trim(),
        startDate: celebrationStartDateInput?.value || '',
        endDate: celebrationEndDateInput?.value || '',
        showMode: celebrationShowModeSelect?.value || 'every_login',
        soundEnabled: celebrationSoundEnabledCheckbox?.checked === true,
        soundUrl: (celebrationSoundUrlInput?.value || '').trim(),
        soundVolume: 0.75,
        durationMs: 5200,
        version: String(Date.now()),
        updatedBy: currentApprover?.Name || '',
        updatedAt: firebase.database.ServerValue.TIMESTAMP
    };
    return normalizeCelebrationConfig(cfg);
}

async function saveCelebrationSettingsFromUI(disableOnly = false) {
    if (!isCurrentUserSuperAdmin()) return;

    if (!db || typeof db.ref !== 'function') {
        if (celebrationSettingsMessage) {
            celebrationSettingsMessage.textContent = 'Database is not ready. Please refresh and try again.';
        }
        return;
    }

    let cfg;
    if (disableOnly) {
        const raw = await fetchCelebrationConfig();
        cfg = normalizeCelebrationConfig(raw);
        cfg.enabled = false;
        cfg.version = String(Date.now());
        cfg.updatedBy = currentApprover?.Name || '';
        cfg.updatedAt = firebase.database.ServerValue.TIMESTAMP;
    } else {
        cfg = readCelebrationConfigFromUI();
    }

    try {
        await db.ref('system_settings/celebration_banner').set(cfg);

        if (celebrationSettingsMessage) {
            celebrationSettingsMessage.textContent = disableOnly ? 'Celebration banner turned off.' : 'Celebration banner saved.';
            celebrationSettingsMessage.className = 'success-message';
        }
    } catch (e) {
        if (celebrationSettingsMessage) {
            celebrationSettingsMessage.textContent = 'Failed to save: ' + (e?.message || e);
            celebrationSettingsMessage.className = 'error-message';
        }
    }
}
