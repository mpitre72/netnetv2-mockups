import { performanceJobs } from '../performance-data.js';

const { createElement: h, useMemo } = React;

function enrichJobs() {
  return performanceJobs
    .filter((j) => j.status === 'active')
    .map((job) => {
      const effortPct = Math.round(((job.actualHours || 0) / Math.max(job.estHours || 1, 1)) * 100);
      const start = new Date(job.startDate);
      const end = new Date(job.plannedEnd || job.startDate);
      const now = Date.now();
      const timelinePct = start instanceof Date && end instanceof Date && end > start
        ? Math.round(((now - start.getTime()) / (end.getTime() - start.getTime())) * 100)
        : 0;
      const atRisk = effortPct > 85 || timelinePct > 85;
      return { ...job, effortPct, timelinePct, atRisk };
    });
}

export function JobsAtRisk() {
  const jobs = useMemo(() => enrichJobs(), []);
  const atRisk = jobs.filter((j) => j.atRisk);

  return h('div', { className: 'space-y-4' }, [
    h('div', { className: 'rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900/80 shadow-sm p-5 space-y-2' }, [
      h('h3', { className: 'text-lg font-semibold text-slate-900 dark:text-white' }, 'Jobs at Risk'),
      h('p', { className: 'text-sm text-slate-600 dark:text-slate-300' }, 'Routing + drilldowns are in place; detailed rescue views land next.'),
    ]),
    h('div', { className: 'rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900/80 shadow-sm' }, [
      h('div', { className: 'px-5 py-4 border-b border-slate-100 dark:border-white/5 flex items-center justify-between' }, [
        h('div', { className: 'text-sm font-semibold text-slate-900 dark:text-white' }, 'Signals'),
        h('span', { className: 'text-xs text-slate-500 dark:text-slate-400' }, `${atRisk.length} of ${jobs.length} active`),
      ]),
      atRisk.length === 0
        ? h('div', { className: 'p-5 text-sm text-slate-600 dark:text-slate-300' }, 'No jobs are currently flagged.')
        : h('div', { className: 'divide-y divide-slate-100 dark:divide-white/5' },
            atRisk.map((job) =>
              h('div', { key: job.id, className: 'px-5 py-3 flex items-center justify-between text-sm text-slate-700 dark:text-slate-200' }, [
                h('div', { className: 'space-y-0.5' }, [
                  h('div', { className: 'font-semibold text-slate-900 dark:text-white' }, job.name),
                  h('div', { className: 'text-xs text-slate-500 dark:text-slate-400' }, job.client),
                ]),
                h('div', { className: 'text-xs text-slate-500 dark:text-slate-400 flex gap-3' }, [
                  h('span', null, `Effort ${job.effortPct}%`),
                  h('span', null, `Timeline ${job.timelinePct}%`),
                ]),
              ])
            )
          ),
    ]),
  ]);
}
