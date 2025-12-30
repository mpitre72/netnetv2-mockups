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

function computeFlowScore({
  deadlines,
  capacityPressurePct = 0,
  jobsNeedingTouch = 0,
  onPacePct = 100,
  fogPct = 0,
  checkInCount = 0,
  jobsInDriftTotal = 0,
  driverFallback = 'Everything looks steady',
} = {}) {
  let score = 0;
  const contributions = [];

  if ((deadlines?.unreviewedOverdue || 0) > 0) {
    const add = 40 + Math.min(20, deadlines.unreviewedOverdue * 10);
    score += add;
    contributions.push({ key: 'deadlines', value: add });
  }

  if (capacityPressurePct > 100) {
    const add = 30 + Math.min(15, (capacityPressurePct - 100) * 1);
    score += add;
    contributions.push({ key: 'capacity', value: add });
  } else if (capacityPressurePct >= 85) {
    const add = 15 + Math.min(10, (capacityPressurePct - 85) * 0.7);
    score += add;
    contributions.push({ key: 'capacity', value: add });
  }

  if (jobsNeedingTouch > 0) {
    const add = Math.min(20, jobsNeedingTouch * 10);
    score += add;
    contributions.push({ key: 'jobs', value: add });
  }

  if (onPacePct < 70) {
    score += 15; contributions.push({ key: 'momentum', value: 15 });
  } else if (onPacePct < 85) {
    score += 7; contributions.push({ key: 'momentum', value: 7 });
  }

  if (fogPct >= 50) {
    score += 10; contributions.push({ key: 'sales', value: 10 });
  } else if (fogPct >= 20) {
    score += 5; contributions.push({ key: 'sales', value: 5 });
  }

  if (checkInCount > 0) {
    const add = Math.min(6, checkInCount * 2);
    score += add;
    contributions.push({ key: 'checkins', value: add });
  }

  const flowScorePct = clamp(Math.round(score), 0, 100);
  const flowState = flowScorePct >= 90 ? 'Drifting' : flowScorePct >= 70 ? 'Watchlist' : 'In Flow';
  const flowMessage = flowState === 'In Flow'
    ? "You're in a steady flow right now."
    : flowState === 'Watchlist'
      ? 'A couple quick touches will keep you in flow.'
      : 'A few things are drifting — start with the biggest driver.';

  const driver = contributions.sort((a, b) => b.value - a.value)[0];
  const driverLabel = driver ? (
    driver.key === 'deadlines' ? 'deadlines' :
    driver.key === 'capacity' ? 'capacity' :
    driver.key === 'jobs' ? 'jobs in drift' :
    driver.key === 'momentum' ? 'momentum' :
    driver.key === 'sales' ? 'sales clarity' :
    driver.key === 'checkins' ? 'check-ins' : driverFallback
  ) : driverFallback;

  return { flowScorePct, flowState, flowMessage, driverLabel };
}

function toneToColor(tone) {
  if (tone === 'red') return { bar: 'bg-rose-500', text: 'text-rose-700 dark:text-rose-200', border: 'border-rose-200 dark:border-rose-400/40' };
  if (tone === 'amber') return { bar: 'bg-amber-500', text: 'text-amber-700 dark:text-amber-200', border: 'border-amber-200 dark:border-amber-400/40' };
  return { bar: 'bg-emerald-500', text: 'text-emerald-700 dark:text-emerald-200', border: 'border-emerald-200 dark:border-emerald-300/40' };
}

function toneLabel(tone) {
  if (tone === 'red') return 'Drifting';
  if (tone === 'amber') return 'Watchlist';
  return 'In Flow';
}

