IBA 11.4.5 — Batch Entry Attention Routing + Manual Override Patch

Upload/replace only these files:
- index.html
- version.json
- js/app-attention-validation.js
- js/app-im-event-wiring.js

Purpose:
- Batch Entry For SRV + Group Normal = site-matched Site DC/Camp Boss logic.
- Batch Entry For SRV + Group Logistic = Imran/logistic person regardless of site.
- Report = GIO, CEO Approval = Hamad, In Process = COO/Ali.
- No-attention statuses remain blank/None.
- If no routing match exists, fallback is Irwin.
- Manual Attention picker remains allowed so the user can override before saving.

After upload: hard refresh Chrome using Ctrl + F5.
