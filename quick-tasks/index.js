import { SectionHeader } from '../components/layout/SectionHeader.js';
import {
  createQuickTask,
  archiveTask,
  deleteTask,
  getTaskAssigneeIds,
  loadQuickTasks,
  loadServiceTypes,
  loadTeamMembers,
  setTaskStatus,
  updateTask,
} from './quick-tasks-store.js';
import { QuickTasksExecutionTable } from './quick-tasks-list.js';
import { getQuickTasksUIState, setQuickTasksFilters } from './quick-tasks-ui-state.js';

const { createElement: h } = React;
const { createRoot } = ReactDOM;

function parseLocalDate(dateStr) {
  if (!dateStr) return null;
  const parts = dateStr.split('-').map((part) => Number(part));
  if (parts.length !== 3 || parts.some((val) => Number.isNaN(val))) return null;
  return new Date(parts[0], parts[1] - 1, parts[2]);
}

function isWithinDays(dateStr, days) {
  const target = parseLocalDate(dateStr);
  if (!target) return false;
  const today = new Date();
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const diff = (target.getTime() - start.getTime()) / (24 * 60 * 60 * 1000);
  return diff >= 0 && diff <= days;
}

function isOverdue(dateStr) {
  const target = parseLocalDate(dateStr);
  if (!target) return false;
  const today = new Date();
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  return target.getTime() < start.getTime();
}

function filterTasks(tasks, uiState, options = {}) {
  const searchValue = typeof uiState?.search === 'string' ? uiState.search : '';
  const term = searchValue.trim().toLowerCase();
  const statusFilter = options.statusFilter || 'all';
  return tasks.filter((task) => {
    const isArchived = task.status === 'archived' || !!task.isArchived;
    if (statusFilter === 'archived') return isArchived;
    if (isArchived) return false;
    if (statusFilter === 'backlog' && task.status !== 'backlog') return false;
    if (statusFilter === 'in_progress' && task.status !== 'in_progress') return false;
    if (statusFilter === 'completed' && task.status !== 'completed') return false;

    if (uiState.assignee && uiState.assignee !== 'all' && !getTaskAssigneeIds(task).includes(String(uiState.assignee))) {
      return false;
    }

    if (uiState.duePreset === 'overdue' && !isOverdue(task.dueDate)) return false;
    if (uiState.duePreset === '7' && !isWithinDays(task.dueDate, 7)) return false;
    if (uiState.duePreset === '30' && !isWithinDays(task.dueDate, 30)) return false;

    if (!term) return true;
    const haystack = `${task.title || ''} ${task.description || ''}`.toLowerCase();
    return haystack.includes(term);
  });
}

function sortTasks(tasks) {
  const rankFor = (task) => {
    if (task.status === 'in_progress') return 0;
    if (task.status === 'backlog') return 1;
    if (task.status === 'completed') return 2;
    if (task.status === 'archived') return 3;
    return 4;
  };
  return [...tasks].sort((a, b) => {
    const rankDiff = rankFor(a) - rankFor(b);
    if (rankDiff !== 0) return rankDiff;
    if (!a.dueDate && !b.dueDate) return 0;
    if (!a.dueDate) return 1;
    if (!b.dueDate) return -1;
    return a.dueDate.localeCompare(b.dueDate);
  });
}