function FlowRiverMeter({ scorePct = 0, width = 520, height = 140 }) {
  const clamped = clamp(scorePct, 0, 100);
  const paddingX = 16;
  const bandHeight = 56;
  const bandTop = 28;
  const bandBottom = bandTop + bandHeight;
  const midY = bandTop + bandHeight / 2;
  const usableWidth = width - paddingX * 2;
  const markerX = paddingX + (clamped / 100) * usableWidth;

  const amp = clamped >= 90 ? 12 : clamped >= 70 ? 8 : 4;
  const points = [];
  const samples = 60;
  const phase = (clamped / 100) * Math.PI;
  for (let i = 0; i <= samples; i += 1) {
    const t = i / samples;
    const x = paddingX + usableWidth * t;
    const y = midY + amp * Math.sin(t * Math.PI * 2 + phase);
    points.push({ x, y });
  }
  const wavePath = points.reduce((acc, pt, idx) => {
    const cmd = idx === 0 ? 'M' : 'L';
    return `${acc} ${cmd} ${pt.x.toFixed(2)} ${pt.y.toFixed(2)}`;
  }, '').trim();

  const greenWidth = usableWidth * 0.7;
  const amberWidth = usableWidth * 0.2;
  const redWidth = usableWidth * 0.1;

  const labels = [
    { text: 'In Flow', x: paddingX + greenWidth / 2 },
    { text: 'Watchlist', x: paddingX + greenWidth + amberWidth / 2 },
    { text: 'Drifting', x: paddingX + greenWidth + amberWidth + redWidth / 2 },
  ];

  return h('svg', { viewBox: `0 0 ${width} ${height}`, className: 'w-full', preserveAspectRatio: 'xMidYMid meet' }, [
    h('rect', { x: paddingX, y: bandTop, width: greenWidth, height: bandHeight, rx: 12, fill: '#05966933' }),
    h('rect', { x: paddingX + greenWidth, y: bandTop, width: amberWidth, height: bandHeight, rx: 0, fill: '#d9770633' }),
    h('rect', { x: paddingX + greenWidth + amberWidth, y: bandTop, width: redWidth, height: bandHeight, rx: 0, fill: '#e11d4833' }),
    h('rect', { x: paddingX, y: bandTop, width: usableWidth, height: bandHeight, rx: 12, stroke: 'rgba(148,163,184,0.5)', strokeWidth: 1, fill: 'none' }),
    h('path', { d: wavePath, stroke: '#0284c7', strokeWidth: 4, fill: 'none' }),
    h('line', { x1: markerX, y1: bandTop - 8, x2: markerX, y2: bandBottom + 8, stroke: 'rgba(0,0,0,0.35)', strokeWidth: 8, strokeLinecap: 'round', pointerEvents: 'none' }),
    h('line', { x1: markerX, y1: bandTop - 8, x2: markerX, y2: bandBottom + 8, stroke: 'rgba(255,255,255,0.95)', strokeWidth: 6, strokeLinecap: 'round', pointerEvents: 'none' }),
    h('circle', { cx: markerX, cy: bandTop - 10, r: 5, fill: 'rgba(255,255,255,0.95)', stroke: 'rgba(0,0,0,0.35)', strokeWidth: 1, pointerEvents: 'none' }),
    h('g', { className: 'text-[10px] font-semibold fill-slate-500 dark:fill-slate-300' },
      labels.map((lbl) =>
        h('text', { key: lbl.text, x: lbl.x, y: bandBottom + 18, textAnchor: 'middle' }, lbl.text)
      )
    ),
  ]);
}

function StateDots({ tone }) {
  const active = toneLabel(tone);
  const dots = [
    { label: 'Drifting', color: 'bg-rose-500', muted: 'bg-rose-200 dark:bg-rose-900/40' },
    { label: 'Watchlist', color: 'bg-amber-500', muted: 'bg-amber-200 dark:bg-amber-900/40' },
    { label: 'In Flow', color: 'bg-emerald-500', muted: 'bg-emerald-200 dark:bg-emerald-900/40' },
  ];
  return h('div', { className: 'flex items-center gap-2' }, [
    h('div', { className: 'flex flex-col gap-1 items-center' },
      dots.map((d) =>
        h('span', {
          key: d.label,
          className: `w-2.5 h-2.5 rounded-full ${active === d.label ? d.color : d.muted}`,
          title: d.label,
        })
      )
    ),
    h('span', { className: 'text-xs font-semibold text-slate-600 dark:text-slate-300' }, active),
  ]);
}

