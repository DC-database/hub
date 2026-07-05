IBA WorkDesk 10.4.0 PATCH ONLY

Upload/replace only these files:
- index.html
- app.js
- js/app-active-tasks.js
- js/app-workdesk-dashboard.js

Purpose:
- Fix duplicate WorkDesk/Invoice active tasks after a New Entry is converted to Invoice Management.
- The original WorkDesk New Entry is now closed/archived as Converted to Invoice.
- Active Task and Dashboard ignore converted intake rows so only the real invoice task remains.

After upload: hard refresh Ctrl + F5.
