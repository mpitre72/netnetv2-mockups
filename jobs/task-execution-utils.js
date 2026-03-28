export function localDateISO(date = new Date()) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export const TASK_STATUS_OPTIONS = [
  { value: 'backlog', label: 'Backlog' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'completed', label: 'Completed' },
  { value: 'archived', label: 'Archived' },
];

const VALID_TASK_STATUSES = new Set(TASK_STATUS_OPTIONS.map((option) => option.value));

export function normalizeExecutionDate(value) {
  if (!value) return null;
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : localDateISO(value);
  }
  const raw = String(value).trim();
  if (!raw) return null;
  const isoMatch = raw.match(/^(\d{4}-\d{2}-\d{2})/);
  if (isoMatch) return isoMatch[1];
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? null : localDateISO(parsed);
}

export function normalizeTaskLifecycleStatus(value, fallback = 'backlog') {
  return VALID_TASK_STATUSES.has(value) ? value : fallback;
}

export function getTaskStartTimestamp(task = {}) {
  return normalizeExecutionDate(task.startTimestamp || task.startedAt);
}

export function getTaskCompletedTimestamp(task = {}) {
  return normalizeExecutionDate(task.completedTimestamp || task.completedAt);
}

export function mergeTaskLifecycleFields(task = {}, updates = {}) {
  const next = { ...(updates || {}) };
  const hasStatus = Object.prototype.hasOwnProperty.call(next, 'status');
  const hasStartedAt = Object.prototype.hasOwnProperty.call(next, 'startedAt');
  const hasStartTimestamp = Object.prototype.hasOwnProperty.call(next, 'startTimestamp');
  const hasCompletedAt = Object.prototype.hasOwnProperty.call(next, 'completedAt');
  const hasCompletedTimestamp = Object.prototype.hasOwnProperty.call(next, 'completedTimestamp');
  const hasStartField = hasStartedAt || hasStartTimestamp;
  const hasCompletedField = hasCompletedAt || hasCompletedTimestamp;

  if (!hasStatus && !hasStartField && !hasCompletedField) return next;

  const today = localDateISO();
  const previousStatus = normalizeTaskLifecycleStatus(task?.status, 'backlog');
  const nextStatus = normalizeTaskLifecycleStatus(
    hasStatus ? next.status : task?.status,
    previousStatus
  );
  let startTimestamp = hasStartField
    ? normalizeExecutionDate(hasStartTimestamp ? next.startTimestamp : next.startedAt)
    : getTaskStartTimestamp(task);
  let completedTimestamp = hasCompletedField
    ? normalizeExecutionDate(hasCompletedTimestamp ? next.completedTimestamp : next.completedAt)
    : getTaskCompletedTimestamp(task);

  if (nextStatus === 'in_progress' && !startTimestamp) {
    startTimestamp = today;
  }

  if (nextStatus === 'completed' && (!completedTimestamp || previousStatus !== 'completed') && !hasCompletedField) {
    completedTimestamp = today;
  }

  next.status = nextStatus;
  next.startTimestamp = startTimestamp;
  next.startedAt = startTimestamp;
  next.completedTimestamp = completedTimestamp;
  next.completedAt = completedTimestamp;
  return next;
}
