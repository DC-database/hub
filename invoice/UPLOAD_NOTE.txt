IBA System Patch 11.2.6 — WorkDesk Dashboard Smart Sync

Upload these files only:
- app.js
- index.html
- version.json
- js/app-workdesk-dashboard.js

Purpose:
- Keep WorkDesk Dashboard visible and stable.
- If cached counts are old, show cache first then quietly rebuild verified counts in the background.
- When WorkDesk Job Entry / IPC changes arrive through workdesk_job_recent, apply the changed job record and recompute Dashboard cards without clearing the visible All Active section.
- Prevent the old visible cycle: count/card visible -> dash/blank/checking -> visible again.

Protected:
- 11.2.5 IPC Application / IPC Processed cards remain visible.
- 11.2.4 Batch Entry attention routing remains included through existing uploaded files.
- 11.2.3 Invoice Entry side panel guard remains included through existing uploaded files.
- Inventory is not touched.

After upload:
1. Hard refresh Chrome (Ctrl + F5).
2. Open WorkDesk Dashboard.
3. Leave it idle for 3 minutes.
4. Counts should not disappear. If old cached counts are shown first, they should update quietly without needing manual Refresh.
