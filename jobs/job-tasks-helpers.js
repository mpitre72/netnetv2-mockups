export const READY_TASK_MESSAGE = 'To start work, complete the task (due date + allocations).';

export function getAllowedServiceTypeIds(deliverable, cycleKey = null) {
  if (!deliverable) return [];
  let pools = deliverable.pools;
  if (cycleKey && deliverable.poolsByCycle && Array.isArray(deliverable.poolsByCycle[cycleKey])) {
    pools = deliverable.poolsByCycle[cycleKey];
  }
  if (!Array.isArray(pools)) return [];
  return pools
    .filter((pool) => Number(pool?.estimatedHours) > 0)
    .map((pool) => pool.serviceTypeId)
    .filter(Boolean);
}

export function isTaskReady(task, deliverable, cycleKey = null) {
  if (!task || task.isDraft) return false;
  if (!task.dueDate) return false;
  if (!Array.isArray(task.allocations) || task.allocations.length < 1) return false;
  const effectiveCycle = cycleKey || task.cycleKey || null;
  const allowedServiceTypeIds = getAllowedServiceTypeIds(deliverable, effectiveCycle);
  return task.allocations.every((alloc) => {
    if (!alloc.assigneeUserId) return false;
    if (!alloc.serviceTypeId || !allowedServiceTypeIds.includes(alloc.serviceTypeId)) return false;
    return Number(alloc.loeHours) > 0;
  });
}