export function renderQuickTasksPage(container = document.getElementById('app-main')) {
  if (!container) {
    console.warn('[QuickTasksModule] container not found for renderQuickTasksPage.');
    return;
  }

  container.className = 'h-full w-full';
  container.innerHTML = `
    <div class="flex h-full w-full flex-col gap-4">
      <div id="quick-tasks-header" class="space-y-3 px-4 pt-4"></div>
      <div id="quick-tasks-body" class="flex-1 space-y-4 px-4 pb-12"></div>
    </div>
  `;

  const headerMount = container.querySelector('#quick-tasks-header');
  const body = container.querySelector('#quick-tasks-body');
  const headerRoot = createRoot(headerMount);
  let bodyRoot = null;

  let uiState = getQuickTasksUIState();
  if (uiState.view !== 'list') {
    uiState = { ...uiState, view: 'list' };
  }
  let statusFilter = uiState.statusLens === 'archived' ? 'archived' : uiState.statusLens === 'completed' ? 'completed' : 'all';
  let tasks = loadQuickTasks();
  let recentlyCreatedTaskId = null;
  let createIntentId = 0;
  let stickyFiltersHeight = 0;

  const refresh = () => {
    tasks = loadQuickTasks();
    renderAll();
  };

  const ensureCreatedTaskVisible = () => {
    uiState = setQuickTasksFilters({
      statusLens: 'active',
      assignee: 'all',
      duePreset: 'all',
      search: '',
    });
    statusFilter = 'all';
  };

  const handleStatusChange = (taskId, status, originStatus) => {
    if (!taskId) return;
    setTaskStatus(taskId, status);
    refresh();
  };

  const renderHeader = () => {
    const breadcrumb = h('div', { className: 'flex items-center gap-2' }, [
      h('span', { className: 'text-sm text-slate-500 dark:text-white/70' }, 'Tasks'),
      h('span', { className: 'text-slate-400 dark:text-white/50' }, '›'),
      h('span', { className: 'text-2xl font-semibold text-slate-900 dark:text-white' }, 'Quick Tasks'),
    ]);

    const searchBox = h('div', { className: 'flex-1 min-w-[220px]' }, [
      h('input', {
        type: 'search',
        value: uiState.search || '',
        placeholder: 'Search quick tasks...',
        onInput: (event) => {
          uiState = setQuickTasksFilters({ search: (event.target?.value || '').toString() });
          renderBody();
        },
        className: 'w-full rounded-lg border border-slate-300 dark:border-white/10 bg-white dark:bg-slate-900 px-3 py-2 text-sm text-slate-800 dark:text-white shadow-inner focus:outline-none focus:ring-2 focus:ring-netnet-purple',
      }),
    ]);

    headerRoot.render(h(React.Fragment, null, [
      h(SectionHeader, {
        title: breadcrumb,
        showHelpIcon: true,
        showSecondaryRow: false,
        className: 'mb-1',
      }),
    ]));
  };

  const renderBody = () => {
    if (!body) return;
    const members = loadTeamMembers();
    const serviceTypes = loadServiceTypes().filter((type) => type.active);
    const memberOptions = [
      h('option', { value: 'all' }, 'All assignees'),
      ...members.map((member) => h('option', { key: member.id, value: member.id }, member.name || member.email || 'Member')),
    ];
    const statusLens = h('div', { className: 'inline-flex items-center gap-1 rounded-full border border-slate-300 dark:border-white/10 bg-white dark:bg-slate-900 px-1 py-1' }, [
      ['all', 'All'],
      ['backlog', 'Backlog'],
      ['in_progress', 'In Progress'],
      ['completed', 'Completed'],
      ['archived', 'Archived'],
    ].map(([key, label]) => h('button', {
      key,
      type: 'button',
      className: [
        'px-3 py-1 rounded-full text-xs font-semibold transition-colors border',
        statusFilter === key
          ? 'bg-[var(--color-brand-purple,#711FFF)] text-white border-transparent shadow-sm'
          : 'text-slate-600 dark:text-slate-300 border-transparent hover:bg-slate-100 dark:hover:bg-white/10',
      ].join(' '),
      onClick: () => {
        statusFilter = key;
        if (key === 'archived') {
          uiState = setQuickTasksFilters({ statusLens: 'archived' });
        } else if (key === 'completed') {
          uiState = setQuickTasksFilters({ statusLens: 'completed' });
        } else {
          uiState = setQuickTasksFilters({ statusLens: 'active' });
        }
        renderAll();
      },
    }, label)));
    const assigneeFilter = h('select', {
      className: 'h-10 rounded-md border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 px-3 text-sm',
      value: uiState.assignee || 'all',
      onChange: (event) => {
        uiState = setQuickTasksFilters({ assignee: event.target.value });
        renderAll();
      },
    }, memberOptions);
    const dueFilter = h('select', {
      className: 'h-10 rounded-md border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 px-3 text-sm',
      value: uiState.duePreset || 'all',
      onChange: (event) => {
        uiState = setQuickTasksFilters({ duePreset: event.target.value });
        renderAll();
      },
    }, [
      h('option', { value: 'all' }, 'All due dates'),
      h('option', { value: 'overdue' }, 'Overdue'),
      h('option', { value: '7' }, 'Next 7 days'),
      h('option', { value: '30' }, 'Next 30 days'),
    ]);
    const newBtn = h('button', {
      type: 'button',
      className: 'inline-flex items-center justify-center h-10 px-4 rounded-md bg-netnet-purple text-white text-sm font-semibold hover:brightness-110',
      onClick: () => {
        ensureCreatedTaskVisible();
        createIntentId += 1;
        renderBody();
      },
    }, '+ New Quick Task');
    const searchBox = h('div', { className: 'flex-1 min-w-[220px]' }, [
      h('input', {
        type: 'search',
        value: uiState.search || '',
        placeholder: 'Search quick tasks...',
        onInput: (event) => {
          uiState = setQuickTasksFilters({ search: (event.target?.value || '').toString() });
          renderBody();
        },
        className: 'w-full rounded-lg border border-slate-300 dark:border-white/10 bg-white dark:bg-slate-900 px-3 py-2 text-sm text-slate-800 dark:text-white shadow-inner focus:outline-none focus:ring-2 focus:ring-netnet-purple',
      }),
    ]);
    const filtered = sortTasks(filterTasks(tasks, uiState, { statusFilter }));
    const prioritized = recentlyCreatedTaskId
      ? [
        ...filtered.filter((task) => String(task.id) === String(recentlyCreatedTaskId)),
        ...filtered.filter((task) => String(task.id) !== String(recentlyCreatedTaskId)),
      ]
      : filtered;

    if (recentlyCreatedTaskId && !prioritized.some((task) => String(task.id) === String(recentlyCreatedTaskId))) {
      recentlyCreatedTaskId = null;
    }

    if (!bodyRoot) {
      body.innerHTML = '<div id="quick-tasks-list-root"></div>';
      bodyRoot = createRoot(body.querySelector('#quick-tasks-list-root'));
    }
    bodyRoot.render(h('div', { className: 'space-y-0' }, [
      h('div', {
        id: 'quick-tasks-sticky-filters',
        className: 'sticky top-0 z-30 -mx-4 mb-0 px-4 py-3 bg-[#f8fafc] dark:bg-[#020617] border-b border-slate-200/80 dark:border-white/10',
      }, [
        h('div', { className: 'flex w-full flex-wrap items-center gap-2' }, [
          statusLens,
          assigneeFilter,
          dueFilter,
          searchBox,
          newBtn,
        ]),
      ]),
      h(QuickTasksExecutionTable, {
        tasks: prioritized,
        members,
        serviceTypes,
        statusFilter,
        stickyOffsetPx: stickyFiltersHeight,
        highlightTaskId: recentlyCreatedTaskId,
        autoExpandTaskId: recentlyCreatedTaskId,
        createIntentId,
        onCreateTask: (payload) => {
          const created = createQuickTask(payload);
          recentlyCreatedTaskId = created?.id || null;
          ensureCreatedTaskVisible();
          refresh();
          return created;
        },
        onTaskUpdate: (taskId, updates) => {
          updateTask(taskId, updates);
          refresh();
        },
        onTaskDelete: (taskId) => {
          const result = deleteTask(taskId);
          if (!result.ok) {
            window?.showToast?.(result.reason);
            return;
          }
          if (String(recentlyCreatedTaskId) === String(taskId)) {
            recentlyCreatedTaskId = null;
          }
          refresh();
        },
        onTaskArchive: (taskId) => {
          archiveTask(taskId);
          if (String(recentlyCreatedTaskId) === String(taskId) && statusFilter === 'archived') {
            recentlyCreatedTaskId = taskId;
          }
          refresh();
        },
        onTaskStatusChange: handleStatusChange,
      }),
    ]));

    requestAnimationFrame(() => {
      const nextHeight = body.querySelector('#quick-tasks-sticky-filters')?.offsetHeight || 0;
      if (nextHeight !== stickyFiltersHeight) {
        stickyFiltersHeight = nextHeight;
        renderBody();
      }
    });
  };

  const renderAll = () => {
    renderHeader();
    renderBody();
  };

  renderAll();
}
