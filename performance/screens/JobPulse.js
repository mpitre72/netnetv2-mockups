import { performanceJobs } from '../performance-data.js';

const { createElement: h, useMemo } = React;

function findJob(jobId) {
  if (!jobId) return null;
  const numId = Number(jobId);
  return performanceJobs.find((j) => String(j.id) === String(jobId) || j.id === numId) || null;
}

export function JobPulse({ queryString = '' }) {
  const params = useMemo(() => new URLSearchParams(queryString), [queryString]);
  const jobId = params.get('jobId');
  const job = useMemo(() => findJob(jobId), [jobId]);

  return h('div', { className: 'space-y-4' }, [
    h('div', { className: 'rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900/80 shadow-sm p-5 space-y-2' }, [
      h('h3', { className: 'text-lg font-semibold text-slate-900 dark:text-white' }, 'Job Pulse'),
      h('p', { className: 'text-sm text-slate-600 dark:text-slate-300' },
        'Future state: mini control center per job (tasks, deadlines, pace, escalations).'
      ),
    ]),
    job
      ? h('div', { className: 'rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900/80 shadow-sm p-4 space-y-1' }, [
          h('div', { className: 'text-sm font-semibold text-slate-900 dark:text-white' }, job.name),
          h('div', { className: 'text-xs text-slate-600 dark:text-slate-300' }, job.client || 'Client TBD'),
          h('div', { className: 'text-sm text-slate-700 dark:text-slate-200' }, `Estimate ${job.estHours || 0}h • Actual ${job.actualHours || 0}h`),
          h('div', { className: 'text-xs text-slate-500 dark:text-slate-400' }, 'Full drilldowns coming in Task Pack 02.'),
        ])
      : h('div', { className: 'rounded-xl border border-dashed border-slate-300 dark:border-white/15 bg-slate-50 dark:bg-slate-900/50 p-4 text-sm text-slate-600 dark:text-slate-200' },
          jobId ? `Job ${jobId} not found in sample data.` : 'Pass ?jobId=<id> to load a job pulse card.'
        ),
  ]);
}
