const DAY_MS = 24 * 60 * 60 * 1000;

function parseDate(iso) {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d;
}

function remainingHoursForTask(task) {
  if (task.completed) return 0;
  const actual = Number(task.actualHours) || 0;
  if (Number.isFinite(task.remainingHours) && task.remainingHours > 0) {
    return task.remainingHours;
  }
  const est = Number(task.estimatedHours);
  const assigned = Number(task.assignedHours);
  const base = Number.isFinite(est) ? est : Number.isFinite(assigned) ? assigned : null;
  if (base == null) return null;
  return Math.max(0, base - actual);
}

export function buildCapacityForecast({ horizonDays = 30, team = [], jobs = [], deliverables = [], tasks = [], todayOverride } = {}) {
  const today = todayOverride ? new Date(todayOverride) : new Date();
  const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const horizonEnd = new Date(todayStart.getTime() + horizonDays * DAY_MS);
  const jobById = new Map(jobs.map((j) => [j.id, j]));
  const deliverableById = new Map(deliverables.map((d) => [d.id, d]));

  // Capacity per member
  const teamStats = team.map((member) => ({
    ...member,
    horizonCapacityHours: Math.round(((Number(member.monthlyCapacityHours) || 0) / 30) * horizonDays),
    assignedKnownDemandHours: 0,
    unknownTasks: [],
    deliverablesContributing: new Map(),
  }));
  const teamById = new Map(teamStats.map((m) => [m.id, m]));

  // Demand aggregation
  let knownDemandHours = 0;
  let unassignedDemandHours = 0;
  let unassignedKnownTaskCount = 0;
  let unknownDemandTaskCount = 0;
  let unknownUnassignedTaskCount = 0;
  const serviceTypeDemand = new Map(); // id -> { knownDemandHours, deliverables: Map }
  const deliverableEvidence = new Map();

  const ensureDeliverableEvidence = (del) => {
    if (!deliverableEvidence.has(del.id)) {
      deliverableEvidence.set(del.id, {
        deliverableId: del.id,
        deliverableName: del.name,
        jobId: del.jobId,
        jobName: jobById.get(del.jobId)?.name || `Job ${del.jobId}`,
        clientName: jobById.get(del.jobId)?.client || 'Client',
        dueDate: del.due,
        knownHoursTotal: 0,
        unknownTaskCountTotal: 0,
        unassignedKnownHoursTotal: 0,
      });
    }
    return deliverableEvidence.get(del.id);
  };

  const ensureServiceTypeEntry = (id) => {
    if (!serviceTypeDemand.has(id)) {
      serviceTypeDemand.set(id, {
        serviceTypeId: id,
        knownDemandHours: 0,
        deliverables: new Map(),
      });
    }
    return serviceTypeDemand.get(id);
  };

  tasks.forEach((task) => {
    const del = deliverableById.get(task.deliverableId);
    if (!del) return;
    const due = parseDate(del.due);
    if (!due || due < todayStart || due > horizonEnd) return;
    if (del.status === 'completed') return;

    const remaining = remainingHoursForTask(task);
    const assigneeId = task.assigneeId;
    const deliverableEntry = ensureDeliverableEvidence(del);
    const serviceTypeId = task.serviceTypeId || 'other';
    const svc = ensureServiceTypeEntry(serviceTypeId);
    const svcDelEntry = (() => {
      const existing = svc.deliverables.get(del.id);
      if (existing) return existing;
      const next = {
        deliverableId: del.id,
        deliverableName: del.name,
        jobId: del.jobId,
        jobName: deliverableEntry.jobName,
        clientName: deliverableEntry.clientName,
        dueDate: del.due,
        knownHours: 0,
        unknownTasks: 0,
        unassignedKnownHours: 0,
      };
      svc.deliverables.set(del.id, next);
      return next;
    })();

    if (remaining == null) {
      unknownDemandTaskCount += 1;
      const member = assigneeId ? teamById.get(assigneeId) : null;
      if (member) {
        member.unknownTasks.push(task);
        const key = del.id;
        const entry = member.deliverablesContributing.get(key) || {
          deliverableId: del.id,
          deliverableName: del.name,
          jobId: del.jobId,
          jobName: deliverableEntry.jobName,
          clientName: deliverableEntry.clientName,
          dueDate: del.due,
          memberAssignedKnownHours: 0,
          memberUnknownTaskCount: 0,
        };
        entry.memberUnknownTaskCount += 1;
        member.deliverablesContributing.set(key, entry);
      } else {
        unknownUnassignedTaskCount += 1;
      }
      deliverableEntry.unknownTaskCountTotal += 1;
      svcDelEntry.unknownTasks += 1;
      return;
    }

    const member = assigneeId ? teamById.get(assigneeId) : null;
    if (member) {
      member.assignedKnownDemandHours += remaining;
      const key = del.id;
      const entry = member.deliverablesContributing.get(key) || {
        deliverableId: del.id,
        deliverableName: del.name,
        jobId: del.jobId,
        jobName: deliverableEntry.jobName,
        clientName: deliverableEntry.clientName,
        dueDate: del.due,
        memberAssignedKnownHours: 0,
        memberUnknownTaskCount: 0,
      };
      entry.memberAssignedKnownHours += remaining;
      member.deliverablesContributing.set(key, entry);
    } else {
      unassignedDemandHours += remaining;
      unassignedKnownTaskCount += 1;
      deliverableEntry.unassignedKnownHoursTotal += remaining;
    }
    knownDemandHours += remaining;

    deliverableEntry.knownHoursTotal += remaining;
    svc.knownDemandHours += remaining;
    svcDelEntry.knownHours += remaining;
    if (!assigneeId) {
      svcDelEntry.unassignedKnownHours += remaining;
    }
  });

  const capacityHours = teamStats.reduce((sum, m) => sum + (m.horizonCapacityHours || 0), 0);
  const allUnknown = knownDemandHours === 0 && unknownDemandTaskCount > 0;
  const capacityPressurePct = !capacityHours || allUnknown
    ? null
    : Math.round((knownDemandHours / capacityHours) * 100);
  const capacityStateLabel = capacityPressurePct == null
    ? 'Unknown'
    : capacityPressurePct > 100
      ? 'Overloaded'
      : capacityPressurePct >= 85
        ? 'Tight'
        : 'Balanced';

  const teamRows = teamStats
    .map((m) => {
      const utilizationPct = m.horizonCapacityHours
        ? Math.round((m.assignedKnownDemandHours / m.horizonCapacityHours) * 100)
        : 0;
      const utilizationState = m.horizonCapacityHours === 0
        ? 'Unknown'
        : utilizationPct > 100
          ? 'Overloaded'
          : utilizationPct >= 85
            ? 'Tight'
            : 'Balanced';
      return {
        memberId: m.id,
        memberName: m.name,
        horizonCapacityHours: m.horizonCapacityHours,
        assignedKnownDemandHours: Math.round(m.assignedKnownDemandHours),
        utilizationPct,
        utilizationState,
        deliverablesContributing: Array.from(m.deliverablesContributing.values()),
        unknownTasks: m.unknownTasks,
      };
    })
    .sort((a, b) => b.utilizationPct - a.utilizationPct);

  const totalServiceDemand = Array.from(serviceTypeDemand.values()).reduce((sum, entry) => sum + entry.knownDemandHours, 0) || 0;
  const serviceTypes = Array.from(serviceTypeDemand.values())
    .map((entry) => ({
      serviceTypeId: entry.serviceTypeId,
      knownDemandHours: Math.round(entry.knownDemandHours),
      sharePct: totalServiceDemand ? Math.round((entry.knownDemandHours / totalServiceDemand) * 100) : 0,
      deliverablesContributing: Array.from(entry.deliverables.values()),
    }))
    .sort((a, b) => b.knownDemandHours - a.knownDemandHours);

  const deliverablesInHorizon = Array.from(deliverableEvidence.values()).sort((a, b) => {
    const aDate = parseDate(a.dueDate);
    const bDate = parseDate(b.dueDate);
    if (aDate && bDate) return aDate - bDate;
    if (aDate) return -1;
    if (bDate) return 1;
    return a.deliverableName.localeCompare(b.deliverableName);
  });

  const unknownDemandDeliverableCount = deliverablesInHorizon.filter((d) => d.unknownTaskCountTotal > 0).length;

  return {
    horizonLabel: `Next ${horizonDays} days`,
    horizonDays,
    knownDemandHours: Math.round(knownDemandHours),
    capacityHours: Math.round(capacityHours),
    capacityPressurePct,
    capacityStateLabel,
    unknownDemandTaskCount,
    unknownDemandDeliverableCount,
    unassignedDemandHours: Math.round(unassignedDemandHours),
    unassignedKnownTaskCount,
    unknownUnassignedTaskCount,
    teamRows,
    serviceTypes,
    deliverablesInHorizon,
  };
}
