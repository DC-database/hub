IBA WorkDesk 9.9.0 — Invoice Records CSV Direct Status Export Fix

Upload/replace:
1. index.html
2. js/app-reporting-actions.js

Purpose:
- CSV download with a selected status now refreshes invoice_entries and exports directly from the fresh Firebase invoice_entries source.
- Prevents stale currentReportData / PO grouping from missing recently batch-updated invoices.
- Status match is exact after trim/case normalization, so Report Approved is not Report and SRV Done is not For SRV.
- No Batch save/write/payment/SRV/inventory logic changed.

Manual visible version update in app.js:
const APP_VERSION = '9.9.0';
