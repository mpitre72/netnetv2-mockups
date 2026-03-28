import { PerfCard, PerfSectionTitle } from '../../components/performance/primitives.js';
import { loadServiceTypes } from '../../quick-tasks/quick-tasks-store.js';

const { createElement: h, useMemo } = React;

function roundHours(value) {
  return Math.round((Number(value) || 0) * 100) / 100;
}

function formatHourValue(value) {
  const hours = roundHours(value);
  return `${hours % 1 ? hours.toFixed(1) : hours}`.replace(/\.0$/, '');
}

function formatHours(value, { signed = false } = {}) {
  const hours = roundHours(value);
  const prefix = signed && hours > 0 ? '+' : '';
  return `${prefix}${formatHourValue(hours)}h`;
}

function formatVariancePercent(value) {
  if (!Number.isFinite(value)) return '—';
  const rounded = Math.round(value * 10) / 10;
  const prefix = rounded > 0 ? '+' : '';
  return `${prefix}${rounded % 1 ? rounded.toFixed(1) : rounded}%`;
}

function clampPercent(value) {
  const number = Number.isFinite(value) ? value : 0;
  if (number < 0) return 0;
  if (number > 100) return 100;
  return number;
}

function sumHoursMap(map = {}) {
  return Object.values(map || {}).reduce((sum, value) => sum + (Number(value) || 0), 0);
}

function addHoursToMap(target, source = {}) {
  Object.keys(source || {}).forEach((key) => {
    const value = roundHours(source[key]);
    if (!value) return;
    target[String(key)] = roundHours((target[String(key)] || 0) + value);
  });
  return target;
}

function subtractHoursFromMap(target, source = {}) {
  Object.keys(source || {}).forEach((key) => {
    const current = Number(target[String(key)]) || 0;
    const next = roundHours(current - (Number(source[key]) || 0));
    if (next > 0) {
      target[String(key)] = next;
    } else {
      delete target[String(key)];
    }
  });
  return target;
}

function hasOwn(obj, key) {
  return Object.prototype.hasOwnProperty.call(obj || {}, key);
}

function getDeliverablePlanPools(job, deliverable) {
  if (job?.kind === 'retainer' && job?.currentCycleKey) {
    const cyclePools = deliverable?.poolsByCycle?.[job.currentCycleKey];
    if (Array.isArray(cyclePools) && cyclePools.length) return cyclePools;
  }
  return Array.isArray(deliverable?.pools) ? deliverable.pools : [];
}

function getEstimatedHoursMapFromPools(pools = []) {
  return (pools || []).reduce((acc, pool) => {
    const serviceTypeId = pool?.serviceTypeId ? String(pool.serviceTypeId) : '';
    const estimated = roundHours(pool?.estimatedHours);
    if (!serviceTypeId || estimated <= 0) return acc;
    acc[serviceTypeId] = roundHours((acc[serviceTypeId] || 0) + estimated);
    return acc;
  }, {});
}

function getActualHoursMapFromPools(pools = []) {
  return (pools || []).reduce((acc, pool) => {
    const serviceTypeId = pool?.serviceTypeId ? String(pool.serviceTypeId) : '';
    const actual = roundHours(pool?.actualHours);
    if (!serviceTypeId || actual <= 0) return acc;
    acc[serviceTypeId] = roundHours((acc[serviceTypeId] || 0) + actual);
    return acc;
  }, {});
}

function getTaskActualHours(task) {
  if (!task) return 0;
  if (Number.isFinite(task.actualHours)) return Number(task.actualHours) || 0;
  if (Array.isArray(task.timeEntries)) {
    return task.timeEntries.reduce((sum, entry) => sum + (Number(entry?.hours) || 0), 0);
  }
  if (Array.isArray(task.allocations)) {
    return task.allocations.reduce((sum, alloc) => sum + (Number(alloc?.actualHours) || 0), 0);
  }
  return 0;
}

function getTaskActualByServiceType(task) {
  const allocations = Array.isArray(task?.allocations) ? task.allocations : [];
  const byServiceType = {};
  let hasAllocationActuals = false;

  allocations.forEach((allocation) => {
    const serviceTypeId = allocation?.serviceTypeId ? String(allocation.serviceTypeId) : '';
    const actual = Number(allocation?.actualHours);
    if (!serviceTypeId || !Number.isFinite(actual)) return;
    hasAllocationActuals = true;
    if (actual <= 0) return;
    byServiceType[serviceTypeId] = roundHours((byServiceType[serviceTypeId] || 0) + actual);
  });

  if (hasAllocationActuals) return byServiceType;

  const taskActual = roundHours(getTaskActualHours(task));
  const uniqueServiceTypeIds = [...new Set(
    allocations.map((allocation) => String(allocation?.serviceTypeId || '')).filter(Boolean)
  )];
  if (taskActual > 0 && uniqueServiceTypeIds.length === 1) {
    byServiceType[uniqueServiceTypeIds[0]] = taskActual;
  }
  return byServiceType;
}

