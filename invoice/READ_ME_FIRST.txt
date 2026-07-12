IBA 11.1.3 - WorkDesk Job Recent Permission Guard + CSV/Dashboard Fixes

Use this patch directly over 11.0.9, 11.1.1, or 11.1.2. It includes the 11.1.0 Dashboard duplicate cleanup, 11.1.1 CSV refresh throttle, 11.1.2 CSV stack guard fix, and a new 11.1.3 guard for /workdesk_job_recent permission warnings.

Fix included in 11.1.3:
- If Firebase rules deny /workdesk_job_recent, the system disables that optional recent-sync helper after one warning.
- It stops repeated permission_denied console warnings every 30 seconds.
- It does not add a full invoice_entries read.
- Dashboard continues using normal cache/index/exact-record validation.

Important:
- This is a code fallback only. If you later add Firebase rules for /workdesk_job_recent, the recent-sync helper can be re-enabled in a future patch.
- 11.0.9 remains the safe rollback if needed.
