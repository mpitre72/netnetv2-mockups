import { SectionHeader } from '../components/layout/SectionHeader.js';
import { navigate } from '../router.js';
import { loadJobs } from './jobs-store.js';
import { loadTeamMembers } from '../quick-tasks/quick-tasks-store.js';
import { setJobsMainView } from './jobs-ui-state.js';
import { ViewToggleGroup } from './jobs-view-toggle.js';

const { createElement: h, useEffect, useMemo, useState } = React;

function formatStatus(task) {
  if (task.isDraft) return 'Draft';
  if (task.status === 'in_progress') return 'In Progress';
  if (task.status === 'completed') return 'Completed';
  return 'Backlog';
}

function formatDate(dateStr) {
  if (!dateStr) return '-';
  const date = new Date(`${dateStr}T00:00:00`);
  if (Number.isNaN(date.getTime())) return dateStr;
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(date);
}

function getInitials(name) {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '?';
  const first = parts[0][0] || '';
  const last = parts.length > 1 ? parts[parts.length - 1][0] : '';
  return `${first}${last}`.toUpperCase();
}

function buildTasks(jobs = []) {
  const results = [];
  (jobs || []).forEach((job) => {
    (job.deliverables || []).forEach((deliverable) => {
      (deliverable.tasks || []).forEach((task) => {
        results.push({
          task,
          job,
          deliverable,
        });
      });
    });
  });
  return results;
}

export function JobsAllTasksScreen() {
  const [jobs, setJobs] = useState(loadJobs());
  const members = useMemo(() => loadTeamMembers(), []);
  const memberMap = useMemo(() => new Map(members.map((member) => [String(member.id), member])), [members]);

  useEffect(() => {
    setJobsMainView('tasks');
    setJobs(loadJobs());
  }, []);

  const entries = useMemo(() => buildTasks(jobs), [jobs]);

  const viewToggle = h(ViewToggleGroup, {
    value: 'tasks',
    options: [
      {
        value: 'jobs',
        label: 'Jobs',
        title: 'Jobs',
        icon: h('svg', { viewBox: '0 0 24 24', className: 'h-4 w-4', fill: 'none', stroke: 'currentColor', strokeWidth: '1.8' }, [
          h('path', { d: 'M4 6h16' }),
          h('path', { d: 'M4 12h16' }),
          h('path', { d: 'M4 18h16' }),
        ]),
      },
      {
        value: 'tasks',
        label: 'All Job Tasks',
        title: 'All Job Tasks',
        icon: h('svg', { viewBox: '0 0 24 24', className: 'h-4 w-4', fill: 'none', stroke: 'currentColor', strokeWidth: '1.8' }, [
          h('rect', { x: '4', y: '4', width: '16', height: '16', rx: '2' }),
          h('path', { d: 'M8 12l3 3 5-6' }),
        ]),
      },
    ],
    onChange: (next) => {
      if (next === 'jobs') navigate('#/app/jobs');
      if (next === 'tasks') navigate('#/app/jobs/tasks');
    },
  });

  return h('div', { className: 'space-y-4 px-4 pt-4 pb-12' }, [
    h(SectionHeader, {
      title: 'All Job Tasks',
      showHelpIcon: true,
      showSecondaryRow: false,
    }),
    h('div', { className: 'flex w-full flex-wrap items-center gap-2' }, [
      viewToggle,
      h('div', { className: 'text-xs text-slate-500 dark:text-slate-400' }, 'Job tasks across all jobs (Quick Tasks are not included).'),
    ]),
    entries.length
      ? h('div', { className: 'rounded-2xl border border-slate-200 dark:border-white/10 bg-white/90 dark:bg-slate-900/60 overflow-x-auto' }, [
        h('div', { className: 'min-w-[720px]' }, [
          h('div', { className: 'grid gap-3 px-5 py-3 text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-white/10', style: { gridTemplateColumns: '2fr 1.3fr 1.3fr 0.8fr 0.8fr' } }, [
            h('div', null, 'Task'),
            h('div', null, 'Job'),
            h('div', null, 'Deliverable'),
            h('div', null, 'Status'),
            h('div', null, 'Due date'),
          ]),
          ...entries.map(({ task, job, deliverable }) => {
            const assigneeIds = [...new Set((task.allocations || []).map((alloc) => String(alloc.assigneeUserId || '')).filter(Boolean))];
            return h('div', {
              key: task.id,
              className: 'grid gap-3 px-5 py-3 border-b border-slate-100 dark:border-white/5 hover:bg-slate-50 dark:hover:bg-white/5 cursor-pointer',
              style: { gridTemplateColumns: '2fr 1.3fr 1.3fr 0.8fr 0.8fr' },
              onClick: () => navigate(`#/app/jobs/${job.id}`),
            }, [
              h('div', { className: 'space-y-1' }, [
                h('div', { className: 'text-sm font-semibold text-slate-900 dark:text-white' }, task.title || 'Untitled task'),
                assigneeIds.length
                  ? h('div', { className: 'flex items-center gap-1' }, assigneeIds.slice(0, 3).map((id) => {
                    const member = memberMap.get(id);
                    return h('span', {
                      key: id,
                      className: 'h-6 w-6 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 text-[10px] font-semibold flex items-center justify-center border border-white dark:border-slate-900',
                    }, getInitials(member?.name || member?.email || id));
                  }))
                  : null,
              ]),
              h('div', { className: 'text-xs text-slate-600 dark:text-slate-300' }, job.name || 'Job'),
              h('div', { className: 'text-xs text-slate-600 dark:text-slate-300' }, deliverable.name || 'Deliverable'),
              h('div', { className: 'text-xs text-slate-600 dark:text-slate-300' }, formatStatus(task)),
              h('div', { className: 'text-xs text-slate-600 dark:text-slate-300' }, formatDate(task.dueDate)),
            ]);
          }),
        ]),
      ])
      : h('div', { className: 'rounded-2xl border border-slate-200 dark:border-white/10 bg-white/90 dark:bg-slate-900/60 p-6 text-center' }, [
        h('h3', { className: 'text-base font-semibold text-slate-900 dark:text-white' }, 'No job tasks yet'),
        h('p', { className: 'mt-2 text-sm text-slate-500 dark:text-slate-400' }, 'Create tasks inside a job to see them here.'),
      ]),
  ]);
}