function getDeliverableActualByServiceType(job, deliverable) {
  const pools = getDeliverablePlanPools(job, deliverable);
  const hasPoolActuals = (pools || []).some((pool) => hasOwn(pool, 'actualHours'));
  if (hasPoolActuals) return getActualHoursMapFromPools(pools);

  return (deliverable?.tasks || []).reduce((acc, task) => {
    addHoursToMap(acc, getTaskActualByServiceType(task));
    return acc;
  }, {});
}

function getUnassignedActualByServiceType(tasks = []) {
  return (tasks || []).reduce((acc, task) => {
    addHoursToMap(acc, getTaskActualByServiceType(task));
    return acc;
  }, {});
}

function getAppliedChangeOrders(job) {
  return (job?.changeOrders || []).filter((changeOrder) => changeOrder?.status === 'applied');
}

function reconstructOriginalDeliverables(job) {
  const deliverablesById = new Map(
    (job?.deliverables || []).map((deliverable) => {
      const id = String(deliverable.id);
      return [id, {
        id,
        name: deliverable.name || 'Deliverable',
        pools: { ...getEstimatedHoursMapFromPools(getDeliverablePlanPools(job, deliverable)) },
      }];
    })
  );

  getAppliedChangeOrders(job).forEach((changeOrder) => {
    (changeOrder?.changes || []).forEach((change) => {
      const serviceTypeHours = change?.serviceTypeHours || {};
      if (change?.kind === 'existing') {
        const deliverableId = String(change.deliverableId || '');
        const target = deliverablesById.get(deliverableId);
        if (!target) return;
        subtractHoursFromMap(target.pools, serviceTypeHours);
        return;
      }
      const createdDeliverableId = String(change?.createdDeliverableId || '');
      if (createdDeliverableId) deliverablesById.delete(createdDeliverableId);
    });
  });

  return deliverablesById;
}

function hybridDeliveryStorageKey(jobId) {
  return `netnet_job_hybrid_delivery_${jobId || 'unknown'}`;
}

function normalizeHybridDeliveryEntry(entry = {}) {
  const serviceTypeEntriesRaw = entry?.serviceTypeEntries && typeof entry.serviceTypeEntries === 'object'
    ? entry.serviceTypeEntries
    : {};
  return {
    enabled: !!entry?.enabled,
    serviceTypeEntries: Object.keys(serviceTypeEntriesRaw).reduce((acc, key) => {
      const rawEntry = serviceTypeEntriesRaw[key] || {};
      const nextHours = rawEntry?.hours === '' || rawEntry?.hours === null || rawEntry?.hours === undefined || Number.isNaN(Number(rawEntry?.hours))
        ? null
        : Number(rawEntry.hours);
      const nextNotes = String(rawEntry?.notes || '').trim();
      if (nextHours !== null || nextNotes) {
        acc[String(key)] = {
          hours: nextHours,
          notes: nextNotes,
        };
      }
      return acc;
    }, {}),
  };
}

function loadHybridDeliveryMap(jobId) {
  if (!jobId) return {};
  try {
    const raw = localStorage.getItem(hybridDeliveryStorageKey(jobId));
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return {};
    return Object.keys(parsed).reduce((acc, key) => {
      acc[String(key)] = normalizeHybridDeliveryEntry(parsed[key]);
      return acc;
    }, {});
  } catch (error) {
    return {};
  }
}

function getHybridHoursMap(entry = {}) {
  return Object.keys(entry?.serviceTypeEntries || {}).reduce((acc, key) => {
    const hours = Number(entry.serviceTypeEntries[key]?.hours) || 0;
    if (hours <= 0) return acc;
    acc[String(key)] = roundHours(hours);
    return acc;
  }, {});
}

function sumHybridHours(entry = {}) {
  return sumHoursMap(getHybridHoursMap(entry));
}

function buildDeliverableHybridTooltip(entry = {}, serviceTypeNameMap) {
  const rows = Object.keys(entry?.serviceTypeEntries || {}).reduce((acc, key) => {
    const item = entry.serviceTypeEntries[key] || {};
    const hours = Number(item?.hours) || 0;
    const notes = String(item?.notes || '').trim();
    if (hours <= 0 && !notes) return acc;
    const typeName = serviceTypeNameMap.get(String(key)) || 'Service Type';
    acc.push(`${typeName}: ${formatHours(hours)}${notes ? ` — ${notes}` : ''}`);
    return acc;
  }, []);
  return rows.join('\n');
}

function formatLeverageRatio(actual, aiHours) {
  const humanActual = Number(actual) || 0;
  const ai = Number(aiHours) || 0;
  if (humanActual <= 0 || ai <= 0) return '—';
  const ratio = (humanActual + ai) / humanActual;
  const rounded = Math.round(ratio * 100) / 100;
  return `${rounded.toFixed(2).replace(/0$/, '').replace(/\.$/, '')}x`;
}

function formatPercent(value) {
  if (!Number.isFinite(value)) return '—';
  const rounded = Math.round(value * 10) / 10;
  return `${rounded % 1 ? rounded.toFixed(1) : rounded}%`;
}

