IBA 11.1.1 - CSV Refresh Throttle + Dashboard Duplicate Cleanup

This patch includes the 11.1.0 Dashboard duplicate source cleanup and adds a CSV refresh guard.

Main fixes:
1. Dashboard duplicate fix remains included.
   - If the same invoice appears from old WorkDesk Job Entry and live Invoice Entry, Dashboard prefers the live Invoice Entry.
   - The old job record is kept as history but hidden from active Dashboard.

2. POVALUE2.csv refresh throttle added.
   - Dashboard will not repeatedly reload POVALUE2.csv every refresh/second.
   - If the PO CSV is already indexed in memory, Dashboard reuses it.
   - One in-flight CSV request is shared instead of starting multiple downloads.
   - Manual forced reload remains available through refreshPOVALUE2CsvNow().

No workflow change. No permission change. No full invoice_entries read added.
