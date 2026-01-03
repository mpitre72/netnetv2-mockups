import { navigate } from '../../router.js';
import { DriftReasonChips, ReviewedBadge, PerfCard, PerfSectionTitle } from '../../components/performance/primitives.js';
import { getEffectiveState } from '../testdata/performance-state.js';
import { buildJobsAtRiskRollup } from '../lib/jobs-at-risk-rollup.js';

const { createElement: h, useMemo } = React;

function JobRow({ job }) {
  const severityTone = job.severity === 3
    ? 'bg-rose-50 text-rose-700 dark:bg-rose-900/40 dark:text-rose-100 border-rose-200 dark:border-rose-400/40'
    : 'bg-amber-50 text-amber-700 dark:bg-amber-900/40 dark:text-amber-100 border-amber-200 dark:border-amber-400/40';
  return h('div', {
    className: 'flex flex-col gap-2 md:flex-row md:items-center md:justify-between',
    role: 'button',
    tabIndex: 0,
    onClick: () => navigate(`#/app/performance/job-pulse?jobId=${job.jobId}`),
    onKeyDown: (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); navigate(`#/app/performance/job-pulse?jobId=${job.jobId}`); } },
  }, [
    h('div', { className: 'space-y-1 min-w-0' }, [
      h('div', { className: 'flex items-center gap-2 flex-wrap' }, [
        h('div', { className: 'text-base font-semibold text-slate-900 dark:text-white truncate' }, job.jobName),
        job.jobReviewedState.reviewedAtRisk ? h(ReviewedBadge, { reviewed: true }) : null,
      ]),
      h('div', { className: 'text-sm text-slate-600 dark:text-slate-300 flex items-center gap-2 flex-wrap' }, [
        h('span', null, job.clientName || 'Client'),
        h('span', { className: 'text-slate-400' }, '•'),
        h('span', null, `${job.atRiskDeliverableCount} at-risk deliverables`),
        job.unreviewedAtRiskDeliverableCount > 0
          ? h('span', { className: 'text-xs font-semibold text-amber-700 dark:text-amber-200' }, `${job.unreviewedAtRiskDeliverableCount} unreviewed`)
          : h('span', { className: 'text-xs text-slate-500 dark:text-slate-400' }, `${job.reviewedAtRiskDeliverableCount} reviewed`),
      ]),
      h('div', { className: 'flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 flex-wrap' }, [
        h('span', null, job.nextPainDate ? `Next pain: ${job.nextPainDate.toLocaleDateString()}` : 'No upcoming due'),
        h('span', { className: 'text-slate-400' }, '•'),
        h('button', {
          type: 'button',
          className: 'text-[var(--color-brand-purple,#711FFF)] font-semibold',
          onClick: (e) => { e.stopPropagation(); navigate(`#/app/performance/deliverables-in-drift?jobId=${job.jobId}`); },
        }, 'View deliverables'),
      ]),
      h(DriftReasonChips, { reasons: job.driverChips }),
    ]),
    h('div', { className: 'flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300' }, [
      h('span', { className: `px-2 py-1 rounded-full border ${severityTone}` },
        job.severity === 3 ? 'Severity: High' : 'Severity: Watch'),
    ]),
  ]);
}

export function JobsAtRisk() {
  const state = useMemo(() => getEffectiveState(), []);
  const rollup = useMemo(
    () => buildJobsAtRiskRollup({ jobs: state.jobs, deliverables: state.deliverables }),
    [state.jobs, state.deliverables]
  );

  return h('div', { className: 'space-y-4' }, [
    h(PerfCard, { className: 'space-y-2' }, [
      h(PerfSectionTitle, { title: 'Jobs at Risk', subtitle: `${rollup.jobsAtRiskCount} jobs at risk${rollup.jobsAtRiskReviewedCount ? ` (${rollup.jobsAtRiskReviewedCount} reviewed)` : ''}` }),
    ]),
    h(PerfCard, { className: 'space-y-3' }, [
      h(PerfSectionTitle, {
        title: 'Signals',
        rightSlot: h('span', { className: 'text-xs text-slate-500 dark:text-slate-400' }, `${rollup.jobsAtRiskCount} jobs • ${rollup.jobsAtRiskNeedingAttention} need attention`),
      }),
      rollup.jobsAtRiskCount === 0
        ? h('div', { className: 'p-2 text-sm text-slate-600 dark:text-slate-300' }, 'No jobs are currently at risk based on near-term deliverable evidence.')
        : h('div', { className: 'space-y-3' },
            rollup.jobsAtRisk.map((job) =>
              h(PerfCard, { key: job.jobId, variant: 'secondary', className: 'hover:-translate-y-[1px] transition' },
                h(JobRow, { job })
              )
            )
          ),
    ]),
  ]);
}
