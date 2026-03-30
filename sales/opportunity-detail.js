import { SectionHeader } from '../components/layout/SectionHeader.js';
import { mountSectionPageShell } from '../components/layout/section-page-shell.js';
import { TextInput } from '../components/forms/text-input.js';
import { SelectInput } from '../components/forms/select-input.js';
import { PrimaryButton } from '../components/buttons/primary-button.js';
import { renderContactsActivityFeed } from '../contacts/contacts-activity-feed.js';
import { loadTeamMembers } from '../quick-tasks/quick-tasks-store.js';
import { renderAvatar, getDisplayName } from '../quick-tasks/quick-tasks-helpers.js';
import {
  getMockSalesOpportunity,
  mockSalesJobOptions,
  prepareMockSalesOpportunity,
  saveMockSalesOpportunity,
} from '../data/mock-sales.js';

const { createElement: h, useEffect, useMemo, useRef, useState } = React;
const { createRoot } = ReactDOM;

const REFERENCE_DATE_ISO = '2026-03-29';
const CARD_CLASS = 'bg-white dark:bg-gray-800 rounded-xl shadow border border-gray-200 dark:border-gray-700';
const DETAIL_STATUS_OPTIONS = [
  { value: 'open', label: 'Open' },
  { value: 'on-hold', label: 'On Hold' },
  { value: 'won', label: 'Won' },
  { value: 'lost', label: 'Lost' },
];

function cloneOpportunity(opportunity) {
  return JSON.parse(JSON.stringify(opportunity || null));
}

function parseLocalDate(dateStr) {
  if (!dateStr) return null;
  const parts = String(dateStr).split('-').map((part) => Number(part));
  if (parts.length !== 3 || parts.some((value) => Number.isNaN(value))) return null;
  return new Date(parts[0], parts[1] - 1, parts[2]);
}

function formatDateLabel(dateStr) {
  const date = parseLocalDate(dateStr);
  if (!date) return '-';
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatShortDate(dateStr) {
  const date = parseLocalDate(dateStr);
  if (!date) return '-';
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function parseCurrencyValue(raw) {
  const cleaned = String(raw || '').replace(/[^0-9.-]/g, '');
  if (!cleaned) return null;
  const value = Number(cleaned);
  return Number.isFinite(value) ? value : null;
}

function moneyValuesEqual(left, right) {
  const leftNumeric = parseCurrencyValue(left);
  const rightNumeric = parseCurrencyValue(right);
  if (leftNumeric !== null || rightNumeric !== null) {
    return leftNumeric === rightNumeric;
  }
  return String(left || '').trim() === String(right || '').trim();
}

function formatStatusValue(status) {
  if (status === 'on-hold') return 'On Hold';
  if (status === 'won') return 'Won';
  if (status === 'lost') return 'Lost';
  return 'Open';
}

function formatClarityValue(clarity) {
  if (clarity === 'clear') return 'Clear';
  if (clarity === 'emerging') return 'Emerging';
  return 'Fog';
}

function buildTimestampMeta(date = new Date()) {
  return {
    date: isoDateFromDate(date),
    sortDate: date.toISOString(),
    timestampLabel: new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    }).format(date),
  };
}

function isoDateFromDate(date) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function addDays(dateStr, days) {
  const date = parseLocalDate(dateStr);
  if (!date) return '';
  date.setDate(date.getDate() + days);
  return isoDateFromDate(date);
}

function subtractDays(dateStr, days) {
  return addDays(dateStr, -days);
}

function normalizeTask(task) {
  if (!task) return task;
  if (task.status === 'completed') return task;
  const reference = parseLocalDate(REFERENCE_DATE_ISO);
  const startDate = parseLocalDate(task.startDate);
  if (task.status === 'backlog' && startDate && reference && startDate.getTime() <= reference.getTime()) {
    return { ...task, status: 'in_progress' };
  }
  return task;
}

function normalizeOpportunity(opportunity) {
  return {
    ...opportunity,
    tasks: (opportunity.tasks || []).map((task) => normalizeTask(task)),
  };
}

function getStatusTone(status) {
  if (status === 'completed') {
    return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-200';
  }
  if (status === 'in_progress') {
    return 'bg-netnet-purple/15 text-netnet-purple dark:bg-netnet-purple/20 dark:text-netnet-purple';
  }
  return 'bg-slate-100 text-slate-700 dark:bg-slate-700/60 dark:text-slate-200';
}

function getStatusLabel(status) {
  if (status === 'in_progress') return 'In Progress';
  if (status === 'completed') return 'Completed';
  return 'Backlog';
}

function renderAvatarHtml(member) {
  if (!member) return h('span', { className: 'text-xs text-slate-400 dark:text-slate-500' }, '-');
  return h('div', {
    dangerouslySetInnerHTML: {
      __html: renderAvatar(member, { sizeClass: 'h-7 w-7', textClass: 'text-[10px]' }),
    },
  });
}

