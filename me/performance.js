import { navigate } from '../router.js';
import {
  KPIBox,
  StackedMeter,
  MovedDateIndicator,
} from '../components/performance/primitives.js';

import {
  performanceJobs,
  performanceDeliverables,
  performanceTasks,
  performanceTimeEntries,
  performanceTeam,
  performanceServiceTypes,
} from '../performance/performance-data.js';

const { createElement: h, useMemo, useState } = React;
const { createRoot } = ReactDOM;

const cardBase = 'bg-slate-950/40 border border-white/10 rounded-2xl shadow-sm shadow-black/20';

function isoDateShift(days) {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
}

function formatHours(hours) {
  if (!Number.isFinite(hours)) return '—';
  if (hours === 0) return '0h';
  const rounded = Math.round(hours * 10) / 10;
  return `${rounded}h`;
}

function buildMaps() {
  const jobById = Object.fromEntries(performanceJobs.map((j) => [j.id, j]));
  const deliverableById = Object.fromEntries(performanceDeliverables.map((d) => [d.id, d]));
  const taskById = Object.fromEntries(performanceTasks.map((t) => [t.id, t]));
  const memberById = Object.fromEntries(performanceTeam.map((m) => [m.id, m]));
  const serviceTypeById = Object.fromEntries(performanceServiceTypes.map((s) => [s.id, s]));
  return { jobById, deliverableById, taskById, memberById, serviceTypeById };
}

function getEntryMemberId(entry, taskById) {
  if (entry.memberId) return entry.memberId;
  if (entry.quickTask) return entry.memberId || null;
  if (!entry.taskId) return null;
  return taskById[entry.taskId]?.assigneeId || null;
}

function getEntryServiceTypeId(entry, taskById) {
  if (entry.serviceTypeId) return entry.serviceTypeId;
  if (!entry.taskId) return 'other';
  return taskById[entry.taskId]?.serviceTypeId || 'other';
}

function getEntryDeliverableId(entry, taskById) {
  if (!entry.taskId) return null;
  return taskById[entry.taskId]?.deliverableId || null;
}

function diffDays(ymdA, ymdB) {
  const a = new Date(`${ymdA}T00:00:00`);
  const b = new Date(`${ymdB}T00:00:00`);
  const ms = a.getTime() - b.getTime();
  return Math.round(ms / 86400000);
}

function toneForPercent(pct) {
  if (!Number.isFinite(pct)) return 'neutral';
  if (pct <= 105) return 'good';
  if (pct <= 115) return 'warning';
  return 'bad';
}

function computeWeightedLoe({ memberId, start, end, taskById }) {
  // LOE = weighted average of (actual/baseline) for completed deliverables in-range, weighted by member hours.
  const completed = performanceDeliverables.filter(
    (d) => d.status === 'completed' && (d.completedAt || d.due) && (d.completedAt || d.due) >= start && (d.completedAt || d.due) <= end
  );

  const memberHoursByDeliverable = {};
  const allHoursByDeliverable = {};

  for (const te of performanceTimeEntries) {
    const deliverableId = getEntryDeliverableId(te, taskById);
    if (!deliverableId) continue;

    const hrs = te.hours || 0;
    allHoursByDeliverable[deliverableId] = (allHoursByDeliverable[deliverableId] || 0) + hrs;

    const teMember = getEntryMemberId(te, taskById);
    if (teMember !== memberId) continue;
    if (te.date < start || te.date > end) continue;
    memberHoursByDeliverable[deliverableId] = (memberHoursByDeliverable[deliverableId] || 0) + hrs;
  }

  let weighted = 0;
  let weight = 0;

  for (const d of completed) {
    const contributed = memberHoursByDeliverable[d.id] || 0;
    if (!contributed) continue;
    const baseline = d.estHours || 0;
    const actual = allHoursByDeliverable[d.id] || 0;
    if (!baseline || !actual) continue;
    const ratio = actual / baseline;
    weighted += ratio * contributed;
    weight += contributed;
  }

  if (!weight) return null;
  return (weighted / weight) * 100;
}

