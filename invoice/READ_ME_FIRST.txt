This patch is cumulative from 11.1.8 and adds the missing Dashboard card stability fix.

Main issue fixed: Dashboard cards were being redrawn in loading state during repeated background refresh, causing counts like 3 to become dash.