function DetailField({ label, value }) {
  return h('div', { className: 'space-y-1 min-w-0' }, [
    h('div', { className: 'text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400' }, label),
    typeof value === 'string'
      ? h('div', { className: 'text-sm font-medium text-slate-900 dark:text-white min-h-[20px]' }, value)
      : h('div', { className: 'min-h-[20px]' }, value),
  ]);
}

function buildSystemActivity(title, text) {
  return {
    type: 'system',
    title,
    text,
    ...buildTimestampMeta(),
  };
}

function buildNoteActivity(text) {
  return {
    type: 'note',
    text,
    user: 'Me',
    ...buildTimestampMeta(),
  };
}

function serializeOpportunity(opportunity) {
  return {
    id: opportunity.id,
    name: opportunity.name,
    company: opportunity.company,
    person: opportunity.person,
    ownerId: opportunity.ownerId,
    status: opportunity.status,
    type: opportunity.type,
    description: opportunity.description || '',
    estimatedStartDate: opportunity.estimatedStartDate,
    estimatedCompletionDate: opportunity.estimatedCompletionDate,
    linkedJobIds: (opportunity.linkedJobs || []).map((job) => String(job.id)),
    tasks: opportunity.tasks || [],
    activities: opportunity.activities || [],
    financial: {
      project: {
        budget: opportunity.value?.project?.budget || '',
        overrideValue: opportunity.value?.project?.overrideValue || '',
      },
      retainer: {
        monthlyValue: opportunity.value?.retainer?.monthlyValue || '',
        durationType: opportunity.value?.retainer?.durationType || 'ongoing',
        durationMonths: opportunity.value?.retainer?.durationMonths || 12,
        overrideMonthly: opportunity.value?.retainer?.overrideMonthly || '',
      },
    },
  };
}

function describeValueState(opportunity) {
  const project = opportunity?.value?.project || null;
  const retainer = opportunity?.value?.retainer || null;
  const parts = [];
  if (project && (project.baseValue || project.effectiveValue)) {
    parts.push(`Project ${project.effectiveValue || project.baseValue || '-'}`);
  }
  if (retainer && (retainer.effectiveMonthly || retainer.baseMonthly)) {
    parts.push(`Retainer ${retainer.effectiveMonthly || retainer.baseMonthly || '-'}`);
  }
  if (retainer?.reportedTotal) {
    parts.push(retainer.reportedTotal);
  }
  return parts.join(' | ');
}

function buildValueChangedEntry(previous, next) {
  const previousParts = [
    previous?.value?.project?.baseValue || '',
    previous?.value?.project?.effectiveValue || '',
    previous?.value?.retainer?.baseMonthly || '',
    previous?.value?.retainer?.effectiveMonthly || '',
    previous?.value?.retainer?.reportedTotal || '',
  ].join('|');
  const nextParts = [
    next?.value?.project?.baseValue || '',
    next?.value?.project?.effectiveValue || '',
    next?.value?.retainer?.baseMonthly || '',
    next?.value?.retainer?.effectiveMonthly || '',
    next?.value?.retainer?.reportedTotal || '',
  ].join('|');
  if (previousParts === nextParts) return null;
  return buildSystemActivity('Opportunity value updated', describeValueState(next));
}

function buildOverrideChangedEntry(label, previousValue, nextValue) {
  if ((previousValue || '') === (nextValue || '')) return null;
  if (nextValue) {
    return buildSystemActivity('Value override updated', `${label} override set to ${nextValue}.`);
  }
  return buildSystemActivity('Value override updated', `${label} override removed.`);
}

function SummaryCard({ opportunity, owner, onStatusChange }) {
  return h('section', { className: `${CARD_CLASS} p-6 space-y-5` }, [
    h('div', { className: 'space-y-1' }, [
      h('div', { className: 'text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400' }, 'Opportunity Summary'),
      h('h1', { className: 'text-2xl font-bold text-slate-900 dark:text-white' }, opportunity.name),
    ]),
    h('div', { className: 'grid grid-cols-1 gap-4 md:grid-cols-2' }, [
      h(DetailField, { label: 'Type', value: opportunity.type === 'both' ? 'Both' : opportunity.type === 'project' ? 'Project' : 'Retainer' }),
      h(DetailField, { label: 'Company / Person', value: `${opportunity.company}${opportunity.person ? ` / ${opportunity.person}` : ''}` }),
      h(DetailField, {
        label: 'Owner',
        value: h('div', { className: 'flex items-center gap-2 min-w-0' }, [
          renderAvatarHtml(owner),
          h('span', { className: 'truncate text-sm font-medium text-slate-900 dark:text-white' }, owner ? getDisplayName(owner) : '-'),
        ]),
      }),
      h(DetailField, {
        label: 'Status',
        value: h('div', { className: 'max-w-[180px]' }, [
          h(SelectInput, {
            id: 'opportunity-detail-status',
            value: opportunity.status,
            onChange: (event) => onStatusChange(event.target.value),
            options: DETAIL_STATUS_OPTIONS,
            className: '!h-10 !bg-white !text-slate-700 !border-slate-200 dark:!bg-slate-900 dark:!text-slate-200 dark:!border-white/10',
          }),
        ]),
      }),
      h(DetailField, { label: 'Clarity', value: formatClarityValue(opportunity.clarity) }),
      h(DetailField, { label: 'Estimated Start Date', value: formatDateLabel(opportunity.estimatedStartDate) }),
      h(DetailField, { label: 'Estimated Completion Date', value: formatDateLabel(opportunity.estimatedCompletionDate) }),
    ]),
  ]);
}

