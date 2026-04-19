import { getCurrentRole } from '../app-shell/app-helpers.js';
import { SectionHeader } from '../components/layout/SectionHeader.js';
import { mountSectionPageShell } from '../components/layout/section-page-shell.js';
import { RowActionsMenu } from '../components/performance/primitives.js';
import { navigate } from '../router.js';
import { QuickTasksExecutionTable } from '../quick-tasks/quick-tasks-list.js';
import { openSingleDatePickerPopover } from '../quick-tasks/quick-task-detail.js';
import { getCurrentUserId, loadTeamMembers } from '../quick-tasks/quick-tasks-store.js';
import {
  buildMyTimeViewModel,
  buildTaskContext,
  formatDateLabel,
  formatDurationDraftValue,
  formatFixedDurationHours,
  formatDurationMinutes,
  getPreviousMonthKey,
  parseDurationInputToMinutes,
  startOfLocalDay,
  toMonthKey,
} from './time-helpers.js';
import {
  deleteMyTimeEntry,
  duplicateMyTimeEntry,
  getMyTimeEntryAccess,
  loadMyTimeEntries,
  loadMyTimeTaskLockMap,
  loadPermittedMyTimeTaskCatalog,
  updateMyTimeEntry,
} from './time-store.js';
import { openMyTimeTaskResolverPopover } from './time-task-resolver.js';

const { createElement: h, useEffect, useMemo, useRef, useState } = React;
const { createRoot } = ReactDOM;

const ME_SWITCHER = [
  { value: 'tasks', label: 'My Tasks', hash: '#/app/me/tasks' },
  { value: 'my-lists', label: 'My Lists', hash: '#/app/me/my-lists' },
  { value: 'time', label: 'My Time', hash: '#/app/me/time' },
  { value: 'performance', label: 'My Performance', hash: '#/app/me/performance' },
];

const WORK_CONTEXT_OPTIONS = [
  { value: 'all', label: 'All' },
  { value: 'client', label: 'Client' },
  { value: 'internal', label: 'Internal' },
];

function renderTableCell(content, className = '') {
  return h('td', { className: `px-3 py-4 align-top ${className}`.trim() }, content);
}

function CompoundFilterControl({ label, id, value, onChange, options = [], widthClass = 'w-[170px]' }) {
  const selected = options.find((option) => String(option.value) === String(value)) || options[0] || { label: '' };
  return h('div', { className: `${widthClass} flex-none`.trim() }, [
    h('div', {
      className: 'relative flex h-11 items-center rounded-md border border-slate-200 bg-white px-3 pr-9 text-sm text-slate-700 dark:border-white/10 dark:bg-slate-900 dark:text-slate-200',
    }, [
      h('div', { className: 'pointer-events-none flex min-w-0 items-center gap-1.5' }, [
        h('span', { className: 'shrink-0 text-slate-500 dark:text-slate-400' }, `${label}:`),
        h('span', { className: 'truncate font-medium text-slate-700 dark:text-slate-200' }, selected.label),
      ]),
      h('span', {
        className: 'pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500',
        'aria-hidden': 'true',
      }, h('svg', { viewBox: '0 0 20 20', className: 'h-4 w-4', fill: 'currentColor' }, [
        h('path', { d: 'M5.23 7.21a.75.75 0 0 1 1.06.02L10 11.168l3.71-3.938a.75.75 0 1 1 1.08 1.04l-4.25 4.512a.75.75 0 0 1-1.08 0L5.21 8.27a.75.75 0 0 1 .02-1.06Z' }),
      ])),
      h('select', {
        id,
        value,
        onChange,
        className: 'absolute inset-0 h-full w-full cursor-pointer appearance-none opacity-0',
        'aria-label': `${label} filter`,
      }, options.map((option) => h('option', { key: option.value, value: option.value }, option.label))),
    ]),
  ]);
}

function CellButton({ onMouseDown, className = '', children, title = '', ...rest }) {
  return h('button', {
    type: 'button',
    title,
    onMouseDown,
    className: `block w-full rounded-md px-2 py-1 -mx-2 -my-1 text-left transition-colors hover:bg-slate-50 focus:outline-none dark:hover:bg-white/5 ${className}`.trim(),
    ...rest,
  }, children);
}

function buildNotesPreview(value) {
  const text = String(value || '').trim();
  if (!text) {
    return {
      label: 'Add note',
      className: 'text-sm text-slate-400 dark:text-slate-500',
      title: 'Add note',
    };
  }
  return {
    label: text,
    className: 'truncate text-sm leading-5 text-slate-700 dark:text-slate-200',
    title: text,
  };
}

