import { getAllowedServiceTypeIds } from '../../jobs/job-tasks-helpers.js';
import { loadJobs } from '../../jobs/jobs-store.js';
import { getCurrentUserId, loadServiceTypes } from '../../quick-tasks/quick-tasks-store.js';
import { TaskDrawerShell } from './task-drawer-shell.js';
import { reassignTask } from './task-reassignment-store.js';

const { createElement: h, useMemo, useState } = React;
const { createRoot } = ReactDOM;

let reassignDrawerRoot = null;

const MOVE_OPTIONS = [
  { value: 'deliverable', label: 'Move to another Deliverable' },
  { value: 'job', label: 'Move to another Job' },
];

const TYPE_CHANGE_OPTIONS = [
  { value: 'quick', label: 'Convert to Quick Task' },
  { value: 'job-task', label: 'Convert to Job Task' },
];

function getDrawer() {
  const shell = document.getElementById('app-shell');
  const drawer = document.getElementById('drawer-container');
  if (!drawer || !shell) return null;
  return { shell, drawer };
}

function clearDrawer(drawer) {
  if (reassignDrawerRoot) {
    try {
      reassignDrawerRoot.unmount();
    } catch (e) {
      // Ignore stale roots
    }
    reassignDrawerRoot = null;
  }
  if (drawer) drawer.innerHTML = '';
}

function closeDrawer({ shell, drawer }) {
  shell?.classList.add('drawer-closed');
  clearDrawer(drawer);
}

function showToast(message) {
  if (typeof window !== 'undefined' && typeof window.showToast === 'function') {
    window.showToast(message);
  }
}

function buildDeliverableOptions(jobs = []) {
  const options = [];
  jobs.forEach((job) => {
    (job.deliverables || []).forEach((deliverable) => {
      options.push({
        value: `${job.id}::${deliverable.id}`,
        label: `${job.name || 'Job'} — ${deliverable.name || 'Deliverable'}`,
        jobId: String(job.id),
        deliverableId: String(deliverable.id),
      });
    });
  });
  return options;
}

function parseDeliverableKey(key) {
  const [jobId = '', deliverableId = ''] = String(key || '').split('::');
  return {
    jobId: String(jobId || ''),
    deliverableId: String(deliverableId || ''),
  };
}

function getTaskName(task) {
  return String(task?.title || task?.originalTaskRef?.title || 'Untitled Task');
}

function findJob(jobs = [], jobId = '') {
  return jobs.find((job) => String(job?.id || '') === String(jobId || '')) || null;
}

function findDeliverable(job, deliverableId = '') {
  return (job?.deliverables || []).find((deliverable) => String(deliverable?.id || '') === String(deliverableId || '')) || null;
}

function getPrimaryServiceTypeId(task) {
  const allocations = Array.isArray(task?.originalTaskRef?.allocations) && task.originalTaskRef.allocations.length
    ? task.originalTaskRef.allocations
    : Array.isArray(task?.allocations)
      ? task.allocations
      : [];
  const match = allocations.find((allocation) => allocation?.serviceTypeId);
  return String(match?.serviceTypeId || '');
}

function getTaskAllocations(task) {
  if (Array.isArray(task?.originalTaskRef?.allocations) && task.originalTaskRef.allocations.length) {
    return task.originalTaskRef.allocations;
  }
  return Array.isArray(task?.allocations) ? task.allocations : [];
}

function getSelectClassName({ invalid = false } = {}) {
  return `h-11 rounded-md border bg-white dark:bg-slate-900 px-3 text-sm ${invalid ? 'border-red-300 dark:border-red-500/60 text-red-700 dark:text-red-200 focus:border-red-400' : 'border-slate-200 dark:border-white/10 text-slate-900 dark:text-white'}`;
}

function getActionLabel(destination) {
  if (destination === 'job-task') return 'Convert to Job Task';
  if (destination === 'quick') return 'Convert to Quick Task';
  return 'Move Task';
}