function FlowMeterHero({ metrics }) {
  const { flowScorePct, flowState, flowMessage, driverLabel } = metrics.flow;
  const tone = flowState === 'Drifting' ? 'red' : flowState === 'Watchlist' ? 'amber' : 'green';
  const clampedScore = clamp(flowScorePct, 0, 100);
  const target = (() => {
    if (metrics.deadlines.unreviewedOverdue > 0) return '#/app/performance/at-risk-deliverables?lens=deadlines';
    if ((Number(metrics.capacity?.capacityPressurePct) || 0) > 110) return '#/app/performance/capacity?horizonDays=30';
    if ((metrics.jobsAtRisk?.jobsAtRiskNeedingAttention || 0) > 0) return '#/app/performance/jobs-at-risk';
    if (metrics.delivery.tone !== 'green') return '#/app/performance/at-risk-deliverables?lens=pace';
    if (metrics.sales.tone !== 'green') return '#/app/performance/reports/sales?view=revenue-fog';
    return '#/app/performance/overview';
  })();

  const dayOffAnswer = flowState === 'In Flow' ? 'Yeah, you could.' : flowState === 'Watchlist' ? 'Maybe.' : 'Probably not.';

  return h('button', {
    type: 'button',
    className: 'w-full text-left focus-visible:outline-none',
    onClick: () => navigate(target),
    title: 'Flow Meter drilldown',
  }, h(PerfCard, { className: 'space-y-6 border-slate-200 dark:border-white/10 hover:-translate-y-[1px] transition' }, [
    h('div', { className: 'text-center space-y-3' }, [
      h('div', { className: 'text-2xl font-semibold text-slate-900 dark:text-white' }, 'Flow Meter'),
      h('div', { className: 'relative w-[80%] max-w-[640px] mx-auto' }, [
        h(FlowRiverMeter, { scorePct: clampedScore }),
      ]),
      h('div', { className: 'text-sm text-slate-700 dark:text-slate-200' }, flowMessage),
      h('div', { className: 'text-sm text-slate-600 dark:text-slate-300' }, `Driven by: ${driverLabel}.`),
      h('div', { className: 'text-[11px] text-slate-500 dark:text-slate-400' }, 'Tap to see what to do next.'),
      h('div', { className: 'text-sm text-slate-800 dark:text-slate-100' }, `Can I take this day off? ${dayOffAnswer}`),
    ]),
  ]));
}