function ExpandedNotesEditor({ value, notesInputRef, notesPanelRef, onChange, onBlur, onKeyDown }) {
  return h('div', {
    ref: notesPanelRef,
    'data-my-time-notes-panel': 'true',
    className: 'rounded-2xl border border-slate-200/80 bg-slate-50 p-4 space-y-3 dark:border-white/10 dark:bg-slate-900/40',
  }, [
    h('div', { className: 'space-y-1' }, [
      h('div', { className: 'text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400' }, 'Notes'),
      h('div', { className: 'text-sm text-slate-500 dark:text-slate-400' }, 'Press Enter to save, Shift+Enter for a new line, or Esc to cancel.'),
    ]),
    h('textarea', {
      ref: notesInputRef,
      rows: 4,
      value,
      onChange,
      onBlur,
      onKeyDown,
      className: 'w-full rounded-md border border-slate-200 bg-white px-3 py-3 text-sm leading-6 text-slate-700 outline-none focus:border-netnet-purple dark:border-white/10 dark:bg-slate-900 dark:text-slate-200',
    }),
  ]);
}

function TimeRowCells({
  entry,
  access,
  activeEditor,
  notesInputRef,
  notesPanelRef,
  durationInputRef,
  onBeginTaskEdit,
  onBeginNotesEdit,
  onNotesChange,
  onNotesBlur,
  onNotesKeyDown,
  onBeginDateEdit,
  onBeginDurationEdit,
  onDurationChange,
  onDurationBlur,
  onDurationKeyDown,
  onRowAction,
  onRowMenuOpenRequest,
}) {
  const taskContext = buildTaskContext(entry);
  const notesValue = String(entry.notes || '').trim();
  const contextLabel = entry.contextType === 'internal' ? 'Internal' : (entry.companyName || 'Client');
  const isDurationEditing = activeEditor?.entryId === entry.id && activeEditor?.field === 'duration';
  const rowStateChip = access?.rowStateLabel
    ? h('span', {
      className: access.isLocked
        ? 'inline-flex rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-amber-700 dark:border-amber-400/30 dark:bg-amber-500/10 dark:text-amber-200'
        : 'inline-flex rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-600 dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-300',
      title: access.rowStateReason || access.rowStateLabel,
    }, access.rowStateLabel)
    : null;
  const taskMeta = [taskContext
    ? h('div', { key: 'context', className: 'truncate text-xs text-slate-500 dark:text-slate-400' }, taskContext)
    : null, rowStateChip].filter(Boolean);
  const taskLabel = h('div', { className: 'space-y-1 min-w-0' }, [
    h('div', { className: 'truncate text-sm font-semibold text-slate-900 dark:text-slate-100' }, entry.taskTitle || 'Untitled task'),
    taskMeta.length
      ? h('div', { className: 'flex min-w-0 flex-wrap items-center gap-2' }, taskMeta)
      : null,
  ]);

  const taskCell = access?.canEdit
    ? h(CellButton, {
      title: 'Relink task',
      onMouseDown: onBeginTaskEdit,
      'data-my-time-editor-trigger': 'task',
      className: activeEditor?.entryId === entry.id && activeEditor?.field === 'task'
        ? 'bg-slate-50 dark:bg-white/5'
        : '',
    }, taskLabel)
    : taskLabel;

  const contextCell = entry.contextType === 'internal'
    ? h('span', {
      className: 'inline-flex rounded-full border border-slate-200 px-2 py-0.5 text-xs font-semibold text-slate-700 dark:border-white/10 dark:bg-slate-800 dark:text-slate-200',
    }, contextLabel)
    : h('span', { className: 'text-sm text-slate-700 dark:text-slate-200 truncate' }, contextLabel);

  const notesCell = (() => {
    const preview = buildNotesPreview(notesValue);
    const noteLabel = h('div', { className: preview.className, title: preview.title }, preview.label);
    return access?.canEdit
      ? h(CellButton, {
        title: preview.title,
        onMouseDown: onBeginNotesEdit,
        'data-my-time-notes-trigger': entry.id,
        className: activeEditor?.entryId === entry.id && activeEditor?.field === 'notes'
          ? 'bg-slate-50 dark:bg-white/5'
          : '',
      }, noteLabel)
      : noteLabel;
  })();

  const dateLabel = h('div', { className: 'whitespace-nowrap text-sm text-slate-600 dark:text-slate-300' }, formatDateLabel(entry.date));
  const dateCell = access?.canEdit
    ? h(CellButton, {
      title: 'Change date',
      onMouseDown: onBeginDateEdit,
      'data-my-time-editor-trigger': 'date',
      className: activeEditor?.entryId === entry.id && activeEditor?.field === 'date'
        ? 'bg-slate-50 dark:bg-white/5'
        : '',
    }, dateLabel)
    : dateLabel;

  const durationCell = (() => {
    if (isDurationEditing) {
      return h('div', { className: 'space-y-1' }, [
        h('input', {
          ref: durationInputRef,
          type: 'text',
          value: activeEditor.draftValue,
          onChange: onDurationChange,
          onBlur: onDurationBlur,
          onKeyDown: onDurationKeyDown,
          className: 'h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-900 outline-none focus:border-netnet-purple dark:border-white/10 dark:bg-slate-900 dark:text-white',
          'aria-label': 'Edit duration',
        }),
        activeEditor.error
          ? h('div', { className: 'text-[11px] text-rose-500' }, activeEditor.error)
          : h('div', { className: 'text-[11px] text-slate-400 dark:text-slate-500' }, 'Use decimal like 1.5 or clock like 1:30'),
      ]);
    }
    const durationLabel = h('div', { className: 'space-y-0.5' }, [
      h('div', { className: 'whitespace-nowrap text-sm font-semibold tabular-nums text-slate-900 dark:text-slate-100' }, formatFixedDurationHours(entry.duration_minutes)),
      h('div', { className: 'text-[11px] font-medium uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400' }, entry.entryType === 'manual' ? 'Manual' : 'Timer'),
    ]);
    return access?.canEdit
      ? h(CellButton, {
        title: 'Edit tracked duration',
        onMouseDown: onBeginDurationEdit,
        'data-my-time-editor-trigger': 'duration',
      }, durationLabel)
      : durationLabel;
  })();

  const rowMenuItems = [
    {
      label: 'Duplicate',
      value: 'duplicate',
      disabled: !access?.canDuplicate,
      reason: access?.duplicateReason || '',
    },
    {
      label: 'Delete',
      value: 'delete',
      disabled: !access?.canDelete,
      reason: access?.deleteReason || '',
      tone: 'danger',
    },
  ];

  return {
    task: taskCell,
    context: contextCell,
    notes: notesCell,
    date: dateCell,
    duration: durationCell,
    more: h('div', { className: 'flex justify-end' }, [
      h(RowActionsMenu, {
        menuItems: rowMenuItems,
        onOpenRequest: onRowMenuOpenRequest,
        onSelect: onRowAction,
      }),
    ]),
  };
}

