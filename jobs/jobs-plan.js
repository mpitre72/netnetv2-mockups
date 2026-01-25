import { loadServiceTypes } from '../quick-tasks/quick-tasks-store.js';
import { JobPlanEditor, buildDeliverablesFromPlan, createPlanStateFromJob } from './jobs-plan-grid.js';
import { DeliverableLOEMeters } from './deliverable-loe-meters.js';
import { getJobCycleKey, setJobCycleKey } from './jobs-ui-state.js';
import { formatCycleLabel, getCurrentCycleKey, getPoolsForCycle, shiftCycleKey } from './retainer-cycle-utils.js';

const { createElement: h, useEffect, useMemo, useRef, useState } = React;

function buildDefaultServiceTypeIds(serviceTypes) {
  return (serviceTypes || []).slice(0, 3).map((type) => type.id);
}

export function JobPlanTab({ job, onJobUpdate, readOnly: readOnlyOverride }) {
  const serviceTypes = useMemo(() => loadServiceTypes().filter((type) => type.active), []);
  const defaultServiceTypeIds = useMemo(() => buildDefaultServiceTypeIds(serviceTypes), [serviceTypes]);
  const isRetainer = job?.kind === 'retainer';
  const readOnly = readOnlyOverride === undefined ? job?.status === 'archived' : readOnlyOverride;

  const [cycleKey, setCycleKey] = useState(() => {
    if (!job || job.kind !== 'retainer') return null;
    return getJobCycleKey(job.id) || job.currentCycleKey || getCurrentCycleKey();
  });

  const [plan, setPlan] = useState(() => createPlanStateFromJob(job, defaultServiceTypeIds, { cycleKey }));
  const planRef = useRef(plan);

  useEffect(() => {
    if (!job) return;
    if (job.kind !== 'retainer') {
      setCycleKey(null);
      return;
    }
    const stored = getJobCycleKey(job.id);
    const nextCycleKey = stored || job.currentCycleKey || getCurrentCycleKey();
    setCycleKey(nextCycleKey);
  }, [job?.id, job?.kind, job?.currentCycleKey]);

  useEffect(() => {
    if (!job) return;
    setPlan(createPlanStateFromJob(job, defaultServiceTypeIds, { cycleKey }));
  }, [job?.id, job?.updatedAt, defaultServiceTypeIds.join('|'), cycleKey]);

  useEffect(() => {
    planRef.current = plan;
  }, [plan]);

  useEffect(() => {
    if (!job || typeof onJobUpdate !== 'function' || readOnly) return undefined;
    const handle = setTimeout(() => {
      const deliverables = buildDeliverablesFromPlan(
        planRef.current,
        job.deliverables || [],
        { cycleKey, jobKind: job.kind }
      );
      onJobUpdate({
        serviceTypeIds: planRef.current.serviceTypeIds,
        deliverables,
      });
    }, 500);
    return () => clearTimeout(handle);
  }, [plan]);

  if (!job) return null;

  const activeCycleKey = isRetainer ? (cycleKey || getCurrentCycleKey()) : null;
  const cycleLabel = activeCycleKey ? formatCycleLabel(activeCycleKey) : '';
  const cycleLabelText = cycleLabel || activeCycleKey || '';
  const setCycle = (nextKey) => {
    if (!job || !isRetainer || !nextKey) return;
    setCycleKey(nextKey);
    setJobCycleKey(job.id, nextKey);
  };
  const shiftCycle = (delta) => {
    if (!activeCycleKey) return;
    setCycle(shiftCycleKey(activeCycleKey, delta));
  };

  const loeSection = h('div', { className: 'rounded-2xl border border-slate-200 dark:border-white/10 bg-white/90 dark:bg-slate-900/60 p-5 space-y-4' }, [
    h('div', { className: 'space-y-1' }, [
      h('div', { className: 'text-base font-semibold text-slate-900 dark:text-white' }, 'Deliverable LOE'),
      h('div', { className: 'text-sm text-slate-500 dark:text-slate-400' }, 'Available hours by service type for each deliverable.'),
    ]),
    (job.deliverables || []).length
      ? h('div', { className: 'space-y-3' }, (job.deliverables || []).map((deliverable) => {
        const deliverablePools = isRetainer && activeCycleKey
          ? getPoolsForCycle(deliverable, activeCycleKey)
          : (deliverable.pools || []);
        return h('div', {
          key: deliverable.id,
          className: 'rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 px-4 py-3 space-y-2',
        }, [
          h('div', { className: 'text-sm font-semibold text-slate-900 dark:text-white' }, deliverable.name || 'Deliverable'),
          h(DeliverableLOEMeters, {
            deliverableId: deliverable.id,
            pools: deliverablePools,
            serviceTypes,
          }),
        ]);
      }))
      : h('div', { className: 'text-sm text-slate-500 dark:text-slate-400' }, 'Add deliverables to see LOE pools here.'),
  ]);

  const cycleSelector = isRetainer ? h('div', {
    className: 'inline-flex items-center gap-2 rounded-full border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 px-2 py-1',
  }, [
    h('button', {
      type: 'button',
      className: 'h-8 w-8 rounded-full border border-slate-200 dark:border-white/10 text-slate-500 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white',
      onClick: () => shiftCycle(-1),
      'aria-label': 'Previous month',
    }, '<'),
    h('span', { className: 'text-sm font-semibold text-slate-700 dark:text-slate-200 px-2' }, cycleLabelText || 'Month'),
    h('button', {
      type: 'button',
      className: 'h-8 w-8 rounded-full border border-slate-200 dark:border-white/10 text-slate-500 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white',
      onClick: () => shiftCycle(1),
      'aria-label': 'Next month',
    }, '>'),
  ]) : null;

  return h('div', { className: 'space-y-6 pb-12' }, [
    cycleSelector,
    h(JobPlanEditor, {
      plan,
      onPlanChange: setPlan,
      serviceTypes,
      readOnly,
    }),
    loeSection,
  ]);
}
