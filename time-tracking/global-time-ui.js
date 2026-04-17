import { setTopBarTimeVisualState } from '../app-shell/app-header.js';
import { TASK_STATUS_OPTIONS } from '../jobs/task-execution-utils.js';
import { getMyTasks } from '../me/tasks-data.js';
import { renderMiniMeters } from '../quick-tasks/quick-tasks-helpers.js';
import { openSingleDatePickerPopover } from '../quick-tasks/quick-task-detail.js';

const { createElement: h, useEffect, useMemo, useRef, useState } = React;
const { createRoot } = ReactDOM;

const ROOT_SLOT_ID = 'global-time-bar-slot';
const BAR_ID = 'global-time-bar';
const TASK_SEARCH_ID = 'global-time-task-search';
const TIME_FORMAT_STORAGE_KEY = 'netnet_time_format';
const TIMER_STATES = Object.freeze({
  idle: 'idle',
  running: 'running',
  paused: 'paused',
  confirming: 'confirming',
});
const MANUAL_FORMATS = Object.freeze({
  decimal: 'decimal',
  clock: 'clock',
});
const ONE_MINUTE_SECONDS = 60;
const TIMER_STEP_SECONDS = 5 * 60;
const TIMER_INTERVAL_MS = 1000;
const STOP_STATUS_OPTIONS = [
  { value: '', label: 'No change' },
  ...TASK_STATUS_OPTIONS.filter((option) => ['backlog', 'in_progress', 'completed'].includes(option.value)),
];
const EXTERNAL_TASK_CACHE = new Map();
const GLOBAL_TIME_LISTENERS = new Set();

const FALLBACK_TASKS = [
  {
    id: 'mock:wireframe-core-flows',
    source: 'job',
    title: 'Wireframe core flows',
    clientName: 'Aurora Rebrand',
    serviceType: 'Design',
    dueDate: '2026-04-15',
    description: 'Shape the primary site journey before build starts.',
    status: 'in_progress',
    loeHours: 8,
    actualHours: 3.5,
  },
  {
    id: 'mock:homepage-hero-tweaks',
    source: 'quick',
    title: 'Homepage hero tweaks',
    clientName: 'Net Net',
    serviceType: 'Design',
    dueDate: '2026-04-12',
    description: 'Refine headline and CTA direction.',
    status: 'backlog',
    loeHours: 3,
    actualHours: 0.5,
  },
  {
    id: 'mock:release-readiness-review',
    source: 'job',
    title: 'Release readiness review',
    clientName: 'Nimbus Growth Sprint',
    serviceType: 'Project Management',
    dueDate: '2026-04-18',
    description: 'Review scope, QA, and launch risks.',
    status: 'completed',
    loeHours: 5,
    actualHours: 5,
  },
];

const STORE = {
  barOpen: false,
  openSource: 'global',
  selectedTaskId: null,
  taskQuery: '',
  dropdownOpen: false,
  notes: '',
  selectedMode: 'timer',
  manualFormat: readStoredManualFormat(),
  manualDate: getTodayIso(),
  manualDurationInput: '',
  timerState: TIMER_STATES.idle,
  timerSeconds: 0,
  stopStatus: '',
};

