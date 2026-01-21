import { loadServiceTypes } from '../../quick-tasks/quick-tasks-store.js';
import { loadJobs } from '../jobs-store.js';
import { getJobNumber, isJobNumberUnique } from '../job-number-utils.js';
import { isJobNumberFormatValid, setJobNumberOverride } from '../jobs-ui-state.js';
import { JobTaskDrawer } from '../job-task-drawer.js';
import { JobActivationModal } from './job-activation-modal.js';

const { createElement: h, useEffect, useMemo, useState } = React;
const CURRENT_USER_ID = 'currentUser';

function localDateISO(date = new Date()) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function JobSettingsTab({
  job,
  members = [],
  onJobUpdate,
  readOnly: readOnlyOverride,
  onJobNumberChange,
}) {
  const [showActivation, setShowActivation] = useState(false);
  const [showComplete, setShowComplete] = useState(false);
  const [showArchive, setShowArchive] = useState(false);
  const [showReactivate, setShowReactivate] = useState(false);
  const [completionDate, setCompletionDate] = useState(localDateISO());
  const [completionError, setCompletionError] = useState('');
  const [drawerState, setDrawerState] = useState({ deliverableId: null, taskId: null });
  const [jobNumberInput, setJobNumberInput] = useState(() => getJobNumber(job));
  const [jobNumberError, setJobNumberError] = useState('');

  const readOnly = readOnlyOverride === undefined ? job?.status === 'archived' : readOnlyOverride;
  const status = job?.status || 'pending';
  const today = localDateISO();

  const serviceTypes = useMemo(() => loadServiceTypes().filter((type) => type.active), []);
  const memberMap = useMemo(() => new Map((members || []).map((member) => [String(member.id), member])), [members]);
  const teamIds = Array.isArray(job?.teamUserIds) ? job.teamUserIds : [];
  const teamSet = new Set(teamIds.map((id) => String(id)));
  const leadId = job?.jobLeadUserId ? String(job.jobLeadUserId) : '';
  const leadOptions = teamIds.length ? members.filter((m) => teamSet.has(String(m.id))) : members;
  const allJobs = useMemo(() => loadJobs(), [job?.id]);
  const currentJobNumber = getJobNumber(job);

  let assigneeOptions = teamIds.length
    ? members.filter((m) => teamSet.has(String(m.id)))
    : members;
  if (job?.jobLeadUserId && !assigneeOptions.some((m) => String(m.id) === String(job.jobLeadUserId))) {
    const lead = memberMap.get(String(job.jobLeadUserId));
    if (lead) assigneeOptions = [lead, ...assigneeOptions];
  }
  const showTeamHint = teamIds.length === 0;

  const toggleMember = (memberId) => {
    if (typeof onJobUpdate !== 'function' || readOnly) return;
    const id = String(memberId);
    const next = new Set(teamSet);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    onJobUpdate({ teamUserIds: Array.from(next) });
  };

  const handleLeadChange = (value) => {
    if (typeof onJobUpdate !== 'function' || readOnly) return;
    onJobUpdate({ jobLeadUserId: value || null });
  };

  const openTask = (deliverableId, taskId) => {
    setDrawerState({ deliverableId, taskId });
    setShowActivation(false);
  };

  const closeDrawer = () => setDrawerState({ deliverableId: null, taskId: null });

  const activeDeliverable = job?.deliverables?.find((deliverable) => deliverable.id === drawerState.deliverableId) || null;
  const activeTask = activeDeliverable?.tasks?.find((task) => task.id === drawerState.taskId) || null;

  const applyTaskUpdate = (deliverableId, taskId, updates) => {
    if (typeof onJobUpdate !== 'function') return;
    const nextDeliverables = (job?.deliverables || []).map((deliverable) => {
      if (deliverable.id !== deliverableId) return deliverable;
      const tasks = (deliverable.tasks || []).map((task) => {
        if (task.id !== taskId) return task;
        return { ...task, ...updates };
      });
      return { ...deliverable, tasks };
    });
    onJobUpdate({ deliverables: nextDeliverables });
  };

  const handleSaveTask = (payload) => {
    if (!activeDeliverable || !activeTask) return;
    applyTaskUpdate(activeDeliverable.id, activeTask.id, payload);
    closeDrawer();
  };

  const handleActivate = () => {
    if (typeof onJobUpdate !== 'function' || readOnly) return;
    onJobUpdate({ status: 'active' });
    window?.showToast?.('Job activated');
    setShowActivation(false);
  };

  const openCompleteModal = () => {
    setCompletionDate(job?.completedAt || today);
    setCompletionError('');
    setShowComplete(true);
  };

  const confirmComplete = () => {
    if (typeof onJobUpdate !== 'function') return;
    if (completionDate > today) {
      setCompletionError('Completion date cannot be in the future.');
      return;
    }
    onJobUpdate({
      status: 'completed',
      completedAt: completionDate || today,
      completedByUserId: CURRENT_USER_ID,
    });
    window?.showToast?.('Job completed');
    setShowComplete(false);
  };

  const confirmArchive = () => {
    if (typeof onJobUpdate !== 'function') return;
    onJobUpdate({
      status: 'archived',
      lastNonArchivedStatus: status,
      archivedAt: new Date().toISOString(),
      archivedByUserId: CURRENT_USER_ID,
    });
    window?.showToast?.('Job archived');
    setShowArchive(false);
  };

  const confirmReactivate = () => {
    if (typeof onJobUpdate !== 'function') return;
    const nextStatus = job?.lastNonArchivedStatus || 'completed';
    onJobUpdate({
      status: nextStatus,
      archivedAt: null,
      archivedByUserId: null,
    });
    window?.showToast?.('Job reactivated');
    setShowReactivate(false);
  };

  const saveJobNumber = () => {
    if (!job?.id || readOnly) return;
    const trimmed = String(jobNumberInput || '').trim();
    if (!trimmed) {
      setJobNumberOverride(job.id, null);
      setJobNumberError('');
      setJobNumberInput(getJobNumber(job));
      onJobNumberChange?.();
      window?.showToast?.('Job number reset');
      return;
    }
    if (!isJobNumberFormatValid(trimmed)) {
      setJobNumberError('Use 3-6 digits.');
      return;
    }
    if (!isJobNumberUnique(job.id, trimmed, allJobs)) {
      setJobNumberError('That job number is already in use.');
      return;
    }
    setJobNumberOverride(job.id, trimmed);
    setJobNumberError('');
    onJobNumberChange?.();
    window?.showToast?.('Job number updated');
  };

  const jobNumberChanged = String(jobNumberInput || '').trim() !== String(currentJobNumber || '').trim();

  useEffect(() => {
    setJobNumberInput(currentJobNumber);
    setJobNumberError('');
  }, [job?.id, currentJobNumber]);

  const lifecycleButtons = [];
  if (status === 'pending') {
    lifecycleButtons.push(
      h('button', {
        key: 'activate',
        type: 'button',
        className: 'inline-flex items-center justify-center h-10 px-4 rounded-md bg-netnet-purple text-white text-sm font-semibold hover:brightness-110',
        onClick: () => setShowActivation(true),
      }, 'Activate Job')
    );
    lifecycleButtons.push(
      h('button', {
        key: 'complete',
        type: 'button',
        className: 'inline-flex items-center justify-center h-10 px-4 rounded-md border border-slate-200 dark:border-white/10 text-sm font-semibold text-slate-700 dark:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-800',
        onClick: openCompleteModal,
      }, 'Mark Completed')
    );
  }
  if (status === 'active') {
    lifecycleButtons.push(
      h('button', {
        key: 'complete',
        type: 'button',
        className: 'inline-flex items-center justify-center h-10 px-4 rounded-md border border-slate-200 dark:border-white/10 text-sm font-semibold text-slate-700 dark:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-800',
        onClick: openCompleteModal,
      }, 'Mark Completed')
    );
    lifecycleButtons.push(
      h('button', {
        key: 'archive',
        type: 'button',
        className: 'inline-flex items-center justify-center h-10 px-4 rounded-md border border-rose-200 dark:border-rose-400/30 text-sm font-semibold text-rose-600 dark:text-rose-200 hover:bg-rose-50 dark:hover:bg-rose-500/10',
        onClick: () => setShowArchive(true),
      }, 'Archive Job')
    );
  }
  if (status === 'completed') {
    lifecycleButtons.push(
      h('button', {
        key: 'archive',
        type: 'button',
        className: 'inline-flex items-center justify-center h-10 px-4 rounded-md border border-rose-200 dark:border-rose-400/30 text-sm font-semibold text-rose-600 dark:text-rose-200 hover:bg-rose-50 dark:hover:bg-rose-500/10',
        onClick: () => setShowArchive(true),
      }, 'Archive Job')
    );
  }
  if (status === 'archived') {
    lifecycleButtons.push(
      h('button', {
        key: 'reactivate',
        type: 'button',
        className: 'inline-flex items-center justify-center h-10 px-4 rounded-md bg-netnet-purple text-white text-sm font-semibold hover:brightness-110',
        onClick: () => setShowReactivate(true),
      }, 'Reactivate Job')
    );
  }

  return h('div', { className: 'space-y-4 pb-12' }, [
    h('div', { className: 'rounded-2xl border border-slate-200 dark:border-white/10 bg-white/90 dark:bg-slate-900/60 p-5 space-y-4' }, [
      h('div', { className: 'space-y-1' }, [
        h('h3', { className: 'text-base font-semibold text-slate-900 dark:text-white' }, 'Job Number'),
        h('p', { className: 'text-sm text-slate-500 dark:text-slate-400' }, 'Use a unique number for quick reference.'),
      ]),
      h('div', { className: 'flex flex-wrap items-center gap-3' }, [
        h('input', {
          type: 'text',
          value: jobNumberInput || '',
          onChange: (event) => {
            setJobNumberInput(event.target.value);
            if (jobNumberError) setJobNumberError('');
          },
          disabled: readOnly,
          placeholder: 'e.g. 1042',
          className: 'h-10 w-40 rounded-md border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 px-3 text-sm text-slate-700 dark:text-slate-200 disabled:opacity-60',
        }),
        h('button', {
          type: 'button',
          className: 'inline-flex items-center justify-center h-10 px-4 rounded-md border border-slate-200 dark:border-white/10 text-sm font-semibold text-slate-700 dark:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-50',
          onClick: saveJobNumber,
          disabled: readOnly || !jobNumberChanged,
        }, 'Save'),
      ]),
      jobNumberError
        ? h('div', { className: 'text-xs text-rose-600 dark:text-rose-200' }, jobNumberError)
        : h('div', { className: 'text-xs text-slate-500 dark:text-slate-400' }, readOnly ? 'Job number is locked while archived.' : 'Numbers must be unique across jobs.'),
    ]),
    h('div', { className: 'rounded-2xl border border-slate-200 dark:border-white/10 bg-white/90 dark:bg-slate-900/60 p-5 space-y-4' }, [
      h('div', { className: 'space-y-1' }, [
        h('h3', { className: 'text-base font-semibold text-slate-900 dark:text-white' }, 'Lifecycle'),
        h('p', { className: 'text-sm text-slate-500 dark:text-slate-400' }, 'Manage job status without blocking delivery work.'),
      ]),
      lifecycleButtons.length
        ? h('div', { className: 'flex flex-wrap items-center gap-2' }, lifecycleButtons)
        : h('div', { className: 'text-sm text-slate-500 dark:text-slate-400' }, 'No lifecycle actions available.'),
      status === 'completed' && job?.completedAt
        ? h('div', { className: 'text-xs text-slate-500 dark:text-slate-400' }, `Completed on ${job.completedAt}`)
        : null,
      status === 'archived'
        ? h('div', { className: 'text-xs text-slate-500 dark:text-slate-400' }, 'Archived jobs are view-only. Reporting remains available.')
        : null,
      status === 'archived' && job?.archivedAt
        ? h('div', { className: 'text-xs text-slate-500 dark:text-slate-400' }, `Archived on ${job.archivedAt}`)
        : null,
    ]),
    h('div', { className: 'rounded-2xl border border-slate-200 dark:border-white/10 bg-white/90 dark:bg-slate-900/60 p-5 space-y-4' }, [
      h('div', { className: 'space-y-1' }, [
        h('h3', { className: 'text-base font-semibold text-slate-900 dark:text-white' }, 'Job Team'),
        h('p', { className: 'text-sm text-slate-500 dark:text-slate-400' }, 'Select who is available to take on tasks for this Job.'),
      ]),
      h('div', { className: 'grid gap-2 sm:grid-cols-2' }, (members || []).map((member) => (
        h('label', {
          key: member.id,
          className: 'flex items-center gap-3 rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 px-3 py-2',
        }, [
          h('input', {
            type: 'checkbox',
            checked: teamSet.has(String(member.id)),
            onChange: () => toggleMember(member.id),
            disabled: readOnly,
            className: 'h-4 w-4 rounded border-slate-300 dark:border-white/20 text-netnet-purple focus:ring-netnet-purple disabled:opacity-60',
          }),
          h('div', { className: 'flex flex-col' }, [
            h('span', { className: 'text-sm font-medium text-slate-700 dark:text-slate-200' }, member.name || member.email || 'Member'),
            member.email ? h('span', { className: 'text-xs text-slate-500 dark:text-slate-400' }, member.email) : null,
          ]),
        ])
      ))),
      !teamIds.length
        ? h('div', { className: 'text-xs text-slate-500 dark:text-slate-400' }, 'No team set yet. Assignees will default to all internal users.')
        : null,
    ]),
    h('div', { className: 'rounded-2xl border border-slate-200 dark:border-white/10 bg-white/90 dark:bg-slate-900/60 p-5 space-y-3' }, [
      h('div', { className: 'space-y-1' }, [
        h('h3', { className: 'text-base font-semibold text-slate-900 dark:text-white' }, 'Job Lead'),
        h('p', { className: 'text-sm text-slate-500 dark:text-slate-400' }, 'Optional. Use to highlight who owns delivery.'),
      ]),
      h('select', {
        value: leadId,
        onChange: (e) => handleLeadChange(e.target.value),
        disabled: readOnly,
        className: 'h-10 rounded-md border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 px-3 text-sm text-slate-700 dark:text-slate-200 disabled:opacity-60',
      }, [
        h('option', { value: '' }, 'No lead selected'),
        ...leadOptions.map((member) => h('option', { key: member.id, value: String(member.id) }, member.name || member.email || 'Member')),
      ]),
    ]),
    h(JobActivationModal, {
      job,
      isOpen: showActivation && job?.status === 'pending',
      onClose: () => setShowActivation(false),
      onConfirm: handleActivate,
      onOpenTask: openTask,
    }),
    h(JobTaskDrawer, {
      isOpen: !!activeTask,
      task: activeTask,
      deliverable: activeDeliverable,
      assignees: assigneeOptions,
      serviceTypes,
      showTeamHint,
      readOnly,
      onClose: closeDrawer,
      onSave: handleSaveTask,
    }),
    showComplete
      ? h('div', { className: 'fixed inset-0 z-50 flex items-center justify-center px-4' }, [
        h('div', { className: 'absolute inset-0 bg-black/40', onClick: () => setShowComplete(false) }),
        h('div', { className: 'relative z-10 w-full max-w-sm rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 p-5 space-y-4 shadow-xl' }, [
          h('div', { className: 'text-base font-semibold text-slate-900 dark:text-white' }, 'Mark job as completed'),
          h('p', { className: 'text-sm text-slate-500 dark:text-slate-400' }, 'Set the completion date for this job.'),
          h('input', {
            type: 'date',
            value: completionDate,
            onChange: (e) => setCompletionDate(e.target.value || today),
            className: 'w-full rounded-md border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 px-3 py-2 text-sm text-slate-700 dark:text-slate-200',
          }),
          completionError
            ? h('div', { className: 'rounded-lg border border-rose-200 dark:border-rose-400/30 bg-rose-50 dark:bg-rose-500/10 p-3 text-xs text-rose-600 dark:text-rose-200' }, completionError)
            : null,
          h('div', { className: 'flex items-center justify-end gap-2' }, [
            h('button', {
              type: 'button',
              className: 'inline-flex items-center justify-center h-9 px-4 rounded-md border border-slate-200 dark:border-white/10 text-sm font-semibold text-slate-700 dark:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-800',
              onClick: () => setShowComplete(false),
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
    showArchive
      ? h('div', { className: 'fixed inset-0 z-50 flex items-center justify-center px-4' }, [
        h('div', { className: 'absolute inset-0 bg-black/40', onClick: () => setShowArchive(false) }),
        h('div', { className: 'relative z-10 w-full max-w-sm rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 p-5 space-y-4 shadow-xl' }, [
          h('div', { className: 'text-base font-semibold text-slate-900 dark:text-white' }, 'Archive this job?'),
          h('p', { className: 'text-sm text-slate-500 dark:text-slate-400' }, 'Archiving stops billing and makes the job read-only.'),
          h('div', { className: 'flex items-center justify-end gap-2' }, [
            h('button', {
              type: 'button',
              className: 'inline-flex items-center justify-center h-9 px-4 rounded-md border border-slate-200 dark:border-white/10 text-sm font-semibold text-slate-700 dark:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-800',
              onClick: () => setShowArchive(false),
            }, 'Cancel'),
            h('button', {
              type: 'button',
              className: 'inline-flex items-center justify-center h-9 px-4 rounded-md bg-rose-500 text-white text-sm font-semibold hover:brightness-110',
              onClick: confirmArchive,
            }, 'Archive Job'),
          ]),
        ]),
      ])
      : null,
    showReactivate
      ? h('div', { className: 'fixed inset-0 z-50 flex items-center justify-center px-4' }, [
        h('div', { className: 'absolute inset-0 bg-black/40', onClick: () => setShowReactivate(false) }),
        h('div', { className: 'relative z-10 w-full max-w-sm rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 p-5 space-y-4 shadow-xl' }, [
          h('div', { className: 'text-base font-semibold text-slate-900 dark:text-white' }, 'Reactivate this job?'),
          h('p', { className: 'text-sm text-slate-500 dark:text-slate-400' }, 'Reactivating restores editing and returns the job to its prior status.'),
          h('div', { className: 'flex items-center justify-end gap-2' }, [
            h('button', {
              type: 'button',
              className: 'inline-flex items-center justify-center h-9 px-4 rounded-md border border-slate-200 dark:border-white/10 text-sm font-semibold text-slate-700 dark:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-800',
              onClick: () => setShowReactivate(false),
            }, 'Cancel'),
            h('button', {
              type: 'button',
              className: 'inline-flex items-center justify-center h-9 px-4 rounded-md bg-netnet-purple text-white text-sm font-semibold hover:brightness-110',
              onClick: confirmReactivate,
            }, 'Reactivate Job'),
          ]),
        ]),
      ])
      : null,
  ]);
}
