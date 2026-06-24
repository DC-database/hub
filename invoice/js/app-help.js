// =================================================================================================
// js/app-help.js
// v7.9.6 — Help Center extracted from app.js.
// Purpose: Help tabs, knowledge base loading/search, FAQ/guide/button admin tools, PDF publish/index, event wiring.
// No feature or Firebase path changes.
// =================================================================================================

// =================================================================================================
// #region BLOCK 31 — IM HELP CENTER
// Purpose: Help tabs, knowledge base loading/search, FAQ/guide/button admin tools, PDF publish/index, event wiring.
// =================================================================================================

// =============================================================
// IM HELP CENTER (Intelligent Assistant + Growing Knowledge Base)
// =============================================================

// Help Center DOM (Tabs)
const imHelpTabButtons = Array.from(document.querySelectorAll('#im-help .im-help-tab-btn'));
const imHelpTabPanels = {
    ask: document.getElementById('im-help-tab-ask'),
    guides: document.getElementById('im-help-tab-guides'),
    faqs: document.getElementById('im-help-tab-faqs'),
    admin: document.getElementById('im-help-tab-admin'),
};
const imHelpAdminTabBtn = document.getElementById('im-help-admin-tab-btn');
const imHelpBackbar = document.getElementById('im-help-backbar');
const imHelpBackBtn = document.getElementById('im-help-back-btn');

// Ask tab
const imHelpSearchInput = document.getElementById('im-help-search-input');
const imHelpSearchBtn = document.getElementById('im-help-search-btn');
const imHelpClearBtn = document.getElementById('im-help-clear-btn');
const imHelpMeta = document.getElementById('im-help-meta');
const imHelpResults = document.getElementById('im-help-results');

// Guides tab
const imHelpGuidesList = document.getElementById('im-help-guides-list');

// FAQs tab
const imHelpFaqSearchInput = document.getElementById('im-help-faq-search-input');
const imHelpFaqSearchBtn = document.getElementById('im-help-faq-search-btn');
const imHelpFaqClearBtn = document.getElementById('im-help-faq-clear-btn');
const imHelpFaqsList = document.getElementById('im-help-faqs-list');

// Admin tab
const imHelpAdmin = document.getElementById('im-help-admin');
const imHelpAdminStatus = document.getElementById('im-help-admin-status');
const imHelpInitBtn = document.getElementById('im-help-init-btn');
const imHelpAdminRefreshBtn = document.getElementById('im-help-admin-refresh-btn');

const imHelpUnansweredList = document.getElementById('im-help-unanswered-list');
const imHelpAdminQ = document.getElementById('im-help-admin-q');
const imHelpAdminA = document.getElementById('im-help-admin-a');
const imHelpAdminModule = document.getElementById('im-help-admin-module');
const imHelpAdminPageRefs = document.getElementById('im-help-admin-pagerefs');
const imHelpAdminPublishBtn = document.getElementById('im-help-admin-publish-btn');
const imHelpAdminClearFormBtn = document.getElementById('im-help-admin-clear-form-btn');
const imHelpAdminFaqs = document.getElementById('im-help-admin-faqs');

// Guides admin
const imHelpGuideTitle = document.getElementById('im-help-guide-title');
const imHelpGuideModule = document.getElementById('im-help-guide-module');
const imHelpGuideBody = document.getElementById('im-help-guide-body');
const imHelpGuideSaveBtn = document.getElementById('im-help-guide-save-btn');
const imHelpGuideClearBtn = document.getElementById('im-help-guide-clear-btn');
const imHelpAdminGuides = document.getElementById('im-help-admin-guides');

// Guides bulk import
const imHelpGuidesImportInput = document.getElementById('im-help-guides-import');
const imHelpGuidesImportBtn = document.getElementById('im-help-guides-import-btn');
const imHelpGuidesReplaceChk = document.getElementById('im-help-guides-replace');


// Buttons admin
const imHelpBtnLabel = document.getElementById('im-help-btn-label');
const imHelpBtnModule = document.getElementById('im-help-btn-module');
const imHelpBtnDesc = document.getElementById('im-help-btn-desc');
const imHelpBtnKeywords = document.getElementById('im-help-btn-keywords');
const imHelpBtnSaveBtn = document.getElementById('im-help-btn-save-btn');
const imHelpBtnClearBtn = document.getElementById('im-help-btn-clear-btn');
const imHelpAdminButtons = document.getElementById('im-help-admin-buttons');

// PDF guide publish (existing)
const imHelpUploadInput = document.getElementById('im-help-upload');
const imHelpUploadBtn = document.getElementById('im-help-upload-btn');
const imHelpUploadStatus = document.getElementById('im-help-upload-status');
const imHelpRefreshBtn = document.getElementById('im-help-refresh-btn');
const imHelpGuideLink = document.getElementById('im-help-guide-link');

// Help Center state
let imHelpCurrent = null;      // { version, guideUrl, updatedAt, updatedBy }
let imHelpPages = [];          // [{ page, text }]
let imHelpFuse = null;         // PDF page search

let imHelpFaqs = [];           // [{ id, question, answer, module, pageRefs, updatedAt, updatedBy }]
let imHelpGuides = [];         // [{ id, title, body, module, updatedAt, updatedBy }]
let imHelpButtons = [];        // [{ id, label, description, module, keywords, updatedAt, updatedBy }]

let imHelpFaqFuse = null;
let imHelpGuideFuse = null;
let imHelpButtonFuse = null;

let imHelpKbLoaded = false;
let imHelpLastQuery = '';
let imHelpLastBest = null;
let imHelpSelectedUnansweredId = null;
let imHelpEditingFaqId = null; // when Super Admin edits an existing FAQ

// Help Center context control:
// - Origin "invoice" shows Admin tab for Super Admin.
// - Origin "workdesk" / "inventory" hides Admin tab and shows a Back button.
window.__imHelpOrigin = window.__imHelpOrigin || 'invoice';
window.__imHelpReturnTo = window.__imHelpReturnTo || null; // 'workdesk' | 'inventory' | null
window.__imHelpReturnSection = window.__imHelpReturnSection || null;

function imHelpGetWorkdeskActiveSectionId() {
    try {
        const active = document.querySelector('#workdesk-view a.active[data-section]');
        return active ? active.getAttribute('data-section') : null;
    } catch (_) {
        return null;
    }
}

function imHelpApplyContextUI() {
    const origin = (window.__imHelpOrigin || 'invoice');
    const returnTo = window.__imHelpReturnTo || null;

    // Back button visibility
    if (imHelpBackbar) {
        imHelpBackbar.classList.toggle('hidden', !returnTo);
    }
    if (imHelpBackBtn) {
        let label = 'Back';
        if (returnTo === 'workdesk') label = 'Back to WorkDesk';
        if (returnTo === 'inventory') label = 'Back to Inventory';
        imHelpBackBtn.innerHTML = `<i class="fa-solid fa-arrow-left"></i> ${label}`;
    }

    // Admin visibility is handled in imHelpUpdateAdminUI()
    imHelpUpdateAdminUI();
}

function imHelpSetContext(origin, returnTo, returnSection) {
    window.__imHelpOrigin = origin || 'invoice';
    window.__imHelpReturnTo = returnTo || null;
    window.__imHelpReturnSection = returnSection || null;
    imHelpApplyContextUI();
}

async function imHelpOnOpen() {
    // Ensure UI reflects current context (back button + admin visibility)
    imHelpApplyContextUI();
    await imHelpLoadKnowledgeBase(false);
    imHelpRenderGuidesList(imHelpGuides);
    imHelpRenderFaqsList(imHelpFaqs);
    imHelpSelectTab('ask');
}

async function imHelpOpenStandalone() {
    // Open Help without requiring Invoice Management access.
    // This is used from WorkDesk / Inventory.
    if (!currentApprover) {
        alert('Please login first.');
        return;
    }

    // Mark as standalone and hide IM nav to avoid confusion.
    window.__imHelpStandalone = true;
    if (imNav) imNav.classList.add('hidden');

    // Populate the IM header user fields (so Help still shows who is logged in)
    if (imUsername) imUsername.textContent = currentApprover.Name || 'User';
    if (imUserIdentifier) imUserIdentifier.textContent = currentApprover.Email || currentApprover.Mobile;

    // Show Help section directly
    showView('invoice-management');
    showIMSection('im-help');

    setTimeout(() => { imHelpOnOpen(); }, 0);
}

