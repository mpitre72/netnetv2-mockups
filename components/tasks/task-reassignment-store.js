import { getActiveWorkspace } from '../../app-shell/app-helpers.js';
import { getAllowedServiceTypeIds, isTaskReady } from '../../jobs/job-tasks-helpers.js';
import { loadJobsStoreSnapshot, replaceJobsStore } from '../../jobs/jobs-store.js';
import {
  getCurrentUserId,
  getTaskActualHours,
  loadAllTasks,
  replaceAllTasks,
} from '../../quick-tasks/quick-tasks-store.js';

export const TASK_SYSTEM_UPDATED_EVENT = 'netnet:task-system-updated';

function workspaceId() {
  return getActiveWorkspace()?.id || 'default';
}

function taskAuditKey(wsId) {
  return `netnet_ws_${wsId}_task_audit_v1`;
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
    return true;
  } catch (e) {
    return false;
  }
}

function cloneValue(value) {
  try {
    return JSON.parse(JSON.stringify(value));
  } catch (e) {
    return value;
  }
}

function roundHours(value) {
  const numeric = Number(value) || 0;
  return Math.round(numeric * 100) / 100;
}

function emitTaskSystemUpdated(detail = {}) {
  if (typeof window === 'undefined' || typeof window.dispatchEvent !== 'function' || typeof CustomEvent !== 'function') return;
  window.dispatchEvent(new CustomEvent(TASK_SYSTEM_UPDATED_EVENT, { detail }));
}

function appendTaskAuditEvent(event, wsId = workspaceId()) {
  const list = readJson(taskAuditKey(wsId), []);
  const next = Array.isArray(list) ? [...list, event] : [event];
  return writeJson(taskAuditKey(wsId), next);
}

export function loadTaskAuditEvents(wsId = workspaceId()) {
  const list = readJson(taskAuditKey(wsId), []);
  return Array.isArray(list) ? list : [];
}

function uniqueValues(list = []) {
  return [...new Set((list || []).map((value) => String(value || '')).filter(Boolean))];
}

function getTaskAllocations(task) {
  return Array.isArray(task?.allocations) ? task.allocations : [];
}

function getTaskAssigneeIds(task) {
  return uniqueValues(getTaskAllocations(task).map((allocation) => allocation?.assigneeUserId));
}

function getTaskServiceTypeIds(task) {
  return uniqueValues(getTaskAllocations(task).map((allocation) => allocation?.serviceTypeId));
}

function getTaskTotalLoe(task) {
  return roundHours(getTaskAllocations(task).reduce((sum, allocation) => sum + (Number(allocation?.loeHours) || 0), 0));
}

function getTaskContext(task = {}) {
  const raw = task?.context && typeof task.context === 'object' ? task.context : {};
  const type = raw.type === 'internal' ? 'internal' : 'client';
  return {
    type,
    companyId: type === 'client' ? (raw.companyId || null) : null,
    personId: type === 'client' ? (raw.personId || null) : null,
  };
}

function getTaskActualByServiceType(task) {
  const allocations = getTaskAllocations(task);
  const explicit = {};
  let hasExplicitPositive = false;

  allocations.forEach((allocation) => {
    const serviceTypeId = String(allocation?.serviceTypeId || '');
    const actualHours = Number(allocation?.actualHours);
    if (!serviceTypeId || !Number.isFinite(actualHours)) return;
    if (actualHours <= 0) return;
    hasExplicitPositive = true;
    explicit[serviceTypeId] = roundHours((explicit[serviceTypeId] || 0) + actualHours);
  });

  if (hasExplicitPositive) return explicit;

  const totalActual = roundHours(getTaskActualHours(task));
  if (totalActual <= 0) return {};

  const serviceTypeIds = getTaskServiceTypeIds(task);
  if (serviceTypeIds.length === 1) {
    return { [serviceTypeIds[0]]: totalActual };
  }

  const totalLoe = getTaskTotalLoe(task);
  if (serviceTypeIds.length > 1 && totalLoe > 0) {
    const next = {};
    allocations.forEach((allocation) => {
      const serviceTypeId = String(allocation?.serviceTypeId || '');
      const loeHours = Number(allocation?.loeHours) || 0;
      if (!serviceTypeId || loeHours <= 0) return;
      next[serviceTypeId] = roundHours((next[serviceTypeId] || 0) + ((totalActual * loeHours) / totalLoe));
    });
    return next;
  }

  return {};
}

