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
  return task?.cycleKey || fallbackCycleKey || null;
}

export function getPoolsForCycle(deliverable, cycleKey) {
  if (!deliverable || !cycleKey) return deliverable?.pools || [];
  const poolsByCycle = deliverable.poolsByCycle || {};
  return Array.isArray(poolsByCycle[cycleKey]) ? poolsByCycle[cycleKey] : (deliverable.pools || []);
}

export function ensureRecurringInstances(job, cycleKey) {
  if (!job || job.kind !== 'retainer' || !cycleKey) return { deliverables: job?.deliverables || [], changed: false };
  let changed = false;
  const deliverables = (job.deliverables || []).map((deliverable) => {
    const tasks = Array.isArray(deliverable.tasks) ? [...deliverable.tasks] : [];
    const recurring = tasks.filter((task) => task.isRecurring && task.recurringTemplateId);
    if (!recurring.length) return deliverable;
    const byTemplate = new Map();
    recurring.forEach((task) => {
      const key = String(task.recurringTemplateId);
      const existing = byTemplate.get(key);
      if (!existing || String(existing.cycleKey || '') < String(task.cycleKey || '')) {
        byTemplate.set(key, task);
      }
    });
    byTemplate.forEach((template) => {
      const already = tasks.some((task) => (
        task.recurringTemplateId === template.recurringTemplateId
        && String(task.cycleKey || '') === String(cycleKey)
      ));
      if (already) return;
      const clone = {
        ...template,
        id: `task_${Math.random().toString(36).slice(2, 9)}`,
        cycleKey,
        status: 'backlog',
        completedAt: null,
      };
      tasks.unshift(clone);
      changed = true;
    });
    return changed ? { ...deliverable, tasks } : deliverable;
  });
  return { deliverables, changed };
}