function imHelpIsSuperAdminUser() {
    try {
        return ((currentApprover?.Name || '').trim().toLowerCase() === SUPER_ADMIN_NAME.toLowerCase());
    } catch (_) {
        return false;
    }
}

function imHelpSetStatus(html) {
    if (!imHelpUploadStatus) return;
    imHelpUploadStatus.innerHTML = html || '';
}

function imHelpAdminSetStatus(html) {
    if (!imHelpAdminStatus) return;
    imHelpAdminStatus.innerHTML = html || '';
}

function imHelpEscapeHtml(str) {
    return String(str || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function imHelpBuildExcerpt(text, query, maxLen = 520) {
    const t = String(text || '').replace(/\s+/g, ' ').trim();
    if (!t) return '';
    const q = String(query || '').trim();
    if (!q) return t.slice(0, maxLen) + (t.length > maxLen ? '…' : '');

    const words = q.split(/\s+/).filter(w => w.length >= 3).slice(0, 4);
    let idx = -1;
    for (const w of words) {
        idx = t.toLowerCase().indexOf(w.toLowerCase());
        if (idx !== -1) break;
    }
    if (idx === -1) idx = 0;

    const start = Math.max(0, idx - Math.floor(maxLen * 0.25));
    const end = Math.min(t.length, start + maxLen);
    const prefix = start > 0 ? '…' : '';
    const suffix = end < t.length ? '…' : '';
    return prefix + t.slice(start, end) + suffix;
}

function imHelpFormatModuleBadge(module) {
    const m = (module || '').trim() || 'General';
    return `<span class="im-help-badge">${imHelpEscapeHtml(m)}</span>`;
}

function imHelpSelectTab(tabName) {
    const t = String(tabName || 'ask');
    for (const btn of imHelpTabButtons) {
        const isActive = btn.getAttribute('data-im-help-tab') === t;
        btn.classList.toggle('active', isActive);
    }
    for (const key in imHelpTabPanels) {
        const el = imHelpTabPanels[key];
        if (!el) continue;
        el.classList.toggle('hidden', key !== t);
    }

    // Lazy render for browse tabs
    if (t === 'guides') {
        imHelpRenderGuidesList(imHelpGuides);
    } else if (t === 'faqs') {
        imHelpRenderFaqsList(imHelpFaqs);
    } else if (t === 'admin') {
        imHelpUpdateAdminUI();
        imHelpAdminRefreshAll(false);
    }
}

function imHelpUpdateAdminUI() {
    const origin = (window.__imHelpOrigin || 'invoice');
    const allowAdmin = imHelpIsSuperAdminUser() && origin === 'invoice';

    if (imHelpAdminTabBtn) {
        imHelpAdminTabBtn.classList.toggle('hidden', !allowAdmin);
    }
    if (imHelpAdmin) {
        imHelpAdmin.classList.toggle('hidden', !allowAdmin);
    }

    // If user landed on Help from WorkDesk/Inventory, force away from Admin tab.
    if (!allowAdmin) {
        try {
            const activeBtn = document.querySelector('#im-help .im-help-tab-btn.active');
            if (activeBtn && activeBtn.getAttribute('data-im-help-tab') === 'admin') {
                imHelpSelectTab('ask');
            }
        } catch (_) {}
    }
}

function imHelpOpenImSection(sectionId) {
    try {
        const link = document.querySelector(`a[data-section="${sectionId}"]`);
        if (link) link.click();
    } catch (_) {}
}

function imHelpRenderMeta() {
    if (!imHelpMeta) return;
    if (!imHelpCurrent || !imHelpCurrent.version) {
        imHelpMeta.style.display = 'none';
        return;
    }
    const parts = [];
    parts.push(`<i class="fa-solid fa-book"></i> <strong>Guide:</strong> ${imHelpEscapeHtml(imHelpCurrent.version)}`);
    if (imHelpCurrent.updatedBy) {
        parts.push(`&nbsp;•&nbsp; <strong>Published by:</strong> ${imHelpEscapeHtml(imHelpCurrent.updatedBy)}`);
    }
    if (imHelpCurrent.updatedAt) {
        const d = new Date(imHelpCurrent.updatedAt);
        if (!isNaN(d.getTime())) parts.push(`&nbsp;•&nbsp; <strong>Updated:</strong> ${d.toLocaleString()}`);
    }
    imHelpMeta.innerHTML = parts.join('');
    imHelpMeta.style.display = 'block';

    if (imHelpGuideLink) {
        if (imHelpCurrent.guideUrl) {
            imHelpGuideLink.href = imHelpCurrent.guideUrl;
            imHelpGuideLink.style.display = 'inline-block';
        } else {
            imHelpGuideLink.style.display = 'none';
        }
    }
}

function imHelpScoreToPct(score) {
    if (typeof score !== 'number') return null;
    const pct = Math.max(0, Math.min(100, Math.round((1 - score) * 100)));
    return pct;
}

function imHelpRenderAskResults(query, best, related) {
    if (!imHelpResults) return;
    const q = String(query || '').trim();
    imHelpLastQuery = q;
    imHelpLastBest = best || null;

    // No KB loaded
    if (!imHelpFuse && !imHelpFaqFuse && !imHelpGuideFuse && !imHelpButtonFuse) {
        imHelpResults.innerHTML = '<div class="im-help-card"><p class="im-help-snippet">Help is not initialized yet. Ask Super Admin to publish templates or a guide.</p></div>';
        return;
    }

    let html = '';

    // Suggested answer
    if (best) {
        const badge = best.badgeHtml || '';
        const title = best.title || 'Suggested answer';
        const body = best.bodyHtml || '';
        const actions = (best.actionsHtml || '') + `
          <button type="button" class="secondary-btn" data-im-help-need-help="1"><i class="fa-solid fa-life-ring"></i> Still need help</button>
        `;

        html += `
          <div class="im-help-card">
            <div class="im-help-title">
              <h3>${imHelpEscapeHtml(title)}</h3>
              ${badge}
            </div>
            <p class="im-help-snippet">${body}</p>
            <div class="im-help-actions">${actions}</div>
          </div>
        `;
    } else {
        html += `
          <div class="im-help-card">
            <div class="im-help-title">
              <h3>No confident match</h3>
              <span class="im-help-badge">Logged for Admin</span>
            </div>
            <p class="im-help-snippet">I couldn’t find a clear answer yet. Click “Still need help” to send this question to Super Admin so it becomes an FAQ next time.</p>
            <div class="im-help-actions">
              <button type="button" class="secondary-btn" data-im-help-need-help="1"><i class="fa-solid fa-life-ring"></i> Still need help</button>
            </div>
          </div>
        `;
    }

    // Related results
    const rel = Array.isArray(related) ? related : [];
    if (rel.length > 0) {
        const relCards = rel.map((r, i) => {
            const badge = r.badgeHtml || '';
            const body = r.bodyHtml || '';
            const actions = r.actionsHtml || '';
            return `
              <div class="im-help-card">
                <div class="im-help-title">
                  <h3>${imHelpEscapeHtml(r.title || `Related ${i+1}`)}</h3>
                  ${badge}
                </div>
                <p class="im-help-snippet">${body}</p>
                ${actions ? `<div class="im-help-actions">${actions}</div>` : ''}
              </div>
            `;
        }).join('');
        html += `
          <div class="im-help-card" style="background:#f8fafc;">
            <div class="im-help-title"><h3>Related</h3><span class="im-help-badge">More matches</span></div>
            <p class="im-help-snippet">Here are other close matches you can open:</p>
          </div>
          ${relCards}
        `;
    }

    imHelpResults.innerHTML = html;
}

function imHelpMakeResultFromFaq(faq, q, score) {
    const pageRefs = Array.isArray(faq.pageRefs) ? faq.pageRefs.filter(n => Number(n) > 0) : [];
    const pageActions = (imHelpCurrent && imHelpCurrent.guideUrl && pageRefs.length)
        ? pageRefs.map(p => `<a class="secondary-btn" href="${imHelpEscapeHtml(imHelpCurrent.guideUrl)}#page=${Number(p)}" target="_blank" rel="noopener"><i class="fa-solid fa-file-pdf"></i> Open page ${Number(p)}</a>`).join('')
        : '';

    return {
        type: 'faq',
        id: faq.id,
        score: score,
        title: 'Answer',
        badgeHtml: `${imHelpFormatModuleBadge(faq.module)}${typeof score === 'number' ? `<span class="im-help-badge">Relevance ${imHelpScoreToPct(score)}%</span>` : ''}`,
        bodyHtml: `${imHelpEscapeHtml(String(faq.answer || '').trim() || 'No answer text.')}`,
        actionsHtml: `
          <button type="button" class="secondary-btn" data-im-open-section="im-help"><i class="fa-solid fa-circle-question"></i> Help</button>
          ${pageActions}
        `,
    };
}

function imHelpMakeResultFromGuide(g, q, score) {
    const excerpt = imHelpBuildExcerpt(g.body || '', q, 520);
    return {
        type: 'guide',
        id: g.id,
        score,
        title: g.title || 'Guide',
        badgeHtml: `${imHelpFormatModuleBadge(g.module)}${typeof score === 'number' ? `<span class="im-help-badge">Relevance ${imHelpScoreToPct(score)}%</span>` : ''}`,
        bodyHtml: `${imHelpEscapeHtml(excerpt)}`,
        actionsHtml: `
          <button type="button" class="secondary-btn" data-im-help-view-guide="${imHelpEscapeHtml(g.id)}"><i class="fa-solid fa-book"></i> View guide</button>
        `,
    };
}

function imHelpMakeResultFromButton(b, q, score) {
    const keywords = (b.keywords || '').trim();
    const kwLine = keywords ? `\n\nKeywords: ${keywords}` : '';
    return {
        type: 'button',
        id: b.id,
        score,
        title: `Button: ${b.label || 'Action'}`,
        badgeHtml: `${imHelpFormatModuleBadge(b.module)}${typeof score === 'number' ? `<span class="im-help-badge">Relevance ${imHelpScoreToPct(score)}%</span>` : ''}`,
        bodyHtml: `${imHelpEscapeHtml(String(b.description || '').trim() || 'No description.')}${imHelpEscapeHtml(kwLine)}`,
        actionsHtml: '',
    };
}

function imHelpMakeResultFromPdfPage(pageItem, q, score) {
    const page = pageItem.page;
    const snippet = imHelpBuildExcerpt(pageItem.text, q);
    return {
        type: 'pdf',
        id: String(page),
        score,
        title: `Guide match (Page ${page})`,
        badgeHtml: `<span class="im-help-badge">PDF • Page ${page}${typeof score === 'number' ? ` • Relevance ${imHelpScoreToPct(score)}%` : ''}</span>`,
        bodyHtml: `${imHelpEscapeHtml(snippet)}`,
        actionsHtml: (imHelpCurrent && imHelpCurrent.guideUrl)
            ? `<a class="secondary-btn" href="${imHelpEscapeHtml(imHelpCurrent.guideUrl)}#page=${page}" target="_blank" rel="noopener"><i class="fa-solid fa-file-pdf"></i> Open page ${page}</a>`
            : '',
    };
}

async function imHelpLoadPdfIndex(force = false) {
    if (imHelpFuse && !force) return;
    imHelpFuse = null;
    imHelpPages = [];
    imHelpCurrent = null;

    try {
        const currentSnap = await invoiceDb.ref('helpCenter/current').once('value');
        imHelpCurrent = currentSnap.val();

        if (!imHelpCurrent || !imHelpCurrent.version) {
            imHelpRenderMeta();
            return;
        }

        const ver = imHelpCurrent.version;
        const pagesSnap = await invoiceDb.ref(`helpCenter/versions/${ver}/pages`).once('value');
        const pagesObj = pagesSnap.val() || {};
        imHelpPages = Object.keys(pagesObj)
            .map(k => ({ page: Number(k), text: pagesObj[k]?.text || '' }))
            .filter(p => p.page > 0 && p.text)
            .sort((a, b) => a.page - b.page);

        if (window.Fuse && imHelpPages.length > 0) {
            imHelpFuse = new Fuse(imHelpPages, {
                keys: ['text'],
                includeScore: true,
                threshold: 0.35,
                ignoreLocation: true,
                minMatchCharLength: 2,
            });
        }

        imHelpRenderMeta();
    } catch (err) {
        console.error('Help Center: load pdf index error', err);
    }
}

async function imHelpLoadFaqs() {
    const snap = await invoiceDb.ref('helpCenter/faqs').once('value');
    const obj = snap.val() || {};
    imHelpFaqs = Object.keys(obj).map(id => {
        const it = obj[id] || {};
        return {
            id,
            question: String(it.question || '').trim(),
            answer: String(it.answer || '').trim(),
            module: String(it.module || 'General').trim(),
            pageRefs: Array.isArray(it.pageRefs) ? it.pageRefs : (typeof it.pageRefs === 'string' ? String(it.pageRefs).split(',').map(s => Number(s.trim())).filter(n => n) : []),
            updatedAt: it.updatedAt || 0,
            updatedBy: String(it.updatedBy || '').trim(),
        };
    }).filter(x => x.question || x.answer);

    if (window.Fuse && imHelpFaqs.length > 0) {
        imHelpFaqFuse = new Fuse(imHelpFaqs, {
            keys: [
                { name: 'question', weight: 0.65 },
                { name: 'answer', weight: 0.35 },
                { name: 'module', weight: 0.15 },
            ],
            includeScore: true,
            threshold: 0.35,
            ignoreLocation: true,
            minMatchCharLength: 2,
        });
    } else {
        imHelpFaqFuse = null;
    }
}

async function imHelpLoadGuides() {
    const snap = await invoiceDb.ref('helpCenter/systemGuides').once('value');
    const obj = snap.val() || {};
    imHelpGuides = Object.keys(obj).map(id => {
        const it = obj[id] || {};
        return {
            id,
            title: String(it.title || '').trim(),
            body: String(it.body || '').trim(),
            module: String(it.module || 'General').trim(),
            updatedAt: it.updatedAt || 0,
            updatedBy: String(it.updatedBy || '').trim(),
        };
    }).filter(x => x.title || x.body);

    if (window.Fuse && imHelpGuides.length > 0) {
        imHelpGuideFuse = new Fuse(imHelpGuides, {
            keys: [
                { name: 'title', weight: 0.5 },
                { name: 'body', weight: 0.5 },
                { name: 'module', weight: 0.15 },
            ],
            includeScore: true,
            threshold: 0.35,
            ignoreLocation: true,
            minMatchCharLength: 2,
        });
    } else {
        imHelpGuideFuse = null;
    }
}

async function imHelpLoadButtons() {
    const snap = await invoiceDb.ref('helpCenter/buttons').once('value');
    const obj = snap.val() || {};
    imHelpButtons = Object.keys(obj).map(id => {
        const it = obj[id] || {};
        return {
            id,
            label: String(it.label || '').trim(),
            description: String(it.description || '').trim(),
            module: String(it.module || 'General').trim(),
            keywords: String(it.keywords || '').trim(),
            updatedAt: it.updatedAt || 0,
            updatedBy: String(it.updatedBy || '').trim(),
        };
    }).filter(x => x.label || x.description);

    if (window.Fuse && imHelpButtons.length > 0) {
        imHelpButtonFuse = new Fuse(imHelpButtons, {
            keys: [
                { name: 'label', weight: 0.55 },
                { name: 'description', weight: 0.45 },
                { name: 'keywords', weight: 0.35 },
                { name: 'module', weight: 0.15 },
            ],
            includeScore: true,
            threshold: 0.35,
            ignoreLocation: true,
            minMatchCharLength: 2,
        });
    } else {
        imHelpButtonFuse = null;
    }
}

async function imHelpLoadKnowledgeBase(force = false) {
    if (imHelpKbLoaded && !force) return;
    await imHelpLoadPdfIndex(force);
    await Promise.allSettled([
        imHelpLoadFaqs(),
        imHelpLoadGuides(),
        imHelpLoadButtons(),
    ]);
    imHelpKbLoaded = true;
}

function imHelpPickBestResult(q) {
    const query = String(q || '').trim();
    const candidates = [];

    try {
        if (imHelpFaqFuse) {
            const r = imHelpFaqFuse.search(query).slice(0, 2);
            r.forEach(x => candidates.push(imHelpMakeResultFromFaq(x.item, query, x.score)));
        }
    } catch (_) {}

    try {
        if (imHelpGuideFuse) {
            const r = imHelpGuideFuse.search(query).slice(0, 2);
            r.forEach(x => candidates.push(imHelpMakeResultFromGuide(x.item, query, x.score)));
        }
    } catch (_) {}

    try {
        if (imHelpButtonFuse) {
            const r = imHelpButtonFuse.search(query).slice(0, 2);
            r.forEach(x => candidates.push(imHelpMakeResultFromButton(x.item, query, x.score)));
        }
    } catch (_) {}

    try {
        if (imHelpFuse) {
            const r = imHelpFuse.search(query).slice(0, 3);
            r.forEach(x => candidates.push(imHelpMakeResultFromPdfPage(x.item, query, x.score)));
        }
    } catch (_) {}

    if (candidates.length === 0) return { best: null, related: [] };

    // Prefer FAQ/Guide/Button over raw PDF when close.
    const prefOrder = { faq: 0, guide: 1, button: 2, pdf: 3 };
    candidates.sort((a, b) => {
        const sa = typeof a.score === 'number' ? a.score : 1;
        const sb = typeof b.score === 'number' ? b.score : 1;
        const pa = prefOrder[a.type] ?? 9;
        const pb = prefOrder[b.type] ?? 9;
        // primary: score
        if (Math.abs(sa - sb) > 0.05) return sa - sb;
        // tie-break: type priority
        if (pa != pb) return pa - pb;
        return sa - sb;
    });

    const best = candidates[0];
    const related = candidates.slice(1, 4);

    // Confidence: if everything is weak, return no best (forces logging)
    const bestScore = typeof best.score === 'number' ? best.score : 1;
    if (bestScore > 0.42) {
        return { best: null, related: related };
    }

    return { best, related };
}

async function imHelpLogNeedHelp(q) {
    const query = String(q || '').trim();
    if (!query) return;

    const payload = {
        q: query,
        askedAt: Date.now(),
        askedBy: (currentApprover?.Name || '').trim() || 'Unknown',
        bestType: imHelpLastBest?.type || null,
        bestId: imHelpLastBest?.id || null,
        status: 'open',
    };

    await invoiceDb.ref('helpCenter/unanswered').push(payload);
}

async function imHelpAsk(query) {
    const q = String(query || '').trim();
    if (!q) return;

    if (imHelpResults) {
        imHelpResults.innerHTML = '<div class="im-help-card"><p class="im-help-snippet">Thinking…</p></div>';
    }

    // Log all questions (analytics)
    try {
        invoiceDb.ref('helpCenter/questions').push({
            q: q,
            askedAt: Date.now(),
            askedBy: (currentApprover?.Name || '').trim() || 'Unknown',
        });
    } catch (_) {}

    await imHelpLoadKnowledgeBase(false);

    const { best, related } = imHelpPickBestResult(q);
    imHelpRenderMeta();
    imHelpRenderAskResults(q, best, related);
}

function imHelpClearAsk() {
    if (imHelpSearchInput) imHelpSearchInput.value = '';
    if (imHelpResults) imHelpResults.innerHTML = '';
}

function imHelpRenderGuidesList(guides) {
    if (!imHelpGuidesList) return;
    const list = Array.isArray(guides) ? guides : [];
    if (!list.length) {
        imHelpGuidesList.innerHTML = '<div class="im-help-card"><p class="im-help-snippet">No guides published yet. Super Admin can click “Initialize Templates” or add guides in the Admin tab.</p></div>';
        return;
    }

    const cards = list
        .slice()
        .sort((a, b) => String(a.module).localeCompare(String(b.module)) || String(a.title).localeCompare(String(b.title)))
        .map(g => {
            const excerpt = imHelpBuildExcerpt(g.body || '', '', 360);
            return `
              <div class="im-help-card">
                <div class="im-help-title">
                  <h3>${imHelpEscapeHtml(g.title || 'Guide')}</h3>
                  ${imHelpFormatModuleBadge(g.module)}
                </div>
                <p class="im-help-snippet">${imHelpEscapeHtml(excerpt)}</p>
                <div class="im-help-actions">
                  <button type="button" class="secondary-btn" data-im-help-view-guide="${imHelpEscapeHtml(g.id)}"><i class="fa-solid fa-book"></i> View</button>
                </div>
              </div>
            `;
        }).join('');

    imHelpGuidesList.innerHTML = cards;
}

function imHelpRenderFaqsList(faqs) {
    if (!imHelpFaqsList) return;
    const list = Array.isArray(faqs) ? faqs : [];
    if (!list.length) {
        imHelpFaqsList.innerHTML = '<div class="im-help-card"><p class="im-help-snippet">No FAQs published yet. Super Admin can add answers in the Admin tab.</p></div>';
        return;
    }

    const cards = list
        .slice()
        .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0))
        .slice(0, 50)
        .map(f => {
            const ans = imHelpBuildExcerpt(f.answer || '', '', 360);
            return `
              <div class="im-help-card">
                <div class="im-help-title">
                  <h3>${imHelpEscapeHtml(f.question || 'FAQ')}</h3>
                  ${imHelpFormatModuleBadge(f.module)}
                </div>
                <p class="im-help-snippet">${imHelpEscapeHtml(ans)}</p>
                <div class="im-help-actions">
                  <button type="button" class="secondary-btn" data-im-help-open-faq="${imHelpEscapeHtml(f.id)}"><i class="fa-solid fa-comment-dots"></i> Ask this</button>
                </div>
              </div>
            `;
        }).join('');

    imHelpFaqsList.innerHTML = cards;
}

