import { RowActionsMenu } from '../components/performance/primitives.js';

const { createElement: h, useEffect, useMemo, useRef, useState } = React;

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

function buildServiceTypeNameMap(serviceTypeIds = [], serviceTypes = []) {
  const knownNames = new Map(
    (serviceTypes || [])
      .filter(Boolean)
      .map((type) => [String(type.id), String(type.name || type.id || '').trim() || String(type.id)])
  );
  return (serviceTypeIds || []).reduce((acc, id) => {
    const key = String(id);
    acc[key] = knownNames.get(key) || key;
    return acc;
  }, {});
}

function createEmptyRow(serviceTypeIds, name = '') {
  return {
    id: createId('del'),
    name,
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

function arrayMove(list = [], fromIndex, toIndex) {
  if (fromIndex === toIndex || fromIndex < 0 || toIndex < 0) return list;
  const next = [...list];
  const [item] = next.splice(fromIndex, 1);
  next.splice(toIndex, 0, item);
  return next;
}

function formatHours(value) {
  const num = Number(value) || 0;
  const rounded = Math.round(num * 10) / 10;
  return `${rounded}`;
}

function parseHours(raw) {
  const trimmed = String(raw ?? '').trim();
  if (!trimmed) return 0;
  const next = Number(trimmed);
  if (!Number.isFinite(next) || next < 0) return 0;
  return Math.round(next * 100) / 100;
}

export function syncRowsWithServiceTypes(rows = [], serviceTypeIds = []) {
  return (rows || []).map((row) => ({
    ...row,
    pools: ensurePools(serviceTypeIds, row.pools || {}),
  }));
}

export function createPlanStateFromJob(job, fallbackServiceTypeIds = [], options = {}) {
  const cycleKey = options.cycleKey || null;
  const serviceTypes = options.serviceTypes || [];
  const jobTypeIds = Array.isArray(job?.serviceTypeIds) ? job.serviceTypeIds.filter(Boolean) : [];
  const poolTypeIds = collectPoolTypeIds(job?.deliverables || [], job?.kind === 'retainer' ? cycleKey : null);
  const serviceTypeIds = [...new Set([...jobTypeIds, ...poolTypeIds, ...(fallbackServiceTypeIds || [])].filter(Boolean))];
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
    : [];
  return {
    serviceTypeIds,
    serviceTypeNames: buildServiceTypeNameMap(serviceTypeIds, serviceTypes),
    rows,
  };
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
        if (!originalDueDate && previousDueDate) originalDueDate = previousDueDate;
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
      if (isRetainer && cycleKey) nextPoolsByCycle[cycleKey] = pools;
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

export function JobPlanEditor({
  plan,
  onPlanChange,
  serviceTypes = [],
  readOnly = false,
  emptyStateMessage = 'Select Service Types in Step 1',
  title = 'Deliverables + LOE',
  subtitle = 'Only the Service Types selected in Step 1 appear here as planning columns.',
  allowServiceTypeCreate = false,
  serviceTypeActionLabel = '+ Add Service Type',
  onAddServiceType,
  showRowDetailsAction = false,
  activeRowDetailsId = null,
  onOpenRowDetails,
  onDeliverableCreated,
  renderExpandedRow,
  stickyHeaderOffset = 0,
  headerActions = null,
}) {
  const serviceTypeIds = Array.isArray(plan?.serviceTypeIds) ? plan.serviceTypeIds : [];
  const rows = Array.isArray(plan?.rows) ? plan.rows : [];
  const [editingCell, setEditingCell] = useState(null);
  const [editingValue, setEditingValue] = useState('');
  const [editingNameRowId, setEditingNameRowId] = useState(null);
  const [nameDraft, setNameDraft] = useState('');
  const [addingDeliverable, setAddingDeliverable] = useState(false);
  const [deliverableDraft, setDeliverableDraft] = useState('');
  const [addingServiceType, setAddingServiceType] = useState(false);
  const [serviceTypeDraft, setServiceTypeDraft] = useState('');
  const addDeliverableInputRef = useRef(null);

  const serviceTypeLabelMap = useMemo(
    () => {
      const fallback = buildServiceTypeNameMap(serviceTypeIds, serviceTypes);
      return serviceTypeIds.reduce((acc, id) => {
        const key = String(id);
        const override = String(plan?.serviceTypeNames?.[key] || '').trim();
        acc[key] = override || fallback[key] || key;
        return acc;
      }, {});
    },
    [serviceTypeIds.join('|'), serviceTypes, JSON.stringify(plan?.serviceTypeNames || {})]
  );

  const updatePlan = (next) => {
    if (readOnly) return;
    if (typeof onPlanChange === 'function') onPlanChange(next);
  };

  const editableColumns = useMemo(() => ['name', ...serviceTypeIds], [serviceTypeIds.join('|')]);

  const scheduleFocus = (position) => {
    if (!position) return;
    setTimeout(() => {
      if (position.field === 'name') {
        const row = rows.find((item) => item.id === position.rowId);
        if (row) startNameEdit(row);
        return;
      }
      if (position.serviceTypeId) startCellEdit(position.rowId, position.serviceTypeId);
    }, 0);
  };

  const getPositionForField = (rowId, field) => {
    if (field === 'name') return { rowId, field: 'name' };
    return { rowId, field, serviceTypeId: field };
  };

  const getVerticalPosition = (rowId, field, delta) => {
    const rowIndex = rows.findIndex((row) => row.id === rowId);
    if (rowIndex < 0) return null;
    const nextIndex = rowIndex + delta;
    if (nextIndex < 0 || nextIndex >= rows.length) return null;
    return getPositionForField(rows[nextIndex].id, field);
  };

  const getHorizontalPosition = (rowId, field, delta) => {
    const rowIndex = rows.findIndex((row) => row.id === rowId);
    const colIndex = editableColumns.findIndex((item) => item === field);
    if (rowIndex < 0 || colIndex < 0) return null;
    let nextRowIndex = rowIndex;
    let nextColIndex = colIndex + delta;
    if (nextColIndex >= editableColumns.length) {
      nextRowIndex += 1;
      nextColIndex = 0;
    }
    if (nextColIndex < 0) {
      nextRowIndex -= 1;
      nextColIndex = editableColumns.length - 1;
    }
    if (nextRowIndex < 0 || nextRowIndex >= rows.length) return null;
    return getPositionForField(rows[nextRowIndex].id, editableColumns[nextColIndex]);
  };

  const updateRow = (rowId, updates) => {
    const nextRows = rows.map((row) => {
      if (row.id !== rowId) return row;
      const nextPools = updates.pools ? { ...row.pools, ...updates.pools } : row.pools;
      return { ...row, ...updates, pools: nextPools };
    });
    updatePlan({ ...plan, rows: nextRows });
  };

  const removeRow = (rowId) => {
    updatePlan({ ...plan, rows: rows.filter((row) => row.id !== rowId) });
  };

  const commitCell = (nextFocus = null) => {
    if (!editingCell) return;
    updateRow(editingCell.rowId, { pools: { [editingCell.serviceTypeId]: parseHours(editingValue) } });
    setEditingCell(null);
    setEditingValue('');
    scheduleFocus(nextFocus);
  };

  const startCellEdit = (rowId, serviceTypeId) => {
    if (readOnly) return;
    const row = rows.find((item) => item.id === rowId);
    setEditingCell({ rowId, serviceTypeId });
    setEditingValue(String(row?.pools?.[serviceTypeId] || ''));
  };

  const startNameEdit = (row) => {
    if (readOnly) return;
    setEditingNameRowId(row.id);
    setNameDraft(row.name || '');
  };

  const commitNameEdit = (nextFocus = null) => {
    if (!editingNameRowId) return;
    updateRow(editingNameRowId, { name: nameDraft });
    setEditingNameRowId(null);
    setNameDraft('');
    scheduleFocus(nextFocus);
  };

  const addDeliverable = (keepEditing = false) => {
    const nextName = String(deliverableDraft || '').trim();
    if (!nextName) {
      setAddingDeliverable(false);
      setDeliverableDraft('');
      return;
    }
    const nextRow = createEmptyRow(serviceTypeIds, nextName);
    updatePlan({
      ...plan,
      rows: [...rows, nextRow],
    });
    setAddingDeliverable(keepEditing);
    setDeliverableDraft('');
    onDeliverableCreated?.(nextRow);
    if (keepEditing) {
      setTimeout(() => addDeliverableInputRef.current?.focus(), 0);
    }
  };

  const addServiceType = () => {
    const nextName = String(serviceTypeDraft || '').trim();
    if (!nextName) {
      setAddingServiceType(false);
      setServiceTypeDraft('');
      return;
    }
    if (typeof onAddServiceType === 'function') {
      onAddServiceType(nextName);
    } else {
      const nextId = createId('svc');
      const nextIds = [...serviceTypeIds, nextId];
      updatePlan({
        ...plan,
        serviceTypeIds: nextIds,
        serviceTypeNames: {
          ...(plan?.serviceTypeNames || {}),
          [nextId]: nextName,
        },
        rows: syncRowsWithServiceTypes(rows, nextIds),
      });
    }
    setAddingServiceType(false);
    setServiceTypeDraft('');
  };

  const reorderRows = (sourceId, targetId) => {
    if (readOnly || !sourceId || !targetId || sourceId === targetId) return;
    const fromIndex = rows.findIndex((row) => row.id === sourceId);
    const toIndex = rows.findIndex((row) => row.id === targetId);
    if (fromIndex < 0 || toIndex < 0) return;
    updatePlan({ ...plan, rows: arrayMove(rows, fromIndex, toIndex) });
  };

  const reorderColumns = (sourceId, targetId) => {
    if (readOnly || !sourceId || !targetId || sourceId === targetId) return;
    const fromIndex = serviceTypeIds.findIndex((id) => id === sourceId);
    const toIndex = serviceTypeIds.findIndex((id) => id === targetId);
    if (fromIndex < 0 || toIndex < 0) return;
    const nextIds = arrayMove(serviceTypeIds, fromIndex, toIndex);
    updatePlan({
      ...plan,
      serviceTypeIds: nextIds,
      serviceTypeNames: nextIds.reduce((acc, id) => {
        const key = String(id);
        const label = serviceTypeLabelMap[key] || buildServiceTypeNameMap([key], serviceTypes)[key] || key;
        if (label) acc[key] = label;
        return acc;
      }, {}),
      rows: syncRowsWithServiceTypes(rows, nextIds),
    });
  };

  const totalsByServiceType = serviceTypeIds.reduce((acc, id) => {
    acc[id] = rows.reduce((sum, row) => sum + (Number(row?.pools?.[id]) || 0), 0);
    return acc;
  }, {});
  const grandTotal = Object.values(totalsByServiceType).reduce((sum, val) => sum + (Number(val) || 0), 0);

  if (!serviceTypeIds.length) {
    return h('div', { className: 'rounded-2xl border border-dashed border-slate-200 dark:border-white/10 bg-white/70 dark:bg-slate-900/40 px-4 py-12 text-center text-sm text-slate-500 dark:text-slate-400' }, emptyStateMessage);
  }

  return h('div', { className: 'rounded-2xl border border-slate-200 dark:border-white/10 bg-white/90 dark:bg-slate-900/60 p-5 space-y-5' }, [
    h('div', { className: 'flex flex-col gap-3 md:flex-row md:items-start md:justify-between' }, [
      h('div', { className: 'space-y-1' }, [
        h('h3', { className: 'text-base font-semibold text-slate-900 dark:text-white' }, title),
        h('p', { className: 'text-sm text-slate-500 dark:text-slate-400' }, subtitle),
      ]),
      h('div', { className: 'flex flex-wrap items-center justify-end gap-2' }, [
        headerActions,
        allowServiceTypeCreate
          ? addingServiceType
            ? h('div', { className: 'flex items-center gap-2 md:min-w-[260px]' }, [
              h('input', {
                type: 'text',
                value: serviceTypeDraft,
                autoFocus: true,
                placeholder: 'New service type',
                onChange: (event) => setServiceTypeDraft(event.target.value),
                onBlur: addServiceType,
                onKeyDown: (event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault();
                    addServiceType();
                  }
                  if (event.key === 'Escape') {
                    event.preventDefault();
                    setAddingServiceType(false);
                    setServiceTypeDraft('');
                  }
                },
                className: 'h-10 w-full rounded-md border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-950/40 px-3 text-sm text-slate-800 dark:text-white',
                disabled: readOnly,
              }),
              h('span', { className: 'text-[11px] text-slate-400 dark:text-slate-500 whitespace-nowrap' }, 'Enter to add'),
            ])
            : h('button', {
              type: 'button',
              className: 'inline-flex h-10 items-center justify-center rounded-md border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-950/40 px-4 text-sm font-semibold text-slate-700 dark:text-slate-100 hover:bg-slate-50 dark:hover:bg-white/5 disabled:opacity-50',
              onClick: () => setAddingServiceType(true),
              disabled: readOnly,
            }, serviceTypeActionLabel)
          : null,
      ]),
    ]),
    h('div', { className: 'overflow-visible rounded-2xl border border-slate-200 dark:border-white/10 bg-slate-50/80 dark:bg-slate-950/30' }, [
      h('table', { className: 'min-w-full w-full text-sm' }, [
        h('thead', { className: 'bg-slate-100/80 dark:bg-white/5' }, [
          h('tr', null, [
            h('th', {
              className: 'sticky z-30 w-[280px] px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400 bg-slate-100/95 dark:bg-slate-900/95 backdrop-blur',
              style: { top: `${stickyHeaderOffset}px` },
            }, 'Deliverable Name'),
            ...serviceTypeIds.map((serviceTypeId) => h('th', {
              key: serviceTypeId,
              className: 'sticky z-30 min-w-[148px] px-4 py-3 text-left border-l border-slate-200 dark:border-white/10 bg-slate-100/95 dark:bg-slate-900/95 backdrop-blur',
              style: { top: `${stickyHeaderOffset}px` },
              onDragOver: (event) => {
                if (readOnly) return;
                event.preventDefault();
              },
              onDrop: (event) => {
                if (readOnly) return;
                event.preventDefault();
                reorderColumns(event.dataTransfer.getData('text/plain'), serviceTypeId);
              },
            }, [
              h('div', { className: 'flex items-center gap-2' }, [
                h('button', {
                  type: 'button',
                  draggable: !readOnly,
                  onDragStart: (event) => {
                    event.dataTransfer.setData('text/plain', serviceTypeId);
                    event.dataTransfer.effectAllowed = 'move';
                  },
                  className: 'cursor-grab text-slate-400 dark:text-slate-500 disabled:cursor-default',
                  disabled: readOnly,
                  title: 'Drag to reorder column',
                }, '⋮⋮'),
                h('span', { className: 'truncate text-left text-sm font-semibold text-slate-700 dark:text-slate-200' }, serviceTypeLabelMap[serviceTypeId] || serviceTypeId),
              ]),
            ])),
            h('th', {
              className: 'sticky z-30 w-[120px] px-4 py-3 text-right border-l border-slate-200 dark:border-white/10 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400 bg-slate-100/95 dark:bg-slate-900/95 backdrop-blur',
              style: { top: `${stickyHeaderOffset}px` },
            }, 'Total Hours'),
            h('th', {
              className: 'sticky z-30 w-[80px] px-4 py-3 border-l border-slate-200 dark:border-white/10 bg-slate-100/95 dark:bg-slate-900/95 backdrop-blur',
              style: { top: `${stickyHeaderOffset}px` },
            }),
          ]),
        ]),
        h('tbody', null, [
          ...rows.map((row) => h(React.Fragment, { key: row.id }, [
            h('tr', {
              className: 'border-t border-slate-200 dark:border-white/10 bg-white/70 dark:bg-slate-900/20',
              onDragOver: (event) => {
                if (readOnly) return;
                event.preventDefault();
              },
              onDrop: (event) => {
                if (readOnly) return;
                event.preventDefault();
                reorderRows(event.dataTransfer.getData('text/plain'), row.id);
              },
            }, [
            h('td', { className: 'px-4 py-3 align-middle' }, [
              h('div', { className: 'flex items-center gap-3' }, [
                h('button', {
                  type: 'button',
                  draggable: !readOnly,
                  onDragStart: (event) => {
                    event.dataTransfer.setData('text/plain', row.id);
                    event.dataTransfer.effectAllowed = 'move';
                  },
                  className: 'cursor-grab text-slate-400 dark:text-slate-500 disabled:cursor-default',
                  disabled: readOnly,
                  title: 'Drag to reorder row',
                }, '⋮⋮'),
                editingNameRowId === row.id
                  ? h('input', {
                    type: 'text',
                    value: nameDraft,
                    autoFocus: true,
                    onChange: (event) => setNameDraft(event.target.value),
                    onBlur: commitNameEdit,
                    onKeyDown: (event) => {
                      if (event.key === 'Enter') {
                        event.preventDefault();
                        commitNameEdit(getVerticalPosition(row.id, 'name', event.shiftKey ? -1 : 1));
                      }
                      if (event.key === 'Tab') {
                        event.preventDefault();
                        commitNameEdit(getHorizontalPosition(row.id, 'name', event.shiftKey ? -1 : 1));
                      }
                      if (event.key === 'Escape') {
                        event.preventDefault();
                        setEditingNameRowId(null);
                        setNameDraft('');
                      }
                    },
                    className: 'h-9 w-full rounded-md border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-950/40 px-3 text-sm text-slate-800 dark:text-white',
                    disabled: readOnly,
                  })
                  : h('button', {
                    type: 'button',
                    className: `w-full truncate rounded-md px-3 py-2 text-left text-sm ${row.name ? 'text-slate-800 dark:text-white' : 'text-slate-400 dark:text-slate-500'} hover:bg-slate-100 dark:hover:bg-white/5`,
                    onClick: () => startNameEdit(row),
                  }, row.name || 'Untitled deliverable'),
                showRowDetailsAction
                  ? h('button', {
                    type: 'button',
                    className: [
                      'flex h-8 w-8 items-center justify-center rounded-md border transition-colors',
                      activeRowDetailsId === row.id
                        ? 'border-netnet-purple/40 bg-netnet-purple/10 text-netnet-purple'
                        : 'border-transparent text-slate-400 hover:border-slate-200 hover:bg-slate-100 hover:text-slate-700 dark:text-slate-500 dark:hover:border-white/10 dark:hover:bg-white/5 dark:hover:text-slate-200',
                    ].join(' '),
                    onClick: (event) => {
                      event.stopPropagation();
                      onOpenRowDetails?.(row.id);
                    },
                    title: 'Deliverable details',
                  }, h('svg', { viewBox: '0 0 24 24', className: 'h-4 w-4', fill: 'none', stroke: 'currentColor', strokeWidth: '1.8' }, [
                    h('circle', { cx: '12', cy: '12', r: '9' }),
                    h('path', { d: 'M12 11v5' }),
                    h('path', { d: 'M12 8h.01' }),
                  ]))
                  : null,
              ]),
            ]),
            ...serviceTypeIds.map((serviceTypeId) => {
              const isEditing = editingCell?.rowId === row.id && editingCell?.serviceTypeId === serviceTypeId;
              return h('td', {
                key: serviceTypeId,
                className: 'px-4 py-3 align-middle border-l border-slate-200 dark:border-white/10',
              }, [
                isEditing
                  ? h('input', {
                    type: 'number',
                    min: 0,
                    step: 0.25,
                    value: editingValue,
                    autoFocus: true,
                    onChange: (event) => setEditingValue(event.target.value),
                    onBlur: commitCell,
                    onKeyDown: (event) => {
                      if (event.key === 'Enter') {
                        event.preventDefault();
                        commitCell(getVerticalPosition(row.id, serviceTypeId, event.shiftKey ? -1 : 1));
                      }
                      if (event.key === 'Tab') {
                        event.preventDefault();
                        commitCell(getHorizontalPosition(row.id, serviceTypeId, event.shiftKey ? -1 : 1));
                      }
                      if (event.key === 'Escape') {
                        event.preventDefault();
                        setEditingCell(null);
                        setEditingValue('');
                      }
                    },
                    className: 'h-9 w-full rounded-md border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-950/40 px-3 text-sm text-slate-800 dark:text-white',
                    disabled: readOnly,
                  })
                  : h('button', {
                    type: 'button',
                    className: `w-full rounded-md px-3 py-2 text-left text-sm ${Number(row?.pools?.[serviceTypeId]) ? 'text-slate-800 dark:text-white' : 'text-slate-400 dark:text-slate-500'} hover:bg-slate-100 dark:hover:bg-white/5`,
                    onClick: () => startCellEdit(row.id, serviceTypeId),
                  }, Number(row?.pools?.[serviceTypeId]) ? formatHours(row.pools[serviceTypeId]) : '0'),
              ]);
            }),
            h('td', { className: 'px-4 py-3 align-middle border-l border-slate-200 dark:border-white/10 text-right text-sm font-semibold text-slate-800 dark:text-white' }, formatHours(sumRowHours(row, serviceTypeIds))),
            h('td', { className: 'px-4 py-3 align-middle border-l border-slate-200 dark:border-white/10 text-right' }, [
              h(RowActionsMenu, {
                menuItems: ['Delete deliverable'],
                onSelect: (item) => {
                  if (item === 'Delete deliverable') removeRow(row.id);
                },
              }),
            ]),
            ]),
            showRowDetailsAction && typeof renderExpandedRow === 'function'
              ? h('tr', {
                className: activeRowDetailsId === row.id
                  ? 'border-t border-slate-200/70 bg-slate-100/70 dark:border-white/10 dark:bg-slate-950/40'
                  : 'border-t border-transparent bg-transparent',
                'aria-hidden': activeRowDetailsId === row.id ? 'false' : 'true',
              }, [
                h('td', {
                  colSpan: serviceTypeIds.length + 3,
                  className: activeRowDetailsId === row.id ? 'px-4 pb-4 pt-0' : 'p-0',
                }, [
                  h('div', {
                    className: [
                      'overflow-hidden rounded-2xl border bg-slate-100/90 transition-all duration-200 ease-out dark:bg-slate-950/55',
                      activeRowDetailsId === row.id
                        ? 'border-slate-200/80 opacity-100 dark:border-white/10'
                        : 'pointer-events-none border-transparent opacity-0',
                    ].join(' '),
                    style: {
                      maxHeight: activeRowDetailsId === row.id ? '640px' : '0px',
                      transform: activeRowDetailsId === row.id ? 'translateY(0)' : 'translateY(-8px)',
                    },
                  }, renderExpandedRow(row)),
                ]),
              ])
              : null,
          ])),
          h('tr', { className: 'border-t border-slate-200 dark:border-white/10 bg-white/40 dark:bg-slate-900/10' }, [
            h('td', { className: 'px-4 py-3 align-middle' }, [
              addingDeliverable
                ? h('div', { className: 'flex items-center gap-2' }, [
                  h('input', {
                    ref: addDeliverableInputRef,
                    type: 'text',
                    value: deliverableDraft,
                    autoFocus: true,
                    placeholder: 'New deliverable name',
                    onChange: (event) => setDeliverableDraft(event.target.value),
                    onBlur: addDeliverable,
                    onKeyDown: (event) => {
                      if (event.key === 'Enter') {
                        event.preventDefault();
                        addDeliverable(true);
                      }
                      if (event.key === 'Escape') {
                        event.preventDefault();
                        setAddingDeliverable(false);
                        setDeliverableDraft('');
                      }
                    },
                    className: 'h-9 w-full rounded-md border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-950/40 px-3 text-sm text-slate-800 dark:text-white',
                    disabled: readOnly,
                  }),
                  h('span', { className: 'text-[11px] text-slate-400 dark:text-slate-500' }, 'Enter to save'),
                ])
                : h('button', {
                  type: 'button',
                  className: 'text-sm font-semibold text-slate-500 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white disabled:opacity-50',
                  onClick: () => setAddingDeliverable(true),
                  disabled: readOnly,
                }, '+ Add deliverable'),
            ]),
            ...serviceTypeIds.map((serviceTypeId) => h('td', {
              key: `${serviceTypeId}-blank`,
              className: 'border-l border-slate-200 dark:border-white/10',
            })),
            h('td', { className: 'border-l border-slate-200 dark:border-white/10' }),
            h('td', { className: 'border-l border-slate-200 dark:border-white/10' }),
          ]),
        ]),
        h('tfoot', { className: 'bg-slate-100/90 dark:bg-white/5 border-t border-slate-200 dark:border-white/10' }, [
          h('tr', null, [
            h('td', { className: 'px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400' }, 'Totals'),
            ...serviceTypeIds.map((serviceTypeId) => h('td', {
              key: `${serviceTypeId}-total`,
              className: 'px-4 py-3 border-l border-slate-200 dark:border-white/10 text-sm font-semibold text-slate-700 dark:text-slate-200',
            }, formatHours(totalsByServiceType[serviceTypeId]))),
            h('td', { className: 'px-4 py-3 border-l border-slate-200 dark:border-white/10 text-right text-sm font-semibold text-slate-900 dark:text-white' }, formatHours(grandTotal)),
            h('td', { className: 'border-l border-slate-200 dark:border-white/10' }),
          ]),
        ]),
      ]),
    ]),
    h('div', { className: 'text-[11px] text-slate-400 dark:text-slate-500' }, 'Click a deliverable name or hour cell to edit. Drag rows and selected service type columns to reorder them.'),
  ]);
}