function getValidationMessage(destination, {
  selectedJobId,
  selectedDeliverableKey,
  selectedServiceTypeId,
  serviceTypeMismatch,
  serviceTypeUnavailable,
  noOpMessage,
  quickTaskConversionBlocked,
}) {
  if (noOpMessage) return noOpMessage;
  if (quickTaskConversionBlocked) return 'Quick Task conversion is blocked until this task is simplified.';
  if (destination === 'deliverable' && !selectedDeliverableKey) return 'Select a destination deliverable.';
  if (destination === 'job' && !selectedJobId) return 'Select a destination job.';
  if (destination === 'job' && !selectedDeliverableKey) return 'Select a destination deliverable.';
  if (destination === 'job-task' && !selectedJobId) return 'Select a destination job.';
  if (destination === 'job-task' && !selectedDeliverableKey) return 'Select a destination deliverable.';
  if (serviceTypeUnavailable) return 'Selected deliverable has no available service types yet.';
  if (serviceTypeMismatch && !selectedServiceTypeId) return 'Remap the service type to continue.';
  if (destination === 'job-task' && !selectedServiceTypeId) return 'Select a service type.';
  return '';
}

function ReassignTaskDrawer({ task, onClose }) {
  const jobs = useMemo(() => loadJobs(), []);
  const serviceTypes = useMemo(() => loadServiceTypes().filter((type) => type.active), []);
  const deliverableOptions = useMemo(() => buildDeliverableOptions(jobs), [jobs]);
  const isJobTask = task?.source === 'job';
  const [destination, setDestination] = useState(isJobTask ? 'deliverable' : 'job-task');
  const [selectedJobId, setSelectedJobId] = useState('');
  const [selectedDeliverableKey, setSelectedDeliverableKey] = useState('');
  const [selectedServiceTypeId, setSelectedServiceTypeId] = useState('');
  const [submitError, setSubmitError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const sourceJobId = String(task?.originalTaskRef?.jobId || '');
  const sourceDeliverableId = String(task?.originalTaskRef?.deliverableId || '');
  const taskName = getTaskName(task);
  const currentServiceTypeId = getPrimaryServiceTypeId(task);
  const taskAllocations = useMemo(() => getTaskAllocations(task), [task]);
  const assigneeCount = useMemo(() => (
    new Set(taskAllocations.map((allocation) => String(allocation?.assigneeUserId || '')).filter(Boolean)).size
  ), [taskAllocations]);
  const serviceTypeCount = useMemo(() => (
    new Set(taskAllocations.map((allocation) => String(allocation?.serviceTypeId || '')).filter(Boolean)).size
  ), [taskAllocations]);
  const currentLocationKey = sourceJobId && sourceDeliverableId ? `${sourceJobId}::${sourceDeliverableId}` : '';
  const currentJob = useMemo(() => findJob(jobs, sourceJobId), [jobs, sourceJobId]);
  const currentDeliverable = useMemo(() => findDeliverable(currentJob, sourceDeliverableId), [currentJob, sourceDeliverableId]);
  const currentServiceType = useMemo(() => (
    serviceTypes.find((type) => String(type?.id || '') === currentServiceTypeId) || null
  ), [currentServiceTypeId, serviceTypes]);

  const jobOptions = jobs.map((job) => ({
    value: String(job.id),
    label: job.name || 'Untitled Job',
  }));

  const scopedDeliverables = useMemo(() => {
    if (destination === 'deliverable' && sourceJobId) {
      return deliverableOptions.filter((option) => option.jobId === sourceJobId);
    }
    if (destination === 'job' || destination === 'job-task') {
      return selectedJobId
        ? deliverableOptions.filter((option) => option.jobId === selectedJobId)
        : [];
    }
    return deliverableOptions;
  }, [deliverableOptions, destination, selectedJobId, sourceJobId]);

  const selectedLocation = useMemo(() => parseDeliverableKey(selectedDeliverableKey), [selectedDeliverableKey]);
  const selectedJob = useMemo(() => {
    if (destination === 'deliverable') return findJob(jobs, selectedLocation.jobId || sourceJobId);
    return findJob(jobs, selectedJobId || selectedLocation.jobId);
  }, [destination, jobs, selectedJobId, selectedLocation.jobId, sourceJobId]);
  const selectedDeliverable = useMemo(() => {
    if (!selectedDeliverableKey) return null;
    return findDeliverable(selectedJob, selectedLocation.deliverableId);
  }, [selectedDeliverableKey, selectedJob, selectedLocation.deliverableId]);
  const allowedServiceTypeIds = useMemo(() => (
    selectedDeliverable ? getAllowedServiceTypeIds(selectedDeliverable) : []
  ), [selectedDeliverable]);
  const availableServiceTypes = useMemo(() => (
    serviceTypes.filter((type) => allowedServiceTypeIds.includes(String(type?.id || '')))
  ), [allowedServiceTypeIds, serviceTypes]);
  const needsServiceTypeRemap = Boolean(
    selectedDeliverableKey
    && currentServiceTypeId
    && !allowedServiceTypeIds.includes(currentServiceTypeId)
  );
  const serviceTypeUnavailable = Boolean(
    selectedDeliverableKey
    && (destination === 'job-task' || needsServiceTypeRemap)
    && availableServiceTypes.length < 1
  );
  const noOpMessage = useMemo(() => {
    if (destination === 'quick' && task?.source === 'quick') return 'Task is already in this location.';
    if (!selectedDeliverableKey) return '';
    if (task?.source === 'job' && selectedDeliverableKey === currentLocationKey) {
      return 'Task is already in this location.';
    }
    return '';
  }, [currentLocationKey, destination, selectedDeliverableKey, task?.source]);
  const quickTaskConversionBlocked = destination === 'quick' && (
    assigneeCount > 1 || serviceTypeCount > 1
  );

  const validationMessage = getValidationMessage(destination, {
    selectedJobId,
    selectedDeliverableKey,
    selectedServiceTypeId,
    serviceTypeMismatch: needsServiceTypeRemap,
    serviceTypeUnavailable,
    noOpMessage,
    quickTaskConversionBlocked,
  });
  const effectiveMessage = submitError || validationMessage;
  const isValid = !effectiveMessage;
  const actionLabel = getActionLabel(destination);
  const visibleMoveOptions = isJobTask ? MOVE_OPTIONS : [];
  const visibleTypeOptions = isJobTask
    ? TYPE_CHANGE_OPTIONS.filter((option) => option.value === 'quick')
    : TYPE_CHANGE_OPTIONS.filter((option) => option.value === 'job-task');

  const handleDestinationChange = (nextValue) => {
    setDestination(nextValue);
    setSelectedJobId('');
    setSelectedDeliverableKey('');
    setSelectedServiceTypeId('');
    setSubmitError('');
  };

  const destinationPreview = useMemo(() => {
    if (destination === 'quick') {
      return {
        title: 'Quick Task',
        detail: 'No deliverable required',
      };
    }
    if (!selectedJob && !selectedDeliverable) return null;
    return {
      title: selectedJob?.name || 'Job',
      detail: selectedDeliverable?.name || 'Select deliverable',
    };
  }, [destination, selectedDeliverable, selectedJob]);

  const footer = [
    effectiveMessage
      ? h('div', { key: 'error', className: 'text-xs text-red-500' }, effectiveMessage)
      : h('div', { key: 'note', className: 'text-xs text-slate-500 dark:text-slate-400' }, 'Task moves are live. Invalid destinations are blocked before anything changes.'),
    h('div', {
      key: 'confirm-block',
      className: 'rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-slate-950/40 p-4 space-y-3',
    }, [
      h('div', { className: 'text-sm text-slate-700 dark:text-slate-200' }, 'All time entries, status, and history will move with this task. Nothing will be lost.'),
      h('div', { className: 'text-xs text-slate-500 dark:text-slate-400' }, 'Status and timeline will remain unchanged.'),
      h('div', { className: 'flex items-center justify-end gap-2' }, [
        h('button', {
          type: 'button',
          className: 'inline-flex items-center justify-center h-9 px-4 rounded-md border border-slate-200 dark:border-white/10 text-sm font-semibold text-slate-700 dark:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-800',
          onClick: onClose,
        }, 'Cancel'),
        h('button', {
          type: 'button',
          className: `inline-flex items-center justify-center h-9 px-4 rounded-md text-sm font-semibold ${isValid && !isSubmitting ? 'bg-netnet-purple text-white hover:brightness-110' : 'bg-slate-200 dark:bg-slate-800 text-slate-500 dark:text-slate-400 cursor-not-allowed'}`,
          disabled: !isValid || isSubmitting,
          onClick: () => {
            if (!isValid || isSubmitting) return;
            setIsSubmitting(true);
            setSubmitError('');
            const result = reassignTask({
              taskId: task?.sourceId || task?.id,
              sourceType: task?.source || 'quick',
              destinationType: destination,
              destinationJobId: destination === 'deliverable'
                ? (selectedLocation.jobId || sourceJobId || null)
                : (selectedJobId || selectedLocation.jobId || null),
              destinationDeliverableId: selectedLocation.deliverableId || null,
              remappedServiceTypeId: selectedServiceTypeId || null,
              performedByUserId: getCurrentUserId(),
            });
            setIsSubmitting(false);
            if (!result?.ok) {
              setSubmitError(result?.message || 'Could not move task.');
              return;
            }
            showToast(`${actionLabel} complete.`);
            onClose?.();
          },
        }, actionLabel),
      ]),
    ]),
  ];

  return h(TaskDrawerShell, {
    headerContent: [
      h('div', { key: 'title', className: 'text-lg font-semibold text-slate-900 dark:text-white' }, 'Move Task'),
    ],
    onClose,
    footer,
  }, [
    h('div', {
      className: 'rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-950/40 p-4 space-y-1',
    }, isJobTask ? [
      h('div', { className: 'text-[11px] uppercase tracking-wide text-slate-500 dark:text-slate-400' }, 'Current Location'),
      h('div', { className: 'text-sm font-semibold text-slate-900 dark:text-white truncate' }, currentJob?.name || 'Job'),
      h('div', { className: 'text-sm text-slate-600 dark:text-slate-300 truncate' }, currentDeliverable?.name || 'Deliverable'),
      h('div', { className: 'text-sm text-slate-500 dark:text-slate-400 truncate' }, taskName),
    ] : [
      h('div', { className: 'text-[11px] uppercase tracking-wide text-slate-500 dark:text-slate-400' }, 'Current Location'),
      h('div', { className: 'text-sm font-semibold text-slate-900 dark:text-white truncate' }, 'Quick Task'),
      h('div', { className: 'text-sm text-slate-500 dark:text-slate-400 truncate' }, taskName),
    ]),
    h('p', { className: 'text-sm text-slate-600 dark:text-slate-300' }, 'Choose where this task should go.'),
    visibleMoveOptions.length
      ? h('div', { className: 'rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-slate-950/40 p-4 space-y-4' }, [
        h('div', { className: 'text-[11px] uppercase tracking-wide text-slate-500 dark:text-slate-400' }, 'Move'),
        h('div', { className: 'space-y-2' }, visibleMoveOptions.map((option) => h('label', {
          key: option.value,
          className: 'flex items-start gap-3 rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 px-3 py-3 text-sm text-slate-700 dark:text-slate-200',
        }, [
          h('input', {
            type: 'radio',
            name: 'task-move-destination',
            checked: destination === option.value,
            onChange: () => handleDestinationChange(option.value),
            className: 'mt-0.5 h-4 w-4 border-slate-300 dark:border-white/20 text-netnet-purple focus:ring-netnet-purple',
          }),
          h('span', null, option.label),
        ]))),
      ])
      : null,
    h('div', { className: 'rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-slate-950/40 p-4 space-y-4' }, [
      h('div', { className: 'text-[11px] uppercase tracking-wide text-slate-500 dark:text-slate-400' }, 'Change task type'),
      h('div', { className: 'space-y-2' }, visibleTypeOptions.map((option) => h('label', {
        key: option.value,
        className: 'flex items-start gap-3 rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 px-3 py-3 text-sm text-slate-700 dark:text-slate-200',
      }, [
        h('input', {
          type: 'radio',
          name: 'task-move-destination',
          checked: destination === option.value,
          onChange: () => handleDestinationChange(option.value),
          className: 'mt-0.5 h-4 w-4 border-slate-300 dark:border-white/20 text-netnet-purple focus:ring-netnet-purple',
        }),
        h('span', null, option.label),
      ]))),
    ]),
    destination === 'deliverable'
      ? h('label', { className: 'flex flex-col gap-1 text-sm text-slate-700 dark:text-slate-200' }, [
        h('span', { className: 'text-[11px] uppercase tracking-wide text-slate-500 dark:text-slate-400' }, 'Deliverable'),
        h('select', {
          value: selectedDeliverableKey,
          onChange: (event) => {
            setSelectedDeliverableKey(event.target.value || '');
            setSubmitError('');
          },
          className: getSelectClassName({ invalid: Boolean(validationMessage) && !selectedDeliverableKey }),
        }, [
          h('option', { value: '' }, 'Select deliverable'),
          ...scopedDeliverables.map((option) => h('option', { key: option.value, value: option.value }, option.label)),
        ]),
      ])
      : null,
    destination === 'job' || destination === 'job-task'
      ? h('div', { className: 'grid gap-4' }, [
        h('label', { key: 'job', className: 'flex flex-col gap-1 text-sm text-slate-700 dark:text-slate-200' }, [
          h('span', { className: 'text-[11px] uppercase tracking-wide text-slate-500 dark:text-slate-400' }, 'Job'),
          h('select', {
            value: selectedJobId,
            onChange: (event) => {
              setSelectedJobId(event.target.value || '');
              setSelectedDeliverableKey('');
              setSelectedServiceTypeId('');
              setSubmitError('');
            },
            className: getSelectClassName({ invalid: Boolean(validationMessage) && !selectedJobId }),
          }, [
            h('option', { value: '' }, 'Select job'),
            ...jobOptions.map((option) => h('option', { key: option.value, value: option.value }, option.label)),
          ]),
        ]),
        h('label', { key: 'deliverable', className: 'flex flex-col gap-1 text-sm text-slate-700 dark:text-slate-200' }, [
          h('span', { className: 'text-[11px] uppercase tracking-wide text-slate-500 dark:text-slate-400' }, 'Deliverable'),
          h('select', {
            value: selectedDeliverableKey,
            onChange: (event) => {
              setSelectedDeliverableKey(event.target.value || '');
              setSelectedServiceTypeId('');
              setSubmitError('');
            },
            className: getSelectClassName({ invalid: Boolean(validationMessage) && !selectedDeliverableKey }),
            disabled: !selectedJobId,
          }, [
            h('option', { value: '' }, selectedJobId ? 'Select deliverable' : 'Select job first'),
            ...scopedDeliverables.map((option) => h('option', { key: option.value, value: option.value }, option.label)),
          ]),
        ]),
      ])
      : null,
    destinationPreview
      ? h('div', {
        className: 'rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-950/40 p-4 space-y-1',
      }, [
        h('div', { className: 'text-[11px] uppercase tracking-wide text-slate-500 dark:text-slate-400' }, 'Destination'),
        h('div', { className: 'text-sm font-semibold text-slate-900 dark:text-white' }, destinationPreview.title),
        h('div', { className: 'text-sm text-slate-500 dark:text-slate-400' }, destinationPreview.detail),
      ])
      : null,
    noOpMessage
      ? h('div', {
        className: 'rounded-xl border border-red-200 dark:border-red-500/40 bg-red-50/80 dark:bg-red-500/10 p-4 text-sm text-red-700 dark:text-red-200',
      }, noOpMessage)
      : null,
    quickTaskConversionBlocked
      ? h('div', {
        className: 'rounded-xl border border-red-200 dark:border-red-500/40 bg-red-50/80 dark:bg-red-500/10 p-4 space-y-1 text-sm text-red-700 dark:text-red-200',
      }, [
        h('div', { className: 'font-semibold' }, 'This task cannot be converted to a Quick Task.'),
        h('div', null, 'Quick Tasks require:'),
        h('div', null, 'Exactly one assignee'),
        h('div', null, 'Exactly one service type'),
        h('div', null, 'Please adjust this task before converting.'),
      ])
      : null,
    (destination === 'job-task' || needsServiceTypeRemap)
      ? h('label', { className: 'flex flex-col gap-1 text-sm text-slate-700 dark:text-slate-200' }, [
        h('span', { className: `text-[11px] uppercase tracking-wide ${needsServiceTypeRemap || serviceTypeUnavailable ? 'text-red-500 dark:text-red-300' : 'text-slate-500 dark:text-slate-400'}` }, 'Service Type'),
        needsServiceTypeRemap
          ? h('div', { className: 'text-xs text-red-500 dark:text-red-300' }, 'Select a service type for this task')
          : null,
        h('select', {
          value: selectedServiceTypeId,
          onChange: (event) => {
            setSelectedServiceTypeId(event.target.value || '');
            setSubmitError('');
          },
          className: getSelectClassName({ invalid: needsServiceTypeRemap || serviceTypeUnavailable || (destination === 'job-task' && !selectedServiceTypeId && Boolean(validationMessage)) }),
          disabled: serviceTypeUnavailable || (destination === 'job-task' && !selectedDeliverableKey),
        }, [
          h('option', { value: '' }, destination === 'job-task' && !selectedDeliverableKey ? 'Select deliverable first' : (needsServiceTypeRemap ? 'Remap service type' : 'Select service type')),
          ...(destination === 'job-task' || needsServiceTypeRemap ? availableServiceTypes : serviceTypes)
            .map((type) => h('option', { key: type.id, value: type.id }, type.name)),
        ]),
        needsServiceTypeRemap && currentServiceType
          ? h('div', { className: 'text-xs text-red-500 dark:text-red-300' }, `Current service type "${currentServiceType.name}" is not available in this deliverable.`)
          : null,
        serviceTypeUnavailable
          ? h('div', { className: 'text-xs text-red-500 dark:text-red-300' }, 'This destination needs service types configured before a task can move here.')
          : null,
      ])
      : null,
    destination === 'quick'
      ? h('div', { className: 'rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-950/40 p-4 text-sm text-slate-600 dark:text-slate-300' }, 'No additional fields are required to convert this task into a Quick Task.')
      : null,
  ]);
}

export function openTaskReassignDrawer({ task = null } = {}) {
  const container = getDrawer();
  if (!container) return;
  const { shell, drawer } = container;
  clearDrawer(drawer);
  reassignDrawerRoot = createRoot(drawer);
  const handleClose = () => closeDrawer({ shell, drawer });
  reassignDrawerRoot.render(h(ReassignTaskDrawer, {
    task,
    onClose: handleClose,
  }));
  shell.classList.remove('drawer-closed');
}
