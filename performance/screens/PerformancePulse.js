import { navigate } from '../../router.js';
import {
  performanceJobs,
  performanceDeliverables,
  performanceTeam,
  performanceSalesDeals,
} from '../performance-data.js';

const { createElement: h, useMemo } = React;

function clamp(n, min, max) {
  return Math.min(max, Math.max(min, n));
}

function getTimelinePercent(start, end) {
  const s = new Date(start).getTime();
  const e = new Date(end).getTime();
  const n = Date.now();
  if (isNaN(s) || isNaN(e) || e <= s) return 0;
  return clamp(Math.round(((n - s) / (e - s)) * 100), 0, 200);
}

function enrichJobs() {
  return performanceJobs.map((job) => {
    const effortPct = clamp(Math.round(((job.actualHours || 0) / Math.max(job.estHours || 1, 1)) * 100), 0, 200);
    const timelinePct = getTimelinePercent(job.startDate, job.plannedEnd || job.startDate);
    const atRisk = effortPct > 85 || timelinePct > 85;
    return { ...job, effortPct, timelinePct, atRisk };
  });
}

function enrichDeliverables() {
  const today = new Date();
  const next7 = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);
  return performanceDeliverables.map((d) => {
    const due = new Date(d.due);
    const overdue = !isNaN(due) && due < today;
    const dueSoon = !isNaN(due) && due >= today && due <= next7;
    const durationConsumed = clamp(Math.round(d.durationConsumed || 0), 0, 200);
    const effortConsumed = clamp(Math.round(d.effortConsumed || 0), 0, 200);
    const atRisk = durationConsumed > 90 || effortConsumed > 90 || overdue;
    return { ...d, overdue, dueSoon, atRisk, effortConsumed, durationConsumed };
  });
}

function computeDelivery(jobs) {
  const active = jobs.filter((j) => j.status === 'active');
  const atRisk = active.filter((j) => j.atRisk);
  const onTimePct = active.length ? Math.round(((active.length - atRisk.length) / active.length) * 100) : 100;
  const tone = onTimePct >= 85 ? 'green' : onTimePct >= 70 ? 'amber' : 'red';
  return { onTimePct, tone, jobsAtRisk: atRisk.length, activeCount: active.length };
}

function computeCapacity(deliverables, horizonDays = 30) {
  const now = new Date();
  const cutoff = new Date(now.getTime() + horizonDays * 24 * 60 * 60 * 1000);
  const demand = deliverables
    .filter((d) => {
      const due = new Date(d.due);
      return !isNaN(due) && due <= cutoff;
    })
    .reduce((sum, d) => sum + (Number(d.estHours) || 40), 0);
  const monthlyCapacity = performanceTeam.reduce((sum, tm) => sum + (Number(tm.monthlyCapacityHours) || 0), 0);
  const capacity = Math.round((monthlyCapacity / 30) * horizonDays);
  const pressurePct = capacity ? Math.round((demand / capacity) * 100) : 0;
  const tone = pressurePct > 110 ? 'red' : pressurePct > 90 ? 'amber' : 'green';
  return { demand: Math.round(demand), capacity, pressurePct, tone };
}

function computeDeadlines(deliverables) {
  const overdueOpen = deliverables.filter((d) => d.overdue && d.status !== 'completed').length;
  const dueSoon = deliverables.filter((d) => d.dueSoon && d.status !== 'completed').length;
  const tone = overdueOpen > 0 ? 'red' : dueSoon > 2 ? 'amber' : 'green';
  return { overdueOpen, dueSoon, totalWindow: overdueOpen + dueSoon, tone };
}

function computeSales() {
  const deals = performanceSalesDeals || [];
  const won = deals.filter((d) => d.stage === 'won');
  const open = deals.filter((d) => !['won', 'lost'].includes(d.stage));
  const wonValue = won.reduce((sum, d) => sum + (Number(d.amount) || 0), 0);
  const weightedOpen = open.reduce((sum, d) => sum + (Number(d.amount) || 0) * (Number(d.probability) || 0.35), 0);
  const coveragePct = wonValue ? Math.round((weightedOpen / wonValue) * 100) : 120;
  const tone = coveragePct >= 90 ? 'green' : coveragePct >= 70 ? 'amber' : 'red';
  return {
    openCount: open.length,
    weightedOpen: Math.round(weightedOpen),
    wonValue: Math.round(wonValue),
    coveragePct,
    tone,
  };
}

