/* 18.0.0 patch 164 (martin): IRIS brain = the Obsidian vault "Iris Knowledge" (D:\IBA OFFICE\Project_01\Iris Knowledge),
   bundled here as plain data. Built 2026-11-28 13:45 UTC from 22 notes. Do not edit by hand: martin edits the notes in
   Obsidian and asks "refresh brain"; this file is rebuilt from the folder.
   It comes from GitHub with the other app files, so reading it costs NO Firebase download.
   - window.ibaKnow.find(text)  -> best notes for a question (only notes this person may see)
   - window.ibaKnow.ask(text)   -> { list:true } | { id } when IRIS should answer from a note without the AI
   - window.ibaKnow.prompt(text)-> short extra text for the AI (only the 1-2 matching notes)
   - window.ibaKnow.html(data)  -> the "From IRIS notes" card
   Note properties in Obsidian (optional): iris-who: all | super (default super, except PO lookup / PO report),
   iris-status: ready | planned, iris-words: extra search words. */
(function () {
    'use strict';
    if (window.ibaKnow) return;
    var NOTES = [
 {
  "id": "ai-office",
  "title": "AI Office",
  "who": "super",
  "status": "ready",
  "links": [
   "Summary Review",
   "ESN printing",
   "PO lookup",
   "PO report",
   "Rina collection",
   "Reception and invoice routing",
   "Office commands",
   "IBA Office rooms and bots",
   "PDF folders and naming",
   "Office for other users",
   "Reassign returned invoices"
  ],
  "words": "",
  "text": "- [[Summary Review]]\n\nProcedure notes for AI Office and Iris in Invoice 18.0.0.\n\n- [[ESN printing]]\n- [[PO lookup]]\n- [[PO report]]\n- [[Rina collection]]\n- [[Reception and invoice routing]]\n- [[Office commands]]\n- [[IBA Office rooms and bots]]\n- [[PDF folders and naming]]\n- [[Office for other users]]\n- [[Reassign returned invoices]]"
 },
 {
  "id": "batch-entry-and-summary-notes",
  "title": "Batch Entry and summary notes",
  "who": "super",
  "status": "ready",
  "links": [
   "Print summary notes",
   "CEO Approval",
   "Summary Review"
  ],
  "words": "batch sum summary note previous current vendor save cards",
  "text": "Batch Entry is a Super Admin page for changing many invoices at once.\n\n- Add invoices by PO, by status, or with skills: New entries to Batch (from Reception), SRV Done to Batch, Today's invoices.\n- Each card can get a new status, attention and note. Nothing changes until **Save**.\n- **SUM** gives the selected invoices a summary note name, for example \"ABC Company 21-Nov-2026\".\n- **Current note** = notes active now (For Summary, CEO Approval, In Process).\n- **Previous note** = the same vendor's newest earlier note that is finished (With Accounts or Paid).\n- If invoices move to a new note, the old empty note is removed so it is not offered as Previous.\n\nNext: [[Print summary notes]], [[CEO Approval]]. Planned upgrade: [[Summary Review]]."
 },
 {
  "id": "ceo-approval",
  "title": "CEO Approval",
  "who": "all",
  "status": "ready",
  "links": [
   "Batch Entry and summary notes",
   "Print summary notes",
   "Invoice flow",
   "Mark urgent"
  ],
  "words": "ceo managing director sign signature approve summary paper",
  "text": "- The CEO signs CEO Approval **on paper**, on the printed summary note. It is not approved by tapping in the app.\n- Printed documents show **Managing Director** as the signature title, never \"CEO\".\n- Invoices reach CEO Approval as a summary set prepared by the Super Admin. See [[Batch Entry and summary notes]] and [[Print summary notes]].\n- After signing, the set moves on (In Process, then With Accounts). See [[Invoice flow]].\n- Urgent is not used for CEO Approval. See [[Mark urgent]]."
 },
 {
  "id": "esn-printing",
  "title": "ESN printing",
  "who": "super",
  "status": "ready",
  "links": [
   "AI Office"
  ],
  "words": "",
  "text": "In IBA Office, a Super Admin can select the printer to open Ready to Print. Check printer status and the Windows queue, then select the ESN to print. Use A4 Color when verifying a current invoice.\n\nCheck the physical page and confirm the ESN moves to Printed and skipped. The app can mark it printed when it sends the page to the printer. If a job stopped halfway and the page physically printed, use the It printed button when available.\n\nSources: Invoice 18.0.0 PATCH.txt and AI-OFFICE-BUILD-CHECKLIST.md. Physical printing still needs verification.\n\nRelated: [[AI Office]]"
 },
 {
  "id": "firebase-download-rules",
  "title": "Firebase download rules",
  "who": "super",
  "status": "ready",
  "links": [
   "Office for other users",
   "AI Office"
  ],
  "words": "firebase download limit gb quota data usage cost",
  "text": "- Each Firebase project has a **10 GB download limit per month**. It resets monthly.\n- **Pockets first**: every feature reads the saved copies (\"pockets\") first: invoices, Job Records (Reception), material stock. Firebase is read only when the item is really not in the pocket, and then only that one item.\n- Never read the full invoice_entries tree. The app keeps a saved copy on each PC and reads only the changes.\n- Inventory (material stock and transfers) also uses a saved copy plus changes.\n- Chat, presence, reminders and requests live in their own database (ibachat), not the main one.\n- IRIS notes come with the app files from GitHub, so they cost no Firebase download.\n- IBA Office: Irwin's office (bots) about 10-20 MB a working day; another user's office only reads their own task list (under 1 MB a day). See [[Office for other users]].\n- Firebase does not charge per user; the only risk is the monthly download limit.\n- Friday is off, Saturday is light, and heavy work starts Sunday.\n\nRelated: [[AI Office]]"
 },
 {
  "id": "iba-office-rooms-and-bots",
  "title": "IBA Office rooms and bots",
  "who": "super",
  "status": "ready",
  "links": [
   "Office for other users",
   "Rina collection",
   "Reception and invoice routing",
   "PDF folders and naming",
   "Office commands",
   "ESN printing",
   "AI Office"
  ],
  "words": "office rooms bots rina sami robot cabinet desk tray room build layout count badge",
  "text": "IBA Office is a page inside the app (Office BETA in the menu). Irwin has the full office with the bots. People Irwin ticks in Skill access (IBA Office (guest)) get a guest office with only their own work, no bots: see [[Office for other users]].\n\n- **Rooms**: Reception, Bot room, Logistics, your office, Managing Director, Finance, HR, Accounts, COO, Project Director, Meeting, Site room, Warehouse, Break, Pantry.\n- **People stay seated**; an empty chair means the person is offline or away. Only bots walk.\n- **Rina** collects Reception entries into Under Review. See [[Rina collection]].\n- **Sami** routes: For SRV to the site person, Report to Gio. See [[Reception and invoice routing]].\n- **Your desk tray** shows the Under Review set sorted by site. Done sends it, with 10 seconds to Undo.\n- **Cabinets** hold the status lists. INV and SRV open the PDFs; LPO opens Find LPO for that PO. See [[PDF folders and naming]].\n- **Build mode** (Super Admin) moves furniture; Save writes `js/iba-office-layout.js` in Live. Record cabinets, counts and the bots' walking stops follow the **saved** layout. If a record cabinet is deleted, its list moves to the nearest cabinet in that room, else the person's desk (Managing Director's count = his desk).\n- The **info robot** in the hall searches a vendor, PO, invoice number or site and drops one folder per department. **Clear** empties the search.\n- Commands for the bots: see [[Office commands]]. Other users: see [[Office for other users]].\n- The **printer** opens Ready to Print. See [[ESN printing]].\n\nRelated: [[AI Office]]"
 },
 {
  "id": "invoice-flow",
  "title": "Invoice flow",
  "who": "all",
  "status": "ready",
  "links": [
   "Reception and invoice routing",
   "CEO Approval",
   "Mark urgent",
   "Payment days and Paid",
   "PO lookup",
   "Batch Entry and summary notes",
   "Material transfers",
   "Passwords and sign-in",
   "AI Office"
  ],
  "words": "status statuses steps journey lifecycle where is my invoice",
  "text": "How an invoice moves through the IBA system, step by step.\n\n1. **New Entry.** Reception receives the vendor invoice and records a WorkDesk job entry (type Invoice). See [[Reception and invoice routing]].\n2. **Under Review.** The invoice is registered in Invoice Entry. Under Review means it is entered and waiting to be sorted.\n3. **For SRV or Report.** For SRV goes to the site DC (Head Office DC for head-office items) to confirm the delivery. Invoices with IPC in the number go to Report (QS).\n4. **SRV Done.** The site confirmed the delivery.\n5. **Approvals when needed.** For Approval, then [[CEO Approval]] for summary sets. See [[Mark urgent]].\n6. **With Accounts.** Handed to Accounts, waiting for a payment day. See [[Payment days and Paid]].\n7. **Paid.** Only this status means the invoice is paid.\n\nEvery invoice keeps a history of who changed its status and when. To check one, ask IRIS \"Show me PO 12345\" ([[PO lookup]]).\n\nOther notes: [[Batch Entry and summary notes]], [[Material transfers]], [[Passwords and sign-in]], [[AI Office]]."
 },
 {
  "id": "mark-urgent",
  "title": "Mark urgent",
  "who": "all",
  "status": "ready",
  "links": [
   "CEO Approval",
   "Invoice flow"
  ],
  "words": "urgent rush priority fast approval tick",
  "text": "Urgent is only about getting an invoice **approved faster**.\n\n- Tick ⚡ Urgent on the invoice, or ask IRIS to mark it urgent. The note text is not changed.\n- Urgent counts only while the invoice is **For Approval**. It clears by itself once the approver acts (any other status).\n- The person who marked it, or the Super Admin, can untick it.\n- CEO Approval is not offered for urgent, because the CEO signs on paper. See [[CEO Approval]].\n\nRelated: [[Invoice flow]]"
 },
 {
  "id": "material-transfers",
  "title": "Material transfers",
  "who": "all",
  "status": "ready",
  "links": [
   "Invoice flow"
  ],
  "words": "inventory stock trf stk use ret transfer restock return usage material who must act",
  "text": "Control numbers: TRF (transfer), STK (restock), USE (usage), RET (return). Ask IRIS the number, for example \"TRF-0361\", to see who must act now.\n\n- **Transfer**, 3 steps: the source site contact confirms and sends (Pending Source), the admin or approver authorizes (Pending Admin, stock leaves the source), the receiver confirms receipt (In Transit, stock is added). Then Completed.\n- **Restock and Return**: approver, then receiver.\n- **Usage**: approver, then the requester confirms the actual usage (Pending Confirmation).\n- A 5-digit number with \"vehicle\", \"plate\", \"truck\" or \"material\" is a vehicle, not a PO.\n\nRelated: [[Invoice flow]]"
 },
 {
  "id": "office-commands",
  "title": "Office commands",
  "who": "super",
  "status": "ready",
  "links": [
   "Reassign returned invoices",
   "Rina collection",
   "IBA Office rooms and bots",
   "Reception and invoice routing"
  ],
  "words": "reassign move command commands type say bot rina sami rafi ana collect find call office box correct return undo back hafiz date day yesterday today nov thursday weekday",
  "text": "Type these in the IBA Office command box (Command pill). Use the exact words.\n\n## Rina collects from Reception\n- `rina collect` / `rina collect now` / `rina collect all`: collects **every** waiting Reception entry into Under Review on your desk.\n- `rina collect po 67486`: collects **only that PO**. If it stays, Rina says why (no PO, not in the PO list, already converted, not on your list).\n- `rina collect oscar` (vendor, close spellings work) or `rina collect site 175`: collects **only those**. Extra words like \"invoice from reception and send to my desk for under review\" are fine.\n- A name that matches nothing collects **nothing**; Rina says so and lists the vendors waiting at Reception.\n- **By day** (the day Reception made the entry): `rina collect nov 26`, `rina collect 26/11`, `rina collect yesterday`, `rina collect today`.\n- **By day name**: `rina collect thursday` / `rina collect last thursday` = the most recent Thursday in the last 7 days (never an older month or year). On a Thursday, `thursday` = today and `last thursday` = a week ago. Write the full day name (`sunday`, not `sun`), or `last thu`. Mix it: `rina collect oscar nov 26`, `rina collect site 175 yesterday`. Entries of other days stay at Reception.\n- With a name, PO, site or day, Rina also finds entries she **returned** in the last 3 days (now with Hafiz), so you can take them back the same way.\n- Plain `rina collect` takes only **your** Reception list (not the ones given back to Hafiz).\n- Rina also collects **by herself** Sun-Wed 4:00-4:30 PM and Thu 1:00-1:30 PM. To stop that for a day, untick \"Rina collects by herself\" on her card.\n\n## Rina returns to Reception (undo)\n- `rina return today's to Hafiz`: Rina lists what she collected **today** that is still Under Review, then waits. Type `yes` to do it (or `no`).\n- Each one: the invoice is removed, the Reception entry opens again as New Entry (Converted to Invoice taken off), attention = Hafiz (who entered it), and a \"Returned to Reception\" line goes in its history.\n- `rina return today's` (no name): back on **your** Reception list (Rina may collect them again at her next collection time).\n- `rina return oscar to Hafiz` / `rina return po 67486 to Hafiz`: only those.\n- Anything already sorted (not Under Review any more) is left as it is.\n\n- **Careful:** \"today's\" = every invoice Rina collected today, from **all** her runs (her 4 PM run too), not only the last one. To return only some, add a name, PO or day: `rina return oscar to Hafiz`, `rina return nov 27 to Hafiz`.\n\n## Move returned entries back (no collecting)\n- `reassign today's returned entries from Hafiz to Irwin` / `rina move returned to me` / `rina reassign oscar to irwin` / `rina move po 67486 back to me`: Rina lists them, you type `yes`. Only Attention changes; they stay New Entry at Reception. Then `rina collect ...` if you want them on your desk. See [[Reassign returned invoices]].\n\n## Find\n- `find PO 12345`: every invoice of that PO, with status and Attention.\n- `find oscar` / `rina find PO for multilink`: search by vendor (close spellings work).\n- `find site 175`, `search Imran`: by site or person.\n\n## Bots\n- `call Rina` (or Bot 1 to 4: Rina, Sami, Rafi, Ana): the bot comes to your office.\n- `Sami take a break`: the bot goes to the lounge for a short break.\n- Sending work by command is not built yet. Use the desk tray and Done.\n\nRelated: [[Rina collection]], [[IBA Office rooms and bots]], [[Reception and invoice routing]]"
 },
 {
  "id": "office-for-other-users",
  "title": "Office for other users",
  "who": "super",
  "status": "ready",
  "links": [
   "PDF folders and naming",
   "Firebase download rules",
   "IBA Office rooms and bots",
   "AI Office"
  ],
  "words": "office other users coo finance manager guest access pilot turn on allow who can see my work desk firebase cost limit skill access",
  "text": "BUILT in **18.0.0 patch 172**. Irwin's own office is unchanged (bots, Setup, Build, Ready to Print).\n\n## Who gets it\n- Irwin turns it on in **Skill access** (same window as the skills): row **IBA Office (guest)**, group Office. Pick positions and/or named people. Saved in `system_settings/skill_access/iba_office`.\n- Nobody is ticked = only Irwin. Pilot: **COO, Finance Manager and 2 normal users** (1 Accounts, 1 Site).\n- They see the **Office** menu on a PC only (not on the phone).\n- Put them in their room in Irwin's **Setup** (people in rooms). Not placed yet = they see the whole office.\n\n## What a guest sees\n- **My work** on the right: only **their own tasks** = the same lists as their Active Task (invoices) and Inventory Active Job (transfers). Search box, Refresh.\n- A **cabinet** click = their own tasks in that step (e.g. COO cabinet = their In Process). \"Show all\" goes back.\n- Their own avatar: Lunch / Toilet / Meeting / Back, Say to everyone. Other people: Chat, Wave, Walk over.\n- **No bots**, no Setup, no Build, no Characters, no Ready to Print, no other people's cabinets.\n\n## What a guest can do\n- Exactly the buttons they already have in Active Task: **Approve / Reject**, **SRV Done**, **Process** (Forward for approval, Hold ...), Close out. \"Open\" = the task in Active Task.\n- Transfers: **Open in Active Job** (approve there).\n- **INV / SRV** open in the PDF side panel from their own **DC Files** folder (see [[PDF folders and naming]]). LPO is not in the guest desk.\n\n## Firebase and cost\n- Their desk reads **nothing new**: the task lists are already in memory after sign-in (pockets first, see [[Firebase download rules]]). It **never** loads the full invoice copy.\n- While open: office setup once (`system_settings/office_v1`, tiny), who is online + office chat (chat database), \"I'm in\" saves. About **10-30 KB per open**.\n- PDFs come from the user's own PC folder: no download from Firebase, no helper.\n\nRelated: [[IBA Office rooms and bots]], [[AI Office]]"
 },
 {
  "id": "pdf-folders-and-naming",
  "title": "PDF folders and naming",
  "who": "super",
  "status": "ready",
  "links": [
   "IBA Office rooms and bots",
   "Invoice flow",
   "ESN printing"
  ],
  "words": "pick dc files folder allow folder pdf folder name naming inv invoice srv report lpo sharepoint onedrive dc files proc print helper panel open not found missing wrong file other users helper needed",
  "text": "INVOICE and SRV files are named **differently**. Never mix them.\n\n| Kind | File name (made by the invoice system) | Folder on Irwin's PC |\n|---|---|---|\n| **INV** | `Site-PO-INVID-Vendor` (vendor cut to 21), e.g. `M40-67165-INV-02-Oscar Marble Trading` | `C:\\Users\\Irwin\\OneDrive - IBA\\DC Files\\INVOICE` |\n| **SRV** | `YYYYMMDD-PO-INVID-Site-Vendor`, e.g. `20261121-67165-INV-02-M40-Oscar Marble Trading` | `C:\\Users\\Irwin\\OneDrive - IBA\\DC Files\\SRV` |\n| **Report** | `PO-INVID-Vendor(15)-Report` | DC Files (Report) |\n| **LPO** | `LPO# <PO>-Vendor-Work-Site`, names are mixed | `C:\\Users\\Irwin\\OneDrive - IBA\\Proc - LPO` |\n\n- The SRV date is the day the SRV name was made (when the invoice went to With Accounts / SRV Done), not the invoice date.\n- The INV / SRV buttons use the name **saved on the invoice** (invName / srvName). If a button says \"No PDF called ...\", compare that name with the file in the folder: one letter or space different = not found.\n- **LPO**: the LPO button opens **Find LPO** already searching that PO, and you pick the file. Rina never guesses an LPO file by name (that once opened a CVS invoice for Khalifa).\n- The PDF opens in the **side panel** with Print: on Irwin's PC through the print helper, on other PCs from their own DC Files folder.\n\n## Other users (no helper needed, patch 172)\n- Other users do **not** need the print helper. Everyone has the shared **DC Files** folder synced on their own PC (OneDrive - IBA \\ DC Files).\n- The first time they press INV or SRV, the side panel asks **\"Pick my DC Files folder\"** (Chrome / Edge folder picker). Pick the DC Files folder itself (it has INVOICE and SRV inside). The browser remembers it.\n- After the browser restarts it may ask **\"Allow folder\"** once: one click.\n- INV is read from `DC Files\\INVOICE`, SRV from `DC Files\\SRV` (sub-folders too), same name rules as above. Nothing is uploaded, nothing is read from Firebase.\n- \"Open in the PDF window instead\" = the old SharePoint window.\n- Invoice Records keeps the old PDF window until that PC has picked the folder once (or has the helper).\n- On Irwin's PC the helper is used first; if it is off, the picked folder is used.\n- **LPO** is different: Find LPO reads the Proc - LPO folder **synced on that PC** (picked once, PC only).\n\n## Print helper (Irwin's PC only)\n- Lives in `D:\\IBA OFFICE\\print-helper` and starts hidden with Windows. It reads the INVOICE, SRV and Proc - LPO folders and prints on **A4 Color**.\n- If SRV or LPO say \"not found\" but the file is there, an **old helper** is still running. Double-click `D:\\IBA OFFICE\\print-helper\\Install print helper.bat`: it stops any old helper (even one from the old USB / E: folder) and starts the new one. The key stays the same.\n- `helper.log` there shows \"could not start on port 47123\" when an old one blocks it.\n\nRelated: [[IBA Office rooms and bots]], [[Invoice flow]], [[ESN printing]]"
 },
 {
  "id": "po-lookup",
  "title": "PO lookup",
  "who": "all",
  "status": "ready",
  "links": [
   "PO report"
  ],
  "words": "",
  "text": "Ask Iris \"Show me PO 12345\" and replace the example number with the PO you need. Iris recognizes a PO number in the request and routes it to the PO tracking card. Use the card to check the current record.\n\nSource: Invoice 18.0.0, js/iba-1800-mind.js.\n\nRelated: [[PO report]]"
 },
 {
  "id": "po-report",
  "title": "PO report",
  "who": "all",
  "status": "ready",
  "links": [],
  "words": "",
  "text": "In AI Office Command mode (Super Admin), use PO report 66850 or Vendor report Oscar. Replace the number or vendor as needed. The preview shows a status pie chart, PO and invoice totals, and the available invoice records and recorded history. Review the preview, choose Print report, and select A4 Color in the browser print dialog. Vendor reports may be limited to the available preview; use a PO number for a specific PO. The report does not change invoice status."
 },
 {
  "id": "passwords-and-sign-in",
  "title": "Passwords and sign-in",
  "who": "all",
  "status": "ready",
  "links": [
   "Invoice flow"
  ],
  "words": "password login sign in forgot reset clear save remember logout",
  "text": "- Sign in with your **IBA mobile number** and password.\n- **Save the password**: after signing in, press Save when the browser offers it. Next time the number and password fill in by themselves.\n- **Forgot password**: on the login screen, type your mobile and use Forgot password. WhatsApp opens with a message to the Super Admin.\n- The Super Admin can **clear** your password. Then sign in with just your mobile and make a new password right away.\n- A **temporary** password from the Super Admin must be changed at the first sign-in.\n- A password needs at least 6 characters, letters and numbers, for example bara26.\n\nRelated: [[Invoice flow]]"
 },
 {
  "id": "payment-days-and-paid",
  "title": "Payment days and Paid",
  "who": "all",
  "status": "ready",
  "links": [
   "Invoice flow"
  ],
  "words": "payment pay paid when money accounts saturday tuesday released",
  "text": "- **With Accounts** means the invoice is with Accounts and waits for a payment day. Payment is in process, not done.\n- Accounts pay only on **Saturday and Tuesday**. Never say a payment is being prepared today.\n- **Paid** is the only status that means paid. SRV Done, approvals, On Hold and others mean not paid yet. \"Invoiced\" means received, not paid.\n- Marking an invoice **Paid is Accounts' job**. If an invoice still needs it, say \"needs Accounts to mark Paid\".\n\nRelated: [[Invoice flow]]"
 },
 {
  "id": "print-basket-and-esn-stickers",
  "title": "Print basket and ESN stickers",
  "who": "super",
  "status": "ready",
  "links": [
   "ESN printing",
   "AI Office"
  ],
  "words": "sticker esn basket print label approved",
  "text": "- The **print basket** (Super Admin) collects stickers to print together. After each add, choose \"Add more\" or \"Print all\".\n- \"Move to Batch Entry\" sends the basket's invoices to Batch Entry.\n- The **ESN sticker** is small (46 x 15 mm). Its last line is the approval date and time, for example 22/OCT/2026 THU 12:46AM.\n- Pick the place on the page (right bottom, right middle, right top) when printing.\n- In IBA Office, the printer opens Ready to Print. See [[ESN printing]].\n\nRelated: [[AI Office]]"
 },
 {
  "id": "print-summary-notes",
  "title": "Print summary notes",
  "who": "super",
  "status": "ready",
  "links": [
   "Batch Entry and summary notes",
   "CEO Approval"
  ],
  "words": "print summary a4 paper signature footer",
  "text": "- Print from the Summary Note screen, or ask IRIS for \"Print summary notes\".\n- The print is A4 portrait with a navy column header and a plain white total box.\n- The full invoice description prints, even when the screen shows it short.\n- The signature title is **Managing Director**.\n- The Previous and Current note names print as a faded line at the bottom of every page.\n- Print on A4 and check the paper against the screen before giving it for signature.\n\nRelated: [[Batch Entry and summary notes]], [[CEO Approval]]"
 },
 {
  "id": "reassign-returned-invoices",
  "title": "Reassign returned invoices",
  "who": "super",
  "status": "ready",
  "links": [
   "Office commands",
   "Rina collection",
   "Reception and invoice routing",
   "AI Office"
  ],
  "words": "reassign move take back returned invoice entries hafiz irwin attention reception job records",
  "text": "BUILT in **18.0.0 patch 174** (idea written with ChatGPT). Type it in the IBA Office command box.\n\n## Say it\n- `reassign today's returned entries from Hafiz to Irwin`\n- `rina move returned to me` (me = you), `rina reassign oscar to irwin`, `rina move po 67486 back to me`\n- A day (`nov 26`, `yesterday`, `today`) matches the day Reception **made** the entry **or** the day Rina **returned** it. Say `returned today` / `returned nov 27` to use only the return day.\n- `from Hafiz` = only entries now with Hafiz. Without `to ...` they go to you.\n\n## What Rina does\n1. Looks only at Reception entries she **returned** in the last 3 days (Job Records pocket first, no big download): still New Entry, with a \"Returned to Reception\" history line.\n2. Shows each one: PO, invoice no., vendor, who has it now, the day it was made and the day it was returned. Nothing changes yet.\n3. Type **yes** (or **no**). If the count is wrong, say it again with a PO, vendor or day. She never widens the search by herself.\n4. She rechecks each entry first. Only **Attention** changes (to the person you named). It stays **New Entry**, Entered by stays the same, and a \"Reassigned\" line goes in its history. Anything converted, archived or changed since the list is left as it is, with the reason.\n5. The entries then show in that person's Reception list. **Collecting** them into Under Review is a separate command: `rina collect` with the PO, vendor or day.\n\nRelated: [[Office commands]], [[Rina collection]], [[Reception and invoice routing]], [[AI Office]]"
 },
 {
  "id": "reception-and-invoice-routing",
  "title": "Reception and invoice routing",
  "who": "super",
  "status": "ready",
  "links": [
   "Rina collection",
   "PO lookup"
  ],
  "words": "",
  "text": "1. **Receive.** New invoice entries wait in Reception. Rina checks the PO, invoice number and amount, and checks for an invoice with the same number on that PO. If the checks pass, Rina converts the entry to an invoice in Under Review and closes the Reception entry as Converted to Invoice.\n2. **Hold exceptions.** Entries Rina cannot validate stay in Reception. Open Needs your answer to see why. For a missing PO, use Add PO now, then Check again. See [[Rina collection]] and [[PO lookup]].\n3. **Sort and confirm.** Open the Under Review set on Your desk. Review the suggested task and the Goes to recipient. Rina suggests Report for invoice numbers containing IPC and For SRV otherwise. Use Later to leave an invoice in Under Review. Save the reviewed set, then press Start on Rina's card.\n4. **Route.** Sami sends For SRV invoices to the designated site contact and Report invoices to Gio by default. Confirm the actual recipient shown by the app before starting. The app records the assignment in invoice history.\n\nSources: Invoice 18.0.0 PATCH.txt and js/iba-office.js (Reception collection, Under Review set, and Sami routing)."
 },
 {
  "id": "rina-collection",
  "title": "Rina collection",
  "who": "super",
  "status": "ready",
  "links": [],
  "words": "",
  "text": "In AI Office, enter `rina collect` to start collection or `rina collect po 67486` to target one PO. Replace the example number with the PO you want.\n\nIf an entry is held, check Needs your answer for the reason. For a missing PO, use Add PO now to open the same form used in Invoice Entry. Use Check again after resolving the issue.\n\nSource: Invoice 18.0.0, PATCH.txt, patch 162."
 },
 {
  "id": "summary-review",
  "title": "Summary Review",
  "who": "super",
  "status": "planned",
  "links": [],
  "words": "",
  "text": "Planned Iris workflow for preparing vendor summaries for CEO approval.\n\n1. Three eligible invoices flag a vendor for the roughly 10-day cycle. Say “Prepare summary now” to run it early using today's Qatar date.\n2. Review invoices by vendor. Combine In Process with SRV Done when the COO signature is verified. Add or remove invoices before printing.\n3. Use the existing SUM label for the current note. Use the same vendor's latest eligible With Accounts or Paid summary as the previous note. To merge new invoices into a held CEO Approval set, review and reprint the full revised set before replacing it.\n4. Print on A4 Color. Compare the physical printout with the on-screen list, then confirm to release the reviewed invoices to CEO Approval.\n\n## If something goes wrong\n\nHold the affected set and show the reason. If a print is uncertain, check the printer before choosing to reprint. If the invoice list or details change after printing, review and reprint. If only part of the release succeeds, show which invoices moved and recheck the remaining rows before resuming. Use the existing manual workflow when needed.\n\nSee the Claude handoff in Live for implementation and verification details."
 }
];
    var BUILT = '2026-11-28 13:45 UTC';

    function esc(v) { return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
    function isSuper() {
        try {
            var n = (typeof currentApprover !== 'undefined' && currentApprover && currentApprover.Name) || '';
            var s = (typeof SUPER_ADMIN_NAME === 'string' && SUPER_ADMIN_NAME) || 'Irwin';
            return !!n && n.trim().toLowerCase() === s.trim().toLowerCase();
        } catch (_) { return false; }
    }
    function visible() { var sup = isSuper(); return NOTES.filter(function (n) { return n.who === 'all' || sup; }); }
    function byId(id) { return visible().filter(function (n) { return n.id === id || n.title.toLowerCase() === String(id).toLowerCase(); })[0] || null; }

    // ---- matching: words of the title count 3x, extra words 2x, text 1x; rare words count more ----
    var STOP = ('a an the and or of to in on for with by at from is are was be it this that these those i me my we our you your do does did ' +
        'how what when where why which who can could should would will use using about show tell give please iris note notes there here then ' +
        'if as so not no yes get got make made have has need want work works working step steps way guide explain help').split(' ');
    var STOPSET = {}; STOP.forEach(function (w) { STOPSET[w] = 1; });
    function stem(w) { return w.replace(/(?:ing|ed|es|s)$/, '').replace(/(.)\1$/, '$1'); }
    function toks(s) {
        return String(s || '').toLowerCase().replace(/\[\[|\]\]/g, ' ').replace(/[^a-z0-9]+/g, ' ').split(' ')
            .filter(function (w) { return w.length > 1 && !STOPSET[w] && !/^\d+$/.test(w); }).map(stem);
    }
    var IDX = null;
    function index() {
        if (IDX) return IDX;
        var df = {};
        var docs = NOTES.map(function (n) {
            var w = {};
            toks(n.text).forEach(function (t) { w[t] = Math.max(w[t] || 0, 1); });
            toks(n.words).forEach(function (t) { w[t] = Math.max(w[t] || 0, 2); });
            toks(n.title).forEach(function (t) { w[t] = 3; });
            Object.keys(w).forEach(function (t) { df[t] = (df[t] || 0) + 1; });
            return { n: n, w: w, title: toks(n.title) };
        });
        IDX = { docs: docs, df: df, N: NOTES.length };
        return IDX;
    }
    function find(text, limit) {
        var q = toks(text);
        if (!q.length) return [];
        var ix = index(), sup = isSuper(), seen = {};
        q = q.filter(function (t) { if (seen[t]) return false; seen[t] = 1; return true; });
        var out = ix.docs.filter(function (d) { return d.n.who === 'all' || sup; }).map(function (d) {
            var s = 0, hits = 0, titleHits = 0;
            q.forEach(function (t) {
                var wt = d.w[t];
                if (!wt) return;
                hits++;
                if (d.title.indexOf(t) !== -1) titleHits++;
                s += wt * (1 + Math.log((ix.N + 1) / (ix.df[t] || 1)));
            });
            var allTitle = d.title.length && d.title.every(function (t) { return q.indexOf(t) !== -1; });
            return { note: d.n, score: s / Math.sqrt(q.length), hits: hits, titleHits: titleHits, allTitle: allTitle };
        }).filter(function (r) { return r.hits; }).sort(function (a, b) { return b.score - a.score; });
        return out.slice(0, limit || 3);
    }
    // should IRIS answer from a note straight away (no AI)?
    var HOWISH = /\b(?:how|who (?:marks?|signs?|approves?|pays?|must|does|can)|what(?:'s| is| does| do)|explain|guide|steps?|procedure|process|meaning|means?|why|where do|where can|when do|rules?|tutorial|teach)\b/i;
    function ask(text) {
        var t = String(text || '').trim().toLowerCase().replace(/[?!.]+$/, '');
        if (!t || !NOTES.length) return null;
        if (/^(?:(?:show|open|list)\s+(?:me\s+)?)?(?:all\s+|the\s+)?(?:iris\s+)?(?:notes|brain|knowledge)$|^iris\s+(?:notes|brain|knowledge)$|^what do you know$/.test(t)) return { list: true };
        var words = t.split(/\s+/).length;
        var num = /\d{4,}/.test(t);
        var how = HOWISH.test(t);
        if (num) return null; // "show me PO 12345" / "make a report for PO 12345" = the real card, not a how-to
        var best = find(t, 3);
        if (!best.length) return null;
        var b = best[0], second = best[1];
        var clear = !second || b.score >= second.score * 1.25;
        var more = best.slice(1).filter(function (r) { return r.hits >= 2 && r.score >= 3.5; }).map(function (r) { return r.note.id; });
        if (b.allTitle && (how || words <= 6)) return { id: b.note.id, more: more };
        if (how && b.hits >= 2 && b.score >= 6 && clear) return { id: b.note.id, more: more };
        if (how && b.titleHits >= 1 && b.score >= 5 && clear) return { id: b.note.id, more: more };
        if (words <= 4 && b.hits >= 2 && b.score >= 6 && clear) return { id: b.note.id, more: more };
        return null;
    }
    // the 1-2 notes that fit this question, as plain text for the AI (nothing when none fit)
    function prompt(text) {
        var best = find(text, 2).filter(function (r) { return r.hits >= 2 && r.score >= 4; });
        if (!best.length) return '';
        return 'IRIS notes (procedures written by the Super Admin; follow them for how-to questions; a PLANNED note describes something not built yet, say so):\n' +
            best.map(function (r) { return '## ' + r.note.title + (r.note.status === 'planned' ? ' (PLANNED, not built yet)' : '') + '\n' + r.note.text.slice(0, 1600); }).join('\n\n');
    }

    // ---- small markdown for the card ----
    function inline(s) {
        var h = esc(s);
        h = h.replace(/`([^`]+)`/g, '<code>$1</code>');
        h = h.replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>');
        h = h.replace(/\[\[([^\]|#]+)(?:[#|]([^\]]*))?\]\]/g, function (_, t, alias) {
            var n = byId(t.trim());
            var label = esc(alias || t.trim());
            return n ? '<button type="button" class="iba-know-link" data-know-open="' + esc(n.id) + '">' + label + '</button>' : '<span class="iba-know-nolink">' + label + '</span>';
        });
        return h;
    }
    function mdHtml(text) {
        var lines = String(text || '').split('\n'), out = [], list = null, para = [];
        function flushP() { if (para.length) { out.push('<p>' + inline(para.join(' ')) + '</p>'); para = []; } }
        function flushL() { if (list) { out.push('<' + list.tag + '>' + list.items.map(function (i) { return '<li>' + inline(i) + '</li>'; }).join('') + '</' + list.tag + '>'); list = null; } }
        lines.forEach(function (ln) {
            var l = ln.trim(), m;
            if (!l) { flushP(); flushL(); return; }
            if ((m = l.match(/^#{1,6}\s+(.*)$/))) { flushP(); flushL(); out.push('<h4>' + inline(m[1]) + '</h4>'); return; }
            if ((m = l.match(/^[-*]\s+(.*)$/))) { flushP(); if (!list || list.tag !== 'ul') { flushL(); list = { tag: 'ul', items: [] }; } list.items.push(m[1]); return; }
            if ((m = l.match(/^\d+[.)]\s+(.*)$/))) { flushP(); if (!list || list.tag !== 'ol') { flushL(); list = { tag: 'ol', items: [] }; } list.items.push(m[1]); return; }
            if (/^(?:sources?|source):/i.test(l)) { flushP(); flushL(); out.push('<p class="iba-know-src">' + inline(l) + '</p>'); return; }
            flushL(); para.push(l);
        });
        flushP(); flushL();
        return out.join('');
    }
    function badge(n) { return n.status === 'planned' ? '<span class="iba-know-badge is-plan">Planned · not ready yet</span>' : ''; }
    function html(data) {
        var x = data || {};
        if (x.list) {
            var v = visible();
            return '<div class="iba-ai-card-head"><i class="fa-solid fa-brain"></i> IRIS notes<span class="iba-ai-badge is-plain">' + v.length + '</span></div>' +
                (v.length ? '<div class="iba-know-list">' + v.map(function (n) {
                    var ls = n.text.split('\n').map(function (l) { return l.trim(); }).filter(function (l) { return l && !/^#/.test(l) && !/^(?:sources?|related)\s*:/i.test(l) && !/^[-*]\s*\[\[/.test(l); });
                    var first = (ls.filter(function (l) { return !/^(?:[-*]|\d+[.)])\s/.test(l); })[0] || ls[0] || '')
                        .replace(/^(?:[-*]|\d+[.)])\s+/, '').replace(/\*\*|`/g, '').replace(/\[\[([^\]|#]+)(?:[#|][^\]]*)?\]\]/g, '$1');
                    if (first.length > 110) first = first.slice(0, 108).replace(/\s+\S*$/, '') + '…';
                    return '<button type="button" class="iba-know-row" data-know-open="' + esc(n.id) + '"><b>' + esc(n.title) + '</b>' + badge(n) + '<small>' + esc(first) + '</small></button>';
                }).join('') + '</div>' : '<p class="iba-ai-empty">No notes yet.</p>') +
                '<p class="iba-know-src">From the Iris Knowledge notes, updated ' + esc(BUILT) + '. Ask "how does …" and I answer from these.</p>';
        }
        var n = byId(x.id);
        if (!n) return '<div class="iba-ai-card-head"><i class="fa-solid fa-brain"></i> IRIS notes</div><p class="iba-ai-empty">That note is not open for you.</p>';
        var more = (x.more || []).map(byId).filter(function (m) { return m && m.id !== n.id; });
        return '<div class="iba-ai-card-head"><i class="fa-solid fa-brain"></i> ' + esc(n.title) + badge(n) + '<span class="iba-ai-head-actions"><button type="button" class="iba-ai-mini" data-know-list title="All IRIS notes"><i class="fa-solid fa-list"></i> All notes</button></span></div>' +
            '<div class="iba-know-body">' + mdHtml(n.text) + '</div>' +
            (more.length ? '<p class="iba-know-also">Also: ' + more.map(function (m) { return '<button type="button" class="iba-know-link" data-know-open="' + esc(m.id) + '">' + esc(m.title) + '</button>'; }).join(' ') + '</p>' : '') +
            '<p class="iba-know-src">From IRIS notes</p>';
    }

    // one small style block (the assistant panel is dark glass)
    function css() {
        if (document.getElementById('iba-know-css')) return;
        var s = document.createElement('style');
        s.id = 'iba-know-css';
        s.textContent =
            '.iba-know-body{font-size:13px;line-height:1.5}.iba-know-body h4{margin:10px 0 4px;font-size:13px;color:#e6c46a}' +
            '.iba-know-body p{margin:6px 0}.iba-know-body ul,.iba-know-body ol{margin:6px 0;padding-left:20px}.iba-know-body li{margin:3px 0}' +
            '.iba-know-body code{background:rgba(255,255,255,.1);padding:1px 5px;border-radius:4px;font-size:12px}' +
            '.iba-know-link{background:none;border:0;border-bottom:1px dashed currentColor;color:#7cc4ff;padding:0;font:inherit;cursor:pointer}' +
            '.iba-know-src{opacity:.55;font-size:11px;margin:8px 0 0}.iba-know-also{font-size:12px;margin:8px 0 0}' +
            '.iba-know-badge{display:inline-block;margin-left:8px;padding:1px 8px;border-radius:999px;font-size:10.5px;font-weight:600;vertical-align:middle}' +
            '.iba-know-badge.is-plan{background:rgba(230,180,60,.18);color:#f0c560;border:1px solid rgba(230,180,60,.45)}' +
            '.iba-know-list{display:flex;flex-direction:column;gap:6px;margin-top:6px}' +
            '.iba-know-row{display:block;text-align:left;width:100%;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.1);border-radius:8px;padding:8px 10px;color:inherit;font:inherit;cursor:pointer}' +
            '.iba-know-row:hover{background:rgba(255,255,255,.1)}.iba-know-row b{font-size:13px}.iba-know-row small{display:block;opacity:.65;font-size:11.5px;margin-top:2px}';
        (document.head || document.documentElement).appendChild(s);
    }
    css();

    window.ibaKnow = { notes: function () { return visible().slice(); }, find: find, ask: ask, prompt: prompt, html: html, built: BUILT, count: NOTES.length };
})();
