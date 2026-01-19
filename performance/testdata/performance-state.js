import {
  performanceDeliverables,
  performanceTasks,
  performanceJobs,
  performanceTeam,
} from '../performance-data.js';
import { getStore, setStore } from './performance-store.js';

const DEFAULT_STORE = { deliverables: {}, tasks: {}, createdTasks: [] };

function readStore() {
  const raw = getStore();
  return raw && typeof raw === 'object' ? raw : { ...DEFAULT_STORE };
}

function writeStore(next) {
  setStore(next);
}

function cloneStore(store) {
  return {
    deliverables: { ...(store.deliverables || {}) },
    tasks: { ...(store.tasks || {}) },
    createdTasks: Array.isArray(store.createdTasks) ? [...store.createdTasks] : [],
  };
}

function reviewSnapshot(del) {
  return {
    due: del.due,
    overdue: del.overdue,
    effortOver: del.effortOver,
    timelineOver: del.timelineOver,
    confidence: del.progressConfidence || 'unset',
  };
}

function hasMaterialReviewChange(currentSnap, reviewedSnap) {
  if (!currentSnap || !reviewedSnap) return true;
  return (
    currentSnap.due !== reviewedSnap.due ||
    currentSnap.overdue !== reviewedSnap.overdue ||
    currentSnap.effortOver !== reviewedSnap.effortOver ||
    currentSnap.timelineOver !== reviewedSnap.timelineOver ||
    currentSnap.confidence !== reviewedSnap.confidence
  );
}

function normalizeStatus(status) {
  if (status === 'completed') return 'completed';
  if (status === 'backlog') return 'backlog';
  return 'in-progress';
}

function buildEffectiveTasks(storeTasks = {}, createdTasks = []) {
  const base = performanceTasks.map((task) => {
    const override = storeTasks[task.id];
    return override ? { ...task, ...override } : task;
  });
  const extras = Array.isArray(createdTasks)
    ? createdTasks.map((task) => {
      const override = storeTasks[task.id];
      return override ? { ...task, ...override } : task;
    })
    : [];
  return [...base, ...extras];
}

function buildEffectiveDeliverable({ base, override, job, today }) {
  const dueOverride = override?.dueOverride;
  const due = dueOverride?.due || base.due;
  const originalDue = dueOverride?.originalDue || base.originalDue || base.due;
  const changedAt = dueOverride?.changedAt || base.changedAt || null;
  const changedBy = dueOverride?.changedBy || base.changedBy || null;
  const status = normalizeStatus(override?.status || base.status);
  const completedAt = override?.completedAt || base.completedAt || null;
  const progressConfidence = override?.progressConfidence || null;

  const effortPct = Math.max(0, Math.round(base.effortConsumed || 0));
  const timelinePct = Math.max(0, Math.round(base.durationConsumed || 0));

  const dueDate = new Date(due);
  const overdue = !isNaN(dueDate) && dueDate < today && status !== 'completed';
  const dueSoon = !overdue && !isNaN(dueDate) && dueDate >= today && dueDate <= new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);
  const effortOver = effortPct > 100;
  const timelineOver = timelinePct > 100;
  const lowConfidence = progressConfidence === 'low';
  const needsCheckIn = ((effortPct >= 85 && effortPct <= 100) || (timelinePct >= 85 && timelinePct <= 100)) && !progressConfidence;
  const atRisk = status !== 'completed' && (overdue || effortOver || timelineOver || lowConfidence);

  const reasons = [];
  if (overdue) reasons.push({ id: 'overdue', label: 'Overdue', tone: 'red' });
  if (dueSoon) reasons.push({ id: 'dueSoon', label: 'Due soon', tone: 'amber' });
  if (effortOver) reasons.push({ id: 'effortOver', label: 'Effort overrun', tone: 'amber' });
  if (timelineOver) reasons.push({ id: 'timelineOver', label: 'Timeline overrun', tone: 'amber' });
  if (lowConfidence) reasons.push({ id: 'lowConf', label: 'Low confidence', tone: 'red' });
  if (needsCheckIn) reasons.push({ id: 'checkIn', label: 'Needs check-in', tone: 'amber' });
  if (changedAt) reasons.push({ id: 'moved', label: 'Date moved', tone: 'amber' });

  const reviewed = override?.reviewed || null;
  const changeOrders = override?.changeOrders || [];

  return {
    ...base,
    jobName: job?.name || `Job ${base.jobId}`,
    client: job?.client || 'Client',
    due,
    originalDue,
    changedAt,
    changedBy,
    status,
    completedAt,
    progressConfidence,
    reviewed,
    changeOrders,
    effortPct,
    timelinePct,
    overdue,
    dueSoon,
    effortOver,
    timelineOver,
    lowConfidence,
    needsCheckIn,
    atRisk,
    reasons,
  };
}

