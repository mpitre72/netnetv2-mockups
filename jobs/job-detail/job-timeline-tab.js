import {
  getTaskCompletedTimestamp,
  getTaskStartTimestamp,
  localDateISO,
  normalizeExecutionDate,
  normalizeTaskLifecycleStatus,
} from '../task-execution-utils.js';
import { openSingleDatePickerPopover } from '../../quick-tasks/quick-task-detail.js';

const { createElement: h, useEffect, useMemo, useRef, useState } = React;

const MS_DAY = 24 * 60 * 60 * 1000;
const TIMELINE_LEFT_COL_WIDTH = 320;
const GROUP_ROW_HEIGHT = 72;
const TASK_ROW_HEIGHT = 34;
const TIMELINE_HEADER_HEIGHT = 56;
const TIMELINE_ZOOM_PRESETS = [
  { value: 'days', label: 'Day', slider: 100 },
  { value: 'weeks', label: 'Week', slider: 62 },
  { value: 'months', label: 'Month', slider: 30 },
  { value: 'year', label: 'Year', slider: 8 },
];

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

function parseISO(dateStr) {
  if (!dateStr) return null;
  const date = new Date(`${dateStr}T00:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function addDays(dateStr, days) {
  const base = parseISO(dateStr) || new Date();
  const next = new Date(base.getTime());
  next.setDate(next.getDate() + days);
  return localDateISO(next);
}

function diffDays(startStr, endStr) {
  const start = parseISO(startStr);
  const end = parseISO(endStr);
  if (!start || !end) return 0;
  return Math.round((end.getTime() - start.getTime()) / MS_DAY);
}

function formatDateLabel(dateStr) {
  if (!dateStr) return 'No date';
  const date = parseISO(dateStr);
  if (!date) return dateStr;
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(date);
}

function formatLongDate(dateStr) {
  if (!dateStr) return 'Select date';
  const date = parseISO(dateStr);
  if (!date) return dateStr;
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(date);
}

function formatShortDate(dateStr) {
  if (!dateStr) return 'No date';
  const date = parseISO(dateStr);
  if (!date) return dateStr;
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(date);
}

function formatTick(dateStr, zoom) {
  const date = parseISO(dateStr);
  if (!date) return dateStr || '';
  if (zoom === 'year' || zoom === 'months') {
    return new Intl.DateTimeFormat('en-US', { month: 'short', year: 'numeric' }).format(date);
  }
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(date);
}

function FieldShell({ label, children }) {
  return h('label', { className: 'space-y-2' }, [
    h('div', { className: 'flex items-center gap-2' }, [
      h('span', { className: 'text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400' }, label),
    ]),
    children,
  ]);
}

function normalizeTaskStatus(status) {
  return normalizeTaskLifecycleStatus(status, 'backlog');
}

function statusLabel(status) {
  if (status === 'archived') return 'Archived';
  if (status === 'completed') return 'Completed';
  if (status === 'in_progress') return 'In Progress';
  return 'Backlog';
}

function statusToneClass(status) {
  if (status === 'archived') {
    return 'bg-slate-200 text-slate-600 dark:bg-slate-800/80 dark:text-slate-300';
  }
  if (status === 'completed') {
    return 'bg-slate-200 text-slate-700 dark:bg-white/10 dark:text-slate-200';
  }
  if (status === 'in_progress') {
    return 'bg-netnet-purple/15 text-netnet-purple dark:bg-netnet-purple/20 dark:text-netnet-purple';
  }
  return 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300';
}

function buildTaskExecutionVisual(task) {
  const status = normalizeTaskStatus(task?.status);
  const dueDate = normalizeExecutionDate(task?.dueDate);
  const startedAt = getTaskStartTimestamp(task);
  const completedAt = getTaskCompletedTimestamp(task);
  const today = localDateISO();

  if (status === 'archived') {
    return { kind: 'none', status };
  }

  if (status === 'backlog') {
    return dueDate
      ? { kind: 'dot', status, anchorDate: dueDate }
      : { kind: 'none', status };
  }

  if (status === 'in_progress') {
    if (!dueDate) return { kind: 'none', status };
    const fallbackStart = startedAt || today;
    const startDate = fallbackStart <= dueDate ? fallbackStart : dueDate;
    const endDate = fallbackStart <= dueDate ? dueDate : fallbackStart;
    return { kind: 'bar', status, startDate, endDate };
  }

  const fallbackEnd = completedAt || dueDate;
  if (!fallbackEnd) {
    return { kind: 'none', status };
  }
  const fallbackStart = startedAt || dueDate || fallbackEnd;
  const startDate = fallbackStart <= fallbackEnd ? fallbackStart : fallbackEnd;
  const endDate = fallbackStart <= fallbackEnd ? fallbackEnd : fallbackStart;
  return { kind: 'bar', status, startDate, endDate };
}

function getVisualDatePoints(visual) {
  if (!visual || visual.kind === 'none') return [];
  if (visual.kind === 'dot') return visual.anchorDate ? [visual.anchorDate] : [];
  return [visual.startDate, visual.endDate].filter(Boolean);
}

function minDateValue(values = []) {
  return values.reduce((min, value) => (!min || value < min ? value : min), null);
}

function maxDateValue(values = []) {
  return values.reduce((max, value) => (!max || value > max ? value : max), null);
}

function sortTimelineTasks(tasks = []) {
  const statusOrder = { in_progress: 0, backlog: 1, completed: 2, archived: 3 };
  return [...(tasks || [])].sort((a, b) => {
    const aStatus = normalizeTaskStatus(a?.status);
    const bStatus = normalizeTaskStatus(b?.status);
    if (statusOrder[aStatus] !== statusOrder[bStatus]) {
      return statusOrder[aStatus] - statusOrder[bStatus];
    }
    const aDue = normalizeExecutionDate(a?.dueDate) || '9999-12-31';
    const bDue = normalizeExecutionDate(b?.dueDate) || '9999-12-31';
    if (aDue !== bDue) return aDue.localeCompare(bDue);
    return String(a?.title || '').localeCompare(String(b?.title || ''));
  });
}

function buildTimelineGroup(group) {
  const tasks = sortTimelineTasks(group?.tasks || []).map((task) => ({
    ...task,
    timelineVisual: buildTaskExecutionVisual(task),
  }));
  const barVisuals = tasks
    .map((task) => task.timelineVisual)
    .filter((visual) => visual?.kind === 'bar');
  const dotVisuals = tasks
    .map((task) => task.timelineVisual)
    .filter((visual) => visual?.kind === 'dot' && visual.anchorDate);
  const aggregateStatus = tasks.some((task) => normalizeTaskStatus(task.status) === 'in_progress')
    ? 'in_progress'
    : tasks.some((task) => normalizeTaskStatus(task.status) === 'completed')
      ? 'completed'
      : 'backlog';
  const aggregateVisual = barVisuals.length
    ? {
      kind: 'bar',
      status: aggregateStatus,
      startDate: minDateValue(barVisuals.map((visual) => visual.startDate).filter(Boolean)),
      endDate: maxDateValue([
        ...barVisuals.map((visual) => visual.endDate).filter(Boolean),
        ...dotVisuals.map((visual) => visual.anchorDate).filter(Boolean),
      ]),
    }
    : dotVisuals.length
      ? {
        kind: 'dot',
        status: 'backlog',
        anchorDate: maxDateValue(dotVisuals.map((visual) => visual.anchorDate).filter(Boolean)),
      }
      : { kind: 'none', status: aggregateStatus };
  const counts = tasks.reduce((acc, task) => {
    const status = normalizeTaskStatus(task.status);
    acc[status] += 1;
    return acc;
  }, { backlog: 0, in_progress: 0, completed: 0, archived: 0 });
  return {
    ...group,
    tasks,
    aggregateVisual,
    counts,
    renderableCount: tasks.filter((task) => task.timelineVisual.kind !== 'none').length,
    datePoints: tasks.flatMap((task) => getVisualDatePoints(task.timelineVisual)),
  };
}

function summarizeGroup(group) {
  const parts = [`${group.tasks.length} ${group.tasks.length === 1 ? 'task' : 'tasks'}`];
  if (group.counts.in_progress) parts.push(`${group.counts.in_progress} in progress`);
  if (group.counts.backlog) parts.push(`${group.counts.backlog} backlog`);
  if (group.counts.completed) parts.push(`${group.counts.completed} completed`);
  if (group.counts.archived) parts.push(`${group.counts.archived} archived`);
  return parts.join(' · ');
}

function getTaskTimelineCaption(task, visual) {
  const status = normalizeTaskStatus(task?.status);
  const dueDate = normalizeExecutionDate(task?.dueDate);
  const startedAt = getTaskStartTimestamp(task);
  const completedAt = getTaskCompletedTimestamp(task);

  if (status === 'archived') {
    return '';
  }

  if (status === 'backlog') {
    return '';
  }

  if (status === 'in_progress') {
    if (visual.kind === 'bar') {
      return `Started ${formatShortDate(visual.startDate)} · Due ${formatShortDate(visual.endDate)}`;
    }
    if (dueDate) return `Due ${formatShortDate(dueDate)}`;
    if (startedAt) return `Started ${formatShortDate(startedAt)}`;
    return '';
  }

  if (visual.kind === 'bar') {
    return `Started ${formatShortDate(visual.startDate)} · Completed ${formatShortDate(visual.endDate)}`;
  }
  if (completedAt) return `Completed ${formatShortDate(completedAt)}`;
  if (dueDate) return `Due ${formatShortDate(dueDate)}`;
  if (startedAt) return `Started ${formatShortDate(startedAt)}`;
  return '';
}

function renderChevron(expanded) {
  return h('svg', {
    className: 'h-4 w-4 text-slate-400 transition-transform duration-200',
    style: { transform: expanded ? 'rotate(90deg)' : 'rotate(0deg)' },
    viewBox: '0 0 20 20',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: '2',
  }, [
    h('path', { d: 'M7 5l6 5-6 5', strokeLinecap: 'round', strokeLinejoin: 'round' }),
  ]);
}

export function JobTimelineTab({ job, onJobUpdate, readOnly = false }) {
  const [zoomValue, setZoomValue] = useState(62);
  const [expandedGroupIds, setExpandedGroupIds] = useState(() => new Set());
  const duePickerCleanupRef = useRef(null);
  const timelineBodyScrollRef = useRef(null);
  const [timelineScrollLeft, setTimelineScrollLeft] = useState(0);

  useEffect(() => {
    setExpandedGroupIds(new Set());
  }, [job?.id]);

  useEffect(() => () => {
    if (duePickerCleanupRef.current) duePickerCleanupRef.current();
  }, []);

  if (!job) return null;

  const today = localDateISO();
  const zoomConfig = getTimelineZoomConfig(zoomValue);
  const projectStartDate = normalizeExecutionDate(job?.startDate || job?.timeline?.startDate);
  const projectFinishDate = normalizeExecutionDate(job?.targetEndDate || job?.timeline?.endDate);

  const groups = useMemo(() => {
    const next = (job?.deliverables || []).map((deliverable) => buildTimelineGroup({
      id: String(deliverable.id),
      name: deliverable.name || 'Deliverable',
      tasks: deliverable.tasks || [],
      isUnassigned: false,
    }));
    if (Array.isArray(job?.unassignedTasks) && job.unassignedTasks.length) {
      next.push(buildTimelineGroup({
        id: 'unassigned',
        name: 'General Job Tasks',
        tasks: job.unassignedTasks,
        isUnassigned: true,
      }));
    }
    return next;
  }, [job]);

  const allDatePoints = [
    ...groups.flatMap((group) => group.datePoints),
    ...(projectStartDate ? [projectStartDate] : []),
    ...(projectFinishDate ? [projectFinishDate] : []),
  ];
  const rangeStart = allDatePoints.reduce((min, date) => (!min || date < min ? date : min), null) || today;
  const rangeEnd = allDatePoints.reduce((max, date) => (!max || date > max ? date : max), null) || today;
  const paddedStart = addDays(rangeStart, -3);
  const paddedEnd = addDays(rangeEnd, 3);
  const rangeDays = Math.max(1, diffDays(paddedStart, paddedEnd) + 1);
  const timelineWidth = Math.max(860, rangeDays * zoomConfig.pxPerDay);
  const shouldRenderStartColumn = Boolean(projectStartDate);
  const shouldRenderFinishColumn = Boolean(projectFinishDate);
  const startLineOffset = projectStartDate ? diffDays(paddedStart, projectStartDate) * zoomConfig.pxPerDay : null;
  const finishLineOffset = projectFinishDate ? diffDays(paddedStart, projectFinishDate) * zoomConfig.pxPerDay : null;

  const ticks = useMemo(() => {
    const next = [];
    for (let offset = 0; offset <= rangeDays; offset += zoomConfig.tickStep) {
      next.push({
        date: addDays(paddedStart, offset),
        offset: offset * zoomConfig.pxPerDay,
      });
    }
    return next;
  }, [paddedStart, rangeDays, zoomConfig.pxPerDay, zoomConfig.tickStep]);

  const toggleGroup = (groupId) => {
    setExpandedGroupIds((prev) => {
      const next = new Set(prev);
      if (next.has(groupId)) {
        next.delete(groupId);
      } else {
        next.add(groupId);
      }
      return next;
    });
  };

  const renderGridLines = (key) => ticks.map((tick) => h('div', {
    key: `${key}-${tick.date}`,
    className: 'absolute inset-y-0 w-px bg-slate-200/70 dark:bg-white/10',
    style: { left: `${tick.offset}px` },
  }));

  const renderVisual = (visual, key, options = {}) => {
    if (!visual || visual.kind === 'none') return null;
    const {
      rowHeight = TASK_ROW_HEIGHT,
      variant = 'task',
    } = options;
    const isGroup = variant === 'group';

    if (visual.kind === 'dot') {
      const size = isGroup ? 14 : 10;
      const anchorOffset = diffDays(paddedStart, visual.anchorDate) * zoomConfig.pxPerDay;
      const dotClass = visual.status === 'completed'
        ? 'bg-netnet-purple/55'
        : visual.status === 'in_progress'
          ? 'bg-netnet-purple/85'
          : 'bg-slate-400/80 dark:bg-slate-500/85';
      return h('div', {
        key,
        className: `absolute z-10 rounded-full ${dotClass}`,
        style: {
          left: `${anchorOffset - (size / 2)}px`,
          top: `${(rowHeight - size) / 2}px`,
          width: `${size}px`,
          height: `${size}px`,
        },
      });
    }

    const startOffset = diffDays(paddedStart, visual.startDate) * zoomConfig.pxPerDay;
    const endOffset = diffDays(paddedStart, visual.endDate) * zoomConfig.pxPerDay;
    const width = Math.max(12, (endOffset - startOffset) + zoomConfig.pxPerDay);
    const barHeight = isGroup ? Math.round(rowHeight * 0.65) : 10;
    const barClass = isGroup
      ? (visual.status === 'completed'
        ? 'bg-netnet-purple/55 border border-netnet-purple/30 shadow-[0_10px_24px_rgba(113,31,255,0.14)]'
        : 'bg-netnet-purple shadow-[0_10px_24px_rgba(113,31,255,0.18)]')
      : (visual.status === 'completed'
        ? 'bg-netnet-purple/45 border border-netnet-purple/30'
        : 'bg-netnet-purple/80 shadow-[0_6px_16px_rgba(113,31,255,0.14)]');
    return h('div', {
      key,
      className: `absolute z-10 ${isGroup ? 'rounded-[8px]' : 'rounded-[7px]'} ${barClass}`,
      style: {
        left: `${startOffset}px`,
        top: `${(rowHeight - barHeight) / 2}px`,
        width: `${width}px`,
        height: `${barHeight}px`,
      },
    });
  };

  const renderGroupRow = (group) => {
    const expanded = expandedGroupIds.has(group.id);
    const visual = group.aggregateVisual;
    return h('div', {
      key: `group-${group.id}`,
      className: 'grid border-b border-slate-200/80 dark:border-white/10',
      style: {
        gridTemplateColumns: `${TIMELINE_LEFT_COL_WIDTH}px ${timelineWidth}px`,
        minHeight: `${GROUP_ROW_HEIGHT}px`,
      },
    }, [
      h('button', {
        type: 'button',
        className: 'flex items-center gap-3 border-r border-slate-200 bg-white/95 px-4 text-left hover:bg-slate-50 dark:border-white/10 dark:bg-slate-950/90 dark:hover:bg-slate-900/90',
        onClick: () => toggleGroup(group.id),
        'aria-expanded': expanded ? 'true' : 'false',
      }, [
        h('span', { className: 'inline-flex h-8 w-8 items-center justify-center rounded-md border border-slate-200 bg-white dark:border-white/10 dark:bg-slate-900' }, [
          renderChevron(expanded),
        ]),
        h('div', { className: 'min-w-0 space-y-1 py-3' }, [
          h('div', { className: 'truncate text-sm font-semibold text-slate-900 dark:text-white' }, group.name || 'Deliverable'),
          h('div', { className: 'flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400' }, [
            h('span', null, summarizeGroup(group)),
          ]),
        ]),
      ]),
      h('div', { className: 'relative bg-slate-950/5 dark:bg-slate-950/40', style: { minHeight: `${GROUP_ROW_HEIGHT}px` } }, [
        ...renderGridLines(`group-${group.id}`),
        renderVisual(visual, `group-${group.id}-aggregate`, {
          rowHeight: GROUP_ROW_HEIGHT,
          variant: 'group',
        }),
      ]),
    ]);
  };

  const renderTaskRow = (groupId, task) => {
    const visual = task.timelineVisual;
    const taskStart = getTaskStartTimestamp(task);
    const tooltipLines = [
      `Status: ${statusLabel(task.status)}`,
      `Due: ${task.dueDate ? formatShortDate(task.dueDate) : 'No date'}`,
      ...(taskStart ? [`Started: ${formatShortDate(taskStart)}`] : []),
    ];
    return h('div', {
      key: `task-${task.id}`,
      className: 'grid border-b border-slate-200/60 dark:border-white/5',
      style: {
        gridTemplateColumns: `${TIMELINE_LEFT_COL_WIDTH}px ${timelineWidth}px`,
        minHeight: `${TASK_ROW_HEIGHT}px`,
      },
    }, [
      h('div', { className: 'flex items-center border-r border-slate-200 bg-white/90 pl-12 pr-4 dark:border-white/10 dark:bg-slate-950/70' }, [
        h('div', { className: 'flex min-w-0 items-center gap-2 py-1.5' }, [
          h('span', { className: 'inline-flex h-3.5 w-3.5 shrink-0 items-center justify-center text-slate-400' }, [
            renderChevron(false),
          ]),
          h('span', { className: 'truncate text-[13px] leading-4 text-slate-800 dark:text-slate-100' }, task.title || 'Untitled task'),
          h('span', {
            className: 'inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full border border-slate-200 text-[10px] font-semibold text-slate-500 dark:border-white/10 dark:text-slate-400',
            tabIndex: 0,
            'data-tooltip': tooltipLines.join('\n'),
            'aria-label': 'Task details',
          }, 'ⓘ'),
        ]),
      ]),
      h('div', { className: 'relative bg-white/40 dark:bg-slate-950/30', style: { minHeight: `${TASK_ROW_HEIGHT}px` } }, [
        ...renderGridLines(`task-${groupId}-${task.id}`),
        renderVisual(visual, `task-visual-${task.id}`, {
          rowHeight: TASK_ROW_HEIGHT,
          variant: 'task',
        }),
      ]),
    ]);
  };

  const renderEmptyTaskRow = (groupId) => h('div', {
    key: `empty-${groupId}`,
    className: 'grid border-b border-slate-200/60 dark:border-white/5',
    style: {
      gridTemplateColumns: `${TIMELINE_LEFT_COL_WIDTH}px ${timelineWidth}px`,
      minHeight: `${TASK_ROW_HEIGHT}px`,
    },
  }, [
    h('div', { className: 'flex items-center border-r border-slate-200 bg-white/90 pl-12 pr-4 text-sm text-slate-500 dark:border-white/10 dark:bg-slate-950/70 dark:text-slate-400' }, 'No tasks yet'),
    h('div', { className: 'relative bg-white/40 dark:bg-slate-950/30', style: { minHeight: `${TASK_ROW_HEIGHT}px` } }, [
      ...renderGridLines(`empty-${groupId}`),
    ]),
  ]);

  const renderedTimelineRows = groups.length
    ? groups.flatMap((group) => {
      const rows = [renderGroupRow(group)];
      if (expandedGroupIds.has(group.id)) {
        if (group.tasks.length) {
          rows.push(...group.tasks.map((task) => renderTaskRow(group.id, task)));
        } else {
          rows.push(renderEmptyTaskRow(group.id));
        }
      }
      return rows;
    })
    : [
      h('div', {
        key: 'empty-timeline',
        className: 'grid',
        style: {
          gridTemplateColumns: `${TIMELINE_LEFT_COL_WIDTH}px ${timelineWidth}px`,
          minHeight: `${GROUP_ROW_HEIGHT}px`,
        },
      }, [
        h('div', { className: 'flex items-center border-r border-slate-200 bg-white/95 px-4 text-sm text-slate-500 dark:border-white/10 dark:bg-slate-950/90 dark:text-slate-400' }, 'No deliverables yet'),
        h('div', { className: 'relative bg-slate-950/5 dark:bg-slate-950/40', style: { minHeight: `${GROUP_ROW_HEIGHT}px` } }, [
          ...renderGridLines('empty'),
        ]),
      ]),
    ];

  const timelineBodyHeight = groups.length
    ? groups.reduce((total, group) => total + GROUP_ROW_HEIGHT + (
      expandedGroupIds.has(group.id)
        ? ((group.tasks.length || 1) * TASK_ROW_HEIGHT)
        : 0
    ), 0)
    : GROUP_ROW_HEIGHT;

  const updateProjectDates = (patch = {}) => {
    if (typeof onJobUpdate !== 'function' || readOnly) return false;
    const nextStart = Object.prototype.hasOwnProperty.call(patch, 'startDate')
      ? normalizeExecutionDate(patch.startDate)
      : projectStartDate;
    const nextFinish = Object.prototype.hasOwnProperty.call(patch, 'targetEndDate')
      ? normalizeExecutionDate(patch.targetEndDate)
      : projectFinishDate;
    if (nextStart && nextFinish && nextStart > nextFinish) {
      window?.showToast?.('Start date must be on or before end date.');
      return false;
    }
    onJobUpdate(patch);
    return true;
  };

  const openProjectDatePicker = (anchorEl, field) => {
    if (!anchorEl || typeof onJobUpdate !== 'function' || readOnly) return;
    const value = field === 'startDate' ? projectStartDate : projectFinishDate;
    if (duePickerCleanupRef.current) duePickerCleanupRef.current();
    duePickerCleanupRef.current = openSingleDatePickerPopover({
      anchorEl,
      value,
      onSelect: (next) => {
        updateProjectDates({ [field]: next || null });
      },
      onClear: () => {
        updateProjectDates({ [field]: null });
      },
      onClose: () => {
        duePickerCleanupRef.current = null;
      },
    });
  };

  const updateZoomValue = (value) => {
    const safeValue = Math.max(0, Math.min(100, Number(value) || 62));
    setZoomValue(safeValue);
  };

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

  return h('div', { className: 'space-y-5 pb-12' }, [
    h('style', null, `
      .job-timeline-scroll::-webkit-scrollbar {
        height: 4px;
      }
      .job-timeline-scroll::-webkit-scrollbar-track {
        background: transparent;
      }
      .job-timeline-scroll::-webkit-scrollbar-thumb {
        background: rgba(148, 163, 184, 0.35);
        border-radius: 999px;
      }
    `),
    h('div', {
      className: 'overflow-hidden rounded-[28px] border border-slate-200/80 bg-white shadow-sm dark:border-white/10 dark:bg-slate-950',
    }, [
      h('div', { className: 'flex flex-wrap items-center justify-between gap-3 bg-white p-5 dark:bg-slate-950' }, [
        h('div', { className: 'grid gap-3 sm:grid-cols-2 lg:grid-cols-[180px_180px]' }, [
          h(FieldShell, { label: 'Start Date' }, h('button', {
            type: 'button',
            className: 'flex h-10 w-full items-center justify-between rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-700 dark:border-white/10 dark:bg-slate-900 dark:text-slate-200',
            onClick: (event) => openProjectDatePicker(event.currentTarget, 'startDate'),
          }, [
            h('span', null, formatLongDate(projectStartDate)),
            h('svg', { viewBox: '0 0 24 24', className: 'h-4 w-4 text-slate-400', fill: 'none', stroke: 'currentColor', strokeWidth: '2' }, [
              h('rect', { x: '3', y: '4', width: '18', height: '18', rx: '2' }),
              h('line', { x1: '16', y1: '2', x2: '16', y2: '6' }),
              h('line', { x1: '8', y1: '2', x2: '8', y2: '6' }),
            ]),
          ])),
          h(FieldShell, { label: 'End Date' }, h('button', {
            type: 'button',
            className: 'flex h-10 w-full items-center justify-between rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-700 dark:border-white/10 dark:bg-slate-900 dark:text-slate-200',
            onClick: (event) => openProjectDatePicker(event.currentTarget, 'targetEndDate'),
          }, [
            h('span', null, formatLongDate(projectFinishDate)),
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
          }, 'Deliverable / Task'),
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
                }, formatTick(tick.date, zoomConfig.mode)),
              ])),
            ]),
          ]),
        ]),
      ]),
    ]),
    h('div', { className: 'overflow-hidden rounded-[28px] border border-slate-200/80 bg-white/85 p-4 shadow-sm dark:border-white/10 dark:bg-slate-950/40 md:-mt-px md:p-5' }, [
      h('div', {
        ref: timelineBodyScrollRef,
        className: 'job-timeline-scroll overflow-x-auto overflow-y-hidden',
        style: { scrollbarWidth: 'thin', scrollbarColor: 'rgba(148,163,184,0.35) transparent' },
        onScroll: (event) => setTimelineScrollLeft(event.currentTarget.scrollLeft || 0),
      }, [
        h('div', { className: 'relative', style: { minWidth: `${TIMELINE_LEFT_COL_WIDTH + timelineWidth}px` } }, [
          h('div', { className: 'relative' }, [
              h('div', {
              className: 'pointer-events-none absolute z-[5]',
              style: {
                top: '0px',
                left: `${TIMELINE_LEFT_COL_WIDTH}px`,
                width: `${timelineWidth}px`,
                height: `${timelineBodyHeight}px`,
              },
            }, [
              shouldRenderStartColumn && startLineOffset !== null
                ? h('button', {
                  type: 'button',
                  className: 'pointer-events-auto absolute bottom-0 top-0 cursor-pointer',
                  style: { left: `${startLineOffset}px` },
                  onClick: (event) => {
                    event.stopPropagation();
                    openProjectDatePicker(event.currentTarget, 'startDate');
                  },
                  'aria-label': 'Edit project start date',
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
                ? h('button', {
                  type: 'button',
                  className: 'pointer-events-auto absolute bottom-0 top-0 cursor-pointer',
                  style: { left: `${finishLineOffset}px` },
                  onClick: (event) => {
                    event.stopPropagation();
                    openProjectDatePicker(event.currentTarget, 'targetEndDate');
                  },
                  'aria-label': 'Edit project end date',
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
            ...renderedTimelineRows,
          ]),
        ]),
      ]),
    ]),
  ]);
}
