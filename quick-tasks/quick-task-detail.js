import { navigate } from '../router.js';
import { QuickTaskDrawerPanel, buildQuickTaskDrawerInitialDraft } from './quick-task-drawer.js';
import {
  addTimeEntry,
  archiveTask,
  canDeleteTask,
  createQuickTask,
  getCurrentUserId,
  getLocalDateISO,
  getMemberById,
  getTaskById,
  getTaskActualHours,
  getTaskContext,
  getTaskPrimaryAllocation,
  getTaskTotalLoe,
  loadServiceTypes,
  loadTeamMembers,
  promoteToJobTask,
  setTaskStatus,
  updateTask,
  deleteTask,
} from './quick-tasks-store.js';
import { escapeHtml, formatDateLabel, formatHours, renderAvatar } from './quick-tasks-helpers.js';
import { getContactsData, getIndividualsData } from '../contacts/contacts-data.js';

const { createElement: h } = React;
const { createRoot } = ReactDOM;

const MOCK_JOBS = [
  {
    id: 'job_aurora',
    name: 'Aurora Rebrand',
    deliverables: [
      { id: 'deliv_strategy', name: 'Brand Strategy', allowedServiceTypeIds: ['pm', 'design'] },
      { id: 'deliv_web', name: 'Marketing Website', allowedServiceTypeIds: ['design', 'development'] },
    ],
  },
  {
    id: 'job_nimbus',
    name: 'Nimbus Growth Sprint',
    deliverables: [
      { id: 'deliv_campaign', name: 'Campaign Rollout', allowedServiceTypeIds: ['pm', 'design'] },
      { id: 'deliv_automation', name: 'Automation Build', allowedServiceTypeIds: ['development'] },
    ],
  },
];

let quickTaskDrawerRoot = null;
let quickTaskDrawerCloseTimer = null;

function ensureModalLayer(id) {
  let layer = document.getElementById(id);
  if (!layer) {
    layer = document.createElement('div');
    layer.id = id;
    document.body.appendChild(layer);
  }
  return layer;
}

function showToast(message) {
  if (typeof window?.showToast === 'function') {
    window.showToast(message);
  }
}

function showQuickTasksModal({
  title,
  body,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  onConfirm,
  onCancel,
  sizeClass = 'max-w-md',
}) {
  const layer = ensureModalLayer('quick-tasks-modal-layer');
  layer.className = 'fixed inset-0 z-[1200] flex items-center justify-center px-4';
  layer.innerHTML = `
    <div class="absolute inset-0 bg-black/40 backdrop-blur-sm" data-qt-modal-backdrop></div>
    <div class="relative w-full ${sizeClass} rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 shadow-2xl p-6 space-y-4">
      <div class="flex items-start justify-between gap-4">
        <h2 class="text-lg font-semibold text-slate-900 dark:text-white">${escapeHtml(title || '')}</h2>
        <button type="button" class="text-slate-500 hover:text-slate-900 dark:text-white/70 dark:hover:text-white" data-qt-modal-close aria-label="Close modal">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </div>
      <div class="space-y-3 text-sm text-slate-600 dark:text-slate-300" data-qt-modal-body>${body || ''}</div>
      <div class="flex justify-end gap-3">
        <button type="button" class="inline-flex items-center justify-center rounded-md border border-slate-200 dark:border-white/20 px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-800" data-qt-modal-cancel>${escapeHtml(cancelLabel)}</button>
        <button type="button" class="inline-flex items-center justify-center rounded-md bg-netnet-purple text-white px-4 py-2 text-sm font-semibold hover:bg-[#6020df]" data-qt-modal-confirm>${escapeHtml(confirmLabel)}</button>
      </div>
    </div>
  `;

  const cleanup = () => {
    layer.innerHTML = '';
    layer.className = '';
  };

  layer.querySelector('[data-qt-modal-close]')?.addEventListener('click', () => {
    cleanup();
    onCancel?.();
  });
  layer.querySelector('[data-qt-modal-backdrop]')?.addEventListener('click', () => {
    cleanup();
    onCancel?.();
  });
  layer.querySelector('[data-qt-modal-cancel]')?.addEventListener('click', () => {
    cleanup();
    onCancel?.();
  });
  layer.querySelector('[data-qt-modal-confirm]')?.addEventListener('click', () => {
    onConfirm?.(cleanup);
  });

  return cleanup;
}

