# Performance — Drift & Flow — QA Runbook

## How to run QA
- Use a clean browser session or hard reload each screen.
- Keep DevTools open to watch for console errors.
- Follow routes in order; record any deviation from expected results.

## Reset state
- Go to `#/app/settings`, click “Clear test data”, accept toast, allow reload.

## Test checklist
1) Overview / Pulse  
   - Route: `#/app/performance/overview`  
   - Action: Click each tile + Flow Meter.  
   - Expect: Routes change correctly; no NaN/undefined; Flow Meter click jumps to highest-priority drilldown without errors.

2) At‑Risk Deliverables  
   - Route: `#/app/performance/at-risk-deliverables` (with/without filters)  
   - Action: Toggle lens + filters; refresh; run actions (review, due move, confidence, reassign, change order).  
   - Expect: URL params persist on refresh; reviewed badge persists; reviewed auto-clears on material change; actions toast and persist; list ordering keeps unreviewed first.

3) Jobs at Risk  
   - Route: `#/app/performance/jobs-at-risk`  
   - Action: Click row; click “View deliverables” link.  
   - Expect: Row opens Job Pulse; link opens At-Risk Deliverables filtered to job; reviewed chip only when all at-risk items reviewed.

4) Job Pulse  
   - Route: `#/app/performance/job-pulse?jobId=<id>` and with `&deliverableId=<id>`  
   - Action: Expand deliverable; run actions; verify focused deliverable highlight when deliverableId present.  
   - Expect: Actions persist and clear reviewed when required; focused deliverable is visually highlighted/pinned; tasks/change orders show; history lists recent events.

5) Capacity & Forecast  
   - Route: `#/app/performance/capacity?horizonDays=30` then 14/60  
   - Action: Switch horizons; expand team row; expand service type; run an action inside an expanded deliverable.  
   - Expect: URL updates with horizon; numbers change with horizon; assigned/unknown/unassigned counts render (no NaN); Job Pulse links include deliverableId; actions persist and refresh utilization.

6) Reports (regression)  
   - Routes: `#/app/performance/reports/time`, `/team`, `/sales`, `/job`  
   - Action: Load each tab.  
   - Expect: Charts/tables render; no console errors; `view=revenue-fog` shows banner on sales.

7) Global nav regression  
   - Action: From any Performance page, click Settings/Contacts/Me and back to Performance.  
   - Expect: No React unmount/removeChild errors; Performance remounts cleanly; build stamp shows latest value in header.
