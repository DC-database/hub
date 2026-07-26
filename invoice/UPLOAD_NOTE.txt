IBA 11.4.4 - Summary Note Strict Live Note Rows Patch

Upload these files only:
- app.js
- index.html
- version.json
- js/app-data-cache.js

Fix:
- Summary Note no longer trusts stale browser/allInvoiceData rows for the generated table.
- Current Note controls the table list and Current Payment only.
- Previous Note controls Previous Payment only.
- Strict Generate exact-reads live invoice rows from note refs and excludes stale refs where the live invoice note no longer matches.
- Stale refs are cleaned from invoice_note_index when detected.

After upload:
1. Hard refresh Chrome with Ctrl + F5.
2. Test Summary Note with Computer Mart 26-Jul-2026.
3. Table should show only the current-note rows.