function WeeklyRow(props) {
  const cells = TimeRowCells(props);
  return h('div', {
    className: 'grid items-start gap-3 border-t border-slate-200/70 px-4 py-3 dark:border-white/10',
    style: {
      gridTemplateColumns: 'minmax(0, 2.5fr) minmax(0, 1.35fr) minmax(0, 1.9fr) 112px 120px 44px',
    },
  }, [
    cells.task,
    cells.context,
    cells.notes,
    cells.date,
    cells.duration,
    cells.more,
  ]);
}

function WeeklyExpandedNotesRow({ entry, activeEditor, notesInputRef, notesPanelRef, onNotesChange, onNotesBlur, onNotesKeyDown }) {
  const isNotesEditing = activeEditor?.entryId === entry.id && activeEditor?.field === 'notes';
  if (!isNotesEditing) return null;
  return h('div', { className: 'border-t border-slate-200/70 px-4 py-4 dark:border-white/10' }, [
    h(ExpandedNotesEditor, {
      value: activeEditor.draftValue,
      notesInputRef,
      notesPanelRef,
      onChange: onNotesChange,
      onBlur: onNotesBlur,
      onKeyDown: onNotesKeyDown,
    }),
  ]);
}

function WeeklyGroup({ group, getRowProps }) {
  return h('section', {
    className: 'overflow-hidden rounded-2xl border border-slate-200/80 bg-white/90 shadow-sm dark:border-white/10 dark:bg-slate-900/80',
  }, [
    h('div', { className: 'flex items-center justify-between gap-3 bg-slate-50 px-4 py-3 dark:bg-slate-950/50' }, [
      h('h3', { className: 'text-sm font-semibold text-slate-900 dark:text-white' }, group.label),
      h('div', { className: 'text-sm font-semibold tabular-nums text-slate-900 dark:text-white' }, formatDurationMinutes(group.subtotalMinutes)),
    ]),
    ...group.entries.flatMap((entry) => {
      const rowProps = getRowProps(entry);
      return [
        h(WeeklyRow, {
          key: entry.id,
          entry,
          ...rowProps,
        }),
        h(WeeklyExpandedNotesRow, {
          key: `${entry.id}-notes-expanded`,
          entry,
          ...rowProps,
        }),
      ];
    }),
  ]);
}

