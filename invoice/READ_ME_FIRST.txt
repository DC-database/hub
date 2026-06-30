IBA WorkDesk 9.5.1 - Welcome Restricted Buttons Hard Guard Fix

Upload these files to the same paths:
- index.html
- app.js
- js/app-navigation-settings.js

Fixes:
- Financial Report and PO System are hidden by default in index.html.
- Added hard CSS guard: buttons remain hidden unless the new permission JS adds allowed body classes.
- Logistic Admin / Logistics / Coordinator can no longer see Financial Report or PO System.
- Financial Report: Super Admin only, or Admin with Finance/Accounts/Accounting/CEO/COO position.
- PO System: Super Admin only.

After upload:
- Open the site with Ctrl + F5 or clear cache.
- The welcome screen should show V 9.5.1.
