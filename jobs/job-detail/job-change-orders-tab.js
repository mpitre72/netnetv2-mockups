import { loadServiceTypes } from '../../quick-tasks/quick-tasks-store.js';
import { navigate } from '../../router.js';
import { createPlanStateFromJob } from '../jobs-plan-grid.js';

const { createElement: h, useEffect, useMemo, useRef, useState } = React;
const CHANGE_ORDER_FLOW_STORAGE_PREFIX = 'netnet_change_order_flow_v1';

function createId(prefix) {
  return `${prefix}_${Math.random().toString(36).slice(2, 9)}`;
}

function localDateISO(date = new Date()) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatDateLabel(value) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    const fallback = new Date(`${value}T00:00:00`);
    if (Number.isNaN(fallback.getTime())) return value;
    return fallback.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function roundHours(value) {
  const next = Number(value) || 0;
  return Math.round(next * 100) / 100;
}

function formatHours(value) {
  const hours = roundHours(value);
  return hours % 1 ? hours.toFixed(1) : String(hours);
}

function formatImpact(value) {
  return `+${formatHours(value)} hrs`;
}

function normalizeHoursMap(map = {}) {
  if (!map || typeof map !== 'object') return {};
  return Object.keys(map).reduce((acc, key) => {
    const value = roundHours(map[key]);
    if (value > 0) acc[String(key)] = value;
    return acc;
  }, {});
}

function sumHoursMap(map = {}) {
  return Object.values(normalizeHoursMap(map)).reduce((sum, value) => sum + (Number(value) || 0), 0);
}

function sumChangeImpact(change) {
  return sumHoursMap(change?.serviceTypeHours || {});
}

function sumChangeOrderImpact(changeOrder) {
  return (changeOrder?.changes || []).reduce((sum, change) => sum + sumChangeImpact(change), 0);
}

function getNextChangeOrderName(changeOrders = []) {
  const used = new Set(
    (changeOrders || []).map((item) => String(item?.name || '').trim()).filter(Boolean)
  );
  for (let index = 1; index < 1000; index += 1) {
    const candidate = `CO-${String(index).padStart(3, '0')}`;
    if (!used.has(candidate)) return candidate;
  }
  return `CO-${Date.now()}`;
}

function createEmptyExistingChange(job) {
  return {
    id: createId('cochg'),
    kind: 'existing',
    deliverableId: String(job?.deliverables?.[0]?.id || ''),
    serviceTypeHours: {},
  };
}

function createEmptyNewDeliverableChange() {
  return {
    id: createId('cochg'),
    kind: 'new_deliverable',
    name: '',
    description: '',
    internalNotes: '',
    serviceTypeHours: {},
  };
}

function createChangeOrderDraft(job, changeOrders = []) {
  return {
    id: createId('co'),
    name: getNextChangeOrderName(changeOrders),
    status: 'draft',
    createdAt: new Date().toISOString(),
    appliedAt: null,
    notes: '',
    impactHours: 0,
    changes: [],
  };
}

function cloneChangeOrder(changeOrder) {
  return JSON.parse(JSON.stringify(changeOrder || null));
}

function getChangeServiceTypeIds(job, change) {
  if (!change) return [];
  if (change.kind === 'existing') {
    const deliverable = (job?.deliverables || []).find((item) => String(item.id) === String(change.deliverableId));
    const poolIds = (deliverable?.pools || [])
      .filter((pool) => Number(pool?.estimatedHours) > 0)
      .map((pool) => String(pool.serviceTypeId));
    if (poolIds.length) return [...new Set(poolIds)];
  }
  return [...new Set((job?.serviceTypeIds || []).map((id) => String(id)).filter(Boolean))];
}

function getReviewableChanges(changeOrder) {
  return (changeOrder?.changes || []).filter((change) => {
    if (!change) return false;
    const impact = sumChangeImpact(change);
    if (change.kind === 'existing') return !!change.deliverableId && impact > 0;
    return impact > 0;
  });
}

