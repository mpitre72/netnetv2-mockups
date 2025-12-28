import { navigate } from '../../router.js';
import { performanceJobs, performanceSalesDeals } from '../performance-data.js';
import { getEffectiveState } from '../testdata/performance-state.js';
import { buildJobsAtRiskRollup } from '../lib/jobs-at-risk-rollup.js';
import { buildCapacityForecast } from '../lib/capacity-forecast.js';
import { PerfCard } from '../../components/performance/primitives.js';

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

function enrichDeliverables(list) {
  const today = new Date();
  const next7 = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);
  return list.map((d) => {
    const due = new Date(d.due);
    const overdue = !isNaN(due) && due < today;
    const dueSoon = !isNaN(due) && due >= today && due <= next7;
    const durationConsumed = clamp(Math.round(d.durationConsumed || d.timelinePct || 0), 0, 200);
    const effortConsumed = clamp(Math.round(d.effortConsumed || d.effortPct || 0), 0, 200);
    const atRisk = durationConsumed > 90 || effortConsumed > 90 || overdue;
    return { ...d, overdue, dueSoon, atRisk, effortConsumed, durationConsumed, reviewed: d.reviewed };
  });
}

function computeDelivery(jobs) {
  const active = jobs.filter((j) => j.status === 'active');
  const atRisk = active.filter((j) => j.atRisk);
  const onTimePct = active.length ? Math.round(((active.length - atRisk.length) / active.length) * 100) : 100;
  const tone = onTimePct >= 85 ? 'green' : onTimePct >= 70 ? 'amber' : 'red';
  return { onTimePct, tone, jobsAtRisk: atRisk.length, activeCount: active.length };
}

function computeDeadlines(deliverables) {
  const open = deliverables.filter((d) => d.status !== 'completed');
  const overdueAll = open.filter((d) => d.overdue);
  const dueSoonAll = open.filter((d) => d.dueSoon);
  const overdueUnreviewed = overdueAll.filter((d) => !d.reviewed);
  const dueSoonUnreviewed = dueSoonAll.filter((d) => !d.reviewed);
  const tone = overdueUnreviewed.length > 0 ? 'red' : dueSoonUnreviewed.length > 2 ? 'amber' : 'green';
  return {
    overdueOpen: overdueAll.length,
    dueSoon: dueSoonAll.length,
    totalWindow: overdueAll.length + dueSoonAll.length,
    unreviewedOverdue: overdueUnreviewed.length,
    unreviewedDueSoon: dueSoonUnreviewed.length,
    tone,
  };
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
  const overdue = Number(metrics?.deadlines?.unreviewedOverdue) || 0;
  const pressure = Number(metrics?.capacity?.capacityPressurePct) || 0;
  const jobsAtRisk = Number(metrics?.jobsAtRisk?.jobsAtRiskNeedingAttention) || 0;
  const deliveryTone = metrics?.delivery?.tone || 'green';
  const salesTone = metrics?.sales?.tone || 'green';
  const penalty =
    overdue * 8 +
    Math.max(0, pressure - 100) * 0.6 +
    jobsAtRisk * 4 +
    (deliveryTone === 'red' ? 10 : deliveryTone === 'amber' ? 5 : 0) +
    (salesTone === 'red' ? 8 : salesTone === 'amber' ? 4 : 0);
  return clamp(95 - Math.round(penalty), 20, 99);
}

