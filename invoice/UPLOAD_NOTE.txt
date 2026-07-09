IBA System Patch 11.0.0
WorkDesk Dashboard Search / Clear / Category Highlight Patch

UPLOAD AFTER: 10.9.9

Changed files:
- index.html
- style.css
- js/app-workdesk-dashboard.js

What changed:
1. Added a Clear button beside the WorkDesk Dashboard search box.
2. Clear resets Dashboard search text, selected All Active category card, selected site/vendor card, search highlights/grey-out, and the yellow-note result area.
3. Dashboard search remains flexible/contains-based.
4. In Dashboard global search mode, matching results are grouped by Site for all matching categories, including For Summary.
5. Direct click on For Summary still keeps the existing vendor-grouped For Summary behavior.
6. When a searched site card is selected, the All Active category cards above highlight only the categories represented by that selected site. Unrelated category cards are greyed out.

Not changed:
- WorkDesk Job Records search behavior
- WorkDesk Active Task page
- Inventory module
- Invoice Entry / Batch Entry
- Firebase workflow/status saving logic
- Attention routing logic
- Dashboard category names/count rules
