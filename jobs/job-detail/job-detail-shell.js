import { SectionHeader } from '../../components/layout/SectionHeader.js';
import { navigate } from '../../router.js';
import { getContactsData } from '../../contacts/contacts-data.js';
import { loadTeamMembers } from '../../quick-tasks/quick-tasks-store.js';
import { getJobById, loadJobChatMessages, updateJob } from '../jobs-store.js';
import { getJobNumber } from '../job-number-utils.js';
import { JobPlanTab } from '../jobs-plan.js';
import { JobSettingsTab } from './job-settings-tab.js';
import { JobKanbanTab } from './job-kanban-tab.js';
import { JobTimelineTab } from './job-timeline-tab.js';
import { JobPerformanceTab } from './job-performance-tab.js';
import { JobTasksTab } from './job-tasks-tab.js';
import { JobChatDrawer } from '../job-chat-drawer.js';

const { createElement: h, useEffect, useMemo, useState } = React;

const TAB_CONFIG = [
  { key: 'plan', label: 'Plan', path: '' },
  { key: 'kanban', label: 'Kanban', path: 'kanban' },
  { key: 'tasks', label: 'Tasks', path: 'tasks' },
  { key: 'timeline', label: 'Timeline', path: 'timeline' },
  { key: 'performance', label: 'Performance', path: 'performance' },
  { key: 'settings', label: 'Settings', path: 'settings' },
];

function kindLabel(kind) {
  return kind === 'retainer' ? 'Retainer' : 'Project';
}

function statusLabel(status) {
  if (status === 'active') return 'Active';
  if (status === 'completed') return 'Completed';
  if (status === 'archived') return 'Archived';
  return 'Pending';
}

function buildCompanyMap() {
  const companies = getContactsData();
  const map = new Map();
  (companies || []).forEach((company) => {
    if (company?.id) map.set(String(company.id), company.name || `Company ${company.id}`);
  });
  return map;
}

function TabPlaceholder({ title, description, bullets = [] }) {
  return h('div', { className: 'rounded-2xl border border-slate-200 dark:border-white/10 bg-white/90 dark:bg-slate-900/60 p-6 space-y-3' }, [
    h('div', { className: 'text-base font-semibold text-slate-900 dark:text-white' }, title),
    h('p', { className: 'text-sm text-slate-500 dark:text-slate-400' }, description),
    bullets.length
      ? h('ul', { className: 'text-sm text-slate-500 dark:text-slate-400 list-disc ps-5 space-y-1' }, bullets.map((item, idx) => h('li', { key: idx }, item)))
      : null,
  ]);
}

