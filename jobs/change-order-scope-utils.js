import { createPlanStateFromJob } from './jobs-plan-grid.js';
import { getCurrentCycleKey } from './retainer-cycle-utils.js';

const CYCLE_KEY_RE = /^\d{4}-\d{2}$/;

function createId(prefix) {
  return `${prefix}_${Math.random().toString(36).slice(2, 9)}`;
}

function roundHours(value) {
  return Math.round((Number(value) || 0) * 100) / 100;
}

function stringOrNull(value) {
  const trimmed = String(value || '').trim();
  return trimmed || null;
}

function normalizeMonth(value, fallback = null) {
  const candidate = String(value || '').trim();
  if (CYCLE_KEY_RE.test(candidate)) return candidate;
  return fallback && CYCLE_KEY_RE.test(String(fallback || '').trim()) ? String(fallback) : null;
}

function stableKeyPart(value, fallback = 'item') {
  const trimmed = String(value ?? '').trim();
  if (!trimmed) return fallback;
  const sanitized = trimmed.replace(/[^a-zA-Z0-9_-]+/g, '_').replace(/^_+|_+$/g, '');
  return sanitized || fallback;
}

function buildDeterministicId(prefix, parts = []) {
  return [prefix, ...(parts || []).map((part, index) => stableKeyPart(part, `part${index + 1}`))].join('_');
}

function normalizePlanRows(rows = []) {
  if (!Array.isArray(rows)) return [];
  return rows
    .map((row) => {
      if (!row) return null;
      const name = String(row?.name || '').trim();
      const pools = row?.pools && typeof row.pools === 'object'
        ? Object.keys(row.pools).reduce((acc, key) => {
          acc[String(key)] = roundHours(row.pools[key]);
          return acc;
        }, {})
        : {};
      return {
        id: row?.id || createId('del'),
        name,
        dueDate: row?.dueDate || null,
        pools,
      };
    })
    .filter(Boolean);
}

export function clonePlanStructure(plan = {}) {
  const serviceTypeIds = Array.isArray(plan?.serviceTypeIds)
    ? [...new Set(plan.serviceTypeIds.map((id) => String(id)).filter(Boolean))]
    : [];
  return {
    serviceTypeIds,
    serviceTypeNames: Object.keys(plan?.serviceTypeNames || {}).reduce((acc, key) => {
      const value = String(plan?.serviceTypeNames?.[key] || '').trim();
      if (value) acc[String(key)] = value;
      return acc;
    }, {}),
    rows: normalizePlanRows(plan?.rows || []),
  };
}

function isEmptyPlan(plan = {}) {
  const normalized = clonePlanStructure(plan);
  return !normalized.rows.length && !normalized.serviceTypeIds.length;
}

function clonePlanSnapshotRecord(snapshot = null, jobKind = 'project') {
  if (!snapshot || typeof snapshot !== 'object') return null;
  if (jobKind === 'retainer') {
    const source = snapshot?.mode === 'retainer'
      ? (snapshot.byMonth || {})
      : (snapshot?.byMonth && typeof snapshot.byMonth === 'object' ? snapshot.byMonth : snapshot);
    const byMonth = Object.keys(source || {}).reduce((acc, key) => {
      const cycleKey = normalizeMonth(key);
      if (!cycleKey) return acc;
      acc[cycleKey] = clonePlanStructure(source[key] || {});
      return acc;
    }, {});
    return Object.keys(byMonth).length ? { mode: 'retainer', byMonth } : null;
  }
  const source = snapshot?.mode === 'project' ? snapshot?.plan : (snapshot?.plan || snapshot);
  const plan = clonePlanStructure(source || {});
  return isEmptyPlan(plan) ? null : { mode: 'project', plan };
}

export function normalizePlanSnapshotRecord(snapshot = null, jobKind = 'project') {
  return clonePlanSnapshotRecord(snapshot, jobKind);
}

function normalizeHoursMap(serviceTypeHours = {}, { keepZero = false } = {}) {
  if (!serviceTypeHours || typeof serviceTypeHours !== 'object') return {};
  return Object.keys(serviceTypeHours).reduce((acc, key) => {
    const value = roundHours(serviceTypeHours[key]);
    if (keepZero ? Number.isFinite(value) : value !== 0) acc[String(key)] = value;
    return acc;
  }, {});
}

function normalizeScopeMode(rawScopeMode, jobKind = 'project') {
  const value = String(rawScopeMode || '').trim();
  if (value === 'retainer' || value === 'cycle') return 'retainer';
  if (value === 'project' || value === 'job') return 'project';
  return jobKind === 'retainer' ? 'retainer' : 'project';
}

export function normalizeChangeOrderScopeFields(changeOrder = {}, jobKind = 'project', fallbackCycleKey = null) {
  const scopeMode = normalizeScopeMode(
    changeOrder?.scopeMode || changeOrder?.scope_mode,
    jobKind
  );
  const effectiveStartMonth = scopeMode === 'retainer'
    ? normalizeMonth(
      changeOrder?.effectiveStartMonth
        || changeOrder?.effective_start_month
        || changeOrder?.effectiveMonth
        || changeOrder?.effective_month
        || changeOrder?.cycleKey
        || changeOrder?.cycle_key
        || String(changeOrder?.appliedAt || '').slice(0, 7)
        || String(changeOrder?.applied_at || '').slice(0, 7),
      fallbackCycleKey || getCurrentCycleKey()
    )
    : null;
  const effectiveMonth = scopeMode === 'retainer'
    ? normalizeMonth(
      changeOrder?.effectiveMonth
        || changeOrder?.effective_month
        || changeOrder?.effectiveStartMonth
        || changeOrder?.effective_start_month
        || changeOrder?.cycleKey
        || changeOrder?.cycle_key
        || String(changeOrder?.appliedAt || '').slice(0, 7)
        || String(changeOrder?.applied_at || '').slice(0, 7),
      fallbackCycleKey || getCurrentCycleKey()
    )
    : null;
  const effectiveDate = scopeMode === 'project'
    ? stringOrNull(changeOrder?.effectiveDate || changeOrder?.effective_date)
    : null;
  return {
    scopeMode,
    effectiveDate,
    effectiveMonth,
    effectiveStartMonth,
    cycleKey: effectiveMonth,
  };
}

function normalizeChangeOrderStatus(rawStatus) {
  return String(rawStatus || '').trim() === 'applied' ? 'applied' : 'draft';
}

function normalizeCanonicalChangeOrderItem(item = {}, changeOrderId = null, index = 0) {
  const actionType = String(item?.actionType || item?.action_type || '').trim() === 'add_deliverable'
    ? 'add_deliverable'
    : 'modify_deliverable';
  const hoursDelta = Number(item?.hoursDelta ?? item?.hours_delta);
  const payload = item?.payload && typeof item.payload === 'object' ? { ...item.payload } : null;
  const deliverableId = actionType === 'modify_deliverable'
    ? stringOrNull(item?.deliverableId || item?.deliverable_id)
    : null;
  const deliverableTempKey = actionType === 'add_deliverable'
    ? stringOrNull(item?.deliverableTempKey || item?.deliverable_temp_key)
    : null;
  const serviceTypeId = stringOrNull(item?.serviceTypeId || item?.service_type_id);
  return {
    id: stringOrNull(item?.id) || buildDeterministicId('coitem', [
      changeOrderId || 'co',
      actionType,
      deliverableId || deliverableTempKey || serviceTypeId || 'item',
      index,
    ]),
    changeOrderId: stringOrNull(item?.changeOrderId || item?.change_order_id || changeOrderId),
    actionType,
    deliverableId,
    deliverableTempKey,
    serviceTypeId,
    hoursDelta: Number.isFinite(hoursDelta) ? roundHours(hoursDelta) : 0,
    payload,
  };
}

