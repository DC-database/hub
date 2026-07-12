11.1.6 is cumulative over 11.1.5 for the changed files included here.

Purpose: keep Summary Note accurate for previous/current notes without making Summary Note depend on full Firebase invoice_entries downloads each time.

Important: Old historical notes cannot already have note-index references. The first time you generate a summary for an old non-indexed note, the system can ask to run a one-time legacy search. After that, the matching references are saved into invoice_note_index for lighter future use.
