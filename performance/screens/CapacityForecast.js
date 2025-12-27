import { performanceTeam } from '../performance-data.js';

const { createElement: h, useMemo } = React;

function summarizeTeam() {
  const totalMonthly = performanceTeam.reduce((sum, tm) => sum + (Number(tm.monthlyCapacityHours) || 0), 0);
  const avg = performanceTeam.length ? Math.round(totalMonthly / performanceTeam.length) : 0;
  return { totalMonthly, avg, count: performanceTeam.length };
}

export function CapacityForecast() {
  const summary = useMemo(() => summarizeTeam(), []);

  return h('div', { className: 'space-y-4' }, [
    h('div', { className: 'rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900/80 shadow-sm p-5 space-y-2' }, [
      h('h3', { className: 'text-lg font-semibold text-slate-900 dark:text-white' }, 'Capacity & Forecast'),
      h('p', { className: 'text-sm text-slate-600 dark:text-slate-300' }, 'Forecast drilldowns will land with Drift & Flow Task Pack 02. Quick headroom snapshot stays visible.'),
    ]),
    h('div', { className: 'grid grid-cols-1 md:grid-cols-3 gap-4' }, [
      h('div', { className: 'rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900/80 shadow-sm p-4 space-y-1' }, [
        h('div', { className: 'text-sm font-semibold text-slate-900 dark:text-white' }, 'Team members'),
        h('div', { className: 'text-3xl font-bold text-slate-900 dark:text-white' }, summary.count),
        h('div', { className: 'text-sm text-slate-600 dark:text-slate-300' }, 'Available for scheduling'),
      ]),
      h('div', { className: 'rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900/80 shadow-sm p-4 space-y-1' }, [
        h('div', { className: 'text-sm font-semibold text-slate-900 dark:text-white' }, 'Monthly capacity'),
        h('div', { className: 'text-3xl font-bold text-slate-900 dark:text-white' }, `${summary.totalMonthly}h`),
        h('div', { className: 'text-sm text-slate-600 dark:text-slate-300' }, 'Baseline hours (team sum)'),
      ]),
      h('div', { className: 'rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900/80 shadow-sm p-4 space-y-1' }, [
        h('div', { className: 'text-sm font-semibold text-slate-900 dark:text-white' }, 'Avg capacity'),
        h('div', { className: 'text-3xl font-bold text-slate-900 dark:text-white' }, `${summary.avg}h`),
        h('div', { className: 'text-sm text-slate-600 dark:text-slate-300' }, 'Per teammate baseline'),
      ]),
    ]),
    h('div', { className: 'rounded-xl border border-dashed border-slate-300 dark:border-white/15 bg-slate-50 dark:bg-slate-900/50 p-4 text-sm text-slate-600 dark:text-slate-200' },
      'Next iteration: assign demand slices, horizon switcher, and strain alerts tied to Flow Meter signals.'
    ),
  ]);
}