function getTaskPlannedByServiceType(task) {
  return getTaskAllocations(task).reduce((acc, allocation) => {
    const serviceTypeId = String(allocation?.serviceTypeId || '');
    const loeHours = Number(allocation?.loeHours) || 0;
    if (!serviceTypeId || loeHours <= 0) return acc;
    acc[serviceTypeId] = roundHours((acc[serviceTypeId] || 0) + loeHours);
    return acc;
  }, {});
}

function adjustPools(pools = [], plannedDeltaByType = {}, actualDeltaByType = {}) {
  return (pools || []).map((pool) => {
    const serviceTypeId = String(pool?.serviceTypeId || '');
    if (!serviceTypeId) return pool;
    const plannedDelta = Number(plannedDeltaByType[serviceTypeId]) || 0;
    const actualDelta = Number(actualDeltaByType[serviceTypeId]) || 0;
    if (!plannedDelta && !actualDelta) return pool;
    return {
      ...pool,
      assignedHours: roundHours((Number(pool?.assignedHours) || 0) + plannedDelta),
      actualHours: roundHours((Number(pool?.actualHours) || 0) + actualDelta),
    };
  });
}

function applyDeliverablePoolDeltas(job, deliverable, plannedDeltaByType = {}, actualDeltaByType = {}) {
  if (!deliverable) return deliverable;
  const cycleKey = job?.kind === 'retainer' ? (job?.currentCycleKey || deliverable?.cycleKey || null) : null;
  const next = {
    ...deliverable,
    pools: adjustPools(deliverable?.pools || [], plannedDeltaByType, actualDeltaByType),
  };
  if (cycleKey && Array.isArray(deliverable?.poolsByCycle?.[cycleKey])) {
    next.poolsByCycle = {
      ...(deliverable?.poolsByCycle || {}),
      [cycleKey]: adjustPools(deliverable.poolsByCycle[cycleKey] || [], plannedDeltaByType, actualDeltaByType),
    };
  }
  return next;
}

function negateHoursMap(map = {}) {
  return Object.keys(map || {}).reduce((acc, key) => {
    acc[key] = roundHours(-(Number(map[key]) || 0));
    return acc;
  }, {});
}

function updateDeliverableInJob(job, deliverableId, updater) {
  return {
    ...job,
    deliverables: (job?.deliverables || []).map((deliverable) => (
      String(deliverable?.id || '') === String(deliverableId || '')
        ? updater(deliverable)
        : deliverable
    )),
  };
}

function removeTaskFromJobStore(jobs, taskId) {
  let removedTask = null;
  let removedJob = null;
  let removedDeliverable = null;
  let removedFromUnassigned = false;

  const nextJobs = (jobs || []).map((job) => {
    let changed = false;
    const nextDeliverables = (job?.deliverables || []).map((deliverable) => {
      const nextTasks = (deliverable?.tasks || []).filter((task) => {
        const match = String(task?.id || '') === String(taskId || '');
        if (match) {
          removedTask = task;
          removedJob = job;
          removedDeliverable = deliverable;
          changed = true;
        }
        return !match;
      });
      return nextTasks.length !== (deliverable?.tasks || []).length
        ? { ...deliverable, tasks: nextTasks }
        : deliverable;
    });

    const nextUnassignedTasks = (job?.unassignedTasks || []).filter((task) => {
      const match = String(task?.id || '') === String(taskId || '');
      if (match) {
        removedTask = task;
        removedJob = job;
        removedDeliverable = null;
        removedFromUnassigned = true;
        changed = true;
      }
      return !match;
    });

    if (!changed) return job;
    return {
      ...job,
      deliverables: nextDeliverables,
      unassignedTasks: nextUnassignedTasks,
    };
  });

  return {
    jobs: nextJobs,
    task: removedTask,
    job: removedJob,
    deliverable: removedDeliverable,
    fromUnassigned: removedFromUnassigned,
  };
}

function insertTaskIntoDeliverable(jobs, destinationJobId, destinationDeliverableId, task) {
  let insertedJob = null;
  let insertedDeliverable = null;
  const nextJobs = (jobs || []).map((job) => {
    if (String(job?.id || '') !== String(destinationJobId || '')) return job;
    insertedJob = job;
    const nextDeliverables = (job?.deliverables || []).map((deliverable) => {
      if (String(deliverable?.id || '') !== String(destinationDeliverableId || '')) return deliverable;
      insertedDeliverable = deliverable;
      return {
        ...deliverable,
        tasks: [task, ...(deliverable?.tasks || [])],
      };
    });
    return { ...job, deliverables: nextDeliverables };
  });
  return { jobs: nextJobs, job: insertedJob, deliverable: insertedDeliverable };
}

