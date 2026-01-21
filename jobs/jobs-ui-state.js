import { getActiveWorkspace } from '../app-shell/app-helpers.js';

const STATUS_FILTERS = new Set(['default', 'pending', 'active', 'completed', 'archived']);
const KIND_FILTERS = new Set(['all', 'project', 'retainer']);
const MAIN_VIEWS = new Set(['jobs', 'tasks']);
const TASK_VIEWS = new Set(['grouped', 'flat']);
const CYCLE_KEY_RE = /^\d{4}-\d{2}$/;
const JOB_NUMBER_RE = /^\d{3,6}$/;

function workspaceId() {
  return getActiveWorkspace()?.id || 'default';
}

function storageKey(wsId) {
  return `netnet_ws_${wsId}_jobs_ui_v1`;
}

const defaultState = () => ({
  statusFilter: 'default',
  kindFilter: 'all',
  search: '',
  jobsMainView: 'jobs',
  jobTasksView: {},
  jobCycleKeys: {},
  jobNumberOverrides: {},
});

let memoryState = defaultState();

function ensureShape(raw) {
  const base = defaultState();
  const next = { ...base, ...(raw || {}) };
  next.statusFilter = STATUS_FILTERS.has(next.statusFilter) ? next.statusFilter : base.statusFilter;
  next.kindFilter = KIND_FILTERS.has(next.kindFilter) ? next.kindFilter : base.kindFilter;
  next.search = typeof next.search === 'string' ? next.search : '';
  next.jobsMainView = MAIN_VIEWS.has(next.jobsMainView) ? next.jobsMainView : base.jobsMainView;
  const jobTasksView = raw?.jobTasksView;
  if (jobTasksView && typeof jobTasksView === 'object') {
    const normalized = {};
    Object.keys(jobTasksView).forEach((key) => {
      const value = jobTasksView[key];
      if (TASK_VIEWS.has(value)) normalized[key] = value;
    });
    next.jobTasksView = normalized;
  } else {
    next.jobTasksView = {};
  }
  const jobCycleKeys = raw?.jobCycleKeys;
  if (jobCycleKeys && typeof jobCycleKeys === 'object') {
    const normalized = {};
    Object.keys(jobCycleKeys).forEach((key) => {
      const value = jobCycleKeys[key];
      if (CYCLE_KEY_RE.test(String(value))) normalized[key] = value;
    });
    next.jobCycleKeys = normalized;
  } else {
    next.jobCycleKeys = {};
  }
  const jobNumberOverrides = raw?.jobNumberOverrides;
  if (jobNumberOverrides && typeof jobNumberOverrides === 'object') {
    const normalized = {};
    Object.keys(jobNumberOverrides).forEach((key) => {
      const value = String(jobNumberOverrides[key] || '').trim();
      if (JOB_NUMBER_RE.test(value)) normalized[key] = value;
    });
    next.jobNumberOverrides = normalized;
  } else {
    next.jobNumberOverrides = {};
  }
  return next;
}

function loadState(wsId = workspaceId()) {
  try {
    const raw = localStorage.getItem(storageKey(wsId));
    if (!raw) {
      memoryState = ensureShape(memoryState);
      return memoryState;
    }
    const parsed = JSON.parse(raw);
    const normalized = ensureShape(parsed);
    memoryState = normalized;
    const normalizedRaw = JSON.stringify(normalized);
    if (normalizedRaw && normalizedRaw !== raw) {
      localStorage.setItem(storageKey(wsId), normalizedRaw);
    }
    return memoryState;
  } catch (e) {
    memoryState = ensureShape(memoryState);
    return memoryState;
  }
}

function persist(state, wsId = workspaceId()) {
  memoryState = ensureShape(state);
  try {
    localStorage.setItem(storageKey(wsId), JSON.stringify(memoryState));
  } catch (e) {
    // Ignore storage errors in prototype
  }
  return memoryState;
}

export function getJobsUIState() {
  return loadState();
}

export function updateJobsUIState(partial = {}) {
  const current = loadState();
  return persist({ ...current, ...(partial || {}) });
}

export function getJobsMainView() {
  return loadState().jobsMainView || 'jobs';
}

export function setJobsMainView(view) {
  const current = loadState();
  current.jobsMainView = MAIN_VIEWS.has(view) ? view : 'jobs';
  return persist(current).jobsMainView;
}

export function getJobTasksViewMode(jobId) {
  const state = loadState();
  const key = String(jobId || '');
  return TASK_VIEWS.has(state.jobTasksView?.[key]) ? state.jobTasksView[key] : 'grouped';
}

export function setJobTasksViewMode(jobId, mode) {
  const state = loadState();
  const key = String(jobId || '');
  const nextMode = TASK_VIEWS.has(mode) ? mode : 'grouped';
  const nextMap = { ...(state.jobTasksView || {}) };
  if (key) nextMap[key] = nextMode;
  state.jobTasksView = nextMap;
  return persist(state).jobTasksView[key] || nextMode;
}

export function getJobCycleKey(jobId) {
  const state = loadState();
  const key = String(jobId || '');
  return CYCLE_KEY_RE.test(state.jobCycleKeys?.[key]) ? state.jobCycleKeys[key] : null;
}

export function setJobCycleKey(jobId, cycleKey) {
  const state = loadState();
  const key = String(jobId || '');
  if (!key || !CYCLE_KEY_RE.test(String(cycleKey || ''))) return getJobCycleKey(jobId);
  const nextMap = { ...(state.jobCycleKeys || {}) };
  nextMap[key] = cycleKey;
  state.jobCycleKeys = nextMap;
  return persist(state).jobCycleKeys[key];
}

export function getJobNumberOverride(jobId) {
  const state = loadState();
  const key = String(jobId || '');
  const value = state.jobNumberOverrides?.[key];
  return JOB_NUMBER_RE.test(String(value || '')) ? value : null;
}

export function setJobNumberOverride(jobId, jobNumber) {
  const state = loadState();
  const key = String(jobId || '');
  if (!key) return null;
  const nextMap = { ...(state.jobNumberOverrides || {}) };
  const normalized = String(jobNumber || '').trim();
  if (normalized && JOB_NUMBER_RE.test(normalized)) {
    nextMap[key] = normalized;
  } else {
    delete nextMap[key];
  }
  state.jobNumberOverrides = nextMap;
  return persist(state).jobNumberOverrides[key] || null;
}

export function getJobNumberOverrides() {
  return { ...(loadState().jobNumberOverrides || {}) };
}

export function isJobNumberFormatValid(value) {
  return JOB_NUMBER_RE.test(String(value || '').trim());
}
