import { getActiveWorkspace } from '../app-shell/app-helpers.js';

function workspaceId() {
  return getActiveWorkspace()?.id || 'default';
}

function storageKey(wsId) {
  return `netnet_ws_${wsId}_quick_tasks_ui_v1`;
}

const defaultState = () => ({
  view: 'list',
  statusLens: 'active',
  search: '',
  assignee: 'all',
  duePreset: 'all',
});

let memoryState = defaultState();

function ensureShape(raw) {
  const base = defaultState();
  const next = { ...base, ...(raw || {}) };
  next.view = next.view === 'kanban' ? 'kanban' : 'list';
  next.statusLens = ['active', 'completed', 'archived'].includes(next.statusLens) ? next.statusLens : 'active';
  next.assignee = typeof next.assignee === 'string' && next.assignee ? next.assignee : 'all';
  next.duePreset = ['all', 'overdue', '7', '30'].includes(String(next.duePreset)) ? String(next.duePreset) : 'all';
  next.search = typeof next.search === 'string' ? next.search : '';
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

export function getQuickTasksUIState() {
  return loadState();
}

export function updateQuickTasksUIState(partial = {}) {
  const current = loadState();
  return persist({ ...current, ...(partial || {}) });
}

export function setQuickTasksView(view) {
  return updateQuickTasksUIState({ view });
}

export function setQuickTasksFilters(partial = {}) {
  return updateQuickTasksUIState(partial);
}
