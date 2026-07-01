IBA WorkDesk 9.8.8 Exact Status Match Fix

Upload these files to patch 9.8.7.

Files included:
- index.html
- js/app-active-tasks.js
- js/app-workdesk-dashboard.js

Fix:
- WorkDesk status tabs now use exact invoice status names only.
- Report Approved is not counted as Report.
- SRV Done is not counted as For SRV.
- For SRV, On Hold, In Process, Pending, Unresolved, and Report must match exact current invoice_entries status.
- IPC remains separate from Job Records.
- Inventory remains separate.
- No invoice save/payment/SRV/inventory workflow write logic changed.