export function openCompletionDateModal({ initialDate, onConfirm, onCancel } = {}) {
  const today = getLocalDateISO(new Date());
  const defaultDate = initialDate || today;
  const body = `
    <p>Confirm completion date.</p>
    <label class="flex flex-col gap-2 text-sm text-slate-700 dark:text-slate-200">
      Completion date
      <input type="date" id="qtCompletionDate" class="h-10 rounded-md border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-800 px-3" value="${escapeHtml(defaultDate)}" max="${escapeHtml(today)}" />
      <span class="text-xs text-red-500 hidden" id="qtCompletionError">Date cannot be in the future.</span>
    </label>
  `;
  return showQuickTasksModal({
    title: 'Mark as completed',
    body,
    confirmLabel: 'Confirm',
    cancelLabel: 'Cancel',
    onConfirm: (cleanup) => {
      const input = document.getElementById('qtCompletionDate');
      const error = document.getElementById('qtCompletionError');
      const value = input?.value || '';
      if (value && value > today) {
        if (error) error.classList.remove('hidden');
        return;
      }
      cleanup();
      onConfirm?.(value || today);
    },
    onCancel,
  });
}

function showDiscardChangesModal(onConfirm) {
  showQuickTasksModal({
    title: 'Discard changes?',
    body: '<p>Your changes will be lost.</p>',
    confirmLabel: 'Discard',
    cancelLabel: 'Keep editing',
    onConfirm: (cleanup) => {
      cleanup();
      onConfirm?.();
    },
  });
}

export function showMovedToJobModal() {
  showToast('Moved to Job');
  showQuickTasksModal({
    title: 'Moved to Job',
    body: '<p>This task now lives in Jobs.</p>',
    confirmLabel: 'View in Jobs',
    cancelLabel: 'Close',
    onConfirm: (cleanup) => {
      cleanup();
      navigate('#/app/jobs');
    },
  });
}

