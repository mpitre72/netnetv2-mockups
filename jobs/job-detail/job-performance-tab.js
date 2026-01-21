import { navigate } from '../../router.js';
import { loadServiceTypes, loadTeamMembers } from '../../quick-tasks/quick-tasks-store.js';
import { isTaskReady } from '../job-tasks-helpers.js';

const { createElement: h, useMemo, useState } = React;

const MS_DAY = 24 * 60 * 60 * 1000;

function localDateISO(date = new Date()) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function addDays(dateStr, days) {
  const base = dateStr ? new Date(`${dateStr}T00:00:00`) : new Date();
  const next = new Date(base.getTime());
  next.setDate(next.getDate() + days);
  return localDateISO(next);
}

function formatDateLabel(dateStr) {
  if (!dateStr) return 'No due date';
  const date = new Date(`${dateStr}T00:00:00`);
  if (Number.isNaN(date.getTime())) return dateStr;
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(date);
}

function formatHours(hours) {
  const value = Math.round((Number(hours) || 0) * 10) / 10;
  return `${value}h`;
}

function getDeliverableStatus(tasks) {
  const list = Array.isArray(tasks) ? tasks : [];
  if (list.some((task) => task.status === 'in_progress')) return 'In Progress';
  const nonDraft = list.filter((task) => !task.isDraft);
  if (nonDraft.length && nonDraft.every((task) => task.status === 'completed')) return 'Completed';
  return 'Backlog';
}

function countByStatus(tasks, status) {
  return (tasks || []).filter((task) => task.status === status).length;
}

function countDrafts(tasks) {
  return (tasks || []).filter((task) => task.isDraft).length;
}

function hasTaskSetupMissing(tasks, deliverable) {
  return (tasks || []).some((task) => !task.isDraft && !isTaskReady(task, deliverable));
}

function sumPools(pools = []) {
  return (pools || []).reduce((sum, pool) => sum + (Number(pool?.estimatedHours) || 0), 0);
}

