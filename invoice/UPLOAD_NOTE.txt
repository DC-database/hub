IBA SYSTEM PATCH 11.0.2

Patch name:
Financial Report QS / Senior QS Access Patch

Upload these files to the live system:
1. index.html
2. app.js
3. js/app-navigation-settings.js
4. version.json

What changed:
- Invoice Management → Financial Report access now also allows Admin users whose Position is QS or Senior QS.
- Existing allowed access remains unchanged: Super Admin, vacation delegate, Admin + Finance/Accounts/Accounting/CEO/COO.
- This patch keeps the Admin-role requirement for QS/Senior QS access, same as the existing finance-position rule.

Not changed:
- Dashboard
- Active Task
- Job Records
- Inventory
- Invoice workflow/status logic
- Firebase paths
- Attention routing

Version note:
- version.json is set to 11.0.2.
- index.html window.IBA_SYSTEM_VERSION is set to 11.0.2.
- app.js APP_VERSION is set to 11.0.2.

After upload:
- Use Ctrl + F5 once if the old menu is cached.
