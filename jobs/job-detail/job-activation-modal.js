import { getJobNumber } from '../job-number-utils.js';

const { createElement: h, useEffect, useMemo, useState } = React;

const MS_DAY = 24 * 60 * 60 * 1000;

function localDateISO(date = new Date()) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function parseISO(dateStr) {
  if (!dateStr) return null;
  const date = new Date(`${dateStr}T00:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function addDays(dateStr, days) {
  const base = parseISO(dateStr) || new Date();
  const next = new Date(base.getTime());
  next.setDate(next.getDate() + days);
  return localDateISO(next);
}

function diffDays(startStr, endStr) {
  const start = parseISO(startStr);
  const end = parseISO(endStr);
  if (!start || !end) return 0;
  return Math.round((end.getTime() - start.getTime()) / MS_DAY);
}

function formatWeeksAndDays(totalDays) {
  const safeDays = Math.max(0, Math.round(Number(totalDays) || 0));
  const weeks = Math.floor(safeDays / 7);
  const days = safeDays % 7;
  if (weeks && days) return `${weeks} wk ${days} d`;
  if (weeks) return `${weeks} wk`;
  return `${days} d`;
}

function formatDateLabel(dateStr) {
  if (!dateStr) return 'Not set';
  const date = parseISO(dateStr);
  if (!date) return dateStr;
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(date);
}

function sumDeliverableHours(deliverable) {
  return (deliverable?.pools || []).reduce((sum, pool) => sum + (Number(pool?.estimatedHours) || 0), 0);
}

function deriveScheduleEnd(job) {
  const deliverableEnd = (job?.deliverables || []).reduce((latest, deliverable) => {
    const dueDate = deliverable?.dueDate || null;
    return !latest || (dueDate && dueDate > latest) ? dueDate : latest;
  }, null);
  return job?.targetEndDate || deliverableEnd || null;
}

export function buildActivationReview(job, activationStartDate, today = localDateISO(), changedByUserId = null) {
  const isProject = job?.kind !== 'retainer';
  const baseStartDate = isProject ? (job?.startDate || today) : today;
  const safeActivationStart = activationStartDate && activationStartDate >= today ? activationStartDate : today;
  const deltaDays = isProject ? diffDays(baseStartDate, safeActivationStart) : 0;
  const changedAt = new Date().toISOString();

  const shiftedDeliverables = (job?.deliverables || []).map((deliverable) => {
    const nextDueDate = isProject && deliverable?.dueDate ? addDays(deliverable.dueDate, deltaDays) : (deliverable?.dueDate || null);
    const prevDueDate = deliverable?.dueDate || null;
    const dueDateChanged = isProject && prevDueDate && nextDueDate && prevDueDate !== nextDueDate;
    const originalDueDate = dueDateChanged
      ? (deliverable.originalDueDate || prevDueDate)
      : (deliverable.originalDueDate || null);
    const dueDateHistory = Array.isArray(deliverable?.dueDateHistory) ? [...deliverable.dueDateHistory] : [];
    if (dueDateChanged) {
      dueDateHistory.push({
        fromDate: prevDueDate,
        toDate: nextDueDate,
        changedAt,
        changedByUserId,
      });
    }
    return {
      ...deliverable,
      dueDate: nextDueDate,
      originalDueDate,
      dueDateHistory,
      tasks: (deliverable?.tasks || []).map((task) => ({
        ...task,
        dueDate: isProject && task?.dueDate ? addDays(task.dueDate, deltaDays) : (task?.dueDate || null),
      })),
    };
  });

  const shiftedUnassignedTasks = (job?.unassignedTasks || []).map((task) => ({
    ...task,
    dueDate: isProject && task?.dueDate ? addDays(task.dueDate, deltaDays) : (task?.dueDate || null),
  }));

  const nextTargetEndDate = isProject && job?.targetEndDate ? addDays(job.targetEndDate, deltaDays) : (job?.targetEndDate || null);
  const derivedEndDate = isProject
    ? (nextTargetEndDate || shiftedDeliverables.reduce((latest, deliverable) => {
      const dueDate = deliverable?.dueDate || null;
      return !latest || (dueDate && dueDate > latest) ? dueDate : latest;
    }, null) || safeActivationStart)
    : null;
  const durationDays = isProject && derivedEndDate ? Math.max(1, diffDays(safeActivationStart, derivedEndDate) + 1) : 0;
  const totalHours = shiftedDeliverables.reduce((sum, deliverable) => sum + sumDeliverableHours(deliverable), 0);

  return {
    activationStartDate: safeActivationStart,
    baseStartDate,
    shiftApplied: isProject && baseStartDate < today,
    deltaDays,
    summary: {
      totalHours,
      durationDays,
      durationLabel: isProject ? formatWeeksAndDays(durationDays) : 'Not applicable',
      deliverablesCount: shiftedDeliverables.length,
      updatedEndDate: derivedEndDate,
    },
    updates: {
      status: 'active',
      startDate: isProject ? safeActivationStart : null,
      targetEndDate: isProject ? nextTargetEndDate : null,
      deliverables: shiftedDeliverables,
      unassignedTasks: shiftedUnassignedTasks,
    },
  };
}

function summaryCard(label, value, hint = null) {
  return h('div', { className: 'rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-slate-800/60 p-4 space-y-1' }, [
    h('div', { className: 'text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400' }, label),
    h('div', { className: 'text-2xl font-semibold text-slate-900 dark:text-white' }, value),
    hint ? h('div', { className: 'text-xs text-slate-500 dark:text-slate-400' }, hint) : null,
  ]);
}

export function JobActivationModal({
  job,
  isOpen,
  onClose,
  onConfirm,
}) {
  const today = useMemo(() => localDateISO(), []);
  const initialStartDate = useMemo(() => {
    const current = job?.startDate || today;
    return current < today ? today : current;
  }, [job?.startDate, today]);
  const [startDate, setStartDate] = useState(initialStartDate);

  useEffect(() => {
    if (!isOpen) return;
    setStartDate(initialStartDate);
  }, [isOpen, initialStartDate]);

  const review = useMemo(
    () => buildActivationReview(job, startDate, today),
    [job, startDate, today]
  );

  if (!isOpen || !job) return null;

  const isProject = job.kind !== 'retainer';
  const jobNumber = getJobNumber(job);

  return h('div', { className: 'fixed inset-0 z-50 flex items-center justify-center px-4' }, [
    h('div', { className: 'absolute inset-0 bg-black/40', onClick: () => onClose && onClose() }),
    h('div', { className: 'relative z-10 w-full max-w-2xl rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 p-6 shadow-2xl space-y-5' }, [
      h('div', { className: 'flex items-start justify-between gap-4' }, [
        h('div', { className: 'space-y-1' }, [
          h('h3', { className: 'text-xl font-semibold text-slate-900 dark:text-white' }, 'Activation Review'),
          h('p', { className: 'text-sm text-slate-500 dark:text-slate-400' }, 'Review the schedule and confirm activation details before this job goes live.'),
        ]),
        h('button', {
          type: 'button',
          className: 'h-9 w-9 rounded-full border border-slate-200 dark:border-white/10 text-slate-500 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white',
          onClick: () => onClose && onClose(),
          'aria-label': 'Close',
        }, '×'),
      ]),
      h('div', { className: 'space-y-3 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-slate-800/60 p-4' }, [
        h('div', { className: 'text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400' }, `Job ${jobNumber}`),
        h('div', { className: 'text-base font-semibold text-slate-900 dark:text-white' }, job.name || 'Job'),
        h('p', { className: 'text-sm text-slate-600 dark:text-slate-300' }, 'Billing begins when this job is activated.'),
      ]),
      h('div', { className: 'space-y-3 rounded-xl border border-slate-200 dark:border-white/10 bg-white/90 dark:bg-slate-900/60 p-4' }, [
        h('div', { className: 'text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400' }, 'Start Date'),
        h('input', {
          type: 'date',
          value: startDate,
          min: today,
          onChange: (event) => setStartDate(event.target.value || today),
          className: 'w-full rounded-md border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 px-3 py-2 text-sm text-slate-700 dark:text-slate-200',
        }),
        review.shiftApplied
          ? h('div', { className: 'text-xs text-amber-600 dark:text-amber-200' }, `Original start date was in the past. Dates will shift forward from ${formatDateLabel(review.baseStartDate)} to ${formatDateLabel(review.activationStartDate)}.`)
          : isProject && review.deltaDays > 0
            ? h('div', { className: 'text-xs text-slate-500 dark:text-slate-400' }, `Timeline dates will shift forward ${review.deltaDays} day${review.deltaDays === 1 ? '' : 's'} to start on ${formatDateLabel(review.activationStartDate)}.`)
            : h('div', { className: 'text-xs text-slate-500 dark:text-slate-400' }, `Start date will be ${formatDateLabel(review.activationStartDate)}.`),
      ]),
      h('div', { className: 'space-y-3 rounded-xl border border-slate-200 dark:border-white/10 bg-white/90 dark:bg-slate-900/60 p-4' }, [
        h('div', { className: 'text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400' }, 'Plan Summary'),
        h('div', { className: 'grid gap-3 sm:grid-cols-3' }, [
          summaryCard('Total Hours', `${review.summary.totalHours}`),
          summaryCard('Duration', isProject ? review.summary.durationLabel : 'Not applicable', isProject && review.summary.updatedEndDate ? `Ends ${formatDateLabel(review.summary.updatedEndDate)}` : null),
          summaryCard('Deliverables', `${review.summary.deliverablesCount}`),
        ]),
      ]),
      h('div', { className: 'flex items-center justify-end gap-2 pt-2' }, [
        h('button', {
          type: 'button',
          className: 'inline-flex items-center justify-center h-9 px-4 rounded-md border border-slate-200 dark:border-white/10 text-sm font-semibold text-slate-700 dark:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-800',
          onClick: () => onClose && onClose(),
        }, 'Cancel'),
        h('button', {
          type: 'button',
          className: 'inline-flex items-center justify-center h-9 px-4 rounded-md bg-netnet-purple text-white text-sm font-semibold hover:brightness-110',
          onClick: () => {
            if (typeof onConfirm === 'function') onConfirm(review.updates);
          },
        }, 'Activate Job'),
      ]),
    ]),
  ]);
}
