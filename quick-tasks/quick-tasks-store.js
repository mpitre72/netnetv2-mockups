import { getActiveWorkspace } from '../app-shell/app-helpers.js';
import { getContactsData, getIndividualsData } from '../contacts/contacts-data.js';
import {
  getTaskCompletedTimestamp,
  getTaskStartTimestamp,
  mergeTaskLifecycleFields,
  normalizeTaskLifecycleStatus,
} from '../jobs/task-execution-utils.js';

const FALLBACK_SERVICE_TYPES = [
  { id: 'pm', name: 'Project Management', billable: true, baseRate: 0, status: 'active', serviceGroupId: null },
  { id: 'design', name: 'Design', billable: true, baseRate: 0, status: 'active', serviceGroupId: null },
  { id: 'development', name: 'Development', billable: true, baseRate: 0, status: 'active', serviceGroupId: null },
  { id: 'seo', name: 'SEO', billable: true, baseRate: 0, status: 'active', serviceGroupId: null },
];

const LEGACY_SERVICE_TYPE_IDS = new Set(['branding', 'web', 'dev', 'video', 'print']);
const LEGACY_TEAM_EMAILS = new Set([
  'marc@netnet.com',
  'jade@netnet.com',
  'sam@netnet.com',
  'avery@netnet.com',
]);
const VALID_TASK_STATUSES = new Set(['backlog', 'in_progress', 'completed', 'archived']);

function workspaceId() {
  return getActiveWorkspace()?.id || 'default';
}

function quickTasksKey(wsId) {
  return `netnet_ws_${wsId}_quick_tasks_v1`;
}

function teamKey(wsId) {
  return `netnet_ws_${wsId}_team_v1`;
}

function serviceTypesKey(wsId) {
  return `netnet_ws_${wsId}_service_types_v1`;
}

function readJson(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw);
  } catch (e) {
    return fallback;
  }
}

function writeJson(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    // Ignore storage errors in prototype
  }
}

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

function currentUserEmail() {
  try {
    const stored = localStorage.getItem('netnet_userEmail');
    return normalizeEmail(stored || 'marc@hellonetnet.com');
  } catch (e) {
    return 'marc@hellonetnet.com';
  }
}

function splitName(fullName) {
  const parts = String(fullName || '').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return { firstName: '', lastName: '' };
  if (parts.length === 1) return { firstName: parts[0], lastName: '' };
  return { firstName: parts[0], lastName: parts.slice(1).join(' ') };
}

function createId(prefix) {
  return `${prefix}_${Math.random().toString(36).slice(2, 9)}`;
}

function localDateISO(date = new Date()) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function isLegacyTeamSeed(list) {
  if (!Array.isArray(list) || list.length !== LEGACY_TEAM_EMAILS.size) return false;
  return list.every((member) => LEGACY_TEAM_EMAILS.has(normalizeEmail(member.email)));
}

function isLegacyServiceTypes(list) {
  if (!Array.isArray(list) || list.length !== LEGACY_SERVICE_TYPE_IDS.size) return false;
  return list.every((item) => LEGACY_SERVICE_TYPE_IDS.has(String(item.id)));
}

function ensureTeamSeed(wsId) {
  const seed = [
    {
      id: 'team_marc_pitre',
      name: 'Marc Pitre',
      email: 'marc@hellonetnet.com',
      role: 'owner',
      status: 'active',
      monthlyCapacityHours: 40,
      monthlySeatCost: 18700,
      typicalServiceTypeIds: ['pm', 'design'],
    },
    {
      id: 'team_arthur_iturres',
      name: 'Arthur Iturres',
      email: 'arthur@hellonetnet.com',
      role: 'owner',
      status: 'active',
      monthlyCapacityHours: 40,
      monthlySeatCost: 10450,
      typicalServiceTypeIds: ['development'],
    },
    {
      id: 'team_andres_naranjo',
      name: 'Andres Naranjo',
      email: 'andres@hellonetnet.com',
      role: 'owner',
      status: 'active',
      monthlyCapacityHours: 40,
      monthlySeatCost: 7950,
      typicalServiceTypeIds: ['development'],
    },
    {
      id: 'team_kumail_abas',
      name: 'Kumail Abas',
      email: 'ceo@itkumail.com',
      role: 'admin',
      status: 'active',
      monthlyCapacityHours: 20,
      monthlySeatCost: 3250,
      typicalServiceTypeIds: ['design', 'seo', 'pm'],
    },
  ];
  const existing = readJson(teamKey(wsId), null);
  if (Array.isArray(existing) && existing.length) {
    if (isLegacyTeamSeed(existing)) {
      writeJson(teamKey(wsId), seed);
      return seed;
    }
    return existing;
  }
  writeJson(teamKey(wsId), seed);
  return seed;
}

