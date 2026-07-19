11.4.1 speeds up Summary Note generation.

Fixes:
- Uses exact note refs first for Previous Note and Current Note.
- Avoids loading/searching the larger note index list when exact note refs already exist.
- Throttles POdetails.csv refresh so Generate does not fetch the large POdetails file every time.
- Keeps Previous Payment = Previous Note only.
- Keeps Current Payment = Current Note only.
- Keeps Summary Note totals = Amt Paid only.
- Keeps 11.4.0 Generate button no-stuck guard.

Note:
If an old note is not indexed yet, the system may still ask once for legacy index build. After that note is indexed, future generation should be fast.