function normalizeLegacyChangeOrderItems(changes = [], changeOrderId = null) {
  if (!Array.isArray(changes)) return [];
  return changes.flatMap((change, changeIndex) => {
    if (!change || typeof change !== 'object') return [];
    const actionType = change?.kind === 'new_deliverable' ? 'add_deliverable' : 'modify_deliverable';
    const serviceTypeHours = normalizeHoursMap(change?.serviceTypeHours || {}, { keepZero: false });
    const payload = {
      legacyChangeId: change?.id || null,
      name: String(change?.name || ''),
      description: actionType === 'add_deliverable' ? String(change?.description || '') : '',
      internalNotes: actionType === 'add_deliverable' ? String(change?.internalNotes || '') : '',
      createdDeliverableId: stringOrNull(change?.createdDeliverableId),
      orderIndex: Number.isFinite(Number(change?.orderIndex)) ? Math.max(0, Math.round(Number(change.orderIndex))) : null,
      remove: !!change?.remove,
    };
    const hourEntries = Object.keys(serviceTypeHours).length
      ? Object.entries(serviceTypeHours)
      : [[null, 0]];
    return hourEntries.map(([serviceTypeId, hoursDelta], index) => ({
      id: buildDeterministicId('coitem', [
        changeOrderId || 'co',
        change?.id || `legacy_${changeIndex}`,
        serviceTypeId || 'none',
        index,
      ]),
      changeOrderId: stringOrNull(changeOrderId),
      actionType,
      deliverableId: actionType === 'modify_deliverable' ? stringOrNull(change?.deliverableId) : null,
      deliverableTempKey: actionType === 'add_deliverable'
        ? stringOrNull(change?.deliverableTempKey || change?.createdDeliverableId || change?.id)
        : null,
      serviceTypeId: stringOrNull(serviceTypeId),
      hoursDelta: roundHours(hoursDelta),
      payload: {
        ...payload,
        legacyItemIndex: index,
      },
    }));
  });
}

function buildLegacyChangesFromItems(items = []) {
  const groups = new Map();
  (items || []).forEach((item) => {
    if (!item || typeof item !== 'object') return;
    const payload = item?.payload && typeof item.payload === 'object' ? item.payload : {};
    const isNewDeliverable = item.actionType === 'add_deliverable';
    const baseKey = isNewDeliverable
      ? `new:${item.deliverableTempKey || payload.createdDeliverableId || payload.legacyChangeId || item.id}`
      : `existing:${item.deliverableId || payload.legacyChangeId || item.id}`;
    if (!groups.has(baseKey)) {
      groups.set(baseKey, {
        id: stringOrNull(payload.legacyChangeId) || item.id || createId('cochg'),
        kind: isNewDeliverable ? 'new_deliverable' : 'existing',
        deliverableId: isNewDeliverable ? '' : (item.deliverableId || ''),
        createdDeliverableId: stringOrNull(payload.createdDeliverableId),
        name: String(payload.name || ''),
        description: isNewDeliverable ? String(payload.description || '') : '',
        internalNotes: isNewDeliverable ? String(payload.internalNotes || '') : '',
        serviceTypeHours: {},
        orderIndex: Number.isFinite(Number(payload.orderIndex)) ? Math.max(0, Math.round(Number(payload.orderIndex))) : null,
        remove: !!payload.remove,
      });
    }
    const group = groups.get(baseKey);
    if (String(payload.name || '').trim()) group.name = String(payload.name || '').trim();
    if (Number.isFinite(Number(payload.orderIndex))) group.orderIndex = Math.max(0, Math.round(Number(payload.orderIndex)));
    if (payload.remove) group.remove = true;
    if (item.serviceTypeId) {
      group.serviceTypeHours[String(item.serviceTypeId)] = roundHours(
        (Number(group.serviceTypeHours[String(item.serviceTypeId)]) || 0) + (Number(item.hoursDelta) || 0)
      );
    }
  });
  return [...groups.values()].map((change) => ({
    ...change,
    serviceTypeHours: normalizeHoursMap(change.serviceTypeHours || {}, { keepZero: false }),
  }));
}

export function normalizeChangeOrderRecord(changeOrder = {}, jobKind = 'project', fallbackCycleKey = null) {
  const scope = normalizeChangeOrderScopeFields(changeOrder, jobKind, fallbackCycleKey);
  const normalizedChangeOrderId = stringOrNull(changeOrder?.id) || buildDeterministicId('co', [
    changeOrder?.createdAt || changeOrder?.created_at || 'created',
    changeOrder?.name || 'Change Order',
    scope.scopeMode,
    scope.effectiveMonth || scope.effectiveDate || 'global',
  ]);
  const itemsSource = Array.isArray(changeOrder?.items) && changeOrder.items.length
    ? changeOrder.items
    : (Array.isArray(changeOrder?.changes) ? normalizeLegacyChangeOrderItems(changeOrder.changes, normalizedChangeOrderId) : []);
  const items = itemsSource
    .map((item, index) => normalizeCanonicalChangeOrderItem(item, normalizedChangeOrderId, index))
    .filter(Boolean);
  const isReverted = !!(changeOrder?.isReverted || changeOrder?.is_reverted || changeOrder?.revertedAt || changeOrder?.reverted_at);
  const status = normalizeChangeOrderStatus(changeOrder?.status);
  const normalized = {
    id: normalizedChangeOrderId,
    jobId: stringOrNull(changeOrder?.jobId || changeOrder?.job_id),
    name: String(changeOrder?.name || '').trim() || 'Change Order',
    notes: String(changeOrder?.notes || '').trim(),
    createdAt: changeOrder?.createdAt || changeOrder?.created_at || new Date().toISOString(),
    createdByUserId: stringOrNull(changeOrder?.createdByUserId || changeOrder?.created_by_user_id),
    status,
    scopeMode: scope.scopeMode,
    effectiveDate: scope.effectiveDate,
    effectiveMonth: scope.effectiveMonth,
    effectiveStartMonth: scope.effectiveStartMonth,
    appliedAt: status === 'applied'
      ? (changeOrder?.appliedAt || changeOrder?.applied_at || null)
      : null,
    revertedAt: changeOrder?.revertedAt || changeOrder?.reverted_at || null,
    isReverted,
    items,
  };
  const changes = buildLegacyChangesFromItems(items);
  return {
    ...normalized,
    cycleKey: normalized.effectiveMonth,
    effective_start_month: normalized.effectiveStartMonth,
    changes,
    impactHours: roundHours(items.reduce((sum, item) => sum + (Number(item?.hoursDelta) || 0), 0)),
  };
}

function collectPlanMetadataFromBranch(branch, targetIds, targetNames) {
  if (!branch || typeof branch !== 'object') return;
  (branch?.serviceTypeIds || []).forEach((id) => {
    if (id) targetIds.add(String(id));
  });
  Object.keys(branch?.serviceTypeNames || {}).forEach((key) => {
    const value = String(branch?.serviceTypeNames?.[key] || '').trim();
    if (value && !targetNames[String(key)]) targetNames[String(key)] = value;
  });
}

