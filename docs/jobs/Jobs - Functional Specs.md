# Jobs - Functional Specs

## Job Types

Net Net supports two primary Job types:

- Project
- Retainer

Project and Retainer performance reporting must remain separate because they answer different operational questions.

## Project Performance

Projects are finite and timeline-based.

Required Project Performance behavior:

- Show one job-level performance report.
- Compare approved scope to actual execution.
- Show start date and target end date.
- Show original plan, current plan, actual hours, remaining hours when active, variance, change orders, deliverable breakdown, and service type breakdown.
- Preserve existing Project Jobs Report detail behavior and existing Jobs app Project Performance behavior.

## Retainer Performance

Retainers are cycle-based and monthly.

Required Retainer fields:

- Start date.
- Optional end date.
- Billing structure.
- Optional billing duration for fixed-term Retainers.
- Current or latest cycle key.

Retainer end date rules:

- Active open-ended Retainers display `-`.
- Completed Retainers display their completion date.
- Fixed-term Retainers may derive the end date from start date plus billing duration.

Retainer navigation rules:

- Month navigation starts at the Retainer start month.
- The previous button is disabled at the first month.
- Month navigation ends at the Retainer end month when an end date exists.
- Active open-ended Retainers can navigate through the latest available or current cycle.
- The next button is disabled at the last available month.
- Jobs Report Retainer detail defaults to the Retainer start month for historical review.
- Individual Job Performance defaults active Retainers to `currentCycleKey` when available, otherwise the latest available cycle.
- Individual Job Performance defaults completed or archived Retainers to the final available cycle.

Retainer report layout:

- Retainer Summary remains visible above the month selector.
- Month selector sits below the Retainer Summary.
- Selected month detail sits below the month selector.

Retainer Summary must include:

- Retainer start date.
- Retainer end date or `-`.
- Retainer status.
- Number of months or cycles.
- Average monthly capacity used.
- Average remaining capacity.
- Total hours used.
- Months over monthly plan.
- Months with unused capacity.
- Change orders during the Retainer.
- Most-used service type or service mix summary.

Selected month detail must include:

- Selected month.
- Monthly plan.
- Actual hours.
- Remaining capacity.
- Capacity used percentage.
- Variance.
- Change orders during that month.
- Deliverable breakdown for that month.
- Service type breakdown for that month.

## Retainer Work Types

Retainer reporting must support:

- Fixed recurring monthly services.
- One-off tasks during a single month.
- One-off tasks spanning more than one month.

Rules:

- Recurring monthly work appears in each cycle where it is planned.
- A one-off task with work only in one month appears only in that month.
- A one-off task spanning two months appears in both months until completed.
- If a one-off task has a completion date, it stops appearing after its completion month.
- If a one-off task starts in one month and remains open into the next month, it can appear in both months.

Demo examples:

- Plugin Updates: recurring monthly work.
- Anything Hours: recurring monthly flexible work.
- Emergency Diagnostics: one-off work in one month.
- Landing Page Fixes: one-off work spanning two months.

## Jobs Report Date Filters

Jobs Report date filters should use the shared Net Net calendar picker pattern when the cleanup task is scheduled. The current prototype may continue to use plain date fields until that focused update.

## Money Rule

Jobs Report and Job Performance reporting are hour, scope, date, and delivery reports. They must not show dollar values. Sales Report is the Performance area where dollar values belong.
