IBA 11.1.2 - CSV Stack Guard Fix + CSV Throttle + Dashboard Duplicate Cleanup

Use this patch directly over 11.0.9 or 11.1.1. It includes the 11.1.0 Dashboard duplicate cleanup and 11.1.1 CSV refresh throttle, plus a correction for the 11.1.1 maximum call stack console error.

Fix included in 11.1.2:
- Corrects app-data-cache.js recursion where the public refreshPOVALUE2CsvNow wrapper could call itself repeatedly.
- Prevents RangeError: Maximum call stack size exceeded from app-data-cache.js line around the CSV refresh wrapper.
- Keeps POVALUE2.csv single-load/throttle behavior so Dashboard does not reload CSV every second.
- Keeps Dashboard duplicate cleanup: prefer live Invoice Entry over old WorkDesk New Entry duplicate.

Testing after upload:
1. Open WorkDesk Dashboard.
2. Console should not show Maximum call stack size exceeded.
3. POVALUE2.csv should not refresh every second.
4. The duplicate New Entry/Report card should show only the current live invoice status.

Rollback:
- 11.0.9 remains the safe rollback if needed.
