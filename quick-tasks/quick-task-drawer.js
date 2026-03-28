import { TaskStyleRichTextField } from '../jobs/task-style-rich-text-field.js';
import { getContactsData, getIndividualsData } from '../contacts/contacts-data.js';
import {
  getCurrentUserId,
  getTaskActualHours,
  getTaskById,
  getTaskContext,
  getTaskPrimaryAllocation,
  getTaskTotalLoe,
} from './quick-tasks-store.js';
import { formatDateLabel, formatHours } from './quick-tasks-helpers.js';

const { createElement: h, useEffect, useMemo, useRef, useState } = React;

function createId(prefix) {
  return `${prefix}_${Math.random().toString(36).slice(2, 9)}`;
}

function quarterRound(value) {
  return Math.round((Number(value) || 0) * 4) / 4;
}

function cloneDraft(draft) {
  return {
    ...draft,
    allocations: Array.isArray(draft?.allocations)
      ? draft.allocations.map((allocation) => ({ ...allocation }))
      : [],
  };
}

function serializeDraft(draft) {
  return JSON.stringify({
    id: draft?.id || null,
    title: String(draft?.title || ''),
    description: String(draft?.description || ''),
    serviceTypeId: draft?.serviceTypeId || '',
    loeInput: String(draft?.loeInput || ''),
    dueDate: draft?.dueDate || '',
    status: draft?.status || 'in_progress',
    completedAt: draft?.completedAt || null,
    contextType: draft?.contextType || 'internal',
    companyId: draft?.companyId || '',
    personId: draft?.personId || '',
    deleteSourceItem: draft?.deleteSourceItem !== false,
    allocations: Array.isArray(draft?.allocations)
      ? draft.allocations.map((allocation) => ({
        id: allocation?.id || '',
        assigneeUserId: allocation?.assigneeUserId || '',
        loeHours: Number(allocation?.loeHours) || 0,
      }))
      : [],
  });
}

function formatStatusLabel(status) {
  if (status === 'completed') return 'Completed';
  if (status === 'backlog') return 'Backlog';
  return 'In Progress';
}

function rebalanceAllocations(allocations, totalHours, serviceTypeId) {
  const nextAllocations = (Array.isArray(allocations) ? allocations : [])
    .map((allocation) => ({
      ...allocation,
      assigneeUserId: allocation?.assigneeUserId || null,
      loeHours: Number(allocation?.loeHours) || 0,
    }))
    .filter((allocation) => allocation.assigneeUserId);

  if (!nextAllocations.length) return [];

  const roundedTotal = Math.max(0, quarterRound(totalHours));
  if (nextAllocations.length === 1) {
    return nextAllocations.map((allocation) => ({
      ...allocation,
      serviceTypeId: serviceTypeId || null,
      loeHours: roundedTotal,
    }));
  }

  const currentTotal = nextAllocations.reduce((sum, allocation) => sum + (Number(allocation.loeHours) || 0), 0);
  let remaining = roundedTotal;

  return nextAllocations.map((allocation, index) => {
    if (index === nextAllocations.length - 1) {
      return {
        ...allocation,
        serviceTypeId: serviceTypeId || null,
        loeHours: quarterRound(remaining),
      };
    }

    const baseShare = currentTotal > 0
      ? (Number(allocation.loeHours) || 0) / currentTotal
      : (1 / nextAllocations.length);
    const hours = quarterRound(baseShare * roundedTotal);
    remaining = quarterRound(remaining - hours);
    return {
      ...allocation,
      serviceTypeId: serviceTypeId || null,
      loeHours: hours,
    };
  });
}

function validateDraft(draft, hasServiceTypes) {
  const title = String(draft?.title || '').trim();
  const description = String(draft?.description || '').trim();
  const totalHours = Number(draft?.loeInput);
  const selectedAssignees = (Array.isArray(draft?.allocations) ? draft.allocations : [])
    .map((allocation) => String(allocation?.assigneeUserId || '').trim())
    .filter(Boolean);
  const uniqueAssignees = new Set(selectedAssignees);

  const messages = {
    title: title ? '' : 'Title is required.',
    description: description ? '' : 'Description is required.',
    serviceTypeId: draft?.serviceTypeId ? '' : 'Service Type is required.',
    loeInput: Number.isFinite(totalHours) && totalHours > 0 ? '' : 'LOE must be greater than 0.',
    dueDate: draft?.dueDate ? '' : 'Due date is required.',
    allocations: selectedAssignees.length
      ? (uniqueAssignees.size === selectedAssignees.length ? '' : 'Each assignee can only appear once.')
      : 'At least one assignee is required.',
    companyId: draft?.contextType === 'client' && !draft?.companyId ? 'Company is required for Client tasks.' : '',
    serviceTypes: hasServiceTypes ? '' : 'Add an active Service Type before creating Quick Tasks.',
  };

  const ready = Object.values(messages).every((message) => !message);
  let summary = '';
  if (!ready) {
    summary = messages.serviceTypes
      || messages.companyId
      || 'Fill the required fields to continue.';
  }

  return { ready, messages, summary };
}

