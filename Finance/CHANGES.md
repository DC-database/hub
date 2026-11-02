# IBA Finance 6.0.0

## Before you go live (3 steps)

1. **Super Admin.** Done: `dc@iba.com.qa` is set as Super Admin in `app.js` (`SUPER_ADMIN_EMAILS`). Add more emails to that list if needed.
2. **Firebase indexes (needed for the small downloads).** In the Firebase console, open project `payment-report-23bda`, then Realtime Database > Rules. Keep your current rules, add the two `.indexOn` blocks below inside `"rules"`, and press Publish:

   ```json
   "payments": { ".indexOn": ["poNo", "updatedAt"] },
   "payments_deleted": { ".indexOn": ".value" }
   ```

   If `payments` already has a block in your rules, add only the `".indexOn"` line to it. Without these indexes the app still works, but each check downloads the whole payments list again.
3. **Upload every file in this folder** to `hub/Finance` on GitHub. That includes the `icons` folder, `manifest.webmanifest`, `sw.js`, `pwa.js`, `teller.js`, `teller.css` and `version.json`. `styles.css` from version 5.9 is no longer used; the new file is `style.css`.

Close any old 5.9 tabs after the upload. Version 5.9 does not stamp its saves, so other browsers only see those saves at their weekly full check, or when someone uses "Reload all records".

## Low download "pocket" (10 GB limit)

- Each browser keeps a copy of all payments. The first visit downloads everything once.
- After that, every visit reads one tiny stamp (`payments_meta`, a few bytes). If nothing has changed, nothing else is downloaded.
- If something has changed, the app downloads only the payments saved or edited since that browser's last visit, plus the ids of deleted payments (`payments_deleted`).
- Search, PVN numbers, the dashboard, certificates, export and the teller all read the browser copy, so they cost nothing.
- Once a week each browser does one full check to stay safe. The avatar menu has "Reload all records" for the same thing.
- The vendor list comes from `Vendors.csv` on GitHub and is kept for 12 hours (no Firebase download).

## Fixes

- **Save as New** always takes the next free PVN and asks first: "Create PVN-4? PVN-1 stays as it is", with Cancel, Update instead, or Create.
- **Editing** keeps the original Date Entered.
- **Logging out and back in** no longer makes every button work twice.
- **CSV import** handles commas inside vendor names and amounts.
- Text such as vendor, site and notes is made safe before it is shown.
- **Warnings** appear when retention is more than the certified amount, when total certified goes over the PO value, and when the PO is not 5 digits.

## New

- **One smart search box** with **Auto / PO / Site / Vendor** buttons above it. In Auto, 5 digits is a PO; any other number, a letter plus a number (170, 1111, M1111) or "site 170" is a site; words are a vendor. Press PO, Site or Vendor to search only that; the choice is remembered.
  - Vendor search finds any word of the name ("khalifa" finds "KHALIFA AL KUWARI AND SONS…"), forgives small typos ("kahlifa"), and also matches the vendor ID.
  - Vendors in the vendor list that have no payments yet are listed under the results.
- **Background** is also in the account menu under your name (Super Admin only).
- **Dashboard:** waiting payments, retention held, paid this month and POs over 90% certified. Click a tile to see the list.
- **PO view:** a progress bar for paid and waiting, the totals, and the payment history (cards on a phone).
- **Export all to CSV.** A backup also downloads automatically before Delete All or a replace import.
- **Install as an app:** an "Install app" button on Chrome and Edge, or Share > Add to Home Screen on iPhone. Silent updates come through `version.json`: when you upload a new version, change `APP_VERSION` in app.js and `version` in version.json to the same number.
- **Teller robot:** the officer robot with idle moves (looking around, coin flip, counting money, vault, salute, dozing). He fades to 30% when you are not using him.
  - The chat works without any key for simple asks.
  - An optional AI key (Groq is free) lets him understand free text. The key stays only in that browser.
  - He never saves, edits or deletes anything.
- **Settings > Background (Irwin only):** choose a photo and the darkness for desktop and for phone, then Save to apply it for everyone. The setting is stored at `system_settings/finance_background`.
- **Irwin only:** Delete All, the replace import and the vendor upload.
