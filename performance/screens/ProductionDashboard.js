import { navigate } from '../../router.js';
import { getContactsData, getIndividualsData } from '../../contacts/contacts-data.js';
import { loadTeamMembers } from '../../quick-tasks/quick-tasks-store.js';
import { loadJobs } from '../../jobs/jobs-store.js';
import {
  formatCycleLabel,
  getCurrentCycleKey,
  getPoolsForCycle,
  getTaskCycleKey,
  isDeliverableVisibleInCycle,
  isRecurringTemplateTask,
} from '../../jobs/retainer-cycle-utils.js';
import {
  ActionModal,
  KPIBox,
  PerfCard,
  PerfSectionTitle,
  ReviewedBadge,
} from '../../components/performance/primitives.js';
import {
  completeDeliverable,
  createChangeOrder,
  getEffectiveState,
  markReviewed,
  reassignTasks,
  updateDueDate,
} from '../testdata/performance-state.js';

const { createElement: h, useEffect, useMemo, useRef, useState } = React;
const { createPortal } = ReactDOM;

const VIEW_OPTIONS = [
  { key: 'all', label: 'All' },
  { key: 'project', label: 'Projects' },
  { key: 'retainer', label: 'Retainers' },
];

const LAYOUT_OPTIONS = [
  { key: 'card', label: 'Card' },
  { key: 'list', label: 'List' },
];

const ACTIONS = [
  { key: 'review', label: 'Mark as reviewed' },
  { key: 'complete', label: 'Complete deliverable' },
  { key: 'due-date', label: 'Change due date' },
  { key: 'reassign', label: 'Reassign tasks' },
  { key: 'change-order', label: 'Create change order' },
];

const CLEANUP_REASONS = ['Missing hour estimate', 'No owner'];
const LAYOUT_STORAGE_KEY = 'netnet.production.layoutView';
const WORK_PANEL_SURFACE = 'bg-slate-50/80 dark:bg-slate-950/35 dark:border-white/10';
const WORK_ITEM_SURFACE = [
  'border-slate-300/80 bg-white shadow-sm shadow-slate-200/70',
  'transition duration-150 hover:-translate-y-0.5 hover:border-slate-400 hover:shadow-md',
  'dark:border-slate-600/70 dark:bg-slate-900/95 dark:shadow-black/20 dark:hover:border-slate-500 dark:hover:bg-slate-800/95',
].join(' ');

function normalizeLayoutView(value) {
  return value === 'list' || value === 'card' ? value : 'card';
}

function readLayoutView() {
  try {
    return normalizeLayoutView(window?.localStorage?.getItem(LAYOUT_STORAGE_KEY));
  } catch (error) {
    return 'card';
  }
}

function writeLayoutView(value) {
  try {
    window?.localStorage?.setItem(LAYOUT_STORAGE_KEY, normalizeLayoutView(value));
  } catch (error) {
    // Ignore storage failures. The toggle still works for the current render.
  }
}