function getLeverageInsight(actual, aiHours) {
  const humanActual = Number(actual) || 0;
  const ai = Number(aiHours) || 0;
  if (humanActual <= 0 || ai <= 0) return '';
  const ratio = (humanActual + ai) / humanActual;
  if (ratio < 1.1) return 'Minimal AI leverage';
  if (ratio <= 1.3) return 'Moderate AI leverage';
  return 'Strong AI leverage';
}

function getHybridIntensity(actual, aiHours) {
  const humanActual = Number(actual) || 0;
  const ai = Number(aiHours) || 0;
  if (ai <= 0) return null;
  if (humanActual <= 0) return 'High';
  const share = (ai / humanActual) * 100;
  if (share < 10) return 'Light';
  if (share <= 25) return 'Moderate';
  return 'High';
}

function getTopHybridServiceInsight(serviceRows = []) {
  const topRow = (serviceRows || []).reduce((best, row) => {
    if (!row || (Number(row.aiHours) || 0) <= 0 || !Number.isFinite(row.hybridSharePct)) return best;
    if (!best) return row;
    if (row.hybridSharePct !== best.hybridSharePct) return row.hybridSharePct > best.hybridSharePct ? row : best;
    if ((Number(row.aiHours) || 0) !== (Number(best.aiHours) || 0)) {
      return (Number(row.aiHours) || 0) > (Number(best.aiHours) || 0) ? row : best;
    }
    return String(row.name || '').localeCompare(String(best.name || '')) < 0 ? row : best;
  }, null);

  if (!topRow) return '';
  return `AI usage is concentrated in ${topRow.name} (${formatPercent(topRow.hybridSharePct)})`;
}

function variancePercent(actual, plan) {
  if (!plan) return Number(actual) ? Infinity : 0;
  return ((Number(actual) || 0) - (Number(plan) || 0)) / plan * 100;
}

function normalizeTaskStatus(status) {
  if (status === 'completed') return 'completed';
  if (status === 'in_progress') return 'in_progress';
  if (status === 'archived') return 'archived';
  return 'backlog';
}

function getExecutionContext(tasks = [], actualHours = 0) {
  const list = Array.isArray(tasks) ? tasks : [];
  if (!list.length) return 'Not planned';
  const normalized = list.map((task) => normalizeTaskStatus(task?.status));
  const activeTasks = normalized.filter((status) => status !== 'archived');
  if (activeTasks.some((status) => status === 'in_progress')) return 'In progress';
  if (activeTasks.length && activeTasks.every((status) => status === 'completed')) return 'Completed';
  if ((Number(actualHours) || 0) <= 0) return 'No work started';
  return 'In progress';
}

function getDueTiming(dateValue) {
  if (!dateValue) return { label: 'No due date', tone: 'muted' };
  const today = new Date();
  const due = new Date(`${dateValue}T00:00:00`);
  if (Number.isNaN(due.getTime())) return { label: 'No due date', tone: 'muted' };
  const dueTime = due.setHours(0, 0, 0, 0);
  const todayTime = today.setHours(0, 0, 0, 0);
  const diffDays = Math.round((dueTime - todayTime) / (24 * 60 * 60 * 1000));
  if (diffDays < 0) return { label: 'Overdue', tone: 'danger' };
  if (diffDays === 0) return { label: 'Due today', tone: 'warn-strong' };
  if (diffDays < 7) return { label: `Due in ${diffDays}d`, tone: 'warn-strong' };
  if (diffDays <= 14) return { label: `Due in ${diffDays}d`, tone: 'warn-soft' };
  return { label: `Due in ${diffDays}d`, tone: 'muted' };
}

function getMeterTone(actual, plan) {
  if (plan <= 0 && actual > 0) return 'danger';
  if (plan <= 0) return 'neutral';
  const ratio = actual / plan;
  if (ratio > 1) return 'danger';
  if (ratio >= 0.85) return 'warn';
  return 'ok';
}

function getToneClasses(tone) {
  if (tone === 'danger') {
    return {
      bar: 'bg-rose-500',
      text: 'text-rose-600 dark:text-rose-300',
    };
  }
  if (tone === 'warn') {
    return {
      bar: 'bg-amber-500',
      text: 'text-amber-600 dark:text-amber-300',
    };
  }
  if (tone === 'ok') {
    return {
      bar: 'bg-emerald-500',
      text: 'text-emerald-600 dark:text-emerald-300',
    };
  }
  return {
    bar: 'bg-slate-400 dark:bg-slate-500',
    text: 'text-slate-500 dark:text-slate-400',
  };
}

function getHintTextClass(tone) {
  if (tone === 'danger') return 'text-rose-600 dark:text-rose-300';
  if (tone === 'warn-strong') return 'text-amber-700 dark:text-amber-300';
  if (tone === 'warn-soft') return 'text-amber-600 dark:text-amber-400';
  return 'text-slate-500 dark:text-slate-400';
}

