import { PerfCard, PerfSectionTitle } from '../../components/performance/primitives.js';
import { loadServiceTypes } from '../../quick-tasks/quick-tasks-store.js';
import { setJobCycleKey } from '../jobs-ui-state.js';
import {
  formatCycleLabel,
  getCurrentCycleKey,
  getTaskCycleKey,
  isDeliverableVisibleInCycle,
  isRecurringTemplateTask,
  shiftCycleKey,
} from '../retainer-cycle-utils.js';
import { getApplicableChangeOrders, getOriginalPlanRowsById } from '../change-order-scope-utils.js';

const { createElement: h, useEffect, useMemo, useState } = React;

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

function getDeliverablePlanPools(job, deliverable, cycleKey = null) {
  if (job?.kind === 'retainer' && cycleKey) {
    if (!isDeliverableVisibleInCycle(deliverable, cycleKey)) return [];
    const cyclePools = deliverable?.poolsByCycle?.[cycleKey];
    if (Array.isArray(cyclePools)) return cyclePools;
    if (Object.keys(deliverable?.poolsByCycle || {}).length || deliverable?.createdCycleKey) return [];
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

function isDateInCycle(dateValue, cycleKey) {
  return !!(dateValue && cycleKey && String(dateValue).startsWith(`${cycleKey}-`));
}

function isTaskInCycle(task, cycleKey, isRetainer = false) {
  if (isRecurringTemplateTask(task)) return false;
  if (!isRetainer || !cycleKey) return true;
  return String(getTaskCycleKey(task, cycleKey) || '') === String(cycleKey);
}

function getTaskActualHours(task, { cycleKey = null, isRetainer = false } = {}) {
  if (!task) return 0;
  if (Array.isArray(task.timeEntries)) {
    return task.timeEntries.reduce((sum, entry) => {
      if (isRetainer && cycleKey && !isDateInCycle(entry?.date, cycleKey)) return sum;
      return sum + (Number(entry?.hours) || 0);
    }, 0);
  }
  if (Number.isFinite(task.actualHours)) {
    return isTaskInCycle(task, cycleKey, isRetainer) ? (Number(task.actualHours) || 0) : 0;
  }
  if (Array.isArray(task.allocations)) {
    if (isRetainer && cycleKey && !isTaskInCycle(task, cycleKey, isRetainer)) return 0;
    return task.allocations.reduce((sum, alloc) => sum + (Number(alloc?.actualHours) || 0), 0);
  }
  return 0;
}

function getTaskActualByServiceType(task, { cycleKey = null, isRetainer = false } = {}) {
  if (isRetainer && cycleKey && !isTaskInCycle(task, cycleKey, isRetainer)) return {};
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

  const taskActual = roundHours(getTaskActualHours(task, { cycleKey, isRetainer }));
  const uniqueServiceTypeIds = [...new Set(
    allocations.map((allocation) => String(allocation?.serviceTypeId || '')).filter(Boolean)
  )];
  if (taskActual > 0 && uniqueServiceTypeIds.length === 1) {
    byServiceType[uniqueServiceTypeIds[0]] = taskActual;
  }
  return byServiceType;
}

function getDeliverableActualByServiceType(job, deliverable, cycleKey = null) {
  const pools = getDeliverablePlanPools(job, deliverable, cycleKey);
  const hasPoolActuals = (pools || []).some((pool) => hasOwn(pool, 'actualHours'));
  if (hasPoolActuals) return getActualHoursMapFromPools(pools);

  const isRetainer = job?.kind === 'retainer';
  return (deliverable?.tasks || []).reduce((acc, task) => {
    addHoursToMap(acc, getTaskActualByServiceType(task, { cycleKey, isRetainer }));
    return acc;
  }, {});
}

function getUnassignedActualByServiceType(tasks = [], { cycleKey = null, isRetainer = false } = {}) {
  return (tasks || []).reduce((acc, task) => {
    addHoursToMap(acc, getTaskActualByServiceType(task, { cycleKey, isRetainer }));
    return acc;
  }, {});
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

function parseDate(value) {
  if (!value) return null;
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatDate(value) {
  const date = parseDate(value);
  if (!date) return value || '-';
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function statusLabel(status) {
  if (status === 'active') return 'Active';
  if (status === 'completed') return 'Completed';
  if (status === 'archived') return 'Archived';
  return 'Pending';
}

function isCycleKey(value) {
  return /^\d{4}-\d{2}$/.test(String(value || ''));
}

function getCycleKeyFromDate(value) {
  return String(value || '').match(/^\d{4}-\d{2}/)?.[0] || null;
}

function getCycleStartDate(cycleKey) {
  return isCycleKey(cycleKey) ? `${cycleKey}-01` : null;
}

function compareCycleKeys(a, b) {
  return String(a || '').localeCompare(String(b || ''));
}

function addCycleKey(target, value) {
  if (isCycleKey(value)) target.add(String(value));
}

function getLatestCycleKey(keys = []) {
  return [...keys].filter(isCycleKey).sort(compareCycleKeys).pop() || null;
}

function getEarliestCycleKey(keys = []) {
  return [...keys].filter(isCycleKey).sort(compareCycleKeys)[0] || null;
}

function deriveFixedTermEndDate(startDate, durationMonths) {
  const start = parseDate(startDate);
  const duration = Math.round(Number(durationMonths) || 0);
  if (!start || duration <= 0) return null;
  const end = new Date(start.getFullYear(), start.getMonth() + duration, 0);
  const year = end.getFullYear();
  const month = `${end.getMonth() + 1}`.padStart(2, '0');
  const day = `${end.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getRetainerEndDate(job) {
  if (!job || job.kind !== 'retainer') return job?.targetEndDate || null;
  if (job.completedAt) return job.completedAt;
  if (job.billingStructure === 'fixed_term') {
    return deriveFixedTermEndDate(job.startDate, job.billingDurationMonths);
  }
  return null;
}

function getRetainerStartDate(job, cycleKeys = []) {
  return job?.startDate || job?.timeline?.startDate || getCycleStartDate(cycleKeys[0]) || getCycleStartDate(job?.currentCycleKey) || null;
}

function collectRetainerCycleKeys(job) {
  const keys = new Set();
  addCycleKey(keys, getCycleKeyFromDate(job?.startDate));
  addCycleKey(keys, getCycleKeyFromDate(job?.completedAt));
  addCycleKey(keys, job?.currentCycleKey);

  const collectTask = (task) => {
    addCycleKey(keys, task?.cycleKey);
    addCycleKey(keys, getCycleKeyFromDate(task?.dueDate));
    addCycleKey(keys, getCycleKeyFromDate(task?.completedAt));
    (task?.timeEntries || []).forEach((entry) => addCycleKey(keys, getCycleKeyFromDate(entry?.date)));
  };

  (job?.deliverables || []).forEach((deliverable) => {
    addCycleKey(keys, deliverable?.createdCycleKey);
    addCycleKey(keys, getCycleKeyFromDate(deliverable?.dueDate));
    Object.keys(deliverable?.poolsByCycle || {}).forEach((key) => addCycleKey(keys, key));
    (deliverable?.tasks || []).forEach(collectTask);
  });
  (job?.unassignedTasks || []).forEach(collectTask);
  (job?.changeOrders || []).forEach((changeOrder) => {
    addCycleKey(keys, changeOrder?.effectiveStartMonth);
    addCycleKey(keys, changeOrder?.effectiveMonth);
    addCycleKey(keys, changeOrder?.cycleKey);
    addCycleKey(keys, getCycleKeyFromDate(changeOrder?.effectiveDate));
  });
  Object.keys(job?.originalPlanSnapshot?.byMonth || {}).forEach((key) => addCycleKey(keys, key));
  Object.keys(job?.currentPlanSnapshot?.byMonth || {}).forEach((key) => addCycleKey(keys, key));

  return [...keys].sort(compareCycleKeys);
}

function buildCycleRange(startCycle, endCycle) {
  if (!isCycleKey(startCycle) || !isCycleKey(endCycle) || compareCycleKeys(startCycle, endCycle) > 0) return [];
  const keys = [];
  let cursor = startCycle;
  while (compareCycleKeys(cursor, endCycle) <= 0) {
    keys.push(cursor);
    cursor = shiftCycleKey(cursor, 1);
    if (keys.length > 120) break;
  }
  return keys;
}

function getRetainerCycleBounds(job) {
  const availableKeys = collectRetainerCycleKeys(job);
  const startDate = getRetainerStartDate(job, availableKeys);
  const startCycle = getCycleKeyFromDate(startDate) || getEarliestCycleKey(availableKeys) || job?.currentCycleKey || getCurrentCycleKey();
  const availableLatest = getLatestCycleKey(availableKeys) || startCycle;
  const endDate = getRetainerEndDate(job);
  const fixedOrClosedEnd = getCycleKeyFromDate(endDate);
  const endCycle = fixedOrClosedEnd || availableLatest || startCycle;
  return {
    startCycle,
    endCycle: compareCycleKeys(endCycle, startCycle) < 0 ? startCycle : endCycle,
    availableLatest,
    endDate,
  };
}

function getRetainerCycleKeys(job) {
  const bounds = getRetainerCycleBounds(job);
  return buildCycleRange(bounds.startCycle, bounds.endCycle);
}

function getDefaultRetainerCycleKey(job, cycleKeys = getRetainerCycleKeys(job)) {
  if (!cycleKeys.length) return null;
  const finalCycle = cycleKeys[cycleKeys.length - 1];
  if (job?.status === 'active') {
    if (cycleKeys.includes(job?.currentCycleKey)) return job.currentCycleKey;
    return finalCycle;
  }
  return finalCycle;
}

function getInitialRetainerSelectedMonth(job, cycleKeys = []) {
  return clampCycleKey(getDefaultRetainerCycleKey(job, cycleKeys), cycleKeys);
}

function clampCycleKey(cycleKey, cycleKeys = []) {
  if (!cycleKeys.length) return null;
  if (cycleKeys.includes(cycleKey)) return cycleKey;
  if (cycleKey && compareCycleKeys(cycleKey, cycleKeys[0]) < 0) return cycleKeys[0];
  if (cycleKey && compareCycleKeys(cycleKey, cycleKeys[cycleKeys.length - 1]) > 0) return cycleKeys[cycleKeys.length - 1];
  return cycleKeys[cycleKeys.length - 1];
}

function getAppliedChangeOrdersForPerformance(job, { activeCycleKey = null, isRetainer = false } = {}) {
  const applied = getApplicableChangeOrders(job, { cycleKey: activeCycleKey, status: 'applied' });
  if (!isRetainer) return applied;
  return applied.filter((changeOrder) => String(
    changeOrder?.effectiveStartMonth || changeOrder?.effectiveMonth || changeOrder?.cycleKey || ''
  ) === String(activeCycleKey || ''));
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

function buildPerformanceMetrics({
  job,
  serviceTypes,
  serviceTypeNameMap,
  hybridDeliveryMap,
  activeCycleKey = null,
  isRetainer = false,
}) {
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
      hasMonthActivity: false,
    };
  }

  const originalDeliverablesById = getOriginalPlanRowsById(job, serviceTypes, { cycleKey: activeCycleKey });
  const hybridByService = {};
  const hybridNotesByService = {};
  const deliverableRows = (job.deliverables || [])
    .filter((deliverable) => !isRetainer || isDeliverableVisibleInCycle(deliverable, activeCycleKey))
    .map((deliverable) => {
      const tasks = (Array.isArray(deliverable?.tasks) ? deliverable.tasks : []).filter((task) => (
        isTaskInCycle(task, activeCycleKey, isRetainer)
      ));
      const currentPlanMap = getEstimatedHoursMapFromPools(getDeliverablePlanPools(job, deliverable, activeCycleKey));
      const originalPlanMap = originalDeliverablesById.get(String(deliverable.id))?.pools || {};
      const actualMap = getDeliverableActualByServiceType(job, deliverable, activeCycleKey);
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

  const unassignedTasksForCycle = (job.unassignedTasks || []).filter((task) => (
    isTaskInCycle(task, activeCycleKey, isRetainer)
  ));
  const unassignedActualMap = getUnassignedActualByServiceType(unassignedTasksForCycle, { cycleKey: activeCycleKey, isRetainer });
  const unassignedActual = sumHoursMap(unassignedActualMap);
  if (unassignedActual > 0 || unassignedTasksForCycle.length) {
    deliverableRows.push({
      id: 'unassigned',
      name: 'General Job Tasks',
      dueDate: null,
      tasks: unassignedTasksForCycle,
      currentPlanMap: {},
      originalPlanMap: {},
      actualMap: unassignedActualMap,
      currentPlan: 0,
      originalPlan: 0,
      actual: unassignedActual,
      aiHours: 0,
      leverageRatio: null,
      hybridTooltip: '',
      executionContext: getExecutionContext(unassignedTasksForCycle, unassignedActual),
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
  const hasMonthActivity = deliverableRows.some((row) => row.actual > 0);

  return {
    appliedChangeOrders: getAppliedChangeOrdersForPerformance(job, { activeCycleKey, isRetainer }),
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
    hasMonthActivity,
  };
}

function CompactSummaryStat({ label, value, subtext }) {
  return h('div', { className: 'rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 dark:border-white/10 dark:bg-white/5' }, [
    h('div', { className: 'text-[10px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400' }, label),
    h('div', { className: 'mt-1 text-base font-semibold leading-tight tabular-nums text-slate-900 dark:text-white' }, value),
    subtext ? h('div', { className: 'mt-0.5 text-[11px] leading-snug text-slate-500 dark:text-slate-400' }, subtext) : null,
  ]);
}

function buildRetainerSummary(job, cycleMetrics = [], cycleKeys = []) {
  const cycleCount = cycleKeys.length;
  const totalPlan = cycleMetrics.reduce((sum, item) => sum + (Number(item.currentPlanHours) || 0), 0);
  const totalActual = cycleMetrics.reduce((sum, item) => sum + (Number(item.actualHours) || 0), 0);
  const remainingTotal = cycleMetrics.reduce((sum, item) => sum + (Number(item.remainingHours) || 0), 0);
  const totalChangeOrders = cycleMetrics.reduce((sum, item) => sum + (item.appliedChangeOrders || []).length, 0);
  const monthsOverPlan = cycleMetrics.filter((item) => (Number(item.varianceHours) || 0) > 0).length;
  const monthsWithUnusedCapacity = cycleMetrics.filter((item) => (Number(item.remainingHours) || 0) > 0).length;
  const serviceTotals = {};
  const plannedServiceTotals = {};
  cycleMetrics.forEach((item) => {
    (item.serviceRows || []).forEach((row) => {
      const key = row.name || 'Service Type';
      serviceTotals[key] = roundHours((serviceTotals[key] || 0) + (Number(row.actual) || 0));
      plannedServiceTotals[key] = roundHours((plannedServiceTotals[key] || 0) + (Number(row.currentPlan) || 0));
    });
  });
  const serviceSource = Object.values(serviceTotals).some((value) => Number(value) > 0)
    ? serviceTotals
    : plannedServiceTotals;
  const topService = Object.keys(serviceSource).sort((a, b) => {
    if (serviceSource[b] !== serviceSource[a]) return serviceSource[b] - serviceSource[a];
    return a.localeCompare(b);
  })[0];
  const endDate = getRetainerEndDate(job);
  const startDate = getRetainerStartDate(job, cycleKeys);

  return {
    cycleCount,
    dateRange: `${formatDate(startDate)} → ${endDate ? formatDate(endDate) : '-'}`,
    status: statusLabel(job?.status),
    averageCapacityUsed: totalPlan > 0 ? (totalActual / totalPlan) * 100 : 0,
    averageRemaining: cycleCount ? remainingTotal / cycleCount : 0,
    totalHoursUsed: totalActual,
    monthsOverPlan,
    monthsWithUnusedCapacity,
    totalChangeOrders,
    mostUsedService: topService || '-',
    mostUsedServiceHours: topService ? serviceSource[topService] : 0,
  };
}

function RetainerSummaryCards({ job, cycleMetrics, cycleKeys }) {
  const summary = buildRetainerSummary(job, cycleMetrics, cycleKeys);
  return h(PerfCard, null, [
    h(PerfSectionTitle, {
      title: 'Retainer Summary',
      subtitle: 'Overall hour pattern across this Retainer.',
    }),
    h('div', { className: 'mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-5' }, [
      h(CompactSummaryStat, { label: 'Retainer Dates', value: summary.dateRange }),
      h(CompactSummaryStat, { label: 'Retainer Status', value: summary.status }),
      h(CompactSummaryStat, { label: 'Cycles', value: String(summary.cycleCount), subtext: 'Monthly cycles' }),
      h(CompactSummaryStat, { label: 'Average Capacity Used', value: formatPercent(summary.averageCapacityUsed), subtext: 'Across cycles' }),
      h(CompactSummaryStat, { label: 'Average Remaining', value: formatHours(summary.averageRemaining), subtext: 'Monthly capacity' }),
      h(CompactSummaryStat, { label: 'Total Hours Used', value: formatHours(summary.totalHoursUsed) }),
      h(CompactSummaryStat, { label: 'Months Over Plan', value: String(summary.monthsOverPlan) }),
      h(CompactSummaryStat, { label: 'Months With Unused Capacity', value: String(summary.monthsWithUnusedCapacity) }),
      h(CompactSummaryStat, { label: 'Change Orders', value: String(summary.totalChangeOrders), subtext: 'During Retainer' }),
      h(CompactSummaryStat, {
        label: 'Most Used Service Type',
        value: summary.mostUsedService,
        subtext: formatHours(summary.mostUsedServiceHours),
      }),
    ]),
  ]);
}

function BoundedRetainerMonthSelector({ cycleKeys, selectedCycleKey, onSelect }) {
  if (!cycleKeys.length) return null;
  const selectedIndex = Math.max(0, cycleKeys.indexOf(selectedCycleKey));
  const first = selectedIndex <= 0;
  const last = selectedIndex >= cycleKeys.length - 1;
  const baseButton = 'h-9 w-9 rounded-full border text-sm font-semibold transition';
  const activeButton = 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50 dark:border-white/10 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-white/10';
  const disabledButton = 'cursor-not-allowed border-slate-200 bg-slate-100 text-slate-300 dark:border-white/5 dark:bg-white/5 dark:text-white/25';
  const changeTo = (index) => {
    const nextKey = cycleKeys[index];
    if (nextKey) onSelect(nextKey);
  };

  return h(PerfCard, null, [
    h('div', { className: 'flex flex-wrap items-center justify-between gap-3' }, [
      h('div', { className: 'space-y-1' }, [
        h('div', { className: 'text-sm font-semibold text-slate-900 dark:text-white' }, 'Month Selector'),
        h('div', { className: 'text-xs text-slate-500 dark:text-slate-400' }, 'Move through monthly Retainer cycles.'),
      ]),
      h('div', { className: 'inline-flex items-center gap-3 rounded-full border border-slate-200 bg-slate-50 px-2 py-1 dark:border-white/10 dark:bg-white/5' }, [
        h('button', {
          type: 'button',
          disabled: first,
          className: `${baseButton} ${first ? disabledButton : activeButton}`,
          onClick: () => !first && changeTo(selectedIndex - 1),
          'aria-label': 'Previous month',
        }, '<'),
        h('div', { className: 'min-w-[132px] text-center text-sm font-semibold text-slate-900 dark:text-white' }, formatCycleLabel(selectedCycleKey)),
        h('button', {
          type: 'button',
          disabled: last,
          className: `${baseButton} ${last ? disabledButton : activeButton}`,
          onClick: () => !last && changeTo(selectedIndex + 1),
          'aria-label': 'Next month',
        }, '>'),
      ]),
    ]),
  ]);
}

function ProjectPerformanceView({ job, metrics }) {
  const {
    appliedChangeOrders,
    deliverableRows,
    serviceRows,
    originalPlanHours,
    currentPlanHours,
    actualHours,
    aiHours,
    effectiveOutputHours,
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
  const summaryStats = [
    h(SummaryStat, { key: 'original', label: 'Original Plan', value: formatHours(originalPlanHours) }),
    h(SummaryStat, {
      key: 'current',
      label: 'Current Plan',
      value: formatHours(currentPlanHours),
      subtext: scopeDeltaHours ? `${formatHours(scopeDeltaHours, { signed: true })} from change orders` : null,
    }),
    h(SummaryStat, { key: 'actual', label: 'Actual Hours', value: formatHours(actualHours) }),
    job?.status === 'active'
      ? h(SummaryStat, {
        key: 'remaining',
        label: 'Remaining Hours',
        value: formatHours(remainingHours),
        subtext: 'Current Plan - Actual Hours',
        valueClassName: remainingValueClass,
      })
      : null,
    h(SummaryStat, {
      key: 'variance',
      label: 'Variance',
      value: formatHours(varianceHours, { signed: true }),
      subtext: formatVariancePercent(variancePct),
      secondary: true,
    }),
    h(SummaryStat, { key: 'change-orders', label: 'Change Orders', value: String(appliedChangeOrders.length) }),
  ].filter(Boolean);

  return h('div', { className: 'space-y-6 pb-12' }, [
    h(PerfCard, null, [
      h(PerfSectionTitle, {
        title: 'Project Performance',
        subtitle: 'Execution vs approved scope',
        rightSlot: h('div', { className: 'text-xs text-slate-500 dark:text-slate-400' }, (
          hasAppliedChangeOrders
            ? `${appliedChangeOrders.length} applied change ${appliedChangeOrders.length === 1 ? 'order' : 'orders'} · ${formatHours(scopeDeltaHours, { signed: true })} scope movement`
            : 'No applied change orders'
        )),
      }),
      h('div', { className: 'mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-6' }, summaryStats),
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
        title: 'Deliverable Breakdown',
        subtitle: 'Plan and actual hours by deliverable.',
      }),
      hasHybridData && topHybridServiceInsight
        ? h('div', { className: 'mt-3 text-sm text-slate-600 dark:text-slate-300' }, topHybridServiceInsight)
        : null,
      h('div', { className: 'mt-4 overflow-hidden rounded-xl border border-slate-200/80 dark:border-white/10' }, [
        h(DataTableHeader, {
          columns: hasHybridData
            ? ['Deliverable', 'Original Plan', 'Current Plan', 'Actual Hours', 'AI Hours', 'Variance', 'Variance %', 'Meter']
            : ['Deliverable', 'Original Plan', 'Current Plan', 'Actual Hours', 'Variance', 'Variance %', 'Meter'],
          gridTemplateColumns: deliverableGrid,
        }),
        deliverableRows.length
          ? [
            ...deliverableRows.map((row) => {
              const currentDelta = roundHours(row.currentPlan - row.originalPlan);
              return h(DataRow, { key: row.id, gridTemplateColumns: deliverableGrid }, [
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
            h(DataRow, { key: 'deliverable-total', gridTemplateColumns: deliverableGrid, footer: true }, [
              h('div', { className: 'space-y-1' }, [
                h('div', { className: 'text-sm text-slate-900 dark:text-white' }, 'Totals'),
                h('div', { className: `text-[11px] ${remainingValueClass || 'text-slate-500 dark:text-slate-400'}` }, `Remaining ${formatHours(remainingHours)}`),
              ]),
              h('div', { className: 'text-sm tabular-nums' }, formatHours(originalPlanHours)),
              h('div', { className: 'text-sm tabular-nums' }, formatHours(currentPlanHours)),
              h('div', { className: 'text-sm tabular-nums' }, formatHours(actualHours)),
              ...(hasHybridData ? [h(HybridValueCell, { hours: aiHours, secondaryText: leverageInsight || null })] : []),
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
            ? ['Service Type', 'Current Plan', 'Actual Hours', 'AI Hours', 'Variance', 'Meter']
            : ['Service Type', 'Current Plan', 'Actual Hours', 'Variance', 'Meter'],
          gridTemplateColumns: serviceGrid,
        }),
        serviceRows.length
          ? [
            ...serviceRows.map((row) => h(DataRow, { key: row.id, gridTemplateColumns: serviceGrid }, [
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
            ])),
            h(DataRow, { key: 'service-total', gridTemplateColumns: serviceGrid, footer: true }, [
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

function RetainerPerformanceView({ job, metrics, cycleKeys, selectedCycleKey, onSelectMonth, cycleMetrics }) {
  const {
    appliedChangeOrders,
    deliverableRows,
    serviceRows,
    currentPlanHours,
    actualHours,
    remainingHours,
    varianceHours,
    variancePct,
    hasMonthActivity,
  } = metrics;
  const deliverableGrid = 'minmax(220px,2fr) 120px 120px 120px 120px';
  const serviceGrid = 'minmax(220px,2fr) 120px 120px 120px';

  return h('div', { className: 'space-y-6 pb-12' }, [
    h(RetainerSummaryCards, { job, cycleMetrics, cycleKeys }),
    h(BoundedRetainerMonthSelector, {
      cycleKeys,
      selectedCycleKey,
      onSelect: onSelectMonth,
    }),
    h(PerfCard, null, [
      h(PerfSectionTitle, {
        title: `${formatCycleLabel(selectedCycleKey)} Detail`,
        subtitle: 'Monthly plan, actuals, remaining capacity, and scope movement.',
        rightSlot: h('div', { className: 'text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400' }, 'Selected Month'),
      }),
      h('div', { className: 'mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-6' }, [
        h(SummaryStat, { label: 'Monthly Plan', value: formatHours(currentPlanHours) }),
        h(SummaryStat, { label: 'Actual Hours', value: formatHours(actualHours) }),
        h(SummaryStat, { label: 'Remaining Capacity', value: formatHours(remainingHours) }),
        h(SummaryStat, { label: 'Capacity Used', value: formatPercent(currentPlanHours > 0 ? (actualHours / currentPlanHours) * 100 : 0) }),
        h(SummaryStat, { label: 'Variance', value: formatHours(varianceHours, { signed: true }), subtext: formatVariancePercent(variancePct), secondary: true }),
        h(SummaryStat, { label: 'Change Orders This Month', value: String(appliedChangeOrders.length) }),
      ]),
      h('div', { className: 'mt-5 rounded-xl border border-slate-200/80 bg-slate-50/70 p-4 dark:border-white/10 dark:bg-slate-900/50' }, [
        h('div', { className: 'mb-3 flex items-center justify-between gap-3' }, [
          h('div', { className: 'text-sm font-semibold text-slate-900 dark:text-white' }, 'Actual vs Current Plan'),
          h('div', { className: 'text-xs font-medium tabular-nums text-slate-500 dark:text-slate-400' }, `Variance ${formatHours(varianceHours, { signed: true })} · ${formatVariancePercent(variancePct)}`),
        ]),
        h(UsageMeter, { actual: actualHours, plan: currentPlanHours }),
        !hasMonthActivity
          ? h('div', { className: 'mt-3 text-[11px] text-slate-500 dark:text-slate-400' }, 'No activity this month')
          : null,
      ]),
    ]),
    h(PerfCard, null, [
      h(PerfSectionTitle, {
        title: 'Monthly Deliverable Breakdown',
        subtitle: 'One-off work appears only in the month or months where it was active.',
      }),
      h('div', { className: 'mt-4 overflow-hidden rounded-xl border border-slate-200/80 dark:border-white/10' }, [
        h(DataTableHeader, {
          columns: ['Deliverable', 'Monthly Plan', 'Actual Hours', 'Remaining', 'Variance'],
          gridTemplateColumns: deliverableGrid,
        }),
        deliverableRows.length
          ? [
            ...deliverableRows.map((row) => h(DataRow, { key: row.id, gridTemplateColumns: deliverableGrid }, [
              h('div', { className: 'min-w-0' }, h('div', { className: 'truncate text-sm font-semibold text-slate-900 dark:text-white' }, row.name)),
              h('div', { className: 'text-sm tabular-nums' }, formatHours(row.currentPlan)),
              h('div', { className: 'text-sm tabular-nums' }, formatHours(row.actual)),
              h('div', { className: 'text-sm tabular-nums' }, formatHours(row.currentPlan - row.actual)),
              h('div', { className: 'text-sm tabular-nums text-slate-500 dark:text-slate-400' }, formatHours(row.varianceHours, { signed: true })),
            ])),
            h(DataRow, { key: 'deliverable-total', gridTemplateColumns: deliverableGrid, footer: true }, [
              h('div', { className: 'text-sm text-slate-900 dark:text-white' }, 'Totals'),
              h('div', { className: 'text-sm tabular-nums' }, formatHours(currentPlanHours)),
              h('div', { className: 'text-sm tabular-nums' }, formatHours(actualHours)),
              h('div', { className: 'text-sm tabular-nums' }, formatHours(remainingHours)),
              h('div', { className: 'text-sm tabular-nums text-slate-500 dark:text-slate-400' }, formatHours(varianceHours, { signed: true })),
            ]),
          ]
          : h('div', { className: 'px-5 py-6 text-sm text-slate-500 dark:text-slate-400' }, 'No deliverable activity for this month.'),
      ]),
    ]),
    h(PerfCard, null, [
      h(PerfSectionTitle, {
        title: 'Monthly Service Type Breakdown',
        subtitle: 'Hours grouped by service type for this cycle.',
      }),
      h('div', { className: 'mt-4 overflow-hidden rounded-xl border border-slate-200/80 dark:border-white/10' }, [
        h(DataTableHeader, {
          columns: ['Service Type', 'Monthly Plan', 'Actual Hours', 'Variance'],
          gridTemplateColumns: serviceGrid,
        }),
        serviceRows.length
          ? [
            ...serviceRows.map((row) => h(DataRow, { key: row.id, gridTemplateColumns: serviceGrid }, [
              h('div', { className: 'min-w-0' }, h('div', { className: 'truncate text-sm font-semibold text-slate-900 dark:text-white' }, row.name)),
              h('div', { className: 'text-sm tabular-nums' }, formatHours(row.currentPlan)),
              h('div', { className: 'text-sm tabular-nums' }, formatHours(row.actual)),
              h('div', { className: 'text-sm tabular-nums text-slate-500 dark:text-slate-400' }, formatHours(row.varianceHours, { signed: true })),
            ])),
            h(DataRow, { key: 'service-total', gridTemplateColumns: serviceGrid, footer: true }, [
              h('div', { className: 'text-sm text-slate-900 dark:text-white' }, 'Totals'),
              h('div', { className: 'text-sm tabular-nums' }, formatHours(currentPlanHours)),
              h('div', { className: 'text-sm tabular-nums' }, formatHours(actualHours)),
              h('div', { className: 'text-sm tabular-nums text-slate-500 dark:text-slate-400' }, formatHours(varianceHours, { signed: true })),
            ]),
          ]
          : h('div', { className: 'px-5 py-6 text-sm text-slate-500 dark:text-slate-400' }, 'No service type data for this month.'),
      ]),
    ]),
  ]);
}

export function JobPerformanceTab({ job }) {
  const serviceTypes = useMemo(() => loadServiceTypes().filter((type) => type.active), []);
  const isRetainer = job?.kind === 'retainer';
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

  const cycleKeys = useMemo(() => (
    isRetainer ? getRetainerCycleKeys(job) : []
  ), [isRetainer, job]);
  const defaultRetainerCycleKey = useMemo(() => (
    isRetainer ? getDefaultRetainerCycleKey(job, cycleKeys) : null
  ), [isRetainer, job, cycleKeys]);
  const [selectedMonth, setSelectedMonth] = useState(null);
  const hybridDeliveryMap = useMemo(() => loadHybridDeliveryMap(job?.id), [job?.id]);

  useEffect(() => {
    setSelectedMonth(null);
  }, [isRetainer, defaultRetainerCycleKey, job?.id]);

  const activeCycleKey = isRetainer
    ? clampCycleKey(selectedMonth || getInitialRetainerSelectedMonth(job, cycleKeys), cycleKeys)
    : null;

  const metrics = useMemo(() => buildPerformanceMetrics({
    job,
    serviceTypes,
    serviceTypeNameMap,
    hybridDeliveryMap,
    activeCycleKey,
    isRetainer,
  }), [job, serviceTypes, serviceTypeNameMap, hybridDeliveryMap, activeCycleKey, isRetainer]);

  const cycleMetrics = useMemo(() => {
    if (!isRetainer) return [];
    return cycleKeys.map((cycleKey) => buildPerformanceMetrics({
      job,
      serviceTypes,
      serviceTypeNameMap,
      hybridDeliveryMap,
      activeCycleKey: cycleKey,
      isRetainer: true,
    }));
  }, [isRetainer, cycleKeys, job, serviceTypes, serviceTypeNameMap, hybridDeliveryMap]);

  if (!job) return null;

  if (isRetainer) {
    return h(RetainerPerformanceView, {
      job,
      metrics,
      cycleKeys,
      selectedCycleKey: activeCycleKey,
      cycleMetrics,
      onSelectMonth: (nextKey) => {
        const clampedKey = clampCycleKey(nextKey, cycleKeys);
        setSelectedMonth(clampedKey);
        if (job?.id && clampedKey) setJobCycleKey(job.id, clampedKey);
      },
    });
  }

  return h(ProjectPerformanceView, { job, metrics });
}
