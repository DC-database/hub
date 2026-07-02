IBA WorkDesk 10.0.1 — Site Pin Clear Traffic Color Patch

Upload these files only:
- index.html
- style.css
- js/app-workdesk-dashboard.js

Changed:
- Updated All Active site card pin colors to avoid orange/red confusion.
- 0–2 days = green.
- 3–7 days = yellow-green.
- 8+ days = yellow.
- 30+ days = red blinking.
- Corkboard note top strips follow the same clear color logic.
- No Firebase save/write/workflow logic changed.

Manual app.js visible version:
const APP_VERSION = '10.0.1';
