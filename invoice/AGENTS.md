# Invoice 18.0.0 project guide

`Live/` contains the current browser app. Start with `index.html` to find the markup, stylesheet cascade, and JavaScript load order. Use the 18.0.0 project tree for changes.

## Where to look

- Invoice entry and records: `js/app-invoice.js`, `js/app-invoice-entry-search.js`, `js/app-invoice-records.js`, and `js/app-batch-entry-ui.js`.
- Workdesk and reporting: `js/app-workdesk-dashboard.js`, `js/app-workdesk-job-entry.js`, and `js/app-workdesk-reporting.js`.
- Inventory and transfers: `js/app-inventory.js`, `js/materialStock.js`, and `js/transferLogic.js`.
- Finance and approvals: `js/app-finance.js`, `js/app-payments.js`, and `js/app-approval-print.js`.
- Assistant and Iris: start with `js/iba-assistant.js`, `js/iba-1800-mind.js`, and `js/iba-1800-iris-guide.js`. Follow the scripts registered in `index.html` for the feature in question.
- Release and browser caching: inspect `version.json`, `sw.js`, and the asset query strings in `index.html` together when diagnosing stale assets.

## Working on a change

Trace the affected UI element or function through `index.html`, the relevant feature script, and any later `iba-*` scripts that touch it. Several generations of patches are loaded by the current page, so check actual script order before choosing where to edit. For layout changes, check `style.css` and the relevant desktop and mobile stylesheets under `css/`.

Verify the affected workflow in a browser with test data. For JavaScript edits, run `node --check` on the changed files when Node is available. For update or caching changes, check both a fresh load and a reload from an existing session. Record any browser checks you could not run.