function formatNumber(n) {
  if (!Number.isFinite(n)) return '—';
  if (Math.abs(n) >= 1_000_000) return `${Math.round((n / 1_000_000) * 10) / 10}M`;
  if (Math.abs(n) >= 1_000) return `${Math.round((n / 1_000) * 10) / 10}k`;
  return String(n);
}

function flowScore(metrics) {
  const penalty =
    metrics.deadlines.overdueOpen * 8 +
    Math.max(0, metrics.capacity.pressurePct - 100) * 0.6 +
    metrics.jobs.jobsAtRisk * 4 +
    (metrics.delivery.tone === 'red' ? 10 : metrics.delivery.tone === 'amber' ? 5 : 0) +
    (metrics.sales.tone === 'red' ? 8 : metrics.sales.tone === 'amber' ? 4 : 0);
  return clamp(95 - Math.round(penalty), 20, 99);
}

function FlowMeter({ metrics }) {
  const score = flowScore(metrics);
  const tone = metrics.deadlines.overdueOpen > 0
    ? 'red'
    : metrics.capacity.pressurePct > 110
      ? 'red'
      : metrics.delivery.tone === 'amber' || metrics.jobs.jobsAtRisk > 0 || metrics.capacity.pressurePct > 90
        ? 'amber'
        : 'green';
  const toneBg = tone === 'red'
    ? 'from-rose-500/20 to-rose-500/5 border-rose-200 dark:border-rose-400/30'
    : tone === 'amber'
      ? 'from-amber-500/20 to-amber-500/5 border-amber-200 dark:border-amber-400/30'
      : 'from-emerald-500/20 to-emerald-500/5 border-emerald-200 dark:border-emerald-400/30';

  const target = (() => {
    if (metrics.deadlines.overdueOpen > 0) return '#/app/performance/at-risk-deliverables?lens=deadlines';
    if (metrics.capacity.pressurePct > 110) return '#/app/performance/capacity?horizonDays=30';
    if (metrics.jobs.jobsAtRisk > 0) return '#/app/performance/jobs-at-risk';
    if (metrics.delivery.tone !== 'green') return '#/app/performance/at-risk-deliverables?lens=pace';
    if (metrics.sales.tone !== 'green') return '#/app/performance/reports/sales?view=revenue-fog';
    return '#/app/performance/overview';
  })();

  const statusLabel = tone === 'red' ? 'Attention needed' : tone === 'amber' ? 'Watchlist' : 'Flowing';
  const caption = metrics.deadlines.overdueOpen > 0
    ? 'Deadlines slipping'
    : metrics.capacity.pressurePct > 110
      ? 'Capacity is strained'
      : metrics.jobs.jobsAtRisk > 0
        ? 'Jobs flagged for follow-up'
        : metrics.delivery.tone !== 'green'
          ? 'Delivery pace is warming up'
          : metrics.sales.tone !== 'green'
            ? 'Revenue fog detected'
            : 'Steady state';

  return h(
    'button',
    {
      type: 'button',
      className: `lg:col-span-2 w-full rounded-2xl border bg-gradient-to-br ${toneBg} p-5 text-left shadow-sm transition hover:brightness-105`,
      onClick: () => navigate(target),
      title: 'Flow Meter drilldown',
    },
    [
      h('div', { className: 'flex items-center justify-between gap-3 flex-wrap' }, [
        h('div', { className: 'space-y-1' }, [
          h('div', { className: 'text-sm font-semibold text-slate-900 dark:text-white' }, 'Flow Meter'),
          h('div', { className: 'text-xs text-slate-600 dark:text-slate-200' }, caption),
        ]),
        h('div', { className: 'flex items-center gap-2' }, [
          h('span', { className: 'text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-200' }, statusLabel),
          h('span', {
            className: 'inline-flex items-center rounded-full border border-white/30 bg-white/20 px-3 py-1 text-sm font-semibold text-slate-900 dark:text-white backdrop-blur',
          }, `${score}%`),
        ]),
      ]),
      h('div', { className: 'mt-4 h-3 w-full rounded-full bg-white/60 dark:bg-white/10 overflow-hidden border border-white/40 dark:border-white/5' },
        h('div', {
          className: `h-full rounded-full ${tone === 'red' ? 'bg-rose-500' : tone === 'amber' ? 'bg-amber-400' : 'bg-emerald-500'}`,
          style: { width: `${score}%` },
        })
      ),
      h('div', { className: 'mt-3 text-xs text-slate-700 dark:text-slate-200' }, 'Click to jump to the highest-priority drilldown.'),
    ]
  );
}