export function getEffectiveState() {
  const store = readStore();
  const nextStore = cloneStore(store);
  const today = new Date();
  const jobsById = new Map(performanceJobs.map((j) => [j.id, j]));
  let dirty = false;

  const tasks = buildEffectiveTasks(nextStore.tasks, nextStore.createdTasks);

  const deliverables = performanceDeliverables.map((d) => {
    const override = nextStore.deliverables?.[d.id] || {};
    const job = jobsById.get(d.jobId);
    const effective = buildEffectiveDeliverable({ base: d, override, job, today });

    if (effective.reviewed) {
      const currentSnap = reviewSnapshot(effective);
      if (hasMaterialReviewChange(currentSnap, effective.reviewed.snapshot)) {
        delete override.reviewed;
        dirty = true;
        effective.reviewed = null;
      }
    }

    if (Object.keys(override).length === 0 && nextStore.deliverables?.[d.id]) {
      delete nextStore.deliverables[d.id];
      dirty = true;
    } else if (Object.keys(override).length > 0) {
      if (!nextStore.deliverables) nextStore.deliverables = {};
      nextStore.deliverables[d.id] = override;
    }

    return effective;
  });

  if (dirty) writeStore(nextStore);

  return {
    deliverables,
    tasks,
    jobs: performanceJobs,
    team: performanceTeam,
    store: nextStore,
  };
}

function ensureDeliverableEntry(store, deliverableId) {
  if (!store.deliverables) store.deliverables = {};
  if (!store.deliverables[deliverableId]) store.deliverables[deliverableId] = {};
  return store.deliverables[deliverableId];
}

export function markReviewed(deliverableId, reviewer = 'You') {
  const current = getEffectiveState();
  const target = current.deliverables.find((d) => d.id === deliverableId);
  if (!target) return current;
  const nextStore = cloneStore(current.store);
  const entry = ensureDeliverableEntry(nextStore, deliverableId);
  entry.reviewed = {
    by: reviewer,
    at: new Date().toISOString(),
    snapshot: reviewSnapshot(target),
  };
  writeStore(nextStore);
  return getEffectiveState();
}

export function clearReviewed(deliverableId) {
  const current = getEffectiveState();
  const nextStore = cloneStore(current.store);
  if (nextStore.deliverables?.[deliverableId]?.reviewed) {
    delete nextStore.deliverables[deliverableId].reviewed;
  }
  writeStore(nextStore);
  return getEffectiveState();
}

export function setProgressConfidence(deliverableId, level) {
  const current = getEffectiveState();
  const nextStore = cloneStore(current.store);
  const entry = ensureDeliverableEntry(nextStore, deliverableId);
  entry.progressConfidence = level || null;
  delete entry.reviewed;
  writeStore(nextStore);
  return getEffectiveState();
}

export function updateDueDate(deliverableId, nextDue, actor = 'You') {
  if (!nextDue) return getEffectiveState();
  const current = getEffectiveState();
  const target = current.deliverables.find((d) => d.id === deliverableId);
  if (!target) return current;
  const nextStore = cloneStore(current.store);
  const entry = ensureDeliverableEntry(nextStore, deliverableId);
  entry.dueOverride = {
    originalDue: entry.dueOverride?.originalDue || target.originalDue || target.due,
    due: nextDue,
    changedAt: new Date().toISOString(),
    changedBy: actor,
  };
  delete entry.reviewed;
  writeStore(nextStore);
  return getEffectiveState();
}

