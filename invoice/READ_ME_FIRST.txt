IBA WorkDesk 10.1.4 PATCH — Dashboard IPC Invoice Date Display Fix

Purpose:
- Fix Dashboard still showing an Invoice Date for IPC Job Records.

Rule:
- IPC is not an invoice yet.
- IPC Dashboard card may use Job Record date as Entered/queue date only.
- IPC Dashboard Invoice Date must remain blank / — until IPC is converted to Invoice.
- Existing stale invoiceDate values on IPC records are ignored in Dashboard display.

Patch type:
- Patch-only package.
- Files inside are complete updated files, ready to replace existing live files.
