import { getActiveWorkspace } from '../app-shell/app-helpers.js';
import { getContactsData, getIndividualsData } from '../contacts/contacts-data.js';
import { loadJobs } from '../jobs/jobs-store.js';
import { loadQuickTasks } from '../quick-tasks/quick-tasks-store.js';
import { getMyTimeSeedEntries } from './time-data.js';

function workspaceId() {
  return getActiveWorkspace()?.id || 'default';
}

function myTimeEntriesKey(wsId) {
  return `netnet_ws_${wsId}_my_time_entries_v2`;
}

function normalizeText(value) {
  return String(value || '').trim().toLowerCase();
}

function readJson(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw);
  } catch (error) {
    return fallback;
  }
}

function writeJson(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (error) {
    // Ignore prototype storage failures.
  }
}

function entriesEqual(a, b) {
  try {
    return JSON.stringify(a) === JSON.stringify(b);
  } catch (error) {
    return false;
  }
}

function buildCompanyMap() {
  return new Map((getContactsData() || []).map((company) => [String(company.id), company]));
}

function buildPersonMap(companyMap) {
  const people = [];
  companyMap.forEach((company) => {
    (company.people || []).forEach((person) => {
      people.push([String(person.id), person]);
    });
  });
  (getIndividualsData() || []).forEach((person) => {
    people.push([String(person.id), person]);
  });
  return new Map(people);
}

function resolveClientName(companyId, personId, companyMap, personMap) {
  const company = companyId ? companyMap.get(String(companyId)) : null;
  if (company) return company.name || company.companyName || '';
  const person = personId ? personMap.get(String(personId)) : null;
  if (!person) return '';
  return person.name || [person.firstName, person.lastName].filter(Boolean).join(' ').trim() || '';
}

function sortCatalogEntries(entries = []) {
  return [...entries].sort((a, b) => {
    const titleDiff = String(a.title || '').localeCompare(String(b.title || ''));
    if (titleDiff !== 0) return titleDiff;
    const jobDiff = String(a.jobName || '').localeCompare(String(b.jobName || ''));
    if (jobDiff !== 0) return jobDiff;
    return String(a.id || '').localeCompare(String(b.id || ''));
  });
}

function buildSearchIndex(parts = []) {
  return normalizeText(parts.filter(Boolean).join(' '));
}

function normalizeCatalogTask(entry = {}) {
  return {
    id: String(entry.id || ''),
    source: entry.source === 'quick' ? 'quick' : 'job',
    sourceId: String(entry.sourceId || ''),
    title: String(entry.title || 'Untitled task'),
    description: String(entry.description || ''),
    jobName: String(entry.jobName || ''),
    deliverableName: String(entry.deliverableName || ''),
    contextType: entry.contextType === 'internal' ? 'internal' : 'client',
    companyName: String(entry.companyName || ''),
    serviceType: String(entry.serviceType || ''),
    searchIndex: buildSearchIndex([
      entry.title,
      entry.description,
      entry.jobName,
      entry.deliverableName,
      entry.companyName,
      entry.serviceType,
    ]),
  };
}

function buildQuickTaskCatalog(companyMap, personMap) {
  return loadQuickTasks()
    .filter((task) => task && !task.isArchived && task.status !== 'archived')
    .map((task) => {
      const context = task?.context && typeof task.context === 'object' ? task.context : {};
      const contextType = context.type === 'internal' ? 'internal' : 'client';
      return normalizeCatalogTask({
        id: `quick:${String(task.id || '')}`,
        source: 'quick',
        sourceId: String(task.id || ''),
        title: task.title || '',
        description: task.description || '',
        jobName: '',
        deliverableName: '',
        contextType,
        companyName: contextType === 'internal'
          ? ''
          : resolveClientName(context.companyId, context.personId, companyMap, personMap),
        serviceType: '',
      });
    });
}

function buildJobTaskCatalog(companyMap, personMap) {
  const entries = [];

  loadJobs().forEach((job) => {
    const contextType = job?.isInternal ? 'internal' : 'client';
    const companyName = contextType === 'internal'
      ? ''
      : resolveClientName(job?.companyId, job?.personId, companyMap, personMap);

    const pushTask = (task, deliverableName = '') => {
      if (!task || task.isArchived || task.status === 'archived') return;
      entries.push(normalizeCatalogTask({
        id: `job:${String(task.id || '')}`,
        source: 'job',
        sourceId: String(task.id || ''),
        title: task.title || '',
        description: task.description || '',
        jobName: job?.name || '',
        deliverableName,
        contextType,
        companyName,
        serviceType: '',
      }));
    };

    (job?.deliverables || []).forEach((deliverable) => {
      (deliverable?.tasks || []).forEach((task) => pushTask(task, deliverable?.name || ''));
    });

    (job?.unassignedTasks || []).forEach((task) => pushTask(task, ''));
  });

  return entries;
}

