import { performanceDeliverables, performanceJobs } from '../performance-data.js';

const { createElement: h, useMemo } = React;

function summarizeDeliverables() {
  const jobsById = new Map(performanceJobs.map((j) => [j.id, j]));
  const now = new Date();
  const soon = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  const rows = performanceDeliverables.map((d) => {
    const due = new Date(d.due);
    const overdue = !isNaN(due) && due < now;
    const dueSoon = !isNaN(due) && due >= now && due <= soon;
    const job = jobsById.get(d.jobId);
    return { ...d, jobName: job?.name || `Job ${d.jobId}`, overdue, dueSoon };
  });
  return {
    overdue: rows.filter((r) => r.overdue && r.status !== 'completed'),
    dueSoon: rows.filter((r) => r.dueSoon && r.status !== 'completed'),
    rows,
  };
}

export function AtRiskDeliverables() {
  const summary = useMemo(() => summarizeDeliverables(), []);

  return h('div', { className: 'space-y-4' }, [
    h('div', { className: 'rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900/80 shadow-sm p-5 space-y-2' }, [
      h('h3', { className: 'text-lg font-semibold text-slate-900 dark:text-white' }, 'At-Risk Deliverables'),
      h('p', { className: 'text-sm text-slate-600 dark:text-slate-300' },
        'Full Drift & Flow drilldowns land in Task Pack 02. Snapshot below keeps awareness visible.'
      ),
    ]),
    h('div', { className: 'grid grid-cols-1 md:grid-cols-2 gap-4' }, [
      h('div', { className: 'rounded-xl border border-amber-200 dark:border-amber-400/40 bg-white dark:bg-slate-900/80 shadow-sm p-4 space-y-1' }, [
        h('div', { className: 'text-sm font-semibold text-slate-900 dark:text-white' }, 'Overdue'),
        h('div', { className: 'text-3xl font-bold text-amber-700 dark:text-amber-200' }, summary.overdue.length),
        h('div', { className: 'text-sm text-slate-600 dark:text-slate-300' }, 'Unreviewed items past due'),
      ]),
      h('div', { className: 'rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900/80 shadow-sm p-4 space-y-1' }, [
        h('div', { className: 'text-sm font-semibold text-slate-900 dark:text-white' }, 'Due in 7 days'),
        h('div', { className: 'text-3xl font-bold text-slate-900 dark:text-white' }, summary.dueSoon.length),
        h('div', { className: 'text-sm text-slate-600 dark:text-slate-300' }, 'Stays until Task Pack adds filters/actions'),
      ]),
    ]),
    h('div', { className: 'rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900/80 shadow-sm' }, [
      h('div', { className: 'px-5 py-4 border-b border-slate-100 dark:border-white/5 flex items-center justify-between' }, [
        h('div', { className: 'text-sm font-semibold text-slate-900 dark:text-white' }, 'Signal list (read-only for now)'),
        h('span', { className: 'text-xs text-slate-500 dark:text-slate-400' }, `${summary.rows.length} deliverables`),
      ]),
      h('div', { className: 'divide-y divide-slate-100 dark:divide-white/5' },
        summary.rows.slice(0, 6).map((row) =>
          h('div', { key: row.id, className: 'px-5 py-3 flex items-center justify-between text-sm text-slate-700 dark:text-slate-200' }, [
            h('div', { className: 'space-y-0.5' }, [
              h('div', { className: 'font-semibold text-slate-900 dark:text-white' }, row.name),
              h('div', { className: 'text-xs text-slate-500 dark:text-slate-400' }, row.jobName),
            ]),
            h('div', { className: 'text-xs text-slate-500 dark:text-slate-300' }, row.overdue ? 'Overdue' : row.dueSoon ? 'Due soon' : 'On track'),
          ])
        )
      ),
    ]),
  ]);
}
