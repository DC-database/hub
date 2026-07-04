IBA WorkDesk 10.3.0 PATCH

Purpose:
- Fix Active Task New Entry tab disappearing after updating a normal invoice in Invoice Management.
- Preserve 10.2.9 accuracy restore for For SRV / On Hold / real invoice source-of-truth.

Cause fixed:
- Invoice Entry update could clear allSystemEntries while WorkDesk cached entries were still considered fresh.
- Active Task then rebuilt from an empty combined list, so Job Entry / New Entry tabs disappeared until full page reload.

Changed files:
- index.html
- app.js
- js/app-data-cache.js

No IPC workflow, Firebase paths, status routing, Dashboard segregation, or style changes were made.