function applyHoursToPools(pools = [], serviceTypeHours = {}, direction = 1) {
  const next = (pools || []).map((pool) => ({ ...pool }));
  Object.entries(normalizeHoursMap(serviceTypeHours)).forEach(([serviceTypeId, hours]) => {
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

function createDeliverableFromChange(change, job, deliverableId, cycleKey = null) {
  const serviceTypeHours = normalizeHoursMap(change.serviceTypeHours || {});
  const pools = Object.keys(serviceTypeHours).map((serviceTypeId) => ({
    serviceTypeId,
    estimatedHours: serviceTypeHours[serviceTypeId],
  }));
  const deliverable = {
    id: deliverableId,
    name: String(change.name || '').trim() || 'New Deliverable',
    status: 'backlog',
    description: String(change.description || ''),
    internalNotes: String(change.internalNotes || ''),
    deliverableType: '',
    durationValue: '',
    durationUnit: 'days',
    dueDate: null,
    dependencyDeliverableIds: [],
    pools,
    tasks: [],
  };
  if (job?.kind === 'retainer' && cycleKey) {
    deliverable.poolsByCycle = { [cycleKey]: pools.map((pool) => ({ ...pool })) };
  }
  return deliverable;
}

function buildNextPlan(jobLike, serviceTypes) {
  const serviceTypeIds = Array.isArray(jobLike?.serviceTypeIds) ? jobLike.serviceTypeIds : [];
  const nextPlan = createPlanStateFromJob(jobLike, serviceTypeIds, {
    serviceTypes,
    cycleKey: jobLike?.kind === 'retainer' ? jobLike?.currentCycleKey || null : null,
  });
  return {
    ...nextPlan,
    serviceTypeNames: {
      ...((jobLike?.plan && jobLike.plan.serviceTypeNames) || {}),
      ...(nextPlan.serviceTypeNames || {}),
    },
  };
}

function upsertChangeOrder(changeOrders = [], changeOrder) {
  const next = [...(changeOrders || [])];
  const index = next.findIndex((item) => String(item.id) === String(changeOrder.id));
  if (index >= 0) {
    next[index] = changeOrder;
    return next;
  }
  return [changeOrder, ...next];
}

function applyChangeOrderToJob(job, changeOrder, serviceTypes) {
  const cycleKey = job?.kind === 'retainer' ? (job?.currentCycleKey || localDateISO().slice(0, 7)) : null;
  const nextDeliverables = cloneDeliverables(job?.deliverables || []);
  const nextDetails = { ...(job?.deliverableDetailsById || {}) };
  const nextServiceTypeIds = new Set((job?.serviceTypeIds || []).map((id) => String(id)));
  const appliedChanges = getReviewableChanges(changeOrder).map((change) => {
    const serviceTypeHours = normalizeHoursMap(change.serviceTypeHours || {});
    Object.keys(serviceTypeHours).forEach((serviceTypeId) => nextServiceTypeIds.add(String(serviceTypeId)));
    if (change.kind === 'existing') {
      const index = nextDeliverables.findIndex((item) => String(item.id) === String(change.deliverableId));
      if (index >= 0) {
        nextDeliverables[index] = updateDeliverableHours(nextDeliverables[index], serviceTypeHours, cycleKey, 1);
      }
      return {
        ...change,
        deliverableId: String(change.deliverableId),
        serviceTypeHours,
      };
    }
    const createdDeliverableId = change.createdDeliverableId || createId('del');
    const createdDeliverable = createDeliverableFromChange(change, job, createdDeliverableId, cycleKey);
    nextDeliverables.push(createdDeliverable);
    nextDetails[String(createdDeliverableId)] = {
      description: String(change.description || ''),
      durationValue: '',
      durationUnit: 'days',
      dependencyRowId: '',
      internalNotes: String(change.internalNotes || ''),
      deliverableType: '',
    };
    return {
      ...change,
      createdDeliverableId,
      serviceTypeHours,
    };
  });

  const nextChangeOrder = {
    ...cloneChangeOrder(changeOrder),
    status: 'applied',
    appliedAt: new Date().toISOString(),
    impactHours: sumChangeOrderImpact({ changes: appliedChanges }),
    changes: appliedChanges,
  };
  const nextJobLike = {
    ...job,
    deliverables: nextDeliverables,
    serviceTypeIds: [...nextServiceTypeIds],
    plan: job?.plan || {},
  };

  return {
    deliverables: nextDeliverables,
    deliverableDetailsById: nextDetails,
    serviceTypeIds: [...nextServiceTypeIds],
    plan: buildNextPlan(nextJobLike, serviceTypes),
    changeOrders: upsertChangeOrder(job?.changeOrders || [], nextChangeOrder),
  };
}

function revertAppliedChangeOrder(job, changeOrder, serviceTypes) {
  const cycleKey = job?.kind === 'retainer' ? (job?.currentCycleKey || localDateISO().slice(0, 7)) : null;
  let nextDeliverables = cloneDeliverables(job?.deliverables || []);
  const nextDetails = { ...(job?.deliverableDetailsById || {}) };

  (changeOrder?.changes || []).forEach((change) => {
    const serviceTypeHours = normalizeHoursMap(change.serviceTypeHours || {});
    if (change.kind === 'existing') {
      const index = nextDeliverables.findIndex((item) => String(item.id) === String(change.deliverableId));
      if (index >= 0) {
        nextDeliverables[index] = updateDeliverableHours(nextDeliverables[index], serviceTypeHours, cycleKey, -1);
      }
      return;
    }
    const createdId = String(change.createdDeliverableId || '');
    if (!createdId) return;
    nextDeliverables = nextDeliverables.filter((item) => String(item.id) !== createdId);
    delete nextDetails[createdId];
  });

  const nextChangeOrders = (job?.changeOrders || []).filter((item) => String(item.id) !== String(changeOrder.id));
  const nextJobLike = {
    ...job,
    deliverables: nextDeliverables,
    plan: job?.plan || {},
  };

  return {
    deliverables: nextDeliverables,
    deliverableDetailsById: nextDetails,
    plan: buildNextPlan(nextJobLike, serviceTypes),
    changeOrders: nextChangeOrders,
  };
}

function flowStorageKey(jobId, changeOrderId) {
  return `${CHANGE_ORDER_FLOW_STORAGE_PREFIX}_${jobId || 'job'}_${changeOrderId || 'co'}`;
}

function loadFlowState(jobId, changeOrderId) {
  if (!jobId || !changeOrderId) return null;
  try {
    const raw = localStorage.getItem(flowStorageKey(jobId, changeOrderId));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;
    return parsed;
  } catch (e) {
    return null;
  }
}

function saveFlowState(jobId, changeOrderId, value) {
  if (!jobId || !changeOrderId) return;
  try {
    localStorage.setItem(flowStorageKey(jobId, changeOrderId), JSON.stringify(value || null));
  } catch (e) {
    // ignore storage errors
  }
}

function clearFlowState(jobId, changeOrderId) {
  if (!jobId || !changeOrderId) return;
  try {
    localStorage.removeItem(flowStorageKey(jobId, changeOrderId));
  } catch (e) {
    // ignore storage errors
  }
}

function statusPill(status) {
  const label = status === 'applied'
    ? 'Applied'
    : status === 'approved'
      ? 'Approved'
      : 'Draft';
  const tone = status === 'applied'
    ? 'border-emerald-400/30 bg-emerald-500/15 text-emerald-200'
    : status === 'approved'
      ? 'border-sky-400/30 bg-sky-500/15 text-sky-200'
      : 'border-amber-400/30 bg-amber-500/15 text-amber-200';
  return h('span', {
    className: `inline-flex min-w-[88px] items-center justify-center rounded-full border px-2.5 py-1 text-xs font-semibold ${tone}`,
  }, label);
}

function metricCard(label, value, hint = null) {
  return h('div', { className: 'rounded-xl border border-slate-200 dark:border-white/10 bg-white/90 dark:bg-slate-900/60 p-4 space-y-1' }, [
    h('div', { className: 'text-[11px] uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400' }, label),
    h('div', { className: 'text-2xl font-semibold text-slate-900 dark:text-white' }, value),
    hint ? h('div', { className: 'text-xs text-slate-500 dark:text-slate-400' }, hint) : null,
  ]);
}

function modalStepPill(label, active, complete, clickable = false, onClick = null) {
  return h('button', {
    type: 'button',
    disabled: !clickable,
    onClick: clickable ? onClick : undefined,
    className: `rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
      active
        ? 'border-netnet-purple bg-netnet-purple/15 text-netnet-purple'
        : complete
          ? 'border-emerald-400/30 bg-emerald-500/10 text-emerald-200'
          : 'border-slate-200 dark:border-white/10 text-slate-500 dark:text-slate-400'
    } ${clickable ? 'cursor-pointer hover:border-netnet-purple/50 hover:text-netnet-purple' : 'cursor-default'} disabled:opacity-100`,
  }, label);
}

export function JobChangeOrdersTab({ job, onJobUpdate, readOnly = false, changeOrderId = null }) {
  const serviceTypes = useMemo(() => loadServiceTypes().filter((type) => type.active), []);
  const serviceTypeMap = useMemo(
    () => new Map((serviceTypes || []).map((type) => [String(type.id), type])),
    [serviceTypes]
  );
  const changeOrders = Array.isArray(job?.changeOrders) ? job.changeOrders : [];
  const appliedCount = changeOrders.filter((item) => item.status === 'applied').length;
  const existingChangeOrder = useMemo(
    () => (changeOrderId ? changeOrders.find((item) => String(item.id) === String(changeOrderId)) || null : null),
    [changeOrders, changeOrderId]
  );

  const [draft, setDraft] = useState(null);
  const [step, setStep] = useState(1);
  const [applyConfirmText, setApplyConfirmText] = useState('');
  const [showApplyModal, setShowApplyModal] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const applyModalRef = useRef(null);
  const applyConfirmInputRef = useRef(null);

  useEffect(() => {
    if (!changeOrderId) {
      setDraft(null);
      setStep(1);
      setApplyConfirmText('');
      setShowApplyModal(false);
      return;
    }
    const cached = loadFlowState(job?.id, changeOrderId);
    if (cached?.draft) {
      setDraft(cached.draft);
      setStep(Math.max(1, Math.min(4, Number(cached.step) || 1)));
      setApplyConfirmText(String(cached.applyConfirmText || ''));
      setShowApplyModal(false);
      return;
    }
    if (existingChangeOrder) {
      setDraft(cloneChangeOrder(existingChangeOrder));
      setStep(existingChangeOrder.status === 'applied' ? 4 : 1);
      setApplyConfirmText('');
      setShowApplyModal(false);
      return;
    }
    const nextDraft = {
      ...createChangeOrderDraft(job, changeOrders),
      id: String(changeOrderId),
    };
    setDraft(nextDraft);
    setStep(1);
    setApplyConfirmText('');
    setShowApplyModal(false);
  }, [changeOrderId, existingChangeOrder, job, changeOrders]);

  useEffect(() => {
    if (!job?.id || !changeOrderId || !draft) return;
    saveFlowState(job.id, changeOrderId, {
      draft,
      step,
      applyConfirmText,
    });
  }, [job?.id, changeOrderId, draft, step, applyConfirmText]);

  const draftReadOnly = !!draft && (readOnly || draft.status === 'applied');
  const reviewableChanges = draft ? getReviewableChanges(draft) : [];
  const draftImpactHours = draft ? sumChangeOrderImpact({ changes: reviewableChanges }) : 0;
  const canOpenApply = !draftReadOnly && reviewableChanges.length > 0;
  const canApply = canOpenApply && String(applyConfirmText || '').trim().toUpperCase() === 'APPLY';
  const isStepReady = (stepIndex) => {
    if (draftReadOnly) return true;
    if (stepIndex === 1) return true;
    if (stepIndex === 2) return reviewableChanges.length > 0;
    if (stepIndex === 3) return reviewableChanges.length > 0;
    if (stepIndex === 4) return canApply;
    return false;
  };
  const canVisitStep = (targetStep) => {
    if (draftReadOnly) return true;
    if (targetStep <= step) return true;
    for (let index = 1; index < targetStep; index += 1) {
      if (!isStepReady(index)) return false;
    }
    return true;
  };
  const goToStep = (targetStep) => {
    if (!canVisitStep(targetStep)) return;
    setStep(targetStep);
  };
  const currentStepCanContinue = isStepReady(step);

  useEffect(() => {
    if (!showApplyModal) return undefined;
    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        setShowApplyModal(false);
        return;
      }
      if (event.key !== 'Tab' || !applyModalRef.current) return;
      const focusable = Array.from(
        applyModalRef.current.querySelectorAll('button, input, textarea, select, [tabindex]:not([tabindex="-1"])')
      ).filter((node) => !node.disabled && node.getAttribute('aria-hidden') !== 'true');
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement;
      if (event.shiftKey && active === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    window.setTimeout(() => {
      if (applyConfirmInputRef.current) applyConfirmInputRef.current.focus();
    }, 0);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [showApplyModal]);

  const backToList = () => navigate(`#/app/jobs/${job.id}/change-orders`);

  const openNewChangeOrder = () => {
    const nextId = createId('co');
    const nextDraft = { ...createChangeOrderDraft(job, changeOrders), id: nextId };
    saveFlowState(job.id, nextId, {
      draft: nextDraft,
      step: 1,
      applyConfirmText: '',
    });
    navigate(`#/app/jobs/${job.id}/change-orders/${nextId}`);
  };

  const openExistingChangeOrder = (changeOrder) => {
    navigate(`#/app/jobs/${job.id}/change-orders/${changeOrder.id}`);
  };

  const updateDraft = (patch) => {
    setDraft((current) => ({ ...(current || {}), ...(patch || {}) }));
  };

  const updateDraftChange = (changeId, patch) => {
    setDraft((current) => ({
      ...(current || {}),
      changes: (current?.changes || []).map((change) => (
        String(change.id) === String(changeId)
          ? { ...change, ...(patch || {}) }
          : change
      )),
    }));
  };

  const updateDraftChangeServiceHours = (changeId, serviceTypeId, rawValue) => {
    setDraft((current) => ({
      ...(current || {}),
      changes: (current?.changes || []).map((change) => {
        if (String(change.id) !== String(changeId)) return change;
        const nextHours = { ...(change?.serviceTypeHours || {}) };
        const trimmed = String(rawValue || '').trim();
        if (!trimmed) {
          delete nextHours[String(serviceTypeId)];
        } else {
          const value = roundHours(trimmed);
          if (value > 0) nextHours[String(serviceTypeId)] = value;
        }
        return { ...change, serviceTypeHours: nextHours };
      }),
    }));
  };

  const addDraftChange = (kind) => {
    setDraft((current) => ({
      ...(current || {}),
      changes: [
        ...(current?.changes || []),
        kind === 'existing' ? createEmptyExistingChange(job) : createEmptyNewDeliverableChange(),
      ],
    }));
  };

  const removeDraftChange = (changeId) => {
    setDraft((current) => ({
      ...(current || {}),
      changes: (current?.changes || []).filter((change) => String(change.id) !== String(changeId)),
    }));
  };

  const persistDraft = () => {
    if (!draft || typeof onJobUpdate !== 'function') return;
    const nextDraft = {
      ...cloneChangeOrder(draft),
      status: 'draft',
      appliedAt: null,
      impactHours: roundHours(draftImpactHours),
      changes: draft.changes || [],
    };
    onJobUpdate({ changeOrders: upsertChangeOrder(changeOrders, nextDraft) });
    clearFlowState(job.id, nextDraft.id);
    window?.showToast?.('Change order saved as draft.');
    backToList();
  };

  const applyDraft = () => {
    if (!draft || !reviewableChanges.length || typeof onJobUpdate !== 'function') return;
    const next = applyChangeOrderToJob(job, { ...draft, changes: reviewableChanges }, serviceTypes);
    onJobUpdate(next);
    clearFlowState(job.id, draft.id);
    setShowApplyModal(false);
    setApplyConfirmText('');
    window?.showToast?.('Change order applied.');
    backToList();
  };

  const deleteChangeOrder = (changeOrder) => {
    if (!changeOrder || typeof onJobUpdate !== 'function') return;
    if (changeOrder.status === 'applied') {
      const reverted = revertAppliedChangeOrder(job, changeOrder, serviceTypes);
      onJobUpdate(reverted);
      clearFlowState(job.id, changeOrder.id);
      window?.showToast?.('Applied change order removed and reverted.');
      return;
    }
    onJobUpdate({
      changeOrders: (changeOrders || []).filter((item) => String(item.id) !== String(changeOrder.id)),
    });
    clearFlowState(job.id, changeOrder.id);
    window?.showToast?.('Draft change order deleted.');
  };

  const renderServiceTypeGrid = (change) => {
    const serviceTypeIds = getChangeServiceTypeIds(job, change);
    return h('div', { className: 'space-y-3' }, [
      h('div', { className: 'text-xs text-slate-500 dark:text-slate-400' }, 'Add work by service type using the same LOE structure as the original plan.'),
      h('div', { className: 'overflow-hidden rounded-2xl border border-slate-200/80 dark:border-white/10' }, [
        h('div', {
          className: 'grid gap-3 border-b border-slate-200/80 bg-slate-100/80 px-4 py-3 text-[11px] uppercase tracking-[0.18em] text-slate-500 dark:border-white/10 dark:bg-slate-900/80 dark:text-slate-400',
          style: { gridTemplateColumns: '1fr 120px' },
        }, [
          h('div', null, 'Service Type'),
          h('div', { className: 'text-right' }, 'Added Hours'),
        ]),
        serviceTypeIds.length
          ? serviceTypeIds.map((serviceTypeId) => h('div', {
            key: `${change.id}-${serviceTypeId}`,
            className: 'grid items-center gap-3 border-b border-slate-200/80 px-4 py-3 last:border-b-0 dark:border-white/10',
            style: { gridTemplateColumns: '1fr 120px' },
          }, [
            h('div', { className: 'text-sm text-slate-800 dark:text-slate-100' }, serviceTypeMap.get(String(serviceTypeId))?.name || 'Service Type'),
            h('input', {
              type: 'number',
              min: '0',
              step: '0.25',
              value: change?.serviceTypeHours?.[String(serviceTypeId)] ?? '',
              disabled: draftReadOnly,
              placeholder: '0',
              onChange: (event) => updateDraftChangeServiceHours(change.id, serviceTypeId, event.target.value),
              className: 'h-10 w-full rounded-md border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-950 px-3 text-right text-sm text-slate-700 dark:text-slate-100',
            }),
          ]))
          : h('div', { className: 'px-4 py-3 text-sm text-slate-500 dark:text-slate-400' }, 'No service types available yet.'),
      ]),
    ]);
  };

  const renderChangeSection = (change, index) => {
    const isExisting = change.kind === 'existing';
    const deliverableOptions = (job?.deliverables || []).map((deliverable) => (
      h('option', { key: deliverable.id, value: deliverable.id }, deliverable.name || 'Deliverable')
    ));

    return h('div', {
      key: change.id,
      className: `space-y-4 ${index > 0 ? 'border-t border-slate-200/80 pt-6 dark:border-white/10' : ''}`,
    }, [
      h('div', { className: 'flex items-start justify-between gap-3' }, [
        h('div', { className: 'space-y-1' }, [
          h('div', { className: 'text-sm font-semibold text-slate-900 dark:text-white' }, isExisting ? 'Add to Existing Deliverable' : 'Add New Deliverable'),
          h('div', { className: 'text-xs text-slate-500 dark:text-slate-400' }, isExisting
            ? 'Select a deliverable and add hours by service type.'
            : 'Create a new deliverable with its own LOE and details.'),
        ]),
        draftReadOnly
          ? null
          : h('button', {
            type: 'button',
            className: 'text-xs font-semibold text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white',
            onClick: () => removeDraftChange(change.id),
          }, 'Remove'),
      ]),
      isExisting
        ? h('div', { className: 'space-y-2' }, [
          h('div', { className: 'text-xs uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400' }, 'Deliverable'),
          h('select', {
            value: change.deliverableId || '',
            disabled: draftReadOnly,
            onChange: (event) => updateDraftChange(change.id, { deliverableId: event.target.value || '' }),
            className: 'h-10 w-full rounded-md border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-950 px-3 text-sm text-slate-700 dark:text-slate-100',
          }, [
            h('option', { value: '' }, 'Select deliverable'),
            ...deliverableOptions,
          ]),
        ])
        : h('div', { className: 'grid gap-4 md:grid-cols-2' }, [
          h('div', { className: 'space-y-2 md:col-span-2' }, [
            h('div', { className: 'text-xs uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400' }, 'Deliverable Name'),
            h('input', {
              type: 'text',
              value: change.name || '',
              disabled: draftReadOnly,
              placeholder: 'New deliverable name',
              onChange: (event) => updateDraftChange(change.id, { name: event.target.value }),
              className: 'h-10 w-full rounded-md border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-950 px-3 text-sm text-slate-700 dark:text-slate-100',
            }),
          ]),
          h('div', { className: 'space-y-2' }, [
            h('div', { className: 'text-xs uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400' }, 'Description'),
            h('textarea', {
              rows: 4,
              value: change.description || '',
              disabled: draftReadOnly,
              placeholder: 'Deliverable description',
              onChange: (event) => updateDraftChange(change.id, { description: event.target.value }),
              className: 'w-full rounded-md border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-950 px-3 py-2 text-sm text-slate-700 dark:text-slate-100',
            }),
          ]),
          h('div', { className: 'space-y-2' }, [
            h('div', { className: 'text-xs uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400' }, 'Details'),
            h('textarea', {
              rows: 4,
              value: change.internalNotes || '',
              disabled: draftReadOnly,
              placeholder: 'Internal notes',
              onChange: (event) => updateDraftChange(change.id, { internalNotes: event.target.value }),
              className: 'w-full rounded-md border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-950 px-3 py-2 text-sm text-slate-700 dark:text-slate-100',
            }),
          ]),
        ]),
      renderServiceTypeGrid(change),
    ]);
  };

  const renderReviewList = () => (
    reviewableChanges.length
      ? h('div', { className: 'space-y-5' }, reviewableChanges.map((change, index) => {
        const title = change.kind === 'existing'
          ? ((job?.deliverables || []).find((item) => String(item.id) === String(change.deliverableId))?.name || 'Deliverable')
          : String(change.name || '').trim() || 'New Deliverable';
        const serviceEntries = Object.entries(normalizeHoursMap(change.serviceTypeHours || {}));
        return h('div', {
          key: `${draft?.id || 'draft'}-${change.id}`,
          className: `${index > 0 ? 'border-t border-slate-200/80 pt-5 dark:border-white/10' : ''} space-y-2`,
        }, [
          h('div', { className: 'text-sm font-semibold text-slate-900 dark:text-white' }, change.kind === 'existing' ? title : `New Deliverable: ${title}`),
          serviceEntries.map(([serviceTypeId, hours]) => h('div', {
            key: `${change.id}-${serviceTypeId}`,
            className: 'flex items-center justify-between gap-3 text-sm text-slate-600 dark:text-slate-300',
          }, [
            h('span', null, serviceTypeMap.get(String(serviceTypeId))?.name || 'Service Type'),
            h('span', { className: 'font-semibold text-slate-900 dark:text-white' }, `+${formatHours(hours)} hrs`),
          ])),
        ]);
      }))
      : h('div', { className: 'text-sm text-slate-500 dark:text-slate-400' }, 'Add at least one deliverable change before applying this change order.')
  );

  const renderEditorStepContent = () => {
    if (!draft) return null;
    if (step === 1) {
      return h('div', { className: 'space-y-6' }, [
        h('div', { className: 'space-y-2' }, [
          h('div', { className: 'text-xs uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400' }, 'Name'),
          h('input', {
            type: 'text',
            value: draft.name || '',
            disabled: draftReadOnly,
            onChange: (event) => updateDraft({ name: event.target.value }),
            className: 'h-11 w-full rounded-md border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-950 px-3 text-sm text-slate-700 dark:text-slate-100',
          }),
        ]),
        h('div', { className: 'space-y-2' }, [
          h('div', { className: 'text-xs uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400' }, 'Notes'),
          h('textarea', {
            rows: 6,
            value: draft.notes || '',
            disabled: draftReadOnly,
            placeholder: 'Optional context for this change order',
            onChange: (event) => updateDraft({ notes: event.target.value }),
            className: 'w-full rounded-md border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-950 px-3 py-2 text-sm text-slate-700 dark:text-slate-100',
          }),
        ]),
      ]);
    }
    if (step === 2) {
      return h('div', { className: 'space-y-6' }, [
        draftReadOnly
          ? null
          : h('div', { className: 'flex flex-wrap gap-2' }, [
            h('button', {
              type: 'button',
              className: 'inline-flex items-center justify-center h-10 px-4 rounded-md border border-slate-200 dark:border-white/10 text-sm font-semibold text-slate-700 dark:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-800',
              onClick: () => addDraftChange('existing'),
            }, 'Add to Existing Deliverable'),
            h('button', {
              type: 'button',
              className: 'inline-flex items-center justify-center h-10 px-4 rounded-md border border-slate-200 dark:border-white/10 text-sm font-semibold text-slate-700 dark:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-800',
              onClick: () => addDraftChange('new_deliverable'),
            }, 'Add New Deliverable'),
          ]),
        draft?.changes?.length
          ? h('div', { className: 'space-y-6' }, draft.changes.map(renderChangeSection))
          : h('div', { className: 'text-sm text-slate-500 dark:text-slate-400' }, 'Choose a change type to begin building this change order.'),
      ]);
    }
    if (step === 3) {
      return h('div', { className: 'space-y-6' }, [
        h('div', { className: 'space-y-2' }, [
          h('div', { className: 'text-sm font-semibold text-slate-900 dark:text-white' }, 'Summary of changes'),
          h('div', { className: 'text-sm text-slate-500 dark:text-slate-400' }, 'Review the original scope against the additive change before applying it.'),
        ]),
        renderReviewList(),
        h('div', { className: 'grid gap-4 border-t border-slate-200/80 pt-5 dark:border-white/10 md:grid-cols-3' }, [
          h('div', { className: 'space-y-1' }, [
            h('div', { className: 'text-[11px] uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400' }, 'Original Deliverables'),
            h('div', { className: 'text-2xl font-semibold text-slate-900 dark:text-white' }, `${job?.deliverables?.length || 0}`),
          ]),
          h('div', { className: 'space-y-1' }, [
            h('div', { className: 'text-[11px] uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400' }, 'Added Work'),
            h('div', { className: 'text-2xl font-semibold text-slate-900 dark:text-white' }, formatImpact(draftImpactHours)),
          ]),
          h('div', { className: 'space-y-1' }, [
            h('div', { className: 'text-[11px] uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400' }, 'Total Impact'),
            h('div', { className: 'text-2xl font-semibold text-slate-900 dark:text-white' }, formatImpact(draftImpactHours)),
          ]),
        ]),
      ]);
    }
    return h('div', { className: 'space-y-6' }, [
      renderReviewList(),
      h('div', { className: 'space-y-4 border-t border-slate-200/80 pt-5 dark:border-white/10' }, [
        h('div', { className: 'space-y-1' }, [
          h('div', { className: 'text-xl font-semibold text-slate-900 dark:text-white' }, 'Apply Change Order'),
          h('div', { className: 'text-sm text-slate-500 dark:text-slate-400' }, 'Review the impact, then apply this change order when you are ready to update the job scope.'),
        ]),
        h('div', { className: 'grid gap-4 md:grid-cols-3' }, [
          metricCard('Changes', `${reviewableChanges.length}`),
          metricCard('Impact', formatImpact(draftImpactHours)),
          metricCard('Status', draft.status === 'applied' ? 'Applied' : 'Ready'),
        ]),
      ]),
    ]);
  };

  const renderChangeOrdersList = () => h('div', { className: 'space-y-5 pb-12' }, [
    h('div', { className: 'flex flex-wrap items-start justify-between gap-3' }, [
      h('div', { className: 'space-y-1' }, [
        h('div', { className: 'text-base font-semibold text-slate-900 dark:text-white' }, 'Change Orders'),
        h('div', { className: 'text-sm text-slate-500 dark:text-slate-400' }, 'Track additive job changes without overwriting the original plan.'),
      ]),
      h('button', {
        type: 'button',
        className: 'inline-flex items-center justify-center h-10 px-4 rounded-md bg-netnet-purple text-white text-sm font-semibold hover:brightness-110 disabled:opacity-60',
        disabled: readOnly,
        onClick: openNewChangeOrder,
      }, '+ New Change Order'),
    ]),
    h('div', { className: 'rounded-2xl border border-slate-200 dark:border-white/10 bg-white/90 dark:bg-slate-900/60 overflow-hidden' }, [
      h('div', {
        className: 'grid gap-3 border-b border-slate-200 dark:border-white/10 px-5 py-3 text-[11px] uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400',
        style: { gridTemplateColumns: '1.2fr 120px 120px 150px 130px' },
      }, [
        h('div', null, 'Name'),
        h('div', null, 'Status'),
        h('div', null, 'Impact'),
        h('div', null, 'Date'),
        h('div', { className: 'text-right' }, 'Actions'),
      ]),
      changeOrders.length
        ? changeOrders.map((changeOrder) => h('div', {
          key: changeOrder.id,
          className: 'grid gap-3 border-b border-slate-200 dark:border-white/10 px-5 py-4 last:border-b-0',
          style: { gridTemplateColumns: '1.2fr 120px 120px 150px 130px' },
        }, [
          h('div', { className: 'space-y-1' }, [
            h('div', { className: 'text-sm font-semibold text-slate-900 dark:text-white' }, changeOrder.name || 'Change Order'),
            changeOrder.notes
              ? h('div', { className: 'text-xs text-slate-500 dark:text-slate-400 line-clamp-1' }, changeOrder.notes)
              : null,
          ]),
          statusPill(changeOrder.status),
          h('div', { className: 'text-sm font-semibold text-slate-900 dark:text-white' }, formatImpact(changeOrder.impactHours || sumChangeOrderImpact(changeOrder))),
          h('div', { className: 'text-sm text-slate-600 dark:text-slate-300' }, formatDateLabel(changeOrder.appliedAt || changeOrder.createdAt)),
          h('div', { className: 'flex items-center justify-end gap-2' }, [
            h('button', {
              type: 'button',
              className: 'text-xs font-semibold text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white',
              onClick: () => openExistingChangeOrder(changeOrder),
            }, 'Open'),
            h('button', {
              type: 'button',
              className: 'text-xs font-semibold text-rose-500 hover:text-rose-400',
              disabled: readOnly,
              onClick: () => setDeleteTarget(changeOrder),
            }, 'Delete'),
          ]),
        ]))
        : h('div', { className: 'px-5 py-10 text-center text-sm text-slate-500 dark:text-slate-400' }, 'No change orders yet. Applied change orders will appear here and stay auditable.'),
    ]),
    appliedCount
      ? h('div', { className: 'text-xs text-slate-500 dark:text-slate-400' }, `${appliedCount} Change Order${appliedCount === 1 ? '' : 's'} applied to this job.`)
      : null,
  ]);

  if (!changeOrderId) {
    return h('div', { className: 'space-y-5 pb-12' }, [
      renderChangeOrdersList(),
      deleteTarget
        ? h('div', { className: 'fixed inset-0 z-50 flex items-center justify-center px-4' }, [
          h('div', { className: 'absolute inset-0 bg-black/40', onClick: () => setDeleteTarget(null) }),
          h('div', { className: 'relative z-10 w-full max-w-md rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 p-6 shadow-2xl space-y-4' }, [
            h('div', { className: 'space-y-1' }, [
              h('div', { className: 'text-lg font-semibold text-slate-900 dark:text-white' }, 'Delete Change Order'),
              h('div', { className: 'text-sm text-slate-500 dark:text-slate-400' }, deleteTarget.status === 'applied'
                ? 'Deleting an applied change order will revert its visual changes.'
                : 'Draft change orders can be deleted freely.'),
            ]),
            h('div', { className: 'rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-slate-800/60 px-4 py-3 text-sm text-slate-700 dark:text-slate-200' }, deleteTarget.name || 'Change Order'),
            h('div', { className: 'flex items-center justify-end gap-2' }, [
              h('button', {
                type: 'button',
                className: 'inline-flex items-center justify-center h-10 px-4 rounded-md border border-slate-200 dark:border-white/10 text-sm font-semibold text-slate-700 dark:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-800',
                onClick: () => setDeleteTarget(null),
              }, 'Cancel'),
              h('button', {
                type: 'button',
                className: 'inline-flex items-center justify-center h-10 px-4 rounded-md bg-rose-600 text-white text-sm font-semibold hover:brightness-110',
                onClick: () => {
                  deleteChangeOrder(deleteTarget);
                  setDeleteTarget(null);
                },
              }, 'Delete'),
            ]),
          ]),
        ])
        : null,
    ]);
  }

  if (!draft) {
    return h('div', { className: 'space-y-4 pb-12' }, [
      h('div', { className: 'text-sm text-slate-500 dark:text-slate-400' }, 'Loading change order...'),
    ]);
  }

  return h('div', { className: 'space-y-4 pb-12' }, [
    h('div', { className: 'flex items-start justify-between gap-4' }, [
      h('div', { className: 'space-y-2' }, [
        h('div', { className: 'flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400' }, [
          h('button', {
            type: 'button',
            className: 'hover:text-slate-900 dark:hover:text-white',
            onClick: () => navigate('#/app/jobs'),
          }, 'Jobs'),
          h('span', null, '›'),
          h('button', {
            type: 'button',
            className: 'hover:text-slate-900 dark:hover:text-white',
            onClick: () => navigate(`#/app/jobs/${job.id}`),
          }, job?.name || 'Job'),
          h('span', null, '›'),
          h('span', { className: 'text-slate-700 dark:text-slate-200' }, 'Change Order'),
        ]),
        h('div', { className: 'text-2xl font-semibold text-slate-900 dark:text-white' }, draft.name || 'Change Order'),
      ]),
      h('button', {
        type: 'button',
        className: 'inline-flex items-center justify-center h-10 px-4 rounded-md border border-slate-200 dark:border-white/10 text-sm font-semibold text-slate-700 dark:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-800',
        onClick: backToList,
      }, 'Back to Change Orders'),
    ]),
    h('section', { className: 'overflow-hidden rounded-[32px] border border-slate-200/80 bg-white/95 shadow-sm dark:border-white/10 dark:bg-slate-950/90' }, [
      h('div', { className: 'border-b border-slate-200/70 px-5 py-4 dark:border-white/10 md:px-6' }, [
        h('div', { className: 'flex flex-col gap-3 md:flex-row md:items-center' }, [
          modalStepPill('1. Summary', step === 1, step > 1, canVisitStep(1), () => goToStep(1)),
          modalStepPill('2. Changes', step === 2, step > 2, canVisitStep(2), () => goToStep(2)),
          modalStepPill('3. Net Net', step === 3, step > 3, canVisitStep(3), () => goToStep(3)),
          modalStepPill('4. Apply', step === 4, false, canVisitStep(4), () => goToStep(4)),
        ]),
      ]),
      h('div', { className: 'px-6 py-8 md:px-8 md:py-10' }, [
        h('div', { className: 'space-y-6' }, [
          h('div', { className: 'space-y-3' }, [
            h('div', { className: 'inline-flex items-center rounded-full border border-slate-200/80 bg-white/75 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-600 dark:border-white/10 dark:bg-white/5 dark:text-slate-300' }, `Step ${step} of 4`),
            h('div', { className: 'space-y-2' }, [
              h('div', { className: 'h-1.5 w-24 rounded-full bg-netnet-purple' }),
              h('div', { className: 'text-3xl font-semibold leading-tight text-slate-900 dark:text-white' }, step === 1
                ? 'Summarize the change'
                : step === 2
                  ? 'Define what changes'
                  : step === 3
                    ? 'Net Net'
                    : 'Confirm and apply'),
              h('div', { className: 'max-w-3xl text-sm leading-7 text-slate-600 dark:text-slate-300 md:text-base' }, step === 1
                ? 'Name this change order and capture any helpful context.'
                : step === 2
                  ? 'Add scope to existing deliverables or define brand new deliverables.'
                  : step === 3
                    ? 'Compare the added work against the current plan before you apply it.'
                    : 'Applying will visibly update the job scope and keep the change order auditable.'),
            ]),
          ]),
          renderEditorStepContent(),
        ]),
      ]),
      h('div', { className: 'border-t border-slate-200/70 px-6 py-4 dark:border-white/10 md:px-8' }, [
        h('div', { className: 'flex flex-wrap items-center justify-between gap-3' }, [
          h('div', { className: 'text-sm text-slate-500 dark:text-slate-400' }, draftReadOnly
            ? 'Applied change orders are read-only in this flow.'
            : `Total Impact ${formatImpact(draftImpactHours)}`),
          h('div', { className: 'flex flex-wrap items-center justify-end gap-2' }, [
            h('button', {
              type: 'button',
              className: 'inline-flex items-center justify-center h-10 px-4 rounded-md border border-slate-200 dark:border-white/10 text-sm font-semibold text-slate-700 dark:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-800',
              onClick: backToList,
            }, 'Cancel'),
            !draftReadOnly && step > 1
              ? h('button', {
                type: 'button',
                className: 'inline-flex items-center justify-center h-10 px-4 rounded-md border border-slate-200 dark:border-white/10 text-sm font-semibold text-slate-700 dark:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-800',
                onClick: () => setStep((current) => Math.max(1, current - 1)),
              }, 'Back')
              : null,
            !draftReadOnly
              ? h('button', {
                type: 'button',
                className: 'inline-flex items-center justify-center h-10 px-4 rounded-md border border-slate-200 dark:border-white/10 text-sm font-semibold text-slate-700 dark:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-800',
                onClick: persistDraft,
              }, 'Save Draft')
              : null,
            !draftReadOnly && step < 4
              ? h('button', {
                type: 'button',
                disabled: !currentStepCanContinue,
                className: 'inline-flex items-center justify-center h-10 px-4 rounded-md bg-netnet-purple text-white text-sm font-semibold hover:brightness-110 disabled:opacity-50',
                onClick: () => {
                  const nextStep = Math.min(4, step + 1);
                  if (canVisitStep(nextStep)) setStep(nextStep);
                },
              }, 'Continue')
              : null,
            !draftReadOnly && step === 4
              ? h('button', {
                type: 'button',
                disabled: !canOpenApply,
                className: 'inline-flex items-center justify-center h-10 px-4 rounded-md bg-netnet-purple text-white text-sm font-semibold hover:brightness-110 disabled:opacity-50',
                onClick: () => {
                  setApplyConfirmText('');
                  setShowApplyModal(true);
                },
              }, 'Apply Change Order')
              : null,
          ].filter(Boolean)),
        ]),
      ]),
    ]),
    showApplyModal
      ? h('div', { className: 'fixed inset-0 z-50 flex items-center justify-center px-4' }, [
        h('div', {
          className: 'absolute inset-0 bg-black/40',
          onClick: () => setShowApplyModal(false),
        }),
        h('div', {
          ref: applyModalRef,
          role: 'dialog',
          'aria-modal': 'true',
          'aria-labelledby': 'apply-change-order-title',
          className: 'relative z-10 w-full max-w-md rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 p-5 shadow-xl space-y-4',
        }, [
          h('div', { className: 'space-y-1' }, [
            h('div', { id: 'apply-change-order-title', className: 'text-base font-semibold text-slate-900 dark:text-white' }, 'Apply Change Order'),
            h('p', { className: 'text-sm text-slate-500 dark:text-slate-400' }, 'This will update the job scope and cannot be undone without removing the change order.'),
          ]),
          h('div', { className: 'space-y-2' }, [
            h('div', { className: 'text-xs uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400' }, 'Type APPLY to confirm'),
            h('input', {
              ref: applyConfirmInputRef,
              type: 'text',
              value: applyConfirmText,
              onChange: (event) => setApplyConfirmText(event.target.value || ''),
              placeholder: 'APPLY',
              className: 'w-full rounded-lg border border-slate-300 dark:border-white/10 bg-white dark:bg-slate-900 px-3 py-2 text-sm text-slate-800 dark:text-white',
            }),
          ]),
          h('div', {
            className: canApply
              ? 'text-xs text-emerald-600 dark:text-emerald-300'
              : 'text-xs text-slate-500 dark:text-slate-400',
          }, canApply ? 'Confirmation unlocked.' : 'Enter APPLY to enable the change order.'),
          h('div', { className: 'flex items-center justify-end gap-2' }, [
            h('button', {
              type: 'button',
              className: 'px-4 py-2 text-sm rounded-lg border border-slate-300 dark:border-white/20 text-slate-700 dark:text-white hover:bg-slate-50 dark:hover:bg-slate-800',
              onClick: () => setShowApplyModal(false),
            }, 'Cancel'),
            h('button', {
              type: 'button',
              disabled: !canApply,
              className: [
                'px-4 py-2 text-sm rounded-lg text-white',
                canApply
                  ? 'bg-netnet-purple hover:brightness-110'
                  : 'bg-netnet-purple/50 cursor-not-allowed opacity-60',
              ].join(' '),
              onClick: applyDraft,
            }, 'Apply Change Order'),
          ]),
        ]),
      ])
      : null,
  ]);
}
