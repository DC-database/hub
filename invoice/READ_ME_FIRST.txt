IBA WorkDesk 10.3.9 PATCH

Fixes Invoice Management > Invoice Entry > Active Jobs side panel showing no data after 10.3.7/10.3.8.

Changes:
- Restores the proven WorkDesk job_entries source for Active Jobs side panel.
- Removes/disables the strict job_entry_inbox optimization that caused empty results.
- Active Jobs now auto-loads when Invoice Entry page is opened, so users see records right away again.
- Keeps New Entry below vendor name and keeps Normal/HSE/Logistic category chip.
- Still does not fetch full invoice_entries / With Accounts for this side panel.

Upload only these files:
- index.html
- app.js
- js/app-invoice-entry-search.js