function PulseTile({ title, value, subtext, tone, onClick, hint }) {
  const toneClasses = tone === 'red'
    ? 'border-rose-200 bg-white dark:bg-slate-900/80 dark:border-rose-400/30'
    : tone === 'amber'
      ? 'border-amber-200 bg-white dark:bg-slate-900/80 dark:border-amber-400/30'
      : 'border-emerald-200 bg-white dark:bg-slate-900/80 dark:border-emerald-300/40';
  const textTone = tone === 'red'
    ? 'text-rose-600 dark:text-rose-200'
    : tone === 'amber'
      ? 'text-amber-700 dark:text-amber-200'
      : 'text-emerald-700 dark:text-emerald-200';
  return h(
    'button',
    {
      type: 'button',
      className: `w-full rounded-2xl border shadow-sm p-4 text-left transition hover:-translate-y-[1px] ${toneClasses}`,
      onClick,
      title: hint || title,
    },
    [
      h('div', { className: 'text-sm font-semibold text-slate-900 dark:text-white' }, title),
      h('div', { className: `mt-2 text-3xl font-bold ${textTone}` }, value),
      h('div', { className: 'mt-1 text-sm text-slate-600 dark:text-slate-300' }, subtext),
    ]
  );
}

export function PerformancePulse() {
  const data = useMemo(() => {
    const jobs = enrichJobs();
    const deliverables = enrichDeliverables();
    const delivery = computeDelivery(jobs);
    const capacity = computeCapacity(deliverables, 30);
    const deadlines = computeDeadlines(deliverables);
    const sales = computeSales();
    const jobsTone = delivery.jobsAtRisk > 0 ? 'amber' : 'green';
    return { jobs, deliverables, delivery, capacity, deadlines, sales, jobsTone };
  }, []);

  const tiles = [
    {
      key: 'delivery',
      title: 'Delivery Pace',
      value: `${data.delivery.onTimePct}%`,
      subtext: `${data.delivery.jobsAtRisk} of ${data.delivery.activeCount || 0} jobs are warming up`,
      tone: data.delivery.tone,
      hint: 'Shows on-time effort vs timeline across active jobs.',
      onClick: () => navigate('#/app/performance/at-risk-deliverables?lens=pace'),
    },
    {
      key: 'jobs',
      title: 'Jobs at Risk',
      value: data.delivery.jobsAtRisk,
      subtext: `${data.delivery.activeCount || 0} active • tap to triage`,
      tone: data.jobsTone,
      hint: 'Jobs flagged by effort/timeline pressure.',
      onClick: () => navigate('#/app/performance/jobs-at-risk'),
    },
    {
      key: 'capacity',
      title: 'Capacity Pressure (30d)',
      value: `${data.capacity.pressurePct}%`,
      subtext: `${formatNumber(data.capacity.demand)}h demand vs ${formatNumber(data.capacity.capacity)}h capacity`,
      tone: data.capacity.tone,
      hint: 'Demand inside the next 30 days vs available capacity.',
      onClick: () => navigate('#/app/performance/capacity?horizonDays=30'),
    },
    {
      key: 'deadlines',
      title: 'Deadlines (7d)',
      value: data.deadlines.totalWindow,
      subtext: `Overdue ${data.deadlines.overdueOpen} • Due soon ${data.deadlines.dueSoon}`,
      tone: data.deadlines.tone,
      hint: 'Overdue and due-soon deliverables in the next week.',
      onClick: () => navigate('#/app/performance/at-risk-deliverables?lens=deadlines'),
    },
    {
      key: 'sales',
      title: 'Sales Pulse (Revenue Fog)',
      value: `$${formatNumber(data.sales.weightedOpen)}`,
      subtext: `${data.sales.openCount} open • ${data.sales.coveragePct}% coverage`,
      tone: data.sales.tone,
      hint: 'Weighted pipeline vs recent wins.',
      onClick: () => navigate('#/app/performance/reports/sales?view=revenue-fog'),
    },
  ];

  return h('div', { className: 'space-y-5' }, [
    h('div', { className: 'grid grid-cols-1 lg:grid-cols-2 gap-4' }, [
      h(FlowMeter, { metrics: { ...data } }),
      ...tiles.map((tile) => h(PulseTile, { key: tile.key, ...tile })),
    ]),
  ]);
}
