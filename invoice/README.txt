IBA 12.8.4 Live Efficiency Patch

Purpose:
- Keep Inventory launcher from preloading full Invoice Management invoice_entries.
- Keep Inventory launcher from preloading WorkDesk job_entries unnecessarily.
- Load Inventory family through ensureAllEntriesFetched(..., { mode: 'inventory' }).
- Defer approver/site/Attention data until the specific Inventory function needs it.
- Reuse cached Site.csv for up to 30 minutes instead of refreshing it on every WorkDesk startup/modal open.

Modified files only:
- index.html
- js/app-modal-navigation-clear.js
- js/app-workdesk-job-entry.js

No Firebase rules, database paths, transaction/write logic, counters, or Inventory transfer mechanisms were changed.
12.8.6 Inventory migration/test build is NOT included or modified by this patch.
