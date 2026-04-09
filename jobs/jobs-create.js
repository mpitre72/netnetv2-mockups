import { getActiveWorkspace } from '../app-shell/app-helpers.js';
import { SectionHeader } from '../components/layout/SectionHeader.js';
import { mountCompanyLookup } from '../contacts/company-lookup.js';
import { getContactsData, getIndividualsData } from '../contacts/contacts-data.js';
import { JobPlanEditor, buildDeliverablesFromPlan, sumRowHours, syncRowsWithServiceTypes } from './jobs-plan-grid.js';
import { mountPersonLookup } from '../contacts/person-lookup.js';
import { openSingleDatePickerPopover } from '../quick-tasks/quick-task-detail.js';
import { loadServiceTypes, loadTeamMembers } from '../quick-tasks/quick-tasks-store.js';
import { navigate } from '../router.js';
import { saveJob } from './jobs-store.js';
import { JobActivationModal } from './job-detail/job-activation-modal.js';
import { getJobNumber } from './job-number-utils.js';
import { TaskStyleRichTextField } from './task-style-rich-text-field.js';
import { loadDeliverableTypeOptions, rememberDeliverableType } from './deliverable-type-store.js';
import {
  ensurePlanBaselines,
  getCurrentPlanState,
  getWorkingPlanState,
} from './change-order-scope-utils.js';

const { createElement: h, useEffect, useMemo, useRef, useState } = React;

const JOB_CREATE_DRAFT_KEY = 'job_create_draft_v1';
const MS_DAY = 24 * 60 * 60 * 1000;
const TIMELINE_LEFT_COL_WIDTH = 280;
const TIMELINE_ROW_HEIGHT = 72;
const TIMELINE_HEADER_HEIGHT = 56;
const TIMELINE_ZOOM_PRESETS = [
  { value: 'days', label: 'Days', slider: 100 },
  { value: 'weeks', label: 'Weeks', slider: 62 },
  { value: 'months', label: 'Months', slider: 30 },
  { value: 'year', label: 'Year', slider: 8 },
];

const STEP_DEFS = [
  {
    id: 'summary',
    index: 1,
    label: 'Summary',
    title: 'Set up the Job',
    subtitle: 'Define what this job is and who is involved.',
    nextLabel: 'Continue →',
    theme: 'from-slate-100 via-white to-slate-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950',
    accentClass: 'bg-netnet-purple',
  },
  {
    id: 'work',
    index: 2,
    label: 'Deliverables + LOE',
    title: 'Plan the work',
    subtitle: 'Define deliverables and the hours required to complete them.',
    backLabel: '← Back',
    nextLabel: 'Continue →',
    theme: 'from-cyan-50 via-white to-slate-50 dark:from-slate-950 dark:via-cyan-950/25 dark:to-slate-950',
    accentClass: 'bg-cyan-500',
  },
  {
    id: 'timeline',
    index: 3,
    label: 'Timeline',
    title: 'Timeline',
    subtitle: 'Set dates and sequencing.',
    body: 'Step 3 content coming',
    backLabel: '← Back',
    nextLabel: 'Continue →',
    theme: 'from-emerald-50 via-white to-slate-50 dark:from-slate-950 dark:via-emerald-950/25 dark:to-slate-950',
    accentClass: 'bg-emerald-500',
  },
  {
    id: 'netnet',
    index: 4,
    label: 'Net Net',
    title: 'Net Net',
    subtitle: 'Review and approve the plan.',
    body: 'Step 4 content coming',
    backLabel: '← Back',
    nextLabel: 'Activate Job',
    theme: 'from-amber-50 via-white to-slate-50 dark:from-slate-950 dark:via-amber-950/25 dark:to-slate-950',
    accentClass: 'bg-amber-500',
  },
];

function buildVisibleSteps(kind = 'project') {
  const visible = kind === 'retainer'
    ? STEP_DEFS.filter((step) => step.id !== 'timeline')
    : STEP_DEFS;
  return visible.map((step, idx, list) => ({
    ...step,
    displayIndex: idx + 1,
    eyebrow: `Step ${idx + 1} of ${list.length}`,
  }));
}

function workspaceId() {
  return getActiveWorkspace()?.id || 'default';
}

function storageKey(wsId = workspaceId()) {
  return `netnet_ws_${wsId}_${JOB_CREATE_DRAFT_KEY}`;
}

function todayISO(date = new Date()) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function createDraftId(prefix) {
  return `${prefix}_${Math.random().toString(36).slice(2, 9)}`;
}