function UsageMeter({ actual, plan, aiHours = 0, compact = false, footerLabel = null, footerTone = 'muted' }) {
  const ratio = plan > 0 ? (actual / plan) : (actual > 0 ? 1 : 0);
  const effectiveRatio = plan > 0 ? ((actual + aiHours) / plan) : ((actual + aiHours) > 0 ? 1 : 0);
  const tone = getMeterTone(actual, plan);
  const classes = getToneClasses(tone);
  const width = clampPercent(ratio * 100);
  const effectiveWidth = clampPercent(effectiveRatio * 100);
  const hybridWidth = Math.max(0, effectiveWidth - width);

  return h('div', {
    className: compact ? 'min-w-[150px] space-y-1' : 'min-w-[180px] space-y-1.5',
    title: aiHours > 0
      ? `Actual ${formatHours(actual)} · AI ${formatHours(aiHours)} · Effective ${formatHours(actual + aiHours)} · Plan ${formatHours(plan)}`
      : `Actual ${formatHours(actual)} · Plan ${formatHours(plan)}`,
  }, [
    h('div', {
      className: `relative overflow-hidden rounded-full bg-slate-200 dark:bg-white/10 ${compact ? 'h-2' : 'h-2.5'}`,
    }, [
      h('div', {
        className: `${classes.bar} h-full rounded-full`,
        style: { width: `${width}%` },
      }),
      aiHours > 0 && hybridWidth > 0
        ? h('div', {
          className: 'absolute bottom-0 bg-netnet-purple/60 dark:bg-netnet-purple/70',
          style: {
            left: `${width}%`,
            width: `${hybridWidth}%`,
            height: compact ? '3px' : '4px',
          },
        })
        : null,
      ratio > 1
        ? h('div', { className: 'absolute inset-y-0 right-0 w-1 bg-rose-600/90 dark:bg-rose-400/90' })
        : null,
    ]),
    h('div', {
      className: `flex items-center justify-between gap-3 text-[11px] ${classes.text}`,
    }, [
      h('span', { className: 'tabular-nums' }, `${formatHourValue(actual)} / ${formatHourValue(plan)}h`),
      h('span', { className: 'tabular-nums' }, Number.isFinite(ratio * 100) ? `${Math.round(ratio * 100)}%` : '—'),
    ]),
    footerLabel
      ? h('div', { className: `text-[11px] ${getHintTextClass(footerTone)}` }, footerLabel)
      : null,
  ]);
}

function HybridValueCell({ hours, tooltip = '', secondaryText = null, secondaryClassName = '' }) {
  const aiHours = Number(hours) || 0;
  if (aiHours <= 0) {
    return h('span', { className: 'text-sm text-slate-400 dark:text-slate-500' }, '—');
  }
  return h('div', {
    className: 'space-y-1',
    title: tooltip || undefined,
  }, [
    h('div', { className: 'text-sm tabular-nums text-slate-700 dark:text-slate-200' }, formatHours(aiHours)),
    secondaryText
      ? h('div', {
        className: ['text-[11px] text-slate-500 dark:text-slate-400', secondaryClassName].join(' ').trim(),
      }, secondaryText)
      : null,
  ]);
}

function SummaryStat({ label, value, subtext = null, valueClassName = '', secondary = false }) {
  return h('div', { className: 'space-y-1' }, [
    h('div', { className: 'text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400' }, label),
    h('div', {
      className: [
        secondary
          ? 'text-lg text-slate-500 dark:text-slate-400'
          : 'text-2xl text-slate-900 dark:text-white',
        'font-semibold tabular-nums',
        valueClassName,
      ].join(' ').trim(),
    }, value),
    subtext ? h('div', { className: 'text-xs text-slate-500 dark:text-slate-400' }, subtext) : null,
  ]);
}

function DataTableHeader({ columns, gridTemplateColumns }) {
  return h('div', {
    className: 'grid gap-3 border-b border-slate-200/80 px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500 dark:border-white/10 dark:text-slate-400 md:px-5',
    style: { gridTemplateColumns },
  }, columns.map((label, index) => h('div', {
    key: `${label || 'blank'}-${index}`,
    className: index === columns.length - 1 ? 'text-right' : '',
  }, label || '')));
}

function DataRow({ gridTemplateColumns, children, muted = false, footer = false }) {
  return h('div', {
    className: [
      'grid gap-3 border-b border-slate-100 px-4 py-3 dark:border-white/5 md:px-5',
      muted ? 'text-slate-500 dark:text-slate-400' : 'text-slate-700 dark:text-slate-200',
      footer ? 'bg-slate-50/80 dark:bg-slate-900/50 font-semibold' : '',
    ].join(' '),
    style: { gridTemplateColumns },
  }, children);
}

