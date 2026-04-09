import { loadServiceTypes } from '../../quick-tasks/quick-tasks-store.js';
import { navigate } from '../../router.js';
import { getJobCycleKey, setJobCycleKey } from '../jobs-ui-state.js';
import { buildDeliverablesFromPlan } from '../jobs-plan-grid.js';
import {
  formatCycleLabel,
  getCurrentCycleKey,
  isDeliverableVisibleInCycle,
  shiftCycleKey,
} from '../retainer-cycle-utils.js';
import {
  applyChangeOrder,
  getApplicableChangeOrders,
  getCurrentPlanState,
  normalizeChangeOrderScopeFields,
  normalizeChangeOrderRecord,
  revertChangeOrder,
} from '../change-order-scope-utils.js';
import { RetainerMonthSwitcher } from './retainer-month-switcher.js';

const { createElement: h, useEffect, useMemo, useRef, useState } = React;
const CHANGE_ORDER_FLOW_STORAGE_PREFIX = 'netnet_change_order_flow_v1';

function createId(prefix) {
  return `${prefix}_${Math.random().toString(36).slice(2, 9)}`;
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
  const hours = roundHours(value);
  const prefix = hours > 0 ? '+' : '';
  return `${prefix}${formatHours(hours)} hrs`;
}

function buildRetainerApplyMonthOptions(selectedMonth) {
  const baseMonth = String(selectedMonth || '').trim() || getCurrentCycleKey();
  return Array.from({ length: 7 }, (_, index) => {
    const value = shiftCycleKey(baseMonth, index);
    return {
      value,
      label: formatCycleLabel(value),
    };
  });
}

