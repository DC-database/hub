After uploading 11.1.4:

1) Hard refresh Chrome.
2) Open Batch Entry.
3) Open Summary Note.
4) Confirm this warning does NOT appear during page open:
   [IBA Firebase Download] Full invoice_entries read requested by ensureInvoiceDataFetched()

Important:
- Searching by status in Batch Entry should use the light active index.
- Searching by note may still use the old full-cache search only when you intentionally press Search by Note; page opening and note dropdown suggestions should not.
- New notes will be saved into invoice_note_index as you save/update invoices.
