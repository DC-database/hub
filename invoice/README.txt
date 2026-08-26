IBA 12.7.8

Invoice Records summary eligibility correction.

Changes:
- The five-part Invoice Records summary (Total Invoice, Confirmed Paid, Unconfirmed, Not Paid, Epicore Value) now appears only for a PO/vendor search that represents the complete result set.
- The summary is hidden when Status, Month, Year, or Site filters are applied, because those filters can produce an incomplete picture.
- Invoice-number and Note searches do not trigger the five-part summary.
- When the summary is shown for a PO/vendor search, the PO is restricted to actual PO/vendor matches so unrelated invoice/note matches cannot create a misleading summary.
- Existing invoice totals, paid-status rules, and record calculations are unchanged.
- Existing visual summary styling from 12.7.7 is retained.
- Updated app-invoice-records.js cache-buster and version to 12.7.8.

Files included:
- index.html
- style.css
- version.json
- README.txt
- js/app-invoice-records.js

Replace the included files in your local copy, then hard refresh (Ctrl+F5) before testing.
