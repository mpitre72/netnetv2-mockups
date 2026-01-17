import { getMemberById, getTaskActualHours } from './quick-tasks-store.js';
import { escapeHtml, formatShortDate, renderAvatar, renderMiniMeters } from './quick-tasks-helpers.js';
import { getContactsData } from '../contacts/contacts-data.js';

function findCompanyName(id, companies) {
  const company = companies.find((item) => String(item.id) === String(id));
  return company?.name || '';
}

function findPersonName(id, companies) {
  if (!id) return '';
  for (const company of companies) {
    const match = (company.people || []).find((person) => String(person.id) === String(id));
    if (match) return match.name || '';
  }
  return '';
}

function renderClientLine(task, companies) {
  if (task.isInternal) {
    return '<span class="inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-700/60 dark:text-slate-100 dark:border-white/10">Internal</span>';
  }
  const companyName = task.companyId ? findCompanyName(task.companyId, companies) : '';
  const personName = task.personId ? findPersonName(task.personId, companies) : '';
  const companyLabel = escapeHtml(companyName || 'Client');
  const personLabel = personName ? `<span class="text-[11px] text-slate-400 dark:text-slate-500 truncate">${escapeHtml(personName)}</span>` : '';
  return `
    <div class="flex flex-col min-w-0">
      <span class="text-xs font-semibold text-slate-700 dark:text-slate-200 truncate">${companyLabel}</span>
      ${personLabel}
    </div>
  `;
}

function renderCardMenu(task, assignee, { hasTime }) {
  const isCompleted = task.status === 'completed';
  const markLabel = isCompleted ? 'Reopen' : 'Mark as Completed';
  const markAction = isCompleted ? 'reopen' : 'complete';
  const canArchive = isCompleted;
  const archiveAttrs = canArchive
    ? `data-qt-action="archive" data-task-id="${escapeHtml(task.id)}"`
    : 'aria-disabled="true" data-tooltip="Complete first to archive."';
  const archiveClasses = canArchive
    ? 'w-full text-left px-3 py-2 text-sm text-slate-700 dark:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-800'
    : 'w-full text-left px-3 py-2 text-sm text-slate-400 dark:text-white/40 cursor-not-allowed';
  const deleteDisabled = isCompleted || hasTime;
  const deleteTooltip = hasTime ? ' data-tooltip="Tasks with time cannot be deleted."' : '';
  const deleteAttrs = deleteDisabled
    ? `aria-disabled="true"${deleteTooltip}`
    : `data-qt-action="delete" data-task-id="${escapeHtml(task.id)}"`;
  const deleteClasses = deleteDisabled
    ? 'w-full text-left px-3 py-2 text-sm text-slate-400 dark:text-white/40 cursor-not-allowed'
    : 'w-full text-left px-3 py-2 text-sm text-red-600 hover:bg-slate-50 dark:hover:bg-slate-800';
  return `
    <div class="relative flex flex-col items-end gap-2">
      <button type="button" class="inline-flex h-7 w-7 items-center justify-center rounded-md text-slate-500 hover:text-slate-700 hover:bg-slate-100 dark:text-slate-400 dark:hover:text-slate-100 dark:hover:bg-slate-800 text-lg leading-none" aria-label="More options" data-qt-menu-button data-task-id="${escapeHtml(task.id)}" onkeydown="if(event.key==='Escape'){const menu=this.parentElement.querySelector('[data-qt-menu]');if(menu)menu.classList.add('hidden');}">
        ⋮
      </button>
      ${renderAvatar(assignee, { sizeClass: 'h-6 w-6', textClass: 'text-[9px]' })}
      <div class="contacts-action-menu hidden" data-qt-menu data-task-id="${escapeHtml(task.id)}">
        <button type="button" class="whitespace-nowrap" data-qt-action="open" data-task-id="${escapeHtml(task.id)}">Open</button>
        <button type="button" class="whitespace-nowrap" data-qt-action="${markAction}" data-task-id="${escapeHtml(task.id)}">${markLabel}</button>
        <button type="button" class="whitespace-nowrap" data-qt-action="promote" data-task-id="${escapeHtml(task.id)}">Promote to Job Task</button>
        <button type="button" class="${archiveClasses}" ${archiveAttrs}>Archive</button>
        <button type="button" class="${deleteClasses}" ${deleteAttrs}>Delete</button>
      </div>
    </div>
  `;
}

function renderCard(task, members, companies) {
  const assignee = getMemberById(task.assigneeUserId, members);
  const actual = getTaskActualHours(task);
  const hasTime = actual > 0 || (Array.isArray(task.timeEntries) && task.timeEntries.length > 0);
  return `
    <div class="group rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 p-3 shadow-sm transition-shadow hover:shadow-md">
      <div class="flex items-start gap-2">
        <div class="min-w-0 flex-1 space-y-2" data-qt-card data-task-id="${escapeHtml(task.id)}" data-task-status="${escapeHtml(task.status)}">
          <div class="flex items-start gap-2">
            <button type="button" class="mt-0.5 flex h-6 w-6 items-center justify-center rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-white/5" data-qt-card-handle draggable="true" aria-label="Drag task">
              <svg viewBox="0 0 24 24" class="h-4 w-4" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="8" cy="8" r="1"></circle>
                <circle cx="16" cy="8" r="1"></circle>
                <circle cx="8" cy="16" r="1"></circle>
                <circle cx="16" cy="16" r="1"></circle>
              </svg>
            </button>
            <div class="min-w-0 flex-1 space-y-1.5" data-qt-card-body>
              <div class="text-sm font-semibold text-slate-900 dark:text-white truncate">${escapeHtml(task.title || 'Untitled')}</div>
              ${renderClientLine(task, companies)}
              <div class="text-[11px] text-slate-500 dark:text-slate-400 truncate">Due ${formatShortDate(task.dueDate)}</div>
              <div class="pt-1">
                ${renderMiniMeters(task, actual)}
              </div>
            </div>
          </div>
        </div>
        ${renderCardMenu(task, assignee, { hasTime })}
      </div>
    </div>
  `;
}

