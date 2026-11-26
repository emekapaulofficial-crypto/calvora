CALVORA REPORTING CENTRE V37 â€” CHANGED FILES ONLY
Build date: 26 November 2026

This package is an incremental website update based on the original calvora-cloudflare-deploy.zip and the V36 reporting package. It contains only the reporting-related replacements/additions. Preserve every other website file.

REPLACE these files in the Cloudflare Pages site root:
- admin.html
- admin-panel.js
- admin-insights.css (new if not already present)
- agent.html
- agent-portal.js
- management.html
- management.js
- management.css
- version.txt

ADD these SQL files to the existing Supabase project (SQL Editor), in this order:
1. team-weekly-reports.sql
2. agent-reporting-v37.sql
3. staff-chat.sql only if the staff chat migration has not already been run.

V37 additions: agent responsibility selection (Sales, Rentals, Land acquisition, Property sourcing), responsibility-specific activity counts, property sourcing details, verification notes, revenue/commission, lost-opportunity reasons, customer feedback, staff role work summary, and follower/subscriber gains for TikTok, Facebook, WhatsApp, Instagram and YouTube. Existing navy/green/red CALVORA reporting styles are retained and extended; no new CSS framework is introduced.

Access: agents submit their own reports; existing RLS controls record access. Staff submit their own weekly reports; CEO/authorized management reviews team reports. Staff chat remains staff-only according to the supplied V36 policy.

Reporting cadence remains Monday planning, in-week updates, Saturday submissions, manager review and monthly summaries. Reports are weekly records; monthly reports aggregate those weekly records.

IMPORTANT: This package has not been deployed to Cloudflare or applied to the live Supabase project. Back up the listed files and database first. Confirm the current Supabase profiles role conventions and RLS policies before running SQL. The V36 migration references the existing public.profiles table and the existing agent_weekly_reports table conditionally; the V37 migration expects team_weekly_reports to exist.

Social metrics are manually entered from platform analytics; this package does not connect platform APIs. Calls and self-reported activity should be checked against CRM/call logs before formal performance decisions. WhatsApp uses Status views and reactions.

The original website config.js, Supabase keys, auth credentials, property listings, customer records, CRM, transactions, Cloudflare workflow and unrelated CSS/pages are not included or changed.
