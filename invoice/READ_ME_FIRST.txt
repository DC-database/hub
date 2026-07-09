IBA 12.0.0 - System Version Update Notice Patch

Upload these files/folders to the SAME live folder where index.html is located:

1. index.html
2. style.css
3. js/app-version-checker.js
4. version.json

IMPORTANT:
- version.json must be beside index.html, not inside the js folder.
- Current version inside this patch is 11.0.1.
- version.json is also set to 11.0.1.

How it works:
- Users who refresh/load 11.0.1 will now have the update checker.
- The browser checks ./version.json when the page opens, every 2 minutes, and when the tab becomes active again.
- If version.json is newer than the browser-loaded version, a System Update Available notice appears.
- Clicking Update Now refreshes the page with a cache-busting URL.
- Clicking Later hides the notice for about 15 minutes.

How to test:
1. Upload this 11.0.1 patch.
2. Open the system and confirm no update notice appears while version.json says 11.0.1.
3. Change only version.json to 11.0.2 and upload it.
4. Wait up to 2 minutes or switch away/back to the browser tab.
5. The update notice should appear.
6. After testing, set version.json back to 11.0.1 unless the actual system is already updated to 11.0.2.

Not changed:
- Dashboard logic
- Job Records logic
- Active Task
- Inventory
- Invoice Entry / Batch Entry
- Firebase data or workflow rules