function ensureServiceTypesSeed(wsId) {
  const existing = readJson(serviceTypesKey(wsId), null);
  if (Array.isArray(existing) && existing.length) {
    if (isLegacyServiceTypes(existing)) {
      writeJson(serviceTypesKey(wsId), FALLBACK_SERVICE_TYPES);
      return FALLBACK_SERVICE_TYPES;
    }
    return existing;
  }
  writeJson(serviceTypesKey(wsId), FALLBACK_SERVICE_TYPES);
  return FALLBACK_SERVICE_TYPES;
}

export function loadTeamMembers(wsId = workspaceId()) {
  const members = ensureTeamSeed(wsId);
  return members.map((member) => {
    const fallback = splitName(member.name);
    return {
      ...member,
      firstName: member.firstName || fallback.firstName || '',
      lastName: member.lastName || fallback.lastName || '',
      photoDataUrl: member.photoDataUrl || null,
      typicalServiceTypeIds: Array.isArray(member.typicalServiceTypeIds) ? member.typicalServiceTypeIds : [],
    };
  });
}

export function loadServiceTypes(wsId = workspaceId()) {
  const list = ensureServiceTypesSeed(wsId);
  return list.map((item) => {
    const active = item.active !== false && item.status !== 'inactive';
    return { ...item, active };
  });
}

export function getCurrentUser(members = loadTeamMembers()) {
  const email = currentUserEmail();
  const match = members.find((member) => normalizeEmail(member.email) === email);
  return match || members[0] || null;
}

export function getCurrentUserId(members = loadTeamMembers()) {
  return getCurrentUser(members)?.id || null;
}

function getSeedContact() {
  const companies = getContactsData();
  const company = Array.isArray(companies) && companies.length ? companies[0] : null;
  if (company) {
    const person = Array.isArray(company.people) && company.people.length ? company.people[0] : null;
    return { companyId: company.id, personId: person ? person.id : null };
  }
  const individuals = getIndividualsData();
  if (Array.isArray(individuals) && individuals.length) {
    return { companyId: null, personId: individuals[0].id };
  }
  return { companyId: null, personId: null };
}

function normalizeStatus(status) {
  return normalizeTaskLifecycleStatus(status, 'in_progress');
}

function normalizeAllocation(allocation = {}) {
  if (!allocation) return null;
  const loeHours = Number(allocation.loeHours);
  const hasActualHours = allocation.actualHours !== undefined && allocation.actualHours !== null && allocation.actualHours !== '';
  const actualHours = hasActualHours ? Number(allocation.actualHours) : null;
  return {
    id: allocation.id || createId('alloc'),
    assigneeUserId: allocation.assigneeUserId || null,
    serviceTypeId: allocation.serviceTypeId || null,
    loeHours: Number.isFinite(loeHours) ? loeHours : null,
    actualHours: Number.isFinite(actualHours) ? actualHours : null,
  };
}

function buildLegacyAllocation(task = {}) {
  if (!task.assigneeUserId && !task.serviceTypeId && task.loeHours === undefined) return [];
  return [normalizeAllocation({
    assigneeUserId: task.assigneeUserId || null,
    serviceTypeId: task.serviceTypeId || null,
    loeHours: task.loeHours,
  })].filter(Boolean);
}

function normalizeAllocations(task = {}) {
  const source = Array.isArray(task.allocations) && task.allocations.length
    ? task.allocations
    : buildLegacyAllocation(task);
  return source.map((allocation) => normalizeAllocation(allocation)).filter(Boolean);
}