function getKnownPlanMetadata(job, originalPlanSnapshot = null) {
  const serviceTypeIds = new Set((job?.serviceTypeIds || []).map((id) => String(id)).filter(Boolean));
  const serviceTypeNames = {};

  Object.keys(job?.plan?.serviceTypeNames || {}).forEach((key) => {
    const value = String(job?.plan?.serviceTypeNames?.[key] || '').trim();
    if (value) serviceTypeNames[String(key)] = value;
  });

  collectPlanMetadataFromBranch(job?.originalPlan || {}, serviceTypeIds, serviceTypeNames);
  Object.keys(job?.originalPlanByCycle || {}).forEach((key) => {
    collectPlanMetadataFromBranch(job?.originalPlanByCycle?.[key] || {}, serviceTypeIds, serviceTypeNames);
  });

  if (originalPlanSnapshot?.mode === 'retainer') {
    Object.keys(originalPlanSnapshot.byMonth || {}).forEach((key) => {
      collectPlanMetadataFromBranch(originalPlanSnapshot.byMonth[key] || {}, serviceTypeIds, serviceTypeNames);
    });
  } else if (originalPlanSnapshot?.mode === 'project') {
    collectPlanMetadataFromBranch(originalPlanSnapshot.plan || {}, serviceTypeIds, serviceTypeNames);
  }

  return {
    serviceTypeIds: [...serviceTypeIds],
    serviceTypeNames,
  };
}

function createEmptyPlanBranch(job, originalPlanSnapshot = null) {
  const metadata = getKnownPlanMetadata(job, originalPlanSnapshot);
  return {
    serviceTypeIds: [...metadata.serviceTypeIds],
    serviceTypeNames: { ...(metadata.serviceTypeNames || {}) },
    rows: [],
  };
}

function hydratePlanServiceTypeNames(plan = {}, serviceTypes = []) {
  const nextPlan = clonePlanStructure(plan);
  const knownNames = new Map(
    (serviceTypes || [])
      .filter(Boolean)
      .map((type) => [String(type.id), String(type.name || type.id || '').trim() || String(type.id)])
  );
  (nextPlan.serviceTypeIds || []).forEach((serviceTypeId) => {
    const key = String(serviceTypeId);
    if (!nextPlan.serviceTypeNames[key] && knownNames.has(key)) {
      nextPlan.serviceTypeNames[key] = knownNames.get(key);
    }
  });
  return nextPlan;
}

function compareChangeOrders(a, b) {
  const leftTime = Date.parse(a?.createdAt || '') || 0;
  const rightTime = Date.parse(b?.createdAt || '') || 0;
  if (leftTime !== rightTime) return leftTime - rightTime;
  return String(a?.id || '').localeCompare(String(b?.id || ''));
}

function isMonthOnOrAfter(month, startMonth) {
  const normalizedMonth = normalizeMonth(month);
  const normalizedStartMonth = normalizeMonth(startMonth);
  if (!normalizedMonth || !normalizedStartMonth) return false;
  return normalizedMonth >= normalizedStartMonth;
}

function ensurePlanHasServiceType(plan, serviceTypeId, job, originalPlanSnapshot = null) {
  if (!serviceTypeId) return plan;
  const nextPlan = clonePlanStructure(plan);
  const key = String(serviceTypeId);
  if (!nextPlan.serviceTypeIds.includes(key)) nextPlan.serviceTypeIds.push(key);
  if (!nextPlan.serviceTypeNames[key]) {
    const metadata = getKnownPlanMetadata(job, originalPlanSnapshot);
    nextPlan.serviceTypeNames[key] = metadata.serviceTypeNames[key] || key;
  }
  return nextPlan;
}

function getSyntheticDeliverableGroupKey(item = {}) {
  return stringOrNull(
    item?.deliverableId
    || item?.deliverableTempKey
    || item?.payload?.createdDeliverableId
    || item?.id
  ) || 'item';
}

function getSyntheticDeliverableRowId(changeOrder, item) {
  const persistedId = stringOrNull(item?.payload?.createdDeliverableId || item?.deliverableTempKey);
  if (persistedId) return persistedId;
  return buildDeterministicId('co_del', [
    changeOrder?.id || 'co',
    getSyntheticDeliverableGroupKey(item),
  ]);
}

function applyHoursDeltaToRow(row, serviceTypeId, hoursDelta) {
  if (!serviceTypeId) return row;
  const pools = { ...(row?.pools || {}) };
  const current = Number(pools[String(serviceTypeId)]) || 0;
  const next = roundHours(current + (Number(hoursDelta) || 0));
  if (next > 0) {
    pools[String(serviceTypeId)] = next;
  } else {
    delete pools[String(serviceTypeId)];
  }
  return {
    ...row,
    pools,
  };
}

function applyChangeOrderItemsToPlan(plan, changeOrder, job, originalPlanSnapshot = null) {
  let nextPlan = clonePlanStructure(plan);
  const rowIndexById = new Map(nextPlan.rows.map((row, index) => [String(row.id), index]));
  const rowOrderOverrides = new Map();
  const removedRowIds = new Set();
  const applyRowPayload = (rowId, payload = {}) => {
    const key = String(rowId || '');
    const rowIndex = rowIndexById.get(key);
    if (rowIndex === undefined) return;
    const nextRow = { ...nextPlan.rows[rowIndex] };
    const nextName = String(payload?.name || '').trim();
    if (nextName) nextRow.name = nextName;
    nextPlan.rows[rowIndex] = nextRow;
    if (Number.isFinite(Number(payload?.orderIndex))) {
      rowOrderOverrides.set(key, Math.max(0, Math.round(Number(payload.orderIndex))));
    }
    if (payload?.remove) removedRowIds.add(key);
  };

  (changeOrder?.items || []).forEach((item) => {
    if (!item || typeof item !== 'object') return;
    if (item.serviceTypeId) {
      nextPlan = ensurePlanHasServiceType(nextPlan, item.serviceTypeId, job, originalPlanSnapshot);
    }

    if (item.actionType === 'modify_deliverable') {
      if (!item.deliverableId) return;
      const rowId = String(item.deliverableId);
      applyRowPayload(rowId, item.payload || {});
      if (!item.serviceTypeId) return;
      const rowIndex = rowIndexById.get(rowId);
      if (rowIndex === undefined) return;
      nextPlan.rows[rowIndex] = applyHoursDeltaToRow(nextPlan.rows[rowIndex], item.serviceTypeId, item.hoursDelta);
      return;
    }

    if (item.actionType !== 'add_deliverable') return;
    const rowId = getSyntheticDeliverableRowId(changeOrder, item);
    let rowIndex = rowIndexById.get(String(rowId));
    if (rowIndex === undefined) {
      nextPlan.rows.push({
        id: rowId,
        name: String(item?.payload?.name || '').trim() || 'New Deliverable',
        dueDate: null,
        pools: {},
      });
      rowIndex = nextPlan.rows.length - 1;
      rowIndexById.set(String(rowId), rowIndex);
    } else if (!String(nextPlan.rows[rowIndex]?.name || '').trim() && String(item?.payload?.name || '').trim()) {
      nextPlan.rows[rowIndex] = {
        ...nextPlan.rows[rowIndex],
        name: String(item.payload.name).trim(),
      };
    }
    applyRowPayload(rowId, item.payload || {});

    if (!item.serviceTypeId) return;
    nextPlan.rows[rowIndex] = applyHoursDeltaToRow(nextPlan.rows[rowIndex], item.serviceTypeId, item.hoursDelta);
  });

  if (removedRowIds.size) {
    nextPlan.rows = nextPlan.rows.filter((row) => !removedRowIds.has(String(row?.id || '')));
  }
  if (rowOrderOverrides.size) {
    const originalOrder = new Map(nextPlan.rows.map((row, index) => [String(row?.id || ''), index]));
    nextPlan.rows = [...nextPlan.rows].sort((left, right) => {
      const leftKey = String(left?.id || '');
      const rightKey = String(right?.id || '');
      const leftRank = rowOrderOverrides.has(leftKey) ? rowOrderOverrides.get(leftKey) : originalOrder.get(leftKey);
      const rightRank = rowOrderOverrides.has(rightKey) ? rowOrderOverrides.get(rightKey) : originalOrder.get(rightKey);
      if (leftRank !== rightRank) return (leftRank ?? 0) - (rightRank ?? 0);
      return (originalOrder.get(leftKey) ?? 0) - (originalOrder.get(rightKey) ?? 0);
    });
  }

  return nextPlan;
}

