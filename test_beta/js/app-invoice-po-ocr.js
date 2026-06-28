// js/app-invoice-po-ocr.js
// Version 8.4.3 — Invoice Records PO/LPO OCR Scanner + Google Lens Paste helper
// Purpose: Mobile Invoice Records camera text scan for printed PO/LPO numbers.
// Privacy: Captured camera frames are processed in browser memory only.
// No Firebase upload, no server upload, no phone gallery save.
(function () {
  'use strict';

  const OCR_SCRIPT_ID = 'tesseract-js-cdn';
  const OCR_SCRIPT_SRC = 'https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js';
  const BUTTON_ID = 'im-records-po-ocr-scan-button';
  const BUTTON_BOTTOM_ID = 'im-records-po-ocr-scan-button-mobile-modal';
  const BUTTON_INLINE_ID = 'im-mobile-inline-po-ocr-scan-button';
  const PASTE_BUTTON_ID = 'im-records-paste-scanned-text-button';
  const PASTE_BOTTOM_ID = 'im-records-paste-scanned-text-button-mobile-modal';
  const PASTE_INLINE_ID = 'im-mobile-inline-paste-scanned-text-button';
  const MODAL_ID = 'im-po-ocr-modal';

  let stream = null;
  let isReading = false;
  let torchEnabled = false;

  function injectStyles() {
    if (document.getElementById('im-po-ocr-style')) return;
    const style = document.createElement('style');
    style.id = 'im-po-ocr-style';
    style.textContent = `
      #${BUTTON_ID}, #${BUTTON_BOTTOM_ID}, #${BUTTON_INLINE_ID},
      #${PASTE_BUTTON_ID}, #${PASTE_BOTTOM_ID}, #${PASTE_INLINE_ID} {
        background: #7c3aed;
        color: #fff;
        border: none;
        border-radius: 10px;
        padding: 0 14px;
        min-height: 44px;
        font-weight: 800;
        align-items: center;
        justify-content: center;
        gap: 7px;
        cursor: pointer;
        white-space: nowrap;
        width: 100%;
        margin: 8px 0 0;
      }
      #${BUTTON_ID}, #${PASTE_BUTTON_ID} {
        display: none;
      }
      #${PASTE_BUTTON_ID}, #${PASTE_BOTTOM_ID}, #${PASTE_INLINE_ID} {
        background: #0f766e;
      }
      #${BUTTON_ID}:hover, #${BUTTON_BOTTOM_ID}:hover, #${BUTTON_INLINE_ID}:hover,
      #${PASTE_BUTTON_ID}:hover, #${PASTE_BOTTOM_ID}:hover, #${PASTE_INLINE_ID}:hover { filter: brightness(1.05); }
      #${MODAL_ID} {
        position: fixed;
        inset: 0;
        z-index: 30000;
        background: rgba(15, 23, 42, 0.82);
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 14px;
      }
      #${MODAL_ID}.hidden { display: none !important; }
      .im-po-ocr-card {
        width: min(96vw, 520px);
        max-height: 92vh;
        overflow: auto;
        background: #fff;
        border-radius: 16px;
        box-shadow: 0 18px 50px rgba(0,0,0,0.35);
        color: #0f172a;
      }
      .im-po-ocr-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 12px;
        padding: 14px 16px;
        background: #003A5C;
        color: #fff;
        border-radius: 16px 16px 0 0;
      }
      .im-po-ocr-header h3 {
        margin: 0;
        font-size: 1rem;
      }
      .im-po-ocr-close {
        background: rgba(255,255,255,0.12);
        color: #fff;
        border: 1px solid rgba(255,255,255,0.25);
        border-radius: 10px;
        width: 36px;
        height: 36px;
        font-size: 1.35rem;
        line-height: 1;
        cursor: pointer;
      }
      .im-po-ocr-body { padding: 14px 16px 16px; }
      .im-po-ocr-hint {
        margin: 0 0 10px;
        font-size: 0.9rem;
        color: #475569;
        line-height: 1.35;
      }
      .im-po-ocr-video-wrap {
        position: relative;
        background: #0f172a;
        border-radius: 14px;
        overflow: hidden;
        min-height: 260px;
        display: flex;
        align-items: center;
        justify-content: center;
      }
      #im-po-ocr-video {
        width: 100%;
        max-height: 55vh;
        object-fit: contain;
        background: #0f172a;
      }
      .im-po-ocr-guide {
        position: absolute;
        left: 18%;
        right: 18%;
        top: 43%;
        height: 14%;
        border: 3px solid rgba(34, 197, 94, 0.98);
        border-radius: 8px;
        box-shadow: 0 0 0 999px rgba(0,0,0,0.24);
        pointer-events: none;
      }
      .im-po-ocr-guide::before {
        content: 'Keep PO/LPO here';
        position: absolute;
        left: 50%;
        top: -26px;
        transform: translateX(-50%);
        color: #dcfce7;
        background: rgba(15, 23, 42, 0.82);
        border: 1px solid rgba(34, 197, 94, 0.7);
        border-radius: 999px;
        padding: 3px 8px;
        font-size: 0.72rem;
        font-weight: 800;
        white-space: nowrap;
      }
      .im-po-ocr-actions {
        display: flex;
        gap: 8px;
        flex-wrap: wrap;
        margin-top: 12px;
      }
      .im-po-ocr-actions button {
        border: none;
        border-radius: 8px;
        padding: 10px 12px;
        font-weight: 700;
        cursor: pointer;
      }
      #im-po-ocr-read-btn { background: #16a34a; color: #fff; flex: 1 1 100%; }
      #im-po-ocr-refocus-btn { background: #0ea5e9; color: #fff; }
      #im-po-ocr-torch-btn { background: #f59e0b; color: #111827; }
      #im-po-ocr-search-btn { background: #00748C; color: #fff; }
      #im-po-ocr-scan-again-btn { background: #e2e8f0; color: #0f172a; }
      #im-po-ocr-cancel-btn { background: #64748b; color: #fff; }
      #im-po-ocr-status {
        margin-top: 10px;
        min-height: 22px;
        font-size: 0.92rem;
        color: #334155;
        line-height: 1.35;
      }
      #im-po-ocr-status strong { color: #14532d; }
      .im-po-ocr-candidates {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
        margin-top: 8px;
      }
      .im-po-ocr-candidate-btn {
        background: #f1f5f9;
        border: 1px solid #cbd5e1;
        border-radius: 999px;
        color: #0f172a;
        padding: 7px 10px;
        font-weight: 700;
        cursor: pointer;
      }
      .im-po-ocr-small {
        margin-top: 8px;
        font-size: 0.78rem;
        color: #64748b;
      }
      #${BUTTON_BOTTOM_ID}, #${PASTE_BOTTOM_ID} {
        width: 100%;
        min-height: 42px;
        margin-top: 8px;
      }
      #im-po-ocr-toast {
        position: fixed;
        left: 50%;
        bottom: 18px;
        transform: translateX(-50%);
        z-index: 40000;
        background: rgba(15, 23, 42, 0.95);
        color: #fff;
        border-radius: 999px;
        padding: 10px 14px;
        font-size: 0.88rem;
        font-weight: 700;
        box-shadow: 0 10px 25px rgba(0,0,0,0.28);
        max-width: min(90vw, 520px);
        text-align: center;
      }
      @media (max-width: 900px), (hover: none) and (pointer: coarse) {
        #${BUTTON_ID}, #${PASTE_BUTTON_ID} { display: inline-flex !important; }
      }
    `;
    document.head.appendChild(style);
  }

  function loadTesseract() {
    if (window.Tesseract) return Promise.resolve(window.Tesseract);

    const existing = document.getElementById(OCR_SCRIPT_ID);
    if (existing) {
      return new Promise((resolve, reject) => {
        existing.addEventListener('load', () => resolve(window.Tesseract), { once: true });
        existing.addEventListener('error', reject, { once: true });
      });
    }

    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.id = OCR_SCRIPT_ID;
      script.src = OCR_SCRIPT_SRC;
      script.async = true;
      script.onload = () => resolve(window.Tesseract);
      script.onerror = () => reject(new Error('OCR library failed to load.'));
      document.head.appendChild(script);
    });
  }

  function createModal() {
    let modal = document.getElementById(MODAL_ID);
    if (modal) return modal;

    modal = document.createElement('div');
    modal.id = MODAL_ID;
    modal.className = 'hidden';
    modal.innerHTML = `
      <div class="im-po-ocr-card" role="dialog" aria-modal="true" aria-labelledby="im-po-ocr-title">
        <div class="im-po-ocr-header">
          <h3 id="im-po-ocr-title"><i class="fa-solid fa-camera"></i> Scan PO/LPO Text</h3>
          <button type="button" class="im-po-ocr-close" id="im-po-ocr-close-btn" aria-label="Close">&times;</button>
        </div>
        <div class="im-po-ocr-body">
          <p class="im-po-ocr-hint">Point the camera at the printed <strong>P.O. Number</strong>, <strong>PO Number</strong>, or <strong>LPO</strong>. Keep only the target line inside the smaller green box, then tap <strong>Read PO</strong>. Use <strong>Refocus</strong> if the camera looks blurry.</p>
          <div class="im-po-ocr-video-wrap">
            <video id="im-po-ocr-video" playsinline autoplay muted></video>
            <div class="im-po-ocr-guide"></div>
          </div>
          <canvas id="im-po-ocr-canvas" class="hidden"></canvas>
          <div class="im-po-ocr-actions">
            <button type="button" id="im-po-ocr-read-btn"><i class="fa-solid fa-wand-magic-sparkles"></i> Read PO</button>
            <button type="button" id="im-po-ocr-refocus-btn"><i class="fa-solid fa-crosshairs"></i> Refocus</button>
            <button type="button" id="im-po-ocr-torch-btn" class="hidden"><i class="fa-solid fa-lightbulb"></i> Light</button>
            <button type="button" id="im-po-ocr-search-btn" class="hidden"><i class="fa-solid fa-magnifying-glass"></i> Search</button>
            <button type="button" id="im-po-ocr-scan-again-btn" class="hidden">Scan Again</button>
            <button type="button" id="im-po-ocr-cancel-btn">Cancel</button>
          </div>
          <div id="im-po-ocr-status">Camera is ready.</div>
          <div class="im-po-ocr-small">Privacy: the image frame is temporary. It is not saved to your phone, Firebase, GitHub, or server.</div>
        </div>
      </div>
    `;
    document.body.appendChild(modal);

    modal.querySelector('#im-po-ocr-close-btn').addEventListener('click', closeModal);
    modal.querySelector('#im-po-ocr-cancel-btn').addEventListener('click', closeModal);
    modal.querySelector('#im-po-ocr-read-btn').addEventListener('click', readCurrentFrame);
    modal.querySelector('#im-po-ocr-refocus-btn').addEventListener('click', refocusCamera);
    modal.querySelector('#im-po-ocr-torch-btn').addEventListener('click', toggleTorch);
    modal.querySelector('#im-po-ocr-scan-again-btn').addEventListener('click', resetForScanAgain);
    modal.querySelector('#im-po-ocr-search-btn').addEventListener('click', () => {
      const searchButton = document.getElementById('im-reporting-search-btn') || document.getElementById('im-mobile-search-run-btn');
      if (searchButton) searchButton.click();
      closeModal();
    });

    modal.addEventListener('click', (event) => {
      if (event.target === modal) closeModal();
    });

    return modal;
  }

  function setStatus(message, html) {
    const status = document.getElementById('im-po-ocr-status');
    if (!status) return;
    if (html) status.innerHTML = message;
    else status.textContent = message;
  }

  function setReadingUI(reading) {
    isReading = reading;
    const readBtn = document.getElementById('im-po-ocr-read-btn');
    if (readBtn) {
      readBtn.disabled = reading;
      readBtn.innerHTML = reading
        ? '<i class="fa-solid fa-spinner fa-spin"></i> Reading...'
        : '<i class="fa-solid fa-wand-magic-sparkles"></i> Read PO';
    }
  }

  async function openModal() {
    injectStyles();
    const modal = createModal();
    modal.classList.remove('hidden');
    resetForScanAgain(false);

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setStatus('Camera access is not supported in this browser. Use Android Chrome over HTTPS.');
      return;
    }

    try {
      stopStream();
      stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: 1920 },
          height: { ideal: 1080 },
          advanced: [
            { focusMode: 'continuous' },
            { exposureMode: 'continuous' },
            { whiteBalanceMode: 'continuous' }
          ]
        },
        audio: false
      });
      const video = document.getElementById('im-po-ocr-video');
      if (video) {
        video.srcObject = stream;
        await video.play().catch(() => {});
      }
      await applyCameraImprovements(false);
      setStatus('Camera is ready. Put only the PO/LPO number or vendor text inside the smaller green box, then tap Read PO.');
    } catch (error) {
      console.error('[PO OCR] Camera error:', error);
      setStatus('Camera permission failed. Please allow camera access and try again.');
    }
  }

  function closeModal() {
    stopStream();
    const modal = document.getElementById(MODAL_ID);
    if (modal) modal.classList.add('hidden');
    clearCanvas();
  }

  function stopStream() {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      stream = null;
    }
    torchEnabled = false;
    updateTorchButton(false);
    const video = document.getElementById('im-po-ocr-video');
    if (video) video.srcObject = null;
  }

  function clearCanvas() {
    const canvas = document.getElementById('im-po-ocr-canvas');
    if (canvas) {
      const ctx = canvas.getContext('2d');
      if (ctx) ctx.clearRect(0, 0, canvas.width || 1, canvas.height || 1);
      canvas.width = 0;
      canvas.height = 0;
    }
  }

  function resetForScanAgain(keepMessage = true) {
    const searchBtn = document.getElementById('im-po-ocr-search-btn');
    const againBtn = document.getElementById('im-po-ocr-scan-again-btn');
    const readBtn = document.getElementById('im-po-ocr-read-btn');
    if (searchBtn) searchBtn.classList.add('hidden');
    if (againBtn) againBtn.classList.add('hidden');
    if (readBtn) readBtn.classList.remove('hidden');
    clearCanvas();
    setReadingUI(false);
    if (keepMessage) setStatus('Ready. Aim the smaller green box at the PO/LPO number or vendor text, then tap Read PO.');
  }

  function getVideoTrack() {
    return stream ? stream.getVideoTracks()[0] : null;
  }

  function updateTorchButton(isSupported) {
    const torchBtn = document.getElementById('im-po-ocr-torch-btn');
    if (!torchBtn) return;
    torchBtn.classList.toggle('hidden', !isSupported);
    torchBtn.innerHTML = torchEnabled
      ? '<i class="fa-solid fa-lightbulb"></i> Light On'
      : '<i class="fa-solid fa-lightbulb"></i> Light';
  }

  async function applyCameraImprovements(showMessage = true) {
    const track = getVideoTrack();
    if (!track || !track.getCapabilities) return;
    const capabilities = track.getCapabilities() || {};
    const advanced = [];

    // Supported on some Android Chrome devices. Unsupported keys are ignored/fail safely.
    if (Array.isArray(capabilities.focusMode) && capabilities.focusMode.includes('continuous')) advanced.push({ focusMode: 'continuous' });
    if (Array.isArray(capabilities.exposureMode) && capabilities.exposureMode.includes('continuous')) advanced.push({ exposureMode: 'continuous' });
    if (Array.isArray(capabilities.whiteBalanceMode) && capabilities.whiteBalanceMode.includes('continuous')) advanced.push({ whiteBalanceMode: 'continuous' });

    if (advanced.length && track.applyConstraints) {
      try { await track.applyConstraints({ advanced }); } catch (error) { console.warn('[PO OCR] Camera improvement skipped:', error); }
    }

    updateTorchButton(Boolean(capabilities.torch));
    if (showMessage) setStatus('Refocus requested. Hold steady, keep good light, then tap Read PO.');
  }

  async function refocusCamera() {
    const track = getVideoTrack();
    if (!track) {
      setStatus('Camera is not ready yet.');
      return;
    }

    await applyCameraImprovements(false);

    // Some browsers do not expose manual focus. Restarting the stream often forces a fresh autofocus.
    try {
      setStatus('Refocusing camera...');
      const video = document.getElementById('im-po-ocr-video');
      stopStream();
      stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: 1920 },
          height: { ideal: 1080 },
          advanced: [{ focusMode: 'continuous' }]
        },
        audio: false
      });
      if (video) {
        video.srcObject = stream;
        await video.play().catch(() => {});
      }
      await applyCameraImprovements(false);
      setStatus('Refocus done. Hold steady and tap Read PO.');
    } catch (error) {
      console.warn('[PO OCR] Refocus restart failed:', error);
      setStatus('Refocus was requested. If still blurry, move slightly closer/farther and try again.');
    }
  }

  async function toggleTorch() {
    const track = getVideoTrack();
    if (!track || !track.getCapabilities || !track.getCapabilities().torch || !track.applyConstraints) return;
    try {
      torchEnabled = !torchEnabled;
      await track.applyConstraints({ advanced: [{ torch: torchEnabled }] });
      updateTorchButton(true);
      setStatus(torchEnabled ? 'Light is on. Aim at the PO/LPO line and tap Read PO.' : 'Light is off.');
    } catch (error) {
      torchEnabled = false;
      updateTorchButton(false);
      console.warn('[PO OCR] Torch not available:', error);
      setStatus('Light control is not supported on this phone/browser.');
    }
  }

  function getGuideCrop(video) {
    const guide = document.querySelector('.im-po-ocr-guide');
    const videoRect = video.getBoundingClientRect();
    const guideRect = guide ? guide.getBoundingClientRect() : null;

    if (!guideRect || !videoRect.width || !videoRect.height) {
      return {
        sx: 0,
        sy: 0,
        sw: video.videoWidth,
        sh: video.videoHeight
      };
    }

    const videoAspect = video.videoWidth / video.videoHeight;
    const elementAspect = videoRect.width / videoRect.height;
    let contentLeft = videoRect.left;
    let contentTop = videoRect.top;
    let contentWidth = videoRect.width;
    let contentHeight = videoRect.height;

    // Account for object-fit: contain letterboxing inside the video element.
    if (elementAspect > videoAspect) {
      contentWidth = videoRect.height * videoAspect;
      contentLeft = videoRect.left + (videoRect.width - contentWidth) / 2;
    } else if (elementAspect < videoAspect) {
      contentHeight = videoRect.width / videoAspect;
      contentTop = videoRect.top + (videoRect.height - contentHeight) / 2;
    }

    const ix1 = Math.max(guideRect.left, contentLeft);
    const iy1 = Math.max(guideRect.top, contentTop);
    const ix2 = Math.min(guideRect.right, contentLeft + contentWidth);
    const iy2 = Math.min(guideRect.bottom, contentTop + contentHeight);

    let rx = (ix1 - contentLeft) / contentWidth;
    let ry = (iy1 - contentTop) / contentHeight;
    let rw = (ix2 - ix1) / contentWidth;
    let rh = (iy2 - iy1) / contentHeight;

    if (!isFinite(rx) || !isFinite(ry) || !isFinite(rw) || !isFinite(rh) || rw <= 0 || rh <= 0) {
      rx = 0.18;
      ry = 0.43;
      rw = 0.64;
      rh = 0.14;
    }

    // Small margin helps when the user places text near the green border, but still keeps OCR focused.
    const marginX = rw * 0.025;
    const marginY = rh * 0.08;
    rx = Math.max(0, rx - marginX);
    ry = Math.max(0, ry - marginY);
    rw = Math.min(1 - rx, rw + marginX * 2);
    rh = Math.min(1 - ry, rh + marginY * 2);

    return {
      sx: Math.max(0, Math.round(rx * video.videoWidth)),
      sy: Math.max(0, Math.round(ry * video.videoHeight)),
      sw: Math.max(1, Math.round(rw * video.videoWidth)),
      sh: Math.max(1, Math.round(rh * video.videoHeight))
    };
  }

  function prepareCropForOcr(ctx, width, height) {
    const img = ctx.getImageData(0, 0, width, height);
    const data = img.data;
    for (let i = 0; i < data.length; i += 4) {
      const gray = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
      // Stronger contrast because the crop should contain only the target PO/vendor area.
      let value = gray;
      if (gray > 168) value = 255;
      else if (gray < 96) value = 0;
      else value = (gray - 96) * (255 / 72);
      data[i] = data[i + 1] = data[i + 2] = Math.max(0, Math.min(255, value));
    }
    ctx.putImageData(img, 0, 0);
  }

  async function readCurrentFrame() {
    if (isReading) return;
    const video = document.getElementById('im-po-ocr-video');
    const canvas = document.getElementById('im-po-ocr-canvas');
    if (!video || !canvas || !video.videoWidth || !video.videoHeight) {
      setStatus('Camera is not ready yet. Wait a moment and try again.');
      return;
    }

    try {
      setReadingUI(true);
      setStatus('Loading OCR reader...');
      const Tesseract = await loadTesseract();

      const crop = getGuideCrop(video);
      const maxWidth = 1100;
      const upscale = 2;
      const rawTargetWidth = Math.min(maxWidth, Math.max(420, Math.round(crop.sw * upscale)));
      const scale = rawTargetWidth / crop.sw;
      canvas.width = Math.max(1, Math.round(crop.sw * scale));
      canvas.height = Math.max(1, Math.round(crop.sh * scale));
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(video, crop.sx, crop.sy, crop.sw, crop.sh, 0, 0, canvas.width, canvas.height);

      // Improve contrast for the cropped green-box area only.
      try {
        prepareCropForOcr(ctx, canvas.width, canvas.height);
      } catch (contrastError) {
        console.warn('[PO OCR] Contrast step skipped:', contrastError);
      }

      setStatus('Reading text... hold on.');
      const result = await Tesseract.recognize(canvas, 'eng', {
        logger: (m) => {
          if (m && m.status === 'recognizing text' && typeof m.progress === 'number') {
            setStatus(`Reading text... ${Math.round(m.progress * 100)}%`);
          }
        }
      });

      const text = result && result.data && result.data.text ? result.data.text : '';
      const parsed = extractPoNumber(text);
      if (parsed.best) {
        pastePoNumber(parsed.best);
        showSuccess(parsed.best, parsed.candidates, parsed.kind);
      } else {
        showNoResult(parsed.candidates, text);
      }
    } catch (error) {
      console.error('[PO OCR] Read error:', error);
      setStatus('OCR failed. Check internet for OCR library loading, then try again.');
    } finally {
      setReadingUI(false);
    }
  }

  function normalizeText(text) {
    return String(text || '')
      .replace(/[|]/g, 'I')
      .replace(/[０-９]/g, d => String.fromCharCode(d.charCodeAt(0) - 0xFF10 + 48));
  }

  function extractPoNumber(rawText) {
    const text = normalizeText(rawText);
    const flatText = text.replace(/\s+/g, ' ').trim();
    const lines = text.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
    const candidates = [];

    function addCandidate(value, score, reason, kind) {
      const isText = kind === 'text';
      const cleaned = isText
        ? cleanVendorText(value)
        : String(value || '').replace(/\D/g, '');
      if (isText) {
        if (!cleaned || cleaned.length < 3) return;
      } else {
        if (!/^\d{3,8}$/.test(cleaned)) return;
      }
      const existing = candidates.find(item => item.value === cleaned);
      if (existing) {
        existing.score = Math.max(existing.score, score);
        if (!existing.reason.includes(reason)) existing.reason += ', ' + reason;
      } else {
        candidates.push({ value: cleaned, score, reason, kind: isText ? 'text' : 'number' });
      }
    }

    const labelRe = /\b(P\s*\.?\s*O\s*\.?\s*(NUMBER|NO|#)?|PURCHASE\s*ORDER|LPO)\b/i;
    const avoidRe = /\b(REQ\.?|REQUEST|DATE|TEL|PHONE|FAX|VAT|QTY|TOTAL|AMOUNT|PAGE|TRN)\b/i;

    lines.forEach((line, index) => {
      const hasLabel = labelRe.test(line);
      const hasAvoid = avoidRe.test(line);
      const numbers = line.match(/\b\d{3,8}\b/g) || [];

      if (hasLabel && numbers.length) {
        numbers.forEach(num => addCandidate(num, num.length === 5 ? 160 : 90, 'same crop line as PO/LPO label', 'number'));
      }

      if (hasLabel && !numbers.length && lines[index + 1]) {
        const nextNums = lines[index + 1].match(/\b\d{3,8}\b/g) || [];
        nextNums.forEach(num => addCandidate(num, num.length === 5 ? 140 : 80, 'line after PO/LPO label in crop', 'number'));
      }

      if (!hasAvoid) {
        numbers.forEach(num => {
          const score = num.length === 5 ? 120 : (num.length >= 4 && num.length <= 6 ? 45 : 15);
          addCandidate(num, score, 'number inside green crop', 'number');
        });
      }
    });

    const wholePatterns = [
      /(?:P\s*\.?\s*O\s*\.?\s*(?:NUMBER|NO|#)?|PURCHASE\s*ORDER|LPO)[^\d]{0,50}(\d{3,8})/ig,
      /(\d{3,8})[^\n]{0,50}(?:P\s*\.?\s*O\s*\.?\s*(?:NUMBER|NO|#)?|PURCHASE\s*ORDER|LPO)/ig
    ];
    wholePatterns.forEach(re => {
      let match;
      while ((match = re.exec(text)) !== null) {
        addCandidate(match[1], match[1].length === 5 ? 170 : 100, 'near PO/LPO label in crop', 'number');
      }
    });

    // If the green box contains only text and no useful 5-digit PO, use it as vendor/search text.
    const vendorText = cleanVendorText(flatText);
    const hasFiveDigit = candidates.some(item => item.kind === 'number' && /^\d{5}$/.test(item.value));
    if (!hasFiveDigit && vendorText) {
      addCandidate(vendorText, 70, 'text inside green crop', 'text');
    }

    const sorted = candidates
      .sort((a, b) => {
        const aFive = a.kind === 'number' && /^\d{5}$/.test(a.value) ? 1 : 0;
        const bFive = b.kind === 'number' && /^\d{5}$/.test(b.value) ? 1 : 0;
        if (aFive !== bFive) return bFive - aFive;
        if (a.kind !== b.kind) return a.kind === 'number' ? -1 : 1;
        return b.score - a.score || a.value.length - b.value.length;
      })
      .slice(0, 6);

    return {
      best: sorted.length ? sorted[0].value : '',
      kind: sorted.length ? sorted[0].kind : '',
      candidates: sorted.map(item => item.value)
    };
  }

  function cleanVendorText(value) {
    let text = String(value || '')
      .replace(/[^A-Za-z0-9&.,()\-\/ ]+/g, ' ')
      .replace(/\b(P\s*\.?\s*O\s*\.?|PO|NUMBER|NO|LPO|PURCHASE|ORDER|DATE|REQ\.?|REQUEST)\b/ig, ' ')
      .replace(/\b\d{1,4}\b/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    // Avoid pasting long messy OCR paragraphs into the search field.
    if (text.length > 60) text = text.slice(0, 60).trim();
    return text;
  }

  function pastePoNumber(value) {
    const recordsInput = document.getElementById('im-reporting-search');
    const mobileInlineInput = document.getElementById('im-mobile-inline-search-term');
    const mobileModalInput = document.getElementById('im-mobile-search-term');
    [recordsInput, mobileInlineInput, mobileModalInput].filter(Boolean).forEach(input => {
      input.value = value;
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
    });
    const focusTarget = mobileInlineInput || mobileModalInput || recordsInput;
    if (focusTarget) {
      focusTarget.focus({ preventScroll: true });
      try { focusTarget.setSelectionRange(value.length, value.length); } catch (_) {}
    }
  }

  function showSuccess(value, candidates, kind) {
    const searchBtn = document.getElementById('im-po-ocr-search-btn');
    const againBtn = document.getElementById('im-po-ocr-scan-again-btn');
    const readBtn = document.getElementById('im-po-ocr-read-btn');
    if (searchBtn) searchBtn.classList.remove('hidden');
    if (againBtn) againBtn.classList.remove('hidden');
    if (readBtn) readBtn.classList.add('hidden');

    const others = (candidates || []).filter(num => num !== value).slice(0, 4);
    const otherButtons = others.length
      ? `<div class="im-po-ocr-candidates">${others.map(num => `<button type="button" class="im-po-ocr-candidate-btn" data-po="${escapeHtml(num)}">Use ${escapeHtml(num)}</button>`).join('')}</div>`
      : '';

    const label = kind === 'text' ? 'Detected and pasted text/vendor' : 'Detected and pasted PO/LPO';
    setStatus(
      `${label}: <strong>${escapeHtml(value)}</strong>${otherButtons}<div class="im-po-ocr-small">OCR read only the green-box area. Tap Search to search Invoice Records, or Scan Again if it is wrong.</div>`,
      true
    );
    wireCandidateButtons();
  }

  function showNoResult(candidates, text) {
    const againBtn = document.getElementById('im-po-ocr-scan-again-btn');
    if (againBtn) againBtn.classList.remove('hidden');

    const unique = Array.from(new Set(candidates || [])).slice(0, 6);
    if (unique.length) {
      setStatus(
        `I could not confirm a PO/LPO label, but found possible numbers:<div class="im-po-ocr-candidates">${unique.map(num => `<button type="button" class="im-po-ocr-candidate-btn" data-po="${escapeHtml(num)}">Use ${escapeHtml(num)}</button>`).join('')}</div><div class="im-po-ocr-small">Use one, or scan again with only the target text/number inside the green box.</div>`,
        true
      );
      wireCandidateButtons();
      return;
    }

    console.log('[PO OCR] Raw OCR text:', text);
    setStatus('No PO/LPO number or readable text detected inside the green box. Move closer, improve lighting, and scan again.');
  }

  function wireCandidateButtons() {
    document.querySelectorAll('.im-po-ocr-candidate-btn').forEach(button => {
      button.addEventListener('click', () => {
        const value = button.getAttribute('data-po') || '';
        if (!value) return;
        pastePoNumber(value);
        showSuccess(value, []);
      });
    });
  }

  function escapeHtml(value) {
    return String(value || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }



  function showOcrToast(message) {
    let toast = document.getElementById('im-po-ocr-toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'im-po-ocr-toast';
      document.body.appendChild(toast);
    }
    toast.textContent = message;
    clearTimeout(showOcrToast._timer);
    showOcrToast._timer = setTimeout(() => {
      if (toast && toast.parentNode) toast.parentNode.removeChild(toast);
    }, 2800);
  }

  function chooseSearchValueFromText(rawText) {
    const text = String(rawText || '').trim();
    if (!text) return '';
    const parsed = extractPoNumber(text);
    if (parsed && parsed.best) return parsed.best;

    // Extra simple fallback for Google Lens/copied text: prefer any standalone 5-digit PO first.
    const five = text.match(/\b\d{5}\b/);
    if (five) return five[0];

    return cleanVendorText(text);
  }

  async function pasteScannedTextFromClipboard() {
    injectStyles();
    let text = '';

    try {
      if (navigator.clipboard && navigator.clipboard.readText) {
        text = await navigator.clipboard.readText();
      }
    } catch (error) {
      console.warn('[PO OCR] Clipboard read failed:', error);
    }

    if (!String(text || '').trim()) {
      // Fallback for browsers that block direct clipboard read.
      const manual = window.prompt('Paste the text/number copied from Google Lens here:');
      text = manual || '';
    }

    const value = chooseSearchValueFromText(text);
    if (!value) {
      showOcrToast('No PO number or vendor text found in copied text.');
      return;
    }

    pastePoNumber(value);
    showOcrToast(`Pasted: ${value}`);
  }

  function bindScanButton(button) {
    if (!button || button.dataset.ocrBound === '1') return;
    button.dataset.ocrBound = '1';
    button.addEventListener('click', openModal);
  }

  function makeScanButton(id, compact) {
    const button = document.createElement('button');
    button.id = id;
    button.type = 'button';
    button.title = 'Scan printed PO/LPO number with camera OCR';
    button.innerHTML = compact
      ? '<i class="fa-solid fa-camera"></i> Scan'
      : '<i class="fa-solid fa-camera"></i> Scan PO Text';
    bindScanButton(button);
    return button;
  }


  function bindPasteButton(button) {
    if (!button || button.dataset.ocrPasteBound === '1') return;
    button.dataset.ocrPasteBound = '1';
    button.addEventListener('click', pasteScannedTextFromClipboard);
  }

  function makePasteButton(id, compact) {
    const button = document.createElement('button');
    button.id = id;
    button.type = 'button';
    button.title = 'Paste text copied from Google Lens or Android text scan';
    button.innerHTML = compact
      ? '<i class="fa-solid fa-paste"></i> Paste'
      : '<i class="fa-solid fa-paste"></i> Paste Scanned Text';
    bindPasteButton(button);
    return button;
  }

  function insertButton() {
    // Correct location: Invoice Records mobile search card, under the PO/Vendor search field.
    // This is intentionally not placed in Invoice Entry.
    bindScanButton(document.getElementById(BUTTON_ID));
    bindPasteButton(document.getElementById(PASTE_BUTTON_ID));
    if (!document.getElementById(BUTTON_ID)) {
      const recordsInput = document.getElementById('im-reporting-search');
      if (recordsInput) {
        const searchBox = recordsInput.closest('.search-box') || recordsInput.parentNode;
        if (searchBox) {
          const button = makeScanButton(BUTTON_ID, false);
          button.classList.add('im-records-mobile-ocr-btn');
          searchBox.insertAdjacentElement('afterend', button);
        }
      }
    }
    if (!document.getElementById(PASTE_BUTTON_ID)) {
      const recordsInput = document.getElementById('im-reporting-search');
      if (recordsInput) {
        const searchBox = recordsInput.closest('.search-box') || recordsInput.parentNode;
        const anchor = document.getElementById(BUTTON_ID) || searchBox;
        if (anchor) {
          const pasteButton = makePasteButton(PASTE_BUTTON_ID, false);
          pasteButton.classList.add('im-records-mobile-paste-btn');
          anchor.insertAdjacentElement('afterend', pasteButton);
        }
      }
    }

    // Correct visible mobile location: Invoice Records inline mobile search card.
    bindScanButton(document.getElementById(BUTTON_INLINE_ID));
    bindPasteButton(document.getElementById(PASTE_INLINE_ID));
    if (!document.getElementById(BUTTON_INLINE_ID)) {
      const inlineTerm = document.getElementById('im-mobile-inline-search-term');
      if (inlineTerm) {
        const group = inlineTerm.closest('.form-group') || inlineTerm.parentNode;
        if (group) {
          const button = makeScanButton(BUTTON_INLINE_ID, false);
          button.classList.add('im-records-mobile-ocr-btn', 'im-mobile-inline-scan-btn');
          group.appendChild(button);
        }
      }
    }
    if (!document.getElementById(PASTE_INLINE_ID)) {
      const inlineTerm = document.getElementById('im-mobile-inline-search-term');
      if (inlineTerm) {
        const group = inlineTerm.closest('.form-group') || inlineTerm.parentNode;
        if (group) {
          const pasteButton = makePasteButton(PASTE_INLINE_ID, false);
          pasteButton.classList.add('im-records-mobile-paste-btn', 'im-mobile-inline-paste-btn');
          group.appendChild(pasteButton);
        }
      }
    }

    // If the older Invoice Records mobile search modal is opened, support it too.
    bindScanButton(document.getElementById(BUTTON_BOTTOM_ID));
    bindPasteButton(document.getElementById(PASTE_BOTTOM_ID));
    if (!document.getElementById(BUTTON_BOTTOM_ID)) {
      const mobileTerm = document.getElementById('im-mobile-search-term');
      if (mobileTerm) {
        const group = mobileTerm.closest('.form-group') || mobileTerm.parentNode;
        if (group) {
          const button = makeScanButton(BUTTON_BOTTOM_ID, true);
          button.classList.add('im-records-mobile-ocr-btn');
          group.appendChild(button);
        }
      }
    }
    if (!document.getElementById(PASTE_BOTTOM_ID)) {
      const mobileTerm = document.getElementById('im-mobile-search-term');
      if (mobileTerm) {
        const group = mobileTerm.closest('.form-group') || mobileTerm.parentNode;
        if (group) {
          const pasteButton = makePasteButton(PASTE_BOTTOM_ID, true);
          pasteButton.classList.add('im-records-mobile-paste-btn');
          group.appendChild(pasteButton);
        }
      }
    }
  }

  function initInvoicePoOcr() {
    injectStyles();
    insertButton();
    setTimeout(insertButton, 300);
    setTimeout(insertButton, 1000);
    document.addEventListener('click', (event) => {
      const target = event.target && event.target.closest ? event.target.closest('[data-section="im-reporting"], #im-nav-reporting-link-mobile, .wd-nav-im-reporting-mobile a, .im-nav-reporting a') : null;
      if (target) setTimeout(insertButton, 150);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initInvoicePoOcr);
  } else {
    initInvoicePoOcr();
  }

  window.openIMPoOcrScanner = openModal;
  window.pasteIMScannedText = pasteScannedTextFromClipboard;
  window.initInvoicePoOcr = initInvoicePoOcr;
})();