export function openPromoteToJobTaskModal({ task, serviceTypes, onConfirm } = {}) {
  const options = MOCK_JOBS.map((job) => `<option value="${escapeHtml(job.id)}">${escapeHtml(job.name)}</option>`).join('');
  const body = `
    <div class="space-y-4">
      <div class="space-y-2">
        <p class="text-xs uppercase tracking-wide text-slate-400">Step 1</p>
        <label class="flex flex-col gap-2">
          Job
          <select id="qtJobSelect" class="h-10 rounded-md border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-800 px-3">
            <option value="">Select job</option>
            ${options}
          </select>
        </label>
      </div>
      <div class="space-y-2">
        <p class="text-xs uppercase tracking-wide text-slate-400">Step 2</p>
        <label class="flex flex-col gap-2">
          Deliverable
          <select id="qtDeliverableSelect" class="h-10 rounded-md border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-800 px-3" disabled>
            <option value="">Select deliverable</option>
          </select>
        </label>
      </div>
      <div id="qtRemapWrap" class="hidden space-y-2 rounded-lg border border-amber-200 bg-amber-50/70 dark:bg-amber-500/10 p-3">
        <p class="text-xs text-amber-700 dark:text-amber-200" id="qtRemapNote">This deliverable doesn’t use the selected Service Type. Choose a new Service Type to attach this task.</p>
        <label class="flex flex-col gap-2">
          Service Type
          <select id="qtRemapSelect" class="h-10 rounded-md border border-amber-300 bg-white dark:bg-slate-800 px-3">
            <option value="">Select Service Type</option>
            ${serviceTypes.map((type) => `<option value="${escapeHtml(type.id)}">${escapeHtml(type.name)}</option>`).join('')}
          </select>
        </label>
      </div>
    </div>
  `;

  const cleanup = showQuickTasksModal({
    title: 'Promote to Job Task',
    body,
    confirmLabel: 'Promote',
    cancelLabel: 'Cancel',
    onConfirm: (closeModal) => {
      const jobId = document.getElementById('qtJobSelect')?.value || '';
      const deliverableId = document.getElementById('qtDeliverableSelect')?.value || '';
      const remapValue = document.getElementById('qtRemapSelect')?.value || '';
      if (!jobId || !deliverableId) return;
      const deliverable = MOCK_JOBS.find((job) => job.id === jobId)?.deliverables.find((del) => del.id === deliverableId);
      const needsRemap = deliverable && !deliverable.allowedServiceTypeIds.includes(task.serviceTypeId);
      if (needsRemap && !remapValue) return;
      closeModal();
      onConfirm?.({
        jobId,
        deliverableId,
        serviceTypeId: needsRemap ? remapValue : null,
      });
    },
  });

  const jobSelect = document.getElementById('qtJobSelect');
  const deliverableSelect = document.getElementById('qtDeliverableSelect');
  const remapWrap = document.getElementById('qtRemapWrap');
  const remapSelect = document.getElementById('qtRemapSelect');
  const remapNote = document.getElementById('qtRemapNote');
  const confirmBtn = document.querySelector('[data-qt-modal-confirm]');

  const getServiceTypeName = (id) => serviceTypes.find((type) => String(type.id) === String(id))?.name || 'this Service Type';

  const updateConfirmState = () => {
    const jobId = jobSelect?.value || '';
    const deliverableId = deliverableSelect?.value || '';
    const remapValue = remapSelect?.value || '';
    const deliverable = MOCK_JOBS.find((job) => job.id === jobId)?.deliverables.find((del) => del.id === deliverableId);
    const needsRemap = deliverable && !deliverable.allowedServiceTypeIds.includes(task.serviceTypeId);
    const ready = !!jobId && !!deliverableId && (!needsRemap || !!remapValue);
    if (confirmBtn) {
      confirmBtn.disabled = !ready;
      confirmBtn.classList.toggle('opacity-40', !ready);
      confirmBtn.classList.toggle('cursor-not-allowed', !ready);
    }
  };

  const updateDeliverables = () => {
    const jobId = jobSelect?.value || '';
    const job = MOCK_JOBS.find((item) => item.id === jobId);
    if (!deliverableSelect) return;
    if (!job) {
      deliverableSelect.innerHTML = '<option value="">Select deliverable</option>';
      deliverableSelect.disabled = true;
      remapWrap?.classList.add('hidden');
      remapSelect.value = '';
      return;
    }
    deliverableSelect.disabled = false;
    deliverableSelect.innerHTML = [
      '<option value="">Select deliverable</option>',
      ...job.deliverables.map((del) => `<option value="${escapeHtml(del.id)}">${escapeHtml(del.name)}</option>`),
    ].join('');
    remapWrap?.classList.add('hidden');
    remapSelect.value = '';
  };

  const updateRemap = () => {
    const jobId = jobSelect?.value || '';
    const deliverableId = deliverableSelect?.value || '';
    const deliverable = MOCK_JOBS.find((job) => job.id === jobId)?.deliverables.find((del) => del.id === deliverableId);
    if (!deliverable) {
      remapWrap?.classList.add('hidden');
      remapSelect.value = '';
      updateConfirmState();
      return;
    }
    const needsRemap = !deliverable.allowedServiceTypeIds.includes(task.serviceTypeId);
    remapWrap?.classList.toggle('hidden', !needsRemap);
    if (!needsRemap) remapSelect.value = '';
    if (needsRemap && remapNote) {
      remapNote.textContent = `This deliverable doesn’t use ${getServiceTypeName(task.serviceTypeId)}. Choose a new Service Type to attach this task.`;
    }
    updateConfirmState();
  };

  jobSelect?.addEventListener('change', () => {
    updateDeliverables();
    updateConfirmState();
  });
  deliverableSelect?.addEventListener('change', () => {
    updateRemap();
    updateConfirmState();
  });
  remapSelect?.addEventListener('change', () => {
    updateConfirmState();
  });

  updateConfirmState();

  return cleanup;
}