function imHelpShowGuideInAsk(id) {
    const g = imHelpGuides.find(x => x.id === id);
    if (!g) return;
    imHelpSelectTab('ask');
    const best = {
        type: 'guide',
        id: g.id,
        score: 0.0,
        title: g.title || 'Guide',
        badgeHtml: imHelpFormatModuleBadge(g.module),
        bodyHtml: imHelpEscapeHtml(g.body || ''),
        actionsHtml: `
          <button type="button" class="secondary-btn" data-im-open-section="im-invoice-entry"><i class="fa-solid fa-arrow-right"></i> Open Invoice Entry</button>
          <button type="button" class="secondary-btn" data-im-open-section="im-reporting"><i class="fa-solid fa-arrow-right"></i> Open Invoice Records</button>
        `,
    };
    imHelpRenderAskResults(g.title || 'Guide', best, []);
}

function imHelpShowFaqInAsk(id) {
    const f = imHelpFaqs.find(x => x.id === id);
    if (!f) return;
    imHelpSelectTab('ask');
    const best = imHelpMakeResultFromFaq(f, f.question || '', 0.0);
    best.title = f.question || 'Answer';
    imHelpRenderAskResults(f.question || 'FAQ', best, []);
}

async function imHelpLoadUnanswered() {
    const snap = await invoiceDb.ref('helpCenter/unanswered').once('value');
    const obj = snap.val() || {};
    const arr = Object.keys(obj).map(id => ({ id, ...(obj[id] || {}) }))
        .filter(x => (x.status || 'open') === 'open')
        .sort((a, b) => (b.askedAt || 0) - (a.askedAt || 0));
    return arr;
}