function normalizeContext(task = {}) {
  const raw = task.context && typeof task.context === 'object' ? task.context : null;
  const isInternal = raw?.type === 'internal' || (!!task.isInternal && raw?.type !== 'client');
  const type = isInternal ? 'internal' : 'client';
  const companyId = raw?.companyId ?? task.companyId ?? null;
  const personId = raw?.personId ?? task.personId ?? null;
  return {
    type,
    companyId: type === 'client' ? (companyId || null) : null,
    personId: type === 'client' ? (personId || null) : null,
  };
}

function normalizeTimeEntries(entries = []) {
  if (!Array.isArray(entries)) return [];
  return entries.map((entry) => ({
    id: entry?.id || createId('qt_time'),
    date: entry?.date || localDateISO(),
    hours: Number(entry?.hours) || 0,
    note: entry?.note || '',
    createdAt: entry?.createdAt || Date.now(),
    createdByUserId: entry?.createdByUserId || null,
    createdByName: entry?.createdByName || 'Net Net',
    createdVia: entry?.createdVia || 'manual',
  }));
}

function normalizeQuickTask(task = {}) {
  if (!task || typeof task !== 'object') return null;
  const allocations = normalizeAllocations(task);
  const context = normalizeContext(task);
  const status = normalizeStatus(task.status);
  const startTimestamp = getTaskStartTimestamp(task);
  const completedTimestamp = getTaskCompletedTimestamp(task);
  const isArchived = status === 'archived' || !!task.isArchived;
  return {
    id: task.id || createId('qt'),
    title: String(task.title || ''),
    description: String(task.description || ''),
    status,
    dueDate: task.dueDate || null,
    startTimestamp,
    startedAt: startTimestamp,
    completedTimestamp,
    completedAt: completedTimestamp,
    context,
    allocations,
    isArchived,
    createdAt: task.createdAt || Date.now(),
    updatedAt: task.updatedAt || Date.now(),
    createdByUserId: task.createdByUserId || null,
    createdVia: task.createdVia || 'manual',
    jobId: task.jobId ?? null,
    deliverableId: task.deliverableId ?? null,
    timeEntries: normalizeTimeEntries(task.timeEntries || []),
    sourceListItemId: task.sourceListItemId || null,
    sourceListId: task.sourceListId || null,
  };
}

function tasksEqual(a, b) {
  try {
    return JSON.stringify(a) === JSON.stringify(b);
  } catch (e) {
    return false;
  }
}

function seedTask(payload = {}) {
  return normalizeQuickTask(payload);
}

