IBA WorkDesk 10.5.6 PATCH

Upload only:
- index.html
- app.js
- style.css
- css/invoice-desktop.css
- css/invoice-mobile.css

Purpose:
- Fix Batch Entry > Search PO modal table header readability.
- The final header style now lives in the invoice CSS module files, which load after style.css.
- Header background is theme green with yellow/gold text.
- Scoped only to #im-batch-search-modal #im-batch-modal-results.

No workflow, Firebase, Dashboard, Active Task, Batch Entry logic, or Invoice Records logic changes.


10.5.7
- Fixed Batch Entry > Search and Add Existing Invoices modal table header readability.
- Header is now hard-scoped and JS-applied as green background with yellow/gold text.
- Changed files: index.html, style.css, css/invoice-desktop.css, css/invoice-mobile.css, css/transfer_stock.css, js/app-batch-entry-ui.js.