export function completeDeliverable(deliverableId, actor = 'You') {
  const current = getEffectiveState();
  const nextStore = cloneStore(current.store);
  const entry = ensureDeliverableEntry(nextStore, deliverableId);
  entry.status = 'completed';
  entry.completedAt = new Date().toISOString();
  entry.completedBy = actor;
  delete entry.reviewed;
  writeStore(nextStore);
  return getEffectiveState();
}

export function reassignTasks(deliverableId, assigneeId) {
  const current = getEffectiveState();
  const nextStore = cloneStore(current.store);
  const relatedTasks = performanceTasks.filter((t) => t.deliverableId === deliverableId);
  relatedTasks.forEach((task) => {
    nextStore.tasks[task.id] = { ...(nextStore.tasks[task.id] || {}), assigneeId };
  });
  const entry = ensureDeliverableEntry(nextStore, deliverableId);
  delete entry.reviewed;
  writeStore(nextStore);
  return getEffectiveState();
}

export function createChangeOrder(deliverableId, note = '') {
  const current = getEffectiveState();
  const nextStore = cloneStore(current.store);
  const entry = ensureDeliverableEntry(nextStore, deliverableId);
  const list = entry.changeOrders || [];
  const id = `co-${Date.now()}`;
  list.push({ id, note, createdAt: new Date().toISOString() });
  entry.changeOrders = list;
  delete entry.reviewed;
  writeStore(nextStore);
  return getEffectiveState();
}

function createTaskId() {
  return `jt-${Date.now().toString(36)}-${Math.random().toString(16).slice(2, 6)}`;
}

function createTimeEntryId() {
  return `jt_time-${Date.now().toString(36)}-${Math.random().toString(16).slice(2, 6)}`;
}

export function createJobTask(payload = {}) {
  const required = payload.jobId && payload.deliverableId && payload.title && payload.serviceTypeId;
  if (!required) return null;
  const now = Date.now();
  const loeHours = Number(payload.loeHours) || 0;
  if (!loeHours) return null;
  const current = getEffectiveState();
  const nextStore = cloneStore(current.store);
  if (!Array.isArray(nextStore.createdTasks)) nextStore.createdTasks = [];
  const task = {
    id: payload.id || createTaskId(),
    title: payload.title,
    description: payload.description || '',
    jobId: payload.jobId,
    deliverableId: payload.deliverableId,
    serviceTypeId: payload.serviceTypeId,
    estimatedHours: loeHours,
    actualHours: 0,
    remainingHours: loeHours,
    assigneeId: payload.assigneeUserId || null,
    assigneeUserId: payload.assigneeUserId || null,
    dueDate: payload.dueDate || null,
    timeEntries: Array.isArray(payload.timeEntries) ? payload.timeEntries : [],
    createdAt: payload.createdAt || now,
    createdByUserId: payload.createdByUserId || null,
    createdVia: payload.createdVia || 'netnet_ai',
  };
  nextStore.createdTasks.push(task);
  writeStore(nextStore);
  return task;
}

export function addJobTaskTimeEntry(taskId, entry = {}) {
  if (!taskId) return null;
  const hours = Number(entry.hours) || 0;
  if (!hours) return null;
  const date = entry.date || '';
  if (!date) return null;

  const current = getEffectiveState();
  const task = current.tasks.find((item) => String(item.id) === String(taskId));
  if (!task) return null;

  const nextStore = cloneStore(current.store);
  if (!nextStore.tasks) nextStore.tasks = {};
  const override = nextStore.tasks[taskId] || {};
  const existingEntries = Array.isArray(override.timeEntries)
    ? [...override.timeEntries]
    : Array.isArray(task.timeEntries)
      ? [...task.timeEntries]
      : [];

  const nextEntry = {
    id: entry.id || createTimeEntryId(),
    date,
    hours,
    note: entry.note || '',
    createdAt: entry.createdAt || new Date().toISOString(),
    createdByUserId: entry.createdByUserId || null,
    createdVia: entry.createdVia || 'netnet_ai',
  };

  existingEntries.push(nextEntry);
  nextStore.tasks[taskId] = { ...override, timeEntries: existingEntries };
  writeStore(nextStore);
  return { ...task, ...nextStore.tasks[taskId] };
}