function MyPerformance() {
  const maps = useMemo(() => buildMaps(), []);

  const [memberId, setMemberId] = useState(performanceTeam[0]?.id || '');
  const [rangeDays, setRangeDays] = useState(30);
  const [compare, setCompare] = useState(false);

  const today = useMemo(() => isoDateShift(0), []);
  const end = today;
  const start = useMemo(() => isoDateShift(-(rangeDays - 1)), [rangeDays]);

  const prevEnd = useMemo(() => isoDateShift(-rangeDays), [rangeDays]);
  const prevStart = useMemo(() => isoDateShift(-(rangeDays * 2 - 1)), [rangeDays]);

  const myEntries = useMemo(() => {
    const rows = [];
    for (const te of performanceTimeEntries) {
      const teMember = getEntryMemberId(te, maps.taskById);
      if (teMember !== memberId) continue;
      if (te.date < start || te.date > end) continue;
      rows.push(te);
    }
    return rows;
  }, [memberId, start, end, maps.taskById]);

  const prevEntries = useMemo(() => {
    if (!compare) return [];
    const rows = [];
    for (const te of performanceTimeEntries) {
      const teMember = getEntryMemberId(te, maps.taskById);
      if (teMember !== memberId) continue;
      if (te.date < prevStart || te.date > prevEnd) continue;
      rows.push(te);
    }
    return rows;
  }, [compare, memberId, prevStart, prevEnd, maps.taskById]);

  const totalHours = useMemo(() => myEntries.reduce((sum, te) => sum + (te.hours || 0), 0), [myEntries]);
  const prevTotalHours = useMemo(() => prevEntries.reduce((sum, te) => sum + (te.hours || 0), 0), [prevEntries]);

  const daysLogged = useMemo(() => new Set(myEntries.map((te) => te.date)).size, [myEntries]);
  const prevDaysLogged = useMemo(() => new Set(prevEntries.map((te) => te.date)).size, [prevEntries]);
  const hygienePct = useMemo(() => (rangeDays ? Math.round((daysLogged / rangeDays) * 100) : 0), [daysLogged, rangeDays]);

  const serviceTotals = useMemo(() => {
    const map = {};
    for (const te of myEntries) {
      const st = getEntryServiceTypeId(te, maps.taskById);
      map[st] = (map[st] || 0) + (te.hours || 0);
    }
    return map;
  }, [myEntries, maps.taskById]);

  const topService = useMemo(() => {
    const rows = Object.entries(serviceTotals)
      .map(([id, hrs]) => ({ id, hrs }))
      .sort((a, b) => b.hrs - a.hrs);
    return rows[0] || null;
  }, [serviceTotals]);

  const myDeliverableHours = useMemo(() => {
    const map = {};
    for (const te of myEntries) {
      const deliverableId = getEntryDeliverableId(te, maps.taskById);
      if (!deliverableId) continue;
      map[deliverableId] = (map[deliverableId] || 0) + (te.hours || 0);
    }
    return map;
  }, [myEntries, maps.taskById]);

  const activeDeliverables = useMemo(() => {
    const rows = Object.entries(myDeliverableHours)
      .map(([id, hrs]) => ({ deliverable: maps.deliverableById[id], hrs }))
      .filter((r) => r.deliverable)
      .sort((a, b) => {
        // At-risk first, then due date.
        const arA = isDeliverableAtRisk(r.deliverable, today) ? 1 : 0;
        const arB = isDeliverableAtRisk(r.deliverable, today) ? 1 : 0;
        if (arA !== arB) return arB - arA;
        return (r.deliverable.due || '').localeCompare(r.deliverable.due || '');
      });
    return rows;
  }, [myDeliverableHours, maps.deliverableById, today]);

  const atRiskCount = useMemo(
    () => activeDeliverables.filter((r) => r.deliverable.status !== 'completed' && isDeliverableAtRisk(r.deliverable, today)).length,
    [activeDeliverables, today]
  );

  const dueSoonCount = useMemo(
    () =>
      activeDeliverables.filter((r) => {
        if (r.deliverable.status === 'completed') return false;
        const days = diffDays(r.deliverable.due, today);
        return days >= 0 && days <= 7;
      }).length,
    [activeDeliverables, today]
  );

  const myLoe = useMemo(() => computeWeightedLoe({ memberId, start, end, taskById: maps.taskById }), [memberId, start, end, maps.taskById]);
  const myLoeTone = useMemo(() => toneForPercent(myLoe), [myLoe]);

  const recentActivity = useMemo(() => {
    const rows = [...myEntries].sort((a, b) => (b.date || '').localeCompare(a.date || ''));
    return rows.slice(0, 12);
  }, [myEntries]);

  return h('div', { className: 'max-w-6xl mx-auto px-4 py-6 lg:py-8 space-y-6' }, [
    h('div', { className: 'flex flex-col gap-3 md:flex-row md:items-center md:justify-between' }, [
      h('div', { className: 'space-y-1' }, [
        h('h2', { className: 'text-xl font-semibold text-slate-900 dark:text-white' }, 'My Performance'),
        h('p', { className: 'text-sm text-slate-600 dark:text-slate-300' }, `Showing ${start} → ${end}`),
        compare
          ? h('p', { className: 'text-xs text-slate-500 dark:text-slate-400' }, `Comparing to ${prevStart} → ${prevEnd}`)
          : null,
      ]),
      h('div', { className: 'flex flex-wrap items-center gap-3' }, [
        h('div', { className: 'flex items-center gap-2' }, [
          h('span', { className: 'text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400' }, 'Me'),
          h(
            'select',
            {
              value: memberId,
              onChange: (e) => setMemberId(e.target.value),
              className: 'rounded-lg border border-slate-300 dark:border-white/10 bg-white dark:bg-slate-900 px-3 py-2 text-sm text-slate-800 dark:text-white',
            },
            performanceTeam.map((m) => h('option', { key: m.id, value: m.id }, m.name))
          ),
        ]),
        h('div', { className: 'flex items-center gap-2' }, [
          h('span', { className: 'text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400' }, 'Range'),
          h('div', { className: 'inline-flex items-center gap-1 rounded-full border border-slate-300 dark:border-white/10 bg-slate-50 dark:bg-slate-800 px-1 py-1' }, [
            [7, 30, 90].map((d) =>
              h(
                'button',
                {
                  key: d,
                  type: 'button',
                  className: [
                    'px-3 py-1 rounded-full text-sm font-medium transition-colors border',
                    rangeDays === d
                      ? 'bg-[var(--color-brand-purple,#711FFF)] text-white shadow-sm border-transparent'
                      : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white bg-transparent border-transparent hover:bg-slate-100 hover:border-slate-300 dark:hover:bg-white/10 dark:hover:border-white/25',
                  ].join(' '),
                  onClick: () => setRangeDays(d),
                },
                `Last ${d} days`
              )
            ),
          ]),
        ]),
        h('label', { className: 'flex items-center gap-2 text-sm text-slate-700 dark:text-slate-200 cursor-pointer select-none' }, [
          h('input', {
            type: 'checkbox',
            checked: compare,
            onChange: () => setCompare((v) => !v),
            className: 'h-4 w-4 rounded border-slate-300 dark:border-white/20 text-[var(--color-brand-purple,#711FFF)] focus:ring-[var(--color-brand-purple,#711FFF)]',
          }),
          h('span', null, 'Compare'),
        ]),
      ]),
    ]),

    // Snapshot KPIs
    h('div', { className: 'grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4' }, [
      h(KPIBox, {
        label: 'Hours logged',
        value: formatHours(totalHours),
        subvalue: compare ? `${formatHours(prevTotalHours)} prev` : `${rangeDays} day range`,
        tone: 'neutral',
      }),
      h(KPIBox, {
        label: 'Time hygiene',
        value: `${hygienePct}%`,
        subvalue: compare ? `${prevDaysLogged}/${rangeDays} days prev` : `${daysLogged}/${rangeDays} days logged`,
        tone: hygienePct >= 70 ? 'good' : hygienePct >= 45 ? 'warning' : 'bad',
      }),
      h(KPIBox, {
        label: 'LOE',
        value: myLoe ? `${Math.round(myLoe)}%` : '—',
        subvalue: myLoe ? 'Weighted across completed deliverables' : 'No completed work in range',
        tone: myLoeTone,
      }),
      h(KPIBox, {
        label: 'Attention needed',
        value: `${atRiskCount}`,
        subvalue: `${dueSoonCount} due in 7 days`,
        tone: atRiskCount ? 'bad' : dueSoonCount ? 'warning' : 'good',
      }),
    ]),

    // Work Queue
    h('div', { className: `${cardBase} p-5 space-y-4` }, [
      h('div', { className: 'flex items-center justify-between' }, [
        h('h3', { className: 'text-sm font-semibold text-slate-100' }, 'My Work Queue'),
        h('span', { className: 'text-xs text-slate-400' }, `${activeDeliverables.length} deliverables`),
      ]),
      h('div', { className: 'overflow-x-auto' }, [
        h(
          'table',
          { className: 'min-w-full text-sm' },
          [
            h('thead', null, [
              h('tr', { className: 'text-left text-xs uppercase tracking-wide text-slate-400 border-b border-white/10' }, [
                h('th', { className: 'py-2 pr-4' }, 'Deliverable'),
                h('th', { className: 'py-2 pr-4' }, 'Job'),
                h('th', { className: 'py-2 pr-4' }, 'Due'),
                h('th', { className: 'py-2 pr-4' }, 'Progress'),
                h('th', { className: 'py-2 pr-4 text-right' }, 'My hours'),
              ]),
            ]),
            h('tbody', null,
              activeDeliverables.slice(0, 8).map(({ deliverable, hrs }) => {
                const job = maps.jobById[deliverable.jobId];
                const serviceType = maps.serviceTypeById[deliverable.serviceTypeId];
                const atRisk = deliverable.status !== 'completed' && isDeliverableAtRisk(deliverable, today);
                const dueIn = diffDays(deliverable.due, today);
                const dueLabel = dueIn < 0 ? `${Math.abs(dueIn)}d overdue` : dueIn === 0 ? 'Due today' : `Due in ${dueIn}d`;
                return h('tr', {
                  key: deliverable.id,
                  className: 'border-b border-white/5 hover:bg-white/5 cursor-pointer',
                  onClick: () => navigate(`#/app/performance/job/${deliverable.jobId}?deliverable=${deliverable.id}`),
                }, [
                  h('td', { className: 'py-3 pr-4 align-top' }, [
                    h('div', { className: 'font-semibold text-slate-100' }, deliverable.name),
                    h('div', { className: 'text-xs text-slate-400 flex items-center gap-2' }, [
                      serviceType ? h('span', { className: 'inline-flex items-center gap-1' }, [
                        h('span', { className: 'inline-block h-2 w-2 rounded-full', style: { background: serviceType.color } }),
                        h('span', null, serviceType.name),
                      ]) : null,
                      atRisk ? h('span', { className: 'text-xs text-red-300' }, 'At risk') : null,
                    ]),
                  ]),
                  h('td', { className: 'py-3 pr-4 align-top text-slate-200' }, job ? `Job #${job.id} — ${job.name}` : '—'),
                  h('td', { className: 'py-3 pr-4 align-top' }, [
                    h('div', { className: 'text-slate-200' }, deliverable.due),
                    h('div', { className: 'text-xs text-slate-400' }, dueLabel),
                    deliverable.changed ? h(MovedDateIndicator, { original: deliverable.originalDue }) : null,
                  ]),
                  h('td', { className: 'py-3 pr-4 align-top w-[280px]' }, [
                    h(StackedMeter, {
                      effort: { actual: deliverable.effortConsumed, baseline: 100, unit: '%' },
                      timeline: { actual: deliverable.durationConsumed, baseline: 100, unit: '%' },
                      completed: deliverable.status === 'completed',
                      variant: atRisk ? 'risk' : 'normal',
                      showHeader: false,
                    }),
                  ]),
                  h('td', { className: 'py-3 pr-4 align-top text-right font-semibold text-slate-100' }, formatHours(hrs)),
                ]);
              })
            ),
          ]
        ),
      ]),
      h('div', { className: 'text-xs text-slate-400' }, 'Tip: Click a deliverable row to open its Job page (stub).'),
    ]),

    // Recent activity
    h('div', { className: `${cardBase} p-5 space-y-4` }, [
      h('div', { className: 'flex items-center justify-between' }, [
        h('h3', { className: 'text-sm font-semibold text-slate-100' }, 'Recent time entries'),
        h('span', { className: 'text-xs text-slate-400' }, `${recentActivity.length} entries`),
      ]),
      h('div', { className: 'divide-y divide-white/10' },
        recentActivity.map((te) => {
          const task = te.taskId ? maps.taskById[te.taskId] : null;
          const job = task?.jobId ? maps.jobById[task.jobId] : null;
          const deliverable = task?.deliverableId ? maps.deliverableById[task.deliverableId] : null;
          const serviceType = maps.serviceTypeById[getEntryServiceTypeId(te, maps.taskById)];
          const title = te.quickTask ? te.title : task?.name || 'Task';
          const context = te.quickTask
            ? 'Quick task'
            : job
              ? `↳ Job #${job.id} — ${job.name}${job.client ? ` (${job.client})` : ''}`
              : deliverable
                ? `↳ ${deliverable.name}`
                : '↳ Job task';
          return h('div', { key: te.id, className: 'py-3 flex items-start justify-between gap-4' }, [
            h('div', { className: 'min-w-0' }, [
              h('div', { className: 'font-semibold text-slate-100 truncate' }, title),
              h('div', { className: 'text-xs text-slate-400 truncate' }, context),
              te.notes ? h('div', { className: 'text-xs text-slate-500 mt-1' }, te.notes) : null,
            ]),
            h('div', { className: 'flex items-center gap-3 shrink-0' }, [
              serviceType
                ? h('span', { className: 'inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-2 py-1 text-xs text-slate-200' }, [
                    h('span', { className: 'inline-block h-2 w-2 rounded-full', style: { background: serviceType.color } }),
                    h('span', null, serviceType.name),
                  ])
                : null,
              h('span', { className: 'text-xs text-slate-400' }, te.date),
              h('span', { className: 'text-sm font-semibold text-slate-100' }, formatHours(te.hours)),
            ]),
          ]);
        })
      ),
    ]),
  ]);
}

function isDeliverableAtRisk(d, today) {
  if (!d) return false;
  if (d.status === 'blocked') return true;
  if (d.due && d.due < today) return true;
  if ((d.effortConsumed || 0) >= 85) return true;
  if ((d.durationConsumed || 0) >= 85) return true;
  return false;
}

export function renderMyPerformancePage(bodyEl) {
  if (!bodyEl) return;
  bodyEl.innerHTML = '<div id="my-performance-root"></div>';
  const mount = bodyEl.querySelector('#my-performance-root');
  if (!mount) return;

  // Recreate root if the mount node changes between navigations.
  if (!window.__myPerformanceRoot || window.__myPerformanceMount !== mount) {
    window.__myPerformanceRoot = createRoot(mount);
    window.__myPerformanceMount = mount;
  }
  window.__myPerformanceRoot.render(h(MyPerformance));
}