let mountedTriggerId = 'timerBtn';
let timeBarRoot = null;
let rootSlot = null;
let triggerElement = null;
let timerIntervalId = null;
let documentListenersBound = false;
let returnFocusElement = null;
function createId(prefix = 'time') {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

function getTodayIso() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function readStoredManualFormat() {
  try {
    const storedValue = window?.localStorage?.getItem?.(TIME_FORMAT_STORAGE_KEY);
    return storedValue === MANUAL_FORMATS.clock ? MANUAL_FORMATS.clock : MANUAL_FORMATS.decimal;
  } catch (error) {
    return MANUAL_FORMATS.decimal;
  }
}

function persistManualFormat(format) {
  try {
    window?.localStorage?.setItem?.(TIME_FORMAT_STORAGE_KEY, format);
  } catch (error) {
    // Ignore storage failures in prototype shell.
  }
}

function normalizeStatusValue(status) {
  const value = String(status || '').trim().toLowerCase();
  if (value === 'in-progress' || value === 'in_progress') return 'in_progress';
  if (value === 'completed') return 'completed';
  if (value === 'archived') return 'archived';
  return 'backlog';
}

function getStatusLabel(status) {
  const match = TASK_STATUS_OPTIONS.find((option) => option.value === normalizeStatusValue(status));
  return match ? match.label : 'Backlog';
}

function getStatusToneClass(status) {
  const normalized = normalizeStatusValue(status);
  if (normalized === 'completed') {
    return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-200';
  }
  if (normalized === 'in_progress') {
    return 'bg-netnet-purple/15 text-netnet-purple dark:bg-netnet-purple/20 dark:text-netnet-purple';
  }
  if (normalized === 'archived') {
    return 'bg-slate-200 text-slate-600 dark:bg-slate-700/60 dark:text-slate-300';
  }
  return 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200';
}

function getTaskActualHours(task) {
  if (!task) return 0;
  if (Number.isFinite(task.actualHours)) return Number(task.actualHours) || 0;
  if (Array.isArray(task.timeEntries)) {
    return task.timeEntries.reduce((sum, entry) => sum + (Number(entry?.hours) || 0), 0);
  }
  if (Array.isArray(task.allocations)) {
    return task.allocations.reduce((sum, allocation) => sum + (Number(allocation?.actualHours) || 0), 0);
  }
  return 0;
}

function normalizeTask(task) {
  return {
    id: String(task?.id || createId('task')),
    source: String(task?.source || 'job'),
    title: String(task?.title || 'Untitled task'),
    description: String(task?.description || ''),
    clientName: String(task?.clientName || ''),
    serviceType: String(task?.serviceType || ''),
    dueDate: task?.dueDate || null,
    status: normalizeStatusValue(task?.status),
    loeHours: Number.isFinite(task?.loeHours) ? Number(task.loeHours) : 0,
    actualHours: getTaskActualHours(task),
  };
}

function registerTask(task) {
  const normalizedTask = normalizeTask(task);
  EXTERNAL_TASK_CACHE.set(normalizedTask.id, normalizedTask);
  return normalizedTask;
}

function formatTaskContext(task) {
  const parts = [task?.clientName || '', task?.serviceType || ''].filter(Boolean);
  return parts.length ? parts.join(' • ') : 'Internal task';
}

function getTaskCatalog() {
  const taskMap = new Map();
  try {
    getMyTasks()
      .map(normalizeTask)
      .filter((task) => !!task.title)
      .forEach((task) => {
        taskMap.set(task.id, task);
      });
  } catch (error) {
    // Ignore task lookup errors in the prototype shell.
  }

  if (!taskMap.size) {
    FALLBACK_TASKS.map(normalizeTask).forEach((task) => taskMap.set(task.id, task));
  }

  EXTERNAL_TASK_CACHE.forEach((task, taskId) => {
    const existing = taskMap.get(taskId);
    taskMap.set(taskId, existing ? { ...existing, ...task } : task);
  });

  return Array.from(taskMap.values());
}

function getTaskById(taskId, tasks = getTaskCatalog()) {
  return tasks.find((task) => String(task.id) === String(taskId)) || null;
}

function filterTasksByQuery(tasks, query, limit = 7) {
  const term = String(query || '').trim().toLowerCase();
  const scoped = !term
    ? tasks
    : tasks.filter((task) => (
        [task.title, task.description, task.clientName, task.serviceType]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()
          .includes(term)
      ));
  return scoped.slice(0, limit);
}

function buildMeterHtml(task) {
  return renderMiniMeters({
    loeHours: Number.isFinite(task?.loeHours) ? Number(task.loeHours) : 0,
    dueDate: task?.dueDate || null,
  }, getTaskActualHours(task))
    .replace(
      'class="space-y-2 min-w-[160px]"',
      'class="global-time-bar__meter-stack"',
    )
    .replaceAll(
      'class="space-y-1"',
      'class="global-time-bar__meter-block"',
    )
    .replace(
      /<div class="text-\[11px\] text-slate-600 dark:text-slate-300">LOE ([^<]+)<\/div>/,
      '<div class="global-time-bar__meter-label"><span class="global-time-bar__meter-key">LOE</span><span class="global-time-bar__meter-value">$1</span></div>',
    )
    .replace(
      /<div class="text-\[11px\] text-slate-600 dark:text-slate-300">Due ([^<]+)<\/div>/,
      '<div class="global-time-bar__meter-label"><span class="global-time-bar__meter-key">Due</span><span class="global-time-bar__meter-value">$1</span></div>',
    );
}

function formatTimerDuration(totalSeconds) {
  const safeSeconds = Math.max(0, Number(totalSeconds) || 0);
  const minutes = Math.floor(safeSeconds / 60);
  const seconds = safeSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

function parseDecimalDuration(input) {
  const trimmed = String(input || '').trim();
  if (!trimmed) return { valid: false, seconds: 0 };
  const numericValue = Number(trimmed);
  if (!Number.isFinite(numericValue) || numericValue < 0) {
    return { valid: false, seconds: 0 };
  }
  return { valid: true, seconds: Math.round(numericValue * 3600) };
}

function parseClockDuration(input) {
  const trimmed = String(input || '').trim();
  if (!trimmed) return { valid: false, seconds: 0 };
  const match = /^(\d+):([0-5]\d)$/.exec(trimmed);
  if (!match) return { valid: false, seconds: 0 };
  const hours = Number(match[1]) || 0;
  const minutes = Number(match[2]) || 0;
  return { valid: true, seconds: (hours * 3600) + (minutes * 60) };
}

function parseManualDuration(input, format = STORE.manualFormat) {
  return format === MANUAL_FORMATS.clock
    ? parseClockDuration(input)
    : parseDecimalDuration(input);
}

function formatDecimalDuration(seconds) {
  const hours = Math.max(0, Number(seconds) || 0) / 3600;
  const roundedHours = Math.round(hours * 100) / 100;
  return roundedHours.toFixed(2).replace(/\.?0+$/, '');
}

function formatClockDuration(seconds) {
  const safeSeconds = Math.max(0, Number(seconds) || 0);
  const totalMinutes = Math.round(safeSeconds / 60);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${hours}:${String(minutes).padStart(2, '0')}`;
}

function formatManualDuration(seconds, format = STORE.manualFormat) {
  return format === MANUAL_FORMATS.clock
    ? formatClockDuration(seconds)
    : formatDecimalDuration(seconds);
}

function formatManualDateLabel(value) {
  const iso = String(value || '').trim();
  if (!iso) return 'Today';
  const todayIso = getTodayIso();
  if (iso === todayIso) return 'Today';
  const parts = iso.split('-').map((part) => Number(part));
  if (parts.length !== 3 || parts.some((valuePart) => Number.isNaN(valuePart))) return 'Today';
  const monthLabels = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sept', 'Oct', 'Nov', 'Dec'];
  return `${monthLabels[Math.max(0, Math.min(11, parts[1] - 1))]} ${parts[2]}`;
}

function isTimerLockedState(timerState = STORE.timerState) {
  return timerState === TIMER_STATES.running
    || timerState === TIMER_STATES.paused
    || timerState === TIMER_STATES.confirming;
}

function canCloseBarState() {
  return !isTimerLockedState();
}

function getTimerStateLabel(timerState = STORE.timerState) {
  if (timerState === TIMER_STATES.paused) return 'Paused';
  if (timerState === TIMER_STATES.confirming) return 'Stopped';
  return 'Running';
}

function getGlobalTimeSnapshot() {
  const hasActiveSession = isTimerLockedState();
  return {
    barOpen: !!STORE.barOpen,
    selectedTaskId: STORE.selectedTaskId || null,
    hasTaskSelected: !!STORE.selectedTaskId,
    surfaceOpen: !!STORE.barOpen,
    surfaceView: 'bar',
    manualEntryStubOpen: false,
    dockTaskIds: [],
    activeTaskId: hasActiveSession ? STORE.selectedTaskId || null : null,
    pausedTaskId: STORE.timerState === TIMER_STATES.paused ? STORE.selectedTaskId || null : null,
    hasWorkingSet: hasActiveSession,
    hasActiveTimer: STORE.timerState === TIMER_STATES.running,
    timerState: STORE.timerState,
    timerSeconds: STORE.timerSeconds,
  };
}

function shouldShowBackgroundOverlay(state = STORE) {
  return state.timerState === TIMER_STATES.confirming
    || (
      state.barOpen
      && state.openSource === 'global'
      && state.timerState === TIMER_STATES.idle
      && !state.selectedTaskId
      && state.dropdownOpen
    );
}

function notifyGlobalTimeListeners() {
  const snapshot = getGlobalTimeSnapshot();
  GLOBAL_TIME_LISTENERS.forEach((listener) => {
    try {
      listener(snapshot);
    } catch (error) {
      // Ignore listener failures in the prototype shell.
    }
  });
}

function clearTimerInterval() {
  if (timerIntervalId) {
    window.clearInterval(timerIntervalId);
    timerIntervalId = null;
  }
}

function syncTimerInterval() {
  if (STORE.timerState === TIMER_STATES.running) {
    if (!timerIntervalId) {
      timerIntervalId = window.setInterval(() => {
        applyState({
          timerSeconds: Math.max(0, Number(STORE.timerSeconds) || 0) + 1,
        });
      }, TIMER_INTERVAL_MS);
    }
    return;
  }
  clearTimerInterval();
}

function updateSlotState() {
  if (!rootSlot) return;
  rootSlot.classList.toggle('is-open', !!STORE.barOpen);
  rootSlot.classList.toggle('is-closed', !STORE.barOpen);
  rootSlot.classList.toggle('has-time-overlay', shouldShowBackgroundOverlay(STORE));
  rootSlot.setAttribute('aria-hidden', STORE.barOpen ? 'false' : 'true');
}

function syncTopBarTimerPillBindings() {
  const pill = document.getElementById('topBarTimerPill');
  const toggleButton = document.getElementById('topBarTimerToggleBtn');
  const stopButton = document.getElementById('topBarTimerStopBtn');
  if (!pill) return;

  const togglePillBar = () => {
    if (!isTimerLockedState()) return;
    if (STORE.barOpen) {
      applyState({
        barOpen: false,
        dropdownOpen: false,
        taskQuery: '',
      });
      return;
    }
    openTimeBar({ taskId: STORE.selectedTaskId || null });
  };

  pill.onclick = (event) => {
    if (!isTimerLockedState()) return;
    if (event.target?.closest?.('#topBarTimerToggleBtn, #topBarTimerStopBtn')) return;
    togglePillBar();
  };
  pill.onkeydown = (event) => {
    if (!isTimerLockedState()) return;
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    togglePillBar();
  };

  if (toggleButton) {
    toggleButton.onclick = (event) => {
      event.preventDefault();
      event.stopPropagation();
      if (STORE.timerState === TIMER_STATES.running) {
        pauseTimer();
        return;
      }
      if (STORE.timerState === TIMER_STATES.paused) {
        resumeTimer();
      }
    };
  }

  if (stopButton) {
    stopButton.onclick = (event) => {
      event.preventDefault();
      event.stopPropagation();
      enterConfirmState();
    };
  }
}

function applyState(nextState, options = {}) {
  Object.assign(STORE, nextState);
  syncTimerInterval();
  renderGlobalTimeUI(options);
  notifyGlobalTimeListeners();
}

function resetBarDraft() {
  return {
    openSource: 'global',
    selectedTaskId: null,
    taskQuery: '',
    dropdownOpen: false,
    notes: '',
    selectedMode: 'timer',
    manualDurationInput: '',
    manualDate: getTodayIso(),
    timerState: TIMER_STATES.idle,
    timerSeconds: 0,
    stopStatus: '',
  };
}

function resetAndCloseBar({ returnFocus = false, showToast = false } = {}) {
  applyState({
    barOpen: false,
    ...resetBarDraft(),
  }, { returnFocus });
  if (showToast) {
    toast('Time saved');
  }
}

function closeTimeBar({ returnFocus = false, force = false } = {}) {
  if (!force && !canCloseBarState()) {
    return false;
  }
  resetAndCloseBar({ returnFocus, showToast: false });
  return true;
}

function openTimeBar({ taskId = null } = {}) {
  if (!STORE.barOpen) {
    returnFocusElement = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  }
  const nextTaskId = taskId ? String(taskId) : null;
  if (isTimerLockedState()) {
    applyState({
      barOpen: true,
      dropdownOpen: false,
      selectedMode: 'timer',
    });
    return;
  }
  applyState({
    barOpen: true,
    openSource: nextTaskId ? STORE.openSource : 'global',
    selectedTaskId: nextTaskId,
    taskQuery: '',
    dropdownOpen: !nextTaskId,
    notes: '',
    selectedMode: 'timer',
    manualDate: getTodayIso(),
    manualDurationInput: '',
    timerState: TIMER_STATES.idle,
    timerSeconds: 0,
    stopStatus: '',
  });
}

function openTimeBarForTask(taskLike) {
  const task = registerTask(taskLike);
  if (!STORE.barOpen) {
    returnFocusElement = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  }
  if (isTimerLockedState() && String(STORE.selectedTaskId || '') !== String(task.id)) {
    openTimeBar();
    return;
  }
  applyState({
    barOpen: true,
    openSource: 'row',
    selectedTaskId: task.id,
    taskQuery: '',
    dropdownOpen: false,
    notes: '',
    selectedMode: 'timer',
    manualDate: getTodayIso(),
    manualDurationInput: '',
    timerState: TIMER_STATES.idle,
    timerSeconds: 0,
    stopStatus: '',
  });
}

function beginTimerForSelectedTask() {
  if (!STORE.selectedTaskId) return false;
  applyState({
    barOpen: true,
    dropdownOpen: false,
    selectedMode: 'timer',
    timerState: TIMER_STATES.running,
    timerSeconds: Math.max(0, Number(STORE.timerSeconds) || 0),
    stopStatus: '',
  });
  return true;
}

function beginTimerForTask(taskLike) {
  const task = registerTask(taskLike);
  applyState({
    barOpen: true,
    selectedTaskId: task.id,
    taskQuery: '',
    dropdownOpen: false,
    notes: '',
    selectedMode: 'timer',
    manualDate: getTodayIso(),
    manualDurationInput: '',
    timerState: TIMER_STATES.running,
    timerSeconds: 0,
    stopStatus: '',
  });
  return true;
}

function pauseTimer() {
  if (STORE.timerState !== TIMER_STATES.running) return;
  applyState({ timerState: TIMER_STATES.paused });
}

function resumeTimer() {
  if (STORE.timerState !== TIMER_STATES.paused && STORE.timerState !== TIMER_STATES.confirming) return;
  applyState({ timerState: TIMER_STATES.running });
}

function nudgeTimerBy(secondsDelta) {
  if (!isTimerLockedState()) return;
  applyState({
    timerSeconds: Math.max(0, (Number(STORE.timerSeconds) || 0) + secondsDelta),
  });
}

function nudgeConfirmTimerBy(secondsDelta) {
  if (STORE.timerState !== TIMER_STATES.confirming) return;
  applyState({
    timerSeconds: Math.max(0, (Number(STORE.timerSeconds) || 0) + secondsDelta),
  });
}

function enterConfirmState() {
  if (!STORE.selectedTaskId || STORE.timerState === TIMER_STATES.idle) return;
  applyState({
    barOpen: true,
    dropdownOpen: false,
    selectedMode: 'timer',
    timerState: TIMER_STATES.confirming,
    stopStatus: '',
  });
}

function finishTimerSession({ showToast = false } = {}) {
  resetAndCloseBar({ showToast });
}

function discardTimerSession() {
  finishTimerSession({ showToast: false });
}

function switchManualFormat(nextFormat) {
  const normalizedFormat = nextFormat === MANUAL_FORMATS.clock ? MANUAL_FORMATS.clock : MANUAL_FORMATS.decimal;
  if (normalizedFormat === STORE.manualFormat) return;
  const parsed = parseManualDuration(STORE.manualDurationInput, STORE.manualFormat);
  persistManualFormat(normalizedFormat);
  applyState({
    manualFormat: normalizedFormat,
    manualDurationInput: parsed.valid ? formatManualDuration(parsed.seconds, normalizedFormat) : STORE.manualDurationInput,
  });
}

function FormatToggle({ format, onChange, ariaLabel = 'Time format' }) {
  return h('div', {
    className: 'global-time-bar__format-toggle global-time-bar__format-toggle--stacked',
    role: 'tablist',
    'aria-label': ariaLabel,
  }, [
    h('button', {
      type: 'button',
      className: [
        'global-time-bar__format-button',
        'is-decimal',
        format === MANUAL_FORMATS.decimal ? 'is-active' : '',
      ].join(' '),
      role: 'tab',
      'aria-selected': format === MANUAL_FORMATS.decimal ? 'true' : 'false',
      'aria-label': 'Decimal time format',
      title: 'Decimal',
      onClick: () => onChange(MANUAL_FORMATS.decimal),
    }, h(FormatGlyph, { kind: 'decimal' })),
    h('button', {
      type: 'button',
      className: [
        'global-time-bar__format-button',
        'is-clock',
        format === MANUAL_FORMATS.clock ? 'is-active' : '',
      ].join(' '),
      role: 'tab',
      'aria-selected': format === MANUAL_FORMATS.clock ? 'true' : 'false',
      'aria-label': 'Clock time format',
      title: 'Clock',
      onClick: () => onChange(MANUAL_FORMATS.clock),
    }, h(FormatGlyph, { kind: 'clock' })),
  ]);
}

function ManualDateControl({ value, onChange }) {
  const triggerRef = useRef(null);
  const cleanupRef = useRef(null);

  useEffect(() => () => {
    if (typeof cleanupRef.current === 'function') {
      cleanupRef.current();
      cleanupRef.current = null;
    }
  }, []);

  return h('button', {
    type: 'button',
    ref: triggerRef,
    className: 'global-time-bar__date-button',
    onClick: () => {
      if (typeof cleanupRef.current === 'function') {
        cleanupRef.current();
        cleanupRef.current = null;
      }
      cleanupRef.current = openSingleDatePickerPopover({
        anchorEl: triggerRef.current,
        value: value || getTodayIso(),
        onSelect: (nextValue) => {
          onChange(nextValue || getTodayIso());
          cleanupRef.current = null;
        },
        onClear: () => {
          onChange(getTodayIso());
          cleanupRef.current = null;
        },
        onClose: () => {
          cleanupRef.current = null;
          triggerRef.current?.focus?.();
        },
      });
    },
    'aria-label': 'Choose manual time date',
  }, [
    h('span', { className: 'global-time-bar__date-label' }, formatManualDateLabel(value)),
    h('svg', {
      viewBox: '0 0 24 24',
      className: 'global-time-bar__date-icon',
      fill: 'none',
      stroke: 'currentColor',
      strokeWidth: '1.8',
      strokeLinecap: 'round',
      strokeLinejoin: 'round',
      'aria-hidden': 'true',
    }, [
      h('rect', { x: '3', y: '4', width: '18', height: '18', rx: '2' }),
      h('line', { x1: '16', y1: '2', x2: '16', y2: '6' }),
      h('line', { x1: '8', y1: '2', x2: '8', y2: '6' }),
      h('line', { x1: '3', y1: '10', x2: '21', y2: '10' }),
    ]),
  ]);
}

function ConfirmStatusControl({ status, onChange }) {
  const [editing, setEditing] = useState(false);
  const activeOption = STOP_STATUS_OPTIONS.find((option) => option.value === (status || '')) || STOP_STATUS_OPTIONS[0];
  const pillClassName = activeOption.value
    ? `rounded-full px-2 py-0.5 text-[11px] font-semibold ${getStatusToneClass(activeOption.value)}`
    : 'rounded-full px-2 py-0.5 text-[11px] font-semibold bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200';

  if (editing) {
    return h('select', {
      value: status || '',
      autoFocus: true,
      onClick: (event) => event.stopPropagation(),
      onMouseDown: (event) => event.stopPropagation(),
      onChange: (event) => {
        onChange(event.target.value || '');
        setEditing(false);
      },
      onBlur: () => setEditing(false),
      onKeyDown: (event) => {
        event.stopPropagation();
        if (event.key === 'Escape') {
          event.preventDefault();
          setEditing(false);
        }
      },
      className: 'global-time-bar__status-select h-7 rounded-full px-2 text-[11px] font-semibold',
      'aria-label': 'Edit stopped timer status',
    }, STOP_STATUS_OPTIONS.map((option) => (
      h('option', { key: option.value || 'no_change', value: option.value }, option.label)
    )));
  }

  return h('button', {
    type: 'button',
    className: 'inline-flex items-center',
    onClick: (event) => {
      event.stopPropagation();
      setEditing(true);
    },
    onMouseDown: (event) => event.stopPropagation(),
    'aria-label': 'Edit stopped timer status',
  }, [
    h('span', { className: pillClassName }, activeOption.label),
  ]);
}

function setManualMode() {
  applyState({ selectedMode: 'manual' });
}

function saveManualEntry() {
  const parsed = parseManualDuration(STORE.manualDurationInput, STORE.manualFormat);
  if (!STORE.selectedTaskId || !parsed.valid) return;
  resetAndCloseBar({ showToast: true });
}

function toggleTimeBar() {
  if (STORE.barOpen) {
    if (!canCloseBarState()) return;
    closeTimeBar({ returnFocus: true });
    return;
  }
  openTimeBar();
}

function handleDocumentKeyDown(event) {
  if (!STORE.barOpen) return;
  if (event.key !== 'Escape') return;
  event.preventDefault();
  if (STORE.dropdownOpen && !STORE.selectedTaskId && STORE.timerState === TIMER_STATES.idle) {
    applyState({ dropdownOpen: false });
    return;
  }
  if (canCloseBarState()) {
    closeTimeBar({ returnFocus: true });
  }
}

function handleDocumentPointerDown(event) {
  if (!STORE.barOpen || !STORE.dropdownOpen || STORE.timerState !== TIMER_STATES.idle) return;
  if (STORE.openSource === 'global') return;
  const target = event.target;
  const bar = document.getElementById(BAR_ID);
  const trigger = document.getElementById(mountedTriggerId);
  if (bar?.contains(target)) return;
  if (trigger?.contains(target)) return;
  applyState({ dropdownOpen: false });
}

function handleHashChange() {
  if (!STORE.barOpen || !canCloseBarState()) return;
  closeTimeBar();
}

function handleWindowResize() {
  if (!STORE.barOpen && STORE.timerState !== TIMER_STATES.confirming) return;
  renderGlobalTimeUI();
}

function bindDocumentListeners() {
  if (documentListenersBound) return;
  documentListenersBound = true;
  document.addEventListener('keydown', handleDocumentKeyDown);
  document.addEventListener('pointerdown', handleDocumentPointerDown, true);
  window.addEventListener('hashchange', handleHashChange);
  window.addEventListener('resize', handleWindowResize);
}

function unbindDocumentListeners() {
  if (!documentListenersBound) return;
  documentListenersBound = false;
  document.removeEventListener('keydown', handleDocumentKeyDown);
  document.removeEventListener('pointerdown', handleDocumentPointerDown, true);
  window.removeEventListener('hashchange', handleHashChange);
  window.removeEventListener('resize', handleWindowResize);
}

function bindTrigger() {
  const nextTrigger = document.getElementById(mountedTriggerId);
  if (!nextTrigger) return;
  if (triggerElement && triggerElement !== nextTrigger) {
    triggerElement.onclick = null;
  }
  triggerElement = nextTrigger;
  triggerElement.onclick = (event) => {
    event.preventDefault();
    toggleTimeBar();
  };
}

function ensureRootSlot() {
  const slot = document.getElementById(ROOT_SLOT_ID);
  if (!slot) return null;
  rootSlot = slot;
  updateSlotState();
  return slot;
}

function toast(message) {
  if (typeof window !== 'undefined' && typeof window.showToast === 'function') {
    window.showToast(message);
  }
}

function GlyphIcon({ d, viewBox = '0 0 24 24' }) {
  return h('svg', {
    viewBox,
    fill: 'currentColor',
    'aria-hidden': 'true',
  }, h('path', { d }));
}

function LineGlyph({ d, viewBox = '0 0 24 24', strokeWidth = '2.4' }) {
  return h('svg', {
    viewBox,
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    'aria-hidden': 'true',
  }, h('path', { d }));
}

function FormatGlyph({ kind }) {
  if (kind === 'clock') {
    return h('svg', {
      viewBox: '0 0 24 24',
      fill: 'none',
      stroke: 'currentColor',
      strokeWidth: '2',
      strokeLinecap: 'round',
      strokeLinejoin: 'round',
      className: 'global-time-bar__format-glyph',
      'aria-hidden': 'true',
    }, [
      h('circle', { cx: '12', cy: '12', r: '8.5' }),
      h('path', { d: 'M12 7.5v5l3 2' }),
    ]);
  }

  return h('svg', {
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: '2',
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    className: 'global-time-bar__format-glyph',
    'aria-hidden': 'true',
  }, [
    h('rect', { x: '4.5', y: '6', width: '15', height: '12', rx: '2.5' }),
    h('path', { d: 'M8 12h.01M12 12h.01M16 12h.01' }),
  ]);
}

function TaskDropdownRow({ task, onSelect }) {
  return h('button', {
    type: 'button',
    className: 'global-time-bar__dropdown-row',
    onClick: () => onSelect(task.id),
  }, [
    h('div', { className: 'global-time-bar__dropdown-main' }, [
      h('div', { className: 'global-time-bar__dropdown-title-row' }, [
        h('div', { className: 'global-time-bar__dropdown-title' }, task.title),
        h('span', {
          className: `global-time-bar__dropdown-status-pill inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ${getStatusToneClass(task.status)}`,
        }, getStatusLabel(task.status)),
      ]),
      h('div', { className: 'global-time-bar__dropdown-context' }, formatTaskContext(task)),
    ]),
    h('div', {
      className: 'global-time-bar__dropdown-meters',
      dangerouslySetInnerHTML: {
        __html: buildMeterHtml(task),
      },
    }),
  ]);
}

function TimerActionArea({ state, canStart }) {
  if (state.timerState === TIMER_STATES.idle) {
    return h('button', {
      type: 'button',
      className: 'global-time-bar__start',
      disabled: !canStart,
      onClick: () => {
        if (!canStart) return;
        beginTimerForSelectedTask();
      },
    }, 'START');
  }

  const isPaused = state.timerState === TIMER_STATES.paused;
  const isConfirming = state.timerState === TIMER_STATES.confirming;
  const handleTimerNudge = (secondsDelta) => {
    if (isConfirming) {
      nudgeConfirmTimerBy(secondsDelta);
      return;
    }
    nudgeTimerBy(secondsDelta);
  };
  const displayValue = isConfirming
    ? formatManualDuration(state.timerSeconds, state.manualFormat)
    : formatTimerDuration(state.timerSeconds);
  return h('div', {
    className: [
      'global-time-bar__timer-cluster',
      isConfirming ? 'is-confirming' : '',
    ].join(' '),
  }, [
    h('div', {
      className: [
        'global-time-bar__timer-readout',
        state.timerState === TIMER_STATES.running ? 'is-running' : '',
        state.timerState === TIMER_STATES.paused ? 'is-paused' : '',
        isConfirming ? 'is-confirming' : '',
      ].join(' '),
      'aria-live': 'polite',
    }, displayValue),
    h('div', { className: 'global-time-bar__nudge-group' }, [
      h('button', {
        type: 'button',
        className: 'global-time-bar__utility-button global-time-bar__nudge-button',
        onClick: () => handleTimerNudge(-TIMER_STEP_SECONDS),
        'aria-label': 'Subtract 5 minutes',
        'data-tooltip': 'Subtract 5 minutes',
        title: 'Subtract 5 minutes',
      }, '-5'),
      h('button', {
        type: 'button',
        className: 'global-time-bar__utility-button global-time-bar__nudge-button',
        onClick: () => handleTimerNudge(-ONE_MINUTE_SECONDS),
        'aria-label': 'Subtract 1 minute',
        'data-tooltip': 'Subtract 1 minute',
        title: 'Subtract 1 minute',
      }, '-1'),
      h('button', {
        type: 'button',
        className: 'global-time-bar__utility-button global-time-bar__nudge-button',
        onClick: () => handleTimerNudge(ONE_MINUTE_SECONDS),
        'aria-label': 'Add 1 minute',
        'data-tooltip': 'Add 1 minute',
        title: 'Add 1 minute',
      }, '+1'),
      h('button', {
        type: 'button',
        className: 'global-time-bar__utility-button global-time-bar__nudge-button',
        onClick: () => handleTimerNudge(TIMER_STEP_SECONDS),
        'aria-label': 'Add 5 minutes',
        'data-tooltip': 'Add 5 minutes',
        title: 'Add 5 minutes',
      }, '+5'),
    ]),
    isConfirming
      ? h('div', { className: 'global-time-bar__confirm-actions' }, [
          h('span', { className: 'global-time-bar__stopped-label' }, 'Stopped'),
          h(FormatToggle, {
            format: state.manualFormat,
            onChange: switchManualFormat,
            ariaLabel: 'Stopped time format',
          }),
          h(ConfirmStatusControl, {
            status: state.stopStatus,
            onChange: (nextStatus) => applyState({ stopStatus: nextStatus || '' }),
          }),
          h('button', {
            type: 'button',
            className: 'global-time-bar__action-button global-time-bar__icon-button',
            onClick: () => resumeTimer(),
            'aria-label': 'Resume timer',
          }, h(GlyphIcon, { d: 'M8 6.5v11l9-5.5-9-5.5z' })),
          h('button', {
            type: 'button',
            className: 'global-time-bar__action-button global-time-bar__icon-button is-stop',
            disabled: true,
            'aria-label': 'Stopped timer',
          }, h(GlyphIcon, { d: 'M7 7h10v10H7z' })),
          h('button', {
            type: 'button',
            className: 'global-time-bar__confirm',
            onClick: () => finishTimerSession({ showToast: true }),
          }, 'CONFIRM'),
          h('button', {
            type: 'button',
            className: 'global-time-bar__discard',
            onClick: () => discardTimerSession(),
          }, 'DISCARD'),
        ])
      : [
          h('button', {
            key: 'toggle',
            type: 'button',
            className: 'global-time-bar__action-button global-time-bar__icon-button',
            onClick: () => {
              if (isPaused) {
                resumeTimer();
                return;
              }
              pauseTimer();
            },
            'aria-label': isPaused ? 'Resume timer' : 'Pause timer',
          }, isPaused
            ? h(GlyphIcon, { d: 'M8 6.5v11l9-5.5-9-5.5z' })
            : h(GlyphIcon, { d: 'M8 5h3v14H8zM13 5h3v14h-3z' })),
          h('button', {
            key: 'stop',
            type: 'button',
            className: 'global-time-bar__action-button global-time-bar__icon-button is-stop',
            onClick: () => enterConfirmState(),
            'aria-label': 'Stop timer',
          }, h(GlyphIcon, { d: 'M7 7h10v10H7z' })),
        ],
  ]);
}

function ManualActionArea({ state, canStart }) {
  const parsed = parseManualDuration(state.manualDurationInput, state.manualFormat);
  const saveEnabled = !!canStart && parsed.valid;
  const presetSeconds = [15 * 60, 30 * 60, 60 * 60, 2 * 60 * 60];
  const inputPlaceholder = state.manualFormat === MANUAL_FORMATS.clock ? '1:15' : '1.25';

  return h('div', { className: 'global-time-bar__manual-cluster' }, [
    h(ManualDateControl, {
      value: state.manualDate,
      onChange: (nextDate) => applyState({ manualDate: nextDate || getTodayIso() }),
    }),
    h('div', { className: 'global-time-bar__duration-pills' }, presetSeconds.map((seconds) => (
      h('button', {
        key: `${state.manualFormat}-${seconds}`,
        type: 'button',
        className: 'global-time-bar__duration-pill',
        onClick: () => applyState({
          manualDurationInput: formatManualDuration(seconds, state.manualFormat),
        }),
      }, formatManualDuration(seconds, state.manualFormat))
    ))),
    h('input', {
      type: 'text',
      value: state.manualDurationInput,
      className: 'global-time-bar__manual-input',
      placeholder: inputPlaceholder,
      onChange: (event) => applyState({ manualDurationInput: event.target.value || '' }),
      'aria-label': state.manualFormat === MANUAL_FORMATS.clock ? 'Manual time in clock format' : 'Manual time in decimal format',
    }),
    h(FormatToggle, {
      format: state.manualFormat,
      onChange: switchManualFormat,
      ariaLabel: 'Manual time format',
    }),
    h('button', {
      type: 'button',
      className: 'global-time-bar__save',
      disabled: !saveEnabled,
      onClick: () => saveManualEntry(),
    }, 'SAVE'),
  ]);
}

function GlobalTimeBar({ state, overlayTop = 0 }) {
  const searchRef = useRef(null);
  const tasks = getTaskCatalog();
  const selectedTask = state.selectedTaskId ? getTaskById(state.selectedTaskId, tasks) : null;
  const filteredTasks = useMemo(() => filterTasksByQuery(tasks, state.taskQuery, 7), [tasks, state.taskQuery]);
  const canStart = !!selectedTask;
  const timerLocked = isTimerLockedState(state.timerState);
  const canSwitchMode = canStart && !timerLocked;
  const showDropdown = state.barOpen && state.dropdownOpen && !selectedTask && state.timerState === TIMER_STATES.idle;
  const showOverlay = shouldShowBackgroundOverlay(state);
  const isManualMode = state.selectedMode === 'manual' && state.timerState === TIMER_STATES.idle;
  const selectFirstTask = () => {
    const firstTask = filteredTasks[0];
    if (!firstTask) return;
    applyState({
      selectedTaskId: firstTask.id,
      taskQuery: '',
      dropdownOpen: false,
    });
  };

  useEffect(() => {
    if (!showDropdown) return;
    window.requestAnimationFrame(() => {
      searchRef.current?.focus?.();
    });
  }, [showDropdown]);

  return h('div', { className: 'global-time-bar__layer' }, [
    showOverlay
      ? h('div', {
          className: 'global-time-bar__overlay is-active',
          style: { top: `${Math.max(0, overlayTop)}px` },
          'aria-hidden': 'true',
        })
      : null,
    h('div', {
      id: BAR_ID,
      role: 'region',
      'aria-label': 'Time tracking',
      className: [
        'global-time-bar',
        state.barOpen ? 'is-open' : 'is-closed',
        isManualMode ? 'is-manual-mode' : '',
        state.timerState === TIMER_STATES.running ? 'is-running' : '',
        state.timerState === TIMER_STATES.paused ? 'is-paused' : '',
        state.timerState === TIMER_STATES.confirming ? 'is-confirming' : '',
      ].join(' '),
      'aria-hidden': state.barOpen ? 'false' : 'true',
    }, [
      h('div', {
        className: [
          'global-time-bar__inner',
          isManualMode ? 'is-manual-mode' : '',
          state.timerState === TIMER_STATES.running ? 'is-running' : '',
          state.timerState === TIMER_STATES.paused ? 'is-paused' : '',
          state.timerState === TIMER_STATES.confirming ? 'is-confirming' : '',
        ].join(' '),
      }, [
        h('div', { className: 'global-time-bar__task-area' }, [
          selectedTask
            ? h('div', { className: 'global-time-bar__task-selected' }, [
                h('button', {
                  type: 'button',
                  className: [
                    'global-time-bar__task-link',
                    timerLocked ? 'is-locked' : '',
                  ].join(' '),
                  disabled: timerLocked,
                  'aria-label': timerLocked
                    ? `Selected task locked while timer is active: ${selectedTask.title}`
                    : `Change selected task. Current task: ${selectedTask.title}`,
                  onClick: () => {
                    if (timerLocked) return;
                    applyState({
                      selectedTaskId: null,
                      taskQuery: '',
                      dropdownOpen: true,
                    });
                  },
                }, selectedTask.title),
                h('span', { className: 'global-time-bar__task-context' }, formatTaskContext(selectedTask)),
              ])
            : h('input', {
                id: TASK_SEARCH_ID,
                ref: searchRef,
                type: 'text',
                value: state.taskQuery,
                className: 'global-time-bar__task-input',
                placeholder: '+ Task',
                'aria-label': 'Select a task',
                onFocus: () => applyState({ dropdownOpen: true }),
                onKeyDown: (event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault();
                    selectFirstTask();
                    return;
                  }
                  if (event.key === 'ArrowDown') {
                    const firstRow = document.querySelector('.global-time-bar__dropdown.is-open .global-time-bar__dropdown-row');
                    if (firstRow instanceof HTMLElement) {
                      event.preventDefault();
                      firstRow.focus();
                    }
                  }
                },
                onChange: (event) => applyState({
                  taskQuery: event.target.value || '',
                  dropdownOpen: true,
                }),
              }),
          h('div', {
            className: [
              'global-time-bar__dropdown',
              showDropdown ? 'is-open' : '',
            ].join(' '),
          }, filteredTasks.length
            ? filteredTasks.map((task) => (
                h(TaskDropdownRow, {
                  key: task.id,
                  task,
                  onSelect: (taskId) => applyState({
                    selectedTaskId: taskId,
                    taskQuery: '',
                    dropdownOpen: false,
                  }),
                })
              ))
            : h('div', { className: 'global-time-bar__dropdown-empty' }, 'No matching tasks')),
        ]),
        h('input', {
          type: 'text',
          value: state.notes,
          className: 'global-time-bar__notes',
          placeholder: 'Notes...',
          onChange: (event) => applyState({ notes: event.target.value || '' }),
        }),
        h('div', {
          className: [
            'global-time-bar__mode-toggle',
            canSwitchMode ? '' : 'is-disabled',
          ].join(' '),
          role: 'tablist',
          'aria-label': 'Time mode',
          'aria-disabled': canSwitchMode ? 'false' : 'true',
        }, [
          h('button', {
            type: 'button',
            className: [
              'global-time-bar__mode-button',
              state.selectedMode === 'timer' ? 'is-active' : '',
            ].join(' '),
            role: 'tab',
            'aria-selected': state.selectedMode === 'timer' ? 'true' : 'false',
            disabled: !canSwitchMode,
            onClick: () => canSwitchMode && applyState({ selectedMode: 'timer' }),
          }, 'Timer'),
          h('button', {
            type: 'button',
            className: [
              'global-time-bar__mode-button',
              state.selectedMode === 'manual' ? 'is-active' : '',
            ].join(' '),
            role: 'tab',
            'aria-selected': state.selectedMode === 'manual' ? 'true' : 'false',
            disabled: !canSwitchMode,
            onClick: () => canSwitchMode && applyState({ selectedMode: 'manual' }),
          }, 'Manual Time'),
        ]),
        state.selectedMode === 'manual' && state.timerState === TIMER_STATES.idle
          ? h(ManualActionArea, { state, canStart })
          : h(TimerActionArea, { state, canStart }),
        h('button', {
          type: 'button',
          className: 'global-time-bar__close',
          onClick: () => closeTimeBar({ returnFocus: true }),
          disabled: !canCloseBarState(),
          title: canCloseBarState() ? 'Close time bar' : 'Timer must be confirmed before closing',
          'aria-label': 'Close time bar',
        }, [
          h('svg', {
            viewBox: '0 0 24 24',
            fill: 'none',
            stroke: 'currentColor',
            strokeWidth: '2',
            strokeLinecap: 'round',
          }, [
            h('line', { x1: '18', y1: '6', x2: '6', y2: '18' }),
            h('line', { x1: '6', y1: '6', x2: '18', y2: '18' }),
          ]),
        ]),
      ]),
    ]),
  ]);
}

export function renderGlobalTimeUI(options = {}) {
  const { returnFocus = false } = options;
  if (!timeBarRoot || !rootSlot) return;

  bindTrigger();
  updateSlotState();
  const selectedTask = STORE.selectedTaskId ? getTaskById(STORE.selectedTaskId) : null;
  const hasTimerSession = isTimerLockedState();
  setTopBarTimeVisualState({
    hasWorkingSet: hasTimerSession,
    hasActiveTimer: STORE.timerState === TIMER_STATES.running,
    expanded: !!STORE.barOpen,
    disabled: false,
    activeTimerBarVisible: hasTimerSession,
    activeTimerLabel: selectedTask?.title || '',
    activeTimerDuration: STORE.timerState === TIMER_STATES.confirming
      ? formatManualDuration(STORE.timerSeconds, STORE.manualFormat)
      : formatTimerDuration(STORE.timerSeconds),
    activeTimerStateLabel: hasTimerSession ? getTimerStateLabel(STORE.timerState) : '',
    activeTimerPaused: STORE.timerState === TIMER_STATES.paused,
    activeTimerConfirming: STORE.timerState === TIMER_STATES.confirming,
    activeTimerCanToggle: STORE.timerState === TIMER_STATES.running || STORE.timerState === TIMER_STATES.paused,
  });

  const overlayTop = rootSlot.getBoundingClientRect().bottom;
  timeBarRoot.render(h(GlobalTimeBar, {
    state: { ...STORE },
    overlayTop,
  }));
  syncTopBarTimerPillBindings();

  if (returnFocus) {
    window.requestAnimationFrame(() => {
      const preferredFocusTarget = returnFocusElement instanceof HTMLElement
        ? returnFocusElement
        : document.getElementById(mountedTriggerId);
      preferredFocusTarget?.focus?.();
      returnFocusElement = null;
    });
  }
}

export function mountGlobalTimeUI({ triggerId = 'timerBtn' } = {}) {
  mountedTriggerId = triggerId;
  const slot = ensureRootSlot();
  if (!slot) return;
  if (!timeBarRoot) {
    timeBarRoot = createRoot(slot);
  }
  bindTrigger();
  bindDocumentListeners();
  renderGlobalTimeUI();
}

export function unmountGlobalTimeUI() {
  clearTimerInterval();
  if (triggerElement) {
    triggerElement.onclick = null;
    triggerElement = null;
  }
  const pill = document.getElementById('topBarTimerPill');
  const toggleButton = document.getElementById('topBarTimerToggleBtn');
  const stopButton = document.getElementById('topBarTimerStopBtn');
  if (pill) {
    pill.onclick = null;
    pill.onkeydown = null;
  }
  if (toggleButton) toggleButton.onclick = null;
  if (stopButton) stopButton.onclick = null;
  unbindDocumentListeners();
  if (timeBarRoot) {
    try {
      timeBarRoot.unmount();
    } catch (error) {
      // Ignore stale roots during shell remounts.
    }
    timeBarRoot = null;
  }
  if (rootSlot) {
    rootSlot.classList.remove('is-open', 'has-time-overlay');
    rootSlot.classList.add('is-closed');
    rootSlot.innerHTML = '';
  }
  Object.assign(STORE, resetBarDraft(), { barOpen: false });
  setTopBarTimeVisualState({
    hasWorkingSet: false,
    hasActiveTimer: false,
    expanded: false,
    disabled: false,
    activeTimerBarVisible: false,
    activeTimerLabel: '',
    activeTimerDuration: '',
    activeTimerStateLabel: '',
    activeTimerPaused: false,
    activeTimerConfirming: false,
    activeTimerCanToggle: false,
  });
  notifyGlobalTimeListeners();
}

export function subscribeGlobalTime(listener) {
  if (typeof listener !== 'function') {
    return () => {};
  }
  GLOBAL_TIME_LISTENERS.add(listener);
  listener(getGlobalTimeSnapshot());
  return () => {
    GLOBAL_TIME_LISTENERS.delete(listener);
  };
}

export function startTimerForTask(taskLike) {
  return beginTimerForTask(taskLike);
}

export function openManualEntryForTask(taskLike) {
  openTimeBarForTask(taskLike);
}

export function addTaskToDock(taskLike) {
  openTimeBarForTask(taskLike);
}

export { getGlobalTimeSnapshot, toggleTimeBar, openTimeBar, openTimeBarForTask, closeTimeBar };
