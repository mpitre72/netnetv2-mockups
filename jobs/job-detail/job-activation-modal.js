import { getAllowedServiceTypeIds, isTaskReady } from '../job-tasks-helpers.js';
import { getJobNumber } from '../job-number-utils.js';

const { createElement: h, useMemo } = React;

function localDateISO(date = new Date()) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function statusBadge(ok, label) {
  const base = 'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold';
  const good = 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-200';
  const bad = 'bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-200';
  return h('span', { className: `${base} ${ok ? good : bad}` }, label);
}

function kindLabel(kind) {
  return kind === 'retainer' ? 'Retainer' : 'Project';
}

export function JobActivationModal({
  job,
  isOpen,
  onClose,
  onConfirm,
  onOpenTask,
}) {
  const today = useMemo(() => localDateISO(), []);
  const isProject = job?.kind !== 'retainer';

  const deliverableChecks = useMemo(() => {
    if (!job) return [];
    return (job.deliverables || []).map((deliverable) => {
      const poolsOk = getAllowedServiceTypeIds(deliverable).length > 0;
      const dueDate = deliverable.dueDate || '';
      const dueDateOk = !isProject ? true : Boolean(dueDate) && dueDate >= today;
      const dueDateLabel = !isProject ? 'Not required' : dueDate || 'Missing';
      return {
        id: deliverable.id,
        name: deliverable.name || 'Deliverable',
        poolsOk,
        dueDateOk,
        dueDateLabel,
      };
    });
  }, [job, isProject, today]);

  const taskChecks = useMemo(() => {
    if (!job) return { all: [], nonDraft: [], blocked: [] };
    const all = (job.deliverables || []).flatMap((deliverable) => (
      (deliverable.tasks || []).map((task) => ({
        task,
        deliverable,
      }))
    ));
    const nonDraft = all.filter(({ task }) => !task.isDraft);
    const blocked = nonDraft.filter(({ task, deliverable }) => !isTaskReady(task, deliverable));
    return { all, nonDraft, blocked };
  }, [job]);

  if (!isOpen || !job) return null;

  const hasDeliverables = deliverableChecks.length > 0;
  const deliverablesReady = hasDeliverables && deliverableChecks.every((item) => item.poolsOk && item.dueDateOk);
  const tasksReady = taskChecks.blocked.length === 0;
  const canActivate = deliverablesReady && tasksReady;
  const jobNumber = getJobNumber(job);

  const draftCount = taskChecks.all.filter(({ task }) => task.isDraft).length;
  const nonDraftCount = taskChecks.nonDraft.length;
  const blockingCount = taskChecks.blocked.length;

  const openTask = (deliverableId, taskId) => {
    if (typeof onOpenTask === 'function') onOpenTask(deliverableId, taskId);
  };

  return h('div', { className: 'fixed inset-0 z-50 flex items-center justify-center px-4' }, [
    h('div', { className: 'absolute inset-0 bg-black/40', onClick: () => onClose && onClose() }),
    h('div', { className: 'relative z-10 w-full max-w-3xl rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 p-6 shadow-2xl space-y-5' }, [
      h('div', { className: 'flex items-start justify-between gap-4' }, [
        h('div', { className: 'space-y-1' }, [
          h('h3', { className: 'text-xl font-semibold text-slate-900 dark:text-white' }, 'Activate Job'),
          h('p', { className: 'text-sm text-slate-500 dark:text-slate-400' }, 'Activate this job once the minimum delivery truth is ready.'),
        ]),
        h('button', {
          type: 'button',
          className: 'h-9 w-9 rounded-full border border-slate-200 dark:border-white/10 text-slate-500 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white',
          onClick: () => onClose && onClose(),
          'aria-label': 'Close',
        }, '×'),
      ]),
      h('div', { className: 'space-y-3 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-slate-800/60 p-4' }, [
        h('div', { className: 'text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400' }, 'Step 1 · Summary'),
        h('div', { className: 'text-base font-semibold text-slate-900 dark:text-white' }, `${job.name || 'Job'}`),
        h('div', { className: 'text-sm text-slate-500 dark:text-slate-400' }, `Job ${jobNumber} · ${kindLabel(job.kind)}`),
        h('p', { className: 'text-sm text-slate-600 dark:text-slate-300' }, 'Activating makes this job operational (time tracking + performance).'),
      ]),
      h('div', { className: 'space-y-3 rounded-xl border border-slate-200 dark:border-white/10 bg-white/90 dark:bg-slate-900/60 p-4' }, [
        h('div', { className: 'text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400' }, 'Step 2 · Deliverables readiness'),
        !hasDeliverables
          ? h('div', { className: 'rounded-lg border border-rose-200 dark:border-rose-400/30 bg-rose-50 dark:bg-rose-500/10 p-3 text-sm text-rose-600 dark:text-rose-200' }, 'Add at least one deliverable before activating this job.')
          : null,
        hasDeliverables
          ? h('div', { className: 'space-y-2' }, [
            h('div', { className: 'grid gap-2 text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400 sm:grid-cols-[1.5fr_140px_180px]' }, [
              h('div', null, 'Deliverable'),
              h('div', null, 'Pools'),
              h('div', null, isProject ? 'Due date' : 'Due date (Project only)'),
            ]),
            ...deliverableChecks.map((deliverable) => (
              h('div', { key: deliverable.id, className: 'grid gap-2 items-center sm:grid-cols-[1.5fr_140px_180px]' }, [
                h('div', { className: 'text-sm font-medium text-slate-700 dark:text-slate-200' }, deliverable.name),
                statusBadge(deliverable.poolsOk, deliverable.poolsOk ? 'OK' : 'Missing'),
                statusBadge(deliverable.dueDateOk, deliverable.dueDateLabel),
              ])
            )),
          ])
          : null,
      ]),
      nonDraftCount
        ? h('div', { className: 'space-y-3 rounded-xl border border-slate-200 dark:border-white/10 bg-white/90 dark:bg-slate-900/60 p-4' }, [
          h('div', { className: 'text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400' }, 'Step 3 · Task readiness'),
          h('div', { className: 'text-sm text-slate-600 dark:text-slate-300' }, [
            `${draftCount} draft task${draftCount === 1 ? '' : 's'} (allowed). `,
            `${blockingCount} of ${nonDraftCount} operational task${nonDraftCount === 1 ? '' : 's'} not ready.`,
          ].join('')),
          blockingCount
            ? h('div', { className: 'space-y-2' }, taskChecks.blocked.map(({ task, deliverable }) => (
              h('div', { key: task.id, className: 'flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-slate-800 px-3 py-2' }, [
                h('div', { className: 'space-y-0.5' }, [
                  h('div', { className: 'text-sm font-semibold text-slate-800 dark:text-slate-100' }, task.title || 'Untitled task'),
                  h('div', { className: 'text-xs text-slate-500 dark:text-slate-400' }, deliverable.name || 'Deliverable'),
                ]),
                h('button', {
                  type: 'button',
                  className: 'text-xs font-semibold text-netnet-purple hover:underline',
                  onClick: () => openTask(deliverable.id, task.id),
                }, 'Open task'),
              ])
            )))
            : h('div', { className: 'text-sm text-emerald-600 dark:text-emerald-200' }, 'All operational tasks are ready.'),
        ])
        : null,
      h('div', { className: 'flex items-center justify-end gap-2 pt-2' }, [
        h('button', {
          type: 'button',
          className: 'inline-flex items-center justify-center h-9 px-4 rounded-md border border-slate-200 dark:border-white/10 text-sm font-semibold text-slate-700 dark:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-800',
          onClick: () => onClose && onClose(),
        }, 'Cancel'),
        h('button', {
          type: 'button',
          className: `inline-flex items-center justify-center h-9 px-4 rounded-md text-sm font-semibold ${canActivate ? 'bg-netnet-purple text-white hover:brightness-110' : 'bg-slate-200 dark:bg-slate-800 text-slate-500 dark:text-slate-500 cursor-not-allowed'}`,
          onClick: () => {
            if (!canActivate) return;
            if (typeof onConfirm === 'function') onConfirm();
          },
        }, 'Confirm Activation'),
      ]),
    ]),
  ]);
}