export function JobDetailShell({ jobId, subview }) {
  const [job, setJob] = useState(() => getJobById(jobId));
  const [chatMessages, setChatMessages] = useState(() => loadJobChatMessages(jobId));
  const [chatState, setChatState] = useState({ isOpen: false, target: { type: 'job' } });
  const [jobNumberVersion, setJobNumberVersion] = useState(0);
  const companyMap = useMemo(buildCompanyMap, []);
  const members = useMemo(() => loadTeamMembers(), []);

  useEffect(() => {
    setJob(getJobById(jobId));
    setChatMessages(loadJobChatMessages(jobId));
  }, [jobId]);

  const handleJobUpdate = (updates) => {
    const next = updateJob(jobId, updates);
    if (next) setJob(next);
  };
  const openChat = (target = { type: 'job' }) => {
    setChatState({ isOpen: true, target });
  };
  const closeChat = () => setChatState((prev) => ({ ...prev, isOpen: false }));
  const refreshChat = () => {
    setChatMessages(loadJobChatMessages(jobId));
  };

  if (!job) {
    return h('div', { className: 'space-y-4 px-4 pt-4 pb-12' }, [
      h(SectionHeader, {
        title: 'Job not found',
        showSecondaryRow: false,
      }),
      h('button', {
        type: 'button',
        className: 'inline-flex items-center justify-center h-10 px-4 rounded-md border border-slate-200 dark:border-white/10 text-sm font-semibold text-slate-700 dark:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-800',
        onClick: () => navigate('#/app/jobs'),
      }, 'Back to Jobs'),
    ]);
  }

  const activeTab = TAB_CONFIG.find((tab) => tab.key === subview) ? subview : 'plan';
  const timelineDisabled = job.kind === 'retainer';
  const readOnly = job.status === 'archived';

  const companyName = job.companyId ? companyMap.get(String(job.companyId)) : '';
  const anchorLabel = job.isInternal ? 'Internal' : companyName ? `Client · ${companyName}` : 'Client';
  const jobNumber = getJobNumber(job, jobNumberVersion);

  const breadcrumb = h('div', { className: 'flex items-center gap-2' }, [
    h('button', {
      type: 'button',
      className: 'text-sm text-slate-500 dark:text-white/70 hover:text-slate-900 dark:hover:text-white',
      onClick: () => navigate('#/app/jobs'),
    }, 'Jobs'),
    h('span', { className: 'text-slate-400 dark:text-white/50' }, '›'),
    h('span', { className: 'text-2xl font-semibold text-slate-900 dark:text-white' }, job.name || 'Job'),
  ]);

  const renderTab = (tab) => {
    const href = `#/app/jobs/${job.id}${tab.path ? `/${tab.path}` : ''}`;
    const isActive = activeTab === tab.key;
    if (tab.key === 'timeline' && timelineDisabled) {
      return h('span', {
        key: tab.key,
        title: 'Timeline applies to Project Jobs only',
        className: 'inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-semibold bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-white/10 text-slate-400 dark:text-slate-500 cursor-not-allowed',
      }, tab.label);
    }
    const base = 'inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-semibold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:ring-netnet-purple focus-visible:ring-offset-white dark:focus-visible:ring-offset-slate-900';
    const activeClasses = 'bg-[var(--color-brand-purple,#711FFF)] text-white border-transparent shadow-sm';
    const idleClasses = 'bg-white dark:bg-slate-900 border-slate-300 dark:border-white/15 text-slate-700 dark:text-slate-100 hover:border-netnet-purple/60 hover:text-netnet-purple';
    return h('a', { key: tab.key, href, className: `${base} ${isActive ? activeClasses : idleClasses}` }, tab.label);
  };

  const content = (() => {
    if (activeTab === 'plan') {
      return h(JobPlanTab, {
        job,
        onJobUpdate: handleJobUpdate,
        readOnly,
        chatMessages,
        onOpenChat: openChat,
      });
    }
    if (activeTab === 'kanban') return h(JobKanbanTab, { job, onJobUpdate: handleJobUpdate, readOnly });
    if (activeTab === 'tasks') {
      return h(JobTasksTab, { job, onJobUpdate: handleJobUpdate, readOnly });
    }
    if (activeTab === 'timeline') {
      if (timelineDisabled) {
        return h(TabPlaceholder, {
          title: 'Timeline',
          description: 'Timeline applies to Project Jobs only.',
        });
      }
      return h(JobTimelineTab, { job, onJobUpdate: handleJobUpdate, readOnly });
    }
    if (activeTab === 'performance') {
      return h(JobPerformanceTab, { job });
    }
    if (activeTab === 'settings') {
      return h(JobSettingsTab, {
        job,
        members,
        onJobUpdate: handleJobUpdate,
        readOnly,
        onJobNumberChange: () => setJobNumberVersion((prev) => prev + 1),
      });
    }
    return null;
  })();

  return h('div', { className: 'space-y-6 px-4 pt-4 pb-12' }, [
    h(SectionHeader, {
      title: breadcrumb,
      showHelpIcon: true,
      showSecondaryRow: false,
    }),
    job.status === 'archived'
      ? h('div', { className: 'rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-slate-800 px-4 py-2 text-xs text-slate-600 dark:text-slate-300' }, 'Archived — view only.')
      : null,
    h('div', { className: 'rounded-2xl border border-slate-200 dark:border-white/10 bg-white/90 dark:bg-slate-900/60 p-5 space-y-3' }, [
      h('div', { className: 'flex items-center justify-between gap-3' }, [
        h('div', { className: 'text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400' }, `Job ${jobNumber}`),
        h('button', {
          type: 'button',
          className: 'inline-flex items-center gap-2 rounded-full border border-slate-200 dark:border-white/10 px-3 py-1.5 text-xs font-semibold text-slate-600 dark:text-slate-200 hover:text-slate-900 dark:hover:text-white',
          onClick: () => openChat({ type: 'job' }),
        }, [
          h('svg', { viewBox: '0 0 24 24', className: 'h-4 w-4', fill: 'none', stroke: 'currentColor', strokeWidth: '1.8' }, [
            h('path', { d: 'M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4z' }),
          ]),
          'Chat',
          chatMessages.length
            ? h('span', { className: 'rounded-full bg-slate-200 dark:bg-slate-700 px-2 py-0.5 text-[10px] font-semibold text-slate-600 dark:text-slate-200' }, String(chatMessages.length))
            : null,
        ].filter(Boolean)),
      ]),
      h('div', { className: 'text-xl font-semibold text-slate-900 dark:text-white' }, job.name || 'Job'),
      h('div', { className: 'flex flex-wrap items-center gap-2' }, [
        h('span', { className: 'rounded-full border border-slate-200 dark:border-white/10 px-3 py-1 text-xs font-semibold text-slate-600 dark:text-slate-200 bg-slate-50 dark:bg-slate-800' }, kindLabel(job.kind)),
        h('span', { className: 'rounded-full border border-slate-200 dark:border-white/10 px-3 py-1 text-xs font-semibold text-slate-600 dark:text-slate-200 bg-slate-50 dark:bg-slate-800' }, statusLabel(job.status)),
        h('span', { className: 'rounded-full border border-slate-200 dark:border-white/10 px-3 py-1 text-xs font-semibold text-slate-600 dark:text-slate-200 bg-slate-50 dark:bg-slate-800' }, anchorLabel),
      ]),
    ]),
    h('div', { className: 'flex flex-wrap gap-2' }, TAB_CONFIG.map(renderTab)),
    content,
    h(JobChatDrawer, {
      isOpen: chatState.isOpen,
      job,
      jobNumber,
      target: chatState.target,
      messages: chatMessages,
      readOnly,
      onClose: closeChat,
      onChatUpdate: refreshChat,
    }),
  ]);
}