function parseISO(dateStr) {
  if (!dateStr) return null;
  const date = new Date(`${dateStr}T00:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function addDaysISO(dateStr, days) {
  const base = parseISO(dateStr) || new Date();
  const next = new Date(base.getTime());
  next.setDate(next.getDate() + days);
  return todayISO(next);
}

function diffDays(startStr, endStr) {
  const start = parseISO(startStr);
  const end = parseISO(endStr);
  if (!start || !end) return 0;
  return Math.round((end.getTime() - start.getTime()) / MS_DAY);
}

function formatTimelineTick(dateStr, mode) {
  const date = parseISO(dateStr);
  if (!date) return dateStr || '';
  if (mode === 'year') return new Intl.DateTimeFormat('en-US', { month: 'short', year: 'numeric' }).format(date);
  if (mode === 'months') return new Intl.DateTimeFormat('en-US', { month: 'short', year: 'numeric' }).format(date);
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(date);
}

function formatLongDate(dateStr) {
  const date = parseISO(dateStr);
  if (!date) return 'Select date';
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(date);
}

function formatMoney(value) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(Number(value) || 0);
}

function formatPercent(value) {
  const num = Number(value) || 0;
  return `${Math.round(num)}%`;
}

function formatLargeHours(value) {
  const rounded = Math.round((Number(value) || 0) * 10) / 10;
  return `${rounded}`;
}

function formatWeeksAndDays(totalDays) {
  const safeDays = Math.max(0, Math.round(Number(totalDays) || 0));
  const weeks = Math.floor(safeDays / 7);
  const days = safeDays % 7;
  if (weeks && days) return `${weeks} wk ${days} d`;
  if (weeks) return `${weeks} wk`;
  return `${days} d`;
}

function formatStatusLabel(status) {
  if (status === 'active') return 'Active';
  if (status === 'completed') return 'Completed';
  if (status === 'archived') return 'Archived';
  return 'Pending';
}

function statusPillTone(status) {
  if (status === 'active') return 'border-emerald-300/70 bg-emerald-500/15 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-200';
  if (status === 'completed') return 'border-yellow-300/70 bg-yellow-400/15 text-yellow-700 dark:border-yellow-500/30 dark:bg-yellow-500/10 dark:text-yellow-200';
  if (status === 'archived') return 'border-red-300/70 bg-red-500/15 text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-200';
  return 'border-yellow-300/70 bg-yellow-400/15 text-yellow-700 dark:border-yellow-500/30 dark:bg-yellow-500/10 dark:text-yellow-200';
}

function getIntensityLabel(hoursPerWeek) {
  const safe = Number(hoursPerWeek) || 0;
  if (safe >= 40) return 'Heavy';
  if (safe >= 22) return 'Moderate';
  return 'Balanced';
}

function getTimelineZoomMode(sliderValue) {
  if (sliderValue >= 82) return 'days';
  if (sliderValue >= 48) return 'weeks';
  if (sliderValue >= 18) return 'months';
  return 'year';
}

function getTimelineZoomConfig(sliderValue) {
  const mode = getTimelineZoomMode(sliderValue);
  const pxPerDay = 2.2 + ((Number(sliderValue) || 0) / 100) * 34;
  const tickStep = mode === 'days' ? 1 : mode === 'weeks' ? 7 : mode === 'months' ? 30 : 90;
  return { mode, pxPerDay, tickStep };
}

function getDurationDays(details = {}) {
  const rawValue = Math.max(0, Number(details?.durationValue) || 0);
  const safeValue = rawValue || 5;
  const unit = details?.durationUnit || 'days';
  const multiplier = unit === 'months' ? 30 : unit === 'weeks' ? 7 : 1;
  return Math.max(1, Math.ceil(safeValue * multiplier));
}

function normalizePlanState(rawPlan = {}, fallbackServiceTypeIds = []) {
  const serviceTypeIds = Array.isArray(rawPlan?.serviceTypeIds) && rawPlan.serviceTypeIds.length
    ? rawPlan.serviceTypeIds.filter(Boolean).map((id) => String(id))
    : (fallbackServiceTypeIds || []).filter(Boolean).map((id) => String(id));
  const names = rawPlan?.serviceTypeNames && typeof rawPlan.serviceTypeNames === 'object'
    ? Object.keys(rawPlan.serviceTypeNames).reduce((acc, key) => {
      const value = String(rawPlan.serviceTypeNames[key] || '').trim();
      if (value) acc[String(key)] = value;
      return acc;
    }, {})
    : {};
  return {
    serviceTypeIds,
    serviceTypeNames: names,
    rows: syncRowsWithServiceTypes(Array.isArray(rawPlan?.rows) ? rawPlan.rows : [], serviceTypeIds),
  };
}

function buildSelectedServiceTypeIds(rawIds = []) {
  return Array.isArray(rawIds) ? [...new Set(rawIds.filter(Boolean).map((id) => String(id)))] : [];
}

function buildKnownServiceTypeNameMap(serviceTypes = []) {
  return (serviceTypes || []).reduce((acc, type) => {
    const key = String(type?.id || '');
    const value = String(type?.name || '').trim();
    if (key && value) acc[key] = value;
    return acc;
  }, {});
}

function mergeSelectedServiceTypesIntoDraft(currentDraft, selectedServiceTypeIds, serviceTypes = []) {
  const nextSelectedIds = buildSelectedServiceTypeIds(selectedServiceTypeIds);
  const knownNames = buildKnownServiceTypeNameMap(serviceTypes);
  const currentPlan = normalizePlanState(currentDraft?.plan, nextSelectedIds);
  const customIds = currentPlan.serviceTypeIds.filter((id) => !knownNames[id]);
  const nextPlanIds = [...nextSelectedIds, ...customIds.filter((id) => !nextSelectedIds.includes(id))];
  const nextNames = { ...(currentPlan.serviceTypeNames || {}) };
  nextSelectedIds.forEach((id) => {
    if (knownNames[id]) nextNames[id] = knownNames[id];
  });
  Object.keys(nextNames).forEach((id) => {
    if (!nextPlanIds.includes(id)) delete nextNames[id];
  });
  return {
    ...currentDraft,
    selectedServiceTypeIds: nextSelectedIds,
    plan: {
      serviceTypeIds: nextPlanIds,
      serviceTypeNames: nextNames,
      rows: syncRowsWithServiceTypes(currentPlan.rows || [], nextPlanIds),
    },
  };
}

function normalizeDeliverableDetailsMap(raw = {}) {
  if (!raw || typeof raw !== 'object') return {};
  return Object.keys(raw).reduce((acc, key) => {
    const item = raw[key] || {};
    const hybridRaw = item.hybridDelivery || {};
    const hybridHours = hybridRaw.estimatedHours;
    acc[String(key)] = {
      description: String(item.description || ''),
      durationValue: String(item.durationValue || ''),
      durationUnit: item.durationUnit === 'weeks' || item.durationUnit === 'months' ? item.durationUnit : 'days',
      dependencyRowId: String(item.dependencyRowId || ''),
      internalNotes: String(item.internalNotes || ''),
      deliverableType: String(item.deliverableType || ''),
      hybridDelivery: {
        enabled: !!hybridRaw.enabled,
        estimatedHours: hybridHours === '' || hybridHours === null || hybridHours === undefined || Number.isNaN(Number(hybridHours))
          ? null
          : Number(hybridHours),
        notes: String(hybridRaw.notes || ''),
      },
    };
    return acc;
  }, {});
}

function ensureDeliverableDetails(detailsMap = {}, rowId) {
  const key = String(rowId || '');
  return detailsMap[key] || {
    description: '',
    durationValue: '',
    durationUnit: 'days',
    dependencyRowId: '',
    internalNotes: '',
    deliverableType: '',
    hybridDelivery: {
      enabled: false,
      estimatedHours: null,
      notes: '',
    },
  };
}

function defaultDraft() {
  return {
    name: '',
    jobNumber: '1138',
    kind: 'project',
    isInternal: false,
    companyId: '',
    personId: '',
    jobLeadUserId: '',
    teamUserIds: [],
    selectedServiceTypeIds: [],
    billingStructure: 'month_to_month',
    billingDurationMonths: null,
    startDate: null,
    targetEndDate: null,
    timelineZoomValue: 62,
    plan: normalizePlanState(),
    deliverableDetailsById: {},
  };
}

function normalizeDraft(raw) {
  const base = defaultDraft();
  const next = { ...base, ...(raw || {}) };
  next.name = typeof next.name === 'string' ? next.name : '';
  next.jobNumber = String(next.jobNumber || base.jobNumber).replace(/\D/g, '') || base.jobNumber;
  next.kind = next.kind === 'retainer' ? 'retainer' : 'project';
  next.isInternal = !!next.isInternal;
  next.companyId = next.isInternal ? '' : String(next.companyId || '');
  next.personId = next.isInternal ? '' : String(next.personId || '');
  next.jobLeadUserId = String(next.jobLeadUserId || '');
  next.teamUserIds = Array.isArray(next.teamUserIds) ? next.teamUserIds.filter(Boolean).map((id) => String(id)) : [];
  next.selectedServiceTypeIds = buildSelectedServiceTypeIds(next.selectedServiceTypeIds);
  next.billingStructure = next.billingStructure === 'fixed_term' ? 'fixed_term' : 'month_to_month';
  const durationMonths = Number(next.billingDurationMonths);
  next.billingDurationMonths = next.billingStructure === 'fixed_term' && Number.isFinite(durationMonths) && durationMonths > 0
    ? Math.round(durationMonths)
    : null;
  next.startDate = typeof next.startDate === 'string' || next.startDate === null ? next.startDate : base.startDate;
  next.targetEndDate = next.kind === 'project' && (typeof next.targetEndDate === 'string' || next.targetEndDate === null)
    ? next.targetEndDate
    : base.targetEndDate;
  if (next.kind !== 'project') next.targetEndDate = null;
  const zoomValue = Number(next.timelineZoomValue);
  next.timelineZoomValue = Number.isFinite(zoomValue)
    ? Math.max(0, Math.min(100, Math.round(zoomValue)))
    : base.timelineZoomValue;
  next.plan = normalizePlanState(next.plan, next.selectedServiceTypeIds);
  next.deliverableDetailsById = normalizeDeliverableDetailsMap(next.deliverableDetailsById);
  return next;
}

function loadDraft(wsId = workspaceId()) {
  const fallback = defaultDraft();
  try {
    const raw = localStorage.getItem(storageKey(wsId));
    if (!raw) return fallback;
    return normalizeDraft(JSON.parse(raw));
  } catch (err) {
    return fallback;
  }
}

function persistDraft(draft, wsId = workspaceId()) {
  const normalized = normalizeDraft(draft);
  try {
    localStorage.setItem(storageKey(wsId), JSON.stringify(normalized));
  } catch (err) {
    // Ignore local storage errors in prototype mode.
  }
  return normalized;
}

function clearDraft(wsId = workspaceId()) {
  try {
    localStorage.removeItem(storageKey(wsId));
  } catch (err) {
    // Ignore storage cleanup failures in prototype mode.
  }
}

function buildDeliverableDetailsFromJob(job) {
  return normalizeDeliverableDetailsMap((job?.deliverables || []).reduce((acc, deliverable) => {
    if (!deliverable?.id) return acc;
    acc[String(deliverable.id)] = {
      description: String(deliverable.description || ''),
      durationValue: String(deliverable.durationValue || ''),
      durationUnit: deliverable.durationUnit || 'days',
      dependencyRowId: String((deliverable.dependencyDeliverableIds || [])[0] || ''),
      internalNotes: String(deliverable.internalNotes || ''),
      deliverableType: String(deliverable.deliverableType || ''),
      hybridDelivery: {
        enabled: !!deliverable?.hybridDelivery?.enabled,
        estimatedHours: deliverable?.hybridDelivery?.estimatedHours ?? null,
        notes: String(deliverable?.hybridDelivery?.notes || ''),
      },
    };
    return acc;
  }, {}));
}

function buildDraftFromJob(job, serviceTypes = []) {
  if (!job) return defaultDraft();
  const cycleKey = job.kind === 'retainer'
    ? (job.currentCycleKey || todayISO().slice(0, 7))
    : null;
  const planAwareJob = ensurePlanBaselines(job, { cycleKey, serviceTypes });
  const sourcePlan = isLockedPlanningStatus(planAwareJob?.status)
    ? getCurrentPlanState(planAwareJob, { cycleKey, serviceTypes })
    : getWorkingPlanState(planAwareJob, { cycleKey, serviceTypes });
  const selectedServiceTypeIds = Array.isArray(sourcePlan?.serviceTypeIds) && sourcePlan.serviceTypeIds.length
    ? sourcePlan.serviceTypeIds
    : (Array.isArray(planAwareJob?.serviceTypeIds) ? planAwareJob.serviceTypeIds : []);
  const mergedPlan = normalizePlanState(sourcePlan, selectedServiceTypeIds);
  return normalizeDraft({
    name: planAwareJob.name || '',
    jobNumber: planAwareJob.jobNumber || getJobNumber(planAwareJob) || '1138',
    kind: planAwareJob.kind || 'project',
    isInternal: !!planAwareJob.isInternal,
    companyId: planAwareJob.companyId || '',
    personId: planAwareJob.personId || '',
    jobLeadUserId: planAwareJob.jobLeadUserId || '',
    teamUserIds: Array.isArray(planAwareJob.teamUserIds) ? planAwareJob.teamUserIds : [],
    selectedServiceTypeIds,
    billingStructure: planAwareJob.billingStructure || 'month_to_month',
    billingDurationMonths: planAwareJob.billingDurationMonths ?? null,
    startDate: planAwareJob.startDate || null,
    targetEndDate: planAwareJob.kind === 'project'
      ? (planAwareJob.targetEndDate || planAwareJob.timeline?.endDate || null)
      : null,
    timelineZoomValue: planAwareJob.timeline?.zoomValue ?? planAwareJob.timelineZoomValue ?? 62,
    plan: mergedPlan,
    deliverableDetailsById: Object.keys(planAwareJob.deliverableDetailsById || {}).length
      ? planAwareJob.deliverableDetailsById
      : buildDeliverableDetailsFromJob(planAwareJob),
  });
}

function buildDraftDeliverables(draft, existingDeliverables = [], options = {}) {
  const plan = normalizePlanState(draft.plan, draft.selectedServiceTypeIds);
  const currentCycleKey = options.currentCycleKey || null;
  const deliverables = buildDeliverablesFromPlan(plan, existingDeliverables, {
    jobKind: draft.kind,
    cycleKey: draft.kind === 'retainer' ? currentCycleKey : null,
  }).map((deliverable) => {
    const details = ensureDeliverableDetails(draft.deliverableDetailsById, deliverable.id);
    const dependencyId = String(details.dependencyRowId || '').trim();
    return {
      ...deliverable,
      description: details.description,
      internalNotes: details.internalNotes,
      deliverableType: String(details.deliverableType || '').trim() || null,
      durationValue: String(details.durationValue || ''),
      durationUnit: details.durationUnit || 'days',
      dependencyDeliverableIds: dependencyId ? [dependencyId] : [],
    };
  });

  if (draft.kind !== 'project') return deliverables;
  if (!draft.startDate) {
    return deliverables.map((deliverable) => ({
      ...deliverable,
      dueDate: deliverable?.dueDate || null,
    }));
  }

  const scheduleMap = new Map();
  let previousEnd = draft.startDate || todayISO();
  return deliverables.map((deliverable, index) => {
    const details = ensureDeliverableDetails(draft.deliverableDetailsById, deliverable.id);
    const dependency = scheduleMap.get(String(details.dependencyRowId || ''));
    const startDate = dependency
      ? addDaysISO(dependency.endDate, 1)
      : index === 0
        ? (draft.startDate || todayISO())
        : addDaysISO(previousEnd, 1);
    const durationDays = getDurationDays(details);
    const dueDate = addDaysISO(startDate, durationDays - 1);
    const next = {
      ...deliverable,
      dueDate,
    };
    scheduleMap.set(String(deliverable.id), { endDate: dueDate });
    previousEnd = dueDate;
    return next;
  });
}

function buildDraftJobPayload(draft, existingJob = null) {
  const plan = normalizePlanState(draft.plan, draft.selectedServiceTypeIds);
  const currentCycleKey = draft.kind === 'retainer'
    ? (existingJob?.currentCycleKey || todayISO().slice(0, 7))
    : null;
  const deliverables = buildDraftDeliverables(draft, existingJob?.deliverables || [], { currentCycleKey });
  const derivedTargetEndDate = draft.kind === 'project'
    ? (draft.targetEndDate || (draft.startDate ? deliverables.reduce((latest, deliverable) => {
      const dueDate = deliverable?.dueDate || null;
      return !latest || (dueDate && dueDate > latest) ? dueDate : latest;
    }, null) : null) || null)
    : null;
  return {
    id: existingJob?.id || null,
    name: String(draft.name || '').trim() || 'Untitled Job',
    jobNumber: String(draft.jobNumber || '').replace(/\D/g, '') || '1138',
    kind: draft.kind,
    status: existingJob?.status || 'pending',
    isInternal: !!draft.isInternal,
    companyId: draft.isInternal ? null : (draft.companyId || null),
    personId: draft.isInternal ? null : (draft.personId || null),
    serviceTypeIds: Array.isArray(plan.serviceTypeIds) ? plan.serviceTypeIds : [],
    plan,
    deliverableDetailsById: normalizeDeliverableDetailsMap(draft.deliverableDetailsById),
    timeline: {
      startDate: draft.startDate || null,
      endDate: draft.kind === 'project' ? derivedTargetEndDate : null,
      zoomValue: Number(draft.timelineZoomValue) || 62,
    },
    billingStructure: draft.billingStructure,
    billingDurationMonths: draft.billingDurationMonths,
    teamUserIds: Array.isArray(draft.teamUserIds) ? draft.teamUserIds : [],
    jobLeadUserId: draft.jobLeadUserId || null,
    startDate: draft.startDate || null,
    targetEndDate: draft.kind === 'project' ? derivedTargetEndDate : null,
    currentCycleKey,
    deliverables,
    unassignedTasks: Array.isArray(existingJob?.unassignedTasks) ? existingJob.unassignedTasks : [],
  };
}

function StepPill({ step, currentStep, onSelect }) {
  const isCurrent = step.index === currentStep;
  const isComplete = step.index < currentStep;
  const isFuture = step.index > currentStep;

  return h('button', {
    type: 'button',
    className: [
      'flex min-w-0 flex-1 items-center gap-3 rounded-2xl border px-3 py-3 text-left transition-colors',
      isCurrent
        ? 'border-netnet-purple/40 bg-netnet-purple/10'
        : isComplete
          ? 'border-emerald-300/70 bg-emerald-50/80 dark:border-emerald-400/30 dark:bg-emerald-500/10'
          : 'border-slate-200/80 bg-white/70 dark:border-white/10 dark:bg-white/5',
      isFuture ? 'opacity-75' : '',
    ].join(' '),
    onClick: () => onSelect(step.index),
  }, [
    h('div', {
      className: [
        'flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-semibold',
        isCurrent
          ? 'bg-netnet-purple text-white'
          : isComplete
            ? 'bg-emerald-500 text-white'
            : 'bg-slate-200 text-slate-500 dark:bg-white/10 dark:text-slate-300',
      ].join(' '),
    }, isComplete ? '✓' : `${step.displayIndex || step.index}`),
    h('div', { className: 'min-w-0' }, [
      h('div', {
        className: [
          'truncate text-sm font-semibold',
          isCurrent ? 'text-slate-900 dark:text-white' : 'text-slate-600 dark:text-slate-300',
        ].join(' '),
      }, step.label),
      h('div', { className: 'truncate text-[11px] uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500' }, step.eyebrow),
    ]),
  ]);
}

function StepFooter({ step, onBack, onNext, actions = null }) {
  return h('footer', {
    className: 'border-t border-slate-200/80 px-6 py-4 dark:border-white/10 md:px-8',
  }, [
    actions || h('div', { className: 'flex items-center justify-between gap-3' }, [
      step.backLabel
        ? h('button', {
          type: 'button',
          className: 'inline-flex h-11 items-center justify-center rounded-md border border-slate-200 bg-white px-5 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50 dark:border-white/10 dark:bg-white/5 dark:text-slate-100 dark:hover:bg-white/10',
          onClick: onBack,
        }, step.backLabel)
        : h('div'),
      h('button', {
        type: 'button',
        className: 'inline-flex h-11 items-center justify-center rounded-md bg-netnet-purple px-5 text-sm font-semibold text-white transition hover:brightness-110',
        onClick: onNext,
      }, step.nextLabel),
    ]),
  ]);
}

function SectionBlock({ title, description, children }) {
  return h('section', { className: 'space-y-4 rounded-[24px] border border-slate-200/80 bg-white/80 p-5 backdrop-blur dark:border-white/10 dark:bg-slate-950/35 md:p-6' }, [
    h('div', { className: 'space-y-1' }, [
      h('h2', { className: 'text-base font-semibold text-slate-900 dark:text-white' }, title),
      description ? h('p', { className: 'text-sm leading-6 text-slate-500 dark:text-slate-400' }, description) : null,
    ]),
    children,
  ]);
}

function FieldShell({ label, hint, required, children }) {
  return h('label', { className: 'space-y-2' }, [
    h('div', { className: 'flex items-center gap-2' }, [
      h('span', { className: 'text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400' }, label),
      required ? h('span', { className: 'text-[11px] font-semibold uppercase tracking-[0.16em] text-netnet-purple' }, 'Required') : null,
    ]),
    children,
    hint ? h('p', { className: 'text-xs leading-5 text-slate-500 dark:text-slate-400' }, hint) : null,
  ]);
}

function SegmentedToggle({ value, options = [], onChange }) {
  return h('div', { className: 'inline-flex flex-wrap items-center gap-1 rounded-full border border-slate-200 bg-white p-1 dark:border-white/10 dark:bg-slate-900' }, (options || []).map((option) => {
    const isActive = option.value === value;
    return h('button', {
      key: option.value,
      type: 'button',
      className: [
        'rounded-full px-3 py-1.5 text-sm font-semibold transition-colors',
        isActive
          ? 'bg-netnet-purple text-white shadow-sm'
          : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-white/10',
      ].join(' '),
      onClick: () => onChange(option.value),
    }, option.label);
  }));
}

function findCompanyById(companies = [], companyId) {
  if (!companyId) return null;
  return (companies || []).find((item) => String(item.id) === String(companyId)) || null;
}

function findPersonById({ companies = [], individuals = [], companyId, personId }) {
  if (!personId) return null;
  const company = findCompanyById(companies, companyId);
  const companyPerson = (company?.people || []).find((person) => String(person.id) === String(personId));
  if (companyPerson) {
    return {
      ...companyPerson,
      companyId: company?.id || null,
      companyName: company?.name || '',
      type: 'company',
    };
  }
  const standalone = (individuals || []).find((person) => String(person.id) === String(personId));
  return standalone ? { ...standalone, companyId: null, companyName: '', type: 'standalone' } : null;
}

function formatDateDisplay(iso) {
  if (!iso) return 'Select date';
  const date = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(date.getTime())) return 'Select date';
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatDraftKind(kind) {
  return kind === 'retainer' ? 'Retainer' : 'Project';
}

function isLockedPlanningStatus(status) {
  return status === 'active' || status === 'completed' || status === 'archived';
}

function formatDraftClientLabel({ draft, companies = [], individuals = [] }) {
  if (draft?.isInternal) return 'Internal';
  const company = findCompanyById(companies, draft?.companyId);
  if (company?.name) return company.name;
  const person = findPersonById({
    companies,
    individuals,
    companyId: draft?.companyId,
    personId: draft?.personId,
  });
  return person?.name || 'Client';
}

function SummaryStepBody({ draft, onDraftChange, companies = [], individuals = [], members = [], serviceTypes = [] }) {
  const companyLookupSlotRef = useRef(null);
  const companyLookupApiRef = useRef(null);
  const personLookupSlotRef = useRef(null);
  const personLookupApiRef = useRef(null);
  const datePickerCleanupRef = useRef(null);

  const selectedCompany = useMemo(
    () => findCompanyById(companies, draft.companyId),
    [companies, draft.companyId]
  );
  const selectedPerson = useMemo(
    () => findPersonById({ companies, individuals, companyId: draft.companyId, personId: draft.personId }),
    [companies, individuals, draft.companyId, draft.personId]
  );

  const updateDraft = (partial) => onDraftChange((current) => ({ ...current, ...(partial || {}) }));

  const handleJobTypeChange = (value) => {
    updateDraft({
      kind: value,
      targetEndDate: value === 'project' ? draft.targetEndDate : '',
    });
  };

  const handleBillingStructureChange = (value) => {
    updateDraft({
      billingStructure: value,
      billingDurationMonths: value === 'fixed_term' ? (draft.billingDurationMonths || 12) : null,
    });
  };

  const handleScopeChange = (value) => {
    const internal = value === 'internal';
    updateDraft({
      isInternal: internal,
      companyId: internal ? '' : draft.companyId,
      personId: internal ? '' : draft.personId,
    });
  };

  const toggleTeamMember = (memberId) => {
    const id = String(memberId);
    onDraftChange((current) => {
      const next = new Set((current.teamUserIds || []).map((item) => String(item)));
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return { ...current, teamUserIds: Array.from(next) };
    });
  };

  const toggleServiceType = (serviceTypeId) => {
    onDraftChange((current) => {
      const next = new Set(buildSelectedServiceTypeIds(current.selectedServiceTypeIds));
      const key = String(serviceTypeId);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return mergeSelectedServiceTypesIntoDraft(current, Array.from(next), serviceTypes);
    });
  };

  useEffect(() => {
    return () => {
      if (datePickerCleanupRef.current) {
        datePickerCleanupRef.current();
        datePickerCleanupRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (draft.isInternal || !companyLookupSlotRef.current) return;
    companyLookupApiRef.current = mountCompanyLookup(companyLookupSlotRef.current, {
      label: 'Company',
      placeholder: 'Search companies...',
      value: selectedCompany,
      onChange: (company) => {
        onDraftChange((current) => ({
          ...current,
          companyId: company ? String(company.id) : '',
          personId: '',
        }));
        if (personLookupApiRef.current) {
          personLookupApiRef.current.setCompany(company || null);
          personLookupApiRef.current.setValue(null);
        }
      },
    });
    return () => {
      companyLookupApiRef.current?.destroy?.();
      companyLookupApiRef.current = null;
    };
  }, [draft.isInternal]);

  useEffect(() => {
    if (draft.isInternal || !draft.companyId || !personLookupSlotRef.current) return;
    personLookupApiRef.current = mountPersonLookup(personLookupSlotRef.current, {
      label: 'Person (optional)',
      placeholder: 'Search people...',
      value: selectedPerson,
      company: selectedCompany,
      onChange: (person) => {
        updateDraft({ personId: person ? String(person.id) : '' });
      },
    });
    return () => {
      personLookupApiRef.current?.destroy?.();
      personLookupApiRef.current = null;
    };
  }, [draft.isInternal, draft.companyId]);

  const openDatePicker = (anchorEl, field) => {
    if (!anchorEl) return;
    if (datePickerCleanupRef.current) datePickerCleanupRef.current();
    datePickerCleanupRef.current = openSingleDatePickerPopover({
      anchorEl,
      value: draft[field] || '',
      onSelect: (next) => updateDraft({ [field]: next || '' }),
      onClear: () => updateDraft({ [field]: '' }),
      onClose: () => {
        datePickerCleanupRef.current = null;
      },
    });
  };

  return h('div', { className: 'w-full space-y-5 md:space-y-6' }, [
    h(SectionBlock, {
      title: 'Job Identity',
      description: 'Set the core identity for this job. Changes save as soon as you make them.',
    }, h('div', { className: 'grid gap-4 md:grid-cols-2' }, [
      h('div', { className: 'md:col-span-2' }, [
        h(FieldShell, { label: 'Job Name' }, h('input', {
          type: 'text',
          value: draft.name,
          onChange: (event) => updateDraft({ name: event.target.value }),
          placeholder: 'e.g. Website Refresh',
          className: 'h-11 w-full rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-800 dark:border-white/10 dark:bg-slate-900 dark:text-white',
        })),
      ]),
      h(FieldShell, { label: 'Job Number' }, h('input', {
        type: 'number',
        min: '0',
        step: '1',
        value: draft.jobNumber,
        onChange: (event) => updateDraft({ jobNumber: String(event.target.value || '').replace(/\D/g, '') }),
        className: 'h-11 w-full rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-800 dark:border-white/10 dark:bg-slate-900 dark:text-white',
      })),
      h(FieldShell, { label: 'Job Type' }, h(SegmentedToggle, {
        value: draft.kind,
        options: [
          { value: 'project', label: 'Project' },
          { value: 'retainer', label: 'Retainer' },
        ],
        onChange: handleJobTypeChange,
      })),
    ])),
    h(SectionBlock, {
      title: 'Client / Internal',
      description: 'Control whether this work is for a client or for internal operations.',
    }, h('div', { className: 'space-y-4' }, [
      h(FieldShell, { label: 'Client vs Internal' }, h(SegmentedToggle, {
        value: draft.isInternal ? 'internal' : 'client',
        options: [
          { value: 'client', label: 'Client' },
          { value: 'internal', label: 'Internal' },
        ],
        onChange: handleScopeChange,
      })),
      !draft.isInternal
        ? h('div', { className: 'grid gap-4 md:grid-cols-2' }, [
          h('div', { ref: companyLookupSlotRef }),
          draft.companyId
            ? h('div', { ref: personLookupSlotRef })
            : h(FieldShell, { label: 'Person', hint: 'Select a company first.' }, h('div', {
              className: 'flex h-11 items-center rounded-md border border-slate-200 bg-slate-50 px-3 text-sm text-slate-400 dark:border-white/10 dark:bg-slate-900/60 dark:text-slate-500',
            }, 'Select a company first')),
        ])
        : null,
    ])),
    h(SectionBlock, {
      title: 'Team',
      description: 'Choose the internal lead and the team members who should be associated with this job.',
    }, h('div', { className: 'space-y-4' }, [
      h(FieldShell, { label: 'Job Lead', required: true }, h('select', {
        value: draft.jobLeadUserId,
        onChange: (event) => updateDraft({ jobLeadUserId: event.target.value }),
        className: 'h-11 w-full rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-700 dark:border-white/10 dark:bg-slate-900 dark:text-slate-200',
      }, [
        h('option', { value: '' }, 'Select a job lead'),
        ...(members || []).map((member) => h('option', { key: member.id, value: String(member.id) }, member.name || member.email || 'Member')),
      ])),
      h(FieldShell, { label: 'Team Members' }, h('div', { className: 'grid gap-2 sm:grid-cols-2' }, (members || []).map((member) => (
        h('label', {
          key: member.id,
          className: 'flex items-center gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2 dark:border-white/10 dark:bg-slate-900',
        }, [
          h('input', {
            type: 'checkbox',
            checked: (draft.teamUserIds || []).some((id) => String(id) === String(member.id)),
            onChange: () => toggleTeamMember(member.id),
            className: 'h-4 w-4 rounded border-slate-300 text-netnet-purple focus:ring-netnet-purple dark:border-white/20',
          }),
          h('div', { className: 'flex min-w-0 flex-col' }, [
            h('span', { className: 'truncate text-sm font-medium text-slate-700 dark:text-slate-200' }, member.name || member.email || 'Member'),
            member.email ? h('span', { className: 'truncate text-xs text-slate-500 dark:text-slate-400' }, member.email) : null,
          ]),
        ])
      )))),
    ])),
    h(SectionBlock, {
      title: 'Service Types',
      description: 'Select the disciplines that should appear in the planning grid on the next step.',
    }, (serviceTypes || []).length
      ? h('div', { className: 'grid gap-2 sm:grid-cols-2' }, (serviceTypes || []).map((serviceType) => (
        h('label', {
          key: serviceType.id,
          className: 'flex items-center gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2 dark:border-white/10 dark:bg-slate-900',
        }, [
          h('input', {
            type: 'checkbox',
            checked: (draft.selectedServiceTypeIds || []).includes(String(serviceType.id)),
            onChange: () => toggleServiceType(serviceType.id),
            className: 'h-4 w-4 rounded border-slate-300 text-netnet-purple focus:ring-netnet-purple dark:border-white/20',
          }),
          h('div', { className: 'flex min-w-0 flex-col' }, [
            h('span', { className: 'truncate text-sm font-medium text-slate-700 dark:text-slate-200' }, serviceType.name || serviceType.id),
            h('span', { className: 'truncate text-xs text-slate-500 dark:text-slate-400' }, serviceType.billable === false ? 'Non-billable' : 'Billable'),
          ]),
        ])
      )))
      : h('div', { className: 'rounded-lg border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-sm text-slate-500 dark:border-white/10 dark:bg-slate-900/60 dark:text-slate-400' }, 'No active Service Types are available yet.')),
    draft.kind === 'retainer'
      ? h(SectionBlock, {
        title: 'Billing Structure',
        description: 'Define how this retainer should be scoped commercially.',
      }, h('div', { className: 'grid gap-4 md:grid-cols-2' }, [
        h(FieldShell, { label: 'Structure' }, h(SegmentedToggle, {
          value: draft.billingStructure,
          options: [
            { value: 'month_to_month', label: 'Month-to-month' },
            { value: 'fixed_term', label: 'Fixed term' },
          ],
          onChange: handleBillingStructureChange,
        })),
        draft.billingStructure === 'fixed_term'
          ? h(FieldShell, { label: 'Length (months)' }, h('input', {
            type: 'number',
            min: '1',
            step: '1',
            value: draft.billingDurationMonths ?? '',
            onChange: (event) => updateDraft({
              billingDurationMonths: event.target.value === '' ? null : Math.max(1, Number(event.target.value) || 1),
            }),
            className: 'h-11 w-full rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-800 dark:border-white/10 dark:bg-slate-900 dark:text-white',
            placeholder: '12',
          }))
          : h('div'),
      ]))
      : null,
    h(SectionBlock, {
      title: 'Dates',
      description: 'Anchor the job with a start date and, for project work, a target end date.',
    }, h('div', { className: 'grid gap-4 md:grid-cols-2' }, [
      h(FieldShell, { label: 'Start Date' }, h('button', {
        type: 'button',
        className: 'flex h-11 w-full items-center justify-between rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-700 dark:border-white/10 dark:bg-slate-900 dark:text-slate-200',
        onClick: (event) => openDatePicker(event.currentTarget, 'startDate'),
      }, [
        h('span', null, formatDateDisplay(draft.startDate)),
        h('svg', { viewBox: '0 0 24 24', className: 'h-5 w-5 text-slate-400', fill: 'none', stroke: 'currentColor', strokeWidth: '2' }, [
          h('rect', { x: '3', y: '4', width: '18', height: '18', rx: '2' }),
          h('line', { x1: '16', y1: '2', x2: '16', y2: '6' }),
          h('line', { x1: '8', y1: '2', x2: '8', y2: '6' }),
          h('line', { x1: '3', y1: '10', x2: '21', y2: '10' }),
        ]),
      ])),
      draft.kind === 'project'
        ? h(FieldShell, { label: 'Target End Date' }, h('button', {
          type: 'button',
          className: 'flex h-11 w-full items-center justify-between rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-700 dark:border-white/10 dark:bg-slate-900 dark:text-slate-200',
          onClick: (event) => openDatePicker(event.currentTarget, 'targetEndDate'),
        }, [
          h('span', null, formatDateDisplay(draft.targetEndDate)),
          h('svg', { viewBox: '0 0 24 24', className: 'h-5 w-5 text-slate-400', fill: 'none', stroke: 'currentColor', strokeWidth: '2' }, [
            h('rect', { x: '3', y: '4', width: '18', height: '18', rx: '2' }),
            h('line', { x1: '16', y1: '2', x2: '16', y2: '6' }),
            h('line', { x1: '8', y1: '2', x2: '8', y2: '6' }),
            h('line', { x1: '3', y1: '10', x2: '21', y2: '10' }),
          ]),
        ]))
        : null,
    ])),
  ]);
}

function DeliverablesStepBody({ draft, onDraftChange, serviceTypes = [], stickyHeaderOffset = 0, jobStatus = 'pending', readOnly = false }) {
  const selectedServiceTypeIds = buildSelectedServiceTypeIds(draft.selectedServiceTypeIds);
  const [detailsRowId, setDetailsRowId] = useState(null);
  const [deliverableTypeOptions, setDeliverableTypeOptions] = useState(() => loadDeliverableTypeOptions());
  const plan = normalizePlanState(draft.plan, draft.selectedServiceTypeIds);
  const historyRef = useRef({ undo: [], redo: [] });
  const suppressHistoryRef = useRef(false);

  if (!selectedServiceTypeIds.length) {
    return h('div', { className: 'flex min-h-[420px] items-center justify-center rounded-[28px] border border-dashed border-slate-200 bg-white/70 px-6 py-16 text-center dark:border-white/10 dark:bg-slate-950/25' }, [
      h('p', { className: 'max-w-md text-base leading-8 text-slate-500 dark:text-slate-400' }, 'Select Service Types in Step 1 to begin planning.'),
    ]);
  }

  const currentSnapshot = () => ({
    plan: normalizePlanState(draft.plan, draft.selectedServiceTypeIds),
    deliverableDetailsById: normalizeDeliverableDetailsMap(draft.deliverableDetailsById),
  });

  const stageHistory = () => {
    if (suppressHistoryRef.current) return;
    historyRef.current.undo.push(currentSnapshot());
    if (historyRef.current.undo.length > 50) historyRef.current.undo.shift();
    historyRef.current.redo = [];
  };

  const applySnapshot = (snapshot, direction) => {
    if (!snapshot) return;
    const current = currentSnapshot();
    if (direction === 'undo') historyRef.current.redo.push(current);
    if (direction === 'redo') historyRef.current.undo.push(current);
    suppressHistoryRef.current = true;
    onDraftChange((draftCurrent) => ({
      ...draftCurrent,
      plan: normalizePlanState(snapshot.plan, draftCurrent.selectedServiceTypeIds),
      deliverableDetailsById: normalizeDeliverableDetailsMap(snapshot.deliverableDetailsById),
    }));
    setDetailsRowId((currentOpen) => (
      currentOpen && !(snapshot.plan?.rows || []).some((row) => row.id === currentOpen) ? null : currentOpen
    ));
  };

  useEffect(() => {
    if (!suppressHistoryRef.current) return;
    suppressHistoryRef.current = false;
  }, [draft.plan, draft.deliverableDetailsById]);

  const handlePlanChange = (nextPlan) => {
    stageHistory();
    onDraftChange((current) => ({
      ...current,
      plan: normalizePlanState(nextPlan, current.selectedServiceTypeIds),
      deliverableDetailsById: Object.keys(current.deliverableDetailsById || {}).reduce((acc, key) => {
        if ((nextPlan?.rows || []).some((row) => String(row.id) === String(key))) acc[key] = current.deliverableDetailsById[key];
        return acc;
      }, {}),
    }));
  };

  const handleAddServiceType = (name) => {
    stageHistory();
    onDraftChange((current) => {
      const currentPlan = normalizePlanState(current.plan, current.selectedServiceTypeIds);
      const nextId = createDraftId('svc');
      const nextIds = [...currentPlan.serviceTypeIds, nextId];
      return {
        ...current,
        plan: {
          serviceTypeIds: nextIds,
          serviceTypeNames: {
            ...(currentPlan.serviceTypeNames || {}),
            [nextId]: name,
          },
          rows: syncRowsWithServiceTypes(currentPlan.rows || [], nextIds),
        },
      };
    });
  };

  useEffect(() => {
    if (!detailsRowId) return;
    if (!(plan.rows || []).some((row) => row.id === detailsRowId)) {
      setDetailsRowId(null);
    }
  }, [detailsRowId, plan.rows]);

  const undoDisabled = historyRef.current.undo.length === 0;
  const redoDisabled = historyRef.current.redo.length === 0;

  const historyButtons = h('div', { className: 'flex items-center gap-2' }, [
    h('button', {
      type: 'button',
      className: `inline-flex h-10 w-10 items-center justify-center rounded-md border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-950/40 text-slate-700 dark:text-slate-100 hover:bg-slate-50 dark:hover:bg-white/5 ${undoDisabled ? 'opacity-50 pointer-events-none' : ''}`,
      onClick: () => applySnapshot(historyRef.current.undo.pop(), 'undo'),
      disabled: undoDisabled,
      title: 'Undo',
      'aria-label': 'Undo',
    }, h('svg', { viewBox: '0 0 24 24', className: 'h-4 w-4', fill: 'none', stroke: 'currentColor', strokeWidth: '1.8' }, [
      h('path', { d: 'M9 7l-5 5 5 5' }),
      h('path', { d: 'M20 17a7 7 0 0 0-7-7H4' }),
    ])),
    h('button', {
      type: 'button',
      className: `inline-flex h-10 w-10 items-center justify-center rounded-md border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-950/40 text-slate-700 dark:text-slate-100 hover:bg-slate-50 dark:hover:bg-white/5 ${redoDisabled ? 'opacity-50 pointer-events-none' : ''}`,
      onClick: () => applySnapshot(historyRef.current.redo.pop(), 'redo'),
      disabled: redoDisabled,
      title: 'Redo',
      'aria-label': 'Redo',
    }, h('svg', { viewBox: '0 0 24 24', className: 'h-4 w-4', fill: 'none', stroke: 'currentColor', strokeWidth: '1.8' }, [
      h('path', { d: 'M15 7l5 5-5 5' }),
      h('path', { d: 'M4 17a7 7 0 0 1 7-7h9' }),
    ])),
  ]);

  const renderHybridSummary = (row) => {
    const details = ensureDeliverableDetails(draft.deliverableDetailsById, row.id);
    const typeLabel = String(details.deliverableType || '').trim();
    const hybrid = details.hybridDelivery || {};
    const summaryItems = [];
    if (typeLabel) {
      summaryItems.push(h('div', {
        key: 'type',
        className: 'truncate text-[11px] font-medium text-slate-500 dark:text-slate-400',
      }, `→ ${typeLabel}`));
    }
    if (jobStatus !== 'active' || !hybrid.enabled) {
      return summaryItems.length ? h('div', { className: 'mt-1 space-y-0.5' }, summaryItems) : null;
    }
    const safeHours = hybrid.estimatedHours;
    const summaryText = safeHours !== null && safeHours !== undefined && safeHours !== ''
      ? `Agent-assisted • ~${formatLargeHours(safeHours)} hrs AI contribution`
      : 'Agent-assisted';
    summaryItems.push(h('div', {
      key: 'hybrid',
      className: 'truncate text-[11px] font-medium text-slate-500 dark:text-slate-400',
    }, summaryText));
    return h('div', { className: 'mt-1 space-y-0.5' }, summaryItems);
  };

  return h(React.Fragment, null, [
    h(JobPlanEditor, {
      plan,
      onPlanChange: handlePlanChange,
      serviceTypes,
      emptyStateMessage: 'Select Service Types in Step 1 to begin planning.',
      title: draft.kind === 'retainer' ? 'Monthly Work Plan' : 'Deliverables + LOE',
      subtitle: draft.kind === 'retainer'
        ? 'All hours are per month'
        : 'Set up deliverables, assign hours by service type, and let totals update instantly as you plan.',
      rowTotalLabel: draft.kind === 'retainer' ? 'Monthly Hours' : 'Total Hours',
      footerTotalsLabel: draft.kind === 'retainer' ? 'Monthly Total' : 'Totals',
      allowServiceTypeCreate: true,
      serviceTypeActionLabel: '+ Add Service Type',
      onAddServiceType: handleAddServiceType,
      headerActions: readOnly ? null : historyButtons,
      readOnly,
      stickyHeaderOffset,
      showRowDetailsAction: true,
      activeRowDetailsId: detailsRowId,
      onOpenRowDetails: (rowId) => setDetailsRowId((current) => (current === rowId ? null : rowId)),
      onDeliverableCreated: () => setDetailsRowId(null),
      renderExpandedRow: (row) => h(DeliverableExpandedRow, {
        row,
        details: ensureDeliverableDetails(draft.deliverableDetailsById, row.id),
        deliverables: plan.rows || [],
        jobKind: draft.kind,
        jobStatus,
        deliverableTypeOptions,
        onRememberDeliverableType: (value) => setDeliverableTypeOptions((current) => rememberDeliverableType(value, current)),
        onChange: (patch) => {
          stageHistory();
          setDetailsRowId(row.id);
          onDraftChange((current) => ({
            ...current,
            deliverableDetailsById: {
              ...(current.deliverableDetailsById || {}),
              [row.id]: {
                ...ensureDeliverableDetails(current.deliverableDetailsById, row.id),
                ...(patch || {}),
              },
            },
          }));
        },
      }),
      renderRowSummary: renderHybridSummary,
    }),
  ]);
}

function DeliverableExpandedRow({
  row,
  details,
  deliverables = [],
  jobKind = 'project',
  jobStatus = 'pending',
  deliverableTypeOptions = [],
  onRememberDeliverableType = null,
  onChange,
}) {
  const isRetainer = jobKind === 'retainer';
  const showHybridDelivery = jobStatus === 'active';
  const hybridDelivery = details.hybridDelivery || { enabled: false, estimatedHours: null, notes: '' };
  return h('div', {
    className: 'grid gap-4 p-4 md:p-5 transition-all duration-200 ease-out',
  }, [
    h(TaskStyleRichTextField, {
      label: 'Description',
      value: details.description || '',
      onChange: (value) => onChange?.({ description: value }),
      rows: 5,
      footerText: 'Auto-saves on change',
    }),
    !isRetainer
      ? h('div', { className: 'grid gap-4 md:grid-cols-2' }, [
        h('div', { className: 'rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-slate-900 p-3 space-y-3' }, [
          h('div', { className: 'text-[11px] uppercase tracking-wide text-slate-500 dark:text-slate-400' }, 'Duration'),
          h('div', { className: 'grid gap-3 sm:grid-cols-[0.95fr_1.05fr]' }, [
            h('input', {
              type: 'number',
              min: '0',
              step: '1',
              value: details.durationValue || '',
              onChange: (event) => onChange?.({ durationValue: String(event.target.value || '').replace(/[^\d.]/g, '') }),
              className: 'h-10 w-full rounded-md border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 px-3 text-sm text-slate-800 dark:text-white',
            }),
            h(SegmentedToggle, {
              value: details.durationUnit || 'days',
              options: [
                { value: 'days', label: 'Days' },
                { value: 'weeks', label: 'Weeks' },
                { value: 'months', label: 'Months' },
              ],
              onChange: (value) => onChange?.({ durationUnit: value }),
            }),
          ]),
        ]),
        h('div', { className: 'rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-slate-900 p-3 space-y-3' }, [
          h('div', { className: 'text-[11px] uppercase tracking-wide text-slate-500 dark:text-slate-400' }, 'Dependency'),
          h('select', {
            value: details.dependencyRowId || '',
            onChange: (event) => onChange?.({ dependencyRowId: event.target.value || '' }),
            className: 'h-10 w-full rounded-md border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 px-3 text-sm text-slate-700 dark:text-slate-200',
          }, [
            h('option', { value: '' }, 'No dependency'),
            ...(deliverables || [])
              .filter((item) => item.id !== row.id)
              .map((item) => h('option', { key: item.id, value: item.id }, item.name || 'Untitled Deliverable')),
          ]),
        ]),
      ])
      : null,
    h(TaskStyleRichTextField, {
      label: 'Internal Notes',
      value: details.internalNotes || '',
      onChange: (value) => onChange?.({ internalNotes: value }),
      rows: 4,
      footerText: 'Auto-saves on change',
      muted: true,
    }),
    h('div', { className: 'rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-slate-900 p-3 space-y-3' }, [
      h('div', { className: 'text-[11px] uppercase tracking-wide text-slate-500 dark:text-slate-400' }, 'Deliverable Type'),
      h('div', { className: 'space-y-2' }, [
        h('input', {
          type: 'text',
          list: `deliverable-type-options-${row.id}`,
          value: details.deliverableType || '',
          placeholder: 'e.g. Website Build, SEO Sprint',
          onChange: (event) => onChange?.({ deliverableType: event.target.value }),
          onBlur: (event) => onRememberDeliverableType?.(event.target.value),
          onKeyDown: (event) => {
            if (event.key === 'Enter') {
              onRememberDeliverableType?.(event.currentTarget.value);
            }
          },
          className: 'h-10 w-full rounded-md border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 px-3 text-sm text-slate-800 dark:text-white',
        }),
        h('datalist', { id: `deliverable-type-options-${row.id}` },
          (deliverableTypeOptions || []).map((option) => h('option', { key: option, value: option }))
        ),
        h('div', { className: 'text-xs text-slate-500 dark:text-slate-400' }, 'Group similar deliverables across jobs'),
      ]),
    ]),
    showHybridDelivery
      ? h('div', { className: 'rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-slate-900 p-4 space-y-4' }, [
        h('div', { className: 'space-y-1' }, [
          h('div', { className: 'text-sm font-semibold text-slate-900 dark:text-white' }, 'Hybrid Delivery'),
        ]),
        h('div', { className: 'flex items-start justify-between gap-4 rounded-lg border border-slate-200/80 bg-white/70 px-3 py-3 dark:border-white/10 dark:bg-slate-950/40' }, [
          h('div', { className: 'space-y-1' }, [
            h('div', { className: 'text-sm font-medium text-slate-900 dark:text-white' }, 'Agent-assisted'),
            !hybridDelivery.enabled
              ? h('div', { className: 'text-xs text-slate-500 dark:text-slate-400' }, 'No AI-assisted work recorded')
              : h('div', { className: 'text-xs text-slate-500 dark:text-slate-400' }, 'Track lightweight AI contribution without affecting LOE planning.'),
          ]),
          h('label', { className: 'relative inline-flex cursor-pointer items-center' }, [
            h('input', {
              type: 'checkbox',
              className: 'peer sr-only',
              checked: !!hybridDelivery.enabled,
              onChange: (event) => onChange?.({
                hybridDelivery: {
                  ...hybridDelivery,
                  enabled: !!event.target.checked,
                },
              }),
            }),
            h('span', {
              className: 'h-6 w-11 rounded-full bg-slate-300 transition-colors peer-checked:bg-netnet-purple dark:bg-slate-700',
            }),
            h('span', {
              className: 'pointer-events-none absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform peer-checked:translate-x-5',
            }),
          ]),
        ]),
        hybridDelivery.enabled
          ? h('div', { className: 'grid gap-4 md:grid-cols-2' }, [
            h('div', { className: 'space-y-2' }, [
              h('label', { className: 'text-[11px] uppercase tracking-wide text-slate-500 dark:text-slate-400' }, 'Estimated AI contribution (hours)'),
              h('input', {
                type: 'number',
                min: '0',
                step: '0.25',
                value: hybridDelivery.estimatedHours ?? '',
                placeholder: 'Optional',
                onChange: (event) => {
                  const raw = String(event.target.value || '').trim();
                  onChange?.({
                    hybridDelivery: {
                      ...hybridDelivery,
                      estimatedHours: raw === '' ? null : Number(raw),
                    },
                  });
                },
                className: 'h-10 w-full rounded-md border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 px-3 text-sm text-slate-800 dark:text-white',
              }),
              h('div', { className: 'text-xs text-slate-500 dark:text-slate-400' }, 'Rough estimate of work completed with AI assistance'),
            ]),
            h('div', { className: 'space-y-2' }, [
              h('label', { className: 'text-[11px] uppercase tracking-wide text-slate-500 dark:text-slate-400' }, 'Notes'),
              h('textarea', {
                value: hybridDelivery.notes || '',
                placeholder: 'What did the AI help with?',
                rows: 4,
                onChange: (event) => onChange?.({
                  hybridDelivery: {
                    ...hybridDelivery,
                    notes: event.target.value,
                  },
                }),
                className: 'w-full rounded-md border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 px-3 py-2 text-sm text-slate-800 dark:text-white',
              }),
            ]),
          ])
          : null,
      ])
      : null,
  ]);
}

function TimelineStepBody({ draft, onDraftChange, stickyHeaderOffset = 0 }) {
  const datePickerCleanupRef = useRef(null);
  const timelineBodyScrollRef = useRef(null);
  const plan = normalizePlanState(draft.plan, draft.selectedServiceTypeIds);
  const deliverables = plan.rows || [];
  const [timelineStartDate, setTimelineStartDate] = useState(() => draft.startDate || '');
  const [timelineEndDate, setTimelineEndDate] = useState(() => draft.targetEndDate || '');
  const [zoomValue, setZoomValue] = useState(() => Number(draft.timelineZoomValue) || 62);
  const [timelineScrollLeft, setTimelineScrollLeft] = useState(0);
  const updateZoomValue = (nextValue) => {
    const safeValue = Math.max(0, Math.min(100, Math.round(Number(nextValue) || 0)));
    setZoomValue(safeValue);
    onDraftChange?.({ timelineZoomValue: safeValue });
  };

  useEffect(() => () => {
    if (datePickerCleanupRef.current) {
      datePickerCleanupRef.current();
      datePickerCleanupRef.current = null;
    }
  }, []);

  const openDatePicker = (anchorEl, value, onSelect) => {
    if (!anchorEl) return;
    if (datePickerCleanupRef.current) datePickerCleanupRef.current();
    datePickerCleanupRef.current = openSingleDatePickerPopover({
      anchorEl,
      value: value || '',
      onSelect: (next) => onSelect(next || ''),
      onClear: () => onSelect(''),
      onClose: () => {
        datePickerCleanupRef.current = null;
      },
    });
  };

  const zoomConfig = useMemo(() => getTimelineZoomConfig(zoomValue), [zoomValue]);
  const effectiveTimelineStart = timelineStartDate || draft.startDate || todayISO();
  const effectiveTimelineFinish = timelineEndDate || draft.targetEndDate || '';
  const schedule = useMemo(() => {
    const rows = [];
    const scheduleMap = new Map();
    let previousEnd = effectiveTimelineStart;
    deliverables.forEach((row, index) => {
      const details = ensureDeliverableDetails(draft.deliverableDetailsById, row.id);
      const dependency = scheduleMap.get(String(details.dependencyRowId || ''));
      const startDate = dependency
        ? addDaysISO(dependency.endDate, 1)
        : index === 0
          ? effectiveTimelineStart
          : addDaysISO(previousEnd, 1);
      const durationDays = getDurationDays(details);
      const endDate = addDaysISO(startDate, durationDays - 1);
      const item = {
        row,
        details,
        startDate,
        endDate,
        durationDays,
      };
      rows.push(item);
      scheduleMap.set(String(row.id), item);
      previousEnd = endDate;
    });
    return rows;
  }, [deliverables, draft.deliverableDetailsById, effectiveTimelineStart]);

  const maxEndDate = useMemo(
    () => schedule.reduce((latest, item) => (!latest || item.endDate > latest ? item.endDate : latest), timelineEndDate || effectiveTimelineStart),
    [schedule, timelineEndDate, effectiveTimelineStart]
  );
  const rangeStart = addDaysISO(effectiveTimelineStart, -2);
  const rangeEnd = addDaysISO((effectiveTimelineFinish && effectiveTimelineFinish > maxEndDate) ? effectiveTimelineFinish : maxEndDate, 2);
  const rangeDays = Math.max(1, diffDays(rangeStart, rangeEnd) + 1);
  const timelineWidth = Math.max(860, Math.round(rangeDays * zoomConfig.pxPerDay));
  const timelineBodyHeight = schedule.length * TIMELINE_ROW_HEIGHT;
  const shouldRenderStartColumn = Boolean(timelineStartDate || draft.startDate);
  const shouldRenderFinishColumn = Boolean(timelineEndDate || draft.targetEndDate);
  const startLineOffset = effectiveTimelineStart ? diffDays(rangeStart, effectiveTimelineStart) * zoomConfig.pxPerDay : null;
  const finishLineOffset = effectiveTimelineFinish ? diffDays(rangeStart, effectiveTimelineFinish) * zoomConfig.pxPerDay : null;

  useEffect(() => {
    const node = timelineBodyScrollRef.current;
    if (!node) return;
    const viewportWidth = Math.max(0, node.clientWidth - TIMELINE_LEFT_COL_WIDTH);
    if (viewportWidth <= 0) return;
    const targetOffset = shouldRenderFinishColumn && finishLineOffset !== null
      ? finishLineOffset
      : shouldRenderStartColumn && startLineOffset !== null
        ? startLineOffset
        : null;
    if (targetOffset === null) return;
    const desired = Math.max(0, Math.min(targetOffset - (viewportWidth * 0.68), Math.max(0, timelineWidth - viewportWidth)));
    node.scrollLeft = desired;
    setTimelineScrollLeft(desired);
  }, [
    finishLineOffset,
    shouldRenderFinishColumn,
    startLineOffset,
    shouldRenderStartColumn,
    timelineWidth,
    zoomValue,
  ]);

  const ticks = useMemo(() => {
    const items = [];
    for (let offset = 0; offset <= rangeDays; offset += zoomConfig.tickStep) {
      items.push({
        date: addDaysISO(rangeStart, offset),
        offset: offset * zoomConfig.pxPerDay,
      });
    }
    if (!items.length || items[items.length - 1].offset < timelineWidth) {
      items.push({ date: rangeEnd, offset: timelineWidth });
    }
    return items;
  }, [rangeDays, rangeStart, rangeEnd, timelineWidth, zoomConfig.pxPerDay, zoomConfig.tickStep]);

  const connectors = useMemo(() => {
    const byId = new Map(schedule.map((item, index) => [String(item.row.id), { ...item, index }]));
    return schedule.flatMap((item, index) => {
      const dependencyId = String(item.details?.dependencyRowId || '');
      const dependency = byId.get(dependencyId);
      if (!dependency) return [];
      const sourceX = (diffDays(rangeStart, dependency.endDate) + 1) * zoomConfig.pxPerDay;
      const targetX = diffDays(rangeStart, item.startDate) * zoomConfig.pxPerDay;
      const sourceY = (dependency.index * TIMELINE_ROW_HEIGHT) + (TIMELINE_ROW_HEIGHT / 2);
      const targetY = (index * TIMELINE_ROW_HEIGHT) + (TIMELINE_ROW_HEIGHT / 2);
      const controlOffset = Math.max(28, Math.abs(targetX - sourceX) * 0.4);
      const d = `M ${sourceX} ${sourceY} C ${sourceX + controlOffset} ${sourceY}, ${targetX - controlOffset} ${targetY}, ${targetX} ${targetY}`;
      return [{ key: `${dependency.row.id}-${item.row.id}`, d }];
    });
  }, [schedule, rangeStart, zoomConfig.pxPerDay]);

  const zoomButtons = h('div', { className: 'inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-1 py-1 dark:border-white/10 dark:bg-slate-900' }, (
    TIMELINE_ZOOM_PRESETS.map((preset) => {
      const isActive = getTimelineZoomMode(zoomValue) === preset.value;
      return h('button', {
        key: preset.value,
        type: 'button',
        className: [
          'rounded-full px-3 py-1.5 text-xs font-semibold transition-colors',
          isActive
            ? 'bg-netnet-purple text-white shadow-sm'
            : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-white/10',
        ].join(' '),
        onClick: () => updateZoomValue(preset.slider),
      }, preset.label);
    })
  ));

  if (!deliverables.length) {
    return h('div', { className: 'space-y-5' }, [
      h('div', { className: 'flex flex-wrap items-center justify-between gap-3 rounded-[24px] border border-slate-200/80 bg-white/80 p-5 backdrop-blur dark:border-white/10 dark:bg-slate-950/35' }, [
        h('div', { className: 'grid gap-3 sm:grid-cols-2 lg:grid-cols-[180px_180px]' }, [
          h(FieldShell, { label: 'Start Date' }, h('button', {
            type: 'button',
            className: 'flex h-10 w-full items-center justify-between rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-700 dark:border-white/10 dark:bg-slate-900 dark:text-slate-200',
            onClick: (event) => openDatePicker(event.currentTarget, timelineStartDate, (next) => {
              setTimelineStartDate(next);
              onDraftChange?.({ startDate: next });
            }),
          }, [h('span', null, formatLongDate(timelineStartDate))])),
          h(FieldShell, { label: 'End Date' }, h('button', {
            type: 'button',
            className: 'flex h-10 w-full items-center justify-between rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-700 dark:border-white/10 dark:bg-slate-900 dark:text-slate-200',
            onClick: (event) => openDatePicker(event.currentTarget, timelineEndDate, (next) => {
              setTimelineEndDate(next);
              onDraftChange?.({ targetEndDate: next });
            }),
          }, [h('span', null, formatLongDate(timelineEndDate))])),
        ]),
        h('div', { className: 'flex min-w-[260px] flex-1 flex-col gap-3' }, [
          zoomButtons,
          h('input', {
            type: 'range',
            min: '0',
            max: '100',
            step: '1',
            value: zoomValue,
            onChange: (event) => updateZoomValue(Number(event.target.value || 0)),
            className: 'w-full accent-netnet-purple',
          }),
        ]),
      ]),
      h('div', { className: 'flex min-h-[420px] items-center justify-center rounded-[28px] border border-dashed border-slate-200 bg-white/70 px-6 py-16 text-center dark:border-white/10 dark:bg-slate-950/25' }, [
        h('p', { className: 'max-w-md text-base leading-8 text-slate-500 dark:text-slate-400' }, 'Add deliverables in Step 2 to build timeline.'),
      ]),
    ]);
  }

  return h('div', { className: 'space-y-5' }, [
    h('style', null, `
      .timeline-step-scroll::-webkit-scrollbar {
        height: 4px;
      }
      .timeline-step-scroll::-webkit-scrollbar-track {
        background: transparent;
      }
      .timeline-step-scroll::-webkit-scrollbar-thumb {
        background: rgba(148, 163, 184, 0.35);
        border-radius: 999px;
      }
    `),
    h('div', {
      className: 'sticky z-30 -mb-px overflow-hidden rounded-[28px] border border-slate-200/80 bg-white shadow-sm dark:border-white/10 dark:bg-slate-950',
      style: { top: `${stickyHeaderOffset}px` },
    }, [
      h('div', { className: 'flex flex-wrap items-center justify-between gap-3 bg-white p-5 dark:bg-slate-950' }, [
        h('div', { className: 'grid gap-3 sm:grid-cols-2 lg:grid-cols-[180px_180px]' }, [
          h(FieldShell, { label: 'Start Date' }, h('button', {
            type: 'button',
            className: 'flex h-10 w-full items-center justify-between rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-700 dark:border-white/10 dark:bg-slate-900 dark:text-slate-200',
            onClick: (event) => openDatePicker(event.currentTarget, timelineStartDate, (next) => {
              setTimelineStartDate(next);
              onDraftChange?.({ startDate: next });
            }),
          }, [
            h('span', null, formatLongDate(timelineStartDate)),
            h('svg', { viewBox: '0 0 24 24', className: 'h-4 w-4 text-slate-400', fill: 'none', stroke: 'currentColor', strokeWidth: '2' }, [
              h('rect', { x: '3', y: '4', width: '18', height: '18', rx: '2' }),
              h('line', { x1: '16', y1: '2', x2: '16', y2: '6' }),
              h('line', { x1: '8', y1: '2', x2: '8', y2: '6' }),
            ]),
          ])),
          h(FieldShell, { label: 'End Date' }, h('button', {
            type: 'button',
            className: 'flex h-10 w-full items-center justify-between rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-700 dark:border-white/10 dark:bg-slate-900 dark:text-slate-200',
            onClick: (event) => openDatePicker(event.currentTarget, timelineEndDate, (next) => {
              setTimelineEndDate(next);
              onDraftChange?.({ targetEndDate: next });
            }),
          }, [
            h('span', null, formatLongDate(timelineEndDate)),
            h('svg', { viewBox: '0 0 24 24', className: 'h-4 w-4 text-slate-400', fill: 'none', stroke: 'currentColor', strokeWidth: '2' }, [
              h('rect', { x: '3', y: '4', width: '18', height: '18', rx: '2' }),
              h('line', { x1: '16', y1: '2', x2: '16', y2: '6' }),
              h('line', { x1: '8', y1: '2', x2: '8', y2: '6' }),
            ]),
          ])),
        ]),
        h('div', { className: 'flex min-w-[320px] flex-1 flex-col items-stretch gap-3 lg:max-w-[420px]' }, [
          zoomButtons,
          h('div', { className: 'flex items-center gap-3' }, [
            h('span', { className: 'text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500' }, 'Scale'),
            h('input', {
              type: 'range',
              min: '0',
              max: '100',
              step: '1',
              value: zoomValue,
              onChange: (event) => updateZoomValue(Number(event.target.value || 0)),
              className: 'w-full accent-netnet-purple',
            }),
          ]),
        ]),
      ]),
      h('div', { className: 'max-w-full overflow-hidden border-t border-slate-200/80 bg-slate-950 dark:border-white/10 dark:bg-slate-950' }, [
        h('div', {
          className: 'relative z-20 flex overflow-hidden border-b border-white/10 bg-slate-900/95 shadow-sm',
          style: { minHeight: `${TIMELINE_HEADER_HEIGHT}px` },
        }, [
          h('div', {
            className: 'flex shrink-0 items-center border-r border-white/10 bg-slate-900/95 px-4 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400',
            style: { width: `${TIMELINE_LEFT_COL_WIDTH}px`, minHeight: `${TIMELINE_HEADER_HEIGHT}px` },
          }, 'Deliverables'),
          h('div', {
            className: 'relative min-w-0 flex-1 overflow-hidden bg-slate-900/95',
            style: { minHeight: `${TIMELINE_HEADER_HEIGHT}px` },
          }, [
            h('div', {
              className: 'relative',
              style: {
                width: `${timelineWidth}px`,
                minHeight: `${TIMELINE_HEADER_HEIGHT}px`,
                transform: `translateX(-${timelineScrollLeft}px)`,
              },
            }, [
              ticks.map((tick) => h('div', {
                key: `${tick.date}-${tick.offset}`,
                className: 'absolute inset-y-0',
                style: { left: `${tick.offset}px` },
              }, [
                h('div', { className: 'absolute inset-y-0 w-px bg-white/10' }),
                h('div', {
                  className: 'absolute left-1 top-3 whitespace-nowrap rounded-md bg-slate-900/95 px-1.5 py-0.5 text-[11px] font-semibold text-slate-300 shadow-sm',
                }, formatTimelineTick(tick.date, zoomConfig.mode)),
              ])),
            ]),
          ]),
        ]),
      ]),
    ]),
    h('div', { className: 'max-w-full overflow-hidden rounded-[28px] border border-slate-200/80 bg-white/85 p-4 shadow-sm dark:border-white/10 dark:bg-slate-950/40 md:-mt-px md:p-5' }, [
      h('div', {
        ref: timelineBodyScrollRef,
        className: 'timeline-step-scroll overflow-x-auto overflow-y-hidden',
        style: {
          scrollbarWidth: 'thin',
          scrollbarColor: 'rgba(148,163,184,0.35) transparent',
        },
        onScroll: (event) => setTimelineScrollLeft(event.currentTarget.scrollLeft || 0),
      }, [
        h('div', { className: 'relative', style: { minWidth: `${TIMELINE_LEFT_COL_WIDTH + timelineWidth}px` } }, [
          h('div', { className: 'relative z-0' }, [
            h('svg', {
              className: 'pointer-events-none absolute left-[280px] z-0 overflow-visible',
              width: timelineWidth,
              height: timelineBodyHeight,
              viewBox: `0 0 ${timelineWidth} ${timelineBodyHeight}`,
              style: { top: '0px' },
            }, [
              connectors.map((connector) => h('path', {
                key: connector.key,
                d: connector.d,
                fill: 'none',
                stroke: 'rgba(113,31,255,0.28)',
                strokeWidth: '2',
                strokeLinecap: 'round',
              })),
            ]),
            h('div', {
              className: 'pointer-events-none absolute left-[280px] z-[5]',
              style: {
                top: '0px',
                width: `${timelineWidth}px`,
                height: `${timelineBodyHeight}px`,
              },
            }, [
            shouldRenderStartColumn && startLineOffset !== null
              ? h('div', {
                className: 'absolute bottom-0 top-0',
                style: { left: `${startLineOffset}px` },
              }, [
                h('div', {
                  className: 'absolute rounded-none',
                  style: {
                    backgroundColor: 'rgba(31, 122, 255, 0.55)',
                    width: '40px',
                    height: '100%',
                    position: 'absolute',
                    top: 0,
                    bottom: 0,
                    left: '50%',
                    transform: 'translateX(-50%)',
                    borderRadius: '0',
                  },
                }),
                h('div', {
                  className: 'absolute inset-y-0 flex w-[40px] flex-col items-center justify-center gap-[3px] text-[10px] font-medium uppercase tracking-[0.18em] text-white/95',
                  style: { left: '50%', transform: 'translateX(-50%)' },
                }, 'START'.split('').map((letter, idx) => h('span', { key: `start-${idx}` }, letter))),
              ])
              : null,
            shouldRenderFinishColumn && finishLineOffset !== null
              ? h('div', {
                className: 'absolute bottom-0 top-0',
                style: { left: `${finishLineOffset}px` },
              }, [
                h('div', {
                  className: 'absolute rounded-none',
                  style: {
                    backgroundColor: 'rgba(95, 206, 168, 0.55)',
                    width: '40px',
                    height: '100%',
                    position: 'absolute',
                    top: 0,
                    bottom: 0,
                    left: '50%',
                    transform: 'translateX(-50%)',
                    borderRadius: '0',
                  },
                }),
                h('div', {
                  className: 'absolute inset-y-0 flex w-[40px] flex-col items-center justify-center gap-[3px] text-[10px] font-medium uppercase tracking-[0.18em] text-slate-900/85',
                  style: { left: '50%', transform: 'translateX(-50%)' },
                }, 'FINISH'.split('').map((letter, idx) => h('span', { key: `finish-${idx}` }, letter))),
              ])
              : null,
            ]),
            schedule.map((item, index) => {
              const offset = diffDays(rangeStart, item.startDate) * zoomConfig.pxPerDay;
              const width = Math.max(10, item.durationDays * zoomConfig.pxPerDay);
              return h('div', {
                key: item.row.id,
                className: 'flex border-b border-slate-200/80 dark:border-white/10',
                style: { minHeight: `${TIMELINE_ROW_HEIGHT}px` },
              }, [
                h('div', {
                  className: 'sticky left-0 z-20 flex shrink-0 items-center border-r border-slate-200 bg-white/95 px-4 dark:border-white/10 dark:bg-slate-950/90',
                  style: { width: `${TIMELINE_LEFT_COL_WIDTH}px`, minHeight: `${TIMELINE_ROW_HEIGHT}px` },
                }, [
                  h('div', { className: 'min-w-0 space-y-1' }, [
                    h('div', { className: 'truncate text-sm font-semibold text-slate-900 dark:text-white' }, item.row.name || 'Untitled Deliverable'),
                    h('div', { className: 'text-[11px] text-slate-500 dark:text-slate-400' }, `${item.durationDays} day${item.durationDays === 1 ? '' : 's'}`),
                  ]),
                ]),
                h('div', {
                  className: 'relative z-0 shrink-0',
                  style: { width: `${timelineWidth}px`, minHeight: `${TIMELINE_ROW_HEIGHT}px` },
                }, [
                  ticks.map((tick) => h('div', {
                    key: `grid-${item.row.id}-${tick.date}`,
                    className: 'absolute inset-y-0 w-px bg-slate-200/70 dark:bg-white/10',
                    style: { left: `${tick.offset}px` },
                  })),
                  h('div', {
                    className: 'absolute top-1/2 z-10 -translate-y-1/2 rounded-[8px] bg-netnet-purple shadow-[0_10px_24px_rgba(113,31,255,0.18)]',
                    style: {
                      left: `${offset}px`,
                      width: `${width}px`,
                      height: `${Math.round(TIMELINE_ROW_HEIGHT * 0.65)}px`,
                    },
                  }),
                ]),
              ]);
            }),
          ]),
        ]),
      ]),
    ]),
  ]);
}

function NetNetStepBody({ draft, serviceTypes = [] }) {
  const isRetainer = draft.kind === 'retainer';
  const plan = normalizePlanState(draft.plan, draft.selectedServiceTypeIds);
  const serviceTypeIds = Array.isArray(plan?.serviceTypeIds) ? plan.serviceTypeIds : [];
  const rows = Array.isArray(plan?.rows) ? plan.rows : [];
  const selectedTypes = serviceTypeIds.map((id) => {
    const match = (serviceTypes || []).find((item) => String(item.id) === String(id));
    const name = String(plan?.serviceTypeNames?.[id] || match?.name || id);
    const baseRate = Number(match?.baseRate) || 0;
    return { id: String(id), name, baseRate };
  });

  const totalHours = rows.reduce((sum, row) => sum + sumRowHours(row, serviceTypeIds), 0);
  const breakdown = selectedTypes.map((type) => {
    const hours = rows.reduce((sum, row) => sum + (Number(row?.pools?.[type.id]) || 0), 0);
    const share = totalHours > 0 ? (hours / totalHours) * 100 : 0;
    const revenue = hours * type.baseRate;
    return { ...type, hours, share, revenue };
  }).filter((item) => item.hours > 0 || item.baseRate > 0 || serviceTypeIds.includes(item.id));

  const scheduleMap = new Map();
  let previousEnd = draft.startDate || todayISO();
  const timelineSchedule = rows.map((row, index) => {
    const details = ensureDeliverableDetails(draft.deliverableDetailsById, row.id);
    const dependency = scheduleMap.get(String(details.dependencyRowId || ''));
    const startDate = dependency
      ? addDaysISO(dependency.endDate, 1)
      : index === 0
        ? (draft.startDate || todayISO())
        : addDaysISO(previousEnd, 1);
    const durationDays = getDurationDays(details);
    const endDate = addDaysISO(startDate, durationDays - 1);
    const item = {
      row,
      details,
      startDate,
      endDate,
      durationDays,
      rowHours: sumRowHours(row, serviceTypeIds),
    };
    previousEnd = endDate;
    scheduleMap.set(String(row.id), item);
    return item;
  });

  const derivedEndDate = draft.targetEndDate || timelineSchedule.reduce((latest, item) => (!latest || item.endDate > latest ? item.endDate : latest), draft.startDate || '');
  const durationDays = draft.startDate && derivedEndDate ? Math.max(1, diffDays(draft.startDate, derivedEndDate) + 1) : 0;
  const weeks = isRetainer ? 4.33 : (durationDays > 0 ? durationDays / 7 : 0);
  const hoursPerWeek = weeks > 0 ? totalHours / weeks : 0;
  const intensityLabel = getIntensityLabel(hoursPerWeek);
  const revenueByDeliverable = timelineSchedule.map((item) => {
    const revenue = selectedTypes.reduce((sum, type) => sum + ((Number(item.row?.pools?.[type.id]) || 0) * type.baseRate), 0);
    return {
      id: item.row.id,
      name: item.row.name || 'Untitled Deliverable',
      hours: item.rowHours,
      revenue,
    };
  });
  const totalBudget = breakdown.reduce((sum, item) => sum + item.revenue, 0);

  const metricCard = (label, value, hint, accentClass = 'text-slate-900 dark:text-white') => h('div', {
    className: 'rounded-[24px] border border-slate-200/80 bg-white/80 p-5 backdrop-blur dark:border-white/10 dark:bg-slate-950/35',
  }, [
    h('div', { className: 'text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400' }, label),
    h('div', { className: `mt-3 text-3xl font-semibold ${accentClass}` }, value),
    hint ? h('div', { className: 'mt-2 text-sm leading-6 text-slate-500 dark:text-slate-400' }, hint) : null,
  ]);

  return h('div', { className: 'space-y-6' }, [
    h('div', { className: 'grid gap-4 xl:grid-cols-[0.95fr_1.05fr]' }, [
      h('div', { className: `grid gap-4 ${isRetainer ? 'sm:grid-cols-2 xl:grid-cols-1' : 'sm:grid-cols-3 xl:grid-cols-1'}` }, [
        metricCard(
          isRetainer ? 'Total Monthly Hours' : 'Total Hours',
          totalHours ? `${formatLargeHours(totalHours)} hrs` : '0 hrs',
          isRetainer ? 'All planned effort shown here is monthly.' : 'All planned effort from Deliverables + LOE.'
        ),
        !isRetainer
          ? metricCard('Duration', durationDays ? formatWeeksAndDays(durationDays) : 'Not set', draft.startDate && derivedEndDate ? `${formatLongDate(draft.startDate)} to ${formatLongDate(derivedEndDate)}` : 'Set dates in Timeline to calculate duration.')
          : null,
        metricCard('Work Intensity', totalHours ? `${formatLargeHours(hoursPerWeek)} hrs/week` : 'Not set', intensityLabel, intensityLabel === 'Heavy' ? 'text-amber-600 dark:text-amber-300' : intensityLabel === 'Moderate' ? 'text-cyan-600 dark:text-cyan-300' : 'text-emerald-600 dark:text-emerald-300'),
      ]),
      h('section', {
        className: 'rounded-[28px] border border-slate-200/80 bg-white/80 p-5 backdrop-blur dark:border-white/10 dark:bg-slate-950/35 md:p-6',
      }, [
        h('div', { className: 'space-y-1' }, [
          h('h2', { className: 'text-base font-semibold text-slate-900 dark:text-white' }, 'Service Type Breakdown'),
          h('p', { className: 'text-sm leading-6 text-slate-500 dark:text-slate-400' }, 'How the planned effort is distributed across the selected disciplines.'),
        ]),
        breakdown.length
          ? h('div', { className: 'mt-5 space-y-4' }, breakdown.map((item) => h('div', {
            key: item.id,
            className: 'space-y-2',
          }, [
            h('div', { className: 'flex items-center justify-between gap-3' }, [
              h('div', { className: 'min-w-0' }, [
                h('div', { className: 'truncate text-sm font-semibold text-slate-800 dark:text-slate-100' }, item.name),
                h('div', { className: 'text-xs text-slate-500 dark:text-slate-400' }, `${formatLargeHours(item.hours)} hrs`),
              ]),
              h('div', { className: 'text-sm font-semibold text-slate-700 dark:text-slate-200' }, formatPercent(item.share)),
            ]),
            h('div', { className: 'h-2 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800' }, [
              h('div', {
                className: 'h-full rounded-full bg-netnet-purple',
                style: { width: `${Math.max(item.share, item.hours > 0 ? 6 : 0)}%` },
              }),
            ]),
          ])))
          : h('div', { className: 'mt-5 rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-sm text-slate-500 dark:border-white/10 dark:bg-slate-900/50 dark:text-slate-400' }, 'Add Service Types and planned hours in earlier steps to see the workload breakdown.'),
      ]),
    ]),
    h('div', {
      className: 'rounded-[24px] border border-slate-200/80 bg-white/80 px-5 py-4 text-sm leading-6 text-slate-600 backdrop-blur dark:border-white/10 dark:bg-slate-950/35 dark:text-slate-300',
    }, [
      h('span', { className: 'font-semibold text-slate-900 dark:text-white' }, 'Net Net Summary: '),
      isRetainer
        ? `${intensityLabel}. This retainer carries ${formatLargeHours(totalHours)} monthly hours, landing at ${formatLargeHours(hoursPerWeek)} hours per week.`
        : `${intensityLabel}. This plan carries ${formatLargeHours(totalHours)} total hours across ${durationDays ? formatWeeksAndDays(durationDays) : 'an untracked duration'}, landing at ${formatLargeHours(hoursPerWeek)} hours per week.`,
    ]),
    h('section', {
      className: 'rounded-[28px] border border-slate-200/80 bg-white/80 p-5 backdrop-blur dark:border-white/10 dark:bg-slate-950/35 md:p-6',
    }, [
      h('div', { className: 'space-y-1' }, [
        h('h2', { className: 'text-lg font-semibold text-slate-900 dark:text-white' }, isRetainer ? 'Monthly Budget (Based on Base Rates)' : 'Project Budget (Based on Base Rates)'),
        h('p', { className: 'text-sm leading-6 text-slate-500 dark:text-slate-400' }, isRetainer ? 'This is your expected monthly budget based on base rates.' : 'Price it however you want. Based on your base rates, this is the expected project budget.'),
      ]),
      h('div', { className: 'mt-6 grid gap-4 xl:grid-cols-[0.9fr_1.1fr]' }, [
        h('div', { className: 'space-y-4' }, [
          h('div', { className: 'rounded-[24px] border border-slate-200/80 bg-slate-50/90 p-5 dark:border-white/10 dark:bg-slate-900/50' }, [
            h('div', { className: 'text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400' }, isRetainer ? 'Total Monthly Budget' : 'Total Project Budget'),
            h('div', { className: 'mt-3 text-4xl font-semibold text-slate-900 dark:text-white' }, formatMoney(totalBudget)),
            h('div', { className: 'mt-2 text-sm leading-6 text-slate-500 dark:text-slate-400' }, `${intensityLabel} workload based on ${formatLargeHours(hoursPerWeek)} hours per week.`),
          ]),
          h('div', { className: 'rounded-[24px] border border-slate-200/80 bg-slate-50/90 p-5 dark:border-white/10 dark:bg-slate-900/50' }, [
            h('div', { className: 'text-sm font-semibold text-slate-900 dark:text-white' }, isRetainer ? 'Monthly Revenue by Service Type' : 'Revenue by Service Type'),
            h('div', { className: 'mt-4 space-y-3' }, breakdown.length
              ? breakdown.map((item) => h('div', {
                key: `${item.id}-revenue`,
                className: 'flex items-center justify-between gap-3 text-sm',
              }, [
                h('span', { className: 'truncate text-slate-600 dark:text-slate-300' }, `${item.name} (${formatLargeHours(item.hours)} hrs @ ${formatMoney(item.baseRate)}/hr)`),
                h('span', { className: 'font-semibold text-slate-900 dark:text-white' }, formatMoney(item.revenue)),
              ]))
              : [h('div', { className: 'text-sm text-slate-500 dark:text-slate-400' }, 'No billable effort yet.')]),
          ]),
        ]),
        h('div', { className: 'rounded-[24px] border border-slate-200/80 bg-slate-50/90 p-5 dark:border-white/10 dark:bg-slate-900/50' }, [
          h('div', { className: 'text-sm font-semibold text-slate-900 dark:text-white' }, isRetainer ? 'Monthly Revenue by Deliverable' : 'Revenue by Deliverable'),
          h('div', { className: 'mt-4 overflow-hidden rounded-2xl border border-slate-200/80 dark:border-white/10' }, [
            h('table', { className: 'min-w-full text-sm' }, [
              h('thead', { className: 'bg-slate-100/90 dark:bg-slate-900/80' }, [
                h('tr', null, [
                  h('th', { className: 'px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400' }, 'Deliverable'),
                  h('th', { className: 'px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400' }, 'Hours'),
                  h('th', { className: 'px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400' }, 'Revenue'),
                ]),
              ]),
              h('tbody', null, revenueByDeliverable.length
                ? revenueByDeliverable.map((item) => h('tr', {
                  key: item.id,
                  className: 'border-t border-slate-200/80 dark:border-white/10',
                }, [
                  h('td', { className: 'px-4 py-3 font-medium text-slate-800 dark:text-slate-100' }, item.name),
                  h('td', { className: 'px-4 py-3 text-right text-slate-600 dark:text-slate-300' }, `${formatLargeHours(item.hours)} hrs`),
                  h('td', { className: 'px-4 py-3 text-right font-semibold text-slate-900 dark:text-white' }, formatMoney(item.revenue)),
                ]))
                : [h('tr', null, [
                  h('td', { colSpan: 3, className: 'px-4 py-8 text-center text-slate-500 dark:text-slate-400' }, 'Add deliverables and hours in Step 2 to see the budget rollup.'),
                ])]),
            ]),
          ]),
        ]),
      ]),
    ]),
  ]);
}

function renderJobChatIcon(indicator = {}) {
  const total = indicator.totalMessages || 0;
  const mentionCount = indicator.mentionCount || 0;
  const hasUnread = indicator.hasUnreadMessages;
  const badgeValue = mentionCount > 9 ? '9+' : mentionCount || '';
  const toneClass = total > 0
    ? 'text-slate-600 dark:text-slate-200'
    : 'text-slate-400 dark:text-slate-500';
  return h('span', { className: `relative inline-flex items-center ${toneClass}` }, [
    h('svg', { viewBox: '0 0 24 24', className: 'h-4 w-4', fill: 'none', stroke: 'currentColor', strokeWidth: '1.8' }, [
      h('path', { d: 'M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4z' }),
    ]),
    mentionCount > 0
      ? h('span', { className: 'absolute -top-1 -right-2 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-white px-1 text-[10px] font-semibold text-slate-900 shadow' }, badgeValue)
      : hasUnread
        ? h('span', { className: 'absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-white shadow' })
        : null,
  ]);
}

function JobCreateHeader({
  draft,
  companies = [],
  individuals = [],
  status = 'pending',
  onOpenChat = null,
  chatIndicator = null,
}) {
  const clientLabel = formatDraftClientLabel({ draft, companies, individuals });
  const jobName = String(draft.name || '').trim() || 'Untitled Job';
  const kindLabel = formatDraftKind(draft.kind);

  return h('div', {
    className: 'space-y-2 px-5 py-4 md:px-6',
    'data-job-header': 'true',
  }, [
    h('div', { className: 'flex items-center justify-between gap-3' }, [
      h('div', { className: 'text-xl font-semibold text-slate-900 dark:text-white' }, jobName),
      onOpenChat
        ? h('button', {
          type: 'button',
          className: 'inline-flex items-center gap-2 rounded-full border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 dark:border-white/10 dark:text-slate-200 dark:hover:text-white',
          onClick: () => onOpenChat({ type: 'job' }),
        }, [
          renderJobChatIcon(chatIndicator || {}),
          'Chat',
        ])
        : null,
    ]),
    h('div', {
      className: 'whitespace-nowrap overflow-hidden text-ellipsis text-xs text-slate-500 dark:text-slate-400',
      'data-job-header-meta': 'true',
    }, [
      h('span', { className: 'font-medium text-slate-700 dark:text-slate-200' }, `Job #${draft.jobNumber || '1138'}`),
      h('span', { className: 'mx-2 text-slate-400 dark:text-slate-500' }, '\u2022'),
      h('span', null, kindLabel),
      h('span', { className: 'mx-2 text-slate-400 dark:text-slate-500' }, '\u2022'),
      h('span', {
        className: `inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold ${statusPillTone(status)}`,
      }, formatStatusLabel(status)),
      h('span', { className: 'mx-2 text-slate-400 dark:text-slate-500' }, '\u2022'),
      h('span', null, 'Client: '),
      h('span', { className: 'text-slate-700 dark:text-slate-200' }, clientLabel),
    ]),
  ]);
}

