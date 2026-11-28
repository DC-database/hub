# Note for Claude — IBA Office and ESN print handoff

## Latest handoff for Claude at home — 28 November 2026

The office working copy is D:/IBA OFFICE/Project_01/Live. At home, open Project_01/Live on the flash drive; its drive letter may differ. The Obsidian vault is the sibling folder Iris Knowledge. Start here and compare with GitHub before replacing files, since deployment of these changes has not been confirmed.

### Implemented locally

- **My Desk → Active Tasks** uses the signed-in user's existing Active Task data. It groups SRV Done, In Process, CEO Approval, and other tasks. It reuses the existing task buttons and INV/SRV preview. Open goes to the full task screen when needed.
- **My Desk → Under Review tools** has Download Under Review CSV, Add Waiting POs to Pull Out, and Open PO Pull Out. Under Review CSV also works from the Office Command box. It exports the saved snapshot by vendor A–Z. Older batches can be reconstructed from available records and may have missing fields.
- **PO Pull Out** checks unique POs after successful Rina collection and queues Active Progress-PO matches. Existing waiting batches can be checked via “Which POs should I pull?” or queued via the desk button. Mark Pulled only after taking the paper original, then Proceed to mark checked POs Inactive.
- **Chat** suppresses automatic opening of main Messages while AI Office is open. Outside Office, normal auto-open rules still apply. Opening the native Office chat for a reply when its panel is closed remains pending.

### Deploy and verify

- Current files for the complete update: index.html, js/iba-office.js, js/iba-office-boot.js, js/iba-1705-release.js, and js/app-chat.js. The Office loader tag is 18.0.0-p174-active-desk. Syntax checks passed for edited JavaScript. Verify the deployed version and test in the browser.
- Verify an assigned task appears under the right status and an available task action works. Save a small Rina set, start it, and verify the CSV remains available and sorted A–Z. Confirm that the pull-out list opens inside Office, each qualifying PO is listed once, and PO status changes only when the operator uses Pulled and Proceed.
- Test an incoming reply with AI Office open and closed. The main Messages popup should auto-open only outside Office under its normal conditions.

### Planned work

Use the Iris Knowledge notes for Summary Review with printout confirmation and recovery, PO reporting, and reassignment of returned invoices. Keep planned commands distinct from deployed behavior. For Summary Review, retain the existing SUM label and previous-summary rule (With Accounts or Paid), reuse A4 Color, and require paper verification before CEO Approval. Keep the existing ESN print route and its A4 Color settings intact.

Hey Claude, brother — I’ve continued the Office design work in the actual app. Please use this note and the checklist to see what is really done.

## Design work in patch 150

The old compact map has been replaced in the source with a larger open-plaza floor plan. The requested Accounts, Procurement, and Site teams have 4, 4, and 6 workstation positions. Reception is by the single Main Entrance / Exit. I kept the existing invoice cabinet IDs, data filters, counts, print tray, and click actions connected to their live data and moved their visual furniture into the new layout.

Irwin said the earlier isometric Canvas 2D preview still looked flat and explicitly authorized replacing that renderer. Patch 149 adds a Three.js WebGL scene made from actual 3D meshes: tiled floor, thick exterior walls and window bays, a door at the shared Main Entrance / Exit, volumetric furniture, procedural male human models, and bot models. Low glass dividers define offices and shared departments, with two-cell door openings; those openings are also respected by staff pathfinding. People swing their arms and legs while moving. The center IBA letters use extruded geometry and rotate above a fixed metal base labeled IBA OFFICE. The existing live cabinet data, counters, click actions, office commands, and Super Admin-only gate remain in iba-office.js.

Patch 150 responds to Irwin’s screenshot: it fixes the floor-tile material darkening, brightens the Pixel Neon floor and walls, softens and lowers the dividers, slightly enlarges shared desks, chairs, and people, and scales up the rotating IBA lettering and fixed IBA OFFICE base. Switching themes rebuilds the same 3D layout and furniture using the selected palette. The renderer loads pinned Three.js r187 as an ES module from jsDelivr and tries unpkg if the first CDN fails. The source is integrated but still needs a browser visual pass; do not claim the final appearance is approved yet. Generated sprite atlases remain as design references under design/ai-office/.

## What is not finished

Please don’t call the visual work complete yet. Irwin's screenshot showed the floors too dark, dividers too strong, furniture/people too small, and center IBA display hard to see; patch 150 addresses those exact issues. I re-opened the current Chrome window for review, but IBA showed the "opened somewhere else" session lock, so I left the account session untouched. The revised browser rendering still needs sign-off. See AI-OFFICE-BUILD-CHECKLIST.md for remaining spacing and alignment checks. The 16-avatar gallery is not wired to an avatar selector.

Irwin explicitly approved adding the low glass dividers with wide walk-through openings. They are now in the WebGL scene, and pathfinding blocks the solid divider sections while allowing traversal through the openings. Keep those openings aligned if you adjust room boundaries.

## Your functional work

Irwin assigned me the appearance and floor-plan work. He assigned you the Brain/bot commands, approval workflow, task execution, business automation, and ESN printing. Both automatic printing and manual Print were reported as not working. The earlier file:// launch had a CORS error reading item-photo/list.json, so that run did not verify the web app. Please use a local HTTP server, confirm A4 Color, and verify that a successful current invoice print leaves Ready to Print and appears in Printed and skipped. Don’t report it fixed until the physical print and list/history behavior are confirmed.

The project folder is E:\project\Invoice\18.0.0\Project_01\Live. The p149 pre-3D rollback is E:\project\Invoice\18.0.0\Project_01\Backup\backup-before-3d-office-p148; the pre-divider pass is E:\project\Invoice\18.0.0\Project_01\Backup\backup-before-3d-office-finish. Patch 150's pre-change snapshot is E:\project\Invoice\18.0.0\Project_01\Backup\backup-before-office-visual-correction-p149. Older p147 backups and Irwin’s separate manual backup remain available.

Thanks, brother. Keep the checklist as the source of truth and keep consequential bot actions approval-first.