function buildRecomputedCurrentPlanSnapshot(job, originalPlanSnapshot, changeOrders = []) {
  const normalizedOriginal = normalizePlanSnapshotRecord(originalPlanSnapshot || null, job?.kind);
  const normalizedChangeOrders = (changeOrders || [])
    .map((changeOrder) => normalizeChangeOrderRecord(changeOrder, job?.kind, job?.currentCycleKey || null))
    .filter((changeOrder) => changeOrder.status === 'applied' && !changeOrder.isReverted)
    .sort(compareChangeOrders);

  if (job?.kind === 'retainer') {
    const byMonth = {};
    const months = new Set(Object.keys(normalizedOriginal?.byMonth || {}));
    months.add(normalizeMonth(job?.currentCycleKey, getCurrentCycleKey()) || getCurrentCycleKey());
    normalizedChangeOrders
      .filter((changeOrder) => isRetainerChangeOrder(changeOrder) && (changeOrder.effectiveStartMonth || changeOrder.effectiveMonth))
      .forEach((changeOrder) => months.add(String(changeOrder.effectiveStartMonth || changeOrder.effectiveMonth)));

    [...months].sort().forEach((month) => {
      let nextPlan = clonePlanStructure(
        normalizedOriginal?.byMonth?.[month]
        || createEmptyPlanBranch(job, normalizedOriginal)
      );
      normalizedChangeOrders.forEach((changeOrder) => {
        if (!isRetainerChangeOrder(changeOrder)) return;
        const startMonth = changeOrder.effectiveStartMonth || changeOrder.effectiveMonth;
        if (!isMonthOnOrAfter(month, startMonth)) return;
        nextPlan = applyChangeOrderItemsToPlan(nextPlan, changeOrder, job, normalizedOriginal);
      });
      byMonth[month] = nextPlan;
    });

    return { mode: 'retainer', byMonth };
  }

  let plan = clonePlanStructure(
    normalizedOriginal?.plan
    || createEmptyPlanBranch(job, normalizedOriginal)
  );
  normalizedChangeOrders.forEach((changeOrder) => {
    if (!isProjectChangeOrder(changeOrder)) return;
    plan = applyChangeOrderItemsToPlan(plan, changeOrder, job, normalizedOriginal);
  });
  return { mode: 'project', plan };
}

function buildCurrentPlanState(job, serviceTypes = [], { cycleKey = null } = {}) {
  return clonePlanStructure(createPlanStateFromJob(job, job?.serviceTypeIds || [], {
    cycleKey: job?.kind === 'retainer' ? cycleKey : null,
    serviceTypes,
  }));
}

export function getWorkingPlanState(job, { cycleKey = null, serviceTypes = [] } = {}) {
  const activeCycleKey = job?.kind === 'retainer'
    ? normalizeMonth(cycleKey || job?.currentCycleKey || getCurrentCycleKey(), getCurrentCycleKey())
    : null;
  const fallbackPlan = buildCurrentPlanState(job, serviceTypes, { cycleKey: activeCycleKey });
  const persistedPlan = clonePlanStructure(job?.plan || {});
  const mergedServiceTypeIds = persistedPlan.serviceTypeIds.length
    ? persistedPlan.serviceTypeIds
    : fallbackPlan.serviceTypeIds;
  return hydratePlanServiceTypeNames(clonePlanStructure({
    serviceTypeIds: mergedServiceTypeIds,
    serviceTypeNames: {
      ...(fallbackPlan.serviceTypeNames || {}),
      ...(persistedPlan.serviceTypeNames || {}),
    },
    rows: job?.kind === 'retainer'
      ? fallbackPlan.rows
      : (persistedPlan.rows.length ? persistedPlan.rows : fallbackPlan.rows),
  }), serviceTypes);
}

function collectRetainerCycleKeys(job, preferredCycleKey = null) {
  const keys = new Set();
  const pushKey = (value) => {
    const key = normalizeMonth(value);
    if (key) keys.add(key);
  };
  pushKey(preferredCycleKey);
  pushKey(job?.currentCycleKey);
  Object.keys(job?.originalPlanSnapshot?.byMonth || {}).forEach(pushKey);
  Object.keys(job?.currentPlanSnapshot?.byMonth || {}).forEach(pushKey);
  Object.keys(job?.originalPlanByCycle || {}).forEach(pushKey);
  Object.keys(job?.currentPlanSnapshot?.byMonth || {}).forEach(pushKey);
  (job?.deliverables || []).forEach((deliverable) => {
    Object.keys(deliverable?.poolsByCycle || {}).forEach(pushKey);
    pushKey(deliverable?.createdCycleKey);
    (deliverable?.tasks || []).forEach((task) => pushKey(task?.cycleKey));
  });
  (job?.unassignedTasks || []).forEach((task) => pushKey(task?.cycleKey));
  (job?.changeOrders || []).forEach((changeOrder) => {
    const scope = normalizeChangeOrderScopeFields(changeOrder, 'retainer', preferredCycleKey || job?.currentCycleKey || null);
    pushKey(scope.effectiveMonth);
    pushKey(scope.effectiveStartMonth);
  });
  if (!keys.size) pushKey(getCurrentCycleKey());
  return [...keys].sort();
}

export function snapshotCurrentPlan(job, { cycleKey = null, serviceTypes = [] } = {}) {
  if (!job || job?.kind === 'retainer') {
    const sourceJob = job || { kind: 'retainer', deliverables: [], serviceTypeIds: [] };
    const cycleKeys = collectRetainerCycleKeys(sourceJob, cycleKey);
    return {
      mode: 'retainer',
      byMonth: cycleKeys.reduce((acc, key) => {
        acc[key] = buildCurrentPlanState(sourceJob, serviceTypes, { cycleKey: key });
        return acc;
      }, {}),
    };
  }
  return {
    mode: 'project',
    plan: buildCurrentPlanState(job, serviceTypes, { cycleKey: null }),
  };
}

