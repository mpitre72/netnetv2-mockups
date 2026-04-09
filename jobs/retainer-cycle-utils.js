const MONTH_LABEL = new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' });
const MONTH_LABEL_SHORT = new Intl.DateTimeFormat('en-US', { month: 'short', year: 'numeric' });

export function getCurrentCycleKey(date = new Date()) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  return `${year}-${month}`;
}

export function shiftCycleKey(cycleKey, delta = 0) {
  const [yearStr, monthStr] = String(cycleKey || '').split('-');
  const year = Number(yearStr) || new Date().getFullYear();
  const month = Number(monthStr) || new Date().getMonth() + 1;
  const base = new Date(year, month - 1, 1);
  base.setMonth(base.getMonth() + delta);
  const nextYear = base.getFullYear();
  const nextMonth = `${base.getMonth() + 1}`.padStart(2, '0');
  return `${nextYear}-${nextMonth}`;
}

export function formatCycleLabel(cycleKey) {
  const [yearStr, monthStr] = String(cycleKey || '').split('-');
  const year = Number(yearStr);
  const month = Number(monthStr);
  if (!year || !month) return cycleKey || '';
  return MONTH_LABEL.format(new Date(year, month - 1, 1));
}

export function formatCycleLabelShort(cycleKey) {
  const [yearStr, monthStr] = String(cycleKey || '').split('-');
  const year = Number(yearStr);
  const month = Number(monthStr);
  if (!year || !month) return cycleKey || '';
  return MONTH_LABEL_SHORT.format(new Date(year, month - 1, 1));
}

export function getTaskCycleKey(task, fallbackCycleKey) {
  if (isRecurringTemplateTask(task)) return null;
  return task?.cycleKey || fallbackCycleKey || null;
}

export function isRecurringTemplateTask(task) {
  return !!(task?.isRecurring && task?.recurringTemplateId && !task?.cycleKey);
}

function cloneTemplateAllocations(task) {
  return (Array.isArray(task?.allocations) ? task.allocations : []).map((allocation) => ({
    ...allocation,
    actualHours: null,
  }));
}

export function deriveRecurringDueDate(baseDueDate, cycleKey) {
  if (!baseDueDate || !cycleKey) return null;
  const [yearStr, monthStr] = String(cycleKey || '').split('-');
  const [, , dayStr] = String(baseDueDate || '').split('-');
  const year = Number(yearStr);
  const month = Number(monthStr);
  const day = Number(dayStr);
  if (!year || !month || !day) return null;
  const lastDay = new Date(year, month, 0).getDate();
  const safeDay = Math.min(day, lastDay);
  return `${yearStr}-${String(month).padStart(2, '0')}-${String(safeDay).padStart(2, '0')}`;
}

export function createRecurringInstanceFromTemplate(template, cycleKey) {
  if (!template || !cycleKey) return null;
  return {
    ...template,
    id: `task_${Math.random().toString(36).slice(2, 9)}`,
    cycleKey,
    dueDate: deriveRecurringDueDate(template.dueDate, cycleKey),
    status: 'backlog',
    startedAt: null,
    startTimestamp: null,
    completedAt: null,
    completedTimestamp: null,
    actualHours: null,
    timeEntries: [],
    allocations: cloneTemplateAllocations(template),
    isDraft: false,
  };
}

export function getPoolsForCycle(deliverable, cycleKey) {
  if (!deliverable || !cycleKey) return deliverable?.pools || [];
  const poolsByCycle = deliverable.poolsByCycle || {};
  return Array.isArray(poolsByCycle[cycleKey]) ? poolsByCycle[cycleKey] : (deliverable.pools || []);
}

export function isDeliverableVisibleInCycle(deliverable, cycleKey) {
  if (!deliverable || !cycleKey) return true;
  const cyclePools = deliverable?.poolsByCycle?.[cycleKey];
  if (Array.isArray(cyclePools) && cyclePools.length) return true;

  const tasks = Array.isArray(deliverable?.tasks) ? deliverable.tasks : [];
  const hasCycleTask = tasks.some((task) => (
    !isRecurringTemplateTask(task)
    && String(getTaskCycleKey(task, cycleKey) || '') === String(cycleKey)
  ));
  if (hasCycleTask) return true;

  const hasExplicitCyclePools = Object.keys(deliverable?.poolsByCycle || {}).length > 0;
  if (deliverable?.createdCycleKey) {
    return String(deliverable.createdCycleKey) === String(cycleKey);
  }
  if (hasExplicitCyclePools) return false;

  return Array.isArray(deliverable?.pools) && deliverable.pools.length > 0;
}

export function ensureRecurringInstances(job, cycleKey) {
  if (!job || job.kind !== 'retainer' || !cycleKey) return { deliverables: job?.deliverables || [], changed: false };
  let changed = false;
  const deliverables = (job.deliverables || []).map((deliverable) => {
    const tasks = Array.isArray(deliverable.tasks) ? [...deliverable.tasks] : [];
    const templates = tasks.filter((task) => isRecurringTemplateTask(task));
    if (!templates.length) return deliverable;
    templates.forEach((template) => {
      const already = tasks.some((task) => (
        task.recurringTemplateId === template.recurringTemplateId
        && String(task.cycleKey || '') === String(cycleKey)
      ));
      if (already) return;
      const clone = createRecurringInstanceFromTemplate(template, cycleKey);
      if (!clone) return;
      tasks.unshift(clone);
      changed = true;
    });
    return changed ? { ...deliverable, tasks } : deliverable;
  });
  return { deliverables, changed };
}