function buildAssigneeRows(draft, members, onChangeAssignee, onAddAssignee, onRemoveAssignee, showErrors, errorMessage) {
  const rows = Array.isArray(draft.allocations) && draft.allocations.length
    ? draft.allocations
    : [{ id: createId('alloc'), assigneeUserId: '' }];

  return h('div', { className: 'rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-950/40 p-4 space-y-3' }, [
    h('div', { className: 'flex items-center justify-between gap-3' }, [
      h('div', { className: 'space-y-1' }, [
        h('div', { className: 'text-[11px] uppercase tracking-wide text-slate-500 dark:text-slate-400' }, 'Assignees'),
        h('div', { className: 'text-xs text-slate-500 dark:text-slate-400' }, 'Use the same assignee pattern as the unified Quick Task rows.'),
      ]),
      h('button', {
        type: 'button',
        className: 'inline-flex items-center gap-2 text-xs font-semibold text-slate-500 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white',
        onClick: onAddAssignee,
      }, '+ Assignee'),
    ]),
    h('div', { className: 'space-y-2' }, rows.map((allocation, index) => h('div', {
      key: allocation.id,
      className: 'grid gap-3 items-center md:grid-cols-[1fr_auto]',
    }, [
      h('select', {
        value: allocation.assigneeUserId || '',
        onChange: (event) => onChangeAssignee(allocation.id, event.target.value || ''),
        className: 'h-10 rounded-md border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 px-3 text-sm text-slate-700 dark:text-slate-200',
      }, [
        h('option', { value: '' }, index === 0 ? 'Select assignee' : 'Additional assignee'),
        ...members.map((member) => h('option', { key: member.id, value: member.id }, member.name || member.email || 'Member')),
      ]),
      h('button', {
        type: 'button',
        className: 'inline-flex items-center justify-center rounded-md border border-slate-200 dark:border-white/10 px-3 h-10 text-xs font-semibold text-slate-600 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-50',
        onClick: () => onRemoveAssignee(allocation.id),
        disabled: rows.length <= 1,
      }, 'Remove'),
    ]))),
    showErrors && errorMessage
      ? h('div', { className: 'text-xs text-red-500' }, errorMessage)
      : null,
  ]);
}

export function buildQuickTaskDrawerInitialDraft({
  mode,
  taskId,
  sourceItem,
  serviceTypes,
  members,
}) {
  const defaultServiceTypeId = serviceTypes.find((type) => type.active)?.id || '';
  const currentUserId = getCurrentUserId(members) || '';

  if (mode === 'edit' && taskId) {
    const task = getTaskById(taskId);
    if (!task) return null;
    const primaryAllocation = getTaskPrimaryAllocation(task);
    const context = getTaskContext(task);
    const allocations = Array.isArray(task.allocations) && task.allocations.length
      ? task.allocations.map((allocation) => ({
        id: allocation.id || createId('alloc'),
        assigneeUserId: allocation.assigneeUserId || '',
        loeHours: Number(allocation.loeHours) || 0,
        serviceTypeId: allocation.serviceTypeId || primaryAllocation?.serviceTypeId || '',
      }))
      : [{
        id: createId('alloc'),
        assigneeUserId: primaryAllocation?.assigneeUserId || currentUserId,
        loeHours: Number(primaryAllocation?.loeHours) || 0,
        serviceTypeId: primaryAllocation?.serviceTypeId || defaultServiceTypeId,
      }];

    return {
      id: task.id,
      title: task.title || '',
      description: task.description || '',
      status: task.status || 'in_progress',
      completedAt: task.completedAt || null,
      dueDate: task.dueDate || '',
      serviceTypeId: primaryAllocation?.serviceTypeId || defaultServiceTypeId,
      loeInput: getTaskTotalLoe(task) ? String(getTaskTotalLoe(task)) : '',
      contextType: context.type === 'internal' ? 'internal' : 'client',
      companyId: context.companyId || '',
      personId: context.personId || '',
      allocations,
      deleteSourceItem: true,
      sourceListItemId: task.sourceListItemId || null,
      sourceListId: task.sourceListId || null,
      isArchived: !!task.isArchived,
      actualHours: getTaskActualHours(task),
    };
  }

  return {
    id: null,
    title: sourceItem?.title || '',
    description: sourceItem?.notes || '',
    status: 'in_progress',
    completedAt: null,
    dueDate: '',
    serviceTypeId: defaultServiceTypeId,
    loeInput: '',
    contextType: 'internal',
    companyId: '',
    personId: '',
    allocations: [{
      id: createId('alloc'),
      assigneeUserId: currentUserId,
      loeHours: 0,
      serviceTypeId: defaultServiceTypeId,
    }],
    deleteSourceItem: true,
    sourceListItemId: sourceItem?.id || null,
    sourceListId: sourceItem?.folderId || null,
    isArchived: false,
    actualHours: 0,
  };
}

