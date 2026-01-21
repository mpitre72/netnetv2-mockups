import { getAllowedServiceTypeIds, isTaskReady, READY_TASK_MESSAGE } from './job-tasks-helpers.js';

const { createElement: h, useEffect, useMemo, useState } = React;

function createId(prefix) {
  return `${prefix}_${Math.random().toString(36).slice(2, 9)}`;
}

function localDateISO(date = new Date()) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatStatus(status) {
  if (status === 'in_progress') return 'In Progress';
  if (status === 'completed') return 'Completed';
  return 'Backlog';
}

export function JobTaskDrawer({
  isOpen,
  task,
  deliverable,
  assignees = [],
  serviceTypes = [],
  showTeamHint = false,
  showRecurring = false,
  cycleKey = null,
  readOnly = false,
  onClose,
  onSave,
}) {
  const [draft, setDraft] = useState(null);
  const [error, setError] = useState('');
  const [showCompleteConfirm, setShowCompleteConfirm] = useState(false);
  const [completionDate, setCompletionDate] = useState(localDateISO());

  const effectiveCycleKey = draft?.cycleKey || cycleKey || null;
  const allowedServiceTypeIds = useMemo(
    () => getAllowedServiceTypeIds(deliverable, effectiveCycleKey),
    [deliverable, effectiveCycleKey]
  );
  const availableServiceTypes = useMemo(
    () => (serviceTypes || []).filter((type) => allowedServiceTypeIds.includes(type.id)),
    [serviceTypes, allowedServiceTypeIds]
  );

  useEffect(() => {
    if (!task) {
      setDraft(null);
      return;
    }
    const nextDraft = {
      ...task,
      allocations: Array.isArray(task.allocations) ? task.allocations.map((alloc) => ({ ...alloc })) : [],
    };
    if (showRecurring && cycleKey && !nextDraft.cycleKey) {
      nextDraft.cycleKey = cycleKey;
    }
    if (showRecurring && nextDraft.isRecurring && !nextDraft.recurringTemplateId) {
      nextDraft.recurringTemplateId = nextDraft.id || createId('recurring');
    }
    setDraft(nextDraft);
    setError('');
    setShowCompleteConfirm(false);
    setCompletionDate(task.completedAt || localDateISO());
  }, [task?.id, deliverable?.id]);

  if (!isOpen || !draft || !deliverable) return null;

  const isReadOnly = !!readOnly;
  const noPools = allowedServiceTypeIds.length === 0;

  const updateField = (field, value) => {
    if (isReadOnly) return;
    setDraft((prev) => ({ ...prev, [field]: value }));
  };

  const updateAllocation = (index, updates) => {
    if (isReadOnly) return;
    setDraft((prev) => {
      const allocations = [...(prev.allocations || [])];
      allocations[index] = { ...allocations[index], ...updates };
      return { ...prev, allocations };
    });
  };

  const addAllocation = () => {
    if (isReadOnly) return;
    setDraft((prev) => ({
      ...prev,
      allocations: [...(prev.allocations || []), { id: createId('alloc'), assigneeUserId: null, serviceTypeId: null, loeHours: null }],
    }));
  };

  const removeAllocation = (index) => {
    if (isReadOnly) return;
    setDraft((prev) => {
      const allocations = [...(prev.allocations || [])];
      allocations.splice(index, 1);
      return { ...prev, allocations };
    });
  };

  const handleSave = () => {
    if (isReadOnly) return;
    setError('');
    const ready = isTaskReady(draft, deliverable);
    if ((draft.status === 'in_progress' || draft.status === 'completed') && !ready) {
      setError(READY_TASK_MESSAGE);
      return;
    }
    if (draft.status === 'completed') {
      setShowCompleteConfirm(true);
      return;
    }
    const payload = { ...draft, completedAt: null };
    if (showRecurring && cycleKey && !payload.cycleKey) {
      payload.cycleKey = cycleKey;
    }
    if (payload.isRecurring && !payload.recurringTemplateId) {
      payload.recurringTemplateId = payload.id || createId('recurring');
    }
    onSave && onSave(payload);
  };

  const confirmComplete = () => {
    if (isReadOnly) return;
    const payload = { ...draft, completedAt: completionDate || localDateISO() };
    onSave && onSave(payload);
    setShowCompleteConfirm(false);
  };

  return h('div', { className: 'fixed inset-0 z-50' }, [
    h('div', {
      className: 'absolute inset-0 bg-black/30',
      onClick: () => onClose && onClose(),
    }),
    h('aside', { className: 'absolute right-0 top-0 bottom-0 w-full max-w-md bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-white/10 shadow-xl flex flex-col' }, [
      h('div', { className: 'flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-white/10' }, [
        h('div', { className: 'space-y-1' }, [
          h('div', { className: 'text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400' }, 'Task Details'),
          h('div', { className: 'text-lg font-semibold text-slate-900 dark:text-white' }, draft.title || 'Untitled Task'),
        ]),
        h('button', {
          type: 'button',
          className: 'h-9 w-9 rounded-full border border-slate-200 dark:border-white/10 text-slate-500 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white',
          onClick: () => onClose && onClose(),
          'aria-label': 'Close',
        }, '×'),
      ]),
      h('div', { className: 'flex-1 overflow-y-auto px-5 py-4 space-y-5' }, [
        h('label', { className: 'space-y-1 block' }, [
          h('span', { className: 'text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400' }, 'Title'),
          h('input', {
            type: 'text',
            value: draft.title || '',
            onChange: (e) => updateField('title', e.target.value),
            disabled: isReadOnly,
            className: 'w-full rounded-md border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 px-3 py-2 text-sm text-slate-800 dark:text-white disabled:opacity-60',
          }),
        ]),
        h('label', { className: 'space-y-1 block' }, [
          h('span', { className: 'text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400' }, 'Description'),
          h('textarea', {
            value: draft.description || '',
            onChange: (e) => updateField('description', e.target.value),
            rows: 3,
            disabled: isReadOnly,
            className: 'w-full rounded-md border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 px-3 py-2 text-sm text-slate-800 dark:text-white disabled:opacity-60',
          }),
        ]),
        h('div', { className: 'grid gap-4 sm:grid-cols-2' }, [
          h('label', { className: 'space-y-1 block' }, [
            h('span', { className: 'text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400' }, 'Status'),
            h('select', {
              value: draft.status || 'backlog',
              onChange: (e) => updateField('status', e.target.value),
              disabled: isReadOnly,
              className: 'w-full rounded-md border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 px-3 py-2 text-sm text-slate-700 dark:text-slate-200 disabled:opacity-60',
            }, [
              h('option', { value: 'backlog' }, 'Backlog'),
              h('option', { value: 'in_progress' }, 'In Progress'),
              h('option', { value: 'completed' }, 'Completed'),
            ]),
          ]),
          h('label', { className: 'space-y-1 block' }, [
            h('span', { className: 'text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400' }, 'Due date'),
            h('input', {
              type: 'date',
              value: draft.dueDate || '',
              onChange: (e) => updateField('dueDate', e.target.value || null),
              disabled: isReadOnly,
              className: 'w-full rounded-md border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 px-3 py-2 text-sm text-slate-700 dark:text-slate-200 disabled:opacity-60',
            }),
          ]),
        ]),
        h('label', { className: 'flex items-center gap-3 text-sm text-slate-700 dark:text-slate-200' }, [
          h('input', {
            type: 'checkbox',
            checked: !!draft.isDraft,
            onChange: (e) => {
              const isDraft = e.target.checked;
              updateField('isDraft', isDraft);
              if (isDraft && draft.status !== 'backlog') {
                updateField('status', 'backlog');
              }
            },
            disabled: isReadOnly,
            className: 'h-4 w-4 rounded border-slate-300 dark:border-white/20 text-netnet-purple focus:ring-netnet-purple disabled:opacity-60',
          }),
          h('span', null, 'Mark as Draft'),
        ]),
        showRecurring
          ? h('label', { className: 'flex items-center gap-3 text-sm text-slate-700 dark:text-slate-200' }, [
            h('input', {
              type: 'checkbox',
              checked: !!draft.isRecurring,
              onChange: (e) => {
                const isRecurring = e.target.checked;
                updateField('isRecurring', isRecurring);
                if (isRecurring) {
                  if (!draft.recurringTemplateId) {
                    updateField('recurringTemplateId', draft.id || createId('recurring'));
                  }
                  if (!draft.cycleKey && cycleKey) {
                    updateField('cycleKey', cycleKey);
                  }
                } else {
                  updateField('recurringTemplateId', null);
                }
              },
              disabled: isReadOnly,
              className: 'h-4 w-4 rounded border-slate-300 dark:border-white/20 text-netnet-purple focus:ring-netnet-purple disabled:opacity-60',
            }),
            h('span', null, 'Recurring (monthly)'),
          ])
          : null,
        h('div', { className: 'space-y-3' }, [
          h('div', { className: 'flex items-center justify-between' }, [
            h('div', { className: 'text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400' }, 'Allocations'),
            h('button', {
              type: 'button',
              className: 'text-xs font-semibold text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white disabled:opacity-50',
              onClick: addAllocation,
              disabled: isReadOnly,
            }, '+ Add allocation'),
          ]),
          noPools
            ? h('div', { className: 'rounded-lg border border-dashed border-slate-200 dark:border-white/10 p-3 text-xs text-slate-500 dark:text-slate-400' }, 'Add available hours pools to this deliverable before assigning tasks.')
            : null,
          showTeamHint
            ? h('div', { className: 'text-xs text-slate-500 dark:text-slate-400' }, 'Set Job Team in Settings to restrict assignees.')
            : null,
          h('div', { className: 'space-y-3' }, (draft.allocations || []).map((alloc, index) => (
            h('div', { key: alloc.id || index, className: 'grid gap-2 sm:grid-cols-[1fr_1fr_100px_auto] items-center' }, [
              h('select', {
                value: alloc.assigneeUserId || '',
                onChange: (e) => updateAllocation(index, { assigneeUserId: e.target.value || null }),
                disabled: isReadOnly,
                className: 'h-10 rounded-md border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 px-3 text-sm text-slate-700 dark:text-slate-200 disabled:opacity-60',
              }, [
                h('option', { value: '' }, 'Assignee'),
                ...assignees.map((member) => h('option', { key: member.id, value: member.id }, member.name || member.email || 'Member')),
              ]),
              h('select', {
                value: alloc.serviceTypeId || '',
                onChange: (e) => updateAllocation(index, { serviceTypeId: e.target.value || null }),
                disabled: noPools || isReadOnly,
                className: 'h-10 rounded-md border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 px-3 text-sm text-slate-700 dark:text-slate-200 disabled:opacity-60',
              }, [
                h('option', { value: '' }, 'Service type'),
                ...availableServiceTypes.map((type) => h('option', { key: type.id, value: type.id }, type.name || type.id)),
              ]),
              h('input', {
                type: 'number',
                min: 0,
                step: 0.25,
                value: Number.isFinite(Number(alloc.loeHours)) ? alloc.loeHours : '',
                onChange: (e) => updateAllocation(index, { loeHours: e.target.value === '' ? null : Number(e.target.value) }),
                disabled: isReadOnly,
                className: 'h-10 rounded-md border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 px-3 text-sm text-slate-700 dark:text-slate-200 disabled:opacity-60',
                placeholder: 'LOE',
              }),
              h('button', {
                type: 'button',
                className: 'text-xs font-semibold text-slate-500 dark:text-slate-400 hover:text-red-600 dark:hover:text-red-400 disabled:opacity-50',
                onClick: () => removeAllocation(index),
                'aria-label': 'Remove allocation',
                disabled: isReadOnly,
              }, 'Remove'),
            ])
          ))),
        ]),
        error
          ? h('div', { className: 'rounded-lg border border-red-200 dark:border-red-400/30 bg-red-50 dark:bg-red-500/10 p-3 text-xs text-red-600 dark:text-red-300' }, error)
          : null,
      ]),
      h('div', { className: 'border-t border-slate-200 dark:border-white/10 px-5 py-4 flex items-center justify-between' }, [
        h('div', { className: 'text-xs text-slate-500 dark:text-slate-400' }, formatStatus(draft.status)),
        h('div', { className: 'flex items-center gap-2' }, [
          h('button', {
            type: 'button',
            className: 'inline-flex items-center justify-center h-9 px-4 rounded-md border border-slate-200 dark:border-white/10 text-sm font-semibold text-slate-700 dark:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-800',
            onClick: () => onClose && onClose(),
          }, 'Cancel'),
          h('button', {
            type: 'button',
            className: `inline-flex items-center justify-center h-9 px-4 rounded-md text-sm font-semibold ${isReadOnly ? 'bg-slate-200 dark:bg-slate-800 text-slate-500 cursor-not-allowed' : 'bg-netnet-purple text-white hover:brightness-110'}`,
            onClick: handleSave,
            disabled: isReadOnly,
          }, 'Save'),
        ]),
      ]),
    ]),
    showCompleteConfirm
      ? h('div', { className: 'absolute inset-0 flex items-center justify-center z-10' }, [
        h('div', { className: 'absolute inset-0 bg-black/30' }),
        h('div', { className: 'relative z-10 w-full max-w-sm rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 p-5 space-y-4 shadow-xl' }, [
          h('div', { className: 'text-base font-semibold text-slate-900 dark:text-white' }, 'Confirm completion'),
          h('p', { className: 'text-sm text-slate-500 dark:text-slate-400' }, 'Choose the completion date for this task.'),
          h('input', {
            type: 'date',
            value: completionDate,
            onChange: (e) => setCompletionDate(e.target.value || localDateISO()),
            className: 'w-full rounded-md border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 px-3 py-2 text-sm text-slate-700 dark:text-slate-200',
          }),
          h('div', { className: 'flex items-center justify-end gap-2' }, [
            h('button', {
              type: 'button',
              className: 'inline-flex items-center justify-center h-9 px-4 rounded-md border border-slate-200 dark:border-white/10 text-sm font-semibold text-slate-700 dark:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-800',
              onClick: () => setShowCompleteConfirm(false),
            }, 'Cancel'),
            h('button', {
              type: 'button',
              className: 'inline-flex items-center justify-center h-9 px-4 rounded-md bg-netnet-purple text-white text-sm font-semibold hover:brightness-110',
              onClick: confirmComplete,
            }, 'Confirm'),
          ]),
        ]),
      ])
      : null,
  ]);
}