function FlowMeter({ metrics }) {
  const score = flowScore(metrics);
  const tone = metrics.deadlines.unreviewedOverdue > 0
    ? 'red'
    : (Number(metrics.capacity?.capacityPressurePct) || 0) > 110
      ? 'red'
      : metrics.delivery.tone === 'amber' || (metrics.jobsAtRisk?.jobsAtRiskNeedingAttention || 0) > 0 || (Number(metrics.capacity?.capacityPressurePct) || 0) > 90 || metrics.deadlines.unreviewedDueSoon > 0
        ? 'amber'
        : 'green';
  const toneBg = tone === 'red'
    ? 'border-rose-200 dark:border-rose-400/30 bg-gradient-to-br from-rose-50/70 to-white dark:from-rose-900/30 dark:to-slate-900'
    : tone === 'amber'
      ? 'border-amber-200 dark:border-amber-400/30 bg-gradient-to-br from-amber-50/70 to-white dark:from-amber-900/30 dark:to-slate-900'
      : 'border-emerald-200 dark:border-emerald-400/30 bg-gradient-to-br from-emerald-50/70 to-white dark:from-emerald-900/30 dark:to-slate-900';

  const target = (() => {
    if (metrics.deadlines.unreviewedOverdue > 0) return '#/app/performance/at-risk-deliverables?lens=deadlines';
    if ((Number(metrics.capacity?.capacityPressurePct) || 0) > 110) return '#/app/performance/capacity?horizonDays=30';
    if ((metrics.jobsAtRisk?.jobsAtRiskNeedingAttention || 0) > 0) return '#/app/performance/jobs-at-risk';
    if (metrics.delivery.tone !== 'green') return '#/app/performance/at-risk-deliverables?lens=pace';
    if (metrics.sales.tone !== 'green') return '#/app/performance/reports/sales?view=revenue-fog';
    return '#/app/performance/overview';
  })();

  const statusLabel = tone === 'red' ? 'Attention needed' : tone === 'amber' ? 'Watchlist' : 'Flowing';
  const caption = metrics.deadlines.unreviewedOverdue > 0
    ? 'Unreviewed deadlines slipping'
    : (Number(metrics.capacity?.capacityPressurePct) || 0) > 110
      ? 'Capacity is strained'
    : (metrics.jobsAtRisk?.jobsAtRiskNeedingAttention || 0) > 0
      ? 'Jobs flagged for follow-up'
    : metrics.delivery.tone !== 'green'
      ? 'Delivery pace is warming up'
      : metrics.sales.tone !== 'green'
        ? 'Revenue fog detected'
        : 'Steady state';

  return h('button', {
    type: 'button',
    className: 'lg:col-span-2 w-full text-left focus-visible:outline-none',
    onClick: () => navigate(target),
    title: 'Flow Meter drilldown',
  }, h(PerfCard, { className: `transition hover:-translate-y-[1px] ${toneBg}` }, [
    h('div', { className: 'flex items-center justify-between gap-3 flex-wrap' }, [
      h('div', { className: 'space-y-1' }, [
        h('div', { className: 'text-sm font-semibold text-slate-900 dark:text-white' }, 'Flow Meter'),
        h('div', { className: 'text-xs text-slate-600 dark:text-slate-200' }, caption),
      ]),
      h('div', { className: 'flex items-center gap-2' }, [
        h('span', { className: 'text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-200' }, statusLabel),
        h('span', {
          className: 'inline-flex items-center rounded-full border border-white/30 bg-white/70 dark:bg-white/10 px-3 py-1 text-sm font-semibold text-slate-900 dark:text-white backdrop-blur',
        }, `${score}%`),
      ]),
    ]),
    h('div', { className: 'mt-4 h-3 w-full rounded-full bg-white/70 dark:bg-white/10 overflow-hidden border border-white/50 dark:border-white/10' },
      h('div', {
        className: `h-full rounded-full ${tone === 'red' ? 'bg-rose-500' : tone === 'amber' ? 'bg-amber-400' : 'bg-emerald-500'}`,
        style: { width: `${score}%` },
      })
    ),
    h('div', { className: 'mt-3 text-[11px] text-slate-600 dark:text-slate-300' }, 'Click to jump to the highest-priority drilldown.'),
  ]));
}