function StickyHeaderBlock({
  stickyRef,
  draft,
  companies,
  individuals,
  currentStep,
  onStepChange,
  steps = STEP_DEFS,
  status = 'pending',
  onOpenChat = null,
  chatIndicator = null,
}) {
  return h('div', {
    ref: stickyRef,
    className: 'sticky top-0 z-40 overflow-hidden rounded-[28px] border border-slate-200/80 bg-white/95 shadow-sm backdrop-blur dark:border-white/10 dark:bg-slate-950/90',
  }, [
    h(JobCreateHeader, {
      draft,
      companies,
      individuals,
      status,
      onOpenChat,
      chatIndicator,
    }),
    h('div', { className: 'border-t border-slate-200/70 px-3 py-3 dark:border-white/10 sm:px-4' }, [
      h('div', { className: 'flex flex-col gap-3 md:flex-row md:items-center' }, (steps || []).map((item) => h(StepPill, {
        key: item.index,
        step: item,
        currentStep,
        onSelect: onStepChange,
      }))),
    ]),
  ]);
}

function PlaceholderStepBody({ text }) {
  return h('div', { className: 'grid flex-1 gap-4 lg:grid-cols-[1.08fr_0.92fr]' }, [
    h('div', { className: 'rounded-[28px] border border-slate-200/80 bg-white/80 p-6 backdrop-blur dark:border-white/10 dark:bg-slate-950/35 md:p-8' }, [
      h('div', { className: 'text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400' }, 'Step Body'),
      h('div', { className: 'mt-4 max-w-2xl text-base leading-8 text-slate-700 dark:text-slate-200' }, text),
    ]),
    h('aside', { className: 'rounded-[28px] border border-dashed border-slate-200 bg-white/70 p-6 dark:border-white/10 dark:bg-white/5 md:p-8' }, [
      h('div', { className: 'text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400' }, 'Next Build Phase'),
      h('div', { className: 'mt-4 space-y-3 text-sm leading-7 text-slate-600 dark:text-slate-300' }, [
        h('p', null, 'This step is still a skeleton while the creation flow is being built out in sequence.'),
      ]),
    ]),
  ]);
}