function MiniSignalCard({ title, subtitle, value, label, subtext, baseline, tone, onClick, badge }) {
  const colors = tone === 'red'
    ? 'text-rose-600 dark:text-rose-200'
    : tone === 'amber'
      ? 'text-amber-600 dark:text-amber-200'
      : 'text-emerald-600 dark:text-emerald-200';
  const safeValue = (value ?? '').toString();
  const safeLabel = (label ?? '').toString();
  return h('button', {
    type: 'button',
    className: 'w-full text-left focus-visible:outline-none',
    onClick,
    title: title,
  }, h(PerfCard, { variant: 'secondary', className: `flex flex-col gap-3 border-slate-200 dark:border-white/10 hover:-translate-y-[1px] transition` }, [
    h('div', { className: 'flex items-start justify-between gap-3' }, [
      h('div', { className: 'space-y-1 min-w-0' }, [
        h('div', { className: 'flex items-center gap-2 flex-wrap' }, [
          h('div', { className: 'text-sm font-semibold text-slate-900 dark:text-white' }, title),
          badge ? h('span', { className: 'text-[11px] px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-200' }, badge) : null,
        ]),
        h('div', { className: 'text-xs text-slate-600 dark:text-slate-300' }, subtitle),
      ]),
      h(StateDots, { tone }),
    ]),
      h('div', { className: 'space-y-2 text-center' }, [
      h('div', { className: `text-[70px] leading-none font-semibold ${colors}` }, safeValue),
      h('div', { className: 'text-2xl font-medium text-slate-800 dark:text-slate-200 leading-tight' }, safeLabel),
      baseline ? h('div', { className: 'text-xs text-slate-600 dark:text-slate-300' }, baseline) : null,
      subtext ? h('div', { className: 'text-xs text-slate-500 dark:text-slate-400' }, subtext) : null,
    ]),
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

  // Momentum (Option A: % on pace using planned hours)
  const activeJobs = data.jobs.filter((j) => j.status === 'active');
  const totalPaceHours = activeJobs.reduce((sum, j) => sum + (Number(j.estHours) || 0), 0);
  const onPaceHours = activeJobs.filter((j) => !j.atRisk).reduce((sum, j) => sum + (Number(j.estHours) || 0), 0);
  const onPacePct = totalPaceHours > 0 ? Math.round((onPaceHours / totalPaceHours) * 100) : 100;
  const momentumTone = totalPaceHours === 0
    ? 'amber'
    : onPacePct >= 75
      ? 'green'
      : onPacePct >= 55
        ? 'amber'
        : 'red';

  // Jobs in Drift
  const jobsNeedingTouch = data.jobsAtRisk.jobsAtRiskNeedingAttention || 0;
  const jobsInDriftTotal = data.jobsAtRisk.jobsAtRiskCount || 0;
  const jobsInDriftReviewed = data.jobsAtRisk.jobsAtRiskReviewedCount || 0;
  const activeJobsTotal = data.delivery.activeCount || 0;
  const hasUnreviewedOverdue = data.jobsAtRisk.jobsAtRisk.some((job) =>
    (job.atRiskDeliverables || []).some((d) => d.overdue && !d.reviewed)
  );
  const jobsTone = hasUnreviewedOverdue
    ? 'red'
    : jobsNeedingTouch > 0
      ? 'amber'
      : 'green';

  // Capacity
  const capacityTone = data.capacity.capacityPressurePct == null
    ? 'amber'
    : data.capacity.capacityPressurePct > 100
      ? 'red'
      : data.capacity.capacityPressurePct >= 85
        ? 'amber'
        : 'green';

  // Due soon
  const dueSoonTotal = data.deadlines.totalWindow || 0;
  const overdueTotal = data.deadlines.overdueOpen || 0;
  const overdueUnreviewed = data.deadlines.unreviewedOverdue || 0;
  const dueTone = overdueUnreviewed > 0 ? 'red' : overdueTotal > 0 ? 'amber' : 'green';

  // Sales clarity
  const openDeals = performanceSalesDeals.filter((d) => !['won', 'lost'].includes(d.stage || ''));
  const unbudgetedDeals = openDeals.filter((d) => {
    const amt = Number(d.amount);
    const prob = Number(d.probability);
    return !Number.isFinite(amt) || amt <= 0 || !Number.isFinite(prob) || prob < 0.5;
  });
  const budgetedDeals = openDeals.length - unbudgetedDeals.length;
  const fogPct = openDeals.length ? Math.round((unbudgetedDeals.length / openDeals.length) * 100) : 0;
  const salesTone = fogPct > 50 ? 'red' : fogPct >= 20 ? 'amber' : 'green';

  // Check-ins tile
  const checkTone = data.checkIn > 0 ? 'amber' : 'green';
  const flow = computeFlowScore({
    deadlines: {
      unreviewedOverdue: data.deadlines.unreviewedOverdue,
      overdueTotal: data.deadlines.overdueOpen,
      dueSoonTotal: data.deadlines.dueSoon,
    },
    capacityPressurePct: data.capacity.capacityPressurePct,
    jobsNeedingTouch,
    jobsInDriftTotal,
    activeJobsTotal,
    onPacePct,
    fogPct,
    checkInCount: data.checkIn,
  });

  const signals = [
    {
      key: 'momentum',
      title: 'Momentum',
      subtitle: 'Are deliverables finishing steadily?',
      value: totalPaceHours > 0 ? `${onPacePct}%` : '—',
      label: 'On Pace',
      baseline: totalPaceHours > 0
        ? `${Math.round(onPaceHours)}h of ${Math.round(totalPaceHours)}h planned is on pace.`
        : 'Not enough data yet',
      tone: momentumTone,
      onClick: () => navigate('#/app/performance/at-risk-deliverables?lens=pace'),
    },
    {
      key: 'jobs',
      title: 'Jobs in Drift',
      subtitle: 'Which jobs need a touch?',
      value: `${jobsNeedingTouch}`,
      label: 'Need a touch',
      baseline: `${jobsInDriftTotal} in drift • ${jobsInDriftReviewed} reviewed • ${activeJobsTotal} active`,
      tone: jobsTone,
      onClick: () => navigate('#/app/performance/jobs-at-risk'),
    },
    {
      key: 'capacity',
      title: 'Capacity Outlook',
      subtitle: 'Do we have room to breathe?',
      badge: '30d',
      value: data.capacity.capacityPressurePct == null ? '—' : `${Math.round(data.capacity.capacityPressurePct)}%`,
      label: 'Used',
      baseline: (data.capacity.capacityHours || 0) > 0
        ? `${formatNumber(data.capacity.knownDemandHours)}h assigned of ${formatNumber(data.capacity.capacityHours)}h available`
        : 'Not enough data yet',
      tone: capacityTone,
      onClick: () => navigate('#/app/performance/capacity?horizonDays=30'),
    },
    {
      key: 'deadlines',
      title: 'Due Soon (7d)',
      subtitle: 'What’s coming up next?',
      value: `${dueSoonTotal}`,
      label: 'Due Soon',
      baseline: `Past due: ${overdueTotal} (${overdueUnreviewed} unreviewed)`,
      tone: dueTone,
      onClick: () => navigate('#/app/performance/at-risk-deliverables?lens=deadlines'),
    },
    {
      key: 'sales',
      title: 'Sales Clarity',
      subtitle: 'Which deals need numbers?',
      value: `${unbudgetedDeals.length}`,
      label: 'Need budgets',
      baseline: openDeals.length
        ? `${unbudgetedDeals.length} foggy • ${budgetedDeals} clear • ${openDeals.length} open`
        : 'Not enough data yet',
      subtext: openDeals.length ? `Weighted open: ${formatNumber(data.sales.weightedOpen)}` : '',
      tone: salesTone,
      onClick: () => navigate('#/app/performance/reports/sales?view=revenue-fog'),
    },
    {
      key: 'checkins',
      title: 'Check-ins',
      subtitle: 'Anything near done that needs a quick check?',
      value: `${data.checkIn}`,
      label: 'Quick check-ins',
      baseline: 'Near completion (85–100%) • confidence not set',
      tone: checkTone,
      onClick: () => navigate('#/app/performance/at-risk-deliverables?lens=confidence'),
    },
  ];

  return h('div', { className: 'space-y-5' }, [
    h(FlowMeterHero, { metrics: {
      delivery: data.delivery,
      capacity: data.capacity,
      deadlines: data.deadlines,
      sales: data.sales,
      jobsAtRisk: data.jobsAtRisk,
      flow,
    } }),
    h('div', { className: 'text-xs text-slate-500 dark:text-slate-400' }, 'Colors show attention, not success: In Flow · Watchlist · Drifting.'),
    h('div', { className: 'grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3' },
      signals.map((sig) => h(MiniSignalCard, { key: sig.key, ...sig }))
    ),
  ]);
}
