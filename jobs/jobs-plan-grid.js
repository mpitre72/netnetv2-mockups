const { createElement: h } = React;

function createId(prefix) {
  return `${prefix}_${Math.random().toString(36).slice(2, 9)}`;
}

function ensurePools(serviceTypeIds, pools = {}) {
  const next = {};
  (serviceTypeIds || []).forEach((id) => {
    next[id] = Number(pools[id]) || 0;
  });
  return next;
}

function createEmptyRow(serviceTypeIds) {
  return {
    id: createId('del'),
    name: '',
    dueDate: null,
    pools: ensurePools(serviceTypeIds),
  };
}

function collectPoolTypeIds(deliverables = [], cycleKey = null) {
  const ids = [];
  deliverables.forEach((deliverable) => {
    const pools = cycleKey
      ? (deliverable?.poolsByCycle?.[cycleKey] || deliverable?.pools || [])
      : (deliverable?.pools || []);
    (pools || []).forEach((pool) => {
      if (pool?.serviceTypeId) ids.push(pool.serviceTypeId);
    });
  });
  return ids;
}

export function createPlanStateFromJob(job, fallbackServiceTypeIds = [], options = {}) {
  const cycleKey = options.cycleKey || null;
  const jobTypeIds = Array.isArray(job?.serviceTypeIds) ? job.serviceTypeIds.filter(Boolean) : [];
  const poolTypeIds = collectPoolTypeIds(job?.deliverables || [], job?.kind === 'retainer' ? cycleKey : null);
  const combined = [...new Set([...jobTypeIds, ...poolTypeIds, ...(fallbackServiceTypeIds || [])].filter(Boolean))];
  const serviceTypeIds = combined.length ? combined : (fallbackServiceTypeIds || []).filter(Boolean);
  const rows = Array.isArray(job?.deliverables) && job.deliverables.length
    ? job.deliverables.map((deliverable) => {
      const pools = {};
      const poolSource = job?.kind === 'retainer' && cycleKey
        ? (deliverable?.poolsByCycle?.[cycleKey] || [])
        : (deliverable?.pools || []);
      (poolSource || []).forEach((pool) => {
        if (pool?.serviceTypeId) pools[pool.serviceTypeId] = Number(pool.estimatedHours) || 0;
      });
      return {
        id: deliverable.id || createId('del'),
        name: deliverable.name || '',
        dueDate: deliverable.dueDate || null,
        pools: ensurePools(serviceTypeIds, pools),
      };
    })
    : [createEmptyRow(serviceTypeIds)];
  return { serviceTypeIds, rows };
}

export function buildDeliverablesFromPlan(plan, existingDeliverables = [], options = {}) {
  const cycleKey = options.cycleKey || null;
  const isRetainer = options.jobKind === 'retainer';
  const rows = Array.isArray(plan?.rows) ? plan.rows : [];
  const serviceTypeIds = Array.isArray(plan?.serviceTypeIds) ? plan.serviceTypeIds : [];
  const existingById = new Map(
    (existingDeliverables || []).map((deliverable) => [String(deliverable.id), deliverable])
  );

  return rows
    .map((row) => {
      const name = String(row?.name || '').trim();
      if (!name) return null;
      const existing = existingById.get(String(row.id));
      const existingPools = new Map(
        (existing?.pools || []).map((pool) => [String(pool.serviceTypeId), pool])
      );
      const pools = serviceTypeIds
        .map((serviceTypeId) => {
          const estimatedHours = Number(row?.pools?.[serviceTypeId]) || 0;
          if (estimatedHours <= 0) return null;
          const previous = existingPools.get(String(serviceTypeId));
          const next = { serviceTypeId, estimatedHours };
          if (Number.isFinite(previous?.assignedHours)) next.assignedHours = Number(previous.assignedHours) || 0;
          if (Number.isFinite(previous?.actualHours)) next.actualHours = Number(previous.actualHours) || 0;
          return next;
        })
        .filter(Boolean);
      const dueDate = row.dueDate === undefined ? (existing?.dueDate || null) : (row.dueDate || null);
      const previousDueDate = existing?.dueDate || null;
      let originalDueDate = existing?.originalDueDate || null;
      let dueDateHistory = Array.isArray(existing?.dueDateHistory) ? [...existing.dueDateHistory] : [];
      if (dueDate !== previousDueDate) {
        if (!originalDueDate && previousDueDate) {
          originalDueDate = previousDueDate;
        }
        dueDateHistory = [
          ...dueDateHistory,
          {
            fromDate: previousDueDate,
            toDate: dueDate,
            changedAt: new Date().toISOString(),
            changedByUserId: null,
          },
        ];
      }
      const nextPoolsByCycle = { ...(existing?.poolsByCycle || {}) };
      if (isRetainer && cycleKey) {
        nextPoolsByCycle[cycleKey] = pools;
      }
      return {
        id: row.id || createId('del'),
        name,
        dueDate,
        originalDueDate,
        dueDateHistory,
        dependencyDeliverableIds: Array.isArray(existing?.dependencyDeliverableIds) ? existing.dependencyDeliverableIds : [],
        poolsByCycle: nextPoolsByCycle,
        pools,
        tasks: Array.isArray(existing?.tasks) ? existing.tasks : [],
      };
    })
    .filter(Boolean);
}