function StepScreen({
  step,
  draft,
  onDraftChange,
  companies,
  individuals,
  members,
  serviceTypes,
  readOnly = false,
  stickyHeaderOffset = 0,
  jobStatus = 'pending',
  onBack,
  onNext,
  footerActions = null,
}) {
  const bodyContent = step.index === 1
    ? h(SummaryStepBody, {
      draft,
      onDraftChange,
      companies,
      individuals,
      members,
      serviceTypes,
    })
    : step.index === 2
      ? h(DeliverablesStepBody, {
        draft,
        onDraftChange,
        serviceTypes,
        stickyHeaderOffset,
        readOnly,
      })
    : step.index === 3
        ? h(TimelineStepBody, {
          draft,
          onDraftChange,
          stickyHeaderOffset,
        })
      : step.index === 4
        ? h(NetNetStepBody, {
          draft,
          serviceTypes,
        })
        : h(PlaceholderStepBody, { text: step.body });

  return h('section', {
    className: `w-full rounded-[32px] border border-slate-200 bg-gradient-to-br ${step.theme} shadow-[0_30px_120px_rgba(15,23,42,0.12)] dark:border-white/10 dark:shadow-[0_30px_120px_rgba(2,6,23,0.45)]`,
  }, [
    h('div', { className: 'flex min-h-[74vh] flex-col' }, [
      h('div', { className: 'flex-1 px-6 py-8 md:px-8 md:py-10' }, [
        h('div', { className: 'flex h-full flex-col justify-between gap-8 lg:gap-10' }, [
          h('header', { className: 'space-y-6' }, [
            h('div', { className: 'inline-flex items-center rounded-full border border-slate-200/80 bg-white/75 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-600 dark:border-white/10 dark:bg-white/5 dark:text-slate-300' }, step.eyebrow),
            h('div', { className: 'space-y-4' }, [
              h('div', { className: `h-1.5 w-24 rounded-full ${step.accentClass}` }),
              h('div', { className: 'space-y-3' }, [
                h('h1', { className: 'max-w-3xl text-2xl font-semibold leading-tight text-slate-900 dark:text-white md:text-[2.8rem]' }, step.title),
                h('p', { className: 'max-w-2xl text-sm leading-7 text-slate-600 dark:text-slate-300 md:text-base' }, step.subtitle),
              ]),
            ]),
          ]),
          bodyContent,
        ]),
      ]),
      h(StepFooter, { step, onBack, onNext, actions: footerActions }),
    ]),
  ]);
}