function findCompanyById(id) {
  return getContactsData().find((company) => String(company.id) === String(id)) || null;
}

function findPersonById(id) {
  if (!id) return null;
  const companies = getContactsData();
  for (const company of companies) {
    const match = (company.people || []).find((person) => String(person.id) === String(id));
    if (match) return { ...match, companyId: company.id, companyName: company.name };
  }
  const individuals = getIndividualsData();
  return individuals.find((person) => String(person.id) === String(id)) || null;
}

function buildInitialTask({ mode, taskId, sourceItem, serviceTypes, members }) {
  if (mode === 'edit' && taskId) {
    const task = getTaskById(taskId);
    if (!task) return null;
    const primaryAllocation = getTaskPrimaryAllocation(task);
    const context = getTaskContext(task);
    return {
      ...task,
      serviceTypeId: primaryAllocation?.serviceTypeId || '',
      loeHours: getTaskTotalLoe(task) || '',
      assigneeUserId: primaryAllocation?.assigneeUserId || '',
      isInternal: context.type === 'internal',
      companyId: context.companyId || null,
      personId: context.personId || null,
    };
  }
  const currentUserId = getCurrentUserId(members);
  const defaultServiceType = serviceTypes.find((type) => type.active)?.id || null;
  return {
    id: null,
    title: sourceItem?.title || '',
    description: sourceItem?.notes || '',
    status: 'in_progress',
    dueDate: '',
    completedAt: null,
    serviceTypeId: defaultServiceType,
    loeHours: '',
    assigneeUserId: currentUserId,
    isInternal: false,
    companyId: null,
    personId: null,
    isArchived: false,
    jobId: null,
    deliverableId: null,
    timeEntries: [],
    sourceListItemId: sourceItem?.id || null,
    sourceListId: sourceItem?.folderId || null,
  };
}

function getDrawer() {
  const shell = document.getElementById('app-shell');
  const drawer = document.getElementById('drawer-container');
  if (!drawer || !shell) return null;
  return { shell, drawer };
}

function closeDrawer() {
  const shell = document.getElementById('app-shell');
  shell?.classList.add('drawer-closed');
}

function clearQuickTaskDrawerRoot(drawer = document.getElementById('drawer-container')) {
  if (quickTaskDrawerCloseTimer) {
    clearTimeout(quickTaskDrawerCloseTimer);
    quickTaskDrawerCloseTimer = null;
  }
  if (quickTaskDrawerRoot) {
    quickTaskDrawerRoot.unmount();
    quickTaskDrawerRoot = null;
  }
  if (drawer) drawer.innerHTML = '';
}

function closeQuickTaskDrawer({ drawer, shell }) {
  if (quickTaskDrawerCloseTimer) {
    clearTimeout(quickTaskDrawerCloseTimer);
    quickTaskDrawerCloseTimer = null;
  }
  shell?.classList.add('drawer-closed');
  quickTaskDrawerCloseTimer = window.setTimeout(() => {
    clearQuickTaskDrawerRoot(drawer);
  }, 260);
}

function serializeFormState({ title, description, serviceTypeId, loeHours, dueDate, assigneeUserId, isInternal, companyId, personId, status, completedAt, deleteSourceItem }) {
  return JSON.stringify({
    title: title || '',
    description: description || '',
    serviceTypeId: serviceTypeId || '',
    loeHours: Number(loeHours) || 0,
    dueDate: dueDate || '',
    assigneeUserId: assigneeUserId || '',
    isInternal: !!isInternal,
    companyId: companyId || '',
    personId: personId || '',
    status: status || '',
    completedAt: completedAt || '',
    deleteSourceItem: deleteSourceItem !== false,
  });
}

