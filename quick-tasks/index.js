import { SectionHeader } from '../components/layout/SectionHeader.js';
import { loadQuickTasks, archiveTask, canDeleteTask, deleteTask, promoteToJobTask, setTaskStatus, loadTeamMembers, loadServiceTypes, getTaskById } from './quick-tasks-store.js';
import { renderQuickTasksList } from './quick-tasks-list.js';
import { renderQuickTasksKanban } from './quick-tasks-kanban.js';
import { getQuickTasksUIState, setQuickTasksFilters, setQuickTasksView } from './quick-tasks-ui-state.js';
import { openCompletionDateModal, openPromoteToJobTaskModal, openQuickTaskDrawer, showMovedToJobModal } from './quick-task-detail.js';

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
    if (statusFilter === 'archived') return !!task.isArchived;
    if (task.isArchived) return false;
    if (statusFilter === 'backlog' && task.status !== 'backlog') return false;
    if (statusFilter === 'in_progress' && task.status !== 'in_progress') return false;
    if (statusFilter === 'completed' && task.status !== 'completed') return false;

    if (uiState.assignee && uiState.assignee !== 'all' && String(task.assigneeUserId) !== String(uiState.assignee)) {
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
  return [...tasks].sort((a, b) => {
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

  let uiState = getQuickTasksUIState();
  let statusFilter = uiState.statusLens === 'archived' ? 'archived' : uiState.statusLens === 'completed' ? 'completed' : 'all';
  let tasks = loadQuickTasks();
  let kanbanEventsBound = false;

  const openNewTask = () => {
    openQuickTaskDrawer({
      mode: 'create',
      onCreated: () => {
        tasks = loadQuickTasks();
        renderAll();
      },
    });
  };

  const renderHeader = () => {
    const members = loadTeamMembers();
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
      onChange: (e) => {
        uiState = setQuickTasksFilters({ assignee: e.target.value });
        renderAll();
      },
    }, memberOptions);

    const dueFilter = h('select', {
      className: 'h-10 rounded-md border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 px-3 text-sm',
      value: uiState.duePreset || 'all',
      onChange: (e) => {
        uiState = setQuickTasksFilters({ duePreset: e.target.value });
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
      onClick: openNewTask,
    }, '+ New Quick Task');

    const breadcrumb = h('div', { className: 'flex items-center gap-2' }, [
      h('span', { className: 'text-sm text-slate-500 dark:text-white/70' }, 'Tasks'),
      h('span', { className: 'text-slate-400 dark:text-white/50' }, '›'),
      h('span', { className: 'text-2xl font-semibold text-slate-900 dark:text-white' }, 'Quick Tasks'),
    ]);

    const switcher = h('div', { className: 'inline-flex items-center gap-1 rounded-full border border-slate-300 dark:border-white/10 bg-slate-50 dark:bg-slate-800 px-1 py-1' }, [
      ['list', 'List'],
      ['kanban', 'Kanban'],
    ].map(([value, label]) => h('button', {
      key: value,
      type: 'button',
      className: [
        'px-3 py-1 rounded-full text-sm font-medium transition-colors border',
        uiState.view === value
          ? 'bg-[var(--color-brand-purple,#711FFF)] text-white shadow-sm border-transparent'
          : 'text-slate-600 dark:text-slate-300 border-transparent hover:bg-slate-100 dark:hover:bg-white/10',
      ].join(' '),
      onClick: () => {
        uiState = setQuickTasksView(value);
        renderAll();
      },
    }, label)));

    const searchBox = h('div', { className: 'flex-1 min-w-[220px]' }, [
      h('input', {
        type: 'search',
        defaultValue: uiState.search || '',
        placeholder: 'Search quick tasks...',
        onInput: (e) => {
          const next = (e.target?.value || '').toString();
          uiState = setQuickTasksFilters({ search: next });
          renderBody();
        },
        className: 'w-full rounded-lg border border-slate-300 dark:border-white/10 bg-white dark:bg-slate-900 px-3 py-2 text-sm text-slate-800 dark:text-white shadow-inner focus:outline-none focus:ring-2 focus:ring-netnet-purple',
      }),
    ]);

    const controlBar = h('div', { className: 'flex w-full flex-wrap items-center gap-2' }, [
      statusLens,
      assigneeFilter,
      dueFilter,
      switcher,
      searchBox,
      newBtn,
    ]);

    headerRoot.render(h(React.Fragment, null, [
      h(SectionHeader, {
        title: breadcrumb,
        showHelpIcon: true,
        showSecondaryRow: false,
        className: 'mb-1',
      }),
      controlBar,
    ]));
  };

  const bindKanbanEmptyActions = () => {
    if (!body) return;
    const newBtn = body.querySelector('[data-qt-empty-action="new"]');
    if (newBtn) {
      newBtn.addEventListener('click', openNewTask);
    }
    const viewActive = body.querySelector('[data-qt-empty-action="view-active"]');
    if (viewActive) {
      viewActive.addEventListener('click', () => {
        statusFilter = 'all';
        uiState = setQuickTasksFilters({ statusLens: 'active' });
        renderAll();
      });
    }
  };

  const renderBody = () => {
    if (!body) return;
    const members = loadTeamMembers();
    const serviceTypes = loadServiceTypes().filter((type) => type.active);
    const filtered = sortTasks(filterTasks(tasks, uiState, { statusFilter }));
    if (uiState.view === 'kanban') {
      if (statusFilter === 'archived') {
        body.innerHTML = `
          <div class="rounded-2xl border border-slate-200 dark:border-white/10 bg-white/90 dark:bg-slate-900/70 p-6 shadow-sm">
            <h3 class="text-base font-semibold text-slate-900 dark:text-white">Archived</h3>
            <p class="mt-2 text-sm text-slate-500 dark:text-slate-400">Archived tasks are shown in List view.</p>
            <button type="button" id="qtSwitchToList" class="mt-4 inline-flex items-center justify-center rounded-md border border-slate-200 dark:border-white/10 px-4 py-2 text-sm font-semibold text-slate-700 dark:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-800">Switch to List</button>
          </div>
        `;
        body.querySelector('#qtSwitchToList')?.addEventListener('click', () => {
          uiState = setQuickTasksView('list');
          renderAll();
        });
        return;
      }
      const today = new Date();
      const todayIso = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
      const kanbanTasks = filtered.map((task) => {
        if (task.status !== 'completed') return task;
        if (statusFilter === 'all' || statusFilter === 'completed') {
          return { ...task, completedAt: todayIso };
        }
        return task;
      });
      body.innerHTML = renderQuickTasksKanban({ tasks: kanbanTasks, members, statusLens: 'active' });
      bindKanbanEmptyActions();
    } else {
      body.innerHTML = renderQuickTasksList({
        tasks: filtered,
        members,
        serviceTypes,
        canDeleteTask,
        statusFilter,
      });
      const listNewBtn = body.querySelector('[data-qt-list-action="new"]');
      if (listNewBtn) listNewBtn.addEventListener('click', openNewTask);
    }
  };

  const refresh = () => {
    tasks = loadQuickTasks();
    renderAll();
  };

  const handleStatusChange = (taskId, status, originStatus) => {
    if (!taskId) return;
    if (status === 'completed') {
      openCompletionDateModal({
        onConfirm: (date) => {
          setTaskStatus(taskId, 'completed', { completedAt: date });
          refresh();
        },
        onCancel: () => {
          if (originStatus && originStatus !== 'completed') {
            setTaskStatus(taskId, originStatus);
          }
          refresh();
        },
      });
      return;
    }
    setTaskStatus(taskId, status);
    refresh();
  };

  const bindListEvents = () => {
    if (!body) return;
    body.onclick = (event) => {
      const target = event.target;
      const menuBtn = target.closest?.('[data-qt-menu-button]');
      if (menuBtn) {
        event.stopPropagation();
        const taskId = menuBtn.getAttribute('data-task-id');
        body.querySelectorAll('[data-qt-menu]').forEach((menu) => {
          if (menu.getAttribute('data-task-id') === taskId) {
            menu.classList.toggle('hidden');
          } else {
            menu.classList.add('hidden');
          }
        });
        return;
      }
      const menuItem = target.closest?.('[data-qt-action]');
      if (menuItem) {
        event.stopPropagation();
        const action = menuItem.getAttribute('data-qt-action');
        const taskId = menuItem.getAttribute('data-task-id');
        body.querySelectorAll('[data-qt-menu]').forEach((menu) => menu.classList.add('hidden'));
        const task = getTaskById(taskId);
        if (!task) return;
        if (action === 'open') {
          openQuickTaskDrawer({
            mode: 'edit',
            taskId,
            onUpdated: refresh,
            onDeleted: refresh,
          });
          return;
        }
        if (action === 'complete') {
          handleStatusChange(taskId, 'completed');
          return;
        }
        if (action === 'reopen') {
          handleStatusChange(taskId, 'backlog');
          return;
        }
        if (action === 'archive') {
          archiveTask(taskId);
          refresh();
          return;
        }
        if (action === 'delete') {
          const result = deleteTask(taskId);
          if (!result.ok) {
            window?.showToast?.(result.reason);
            return;
          }
          refresh();
          return;
        }
        if (action === 'promote') {
          const serviceTypes = loadServiceTypes().filter((type) => type.active);
          openPromoteToJobTaskModal({
            task,
            serviceTypes,
            onConfirm: ({ jobId, deliverableId, serviceTypeId }) => {
              promoteToJobTask(taskId, { jobId, deliverableId, serviceTypeId });
              refresh();
              showMovedToJobModal();
            },
          });
        }
        return;
      }
      const menuWrap = target.closest?.('[data-qt-menu]');
      if (menuWrap) {
        event.stopPropagation();
        return;
      }
      const row = target.closest?.('[data-qt-row]');
      if (row) {
        const taskId = row.getAttribute('data-task-id');
        openQuickTaskDrawer({
          mode: 'edit',
          taskId,
          onUpdated: refresh,
          onDeleted: refresh,
        });
      }
    };
  };

  const bindKanbanEvents = () => {
    if (!body || kanbanEventsBound) return;
    kanbanEventsBound = true;
    let dragMeta = null;
    body.addEventListener('dragstart', (event) => {
      const handle = event.target.closest?.('[data-qt-card-handle]');
      if (!handle) return;
      const card = event.target.closest?.('[data-qt-card]');
      if (!card) return;
      dragMeta = {
        id: card.getAttribute('data-task-id') || '',
        status: card.getAttribute('data-task-status') || '',
      };
      event.dataTransfer?.setData('text/plain', dragMeta.id);
      event.dataTransfer.effectAllowed = 'move';
      card.classList.add('opacity-60');
    });
    body.addEventListener('dragend', (event) => {
      const card = event.target.closest?.('[data-qt-card]');
      if (card) card.classList.remove('opacity-60');
      dragMeta = null;
      body.querySelectorAll('[data-qt-dropzone]').forEach((zone) => {
        zone.classList.remove('ring-2', 'ring-netnet-purple/40', 'border-netnet-purple/40', 'bg-netnet-purple/5');
      });
    });
    body.addEventListener('dragover', (event) => {
      const dropzone = event.target.closest?.('[data-qt-dropzone]');
      if (!dropzone) return;
      event.preventDefault();
      dropzone.classList.add('ring-2', 'ring-netnet-purple/40', 'border-netnet-purple/40', 'bg-netnet-purple/5');
    });
    body.addEventListener('dragleave', (event) => {
      const dropzone = event.target.closest?.('[data-qt-dropzone]');
      if (!dropzone) return;
      dropzone.classList.remove('ring-2', 'ring-netnet-purple/40', 'border-netnet-purple/40', 'bg-netnet-purple/5');
    });
    body.addEventListener('drop', (event) => {
      const dropzone = event.target.closest?.('[data-qt-dropzone]');
      if (!dropzone) return;
      event.preventDefault();
      dropzone.classList.remove('ring-2', 'ring-netnet-purple/40', 'border-netnet-purple/40', 'bg-netnet-purple/5');
      const taskId = event.dataTransfer?.getData('text/plain') || dragMeta?.id;
      const status = dropzone.getAttribute('data-status');
      handleStatusChange(taskId, status, dragMeta?.status || '');
    });
    body.addEventListener('click', (event) => {
      if (event.target.closest?.('[data-qt-card-handle]')) {
        event.stopPropagation();
        return;
      }
      const card = event.target.closest?.('[data-qt-card]');
      if (!card) return;
      const taskId = card.getAttribute('data-task-id');
      openQuickTaskDrawer({
        mode: 'edit',
        taskId,
        onUpdated: refresh,
        onDeleted: refresh,
      });
    });
  };

  const renderAll = () => {
    renderHeader();
    renderBody();
    bindListEvents();
    if (uiState.view === 'kanban') bindKanbanEvents();
  };

  document.addEventListener('click', (event) => {
    if (!body) return;
    const insideMenu = event.target.closest?.('[data-qt-menu]');
    const menuBtn = event.target.closest?.('[data-qt-menu-button]');
    if (!insideMenu && !menuBtn) {
      body.querySelectorAll('[data-qt-menu]').forEach((menu) => menu.classList.add('hidden'));
    }
  });

  renderAll();
}