function getJobById(jobs, jobId) {
  return (jobs || []).find((job) => String(job?.id || '') === String(jobId || '')) || null;
}

function getDeliverableById(job, deliverableId) {
  return (job?.deliverables || []).find((deliverable) => String(deliverable?.id || '') === String(deliverableId || '')) || null;
}

function updateTaskChatTargets(messages = [], taskId, sourceJobId, destinationJobId, destinationDeliverableId, performedByUserId) {
  const now = new Date().toISOString();
  return (messages || []).map((message) => {
    const matchesTask = String(message?.taskId || '') === String(taskId || '');
    const matchesJob = String(message?.jobId || '') === String(sourceJobId || '');
    if (!matchesTask || !matchesJob) return message;
    const history = Array.isArray(message?.retagHistory) ? message.retagHistory : [];
    return {
      ...message,
      jobId: String(destinationJobId || sourceJobId || ''),
      deliverableId: destinationDeliverableId || null,
      taskId: String(taskId || ''),
      tagTarget: {
        type: 'task',
        deliverableId: destinationDeliverableId || null,
        taskId: String(taskId || ''),
      },
      retagHistory: [
        ...history,
        {
          fromTarget: message?.tagTarget || {
            type: 'task',
            deliverableId: message?.deliverableId || null,
            taskId: String(taskId || ''),
          },
          toTarget: {
            type: 'task',
            deliverableId: destinationDeliverableId || null,
            taskId: String(taskId || ''),
          },
          changedAt: now,
          changedByUserId: performedByUserId || null,
        },
      ],
    };
  });
}

function makeResult(ok, extra = {}) {
  return { ok, ...extra };
}

function makeError(message, fieldErrors = {}, code = 'validation') {
  return makeResult(false, { code, message, fieldErrors });
}