function ValueSection({ title, rows }) {
  return h('div', { className: 'space-y-3' }, [
    h('div', { className: 'text-sm font-semibold text-slate-900 dark:text-white' }, title),
    h('div', { className: 'grid grid-cols-1 gap-3 md:grid-cols-2' }, rows.map((row) => h('div', {
      key: row.label,
      className: `rounded-lg border border-slate-200 dark:border-gray-700 bg-slate-50/80 dark:bg-slate-900/40 px-4 py-3 ${row.className || ''}`.trim(),
    }, [
      h('div', { className: 'flex items-center gap-2' }, [
        h('div', { className: 'text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400' }, row.label),
        row.badge ? h('span', { className: 'text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400' }, row.badge) : null,
      ]),
      h('div', { className: `mt-2 text-base font-semibold text-slate-900 dark:text-white ${row.primaryClassName || ''}`.trim() }, row.primary),
      row.secondary ? h('div', { className: `mt-1 text-sm text-slate-500 dark:text-slate-400 ${row.secondaryClassName || ''}`.trim() }, row.secondary) : null,
    ]))),
  ]);
}

function ValueBlock({
  opportunity,
  onProjectOverrideChange,
  onRetainerOverrideChange,
}) {
  const [projectOverrideDraft, setProjectOverrideDraft] = useState(opportunity.value?.project?.overrideValue || '');
  const [retainerOverrideDraft, setRetainerOverrideDraft] = useState(opportunity.value?.retainer?.overrideMonthly || '');

  useEffect(() => {
    setProjectOverrideDraft(opportunity.value?.project?.overrideValue || '');
  }, [opportunity.id, opportunity.value?.project?.overrideValue]);

  useEffect(() => {
    setRetainerOverrideDraft(opportunity.value?.retainer?.overrideMonthly || '');
  }, [opportunity.id, opportunity.value?.retainer?.overrideMonthly]);

  const sections = [];
  if (opportunity.value?.project) {
    sections.push(h(ValueSection, {
      key: 'project',
      title: 'Project',
      rows: [
        { label: 'Budget', primary: opportunity.value.project.budget || '-', secondary: 'Fallback when no base value or override exists' },
        { label: 'Base Value', primary: opportunity.value.project.baseValue || '-', secondary: `${opportunity.linkedJobsCount || 0} linked job${opportunity.linkedJobsCount === 1 ? '' : 's'}`, primaryClassName: 'text-sm font-medium text-slate-600 dark:text-slate-300 opacity-85', secondaryClassName: 'opacity-75' },
        {
          label: 'Override',
          badge: 'Optional',
          primary: h('div', { className: 'flex flex-wrap items-center gap-2' }, [
            h('div', { className: 'min-w-[180px] flex-1' }, [
              h(TextInput, {
                id: 'project-override-inline',
                value: projectOverrideDraft,
                onChange: (event) => setProjectOverrideDraft(event.target.value),
                onBlur: () => onProjectOverrideChange(projectOverrideDraft),
                placeholder: '$25,000',
                className: '!bg-white !text-slate-700 !border-slate-200 dark:!bg-slate-900 dark:!text-slate-200 dark:!border-white/10',
              }),
            ]),
            h('button', {
              type: 'button',
              className: 'inline-flex h-10 items-center justify-center rounded-md border border-slate-200 dark:border-gray-700 px-3 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800',
              onClick: () => {
                setProjectOverrideDraft('');
                onProjectOverrideChange('');
              },
            }, 'Clear'),
          ]),
          secondary: opportunity.value.project.overrideValue
            ? `${opportunity.value.project.baseValue || opportunity.value.project.budget || '-'} fallback`
            : 'Leave blank to use the derived fallback automatically',
          secondaryClassName: 'opacity-75',
        },
        {
          label: 'Effective Value',
          primary: opportunity.value.project.effectiveValue || '-',
          primaryClassName: 'text-xl font-bold tracking-[-0.01em]',
          secondary: opportunity.value.project.overrideValue
            ? `${opportunity.value.project.baseValue || opportunity.value.project.budget || '-'} base`
            : opportunity.value.project.baseValue
              ? `${opportunity.value.project.baseValue} base`
              : opportunity.value.project.budget
                ? `${opportunity.value.project.budget} budget`
                : 'No project value yet',
        },
      ],
    }));
  }
  if (opportunity.value?.retainer) {
    sections.push(h(ValueSection, {
      key: 'retainer',
      title: 'Retainer',
      rows: [
        { label: 'Monthly Value', primary: opportunity.value.retainer.monthlyValue || '-', secondary: 'Fallback when no base monthly or override exists' },
        { label: 'Base Monthly', primary: opportunity.value.retainer.baseMonthly || '-', secondary: `${opportunity.linkedJobsCount || 0} linked job${opportunity.linkedJobsCount === 1 ? '' : 's'}`, primaryClassName: 'text-sm font-medium text-slate-600 dark:text-slate-300 opacity-85', secondaryClassName: 'opacity-75' },
        {
          label: 'Duration',
          primary: opportunity.value.retainer.durationType === 'fixed'
            ? `${opportunity.value.retainer.durationMonths} months`
            : 'Ongoing',
          secondary: opportunity.value.retainer.durationType === 'fixed' ? 'Fixed term total' : 'Reported as 12 months',
        },
        {
          label: 'Override Monthly',
          badge: 'Optional',
          primary: h('div', { className: 'flex flex-wrap items-center gap-2' }, [
            h('div', { className: 'min-w-[180px] flex-1' }, [
              h(TextInput, {
                id: 'retainer-override-inline',
                value: retainerOverrideDraft,
                onChange: (event) => setRetainerOverrideDraft(event.target.value),
                onBlur: () => onRetainerOverrideChange(retainerOverrideDraft),
                placeholder: '$5,000/mo',
                className: '!bg-white !text-slate-700 !border-slate-200 dark:!bg-slate-900 dark:!text-slate-200 dark:!border-white/10',
              }),
            ]),
            h('button', {
              type: 'button',
              className: 'inline-flex h-10 items-center justify-center rounded-md border border-slate-200 dark:border-gray-700 px-3 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800',
              onClick: () => {
                setRetainerOverrideDraft('');
                onRetainerOverrideChange('');
              },
            }, 'Clear'),
          ]),
          secondary: opportunity.value.retainer.overrideMonthly
            ? `${opportunity.value.retainer.baseMonthly || opportunity.value.retainer.monthlyValue || '-'} fallback`
            : 'Leave blank to use the derived fallback automatically',
          secondaryClassName: 'opacity-75',
        },
        {
          label: 'Effective Monthly',
          primary: opportunity.value.retainer.effectiveMonthly || '-',
          primaryClassName: 'text-xl font-bold tracking-[-0.01em]',
          secondary: opportunity.value.retainer.overrideMonthly
            ? `${opportunity.value.retainer.baseMonthly || opportunity.value.retainer.monthlyValue || '-'} base`
            : opportunity.value.retainer.baseMonthly
              ? `${opportunity.value.retainer.baseMonthly} base`
              : opportunity.value.retainer.monthlyValue
                ? `${opportunity.value.retainer.monthlyValue} input`
                : 'No retainer value yet',
        },
        { label: 'Total Value', primary: opportunity.value.retainer.reportedTotal || '-', secondary: 'Effective monthly x duration', primaryClassName: 'text-base font-semibold opacity-90' },
      ],
    }));
  }

  return h('section', { className: `${CARD_CLASS} p-6 space-y-5` }, [
    h('div', { className: 'text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400' }, 'Value'),
    ...sections,
  ]);
}