function getLegacyOriginalPlanCompatibility(job, snapshot) {
  if (job?.kind === 'retainer') {
    const byMonth = snapshot?.mode === 'retainer' && snapshot?.byMonth
      ? Object.keys(snapshot.byMonth).reduce((acc, key) => {
        acc[key] = clonePlanStructure(snapshot.byMonth[key] || {});
        return acc;
      }, {})
      : {};
    return {
      originalPlan: clonePlanStructure(job?.originalPlan || {}),
      originalPlanByCycle: byMonth,
    };
  }
  return {
    originalPlan: snapshot?.mode === 'project'
      ? clonePlanStructure(snapshot.plan || {})
      : clonePlanStructure(job?.originalPlan || {}),
    originalPlanByCycle: {},
  };
}

export function ensurePlanBaselines(job, { cycleKey = null, serviceTypes = [] } = {}) {
  if (!job) return job;

  const fallbackCycleKey = cycleKey || job?.currentCycleKey || getCurrentCycleKey();
  const nextChangeOrders = (job?.changeOrders || []).map((changeOrder) => {
    const normalized = normalizeChangeOrderRecord(changeOrder, job?.kind, fallbackCycleKey);
    return {
      ...normalized,
      jobId: normalized.jobId || stringOrNull(job?.id),
    };
  });

  const shouldInitializeMissing = job?.status !== 'pending';
  let originalPlanSnapshot = normalizePlanSnapshotRecord(job?.originalPlanSnapshot || null, job?.kind);
  let currentPlanSnapshot = normalizePlanSnapshotRecord(job?.currentPlanSnapshot || null, job?.kind);

  if (shouldInitializeMissing) {
    if (!originalPlanSnapshot) {
      originalPlanSnapshot = snapshotCurrentPlan({ ...job, changeOrders: nextChangeOrders }, {
        cycleKey: fallbackCycleKey,
        serviceTypes,
      });
    }
    if (!currentPlanSnapshot) {
      currentPlanSnapshot = clonePlanSnapshotRecord(originalPlanSnapshot, job?.kind);
    }
    if (job?.kind === 'retainer') {
      const cycleKeys = collectRetainerCycleKeys({ ...job, changeOrders: nextChangeOrders }, fallbackCycleKey);
      cycleKeys.forEach((key) => {
        if (!originalPlanSnapshot?.byMonth?.[key]) {
          originalPlanSnapshot = originalPlanSnapshot || { mode: 'retainer', byMonth: {} };
          originalPlanSnapshot.byMonth[key] = buildCurrentPlanState(job, serviceTypes, { cycleKey: key });
        }
        if (!currentPlanSnapshot?.byMonth?.[key]) {
          currentPlanSnapshot = currentPlanSnapshot || { mode: 'retainer', byMonth: {} };
          currentPlanSnapshot.byMonth[key] = clonePlanStructure(originalPlanSnapshot?.byMonth?.[key] || {});
        }
      });
    }
  }

  if (!currentPlanSnapshot && originalPlanSnapshot) {
    currentPlanSnapshot = clonePlanSnapshotRecord(originalPlanSnapshot, job?.kind);
  }

  if (originalPlanSnapshot) {
    currentPlanSnapshot = buildRecomputedCurrentPlanSnapshot(
      { ...job, changeOrders: nextChangeOrders },
      originalPlanSnapshot,
      nextChangeOrders
    );
  }

  const legacyPlan = getLegacyOriginalPlanCompatibility(job, originalPlanSnapshot);

  const currentChangeOrdersJson = JSON.stringify(job?.changeOrders || []);
  const nextChangeOrdersJson = JSON.stringify(nextChangeOrders);
  const currentOriginalSnapshotJson = JSON.stringify(job?.originalPlanSnapshot || null);
  const nextOriginalSnapshotJson = JSON.stringify(originalPlanSnapshot || null);
  const currentCurrentSnapshotJson = JSON.stringify(job?.currentPlanSnapshot || null);
  const nextCurrentSnapshotJson = JSON.stringify(currentPlanSnapshot || null);
  const currentOriginalPlanJson = JSON.stringify(job?.originalPlan || {});
  const nextOriginalPlanJson = JSON.stringify(legacyPlan.originalPlan || {});
  const currentOriginalPlanByCycleJson = JSON.stringify(job?.originalPlanByCycle || {});
  const nextOriginalPlanByCycleJson = JSON.stringify(legacyPlan.originalPlanByCycle || {});

  if (
    currentChangeOrdersJson === nextChangeOrdersJson
    && currentOriginalSnapshotJson === nextOriginalSnapshotJson
    && currentCurrentSnapshotJson === nextCurrentSnapshotJson
    && currentOriginalPlanJson === nextOriginalPlanJson
    && currentOriginalPlanByCycleJson === nextOriginalPlanByCycleJson
  ) {
    return job;
  }

  return {
    ...job,
    // Deliverables are persistent entities. Change Orders will mutate or extend them later;
    // they must not be rebuilt from scratch on every render.
    changeOrders: nextChangeOrders,
    originalPlanSnapshot,
    currentPlanSnapshot,
    originalPlan: legacyPlan.originalPlan,
    originalPlanByCycle: legacyPlan.originalPlanByCycle,
  };
}

export function ensureJobOriginalPlan(job, serviceTypes = []) {
  return ensurePlanBaselines(job, { serviceTypes });
}

export function isRetainerChangeOrder(changeOrder) {
  return normalizeScopeMode(changeOrder?.scopeMode || changeOrder?.scope_mode, 'project') === 'retainer';
}

export function isProjectChangeOrder(changeOrder) {
  return normalizeScopeMode(changeOrder?.scopeMode || changeOrder?.scope_mode, 'project') === 'project';
}

export function isChangeOrderApplicableToContext(changeOrder, job, { cycleKey = null, status = null } = {}) {
  if (!changeOrder || !job) return false;
  const normalized = normalizeChangeOrderRecord(changeOrder, job?.kind, cycleKey || job?.currentCycleKey || null);
  if (normalized.isReverted) return false;
  if (status && normalized.status !== status) return false;
  if (job?.kind !== 'retainer') return isProjectChangeOrder(normalized);
  if (!isRetainerChangeOrder(normalized)) return false;
  const activeMonth = normalizeMonth(cycleKey || job?.currentCycleKey || getCurrentCycleKey());
  const startMonth = normalizeMonth(
    normalized.effectiveStartMonth || normalized.effectiveMonth,
    activeMonth
  );
  return !!(activeMonth && startMonth && isMonthOnOrAfter(activeMonth, startMonth));
}

export function getApplicableChangeOrders(job, { cycleKey = null, status = 'applied' } = {}) {
  return (job?.changeOrders || [])
    .map((changeOrder) => normalizeChangeOrderRecord(changeOrder, job?.kind, cycleKey || job?.currentCycleKey || null))
    .filter((changeOrder) => isChangeOrderApplicableToContext(changeOrder, job, { cycleKey, status }));
}

export function getAppliedChangeOrders(source, { jobId = null, effectiveMonth = null } = {}) {
  if (Array.isArray(source?.jobs)) {
    return (source.jobs || []).flatMap((job) => {
      if (jobId && String(job?.id) !== String(jobId)) return [];
      return getApplicableChangeOrders(job, {
        cycleKey: effectiveMonth,
        status: 'applied',
      });
    });
  }
  if (Array.isArray(source)) {
    return source
      .map((changeOrder) => normalizeChangeOrderRecord(changeOrder, 'project', effectiveMonth))
      .filter((changeOrder) => changeOrder.status === 'applied' && !changeOrder.isReverted);
  }
  if (source?.changeOrders) {
    return getApplicableChangeOrders(source, {
      cycleKey: effectiveMonth,
      status: 'applied',
    });
  }
  return [];
}

