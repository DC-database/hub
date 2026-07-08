IBA 10.9.8 — Invoice Entry Quick Access Side Panel UI Patch

Upload after 10.9.7.

Changed files:
1. index.html
2. style.css

What changed:
- Moved Invoice Entry quick status buttons out of the footer.
- Added a slim right-side Quick Access panel inside the Invoice Entry modal body.
- Footer is now simple again:
  Left: PO / Site / Vendor
  Right: Close
- Quick Access buttons are vertically arranged in their own side column.
- Updated style.css cache version in index.html to ?v=10.9.8.

Not changed:
- No Firebase/database logic changed.
- No invoice saving/update/delete logic changed.
- No status workflow logic changed.
- No WorkDesk Dashboard logic changed.
- No PDF/report/SRV logic changed.