export function sumRowHours(row, serviceTypeIds = []) {
  return (serviceTypeIds || []).reduce((sum, id) => sum + (Number(row?.pools?.[id]) || 0), 0);
}

function syncRowsWithServiceTypes(rows, serviceTypeIds) {
  return rows.map((row) => ({
    ...row,
    pools: ensurePools(serviceTypeIds, row.pools || {}),
  }));
}

function formatHours(value) {
  const num = Number(value) || 0;
  const rounded = Math.round(num * 10) / 10;
  return `${rounded}`;
}

export function JobPlanEditor({ plan, onPlanChange, serviceTypes = [], readOnly = false }) {
  const serviceTypeIds = Array.isArray(plan?.serviceTypeIds) ? plan.serviceTypeIds : [];
  const rows = Array.isArray(plan?.rows) ? plan.rows : [];
  const activeTypes = (serviceTypes || []).filter((type) => type && type.active !== false);

  const updatePlan = (next) => {
    if (readOnly) return;
    if (typeof onPlanChange === 'function') onPlanChange(next);
  };

  const toggleServiceType = (serviceTypeId) => {
    if (readOnly) return;
    const has = serviceTypeIds.includes(serviceTypeId);
    const nextIds = has
      ? serviceTypeIds.filter((id) => id !== serviceTypeId)
      : [...serviceTypeIds, serviceTypeId];
    const nextRows = syncRowsWithServiceTypes(rows, nextIds);
    updatePlan({ ...plan, serviceTypeIds: nextIds, rows: nextRows });
  };

  const moveServiceType = (serviceTypeId, direction) => {
    if (readOnly) return;
    const index = serviceTypeIds.indexOf(serviceTypeId);
    if (index < 0) return;
    const nextIndex = index + direction;
    if (nextIndex < 0 || nextIndex >= serviceTypeIds.length) return;
    const nextIds = [...serviceTypeIds];
    const temp = nextIds[index];
    nextIds[index] = nextIds[nextIndex];
    nextIds[nextIndex] = temp;
    updatePlan({ ...plan, serviceTypeIds: nextIds });
  };

  const updateRow = (rowId, updates) => {
    if (readOnly) return;
    const nextRows = rows.map((row) => {
      if (row.id !== rowId) return row;
      const nextPools = updates.pools ? { ...row.pools, ...updates.pools } : row.pools;
      return { ...row, ...updates, pools: nextPools };
    });
    updatePlan({ ...plan, rows: nextRows });
  };

  const addRow = () => {
    if (readOnly) return;
    const nextRows = [...rows, createEmptyRow(serviceTypeIds)];
    updatePlan({ ...plan, rows: nextRows });
  };

  const removeRow = (rowId) => {
    if (readOnly) return;
    const nextRows = rows.filter((row) => row.id !== rowId);
    updatePlan({ ...plan, rows: nextRows.length ? nextRows : [createEmptyRow(serviceTypeIds)] });
  };

  const totalsByServiceType = serviceTypeIds.reduce((acc, id) => {
    acc[id] = rows.reduce((sum, row) => sum + (Number(row?.pools?.[id]) || 0), 0);
    return acc;
  }, {});
  const grandTotal = Object.values(totalsByServiceType).reduce((sum, val) => sum + (Number(val) || 0), 0);

  return h('div', { className: 'space-y-4' }, [
    h('div', { className: 'rounded-2xl border border-slate-200 dark:border-white/10 bg-white/90 dark:bg-slate-900/60 p-5' }, [
      h('div', { className: 'flex items-start justify-between gap-4 flex-wrap' }, [
        h('div', { className: 'space-y-1' }, [
          h('h3', { className: 'text-base font-semibold text-slate-900 dark:text-white' }, 'Service Types'),
          h('p', { className: 'text-sm text-slate-500 dark:text-slate-400' }, 'Pick which service types appear as columns, then order them.'),
        ]),
      ]),
      h('div', { className: 'mt-4 grid gap-3 sm:grid-cols-2' }, [
        h('div', { className: 'space-y-2' }, [
          h('div', { className: 'text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400' }, 'Select'),
          h('div', { className: 'space-y-2' }, activeTypes.map((type) => {
            const checked = serviceTypeIds.includes(type.id);
            return h('label', { key: type.id, className: 'flex items-center justify-between gap-3 rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 px-3 py-2' }, [
              h('div', { className: 'flex items-center gap-2' }, [
                h('input', {
                  type: 'checkbox',
                  checked,
                  onChange: () => toggleServiceType(type.id),
                  disabled: readOnly,
                  className: 'h-4 w-4 rounded border-slate-300 dark:border-white/20 text-netnet-purple focus:ring-netnet-purple disabled:opacity-60',
                }),
                h('span', { className: 'text-sm font-medium text-slate-700 dark:text-slate-200' }, type.name || type.id),
              ]),
              h('div', { className: 'flex items-center gap-1' }, [
                h('button', {
                  type: 'button',
                  className: 'h-7 w-7 rounded-md border border-slate-200 dark:border-white/10 text-slate-500 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white disabled:opacity-40',
                  onClick: () => moveServiceType(type.id, -1),
                  disabled: readOnly || !checked || serviceTypeIds.indexOf(type.id) <= 0,
                  title: 'Move up',
                }, '↑'),
                h('button', {
                  type: 'button',
                  className: 'h-7 w-7 rounded-md border border-slate-200 dark:border-white/10 text-slate-500 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white disabled:opacity-40',
                  onClick: () => moveServiceType(type.id, 1),
                  disabled: readOnly || !checked || serviceTypeIds.indexOf(type.id) === serviceTypeIds.length - 1,
                  title: 'Move down',
                }, '↓'),
              ]),
            ]);
          })),
        ]),
        h('div', { className: 'space-y-2' }, [
          h('div', { className: 'text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400' }, 'Order'),
          h('div', { className: 'space-y-2' }, serviceTypeIds.length
            ? serviceTypeIds.map((id) => {
              const type = activeTypes.find((item) => item.id === id);
              return h('div', { key: id, className: 'flex items-center justify-between rounded-lg border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-slate-800 px-3 py-2' }, [
                h('span', { className: 'text-sm font-medium text-slate-700 dark:text-slate-200' }, type?.name || id),
                h('div', { className: 'text-xs text-slate-500 dark:text-slate-400' }, 'Column'),
              ]);
            })
            : h('div', { className: 'text-sm text-slate-500 dark:text-slate-400' }, 'Select at least one service type.')),
        ]),
      ]),
    ]),
    h('div', { className: 'rounded-2xl border border-slate-200 dark:border-white/10 bg-white/90 dark:bg-slate-900/60 p-5' }, [
      h('div', { className: 'flex items-start justify-between gap-4 flex-wrap' }, [
        h('div', { className: 'space-y-1' }, [
          h('h3', { className: 'text-base font-semibold text-slate-900 dark:text-white' }, 'Deliverables + Available hours'),
          h('p', { className: 'text-sm text-slate-500 dark:text-slate-400' }, 'Available hours are the estimated hours you plan to spend, tracked by Service Type.'),
        ]),
        h('button', {
          type: 'button',
          className: 'inline-flex items-center justify-center h-9 px-3 rounded-md border border-slate-200 dark:border-white/10 text-sm font-semibold text-slate-700 dark:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-50',
          onClick: addRow,
          disabled: readOnly,
        }, '+ Add Deliverable'),
      ]),
      h('div', { className: 'mt-4 overflow-x-auto' }, [
        serviceTypeIds.length
          ? h('table', { className: 'min-w-full text-sm border-separate', style: { borderSpacing: '0 8px' } }, [
            h('thead', null, [
              h('tr', null, [
                h('th', { className: 'text-left text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400 px-3' }, 'Deliverable'),
                h('th', { className: 'text-left text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400 px-3' }, 'Due date'),
                ...serviceTypeIds.map((id) => {
                  const type = activeTypes.find((item) => item.id === id);
                  return h('th', { key: id, className: 'text-left text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400 px-3' }, type?.name || id);
                }),
                h('th', { className: 'text-right text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400 px-3' }, 'Total'),
                h('th', { className: 'px-3' }),
              ]),
            ]),
            h('tbody', null, rows.map((row) => (
              h('tr', { key: row.id, className: 'bg-white dark:bg-slate-900/60 shadow-sm rounded-xl' }, [
                h('td', { className: 'px-3 py-3 align-top rounded-l-xl border border-slate-200 dark:border-white/10' }, [
                  h('input', {
                    type: 'text',
                    value: row.name,
                    placeholder: 'Deliverable name',
                    onChange: (e) => updateRow(row.id, { name: e.target.value }),
                    disabled: readOnly,
                    className: 'w-full rounded-md border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 px-3 py-2 text-sm text-slate-800 dark:text-white disabled:opacity-60',
                  }),
                ]),
                h('td', { className: 'px-3 py-3 align-top border-t border-b border-slate-200 dark:border-white/10' }, [
                  h('input', {
                    type: 'date',
                    value: row.dueDate || '',
                    onChange: (e) => updateRow(row.id, { dueDate: e.target.value || null }),
                    disabled: readOnly,
                    className: 'w-36 rounded-md border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 px-2 py-2 text-sm text-slate-800 dark:text-white disabled:opacity-60',
                  }),
                ]),
                ...serviceTypeIds.map((id) => h('td', { key: id, className: 'px-3 py-3 align-top border-t border-b border-slate-200 dark:border-white/10' }, [
                  h('input', {
                    type: 'number',
                    min: 0,
                    step: 0.25,
                    value: row.pools?.[id] ?? '',
                    onChange: (e) => {
                      const nextValue = Math.max(0, Number(e.target.value) || 0);
                      updateRow(row.id, { pools: { [id]: nextValue } });
                    },
                    disabled: readOnly,
                    className: 'w-24 rounded-md border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 px-2 py-2 text-sm text-slate-800 dark:text-white disabled:opacity-60',
                  }),
                ])),
                h('td', { className: 'px-3 py-3 align-top text-right text-sm font-semibold text-slate-700 dark:text-slate-200 border-t border-b border-slate-200 dark:border-white/10' }, formatHours(sumRowHours(row, serviceTypeIds))),
                h('td', { className: 'px-3 py-3 align-top rounded-r-xl border border-slate-200 dark:border-white/10' }, [
                  h('button', {
                    type: 'button',
                    className: 'text-xs font-semibold text-slate-500 hover:text-red-600 dark:text-slate-300 dark:hover:text-red-400 disabled:opacity-50',
                    onClick: () => removeRow(row.id),
                    disabled: readOnly,
                  }, 'Remove'),
                ]),
              ])
            ))),
            h('tfoot', null, [
              h('tr', null, [
                h('td', { className: 'px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400' }, 'Totals'),
                h('td', { className: 'px-3 py-2' }),
                ...serviceTypeIds.map((id) => (
                  h('td', { key: id, className: 'px-3 py-2 text-sm font-semibold text-slate-700 dark:text-slate-200' }, formatHours(totalsByServiceType[id]))
                )),
                h('td', { className: 'px-3 py-2 text-right text-sm font-semibold text-slate-900 dark:text-white' }, formatHours(grandTotal)),
                h('td', { className: 'px-3 py-2' }),
              ]),
            ]),
          ])
          : h('div', { className: 'rounded-lg border border-dashed border-slate-200 dark:border-white/10 p-4 text-sm text-slate-500 dark:text-slate-400' }, 'Select at least one service type to start planning.'),
      ]),
    ]),
  ]);
}