export function recomputeCurrentPlan(job) {
  if (!job) return job;
  const normalizedChangeOrders = (job?.changeOrders || []).map((changeOrder) => normalizeChangeOrderRecord(
    changeOrder,
    job?.kind,
    job?.currentCycleKey || null
  ));
  let originalPlanSnapshot = normalizePlanSnapshotRecord(job?.originalPlanSnapshot || null, job?.kind);
  if (!originalPlanSnapshot) {
    originalPlanSnapshot = snapshotCurrentPlan({ ...job, changeOrders: normalizedChangeOrders }, {
      cycleKey: job?.currentCycleKey || getCurrentCycleKey(),
    });
  }
  const currentPlanSnapshot = buildRecomputedCurrentPlanSnapshot(
    { ...job, changeOrders: normalizedChangeOrders },
    originalPlanSnapshot,
    normalizedChangeOrders
  );
  const legacyPlan = getLegacyOriginalPlanCompatibility(job, originalPlanSnapshot);
  return {
    ...job,
    changeOrders: normalizedChangeOrders,
    originalPlanSnapshot: clonePlanSnapshotRecord(originalPlanSnapshot, job?.kind),
    currentPlanSnapshot,
    originalPlan: legacyPlan.originalPlan,
    originalPlanByCycle: legacyPlan.originalPlanByCycle,
  };
}

export function applyChangeOrder(job, changeOrderId) {
  if (!job || !changeOrderId) return job;
  const targetId = String(changeOrderId);
  let found = false;
  let changed = false;
  const now = new Date().toISOString();
  const nextChangeOrders = (job?.changeOrders || []).map((changeOrder) => {
    const normalized = normalizeChangeOrderRecord(changeOrder, job?.kind, job?.currentCycleKey || null);
    if (String(normalized.id) !== targetId) return normalized;
    found = true;
    if (normalized.status === 'applied' && !normalized.isReverted) return normalized;
    changed = true;
    return {
      ...normalized,
      status: 'applied',
      appliedAt: now,
      isReverted: false,
      revertedAt: null,
    };
  });
  if (!found || !changed) return job;
  return recomputeCurrentPlan({
    ...job,
    changeOrders: nextChangeOrders,
  });
}

export function revertChangeOrder(job, changeOrderId) {
  if (!job || !changeOrderId) return job;
  const targetId = String(changeOrderId);
  let found = false;
  let changed = false;
  const now = new Date().toISOString();
  const nextChangeOrders = (job?.changeOrders || []).map((changeOrder) => {
    const normalized = normalizeChangeOrderRecord(changeOrder, job?.kind, job?.currentCycleKey || null);
    if (String(normalized.id) !== targetId) return normalized;
    found = true;
    if (normalized.isReverted) return normalized;
    changed = true;
    return {
      ...normalized,
      status: 'applied',
      isReverted: true,
      revertedAt: now,
    };
  });
  if (!found || !changed) return job;
  return recomputeCurrentPlan({
    ...job,
    changeOrders: nextChangeOrders,
  });
}

export function getCurrentPlanFromBaseline(job, { cycleKey = null } = {}) {
  if (!job || job?.kind !== 'retainer') {
    const normalizedCurrent = normalizePlanSnapshotRecord(job?.currentPlanSnapshot || null, 'project');
    const normalizedOriginal = normalizePlanSnapshotRecord(job?.originalPlanSnapshot || null, 'project');
    if (!normalizedCurrent?.plan && !normalizedOriginal?.plan) {
      const snapshotted = snapshotCurrentPlan(job || {}, { cycleKey: null });
      if (snapshotted?.mode === 'project' && snapshotted?.plan) {
        return clonePlanStructure(snapshotted.plan);
      }
    }
    return clonePlanStructure(
      normalizedCurrent?.plan
      || normalizedOriginal?.plan
      || createEmptyPlanBranch(job, normalizedOriginal)
    );
  }
  const activeCycleKey = normalizeMonth(cycleKey || job?.currentCycleKey || getCurrentCycleKey(), getCurrentCycleKey());
  const normalizedCurrent = normalizePlanSnapshotRecord(job?.currentPlanSnapshot || null, 'retainer');
  const normalizedOriginal = normalizePlanSnapshotRecord(job?.originalPlanSnapshot || null, 'retainer');
  if (!normalizedCurrent?.byMonth?.[activeCycleKey]) {
    const recomputed = recomputeCurrentPlan({
      ...job,
      currentCycleKey: activeCycleKey,
    });
    const recomputedSnapshot = normalizePlanSnapshotRecord(recomputed?.currentPlanSnapshot || null, 'retainer');
    if (recomputedSnapshot?.byMonth?.[activeCycleKey]) {
      return clonePlanStructure(recomputedSnapshot.byMonth[activeCycleKey]);
    }
  }
  if (!normalizedCurrent?.byMonth?.[activeCycleKey] && !normalizedOriginal?.byMonth?.[activeCycleKey]) {
    const snapshotted = snapshotCurrentPlan(job, { cycleKey: activeCycleKey });
    if (snapshotted?.mode === 'retainer' && snapshotted?.byMonth?.[activeCycleKey]) {
      return clonePlanStructure(snapshotted.byMonth[activeCycleKey]);
    }
  }
  return clonePlanStructure(
    normalizedCurrent?.byMonth?.[activeCycleKey]
    || normalizedOriginal?.byMonth?.[activeCycleKey]
    || createEmptyPlanBranch(job, normalizedOriginal)
  );
}

export function getOriginalPlanState(job, serviceTypes = [], { cycleKey = null } = {}) {
  if (!job || job?.kind !== 'retainer') {
    const normalizedOriginal = normalizePlanSnapshotRecord(job?.originalPlanSnapshot || null, 'project');
    if (normalizedOriginal?.plan) return hydratePlanServiceTypeNames(clonePlanStructure(normalizedOriginal.plan), serviceTypes);
    const snapshotted = snapshotCurrentPlan(job || {}, { cycleKey: null, serviceTypes });
    if (snapshotted?.mode === 'project' && snapshotted?.plan) {
      return hydratePlanServiceTypeNames(clonePlanStructure(snapshotted.plan), serviceTypes);
    }
    return hydratePlanServiceTypeNames(createEmptyPlanBranch(job || {}, normalizedOriginal), serviceTypes);
  }
  const activeCycleKey = normalizeMonth(cycleKey || job?.currentCycleKey || getCurrentCycleKey(), getCurrentCycleKey());
  const normalizedOriginal = normalizePlanSnapshotRecord(job?.originalPlanSnapshot || null, 'retainer');
  if (normalizedOriginal?.byMonth?.[activeCycleKey]) {
    return hydratePlanServiceTypeNames(clonePlanStructure(normalizedOriginal.byMonth[activeCycleKey]), serviceTypes);
  }
  if (!normalizedOriginal) {
    const snapshotted = snapshotCurrentPlan(job, { cycleKey: activeCycleKey, serviceTypes });
    if (snapshotted?.mode === 'retainer' && snapshotted?.byMonth?.[activeCycleKey]) {
      return hydratePlanServiceTypeNames(clonePlanStructure(snapshotted.byMonth[activeCycleKey]), serviceTypes);
    }
  }
  return hydratePlanServiceTypeNames(createEmptyPlanBranch(job, normalizedOriginal), serviceTypes);
}

