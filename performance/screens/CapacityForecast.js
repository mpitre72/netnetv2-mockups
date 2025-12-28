import { navigate } from '../../router.js';
import { RowActionsMenu, PerfCard, PerfSectionTitle } from '../../components/performance/primitives.js';
import { getEffectiveState, markReviewed, clearReviewed, setProgressConfidence, updateDueDate, completeDeliverable, reassignTasks, createChangeOrder } from '../testdata/performance-state.js';
import { buildCapacityForecast } from '../lib/capacity-forecast.js';
import { performanceServiceTypes } from '../performance-data.js';

const { createElement: h, useEffect, useMemo, useState } = React;

function HorizonSelector({ value, onChange }) {
  const options = [14, 30, 60];
  return h('div', { className: 'inline-flex items-center gap-2 rounded-full border border-slate-300 dark:border-white/10 bg-white dark:bg-slate-900 shadow-sm p-1' },
    options.map((opt) =>
      h('button', {
        key: opt,
        type: 'button',
        className: [
          'px-3 py-1 text-sm font-semibold rounded-full transition',
          opt === value
            ? 'bg-netnet-purple text-white shadow'
            : 'text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800'
        ].join(' '),
        onClick: () => onChange(opt),
      }, `${opt}d`)
    )
  );
}

function CapacityKPI({ label, value, sub, tone = 'neutral' }) {
  const toneClass = tone === 'red' ? 'text-rose-600 dark:text-rose-200'
    : tone === 'amber' ? 'text-amber-600 dark:text-amber-200'
    : 'text-slate-900 dark:text-white';
  return h(PerfCard, { variant: 'secondary', className: 'space-y-1' }, [
    h('div', { className: 'text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400' }, label),
    h('div', { className: `text-2xl font-bold ${toneClass}` }, value),
    sub ? h('div', { className: 'text-sm text-slate-600 dark:text-slate-300' }, sub) : null,
  ]);
}

function MemberRow({ member, expanded, onToggle, state, refresh }) {
  return h('div', { className: 'border-b border-slate-100 dark:border-white/5' }, [
    h('div', {
      className: 'px-4 py-3 grid grid-cols-2 md:grid-cols-5 gap-2 items-center hover:bg-slate-50 dark:hover:bg-slate-800/40 cursor-pointer',
      onClick: onToggle,
    }, [
      h('div', { className: 'text-sm font-semibold text-slate-900 dark:text-white' }, member.memberName),
      h('div', { className: 'text-sm text-slate-700 dark:text-slate-200' }, `${Math.round(member.horizonCapacityHours)}h`),
      h('div', { className: 'text-sm text-slate-700 dark:text-slate-200' }, `${Math.round(member.assignedKnownDemandHours)}h`),
      h('div', { className: 'text-sm text-slate-700 dark:text-slate-200' }, `${member.utilizationPct}%`),
      h('div', { className: 'text-xs text-slate-600 dark:text-slate-300' }, member.utilizationState),
    ]),
    expanded ? h('div', { className: 'px-4 pb-4 bg-slate-50 dark:bg-slate-900/40 space-y-3' }, [
      member.deliverablesContributing.length === 0
        ? h('div', { className: 'text-sm text-slate-600 dark:text-slate-300' }, 'No known demand in this horizon.')
        : member.deliverablesContributing.map((d) =>
            h('div', { key: d.deliverableId, className: 'rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900/80 shadow-sm p-3 space-y-1' }, [
              h('div', { className: 'flex items-center justify-between gap-2' }, [
                h('div', { className: 'text-sm font-semibold text-slate-900 dark:text-white' }, d.deliverableName),
                h('div', { onClick: (e) => e.stopPropagation() },
                  h(RowActionsMenu, {
                    onSelect: (item) => {
                      if (item === 'Mark as Reviewed') refresh(markReviewed(d.deliverableId));
                      else if (item === 'Clear Reviewed') refresh(clearReviewed(d.deliverableId));
                      else if (item === 'Complete Deliverable') refresh(completeDeliverable(d.deliverableId));
                      else if (item === 'Change Deliverable Due Date') {
                        const next = prompt('New due date (YYYY-MM-DD)?');
                        if (next) refresh(updateDueDate(d.deliverableId, next));
                      } else if (item === 'Reassign Tasks In Deliverable') {
                        const next = prompt('Assign to member id?', member.memberId);
                        refresh(reassignTasks(d.deliverableId, next));
                      } else if (item === 'Create Change Order') {
                        const note = prompt('Change order note?', 'Change order added');
                        refresh(createChangeOrder(d.deliverableId, note));
                      }
                      window?.showToast?.(`${item} → saved`);
                    },
                  })
                ),
              ]),
              h('div', { className: 'text-xs text-slate-600 dark:text-slate-300 flex items-center gap-2 flex-wrap' }, [
                h('span', null, `${d.jobName} (${d.clientName})`),
                h('span', { className: 'text-slate-400' }, '•'),
                h('span', null, `Due ${d.dueDate || '—'}`),
                h('span', { className: 'text-slate-400' }, '•'),
                h('span', null, `${Math.round(d.memberAssignedKnownHours)}h assigned`),
                d.memberUnknownTaskCount > 0
                  ? h('span', { className: 'text-amber-700 dark:text-amber-200' }, `${d.memberUnknownTaskCount} unknown tasks`)
                  : null,
                h('button', {
                  type: 'button',
                  className: 'text-[var(--color-brand-purple,#711FFF)] font-semibold',
                  onClick: (e) => { e.stopPropagation(); navigate(`#/app/performance/job-pulse?jobId=${d.jobId}&deliverableId=${d.deliverableId}`); },
                }, 'View Job Pulse'),
              ]),
            ])
          ),
    ]) : null,
  ]);
}