export function JobCreateStepperRoot({
  job = null,
  onJobUpdate = null,
  readOnly = false,
  onOpenChat = null,
  chatIndicator = null,
  showSectionHeader = true,
}) {
  const wsId = useMemo(() => workspaceId(), []);
  const companies = useMemo(() => getContactsData(), []);
  const individuals = useMemo(() => getIndividualsData(), []);
  const serviceTypes = useMemo(() => loadServiceTypes().filter((type) => type.active), []);
  const members = useMemo(() => loadTeamMembers(), []);
  const isEditingJob = !!job?.id;
  const [step, setStep] = useState(1);
  const [draft, setDraft] = useState(() => (
    isEditingJob ? buildDraftFromJob(job, serviceTypes) : loadDraft(wsId)
  ));
  const [showActivationReview, setShowActivationReview] = useState(false);
  const stickyHeaderRef = useRef(null);
  const [stickyHeaderHeight, setStickyHeaderHeight] = useState(0);
  const lastSyncedPayloadRef = useRef('');

  const visibleSteps = useMemo(() => buildVisibleSteps(draft.kind), [draft.kind]);
  const activeStep = useMemo(() => visibleSteps.find((item) => item.index === step) || visibleSteps[0], [step, visibleSteps]);

  useEffect(() => {
    if (typeof window !== 'undefined' && typeof window.scrollTo === 'function') {
      window.scrollTo({ top: 0, behavior: 'auto' });
    }
  }, [step]);

  useEffect(() => {
    const nextDraft = isEditingJob ? buildDraftFromJob(job, serviceTypes) : loadDraft(wsId);
    setDraft(nextDraft);
  }, [isEditingJob, job, wsId, serviceTypes]);

  useEffect(() => {
    if (!visibleSteps.some((item) => item.index === step)) {
      setStep(visibleSteps[visibleSteps.length - 1]?.index || 1);
    }
  }, [step, visibleSteps]);

  useEffect(() => {
    const node = stickyHeaderRef.current;
    if (!node) return undefined;
    const updateHeight = () => {
      const next = Math.ceil(node.getBoundingClientRect().height);
      setStickyHeaderHeight(next > 0 ? next : 0);
    };
    updateHeight();
    if (typeof ResizeObserver === 'function') {
      const observer = new ResizeObserver(() => updateHeight());
      observer.observe(node);
      return () => observer.disconnect();
    }
    window.addEventListener('resize', updateHeight);
    return () => window.removeEventListener('resize', updateHeight);
  }, []);

  const updateDraft = (updater) => {
    setDraft((current) => {
      if (readOnly) return current;
      const next = typeof updater === 'function' ? updater(current) : { ...current, ...(updater || {}) };
      return isEditingJob ? normalizeDraft(next) : persistDraft(next, wsId);
    });
  };

  const commitDraft = (overrides = {}) => {
    if (readOnly) return null;
    const payload = buildDraftJobPayload(draft, job);
    let finalPayload = {
      ...payload,
      ...(overrides || {}),
    };
    if (isLockedPlanningStatus(finalPayload?.status)) {
      finalPayload = ensurePlanBaselines(finalPayload, {
        cycleKey: finalPayload?.currentCycleKey || job?.currentCycleKey || null,
        serviceTypes,
      });
    }
    console.log('COMMIT DRAFT payload:', finalPayload);
    const savedJob = saveJob(finalPayload, wsId);
    console.log('COMMIT DRAFT saved:', savedJob);
    if (!savedJob) return null;
    lastSyncedPayloadRef.current = JSON.stringify(savedJob);
    if (isEditingJob) {
      setDraft(buildDraftFromJob(savedJob, serviceTypes));
    }
    if (isEditingJob && typeof onJobUpdate === 'function') {
      onJobUpdate(savedJob, { persisted: true });
    }
    return savedJob;
  };

  const handleNext = () => {
    const currentIdx = visibleSteps.findIndex((item) => item.index === step);
    if (currentIdx >= 0 && currentIdx < visibleSteps.length - 1) {
      setStep(visibleSteps[currentIdx + 1].index);
    }
  };

  const handleBack = () => {
    const currentIdx = visibleSteps.findIndex((item) => item.index === step);
    if (currentIdx > 0) setStep(visibleSteps[currentIdx - 1].index);
  };

  const saveAsPending = () => {
    const savedJob = commitDraft({ status: 'pending' });
    if (!savedJob) return;
    clearDraft(wsId);
    window?.showToast?.('Job saved as pending.');
    navigate('#/app/jobs');
  };

  const activateFromReview = (activationUpdates) => {
    const savedJob = commitDraft({
      ...(activationUpdates || {}),
      status: 'active',
    });
    if (!savedJob) return;
    clearDraft(wsId);
    setShowActivationReview(false);
    window?.showToast?.('Job activated.');
    if (savedJob?.id) navigate(`#/app/jobs/${savedJob.id}`);
  };

  const activationPreviewJob = useMemo(() => buildDraftJobPayload(draft, job), [draft, job]);
  const stepFourActions = !readOnly && activeStep?.id === 'netnet'
    ? h('div', { className: 'flex items-center justify-between gap-3' }, [
      h('button', {
        type: 'button',
        className: 'inline-flex h-11 items-center justify-center rounded-md border border-slate-200 bg-white px-5 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50 dark:border-white/10 dark:bg-white/5 dark:text-slate-100 dark:hover:bg-white/10',
        onClick: saveAsPending,
      }, 'Save as Pending'),
      h('div', { className: 'flex items-center gap-3' }, [
        activeStep.backLabel
          ? h('button', {
            type: 'button',
            className: 'inline-flex h-11 items-center justify-center rounded-md border border-slate-200 bg-white px-5 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50 dark:border-white/10 dark:bg-white/5 dark:text-slate-100 dark:hover:bg-white/10',
            onClick: handleBack,
          }, activeStep.backLabel)
          : null,
        h('button', {
          type: 'button',
          className: 'inline-flex h-11 items-center justify-center rounded-md bg-netnet-purple px-5 text-sm font-semibold text-white transition hover:brightness-110',
          onClick: () => setShowActivationReview(true),
        }, 'Activate Job'),
      ]),
    ])
    : null;

  const breadcrumb = h('div', { className: 'flex items-center gap-2' }, [
    h('button', {
      type: 'button',
      className: 'text-sm text-slate-500 hover:text-slate-900 dark:text-white/70 dark:hover:text-white',
      onClick: () => navigate('#/app/jobs'),
    }, 'Jobs'),
    h('span', { className: 'text-slate-400 dark:text-white/50' }, '›'),
    h('span', { className: 'text-2xl font-semibold text-slate-900 dark:text-white' }, String(draft.name || '').trim() || 'New Job'),
  ]);

  return h('div', { className: 'space-y-4 px-4 pt-4 pb-[50px]' }, [
    showSectionHeader
      ? h(SectionHeader, {
        title: breadcrumb,
        showHelpIcon: true,
        showSecondaryRow: false,
      })
      : null,
    h(StickyHeaderBlock, {
      stickyRef: stickyHeaderRef,
      draft,
      companies,
      individuals,
      status: job?.status || 'pending',
      currentStep: step,
      onStepChange: setStep,
      steps: visibleSteps,
      onOpenChat,
      chatIndicator,
    }),
    h('div', { className: 'flex w-full' }, [
      h(StepScreen, {
        step: activeStep,
        draft,
        onDraftChange: updateDraft,
        companies,
        individuals,
        members,
        serviceTypes,
        readOnly,
        stickyHeaderOffset: stickyHeaderHeight,
        jobStatus: job?.status || 'pending',
        onBack: handleBack,
        onNext: handleNext,
        footerActions: stepFourActions,
      }),
    ]),
    h(JobActivationModal, {
      job: activationPreviewJob,
      isOpen: showActivationReview,
      onClose: () => setShowActivationReview(false),
      onConfirm: activateFromReview,
    }),
  ]);
}

export function JobsCreateScreen() {
  return h(JobCreateStepperRoot);
}