function setFieldError(fieldId, message) {
  const field = document.getElementById(fieldId);
  const error = field?.closest('label')?.querySelector('[data-qt-error]');
  if (field) {
    field.classList.toggle('border-red-400', !!message);
    field.classList.toggle('border-slate-300', !message);
    field.classList.toggle('dark:border-white/10', !message);
  }
  if (error) {
    error.textContent = message || '';
    error.classList.toggle('hidden', !message);
  }
}

function renderTimeEntries(task) {
  const entries = Array.isArray(task.timeEntries) ? task.timeEntries : [];
  if (!entries.length) return '<p class="text-xs text-slate-500 dark:text-slate-400">No time logged yet.</p>';
  return entries.map((entry) => `
    <div class="flex items-center justify-between rounded-md border border-slate-200 dark:border-white/10 px-3 py-2 text-xs">
      <span class="text-slate-600 dark:text-slate-300">${formatDateLabel(entry.date)}</span>
      <span class="text-slate-900 dark:text-white font-semibold">${formatHours(entry.hours)}</span>
    </div>
  `).join('');
}

function renderMemberPreview(member) {
  if (!member) {
    return `<span class="text-xs text-slate-400">No selection</span>`;
  }
  return `
    <div class="flex items-center gap-2 relative overflow-hidden">
      ${renderAvatar(member, { sizeClass: 'h-6 w-6', textClass: 'text-[9px]', showTooltip: false })}
      <span class="text-xs text-slate-600 dark:text-slate-300">${escapeHtml(member.name || member.email || '')}</span>
    </div>
  `;
}

function parseISODate(iso) {
  if (!iso) return null;
  const parts = iso.split('-').map((part) => Number(part));
  if (parts.length !== 3 || parts.some((val) => Number.isNaN(val))) return null;
  return { year: parts[0], monthIndex: parts[1] - 1, day: parts[2] };
}

function formatISODate(year, monthIndex, day) {
  const mm = String(monthIndex + 1).padStart(2, '0');
  const dd = String(day).padStart(2, '0');
  return `${year}-${mm}-${dd}`;
}

