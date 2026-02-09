import { DeliverableLOEMeters } from '../deliverable-loe-meters.js';
import { openSingleDatePickerPopover } from '../../quick-tasks/quick-task-detail.js';
import { renderMiniMeters } from '../../quick-tasks/quick-tasks-helpers.js';
import { JobKanbanTab } from './job-kanban-tab.js';

const { createElement: h, useEffect, useMemo, useRef, useState } = React;

const COLUMN_ORDER = [
  'drag',
  'title',
  'description',
  'chat',
  'assignees',
  'service',
  'due',
  'meter',
  'actions',
];

const EDITABLE_FIELDS = ['title', 'description', 'status', 'assignees', 'service', 'dueDate', 'loe'];
const STATUS_OPTIONS = [
  { value: 'backlog', label: 'Backlog' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'completed', label: 'Completed' },
];
const DELIVERABLE_STATUS_OPTIONS = [
  { value: 'backlog', label: 'Backlog' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'completed', label: 'Completed' },
];
const HEALTH_STATUS_LABELS = {
  over: 'Drifting',
  tight: 'Tight',
  ok: 'On track',
  muted: 'On track',
};
const CONFIDENCE_OPTIONS = [
  { value: 'not_set', label: 'Not set' },
  { value: 'high', label: 'High' },
  { value: 'medium', label: 'Medium' },
  { value: 'low', label: 'Low' },
];
const DEMO_CHAT_STATES = {
  'UX + Visual Design': { totalMessages: 0, hasUnreadMessages: false, mentionCount: 0 },
  'Frontend Build': { totalMessages: 6, hasUnreadMessages: false, mentionCount: 0 },
  'E-commerce': { totalMessages: 4, hasUnreadMessages: true, mentionCount: 0 },
  'General Job Tasks': { totalMessages: 3, hasUnreadMessages: true, mentionCount: 2 },
};

function renderHeaderChatIndicator({ hasChats, hasNewChats, mentionCount }) {
  const badgeValue = mentionCount > 9 ? '9+' : mentionCount || '';
  const toneClass = hasChats ? 'text-white' : 'text-slate-500';
  return React.createElement('span', { className: `relative inline-flex items-center ${toneClass}` }, [
    React.createElement('svg', { viewBox: '0 0 24 24', className: 'h-4 w-4', fill: 'none', stroke: 'currentColor', strokeWidth: '1.8' }, [
      React.createElement('path', { d: 'M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4z' }),
    ]),
    mentionCount > 0
      ? React.createElement('span', { className: 'absolute -top-1 -right-2 min-w-[16px] h-4 rounded-full bg-[#5FCEA8] text-[10px] font-semibold text-slate-900 px-1 flex items-center justify-center shadow' }, badgeValue)
      : hasNewChats
        ? React.createElement('span', { className: 'absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-white shadow' })
        : null,
  ]);
}

function DeliverableIndicatorBox({
  label,
  valueNode,
  revealText,
  boxProps = {},
}) {
  return React.createElement('div', { className: 'w-[152px] h-[64px]', ...boxProps }, [
    React.createElement('div', { className: 'h-full rounded-lg border border-slate-200/50 dark:border-white/10 bg-white/5 dark:bg-slate-900/40 px-3 py-2 text-left flex flex-col justify-between' }, [
      React.createElement('div', { className: 'text-[9px] uppercase tracking-wide text-slate-400' }, label),
      React.createElement('div', { className: 'min-w-0' }, valueNode),
      React.createElement('div', {
        className: 'text-[10px] leading-[12px] h-[12px] text-slate-400/80 opacity-0 group-hover/kpi:opacity-60 transition-opacity whitespace-nowrap',
      }, revealText || ''),
    ]),
  ]);
}

function DeliverableHeaderRow({
  groupId,
  groupName,
  isExpanded,
  isMuted,
  deliverableStatus,
  deliverableDueDate,
  deliverableOverdue,
  healthStatus,
  healthRatio,
  healthTimelineRatio,
  hasChats,
  hasNewChats,
  mentionCount,
  showPools,
  pools,
  serviceTypes,
  confidenceValue,
  onConfidenceChange,
  confidenceMenuOpen,
  onToggleConfidenceMenu,
  statusMenuOpen,
  onToggleStatusMenu,
  onStatusChange,
  onOpenDuePicker,
  onToggle,
  onOpenChat,
}) {
  const chevronRotation = isExpanded ? 'rotate(180deg)' : 'rotate(0deg)';
  const healthColor = healthStatus === 'over'
    ? 'bg-rose-500'
    : healthStatus === 'tight'
      ? 'bg-amber-500'
      : 'bg-emerald-500';
  const healthBarHeight = 'h-4';
  const rowClass = `${isMuted ? 'bg-[#1F194C]' : 'bg-[#1F2937]'} border-b border-slate-900/60`;
  const cellPadding = 'px-6 py-4';
  const statusLabel = HEALTH_STATUS_LABELS[healthStatus] || 'On track';
  const effortPercent = Math.round(clamp(healthRatio, 0, 1.2) * 100);
  const timePercent = Math.round(clamp(healthTimelineRatio || 0, 0, 1.2) * 100);
  const healthRolloverLine = `${statusLabel} \u00b7 E${effortPercent}% \u00b7 T${timePercent}%`;
  const confidenceLabel = CONFIDENCE_OPTIONS.find((option) => option.value === confidenceValue)?.label || 'Not set';
  const confidenceRolloverLine = 'Manual forecast';
  const deliverableStatusLabel = DELIVERABLE_STATUS_OPTIONS.find((option) => option.value === deliverableStatus)?.label || 'Backlog';
  const dueDateLabel = formatShortDate(deliverableDueDate);

  return React.createElement('tr', { className: rowClass }, [
    React.createElement('td', { colSpan: COLUMN_ORDER.length, className: cellPadding }, [
      React.createElement('div', { className: isExpanded ? 'space-y-3' : '' }, [
        React.createElement('div', { className: 'grid grid-cols-[1fr_auto] items-center gap-4' }, [
          React.createElement('div', { className: 'flex items-center gap-3' }, [
            React.createElement('button', {
              type: 'button',
              className: 'h-8 w-8 flex items-center justify-center rounded-full border border-slate-200/70 text-slate-200',
              onClick: (event) => {
                event.stopPropagation();
                onToggle?.();
              },
              'aria-label': isExpanded ? 'Collapse deliverable' : 'Expand deliverable',
            }, React.createElement('svg', { className: 'h-4 w-4 transition-transform', style: { transform: chevronRotation }, fill: 'none', stroke: 'currentColor', viewBox: '0 0 24 24' }, [
              React.createElement('path', { strokeLinecap: 'round', strokeLinejoin: 'round', strokeWidth: '2', d: 'M19 9l-7 7-7-7' }),
            ])),
            React.createElement('div', { className: `text-sm font-semibold ${isMuted ? 'text-slate-300' : 'text-white'}` }, groupName),
          ]),
          React.createElement('div', { className: 'justify-self-end flex items-stretch gap-3 pb-2' }, [
            React.createElement('div', { className: 'flex items-stretch gap-3 group/kpi' }, [
              DeliverableIndicatorBox({
                label: 'Status',
                revealText: `Status: ${deliverableStatusLabel}`,
                valueNode: React.createElement('div', { className: 'relative w-full' }, [
                  React.createElement('button', {
                    type: 'button',
                    className: 'text-[12px] font-semibold text-slate-200 whitespace-nowrap text-left w-full',
                    onClick: (event) => {
                      event.stopPropagation();
                      onToggleStatusMenu?.();
                    },
                    onMouseDown: (event) => event.stopPropagation(),
                    'data-deliverable-status-trigger': groupId,
                    'aria-haspopup': 'menu',
                    'aria-expanded': statusMenuOpen ? 'true' : 'false',
                  }, deliverableStatusLabel),
                  statusMenuOpen
                    ? React.createElement('div', {
                      className: 'contacts-action-menu',
                      'data-deliverable-status-menu': groupId,
                    }, DELIVERABLE_STATUS_OPTIONS.map((option) => (
                      React.createElement('button', {
                        key: option.value,
                        type: 'button',
                        onClick: (event) => {
                          event.stopPropagation();
                          onStatusChange?.(option.value);
                        },
                      }, option.label)
                    )))
                    : null,
                ]),
              }),
              DeliverableIndicatorBox({
                label: 'Due',
                revealText: deliverableDueDate
                  ? `${deliverableOverdue ? 'Overdue' : 'Due'} ${dueDateLabel}`
                  : 'No due date',
                valueNode: React.createElement('button', {
                  type: 'button',
                  className: `text-[12px] font-semibold whitespace-nowrap text-left w-full ${deliverableOverdue ? 'text-rose-400' : 'text-slate-200'}`,
                  onClick: (event) => {
                    event.stopPropagation();
                    onOpenDuePicker?.(event.currentTarget, groupId, deliverableDueDate);
                  },
                  onMouseDown: (event) => event.stopPropagation(),
                  'aria-label': 'Edit due date',
                }, dueDateLabel),
              }),
              DeliverableIndicatorBox({
                label: 'Health',
                revealText: healthRolloverLine,
                valueNode: React.createElement('div', {
                  className: `${healthBarHeight} w-full rounded-full border border-slate-200/70 dark:border-white/10 bg-slate-100 dark:bg-white/10 shadow-inner overflow-hidden`,
                }, [
                  React.createElement('div', {
                    className: `${healthColor} h-full`,
                    style: { width: `${clamp(healthRatio * 100, 0, 100)}%` },
                  }),
                ]),
              }),
              DeliverableIndicatorBox({
                label: 'Confidence',
                revealText: confidenceRolloverLine,
                boxProps: {
                  onClick: (event) => event.stopPropagation(),
                  onMouseDown: (event) => event.stopPropagation(),
                },
                valueNode: React.createElement('div', { className: 'relative w-full flex items-center' }, [
                  React.createElement('button', {
                    type: 'button',
                    className: 'inline-flex w-full items-center justify-between gap-2 text-[12px] font-semibold text-slate-200 leading-none',
                    onClick: (event) => {
                      event.stopPropagation();
                      onToggleConfidenceMenu?.();
                    },
                    onMouseDown: (event) => event.stopPropagation(),
                    'data-confidence-trigger': groupId,
                    'aria-haspopup': 'menu',
                    'aria-expanded': confidenceMenuOpen ? 'true' : 'false',
                  }, [
                    React.createElement('span', { className: 'truncate' }, confidenceLabel),
                    React.createElement('svg', { className: 'h-3 w-3 text-slate-400', viewBox: '0 0 20 20', fill: 'none', stroke: 'currentColor', strokeWidth: '2' }, [
                      React.createElement('path', { d: 'M6 8l4 4 4-4', strokeLinecap: 'round', strokeLinejoin: 'round' }),
                    ]),
                  ]),
                  confidenceMenuOpen
                    ? React.createElement('div', {
                      className: 'contacts-action-menu',
                      'data-confidence-menu': groupId,
                    }, CONFIDENCE_OPTIONS.map((option) => (
                      React.createElement('button', {
                        key: option.value,
                        type: 'button',
                        onClick: (event) => {
                          event.stopPropagation();
                          onConfidenceChange?.(option.value);
                        },
                      }, option.label)
                    )))
                    : null,
                ]),
              }),
            ]),
            React.createElement('button', {
              type: 'button',
              className: 'inline-flex items-center',
              onClick: (event) => {
                if (!onOpenChat || isMuted) return;
                event.stopPropagation();
                onOpenChat({ type: 'deliverable', deliverableId: groupId });
              },
              disabled: !onOpenChat || isMuted,
              'aria-label': 'Open deliverable chat',
            }, renderHeaderChatIndicator({
              hasChats,
              hasNewChats,
              mentionCount,
            })),
          ]),
        ]),
        showPools
          ? React.createElement('div', { className: 'group relative rounded-xl border border-slate-200/10 dark:border-white/10 bg-slate-900/40 p-3' }, [
            React.createElement('div', {
              className: 'absolute left-3 top-2 text-[10px] tracking-wide text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none',
            }, 'Available Services'),
            React.createElement(DeliverableLOEMeters, {
              deliverableId: groupId,
              pools,
              serviceTypes,
              className: 'mt-1',
            }),
          ])
          : null,
      ]),
    ]),
  ]);
}