function imHelpRenderUnanswered(items) {
    if (!imHelpUnansweredList) return;
    const list = Array.isArray(items) ? items : [];
    if (!list.length) {
        imHelpUnansweredList.innerHTML = '<div class="im-help-card"><p class="im-help-snippet">No unanswered questions 🎉</p></div>';
        return;
    }

    const cards = list.slice(0, 40).map(it => {
        const d = it.askedAt ? new Date(it.askedAt) : null;
        const when = d && !isNaN(d.getTime()) ? d.toLocaleString() : '';
        return `
          <div class="im-help-card">
            <div class="im-help-title">
              <h3>${imHelpEscapeHtml(it.q || 'Question')}</h3>
              <span class="im-help-badge">${imHelpEscapeHtml(when)}</span>
            </div>
            <p class="im-help-snippet">Asked by: ${imHelpEscapeHtml(it.askedBy || 'Unknown')}</p>
            <div class="im-help-actions">
              <button type="button" class="secondary-btn" data-im-help-answer-unanswered="${imHelpEscapeHtml(it.id)}"><i class="fa-solid fa-pen"></i> Answer</button>
            </div>
          </div>
        `;
    }).join('');

    imHelpUnansweredList.innerHTML = cards;
}

function imHelpAdminClearForm() {
    imHelpSelectedUnansweredId = null;
    imHelpEditingFaqId = null;
    if (imHelpAdminQ) imHelpAdminQ.value = '';
    if (imHelpAdminA) imHelpAdminA.value = '';
    if (imHelpAdminModule) imHelpAdminModule.value = 'Invoice Management';
    if (imHelpAdminPageRefs) imHelpAdminPageRefs.value = '';

    // Reset publish button label
    if (imHelpAdminPublishBtn) {
        imHelpAdminPublishBtn.innerHTML = '<i class="fa-solid fa-circle-check"></i> Publish FAQ';
    }
}