function formatDate(iso) {
  if (!iso) return '-';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatHours(value) {
  const hours = Math.max(0, Number(value) || 0);
  return `${hours.toFixed(hours % 1 ? 1 : 0)} hrs`;
}

function plural(count, singular, pluralLabel = `${singular}s`) {
  return `${count} ${count === 1 ? singular : pluralLabel}`;
}

function sumHours(items = [], field = 'estimatedHours') {
  return (items || []).reduce((sum, item) => sum + (Number(item?.[field]) || 0), 0);
}

function sameServiceMix(a = [], b = []) {
  const normalize = (pools) => (pools || [])
    .map((pool) => `${pool.serviceTypeId}:${Number(pool.estimatedHours) || 0}`)
    .sort()
    .join('|');
  return normalize(a) === normalize(b);
}

function buildContactMaps() {
  const companies = getContactsData();
  const people = getIndividualsData();
  const companyMap = new Map();
  const peopleMap = new Map();
  (companies || []).forEach((company) => {
    if (company?.id) companyMap.set(String(company.id), company.name || `Company ${company.id}`);
  });
  (people || []).forEach((person) => {
    if (person?.id) peopleMap.set(String(person.id), person.name || `Person ${person.id}`);
  });
  return { companyMap, peopleMap };
}

function getJobCompany(job, contactMaps) {
  if (job?.isInternal) return 'Internal';
  if (job?.client) return job.client;
  if (job?.companyId) return contactMaps.companyMap.get(String(job.companyId)) || 'Client';
  if (job?.personId) return contactMaps.peopleMap.get(String(job.personId)) || 'Client';
  return 'Client';
}

function getReasonTone(reason) {
  if (reason === 'Late' || reason === 'No owner') return 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-500/10 dark:text-rose-200 dark:border-rose-300/20';
  if (reason === 'Used more hours than planned') return 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-500/10 dark:text-amber-200 dark:border-amber-300/20';
  return 'bg-slate-50 text-slate-700 border-slate-200 dark:bg-white/5 dark:text-slate-200 dark:border-white/10';
}

function ReasonChips({ reasons }) {
  return h('div', { className: 'flex flex-wrap gap-1.5' }, (reasons || []).map((reason) =>
    h('span', {
      key: reason,
      className: `inline-flex rounded-full border px-2 py-0.5 text-xs font-semibold ${getReasonTone(reason)}`,
    }, reason)
  ));
}

function getPriorityLabel(row) {
  const reasons = row?.reasons || [];
  const hasDecisionReason = reasons.some((reason) => (
    reason === 'Late' ||
    reason === 'Used more hours than planned' ||
    reason === 'Work changed'
  ));
  const hasCleanupReason = reasons.some((reason) => CLEANUP_REASONS.includes(reason)) || row?.missingDate;
  const dueSoonWithAnotherIssue = reasons.includes('Due soon') && reasons.length > 1;
  const retainerCapacityNeedsDecision = row?.source === 'retainer' && Number(row?.capacityPct) >= 85;

  if (hasDecisionReason || dueSoonWithAnotherIssue || retainerCapacityNeedsDecision) return 'Needs decision';
  if (hasCleanupReason) return 'Cleanup needed';
  return 'Watch';
}

function getPriorityTone(priority) {
  if (priority === 'Needs decision') return 'bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-400/15 dark:text-amber-100 dark:border-amber-300/25';
  if (priority === 'Cleanup needed') return 'bg-slate-100 text-slate-800 border-slate-200 dark:bg-white/10 dark:text-slate-100 dark:border-white/15';
  return 'bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-400/10 dark:text-emerald-100 dark:border-emerald-300/20';
}

function PriorityPill({ priority }) {
  return h('span', {
    className: `inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${getPriorityTone(priority)}`,
  }, priority);
}

function buildProjectReasonSentence(row) {
  const reasons = row?.reasons || [];
  if (reasons.includes('Late')) return 'This is past due and still open.';
  if (reasons.includes('Due soon') && reasons.includes('Used more hours than planned')) {
    return 'This is due soon and has already used more hours than planned.';
  }
  if (reasons.includes('Due soon') && reasons.includes('Work changed')) {
    return 'This is due soon and the work changed recently.';
  }
  if (reasons.includes('Due soon') && reasons.includes('Missing hour estimate')) {
    return 'This is due soon, but one task is missing an hour estimate.';
  }
  if (reasons.includes('Due soon') && reasons.includes('No owner')) return 'This is due soon, but no owner is assigned.';
  if (reasons.includes('Used more hours than planned')) return 'This has already used more hours than planned.';
  if (reasons.includes('Work changed')) return 'This work changed recently and may need a quick review.';
  if (reasons.includes('No owner')) return 'No owner is assigned for this work.';
  if (reasons.includes('Missing hour estimate')) return 'One task is missing an hour estimate.';
  if (row?.missingDate) return 'This work is missing a due date.';
  if (reasons.includes('Due soon')) return 'This is due soon.';
  if (reasons.includes('Needs a quick check')) return 'This work should get a quick check.';
  return 'This work needs attention.';
}

function buildRetainerReasonSentence(row) {
  const reasons = row?.reasons || [];
  if (reasons.includes('No owner')) return 'No owner is assigned for this cycle.';
  if (reasons.includes('Used more hours than planned')) return 'This cycle is using hours faster than expected.';
  if (Number(row?.capacityPct) >= 85) return 'This Retainer cycle has very little capacity remaining.';
  if (row?.hasOneOffWork) return 'This cycle has one-off work that changed the plan.';
  if (reasons.includes('Work changed')) return 'This Retainer cycle changed and may need a quick review.';
  if (reasons.includes('Missing hour estimate')) return 'This cycle is missing an hour estimate.';
  if (row?.missingDate) return 'This Retainer work is missing cycle data.';
  if (reasons.includes('Needs a quick check')) return 'This Retainer work should be checked this cycle.';
  return 'This Retainer work needs attention this cycle.';
}

function decorateRow(row) {
  const priority = getPriorityLabel(row);
  return {
    ...row,
    priority,
    reasonSentence: row.source === 'retainer' ? buildRetainerReasonSentence(row) : buildProjectReasonSentence(row),
  };
}

function getTaskAssigneeName(task, teamMap) {
  const id = task?.assigneeId || task?.assigneeUserId;
  return id ? teamMap.get(String(id)) || null : null;
}

function buildProjectRows(perfState) {
  const jobMap = new Map((perfState.jobs || []).map((job) => [String(job.id), job]));
  const teamMap = new Map((perfState.team || []).map((member) => [String(member.id), member.name || member.id]));
  const tasksByDeliverable = new Map();
  (perfState.tasks || []).forEach((task) => {
    const key = String(task.deliverableId || '');
    if (!tasksByDeliverable.has(key)) tasksByDeliverable.set(key, []);
    tasksByDeliverable.get(key).push(task);
  });

  return (perfState.deliverables || [])
    .filter((deliverable) => deliverable.status !== 'completed')
    .map((deliverable) => {
      const job = jobMap.get(String(deliverable.jobId));
      const tasks = tasksByDeliverable.get(String(deliverable.id)) || [];
      const missingEstimate = tasks.some((task) => task.estimatedHours === null || task.estimatedHours === undefined || task.estimatedHours === '');
      const noOwner = !deliverable.owner && tasks.some((task) => !task.assigneeId && !task.assigneeUserId);
      const reasons = [];
      if (deliverable.dueSoon) reasons.push('Due soon');
      if (deliverable.overdue) reasons.push('Late');
      if (deliverable.effortOver) reasons.push('Used more hours than planned');
      if (deliverable.changedAt || (deliverable.changeOrders || []).length) reasons.push('Work changed');
      if (deliverable.needsCheckIn) reasons.push('Needs a quick check');
      if (missingEstimate) reasons.push('Missing hour estimate');
      if (noOwner) reasons.push('No owner');

      const plannedHours = Number(deliverable.estHours) || sumHours(tasks, 'estimatedHours');
      const usedHours = plannedHours ? Math.round((plannedHours * (Number(deliverable.effortPct) || 0)) / 100) : 0;
      const firstAssignee = tasks.map((task) => getTaskAssigneeName(task, teamMap)).find(Boolean);
      const dueTime = deliverable.due ? new Date(deliverable.due).getTime() : Number.POSITIVE_INFINITY;

      return decorateRow({
        id: `project-${deliverable.id}`,
        source: 'project',
        deliverableId: deliverable.id,
        jobId: deliverable.jobId,
        deliverable: deliverable.name || 'Deliverable',
        job: deliverable.jobName || job?.name || 'Job',
        company: deliverable.client || job?.client || 'Client',
        jobType: 'Project',
        reasons,
        dueTime,
        dateLabel: deliverable.due ? `Due ${formatDate(deliverable.due)}` : 'No due date',
        hoursLabel: plannedHours ? `${formatHours(usedHours)} / ${formatHours(plannedHours)}` : 'No hour estimate',
        hoursHelper: usedHours > plannedHours && plannedHours > 0 ? 'Used more than planned' : '',
        plannedHours,
        usedHours,
        owner: deliverable.owner || firstAssignee || 'No owner',
        reviewed: deliverable.reviewed,
        actionTarget: deliverable,
        missingEstimate,
        noOwner,
        missingDate: !deliverable.due,
      });
    })
    .filter((row) => row.reasons.length);
}

function isTaskInCycle(task, cycleKey) {
  if (!task || isRecurringTemplateTask(task)) return false;
  return String(getTaskCycleKey(task, cycleKey) || '') === String(cycleKey);
}

function getTaskActualHours(task) {
  const allocations = Array.isArray(task?.allocations) ? task.allocations : [];
  const allocationActual = allocations.reduce((sum, allocation) => sum + (Number(allocation?.actualHours) || 0), 0);
  if (allocationActual > 0) return allocationActual;
  if (Array.isArray(task?.timeEntries)) return task.timeEntries.reduce((sum, entry) => sum + (Number(entry?.hours) || 0), 0);
  return Number(task?.actualHours) || 0;
}

function getTaskPlanHours(task) {
  const allocations = Array.isArray(task?.allocations) ? task.allocations : [];
  const allocationPlan = allocations.reduce((sum, allocation) => sum + (Number(allocation?.loeHours) || 0), 0);
  return allocationPlan || Number(task?.loeHours) || Number(task?.estimatedHours) || 0;
}

function getTaskOwner(task, teamMap) {
  const allocations = Array.isArray(task?.allocations) ? task.allocations : [];
  const allocationOwner = allocations.map((allocation) => allocation?.assigneeUserId).find(Boolean);
  const ownerId = allocationOwner || task?.assigneeUserId || task?.assigneeId;
  return ownerId ? teamMap.get(String(ownerId)) || null : null;
}

function buildRetainerRows({ jobs, teamMap, contactMaps }) {
  const rows = [];
  (jobs || [])
    .filter((job) => job.kind === 'retainer' && job.status === 'active')
    .forEach((job) => {
      const cycleKey = job.currentCycleKey || getCurrentCycleKey();
      const previousCycleKey = (() => {
        const [year, month] = String(cycleKey).split('-').map(Number);
        if (!year || !month) return '';
        const date = new Date(year, month - 2, 1);
        return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      })();
      const changeOrders = (job.changeOrders || []).filter((changeOrder) => (
        String(changeOrder?.effectiveMonth || changeOrder?.effectiveStartMonth || changeOrder?.cycleKey || '') === String(cycleKey)
      ));

      (job.deliverables || [])
        .filter((deliverable) => isDeliverableVisibleInCycle(deliverable, cycleKey))
        .forEach((deliverable) => {
          const pools = getPoolsForCycle(deliverable, cycleKey) || [];
          const previousPools = previousCycleKey ? getPoolsForCycle(deliverable, previousCycleKey) || [] : [];
          const cycleTasks = (deliverable.tasks || []).filter((task) => isTaskInCycle(task, cycleKey));
          const plannedHours = sumHours(pools, 'estimatedHours') || cycleTasks.reduce((sum, task) => sum + getTaskPlanHours(task), 0);
          const poolActualHours = pools.some((pool) => pool.actualHours !== undefined && pool.actualHours !== null)
            ? sumHours(pools, 'actualHours')
            : 0;
          const usedHours = poolActualHours || cycleTasks.reduce((sum, task) => sum + getTaskActualHours(task), 0);
          const capacityPct = plannedHours ? Math.round((usedHours / plannedHours) * 100) : 0;
          const remainingHours = Math.max(0, plannedHours - usedHours);
          const isOneOff = Boolean(deliverable.createdCycleKey) ||
            cycleTasks.some((task) => !task.isRecurring && !task.recurringTemplateId);
          const serviceMixChanged = previousPools.length > 0 && !sameServiceMix(pools, previousPools);
          const missingEstimate = plannedHours <= 0 || cycleTasks.some((task) => getTaskPlanHours(task) <= 0);
          const owner = cycleTasks.map((task) => getTaskOwner(task, teamMap)).find(Boolean);
          const noOwner = !owner;
          const reasons = [];
          if (usedHours > plannedHours && plannedHours > 0) reasons.push('Used more hours than planned');
          if (capacityPct >= 85 && usedHours <= plannedHours && plannedHours > 0) reasons.push('Needs a quick check');
          if (changeOrders.length || isOneOff || serviceMixChanged) reasons.push('Work changed');
          if (missingEstimate) reasons.push('Missing hour estimate');
          if (noOwner) reasons.push('No owner');

          rows.push(decorateRow({
            id: `retainer-${job.id}-${deliverable.id}-${cycleKey}`,
            source: 'retainer',
            jobId: job.id,
            deliverableId: deliverable.id,
            deliverable: deliverable.name || 'Deliverable',
            job: job.name || 'Retainer',
            company: getJobCompany(job, contactMaps),
            jobType: 'Retainer',
            reasons,
            cycleKey,
            dateLabel: formatCycleLabel(cycleKey) || cycleKey,
            cycleLabel: formatCycleLabel(cycleKey) || cycleKey,
            hoursLabel: plannedHours
              ? `${formatHours(usedHours)} used, ${formatHours(remainingHours)} remaining`
              : 'No hour estimate',
            usedHours,
            plannedHours,
            remainingHours,
            owner: owner || 'No owner',
            capacityPct,
            hasOneOffWork: isOneOff,
            actionTarget: { job, deliverable, cycleKey },
            missingEstimate,
            noOwner,
            missingDate: !cycleKey,
          }));
        });
    });
  return rows.filter((row) => row.reasons.length);
}

function buildTrust(rows) {
  const missingEstimates = rows.filter((row) => row.missingEstimate).length;
  const noOwner = rows.filter((row) => row.noOwner).length;
  const missingDate = rows.filter((row) => row.missingDate).length;
  const parts = [];
  if (missingEstimates) parts.push(`${plural(missingEstimates, 'work item')} ${missingEstimates === 1 ? 'is' : 'are'} missing an hour estimate.`);
  if (noOwner) parts.push(`${plural(noOwner, 'work item')} ${noOwner === 1 ? 'has' : 'have'} no owner.`);
  if (missingDate) parts.push(`${plural(missingDate, 'work item')} ${missingDate === 1 ? 'is' : 'are'} missing a date or cycle.`);
  return {
    ok: parts.length === 0,
    title: parts.length ? 'Data needs cleanup' : 'Data looks current',
    copy: parts.length ? parts.join(' ') : 'Hours, owners, and dates are ready to use.',
  };
}

function filterRows(rows, view) {
  if (view === 'project') return rows.filter((row) => row.source === 'project');
  if (view === 'retainer') return rows.filter((row) => row.source === 'retainer');
  return rows;
}

function getUrgencyRank(row) {
  const reasons = row?.reasons || [];
  if (reasons.includes('Late')) return 1;
  if (reasons.includes('Due soon') && reasons.includes('Used more hours than planned')) return 2;
  if (reasons.includes('Due soon') && reasons.includes('Work changed')) return 3;
  if (reasons.includes('Used more hours than planned')) return 4;
  if (reasons.includes('No owner')) return 5;
  if (reasons.includes('Missing hour estimate')) return 6;
  if (row?.missingDate) return 7;
  if (reasons.includes('Due soon')) return 8;
  if (reasons.includes('Work changed')) return 9;
  if (reasons.includes('Needs a quick check')) return 10;
  return 20;
}

function sortRowsByUrgency(rows) {
  return [...rows].sort((a, b) => {
    const urgencyDelta = getUrgencyRank(a) - getUrgencyRank(b);
    if (urgencyDelta) return urgencyDelta;
    if (a.source === 'project' && b.source === 'project') {
      return (a.dueTime || Number.POSITIVE_INFINITY) - (b.dueTime || Number.POSITIVE_INFINITY);
    }
    if (a.source === 'retainer' && b.source === 'retainer') {
      const cycleDelta = String(b.cycleKey || '').localeCompare(String(a.cycleKey || ''));
      if (cycleDelta) return cycleDelta;
      return (Number(b.capacityPct) || 0) - (Number(a.capacityPct) || 0);
    }
    return a.source === 'project' ? -1 : 1;
  });
}

function buildSummary(rows) {
  return [
    { title: 'Needs attention', value: rows.length, subtext: 'Work that may need a decision.', tone: 'amber' },
    { title: 'Due soon', value: rows.filter((row) => row.reasons.includes('Due soon')).length, subtext: 'Work due in the next 7 days.', tone: 'amber' },
    { title: 'Late', value: rows.filter((row) => row.reasons.includes('Late')).length, subtext: 'Work past its due date.', tone: 'red' },
    { title: 'Used more hours than planned', value: rows.filter((row) => row.reasons.includes('Used more hours than planned')).length, subtext: 'Work above its planned hours.', tone: 'amber' },
    { title: 'Work changed', value: rows.filter((row) => row.reasons.includes('Work changed')).length, subtext: 'Work with recent changes.', tone: 'green' },
  ];
}

function SegmentedControl({ options, value, onChange }) {
  return h('div', { className: 'inline-flex items-center gap-1 rounded-full border border-slate-300 bg-white p-1 dark:border-white/10 dark:bg-slate-900' },
    options.map((option) => {
      const active = option.key === value;
      return h('button', {
        key: option.key,
        type: 'button',
        className: [
          'rounded-full px-3 py-1.5 text-sm font-semibold transition',
          active
            ? 'bg-netnet-purple text-white shadow-sm'
            : 'text-slate-600 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800',
        ].join(' '),
        onClick: () => onChange(option.key),
      }, option.label);
    })
  );
}

function ViewControl({ value, onChange }) {
  return h(SegmentedControl, { options: VIEW_OPTIONS, value, onChange });
}

function LayoutControl({ value, onChange }) {
  return h(SegmentedControl, { options: LAYOUT_OPTIONS, value, onChange });
}

function DataTrustStrip({ trust }) {
  return h(PerfCard, { variant: 'secondary', className: 'flex flex-wrap items-center justify-between gap-3' }, [
    h('div', { className: 'space-y-1' }, [
      h('div', { className: 'flex items-center gap-2' }, [
        h('span', { className: `h-2.5 w-2.5 rounded-full ${trust.ok ? 'bg-emerald-500' : 'bg-amber-500'}` }),
        h('h3', { className: 'text-sm font-semibold text-slate-900 dark:text-white' }, trust.title),
      ]),
      h('p', { className: 'text-sm text-slate-600 dark:text-slate-300' }, trust.copy),
    ]),
  ]);
}

function TakeActionMenu({ row, onSelect }) {
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState({ top: 0, left: 0 });
  const btnRef = useRef(null);
  const menuRef = useRef(null);

  const positionMenu = () => {
    const rect = btnRef.current?.getBoundingClientRect();
    if (!rect) return;
    const menuWidth = 224;
    const margin = 12;
    const left = Math.min(
      window.innerWidth - menuWidth - margin,
      Math.max(margin, rect.right - menuWidth)
    );
    setCoords({
      top: rect.bottom + 8,
      left,
    });
  };

  const toggleMenu = () => {
    if (open) {
      setOpen(false);
      return;
    }
    positionMenu();
    setOpen(true);
  };

  useEffect(() => {
    if (!open) return;
    const onPointer = (event) => {
      const menu = menuRef.current;
      const button = btnRef.current;
      if (menu?.contains(event.target) || button?.contains(event.target)) return;
      setOpen(false);
    };
    const onKey = (event) => {
      if (event.key === 'Escape') setOpen(false);
    };
    const onReposition = () => positionMenu();
    document.addEventListener('pointerdown', onPointer, true);
    document.addEventListener('keydown', onKey);
    window.addEventListener('resize', onReposition);
    window.addEventListener('scroll', onReposition, true);
    return () => {
      document.removeEventListener('pointerdown', onPointer, true);
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('resize', onReposition);
      window.removeEventListener('scroll', onReposition, true);
    };
  }, [open]);

  const menuItems = ACTIONS.map((action) => {
    if (row.source === 'project') return { ...action, disabled: false, reason: '' };
    if (action.key === 'change-order' && row.jobId) return { ...action, disabled: false, reason: '' };
    return { ...action, disabled: true, reason: 'Available from Job detail in this prototype.' };
  });

  const menu = open ? createPortal(
    h('div', { className: 'fixed inset-0 z-[80] pointer-events-none', role: 'presentation' }, [
      h('div', {
        ref: menuRef,
        className: 'pointer-events-auto absolute w-56 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-xl dark:border-white/10 dark:bg-slate-900',
        style: { top: `${coords.top}px`, left: `${coords.left}px` },
      },
        menuItems.map((item) => h(item.disabled ? 'div' : 'button', {
          key: item.key,
          type: item.disabled ? undefined : 'button',
          className: [
            'w-full px-3 py-2.5 text-left text-sm',
            item.disabled
              ? 'cursor-not-allowed bg-slate-50 text-slate-400 dark:bg-white/[0.04] dark:text-slate-500'
              : 'text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-white/10',
          ].join(' '),
          title: item.reason || undefined,
          onClick: item.disabled
            ? undefined
            : () => {
                onSelect(item.key, row);
                setOpen(false);
              },
        }, [
          h('div', { className: 'font-medium' }, item.label),
          item.disabled ? h('div', { className: 'mt-0.5 text-[11px] leading-4' }, item.reason) : null,
        ]))
      ),
    ]),
    document.body
  ) : null;

  return h('div', { className: 'relative inline-flex' }, [
    h('button', {
      ref: btnRef,
      type: 'button',
      className: 'inline-flex items-center rounded-full bg-netnet-purple px-3 py-1.5 text-sm font-semibold text-white shadow-sm hover:brightness-110',
      onClick: toggleMenu,
    }, 'Take action'),
    menu,
  ]);
}

function OwnerLabel({ row }) {
  const missing = row.owner === 'No owner';
  return h('span', {
    className: missing
      ? 'font-semibold text-rose-700 dark:text-rose-200'
      : 'font-semibold text-slate-800 dark:text-slate-100',
  }, `Owner: ${row.owner}`);
}

function MetaSeparator() {
  return h('span', { className: 'text-slate-400' }, '|');
}

function ProjectWorkRow({ row, onAction }) {
  return h(PerfCard, { variant: 'secondary', className: `space-y-3 ${WORK_ITEM_SURFACE}` }, [
    h('div', { className: 'flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between' }, [
      h('div', { className: 'min-w-0 flex-1 space-y-3' }, [
        h('div', { className: 'flex flex-wrap items-center gap-2' }, [
          h(PriorityPill, { priority: row.priority }),
          h('h3', { className: 'truncate text-base font-semibold text-slate-900 dark:text-white' }, row.deliverable),
          h('span', { className: 'rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-200' }, row.jobType),
          row.reviewed ? h(ReviewedBadge, { reviewed: row.reviewed }) : null,
        ]),
        h('div', { className: 'flex flex-wrap items-center gap-2 text-sm text-slate-600 dark:text-slate-300' }, [
          h('span', { className: 'font-semibold text-slate-800 dark:text-slate-100' }, row.job),
          h(MetaSeparator),
          h('span', null, row.company),
        ]),
        h('p', { className: 'text-sm leading-6 text-slate-700 dark:text-slate-200' }, row.reasonSentence),
        h('div', { className: 'flex flex-wrap items-center gap-2 text-sm text-slate-600 dark:text-slate-300' }, [
          h('span', null, row.dateLabel),
          h(MetaSeparator),
          h('span', { className: 'font-semibold text-slate-800 dark:text-slate-100' }, row.hoursLabel),
          row.hoursHelper ? h('span', { className: 'rounded-full bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-700 dark:bg-amber-400/10 dark:text-amber-100' }, row.hoursHelper) : null,
          h(MetaSeparator),
          h(OwnerLabel, { row }),
        ]),
        h(ReasonChips, { reasons: row.reasons }),
      ]),
      h('div', { className: 'flex shrink-0 items-start justify-start xl:justify-end' }, h(TakeActionMenu, { row, onSelect: onAction })),
    ]),
  ]);
}

function RetainerWorkRow({ row, onAction }) {
  return h(PerfCard, { variant: 'secondary', className: `space-y-3 ${WORK_ITEM_SURFACE}` }, [
    h('div', { className: 'flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between' }, [
      h('div', { className: 'min-w-0 flex-1 space-y-3' }, [
        h('div', { className: 'flex flex-wrap items-center gap-2' }, [
          h(PriorityPill, { priority: row.priority }),
          h('h3', { className: 'truncate text-base font-semibold text-slate-900 dark:text-white' }, row.deliverable),
          h('span', { className: 'rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-200' }, row.jobType),
        ]),
        h('div', { className: 'flex flex-wrap items-center gap-2 text-sm text-slate-600 dark:text-slate-300' }, [
          h('span', { className: 'font-semibold text-slate-800 dark:text-slate-100' }, row.job),
          h(MetaSeparator),
          h('span', null, row.company),
          h(MetaSeparator),
          h('span', null, `Current cycle: ${row.cycleLabel}`),
        ]),
        h('p', { className: 'text-sm leading-6 text-slate-700 dark:text-slate-200' }, row.reasonSentence),
        h('div', { className: 'flex flex-wrap items-center gap-2 text-sm text-slate-600 dark:text-slate-300' }, [
          h('span', { className: 'font-semibold text-slate-800 dark:text-slate-100' }, `${formatHours(row.usedHours)} used this cycle`),
          h(MetaSeparator),
          h('span', { className: 'font-semibold text-slate-800 dark:text-slate-100' }, `${formatHours(row.remainingHours)} remaining this cycle`),
          row.capacityPct != null ? h('span', { className: 'text-xs text-slate-500 dark:text-slate-400' }, `${row.capacityPct}% used this cycle`) : null,
          h(MetaSeparator),
          h(OwnerLabel, { row }),
        ]),
        h(ReasonChips, { reasons: row.reasons }),
      ]),
      h('div', { className: 'flex shrink-0 items-start justify-start xl:justify-end' }, h(TakeActionMenu, { row, onSelect: onAction })),
    ]),
  ]);
}

function WorkRow({ row, onAction }) {
  if (row.source === 'retainer') return h(RetainerWorkRow, { row, onAction });
  return h(ProjectWorkRow, { row, onAction });
}

function CardMetaLine({ row }) {
  return h('div', { className: 'flex flex-wrap items-center gap-2 text-sm text-slate-600 dark:text-slate-300' }, [
    h('span', { className: 'rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-200' }, row.jobType),
    h(MetaSeparator),
    h('span', { className: 'font-semibold text-slate-800 dark:text-slate-100' }, row.job),
    h(MetaSeparator),
    h('span', null, row.company),
  ]);
}

function ProjectWorkCard({ row, onAction }) {
  return h(PerfCard, { variant: 'secondary', className: `flex h-full flex-col gap-4 ${WORK_ITEM_SURFACE}` }, [
    h('div', { className: 'space-y-3' }, [
      h(PriorityPill, { priority: row.priority }),
      h('div', { className: 'space-y-2' }, [
        h('h3', { className: 'text-lg font-semibold leading-6 text-slate-900 dark:text-white' }, row.deliverable),
        h(CardMetaLine, { row }),
      ]),
      h('p', { className: 'text-sm leading-6 text-slate-700 dark:text-slate-200' }, row.reasonSentence),
    ]),
    h('div', { className: 'space-y-2 text-sm text-slate-600 dark:text-slate-300' }, [
      h('div', { className: 'font-semibold text-slate-800 dark:text-slate-100' }, row.dateLabel),
      h('div', { className: 'font-semibold text-slate-800 dark:text-slate-100' }, row.hoursLabel),
      row.hoursHelper ? h('div', { className: 'text-xs font-semibold text-amber-700 dark:text-amber-100' }, row.hoursHelper) : null,
      h('div', null, h(OwnerLabel, { row })),
    ]),
    h(ReasonChips, { reasons: row.reasons }),
    h('div', { className: 'mt-auto pt-1' }, h(TakeActionMenu, { row, onSelect: onAction })),
  ]);
}

function RetainerWorkCard({ row, onAction }) {
  return h(PerfCard, { variant: 'secondary', className: `flex h-full flex-col gap-4 ${WORK_ITEM_SURFACE}` }, [
    h('div', { className: 'space-y-3' }, [
      h(PriorityPill, { priority: row.priority }),
      h('div', { className: 'space-y-2' }, [
        h('h3', { className: 'text-lg font-semibold leading-6 text-slate-900 dark:text-white' }, row.deliverable),
        h(CardMetaLine, { row }),
      ]),
      h('div', { className: 'text-sm font-semibold text-slate-800 dark:text-slate-100' }, `Current cycle: ${row.cycleLabel}`),
      h('p', { className: 'text-sm leading-6 text-slate-700 dark:text-slate-200' }, row.reasonSentence),
    ]),
    h('div', { className: 'space-y-2 text-sm text-slate-600 dark:text-slate-300' }, [
      h('div', { className: 'font-semibold text-slate-800 dark:text-slate-100' }, `${formatHours(row.usedHours)} used this cycle`),
      h('div', { className: 'font-semibold text-slate-800 dark:text-slate-100' }, `${formatHours(row.remainingHours)} remaining`),
      h('div', null, h(OwnerLabel, { row })),
    ]),
    h(ReasonChips, { reasons: row.reasons }),
    h('div', { className: 'mt-auto pt-1' }, h(TakeActionMenu, { row, onSelect: onAction })),
  ]);
}

function WorkCard({ row, onAction }) {
  if (row.source === 'retainer') return h(RetainerWorkCard, { row, onAction });
  return h(ProjectWorkCard, { row, onAction });
}

function WorkItems({ rows, layoutView, onAction }) {
  if (!rows.length) {
    return h('div', { className: 'rounded-xl border border-dashed border-slate-200 p-5 text-sm text-slate-600 dark:border-white/10 dark:text-slate-300' }, 'No active work needs attention for this view.');
  }
  if (layoutView === 'list') {
    return h('div', { className: 'space-y-4', 'data-demo': 'production-list-view' }, rows.map((row) =>
      h(WorkRow, { key: row.id, row, onAction })
    ));
  }
  return h('div', { className: 'grid grid-cols-1 gap-5 lg:grid-cols-2', 'data-demo': 'production-card-view' }, rows.map((row) =>
    h(WorkCard, { key: row.id, row, onAction })
  ));
}

function ActionBody({ action, formState, setFormState, team }) {
  if (action?.type === 'due-date') {
    return h('label', { className: 'flex flex-col gap-1 text-sm text-slate-700 dark:text-slate-200' }, [
      'New due date',
      h('input', {
        type: 'date',
        value: formState.date || '',
        onChange: (event) => setFormState((current) => ({ ...current, date: event.target.value })),
        className: 'rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-white/10 dark:bg-slate-900',
      }),
    ]);
  }
  if (action?.type === 'reassign') {
    return h('label', { className: 'flex flex-col gap-1 text-sm text-slate-700 dark:text-slate-200' }, [
      'Assign tasks to',
      h('select', {
        value: formState.assigneeId || '',
        onChange: (event) => setFormState((current) => ({ ...current, assigneeId: event.target.value })),
        className: 'rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-white/10 dark:bg-slate-900',
      }, (team || []).map((member) => h('option', { key: member.id, value: member.id }, member.name))),
    ]);
  }
  if (action?.type === 'change-order') {
    return h('label', { className: 'flex flex-col gap-1 text-sm text-slate-700 dark:text-slate-200' }, [
      'Change order note',
      h('textarea', {
        value: formState.note || '',
        onChange: (event) => setFormState((current) => ({ ...current, note: event.target.value })),
        className: 'rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-white/10 dark:bg-slate-900',
        rows: 3,
      }),
    ]);
  }
  return h('p', { className: 'text-sm text-slate-600 dark:text-slate-300' }, 'Confirm this action to update the deliverable.');
}

export function ProductionDashboard() {
  const [view, setView] = useState('all');
  const [layoutView, setLayoutView] = useState(() => readLayoutView());
  const [perfState, setPerfState] = useState(() => getEffectiveState());
  const [jobs, setJobs] = useState(() => loadJobs());
  const [action, setAction] = useState(null);
  const [formState, setFormState] = useState({});

  const contactMaps = useMemo(() => buildContactMaps(), []);
  const liveTeam = useMemo(() => loadTeamMembers(), []);
  const liveTeamMap = useMemo(() => new Map((liveTeam || []).map((member) => [String(member.id), member.name || member.email || member.id])), [liveTeam]);
  const projectRows = useMemo(() => buildProjectRows(perfState), [perfState]);
  const retainerRows = useMemo(() => buildRetainerRows({ jobs, teamMap: liveTeamMap, contactMaps }), [jobs, liveTeamMap, contactMaps]);
  const allRows = useMemo(() => [...projectRows, ...retainerRows], [projectRows, retainerRows]);
  const visibleRows = useMemo(() => sortRowsByUrgency(filterRows(allRows, view)), [allRows, view]);
  const trust = useMemo(() => buildTrust(allRows), [allRows]);
  const summary = useMemo(() => buildSummary(visibleRows), [visibleRows]);

  const updateLayoutView = (nextLayout) => {
    const normalized = normalizeLayoutView(nextLayout);
    setLayoutView(normalized);
    writeLayoutView(normalized);
  };

  const openAction = (type, row) => {
    if (row.source === 'retainer') {
      if (type === 'change-order' && row.jobId) navigate(`#/app/jobs/${row.jobId}/change-orders`);
      return;
    }
    setAction({ type, row });
    setFormState({
      date: row.actionTarget?.due || '',
      assigneeId: perfState.tasks.find((task) => String(task.deliverableId) === String(row.deliverableId))?.assigneeId || perfState.team[0]?.id || '',
      note: '',
    });
  };

  const closeAction = () => {
    setAction(null);
    setFormState({});
  };

  const refreshProjectState = (nextState) => {
    setPerfState(nextState);
    setJobs(loadJobs());
  };

  const confirmAction = () => {
    if (!action?.row) return;
    const deliverableId = action.row.deliverableId;
    let next = perfState;
    if (action.type === 'review') next = markReviewed(deliverableId);
    if (action.type === 'complete') next = completeDeliverable(deliverableId);
    if (action.type === 'due-date') next = updateDueDate(deliverableId, formState.date);
    if (action.type === 'reassign') next = reassignTasks(deliverableId, formState.assigneeId || perfState.team[0]?.id);
    if (action.type === 'change-order') next = createChangeOrder(deliverableId, formState.note || 'Change order added');
    refreshProjectState(next);
    closeAction();
    window?.showToast?.('Production action saved');
  };

  return h('div', { className: 'space-y-6', 'data-demo': 'production-dashboard' }, [
    h(PerfCard, { className: 'space-y-2' }, [
      h('p', { className: 'text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400' }, 'Performance'),
      h('h2', { className: 'text-2xl font-semibold text-slate-900 dark:text-white' }, 'Production'),
      h('p', { className: 'max-w-2xl text-sm leading-6 text-slate-600 dark:text-slate-300' }, 'Active work that needs attention.'),
    ]),
    h(DataTrustStrip, { trust }),
    h('div', { className: 'grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-5', 'data-demo': 'production-summary-cards' },
      summary.map((card) => h(KPIBox, {
        key: card.title,
        title: card.title,
        value: card.value,
        subtext: card.subtext,
        tone: card.tone,
      }))
    ),
    h(PerfCard, { className: `space-y-4 ${WORK_PANEL_SURFACE}`, 'data-demo': 'production-work-list' }, [
      h(PerfSectionTitle, {
        title: 'Work needing attention',
        subtitle: `${plural(visibleRows.length, 'work item')} shown`,
        rightSlot: h('div', { className: 'flex flex-wrap items-end justify-start gap-3' }, [
          h('div', { className: 'space-y-1' }, [
            h('div', { className: 'text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400' }, 'Layout'),
            h(LayoutControl, { value: layoutView, onChange: updateLayoutView }),
          ]),
          h('div', { className: 'space-y-1' }, [
            h('div', { className: 'text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400' }, 'View'),
            h(ViewControl, { value: view, onChange: setView }),
          ]),
        ]),
      }),
      h('p', { className: 'text-sm text-slate-600 dark:text-slate-300' }, 'Projects use due dates. Retainers use cycles.'),
      h(WorkItems, { rows: visibleRows, layoutView, onAction: openAction }),
    ]),
    action ? h(ActionModal, {
      title: ACTIONS.find((item) => item.key === action.type)?.label || 'Take action',
      description: action.row?.deliverable,
      onCancel: closeAction,
      onConfirm: confirmAction,
      children: h(ActionBody, { action, formState, setFormState, team: perfState.team }),
    }) : null,
  ]);
}