export function loadPermittedMyTimeTaskCatalog({ actorUserId = '', actorRole = '' } = {}) {
  const companyMap = buildCompanyMap();
  const personMap = buildPersonMap(companyMap);
  const allTasks = [
    ...buildQuickTaskCatalog(companyMap, personMap),
    ...buildJobTaskCatalog(companyMap, personMap),
  ];

  // Pack 2 allows relinking against all valid existing tasks the actor can correct against.
  // The current prototype shell does not yet expose narrower task-visibility rules, so we
  // surface the full valid catalog for every actor while keeping the role-aware function
  // signature ready for later permission hardening.
  void actorUserId;
  void actorRole;

  const unique = new Map();
  allTasks.forEach((task) => {
    if (!task.id) return;
    unique.set(task.id, task);
  });
  return sortCatalogEntries([...unique.values()]);
}

export function findMyTimeTask(taskId, catalog = []) {
  return catalog.find((task) => String(task.id) === String(taskId)) || null;
}

function findBestTaskMatch(entry, catalog = []) {
  if (!catalog.length) return null;
  const titleNeedle = normalizeText(entry.taskTitle);
  const companyNeedle = normalizeText(entry.companyName);
  const jobNeedle = normalizeText(entry.jobName);

  const exactTitle = catalog.find((task) => normalizeText(task.title) === titleNeedle);
  if (exactTitle) return exactTitle;

  const contextualTitle = catalog.find((task) => (
    normalizeText(task.title).includes(titleNeedle)
    && (!companyNeedle || normalizeText(task.companyName) === companyNeedle)
  ));
  if (contextualTitle) return contextualTitle;

  const exactJob = catalog.find((task) => normalizeText(task.jobName) === jobNeedle && (!!task.jobName || !!jobNeedle));
  if (exactJob) return exactJob;

  const sameCompany = catalog.find((task) => normalizeText(task.companyName) === companyNeedle && (!!task.companyName || !!companyNeedle));
  if (sameCompany) return sameCompany;

  const sameContext = catalog.find((task) => task.contextType === entry.contextType);
  if (sameContext) return sameContext;

  return catalog[0] || null;
}

function normalizeDurationMinutes(entry = {}) {
  if (Number.isFinite(entry.duration_minutes)) return Math.max(0, Math.round(entry.duration_minutes));
  if (Number.isFinite(entry.durationMinutes)) return Math.max(0, Math.round(entry.durationMinutes));
  if (Number.isFinite(entry.durationHours)) return Math.max(0, Math.round(Number(entry.durationHours) * 60));
  return 0;
}

function bindEntryToTask(entry, task) {
  if (!task) return entry;
  return {
    ...entry,
    taskId: task.id,
    taskSource: task.source,
    taskSourceId: task.sourceId,
    taskTitle: task.title,
    jobName: task.jobName,
    deliverableName: task.deliverableName,
    contextType: task.contextType,
    companyName: task.companyName,
  };
}

function normalizeStoredEntry(entry = {}, catalog = []) {
  const normalized = {
    id: String(entry.id || ''),
    userId: String(entry.userId || ''),
    taskId: String(entry.taskId || ''),
    taskSource: entry.taskSource === 'quick' ? 'quick' : 'job',
    taskSourceId: String(entry.taskSourceId || ''),
    taskTitle: String(entry.taskTitle || 'Untitled task'),
    jobName: String(entry.jobName || ''),
    deliverableName: String(entry.deliverableName || ''),
    contextType: entry.contextType === 'internal' ? 'internal' : 'client',
    companyName: String(entry.companyName || ''),
    notes: String(entry.notes || ''),
    date: String(entry.date || ''),
    duration_minutes: normalizeDurationMinutes(entry),
    entryType: entry.entryType === 'manual' ? 'manual' : 'timer',
    startTime: String(entry.startTime || ''),
    endTime: String(entry.endTime || ''),
    lockReason: String(entry.lockReason || ''),
  };

  const linkedTask = findMyTimeTask(normalized.taskId, catalog) || findBestTaskMatch(normalized, catalog);
  if (!linkedTask) return normalized;

  if (!normalized.taskId) {
    return {
      ...normalized,
      taskId: linkedTask.id,
      taskSource: linkedTask.source,
      taskSourceId: linkedTask.sourceId,
    };
  }

  return normalized;
}