function normalizeHoursMap(map = {}) {
  if (!map || typeof map !== 'object') return {};
  return Object.keys(map).reduce((acc, key) => {
    const value = roundHours(map[key]);
    if (value !== 0) acc[String(key)] = value;
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

function getVisibleDeliverables(job, cycleKey = null) {
  const deliverables = Array.isArray(job?.deliverables) ? job.deliverables : [];
  if (job?.kind !== 'retainer') return deliverables;
  return deliverables.filter((deliverable) => isDeliverableVisibleInCycle(deliverable, cycleKey));
}

function getDeliverableServiceTypeIds(job, deliverable, cycleKey = null) {
  if (!deliverable) return [];
  const pools = job?.kind === 'retainer' && cycleKey
    ? (deliverable?.poolsByCycle?.[cycleKey] || deliverable?.pools || [])
    : (deliverable?.pools || []);
  return [...new Set((pools || [])
    .filter((pool) => Number(pool?.estimatedHours) > 0 && pool?.serviceTypeId)
    .map((pool) => String(pool.serviceTypeId)))];
}

function createEmptyExistingChange() {
  return {
    id: createId('cochg'),
    kind: 'existing',
    deliverableId: '',
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

function createChangeOrderDraft(job, changeOrders = [], cycleKey = null, serviceTypes = []) {
  const scope = normalizeChangeOrderScopeFields({}, job?.kind, cycleKey || job?.currentCycleKey || null);
  return normalizeChangeOrderRecord({
    id: createId('co'),
    name: getNextChangeOrderName(changeOrders),
    status: 'draft',
    scopeMode: scope.scopeMode,
    effectiveMonth: scope.cycleKey,
    createdAt: new Date().toISOString(),
    appliedAt: null,
    notes: '',
    impactHours: 0,
    changes: [],
    items: [],
  }, job?.kind, scope.cycleKey);
}

function cloneChangeOrder(changeOrder) {
  return JSON.parse(JSON.stringify(changeOrder || null));
}

function getReviewableChanges(changeOrder) {
  return (changeOrder?.changes || []).filter((change) => {
    if (!change) return false;
    const impact = sumChangeImpact(change);
    const hasMetadata = !!String(change?.name || '').trim()
      || Number.isFinite(Number(change?.orderIndex))
      || !!change?.remove;
    if (change.kind === 'existing') return !!change.deliverableId && (impact !== 0 || hasMetadata);
    return !!String(change?.name || '').trim() && impact !== 0;
  });
}

function getChangeValidation(change, job, cycleKey = null) {
  if (!change) return { valid: false, message: 'Change item is missing.' };
  if (change.kind === 'existing') {
    const deliverable = getVisibleDeliverables(job, cycleKey)
      .find((item) => String(item?.id || '') === String(change?.deliverableId || ''));
    if (!deliverable) {
      return { valid: false, message: 'Select an existing deliverable.' };
    }
    if (sumChangeImpact(change) <= 0) {
      return { valid: false, message: 'Enter hours for at least one service type.' };
    }
    return { valid: true, message: '' };
  }
  if (!String(change?.name || '').trim()) {
    return { valid: false, message: 'Enter a deliverable name.' };
  }
  if (sumChangeImpact(change) <= 0) {
    return { valid: false, message: 'Enter hours for at least one service type.' };
  }
  return { valid: true, message: '' };
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

function createEmptyDeliverableDetails() {
  return {
    description: '',
    durationValue: '',
    durationUnit: 'days',
    dependencyRowId: '',
    internalNotes: '',
    deliverableType: '',
  };
}

function shouldKeepRetainerDeliverableAfterCycleRemoval(deliverable, cycleKey) {
  if (!deliverable) return false;
  const remainingPoolsByCycle = Object.keys(deliverable?.poolsByCycle || {}).reduce((acc, key) => {
    if (String(key) === String(cycleKey)) return acc;
    const pools = Array.isArray(deliverable.poolsByCycle[key]) ? deliverable.poolsByCycle[key] : [];
    if (pools.length) acc[key] = pools;
    return acc;
  }, {});
  const hasOtherCyclePools = Object.keys(remainingPoolsByCycle).length > 0;
  const hasGlobalPools = Array.isArray(deliverable?.pools) && deliverable.pools.length > 0 && !Object.keys(deliverable?.poolsByCycle || {}).length;
  const hasTasks = Array.isArray(deliverable?.tasks) && deliverable.tasks.length > 0;
  return hasOtherCyclePools || hasGlobalPools || hasTasks;
}

function buildDeliverableDetailsById(plan, deliverables = [], existingDetails = {}) {
  const detailsByDeliverableId = new Map(
    (deliverables || []).map((deliverable) => [String(deliverable.id), {
      description: String(deliverable?.description || ''),
      durationValue: String(deliverable?.durationValue || ''),
      durationUnit: deliverable?.durationUnit || 'days',
      dependencyRowId: String((deliverable?.dependencyDeliverableIds || [])[0] || ''),
      internalNotes: String(deliverable?.internalNotes || ''),
      deliverableType: String(deliverable?.deliverableType || ''),
    }])
  );
  return (plan?.rows || []).reduce((acc, row) => {
    const key = String(row?.id || '');
    if (!key) return acc;
    acc[key] = existingDetails?.[key]
      ? { ...(existingDetails[key] || {}) }
      : (detailsByDeliverableId.get(key) || createEmptyDeliverableDetails());
    return acc;
  }, {});
}

function materializeDeliverablesFromPlan(job, plan, cycleKey = null) {
  const existingDeliverables = Array.isArray(job?.deliverables) ? job.deliverables : [];
  if (job?.kind !== 'retainer') {
    return buildDeliverablesFromPlan(plan, existingDeliverables, { jobKind: job?.kind });
  }

  const builtCycleDeliverables = buildDeliverablesFromPlan(plan, existingDeliverables, {
    jobKind: 'retainer',
    cycleKey,
  });
  const builtById = new Map(builtCycleDeliverables.map((deliverable) => [String(deliverable.id), deliverable]));
  const nextDeliverables = [...builtCycleDeliverables];

  existingDeliverables.forEach((deliverable) => {
    const key = String(deliverable?.id || '');
    if (!key || builtById.has(key)) return;
    if (!isDeliverableVisibleInCycle(deliverable, cycleKey)) {
      nextDeliverables.push(deliverable);
      return;
    }
    if (!shouldKeepRetainerDeliverableAfterCycleRemoval(deliverable, cycleKey)) return;
    const nextPoolsByCycle = Object.keys(deliverable?.poolsByCycle || {}).reduce((acc, monthKey) => {
      if (String(monthKey) === String(cycleKey)) return acc;
      const pools = Array.isArray(deliverable.poolsByCycle[monthKey]) ? deliverable.poolsByCycle[monthKey] : [];
      if (pools.length) acc[monthKey] = pools.map((pool) => ({ ...pool }));
      return acc;
    }, {});
    nextDeliverables.push({
      ...deliverable,
      createdCycleKey: String(deliverable?.createdCycleKey || '') === String(cycleKey) ? null : (deliverable?.createdCycleKey || null),
      poolsByCycle: nextPoolsByCycle,
    });
  });

  return nextDeliverables;
}

function materializeJobFromCurrentPlan(job, serviceTypes = [], cycleKey = null) {
  const activeCycleKey = job?.kind === 'retainer' ? (cycleKey || job?.currentCycleKey || getCurrentCycleKey()) : null;
  const currentPlan = getCurrentPlanState(job, {
    cycleKey: activeCycleKey,
    serviceTypes,
  });
  const deliverables = materializeDeliverablesFromPlan(job, currentPlan, activeCycleKey);
  return {
    ...job,
    plan: currentPlan,
    deliverables,
    deliverableDetailsById: buildDeliverableDetailsById(currentPlan, deliverables, job?.deliverableDetailsById || {}),
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
  const allServiceTypes = useMemo(() => loadServiceTypes().filter((type) => type.active), []);
  const isRetainer = job?.kind === 'retainer';
  const [selectedMonth, setSelectedMonth] = useState(() => (
    isRetainer && job?.id ? (getJobCycleKey(job.id) || job.currentCycleKey || getCurrentCycleKey()) : null
  ));

  useEffect(() => {
    if (!job || job.kind !== 'retainer') {
      setSelectedMonth(null);
      return;
    }
    setSelectedMonth(getJobCycleKey(job.id) || job.currentCycleKey || getCurrentCycleKey());
  }, [job?.id, job?.kind, job?.currentCycleKey]);

  const activeCycleKey = isRetainer ? (selectedMonth || getCurrentCycleKey()) : null;
  const scopedPlanState = useMemo(
    () => getCurrentPlanState(job, { cycleKey: activeCycleKey, serviceTypes: allServiceTypes }),
    [job, activeCycleKey, allServiceTypes]
  );
  const allowedServiceTypeIds = useMemo(
    () => [...new Set([
      ...((job?.serviceTypeIds || []).map((id) => String(id)).filter(Boolean)),
      ...((scopedPlanState?.serviceTypeIds || []).map((id) => String(id)).filter(Boolean)),
    ])],
    [job?.serviceTypeIds, scopedPlanState]
  );
  const serviceTypes = useMemo(() => {
    const knownTypesById = new Map((allServiceTypes || []).map((type) => [String(type.id), type]));
    return allowedServiceTypeIds
      .map((id) => knownTypesById.get(String(id)))
      .filter(Boolean);
  }, [allServiceTypes, allowedServiceTypeIds]);
  const serviceTypeMap = useMemo(
    () => new Map((allServiceTypes || []).map((type) => [String(type.id), type])),
    [allServiceTypes]
  );
  const allChangeOrders = Array.isArray(job?.changeOrders) ? job.changeOrders : [];
  const changeOrders = useMemo(() => {
    return isRetainer
      ? allChangeOrders.filter((changeOrder) => getApplicableChangeOrders(job, { cycleKey: activeCycleKey, status: null }).some((item) => String(item.id) === String(changeOrder.id)))
      : allChangeOrders;
  }, [job, isRetainer, activeCycleKey, allChangeOrders]);
  const appliedCount = changeOrders.filter((item) => item.status === 'applied').length;
  const existingChangeOrder = useMemo(
    () => (changeOrderId ? allChangeOrders.find((item) => String(item.id) === String(changeOrderId)) || null : null),
    [allChangeOrders, changeOrderId]
  );

  const [draft, setDraft] = useState(null);
  const [step, setStep] = useState(1);
  const [applyConfirmText, setApplyConfirmText] = useState('');
  const [applyEffectiveStartMonth, setApplyEffectiveStartMonth] = useState(() => (
    isRetainer ? (selectedMonth || getCurrentCycleKey()) : ''
  ));
  const [showApplyModal, setShowApplyModal] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [pendingChange, setPendingChange] = useState(null);
  const [pendingFocusTarget, setPendingFocusTarget] = useState(null);
  const applyModalRef = useRef(null);
  const applyConfirmInputRef = useRef(null);

  const setCycle = (nextKey) => {
    if (!job || !isRetainer || !nextKey) return;
    setSelectedMonth(nextKey);
    setJobCycleKey(job.id, nextKey);
  };

  useEffect(() => {
    if (!isRetainer || !existingChangeOrder?.cycleKey) return;
    if (String(existingChangeOrder.cycleKey) === String(activeCycleKey || '')) return;
    setCycle(existingChangeOrder.cycleKey);
  }, [isRetainer, existingChangeOrder?.cycleKey, activeCycleKey]);

  useEffect(() => {
    if (!changeOrderId) {
      setDraft(null);
      setStep(1);
      setApplyConfirmText('');
      setApplyEffectiveStartMonth(isRetainer ? (selectedMonth || getCurrentCycleKey()) : '');
      setShowApplyModal(false);
      setPendingChange(null);
      setPendingFocusTarget(null);
      return;
    }
    const cached = loadFlowState(job?.id, changeOrderId);
    if (cached?.draft) {
      setDraft(normalizeChangeOrderRecord(
        {
          ...cached.draft,
          items: [],
        },
        job?.kind,
        cached?.draft?.cycleKey || activeCycleKey
      ));
      setStep(Math.max(1, Math.min(4, Number(cached.step) || 1)));
      setApplyConfirmText(String(cached.applyConfirmText || ''));
      setApplyEffectiveStartMonth(String(cached.applyEffectiveStartMonth || cached?.draft?.effectiveStartMonth || cached?.draft?.effectiveMonth || activeCycleKey || getCurrentCycleKey()));
      setShowApplyModal(false);
      setPendingChange(cached?.pendingChange ? { ...cached.pendingChange } : null);
      setPendingFocusTarget(null);
      return;
    }
    if (existingChangeOrder) {
      setDraft(normalizeChangeOrderRecord(
        {
          ...cloneChangeOrder(existingChangeOrder),
          items: [],
        },
        job?.kind,
        activeCycleKey || existingChangeOrder?.cycleKey || job?.currentCycleKey || null
      ));
      setStep(existingChangeOrder.status === 'applied' ? 4 : 1);
      setApplyConfirmText('');
      setApplyEffectiveStartMonth(String(existingChangeOrder?.effectiveStartMonth || existingChangeOrder?.effectiveMonth || activeCycleKey || getCurrentCycleKey()));
      setShowApplyModal(false);
      setPendingChange(null);
      setPendingFocusTarget(null);
      return;
    }
    const nextDraft = {
      ...createChangeOrderDraft(job, allChangeOrders, activeCycleKey, serviceTypes),
      id: String(changeOrderId),
    };
    setDraft(nextDraft);
    setStep(1);
    setApplyConfirmText('');
    setApplyEffectiveStartMonth(isRetainer ? (activeCycleKey || getCurrentCycleKey()) : '');
    setShowApplyModal(false);
    setPendingChange(null);
    setPendingFocusTarget(null);
  }, [changeOrderId, existingChangeOrder, job, allChangeOrders, activeCycleKey, serviceTypes]);

  useEffect(() => {
    if (!job?.id || !changeOrderId || !draft) return;
    saveFlowState(job.id, changeOrderId, {
      draft,
      step,
      applyConfirmText,
      applyEffectiveStartMonth,
      pendingChange,
    });
  }, [job?.id, changeOrderId, draft, step, applyConfirmText, applyEffectiveStartMonth, pendingChange]);

  const draftReadOnly = !!draft && (readOnly || draft.status === 'applied');
  const reviewableChanges = draft ? getReviewableChanges(draft) : [];
  const changeValidations = useMemo(
    () => (draft?.changes || []).reduce((acc, change) => {
      acc[String(change?.id || '')] = getChangeValidation(change, job, activeCycleKey);
      return acc;
    }, {}),
    [draft?.changes, job, activeCycleKey]
  );
  const hasStep2Changes = !!(draft?.changes || []).length;
  const allDraftChangesValid = hasStep2Changes && (draft?.changes || []).every((change) => (
    changeValidations[String(change?.id || '')]?.valid
  ));
  const draftImpactHours = draft ? sumChangeOrderImpact({ changes: reviewableChanges }) : 0;
  const canOpenApply = !draftReadOnly && reviewableChanges.length > 0;
  const retainerApplyMonthOptions = useMemo(
    () => (isRetainer ? buildRetainerApplyMonthOptions(activeCycleKey || getCurrentCycleKey()) : []),
    [isRetainer, activeCycleKey]
  );
  const hasValidApplyStartMonth = !isRetainer || retainerApplyMonthOptions.some((option) => String(option.value) === String(applyEffectiveStartMonth || ''));
  const canApply = canOpenApply
    && hasValidApplyStartMonth
    && String(applyConfirmText || '').trim().toUpperCase() === 'APPLY';
  const isStepReady = (stepIndex) => {
    if (draftReadOnly) return true;
    if (stepIndex === 1) return true;
    if (stepIndex === 2) return hasStep2Changes && allDraftChangesValid;
    if (stepIndex === 3) return hasStep2Changes && allDraftChangesValid && reviewableChanges.length > 0;
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

  useEffect(() => {
    if (!isRetainer) return;
    if (showApplyModal) {
      setShowApplyModal(false);
      setApplyConfirmText('');
    }
    setApplyEffectiveStartMonth(String(activeCycleKey || getCurrentCycleKey()));
  }, [activeCycleKey, isRetainer]);

  useEffect(() => {
    if (!pendingFocusTarget) return;
    window.requestAnimationFrame(() => {
      const node = document.querySelector(`[data-change-focus="${pendingFocusTarget}"]`);
      if (node?.focus) {
        node.focus();
        if (typeof node.setSelectionRange === 'function') {
          const value = String(node.value || '');
          node.setSelectionRange(value.length, value.length);
        }
      }
      setPendingFocusTarget(null);
    });
  }, [pendingFocusTarget, draft, pendingChange]);

  const backToList = () => navigate(`#/app/jobs/${job.id}/change-orders`);

  const openNewChangeOrder = () => {
    const nextId = createId('co');
    const nextDraft = { ...createChangeOrderDraft(job, allChangeOrders, activeCycleKey, serviceTypes), id: nextId };
    saveFlowState(job.id, nextId, {
      draft: nextDraft,
      step: 1,
      applyConfirmText: '',
      pendingChange: null,
    });
    navigate(`#/app/jobs/${job.id}/change-orders/${nextId}`);
  };

  const openExistingChangeOrder = (changeOrder) => {
    navigate(`#/app/jobs/${job.id}/change-orders/${changeOrder.id}`);
  };

  const updateDraft = (patch) => {
    setDraft((current) => ({ ...(current || {}), ...(patch || {}) }));
  };

  const startPendingChange = (kind) => {
    if (draftReadOnly) return;
    const nextPending = kind === 'existing'
      ? createEmptyExistingChange()
      : createEmptyNewDeliverableChange();
    setPendingChange(nextPending);
    setPendingFocusTarget(kind === 'existing'
      ? `pending-deliverable-${nextPending.id}`
      : `pending-name-${nextPending.id}`);
  };

  const clearPendingChange = () => {
    setPendingChange(null);
    setPendingFocusTarget(null);
  };

  const commitPendingChange = (patch = {}, focusTarget = null) => {
    if (!pendingChange) return;
    const committedChange = {
      ...pendingChange,
      ...(patch || {}),
    };
    setDraft((current) => (
      current
        ? {
          ...current,
          changes: [
            ...(current?.changes || []),
            committedChange,
          ],
        }
        : current
    ));
    setPendingChange(null);
    if (focusTarget) {
      setPendingFocusTarget(
        focusTarget.replace('__CHANGE_ID__', committedChange.id)
      );
    }
  };

  const updateDraftChange = (changeId, patch) => {
    setDraft((current) => (
      current
        ? {
          ...current,
          changes: (current?.changes || []).map((change) => (
            String(change?.id || '') === String(changeId)
              ? { ...change, ...(patch || {}) }
              : change
          )),
        }
        : current
    ));
  };

  const updateDraftChangeServiceHours = (changeId, serviceTypeId, rawValue) => {
    setDraft((current) => (
      current
        ? {
          ...current,
          changes: (current?.changes || []).map((change) => {
            if (String(change?.id || '') !== String(changeId)) return change;
            const nextHours = { ...(change?.serviceTypeHours || {}) };
            const trimmed = String(rawValue || '').trim();
            if (!trimmed) {
              delete nextHours[String(serviceTypeId)];
            } else {
              const value = roundHours(trimmed);
              if (value > 0) nextHours[String(serviceTypeId)] = value;
            }
            return {
              ...change,
              serviceTypeHours: nextHours,
            };
          }),
        }
        : current
    ));
  };

  const addDraftChange = (kind) => {
    setDraft((current) => (
      current
        ? {
          ...current,
          changes: [
            ...(current?.changes || []),
            kind === 'existing'
              ? createEmptyExistingChange()
              : createEmptyNewDeliverableChange(),
          ],
        }
        : current
    ));
  };

  const removeDraftChange = (changeId) => {
    setDraft((current) => (
      current
        ? {
          ...current,
          changes: (current?.changes || []).filter((change) => String(change?.id || '') !== String(changeId)),
        }
        : current
    ));
  };

  const persistDraft = () => {
    if (!draft || typeof onJobUpdate !== 'function') return;
    const nextDraft = normalizeChangeOrderRecord({
      ...cloneChangeOrder(draft),
      items: [],
      status: 'draft',
      appliedAt: null,
    }, job?.kind, draft?.cycleKey || activeCycleKey);
    onJobUpdate({ changeOrders: upsertChangeOrder(allChangeOrders, nextDraft) });
    clearFlowState(job.id, nextDraft.id);
    window?.showToast?.('Change order saved as draft.');
    backToList();
  };

  const applyDraft = () => {
    if (!draft || !reviewableChanges.length || typeof onJobUpdate !== 'function') return;
    const nextDraft = normalizeChangeOrderRecord({
      ...cloneChangeOrder(draft),
      ...(isRetainer ? { effectiveStartMonth: applyEffectiveStartMonth || activeCycleKey || getCurrentCycleKey() } : {}),
      items: [],
      status: 'draft',
      appliedAt: null,
    }, job?.kind, draft?.cycleKey || activeCycleKey);
    const appliedJob = applyChangeOrder({
      ...job,
      changeOrders: upsertChangeOrder(allChangeOrders, nextDraft),
    }, nextDraft.id);
    const next = materializeJobFromCurrentPlan(appliedJob, serviceTypes, nextDraft.cycleKey || activeCycleKey);
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
      const revertedJob = revertChangeOrder({
        ...job,
        changeOrders: allChangeOrders,
      }, changeOrder.id);
      const reverted = materializeJobFromCurrentPlan(
        revertedJob,
        serviceTypes,
        changeOrder?.cycleKey || activeCycleKey
      );
      onJobUpdate(reverted);
      clearFlowState(job.id, changeOrder.id);
      window?.showToast?.('Applied change order removed and reverted.');
      return;
    }
    onJobUpdate({
      changeOrders: (allChangeOrders || []).filter((item) => String(item.id) !== String(changeOrder.id)),
    });
    clearFlowState(job.id, changeOrder.id);
    window?.showToast?.('Draft change order deleted.');
  };

  const visibleDeliverables = getVisibleDeliverables(job, activeCycleKey);

  const renderServiceTypeGrid = (change, options = {}) => {
    const isPending = !!options.isPending;
    const selectedDeliverable = change?.kind === 'existing'
      ? visibleDeliverables.find((deliverable) => String(deliverable?.id || '') === String(change?.deliverableId || ''))
      : null;
    const serviceTypeIds = change?.kind === 'existing'
      ? getDeliverableServiceTypeIds(job, selectedDeliverable, activeCycleKey)
      : (serviceTypes || []).map((type) => String(type.id)).filter(Boolean);
    return h('div', { className: 'space-y-3' }, [
      h('div', { className: 'text-xs text-slate-500 dark:text-slate-400' }, change?.kind === 'existing'
        ? 'Add hours by service type using the selected deliverable pools.'
        : 'Define the hours for this new deliverable by service type.'),
      h('div', { className: 'overflow-hidden rounded-2xl border border-slate-200/80 dark:border-white/10' }, [
        h('div', {
          className: 'grid gap-3 border-b border-slate-200/80 bg-slate-100/80 px-4 py-3 text-[11px] uppercase tracking-[0.18em] text-slate-500 dark:border-white/10 dark:bg-slate-900/80 dark:text-slate-400',
          style: { gridTemplateColumns: '1fr 120px' },
        }, [
          h('div', null, 'Service Type'),
          h('div', { className: 'text-right' }, 'Hours'),
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
              'data-change-focus': `${isPending ? 'pending' : 'committed'}-hours-${change.id}-${serviceTypeId}`,
              onChange: (event) => {
                if (isPending) {
                  const rawValue = event.target.value;
                  const trimmed = String(rawValue || '').trim();
                  if (!trimmed) {
                    setPendingChange((current) => current ? {
                      ...current,
                      serviceTypeHours: {
                        ...(current?.serviceTypeHours || {}),
                        [String(serviceTypeId)]: '',
                      },
                    } : current);
                    return;
                  }
                  const value = roundHours(rawValue);
                  commitPendingChange({
                    serviceTypeHours: {
                      ...(change?.serviceTypeHours || {}),
                      [String(serviceTypeId)]: value,
                    },
                  }, `committed-hours-__CHANGE_ID__-${serviceTypeId}`);
                  return;
                }
                updateDraftChangeServiceHours(change.id, serviceTypeId, event.target.value);
              },
              className: 'h-10 w-full rounded-md border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-950 px-3 text-right text-sm text-slate-700 dark:text-slate-100',
            }),
          ]))
          : h('div', { className: 'px-4 py-3 text-sm text-slate-500 dark:text-slate-400' }, change?.kind === 'existing'
            ? 'Select a deliverable with available service types.'
            : 'No service types are available yet.'),
      ]),
    ]);
  };

  const renderChangeSection = (change, index, options = {}) => {
    const isExisting = change?.kind === 'existing';
    const isPending = !!options.isPending;
    const validation = isPending
      ? { valid: true, message: '' }
      : (changeValidations[String(change?.id || '')] || { valid: true, message: '' });
    return h('div', {
      key: change.id,
      className: `space-y-4 rounded-2xl border p-5 ${isPending
        ? 'border-netnet-purple/40 bg-netnet-purple/5 dark:border-netnet-purple/50 dark:bg-netnet-purple/10'
        : 'border-slate-200/80 bg-white/80 dark:border-white/10 dark:bg-slate-900/40'}`,
    }, [
      h('div', { className: 'flex items-start justify-between gap-3' }, [
        h('div', { className: 'space-y-1' }, [
          h('div', { className: 'text-sm font-semibold text-slate-900 dark:text-white' }, isExisting ? 'Add to Existing Deliverable' : 'Add New Deliverable'),
          h('div', { className: 'text-xs text-slate-500 dark:text-slate-400' }, isExisting
            ? 'Select a deliverable and add hours by service type.'
            : 'Create a new deliverable with its own service type hours.'),
          isPending
            ? h('div', { className: 'text-[11px] font-semibold uppercase tracking-[0.16em] text-netnet-purple' }, 'Pending')
            : null,
        ]),
        draftReadOnly
          ? null
          : h('button', {
            type: 'button',
            className: 'text-xs font-semibold text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white',
            onClick: () => (isPending ? clearPendingChange() : removeDraftChange(change.id)),
          }, isPending ? 'Cancel' : 'Remove'),
      ]),
      isExisting
        ? h('div', { className: 'space-y-2' }, [
          h('div', { className: 'text-xs uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400' }, 'Deliverable'),
          h('select', {
            value: change?.deliverableId || '',
            disabled: draftReadOnly,
            'data-change-focus': `${isPending ? 'pending' : 'committed'}-deliverable-${change.id}`,
            onChange: (event) => {
              const nextValue = event.target.value || '';
              if (isPending) {
                if (!nextValue) {
                  setPendingChange((current) => current ? { ...current, deliverableId: '', serviceTypeHours: {} } : current);
                  return;
                }
                commitPendingChange({
                  deliverableId: nextValue,
                  serviceTypeHours: {},
                }, 'committed-deliverable-__CHANGE_ID__');
                return;
              }
              updateDraftChange(change.id, {
                deliverableId: nextValue,
                serviceTypeHours: {},
              });
            },
            className: 'h-10 w-full rounded-md border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-950 px-3 text-sm text-slate-700 dark:text-slate-100',
          }, [
            h('option', { value: '' }, 'Select deliverable'),
            ...visibleDeliverables.map((deliverable) => (
              h('option', { key: deliverable.id, value: deliverable.id }, deliverable.name || 'Deliverable')
            )),
          ]),
        ])
        : h('div', { className: 'grid gap-4 md:grid-cols-2' }, [
          h('div', { className: 'space-y-2 md:col-span-2' }, [
            h('div', { className: 'text-xs uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400' }, 'Deliverable Name'),
            h('input', {
              type: 'text',
              value: change?.name || '',
              disabled: draftReadOnly,
              'data-change-focus': `${isPending ? 'pending' : 'committed'}-name-${change.id}`,
              placeholder: 'New deliverable name',
              onChange: (event) => {
                const nextValue = event.target.value;
                if (isPending) {
                  if (!String(nextValue || '').trim()) {
                    setPendingChange((current) => current ? { ...current, name: nextValue } : current);
                    return;
                  }
                  commitPendingChange({ name: nextValue }, 'committed-name-__CHANGE_ID__');
                  return;
                }
                updateDraftChange(change.id, { name: nextValue });
              },
              className: 'h-10 w-full rounded-md border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-950 px-3 text-sm text-slate-700 dark:text-slate-100',
            }),
          ]),
          h('div', { className: 'space-y-2' }, [
            h('div', { className: 'text-xs uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400' }, 'Description'),
            h('textarea', {
              rows: 4,
              value: change?.description || '',
              disabled: draftReadOnly,
              placeholder: 'Deliverable description',
              onChange: (event) => (isPending
                ? setPendingChange((current) => current ? { ...current, description: event.target.value } : current)
                : updateDraftChange(change.id, { description: event.target.value })),
              className: 'w-full rounded-md border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-950 px-3 py-2 text-sm text-slate-700 dark:text-slate-100',
            }),
          ]),
          h('div', { className: 'space-y-2' }, [
            h('div', { className: 'text-xs uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400' }, 'Details'),
            h('textarea', {
              rows: 4,
              value: change?.internalNotes || '',
              disabled: draftReadOnly,
              placeholder: 'Internal notes',
              onChange: (event) => (isPending
                ? setPendingChange((current) => current ? { ...current, internalNotes: event.target.value } : current)
                : updateDraftChange(change.id, { internalNotes: event.target.value })),
              className: 'w-full rounded-md border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-950 px-3 py-2 text-sm text-slate-700 dark:text-slate-100',
            }),
          ]),
        ]),
      renderServiceTypeGrid(change, { isPending }),
      !validation.valid
        ? h('div', { className: 'rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-200' }, validation.message)
        : null,
    ]);
  };

  const renderReviewList = () => (
    reviewableChanges.length
      ? h('div', { className: 'space-y-5' }, reviewableChanges.map((change, index) => {
        const existingDeliverable = change.kind === 'existing'
          ? (job?.deliverables || []).find((item) => String(item.id) === String(change.deliverableId))
          : null;
        const title = change.kind === 'existing'
          ? (String(change.name || '').trim() || existingDeliverable?.name || 'Deliverable')
          : String(change.name || '').trim() || 'New Deliverable';
        const serviceEntries = Object.entries(normalizeHoursMap(change.serviceTypeHours || {}));
        return h('div', {
          key: `${draft?.id || 'draft'}-${change.id}`,
          className: `${index > 0 ? 'border-t border-slate-200/80 pt-5 dark:border-white/10' : ''} space-y-2`,
        }, [
          h('div', { className: 'text-sm font-semibold text-slate-900 dark:text-white' }, change.kind === 'existing' ? title : `New Deliverable: ${title}`),
          change.kind === 'existing' && existingDeliverable?.name && String(change.name || '').trim() && String(change.name || '').trim() !== String(existingDeliverable.name || '').trim()
            ? h('div', { className: 'text-xs text-slate-500 dark:text-slate-400' }, `Renamed from ${existingDeliverable.name}`)
            : null,
          change.remove
            ? h('div', { className: 'text-sm text-rose-600 dark:text-rose-300' }, 'Removed from current plan')
            : null,
          !change.remove && Number.isFinite(Number(change.orderIndex))
            ? h('div', { className: 'text-xs text-slate-500 dark:text-slate-400' }, `Row position ${Number(change.orderIndex) + 1}`)
            : null,
          serviceEntries.map(([serviceTypeId, hours]) => h('div', {
            key: `${change.id}-${serviceTypeId}`,
            className: 'flex items-center justify-between gap-3 text-sm text-slate-600 dark:text-slate-300',
          }, [
            h('span', null, serviceTypeMap.get(String(serviceTypeId))?.name || 'Service Type'),
            h('span', { className: 'font-semibold text-slate-900 dark:text-white' }, formatImpact(hours)),
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
              className: `inline-flex items-center justify-center h-10 px-4 rounded-md border text-sm font-semibold ${
                pendingChange?.kind === 'existing'
                  ? 'border-netnet-purple bg-netnet-purple/10 text-netnet-purple'
                  : 'border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-800'
              }`,
              onClick: () => startPendingChange('existing'),
            }, 'Add to Existing Deliverable'),
            h('button', {
              type: 'button',
              className: `inline-flex items-center justify-center h-10 px-4 rounded-md border text-sm font-semibold ${
                pendingChange?.kind === 'new_deliverable'
                  ? 'border-netnet-purple bg-netnet-purple/10 text-netnet-purple'
                  : 'border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-800'
              }`,
              onClick: () => startPendingChange('new_deliverable'),
            }, 'Add New Deliverable'),
          ]),
        (draft?.changes?.length || pendingChange)
          ? h('div', { className: 'space-y-4' }, [
            ...(draft?.changes || []).map(renderChangeSection),
            pendingChange ? renderChangeSection(pendingChange, (draft?.changes || []).length, { isPending: true }) : null,
          ].filter(Boolean))
          : h('div', { className: 'text-sm text-slate-500 dark:text-slate-400' }, 'Choose a change type to begin building this change order.'),
      ]);
    }
    if (step === 3) {
      return h('div', { className: 'space-y-6' }, [
        h('div', { className: 'space-y-2' }, [
          h('div', { className: 'text-sm font-semibold text-slate-900 dark:text-white' }, 'Summary of changes'),
          h('div', { className: 'text-sm text-slate-500 dark:text-slate-400' }, 'Review the current plan against the working plan before applying this change order.'),
        ]),
        renderReviewList(),
        h('div', { className: 'grid gap-4 border-t border-slate-200/80 pt-5 dark:border-white/10 md:grid-cols-3' }, [
          h('div', { className: 'space-y-1' }, [
            h('div', { className: 'text-[11px] uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400' }, 'Current Deliverables'),
            h('div', { className: 'text-2xl font-semibold text-slate-900 dark:text-white' }, `${visibleDeliverables.length || 0}`),
          ]),
          h('div', { className: 'space-y-1' }, [
            h('div', { className: 'text-[11px] uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400' }, 'Plan Delta'),
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
        h('div', { className: 'text-sm text-slate-500 dark:text-slate-400' }, 'Track structured plan updates without overwriting the original plan.'),
      ]),
      h('div', { className: 'flex flex-wrap items-center gap-3' }, [
        isRetainer
          ? h(RetainerMonthSwitcher, {
            cycleKey: activeCycleKey,
            onChange: setCycle,
            ariaLabel: 'Selected change order month',
          })
          : null,
        h('button', {
          type: 'button',
          className: 'inline-flex items-center justify-center h-10 px-4 rounded-md bg-netnet-purple text-white text-sm font-semibold hover:brightness-110 disabled:opacity-60',
          disabled: readOnly,
          onClick: openNewChangeOrder,
        }, '+ New Change Order'),
      ].filter(Boolean)),
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
      h('div', { className: 'flex flex-wrap items-center justify-end gap-3' }, [
        isRetainer
          ? h(RetainerMonthSwitcher, {
            cycleKey: activeCycleKey,
            onChange: setCycle,
            ariaLabel: 'Selected change order month',
          })
          : null,
        h('button', {
          type: 'button',
          className: 'inline-flex items-center justify-center h-10 px-4 rounded-md border border-slate-200 dark:border-white/10 text-sm font-semibold text-slate-700 dark:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-800',
          onClick: backToList,
        }, 'Back to Change Orders'),
      ].filter(Boolean)),
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
                  ? 'Add to existing deliverables or create brand new deliverables as separate change items.'
                  : step === 3
                    ? 'Review the plan delta against the current plan before you apply it.'
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
            : step === 2
              ? `${draft?.changes?.length || 0} change item${(draft?.changes?.length || 0) === 1 ? '' : 's'} in this change order.`
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
                  setApplyEffectiveStartMonth(String(activeCycleKey || getCurrentCycleKey()));
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
          isRetainer
            ? h('div', { className: 'space-y-2' }, [
              h('div', { className: 'text-xs uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400' }, 'When does this Change Order take effect?'),
              h('select', {
                value: applyEffectiveStartMonth || '',
                onChange: (event) => setApplyEffectiveStartMonth(event.target.value || ''),
                className: 'w-full rounded-lg border border-slate-300 dark:border-white/10 bg-white dark:bg-slate-900 px-3 py-2 text-sm text-slate-800 dark:text-white',
              }, retainerApplyMonthOptions.map((option) => (
                h('option', { key: option.value, value: option.value }, option.label)
              ))),
            ])
            : null,
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