function formatDisplayDate(iso) {
  const parsed = parseISODate(iso);
  if (!parsed) return '';
  const date = new Date(parsed.year, parsed.monthIndex, parsed.day);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function getMonthLabel(year, monthIndex) {
  const date = new Date(year, monthIndex, 1);
  return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

export function openSingleDatePickerPopover({ anchorEl, value, onSelect, onClear, onClose } = {}) {
  if (!anchorEl) return null;
  const layer = ensureModalLayer('qt-date-picker-layer');
  layer.className = 'fixed inset-0 z-[1100]';
  layer.innerHTML = '';

  const backdrop = document.createElement('div');
  backdrop.className = 'absolute inset-0';
  const popover = document.createElement('div');
  popover.className = 'fixed w-[304px] rounded-xl border border-slate-200 dark:border-white/10 bg-white text-slate-900 shadow-2xl dark:bg-slate-950/90 dark:text-white backdrop-blur-sm p-4 space-y-3';
  popover.setAttribute('role', 'dialog');
  popover.setAttribute('aria-label', 'Choose due date');
  layer.appendChild(backdrop);
  layer.appendChild(popover);

  const todayIso = getLocalDateISO(new Date());
  const initial = parseISODate(value) || parseISODate(todayIso) || { year: new Date().getFullYear(), monthIndex: new Date().getMonth() };
  let viewYear = initial.year;
  let viewMonth = initial.monthIndex;
  let selectedIso = typeof value === 'string' ? value : '';

  const renderCalendar = () => {
    const monthLabel = getMonthLabel(viewYear, viewMonth);
    const firstDay = new Date(viewYear, viewMonth, 1);
    const startDay = firstDay.getDay();
    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
    const weekdayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const cells = [];

    for (let i = 0; i < startDay; i += 1) {
      cells.push('<div class="h-8 w-8"></div>');
    }
    for (let day = 1; day <= daysInMonth; day += 1) {
      const iso = formatISODate(viewYear, viewMonth, day);
      const isSelected = selectedIso && iso === selectedIso;
      const isToday = iso === todayIso;
      const base = 'h-8 w-8 rounded-full text-sm flex items-center justify-center transition-colors';
      const selected = isSelected ? 'bg-netnet-purple text-white' : 'text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/10';
      const today = isToday ? 'ring-1 ring-netnet-purple/50' : '';
      cells.push(`<button type="button" class="${base} ${selected} ${today}" data-qt-date="${iso}">${day}</button>`);
    }

    popover.innerHTML = `
      <div class="flex items-center justify-between">
        <button type="button" class="h-8 w-8 flex items-center justify-center rounded-md border border-slate-200 dark:border-white/10 text-slate-500 dark:text-white/60 hover:bg-slate-100 dark:hover:bg-white/10" data-qt-action="prev" aria-label="Previous month">
          <svg viewBox="0 0 24 24" class="h-4 w-4" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="15 18 9 12 15 6"></polyline>
          </svg>
        </button>
        <div class="text-sm font-semibold">${monthLabel}</div>
        <button type="button" class="h-8 w-8 flex items-center justify-center rounded-md border border-slate-200 dark:border-white/10 text-slate-500 dark:text-white/60 hover:bg-slate-100 dark:hover:bg-white/10" data-qt-action="next" aria-label="Next month">
          <svg viewBox="0 0 24 24" class="h-4 w-4" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="9 18 15 12 9 6"></polyline>
          </svg>
        </button>
      </div>
      <div class="grid grid-cols-7 gap-1 text-[11px] text-slate-500 dark:text-white/50">
        ${weekdayLabels.map((label) => `<div class="text-center">${label}</div>`).join('')}
      </div>
      <div class="grid grid-cols-7 gap-1">${cells.join('')}</div>
      <div class="flex items-center justify-between border-t border-slate-200 dark:border-white/10 pt-3">
        <button type="button" class="text-xs font-semibold text-slate-500 dark:text-white/60 hover:text-slate-700 dark:hover:text-white" data-qt-action="clear">Clear</button>
        <button type="button" class="inline-flex items-center justify-center rounded-md border border-netnet-purple/40 text-netnet-purple px-3 py-1 text-xs font-semibold hover:bg-netnet-purple/10" data-qt-action="today">Today</button>
      </div>
    `;
  };

  const positionPopover = () => {
    const rect = anchorEl.getBoundingClientRect();
    const popoverRect = popover.getBoundingClientRect();
    const padding = 12;
    let left = rect.left;
    let top = rect.bottom + 8;
    if (left + popoverRect.width > window.innerWidth - padding) {
      left = window.innerWidth - padding - popoverRect.width;
    }
    if (left < padding) left = padding;
    if (top + popoverRect.height > window.innerHeight - padding) {
      top = rect.top - popoverRect.height - 8;
    }
    if (top < padding) top = padding;
    popover.style.left = `${left}px`;
    popover.style.top = `${top}px`;
  };

  const close = () => {
    layer.innerHTML = '';
    layer.className = '';
    document.removeEventListener('keydown', handleKeyDown);
    onClose?.();
  };

  const handleKeyDown = (event) => {
    if (event.key === 'Escape') close();
  };

  backdrop.addEventListener('click', close);
  popover.addEventListener('click', (event) => {
    event.stopPropagation();
    const actionBtn = event.target.closest?.('[data-qt-action]');
    if (actionBtn) {
      const action = actionBtn.getAttribute('data-qt-action');
      if (action === 'prev') {
        const date = new Date(viewYear, viewMonth - 1, 1);
        viewYear = date.getFullYear();
        viewMonth = date.getMonth();
        renderCalendar();
        positionPopover();
        return;
      }
      if (action === 'next') {
        const date = new Date(viewYear, viewMonth + 1, 1);
        viewYear = date.getFullYear();
        viewMonth = date.getMonth();
        renderCalendar();
        positionPopover();
        return;
      }
      if (action === 'today') {
        selectedIso = todayIso;
        onSelect?.(todayIso);
        close();
        return;
      }
      if (action === 'clear') {
        selectedIso = '';
        onClear?.();
        close();
      }
    }
    const dayBtn = event.target.closest?.('[data-qt-date]');
    if (dayBtn) {
      const iso = dayBtn.getAttribute('data-qt-date');
      selectedIso = iso;
      onSelect?.(iso);
      close();
    }
  });
  document.addEventListener('keydown', handleKeyDown);

  renderCalendar();
  positionPopover();
  return close;
}

export function openQuickTaskDrawer({
  mode = 'create',
  taskId = null,
  sourceItem = null,
  onCreated,
  onUpdated,
  onDeleted,
} = {}) {
  const container = getDrawer();
  if (!container) return;
  const { shell, drawer } = container;

  const members = loadTeamMembers();
  const serviceTypes = loadServiceTypes().filter((type) => type.active);
  const existingTask = mode === 'edit' && taskId ? getTaskById(taskId) : null;
  const initialDraft = buildQuickTaskDrawerInitialDraft({
    mode,
    taskId,
    sourceItem,
    serviceTypes,
    members,
  });

  if (!initialDraft) return;

  clearQuickTaskDrawerRoot(drawer);
  quickTaskDrawerRoot = createRoot(drawer);

  const finishClose = () => closeQuickTaskDrawer({ drawer, shell });
  const requestClose = ({ dirty } = {}) => {
    if (dirty) {
      showDiscardChangesModal(() => finishClose());
      return;
    }
    finishClose();
  };

  const handleSubmit = ({ payload, deleteSourceItem: shouldDeleteSourceItem }) => {
    if (mode === 'edit' && initialDraft.id) {
      const updated = updateTask(initialDraft.id, payload);
      if (!updated) return;
      showToast('Quick Task updated');
      onUpdated?.(updated);
      finishClose();
      return;
    }

    const created = createQuickTask({
      ...payload,
      sourceListItemId: sourceItem?.id || null,
      sourceListId: sourceItem?.folderId || null,
    });
    showToast('Quick Task created');
    onCreated?.({
      task: created,
      deleteSourceItem: shouldDeleteSourceItem !== false,
    });
    finishClose();
  };

  const handleArchive = () => {
    if (!initialDraft.id) return;
    const updated = archiveTask(initialDraft.id);
    showToast('Quick Task archived');
    onUpdated?.(updated || getTaskById(initialDraft.id));
    finishClose();
  };

  const handleDelete = () => {
    if (!existingTask?.id) return;
    showQuickTasksModal({
      title: 'Delete Quick Task?',
      body: '<p>This will permanently delete the task.</p>',
      confirmLabel: 'Delete',
      cancelLabel: 'Cancel',
      onConfirm: (cleanup) => {
        cleanup();
        const result = deleteTask(existingTask.id);
        if (!result.ok) {
          showToast(result.reason);
          return;
        }
        showToast('Quick Task deleted');
        onDeleted?.(existingTask);
        finishClose();
      },
    });
  };

  const handleToggleComplete = () => {
    if (!existingTask?.id) return;
    if (existingTask.status === 'completed') {
      const updated = setTaskStatus(existingTask.id, 'backlog');
      showToast('Quick Task reopened');
      onUpdated?.(updated);
      finishClose();
      return;
    }

    openCompletionDateModal({
      initialDate: getLocalDateISO(new Date()),
      onConfirm: (date) => {
        const updated = setTaskStatus(existingTask.id, 'completed', { completedAt: date });
        showToast('Quick Task completed');
        onUpdated?.(updated);
        finishClose();
      },
    });
  };

  quickTaskDrawerRoot.render(h(QuickTaskDrawerPanel, {
    mode,
    initialDraft,
    members,
    serviceTypes,
    canDelete: canDeleteTask(existingTask),
    showDeleteSourceToggle: !!sourceItem,
    onClose: requestClose,
    onSubmit: handleSubmit,
    onDelete: handleDelete,
    onArchive: handleArchive,
    onToggleComplete: handleToggleComplete,
  }));

  shell.classList.remove('drawer-closed');
}