async function imHelpAdminPublishFaq() {
    if (!imHelpIsSuperAdminUser()) {
        alert('Access Denied: Super Admin only.');
        return;
    }

    const q = String(imHelpAdminQ?.value || '').trim();
    const a = String(imHelpAdminA?.value || '').trim();
    const module = String(imHelpAdminModule?.value || 'General').trim();
    const pageRefsStr = String(imHelpAdminPageRefs?.value || '').trim();
    const pageRefs = pageRefsStr
        ? pageRefsStr.split(',').map(s => Number(String(s).trim())).filter(n => n && n > 0)
        : [];

    if (!q || !a) {
        alert('Please fill Question and Answer.');
        return;
    }

    const now = Date.now();
    const payload = {
        question: q,
        answer: a,
        module,
        pageRefs,
        updatedAt: now,
        updatedBy: (currentApprover?.Name || '').trim() || SUPER_ADMIN_NAME,
    };

    const isEditing = !!imHelpEditingFaqId;
    imHelpAdminSetStatus(`<i class="fa-solid fa-spinner fa-spin"></i> ${isEditing ? 'Updating' : 'Publishing'} FAQ…`);

    let faqKey = null;

    if (isEditing) {
        faqKey = imHelpEditingFaqId;
        await invoiceDb.ref(`helpCenter/faqs/${faqKey}`).update(payload);
    } else {
        const newRef = invoiceDb.ref('helpCenter/faqs').push();
        await newRef.set(payload);
        faqKey = newRef.key;

        if (imHelpSelectedUnansweredId) {
            await invoiceDb.ref(`helpCenter/unanswered/${imHelpSelectedUnansweredId}`).update({
                status: 'answered',
                answeredAt: now,
                answeredBy: payload.updatedBy,
                faqId: faqKey,
            });
        }
    }

    imHelpAdminSetStatus(`<span style="color:#1e7e34;"><i class="fa-solid fa-circle-check"></i> FAQ ${isEditing ? 'updated' : 'published'}</span>`);
    imHelpAdminClearForm();
    await imHelpAdminRefreshAll(true);
}

async function imHelpAdminSaveGuide() {
    if (!imHelpIsSuperAdminUser()) {
        alert('Access Denied: Super Admin only.');
        return;
    }

    const title = String(imHelpGuideTitle?.value || '').trim();
    const body = String(imHelpGuideBody?.value || '').trim();
    const module = String(imHelpGuideModule?.value || 'General').trim();

    if (!title || !body) {
        alert('Please fill guide title and content.');
        return;
    }

    const payload = {
        title,
        body,
        module,
        updatedAt: Date.now(),
        updatedBy: (currentApprover?.Name || '').trim() || SUPER_ADMIN_NAME,
    };

    imHelpAdminSetStatus('<i class="fa-solid fa-spinner fa-spin"></i> Saving guide…');
    await invoiceDb.ref('helpCenter/systemGuides').push().set(payload);
    imHelpAdminSetStatus(`<span style="color:#1e7e34;"><i class="fa-solid fa-circle-check"></i> Guide saved</span>`);
    if (imHelpGuideTitle) imHelpGuideTitle.value = '';
    if (imHelpGuideBody) imHelpGuideBody.value = '';
    if (imHelpGuideModule) imHelpGuideModule.value = 'Invoice Management';
    await imHelpAdminRefreshAll(true);
}


function imHelpParseGuidePackMd(fileText) {
    const raw = String(fileText || '');
    const guides = [];

    // Match each section that starts with '## <title>' and continues until the next '##'
    const re = /##\s+([^\n\r]+)\n([\s\S]*?)(?=\n##\s+|$)/g;
    let m;
    while ((m = re.exec(raw)) !== null) {
        const heading = String(m[1] || '').trim();
        const block = String(m[2] || '');

        // Title: remove leading numbering like '1) '
        const title = heading.replace(/^\s*\d+\s*[).:-]\s*/, '').trim();
        if (!title) continue;

        // Module
        let module = 'General';
        const modMatch = block.match(/\*\*Module:\*\*\s*([^\n\r]+)/i);
        if (modMatch && modMatch[1]) {
            module = String(modMatch[1]).trim() || 'General';
        }

        // Body + Keywords
        const bodyMarker = '**Body:**';
        const bodyIdx = block.indexOf(bodyMarker);
        if (bodyIdx === -1) continue;

        let bodyPart = block.slice(bodyIdx + bodyMarker.length).trim();
        let body = '';
        let keywords = '';

        const kwBoldMarker = '**Keywords:**';
        const kwIdx = bodyPart.indexOf(kwBoldMarker);
        if (kwIdx !== -1) {
            body = bodyPart.slice(0, kwIdx).trim();
            keywords = bodyPart.slice(kwIdx + kwBoldMarker.length).trim();
        } else {
            // fallback: a plain 'Keywords:' line
            const kwMatch = bodyPart.match(/(?:^|\n)\s*Keywords:\s*([^\n\r]+)/i);
            if (kwMatch && kwMatch[1]) {
                keywords = String(kwMatch[1]).trim();
                body = bodyPart.replace(/(?:^|\n)\s*Keywords:\s*[^\n\r]+/i, '').trim();
            } else {
                body = bodyPart.trim();
            }
        }

        keywords = String(keywords || '').replace(/\s+/g, ' ').trim();
        if (keywords) {
            body = (body ? body + '\n\n' : '') + 'Keywords: ' + keywords;
        }

        if (!body) continue;
        guides.push({ title, module, body });
    }

    return guides;
}

async function imHelpAdminImportGuidePack() {
    if (!imHelpIsSuperAdminUser()) {
        alert('Access Denied: Super Admin only.');
        return;
    }

    const file = imHelpGuidesImportInput?.files?.[0];
    if (!file) {
        alert('Please choose a .md or .txt guide pack file first.');
        return;
    }

    const replaceExisting = !!imHelpGuidesReplaceChk?.checked;

    try {
        imHelpAdminSetStatus('<i class="fa-solid fa-spinner fa-spin"></i> Reading guide pack…');
        const text = await file.text();
        const guides = imHelpParseGuidePackMd(text);

        if (!guides.length) {
            throw new Error('No guides found in this file. Make sure it contains sections starting with "##" plus "**Module:**" and "**Body:**".');
        }

        const now = Date.now();
        const by = (currentApprover?.Name || '').trim() || SUPER_ADMIN_NAME;

        if (replaceExisting) {
            imHelpAdminSetStatus('<i class="fa-solid fa-spinner fa-spin"></i> Replacing existing guides…');
            await invoiceDb.ref('helpCenter/systemGuides').remove();
        }

        imHelpAdminSetStatus(`<i class="fa-solid fa-spinner fa-spin"></i> Importing ${guides.length} guides…`);

        const updates = {};
        for (const g of guides) {
            const key = invoiceDb.ref('helpCenter/systemGuides').push().key;
            updates[`helpCenter/systemGuides/${key}`] = { ...g, updatedAt: now, updatedBy: by };
        }

        await invoiceDb.ref().update(updates);

        imHelpAdminSetStatus(`<span style="color:#1e7e34;"><i class="fa-solid fa-circle-check"></i> Imported ${guides.length} guides</span>`);

        if (imHelpGuidesImportInput) imHelpGuidesImportInput.value = '';
        if (imHelpGuidesReplaceChk) imHelpGuidesReplaceChk.checked = false;

        await imHelpAdminRefreshAll(true);

    } catch (err) {
        console.error('Help Center guide pack import error', err);
        imHelpAdminSetStatus(`<span style="color:#C3502F;"><i class="fa-solid fa-triangle-exclamation"></i> ${imHelpEscapeHtml(err?.message || String(err))}</span>`);
    }
}