function renderColumn(status, title, tasks, members, companies, { allowDrop = true, emptyTitle = 'No tasks yet', emptySubtext = '' } = {}) {
  const cards = tasks.map((task) => renderCard(task, members, companies)).join('');
  const bodyClass = allowDrop
    ? 'mt-4 flex-1 space-y-3 min-h-[140px] rounded-xl border border-dashed border-slate-200 dark:border-white/10 bg-white/60 dark:bg-slate-900/40 p-2 transition-colors'
    : 'mt-4 flex-1 space-y-3 min-h-[140px]';
  const bodyAttrs = allowDrop ? `data-qt-dropzone data-status="${escapeHtml(status)}"` : '';
  const emptyMarkup = `
    <div class="rounded-lg border border-dashed border-slate-200 dark:border-white/10 bg-white dark:bg-slate-950/40 px-3 py-4 text-xs text-slate-500 dark:text-white/50">
      <div class="text-xs font-semibold text-slate-700 dark:text-white/70">${emptyTitle}</div>
      ${emptySubtext ? `<div class="mt-1 text-[11px] text-slate-500 dark:text-white/40">${emptySubtext}</div>` : ''}
    </div>
  `;
  return `
    <div class="rounded-2xl border border-slate-200 dark:border-white/10 bg-white/70 dark:bg-slate-900/60 p-4 flex flex-col">
      <div class="flex items-center justify-between">
        <h3 class="text-sm font-semibold text-slate-900 dark:text-white">${title}</h3>
        <span class="min-w-[28px] rounded-full bg-slate-100 px-2 py-0.5 text-center text-[11px] font-semibold text-slate-600 dark:bg-white/10 dark:text-slate-200">${tasks.length}</span>
      </div>
      <div class="${bodyClass}" ${bodyAttrs}>
        ${cards || emptyMarkup}
      </div>
    </div>
  `;
}

export function renderQuickTasksKanban({ tasks = [], members = [], statusLens = 'active' }) {
  const companies = getContactsData();
  const today = new Date();
  const recentThreshold = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 7);
  const grouped = {
    backlog: [],
    in_progress: [],
    completed: [],
  };
  tasks.forEach((task) => {
    const key = grouped[task.status] ? task.status : 'backlog';
    grouped[key].push(task);
  });

  const renderBoardEmptyState = ({ title, body, actionLabel, actionKey }) => `
    <div class="rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-950/40 p-6 text-center">
      <h3 class="text-base font-semibold text-slate-900 dark:text-white">${title}</h3>
      <p class="mt-2 text-sm text-slate-500 dark:text-white/50">${body}</p>
      ${actionLabel ? `<button type="button" class="mt-4 inline-flex items-center justify-center rounded-md border border-slate-200 dark:border-white/10 px-4 py-2 text-sm font-semibold text-slate-700 dark:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-800" data-qt-empty-action="${actionKey}">${actionLabel}</button>` : ''}
    </div>
  `;

  if (statusLens === 'completed' && grouped.completed.length === 0) {
    return renderBoardEmptyState({
      title: 'No completed tasks yet',
      body: 'Complete a task to see it here.',
      actionLabel: 'View Active',
      actionKey: 'view-active',
    });
  }

  const columns = [];
  if (statusLens === 'completed') {
    columns.push(renderColumn('completed', 'Completed', grouped.completed, members, companies, {
      allowDrop: false,
      emptyTitle: 'No completed tasks',
    }));
  } else {
    columns.push(renderColumn('backlog', 'Backlog', grouped.backlog, members, companies, {
      allowDrop: true,
      emptyTitle: 'No backlog tasks',
      emptySubtext: "You're clear here.",
    }));
    columns.push(renderColumn('in_progress', 'In Progress', grouped.in_progress, members, companies, {
      allowDrop: true,
      emptyTitle: 'No in-progress tasks',
      emptySubtext: "You're clear here.",
    }));
    const recentCompleted = statusLens === 'active' ? grouped.completed.filter((task) => {
      if (!task.completedAt) return false;
      const date = new Date(task.completedAt);
      if (Number.isNaN(date.getTime())) return false;
      return date >= recentThreshold;
    }) : [];
    columns.push(renderColumn('completed', 'Completed', recentCompleted, members, companies, {
      allowDrop: true,
      emptyTitle: 'No recently completed tasks',
      emptySubtext: 'Completed tasks appear here for the most recent window.',
    }));

    if (grouped.backlog.length + grouped.in_progress.length + recentCompleted.length === 0) {
      return `
        <div class="space-y-4">
          ${renderBoardEmptyState({
            title: 'No quick tasks yet',
            body: 'Create your first Quick Task to start tracking real work outside of Jobs.',
            actionLabel: '+ New Quick Task',
            actionKey: 'new',
          })}
          <div class="grid grid-cols-1 gap-4 md:grid-cols-3" data-quick-tasks-kanban>
            ${columns.join('')}
          </div>
        </div>
      `;
    }
  }

  const gridCols = columns.length === 3 ? 'md:grid-cols-3' : columns.length > 1 ? 'md:grid-cols-2' : 'md:grid-cols-1';
  return `
    <div class="grid grid-cols-1 gap-4 ${gridCols}" data-quick-tasks-kanban>
      ${columns.join('')}
    </div>
  `;
}
