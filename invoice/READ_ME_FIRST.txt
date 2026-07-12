This patch is cumulative from 11.1.4 and adds the requested Invoice Management status/attention behavior.

For Summary was added only to the Invoice Entry Quick Access side panel.
The status dropdown already had For Summary.

No-attention statuses now save Attention blank/None:
Under Review, For Summary, With Accounts, Pending, Report Approved, On Hold.

This prevents these statuses from creating personal active-task routing by mistake.