function seedEntries(now = new Date(), catalog = []) {
  return (getMyTimeSeedEntries(now) || []).map((entry) => normalizeStoredEntry(entry, catalog));
}

function mergeStoredEntriesWithSeeds(storedEntries = [], seededEntries = []) {
  if (!Array.isArray(storedEntries) || !storedEntries.length) return seededEntries;
  const existingIds = new Set(storedEntries.map((entry) => String(entry?.id || '')));
  const missingSeeds = seededEntries.filter((entry) => !existingIds.has(String(entry?.id || '')));
  return missingSeeds.length ? [...storedEntries, ...missingSeeds] : storedEntries;
}

export function loadMyTimeTaskLockMap() {
  const map = new Map();

  loadQuickTasks().forEach((task) => {
    if (!task?.id) return;
    const isArchived = !!task.isArchived || task.status === 'archived';
    if (!isArchived) return;
    map.set(`quick:${String(task.id)}`, 'Locked while this task is archived.');
  });

  loadJobs().forEach((job) => {
    const jobIsArchived = job?.status === 'archived' || !!job?.archivedAt;
    const reasonForTask = (task) => {
      const taskIsArchived = !!task?.isArchived || task?.status === 'archived';
      if (jobIsArchived) return 'Locked while parent work is archived.';
      if (taskIsArchived) return 'Locked while this task is archived.';
      return '';
    };

    const registerTask = (task) => {
      if (!task?.id) return;
      const reason = reasonForTask(task);
      if (!reason) return;
      map.set(`job:${String(task.id)}`, reason);
    };

    (job?.deliverables || []).forEach((deliverable) => {
      (deliverable?.tasks || []).forEach(registerTask);
    });

    (job?.unassignedTasks || []).forEach(registerTask);
  });

  return map;
}

function resolveEntryLockReason(entry, taskLockMap = null) {
  const explicit = String(entry?.lockReason || '').trim();
  if (explicit) return explicit;
  const map = taskLockMap instanceof Map ? taskLockMap : loadMyTimeTaskLockMap();
  const keys = [
    String(entry?.taskId || ''),
    entry?.taskSource && entry?.taskSourceId ? `${entry.taskSource}:${entry.taskSourceId}` : '',
  ].filter(Boolean);
  for (const key of keys) {
    const reason = map.get(key);
    if (reason) return reason;
  }
  return '';
}

export function getMyTimeEntryAccess(entry, {
  actorUserId = '',
  actorRole = '',
  selectedUserId = '',
  taskLockMap = null,
} = {}) {
  const role = normalizeText(actorRole);
  const isAdminLike = role === 'owner' || role === 'admin';
  const targetUserId = isAdminLike ? String(selectedUserId || actorUserId || '') : String(actorUserId || '');
  const ownsVisibleEntry = String(entry?.userId || '') === targetUserId;
  const permissionReason = ownsVisibleEntry
    ? ''
    : (isAdminLike ? 'Switch to the matching user to change this entry.' : 'You can only change your own time.');
  const lockReason = resolveEntryLockReason(entry, taskLockMap);
  const isLocked = !!lockReason;
  const mutationReason = lockReason || permissionReason;
  const canMutate = ownsVisibleEntry && !isLocked;

  return {
    canEdit: canMutate,
    canDuplicate: canMutate,
    canDelete: canMutate,
    isLocked,
    lockReason,
    rowStateLabel: isLocked ? 'Locked' : (!ownsVisibleEntry ? 'View-only' : ''),
    rowStateReason: mutationReason,
    duplicateReason: mutationReason,
    deleteReason: mutationReason,
  };
}

export function loadMyTimeEntries({ now = new Date(), catalog = null, wsId = workspaceId() } = {}) {
  const taskCatalog = Array.isArray(catalog) ? catalog : loadPermittedMyTimeTaskCatalog();
  const key = myTimeEntriesKey(wsId);
  const stored = readJson(key, null);
  const seeded = seedEntries(now, taskCatalog);
  const source = mergeStoredEntriesWithSeeds(Array.isArray(stored) ? stored : [], seeded);
  const normalized = source.map((entry) => normalizeStoredEntry(entry, taskCatalog));

  if (!Array.isArray(stored) || !entriesEqual(stored, normalized)) {
    writeJson(key, normalized);
  }

  return normalized;
}

