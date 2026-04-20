const { createElement: h, useState } = React;

function isActiveLocation(activeLocation, type, id) {
  return activeLocation?.type === type && activeLocation?.id === id;
}

function subtleCount(value) {
  return Number(value || 0) > 0 ? String(value) : '';
}

function ChannelRow({
  label,
  meta,
  count,
  active = false,
  primary = false,
  indent = false,
  onClick,
}) {
  return h('button', {
    type: 'button',
    onClick,
    className: [
      'flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-sm transition-colors',
      indent ? 'pl-5' : '',
      active
        ? 'bg-slate-100 text-slate-950 dark:bg-white/10 dark:text-white'
        : 'text-slate-600 hover:bg-slate-100 hover:text-slate-950 dark:text-slate-300 dark:hover:bg-white/10 dark:hover:text-white',
      primary ? 'font-semibold' : 'font-medium',
    ].join(' '),
    'aria-current': active ? 'page' : undefined,
  }, [
    h('span', { className: 'min-w-0 flex-1 truncate' }, label),
    meta ? h('span', { className: 'shrink-0 text-[11px] text-slate-400 dark:text-slate-500' }, meta) : null,
    count ? h('span', {
      className: 'ml-1 inline-flex min-w-[1.25rem] justify-center rounded-full bg-slate-100 px-1.5 py-0.5 text-[11px] font-semibold text-slate-500 dark:bg-white/10 dark:text-slate-300',
    }, count) : null,
  ]);
}

function SectionHeader({ label, action }) {
  return h('div', { className: 'flex items-center justify-between gap-2 px-2.5 pt-3 text-[11px] font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500' }, [
    h('span', null, label),
    action || null,
  ]);
}

function DisclosureButton({ label, open, count, onClick }) {
  return h('button', {
    type: 'button',
    onClick,
    className: 'flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-xs font-semibold text-slate-500 hover:bg-slate-100 hover:text-slate-800 dark:text-slate-400 dark:hover:bg-white/10 dark:hover:text-white',
    'aria-expanded': open ? 'true' : 'false',
  }, [
    h('span', { className: `transition-transform ${open ? 'rotate-90' : ''}`, 'aria-hidden': 'true' }, '>'),
    h('span', { className: 'flex-1' }, label),
    h('span', { className: 'text-[11px] text-slate-400 dark:text-slate-500' }, String(count || 0)),
  ]);
}

function StatusLabel({ label, count }) {
  return h('div', { className: 'flex items-center justify-between px-2.5 pt-1 text-[11px] font-semibold text-slate-400 dark:text-slate-500' }, [
    h('span', null, label),
    h('span', null, String(count || 0)),
  ]);
}

function JobRows({ jobs = [], activeLocation, onSelectLocation, collapsed = false }) {
  if (collapsed) return null;
  return h('div', { className: 'space-y-0.5' }, jobs.map((channel) => h(ChannelRow, {
    key: channel.id,
    label: channel.title,
    meta: channel.client,
    count: subtleCount(channel.unreadCount || channel.mentionCount),
    active: isActiveLocation(activeLocation, 'job', channel.id),
    primary: true,
    indent: true,
    onClick: () => onSelectLocation({ type: 'job', id: channel.id }),
  })));
}

export function ChatChannelPanel({
  activeLocation,
  utilityViews = [],
  generalChannel,
  jobChannels = {},
  directMessages = [],
  utilityCounts = {},
  onSelectLocation,
  onClose,
}) {
  const [pendingOpen, setPendingOpen] = useState(false);
  const [completedOpen, setCompletedOpen] = useState(false);
  const activeJobs = jobChannels.active || [];
  const pendingJobs = jobChannels.pending || [];
  const completedJobs = jobChannels.completed || [];

  return h('aside', {
    className: 'flex h-full w-full flex-col overflow-hidden rounded-lg border border-slate-200 bg-white dark:border-white/10 dark:bg-slate-950/50 lg:w-[310px] lg:shrink-0',
    'data-chat-channel-panel': 'true',
  }, [
    h('header', { className: 'flex items-center justify-between border-b border-slate-200 px-3 py-3 dark:border-white/10' }, [
      h('div', { className: 'text-sm font-semibold text-slate-900 dark:text-white' }, 'Channels'),
      h('button', {
        type: 'button',
        onClick: onClose,
        className: 'rounded-md px-2 py-1 text-sm text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-white/10 dark:hover:text-white',
        'aria-label': 'Collapse channel list',
      }, 'x'),
    ]),
    h('div', { className: 'min-h-0 flex-1 overflow-y-auto px-2 py-2' }, [
      h('section', { className: 'space-y-0.5' }, utilityViews.map((view) => h(ChannelRow, {
        key: view.id,
        label: view.label,
        count: subtleCount(utilityCounts[view.id]),
        active: isActiveLocation(activeLocation, 'utility', view.id),
        onClick: () => onSelectLocation({ type: 'utility', id: view.id }),
      }))),
      h('section', { className: 'mt-2 space-y-0.5' }, [
        h(ChannelRow, {
          label: generalChannel?.title || 'General',
          count: subtleCount(generalChannel?.unreadCount || generalChannel?.mentionCount),
          active: isActiveLocation(activeLocation, 'general', generalChannel?.id),
          onClick: () => onSelectLocation({ type: 'general', id: generalChannel?.id || 'general' }),
        }),
      ]),
      h('section', { className: 'mt-2 space-y-1' }, [
        h(SectionHeader, { label: 'Job Channels' }),
        h(StatusLabel, { label: 'Active', count: activeJobs.length }),
        h(JobRows, {
          jobs: activeJobs,
          activeLocation,
          onSelectLocation,
        }),
        h(DisclosureButton, {
          label: 'Pending',
          open: pendingOpen,
          count: pendingJobs.length,
          onClick: () => setPendingOpen((value) => !value),
        }),
        h(JobRows, {
          jobs: pendingJobs,
          activeLocation,
          onSelectLocation,
          collapsed: !pendingOpen,
        }),
        h(DisclosureButton, {
          label: 'Completed',
          open: completedOpen,
          count: completedJobs.length,
          onClick: () => setCompletedOpen((value) => !value),
        }),
        h(JobRows, {
          jobs: completedJobs,
          activeLocation,
          onSelectLocation,
          collapsed: !completedOpen,
        }),
      ]),
      h('section', { className: 'mt-3 space-y-1' }, [
        h(SectionHeader, { label: 'Direct Messages' }),
        ...directMessages.map((channel) => h(ChannelRow, {
          key: channel.id,
          label: channel.title,
          count: subtleCount(channel.unreadCount || channel.mentionCount),
          active: isActiveLocation(activeLocation, 'direct', channel.id),
          onClick: () => onSelectLocation({ type: 'direct', id: channel.id }),
        })),
      ]),
    ]),
  ]);
}
