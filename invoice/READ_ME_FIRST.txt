IBA WorkDesk 9.5.2 - ECommit Optional Load Fix

Upload/replace:
1. index.html
2. js/app-data-cache.js

Fix:
- F5/browser refresh should no longer stop with: CRITICAL ERROR: Could not load Ecommit data.
- ECommit.csv is now treated as optional supporting data.
- Invoice Management can continue with Firebase invoice records if ECommit.csv is temporarily unavailable.

Manual visible version update, optional:
- In app.js, change APP_VERSION to '9.5.2' if you want the welcome screen to display V 9.5.2.
