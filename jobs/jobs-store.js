import { getActiveWorkspace } from '../app-shell/app-helpers.js';
import { loadServiceTypes } from '../quick-tasks/quick-tasks-store.js';
import { getContactsData, getIndividualsData } from '../contacts/contacts-data.js';

const VALID_KINDS = new Set(['project', 'retainer']);
const VALID_STATUSES = new Set(['pending', 'active', 'completed', 'archived']);
const VALID_TASK_STATUSES = new Set(['backlog', 'in_progress', 'completed']);
const VALID_LIFECYCLE_STATUSES = new Set(['pending', 'active', 'completed']);
const DEFAULT_USER_ID = 'currentUser';

function workspaceId() {
  return getActiveWorkspace()?.id || 'default';
}

function jobsKey(wsId) {
  return `netnet_ws_${wsId}_jobs_v1`;
}

function normalizeJobsStore(raw) {
  if (Array.isArray(raw)) {
    return { jobs: raw, jobsChatMessages: [] };
  }
  if (raw && typeof raw === 'object') {
    return {
      jobs: Array.isArray(raw.jobs) ? raw.jobs : [],
      jobsChatMessages: Array.isArray(raw.jobsChatMessages) ? raw.jobsChatMessages : [],
    };
  }
  return { jobs: [], jobsChatMessages: [] };
}

function readJobsStore(wsId) {
  return normalizeJobsStore(readJson(jobsKey(wsId), null));
}