async function imHelpAdminSaveButtonHelp() {
    if (!imHelpIsSuperAdminUser()) {
        alert('Access Denied: Super Admin only.');
        return;
    }

    const label = String(imHelpBtnLabel?.value || '').trim();
    const description = String(imHelpBtnDesc?.value || '').trim();
    const module = String(imHelpBtnModule?.value || 'General').trim();
    const keywords = String(imHelpBtnKeywords?.value || '').trim();

    if (!label || !description) {
        alert('Please fill button name and description.');
        return;
    }

    const payload = {
        label,
        description,
        module,
        keywords,
        updatedAt: Date.now(),
        updatedBy: (currentApprover?.Name || '').trim() || SUPER_ADMIN_NAME,
    };

    imHelpAdminSetStatus('<i class="fa-solid fa-spinner fa-spin"></i> Saving button help…');
    await invoiceDb.ref('helpCenter/buttons').push().set(payload);
    imHelpAdminSetStatus(`<span style="color:#1e7e34;"><i class="fa-solid fa-circle-check"></i> Button help saved</span>`);

    if (imHelpBtnLabel) imHelpBtnLabel.value = '';
    if (imHelpBtnDesc) imHelpBtnDesc.value = '';
    if (imHelpBtnKeywords) imHelpBtnKeywords.value = '';
    if (imHelpBtnModule) imHelpBtnModule.value = 'WorkDesk';

    await imHelpAdminRefreshAll(true);
}

function imHelpRenderAdminFaqs() {
    if (!imHelpAdminFaqs) return;
    const list = (Array.isArray(imHelpFaqs) ? imHelpFaqs : []).slice().sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0)).slice(0, 60);
    if (!list.length) {
        imHelpAdminFaqs.innerHTML = '<div class="im-help-card"><p class="im-help-snippet">No FAQs yet.</p></div>';
        return;
    }

    imHelpAdminFaqs.innerHTML = list.map(f => {
        const when = f.updatedAt ? new Date(f.updatedAt).toLocaleString() : '';
        return `
          <div class="im-help-card">
            <div class="im-help-title">
              <h3>${imHelpEscapeHtml(f.question || 'FAQ')}</h3>
              <span class="im-help-badge">${imHelpEscapeHtml(when)}</span>
            </div>
            <p class="im-help-snippet">${imHelpEscapeHtml(imHelpBuildExcerpt(f.answer || '', '', 300))}</p>
            <div class="im-help-actions">
              <button type="button" class="secondary-btn" data-im-help-open-faq="${imHelpEscapeHtml(f.id)}"><i class="fa-solid fa-eye"></i> View</button>
              <button type="button" class="secondary-btn" data-im-help-edit-faq="${imHelpEscapeHtml(f.id)}"><i class="fa-solid fa-pen"></i> Edit</button>
            </div>
          </div>
        `;
    }).join('');
}

function imHelpRenderAdminGuides() {
    if (!imHelpAdminGuides) return;
    const list = (Array.isArray(imHelpGuides) ? imHelpGuides : []).slice().sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0)).slice(0, 60);
    if (!list.length) {
        imHelpAdminGuides.innerHTML = '<div class="im-help-card"><p class="im-help-snippet">No guides yet.</p></div>';
        return;
    }

    imHelpAdminGuides.innerHTML = list.map(g => {
        const when = g.updatedAt ? new Date(g.updatedAt).toLocaleString() : '';
        return `
          <div class="im-help-card">
            <div class="im-help-title">
              <h3>${imHelpEscapeHtml(g.title || 'Guide')}</h3>
              <span class="im-help-badge">${imHelpEscapeHtml(when)}</span>
            </div>
            <p class="im-help-snippet">${imHelpEscapeHtml(imHelpBuildExcerpt(g.body || '', '', 280))}</p>
            <div class="im-help-actions">
              <button type="button" class="secondary-btn" data-im-help-view-guide="${imHelpEscapeHtml(g.id)}"><i class="fa-solid fa-book"></i> View</button>
            </div>
          </div>
        `;
    }).join('');
}

function imHelpRenderAdminButtons() {
    if (!imHelpAdminButtons) return;
    const list = (Array.isArray(imHelpButtons) ? imHelpButtons : []).slice().sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0)).slice(0, 80);
    if (!list.length) {
        imHelpAdminButtons.innerHTML = '<div class="im-help-card"><p class="im-help-snippet">No button help yet.</p></div>';
        return;
    }

    imHelpAdminButtons.innerHTML = list.map(b => {
        const when = b.updatedAt ? new Date(b.updatedAt).toLocaleString() : '';
        return `
          <div class="im-help-card">
            <div class="im-help-title">
              <h3>${imHelpEscapeHtml(b.label || 'Button')}</h3>
              <span class="im-help-badge">${imHelpEscapeHtml(when)}</span>
            </div>
            <p class="im-help-snippet">${imHelpEscapeHtml(imHelpBuildExcerpt(b.description || '', '', 280))}</p>
          </div>
        `;
    }).join('');
}

async function imHelpAdminRefreshAll(forceKb = false) {
    if (!imHelpIsSuperAdminUser()) return;

    await imHelpLoadKnowledgeBase(forceKb);

    try {
        const unanswered = await imHelpLoadUnanswered();
        imHelpRenderUnanswered(unanswered);
    } catch (e) {
        console.error('Help Admin: load unanswered failed', e);
    }

    imHelpRenderAdminFaqs();
    imHelpRenderAdminGuides();
    imHelpRenderAdminButtons();

    // also keep browse tabs up to date
    imHelpRenderGuidesList(imHelpGuides);
    imHelpRenderFaqsList(imHelpFaqs);
}

async function imHelpAdminInitTemplates() {
    if (!imHelpIsSuperAdminUser()) {
        alert('Access Denied: Super Admin only.');
        return;
    }

    const now = Date.now();
    const by = (currentApprover?.Name || '').trim() || SUPER_ADMIN_NAME;

    const templatesGuides = [
        {
            title: 'Invoice Entry – Step by Step',
            module: 'Invoice Management',
            body: [
                '1) Go to Invoice Management → Invoice Entry.',
                '2) Fill required fields (PO No, Vendor, Invoice No, Amount, Site, Date).',
                '3) Attach the invoice scan if required.',
                '4) Save/Submit. The record will appear in Invoice Records and in the next person’s WorkDesk if routing is used.',
                '',
                'Tip: If you can’t submit, check that PO and Site are correct and required fields are filled.'
            ].join('\n')
        },
        {
            title: 'Invoice Records – Search & Status',
            module: 'Invoice Management',
            body: [
                '1) Go to Invoice Management → Invoice Records.',
                '2) Use the filters/search to find an invoice by PO, Vendor, Invoice No, or Status.',
                '3) Open the invoice to see history and current attention/status.',
                '',
                'Tip: If an invoice is stuck, check the last history entry and the current “Attention” field.'
            ].join('\n')
        },
        {
            title: 'WorkDesk – What is it?',
            module: 'WorkDesk',
            body: [
                'WorkDesk shows tasks/items waiting for your action (review, approve, return, complete SRV, etc.).',
                'Open the task, read the notes and attachments, then take the correct action.',
                '',
                'If you are unsure which button to use, search the Help Center for the button name (Approve / Return / SRV Done).' 
            ].join('\n')
        },
        {
            title: 'Inventory – Common actions',
            module: 'Inventory',
            body: [
                'Inventory pages track stock movements (receive, transfer, issue).',
                'Use search to find items by code/description and verify quantities.',
                '',
                'If you see mismatched quantities, check recent transfers/receipts history.'
            ].join('\n')
        },
        {
            title: 'Financial Report – Search payments',
            module: 'Financial',
            body: [
                '1) Go to Invoice Management → Financial Report.',
                '2) Enter PO No and click Search.',
                '3) This page is read-only; it shows matching payments from the finance database.',
                '',
                'If nothing appears, confirm PO No is correct and the payment has been recorded by finance.'
            ].join('\n')
        }
    ];

    const templatesButtons = [
        { label: 'Approve', module: 'WorkDesk', description: 'Approves the current item and routes it to the next step (based on status/role). Use after you verify PO, invoice details, and attachment.', keywords: 'approve, approval, manager approved' },
        { label: 'Return', module: 'WorkDesk', description: 'Sends the item back for correction with a note. Use when information is missing or incorrect (wrong PO, missing attachment, wrong amount).', keywords: 'return, reject, correction' },
        { label: 'SRV Done', module: 'WorkDesk', description: 'Marks SRV/receiving as completed (when applicable) and moves the invoice forward.', keywords: 'srv, receiving, done' },
        { label: 'Invoice Entry', module: 'Invoice Management', description: 'Use this page to create a new invoice record and submit it into the process.', keywords: 'create invoice, new invoice' },
        { label: 'Invoice Records', module: 'Invoice Management', description: 'Search and review invoices and their statuses/history.', keywords: 'reporting, records, status' }
    ];

    imHelpAdminSetStatus('<i class="fa-solid fa-spinner fa-spin"></i> Initializing templates…');

    // Add templates only if empty
    const [gSnap, bSnap, fSnap] = await Promise.all([
        invoiceDb.ref('helpCenter/systemGuides').once('value'),
        invoiceDb.ref('helpCenter/buttons').once('value'),
        invoiceDb.ref('helpCenter/faqs').once('value'),
    ]);

    const updates = {};
    if (!gSnap.exists()) {
        for (const g of templatesGuides) {
            const key = invoiceDb.ref('helpCenter/systemGuides').push().key;
            updates[`helpCenter/systemGuides/${key}`] = { ...g, updatedAt: now, updatedBy: by };
        }
    }
    if (!bSnap.exists()) {
        for (const b of templatesButtons) {
            const key = invoiceDb.ref('helpCenter/buttons').push().key;
            updates[`helpCenter/buttons/${key}`] = { ...b, updatedAt: now, updatedBy: by };
        }
    }
    // If FAQs empty, add one helpful FAQ
    if (!fSnap.exists()) {
        const key = invoiceDb.ref('helpCenter/faqs').push().key;
        updates[`helpCenter/faqs/${key}`] = {
            question: 'How do I find an invoice after entry?',
            answer: 'Go to Invoice Management → Invoice Records, then search by PO No / Vendor / Invoice No. Open the record to see its current status and history.',
            module: 'Invoice Management',
            pageRefs: [],
            updatedAt: now,
            updatedBy: by,
        };
    }

    if (Object.keys(updates).length) {
        await invoiceDb.ref().update(updates);
    }

    imHelpAdminSetStatus(`<span style="color:#1e7e34;"><i class="fa-solid fa-circle-check"></i> Templates initialized</span>`);

    await imHelpAdminRefreshAll(true);
}

