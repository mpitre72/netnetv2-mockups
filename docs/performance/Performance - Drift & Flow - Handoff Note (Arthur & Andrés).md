# Performance — Drift & Flow — Handoff Note (Arthur & Andrés)

## Mental model
- Performance Pulse: calm orientation “weather report” with drilldowns.
- At‑Risk Deliverables: triage workbench for deliverable-level drift + actions.
‑ Jobs at Risk: job-level rollup driven only by at-risk deliverables.
‑ Job Pulse: job context + same locked actions + evidence.
‑ Capacity & Forecast: near-term pressure; split known vs unknown; unassigned separated.

## Canonical routes
- `#/app/performance/overview`
- `#/app/performance/at-risk-deliverables`
- `#/app/performance/jobs-at-risk`
- `#/app/performance/job-pulse?jobId=<id>[&deliverableId=<id>]`
- `#/app/performance/capacity?horizonDays=14|30|60`
- Reports: `#/app/performance/reports/time|team|sales|job`

## Non-negotiables
- Evidence-based drift (overdue/overruns/low confidence/pace red), not proximity to 85% alone.
- Check-in zone (85–100 without confidence) is gentle; does not raise risk by itself.
- Reviewed mutes attention but never hides truth counts.
- Locked action order/labels: Mark/Clear Reviewed, Complete Deliverable, Change Due Date, Reassign Tasks, Create Change Order.

## State model
- URL params: lens, filters, reviewed, client, jobId, q (At-Risk); horizonDays (Capacity); jobId/deliverableId (Job Pulse); view (reports sales revenue-fog).
- Persistence key: `netnet_testdata_performance_v1` via performance/testdata/performance-store.js.
- Effective state builder: performance/testdata/performance-state.js merges seed + overrides; reviewed auto-clears on material change.

## Suggested production mapping (React/MUI)
- Cards → MUI Card; chip rows → MUI Chip/Stack.
- Menus → MUI Menu; RowActionsMenu logic can map to MUI Menu with anchor.
- Modals → MUI Dialog (shared ActionModal is the prototype reference).
- Lists/tables → MUI List/Table; section headers → MUI Typography + Stack.
- URL state via router search params; localStorage-backed overrides -> context/store.

## Prototype shortcuts
- Mock data only; capacity math simplified (remainingHours/est-assigned minus actual; forward-looking horizon).
- Change orders stored as simple arrays; no workflow state.
- Reports use static data; no API layer.

## Interpreting “Reviewed”
- Reviewed records a snapshot to mute attention; underlying drift truth remains.
- If due date/confidence/status/tasks/change order change, reviewed auto-clears.
- UI shows reviewed badges and sorts unreviewed above reviewed to keep focus.