function LinkedJobsBlock({ linkedJobs = [], onAddJob, onRemoveJob }) {
  return h('section', { className: `${CARD_CLASS} p-6 space-y-4` }, [
    h('div', { className: 'flex items-center justify-between gap-3' }, [
      h('div', { className: 'text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400' }, 'Linked Jobs'),
      h('button', {
        type: 'button',
        className: 'inline-flex h-8 items-center justify-center rounded-md border border-slate-200 dark:border-gray-700 px-3 text-sm font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800',
        onClick: onAddJob,
      }, '+ Add Job'),
    ]),
    h('div', { className: 'space-y-2.5' }, linkedJobs.length
      ? linkedJobs.map((job) => h('div', {
      key: job.id,
      className: 'flex items-center justify-between gap-3 rounded-lg border border-slate-200 dark:border-gray-700 bg-slate-50/80 dark:bg-slate-900/40 px-4 py-2 hover:bg-slate-100/95 dark:hover:bg-slate-800/65 transition-colors',
    }, [
      h('div', { className: 'min-w-0 flex-1 space-y-1' }, [
        h('div', { className: 'flex flex-wrap items-center gap-2 text-sm font-semibold text-slate-900 dark:text-white' }, [
          h('span', null, job.jobNumber),
          h('span', { className: 'text-slate-400 dark:text-slate-500' }, '|'),
          h('span', { className: 'truncate' }, job.name),
        ]),
        h('div', { className: 'inline-flex rounded-full bg-slate-200/80 px-2 py-0.5 text-[11px] font-semibold text-slate-700 dark:bg-slate-700/70 dark:text-slate-200' }, job.status),
      ]),
      h('button', {
        type: 'button',
        className: 'inline-flex h-8 min-w-[72px] flex-none items-center justify-center self-center rounded-md border border-slate-200 dark:border-gray-700 px-3 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800',
        onClick: () => onRemoveJob(job.id),
      }, 'Remove'),
    ]))
      : [
        h('div', {
          key: 'empty',
          className: 'rounded-lg border border-dashed border-slate-200 dark:border-gray-700 bg-slate-50/60 dark:bg-slate-900/30 px-4 py-4 text-sm text-slate-500 dark:text-slate-400',
        }, 'No linked Jobs yet. Add one to sharpen clarity and derive base values.'),
      ]),
  ]);
}