export function JobPerformanceTab({ job }) {
  const serviceTypes = useMemo(() => loadServiceTypes().filter((type) => type.active), []);
  const hybridDeliveryMap = loadHybridDeliveryMap(job?.id);

  const serviceTypeNameMap = useMemo(() => {
    const map = new Map();
    (serviceTypes || []).forEach((type) => {
      map.set(String(type.id), type.name || `Service ${type.id}`);
    });
    Object.keys(job?.plan?.serviceTypeNames || {}).forEach((key) => {
      if (!map.has(String(key))) map.set(String(key), String(job.plan.serviceTypeNames[key] || key));
    });
    return map;
  }, [job?.plan?.serviceTypeNames, serviceTypes]);

  const metrics = useMemo(() => {
    if (!job) {
      return {
        appliedChangeOrders: [],
        deliverableRows: [],
        serviceRows: [],
        originalPlanHours: 0,
        currentPlanHours: 0,
        actualHours: 0,
        aiHours: 0,
        effectiveOutputHours: 0,
        leverageRatio: null,
        leverageInsight: '',
        varianceHours: 0,
        variancePct: 0,
        topHybridServiceInsight: '',
        hasHybridData: false,
      };
    }

    const originalDeliverablesById = reconstructOriginalDeliverables(job);
    const hybridByService = {};
    const hybridNotesByService = {};
    const deliverableRows = (job.deliverables || []).map((deliverable) => {
      const tasks = Array.isArray(deliverable?.tasks) ? deliverable.tasks : [];
      const currentPlanMap = getEstimatedHoursMapFromPools(getDeliverablePlanPools(job, deliverable));
      const originalPlanMap = originalDeliverablesById.get(String(deliverable.id))?.pools || {};
      const actualMap = getDeliverableActualByServiceType(job, deliverable);
      const hybridEntry = normalizeHybridDeliveryEntry(hybridDeliveryMap?.[String(deliverable.id)] || {});
      const hybridMap = getHybridHoursMap(hybridEntry);
      const aiHours = sumHybridHours(hybridEntry);
      const currentPlan = sumHoursMap(currentPlanMap);
      const originalPlan = sumHoursMap(originalPlanMap);
      const actual = sumHoursMap(actualMap);
      const varianceHours = roundHours(actual - currentPlan);
      addHoursToMap(hybridByService, hybridMap);
      Object.keys(hybridEntry.serviceTypeEntries || {}).forEach((serviceTypeId) => {
        const item = hybridEntry.serviceTypeEntries[serviceTypeId] || {};
        const hours = Number(item?.hours) || 0;
        const notes = String(item?.notes || '').trim();
        if (hours <= 0 && !notes) return;
        const next = hybridNotesByService[String(serviceTypeId)] || [];
        next.push({
          deliverableName: deliverable.name || 'Deliverable',
          hours,
          notes,
        });
        hybridNotesByService[String(serviceTypeId)] = next;
      });
      return {
        id: String(deliverable.id),
        name: deliverable.name || 'Deliverable',
        dueDate: deliverable?.dueDate || null,
        tasks,
        currentPlanMap,
        originalPlanMap,
        actualMap,
        currentPlan,
        originalPlan,
        actual,
        aiHours,
        leverageRatio: actual > 0 && aiHours > 0 ? ((actual + aiHours) / actual) : null,
        hybridTooltip: buildDeliverableHybridTooltip(hybridEntry, serviceTypeNameMap),
        executionContext: getExecutionContext(tasks, actual),
        dueTiming: getDueTiming(deliverable?.dueDate || null),
        varianceHours,
        variancePct: variancePercent(actual, currentPlan),
      };
    });

    const unassignedActualMap = getUnassignedActualByServiceType(job.unassignedTasks || []);
    const unassignedActual = sumHoursMap(unassignedActualMap);
    if (unassignedActual > 0) {
      deliverableRows.push({
        id: 'unassigned',
        name: 'General Job Tasks',
        dueDate: null,
        tasks: job.unassignedTasks || [],
        currentPlanMap: {},
        originalPlanMap: {},
        actualMap: unassignedActualMap,
        currentPlan: 0,
        originalPlan: 0,
        actual: unassignedActual,
        aiHours: 0,
        leverageRatio: null,
        hybridTooltip: '',
        executionContext: getExecutionContext(job.unassignedTasks || [], unassignedActual),
        dueTiming: getDueTiming(null),
        varianceHours: roundHours(unassignedActual),
        variancePct: Infinity,
      });
    }

    const currentPlanByService = {};
    const originalPlanByService = {};
    const actualByService = {};
    deliverableRows.forEach((row) => {
      addHoursToMap(currentPlanByService, row.currentPlanMap);
      addHoursToMap(originalPlanByService, row.originalPlanMap);
      addHoursToMap(actualByService, row.actualMap);
    });

    const serviceTypeIds = [...new Set([
      ...Object.keys(currentPlanByService),
      ...Object.keys(originalPlanByService),
      ...Object.keys(actualByService),
    ])];

    const serviceRows = serviceTypeIds.map((serviceTypeId) => {
      const currentPlan = roundHours(currentPlanByService[serviceTypeId]);
      const originalPlan = roundHours(originalPlanByService[serviceTypeId]);
      const actual = roundHours(actualByService[serviceTypeId]);
      const aiHours = roundHours(hybridByService[serviceTypeId]);
      const combinedOutput = actual + aiHours;
      return {
        id: serviceTypeId,
        name: serviceTypeNameMap.get(String(serviceTypeId)) || `Service ${serviceTypeId}`,
        currentPlan,
        originalPlan,
        actual,
        aiHours,
        hybridSharePct: combinedOutput > 0 ? (aiHours / combinedOutput) * 100 : null,
        hybridTooltip: (hybridNotesByService[serviceTypeId] || []).map((entry) => (
          `${entry.deliverableName}: ${formatHours(entry.hours)}${entry.notes ? ` — ${entry.notes}` : ''}`
        )).join('\n'),
        varianceHours: roundHours(actual - currentPlan),
        variancePct: variancePercent(actual, currentPlan),
      };
    });

    deliverableRows.sort((a, b) => {
      if (b.varianceHours !== a.varianceHours) return b.varianceHours - a.varianceHours;
      if (b.actual !== a.actual) return b.actual - a.actual;
      return String(a.name || '').localeCompare(String(b.name || ''));
    });

    serviceRows.sort((a, b) => {
      if (b.varianceHours !== a.varianceHours) return b.varianceHours - a.varianceHours;
      if (b.actual !== a.actual) return b.actual - a.actual;
      return String(a.name || '').localeCompare(String(b.name || ''));
    });

    const currentPlanHours = roundHours(sumHoursMap(currentPlanByService));
    const originalPlanHours = roundHours(sumHoursMap(originalPlanByService));
    const actualHours = roundHours(sumHoursMap(actualByService));
    const aiHours = roundHours(sumHoursMap(hybridByService));
    const effectiveOutputHours = roundHours(actualHours + aiHours);
    const varianceHours = roundHours(actualHours - currentPlanHours);

    return {
      appliedChangeOrders: getAppliedChangeOrders(job),
      deliverableRows,
      serviceRows,
      originalPlanHours,
      currentPlanHours,
      actualHours,
      aiHours,
      effectiveOutputHours,
      leverageRatio: actualHours > 0 && aiHours > 0 ? (effectiveOutputHours / actualHours) : null,
      leverageInsight: getLeverageInsight(actualHours, aiHours),
      remainingHours: roundHours(currentPlanHours - actualHours),
      varianceHours,
      variancePct: variancePercent(actualHours, currentPlanHours),
      topHybridServiceInsight: getTopHybridServiceInsight(serviceRows),
      hasHybridData: aiHours > 0,
    };
  }, [job, serviceTypeNameMap, hybridDeliveryMap]);

  if (!job) return null;

  const {
    appliedChangeOrders,
    deliverableRows,
    serviceRows,
    originalPlanHours,
    currentPlanHours,
    actualHours,
    aiHours,
    effectiveOutputHours,
    leverageRatio,
    leverageInsight,
    remainingHours,
    varianceHours,
    variancePct,
    topHybridServiceInsight,
    hasHybridData,
  } = metrics;

  const hasAppliedChangeOrders = appliedChangeOrders.length > 0;
  const scopeDeltaHours = roundHours(currentPlanHours - originalPlanHours);
  const remainingTone = remainingHours < 0 ? 'danger' : remainingHours <= (currentPlanHours * 0.15) ? 'warn' : 'ok';
  const remainingValueClass = remainingTone === 'danger'
    ? 'text-rose-600 dark:text-rose-300'
    : remainingTone === 'warn'
      ? 'text-amber-600 dark:text-amber-300'
      : '';
  const deliverableGrid = hasHybridData
    ? 'minmax(220px,1.7fr) 104px 104px 104px 96px 110px 92px minmax(160px,1fr)'
    : 'minmax(220px,1.7fr) 104px 104px 104px 110px 92px minmax(160px,1fr)';
  const serviceGrid = hasHybridData
    ? 'minmax(220px,1.8fr) 120px 120px 96px 120px minmax(170px,1fr)'
    : 'minmax(220px,1.8fr) 120px 120px 120px minmax(170px,1fr)';

  return h('div', { className: 'space-y-6 pb-12' }, [
    h(PerfCard, null, [
      h(PerfSectionTitle, {
        title: 'Performance',
        subtitle: 'Execution vs approved scope',
        rightSlot: h('div', { className: 'text-xs text-slate-500 dark:text-slate-400' }, (
          hasAppliedChangeOrders
            ? `${appliedChangeOrders.length} applied change ${appliedChangeOrders.length === 1 ? 'order' : 'orders'} · ${formatHours(scopeDeltaHours, { signed: true })} scope movement`
            : 'No applied change orders'
        )),
      }),
      h('div', { className: `mt-5 grid gap-4 sm:grid-cols-2 ${hasAppliedChangeOrders ? 'xl:grid-cols-5' : 'xl:grid-cols-4'}` }, (
        hasAppliedChangeOrders
          ? [
            h(SummaryStat, {
              key: 'original',
              label: 'Original Plan',
              value: formatHours(originalPlanHours),
            }),
            h(SummaryStat, {
              key: 'current',
              label: 'Current Plan',
              value: formatHours(currentPlanHours),
              subtext: `${formatHours(scopeDeltaHours, { signed: true })} from change orders`,
            }),
            h(SummaryStat, {
              key: 'actual',
              label: 'Actual',
              value: formatHours(actualHours),
            }),
            h(SummaryStat, {
              key: 'remaining',
              label: 'Remaining',
              value: formatHours(remainingHours),
              subtext: 'Current plan - actual',
              valueClassName: remainingValueClass,
            }),
            h(SummaryStat, {
              key: 'variance',
              label: 'Variance',
              value: formatHours(varianceHours, { signed: true }),
              subtext: formatVariancePercent(variancePct),
              secondary: true,
            }),
          ]
          : [
            h(SummaryStat, {
              key: 'plan',
              label: 'Plan',
              value: formatHours(currentPlanHours),
            }),
            h(SummaryStat, {
              key: 'actual',
              label: 'Actual',
              value: formatHours(actualHours),
            }),
            h(SummaryStat, {
              key: 'remaining',
              label: 'Remaining',
              value: formatHours(remainingHours),
              subtext: 'Plan - actual',
              valueClassName: remainingValueClass,
            }),
            h(SummaryStat, {
              key: 'variance',
              label: 'Variance',
              value: formatHours(varianceHours, { signed: true }),
              subtext: formatVariancePercent(variancePct),
              secondary: true,
            }),
          ]
      )),
      h('div', { className: 'mt-5 rounded-xl border border-slate-200/80 bg-slate-50/70 p-4 dark:border-white/10 dark:bg-slate-900/50' }, [
        h('div', { className: 'mb-3 flex items-center justify-between gap-3' }, [
          h('div', { className: 'text-sm font-semibold text-slate-900 dark:text-white' }, 'Actual vs Current Plan'),
          h('div', { className: 'text-xs font-medium tabular-nums text-slate-500 dark:text-slate-400' }, `Variance ${formatHours(varianceHours, { signed: true })} · ${formatVariancePercent(variancePct)}`),
        ]),
        h(UsageMeter, { actual: actualHours, plan: currentPlanHours, aiHours }),
        hasHybridData
          ? h('div', { className: 'mt-3 space-y-1' }, [
            h('div', { className: 'text-xs tabular-nums text-slate-500 dark:text-slate-400' }, [
              h('span', null, `AI Equivalent ${formatHours(aiHours)}`),
              h('span', null, ' · '),
              h('span', null, `Effective Output ${formatHours(effectiveOutputHours)}`),
              h('span', null, ' · '),
              h('span', null, `Leverage ${formatLeverageRatio(actualHours, aiHours)}`),
            ]),
            leverageInsight
              ? h('div', { className: 'text-[11px] text-slate-500 dark:text-slate-400' }, leverageInsight)
              : null,
          ])
          : null,
      ]),
    ]),

    h(PerfCard, null, [
      h(PerfSectionTitle, {
        title: 'Deliverable Drift',
        subtitle: 'Largest overages first so scope movement and execution drift surface immediately.',
      }),
      hasHybridData && topHybridServiceInsight
        ? h('div', { className: 'mt-3 text-sm text-slate-600 dark:text-slate-300' }, topHybridServiceInsight)
        : null,
      h('div', { className: 'mt-4 overflow-hidden rounded-xl border border-slate-200/80 dark:border-white/10' }, [
        h(DataTableHeader, {
          columns: hasHybridData
            ? ['Deliverable Name', 'Original Plan', 'Current Plan', 'Actual', 'AI (hrs)', 'Variance', 'Variance %', 'LOE Meter']
            : ['Deliverable Name', 'Original Plan', 'Current Plan', 'Actual', 'Variance', 'Variance %', 'LOE Meter'],
          gridTemplateColumns: deliverableGrid,
        }),
        deliverableRows.length
          ? [
            ...deliverableRows.map((row) => {
              const currentDelta = roundHours(row.currentPlan - row.originalPlan);
              return h(DataRow, {
                key: row.id,
                gridTemplateColumns: deliverableGrid,
              }, [
                h('div', { className: 'min-w-0 space-y-1' }, [
                  h('div', { className: 'truncate text-sm font-semibold text-slate-900 dark:text-white' }, row.name),
                  h('div', { className: 'text-xs text-slate-500 dark:text-slate-400' }, row.executionContext),
                  hasAppliedChangeOrders && currentDelta !== 0
                    ? h('div', { className: 'text-xs text-slate-500 dark:text-slate-400' }, `${formatHours(currentDelta, { signed: true })} scope movement`)
                    : null,
                ]),
                h('div', { className: 'text-sm tabular-nums' }, formatHours(row.originalPlan)),
                h('div', { className: 'text-sm tabular-nums' }, formatHours(row.currentPlan)),
                h('div', { className: 'text-sm tabular-nums' }, formatHours(row.actual)),
                ...(hasHybridData ? [
                  h(HybridValueCell, {
                    hours: row.aiHours,
                    tooltip: row.hybridTooltip,
                    secondaryText: getHybridIntensity(row.actual, row.aiHours),
                  }),
                ] : []),
                h('div', { className: 'text-xs tabular-nums text-slate-500 dark:text-slate-400' }, formatHours(row.varianceHours, { signed: true })),
                h('div', { className: 'text-xs tabular-nums text-slate-500 dark:text-slate-400' }, formatVariancePercent(row.variancePct)),
                h(UsageMeter, {
                  actual: row.actual,
                  plan: row.currentPlan,
                  aiHours: row.aiHours,
                  compact: true,
                  footerLabel: row.dueTiming.label,
                  footerTone: row.dueTiming.tone,
                }),
              ]);
            }),
            h(DataRow, {
              key: 'deliverable-total',
              gridTemplateColumns: deliverableGrid,
              footer: true,
            }, [
              h('div', { className: 'space-y-1' }, [
                h('div', { className: 'text-sm text-slate-900 dark:text-white' }, 'Totals'),
                h('div', { className: `text-[11px] ${remainingValueClass || 'text-slate-500 dark:text-slate-400'}` }, `Remaining ${formatHours(remainingHours)}`),
              ]),
              h('div', { className: 'text-sm tabular-nums' }, formatHours(originalPlanHours)),
              h('div', { className: 'text-sm tabular-nums' }, formatHours(currentPlanHours)),
              h('div', { className: 'text-sm tabular-nums' }, formatHours(actualHours)),
              ...(hasHybridData ? [
                h(HybridValueCell, {
                  hours: aiHours,
                  secondaryText: leverageInsight || null,
                }),
              ] : []),
              h('div', { className: 'text-xs tabular-nums text-slate-500 dark:text-slate-400' }, formatHours(varianceHours, { signed: true })),
              h('div', { className: 'text-xs tabular-nums text-slate-500 dark:text-slate-400' }, formatVariancePercent(variancePct)),
              h(UsageMeter, { actual: actualHours, plan: currentPlanHours, aiHours, compact: true }),
            ]),
          ]
          : h('div', { className: 'px-5 py-6 text-sm text-slate-500 dark:text-slate-400' }, 'Add deliverables to compare plan and actuals.'),
      ]),
    ]),

    h(PerfCard, null, [
      h(PerfSectionTitle, {
        title: 'Service Type Breakdown',
        subtitle: 'Rolled up from the current plan and actuals across the job.',
      }),
      h('div', { className: 'mt-4 overflow-hidden rounded-xl border border-slate-200/80 dark:border-white/10' }, [
        h(DataTableHeader, {
          columns: hasHybridData
            ? ['Service Type', 'Planned', 'Actual', 'AI (hrs)', 'Variance', 'Meter']
            : ['Service Type', 'Planned', 'Actual', 'Variance', 'Meter'],
          gridTemplateColumns: serviceGrid,
        }),
        serviceRows.length
          ? [
            ...serviceRows.map((row) => {
              return h(DataRow, {
                key: row.id,
                gridTemplateColumns: serviceGrid,
              }, [
                h('div', { className: 'min-w-0 space-y-1' }, [
                  h('div', { className: 'truncate text-sm font-semibold text-slate-900 dark:text-white' }, row.name),
                  hasAppliedChangeOrders && row.currentPlan !== row.originalPlan
                    ? h('div', { className: 'text-xs text-slate-500 dark:text-slate-400' }, `${formatHours(row.currentPlan - row.originalPlan, { signed: true })} from change orders`)
                    : null,
                ]),
                h('div', { className: 'text-sm tabular-nums' }, formatHours(row.currentPlan)),
                h('div', { className: 'text-sm tabular-nums' }, formatHours(row.actual)),
                ...(hasHybridData ? [
                  h(HybridValueCell, {
                    hours: row.aiHours,
                    tooltip: row.hybridTooltip,
                    secondaryText: row.hybridSharePct !== null && row.hybridSharePct !== undefined && row.aiHours > 0
                      ? `${formatPercent(row.hybridSharePct)} hybrid`
                      : null,
                    secondaryClassName: row.aiHours > 0 ? 'font-medium text-slate-600 dark:text-slate-300' : '',
                  }),
                ] : []),
                h('div', { className: 'text-xs tabular-nums text-slate-500 dark:text-slate-400' }, formatHours(row.varianceHours, { signed: true })),
                h(UsageMeter, { actual: row.actual, plan: row.currentPlan, aiHours: row.aiHours, compact: true }),
              ]);
            }),
            h(DataRow, {
              key: 'service-total',
              gridTemplateColumns: serviceGrid,
              footer: true,
            }, [
              h('div', { className: 'space-y-1' }, [
                h('div', { className: 'text-sm text-slate-900 dark:text-white' }, 'Totals'),
                h('div', { className: `text-[11px] ${remainingValueClass || 'text-slate-500 dark:text-slate-400'}` }, `Remaining ${formatHours(remainingHours)}`),
              ]),
              h('div', { className: 'text-sm tabular-nums' }, formatHours(currentPlanHours)),
              h('div', { className: 'text-sm tabular-nums' }, formatHours(actualHours)),
              ...(hasHybridData ? [
                h(HybridValueCell, {
                  hours: aiHours,
                  secondaryText: (actualHours + aiHours) > 0 && aiHours > 0
                    ? `${formatPercent((aiHours / (actualHours + aiHours)) * 100)} hybrid`
                    : null,
                  secondaryClassName: aiHours > 0 ? 'font-medium text-slate-600 dark:text-slate-300' : '',
                }),
              ] : []),
              h('div', { className: 'text-xs tabular-nums text-slate-500 dark:text-slate-400' }, formatHours(varianceHours, { signed: true })),
              h(UsageMeter, { actual: actualHours, plan: currentPlanHours, aiHours, compact: true }),
            ]),
          ]
          : h('div', { className: 'px-5 py-6 text-sm text-slate-500 dark:text-slate-400' }, 'No service type data yet.'),
      ]),
    ]),
  ]);
}