export function JobPerformanceTab({ job }) {
  const [openHistoryId, setOpenHistoryId] = useState(null);
  const today = useMemo(() => localDateISO(), []);
  const dueSoonCutoff = useMemo(() => addDays(today, 7), [today]);
  const serviceTypes = useMemo(() => loadServiceTypes().filter((type) => type.active), []);
  const serviceTypeMap = useMemo(() => new Map(serviceTypes.map((type) => [String(type.id), type])), [serviceTypes]);
  const members = useMemo(() => loadTeamMembers(), []);
  const memberMap = useMemo(() => new Map(members.map((member) => [String(member.id), member])), [members]);

  if (!job) return null;

  const deliverables = job.deliverables || [];
  const isRetainer = job.kind === 'retainer';

  const deliverableMeta = deliverables.map((deliverable) => {
    const tasks = deliverable.tasks || [];
    const dueDate = deliverable.dueDate || null;
    const overdue = dueDate ? dueDate < today : false;
    const dueSoon = dueDate ? dueDate >= today && dueDate <= dueSoonCutoff : false;
    const moved = !!deliverable.originalDueDate || (deliverable.dueDateHistory || []).length > 0;
    const taskSetupMissing = hasTaskSetupMissing(tasks, deliverable);
    const status = getDeliverableStatus(tasks);
    const poolsTotal = sumPools(deliverable.pools || []);
    const poolSummary = (deliverable.pools || [])
      .map((pool) => serviceTypeMap.get(String(pool.serviceTypeId))?.name)
      .filter(Boolean);
    const riskRank = Math.min(
      overdue ? 0 : 4,
      dueSoon ? 1 : 4,
      moved ? 2 : 4,
      taskSetupMissing ? 3 : 4
    );
    return {
      deliverable,
      dueDate,
      overdue,
      dueSoon,
      moved,
      taskSetupMissing,
      status,
      poolsTotal,
      poolSummary,
      inProgressCount: countByStatus(tasks, 'in_progress'),
      backlogCount: countByStatus(tasks, 'backlog'),
      draftCount: countDrafts(tasks),
      riskRank,
    };
  });

  const sortedDeliverables = deliverableMeta.slice().sort((a, b) => {
    if (a.riskRank !== b.riskRank) return a.riskRank - b.riskRank;
    const aDate = a.dueDate || '9999-12-31';
    const bDate = b.dueDate || '9999-12-31';
    if (aDate !== bDate) return aDate.localeCompare(bDate);
    return String(a.deliverable.name || '').localeCompare(String(b.deliverable.name || ''));
  });

  const needsAttention = deliverableMeta.filter((item) => (
    item.overdue || item.dueSoon || item.moved || item.taskSetupMissing
  ));
  const overdueCount = deliverableMeta.filter((item) => item.overdue).length;
  const dueSoonCount = deliverableMeta.filter((item) => item.dueSoon).length;
  const movedCount = deliverableMeta.filter((item) => item.moved).length;
  const moveEvents = deliverableMeta.reduce((sum, item) => sum + (item.deliverable.dueDateHistory || []).length, 0);
  const draftTaskCount = deliverables.reduce((sum, deliverable) => sum + countDrafts(deliverable.tasks || []), 0);

  const navigateToPlan = () => {
    navigate(`#/app/jobs/${job.id}`);
  };

  const renderHistory = (deliverable) => {
    const history = Array.isArray(deliverable.dueDateHistory) ? deliverable.dueDateHistory : [];
    if (!history.length) {
      return h('div', { className: 'text-xs text-slate-500 dark:text-slate-400' }, 'No changes yet.');
    }
    return h('div', { className: 'space-y-2' }, history.slice().reverse().map((entry, idx) => {
      const user = entry.changedByUserId ? memberMap.get(String(entry.changedByUserId)) : null;
      const changedAt = entry.changedAt ? new Date(entry.changedAt) : null;
      return h('div', { key: entry.changedAt || idx, className: 'text-xs text-slate-600 dark:text-slate-300' }, [
        h('div', { className: 'font-semibold' }, `${formatDateLabel(entry.fromDate)} → ${formatDateLabel(entry.toDate)}`),
        changedAt
          ? h('div', { className: 'text-[11px] text-slate-500 dark:text-slate-400' }, [
            changedAt.toLocaleString(),
            user ? ` · ${user.name || user.email || 'User'}` : '',
          ].join(''))
          : null,
      ]);
    }));
  };

  const renderCard = (label, value, subtext) => h('div', {
    className: 'rounded-2xl border border-slate-200 dark:border-white/10 bg-white/90 dark:bg-slate-900/60 p-4 space-y-1',
  }, [
    h('div', { className: 'text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400' }, label),
    h('div', { className: 'text-2xl font-semibold text-slate-900 dark:text-white' }, value),
    subtext ? h('div', { className: 'text-xs text-slate-500 dark:text-slate-400' }, subtext) : null,
  ]);

  return h('div', { className: 'space-y-6 pb-12' }, [
    h('div', { className: 'space-y-1' }, [
      h('div', { className: 'text-lg font-semibold text-slate-900 dark:text-white' }, 'Performance'),
      h('div', { className: 'text-sm text-slate-500 dark:text-slate-400' }, 'Deliverable-level signals for delivery drift and readiness.'),
    ]),
    isRetainer
      ? h('div', { className: 'rounded-2xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-slate-800/60 p-4 text-sm text-slate-600 dark:text-slate-300' }, [
        'Performance for retainers is cycle-based. ',
        h('span', { className: 'text-slate-500 dark:text-slate-400' }, 'Select a month to review performance.'),
      ])
      : null,
    h('div', { className: 'grid gap-3 sm:grid-cols-2 xl:grid-cols-4' }, [
      renderCard('Needs attention', needsAttention.length, 'Deliverables with drift signals'),
      renderCard('Deadlines', overdueCount, `${dueSoonCount} due soon`),
      renderCard('Slippage', movedCount, `${moveEvents} total moves`),
      renderCard('Draft tasks', draftTaskCount, 'Planning visibility'),
    ]),
    h('div', { className: 'rounded-2xl border border-slate-200 dark:border-white/10 bg-white/90 dark:bg-slate-900/60' }, [
      h('div', { className: 'px-5 py-4 border-b border-slate-200 dark:border-white/10 flex items-center justify-between gap-3' }, [
        h('div', { className: 'text-sm font-semibold text-slate-900 dark:text-white' }, 'Deliverables radar'),
        h('button', {
          type: 'button',
          className: 'text-xs font-semibold text-netnet-purple hover:underline',
          onClick: navigateToPlan,
        }, 'View in Plan'),
      ]),
      deliverables.length
        ? h('div', { className: 'overflow-x-auto' }, [
          h('div', { className: 'min-w-[860px]' }, [
            h('div', { className: 'grid gap-3 px-5 py-2 text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-white/10', style: { gridTemplateColumns: '1.6fr 0.8fr 0.7fr 0.8fr 1fr 1.2fr' } }, [
              h('div', null, 'Deliverable'),
              h('div', null, 'Due date'),
              h('div', null, 'Status'),
              h('div', null, 'Pools'),
              h('div', null, 'Tasks'),
              h('div', null, 'Risk'),
            ]),
            ...sortedDeliverables.map((item) => {
              const deliverable = item.deliverable;
              const riskChips = [
                item.overdue ? 'Overdue' : null,
                item.dueSoon ? 'Due soon' : null,
                item.moved ? 'Moved' : null,
                item.taskSetupMissing ? 'Task setup missing' : null,
              ].filter(Boolean);
              return h('div', {
                key: deliverable.id,
                className: 'grid gap-3 px-5 py-3 border-b border-slate-100 dark:border-white/5 hover:bg-slate-50 dark:hover:bg-white/5 cursor-pointer',
                style: { gridTemplateColumns: '1.6fr 0.8fr 0.7fr 0.8fr 1fr 1.2fr' },
                onClick: navigateToPlan,
              }, [
                h('div', { className: 'space-y-1' }, [
                  h('div', { className: 'text-sm font-semibold text-slate-900 dark:text-white' }, deliverable.name || 'Deliverable'),
                  item.poolSummary.length
                    ? h('div', { className: 'text-xs text-slate-500 dark:text-slate-400' }, item.poolSummary.join(', '))
                    : null,
                ]),
                h('div', { className: 'space-y-1' }, [
                  h('button', {
                    type: 'button',
                    className: 'text-xs text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white underline underline-offset-2',
                    onClick: (event) => {
                      event.stopPropagation();
                      setOpenHistoryId(openHistoryId === deliverable.id ? null : deliverable.id);
                    },
                  }, formatDateLabel(item.dueDate)),
                  item.moved
                    ? h('button', {
                      type: 'button',
                      className: 'rounded-full border border-amber-200 dark:border-amber-400/30 bg-amber-50 dark:bg-amber-500/10 px-2 py-0.5 text-[11px] font-semibold text-amber-700 dark:text-amber-200',
                      onClick: (event) => {
                        event.stopPropagation();
                        setOpenHistoryId(openHistoryId === deliverable.id ? null : deliverable.id);
                      },
                    }, 'Moved')
                    : null,
                  openHistoryId === deliverable.id
                    ? h('div', { className: 'mt-2 rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 p-3 text-xs shadow-md' }, [
                      h('div', { className: 'text-[11px] uppercase tracking-wide text-slate-400 dark:text-slate-500' }, 'Due date history'),
                      h('div', { className: 'mt-2 space-y-2' }, [
                        h('div', { className: 'text-xs text-slate-600 dark:text-slate-300' }, `Original: ${formatDateLabel(deliverable.originalDueDate)}`),
                        h('div', { className: 'text-xs text-slate-600 dark:text-slate-300' }, `Current: ${formatDateLabel(deliverable.dueDate)}`),
                        renderHistory(deliverable),
                      ]),
                    ])
                    : null,
                ]),
                h('div', { className: 'text-xs text-slate-600 dark:text-slate-300' }, item.status),
                h('div', { className: 'text-xs text-slate-600 dark:text-slate-300' }, item.poolsTotal ? formatHours(item.poolsTotal) : '—'),
                h('div', { className: 'text-xs text-slate-600 dark:text-slate-300 space-y-1' }, [
                  h('div', null, `In progress: ${item.inProgressCount}`),
                  h('div', null, `Backlog: ${item.backlogCount}`),
                  h('div', null, `Draft: ${item.draftCount}`),
                ]),
                h('div', { className: 'flex flex-wrap gap-2' }, (
                  riskChips.length
                    ? riskChips.map((chip) => h('span', {
                      key: chip,
                      className: 'rounded-full border border-slate-200 dark:border-white/10 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 text-[11px] text-slate-600 dark:text-slate-300',
                    }, chip))
                    : h('span', { className: 'text-xs text-slate-400 dark:text-slate-500' }, '—')
                )),
              ]);
            }),
          ]),
        ])
        : h('div', { className: 'px-5 py-6 text-sm text-slate-500 dark:text-slate-400' }, 'Add deliverables to see performance signals.'),
    ]),
  ]);
}