function createId(prefix) {
  return `${prefix}_${Math.random().toString(36).slice(2, 9)}`;
}

function createEmptyDraftRow() {
  return {
    title: '',
    description: '',
    status: 'in_progress',
    dueDate: '',
    assigneeUserId: '',
    serviceTypeId: '',
    loeHours: '',
  };
}

function confidenceStorageKey(jobId) {
  return `netnet_job_confidence_${jobId || 'unknown'}`;
}

function loadConfidenceMap(jobId) {
  if (!jobId) return {};
  try {
    const raw = localStorage.getItem(confidenceStorageKey(jobId));
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch (e) {
    return {};
  }
}

function saveConfidenceMap(jobId, map) {
  if (!jobId) return;
  try {
    localStorage.setItem(confidenceStorageKey(jobId), JSON.stringify(map || {}));
  } catch (e) {
    // ignore storage errors
  }
}

function formatDateInput(value) {
  return value || '';
}

function formatHours(value) {
  const hours = Number(value) || 0;
  return `${hours % 1 ? hours.toFixed(1) : hours}h`;
}

function getActualHours(task) {
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

function renderQuickTaskMeter(taskLike, actualHours) {
  return h('div', {
    className: 'min-w-[160px]',
    dangerouslySetInnerHTML: { __html: renderMiniMeters(taskLike, actualHours) },
  });
}

function formatDueIn(task) {
  if (!task?.dueDate) return { label: '—', tone: 'muted' };
  if (task.status === 'completed') return { label: 'Done', tone: 'muted' };
  const today = new Date();
  const due = new Date(`${task.dueDate}T00:00:00`);
  if (Number.isNaN(due.getTime())) return { label: task.dueDate, tone: 'muted' };
  const diffMs = due.setHours(0, 0, 0, 0) - today.setHours(0, 0, 0, 0);
  const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays < 0) return { label: 'Overdue', tone: 'danger' };
  if (diffDays === 0) return { label: 'Due today', tone: 'warn' };
  return { label: `${diffDays}d`, tone: diffDays <= 5 ? 'warn' : 'neutral' };
}

function formatShortDate(dateValue) {
  if (!dateValue) return '—';
  const date = new Date(`${dateValue}T00:00:00`);
  if (Number.isNaN(date.getTime())) return dateValue;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function isOverdueDate(dateValue) {
  if (!dateValue) return false;
  const today = new Date();
  const due = new Date(`${dateValue}T00:00:00`);
  if (Number.isNaN(due.getTime())) return false;
  return due.setHours(0, 0, 0, 0) < today.setHours(0, 0, 0, 0);
}

function getStatusLabel(status) {
  const match = STATUS_OPTIONS.find((option) => option.value === status);
  return match ? match.label : 'Backlog';
}

function getInitials(name) {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '?';
  const first = parts[0][0] || '';
  const last = parts.length > 1 ? parts[parts.length - 1][0] : '';
  return `${first}${last}`.toUpperCase();
}

function sortTasks(tasks = []) {
  const order = (task) => {
    if (task.status === 'in_progress') return 0;
    if (task.status === 'backlog' && !task.isDraft) return 1;
    if (task.isDraft) return 2;
    if (task.status === 'completed') return 3;
    return 4;
  };
  return tasks
    .map((task, idx) => ({ task, idx }))
    .sort((a, b) => {
      const rankDiff = order(a.task) - order(b.task);
      return rankDiff !== 0 ? rankDiff : a.idx - b.idx;
    })
    .map((item) => item.task);
}

function sumEstimated(pools = []) {
  return (pools || []).reduce((sum, pool) => sum + (Number(pool?.estimatedHours) || 0), 0);
}

function sumAllocations(task) {
  return (task?.allocations || []).reduce((sum, alloc) => sum + (Number(alloc?.loeHours) || 0), 0);
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function getRatioStatus(ratio) {
  if (ratio >= 1) return 'over';
  if (ratio >= 0.85) return 'tight';
  if (ratio > 0) return 'ok';
  return 'muted';
}

function getTimelineRatio(dueDate) {
  if (!dueDate) return 0;
  const today = new Date();
  const due = new Date(`${dueDate}T00:00:00`);
  if (Number.isNaN(due.getTime())) return 0;
  const diffMs = due.setHours(0, 0, 0, 0) - today.setHours(0, 0, 0, 0);
  const diffDays = diffMs / (1000 * 60 * 60 * 24);
  if (diffDays <= 0) return 1.1;
  return clamp(1 - diffDays / 30, 0, 1);
}

function getServiceTypeLabels(task, serviceTypeMap) {
  const ids = (task.allocations || [])
    .map((alloc) => String(alloc.serviceTypeId || ''))
    .filter(Boolean);
  const unique = [...new Set(ids)];
  if (!unique.length) return '—';
  return unique
    .map((id) => serviceTypeMap.get(id)?.name || 'Service')
    .join(', ');
}

function getAllowedServiceTypeIds(deliverable) {
  const pools = deliverable?.effectivePools || deliverable?.pools || [];
  return (pools || [])
    .filter((pool) => Number(pool?.estimatedHours) > 0)
    .map((pool) => String(pool.serviceTypeId));
}

function isTaskReady(task, deliverable) {
  if (!task || !String(task.title || '').trim()) return false;
  if (!String(task.description || '').trim()) return false;
  if (!task.dueDate) return false;
  const allocations = task.allocations || [];
  if (!allocations.length) return false;
  const allowedTypes = new Set(getAllowedServiceTypeIds(deliverable));
  if (!allowedTypes.size) return false;
  return allocations.every((alloc) => {
    if (!alloc) return false;
    const assigneeOk = !!alloc.assigneeUserId;
    const serviceOk = !!alloc.serviceTypeId && allowedTypes.has(String(alloc.serviceTypeId));
    const loeOk = Number(alloc.loeHours) > 0;
    return assigneeOk && serviceOk && loeOk;
  });
}

export function JobTasksExecutionTable({
  job,
  deliverables,
  unassignedTasks,
  serviceTypes,
  members,
  assigneeOptions,
  chatIndicators,
  onOpenChat,
  onOpenDrawer,
  onJobUpdate,
  readOnly,
  cycleKey,
  taskMetaMap,
  collapsedMap,
  onToggleCollapse,
}) {
  const tableRef = useRef(null);
  const buildExpandedGroups = (items, collapsed = {}) => {
    const next = new Set();
    const list = [...(items || []), { id: 'unassigned' }];
    list.forEach((item) => {
      const hasValue = Object.prototype.hasOwnProperty.call(collapsed || {}, item.id);
      const isCollapsed = hasValue ? collapsed[item.id] : true;
      if (!isCollapsed) next.add(item.id);
    });
    return next;
  };

  const [expandedGroups, setExpandedGroups] = useState(() => buildExpandedGroups(deliverables, collapsedMap || {}));
  const [confidenceMap, setConfidenceMap] = useState(() => loadConfidenceMap(job?.id));
  const [openConfidenceMenuId, setOpenConfidenceMenuId] = useState(null);
  const [openDeliverableStatusMenuId, setOpenDeliverableStatusMenuId] = useState(null);
  const [statusPrompt, setStatusPrompt] = useState(null);
  const [statusPromptDate, setStatusPromptDate] = useState(() => formatDateInput(new Date().toISOString().slice(0, 10)));
  const [expandedTaskIds, setExpandedTaskIds] = useState(() => new Set());
  const [editingCell, setEditingCell] = useState(null);
  const [editingValue, setEditingValue] = useState('');
  const [descriptionEditor, setDescriptionEditor] = useState(null);
  const [draftDescriptionEditor, setDraftDescriptionEditor] = useState(null);
  const [draftRows, setDraftRows] = useState({});
  const [openDraftRows, setOpenDraftRows] = useState({});
  const [draftFocusKey, setDraftFocusKey] = useState(null);
  const [dragState, setDragState] = useState(null);
  const [deliverableTaskViewMode, setDeliverableTaskViewMode] = useState({});
  const duePickerCleanupRef = useRef(null);
  const draftRowRefs = useRef({});

  const serviceTypeMap = useMemo(
    () => new Map((serviceTypes || []).map((type) => [String(type.id), type])),
    [serviceTypes]
  );
  const assigneeList = useMemo(() => {
    const base = (assigneeOptions && assigneeOptions.length ? assigneeOptions : (members || [])) || [];
    const hasMarc = base.some((member) => (
      member?.name === 'Marc Pitre' || member?.email === 'marc@hellonetnet.com'
    ));
    if (hasMarc) return base;
    return [
      ...base,
      { id: 'team_marc_pitre', name: 'Marc Pitre', email: 'marc@hellonetnet.com' },
    ];
  }, [assigneeOptions, members]);
  const memberMap = useMemo(
    () => new Map(assigneeList.map((member) => [String(member.id), member])),
    [assigneeList]
  );

  const renderChatIndicator = (indicator = {}) => {
    const total = indicator.totalMessages || 0;
    const mentionCount = indicator.mentionCount || 0;
    const hasUnread = indicator.hasUnreadMessages;
    const badgeValue = mentionCount > 9 ? '9+' : mentionCount || '';
    const toneClass = total > 0
      ? 'text-slate-500 dark:text-slate-300'
      : 'text-slate-400 dark:text-slate-500';
    return h('span', { className: `relative inline-flex items-center ${toneClass}` }, [
      h('svg', { viewBox: '0 0 24 24', className: 'h-4 w-4', fill: 'none', stroke: 'currentColor', strokeWidth: '1.8' }, [
        h('path', { d: 'M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4z' }),
      ]),
      mentionCount > 0
        ? h('span', { className: 'absolute -top-1 -right-2 min-w-[16px] h-4 rounded-full bg-white text-[10px] font-semibold text-slate-900 px-1 flex items-center justify-center shadow' }, badgeValue)
        : hasUnread
          ? h('span', { className: 'absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-white shadow' })
          : null,
    ]);
  };

  useEffect(() => {
    setExpandedGroups(buildExpandedGroups(deliverables, collapsedMap || {}));
  }, [deliverables, collapsedMap]);

  useEffect(() => {
    setConfidenceMap(loadConfidenceMap(job?.id));
  }, [job?.id]);

  useEffect(() => {
    if (!openConfidenceMenuId) return undefined;
    const handleClick = (event) => {
      const target = event.target;
      if (target.closest?.('[data-confidence-menu]')) return;
      if (target.closest?.('[data-confidence-trigger]')) return;
      setOpenConfidenceMenuId(null);
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [openConfidenceMenuId]);

  useEffect(() => {
    if (!openDeliverableStatusMenuId) return undefined;
    const handleClick = (event) => {
      const target = event.target;
      if (target.closest?.('[data-deliverable-status-menu]')) return;
      if (target.closest?.('[data-deliverable-status-trigger]')) return;
      setOpenDeliverableStatusMenuId(null);
    };
    const handleKey = (event) => {
      if (event.key === 'Escape') setOpenDeliverableStatusMenuId(null);
    };
    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleKey);
    };
  }, [openDeliverableStatusMenuId]);

  useEffect(() => {
    const handleOutside = (event) => {
      const openKeys = Object.keys(openDraftRows || {}).filter((key) => openDraftRows[key]);
      if (!openKeys.length) return;
      openKeys.forEach((key) => {
        const node = draftRowRefs.current[key];
        if (node && node.contains(event.target)) return;
        const draft = draftRows[key] || createEmptyDraftRow();
        if (hasAllocationStarted(draft)) return;
        setOpenDraftRows((prev) => ({ ...(prev || {}), [key]: false }));
        setDraftRows((prev) => ({ ...prev, [key]: createEmptyDraftRow() }));
        setDraftFocusKey((prev) => (prev === key ? null : prev));
        if (draftDescriptionEditor?.key === key) setDraftDescriptionEditor(null);
      });
    };
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, [openDraftRows, draftRows, draftDescriptionEditor]);

  useEffect(() => {
    if (!expandedTaskIds || expandedTaskIds.size === 0) return undefined;
    const handleClick = (event) => {
      const table = tableRef.current;
      if (!table) return;
      const ids = Array.from(expandedTaskIds);
      const isInside = ids.some((taskId) => {
        const rows = Array.from(table.querySelectorAll(`[data-alloc-group='${taskId}']`));
        return rows.some((row) => row.contains(event.target));
      });
      if (!isInside) setExpandedTaskIds(new Set());
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [expandedTaskIds]);

  useEffect(() => () => {
    if (duePickerCleanupRef.current) duePickerCleanupRef.current();
  }, []);

  const updateConfidence = (deliverableId, value) => {
    if (!deliverableId) return;
    setConfidenceMap((prev) => {
      const next = { ...(prev || {}) };
      next[String(deliverableId)] = value;
      saveConfidenceMap(job?.id, next);
      return next;
    });
    setOpenConfidenceMenuId(null);
  };

  const updateDeliverable = (deliverableId, patch) => {
    if (typeof onJobUpdate !== 'function' || readOnly) return;
    const nextDeliverables = (job.deliverables || []).map((deliverable) => {
      if (deliverable.id !== deliverableId) return deliverable;
      return { ...deliverable, ...(patch || {}) };
    });
    onJobUpdate({ deliverables: nextDeliverables });
  };

  const openStatusPrompt = (deliverableId, nextStatus, promptType) => {
    const today = new Date().toISOString().slice(0, 10);
    setStatusPrompt({ deliverableId, nextStatus, promptType });
    setStatusPromptDate(today);
  };

  const handleDeliverableStatusSelect = (deliverable, nextStatus) => {
    if (!deliverable || !nextStatus) return;
    const currentStatus = deliverable.status || 'backlog';
    if (currentStatus === nextStatus) {
      setOpenDeliverableStatusMenuId(null);
      return;
    }
    if (currentStatus === 'backlog' && nextStatus === 'in_progress') {
      setOpenDeliverableStatusMenuId(null);
      openStatusPrompt(deliverable.id, nextStatus, 'start');
      return;
    }
    if (currentStatus === 'in_progress' && nextStatus === 'completed') {
      setOpenDeliverableStatusMenuId(null);
      openStatusPrompt(deliverable.id, nextStatus, 'complete');
      return;
    }
    setOpenDeliverableStatusMenuId(null);
    updateDeliverable(deliverable.id, {
      status: nextStatus,
      startedAt: nextStatus === 'backlog' ? null : deliverable.startedAt || null,
      completedAt: nextStatus === 'completed' ? (deliverable.completedAt || null) : null,
    });
  };

  const confirmStatusPrompt = () => {
    if (!statusPrompt) return;
    const deliverable = (job.deliverables || []).find((item) => item.id === statusPrompt.deliverableId);
    if (!deliverable) {
      setStatusPrompt(null);
      return;
    }
    if (statusPrompt.promptType === 'start') {
      updateDeliverable(deliverable.id, {
        status: 'in_progress',
        startedAt: statusPromptDate || new Date().toISOString().slice(0, 10),
      });
    }
    if (statusPrompt.promptType === 'complete') {
      updateDeliverable(deliverable.id, {
        status: 'completed',
        completedAt: statusPromptDate || new Date().toISOString().slice(0, 10),
      });
    }
    setStatusPrompt(null);
  };

  const toggleGroup = (groupId) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      const isExpanded = next.has(groupId);
      if (isExpanded) {
        next.delete(groupId);
      } else {
        next.add(groupId);
      }
      if (typeof onToggleCollapse === 'function') {
        onToggleCollapse(groupId, isExpanded);
      }
      return next;
    });
  };

  const draftKey = (deliverableId) => deliverableId || 'unassigned';
  const hasAllocationStarted = (draft) => {
    if (!draft) return false;
    if (draft.assigneeUserId) return true;
    if (draft.serviceTypeId) return true;
    return String(draft.loeHours || '').trim().length > 0;
  };
  const getDraftRow = (deliverableId) => {
    const key = draftKey(deliverableId);
    return draftRows[key] || createEmptyDraftRow();
  };
  const updateDraftRow = (deliverableId, patch) => {
    const key = draftKey(deliverableId);
    const current = draftRows[key] || createEmptyDraftRow();
    const nextDraft = { ...createEmptyDraftRow(), ...current, ...(patch || {}) };
    setDraftRows((prev) => ({
      ...prev,
      [key]: nextDraft,
    }));
    if (readOnly) return;
    if (!String(nextDraft.title || '').trim()) return;
    if (!hasAllocationStarted(nextDraft)) return;
    const task = createTaskFromDraft(deliverableId, nextDraft);
    if (task) {
      setExpandedTaskIds((prev) => {
        const next = new Set(prev);
        next.add(task.id);
        return next;
      });
    }
  };
  const clearDraftRow = (deliverableId) => {
    const key = draftKey(deliverableId);
    setDraftRows((prev) => ({ ...prev, [key]: createEmptyDraftRow() }));
  };
  const isDraftRowOpen = (deliverableId) => {
    const key = draftKey(deliverableId);
    return !!openDraftRows[key];
  };
  const openDraftRow = (deliverableId) => {
    const key = draftKey(deliverableId);
    setOpenDraftRows((prev) => ({ ...(prev || {}), [key]: true }));
    setDraftFocusKey(key);
    setDraftRows((prev) => ({
      ...prev,
      [key]: { ...createEmptyDraftRow(), ...(prev[key] || {}) },
    }));
  };
  const closeDraftRow = (deliverableId) => {
    const key = draftKey(deliverableId);
    setOpenDraftRows((prev) => ({ ...(prev || {}), [key]: false }));
    setDraftFocusKey((prev) => (prev === key ? null : prev));
    if (draftDescriptionEditor?.key === key) setDraftDescriptionEditor(null);
  };

  const openDatePicker = (anchorEl, value, onSelect) => {
    if (!anchorEl) return;
    if (duePickerCleanupRef.current) duePickerCleanupRef.current();
    duePickerCleanupRef.current = openSingleDatePickerPopover({
      anchorEl,
      value,
      onSelect: (next) => onSelect?.(next),
      onClear: () => onSelect?.(''),
      onClose: () => {
        duePickerCleanupRef.current = null;
      },
    });
  };

  const openDeliverableDatePicker = (anchorEl, deliverableId, value) => {
    if (!anchorEl || readOnly) return;
    if (duePickerCleanupRef.current) duePickerCleanupRef.current();
    duePickerCleanupRef.current = openSingleDatePickerPopover({
      anchorEl,
      value,
      onSelect: (next) => updateDeliverable(deliverableId, { dueDate: next || null }),
      onClear: () => updateDeliverable(deliverableId, { dueDate: null }),
      onClose: () => {
        duePickerCleanupRef.current = null;
      },
    });
  };

  const getTaskList = (deliverableId) => {
    if (!deliverableId) return unassignedTasks || [];
    const deliverable = (deliverables || []).find((item) => item.id === deliverableId);
    return deliverable?.tasks || [];
  };

  const updateTaskList = (deliverableId, updater) => {
    if (typeof onJobUpdate !== 'function' || readOnly) return;
    if (!deliverableId) {
      const nextTasks = (updater(unassignedTasks || []) || []).map((task) => ({
        ...task,
        isDraft: !isTaskReady(task, null),
      }));
      onJobUpdate({ unassignedTasks: nextTasks });
      return;
    }
    const nextDeliverables = (job.deliverables || []).map((deliverable) => {
      if (deliverable.id !== deliverableId) return deliverable;
      const nextTasks = updater(deliverable.tasks || []);
      const readyDeliverable = (deliverables || []).find((item) => item.id === deliverableId) || deliverable;
      const normalizedTasks = (nextTasks || []).map((task) => ({
        ...task,
        isDraft: !isTaskReady(task, readyDeliverable),
      }));
      return { ...deliverable, tasks: normalizedTasks };
    });
    onJobUpdate({ deliverables: nextDeliverables });
  };

  const updateTask = (deliverableId, taskId, patch) => {
    updateTaskList(deliverableId, (tasks) => (
      (tasks || []).map((task) => (task.id === taskId ? { ...task, ...patch } : task))
    ));
  };

  const updateAllocations = (deliverableId, taskId, updater) => {
    updateTaskList(deliverableId, (tasks) => (
      (tasks || []).map((task) => {
        if (task.id !== taskId) return task;
        return { ...task, allocations: updater(task.allocations || []) };
      })
    ));
  };

  const isTaskExpanded = (taskId) => expandedTaskIds.has(taskId);
  const toggleTaskExpanded = (taskId) => {
    setExpandedTaskIds((prev) => {
      const next = new Set(prev);
      if (next.has(taskId)) {
        next.delete(taskId);
      } else {
        next.add(taskId);
      }
      return next;
    });
  };

  const getPrimaryAllocation = (task) => (task?.allocations || [])[0] || null;

  const updatePrimaryAllocation = (deliverableId, taskId, patch) => {
    updateAllocations(deliverableId, taskId, (allocations) => {
      const next = [...(allocations || [])];
      if (!next.length) {
        next.push({ id: createId('alloc'), assigneeUserId: null, serviceTypeId: null, loeHours: null });
      }
      next[0] = { ...next[0], ...(patch || {}) };
      return next;
    });
  };

  const getFieldValue = (task, field) => {
    if (!task) return '';
    const primary = getPrimaryAllocation(task);
    if (field === 'title') return task.title || '';
    if (field === 'description') return task.description || '';
    if (field === 'status') return task.status || 'in_progress';
    if (field === 'dueDate') return task.dueDate || '';
    if (field === 'assignees') return primary?.assigneeUserId ? String(primary.assigneeUserId) : '';
    if (field === 'service') return primary?.serviceTypeId ? String(primary.serviceTypeId) : '';
    if (field === 'loe') return primary?.loeHours ?? '';
    return '';
  };

  const startEdit = (task, deliverableId, field, valueOverride) => {
    if (readOnly) return;
    if (field === 'description') {
      if (descriptionEditor?.taskId === task.id) {
        setDescriptionEditor(null);
        return;
      }
      setEditingCell(null);
      setEditingValue('');
      setDescriptionEditor(null);
      setDescriptionEditor({ taskId: task.id, deliverableId, value: task.description || '' });
      return;
    }
    if (field !== 'dueDate' && editingCell?.taskId === task.id && editingCell.field === field) {
      setEditingCell(null);
      setEditingValue('');
      return;
    }
    if (field === 'dueDate') {
      setEditingCell(null);
      setEditingValue('');
      setDescriptionEditor(null);
      const cell = tableRef.current?.querySelector(`[data-row='${task.id}'][data-col='due']`);
      openDatePicker(cell, task.dueDate || '', (next) => {
        commitField(task, deliverableId, 'dueDate', next);
      });
      return;
    }
    setDescriptionEditor(null);
    setEditingCell({ taskId: task.id, deliverableId, field });
    setEditingValue(valueOverride !== undefined ? valueOverride : getFieldValue(task, field));
  };

  const handleEditCancel = () => {
    setEditingCell(null);
    setEditingValue('');
  };

  const commitField = (task, deliverableId, field, value) => {
    if (!task) return;
    const nextValue = field === 'title' ? String(value || '').trim() : value;
    if (field === 'title' && !nextValue) return false;
    if (field === 'status') {
      updateTask(deliverableId, task.id, { status: nextValue || 'in_progress' });
      return true;
    }
    if (field === 'dueDate') {
      updateTask(deliverableId, task.id, { dueDate: nextValue || null });
      return true;
    }
    if (field === 'assignees') {
      updatePrimaryAllocation(deliverableId, task.id, { assigneeUserId: nextValue || null });
      return true;
    }
    if (field === 'service') {
      updatePrimaryAllocation(deliverableId, task.id, { serviceTypeId: nextValue || null });
      return true;
    }
    if (field === 'loe') {
      const loeHours = Number(nextValue);
      updatePrimaryAllocation(deliverableId, task.id, { loeHours: Number.isFinite(loeHours) ? loeHours : null });
      return true;
    }
    updateTask(deliverableId, task.id, { [field]: nextValue });
    return true;
  };

  const commitOnBlur = (task, deliverableId, field, value) => {
    const committed = commitField(task, deliverableId, field, value);
    if (!committed) return;
    if (editingCell?.taskId === task.id && editingCell.field === field) {
      setEditingCell(null);
      setEditingValue('');
    }
  };

  const getAdjacentField = (field, direction) => {
    const idx = EDITABLE_FIELDS.indexOf(field);
    if (idx < 0) return null;
    const next = EDITABLE_FIELDS[idx + direction];
    return next || null;
  };

  const handleEditorKeyDown = (event, task, deliverableId, field) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      handleEditCancel();
      return;
    }
    if (event.key === 'Enter' || event.key === 'Tab') {
      event.preventDefault();
      const committed = commitField(task, deliverableId, field, editingValue);
      if (!committed) return;
      const direction = event.shiftKey ? -1 : 1;
      const nextField = getAdjacentField(field, direction);
      if (!nextField) {
        handleEditCancel();
        return;
      }
      startEdit(task, deliverableId, nextField);
    }
  };

  const createTaskFromDraft = (deliverableId, draftOverride) => {
    const draft = draftOverride || getDraftRow(deliverableId);
    const title = String(draft.title || '').trim();
    if (!title) return null;
    const hasAllocation = draft.assigneeUserId || draft.serviceTypeId || String(draft.loeHours || '').trim().length > 0;
    if (!hasAllocation) return null;
    const allocations = hasAllocation
      ? [{
        id: createId('alloc'),
        assigneeUserId: draft.assigneeUserId || null,
        serviceTypeId: draft.serviceTypeId || null,
        loeHours: String(draft.loeHours || '').trim().length ? Number(draft.loeHours) || null : null,
      }]
      : [];
    const task = {
      id: createId('task'),
      jobId: job.id,
      deliverableId: deliverableId || null,
      title,
      description: String(draft.description || ''),
      status: draft.status || 'in_progress',
      isDraft: true,
      isRecurring: false,
      recurringTemplateId: null,
      dueDate: draft.dueDate || null,
      completedAt: null,
      cycleKey: cycleKey || null,
      allocations,
    };
    updateTaskList(deliverableId, (tasks) => [task, ...(tasks || [])]);
    clearDraftRow(deliverableId);
    closeDraftRow(deliverableId);
    return task;
  };

  const createTaskAndEdit = (deliverableId, nextField) => {
    const task = createTaskFromDraft(deliverableId);
    if (!task) return;
    requestAnimationFrame(() => {
      startEdit(task, deliverableId, nextField);
    });
  };

  const handleDragStart = (event, deliverableId, taskId) => {
    if (readOnly) return;
    setDragState({ deliverableId, taskId });
    event.dataTransfer?.setData('text/plain', String(taskId));
    event.dataTransfer.effectAllowed = 'move';
  };

  const handleDrop = (event, deliverableId, targetTaskId) => {
    if (readOnly || !dragState) return;
    event.preventDefault();
    if (dragState.deliverableId !== deliverableId) return;
    const tasks = getTaskList(deliverableId);
    const fromIndex = tasks.findIndex((task) => task.id === dragState.taskId);
    const toIndex = tasks.findIndex((task) => task.id === targetTaskId);
    if (fromIndex < 0 || toIndex < 0) return;
    const dragTask = tasks[fromIndex];
    const targetTask = tasks[toIndex];
    if (dragTask?.status !== targetTask?.status) return;
    const nextTasks = [...tasks];
    nextTasks.splice(fromIndex, 1);
    nextTasks.splice(toIndex, 0, dragTask);
    updateTaskList(deliverableId, () => nextTasks);
    setDragState(null);
  };

  const handleKeyNav = (event) => {
    if (!['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.key)) return;
    const cell = event.currentTarget;
    const row = cell.dataset.row;
    const col = cell.dataset.col;
    const table = tableRef.current;
    if (!table || !row || !col) return;
    event.preventDefault();

    if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
      const cells = Array.from(table.querySelectorAll(`[data-col='${col}'][data-cell='task']`));
      const idx = cells.indexOf(cell);
      const next = cells[idx + (event.key === 'ArrowDown' ? 1 : -1)];
      next?.focus();
      return;
    }

    const colIdx = COLUMN_ORDER.indexOf(col);
    if (colIdx < 0) return;
    const nextCol = event.key === 'ArrowRight' ? COLUMN_ORDER[colIdx + 1] : COLUMN_ORDER[colIdx - 1];
    if (!nextCol) return;
    const nextCell = table.querySelector(`[data-row='${row}'][data-col='${nextCol}']`);
    nextCell?.focus();
  };

  const groups = (deliverables || []).map((deliverable) => {
    const tasks = sortTasks(deliverable.tasks || []);
    return { ...deliverable, tasks };
  });
  const unassignedGroup = {
    id: 'unassigned',
    name: 'General Job Tasks',
    status: 'in_progress',
    tasks: sortTasks(unassignedTasks || []),
  };

  const renderAllocations = (task, deliverable) => {
    const allocations = Array.isArray(task.allocations) ? task.allocations : [];
    const allowedTypeIds = getAllowedServiceTypeIds(deliverable);
    const hasPools = allowedTypeIds.length > 0;
    const isReady = isTaskReady(task, deliverable);
    const draftOutlineClass = !isReady ? 'outline outline-1 outline-[#6d28d9]/35 outline-offset-[-1px]' : '';
    const gridStyle = { gridTemplateColumns: '1.2fr 1.2fr 0.6fr 0.8fr 0.8fr' };

    const addAllocation = () => {
      if (readOnly) return;
      updateAllocations(deliverable?.id || null, task.id, (list) => [
        ...list,
        { id: createId('alloc'), assigneeUserId: null, serviceTypeId: null, loeHours: null },
      ]);
    };

    const rows = [];

    rows.push(h('tr', {
      key: `${task.id}-alloc-header`,
      'data-alloc-group': task.id,
      className: `bg-slate-50 dark:bg-slate-900/70 ${draftOutlineClass}`,
    }, [
      h('td', { colSpan: COLUMN_ORDER.length, className: 'px-6 py-2' }, [
        hasPools ? null : h('div', { className: 'mb-2 text-xs text-slate-500 dark:text-slate-400' }, 'Assign this task to a deliverable with available hours to set service types.'),
        h('div', { className: 'grid gap-3 text-[11px] uppercase tracking-wide text-slate-500 dark:text-slate-400', style: gridStyle }, [
          h('div', null, 'Assignee'),
          h('div', null, 'Service Type'),
          h('div', null, 'LOE'),
          h('div', null, 'Meter'),
          h('div', null, 'Due Date'),
        ]),
      ]),
    ]));

    if (allocations.length) {
      allocations.forEach((alloc) => {
        const pool = (deliverable?.effectivePools || []).find((item) => String(item.serviceTypeId) === String(alloc.serviceTypeId));
        const allocationActual = Number(alloc.actualHours) || 0;
        const allocationMeterTask = {
          loeHours: Number.isFinite(Number(alloc.loeHours)) ? Number(alloc.loeHours) : null,
          dueDate: task.dueDate || null,
        };
        rows.push(h('tr', {
          key: alloc.id,
          'data-alloc-group': task.id,
          className: `bg-slate-50 dark:bg-slate-900/70 ${draftOutlineClass}`,
        }, [
          h('td', { colSpan: COLUMN_ORDER.length, className: 'px-6 py-2' }, [
            h('div', { className: 'grid gap-3 items-center', style: gridStyle }, [
              h('select', {
                value: alloc.assigneeUserId ? String(alloc.assigneeUserId) : '',
                disabled: readOnly,
                onChange: (event) => updateAllocations(deliverable?.id || null, task.id, (list) => (
                  list.map((item) => item.id === alloc.id ? { ...item, assigneeUserId: event.target.value || null } : item)
                )),
                className: 'h-8 rounded-md border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 px-2 text-xs text-slate-700 dark:text-slate-200 disabled:opacity-60',
              }, [
                h('option', { value: '' }, 'Unassigned'),
                ...(assigneeList || []).map((member) => h('option', { key: member.id, value: member.id }, member.name || member.email)),
              ]),
              h('select', {
                value: alloc.serviceTypeId ? String(alloc.serviceTypeId) : '',
                disabled: readOnly || !hasPools,
                onChange: (event) => updateAllocations(deliverable?.id || null, task.id, (list) => (
                  list.map((item) => item.id === alloc.id ? { ...item, serviceTypeId: event.target.value || null } : item)
                )),
                className: 'h-8 rounded-md border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 px-2 text-xs text-slate-700 dark:text-slate-200 disabled:opacity-60',
              }, [
                h('option', { value: '' }, hasPools ? 'Select' : 'No pools'),
                ...allowedTypeIds.map((id) => h('option', { key: id, value: id }, serviceTypeMap.get(id)?.name || id)),
              ]),
              h('input', {
                type: 'number',
                min: 0,
                step: 0.25,
                value: alloc.loeHours ?? '',
                disabled: readOnly,
                onChange: (event) => {
                  const raw = event.target.value;
                  const next = raw === '' ? null : Number(raw);
                  updateAllocations(deliverable?.id || null, task.id, (list) => (
                    list.map((item) => item.id === alloc.id ? { ...item, loeHours: Number.isFinite(next) ? next : null } : item)
                  ));
                },
                className: 'h-8 w-full rounded-md border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 px-2 text-xs text-slate-700 dark:text-slate-200 disabled:opacity-60',
              }),
              h('div', null, renderQuickTaskMeter(allocationMeterTask, allocationActual)),
              h('span', { className: 'text-xs text-slate-500 dark:text-slate-400' }, task.dueDate || '—'),
            ]),
          ]),
        ]));
      });
    } else {
      rows.push(h('tr', {
        key: `${task.id}-alloc-empty`,
        'data-alloc-group': task.id,
        className: `bg-slate-50 dark:bg-slate-900/70 ${draftOutlineClass}`,
      }, [
        h('td', { colSpan: COLUMN_ORDER.length, className: 'px-6 py-2 text-xs text-slate-500 dark:text-slate-400' }, 'No allocations yet.'),
      ]));
    }

    rows.push(h('tr', {
      key: `${task.id}-alloc-add`,
      'data-alloc-group': task.id,
      className: `bg-slate-50 dark:bg-slate-900/70 ${draftOutlineClass}`,
    }, [
      h('td', { colSpan: COLUMN_ORDER.length, className: 'px-6 py-2' }, [
        h('button', {
          type: 'button',
          className: 'inline-flex items-center gap-2 text-xs font-semibold text-slate-500 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white disabled:opacity-60',
          onClick: addAllocation,
          disabled: readOnly,
        }, '+ Add allocation'),
      ]),
    ]));

    return rows;
  };

  const renderDescriptionEditor = (task, deliverableId, isDraft) => {
    const value = descriptionEditor?.value ?? '';
    const save = () => {
      if (readOnly) return;
      updateTask(deliverableId, task.id, { description: value });
      setDescriptionEditor(null);
    };
    const cancel = () => {
      setDescriptionEditor(null);
    };
    const draftOutlineClass = isDraft ? 'outline outline-1 outline-[#6d28d9]/35 outline-offset-[-1px]' : '';
    return h('tr', { key: `${task.id}-description`, className: `bg-white dark:bg-slate-900/60 ${draftOutlineClass}` }, [
      h('td', { colSpan: COLUMN_ORDER.length, className: 'px-4 py-3' }, [
        h('div', { className: 'rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-slate-900 p-3' }, [
          h('div', { className: 'text-[11px] uppercase tracking-wide text-slate-500 dark:text-slate-400 mb-2' }, 'Description'),
          h('div', { className: 'flex flex-wrap items-center gap-1 border border-slate-200 dark:border-white/10 rounded-md bg-white dark:bg-slate-950/40 px-2 py-1 mb-2' }, [
            h('button', { type: 'button', disabled: true, className: 'px-2 py-1 text-[11px] font-semibold text-slate-400 dark:text-slate-500' }, 'B'),
            h('button', { type: 'button', disabled: true, className: 'px-2 py-1 text-[11px] italic text-slate-400 dark:text-slate-500' }, 'I'),
            h('button', { type: 'button', disabled: true, className: 'px-2 py-1 text-[11px] underline text-slate-400 dark:text-slate-500' }, 'U'),
            h('button', { type: 'button', disabled: true, className: 'px-2 py-1 text-[11px] text-slate-400 dark:text-slate-500' }, '•'),
            h('button', { type: 'button', disabled: true, className: 'px-2 py-1 text-[11px] text-slate-400 dark:text-slate-500' }, 'Link'),
            h('button', { type: 'button', disabled: true, className: 'px-2 py-1 text-[11px] text-slate-400 dark:text-slate-500' }, 'H1'),
            h('button', { type: 'button', disabled: true, className: 'px-2 py-1 text-[11px] text-slate-400 dark:text-slate-500' }, 'Quote'),
            h('button', { type: 'button', disabled: true, className: 'px-2 py-1 text-[11px] text-slate-400 dark:text-slate-500' }, 'Code'),
          ]),
          h('textarea', {
            value,
            rows: 3,
            autoFocus: true,
            disabled: readOnly,
            onChange: (event) => setDescriptionEditor((prev) => ({ ...prev, value: event.target.value })),
            onBlur: save,
            onKeyDown: (event) => {
              if (event.key === 'Escape') {
                event.preventDefault();
                cancel();
              }
              if (event.key === 'Tab') {
                event.preventDefault();
                save();
                startEdit(task, deliverableId, 'status');
              }
              if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault();
                save();
                startEdit(task, deliverableId, 'status');
              }
            },
            className: 'w-full rounded-md border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 px-3 py-2 text-sm text-slate-700 dark:text-slate-200',
          }),
          h('div', { className: 'mt-2 text-[11px] text-slate-400 dark:text-slate-500' }, 'Enter to save · Esc to cancel'),
        ]),
      ]),
    ]);
  };

  const renderDraftDescriptionEditor = (deliverableId) => {
    const draft = getDraftRow(deliverableId);
    const close = () => setDraftDescriptionEditor(null);
    return h('tr', { key: `draft-${deliverableId || 'unassigned'}-description`, className: 'bg-white dark:bg-slate-900/60' }, [
      h('td', { colSpan: COLUMN_ORDER.length, className: 'px-4 py-3' }, [
        h('div', { className: 'rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-slate-900 p-3' }, [
          h('div', { className: 'text-[11px] uppercase tracking-wide text-slate-500 dark:text-slate-400 mb-2' }, 'Description'),
          h('div', { className: 'flex flex-wrap items-center gap-1 border border-slate-200 dark:border-white/10 rounded-md bg-white dark:bg-slate-950/40 px-2 py-1 mb-2' }, [
            h('button', { type: 'button', disabled: true, className: 'px-2 py-1 text-[11px] font-semibold text-slate-400 dark:text-slate-500' }, 'B'),
            h('button', { type: 'button', disabled: true, className: 'px-2 py-1 text-[11px] italic text-slate-400 dark:text-slate-500' }, 'I'),
            h('button', { type: 'button', disabled: true, className: 'px-2 py-1 text-[11px] underline text-slate-400 dark:text-slate-500' }, 'U'),
            h('button', { type: 'button', disabled: true, className: 'px-2 py-1 text-[11px] text-slate-400 dark:text-slate-500' }, '•'),
            h('button', { type: 'button', disabled: true, className: 'px-2 py-1 text-[11px] text-slate-400 dark:text-slate-500' }, 'Link'),
            h('button', { type: 'button', disabled: true, className: 'px-2 py-1 text-[11px] text-slate-400 dark:text-slate-500' }, 'H1'),
            h('button', { type: 'button', disabled: true, className: 'px-2 py-1 text-[11px] text-slate-400 dark:text-slate-500' }, 'Quote'),
            h('button', { type: 'button', disabled: true, className: 'px-2 py-1 text-[11px] text-slate-400 dark:text-slate-500' }, 'Code'),
          ]),
          h('textarea', {
            value: draft.description || '',
            rows: 3,
            autoFocus: true,
            disabled: readOnly,
            onChange: (event) => updateDraftRow(deliverableId, { description: event.target.value }),
            onBlur: close,
            onKeyDown: (event) => {
              if (event.key === 'Escape') {
                event.preventDefault();
                close();
              }
              if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault();
                close();
              }
            },
            className: 'w-full rounded-md border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 px-3 py-2 text-sm text-slate-700 dark:text-slate-200',
          }),
          h('div', { className: 'mt-2 text-[11px] text-slate-400 dark:text-slate-500' }, 'Enter to save · Esc to cancel'),
        ]),
      ]),
    ]);
  };

  const renderTaskRow = (task, deliverableId, deliverable) => {
    const due = formatDueIn(task);
    const taskMeta = taskMetaMap?.get(task.id) || {};
    const allocTotal = sumAllocations(task);
    const deliverableEstimate = sumEstimated(deliverable?.effectivePools || []);
    const effortRatio = deliverableEstimate ? allocTotal / deliverableEstimate : 0;
    const timelineRatio = getTimelineRatio(task.dueDate);
    const isEditing = editingCell?.taskId === task.id;
    const titleEditing = isEditing && editingCell.field === 'title';
    const statusEditing = isEditing && editingCell.field === 'status';
    const assigneeEditing = isEditing && editingCell.field === 'assignees';
    const serviceEditing = isEditing && editingCell.field === 'service';
    const loeEditing = isEditing && editingCell.field === 'loe';
    const descriptionOpen = descriptionEditor?.taskId === task.id;

    const assigneeIds = [...new Set((task.allocations || [])
      .map((alloc) => String(alloc.assigneeUserId || ''))
      .filter(Boolean))];
    const assigneeLabels = assigneeIds
      .map((id) => memberMap.get(id))
      .filter(Boolean)
      .map((member) => getInitials(member.name || member.email));

    const serviceTypeLabels = getServiceTypeLabels(task, serviceTypeMap);
    const chatIndicator = chatIndicators?.task?.get(String(task.id)) || {};
    const canOpenDrawer = !!deliverableId && typeof onOpenDrawer === 'function';
    const statusLabel = getStatusLabel(task.status);
    const allowedTypeIds = deliverable
      ? (deliverable.effectivePools || [])
        .filter((pool) => Number(pool?.estimatedHours) > 0)
        .map((pool) => String(pool.serviceTypeId))
      : [];
    const hasPools = allowedTypeIds.length > 0;
    const isReady = isTaskReady(task, deliverable);
    const isDraft = !isReady;
    const draftOutlineClass = isDraft ? 'outline outline-1 outline-[#6d28d9]/35 outline-offset-[-1px]' : '';
    const allocationCount = (task.allocations || []).length;
    const singleAllocationMode = allocationCount <= 1;

    const cellClass = 'px-6 py-3 text-sm text-gray-700 dark:text-gray-200 align-top';

    const allocationRows = isTaskExpanded(task.id) ? renderAllocations(task, deliverable) : [];

    return [
      h('tr', {
        key: task.id,
        className: `contacts-row border-b border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800/70 transition-colors ${draftOutlineClass}`,
        onDragOver: (event) => {
          if (readOnly) return;
          if (dragState?.deliverableId !== deliverableId) return;
          event.preventDefault();
        },
        onDrop: (event) => handleDrop(event, deliverableId, task.id),
      }, [
        h('td', { className: `${cellClass} w-10 align-middle` }, [
          h('button', {
            type: 'button',
            className: 'h-8 w-8 rounded-md border border-slate-200 dark:border-white/10 text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-white/5 disabled:opacity-50 flex items-center justify-center',
            draggable: !readOnly,
            onDragStart: (event) => handleDragStart(event, deliverableId, task.id),
            disabled: readOnly,
            'aria-label': 'Drag task',
          }, [
            h('svg', { viewBox: '0 0 24 24', className: 'h-4 w-4', fill: 'none', stroke: 'currentColor', strokeWidth: '2' }, [
              h('circle', { cx: '8', cy: '8', r: '1' }),
              h('circle', { cx: '16', cy: '8', r: '1' }),
              h('circle', { cx: '8', cy: '16', r: '1' }),
              h('circle', { cx: '16', cy: '16', r: '1' }),
            ]),
          ]),
        ]),
        h('td', {
          className: `${cellClass} min-w-[220px]`,
          tabIndex: 0,
          'data-cell': 'task',
          'data-row': task.id,
          'data-col': 'title',
          onKeyDown: handleKeyNav,
          onClick: () => startEdit(task, deliverableId, 'title'),
        }, [
          titleEditing
            ? h('input', {
              value: editingValue,
              autoFocus: true,
              onChange: (event) => setEditingValue(event.target.value),
              onBlur: (event) => commitOnBlur(task, deliverableId, 'title', event.target.value),
              onKeyDown: (event) => handleEditorKeyDown(event, task, deliverableId, 'title'),
              className: 'w-full rounded-md border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 px-2 py-1 text-sm text-slate-700 dark:text-slate-200',
            })
            : h('div', { className: 'space-y-1' }, [
              h('div', { className: 'font-semibold text-gray-900 dark:text-gray-100' }, task.title || 'Untitled task'),
              h('div', { className: 'flex flex-wrap items-center gap-2 text-[11px] text-gray-500 dark:text-gray-400' }, [
                isDraft
                  ? h('span', { className: 'text-[10px] font-semibold tracking-wide text-purple-400 uppercase' }, 'DRAFT')
                  : null,
                task.isRecurring
                  ? h('span', { className: 'rounded-full border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 px-2 py-0.5 text-slate-600 dark:text-slate-300' }, 'R')
                  : null,
                taskMeta?.plannedLabel
                  ? h('span', { className: 'rounded-full border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 px-2 py-0.5 text-slate-600 dark:text-slate-300' }, `Pending: ${taskMeta.plannedLabel}`)
                  : null,
                statusEditing
                  ? h('select', {
                    value: editingValue,
                    autoFocus: true,
                    disabled: readOnly,
                    onChange: (event) => setEditingValue(event.target.value),
                    onBlur: (event) => commitOnBlur(task, deliverableId, 'status', event.target.value),
                    onKeyDown: (event) => handleEditorKeyDown(event, task, deliverableId, 'status'),
                    className: 'h-6 rounded-md border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 px-2 text-[11px] font-semibold text-slate-600 dark:text-slate-200',
                  }, STATUS_OPTIONS.map((option) => (
                    h('option', { key: option.value, value: option.value }, option.label)
                  )))
                  : h('button', {
                    type: 'button',
                    className: 'text-[11px] font-semibold text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white',
                    onClick: (event) => {
                      event.stopPropagation();
                      startEdit(task, deliverableId, 'status');
                    },
                  }, statusLabel),
              ].filter(Boolean)),
            ]),
        ]),
        h('td', {
          className: `${cellClass} min-w-[200px]`,
          tabIndex: 0,
          'data-cell': 'task',
          'data-row': task.id,
          'data-col': 'description',
          onKeyDown: handleKeyNav,
          onClick: () => {
            startEdit(task, deliverableId, 'description');
          },
        }, [
          h('div', { className: 'text-xs text-slate-500 dark:text-slate-400 truncate max-w-[240px] cursor-pointer' }, task.description || 'Add description'),
        ]),
        h('td', {
          className: `${cellClass} text-center`,
          tabIndex: 0,
          'data-cell': 'task',
          'data-row': task.id,
          'data-col': 'chat',
          onKeyDown: handleKeyNav,
        }, [
          h('button', {
            type: 'button',
            className: 'inline-flex items-center justify-center text-xs font-semibold',
            onClick: (event) => {
              event.stopPropagation();
              onOpenChat && onOpenChat({ type: 'task', deliverableId, taskId: task.id });
            },
            disabled: !onOpenChat,
            'aria-label': 'Open task chat',
          }, renderChatIndicator(chatIndicator)),
        ]),
        h('td', {
          className: `${cellClass} min-w-[140px]`,
          tabIndex: 0,
          'data-cell': 'task',
          'data-row': task.id,
          'data-col': 'assignees',
          onKeyDown: handleKeyNav,
          onClick: (event) => {
            event.stopPropagation();
            if (singleAllocationMode) startEdit(task, deliverableId, 'assignees');
          },
        }, [
          assigneeEditing && singleAllocationMode
            ? h('select', {
              value: editingValue,
              autoFocus: true,
              disabled: readOnly,
              onChange: (event) => setEditingValue(event.target.value),
              onBlur: (event) => commitOnBlur(task, deliverableId, 'assignees', event.target.value),
              onKeyDown: (event) => handleEditorKeyDown(event, task, deliverableId, 'assignees'),
              className: 'h-8 w-full rounded-md border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 px-2 text-xs text-slate-700 dark:text-slate-200',
            }, [
              h('option', { value: '' }, 'Unassigned'),
              ...(assigneeList || []).map((member) => (
                h('option', { key: member.id, value: member.id }, member.name || member.email)
              )),
            ])
            : h('div', { className: 'flex items-center justify-between gap-2' }, [
              assigneeLabels.length
                ? h('div', { className: 'flex -space-x-1 items-center' }, assigneeLabels.slice(0, 3).map((label, idx) => (
                  h('span', {
                    key: `${task.id}-assignee-${idx}`,
                    className: 'h-6 w-6 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 text-[10px] font-semibold flex items-center justify-center border border-white dark:border-slate-900',
                  }, label)
                )))
                : h('span', { className: 'text-xs text-slate-400 dark:text-slate-500' }, 'Unassigned'),
              h('button', {
                type: 'button',
                className: 'h-6 w-6 flex items-center justify-center text-sm font-semibold text-slate-500 hover:text-slate-800 dark:text-slate-300 dark:hover:text-white',
                onClick: (event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  toggleTaskExpanded(task.id);
                },
                title: 'Toggle allocations',
              }, '▾'),
            ]),
        ]),
        h('td', {
          className: `${cellClass} min-w-[140px]`,
          tabIndex: 0,
          'data-cell': 'task',
          'data-row': task.id,
          'data-col': 'service',
          onKeyDown: handleKeyNav,
          onClick: (event) => {
            event.stopPropagation();
            if (hasPools && singleAllocationMode) startEdit(task, deliverableId, 'service');
          },
        }, [
          serviceEditing && singleAllocationMode
            ? h('select', {
              value: editingValue,
              autoFocus: true,
              disabled: readOnly || !hasPools,
              onChange: (event) => setEditingValue(event.target.value),
              onBlur: (event) => commitOnBlur(task, deliverableId, 'service', event.target.value),
              onKeyDown: (event) => handleEditorKeyDown(event, task, deliverableId, 'service'),
              className: 'h-8 w-full rounded-md border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 px-2 text-xs text-slate-700 dark:text-slate-200 disabled:opacity-60',
            }, [
              h('option', { value: '' }, hasPools ? 'Select' : 'No pools'),
              ...allowedTypeIds.map((id) => h('option', { key: id, value: id }, serviceTypeMap.get(id)?.name || id)),
            ])
            : h('div', { className: 'flex items-center justify-between gap-2' }, [
              h('span', { className: 'text-xs text-slate-500 dark:text-slate-400' }, hasPools ? serviceTypeLabels : 'No pools'),
              h('button', {
                type: 'button',
                className: 'h-6 w-6 flex items-center justify-center text-sm font-semibold text-slate-500 hover:text-slate-800 dark:text-slate-300 dark:hover:text-white',
                onClick: (event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  toggleTaskExpanded(task.id);
                },
                title: 'Toggle allocations',
              }, '▾'),
            ]),
        ]),
        h('td', {
          className: `${cellClass} min-w-[90px]`,
          tabIndex: 0,
          'data-cell': 'task',
          'data-row': task.id,
          'data-col': 'due',
          onKeyDown: (event) => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault();
              startEdit(task, deliverableId, 'dueDate');
              return;
            }
            handleKeyNav(event);
          },
          onClick: (event) => {
            event.stopPropagation();
            startEdit(task, deliverableId, 'dueDate');
          },
        }, [
          h('span', {
            className: `text-xs ${due.tone === 'danger' ? 'text-rose-600 dark:text-rose-300' : due.tone === 'warn' ? 'text-amber-600 dark:text-amber-300' : 'text-slate-500 dark:text-slate-400'}`,
          }, due.label),
        ]),
        h('td', {
          className: `${cellClass} min-w-[110px]`,
          tabIndex: 0,
          'data-cell': 'task',
          'data-row': task.id,
          'data-col': 'meter',
          onKeyDown: handleKeyNav,
          onClick: () => {
            if (singleAllocationMode) startEdit(task, deliverableId, 'loe');
          },
        }, [
          loeEditing && singleAllocationMode
            ? h('input', {
              type: 'number',
              min: 0,
              step: 0.25,
              value: editingValue,
              autoFocus: true,
              onChange: (event) => setEditingValue(event.target.value),
              onBlur: (event) => commitOnBlur(task, deliverableId, 'loe', event.target.value),
              onKeyDown: (event) => handleEditorKeyDown(event, task, deliverableId, 'loe'),
              className: 'w-full rounded-md border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 px-2 py-1 text-xs text-slate-700 dark:text-slate-200',
            })
            : renderQuickTaskMeter(
              {
                loeHours: Number.isFinite(Number(allocTotal)) ? Number(allocTotal) : null,
                dueDate: task.dueDate || null,
              },
              getActualHours(task),
            ),
        ]),
        h('td', {
          className: `px-4 py-3 text-sm text-gray-700 dark:text-gray-200 align-top text-right`,
          tabIndex: 0,
          'data-cell': 'task',
          'data-row': task.id,
          'data-col': 'actions',
          onKeyDown: handleKeyNav,
        }, [
          h('button', {
            type: 'button',
            className: 'nn-btn nn-btn--micro',
            disabled: readOnly || !canOpenDrawer,
            onClick: (event) => {
              event.stopPropagation();
              if (canOpenDrawer) onOpenDrawer(deliverableId, task.id);
            },
            title: 'More',
          }, '⋯'),
        ]),
      ]),
      descriptionOpen ? renderDescriptionEditor(task, deliverableId, isDraft) : null,
      ...(allocationRows || []),
    ].filter(Boolean);
  };

  const renderGroupHeader = (group, isMuted = false) => {
    const isExpanded = expandedGroups.has(group.id);
    const baseIndicator = !isMuted
      ? (chatIndicators?.deliverable?.get(String(group.id)) || {})
      : {};
    const demoIndicator = !isExpanded ? DEMO_CHAT_STATES[group.name] : null;
    const deliverableChatIndicator = demoIndicator || baseIndicator;
    const deliverableStatus = group.status || 'backlog';
    const deliverableOverdue = isOverdueDate(group.dueDate) && deliverableStatus !== 'completed';
    const health = (() => {
      const pools = group.effectivePools || [];
      const estimated = sumEstimated(pools);
      const assigned = (pools || []).reduce((sum, pool) => sum + (Number(pool?.assignedHours) || 0), 0);
      const actual = (pools || []).reduce((sum, pool) => sum + (Number(pool?.actualHours) || 0), 0);
      const taskTotal = (group.tasks || []).reduce((sum, task) => sum + sumAllocations(task), 0);
      const usage = Math.max(assigned, actual, taskTotal);
      const ratio = estimated ? usage / estimated : 0;
      return { ratio: clamp(ratio, 0, 1.2), status: getRatioStatus(ratio) };
    })();
    const hasChats = (deliverableChatIndicator.totalMessages || 0) > 0;
    const mentionCount = deliverableChatIndicator.mentionCount || 0;
    const hasNewChats = !!deliverableChatIndicator.hasUnreadMessages && mentionCount === 0;
    const confidenceValue = confidenceMap?.[String(group.id)] || 'not_set';
    const confidenceMenuOpen = openConfidenceMenuId === group.id;
    const statusMenuOpen = openDeliverableStatusMenuId === group.id;
    return h(DeliverableHeaderRow, {
      groupId: group.id,
      groupName: group.name || 'Deliverable',
      isExpanded,
      isMuted,
      deliverableStatus,
      deliverableDueDate: group.dueDate || null,
      deliverableOverdue,
      healthStatus: health.status,
      healthRatio: health.ratio,
      healthTimelineRatio: getTimelineRatio(group.dueDate),
      hasChats,
      hasNewChats,
      mentionCount,
      showPools: isExpanded && group.effectivePools,
      pools: group.effectivePools,
      serviceTypes,
      confidenceValue,
      onConfidenceChange: (value) => updateConfidence(group.id, value),
      confidenceMenuOpen,
      onToggleConfidenceMenu: () => {
        setOpenConfidenceMenuId((prev) => (prev === group.id ? null : group.id));
      },
      statusMenuOpen,
      onToggleStatusMenu: () => {
        setOpenDeliverableStatusMenuId((prev) => (prev === group.id ? null : group.id));
      },
      onStatusChange: (nextStatus) => handleDeliverableStatusSelect(group, nextStatus),
      onOpenDuePicker: (anchorEl, deliverableId, value) => openDeliverableDatePicker(anchorEl, deliverableId, value),
      onToggle: () => toggleGroup(group.id),
      onOpenChat,
    });
  };

  const renderTaskHeaderRow = (groupId) => h('tr', {
    key: `header-${groupId}`,
    className: 'contacts-column-header-row text-xs uppercase text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-800',
  }, [
    h('th', { className: 'px-6 py-2 w-10' }, ''),
    h('th', { className: 'px-6 py-2 min-w-[220px]' }, 'Task'),
    h('th', { className: 'px-6 py-2 min-w-[200px]' }, 'Description'),
    h('th', { className: 'px-6 py-2 text-center w-16' }, 'Chat'),
    h('th', { className: 'px-6 py-2 min-w-[140px]' }, 'Assignee(s)'),
    h('th', { className: 'px-6 py-2 min-w-[140px]' }, 'Service Type'),
    h('th', { className: 'px-6 py-2 min-w-[90px]' }, 'Due In'),
    h('th', { className: 'px-6 py-2 min-w-[110px]' }, 'Meter'),
    h('th', { className: 'px-4 py-2 text-right w-14' }, '⋯'),
  ]);

  const renderTasksSubToolbarRow = (groupId) => {
    const key = String(groupId || 'unassigned');
    const mode = deliverableTaskViewMode[key] || 'list';
    const setMode = (nextMode) => {
      setDeliverableTaskViewMode((prev) => ({ ...prev, [key]: nextMode }));
    };
    const buttonBase = 'h-7 w-7 rounded-md border flex items-center justify-center transition-colors';
    const active = 'border-netnet-purple/60 bg-netnet-purple/15 text-netnet-purple';
    const inactive = 'border-slate-200 dark:border-white/10 text-slate-400 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800/60';
    return h('tr', { key: `tasks-toolbar-${key}`, className: 'border-b border-gray-200 dark:border-gray-700 bg-transparent' }, [
      h('td', { colSpan: COLUMN_ORDER.length, className: 'px-6 py-2' }, [
        h('div', { className: 'flex items-center justify-end gap-1' }, [
          h('button', {
            type: 'button',
            className: `${buttonBase} ${mode === 'list' ? active : inactive}`,
            onClick: (event) => {
              event.stopPropagation();
              setMode('list');
            },
            title: 'List view',
            'aria-label': 'List view',
            'aria-pressed': mode === 'list' ? 'true' : 'false',
          }, [
            h('svg', { viewBox: '0 0 20 20', className: 'h-3.5 w-3.5', fill: 'none', stroke: 'currentColor', strokeWidth: '1.8' }, [
              h('line', { x1: '4', y1: '5', x2: '16', y2: '5' }),
              h('line', { x1: '4', y1: '10', x2: '16', y2: '10' }),
              h('line', { x1: '4', y1: '15', x2: '16', y2: '15' }),
            ]),
          ]),
          h('button', {
            type: 'button',
            className: `${buttonBase} ${mode === 'kanban' ? active : inactive}`,
            onClick: (event) => {
              event.stopPropagation();
              setMode('kanban');
            },
            title: 'Kanban view',
            'aria-label': 'Kanban view',
            'aria-pressed': mode === 'kanban' ? 'true' : 'false',
          }, [
            h('svg', { viewBox: '0 0 20 20', className: 'h-3.5 w-3.5', fill: 'none', stroke: 'currentColor', strokeWidth: '1.8' }, [
              h('rect', { x: '3.5', y: '4', width: '4', height: '12', rx: '0.8' }),
              h('rect', { x: '8', y: '4', width: '4', height: '12', rx: '0.8' }),
              h('rect', { x: '12.5', y: '4', width: '4', height: '12', rx: '0.8' }),
            ]),
          ]),
        ]),
      ]),
    ]);
  };

  const renderDeliverableKanbanRow = (group) => {
    const deliverableId = group?.id === 'unassigned' ? null : group?.id;
    const scopedDeliverable = {
      id: group?.id || 'unassigned',
      name: group?.name || 'Deliverable',
      effectivePools: group?.effectivePools || [],
      pools: group?.effectivePools || group?.pools || [],
      tasks: group?.tasks || [],
    };
    const scopedJob = {
      ...job,
      deliverables: [scopedDeliverable],
    };
    return h('tr', { key: `kanban-${group?.id || 'unassigned'}`, className: 'border-b border-gray-200 dark:border-gray-800' }, [
      h('td', {
        colSpan: COLUMN_ORDER.length,
        className: 'px-6 py-3',
        'data-deliverable-kanban': 'true',
        'data-deliverable-id': group?.id || 'unassigned',
        'data-scoped-task-count': String((group?.tasks || []).length),
        'data-show-deliverable-label': 'false',
      }, [
        h(JobKanbanTab, {
          job: scopedJob,
          onJobUpdate: (patch) => {
            const nextTasks = patch?.deliverables?.[0]?.tasks || [];
            updateTaskList(deliverableId, () => nextTasks);
          },
          readOnly,
          chatIndicators,
          onOpenChat,
          showDeliverableLabel: false,
          embedded: true,
        }),
      ]),
    ]);
  };

  const renderDraftRow = (deliverable, autoFocus = false) => {
    const deliverableId = deliverable?.id || null;
    const draft = getDraftRow(deliverableId);
    const baseCell = 'px-6 py-3 text-sm text-gray-500 dark:text-gray-300 align-top';
    const draftRowKey = draftKey(deliverableId);
    return h('tr', {
      key: `draft-${deliverableId || 'unassigned'}`,
      className: 'border-b border-gray-200 dark:border-gray-800',
      ref: (node) => {
        if (node) {
          draftRowRefs.current[draftRowKey] = node;
        } else {
          delete draftRowRefs.current[draftRowKey];
        }
      },
    }, [
      h('td', { className: `${baseCell} w-10` }, [
        h('div', { className: 'h-7 w-7 rounded-md border border-dashed border-slate-200 dark:border-white/10' }),
      ]),
      h('td', { className: `${baseCell} min-w-[220px]` }, [
        h('div', { className: 'flex flex-col gap-2' }, [
          h('input', {
            type: 'text',
            value: draft.title,
            placeholder: 'Task name…',
            autoFocus,
            disabled: readOnly,
            onChange: (event) => updateDraftRow(deliverableId, { title: event.target.value }),
            className: 'w-full rounded-md border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 px-3 py-2 text-sm text-slate-700 dark:text-slate-200 disabled:opacity-60',
          }),
          h('select', {
            value: draft.status,
            disabled: readOnly,
            onChange: (event) => updateDraftRow(deliverableId, { status: event.target.value }),
            className: 'h-8 rounded-md border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 px-2 text-xs text-slate-600 dark:text-slate-300',
          }, STATUS_OPTIONS.map((option) => (
            h('option', { key: option.value, value: option.value }, option.label)
          ))),
        ]),
      ]),
      h('td', {
        className: `${baseCell} min-w-[200px]`,
        onClick: () => {
          if (readOnly) return;
          setDraftDescriptionEditor({ key: draftRowKey, deliverableId });
        },
      }, [
        h('div', { className: 'text-xs text-slate-500 dark:text-slate-400 truncate max-w-[240px] cursor-pointer' }, draft.description || 'Add description'),
      ]),
      h('td', { className: `${baseCell} text-center w-16` }, [
        h('span', { className: 'text-xs text-slate-400 dark:text-slate-500' }, '—'),
      ]),
      h('td', { className: `${baseCell} min-w-[140px]` }, [
        h('select', {
          value: draft.assigneeUserId,
          disabled: readOnly,
          onChange: (event) => updateDraftRow(deliverableId, { assigneeUserId: event.target.value }),
          className: 'h-8 w-full rounded-md border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 px-2 text-xs text-slate-700 dark:text-slate-200',
        }, [
          h('option', { value: '' }, 'Unassigned'),
          ...(assigneeList || []).map((member) => (
            h('option', { key: member.id, value: member.id }, member.name || member.email)
          )),
        ]),
      ]),
      h('td', { className: `${baseCell} min-w-[140px]` }, [
        h('select', {
          value: draft.serviceTypeId,
          disabled: readOnly,
          onChange: (event) => updateDraftRow(deliverableId, { serviceTypeId: event.target.value }),
          className: 'h-8 w-full rounded-md border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 px-2 text-xs text-slate-700 dark:text-slate-200',
        }, [
          h('option', { value: '' }, 'Service type'),
          ...(deliverable?.effectivePools || [])
            .filter((pool) => Number(pool?.estimatedHours) > 0)
            .map((pool) => String(pool.serviceTypeId))
            .map((id) => h('option', { key: id, value: id }, serviceTypeMap.get(id)?.name || id)),
        ]),
      ]),
      h('td', { className: `${baseCell} min-w-[90px]` }, [
        h('button', {
          type: 'button',
          disabled: readOnly,
          onClick: (event) => {
            event.stopPropagation();
            openDatePicker(event.currentTarget, draft.dueDate, (next) => updateDraftRow(deliverableId, { dueDate: next }));
          },
          className: 'text-xs text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white',
        }, draft.dueDate || 'Select date'),
      ]),
      h('td', { className: `${baseCell} min-w-[110px]` }, [
        h('input', {
          type: 'number',
          min: 0,
          step: 0.25,
          value: draft.loeHours,
          disabled: readOnly,
          onChange: (event) => updateDraftRow(deliverableId, { loeHours: event.target.value }),
          className: 'h-8 w-full rounded-md border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 px-2 text-xs text-slate-700 dark:text-slate-200',
        }),
      ]),
      h('td', { className: `${baseCell} text-right w-14` }, [
        h('span', { className: 'text-xs text-slate-400 dark:text-slate-500' }, '—'),
      ]),
    ]);
  };

  const renderAddTaskTrigger = (deliverable) => {
    const deliverableId = deliverable?.id || null;
    return h('tr', { key: `add-${deliverableId || 'unassigned'}`, className: 'border-b border-gray-200 dark:border-gray-800' }, [
      h('td', { colSpan: COLUMN_ORDER.length, className: 'px-6 py-3' }, [
        h('button', {
          type: 'button',
          disabled: readOnly,
          onClick: (event) => {
            event.stopPropagation();
            openDraftRow(deliverableId);
          },
          className: 'text-sm font-semibold text-gray-500 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white disabled:opacity-60',
        }, '+ Add a task'),
      ]),
    ]);
  };

  const renderSectionSpacer = (key) => h('tr', {
    key: `spacer-${key}`,
    className: 'h-4',
  }, [
    h('td', { colSpan: COLUMN_ORDER.length, className: 'p-0' }, [
      h('div', { className: 'h-4' }),
    ]),
  ]);

  const statusPromptTitle = statusPrompt?.promptType === 'complete'
    ? 'Complete deliverable?'
    : 'Start deliverable?';
  const statusPromptLabel = statusPrompt?.promptType === 'complete'
    ? 'Completion date'
    : 'Start date';

  return h('div', { className: 'overflow-x-auto' }, [
    h('table', { className: 'w-full text-left border-collapse', ref: tableRef }, [
      ...groups.map((group) => {
        const rows = [];
        const draftKeyId = draftKey(group.id);
        const mode = deliverableTaskViewMode[String(group.id)] || 'list';
        rows.push(renderGroupHeader(group));
        if (expandedGroups.has(group.id)) {
          rows.push(renderTasksSubToolbarRow(group.id));
          if (mode === 'kanban') {
            rows.push(renderDeliverableKanbanRow(group));
          } else {
            rows.push(renderTaskHeaderRow(group.id));
            (group.tasks || []).forEach((task) => {
              rows.push(...renderTaskRow(task, group.id, group));
            });
            if (isDraftRowOpen(group.id)) {
              rows.push(renderDraftRow(group, draftFocusKey === draftKeyId));
              if (draftDescriptionEditor?.key === draftKeyId) {
                rows.push(renderDraftDescriptionEditor(group.id));
              }
            } else {
              rows.push(renderAddTaskTrigger(group));
            }
          }
        }
        rows.push(renderSectionSpacer(group.id));
        return h('tbody', { key: group.id }, rows);
      }),
      h('tbody', { key: 'unassigned' }, [
        renderGroupHeader(unassignedGroup, true),
        ...(expandedGroups.has('unassigned')
          ? [
            renderTasksSubToolbarRow('unassigned'),
            ...((deliverableTaskViewMode.unassigned || 'list') === 'kanban'
              ? [renderDeliverableKanbanRow(unassignedGroup)]
              : [
                renderTaskHeaderRow('unassigned'),
                ...(unassignedGroup.tasks || []).flatMap((task) => renderTaskRow(task, null, null)),
                ...(isDraftRowOpen(null)
                  ? [
                    renderDraftRow(null, draftFocusKey === draftKey(null)),
                    ...(draftDescriptionEditor?.key === draftKey(null) ? [renderDraftDescriptionEditor(null)] : []),
                  ]
                  : [renderAddTaskTrigger(null)]),
              ]),
          ]
          : []),
        renderSectionSpacer('unassigned'),
      ]),
    ]),
    statusPrompt
      ? h('div', { className: 'fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 px-4' }, [
        h('div', { className: 'w-full max-w-sm rounded-xl border border-slate-200/10 bg-slate-900 text-slate-100 shadow-xl' }, [
          h('div', { className: 'px-5 py-4 border-b border-slate-800' }, [
            h('div', { className: 'text-base font-semibold' }, statusPromptTitle),
          ]),
          h('div', { className: 'px-5 py-4 space-y-3' }, [
            h('label', { className: 'block text-xs font-semibold text-slate-300' }, statusPromptLabel),
            h('input', {
              type: 'date',
              value: statusPromptDate || '',
              onChange: (event) => setStatusPromptDate(event.target.value),
              className: 'h-9 w-full rounded-md border border-slate-700 bg-slate-900 px-2 text-sm text-slate-100',
            }),
          ]),
          h('div', { className: 'px-5 py-4 flex items-center justify-end gap-2 border-t border-slate-800' }, [
            h('button', {
              type: 'button',
              className: 'px-3 py-1.5 text-sm text-slate-300 hover:text-white',
              onClick: () => setStatusPrompt(null),
            }, 'Cancel'),
            h('button', {
              type: 'button',
              className: 'px-3 py-1.5 rounded-md bg-slate-100 text-slate-900 text-sm font-semibold hover:bg-white',
              onClick: confirmStatusPrompt,
            }, 'Confirm'),
          ]),
        ]),
      ])
      : null,
  ]);
}