function ServiceTypeRow({ svc, expanded, onToggle, deliverables, refresh, team }) {
  return h('div', { className: 'border-b border-slate-100 dark:border-white/5' }, [
    h('div', {
      className: 'px-4 py-3 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-800/40 cursor-pointer',
      onClick: onToggle,
    }, [
      h('div', { className: 'text-sm font-semibold text-slate-900 dark:text-white' }, svc.name || svc.serviceTypeId),
      h('div', { className: 'text-sm text-slate-700 dark:text-slate-200' }, `${svc.knownDemandHours}h • ${svc.sharePct}%`),
    ]),
    expanded ? h('div', { className: 'px-4 pb-4 bg-slate-50 dark:bg-slate-900/40 space-y-2' },
      (deliverables || []).map((d) =>
        h('div', { key: `${svc.serviceTypeId}-${d.deliverableId}`, className: 'rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900/80 shadow-sm p-3 space-y-1' }, [
          h('div', { className: 'flex items-center justify-between' }, [
            h('div', { className: 'text-sm font-semibold text-slate-900 dark:text-white' }, d.deliverableName),
            h('div', { onClick: (e) => e.stopPropagation() },
              h(RowActionsMenu, {
                onSelect: (item) => {
                  if (item === 'Mark as Reviewed') refresh(markReviewed(d.deliverableId));
                  else if (item === 'Clear Reviewed') refresh(clearReviewed(d.deliverableId));
                  else if (item === 'Complete Deliverable') refresh(completeDeliverable(d.deliverableId));
                  else if (item === 'Change Deliverable Due Date') {
                    const next = prompt('New due date (YYYY-MM-DD)?');
                    if (next) refresh(updateDueDate(d.deliverableId, next));
                  } else if (item === 'Reassign Tasks In Deliverable') {
                    const next = prompt('Assign to member id?', team[0]?.id);
                    refresh(reassignTasks(d.deliverableId, next));
                  } else if (item === 'Create Change Order') {
                    const note = prompt('Change order note?', 'Change order added');
                    refresh(createChangeOrder(d.deliverableId, note));
                  }
                  window?.showToast?.(`${item} → saved`);
                },
              })
            ),
          ]),
          h('div', { className: 'text-xs text-slate-600 dark:text-slate-300 flex items-center gap-2 flex-wrap' }, [
            h('span', null, `${d.jobName} (${d.clientName})`),
            h('span', { className: 'text-slate-400' }, '•'),
            h('span', null, `Due ${d.dueDate || '—'}`),
            h('span', { className: 'text-slate-400' }, '•'),
            h('span', null, `${Math.round(d.knownHours)}h known`),
            d.unknownTasks > 0 ? h('span', { className: 'text-amber-700 dark:text-amber-200' }, `${d.unknownTasks} unknown tasks`) : null,
            d.unassignedKnownHours > 0 ? h('span', { className: 'text-amber-800 dark:text-amber-100' }, `${Math.round(d.unassignedKnownHours)}h unassigned`) : null,
            h('button', {
              type: 'button',
              className: 'text-[var(--color-brand-purple,#711FFF)] font-semibold',
              onClick: (e) => { e.stopPropagation(); navigate(`#/app/performance/job-pulse?jobId=${d.jobId}&deliverableId=${d.deliverableId}`); },
            }, 'View Job Pulse'),
          ]),
        ])
      )
    ) : null,
  ]);
}