export function updateMyTimeEntry(entryId, updates = {}, {
  now = new Date(),
  catalog = null,
  wsId = workspaceId(),
  actorUserId = '',
  actorRole = '',
  selectedUserId = '',
  taskLockMap = null,
} = {}) {
  const taskCatalog = Array.isArray(catalog) ? catalog : loadPermittedMyTimeTaskCatalog();
  const currentEntries = loadMyTimeEntries({ now, catalog: taskCatalog, wsId });
  const currentEntry = currentEntries.find((entry) => String(entry.id) === String(entryId));
  if (!currentEntry) return currentEntries;
  const access = getMyTimeEntryAccess(currentEntry, { actorUserId, actorRole, selectedUserId, taskLockMap });
  if (!access.canEdit) return currentEntries;
  const nextEntries = currentEntries.map((entry) => {
    if (String(entry.id) !== String(entryId)) return entry;
    const merged = normalizeStoredEntry({ ...entry, ...updates }, taskCatalog);
    if (updates.nextTaskId) {
      const nextTask = findMyTimeTask(updates.nextTaskId, taskCatalog);
      return normalizeStoredEntry(bindEntryToTask(merged, nextTask), taskCatalog);
    }
    return merged;
  });
  writeJson(myTimeEntriesKey(wsId), nextEntries);
  return nextEntries;
}

function buildDuplicateEntryId(entry, currentEntries = []) {
  const base = `${String(entry?.id || 'my-time-entry')}-copy`;
  const existingIds = new Set(currentEntries.map((item) => String(item?.id || '')));
  let suffix = 1;
  let candidate = `${base}-${suffix}`;
  while (existingIds.has(candidate)) {
    suffix += 1;
    candidate = `${base}-${suffix}`;
  }
  return candidate;
}

export function duplicateMyTimeEntry(entryId, {
  now = new Date(),
  catalog = null,
  wsId = workspaceId(),
  actorUserId = '',
  actorRole = '',
  selectedUserId = '',
  taskLockMap = null,
} = {}) {
  const taskCatalog = Array.isArray(catalog) ? catalog : loadPermittedMyTimeTaskCatalog();
  const currentEntries = loadMyTimeEntries({ now, catalog: taskCatalog, wsId });
  const sourceEntry = currentEntries.find((entry) => String(entry.id) === String(entryId));
  if (!sourceEntry) return currentEntries;
  const access = getMyTimeEntryAccess(sourceEntry, { actorUserId, actorRole, selectedUserId, taskLockMap });
  if (!access.canDuplicate) return currentEntries;

  const duplicate = normalizeStoredEntry({
    ...sourceEntry,
    id: buildDuplicateEntryId(sourceEntry, currentEntries),
  }, taskCatalog);

  const insertAt = currentEntries.findIndex((entry) => String(entry.id) === String(entryId));
  const nextEntries = [...currentEntries];
  nextEntries.splice(insertAt >= 0 ? insertAt + 1 : nextEntries.length, 0, duplicate);
  writeJson(myTimeEntriesKey(wsId), nextEntries);
  return nextEntries;
}

export function deleteMyTimeEntry(entryId, {
  now = new Date(),
  catalog = null,
  wsId = workspaceId(),
  actorUserId = '',
  actorRole = '',
  selectedUserId = '',
  taskLockMap = null,
} = {}) {
  const taskCatalog = Array.isArray(catalog) ? catalog : loadPermittedMyTimeTaskCatalog();
  const currentEntries = loadMyTimeEntries({ now, catalog: taskCatalog, wsId });
  const sourceEntry = currentEntries.find((entry) => String(entry.id) === String(entryId));
  if (!sourceEntry) return currentEntries;
  const access = getMyTimeEntryAccess(sourceEntry, { actorUserId, actorRole, selectedUserId, taskLockMap });
  if (!access.canDelete) return currentEntries;
  const nextEntries = currentEntries.filter((entry) => String(entry.id) !== String(entryId));
  writeJson(myTimeEntriesKey(wsId), nextEntries);
  return nextEntries;
}