// -------------------------
// PDF Publish / Index (existing)
// -------------------------
async function imHelpPublishPdf(file) {
    if (!file) return;
    if (!window.pdfjsLib) {
        throw new Error('PDF parser not loaded (pdf.js).');
    }
    if (file.type !== 'application/pdf') {
        throw new Error('Please upload a PDF file.');
    }

    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');
    const version = `${yyyy}-${mm}-${dd}-${Date.now()}`;

    imHelpSetStatus('<i class="fa-solid fa-spinner fa-spin"></i> Uploading PDF…');
    const storagePath = `Files/HelpCenter/guides/${version}.pdf`;
    const guideRef = storage.ref().child(storagePath);
    await guideRef.put(file, { contentType: 'application/pdf' });
    const guideUrl = await guideRef.getDownloadURL();

    imHelpSetStatus('<i class="fa-solid fa-spinner fa-spin"></i> Extracting text…');
    const buf = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: buf }).promise;
    const numPages = pdf.numPages || 0;
    if (!numPages) throw new Error('Could not read PDF pages.');

    const updates = {};
    for (let p = 1; p <= numPages; p++) {
        const page = await pdf.getPage(p);
        const tc = await page.getTextContent();
        const pageText = (tc.items || []).map(it => it.str).join(' ').replace(/\s+/g, ' ').trim();
        updates[`helpCenter/versions/${version}/pages/${p}`] = {
            text: pageText,
            updatedAt: Date.now(),
        };
    }

    updates['helpCenter/current'] = {
        version,
        guideUrl,
        updatedAt: Date.now(),
        updatedBy: (currentApprover?.Name || '').trim() || 'Super Admin',
        pages: numPages,
    };

    imHelpSetStatus('<i class="fa-solid fa-spinner fa-spin"></i> Publishing…');
    await invoiceDb.ref().update(updates);
    imHelpSetStatus(`<span style="color:#1e7e34;"><i class="fa-solid fa-circle-check"></i> Published version ${imHelpEscapeHtml(version)} (${numPages} pages)</span>`);

    await imHelpLoadKnowledgeBase(true);
}

// -------------------------
// Event wiring
// -------------------------

// Tabs
if (imHelpTabButtons.length) {
    imHelpTabButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            const t = btn.getAttribute('data-im-help-tab');
            imHelpSelectTab(t);
        });
    });
}

// Back button (shown when Help is opened from WorkDesk/Inventory)
if (imHelpBackBtn) {
    imHelpBackBtn.addEventListener('click', async (e) => {
        e.preventDefault();
        const returnTo = window.__imHelpReturnTo || null;
        const returnSection = window.__imHelpReturnSection || null;

        // Restore normal IM state
        window.__imHelpStandalone = false;
        if (imNav) imNav.classList.remove('hidden');

        if (returnTo === 'inventory') {
            // Prefer the official Inventory button flow (it sets inventory-mode + loads stock)
            if (typeof inventoryButton !== 'undefined' && inventoryButton) {
                inventoryButton.click();
                return;
            }
            // Fallback: show WorkDesk material stock
            showView('workdesk');
            if (typeof showWorkdeskSection === 'function') {
                await showWorkdeskSection('wd-material-stock');
            }
            return;
        }

        // Default: WorkDesk
        showView('workdesk');
        if (typeof showWorkdeskSection === 'function') {
            const sec = returnSection || 'wd-activetask';
            // Keep nav highlight in sync
            try {
                document.querySelectorAll('#workdesk-nav a, .workdesk-footer-nav a').forEach(a => a.classList.remove('active'));
                const activeLink = document.querySelector(`#workdesk-view a[data-section="${sec}"]`);
                if (activeLink) activeLink.classList.add('active');
            } catch (_) {}
            await showWorkdeskSection(sec);
        }
    });
}

// Open Help from WorkDesk / Inventory
if (wdHelpLink) {
    wdHelpLink.addEventListener('click', (e) => {
        e.preventDefault();
        const sec = imHelpGetWorkdeskActiveSectionId() || 'wd-activetask';
        imHelpSetContext('workdesk', 'workdesk', sec);
        imHelpOpenStandalone();
    });
}
if (invHelpLink) {
    invHelpLink.addEventListener('click', (e) => {
        e.preventDefault();
        imHelpSetContext('inventory', 'inventory', 'wd-material-stock');
        imHelpOpenStandalone();
    });
}

// Ask
if (imHelpSearchBtn && imHelpSearchInput) {
    imHelpSearchBtn.addEventListener('click', () => imHelpAsk(imHelpSearchInput.value));
    imHelpSearchInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            imHelpAsk(imHelpSearchInput.value);
        }
    });
}
if (imHelpClearBtn) imHelpClearBtn.addEventListener('click', imHelpClearAsk);

// FAQ search tab
if (imHelpFaqSearchBtn && imHelpFaqSearchInput) {
    imHelpFaqSearchBtn.addEventListener('click', async () => {
        const q = String(imHelpFaqSearchInput.value || '').trim();
        await imHelpLoadKnowledgeBase(false);
        if (!q) {
            imHelpRenderFaqsList(imHelpFaqs);
            return;
        }
        const results = imHelpFaqFuse ? imHelpFaqFuse.search(q).slice(0, 30).map(r => r.item) : [];
        imHelpRenderFaqsList(results);
    });
    imHelpFaqSearchInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            imHelpFaqSearchBtn.click();
        }
    });
}
if (imHelpFaqClearBtn) {
    imHelpFaqClearBtn.addEventListener('click', () => {
        if (imHelpFaqSearchInput) imHelpFaqSearchInput.value = '';
        imHelpRenderFaqsList(imHelpFaqs);
    });
}