export function getCurrentPlanState(job, { cycleKey = null, serviceTypes = [] } = {}) {
  // Planning surfaces must read either the working plan or a snapshot-backed
  // original/current plan branch. They should never silently mix those sources.
  return hydratePlanServiceTypeNames(
    getCurrentPlanFromBaseline(job, { cycleKey }),
    serviceTypes
  );
}

export function buildWorkingPlanForChangeOrder(job, changeOrder = {}, { cycleKey = null, serviceTypes = [] } = {}) {
  const activeCycleKey = job?.kind === 'retainer'
    ? normalizeMonth(cycleKey || job?.currentCycleKey || getCurrentCycleKey(), getCurrentCycleKey())
    : null;
  const basePlan = getCurrentPlanState(job, { cycleKey: activeCycleKey, serviceTypes });
  const normalizedOriginal = normalizePlanSnapshotRecord(job?.originalPlanSnapshot || null, job?.kind);
  const normalizedChangeOrder = normalizeChangeOrderRecord(changeOrder, job?.kind, activeCycleKey);
  if (!(normalizedChangeOrder?.items || []).length) {
    return hydratePlanServiceTypeNames(clonePlanStructure(basePlan), serviceTypes);
  }
  return hydratePlanServiceTypeNames(
    applyChangeOrderItemsToPlan(basePlan, normalizedChangeOrder, job, normalizedOriginal),
    serviceTypes
  );
}

export function buildChangeOrderFromWorkingPlan(job, changeOrder = {}, workingPlan = {}, { cycleKey = null, serviceTypes = [] } = {}) {
  const activeCycleKey = job?.kind === 'retainer'
    ? normalizeMonth(cycleKey || job?.currentCycleKey || getCurrentCycleKey(), getCurrentCycleKey())
    : null;
  const basePlan = getCurrentPlanState(job, { cycleKey: activeCycleKey, serviceTypes });
  const normalizedWorkingPlan = hydratePlanServiceTypeNames(clonePlanStructure(workingPlan), serviceTypes);
  const serviceTypeIds = [...new Set([
    ...(basePlan?.serviceTypeIds || []).map((id) => String(id)),
    ...(normalizedWorkingPlan?.serviceTypeIds || []).map((id) => String(id)),
  ])];
  const baseRows = Array.isArray(basePlan?.rows) ? basePlan.rows : [];
  const workingRows = (Array.isArray(normalizedWorkingPlan?.rows) ? normalizedWorkingPlan.rows : [])
    .filter((row) => String(row?.name || '').trim());
  const baseRowsById = new Map(baseRows.map((row, index) => [String(row?.id || ''), { row, index }]));
  const items = [];
  const changeOrderId = stringOrNull(changeOrder?.id) || buildDeterministicId('co', [
    changeOrder?.createdAt || changeOrder?.created_at || 'created',
    changeOrder?.name || 'Change Order',
    activeCycleKey || 'global',
  ]);
  const pushItem = (item) => {
    const normalized = normalizeCanonicalChangeOrderItem(item, changeOrderId, items.length);
    if (normalized) items.push(normalized);
  };
  const workingRowIds = new Set();

  workingRows.forEach((row, orderIndex) => {
    const rowId = String(row?.id || '').trim();
    if (!rowId) return;
    workingRowIds.add(rowId);
    const trimmedName = String(row?.name || '').trim();
    const baseEntry = baseRowsById.get(rowId);
    if (!baseEntry) {
      const payload = {
        name: trimmedName || 'New Deliverable',
        orderIndex,
        createdDeliverableId: rowId,
      };
      let pushed = false;
      serviceTypeIds.forEach((serviceTypeId) => {
        const hours = roundHours(row?.pools?.[serviceTypeId]);
        if (!hours) return;
        pushItem({
          actionType: 'add_deliverable',
          deliverableTempKey: rowId,
          serviceTypeId,
          hoursDelta: hours,
          payload,
        });
        pushed = true;
      });
      if (!pushed) {
        pushItem({
          actionType: 'add_deliverable',
          deliverableTempKey: rowId,
          serviceTypeId: null,
          hoursDelta: 0,
          payload,
        });
      }
      return;
    }

    const baseRow = baseEntry.row || {};
    const nameChanged = trimmedName !== String(baseRow?.name || '').trim();
    const orderChanged = orderIndex !== Number(baseEntry.index);
    if (nameChanged || orderChanged) {
      pushItem({
        actionType: 'modify_deliverable',
        deliverableId: rowId,
        serviceTypeId: null,
        hoursDelta: 0,
        payload: {
          name: trimmedName,
          orderIndex,
        },
      });
    }

    serviceTypeIds.forEach((serviceTypeId) => {
      const nextHours = roundHours(row?.pools?.[serviceTypeId]);
      const previousHours = roundHours(baseRow?.pools?.[serviceTypeId]);
      const hoursDelta = roundHours(nextHours - previousHours);
      if (!hoursDelta) return;
      pushItem({
        actionType: 'modify_deliverable',
        deliverableId: rowId,
        serviceTypeId,
        hoursDelta,
        payload: null,
      });
    });
  });

  baseRows.forEach((row, orderIndex) => {
    const rowId = String(row?.id || '').trim();
    if (!rowId || workingRowIds.has(rowId)) return;
    pushItem({
      actionType: 'modify_deliverable',
      deliverableId: rowId,
      serviceTypeId: null,
      hoursDelta: 0,
      payload: {
        name: String(row?.name || '').trim(),
        orderIndex,
        remove: true,
      },
    });
    serviceTypeIds.forEach((serviceTypeId) => {
      const previousHours = roundHours(row?.pools?.[serviceTypeId]);
      if (!previousHours) return;
      pushItem({
        actionType: 'modify_deliverable',
        deliverableId: rowId,
        serviceTypeId,
        hoursDelta: -previousHours,
        payload: null,
      });
    });
  });

  return normalizeChangeOrderRecord({
    ...changeOrder,
    id: changeOrderId,
    scopeMode: job?.kind === 'retainer' ? 'retainer' : 'project',
    effectiveMonth: activeCycleKey,
    cycleKey: activeCycleKey,
    items,
  }, job?.kind, activeCycleKey);
}

function buildRowMap(rows = []) {
  const map = new Map();
  (rows || []).forEach((row) => {
    if (!row?.id) return;
    map.set(String(row.id), {
      ...row,
      pools: { ...(row?.pools || {}) },
    });
  });
  return map;
}

export function getOriginalPlanRowsById(job, serviceTypes = [], { cycleKey = null } = {}) {
  return buildRowMap(getOriginalPlanState(job, serviceTypes, { cycleKey })?.rows || []);
}

function cloneDeliverables(deliverables = []) {
  return (deliverables || []).map((deliverable) => ({
    ...deliverable,
    pools: (deliverable?.pools || []).map((pool) => ({ ...pool })),
    poolsByCycle: Object.keys(deliverable?.poolsByCycle || {}).reduce((acc, key) => {
      acc[key] = (deliverable.poolsByCycle[key] || []).map((pool) => ({ ...pool }));
      return acc;
    }, {}),
    tasks: Array.isArray(deliverable?.tasks) ? deliverable.tasks : [],
  }));
}