function MonthSection({ title, totalMinutes, rows, members, getRowProps }) {
  const customRows = rows.flatMap((entry) => {
    const rowProps = getRowProps(entry);
    const cells = TimeRowCells({ entry, ...rowProps });
    const items = [
      h('tr', {
        key: entry.id,
        className: 'hover:bg-slate-50/90 dark:hover:bg-slate-800/50 transition-colors',
      }, [
        renderTableCell(cells.task, 'w-[28%] min-w-0'),
        renderTableCell(cells.context, 'w-[17%] min-w-[140px]'),
        renderTableCell(cells.notes, 'w-[21%] min-w-0'),
        renderTableCell(cells.date, 'w-[10%] min-w-[108px]'),
        renderTableCell(cells.duration, 'w-[12%] min-w-[112px]'),
        renderTableCell(cells.more, 'w-[4%] min-w-[44px] text-right'),
      ]),
    ];
    if (rowProps.activeEditor?.entryId === entry.id && rowProps.activeEditor?.field === 'notes') {
      items.push(h('tr', {
        key: `${entry.id}-notes-expanded`,
        className: 'bg-white dark:bg-slate-900/60',
      }, [
        h('td', { colSpan: 6, className: 'px-4 pb-4 pt-0' }, [
          h(ExpandedNotesEditor, {
            value: rowProps.activeEditor.draftValue,
            notesInputRef: rowProps.notesInputRef,
            notesPanelRef: rowProps.notesPanelRef,
            onChange: rowProps.onNotesChange,
            onBlur: rowProps.onNotesBlur,
            onKeyDown: rowProps.onNotesKeyDown,
          }),
        ]),
      ]));
    }
    return items;
  });

  return h('section', {
    className: 'space-y-4 rounded-[24px] border border-slate-200/80 bg-white/90 p-4 shadow-sm dark:border-white/10 dark:bg-slate-900/80 md:p-5',
  }, [
    h('div', { className: 'flex items-center justify-between gap-3 px-1' }, [
      h('h2', { className: 'text-lg font-semibold text-slate-900 dark:text-white' }, title),
      h('div', { className: 'text-sm font-semibold tabular-nums text-slate-900 dark:text-white' }, formatDurationMinutes(totalMinutes)),
    ]),
    h(QuickTasksExecutionTable, {
      tasks: [],
      members,
      stickyHeader: false,
      customColumns: [
        { key: 'task', label: 'Task', className: 'px-3 py-3 w-[28%]' },
        { key: 'context', label: 'Company / Internal', className: 'px-3 py-3 w-[17%]' },
        { key: 'notes', label: 'Notes', className: 'px-3 py-3 w-[21%]' },
        { key: 'date', label: 'Date', className: 'px-3 py-3 w-[10%]' },
        { key: 'duration', label: 'Tracked', className: 'px-3 py-3 w-[12%]' },
        { key: 'more', label: '', className: 'px-3 py-3 w-[4%] text-right' },
      ],
      customRows,
      customEmptyMessage: 'No matching time entries',
    }),
  ]);
}

function PreviousMonthButton({ onClick }) {
  return h('div', { className: 'flex justify-center pt-2' }, [
    h('button', {
      type: 'button',
      onClick,
      className: 'inline-flex h-11 items-center justify-center rounded-md border border-slate-300 bg-white px-4 text-sm font-medium text-slate-700 shadow-sm transition-colors hover:bg-slate-50 dark:border-white/10 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800',
    }, 'Previous Month'),
  ]);
}

function DeleteTimeEntryModal({ targetEntry, value, onChange, onCancel, onConfirm }) {
  if (!targetEntry) return null;
  const isUnlocked = value === 'DELETE';
  return h('div', { className: 'fixed inset-0 z-50 flex items-center justify-center px-4' }, [
    h('div', {
      className: 'absolute inset-0 bg-black/40',
      onClick: onCancel,
    }),
    h('div', { className: 'relative z-10 w-full max-w-md rounded-2xl border border-slate-200 bg-white p-5 shadow-xl space-y-4 dark:border-white/10 dark:bg-slate-900' }, [
      h('div', { className: 'space-y-1' }, [
        h('div', { className: 'text-base font-semibold text-slate-900 dark:text-white' }, 'Delete Time Entry'),
        h('p', { className: 'text-sm text-slate-500 dark:text-slate-400' }, `This permanently removes "${targetEntry.taskTitle || 'this time entry'}" from My Time.`),
        h('p', { className: 'text-sm text-slate-500 dark:text-slate-400' }, 'Type DELETE to confirm.'),
      ]),
      h('input', {
        type: 'text',
        value,
        onChange: (event) => onChange(event.target.value || ''),
        placeholder: 'DELETE',
        className: 'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 dark:border-white/10 dark:bg-slate-900 dark:text-white',
      }),
      h('div', {
        className: isUnlocked
          ? 'text-xs text-emerald-600 dark:text-emerald-300'
          : 'text-xs text-slate-500 dark:text-slate-400',
      }, isUnlocked ? 'Confirmation unlocked.' : 'Enter DELETE exactly to enable deletion.'),
      h('div', { className: 'flex items-center justify-end gap-2' }, [
        h('button', {
          type: 'button',
          className: 'px-4 py-2 text-sm rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50 dark:border-white/20 dark:text-white dark:hover:bg-slate-800',
          onClick: onCancel,
        }, 'Cancel'),
        h('button', {
          type: 'button',
          disabled: !isUnlocked,
          className: [
            'px-4 py-2 text-sm rounded-lg text-white',
            isUnlocked ? 'bg-rose-500 hover:brightness-110' : 'bg-rose-300 cursor-not-allowed opacity-60',
          ].join(' '),
          onClick: onConfirm,
        }, 'Delete Entry'),
      ]),
    ]),
  ]);
}