function PulseTile({ title, value, subtext, tone, onClick, hint }) {
  const toneClasses = tone === 'red'
    ? 'border-rose-200 dark:border-rose-400/40 bg-gradient-to-br from-rose-50/70 to-white dark:from-rose-900/30 dark:to-slate-900'
    : tone === 'amber'
      ? 'border-amber-200 dark:border-amber-400/40 bg-gradient-to-br from-amber-50/70 to-white dark:from-amber-900/30 dark:to-slate-900'
      : 'border-emerald-200 dark:border-emerald-400/40 bg-gradient-to-br from-emerald-50/70 to-white dark:from-emerald-900/30 dark:to-slate-900';
  const textTone = tone === 'red'
    ? 'text-rose-600 dark:text-rose-200'
    : tone === 'amber'
      ? 'text-amber-700 dark:text-amber-200'
      : 'text-emerald-700 dark:text-emerald-200';
  return h('button', {
    type: 'button',
    className: 'w-full text-left focus-visible:outline-none',
    onClick,
    title: hint || title,
  }, h(PerfCard, { className: `transition hover:-translate-y-[1px] ${toneClasses}` }, [
    h('div', { className: 'text-sm font-semibold text-slate-900 dark:text-white' }, title),
    h('div', { className: `mt-2 text-3xl font-bold ${textTone}` }, value),
    h('div', { className: 'mt-1 text-sm text-slate-600 dark:text-slate-300' }, subtext),
  ]));
}

export function PerformancePulse() {
  const data = useMemo(() => {
    const state = getEffectiveState();
    const jobs = enrichJobs();
    const deliverables = enrichDeliverables(state.deliverables || []);
    const delivery = computeDelivery(jobs);
    const capacity = buildCapacityForecast({ horizonDays: 30, team: state.team, jobs: state.jobs, deliverables: state.deliverables, tasks: state.tasks });
    const deadlines = computeDeadlines(deliverables);
    const sales = computeSales();
    const jobsAtRisk = buildJobsAtRiskRollup({ jobs: state.jobs, deliverables: state.deliverables });
    const hasSeverity3 = jobsAtRisk.jobsAtRisk.some((j) => j.severity === 3);
    const jobsTone = jobsAtRisk.jobsAtRiskCount === 0
      ? 'green'
      : jobsAtRisk.jobsAtRiskNeedingAttention > 0 && hasSeverity3
        ? 'red'
        : 'amber';
    const checkIn = (state.deliverables || []).filter((d) => d.needsCheckIn && !d.progressConfidence).length;
    return { jobs, deliverables, delivery, capacity, deadlines, sales, jobsTone, checkIn, jobsAtRisk };
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
      value: data.jobsAtRisk.jobsAtRiskCount,
      subtext: `${data.jobsAtRisk.jobsAtRiskNeedingAttention} need attention • ${data.jobsAtRisk.jobsAtRiskReviewedCount} reviewed`,
      tone: data.jobsTone,
      hint: 'Jobs flagged by effort/timeline pressure.',
      onClick: () => navigate('#/app/performance/jobs-at-risk'),
    },
    {
      key: 'capacity',
      title: 'Capacity Pressure (30d)',
      value: data.capacity.capacityPressurePct == null ? 'Unknown' : `${data.capacity.capacityPressurePct}%`,
      subtext: `${formatNumber(data.capacity.knownDemandHours)}h demand vs ${formatNumber(data.capacity.capacityHours)}h capacity`,
      tone: data.capacity.capacityPressurePct == null
        ? 'amber'
        : data.capacity.capacityPressurePct > 100
          ? 'red'
          : data.capacity.capacityPressurePct >= 85
            ? 'amber'
            : 'green',
      hint: 'Demand inside the next 30 days vs available capacity.',
      onClick: () => navigate('#/app/performance/capacity?horizonDays=30'),
    },
    {
      key: 'deadlines',
      title: 'Deadlines (7d)',
      value: data.deadlines.totalWindow,
      subtext: `Overdue ${data.deadlines.overdueOpen} (${data.deadlines.unreviewedOverdue} unreviewed) • Due soon ${data.deadlines.dueSoon}`,
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
    data.checkIn > 0
      ? h('div', { className: 'text-sm text-slate-600 dark:text-slate-300' }, `${data.checkIn} deliverables nearing completion need a confidence check-in.`)
      : null,
  ]);
}