function OpportunityTasksBlock({ tasks, ownerOptions, ownerMap, onCreateTask, onStartTask, onCompleteTask, onCreateFollowUp, onDismissFollowUp, followUpPromptTaskId }) {
  const [draftTitle, setDraftTitle] = useState('');
  const [draftAssigneeId, setDraftAssigneeId] = useState(ownerOptions[0]?.value || '');
  const [draftDueDate, setDraftDueDate] = useState(addDays(REFERENCE_DATE_ISO, 10));

  const handleCreate = () => {
    const title = String(draftTitle || '').trim();
    if (!title || !draftDueDate) return;
    onCreateTask({
      title,
      assigneeId: draftAssigneeId || ownerOptions[0]?.value || '',
      dueDate: draftDueDate,
    });
    setDraftTitle('');
    setDraftDueDate(addDays(REFERENCE_DATE_ISO, 10));
  };

  return h('section', { className: `${CARD_CLASS} overflow-hidden` }, [
    h('div', { className: 'px-6 pt-6 pb-4' }, [
      h('div', { className: 'text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400' }, 'Opportunity Tasks'),
    ]),
    h('div', { className: 'border-t border-b border-slate-200 dark:border-gray-700 bg-slate-50/80 dark:bg-slate-900/45 px-3 py-2' }, [
      h('div', { className: 'flex flex-wrap items-center gap-1' }, [
        h('div', { className: 'min-w-[220px] flex-1' }, [
          h(TextInput, {
            id: 'opportunity-task-title',
            value: draftTitle,
            onChange: (event) => setDraftTitle(event.target.value),
            placeholder: 'Add follow-up task...',
            className: '!h-9 !bg-white !text-slate-700 !border-slate-200 dark:!bg-slate-900 dark:!text-slate-200 dark:!border-white/10',
          }),
        ]),
        h('div', { className: 'w-[156px] flex-none' }, [
          h(SelectInput, {
            id: 'opportunity-task-assignee',
            value: draftAssigneeId,
            onChange: (event) => setDraftAssigneeId(event.target.value),
            options: ownerOptions,
            className: '!h-9 !bg-white !text-slate-700 !border-slate-200 dark:!bg-slate-900 dark:!text-slate-200 dark:!border-white/10',
          }),
        ]),
        h('div', { className: 'w-[138px] flex-none' }, [
          h(TextInput, {
            id: 'opportunity-task-due-date',
            type: 'date',
            value: draftDueDate,
            onChange: (event) => setDraftDueDate(event.target.value),
            className: '!h-9 !bg-white !text-slate-700 !border-slate-200 dark:!bg-slate-900 dark:!text-slate-200 dark:!border-white/10',
          }),
        ]),
        h(PrimaryButton, {
          className: 'h-9 flex-none whitespace-nowrap px-3 text-sm',
          onClick: handleCreate,
        }, 'Add'),
      ]),
    ]),
    h('section', { className: 'rounded-none border-0 bg-white/90 dark:bg-slate-900/70 shadow-none' }, [
      h('table', { className: 'w-full table-fixed text-left border-collapse' }, [
        h('thead', { className: 'bg-slate-100 dark:bg-slate-900 text-[11px] uppercase tracking-[0.18em] text-slate-600 dark:text-slate-300' }, [
          h('tr', null, [
            h('th', { className: 'px-3 py-3 w-[56%]' }, 'Task Name'),
            h('th', { className: 'px-3 py-3 w-[16%]' }, 'Assignee'),
            h('th', { className: 'px-3 py-3 w-[18%]' }, 'Due Date'),
            h('th', { className: 'px-3 py-3 w-[10%] text-right' }, ''),
          ]),
        ]),
        h('tbody', { className: 'divide-y divide-slate-200/80 dark:divide-white/10' }, tasks.flatMap((task) => {
          const assignee = ownerMap.get(String(task.assigneeId)) || null;
          const actionButton = task.status === 'backlog'
            ? h('button', {
              type: 'button',
              className: 'inline-flex h-8 min-w-[84px] items-center justify-center rounded-md border border-slate-200 dark:border-gray-700 px-3 text-xs font-semibold text-netnet-purple hover:bg-slate-100 dark:hover:bg-slate-800',
              onClick: () => onStartTask(task.id),
            }, 'Start early')
            : task.status === 'in_progress'
              ? h('button', {
                type: 'button',
                className: 'inline-flex h-8 min-w-[84px] items-center justify-center rounded-md border border-slate-200 dark:border-gray-700 px-3 text-xs font-semibold text-netnet-purple hover:bg-slate-100 dark:hover:bg-slate-800',
                onClick: () => onCompleteTask(task.id),
              }, 'Complete')
              : null;

          const taskRow = h('tr', {
            key: task.id,
            className: 'hover:bg-slate-100/95 dark:hover:bg-slate-800/65 transition-colors',
          }, [
            h('td', { className: 'px-3 py-4 align-top' }, [
              h('div', { className: 'min-h-[40px] flex items-start' }, [
                h('div', { className: 'space-y-1 min-w-0' }, [
                  h('div', { className: 'truncate text-sm font-semibold text-slate-900 dark:text-slate-100' }, task.title),
                  h('div', { className: 'flex flex-wrap items-start gap-2 text-[11px]' }, [
                    h('div', { className: 'flex flex-col gap-0.5' }, [
                      h('span', { className: `inline-flex rounded-full px-2 py-0.5 font-semibold ${getStatusTone(task.status)}` }, getStatusLabel(task.status)),
                      task.status === 'backlog'
                        ? h('span', { className: 'pl-1 text-[10px] leading-tight text-slate-400 dark:text-slate-500' }, `Starts ${formatShortDate(task.startDate)}`)
                        : null,
                    ]),
                  ]),
                ]),
              ]),
            ]),
            h('td', { className: 'px-3 py-4 align-middle' }, [
              h('div', { className: 'min-h-[40px] flex items-center gap-2' }, [
                renderAvatarHtml(assignee),
                h('span', { className: 'truncate text-sm text-slate-700 dark:text-slate-200' }, assignee ? getDisplayName(assignee) : '-'),
              ]),
            ]),
            h('td', { className: 'px-3 py-4 align-middle' }, [
              h('div', { className: 'min-h-[40px] flex items-center text-sm text-slate-500 dark:text-slate-400 whitespace-nowrap' }, formatShortDate(task.dueDate)),
            ]),
            h('td', { className: 'px-3 py-4 align-top text-right' }, [
              h('div', { className: 'min-h-[40px] flex items-start justify-end pt-0.5' }, [actionButton]),
            ]),
          ]);

          const promptRow = followUpPromptTaskId === task.id
            ? h('tr', { key: `${task.id}-follow-up` }, [
              h('td', { colSpan: 4, className: 'px-4 pb-4 pt-0' }, [
                h('div', { className: 'rounded-xl border border-emerald-200 dark:border-emerald-500/20 bg-emerald-50 dark:bg-emerald-500/10 px-4 py-3 min-h-[60px] flex flex-wrap items-center justify-between gap-3' }, [
                  h('div', { className: 'text-sm font-medium text-emerald-900 dark:text-emerald-100' }, 'Create next follow-up?'),
                  h('div', { className: 'flex items-center gap-2' }, [
                    h('button', {
                      type: 'button',
                      className: 'inline-flex h-9 items-center justify-center rounded-md bg-netnet-purple px-3 text-sm font-semibold text-white hover:brightness-110',
                      onClick: () => onCreateFollowUp(task),
                    }, 'Create next'),
                    h('button', {
                      type: 'button',
                      className: 'inline-flex h-9 items-center justify-center rounded-md border border-slate-200 dark:border-gray-700 px-3 text-sm font-semibold text-slate-700 dark:text-slate-200 hover:bg-white/80 dark:hover:bg-slate-800',
                      onClick: () => onDismissFollowUp(),
                    }, 'Dismiss'),
                  ]),
                ]),
              ]),
            ])
            : null;

          return promptRow ? [taskRow, promptRow] : [taskRow];
        })),
      ]),
    ]),
  ]);
}