function writeJobsStore(wsId, store) {
  writeJson(jobsKey(wsId), {
    jobs: Array.isArray(store.jobs) ? store.jobs : [],
    jobsChatMessages: Array.isArray(store.jobsChatMessages) ? store.jobsChatMessages : [],
  });
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

function createId(prefix) {
  return `${prefix}_${Math.random().toString(36).slice(2, 9)}`;
}

function localDateISO(date = new Date()) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getSeedContact(index = 0) {
  const companies = getContactsData();
  const company = Array.isArray(companies) && companies.length > index ? companies[index] : null;
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

function normalizePools(pools = []) {
  if (!Array.isArray(pools)) return [];
  return pools
    .map((pool) => {
      if (!pool || !pool.serviceTypeId) return null;
      const estimatedHours = Number(pool.estimatedHours) || 0;
      if (estimatedHours <= 0) return null;
      const next = {
        serviceTypeId: pool.serviceTypeId,
        estimatedHours,
      };
      if (Number.isFinite(pool.assignedHours)) next.assignedHours = Number(pool.assignedHours) || 0;
      if (Number.isFinite(pool.actualHours)) next.actualHours = Number(pool.actualHours) || 0;
      return next;
    })
    .filter(Boolean);
}

function normalizePoolsByCycle(poolsByCycle = {}) {
  if (!poolsByCycle || typeof poolsByCycle !== 'object') return {};
  const next = {};
  Object.keys(poolsByCycle).forEach((key) => {
    const pools = normalizePools(poolsByCycle[key] || []);
    if (pools.length) next[key] = pools;
  });
  return next;
}

function normalizeAllocations(allocations = []) {
  if (!Array.isArray(allocations)) return [];
  return allocations
    .map((allocation) => {
      if (!allocation) return null;
      const loeHours = Number(allocation.loeHours);
      return {
        id: allocation.id || createId('alloc'),
        assigneeUserId: allocation.assigneeUserId || null,
        serviceTypeId: allocation.serviceTypeId || null,
        loeHours: Number.isFinite(loeHours) ? loeHours : null,
      };
    })
    .filter(Boolean);
}

function normalizeTasks(tasks = [], { jobId, deliverableId } = {}) {
  if (!Array.isArray(tasks)) return [];
  return tasks
    .map((task) => {
      if (!task) return null;
      const title = String(task.title || '').trim();
      if (!title) return null;
      const status = VALID_TASK_STATUSES.has(task.status) ? task.status : 'backlog';
      return {
        id: task.id || createId('task'),
        jobId: task.jobId || jobId || null,
        deliverableId: task.deliverableId || deliverableId || null,
        title,
        description: task.description ? String(task.description) : '',
        status,
        isDraft: !!task.isDraft,
        isRecurring: !!task.isRecurring,
        recurringTemplateId: task.recurringTemplateId || null,
        dueDate: task.dueDate || null,
        completedAt: status === 'completed' ? (task.completedAt || null) : null,
        cycleKey: task.cycleKey || null,
        allocations: normalizeAllocations(task.allocations || []),
      };
    })
    .filter(Boolean);
}

function normalizeDueDateHistory(entries = []) {
  if (!Array.isArray(entries)) return [];
  return entries
    .map((entry) => {
      if (!entry) return null;
      const fromDate = entry.fromDate || null;
      const toDate = entry.toDate || null;
      const changedAt = entry.changedAt || null;
      const changedByUserId = entry.changedByUserId || null;
      return { fromDate, toDate, changedAt, changedByUserId };
    })
    .filter(Boolean);
}

function normalizeDeliverables(deliverables = [], jobId) {
  if (!Array.isArray(deliverables)) return [];
  return deliverables
    .map((deliverable) => {
      const name = String(deliverable?.name || '').trim();
      if (!name) return null;
      const deliverableId = deliverable.id || createId('del');
      return {
        id: deliverableId,
        name,
        dueDate: deliverable.dueDate || null,
        originalDueDate: deliverable.originalDueDate || null,
        dueDateHistory: normalizeDueDateHistory(deliverable.dueDateHistory || []),
        dependencyDeliverableIds: Array.isArray(deliverable.dependencyDeliverableIds)
          ? deliverable.dependencyDeliverableIds.map((id) => String(id)).filter(Boolean)
          : [],
        poolsByCycle: normalizePoolsByCycle(deliverable.poolsByCycle || {}),
        pools: normalizePools(deliverable.pools || []),
        tasks: normalizeTasks(deliverable.tasks || [], { jobId, deliverableId }),
      };
    })
    .filter(Boolean);
}

function normalizeMentions(mentions = {}) {
  const peopleMentions = Array.isArray(mentions.peopleMentions)
    ? mentions.peopleMentions.map((id) => String(id)).filter(Boolean)
    : [];
  const smart = mentions.smartMentions || {};
  const deliverableIds = Array.isArray(smart.deliverableIds)
    ? smart.deliverableIds.map((id) => String(id)).filter(Boolean)
    : [];
  const taskIds = Array.isArray(smart.taskIds)
    ? smart.taskIds.map((id) => String(id)).filter(Boolean)
    : [];
  return {
    peopleMentions,
    smartMentions: { deliverableIds, taskIds },
  };
}

function normalizeTagTarget(target = {}, fallback = {}) {
  if (target?.type === 'task') {
    return {
      type: 'task',
      deliverableId: target.deliverableId || fallback.deliverableId || null,
      taskId: target.taskId || fallback.taskId || null,
    };
  }
  if (target?.type === 'deliverable') {
    return {
      type: 'deliverable',
      deliverableId: target.deliverableId || fallback.deliverableId || null,
      taskId: null,
    };
  }
  return { type: 'job', deliverableId: null, taskId: null };
}

function normalizeChatMessage(message) {
  if (!message || !message.jobId) return null;
  const body = String(message.body || '').trim();
  if (!body) return null;
  const deliverableId = message.deliverableId ? String(message.deliverableId) : null;
  const taskId = message.taskId ? String(message.taskId) : null;
  const tagTarget = normalizeTagTarget(message.tagTarget, { deliverableId, taskId });
  return {
    id: message.id || createId('msg'),
    jobId: String(message.jobId),
    deliverableId: tagTarget.deliverableId || null,
    taskId: tagTarget.taskId || null,
    authorUserId: message.authorUserId || DEFAULT_USER_ID,
    createdAt: message.createdAt || new Date().toISOString(),
    body,
    mentions: normalizeMentions(message.mentions || {}),
    tagTarget,
    editedAt: message.editedAt || null,
    retagHistory: Array.isArray(message.retagHistory) ? message.retagHistory : [],
  };
}

function normalizeChatMessages(messages = []) {
  if (!Array.isArray(messages)) return [];
  return messages.map((message) => normalizeChatMessage(message)).filter(Boolean);
}

function ensureJobsSeed(wsId) {
  const store = readJobsStore(wsId);
  if (Array.isArray(store.jobs) && store.jobs.length) return store;

  const serviceTypes = loadServiceTypes(wsId).filter((type) => type.active);
  const typeIds = serviceTypes.map((type) => type.id);
  const pickType = (index, fallbackIndex = 0) => typeIds[index] || typeIds[fallbackIndex] || null;
  const pmId = pickType(0);
  const designId = pickType(1);
  const devId = pickType(2);
  const seoId = pickType(3);

  const clientA = getSeedContact(0);
  const clientB = getSeedContact(1);
  const clientC = getSeedContact(2);
  const now = Date.now();
  const day = 24 * 60 * 60 * 1000;
  const today = localDateISO();
  const nextWeek = localDateISO(new Date(now + 7 * day));
  const nextMonth = localDateISO(new Date(now + 30 * day));
  const lastWeek = localDateISO(new Date(now - 7 * day));
  const currentCycleKey = today.slice(0, 7);
  const nextCycleKey = nextMonth.slice(0, 7);
  const designDeliverableId = createId('del');
  const buildDeliverableId = createId('del');

  const pool = (serviceTypeId, estimatedHours, extras = {}) => {
    if (!serviceTypeId || estimatedHours <= 0) return null;
    return {
      serviceTypeId,
      estimatedHours,
      ...extras,
    };
  };

  const seed = [
    {
      id: createId('job'),
      name: 'Northbridge Website Refresh',
      kind: 'project',
      status: 'active',
      lastNonArchivedStatus: null,
      archivedAt: null,
      archivedByUserId: null,
      completedAt: null,
      completedByUserId: null,
      isInternal: false,
      companyId: clientA.companyId,
      personId: clientA.personId,
      serviceTypeIds: [designId, devId, pmId].filter(Boolean),
      startDate: lastWeek,
      targetEndDate: nextMonth,
      createdAt: now - 28 * day,
      updatedAt: now - 2 * day,
      deliverables: [
        {
          id: designDeliverableId,
          name: 'UX + Visual Design',
          dueDate: nextWeek,
          dependencyDeliverableIds: [],
          pools: [
            pool(designId, 42, { assignedHours: 16, actualHours: 12 }),
            pool(pmId, 8, { assignedHours: 3, actualHours: 2 }),
          ].filter(Boolean),
          tasks: [],
        },
        {
          id: buildDeliverableId,
          name: 'Frontend Build',
          dueDate: nextMonth,
          dependencyDeliverableIds: [designDeliverableId],
          pools: [
            pool(devId, 60, { assignedHours: 20, actualHours: 10 }),
            pool(pmId, 10, { assignedHours: 4, actualHours: 3 }),
          ].filter(Boolean),
          tasks: [],
        },
      ],
    },
    {
      id: createId('job'),
      name: 'Retainer: Growth Support',
      kind: 'retainer',
      status: 'pending',
      lastNonArchivedStatus: null,
      archivedAt: null,
      archivedByUserId: null,
      completedAt: null,
      completedByUserId: null,
      isInternal: false,
      companyId: clientB.companyId,
      personId: clientB.personId,
      currentCycleKey,
      serviceTypeIds: [seoId, designId, pmId].filter(Boolean),
      createdAt: now - 10 * day,
      updatedAt: now - 3 * day,
      deliverables: [
        {
          id: createId('del'),
          name: 'Monthly Optimization',
          dueDate: null,
          poolsByCycle: {
            [currentCycleKey]: [
              pool(seoId, 20),
              pool(pmId, 6),
            ].filter(Boolean),
            [nextCycleKey]: [
              pool(seoId, 18),
              pool(pmId, 6),
            ].filter(Boolean),
          },
          pools: [
            pool(seoId, 20),
            pool(pmId, 6),
          ].filter(Boolean),
          tasks: [],
        },
        {
          id: createId('del'),
          name: 'Campaign Creative',
          dueDate: null,
          poolsByCycle: {
            [currentCycleKey]: [
              pool(designId, 12),
            ].filter(Boolean),
            [nextCycleKey]: [
              pool(designId, 10),
              pool(pmId, 4),
            ].filter(Boolean),
          },
          pools: [
            pool(designId, 12),
          ].filter(Boolean),
          tasks: [],
        },
      ],
    },
    {
      id: createId('job'),
      name: 'Internal Brand System',
      kind: 'project',
      status: 'completed',
      lastNonArchivedStatus: null,
      archivedAt: null,
      archivedByUserId: null,
      completedAt: today,
      completedByUserId: DEFAULT_USER_ID,
      isInternal: true,
      companyId: null,
      personId: null,
      serviceTypeIds: [designId, pmId].filter(Boolean),
      startDate: lastWeek,
      targetEndDate: today,
      createdAt: now - 60 * day,
      updatedAt: now - 14 * day,
      deliverables: [
        {
          id: createId('del'),
          name: 'Identity System',
          dueDate: today,
          pools: [
            pool(designId, 30, { actualHours: 28 }),
            pool(pmId, 6, { actualHours: 5 }),
          ].filter(Boolean),
          tasks: [],
        },
      ],
    },
    {
      id: createId('job'),
      name: 'Archived: SEO Tune-Up',
      kind: 'project',
      status: 'archived',
      lastNonArchivedStatus: 'completed',
      archivedAt: today,
      archivedByUserId: DEFAULT_USER_ID,
      completedAt: lastWeek,
      completedByUserId: DEFAULT_USER_ID,
      isInternal: false,
      companyId: clientC.companyId,
      personId: clientC.personId,
      serviceTypeIds: [seoId, pmId].filter(Boolean),
      createdAt: now - 120 * day,
      updatedAt: now - 90 * day,
      deliverables: [
        {
          id: createId('del'),
          name: 'Technical Audit',
          dueDate: null,
          pools: [
            pool(seoId, 16),
            pool(pmId, 4),
          ].filter(Boolean),
          tasks: [],
        },
      ],
    },
  ];

  store.jobs = seed;
  store.jobsChatMessages = Array.isArray(store.jobsChatMessages) ? store.jobsChatMessages : [];
  writeJobsStore(wsId, store);
  return store;
}

function persistJobsStore(wsId, store) {
  writeJobsStore(wsId, store);
  return store;
}

function normalizeStatus(status) {
  return VALID_STATUSES.has(status) ? status : 'pending';
}

function normalizeKind(kind) {
  return VALID_KINDS.has(kind) ? kind : 'project';
}

function normalizeLifecycleStatus(value) {
  return VALID_LIFECYCLE_STATUSES.has(value) ? value : null;
}

function normalizeJobLifecycle(job) {
  if (!job) return job;
  const lastNonArchivedStatus = normalizeLifecycleStatus(job.lastNonArchivedStatus);
  const archivedAt = job.archivedAt || null;
  const archivedByUserId = job.archivedByUserId || null;
  const completedAt = job.completedAt || null;
  const completedByUserId = job.completedByUserId || null;
  const changed = (
    lastNonArchivedStatus !== (job.lastNonArchivedStatus || null)
    || archivedAt !== (job.archivedAt || null)
    || archivedByUserId !== (job.archivedByUserId || null)
    || completedAt !== (job.completedAt || null)
    || completedByUserId !== (job.completedByUserId || null)
  );
  if (!changed) return job;
  return {
    ...job,
    lastNonArchivedStatus,
    archivedAt,
    archivedByUserId,
    completedAt,
    completedByUserId,
  };
}

export function loadJobs(wsId = workspaceId()) {
  const store = ensureJobsSeed(wsId);
  const list = store.jobs || [];
  let changed = false;
  const normalized = list.map((job) => {
    const next = normalizeJobLifecycle(job);
    if (next !== job) changed = true;
    return next;
  });
  if (changed) {
    store.jobs = normalized;
    persistJobsStore(wsId, store);
  }
  return normalized;
}

export function getJobById(jobId, wsId = workspaceId()) {
  const list = loadJobs(wsId);
  return list.find((job) => String(job.id) === String(jobId)) || null;
}

export function createJob(payload = {}, wsId = workspaceId()) {
  const store = ensureJobsSeed(wsId);
  const list = store.jobs || [];
  const now = Date.now();
  const kind = normalizeKind(payload.kind);
  const status = normalizeStatus(payload.status);
  const jobId = payload.id || createId('job');
  const defaultCycleKey = localDateISO().slice(0, 7);
  const completedAt = payload.completedAt || null;
  const completedByUserId = payload.completedByUserId || null;
  const archivedAt = payload.archivedAt || null;
  const archivedByUserId = payload.archivedByUserId || null;
  const job = {
    id: jobId,
    name: String(payload.name || '').trim(),
    kind,
    status,
    isInternal: !!payload.isInternal,
    companyId: payload.companyId ?? null,
    personId: payload.personId ?? null,
    serviceTypeIds: Array.isArray(payload.serviceTypeIds)
      ? payload.serviceTypeIds.filter(Boolean)
      : [],
    teamUserIds: Array.isArray(payload.teamUserIds) ? payload.teamUserIds.filter(Boolean) : [],
    jobLeadUserId: payload.jobLeadUserId || null,
    createdAt: payload.createdAt || now,
    updatedAt: now,
    startDate: kind === 'project' ? (payload.startDate || null) : null,
    targetEndDate: kind === 'project' ? (payload.targetEndDate || null) : null,
    currentCycleKey: kind === 'retainer' ? (payload.currentCycleKey || defaultCycleKey) : null,
    lastNonArchivedStatus: normalizeLifecycleStatus(payload.lastNonArchivedStatus),
    archivedAt,
    archivedByUserId,
    completedAt: status === 'completed' ? completedAt : null,
    completedByUserId: status === 'completed' ? (completedByUserId || DEFAULT_USER_ID) : null,
    deliverables: normalizeDeliverables(payload.deliverables || [], jobId),
  };
  list.unshift(job);
  store.jobs = list;
  persistJobsStore(wsId, store);
  return job;
}

export function updateJob(jobId, updates = {}, wsId = workspaceId()) {
  const store = ensureJobsSeed(wsId);
  const list = store.jobs || [];
  const idx = list.findIndex((job) => String(job.id) === String(jobId));
  if (idx < 0) return null;
  const current = list[idx];
  const nextKind = updates.kind ? normalizeKind(updates.kind) : current.kind;
  const nextStatus = updates.status ? normalizeStatus(updates.status) : current.status;
  let lastNonArchivedStatus = updates.lastNonArchivedStatus !== undefined
    ? normalizeLifecycleStatus(updates.lastNonArchivedStatus)
    : (current.lastNonArchivedStatus || null);
  let archivedAt = updates.archivedAt !== undefined ? updates.archivedAt : (current.archivedAt || null);
  let archivedByUserId = updates.archivedByUserId !== undefined
    ? updates.archivedByUserId
    : (current.archivedByUserId || null);
  let completedAt = updates.completedAt !== undefined ? updates.completedAt : (current.completedAt || null);
  let completedByUserId = updates.completedByUserId !== undefined
    ? updates.completedByUserId
    : (current.completedByUserId || null);

  if (current.status !== 'archived' && nextStatus === 'archived' && !updates.lastNonArchivedStatus) {
    lastNonArchivedStatus = normalizeLifecycleStatus(current.status);
  }
  if (nextStatus === 'archived' && archivedAt === null) {
    archivedAt = new Date().toISOString();
    archivedByUserId = archivedByUserId || DEFAULT_USER_ID;
  }
  if (current.status === 'archived' && nextStatus !== 'archived' && updates.archivedAt === undefined) {
    archivedAt = null;
    archivedByUserId = null;
  }
  if (nextStatus === 'completed') {
    if (!completedAt) completedAt = localDateISO();
    completedByUserId = completedByUserId || DEFAULT_USER_ID;
  }
  if (nextStatus !== 'completed' && updates.status && updates.completedAt === undefined) {
    completedAt = null;
    completedByUserId = null;
  }

  const next = {
    ...current,
    ...updates,
    name: updates.name ? String(updates.name).trim() : current.name,
    kind: nextKind,
    status: nextStatus,
    isInternal: typeof updates.isInternal === 'boolean' ? updates.isInternal : current.isInternal,
    serviceTypeIds: Array.isArray(updates.serviceTypeIds)
      ? updates.serviceTypeIds.filter(Boolean)
      : current.serviceTypeIds,
    teamUserIds: Array.isArray(updates.teamUserIds)
      ? updates.teamUserIds.filter(Boolean)
      : (current.teamUserIds || []),
    jobLeadUserId: updates.jobLeadUserId !== undefined
      ? updates.jobLeadUserId
      : (current.jobLeadUserId || null),
    currentCycleKey: updates.currentCycleKey !== undefined
      ? updates.currentCycleKey
      : (current.currentCycleKey || null),
    lastNonArchivedStatus,
    archivedAt,
    archivedByUserId,
    completedAt,
    completedByUserId,
    deliverables: updates.deliverables ? normalizeDeliverables(updates.deliverables, current.id) : current.deliverables,
    updatedAt: Date.now(),
  };
  if (nextKind !== 'project') {
    next.startDate = null;
    next.targetEndDate = null;
  }
  if (nextKind !== 'retainer') {
    next.currentCycleKey = null;
  }
  list[idx] = next;
  store.jobs = list;
  persistJobsStore(wsId, store);
  return next;
}

export function loadJobChatMessages(jobId, wsId = workspaceId()) {
  const store = ensureJobsSeed(wsId);
  const messages = normalizeChatMessages(store.jobsChatMessages || []);
  if (!jobId) return messages;
  return messages.filter((message) => String(message.jobId) === String(jobId));
}

export function addJobChatMessage(payload = {}, wsId = workspaceId()) {
  const store = ensureJobsSeed(wsId);
  const message = normalizeChatMessage(payload);
  if (!message) return null;
  const next = [...(store.jobsChatMessages || []), message];
  store.jobsChatMessages = next;
  persistJobsStore(wsId, store);
  return message;
}

export function retagJobChatMessage(messageId, nextTarget = {}, wsId = workspaceId()) {
  const store = ensureJobsSeed(wsId);
  const list = Array.isArray(store.jobsChatMessages) ? store.jobsChatMessages : [];
  const idx = list.findIndex((message) => String(message.id) === String(messageId));
  if (idx < 0) return null;
  const current = normalizeChatMessage(list[idx]) || list[idx];
  const target = normalizeTagTarget(nextTarget, nextTarget);
  const updated = {
    ...current,
    tagTarget: target,
    deliverableId: target.deliverableId || null,
    taskId: target.taskId || null,
  };
  const history = Array.isArray(current.retagHistory) ? current.retagHistory : [];
  updated.retagHistory = [
    ...history,
    {
      fromTarget: current.tagTarget || normalizeTagTarget({}, current),
      toTarget: target,
      changedAt: new Date().toISOString(),
      changedByUserId: nextTarget.changedByUserId || DEFAULT_USER_ID,
    },
  ];
  list[idx] = updated;
  store.jobsChatMessages = list;
  persistJobsStore(wsId, store);
  return updated;
}

export function getJobAvailableHours(job) {
  if (!job || !Array.isArray(job.deliverables)) return 0;
  return job.deliverables.reduce((sum, deliverable) => {
    if (!Array.isArray(deliverable.pools)) return sum;
    const poolTotal = deliverable.pools.reduce((inner, pool) => inner + (Number(pool.estimatedHours) || 0), 0);
    return sum + poolTotal;
  }, 0);
}

export function getLocalDateISO(date = new Date()) {
  return localDateISO(date);
}