function ensureQuickTasksSeed(wsId) {
  const existing = readJson(quickTasksKey(wsId), null);
  if (Array.isArray(existing) && existing.length) return existing;

  const members = loadTeamMembers(wsId);
  const serviceTypes = loadServiceTypes(wsId).filter((type) => type.active);
  const serviceTypeId = serviceTypes[0]?.id || null;
  const contact = getSeedContact();
  const assignee = members[0]?.id || null;
  const secondAssignee = members[1]?.id || assignee;
  const today = localDateISO();
  const nextWeek = localDateISO(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000));
  const nextTwoWeeks = localDateISO(new Date(Date.now() + 14 * 24 * 60 * 60 * 1000));

  const seed = [
    seedTask({
      title: 'Prepare kickoff recap',
      description: 'Send recap with action items and docs.',
      status: 'backlog',
      dueDate: nextWeek,
      context: { type: 'internal', companyId: null, personId: null },
      allocations: [
        { assigneeUserId: assignee, serviceTypeId, loeHours: 2 },
      ],
      isArchived: false,
      createdAt: Date.now() - 1000 * 60 * 60 * 24 * 3,
      updatedAt: Date.now() - 1000 * 60 * 60 * 24 * 2,
      jobId: null,
      deliverableId: null,
      timeEntries: [
        { id: createId('qt_time'), date: today, hours: 0.5 },
      ],
    }),
    seedTask({
      title: 'Homepage hero tweaks',
      description: 'Refine headline and primary CTA.',
      status: 'in_progress',
      dueDate: nextTwoWeeks,
      context: {
        type: contact.companyId ? 'client' : 'internal',
        companyId: contact.companyId,
        personId: contact.personId,
      },
      allocations: [
        { assigneeUserId: assignee, serviceTypeId, loeHours: 2 },
        { assigneeUserId: secondAssignee, serviceTypeId, loeHours: 2 },
      ],
      isArchived: false,
      createdAt: Date.now() - 1000 * 60 * 60 * 24 * 6,
      updatedAt: Date.now() - 1000 * 60 * 60 * 5,
      jobId: null,
      deliverableId: null,
      timeEntries: [
        { id: createId('qt_time'), date: today, hours: 1.25 },
      ],
    }),
    seedTask({
      title: 'Finalize invoice notes',
      description: 'Review final adjustments before sending.',
      status: 'completed',
      dueDate: today,
      completedAt: today,
      context: { type: 'internal', companyId: null, personId: null },
      allocations: [
        { assigneeUserId: assignee, serviceTypeId, loeHours: 1 },
      ],
      isArchived: false,
      createdAt: Date.now() - 1000 * 60 * 60 * 24 * 10,
      updatedAt: Date.now() - 1000 * 60 * 60 * 24 * 9,
      jobId: null,
      deliverableId: null,
      timeEntries: [
        { id: createId('qt_time'), date: today, hours: 0.75 },
      ],
    }),
  ].filter(Boolean);

  writeJson(quickTasksKey(wsId), seed);
  return seed;
}

function persistTasks(wsId, tasks) {
  const normalized = (Array.isArray(tasks) ? tasks : [])
    .map((task) => normalizeQuickTask(task))
    .filter(Boolean);
  writeJson(quickTasksKey(wsId), normalized);
  return normalized;
}

export function replaceAllTasks(tasks = [], wsId = workspaceId()) {
  return persistTasks(wsId, tasks);
}

export function loadAllTasks(wsId = workspaceId()) {
  const seeded = ensureQuickTasksSeed(wsId);
  const normalized = (Array.isArray(seeded) ? seeded : []).map((task) => normalizeQuickTask(task)).filter(Boolean);
  if (!tasksEqual(seeded, normalized)) {
    persistTasks(wsId, normalized);
  }
  return normalized;
}

export function loadQuickTasks(wsId = workspaceId()) {
  const list = loadAllTasks(wsId);
  return list.filter((task) => !task.jobId && !task.deliverableId);
}

export function getTaskById(taskId, wsId = workspaceId()) {
  const list = loadAllTasks(wsId);
  return list.find((task) => String(task.id) === String(taskId)) || null;
}

export function getTaskAllocations(task) {
  return Array.isArray(task?.allocations) ? task.allocations : [];
}

export function getTaskPrimaryAllocation(task) {
  return getTaskAllocations(task)[0] || null;
}

export function getTaskAssigneeIds(task) {
  return [...new Set(getTaskAllocations(task).map((allocation) => String(allocation.assigneeUserId || '')).filter(Boolean))];
}

export function getTaskServiceTypeIds(task) {
  return [...new Set(getTaskAllocations(task).map((allocation) => String(allocation.serviceTypeId || '')).filter(Boolean))];
}

export function getTaskTotalLoe(task) {
  return getTaskAllocations(task).reduce((sum, allocation) => sum + (Number(allocation?.loeHours) || 0), 0);
}

export function getTaskContext(task) {
  return normalizeContext(task || {});
}

export function createQuickTask(payload, wsId = workspaceId()) {
  const list = loadAllTasks(wsId);
  const now = Date.now();
  const task = normalizeQuickTask(mergeTaskLifecycleFields({}, {
    ...payload,
    id: payload.id || createId('qt'),
    status: payload.status || 'in_progress',
    createdAt: payload.createdAt || now,
    updatedAt: now,
    createdByUserId: payload.createdByUserId || getCurrentUserId(),
    jobId: payload.jobId ?? null,
    deliverableId: payload.deliverableId ?? null,
  }));
  list.unshift(task);
  persistTasks(wsId, list);
  return task;
}