function ActivityFeedPanel({ opportunity, onAddNote }) {
  const panelRef = useRef(null);
  const feedHtml = useMemo(() => renderContactsActivityFeed(opportunity, 'company'), [opportunity]);

  useEffect(() => {
    const panel = panelRef.current;
    if (!panel) return undefined;
    const addNoteBtn = panel.querySelector('#add-note-btn');
    const noteInput = panel.querySelector('#quick-note');
    if (!addNoteBtn || !noteInput) return undefined;

    const handleClick = () => {
      const text = noteInput.value.trim();
      if (!text) return;
      onAddNote(text);
    };

    addNoteBtn.addEventListener('click', handleClick);
    return () => addNoteBtn.removeEventListener('click', handleClick);
  }, [feedHtml, onAddNote]);

  return h('div', {
    ref: panelRef,
    className: 'w-full lg:w-96 border-t lg:border-t-0 lg:border-l border-gray-200 dark:border-gray-700 h-[50vh] lg:h-full flex-shrink-0',
    dangerouslySetInnerHTML: { __html: feedHtml },
  });
}

function OpportunityDetailScreen({ opportunityId }) {
  const members = useMemo(() => loadTeamMembers(), []);
  const ownerMap = useMemo(() => new Map(members.map((member) => [String(member.id), member])), [members]);
  const [opportunity, setOpportunity] = useState(() => {
    const found = getMockSalesOpportunity(opportunityId);
    return found ? normalizeOpportunity(cloneOpportunity(found)) : null;
  });
  const [followUpPromptTaskId, setFollowUpPromptTaskId] = useState('');

  const ownerOptions = useMemo(
    () => members.map((member) => ({ value: member.id, label: getDisplayName(member) || member.email || 'Owner' })),
    [members],
  );

  const owner = opportunity ? ownerMap.get(String(opportunity.ownerId)) : null;

  useEffect(() => {
    const found = getMockSalesOpportunity(opportunityId);
    setOpportunity(found ? normalizeOpportunity(cloneOpportunity(found)) : null);
    setFollowUpPromptTaskId('');
  }, [opportunityId]);

  if (!opportunity) {
    return h('div', { className: `${CARD_CLASS} p-6` }, [
      h('div', { className: 'text-lg font-semibold text-slate-900 dark:text-white' }, 'Opportunity not found'),
    ]);
  }

  const persistOpportunity = (updater, buildEntries = null) => {
    setOpportunity((current) => {
      const draft = typeof updater === 'function' ? updater(cloneOpportunity(current)) : cloneOpportunity(updater);
      const preview = prepareMockSalesOpportunity(serializeOpportunity(draft));
      const nextEntries = typeof buildEntries === 'function'
        ? (buildEntries(current, preview, draft) || []).filter(Boolean)
        : [];
      const saved = saveMockSalesOpportunity({
        ...serializeOpportunity(draft),
        activities: [...nextEntries, ...(current.activities || [])],
      });
      return normalizeOpportunity(cloneOpportunity(saved));
    });
  };

  const handleStartTask = (taskId) => {
    persistOpportunity((current) => ({
      ...current,
      tasks: (current.tasks || []).map((task) => (
        String(task.id) === String(taskId)
          ? normalizeTask({ ...task, status: 'in_progress' })
          : task
      )),
    }), (previous) => {
      const task = (previous.tasks || []).find((item) => String(item.id) === String(taskId));
      return task ? [{
        type: 'task',
        title: task.title,
        text: 'Task moved to In Progress early.',
        ...buildTimestampMeta(),
      }] : [];
    });
  };

  const handleCompleteTask = (taskId) => {
    persistOpportunity((current) => ({
      ...current,
      tasks: (current.tasks || []).map((task) => (
        String(task.id) === String(taskId)
          ? normalizeTask({ ...task, status: 'completed' })
          : task
      )),
    }), (previous) => {
      const task = (previous.tasks || []).find((item) => String(item.id) === String(taskId));
      return task ? [{
        type: 'task',
        title: task.title,
        text: 'Task marked complete.',
        ...buildTimestampMeta(),
      }] : [];
    });
    setFollowUpPromptTaskId(taskId);
  };

  const handleCreateTask = ({ title, assigneeId, dueDate }) => {
    const newTask = normalizeTask({
      id: `opp_task_${Math.random().toString(36).slice(2, 9)}`,
      title,
      status: 'backlog',
      assigneeId,
      dueDate,
      startDate: subtractDays(dueDate, 7),
    });
    persistOpportunity((current) => ({
      ...current,
      tasks: [newTask, ...(current.tasks || [])],
    }), () => [buildSystemActivity('Task created', `${title} was added to the opportunity.`)]);
  };

  const handleCreateFollowUp = (task) => {
    const nextDueDate = addDays(task.dueDate, 14);
    handleCreateTask({
      title: `Follow up: ${task.title}`,
      assigneeId: task.assigneeId,
      dueDate: nextDueDate,
    });
    setFollowUpPromptTaskId('');
  };

  const handleDismissFollowUp = () => {
    setFollowUpPromptTaskId('');
  };

  const handleAddNote = (text) => {
    persistOpportunity((current) => current, () => [buildNoteActivity(text)]);
    if (typeof window?.showToast === 'function') {
      window.showToast('Note added');
    }
  };

  const handleStatusChange = (nextStatus) => {
    if (nextStatus === opportunity.status) return;
    persistOpportunity((current) => ({
      ...current,
      status: nextStatus,
    }), (previous, next) => [
      buildSystemActivity('Status changed', `Status changed from ${formatStatusValue(previous.status)} to ${formatStatusValue(next.status)}.`),
    ]);
  };

  const handleProjectOverrideChange = (nextOverride) => {
    const normalized = String(nextOverride || '').trim();
    if (moneyValuesEqual(normalized, opportunity.value?.project?.overrideValue || '')) return;
    persistOpportunity((current) => ({
      ...current,
      value: {
        ...current.value,
        project: {
          ...(current.value?.project || {}),
          overrideValue: normalized,
        },
      },
    }), (previous, next) => [
      buildOverrideChangedEntry('Project', previous.value?.project?.overrideValue || '', next.value?.project?.overrideValue || ''),
      buildValueChangedEntry(previous, next),
    ]);
  };

  const handleRetainerOverrideChange = (nextOverride) => {
    const normalized = String(nextOverride || '').trim();
    if (moneyValuesEqual(normalized, opportunity.value?.retainer?.overrideMonthly || '')) return;
    persistOpportunity((current) => ({
      ...current,
      value: {
        ...current.value,
        retainer: {
          ...(current.value?.retainer || {}),
          overrideMonthly: normalized,
        },
      },
    }), (previous, next) => [
      buildOverrideChangedEntry('Retainer', previous.value?.retainer?.overrideMonthly || '', next.value?.retainer?.overrideMonthly || ''),
      buildValueChangedEntry(previous, next),
    ]);
  };

  const handleAddJob = () => {
    const linkedIds = new Set((opportunity.linkedJobs || []).map((job) => String(job.id)));
    const nextJob = mockSalesJobOptions.find((job) => !linkedIds.has(String(job.id)));
    if (!nextJob) {
      window?.showToast?.('All mock Jobs are already linked.');
      return;
    }
    persistOpportunity((current) => ({
      ...current,
      linkedJobs: [...(current.linkedJobs || []), { ...nextJob }],
    }), (previous, next) => [
      buildSystemActivity('Job added', `${nextJob.jobNumber} ${nextJob.name} linked to the opportunity.`),
      buildValueChangedEntry(previous, next),
    ]);
  };

  const handleRemoveJob = (jobId) => {
    const removedJob = (opportunity.linkedJobs || []).find((job) => String(job.id) === String(jobId));
    if (!removedJob) return;
    persistOpportunity((current) => ({
      ...current,
      linkedJobs: (current.linkedJobs || []).filter((job) => String(job.id) !== String(jobId)),
    }), (previous, next) => [
      buildSystemActivity('Job removed', `${removedJob.jobNumber} ${removedJob.name} removed from the opportunity.`),
      buildValueChangedEntry(previous, next),
    ]);
  };

  return h('div', { className: 'flex flex-col lg:flex-row min-h-[calc(100vh-180px)]' }, [
    h('div', { className: 'flex-1 overflow-y-auto bg-[var(--color-bg-app,#020617)]' }, [
      h('div', { className: 'space-y-5' }, [
        h(SummaryCard, { opportunity, owner, onStatusChange: handleStatusChange }),
        h(ValueBlock, {
          opportunity,
          onProjectOverrideChange: handleProjectOverrideChange,
          onRetainerOverrideChange: handleRetainerOverrideChange,
        }),
        h(LinkedJobsBlock, {
          linkedJobs: opportunity.linkedJobs || [],
          onAddJob: handleAddJob,
          onRemoveJob: handleRemoveJob,
        }),
        h(OpportunityTasksBlock, {
          tasks: opportunity.tasks || [],
          ownerOptions,
          ownerMap,
          onCreateTask: handleCreateTask,
          onStartTask: handleStartTask,
          onCompleteTask: handleCompleteTask,
          onCreateFollowUp: handleCreateFollowUp,
          onDismissFollowUp: handleDismissFollowUp,
          followUpPromptTaskId,
        }),
      ]),
    ]),
    h(ActivityFeedPanel, { opportunity, onAddNote: handleAddNote }),
  ]);
}

export function renderOpportunityDetailPage(container = document.getElementById('app-main'), opportunityId = '1') {
  if (!container) {
    console.warn('[SalesOpportunityDetail] container not found for renderOpportunityDetailPage.');
    return;
  }

  const opportunity = getMockSalesOpportunity(opportunityId);
  const { headerMount, bodyMount } = mountSectionPageShell(container, {
    headerId: 'sales-detail-header',
    bodyId: 'sales-detail-body',
  });
  const headerRoot = createRoot(headerMount);
  const bodyRoot = createRoot(bodyMount);

  headerRoot.render(h(SectionHeader, {
    breadcrumbs: [
      { label: 'Sales', path: '/sales' },
      { label: opportunity?.name || 'Opportunity' },
    ],
    showHelpIcon: true,
    showSecondaryRow: false,
    className: 'mb-1',
  }));

  bodyRoot.render(h(OpportunityDetailScreen, { opportunityId }));
}