export function QuickTaskDrawerPanel({
  mode = 'create',
  initialDraft,
  members = [],
  serviceTypes = [],
  canDelete = false,
  showDeleteSourceToggle = false,
  onClose,
  onSubmit,
  onDelete,
  onArchive,
  onToggleComplete,
}) {
  const [draft, setDraft] = useState(() => cloneDraft(initialDraft));
  const [showErrors, setShowErrors] = useState(false);
  const titleRef = useRef(null);
  const companies = useMemo(() => getContactsData(), []);
  const individuals = useMemo(() => getIndividualsData(), []);
  const companyMap = useMemo(
    () => new Map(companies.map((company) => [String(company.id), company])),
    [companies]
  );
  const hasServiceTypes = serviceTypes.length > 0;
  const initialSnapshot = useMemo(() => serializeDraft(initialDraft), [initialDraft]);
  const validation = useMemo(() => validateDraft(draft, hasServiceTypes), [draft, hasServiceTypes]);

  useEffect(() => {
    setDraft(cloneDraft(initialDraft));
    setShowErrors(false);
  }, [initialDraft]);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => titleRef.current?.focus());
    return () => window.cancelAnimationFrame(frame);
  }, [initialDraft?.id, mode]);

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        const dirty = serializeDraft(draft) !== initialSnapshot;
        onClose?.({ dirty });
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [draft, initialSnapshot, onClose]);

  const dirty = serializeDraft(draft) !== initialSnapshot;
  const company = draft.companyId ? companyMap.get(String(draft.companyId)) : null;
  const personOptions = company?.people || (!draft.companyId ? individuals : []);

  useEffect(() => {
    if (draft.contextType !== 'client' && (draft.companyId || draft.personId)) {
      setDraft((prev) => ({ ...prev, companyId: '', personId: '' }));
      return;
    }
    if (draft.contextType !== 'client') return;
    if (!draft.companyId && draft.personId) {
      setDraft((prev) => ({ ...prev, personId: '' }));
      return;
    }
    const validPersonIds = new Set(personOptions.map((person) => String(person.id)));
    if (draft.personId && !validPersonIds.has(String(draft.personId))) {
      setDraft((prev) => ({ ...prev, personId: '' }));
    }
  }, [draft.contextType, draft.companyId, draft.personId, personOptions]);

  const updateField = (field, value) => {
    setDraft((prev) => ({ ...prev, [field]: value }));
  };

  const updateAssignee = (allocationId, assigneeUserId) => {
    setDraft((prev) => ({
      ...prev,
      allocations: prev.allocations.map((allocation) => (
        allocation.id === allocationId
          ? { ...allocation, assigneeUserId }
          : allocation
      )),
    }));
  };

  const addAssignee = () => {
    setDraft((prev) => ({
      ...prev,
      allocations: [
        ...(Array.isArray(prev.allocations) ? prev.allocations : []),
        {
          id: createId('alloc'),
          assigneeUserId: '',
          loeHours: 0,
          serviceTypeId: prev.serviceTypeId || null,
        },
      ],
    }));
  };

  const removeAssignee = (allocationId) => {
    setDraft((prev) => {
      const current = Array.isArray(prev.allocations) ? prev.allocations : [];
      if (current.length <= 1) return prev;
      return {
        ...prev,
        allocations: current.filter((allocation) => allocation.id !== allocationId),
      };
    });
  };

  const requestClose = () => onClose?.({ dirty });

  const handleSubmit = () => {
    setShowErrors(true);
    if (!validation.ready) return;
    const payload = {
      title: String(draft.title || '').trim(),
      description: String(draft.description || '').trim(),
      dueDate: draft.dueDate || null,
      status: draft.status || 'in_progress',
      completedAt: draft.status === 'completed' ? (draft.completedAt || null) : null,
      context: draft.contextType === 'internal'
        ? { type: 'internal', companyId: null, personId: null }
        : {
          type: 'client',
          companyId: draft.companyId || null,
          personId: draft.personId || null,
        },
      allocations: rebalanceAllocations(draft.allocations, Number(draft.loeInput), draft.serviceTypeId || null),
    };

    onSubmit?.({
      payload,
      deleteSourceItem: draft.deleteSourceItem !== false,
    });
  };

  const saveLabel = mode === 'edit' ? 'Save Quick Task' : 'Create Quick Task';
  const statusLabel = formatStatusLabel(draft.status);
  const completedLabel = draft.completedAt ? `Completed on ${formatDateLabel(draft.completedAt)}` : '';

  return h(React.Fragment, null, [
    h('div', {
      id: 'app-drawer-backdrop',
      onClick: requestClose,
    }),
    h('aside', { id: 'app-drawer', className: 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white p-0 flex flex-col w-full max-w-md h-full' }, [
      h('div', { className: 'flex items-start justify-between gap-4 px-5 py-4 border-b border-slate-200 dark:border-white/10' }, [
        h('div', { className: 'space-y-2 min-w-0' }, [
          h('div', { className: 'text-[11px] uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400' }, mode === 'edit' ? 'Edit Quick Task' : 'New Quick Task'),
          h('div', { className: 'text-lg font-semibold text-slate-900 dark:text-white' }, mode === 'edit' ? (draft.title || 'Quick Task') : 'Create Quick Task'),
          h('div', { className: 'flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400' }, [
            h('span', { className: 'inline-flex items-center rounded-full border border-slate-200 dark:border-white/10 px-2 py-1 font-semibold text-slate-600 dark:text-slate-300' }, statusLabel),
            mode === 'edit'
              ? h('span', { className: 'inline-flex items-center rounded-full border border-slate-200 dark:border-white/10 px-2 py-1 text-slate-500 dark:text-slate-400' }, `Actual ${formatHours(draft.actualHours || 0)}`)
              : null,
            completedLabel
              ? h('span', { className: 'inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-2 py-1 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-200' }, completedLabel)
              : null,
          ]),
        ]),
        h('button', {
          type: 'button',
          className: 'h-9 w-9 rounded-full border border-slate-200 dark:border-white/10 text-slate-500 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white',
          onClick: requestClose,
          'aria-label': 'Close Quick Task drawer',
        }, 'x'),
      ]),
      h('div', { className: 'flex-1 overflow-y-auto px-5 py-5 space-y-5' }, [
        h('div', { className: 'rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-slate-950/40 p-4 space-y-4' }, [
          h('div', { className: 'text-[11px] uppercase tracking-wide text-slate-500 dark:text-slate-400' }, 'Task'),
          h('label', { className: 'flex flex-col gap-1 text-sm text-slate-700 dark:text-slate-200' }, [
            h('div', { className: 'flex items-center justify-between' }, [
              h('span', null, 'Title'),
              h('span', { className: 'text-[11px] uppercase tracking-wide text-slate-400 dark:text-slate-500' }, 'Required'),
            ]),
            h('input', {
              ref: titleRef,
              type: 'text',
              value: draft.title || '',
              onChange: (event) => updateField('title', event.target.value),
              className: 'h-11 rounded-md border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 px-3 text-sm text-slate-800 dark:text-white',
              placeholder: 'What needs to get done?',
            }),
            showErrors && validation.messages.title
              ? h('div', { className: 'text-xs text-red-500' }, validation.messages.title)
              : null,
          ]),
          h(TaskStyleRichTextField, {
            label: 'Description',
            value: draft.description || '',
            rows: 6,
            footerText: '',
            onChange: (value) => updateField('description', value),
          }),
          showErrors && validation.messages.description
            ? h('div', { className: 'text-xs text-red-500 -mt-2' }, validation.messages.description)
            : null,
        ]),
        h('div', { className: 'rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-950/40 p-4 space-y-4' }, [
          h('div', { className: 'text-[11px] uppercase tracking-wide text-slate-500 dark:text-slate-400' }, 'Scope'),
          h('div', { className: 'grid gap-4 md:grid-cols-2' }, [
            h('label', { className: 'flex flex-col gap-1 text-sm text-slate-700 dark:text-slate-200' }, [
              h('div', { className: 'flex items-center justify-between' }, [
                h('span', null, 'Service Type'),
                h('span', { className: 'text-[11px] uppercase tracking-wide text-slate-400 dark:text-slate-500' }, 'Required'),
              ]),
              h('select', {
                value: draft.serviceTypeId || '',
                onChange: (event) => updateField('serviceTypeId', event.target.value || ''),
                className: 'h-11 rounded-md border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 px-3 text-sm text-slate-700 dark:text-slate-200',
                disabled: !hasServiceTypes,
              }, [
                h('option', { value: '' }, hasServiceTypes ? 'Select service type' : 'No active service types'),
                ...serviceTypes.map((type) => h('option', { key: type.id, value: type.id }, type.name)),
              ]),
              showErrors && validation.messages.serviceTypeId
                ? h('div', { className: 'text-xs text-red-500' }, validation.messages.serviceTypeId)
                : null,
            ]),
            h('label', { className: 'flex flex-col gap-1 text-sm text-slate-700 dark:text-slate-200' }, [
              h('div', { className: 'flex items-center justify-between' }, [
                h('span', null, 'LOE (hours)'),
                h('span', { className: 'text-[11px] uppercase tracking-wide text-slate-400 dark:text-slate-500' }, 'Required'),
              ]),
              h('input', {
                type: 'number',
                min: 0,
                step: 0.25,
                value: draft.loeInput || '',
                onChange: (event) => updateField('loeInput', event.target.value),
                className: 'h-11 rounded-md border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 px-3 text-sm text-slate-800 dark:text-white',
                placeholder: '0.0',
              }),
              showErrors && validation.messages.loeInput
                ? h('div', { className: 'text-xs text-red-500' }, validation.messages.loeInput)
                : null,
            ]),
          ]),
          h('label', { className: 'flex flex-col gap-1 text-sm text-slate-700 dark:text-slate-200' }, [
            h('div', { className: 'flex items-center justify-between' }, [
              h('span', null, 'Due date'),
              h('span', { className: 'text-[11px] uppercase tracking-wide text-slate-400 dark:text-slate-500' }, 'Required'),
            ]),
            h('input', {
              type: 'date',
              value: draft.dueDate || '',
              onChange: (event) => updateField('dueDate', event.target.value || ''),
              className: 'h-11 rounded-md border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 px-3 text-sm text-slate-700 dark:text-slate-200',
            }),
            showErrors && validation.messages.dueDate
              ? h('div', { className: 'text-xs text-red-500' }, validation.messages.dueDate)
              : null,
          ]),
          !hasServiceTypes && validation.messages.serviceTypes
            ? h('div', { className: 'rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200' }, validation.messages.serviceTypes)
            : null,
        ]),
        buildAssigneeRows(
          draft,
          members,
          updateAssignee,
          addAssignee,
          removeAssignee,
          showErrors,
          validation.messages.allocations
        ),
        h('div', { className: 'rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-950/40 p-4 space-y-4' }, [
          h('div', { className: 'space-y-1' }, [
            h('div', { className: 'text-[11px] uppercase tracking-wide text-slate-500 dark:text-slate-400' }, 'Context'),
            h('div', { className: 'text-xs text-slate-500 dark:text-slate-400' }, 'Quick Tasks use the same task system as Jobs, without Job or Deliverable context.'),
          ]),
          h('div', { className: 'inline-flex rounded-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-white/10 p-1 self-start' }, [
            ['internal', 'Internal'],
            ['client', 'Client'],
          ].map(([value, label]) => h('button', {
            key: value,
            type: 'button',
            className: `px-3 py-1 rounded-full text-sm font-semibold ${draft.contextType === value ? 'bg-white dark:bg-slate-700 shadow border border-slate-200 dark:border-white/10' : 'text-slate-600 dark:text-white/70'}`,
            onClick: () => updateField('contextType', value),
          }, label))),
          draft.contextType === 'client'
            ? h('div', { className: 'grid gap-4 md:grid-cols-2' }, [
              h('label', { className: 'flex flex-col gap-1 text-sm text-slate-700 dark:text-slate-200' }, [
                h('div', { className: 'flex items-center justify-between' }, [
                  h('span', null, 'Company'),
                  h('span', { className: 'text-[11px] uppercase tracking-wide text-slate-400 dark:text-slate-500' }, 'Required'),
                ]),
                h('select', {
                  value: draft.companyId || '',
                  onChange: (event) => updateField('companyId', event.target.value || ''),
                  className: 'h-11 rounded-md border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 px-3 text-sm text-slate-700 dark:text-slate-200',
                }, [
                  h('option', { value: '' }, 'Select company'),
                  ...companies.map((item) => h('option', { key: item.id, value: item.id }, item.name || 'Company')),
                ]),
                showErrors && validation.messages.companyId
                  ? h('div', { className: 'text-xs text-red-500' }, validation.messages.companyId)
                  : null,
              ]),
              h('label', { className: 'flex flex-col gap-1 text-sm text-slate-700 dark:text-slate-200' }, [
                h('div', { className: 'flex items-center justify-between' }, [
                  h('span', null, 'Person'),
                  h('span', { className: 'text-[11px] uppercase tracking-wide text-slate-400 dark:text-slate-500' }, 'Optional'),
                ]),
                h('select', {
                  value: draft.personId || '',
                  onChange: (event) => updateField('personId', event.target.value || ''),
                  className: 'h-11 rounded-md border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 px-3 text-sm text-slate-700 dark:text-slate-200',
                  disabled: !draft.companyId,
                }, [
                  h('option', { value: '' }, draft.companyId ? 'Optional person' : 'Select a company first'),
                  ...personOptions.map((person) => h('option', { key: person.id, value: person.id }, person.name || 'Person')),
                ]),
              ]),
            ])
            : null,
        ]),
        showDeleteSourceToggle
          ? h('label', { className: 'flex items-center justify-between rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-950/40 px-4 py-3 text-sm text-slate-700 dark:text-slate-200' }, [
            h('span', null, 'Delete list item after creating task'),
            h('input', {
              type: 'checkbox',
              checked: draft.deleteSourceItem !== false,
              onChange: (event) => updateField('deleteSourceItem', event.target.checked),
              className: 'h-4 w-4 rounded border-slate-300 dark:border-white/20 text-netnet-purple focus:ring-netnet-purple',
            }),
          ])
          : null,
      ]),
      h('div', { className: 'border-t border-slate-200 dark:border-white/10 px-5 py-4 space-y-3' }, [
        validation.summary
          ? h('div', { className: 'text-xs text-slate-500 dark:text-slate-400' }, validation.summary)
          : h('div', { className: 'text-xs text-slate-500 dark:text-slate-400' }, 'Quick Tasks save directly into the same persistent store as the list view.'),
        h('div', { className: 'flex items-center justify-between gap-3' }, [
          h('div', { className: 'flex items-center gap-2' }, [
            mode === 'edit' && !draft.isArchived
              ? h('button', {
                type: 'button',
                className: 'inline-flex items-center justify-center h-9 px-3 rounded-md border border-slate-200 dark:border-white/10 text-xs font-semibold text-slate-700 dark:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-800',
                onClick: onArchive,
              }, 'Archive')
              : null,
            mode === 'edit' && canDelete
              ? h('button', {
                type: 'button',
                className: 'inline-flex items-center justify-center h-9 px-3 rounded-md border border-red-200 text-xs font-semibold text-red-600 hover:bg-red-50',
                onClick: onDelete,
              }, 'Delete')
              : null,
          ]),
          h('div', { className: 'flex items-center gap-2' }, [
            mode === 'edit'
              ? h('button', {
                type: 'button',
                className: 'inline-flex items-center justify-center h-9 px-3 rounded-md border border-slate-200 dark:border-white/10 text-xs font-semibold text-slate-700 dark:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-800',
                onClick: onToggleComplete,
              }, draft.status === 'completed' ? 'Reopen' : 'Mark Completed')
              : null,
            h('button', {
              type: 'button',
              className: 'inline-flex items-center justify-center h-9 px-4 rounded-md border border-slate-200 dark:border-white/10 text-sm font-semibold text-slate-700 dark:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-800',
              onClick: requestClose,
            }, 'Cancel'),
            h('button', {
              type: 'button',
              className: `inline-flex items-center justify-center h-9 px-4 rounded-md text-sm font-semibold ${validation.ready ? 'bg-netnet-purple text-white hover:brightness-110' : 'bg-slate-200 dark:bg-slate-800 text-slate-500 dark:text-slate-400 cursor-not-allowed'}`,
              onClick: handleSubmit,
              disabled: !validation.ready,
            }, saveLabel),
          ]),
        ]),
      ]),
    ]),
  ]);
}
