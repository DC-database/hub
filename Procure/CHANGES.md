# Procurement Hub v8.0 (sorting hat)

Copy every file and folder here over your current app (index.html, app.js, style.css), and also upload the new ones: manifest.webmanifest, sw.js, icons/.

## Sorting hat (replaces the item assistant flow)
- Type an item. The hat picks the best of the 5 main categories by itself, shows how well it fits each one (%), says how sure it is, and explains why.
- Then it shows the best class + group in that category, plus the best place in the runner-up category.
- It learns from how your catalog is already filed, and adds built-in construction knowledge, so it also handles items the catalog has never seen (timber, asphalt, salary...). It fixes typos (cabel -> cable).
- Tested on 1,673 catalog items it had not seen: right category 84% of the time, 94% when it says "Sure".
- With a Groq key in Settings, the AI gets the shortlist and evidence and makes the final call.
- You can still pick the category yourself (chips under the answer).

## Install as an app
- An "Install app" button appears in the top bar in Chrome/Edge. On iPhone/iPad: Share > Add to Home Screen.
- Needs the site served over https (GitHub Pages, Firebase Hosting...). Opening index.html as a file cannot install.
- The app opens offline with the last catalog it downloaded.

## Recent new items
- Shows only items added in the last 7 days ("Show older too" for the rest).
- Copy buttons next to each part code and description, and "Copy all for Excel".
- New items save who created them. Only the super admin sees the "Added by" column. Items created before this update show "Unknown".

## Descriptions in CAPS
- Create, edit and import always save descriptions in capitals.

## 8.0.1: silent updates
- `version.json` says which patch is live. The app compares it with `APP_VERSION` at the top of the "SILENT UPDATES" section in app.js.
- It checks when the app opens, and when someone comes back to the tab (at most every 30 minutes). Nothing runs in the background.
- If the versions differ, it reloads quietly. If the person is busy (a window open, typing, sorting hat open), it waits until they leave the tab or finish. The cart is kept.
- **To release a patch:** change `APP_VERSION` in app.js and `"version"` in version.json to the same new number, then upload both.
- Uses no Firebase: version.json comes from your website.
