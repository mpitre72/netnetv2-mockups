import { getMemberById, getServiceTypeById, getTaskActualHours } from './quick-tasks-store.js';
import { escapeHtml, formatHours, renderAvatar, renderMiniMeters, renderStatusPill } from './quick-tasks-helpers.js';
import { getContactsData, getIndividualsData } from '../contacts/contacts-data.js';

function findCompanyById(id, companies) {
  return companies.find((company) => String(company.id) === String(id)) || null;
}

function findPersonById(id, companies, individuals) {
  if (!id) return null;
  for (const company of companies) {
    const match = (company.people || []).find((person) => String(person.id) === String(id));
    if (match) return { ...match, companyId: company.id, companyName: company.name };
  }
  const standalone = individuals.find((person) => String(person.id) === String(id));
  return standalone ? { ...standalone, companyId: null, companyName: '' } : null;
}

function renderClientCell(task, companies, individuals) {
  if (task.isInternal) {
    return '<span class="inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-700/60 dark:text-slate-100 dark:border-white/10">Internal</span>';
  }
  const company = task.companyId ? findCompanyById(task.companyId, companies) : null;
  const person = task.personId ? findPersonById(task.personId, companies, individuals) : null;
  const companyLabel = company?.name ? escapeHtml(company.name) : 'Client';
  const personLabel = person?.name ? escapeHtml(person.name) : '';
    return `
    <div class="flex flex-col">
      <span class="text-sm font-medium text-slate-900 dark:text-slate-100">${companyLabel}</span>
      ${personLabel ? `<span class="text-xs text-slate-500 dark:text-slate-400">${personLabel}</span>` : ''}
    </div>
  `;
}

function renderRowMenu(task, { canDelete, hasTime }) {
  const isCompleted = task.status === 'completed';
  const markLabel = isCompleted ? 'Reopen' : 'Mark as Completed';
  const markAction = isCompleted ? 'reopen' : 'complete';
  const canArchive = isCompleted;
  const archiveAttrs = canArchive
    ? `data-qt-action="archive" data-task-id="${escapeHtml(task.id)}"`
    : 'aria-disabled="true" data-tooltip="Complete first to archive."';
  const archiveClasses = canArchive
    ? 'w-full text-left px-3 py-2 text-sm text-slate-700 dark:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-800 whitespace-nowrap'
    : 'w-full text-left px-3 py-2 text-sm text-slate-400 dark:text-white/40 cursor-not-allowed whitespace-nowrap';
  const deleteDisabled = !canDelete;
  const deleteTooltip = hasTime ? ' data-tooltip="Tasks with time cannot be deleted."' : '';
  const deleteAttrs = deleteDisabled
    ? `aria-disabled="true"${deleteTooltip}`
    : `data-qt-action="delete" data-task-id="${escapeHtml(task.id)}"`;
  const deleteClasses = deleteDisabled
    ? 'w-full text-left px-3 py-2 text-sm text-slate-400 dark:text-white/40 cursor-not-allowed whitespace-nowrap'
    : 'w-full text-left px-3 py-2 text-sm text-red-600 hover:bg-slate-50 dark:hover:bg-slate-800 whitespace-nowrap';
  const deleteItem = `
    <button type="button" class="${deleteClasses}" ${deleteAttrs}>Delete</button>
  `;
  return `
    <div class="relative flex justify-center">
      <button type="button" class="inline-flex h-7 w-7 items-center justify-center rounded-md text-slate-500 hover:text-slate-700 hover:bg-slate-100 dark:text-slate-400 dark:hover:text-slate-100 dark:hover:bg-slate-800 text-lg leading-none" aria-label="More options" data-qt-menu-button data-task-id="${escapeHtml(task.id)}">
        ⋮
      </button>
      <div class="contacts-action-menu hidden" data-qt-menu data-task-id="${escapeHtml(task.id)}">
        <button type="button" class="whitespace-nowrap" data-qt-action="open" data-task-id="${escapeHtml(task.id)}">Open</button>
        <button type="button" class="whitespace-nowrap" data-qt-action="${markAction}" data-task-id="${escapeHtml(task.id)}">${markLabel}</button>
        <button type="button" class="whitespace-nowrap" data-qt-action="promote" data-task-id="${escapeHtml(task.id)}">Promote to Job Task</button>
        <button type="button" class="${archiveClasses}" ${archiveAttrs}>Archive</button>
        ${deleteItem}
      </div>
    </div>
  `;
}