export function renderMyTimePage(container = document.getElementById('app-main')) {
  if (!container) {
    console.warn('[MyTimeModule] container not found for renderMyTimePage.');
    return;
  }

  const { headerMount, bodyMount } = mountSectionPageShell(container, {
    headerId: 'my-time-header',
    bodyId: 'my-time-body',
  });
  const headerRoot = createRoot(headerMount);
  const bodyRoot = createRoot(bodyMount);

  headerRoot.render(h(SectionHeader, {
    breadcrumbs: [
      { label: 'Me' },
      { label: 'My Time' },
    ],
    showHelpIcon: true,
    videoHelpConfig: {
      primary: {
        title: 'My Time overview',
        description: 'Review your weekly corrections and browse month-based time history.',
        videoUrl: 'https://videos.hellonetnet.com/watch/wo5umvj3',
        thumbnailSrc: 'public/assets/samples/vid-jobs.jpg',
      },
      related: [],
    },
    switcherOptions: ME_SWITCHER,
    switcherValue: 'time',
    onSwitcherChange: (value) => {
      const next = ME_SWITCHER.find((item) => item.value === value);
      navigate(next?.hash || '#/app/me/tasks');
    },
    showSearch: false,
    showSecondaryRow: false,
    className: 'mb-1',
  }));

  function ScreenRoot() {
    const now = useMemo(() => startOfLocalDay(new Date()), []);
    const membersState = useMemo(() => loadTeamMembers(), []);
    const roleState = useMemo(() => getCurrentRole(), []);
    const canSwitchUsersState = roleState === 'owner' || roleState === 'admin';
    const currentUserIdState = useMemo(() => getCurrentUserId(membersState) || membersState[0]?.id || '', [membersState]);
    const currentMonthKey = useMemo(() => toMonthKey(now), [now]);
    const taskCatalog = useMemo(() => loadPermittedMyTimeTaskCatalog({
      actorUserId: currentUserIdState,
      actorRole: roleState,
    }), [currentUserIdState, roleState]);
    const taskLockMap = useMemo(() => loadMyTimeTaskLockMap(), [taskCatalog]);
    const [storedEntries, setStoredEntries] = useState(() => loadMyTimeEntries({ now, catalog: taskCatalog }));
    const [selectedUserId, setSelectedUserId] = useState(currentUserIdState);
    const [search, setSearch] = useState('');
    const [jobFilter, setJobFilter] = useState('all');
    const [companyFilter, setCompanyFilter] = useState('all');
    const [contextFilter, setContextFilter] = useState('all');
    const [loadedMonthKeys, setLoadedMonthKeys] = useState([currentMonthKey]);
    const [activeEditor, setActiveEditor] = useState(null);
    const [deleteTargetId, setDeleteTargetId] = useState('');
    const [deleteInput, setDeleteInput] = useState('');

    const overlayCleanupRef = useRef(null);
    const activeEditorRef = useRef(null);
    const notesInputRef = useRef(null);
    const notesPanelRef = useRef(null);
    const durationInputRef = useRef(null);

    const refreshEntries = () => {
      setStoredEntries(loadMyTimeEntries({ now, catalog: taskCatalog }));
    };

    const closeOverlay = () => {
      if (typeof overlayCleanupRef.current === 'function') {
        const cleanup = overlayCleanupRef.current;
        overlayCleanupRef.current = null;
        cleanup();
      }
    };

    useEffect(() => {
      refreshEntries();
    }, [taskCatalog]);

    useEffect(() => {
      activeEditorRef.current = activeEditor;
    }, [activeEditor]);

    useEffect(() => {
      return () => {
        closeOverlay();
      };
    }, []);

    useEffect(() => {
      setSelectedUserId(currentUserIdState);
    }, [currentUserIdState]);

    useEffect(() => {
      if (!canSwitchUsersState) setSelectedUserId(currentUserIdState);
    }, [canSwitchUsersState, currentUserIdState]);

    useEffect(() => {
      setLoadedMonthKeys([currentMonthKey]);
      setActiveEditor(null);
      setDeleteTargetId('');
      setDeleteInput('');
      closeOverlay();
    }, [selectedUserId, currentMonthKey]);

    useEffect(() => {
      if (!activeEditor) return;
      window.requestAnimationFrame(() => {
        if (activeEditor.field === 'notes') notesInputRef.current?.focus?.();
        if (activeEditor.field === 'duration') durationInputRef.current?.focus?.();
      });
    }, [activeEditor]);

    useEffect(() => {
      if (activeEditor?.field !== 'notes') return undefined;
      const handlePointerDown = (event) => {
        const target = event.target;
        if (notesPanelRef.current?.contains?.(target)) return;
        const noteTrigger = target?.closest?.('[data-my-time-notes-trigger]');
        if (noteTrigger && String(noteTrigger.getAttribute('data-my-time-notes-trigger')) === String(activeEditor.entryId)) {
          return;
        }
        commitEditor(activeEditorRef.current);
      };
      document.addEventListener('pointerdown', handlePointerDown, true);
      return () => document.removeEventListener('pointerdown', handlePointerDown, true);
    }, [activeEditor]);

    const mutationContext = {
      now,
      catalog: taskCatalog,
      actorUserId: currentUserIdState,
      actorRole: roleState,
      selectedUserId: canSwitchUsersState ? selectedUserId : currentUserIdState,
      taskLockMap,
    };

    const persistEntryPatch = (entryId, patch) => {
      const nextEntries = updateMyTimeEntry(entryId, patch, mutationContext);
      setStoredEntries(nextEntries);
    };

    const commitEditor = (editor = activeEditorRef.current) => {
      if (!editor) return true;
      if (editor.field === 'notes') {
        persistEntryPatch(editor.entryId, { notes: String(editor.draftValue || '') });
        setActiveEditor(null);
        return true;
      }
      if (editor.field === 'duration') {
        const parsed = parseDurationInputToMinutes(editor.draftValue);
        if (!parsed.valid || parsed.minutes <= 0) {
          setActiveEditor((current) => current && current.entryId === editor.entryId && current.field === editor.field
            ? { ...current, error: 'Enter a positive duration like 1.5 or 1:30.' }
            : current);
          window.requestAnimationFrame(() => durationInputRef.current?.focus?.());
          return false;
        }
        persistEntryPatch(editor.entryId, { duration_minutes: parsed.minutes });
        setActiveEditor(null);
        return true;
      }
      return true;
    };

    const cancelEditor = () => {
      setActiveEditor(null);
      closeOverlay();
    };

    const resolveAndRun = (callback) => {
      const ok = commitEditor();
      if (!ok) return false;
      closeOverlay();
      callback?.();
      return true;
    };

    const effectiveUserId = canSwitchUsersState ? selectedUserId : currentUserIdState;
    const viewModel = useMemo(() => buildMyTimeViewModel({
      entries: storedEntries,
      effectiveUserId,
      loadedMonthKeys,
      filters: {
        search,
        job: jobFilter,
        company: companyFilter,
        context: contextFilter,
      },
      now,
    }), [storedEntries, effectiveUserId, loadedMonthKeys, search, jobFilter, companyFilter, contextFilter, now]);

    const {
      availableCompanies,
      availableJobs,
      filteredCandidateEntries,
      monthSections,
      weeklyEntries,
      weeklyGroups,
      weeklyTotalMinutes,
    } = viewModel;
    const filteredEntryMap = useMemo(() => new Map(filteredCandidateEntries.map((entry) => [entry.id, entry])), [filteredCandidateEntries]);
    const deleteTargetEntry = deleteTargetId ? filteredEntryMap.get(deleteTargetId) || storedEntries.find((entry) => String(entry.id) === String(deleteTargetId)) || null : null;

    useEffect(() => {
      if (jobFilter !== 'all' && !availableJobs.includes(jobFilter)) setJobFilter('all');
    }, [jobFilter, availableJobs]);

    useEffect(() => {
      if (companyFilter !== 'all' && !availableCompanies.includes(companyFilter)) setCompanyFilter('all');
    }, [companyFilter, availableCompanies]);

    const userOptionsState = useMemo(() => membersState.map((member) => ({
      value: member.id,
      label: member.name || member.email || 'Team member',
    })), [membersState]);

    const beginNotesEdit = (entry) => {
      const current = activeEditorRef.current;
      if (current?.field === 'notes' && current.entryId === entry.id) {
        commitEditor(current);
        return;
      }
      resolveAndRun(() => {
        setActiveEditor({
          entryId: entry.id,
          field: 'notes',
          draftValue: String(entry.notes || ''),
          error: '',
        });
      });
    };

    const beginDurationEdit = (entry) => {
      resolveAndRun(() => {
        setActiveEditor({
          entryId: entry.id,
          field: 'duration',
          draftValue: formatDurationDraftValue(entry.duration_minutes),
          error: '',
        });
      });
    };

    const beginDateEdit = (entry, anchorEl) => {
      resolveAndRun(() => {
        setActiveEditor({
          entryId: entry.id,
          field: 'date',
          draftValue: entry.date,
          error: '',
        });
        overlayCleanupRef.current = openSingleDatePickerPopover({
          anchorEl,
          value: entry.date || '',
          onSelect: (nextDate) => {
            persistEntryPatch(entry.id, { date: nextDate || entry.date });
            setActiveEditor(null);
            overlayCleanupRef.current = null;
          },
          onClear: () => {},
          onClose: () => {
            overlayCleanupRef.current = null;
            setActiveEditor((current) => (current?.entryId === entry.id && current?.field === 'date' ? null : current));
            anchorEl?.focus?.();
          },
        });
      });
    };

    const beginTaskEdit = (entry, anchorEl) => {
      resolveAndRun(() => {
        setActiveEditor({
          entryId: entry.id,
          field: 'task',
          draftValue: '',
          error: '',
        });
        overlayCleanupRef.current = openMyTimeTaskResolverPopover({
          anchorEl,
          tasks: taskCatalog,
          onSelect: (task) => {
            persistEntryPatch(entry.id, { nextTaskId: task.id });
            setActiveEditor(null);
            overlayCleanupRef.current = null;
          },
          onClose: () => {
            overlayCleanupRef.current = null;
            setActiveEditor((current) => (current?.entryId === entry.id && current?.field === 'task' ? null : current));
            anchorEl?.focus?.();
          },
        });
      });
    };

    const handleDuplicateEntry = (entry) => {
      resolveAndRun(() => {
        const nextEntries = duplicateMyTimeEntry(entry.id, mutationContext);
        setStoredEntries(nextEntries);
      });
    };

    const handleRequestDeleteEntry = (entry) => {
      resolveAndRun(() => {
        setDeleteTargetId(entry.id);
        setDeleteInput('');
      });
    };

    const confirmDeleteEntry = () => {
      if (!deleteTargetEntry || deleteInput !== 'DELETE') return;
      const nextEntries = deleteMyTimeEntry(deleteTargetEntry.id, mutationContext);
      setStoredEntries(nextEntries);
      setDeleteTargetId('');
      setDeleteInput('');
    };

    const sharedRowProps = {
      activeEditor,
      durationInputRef,
      notesInputRef,
      notesPanelRef,
      onDurationBlur: () => {
        commitEditor(activeEditorRef.current);
      },
      onDurationChange: (event) => {
        const nextValue = event.target.value || '';
        setActiveEditor((current) => current ? { ...current, draftValue: nextValue, error: '' } : current);
      },
      onDurationKeyDown: (event) => {
        if (event.key === 'Escape') {
          event.preventDefault();
          cancelEditor();
        }
        if (event.key === 'Enter') {
          event.preventDefault();
          commitEditor(activeEditorRef.current);
        }
      },
      onNotesBlur: () => {
        commitEditor(activeEditorRef.current);
      },
      onNotesChange: (event) => {
        const nextValue = event.target.value || '';
        setActiveEditor((current) => current ? { ...current, draftValue: nextValue } : current);
      },
      onNotesKeyDown: (event) => {
        if (event.key === 'Escape') {
          event.preventDefault();
          cancelEditor();
        }
        if (event.key === 'Enter' && !event.shiftKey) {
          event.preventDefault();
          commitEditor(activeEditorRef.current);
        }
      },
    };

    const buildRowProps = (entry) => {
      const access = getMyTimeEntryAccess(entry, mutationContext);
      return {
        ...sharedRowProps,
        access,
        onBeginTaskEdit: (event) => {
          event.preventDefault();
          beginTaskEdit(entry, event.currentTarget);
        },
        onBeginNotesEdit: (event) => {
          event.preventDefault();
          beginNotesEdit(entry);
        },
        onBeginDateEdit: (event) => {
          event.preventDefault();
          beginDateEdit(entry, event.currentTarget);
        },
        onBeginDurationEdit: (event) => {
          event.preventDefault();
          beginDurationEdit(entry);
        },
        onRowAction: (action) => {
          if (action === 'duplicate') handleDuplicateEntry(entry);
          if (action === 'delete') handleRequestDeleteEntry(entry);
        },
        onRowMenuOpenRequest: () => resolveAndRun(() => {}),
      };
    };

    return h('div', { className: 'space-y-5' }, [
      h('div', {
        key: 'controls',
        className: 'sticky top-0 z-20 -mx-4 border-b border-slate-200/80 bg-[#f8fafc] px-4 py-3 dark:border-white/10 dark:bg-[#020617]',
      }, [
        h('div', { className: 'flex w-full flex-wrap items-center gap-2' }, [
          h('div', {
            className: 'inline-flex items-center gap-1 rounded-full border border-slate-300 bg-slate-50 px-1 py-1 dark:border-white/10 dark:bg-slate-800',
          }, ME_SWITCHER.map((option) => h('button', {
            key: option.value,
            type: 'button',
            className: [
              'rounded-full border px-3 py-1 text-sm font-medium transition-colors',
              option.value === 'time'
                ? 'border-transparent bg-[var(--color-brand-purple,#711FFF)] text-white shadow-sm'
                : 'border-transparent text-slate-600 hover:bg-slate-100 hover:border-slate-300 dark:text-slate-300 dark:hover:bg-white/10 dark:hover:border-white/25',
            ].join(' '),
            onClick: () => navigate(option.hash),
          }, option.label))),
          h('div', { className: 'min-w-[240px] flex-1' }, [
            h('input', {
              type: 'search',
              value: search,
              onChange: (event) => setSearch(event.target.value || ''),
              placeholder: 'Search time history...',
              className: 'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 shadow-inner focus:outline-none focus:ring-2 focus:ring-netnet-purple dark:border-white/10 dark:bg-slate-900 dark:text-white',
              'aria-label': 'Search time history',
            }),
          ]),
          h(CompoundFilterControl, {
            label: 'Job',
            id: 'my-time-job-filter',
            value: jobFilter,
            onChange: (event) => setJobFilter(event.target.value),
            options: [{ value: 'all', label: 'All jobs' }, ...availableJobs.map((job) => ({ value: job, label: job }))],
            widthClass: 'w-[184px]',
          }),
          h(CompoundFilterControl, {
            label: 'Company',
            id: 'my-time-company-filter',
            value: companyFilter,
            onChange: (event) => setCompanyFilter(event.target.value),
            options: [{ value: 'all', label: 'All companies' }, ...availableCompanies.map((company) => ({ value: company, label: company }))],
            widthClass: 'w-[198px]',
          }),
          h(CompoundFilterControl, {
            label: 'Work Context',
            id: 'my-time-context-filter',
            value: contextFilter,
            onChange: (event) => setContextFilter(event.target.value),
            options: WORK_CONTEXT_OPTIONS,
            widthClass: 'w-[188px]',
          }),
          canSwitchUsersState
            ? h(CompoundFilterControl, {
              label: 'User',
              id: 'my-time-user-filter',
              value: selectedUserId,
              onChange: (event) => setSelectedUserId(event.target.value),
              options: userOptionsState,
              widthClass: 'w-[184px]',
            })
            : null,
        ]),
      ]),
      weeklyEntries.length > 0
        ? h('section', {
          key: 'this-week',
          className: 'space-y-4 rounded-[24px] border border-slate-200/80 bg-white/90 p-4 shadow-sm dark:border-white/10 dark:bg-slate-900/80 md:p-5',
        }, [
          h('div', { className: 'flex items-center justify-between gap-3 px-1' }, [
            h('h2', { className: 'text-lg font-semibold text-slate-900 dark:text-white' }, 'This Week'),
            h('div', { className: 'text-sm font-semibold tabular-nums text-slate-900 dark:text-white' }, formatDurationMinutes(weeklyTotalMinutes)),
          ]),
          weeklyGroups.map((group) => h(WeeklyGroup, {
            key: group.key,
            group,
            getRowProps: buildRowProps,
          })),
        ])
        : null,
      ...monthSections.map((section) => h(MonthSection, {
        key: section.key,
        title: section.title,
        totalMinutes: section.totalMinutes,
        rows: section.rows,
        members: membersState,
        getRowProps: buildRowProps,
      })),
      h(PreviousMonthButton, {
        key: 'previous-month',
        onClick: () => setLoadedMonthKeys((current) => {
          const last = current[current.length - 1] || currentMonthKey;
          const nextKey = getPreviousMonthKey(last);
          return current.includes(nextKey) ? current : [...current, nextKey];
        }),
      }),
      h(DeleteTimeEntryModal, {
        key: 'delete-modal',
        targetEntry: deleteTargetEntry,
        value: deleteInput,
        onChange: setDeleteInput,
        onCancel: () => {
          setDeleteTargetId('');
          setDeleteInput('');
        },
        onConfirm: confirmDeleteEntry,
      }),
    ]);
  }

  bodyRoot.render(h(ScreenRoot));
}