export function CapacityForecast({ queryString = '' }) {
  const allowed = [14, 30, 60];
  const params = new URLSearchParams(queryString);
  const rawHorizon = parseInt(params.get('horizonDays') || '30', 10);
  const initialHorizon = allowed.includes(rawHorizon) ? rawHorizon : 30;
  const [horizon, setHorizon] = useState(initialHorizon);
  const [state, setState] = useState(() => getEffectiveState());
  const [expandedMembers, setExpandedMembers] = useState(new Set());
  const [expandedSvc, setExpandedSvc] = useState(new Set());
  const serviceTypeLookup = useMemo(
    () => new Map((performanceServiceTypes || []).map((s) => [s.id, s.name])),
    []
  );

  useEffect(() => {
    const nextParams = new URLSearchParams(queryString);
    const incoming = parseInt(nextParams.get('horizonDays') || '30', 10);
    const safe = allowed.includes(incoming) ? incoming : 30;
    setHorizon((prev) => (prev === safe ? prev : safe));
    if (!allowed.includes(incoming) && queryString) {
      navigate('#/app/performance/capacity?horizonDays=30');
    }
  }, [queryString]); // keep URL/state in sync

  const forecast = useMemo(
    () => buildCapacityForecast({
      horizonDays: horizon,
      team: state.team,
      jobs: state.jobs,
      deliverables: state.deliverables,
      tasks: state.tasks,
    }),
    [horizon, state]
  );

  const pressureTone = forecast.capacityPressurePct == null
    ? 'amber'
    : forecast.capacityPressurePct > 100
      ? 'red'
      : forecast.capacityPressurePct >= 85
        ? 'amber'
        : 'green';

  const setHorizonAndUrl = (val) => {
    setHorizon(val);
    navigate(`#/app/performance/capacity?horizonDays=${val}`);
  };

  const refresh = (nextState) => {
    setState(nextState);
  };

  return h('div', { className: 'space-y-6' }, [
    h(PerfSectionTitle, {
      title: 'Capacity & Forecast',
      subtitle: 'Near-term pressure based on remaining work due in this horizon.',
      rightSlot: h(HorizonSelector, { value: horizon, onChange: setHorizonAndUrl }),
    }),

    h('div', { className: 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3' }, [
      h(CapacityKPI, { label: 'Horizon', value: forecast.horizonLabel }),
      h(CapacityKPI, { label: 'Known demand', value: `${forecast.knownDemandHours}h` }),
      h(CapacityKPI, { label: 'Capacity', value: `${forecast.capacityHours}h` }),
      h(CapacityKPI, {
        label: 'Capacity pressure',
        value: forecast.capacityPressurePct == null ? 'Unknown' : `${forecast.capacityPressurePct}%`,
        sub: forecast.capacityStateLabel || 'Unknown',
        tone: pressureTone,
      }),
    ]),

    h('div', { className: 'grid grid-cols-1 md:grid-cols-2 gap-3' }, [
      h(PerfCard, { variant: 'secondary', className: 'space-y-1 border-amber-200 dark:border-amber-300/30 bg-amber-50 dark:bg-amber-900/20' }, [
        h('div', { className: 'text-sm font-semibold text-amber-800 dark:text-amber-100' }, 'Unassigned demand'),
        h('div', { className: 'text-2xl font-bold text-amber-900 dark:text-amber-50' }, `${forecast.unassignedDemandHours}h`),
        h('div', { className: 'text-sm text-amber-800/90 dark:text-amber-100/80' }, `${forecast.unassignedKnownTaskCount} tasks lack assignee`),
        forecast.unknownUnassignedTaskCount
          ? h('div', { className: 'text-xs text-amber-800/80 dark:text-amber-100/70' }, `${forecast.unknownUnassignedTaskCount} unknown-effort tasks also unassigned`)
          : null,
      ]),
      h(PerfCard, { variant: 'secondary', className: 'space-y-1' }, [
        h('div', { className: 'text-sm font-semibold text-slate-900 dark:text-white' }, 'Unknown demand'),
        h('div', { className: 'text-2xl font-bold text-slate-900 dark:text-white' }, forecast.unknownDemandTaskCount > 0 ? `${forecast.unknownDemandTaskCount} tasks` : 'None'),
        h('div', { className: 'text-sm text-slate-600 dark:text-slate-300' }, forecast.capacityPressurePct == null ? 'Some demand cannot be calculated yet.' : 'Not included in pressure until estimates are known.'),
        forecast.unknownDemandDeliverableCount
          ? h('div', { className: 'text-xs text-slate-500 dark:text-slate-300' }, `${forecast.unknownDemandDeliverableCount} deliverables include unknown tasks`)
          : null,
      ]),
    ]),

    h(PerfCard, { className: 'space-y-3' }, [
      h(PerfSectionTitle, { title: 'Team utilization', subtitle: 'Known demand assigned to each teammate in this horizon.' }),
      forecast.teamRows.length === 0
        ? h('div', { className: 'p-2 text-sm text-slate-600 dark:text-slate-300' }, 'No deliverables due in this horizon.')
        : h('div', null,
            forecast.teamRows.map((row) =>
              h(MemberRow, {
                key: row.memberId,
                member: row,
                expanded: expandedMembers.has(row.memberId),
                onToggle: () => setExpandedMembers((prev) => {
                  const next = new Set(Array.from(prev));
                  if (next.has(row.memberId)) next.delete(row.memberId); else next.add(row.memberId);
                  return next;
                }),
                state,
                refresh,
              })
            )
          ),
    ]),

    h(PerfCard, { className: 'space-y-3' }, [
      h(PerfSectionTitle, { title: 'Service type bottlenecks', subtitle: 'Demand by service type inside this horizon.' }),
      forecast.serviceTypes.length === 0
        ? h('div', { className: 'p-2 text-sm text-slate-600 dark:text-slate-300' }, 'No demand in this horizon.')
        : h('div', null,
            forecast.serviceTypes.map((svc) =>
              h(ServiceTypeRow, {
                key: svc.serviceTypeId,
                svc: { ...svc, name: serviceTypeLookup.get(svc.serviceTypeId) || svc.serviceTypeId },
                expanded: expandedSvc.has(svc.serviceTypeId),
                onToggle: () => setExpandedSvc((prev) => {
                  const next = new Set(Array.from(prev));
                  if (next.has(svc.serviceTypeId)) next.delete(svc.serviceTypeId); else next.add(svc.serviceTypeId);
                  return next;
                }),
                deliverables: svc.deliverablesContributing || [],
                refresh,
                team: state.team,
              })
            )
          ),
    ]),

    forecast.deliverablesInHorizon?.length
      ? h(PerfCard, { className: 'space-y-3' }, [
          h(PerfSectionTitle, { title: 'Deliverables due in this horizon', subtitle: 'Evidence list for what drives demand.' }),
          h('div', { className: 'space-y-2' }, forecast.deliverablesInHorizon.map((d) =>
            h(PerfCard, { key: d.deliverableId, variant: 'secondary', className: 'flex items-center justify-between flex-wrap gap-2' }, [
              h('div', { className: 'space-y-0.5' }, [
                h('div', { className: 'text-sm font-semibold text-slate-900 dark:text-white' }, d.deliverableName),
                h('div', { className: 'text-xs text-slate-600 dark:text-slate-300 flex gap-2 flex-wrap items-center' }, [
                  h('span', null, `${d.jobName} (${d.clientName})`),
                  h('span', { className: 'text-slate-400' }, '•'),
                  h('span', null, `Due ${d.dueDate || '—'}`),
                  h('span', { className: 'text-slate-400' }, '•'),
                  h('span', null, `${Math.round(d.knownHoursTotal)}h known`),
                  d.unknownTaskCountTotal > 0 ? h('span', { className: 'text-amber-700 dark:text-amber-200' }, `${d.unknownTaskCountTotal} unknown tasks`) : null,
                  d.unassignedKnownHoursTotal > 0 ? h('span', { className: 'text-amber-800 dark:text-amber-100' }, `${Math.round(d.unassignedKnownHoursTotal)}h unassigned`) : null,
                ]),
              ]),
              h('button', {
                type: 'button',
                className: 'text-[var(--color-brand-purple,#711FFF)] font-semibold text-sm',
                onClick: () => navigate(`#/app/performance/job-pulse?jobId=${d.jobId}&deliverableId=${d.deliverableId}`),
              }, 'View Job Pulse'),
            ])
          )),
        ])
      : null,
  ]);
}