// Delegate clicks inside results/lists (open guide, open section, log need help, answer unanswered)
if (document.getElementById('im-help')) {
    document.getElementById('im-help').addEventListener('click', async (e) => {
        const needHelp = e.target.closest('[data-im-help-need-help]');
        if (needHelp) {
            try {
                await imHelpLogNeedHelp(imHelpLastQuery || (imHelpSearchInput?.value || ''));
                alert('Sent to Super Admin. Thank you!');
            } catch (err) {
                console.error('Help Center: log need help failed', err);
                alert('Could not send the question. Please try again.');
            }
            return;
        }

        const openSection = e.target.closest('[data-im-open-section]');
        if (openSection) {
            const sec = openSection.getAttribute('data-im-open-section');
            if (sec) imHelpOpenImSection(sec);
            return;
        }

        const viewGuide = e.target.closest('[data-im-help-view-guide]');
        if (viewGuide) {
            const id = viewGuide.getAttribute('data-im-help-view-guide');
            if (id) imHelpShowGuideInAsk(id);
            return;
        }

        const openFaq = e.target.closest('[data-im-help-open-faq]');
        if (openFaq) {
            const id = openFaq.getAttribute('data-im-help-open-faq');
            if (id) imHelpShowFaqInAsk(id);
            return;
        }

        // Super Admin: Edit FAQ
        const editFaq = e.target.closest('[data-im-help-edit-faq]');
        if (editFaq) {
            if (!imHelpIsSuperAdminUser()) {
                alert('Access Denied: Super Admin only.');
                return;
            }
            const id = editFaq.getAttribute('data-im-help-edit-faq');
            if (!id) return;
            // Find in loaded list
            const faq = (Array.isArray(imHelpFaqs) ? imHelpFaqs : []).find(x => String(x.id) === String(id));
            if (!faq) {
                alert('FAQ not found (please Refresh).');
                return;
            }

            imHelpEditingFaqId = String(id);
            imHelpSelectedUnansweredId = null; // editing existing, not answering queue

            if (imHelpAdminQ) imHelpAdminQ.value = String(faq.question || '');
            if (imHelpAdminA) imHelpAdminA.value = String(faq.answer || '');
            if (imHelpAdminModule) imHelpAdminModule.value = String(faq.module || 'Invoice Management');
            if (imHelpAdminPageRefs) imHelpAdminPageRefs.value = Array.isArray(faq.pageRefs) ? faq.pageRefs.join(', ') : '';

            if (imHelpAdminPublishBtn) {
                imHelpAdminPublishBtn.innerHTML = '<i class="fa-solid fa-circle-check"></i> Update FAQ';
            }

            imHelpSelectTab('admin');
            imHelpAdminQ?.focus();
            window.scrollTo({ top: 0, behavior: 'smooth' });
            return;
        }

        const ansBtn = e.target.closest('[data-im-help-answer-unanswered]');
        if (ansBtn) {
            const id = ansBtn.getAttribute('data-im-help-answer-unanswered');
            if (!id) return;
            const snap = await invoiceDb.ref(`helpCenter/unanswered/${id}`).once('value');
            const it = snap.val();
            if (it && imHelpAdminQ) {
                imHelpEditingFaqId = null;
                imHelpSelectedUnansweredId = id;
                imHelpAdminQ.value = String(it.q || '').trim();
                if (imHelpAdminPublishBtn) {
                    imHelpAdminPublishBtn.innerHTML = '<i class="fa-solid fa-circle-check"></i> Publish FAQ';
                }
                imHelpSelectTab('admin');
                imHelpAdminQ.focus();
                window.scrollTo({ top: 0, behavior: 'smooth' });
            }
            return;
        }
    });
}

// Add this listener in your app.js file
const imPoClearBtn = document.getElementById('im-po-clear-button');
const imPoInputTop = document.getElementById('im-po-search-input');
const imPoInputBottom = document.getElementById('im-po-search-input-bottom');
const imInvoicesBody = document.getElementById('im-invoices-table-body');
const imPoDetails = document.getElementById('im-po-details-container');

if (imPoClearBtn) {
    imPoClearBtn.addEventListener('click', () => {
        // 1. Clear Search Inputs
        if (imPoInputTop) imPoInputTop.value = '';
        if (imPoInputBottom) imPoInputBottom.value = '';

        // 2. Clear Session Storage
        sessionStorage.removeItem('imPOSearch');


// #endregion BLOCK 31 — IM HELP CENTER


// =================================================================================================
// #region BLOCK 32 — FINAL UI CLEANUP + HELP CENTER BOOTSTRAP
// Purpose: End-of-file UI cleanup, invoice form reset/hide logic, Help Center lazy loading/open actions.
// =================================================================================================

        // 3. Clear the Invoices Table
        if (imInvoicesBody) {
            imInvoicesBody.innerHTML = '<tr><td colspan="8" style="text-align:center; padding:30px; color:#888;">Table cleared. Search for a PO to view invoices.</td></tr>';
        }

        // 4. Hide or Reset PO Details Header
        document.querySelectorAll('.im-po-no, .im-po-site, .im-po-value, .im-po-vendor').forEach(el => {
            el.textContent = '---';
        });

        // 5. Hide the Invoice Form and other UI triggers
        const trigger = document.getElementById('im-invoice-form-trigger');
        if (trigger) trigger.classList.add('hidden');
        
        const existingContainer = document.getElementById('im-existing-invoices-container');
        if (existingContainer) existingContainer.classList.add('hidden');

        // 6. Reset Internal State
        window.currentPO = null;
        
        console.log("Invoice Entry Page Cleared.");
    });
}

// Admin actions
if (imHelpInitBtn) imHelpInitBtn.addEventListener('click', () => imHelpAdminInitTemplates());
if (imHelpAdminRefreshBtn) imHelpAdminRefreshBtn.addEventListener('click', () => imHelpAdminRefreshAll(true));

if (imHelpAdminPublishBtn) imHelpAdminPublishBtn.addEventListener('click', () => imHelpAdminPublishFaq());
if (imHelpAdminClearFormBtn) imHelpAdminClearFormBtn.addEventListener('click', imHelpAdminClearForm);

if (imHelpGuideSaveBtn) imHelpGuideSaveBtn.addEventListener('click', () => imHelpAdminSaveGuide());
if (imHelpGuidesImportBtn) imHelpGuidesImportBtn.addEventListener('click', () => imHelpAdminImportGuidePack());
if (imHelpGuideClearBtn) imHelpGuideClearBtn.addEventListener('click', () => {
    if (imHelpGuideTitle) imHelpGuideTitle.value = '';
    if (imHelpGuideBody) imHelpGuideBody.value = '';
    if (imHelpGuideModule) imHelpGuideModule.value = 'Invoice Management';
});

if (imHelpBtnSaveBtn) imHelpBtnSaveBtn.addEventListener('click', () => imHelpAdminSaveButtonHelp());
if (imHelpBtnClearBtn) imHelpBtnClearBtn.addEventListener('click', () => {
    if (imHelpBtnLabel) imHelpBtnLabel.value = '';
    if (imHelpBtnDesc) imHelpBtnDesc.value = '';
    if (imHelpBtnKeywords) imHelpBtnKeywords.value = '';
    if (imHelpBtnModule) imHelpBtnModule.value = 'WorkDesk';
});

// PDF Upload
if (imHelpUploadBtn) {
    imHelpUploadBtn.addEventListener('click', async () => {
        try {
            if (!imHelpIsSuperAdminUser()) {
                alert('Access Denied: Super Admin only.');
                return;
            }
            const file = imHelpUploadInput?.files?.[0];
            if (!file) {
                alert('Please choose a PDF file first.');
                return;
            }
            imHelpUploadBtn.disabled = true;
            await imHelpPublishPdf(file);
        } catch (err) {
            console.error('Help Center publish error', err);
            imHelpSetStatus(`<span style="color:#C3502F;"><i class="fa-solid fa-triangle-exclamation"></i> ${imHelpEscapeHtml(err?.message || String(err))}</span>`);
        } finally {
            if (imHelpUploadBtn) imHelpUploadBtn.disabled = false;
        }
    });
}

if (imHelpRefreshBtn) {
    imHelpRefreshBtn.addEventListener('click', async () => {
        await imHelpLoadKnowledgeBase(true);
        if (imHelpSearchInput?.value) {
            imHelpAsk(imHelpSearchInput.value);
        }
    });
}

// Load KB when Help is opened
if (imNav) {
    imNav.addEventListener('click', (e) => {
        const link = e.target.closest('a[data-section]');
        if (!link) return;
        if (link.getAttribute('data-section') === 'im-help') {
            // Normal Invoice Management Help (Admin tab allowed for Super Admin)
            window.__imHelpStandalone = false;
            imNav.classList.remove('hidden');
            imHelpSetContext('invoice', null, null);
            setTimeout(() => { imHelpOnOpen(); }, 0);
        }
    });
}

// Initial silent load
imHelpSetContext('invoice', null, null);
imHelpLoadKnowledgeBase(false);


// #endregion BLOCK 32 — FINAL UI CLEANUP + HELP CENTER BOOTSTRAP