function applyHoursToPools(pools = [], serviceTypeHours = {}, direction = 1) {
  const next = (pools || []).map((pool) => ({ ...pool }));
  Object.entries(normalizeHoursMap(serviceTypeHours, { keepZero: false })).forEach(([serviceTypeId, hours]) => {
    const idx = next.findIndex((pool) => String(pool.serviceTypeId) === String(serviceTypeId));
    if (idx >= 0) {
      next[idx] = {
        ...next[idx],
        estimatedHours: Math.max(0, roundHours((Number(next[idx].estimatedHours) || 0) + (direction * hours))),
      };
      return;
    }
    if (direction > 0) {
      next.push({ serviceTypeId, estimatedHours: roundHours(hours) });
    }
  });
  return next.filter((pool) => Number(pool?.estimatedHours) > 0);
}

function updateDeliverableHours(deliverable, serviceTypeHours, cycleKey = null, direction = 1) {
  const nextDeliverable = {
    ...deliverable,
    pools: applyHoursToPools(deliverable?.pools || [], serviceTypeHours, direction),
  };
  if (cycleKey) {
    const currentCyclePools = (deliverable?.poolsByCycle || {})[cycleKey] || deliverable?.pools || [];
    nextDeliverable.poolsByCycle = {
      ...(deliverable?.poolsByCycle || {}),
      [cycleKey]: applyHoursToPools(currentCyclePools, serviceTypeHours, direction),
    };
  }
  return nextDeliverable;
}

function createDeliverableFromChange(change, job, deliverableId, changeOrder) {
  const scope = normalizeChangeOrderScopeFields(changeOrder, job?.kind, job?.currentCycleKey || null);
  const serviceTypeHours = normalizeHoursMap(change?.serviceTypeHours || {}, { keepZero: false });
  const pools = Object.keys(serviceTypeHours).map((serviceTypeId) => ({
    serviceTypeId,
    estimatedHours: serviceTypeHours[serviceTypeId],
  }));
  const deliverable = {
    id: deliverableId,
    name: String(change?.name || '').trim() || 'New Deliverable',
    status: 'backlog',
    description: String(change?.description || ''),
    internalNotes: String(change?.internalNotes || ''),
    deliverableType: '',
    durationValue: '',
    durationUnit: 'days',
    dueDate: null,
    dependencyDeliverableIds: [],
    pools,
    tasks: [],
    createdByChangeOrderId: String(changeOrder?.id || ''),
    createdCycleKey: job?.kind === 'retainer' ? (scope.effectiveMonth || null) : null,
  };
  if (job?.kind === 'retainer' && scope.effectiveMonth) {
    deliverable.poolsByCycle = { [scope.effectiveMonth]: pools.map((pool) => ({ ...pool })) };
  }
  return deliverable;
}

export function applyChangeOrderScope(job, changeOrder, serviceTypes = []) {
  if (!job || !changeOrder) return null;
  const normalizedChangeOrder = normalizeChangeOrderRecord(changeOrder, job?.kind, job?.currentCycleKey || null);
  const scope = normalizeChangeOrderScopeFields(normalizedChangeOrder, job?.kind, job?.currentCycleKey || null);
  const nextDeliverables = cloneDeliverables(job?.deliverables || []);
  const nextDetails = { ...(job?.deliverableDetailsById || {}) };
  const nextServiceTypeIds = new Set((job?.serviceTypeIds || []).map((id) => String(id)));
  const appliedChanges = (normalizedChangeOrder?.changes || []).reduce((acc, change) => {
    const serviceTypeHours = normalizeHoursMap(change?.serviceTypeHours || {}, { keepZero: false });
    Object.keys(serviceTypeHours).forEach((serviceTypeId) => nextServiceTypeIds.add(String(serviceTypeId)));
    if (change?.kind === 'existing') {
      const index = nextDeliverables.findIndex((item) => String(item.id) === String(change.deliverableId));
      if (index >= 0) {
        nextDeliverables[index] = updateDeliverableHours(nextDeliverables[index], serviceTypeHours, scope.cycleKey, 1);
      }
      acc.push({
        ...change,
        deliverableId: String(change?.deliverableId || ''),
        serviceTypeHours,
      });
      return acc;
    }
    const createdDeliverableId = change?.createdDeliverableId || `del_${Math.random().toString(36).slice(2, 9)}`;
    const createdDeliverable = createDeliverableFromChange(change, job, createdDeliverableId, normalizedChangeOrder);
    nextDeliverables.push(createdDeliverable);
    nextDetails[String(createdDeliverableId)] = {
      description: String(change?.description || ''),
      durationValue: '',
      durationUnit: 'days',
      dependencyRowId: '',
      internalNotes: String(change?.internalNotes || ''),
      deliverableType: '',
    };
    acc.push({
      ...change,
      createdDeliverableId,
      serviceTypeHours,
    });
    return acc;
  }, []);

  const nextChangeOrder = normalizeChangeOrderRecord({
    ...normalizedChangeOrder,
    status: 'applied',
    appliedAt: new Date().toISOString(),
    changes: appliedChanges,
  }, job?.kind, scope.cycleKey);

  const nextJobLike = {
    ...job,
    deliverables: nextDeliverables,
    serviceTypeIds: [...nextServiceTypeIds],
  };

  return {
    deliverables: nextDeliverables,
    deliverableDetailsById: nextDetails,
    serviceTypeIds: [...nextServiceTypeIds],
    plan: buildCurrentPlanState(nextJobLike, serviceTypes, { cycleKey: scope.cycleKey }),
    changeOrders: [
      nextChangeOrder,
      ...(job?.changeOrders || []).filter((item) => String(item.id) !== String(normalizedChangeOrder.id)),
    ],
  };
}

export function revertAppliedChangeOrderScope(job, changeOrder, serviceTypes = []) {
  if (!job || !changeOrder) return null;
  const normalizedChangeOrder = normalizeChangeOrderRecord(changeOrder, job?.kind, job?.currentCycleKey || null);
  const scope = normalizeChangeOrderScopeFields(normalizedChangeOrder, job?.kind, job?.currentCycleKey || null);
  let nextDeliverables = cloneDeliverables(job?.deliverables || []);
  const nextDetails = { ...(job?.deliverableDetailsById || {}) };

  (normalizedChangeOrder?.changes || []).forEach((change) => {
    const serviceTypeHours = normalizeHoursMap(change?.serviceTypeHours || {}, { keepZero: false });
    if (change?.kind === 'existing') {
      const index = nextDeliverables.findIndex((item) => String(item.id) === String(change.deliverableId));
      if (index >= 0) {
        nextDeliverables[index] = updateDeliverableHours(nextDeliverables[index], serviceTypeHours, scope.cycleKey, -1);
      }
      return;
    }
    const createdId = String(change?.createdDeliverableId || '');
    if (!createdId) return;
    nextDeliverables = nextDeliverables.filter((item) => String(item.id) !== createdId);
    delete nextDetails[createdId];
  });

  const nextJobLike = {
    ...job,
    deliverables: nextDeliverables,
  };

  return {
    deliverables: nextDeliverables,
    deliverableDetailsById: nextDetails,
    plan: buildCurrentPlanState(nextJobLike, serviceTypes, { cycleKey: scope.cycleKey }),
    changeOrders: (job?.changeOrders || []).filter((item) => String(item.id) !== String(normalizedChangeOrder.id)),
  };
}
