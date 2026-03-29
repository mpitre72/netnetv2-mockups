import { getContactsData, getIndividualsData } from '../contacts/contacts-data.js';
import { loadJobs } from '../jobs/jobs-store.js';
import {
  getCurrentUserId,
  getMemberById,
  getServiceTypeById,
  getTaskAllocations,
  loadQuickTasks,
  loadServiceTypes,
  loadTeamMembers,
} from '../quick-tasks/quick-tasks-store.js';

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

function normalizeStatus(status) {
  const value = String(status || '').trim().toLowerCase();
  if (value === 'in_progress' || value === 'in-progress') return 'in-progress';
  if (value === 'completed') return 'completed';
  if (value === 'archived') return 'archived';
  return 'backlog';
}

function getStatusSortRank(status) {
  if (status === 'in-progress') return 0;
  if (status === 'backlog') return 1;
  if (status === 'completed') return 2;
  if (status === 'archived') return 3;
  return 4;
}

function resolveClientName(companyId, personId, companyMap, personMap) {
  const company = companyId ? companyMap.get(String(companyId)) : null;
  if (company) return company.name || company.companyName || null;
  const person = personId ? personMap.get(String(personId)) : null;
  if (!person) return null;
  return person.name || [person.firstName, person.lastName].filter(Boolean).join(' ').trim() || null;
}

function matchesUserId(candidate, currentUserId, members) {
  const normalizedCandidate = String(candidate || '');
  const normalizedUserId = String(currentUserId || '');
  if (!normalizedCandidate || !normalizedUserId) return false;
  if (normalizedCandidate === normalizedUserId) return true;
  const assignee = getMemberById(normalizedCandidate, members);
  return String(assignee?.id || '') === normalizedUserId;
}

function findAssignmentForUser(task, currentUserId, members) {
  const allocationMatch = getTaskAllocations(task).find((allocation) => (
    matchesUserId(allocation?.assigneeUserId, currentUserId, members)
  ));
  if (allocationMatch) return allocationMatch;

  if (matchesUserId(task?.assignedToUserId, currentUserId, members)) {
    return {
      assigneeUserId: task.assignedToUserId,
      serviceTypeId: task.serviceTypeId || task.serviceType || null,
      loeHours: task.loeHours,
    };
  }

  if (matchesUserId(task?.assigneeId, currentUserId, members)) {
    return {
      assigneeUserId: task.assigneeId,
      serviceTypeId: task.serviceTypeId || task.serviceType || null,
      loeHours: task.loeHours,
    };
  }

  if (Array.isArray(task?.assignees)) {
    const assigneeMatch = task.assignees.find((assigneeId) => matchesUserId(assigneeId, currentUserId, members));
    if (assigneeMatch) {
      return {
        assigneeUserId: assigneeMatch,
        serviceTypeId: task.serviceTypeId || task.serviceType || null,
        loeHours: task.loeHours,
      };
    }
  }

  return null;
}

function normalizeJobTask(task, allocation, job, companyMap, personMap, serviceTypes) {
  const serviceType = allocation?.serviceTypeId
    ? getServiceTypeById(allocation.serviceTypeId, serviceTypes)
    : null;

  return {
    id: `job:${String(task.id || '')}:${String(allocation?.assigneeUserId || '')}`,
    source: 'job',
    sourceId: String(task.id || ''),
    title: String(task.title || ''),
    description: String(task.description || ''),
    status: normalizeStatus(task.status),
    assigneeId: String(allocation?.assigneeUserId || ''),
    serviceType: String(serviceType?.name || allocation?.serviceTypeId || ''),
    loeHours: Number(allocation?.loeHours) || 0,
    dueDate: task.dueDate || null,
    clientName: resolveClientName(job?.companyId, job?.personId, companyMap, personMap),
    clientType: 'client',
    hasChat: true,
    originalTaskRef: task,
  };
}

function normalizeQuickTask(task, allocation, companyMap, personMap, serviceTypes) {
  const serviceType = allocation?.serviceTypeId
    ? getServiceTypeById(allocation.serviceTypeId, serviceTypes)
    : null;
  const context = task?.context && typeof task.context === 'object' ? task.context : {};
  const clientType = context.type === 'internal' ? 'internal' : 'client';

  return {
    id: `quick:${String(task.id || '')}:${String(allocation?.assigneeUserId || '')}`,
    source: 'quick',
    sourceId: String(task.id || ''),
    title: String(task.title || ''),
    description: String(task.description || ''),
    status: normalizeStatus(task.status),
    assigneeId: String(allocation?.assigneeUserId || ''),
    serviceType: String(serviceType?.name || allocation?.serviceTypeId || ''),
    loeHours: Number(allocation?.loeHours) || 0,
    dueDate: task.dueDate || null,
    clientName: clientType === 'internal'
      ? null
      : resolveClientName(context.companyId, context.personId, companyMap, personMap),
    clientType,
    hasChat: false,
    originalTaskRef: task,
  };
}

function sortMyTasks(tasks = []) {
  return [...tasks].sort((a, b) => {
    const rankDiff = getStatusSortRank(a.status) - getStatusSortRank(b.status);
    if (rankDiff !== 0) return rankDiff;
    if (a.dueDate && b.dueDate) return String(a.dueDate).localeCompare(String(b.dueDate));
    if (a.dueDate) return -1;
    if (b.dueDate) return 1;
    return String(a.title || '').localeCompare(String(b.title || ''));
  });
}

function getAssignedJobTasks(currentUserId, members, serviceTypes, companyMap, personMap) {
  const tasks = [];
  loadJobs().forEach((job) => {
    (job.deliverables || []).forEach((deliverable) => {
      (deliverable.tasks || []).forEach((task) => {
        const allocation = findAssignmentForUser(task, currentUserId, members);
        if (!allocation) return;
        tasks.push(normalizeJobTask(task, allocation, job, companyMap, personMap, serviceTypes));
      });
    });

    (job.unassignedTasks || []).forEach((task) => {
      const allocation = findAssignmentForUser(task, currentUserId, members);
      if (!allocation) return;
      tasks.push(normalizeJobTask(task, allocation, job, companyMap, personMap, serviceTypes));
    });
  });
  return tasks;
}

function getAssignedQuickTasks(currentUserId, members, serviceTypes, companyMap, personMap) {
  return loadQuickTasks()
    .map((task) => {
      const allocation = findAssignmentForUser(task, currentUserId, members);
      if (!allocation) return null;
      return normalizeQuickTask(task, allocation, companyMap, personMap, serviceTypes);
    })
    .filter(Boolean);
}

export function getMyTasks(currentUserId = getCurrentUserId()) {
  const members = loadTeamMembers();
  const serviceTypes = loadServiceTypes();
  const companyMap = buildCompanyMap();
  const personMap = buildPersonMap(companyMap);
  const jobTasks = getAssignedJobTasks(currentUserId, members, serviceTypes, companyMap, personMap);
  const quickTasks = getAssignedQuickTasks(currentUserId, members, serviceTypes, companyMap, personMap);
  return sortMyTasks([...jobTasks, ...quickTasks]);
}