export function renderQuickTasksList({ tasks = [], members = [], serviceTypes = [], canDeleteTask, statusFilter = 'all' }) {
  const companies = getContactsData();
  const individuals = getIndividualsData();

  if (!tasks.length) {
    const titleMap = {
      all: 'No quick tasks yet',
      backlog: 'No backlog quick tasks',
      in_progress: 'No in-progress quick tasks',
      completed: 'No completed tasks yet',
      archived: 'No archived quick tasks',
    };
    const bodyMap = {
      all: 'Create your first Quick Task to start tracking real work.',
      backlog: 'Move work here when you are ready to start.',
      in_progress: 'Start a task to see it here.',
      completed: 'Complete a task to see it here.',
      archived: 'Archived tasks appear here after archiving.',
    };
    const title = titleMap[statusFilter] || titleMap.all;
    const body = bodyMap[statusFilter] || bodyMap.all;
    const showAction = ['all', 'backlog', 'in_progress'].includes(statusFilter);
    return `
      <div class="rounded-2xl border border-slate-200 dark:border-white/10 bg-white/90 dark:bg-slate-900/70 shadow-sm overflow-hidden">
        <div class="overflow-x-auto">
          <table class="w-full text-left border-collapse">
            <thead class="bg-gray-50 dark:bg-gray-800/80 text-xs uppercase text-gray-500 dark:text-gray-400 font-semibold">
              <tr>
                <th class="px-6 py-3 border-b border-gray-200 dark:border-gray-700 w-[34%]">Task</th>
                <th class="px-6 py-3 border-b border-gray-200 dark:border-gray-700 w-[18%]">Client</th>
                <th class="px-6 py-3 border-b border-gray-200 dark:border-gray-700 w-[14%]">Service Type</th>
                <th class="px-6 py-3 border-b border-gray-200 dark:border-gray-700 text-right w-[7%]">LOE</th>
                <th class="px-6 py-3 border-b border-gray-200 dark:border-gray-700 w-[14%]">Meter</th>
                <th class="px-6 py-3 border-b border-gray-200 dark:border-gray-700 w-[9%]">Status</th>
                <th class="px-4 py-3 border-b border-gray-200 dark:border-gray-700 text-center w-[52px]">Assignee</th>
                <th class="px-4 py-3 border-b border-gray-200 dark:border-gray-700 text-center w-[52px]">Assignor</th>
                <th class="px-3 py-3 border-b border-gray-200 dark:border-gray-700 text-center w-[36px]"></th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td colspan="9" class="px-6 py-6 text-sm text-slate-500 dark:text-slate-400 text-center">
                  <div class="mx-auto max-w-md">
                    <div class="text-base font-semibold text-slate-900 dark:text-white">${title}</div>
                    <div class="mt-2 text-sm text-slate-500 dark:text-slate-400">${body}</div>
                    ${showAction ? '<button type="button" class="mt-4 inline-flex items-center justify-center rounded-md border border-slate-200 dark:border-white/10 px-4 py-2 text-sm font-semibold text-slate-700 dark:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-800" data-qt-list-action="new">+ New Quick Task</button>' : ''}
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    `;
  }

  const rows = tasks.map((task) => {
    const assignee = getMemberById(task.assigneeUserId, members);
    const assignor = getMemberById(task.assignorUserId, members);
    const serviceType = getServiceTypeById(task.serviceTypeId, serviceTypes);
    const actual = getTaskActualHours(task);
    const hasTime = actual > 0 || (Array.isArray(task.timeEntries) && task.timeEntries.length > 0);
    const canDelete = typeof canDeleteTask === 'function' ? canDeleteTask(task) : false;
    const title = escapeHtml(task.title || 'Untitled');
    const desc = task.description ? escapeHtml(task.description) : '';
    return `
      <tr class="hover:bg-gray-50 dark:hover:bg-gray-800/50 cursor-pointer" data-qt-row data-task-id="${escapeHtml(task.id)}">
        <td class="px-6 py-3 align-top">
          <div class="flex items-start justify-between gap-3">
            <div class="space-y-1">
              <div class="text-sm font-semibold text-slate-900 dark:text-gray-100">${title}</div>
              ${desc ? `<div class="text-xs text-slate-500 dark:text-slate-400 line-clamp-2">${desc}</div>` : ''}
            </div>
          </div>
        </td>
        <td class="px-6 py-3 align-top">${renderClientCell(task, companies, individuals)}</td>
        <td class="px-6 py-3 text-sm text-gray-600 dark:text-gray-400">${escapeHtml(serviceType?.name || 'Unassigned')}</td>
        <td class="px-6 py-3 text-sm text-gray-600 dark:text-gray-400 text-right tabular-nums">${formatHours(task.loeHours)}</td>
        <td class="px-6 py-3">${renderMiniMeters(task, actual)}</td>
        <td class="px-6 py-3">${renderStatusPill(task.status)}</td>
        <td class="px-4 py-3 text-center">${renderAvatar(assignee, { sizeClass: 'h-7 w-7', textClass: 'text-[10px]' })}</td>
        <td class="px-4 py-3 text-center">${renderAvatar(assignor, { sizeClass: 'h-7 w-7', textClass: 'text-[10px]' })}</td>
        <td class="px-3 py-3 text-center">${renderRowMenu(task, { canDelete, hasTime })}</td>
      </tr>
    `;
  }).join('');

  return `
    <div class="rounded-2xl border border-slate-200 dark:border-white/10 bg-white/90 dark:bg-slate-900/70 shadow-sm overflow-hidden">
      <div class="overflow-x-auto">
        <table class="w-full text-left border-collapse">
          <thead class="bg-gray-50 dark:bg-gray-800/80 text-xs uppercase text-gray-500 dark:text-gray-400 font-semibold">
            <tr>
              <th class="px-6 py-3 border-b border-gray-200 dark:border-gray-700 w-[34%]">Task</th>
              <th class="px-6 py-3 border-b border-gray-200 dark:border-gray-700 w-[18%]">Client</th>
              <th class="px-6 py-3 border-b border-gray-200 dark:border-gray-700 w-[14%]">Service Type</th>
              <th class="px-6 py-3 border-b border-gray-200 dark:border-gray-700 text-right w-[7%]">LOE</th>
              <th class="px-6 py-3 border-b border-gray-200 dark:border-gray-700 w-[14%]">Meter</th>
              <th class="px-6 py-3 border-b border-gray-200 dark:border-gray-700 w-[9%]">Status</th>
              <th class="px-4 py-3 border-b border-gray-200 dark:border-gray-700 text-center w-[52px]">Assignee</th>
              <th class="px-4 py-3 border-b border-gray-200 dark:border-gray-700 text-center w-[52px]">Assignor</th>
              <th class="px-3 py-3 border-b border-gray-200 dark:border-gray-700 text-center w-[36px]"></th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-100 dark:divide-gray-800">
            ${rows}
          </tbody>
        </table>
      </div>
    </div>
  `;
}