export function updateTask(taskId, updates = {}, wsId = workspaceId()) {
  const list = loadAllTasks(wsId);
  const idx = list.findIndex((task) => String(task.id) === String(taskId));
  if (idx < 0) return null;
  const merged = mergeTaskLifecycleFields(list[idx], updates || {});
  const next = normalizeQuickTask({
    ...list[idx],
    ...merged,
    updatedAt: Date.now(),
  });
  list[idx] = next;
  persistTasks(wsId, list);
  return next;
}

export function canDeleteTask(task) {
  if (!task) return false;
  const hasTime = Array.isArray(task.timeEntries) && task.timeEntries.length > 0;
  return !hasTime;
}

export function deleteTask(taskId, wsId = workspaceId()) {
  const list = loadAllTasks(wsId);
  const target = list.find((task) => String(task.id) === String(taskId));
  if (!target) return { ok: false, reason: 'Task not found.' };
  if (!canDeleteTask(target)) {
    return { ok: false, reason: 'Cannot delete task with logged time.' };
  }
  const next = list.filter((task) => String(task.id) !== String(taskId));
  persistTasks(wsId, next);
  return { ok: true };
}

export function archiveTask(taskId, wsId = workspaceId()) {
  return updateTask(taskId, { status: 'archived', isArchived: true }, wsId);
}

export function setTaskStatus(taskId, status, options = {}, wsId = workspaceId()) {
  if (!status) return null;
  const lifecyclePatch = {
    status,
    isArchived: status === 'archived',
  };
  if (options.startTimestamp !== undefined) lifecyclePatch.startTimestamp = options.startTimestamp;
  if (options.startedAt !== undefined) lifecyclePatch.startedAt = options.startedAt;
  if (options.completedTimestamp !== undefined) lifecyclePatch.completedTimestamp = options.completedTimestamp;
  if (options.completedAt !== undefined) lifecyclePatch.completedAt = options.completedAt;
  const next = mergeTaskLifecycleFields(getTaskById(taskId, wsId) || {}, lifecyclePatch);
  return updateTask(taskId, next, wsId);
}

export function addTimeEntry(taskId, entry, wsId = workspaceId()) {
  const task = getTaskById(taskId, wsId);
  if (!task) return null;
  const timeEntries = Array.isArray(task.timeEntries) ? [...task.timeEntries] : [];
  const user = getCurrentUser();
  const userId = getCurrentUserId();
  const nextEntry = {
    id: entry?.id || createId('qt_time'),
    date: entry?.date || localDateISO(),
    hours: Number(entry?.hours) || 0,
    note: entry?.note || '',
    createdAt: entry?.createdAt || Date.now(),
    createdByUserId: entry?.createdByUserId || userId,
    createdByName: entry?.createdByName || user?.name || 'Net Net',
    createdVia: entry?.createdVia || 'manual',
  };
  timeEntries.push(nextEntry);
  return updateTask(taskId, { timeEntries }, wsId);
}

export function promoteToJobTask(taskId, { jobId, deliverableId, serviceTypeId } = {}, wsId = workspaceId()) {
  if (!jobId || !deliverableId) return null;
  const task = getTaskById(taskId, wsId);
  if (!task) return null;
  const allocations = getTaskAllocations(task).map((allocation) => ({
    ...allocation,
    serviceTypeId: serviceTypeId || allocation.serviceTypeId || null,
  }));
  return updateTask(taskId, { jobId, deliverableId, allocations }, wsId);
}

export function getTaskActualHours(task) {
  if (!task || !Array.isArray(task.timeEntries)) return 0;
  return task.timeEntries.reduce((sum, entry) => sum + (Number(entry.hours) || 0), 0);
}

export function getServiceTypeById(id, serviceTypes = loadServiceTypes()) {
  return serviceTypes.find((type) => String(type.id) === String(id)) || null;
}

export function getMemberById(id, members = loadTeamMembers()) {
  return members.find((member) => String(member.id) === String(id)) || null;
}

export function getLocalDateISO(date = new Date()) {
  return localDateISO(date);
}