export function reassignTask({
  taskId,
  sourceType,
  destinationType,
  destinationJobId = null,
  destinationDeliverableId = null,
  remappedServiceTypeId = null,
  performedByUserId = getCurrentUserId(),
} = {}) {
  const normalizedSourceType = String(sourceType || '') === 'job' ? 'job' : 'quick';
  const normalizedDestinationType = String(destinationType || '') === 'quick' ? 'quick' : 'job';
  const wsId = workspaceId();

  const quickTasks = cloneValue(loadAllTasks(wsId));
  const jobsStore = cloneValue(loadJobsStoreSnapshot(wsId));
  const jobs = Array.isArray(jobsStore?.jobs) ? jobsStore.jobs : [];
  const jobsChatMessages = Array.isArray(jobsStore?.jobsChatMessages) ? jobsStore.jobsChatMessages : [];

  const sourceQuickTask = normalizedSourceType === 'quick'
    ? quickTasks.find((task) => String(task?.id || '') === String(taskId || '')) || null
    : null;
  const removed = normalizedSourceType === 'job'
    ? removeTaskFromJobStore(jobs, taskId)
    : null;
  const sourceTask = normalizedSourceType === 'job' ? removed?.task : sourceQuickTask;
  const sourceJob = normalizedSourceType === 'job' ? removed?.job : null;
  const sourceDeliverable = normalizedSourceType === 'job' ? removed?.deliverable : null;

  if (!sourceTask) {
    return makeError('Task not found.', {}, 'not_found');
  }

  const sourceJobId = String(sourceTask?.jobId || sourceJob?.id || '');
  const sourceDeliverableId = String(sourceTask?.deliverableId || sourceDeliverable?.id || '');
  const currentServiceTypeIds = getTaskServiceTypeIds(sourceTask);
  const nextDestinationJobId = normalizedDestinationType === 'job' ? String(destinationJobId || '') : '';
  const nextDestinationDeliverableId = normalizedDestinationType === 'job' ? String(destinationDeliverableId || '') : '';

  if (
    normalizedSourceType === normalizedDestinationType
    && sourceJobId === nextDestinationJobId
    && sourceDeliverableId === nextDestinationDeliverableId
  ) {
    return makeError('Task is already in this location.', {}, 'no_op');
  }

  let nextQuickTasks = cloneValue(quickTasks);
  let nextJobs = normalizedSourceType === 'job' ? cloneValue(removed?.jobs || jobs) : cloneValue(jobs);
  let nextChatMessages = cloneValue(jobsChatMessages);
  const sourceActualByType = getTaskActualByServiceType(sourceTask);
  const sourcePlannedByType = getTaskPlannedByServiceType(sourceTask);
  const nextTaskBase = {
    ...cloneValue(sourceTask),
    updatedAt: Date.now(),
  };

  if (normalizedDestinationType === 'quick') {
    const assigneeIds = getTaskAssigneeIds(sourceTask);
    const serviceTypeIds = currentServiceTypeIds;
    const totalLoe = getTaskTotalLoe(sourceTask);
    if (assigneeIds.length !== 1) {
      return makeError('Quick Tasks require exactly one assignee.', { assigneeId: 'Exactly one assignee is required.' });
    }
    if (serviceTypeIds.length !== 1) {
      return makeError('Quick Tasks require exactly one service type.', { serviceTypeId: 'Exactly one service type is required.' });
    }
    if (!sourceTask?.dueDate) {
      return makeError('Quick Tasks require a due date.', { dueDate: 'Due date is required.' });
    }
    if (totalLoe <= 0) {
      return makeError('Quick Tasks require LOE before reassignment.', { loeHours: 'LOE is required.' });
    }

    const quickContext = normalizedSourceType === 'job'
      ? (sourceJob?.isInternal
        ? { type: 'internal', companyId: null, personId: null }
        : {
          type: 'client',
          companyId: sourceJob?.companyId || null,
          personId: sourceJob?.personId || null,
        })
      : getTaskContext(sourceTask);
    const hasQuickAnchor = quickContext.type === 'internal' || quickContext.companyId || quickContext.personId;
    if (!hasQuickAnchor) {
      return makeError('Quick Tasks require a client or internal context.', { context: 'Client/internal anchor is required.' });
    }

    const quickTask = {
      ...nextTaskBase,
      jobId: null,
      deliverableId: null,
      context: quickContext,
    };

    if (normalizedSourceType === 'job' && sourceDeliverableId) {
      nextJobs = nextJobs.map((job) => {
        if (String(job?.id || '') !== sourceJobId) return job;
        return updateDeliverableInJob(job, sourceDeliverableId, (deliverable) => (
          applyDeliverablePoolDeltas(job, deliverable, negateHoursMap(sourcePlannedByType), negateHoursMap(sourceActualByType))
        ));
      });
    }

    if (normalizedSourceType === 'quick') {
      nextQuickTasks = nextQuickTasks.map((task) => (
        String(task?.id || '') === String(taskId || '') ? quickTask : task
      ));
    } else {
      nextQuickTasks = [quickTask, ...nextQuickTasks];
    }
  } else {
    if (!nextDestinationJobId) {
      return makeError('Select a destination job.', { jobId: 'Destination job is required.' });
    }
    if (!nextDestinationDeliverableId) {
      return makeError('Select a destination deliverable.', { deliverableId: 'Destination deliverable is required.' });
    }

    const destinationJob = getJobById(nextJobs, nextDestinationJobId);
    const destinationDeliverable = getDeliverableById(destinationJob, nextDestinationDeliverableId);
    if (!destinationJob || !destinationDeliverable) {
      return makeError('Destination deliverable not found.', { deliverableId: 'Choose a valid deliverable.' }, 'not_found');
    }

    const allowedServiceTypeIds = getAllowedServiceTypeIds(
      destinationDeliverable,
      destinationJob?.kind === 'retainer' ? (destinationJob?.currentCycleKey || nextTaskBase?.cycleKey || null) : null
    ).map((id) => String(id));
    if (!allowedServiceTypeIds.length) {
      return makeError('Selected deliverable has no available service types yet.', { serviceTypeId: 'Destination deliverable is not ready.' });
    }

    const invalidSourceTypes = currentServiceTypeIds.filter((id) => !allowedServiceTypeIds.includes(String(id)));
    if (invalidSourceTypes.length && !remappedServiceTypeId) {
      return makeError('Remap the service type to continue.', { serviceTypeId: 'A valid destination service type is required.' });
    }
    if (remappedServiceTypeId && !allowedServiceTypeIds.includes(String(remappedServiceTypeId))) {
      return makeError('Selected service type is not available in the destination deliverable.', { serviceTypeId: 'Choose a service type from this deliverable.' });
    }

    const destinationAllocations = getTaskAllocations(nextTaskBase).map((allocation) => {
      const currentId = String(allocation?.serviceTypeId || '');
      if (!currentId || allowedServiceTypeIds.includes(currentId)) {
        if (!remappedServiceTypeId || invalidSourceTypes.length) return allocation;
      }
      if (!remappedServiceTypeId) return allocation;
      return {
        ...allocation,
        serviceTypeId: String(remappedServiceTypeId),
      };
    });

    const destinationTask = {
      ...nextTaskBase,
      jobId: nextDestinationJobId,
      deliverableId: nextDestinationDeliverableId,
      allocations: destinationAllocations,
      isDraft: false,
    };

    const readyForJob = isTaskReady(
      destinationTask,
      destinationDeliverable,
      destinationJob?.kind === 'retainer' ? (destinationJob?.currentCycleKey || destinationTask?.cycleKey || null) : null
    );
    if (normalizedSourceType === 'quick' && !readyForJob) {
      return makeError('Quick Task is missing required Job Task fields.', {
        dueDate: destinationTask?.dueDate ? '' : 'Due date is required.',
        assigneeId: getTaskAssigneeIds(destinationTask).length ? '' : 'Assignee is required.',
        serviceTypeId: getTaskServiceTypeIds(destinationTask).length ? '' : 'Service type is required.',
        loeHours: getTaskTotalLoe(destinationTask) > 0 ? '' : 'LOE is required.',
      });
    }

    const destinationActualByType = getTaskActualByServiceType(destinationTask);
    const destinationPlannedByType = getTaskPlannedByServiceType(destinationTask);

    if (normalizedSourceType === 'job' && sourceDeliverableId) {
      nextJobs = nextJobs.map((job) => {
        if (String(job?.id || '') !== sourceJobId) return job;
        return updateDeliverableInJob(job, sourceDeliverableId, (deliverable) => (
          applyDeliverablePoolDeltas(job, deliverable, negateHoursMap(sourcePlannedByType), negateHoursMap(sourceActualByType))
        ));
      });
      nextChatMessages = updateTaskChatTargets(
        nextChatMessages,
        taskId,
        sourceJobId,
        nextDestinationJobId,
        nextDestinationDeliverableId,
        performedByUserId
      );
    }

    nextJobs = nextJobs.map((job) => {
      if (String(job?.id || '') !== nextDestinationJobId) return job;
      return updateDeliverableInJob(job, nextDestinationDeliverableId, (deliverable) => (
        applyDeliverablePoolDeltas(job, deliverable, destinationPlannedByType, destinationActualByType)
      ));
    });

    if (normalizedSourceType === 'job') {
      const inserted = insertTaskIntoDeliverable(nextJobs, nextDestinationJobId, nextDestinationDeliverableId, destinationTask);
      nextJobs = inserted.jobs;
    } else {
      const inserted = insertTaskIntoDeliverable(nextJobs, nextDestinationJobId, nextDestinationDeliverableId, destinationTask);
      nextJobs = inserted.jobs;
      nextQuickTasks = nextQuickTasks.filter((task) => String(task?.id || '') !== String(taskId || ''));
    }
  }

  const auditEvent = {
    id: `audit_${Math.random().toString(36).slice(2, 9)}`,
    type: 'task.reassigned',
    task_id: String(taskId || ''),
    source_type: normalizedSourceType,
    source_job_id: sourceJobId || null,
    source_deliverable_id: sourceDeliverableId || null,
    destination_type: normalizedDestinationType,
    destination_job_id: normalizedDestinationType === 'job' ? (nextDestinationJobId || null) : null,
    destination_deliverable_id: normalizedDestinationType === 'job' ? (nextDestinationDeliverableId || null) : null,
    previous_service_type_id: currentServiceTypeIds.length === 1 ? currentServiceTypeIds[0] : null,
    new_service_type_id: remappedServiceTypeId ? String(remappedServiceTypeId) : null,
    performed_by_user_id: performedByUserId || null,
    performed_at: new Date().toISOString(),
  };

  replaceAllTasks(nextQuickTasks, wsId);
  replaceJobsStore({
    jobs: nextJobs,
    jobsChatMessages: nextChatMessages,
  }, wsId);
  appendTaskAuditEvent(auditEvent, wsId);
  emitTaskSystemUpdated({
    action: 'task.reassigned',
    taskId: String(taskId || ''),
    sourceType: normalizedSourceType,
    sourceJobId: sourceJobId || null,
    sourceDeliverableId: sourceDeliverableId || null,
    destinationType: normalizedDestinationType,
    destinationJobId: normalizedDestinationType === 'job' ? (nextDestinationJobId || null) : null,
    destinationDeliverableId: normalizedDestinationType === 'job' ? (nextDestinationDeliverableId || null) : null,
  });

  return makeResult(true, {
    taskId: String(taskId || ''),
    sourceType: normalizedSourceType,
    destinationType: normalizedDestinationType,
    destinationJobId: normalizedDestinationType === 'job' ? (nextDestinationJobId || null) : null,
    destinationDeliverableId: normalizedDestinationType === 'job' ? (nextDestinationDeliverableId || null) : null,
    auditEvent,
  });
}
