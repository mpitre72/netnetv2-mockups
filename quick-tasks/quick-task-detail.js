import { navigate } from '../router.js';
import { mountCompanyLookup } from '../contacts/company-lookup.js';
import { mountPersonLookup } from '../contacts/person-lookup.js';
import {
  addTimeEntry,
  archiveTask,
  canDeleteTask,
  createQuickTask,
  getCurrentUser,
  getCurrentUserId,
  getLocalDateISO,
  getMemberById,
  getTaskById,
  getTaskActualHours,
  loadServiceTypes,
  loadTeamMembers,
  promoteToJobTask,
  setTaskStatus,
  updateTask,
  deleteTask,
} from './quick-tasks-store.js';
import { escapeHtml, formatDateLabel, formatHours, renderAvatar } from './quick-tasks-helpers.js';
import { getContactsData, getIndividualsData } from '../contacts/contacts-data.js';

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
    return task ? { ...task } : null;
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
    assignorUserId: currentUserId,
    isInternal: true,
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

function serializeFormState({ title, description, serviceTypeId, loeHours, dueDate, assigneeUserId, assignorUserId, isInternal, companyId, personId, status, completedAt, deleteSourceItem }) {
  return JSON.stringify({
    title: title || '',
    description: description || '',
    serviceTypeId: serviceTypeId || '',
    loeHours: Number(loeHours) || 0,
    dueDate: dueDate || '',
    assigneeUserId: assigneeUserId || '',
    assignorUserId: assignorUserId || '',
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

function openSingleDatePickerPopover({ anchorEl, value, onSelect, onClear, onClose } = {}) {
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
  const hasServiceTypes = serviceTypes.length > 0;
  const task = buildInitialTask({ mode, taskId, sourceItem, serviceTypes, members });
  if (!task) return;

  const showTaskTypeToggle = mode === 'create' && !!sourceItem;
  let taskType = 'quick';

  let selectedCompany = task.companyId ? findCompanyById(task.companyId) : null;
  let selectedPerson = task.personId ? findPersonById(task.personId) : null;
  let deleteSourceItem = true;

  const currentUser = getCurrentUser(members);

  const serviceTypeOptions = serviceTypes.map((type) => `
    <option value="${escapeHtml(type.id)}" ${type.id === task.serviceTypeId ? 'selected' : ''}>${escapeHtml(type.name)}</option>
  `).join('');

  const memberOptions = members.map((member) => `
    <option value="${escapeHtml(member.id)}">${escapeHtml(member.name || member.email || 'Member')}</option>
  `).join('');

  drawer.innerHTML = `
    <div id="app-drawer-backdrop"></div>
    <aside id="app-drawer" class="bg-white dark:bg-slate-900 text-slate-900 dark:text-white p-0 flex flex-col w-full max-w-md h-full">
      <div class="flex items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-white/10">
        <div>
          <p class="text-[11px] uppercase tracking-wide text-slate-500 dark:text-white/60">${mode === 'edit' ? 'Edit Task' : 'Create Task'}</p>
          <h2 class="text-lg font-semibold">${mode === 'edit' ? 'Quick Task' : 'New Quick Task'}</h2>
        </div>
        <button type="button" id="drawerCloseBtn" class="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800" aria-label="Close quick task">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </div>
      <div class="p-4 pb-20 space-y-5 text-sm flex-1 overflow-y-auto" data-scrollable="true">
        ${showTaskTypeToggle ? `
          <div class="inline-flex rounded-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-white/10 p-1" id="qtTaskTypeToggle">
            <button type="button" data-qt-task-type="quick" class="px-3 py-1 rounded-full text-sm font-semibold bg-white dark:bg-slate-700 shadow border border-slate-200 dark:border-white/10">Quick Task</button>
            <button type="button" data-qt-task-type="job" class="px-3 py-1 rounded-full text-sm font-semibold text-slate-600 dark:text-white/70">Job Task</button>
          </div>
        ` : ''}
        <div data-qt-panel="quick" class="space-y-5">
          <div class="space-y-2">
          <div class="text-xs uppercase tracking-wide text-slate-500 dark:text-white/60">Status</div>
          <div class="inline-flex rounded-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-white/10 p-1" id="qtStatusPicker">
            <button type="button" data-qt-status="backlog" class="px-3 py-1 rounded-full text-sm font-semibold ${task.status === 'backlog' ? 'bg-white dark:bg-slate-700 shadow border border-slate-200 dark:border-white/10' : 'text-slate-600 dark:text-white/70'}">Backlog</button>
            <button type="button" data-qt-status="in_progress" class="px-3 py-1 rounded-full text-sm font-semibold ${task.status === 'in_progress' ? 'bg-white dark:bg-slate-700 shadow border border-slate-200 dark:border-white/10' : 'text-slate-600 dark:text-white/70'}">In Progress</button>
            <button type="button" data-qt-status="completed" class="px-3 py-1 rounded-full text-sm font-semibold ${task.status === 'completed' ? 'bg-white dark:bg-slate-700 shadow border border-slate-200 dark:border-white/10' : 'text-slate-600 dark:text-white/70'}">Completed</button>
          </div>
          <p id="qtCompletedAt" class="text-xs text-slate-500 dark:text-slate-400 ${task.completedAt ? '' : 'hidden'}">Completed on ${task.completedAt ? formatDateLabel(task.completedAt) : ''}</p>
        </div>

        <label class="flex flex-col gap-1">
          <div class="flex items-center justify-between">
            <span>Title</span>
            <span class="text-[11px] uppercase tracking-wide text-slate-400">Required</span>
          </div>
          <input id="qtTitle" name="title" class="rounded-lg border border-slate-300 dark:border-white/10 bg-white dark:bg-slate-900 px-3 py-2 text-sm" value="${escapeHtml(task.title || '')}" />
          <span class="text-xs text-red-500 hidden" data-qt-error></span>
        </label>

        <label class="flex flex-col gap-1">
          Description
          <textarea id="qtDescription" rows="4" class="rounded-lg border border-slate-300 dark:border-white/10 bg-white dark:bg-slate-900 px-3 py-2 text-sm">${escapeHtml(task.description || '')}</textarea>
        </label>

        <div class="grid grid-cols-2 gap-3">
          <label class="flex flex-col gap-1">
            <div class="flex items-center justify-between">
              <span>Service Type</span>
              <span class="text-[11px] uppercase tracking-wide text-slate-400">Required</span>
            </div>
            <select id="qtServiceType" class="h-10 rounded-lg border border-slate-300 dark:border-white/10 bg-white dark:bg-slate-900 px-3 text-sm" ${hasServiceTypes ? '' : 'disabled'}>
              <option value="">Select service type</option>
              ${serviceTypeOptions}
            </select>
            <span class="text-xs text-red-500 hidden" data-qt-error></span>
          </label>
          <label class="flex flex-col gap-1">
            <div class="flex items-center justify-between">
              <span>LOE (hours)</span>
              <span class="text-[11px] uppercase tracking-wide text-slate-400">Required</span>
            </div>
            <input id="qtLoe" type="number" min="0" step="0.25" class="rounded-lg border border-slate-300 dark:border-white/10 bg-white dark:bg-slate-900 px-3 py-2 text-sm" value="${escapeHtml(task.loeHours || '')}" />
            <span class="text-xs text-red-500 hidden" data-qt-error></span>
          </label>
        </div>

        <div class="grid grid-cols-2 gap-3">
          <label class="flex flex-col gap-1">
            <div class="flex items-center justify-between">
              <span>Assignee</span>
              <span class="text-[11px] uppercase tracking-wide text-slate-400">Required</span>
            </div>
            <select id="qtAssignee" class="h-10 rounded-lg border border-slate-300 dark:border-white/10 bg-white dark:bg-slate-900 px-3 text-sm">
              <option value="">Select assignee</option>
              ${memberOptions}
            </select>
            <span class="text-xs text-red-500 hidden" data-qt-error></span>
            <div id="qtAssigneePreview" class="pt-1"></div>
          </label>
          <label class="flex flex-col gap-1">
            Assignor
            <select id="qtAssignor" class="h-10 rounded-lg border border-slate-300 dark:border-white/10 bg-white dark:bg-slate-900 px-3 text-sm">
              <option value="">Select assignor</option>
              ${memberOptions}
            </select>
            <div id="qtAssignorPreview" class="pt-1"></div>
          </label>
        </div>

        <div class="grid grid-cols-2 gap-3">
          <label class="flex flex-col gap-1">
            <div class="flex items-center justify-between">
              <span>Due date</span>
              <span class="text-[11px] uppercase tracking-wide text-slate-400">Required</span>
            </div>
            <div class="relative">
            <input id="qtDueDate" type="hidden" value="${escapeHtml(task.dueDate || '')}" />
            <div class="relative">
              <input id="qtDueDateDisplay" type="text" readonly class="h-10 w-full rounded-lg border border-slate-300 dark:border-white/10 bg-white dark:bg-slate-900 px-3 py-2 text-sm pr-10" placeholder="Select date" />
              <button type="button" id="qtDuePickerBtn" class="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400 hover:text-slate-600 dark:text-slate-400 dark:hover:text-slate-200" aria-label="Open calendar">
                <svg viewBox="0 0 24 24" class="h-5 w-5" fill="none" stroke="currentColor" stroke-width="2">
                  <rect x="3" y="4" width="18" height="18" rx="2"></rect>
                  <line x1="16" y1="2" x2="16" y2="6"></line>
                  <line x1="8" y1="2" x2="8" y2="6"></line>
                  <line x1="3" y1="10" x2="21" y2="10"></line>
                </svg>
              </button>
            </div>
            <span class="text-xs text-red-500 hidden" data-qt-error></span>
          </label>
          <div class="flex flex-col gap-1">
            <div class="flex items-center justify-between">
              <span>Anchor</span>
              <span class="text-[11px] uppercase tracking-wide text-slate-400">Required</span>
            </div>
            <div class="inline-flex rounded-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-white/10 p-1">
              <button type="button" data-qt-anchor="internal" class="px-3 py-1 rounded-full text-sm font-semibold ${task.isInternal ? 'bg-white dark:bg-slate-700 shadow border border-slate-200 dark:border-white/10' : 'text-slate-600 dark:text-white/70'}">Internal</button>
              <button type="button" data-qt-anchor="client" class="px-3 py-1 rounded-full text-sm font-semibold ${!task.isInternal ? 'bg-white dark:bg-slate-700 shadow border border-slate-200 dark:border-white/10' : 'text-slate-600 dark:text-white/70'}">Client</button>
            </div>
            <span class="text-xs text-red-500 hidden" id="qtAnchorError"></span>
          </div>
        </div>

        <div id="qtClientBlock" class="space-y-3 ${task.isInternal ? 'hidden' : ''}">
          <div class="text-xs uppercase tracking-wide text-slate-500 dark:text-white/60">Client</div>
          <div id="qtCompanyLookup"></div>
          <div id="qtPersonLookup"></div>
          <p class="text-xs text-slate-500 dark:text-slate-400">Company required. Person optional.</p>
          <p class="text-xs text-red-500 hidden" id="qtCompanyError"></p>
        </div>

        ${!hasServiceTypes ? `
          <div class="rounded-lg border border-amber-200 bg-amber-50 text-amber-800 p-3 text-xs">
            No active service types. Add one in <a class="underline" href="#/app/settings/service-types">Settings → Service Types</a>.
          </div>
        ` : ''}

        ${mode === 'edit'
          ? `
            <div class="rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 p-4 space-y-3">
              <div class="flex items-center justify-between">
                <div class="text-xs uppercase tracking-wide text-slate-500 dark:text-white/60">Time Entries</div>
                <div class="text-xs text-slate-600 dark:text-slate-300" id="qtActualHours">Actual ${formatHours(getTaskActualHours(task))}</div>
              </div>
              <div id="qtTimeEntries" class="space-y-2">${renderTimeEntries(task)}</div>
              <div class="grid grid-cols-2 gap-3">
                <label class="flex flex-col gap-1">
                  Date
                  <input id="qtLogDate" type="date" class="h-9 rounded-lg border border-slate-300 dark:border-white/10 bg-white dark:bg-slate-900 px-2 text-sm" value="${escapeHtml(getLocalDateISO(new Date()))}" />
                </label>
                <label class="flex flex-col gap-1">
                  Hours
                  <input id="qtLogHours" type="number" min="0" step="0.25" class="h-9 rounded-lg border border-slate-300 dark:border-white/10 bg-white dark:bg-slate-900 px-2 text-sm" placeholder="0.5" />
                </label>
              </div>
              <button type="button" id="qtLogTimeBtn" class="inline-flex items-center justify-center rounded-md border border-slate-200 dark:border-white/10 px-3 py-2 text-xs font-semibold text-slate-700 dark:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-800">Log time</button>
            </div>
          `
          : `
            <div class="rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 p-4"></div>
          `}

        ${mode === 'edit' ? `
          <button type="button" id="qtPromoteBtn" class="inline-flex items-center justify-center rounded-md border border-slate-200 dark:border-white/10 px-3 py-2 text-xs font-semibold text-slate-700 dark:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-800">Promote to Job Task</button>
        ` : ''}

        ${sourceItem ? `
          <label class="flex items-center justify-between rounded-lg border border-slate-200 dark:border-white/10 px-3 py-2">
            <span class="text-sm">Delete list item after creating task</span>
            <input id="qtDeleteSourceToggle" type="checkbox" class="h-4 w-4" checked />
          </label>
        ` : ''}
        </div>
        ${showTaskTypeToggle ? `
          <div data-qt-panel="job" class="hidden space-y-4">
            <div class="rounded-lg border border-amber-200 bg-amber-50 text-amber-800 p-3 text-xs dark:bg-amber-500/10 dark:text-amber-200">
              Job Tasks will be enabled once Jobs is shipped.
            </div>
            <label class="flex flex-col gap-1">
              Job
              <input type="text" class="h-10 rounded-lg border border-slate-300 dark:border-white/10 bg-white dark:bg-slate-900 px-3 text-sm" placeholder="Select job (coming soon)" />
            </label>
            <label class="flex flex-col gap-1">
              Deliverable
              <input type="text" class="h-10 rounded-lg border border-slate-300 dark:border-white/10 bg-white dark:bg-slate-900 px-3 text-sm" placeholder="Select deliverable (coming soon)" />
            </label>
            <label class="flex flex-col gap-1">
              Assignee
              <input type="text" class="h-10 rounded-lg border border-slate-300 dark:border-white/10 bg-white dark:bg-slate-900 px-3 text-sm" placeholder="Select assignee (coming soon)" />
            </label>
            <label class="flex flex-col gap-1">
              Due date
              <input type="text" class="h-10 rounded-lg border border-slate-300 dark:border-white/10 bg-white dark:bg-slate-900 px-3 text-sm" placeholder="Select date (coming soon)" />
            </label>
            <label class="flex flex-col gap-1">
              Estimated hours
              <input type="number" min="0" step="0.25" class="h-10 rounded-lg border border-slate-300 dark:border-white/10 bg-white dark:bg-slate-900 px-3 text-sm" placeholder="0" />
            </label>
          </div>
        ` : ''}
      </div>
      <div class="p-4 border-t border-slate-200 dark:border-white/10 flex flex-col gap-3">
        <p id="qtSaveHint" class="text-xs text-slate-500 dark:text-slate-400 hidden">Complete required fields to save.</p>
        <p id="qtJobHint" class="text-xs text-amber-700 dark:text-amber-300 hidden">Job Tasks will be enabled once Jobs is shipped.</p>
        <div class="flex items-center justify-between gap-3">
        <div class="flex items-center gap-2">
          ${mode === 'edit' && !task.isArchived ? `
            <button type="button" id="qtArchiveBtn" class="px-3 py-2 rounded-md border border-slate-200 dark:border-white/10 text-xs text-slate-600 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800">Archive</button>
          ` : ''}
          ${mode === 'edit' && canDeleteTask(task) ? `
            <button type="button" id="qtDeleteBtn" class="px-3 py-2 rounded-md border border-red-200 text-xs text-red-600 hover:bg-red-50">Delete</button>
          ` : ''}
        </div>
        <div class="flex items-center gap-2">
          ${mode === 'edit' ? `
            <button type="button" id="qtCompleteBtn" class="px-3 py-2 rounded-md border border-slate-200 dark:border-white/10 text-xs text-slate-700 dark:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-800">${task.status === 'completed' ? 'Reopen' : 'Mark Completed'}</button>
          ` : ''}
          <button type="button" id="qtCancelBtn" class="px-3 py-2 rounded-md border border-slate-200 dark:border-white/10 text-xs">Cancel</button>
          <button type="button" id="qtSaveBtn" class="px-3 py-2 rounded-md bg-netnet-purple text-white text-xs font-semibold hover:bg-[#6020df]" ${hasServiceTypes ? '' : 'disabled'}>${mode === 'edit' ? 'Save' : 'Create'}</button>
        </div>
        </div>
      </div>
    </aside>
  `;

  shell.classList.remove('drawer-closed');

  const titleInput = drawer.querySelector('#qtTitle');
  const descInput = drawer.querySelector('#qtDescription');
  const serviceTypeInput = drawer.querySelector('#qtServiceType');
  const loeInput = drawer.querySelector('#qtLoe');
  const assigneeInput = drawer.querySelector('#qtAssignee');
  const assignorInput = drawer.querySelector('#qtAssignor');
  const dueInput = drawer.querySelector('#qtDueDate');
  const dueDisplayInput = drawer.querySelector('#qtDueDateDisplay');
  const duePickerBtn = drawer.querySelector('#qtDuePickerBtn');
  const clientBlock = drawer.querySelector('#qtClientBlock');
  const companyError = drawer.querySelector('#qtCompanyError');
  const anchorError = drawer.querySelector('#qtAnchorError');
  const deleteToggle = drawer.querySelector('#qtDeleteSourceToggle');
  const assigneePreview = drawer.querySelector('#qtAssigneePreview');
  const assignorPreview = drawer.querySelector('#qtAssignorPreview');
  const saveBtn = drawer.querySelector('#qtSaveBtn');
  const saveHint = drawer.querySelector('#qtSaveHint');
  const jobHint = drawer.querySelector('#qtJobHint');
  const statusButtons = drawer.querySelectorAll('[data-qt-status]');
  const completedAtLabel = drawer.querySelector('#qtCompletedAt');
  const completeBtn = drawer.querySelector('#qtCompleteBtn');
  const taskTypeButtons = drawer.querySelectorAll('[data-qt-task-type]');
  const quickPanel = drawer.querySelector('[data-qt-panel="quick"]');
  const jobPanel = drawer.querySelector('[data-qt-panel="job"]');

  if (assigneeInput && task.assigneeUserId) assigneeInput.value = task.assigneeUserId;
  if (assignorInput && task.assignorUserId) assignorInput.value = task.assignorUserId;

  const snapshotBase = serializeFormState({
    title: task.title,
    description: task.description,
    serviceTypeId: task.serviceTypeId,
    loeHours: task.loeHours,
    dueDate: task.dueDate,
    assigneeUserId: task.assigneeUserId,
    assignorUserId: task.assignorUserId,
    isInternal: task.isInternal,
    companyId: task.companyId,
    personId: task.personId,
    status: task.status,
    completedAt: task.completedAt,
    deleteSourceItem,
  });

  const updateMemberPreview = (targetEl, memberId) => {
    if (!targetEl) return;
    const member = getMemberById(memberId, members);
    targetEl.innerHTML = renderMemberPreview(member);
  };

  const getRequiredState = () => {
    const title = titleInput?.value.trim() || '';
    const serviceTypeId = serviceTypeInput?.value || '';
    const loeValue = Number(loeInput?.value);
    const assigneeId = assigneeInput?.value || '';
    const dueDate = dueInput?.value || '';
    const companyOk = task.isInternal || !!selectedCompany;
    const ready = !!title && !!serviceTypeId && Number.isFinite(loeValue) && loeValue > 0 && !!assigneeId && !!dueDate && companyOk;
    return { ready };
  };

  const updateSaveState = () => {
    const isJobMode = showTaskTypeToggle && taskType === 'job';
    const ready = !isJobMode && getRequiredState().ready && hasServiceTypes;
    if (saveBtn) {
      saveBtn.disabled = !ready;
      saveBtn.classList.toggle('opacity-40', !ready);
      saveBtn.classList.toggle('cursor-not-allowed', !ready);
    }
    if (saveHint) {
      saveHint.classList.toggle('hidden', ready || isJobMode);
    }
    if (jobHint) {
      jobHint.classList.toggle('hidden', !isJobMode);
    }
  };

  const setTaskType = (value) => {
    taskType = value === 'job' ? 'job' : 'quick';
    taskTypeButtons.forEach((btn) => {
      const active = btn.getAttribute('data-qt-task-type') === taskType;
      btn.classList.toggle('bg-white', active);
      btn.classList.toggle('dark:bg-slate-700', active);
      btn.classList.toggle('shadow', active);
      btn.classList.toggle('border', active);
      btn.classList.toggle('border-slate-200', active);
      btn.classList.toggle('text-slate-600', !active);
      btn.classList.toggle('dark:text-white/70', !active);
    });
    if (quickPanel) quickPanel.classList.toggle('hidden', taskType !== 'quick');
    if (jobPanel) jobPanel.classList.toggle('hidden', taskType !== 'job');
    updateSaveState();
  };

  const syncStatusUI = () => {
    statusButtons.forEach((btn) => {
      const value = btn.getAttribute('data-qt-status');
      const active = value === task.status;
      btn.classList.toggle('bg-white', active);
      btn.classList.toggle('dark:bg-slate-700', active);
      btn.classList.toggle('shadow', active);
      btn.classList.toggle('border', active);
      btn.classList.toggle('border-slate-200', active);
      btn.classList.toggle('text-slate-600', !active);
      btn.classList.toggle('dark:text-white/70', !active);
    });
    if (completedAtLabel) {
      completedAtLabel.classList.toggle('hidden', !task.completedAt);
      completedAtLabel.textContent = task.completedAt ? `Completed on ${formatDateLabel(task.completedAt)}` : '';
    }
    if (completeBtn) {
      completeBtn.textContent = task.status === 'completed' ? 'Reopen' : 'Mark Completed';
    }
  };

  const setStatus = (nextStatus, completedAt = null) => {
    task.status = nextStatus;
    task.completedAt = completedAt;
    syncStatusUI();
    updateSaveState();
  };

  const setDueDateValue = (iso) => {
    if (dueInput) dueInput.value = iso || '';
    if (dueDisplayInput) dueDisplayInput.value = iso ? formatDisplayDate(iso) : '';
    setFieldError('qtDueDateDisplay', '');
    updateSaveState();
  };

  let duePickerCleanup = null;
  const openDueDatePicker = () => {
    if (!dueDisplayInput) return;
    if (duePickerCleanup) duePickerCleanup();
    duePickerCleanup = openSingleDatePickerPopover({
      anchorEl: dueDisplayInput,
      value: dueInput?.value || '',
      onSelect: (iso) => setDueDateValue(iso),
      onClear: () => setDueDateValue(''),
      onClose: () => {
        duePickerCleanup = null;
      },
    });
  };

  const renderContactResolver = () => {
    const companySlot = drawer.querySelector('#qtCompanyLookup');
    const personSlot = drawer.querySelector('#qtPersonLookup');
    if (!companySlot || !personSlot) return;
    companySlot.innerHTML = '';
    personSlot.innerHTML = '';
    let personLookupApi = null;

    const setCompany = (company) => {
      selectedCompany = company ? findCompanyById(company.id) || company : null;
      if (!company) selectedPerson = null;
      personLookupApi?.setCompany(selectedCompany);
      personLookupApi?.setValue(null);
      updateSaveState();
    };

    const setPerson = (person, meta) => {
      selectedPerson = person ? findPersonById(person.id) || person : null;
      if (meta?.companyCreated && !selectedCompany) {
        selectedCompany = meta.companyCreated;
        renderCompanyLookup(selectedCompany);
        personLookupApi?.setCompany(selectedCompany);
      }
      updateSaveState();
    };

    const renderCompanyLookup = (value) => {
      mountCompanyLookup(companySlot, {
        label: 'Company (required)',
        placeholder: 'Search companies...',
        value,
        onChange: (company) => setCompany(company),
      });
    };

    renderCompanyLookup(selectedCompany);
    personLookupApi = mountPersonLookup(personSlot, {
      label: 'Person (optional)',
      placeholder: 'Search people...',
      value: selectedPerson,
      company: selectedCompany,
      onChange: (person, meta) => setPerson(person, meta),
    });
  };

  renderContactResolver();

  const setAnchor = (value) => {
    const isInternal = value === 'internal';
    task.isInternal = isInternal;
    drawer.querySelectorAll('[data-qt-anchor]').forEach((btn) => {
      const active = btn.getAttribute('data-qt-anchor') === value;
      btn.classList.toggle('bg-white', active);
      btn.classList.toggle('dark:bg-slate-700', active);
      btn.classList.toggle('shadow', active);
      btn.classList.toggle('border', active);
      btn.classList.toggle('border-slate-200', active);
      btn.classList.toggle('text-slate-600', !active);
      btn.classList.toggle('dark:text-white/70', !active);
    });
    if (clientBlock) clientBlock.classList.toggle('hidden', isInternal);
    if (isInternal) {
      selectedCompany = null;
      selectedPerson = null;
      renderContactResolver();
    }
    updateSaveState();
  };

  drawer.querySelectorAll('[data-qt-anchor]').forEach((btn) => {
    btn.addEventListener('click', () => {
      setAnchor(btn.getAttribute('data-qt-anchor'));
    });
  });

  assigneeInput?.addEventListener('change', () => {
    if (assignorInput && currentUser?.id) {
      assignorInput.value = currentUser.id;
      updateMemberPreview(assignorPreview, currentUser.id);
    }
    updateMemberPreview(assigneePreview, assigneeInput.value);
    updateSaveState();
  });

  assignorInput?.addEventListener('change', () => {
    updateMemberPreview(assignorPreview, assignorInput.value);
    updateSaveState();
  });

  titleInput?.addEventListener('input', updateSaveState);
  serviceTypeInput?.addEventListener('change', updateSaveState);
  loeInput?.addEventListener('input', updateSaveState);
  dueDisplayInput?.addEventListener('click', openDueDatePicker);
  duePickerBtn?.addEventListener('click', openDueDatePicker);

  taskTypeButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      setTaskType(btn.getAttribute('data-qt-task-type'));
    });
  });

  statusButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      const nextStatus = btn.getAttribute('data-qt-status') || 'backlog';
      if (nextStatus === task.status) return;
      if (nextStatus === 'completed') {
        const previousStatus = task.status;
        openCompletionDateModal({
          onConfirm: (date) => {
            setStatus('completed', date);
          },
          onCancel: () => {
            task.status = previousStatus;
            syncStatusUI();
          },
        });
        return;
      }
      setStatus(nextStatus, null);
    });
  });

  const validate = () => {
    let valid = true;
    const title = titleInput?.value.trim() || '';
    if (!title) {
      setFieldError('qtTitle', 'Title is required.');
      valid = false;
    } else {
      setFieldError('qtTitle', '');
    }

    if (!serviceTypeInput?.value) {
      setFieldError('qtServiceType', 'Service Type is required.');
      valid = false;
    } else {
      setFieldError('qtServiceType', '');
    }

    const loeValue = Number(loeInput?.value);
    if (!Number.isFinite(loeValue) || loeValue <= 0) {
      setFieldError('qtLoe', 'LOE must be greater than 0.');
      valid = false;
    } else {
      setFieldError('qtLoe', '');
    }

    if (!assigneeInput?.value) {
      setFieldError('qtAssignee', 'Assignee is required.');
      valid = false;
    } else {
      setFieldError('qtAssignee', '');
    }

    if (!dueInput?.value) {
      setFieldError('qtDueDateDisplay', 'Due date is required.');
      valid = false;
    } else {
      setFieldError('qtDueDateDisplay', '');
    }

    if (!task.isInternal && !selectedCompany) {
      if (companyError) {
        companyError.textContent = 'Company is required for Client anchor.';
        companyError.classList.remove('hidden');
      }
      valid = false;
    } else if (companyError) {
      companyError.textContent = '';
      companyError.classList.add('hidden');
    }

    if (!task.isInternal && !selectedCompany) {
      anchorError?.classList.remove('hidden');
      if (anchorError) anchorError.textContent = 'Client anchor requires a company.';
    } else {
      anchorError?.classList.add('hidden');
      if (anchorError) anchorError.textContent = '';
    }

    return valid;
  };

  const collectForm = () => ({
    title: titleInput?.value.trim() || '',
    description: descInput?.value.trim() || '',
    serviceTypeId: serviceTypeInput?.value || '',
    loeHours: Number(loeInput?.value) || 0,
    assigneeUserId: assigneeInput?.value || '',
    assignorUserId: assignorInput?.value || '',
    dueDate: dueInput?.value || '',
    status: task.status,
    completedAt: task.completedAt || null,
    isInternal: task.isInternal,
    companyId: task.isInternal ? null : selectedCompany?.id || null,
    personId: task.isInternal ? null : selectedPerson?.id || null,
  });

  const isDirty = () => {
    const form = collectForm();
    deleteSourceItem = deleteToggle ? deleteToggle.checked : deleteSourceItem;
    const currentSnapshot = serializeFormState({ ...form, deleteSourceItem });
    return currentSnapshot !== snapshotBase;
  };

  const tryClose = () => {
    if (isDirty()) {
      showDiscardChangesModal(() => closeDrawer());
      return;
    }
    closeDrawer();
  };

  drawer.querySelector('#drawerCloseBtn')?.addEventListener('click', tryClose);
  drawer.querySelector('#qtCancelBtn')?.addEventListener('click', tryClose);
  drawer.querySelector('#app-drawer-backdrop')?.addEventListener('click', tryClose);

  updateMemberPreview(assigneePreview, assigneeInput?.value);
  updateMemberPreview(assignorPreview, assignorInput?.value);
  setDueDateValue(dueInput?.value || '');
  syncStatusUI();
  if (showTaskTypeToggle) setTaskType('quick');

  drawer.querySelector('#qtSaveBtn')?.addEventListener('click', () => {
    if (showTaskTypeToggle && taskType === 'job') {
      showToast('Job Tasks are coming soon.');
      return;
    }
    if (!validate()) return;
    const form = collectForm();
    if (mode === 'edit') {
      const updated = updateTask(task.id, {
        ...form,
        assignorUserId: form.assignorUserId || form.assigneeUserId,
      });
      if (updated) {
        showToast('Quick Task updated');
        onUpdated?.(updated);
        closeDrawer();
      }
      return;
    }
    const created = createQuickTask({
      ...form,
      assignorUserId: form.assignorUserId || form.assigneeUserId,
      status: form.status,
      completedAt: form.completedAt || null,
      sourceListItemId: sourceItem?.id || null,
      sourceListId: sourceItem?.folderId || null,
    });
    showToast('Quick Task created');
    const shouldDelete = deleteToggle ? deleteToggle.checked : true;
    onCreated?.({ task: created, deleteSourceItem: shouldDelete });
    closeDrawer();
  });

  drawer.querySelector('#qtArchiveBtn')?.addEventListener('click', () => {
    archiveTask(task.id);
    showToast('Quick Task archived');
    onUpdated?.(getTaskById(task.id));
    closeDrawer();
  });

  drawer.querySelector('#qtDeleteBtn')?.addEventListener('click', () => {
    showQuickTasksModal({
      title: 'Delete Quick Task?',
      body: '<p>This will permanently delete the task.</p>',
      confirmLabel: 'Delete',
      cancelLabel: 'Cancel',
      onConfirm: (cleanup) => {
        cleanup();
        const result = deleteTask(task.id);
        if (!result.ok) {
          showToast(result.reason);
          return;
        }
        showToast('Quick Task deleted');
        onDeleted?.(task);
        closeDrawer();
      },
    });
  });

  drawer.querySelector('#qtCompleteBtn')?.addEventListener('click', () => {
    if (task.status === 'completed') {
      const updated = setTaskStatus(task.id, 'backlog');
      showToast('Quick Task reopened');
      onUpdated?.(updated);
      closeDrawer();
      return;
    }
    openCompletionDateModal({
      initialDate: getLocalDateISO(new Date()),
      onConfirm: (date) => {
        const updated = setTaskStatus(task.id, 'completed', { completedAt: date });
        showToast('Quick Task completed');
        onUpdated?.(updated);
        closeDrawer();
      },
    });
  });

  drawer.querySelector('#qtPromoteBtn')?.addEventListener('click', () => {
    const currentServiceTypeId = serviceTypeInput?.value || task.serviceTypeId;
    openPromoteToJobTaskModal({
      task: { ...task, serviceTypeId: currentServiceTypeId },
      serviceTypes,
      onConfirm: ({ jobId, deliverableId, serviceTypeId }) => {
        const updated = promoteToJobTask(task.id, { jobId, deliverableId, serviceTypeId });
        onUpdated?.(updated);
        showMovedToJobModal();
        closeDrawer();
      },
    });
  });

  drawer.querySelector('#qtLogTimeBtn')?.addEventListener('click', () => {
    const hours = Number(drawer.querySelector('#qtLogHours')?.value);
    const date = drawer.querySelector('#qtLogDate')?.value || getLocalDateISO(new Date());
    if (!Number.isFinite(hours) || hours <= 0) {
      showToast('Enter hours greater than 0.');
      return;
    }
    const updated = addTimeEntry(task.id || null, { date, hours });
    if (!updated) return;
    const timeList = drawer.querySelector('#qtTimeEntries');
    if (timeList) timeList.innerHTML = renderTimeEntries(updated);
    const actualNode = drawer.querySelector('#qtActualHours');
    if (actualNode) actualNode.textContent = `Actual ${formatHours(getTaskActualHours(updated))}`;
    drawer.querySelector('#qtLogHours').value = '';
  });
}
