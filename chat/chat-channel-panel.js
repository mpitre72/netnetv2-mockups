const { createElement: h, useState } = React;

function CaretIcon({ open = false }) {
  return h('svg', {
    width: 14,
    height: 14,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 2,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    className: open ? 'rotate-90 transition-transform' : 'transition-transform',
    'aria-hidden': 'true',
  }, h('polyline', { points: '9 18 15 12 9 6' }));
}

function CloseIcon() {
  return h('svg', {
    width: 16,
    height: 16,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 2,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    'aria-hidden': 'true',
  }, [
    h('line', { x1: 18, y1: 6, x2: 6, y2: 18 }),
    h('line', { x1: 6, y1: 6, x2: 18, y2: 18 }),
  ]);
}

function isActiveLocation(activeLocation, type, id) {
  return activeLocation?.type === type && activeLocation?.id === id;
}

function subtleCount(value) {
  return Number(value || 0) > 0 ? String(value) : '';
}

function ChannelRow({
  label,
  count,
  active = false,
  emphasis = 'normal',
  indent = false,
  onClick,
}) {
  const isPrimary = emphasis === 'primary';
  const isUtility = emphasis === 'utility';
  return h('button', {
    type: 'button',
    onClick,
    title: label,
    className: [
      'group flex w-full min-w-0 items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors focus:outline-none focus:ring-1 focus:ring-netnet-purple/50',
      indent ? 'pl-4' : '',
      active
        ? 'bg-netnet-purple/10 text-slate-950 ring-1 ring-netnet-purple/15 dark:bg-white/10 dark:text-white dark:ring-white/10'
        : 'text-slate-600 hover:bg-slate-100/80 hover:text-slate-950 dark:text-slate-300 dark:hover:bg-white/10 dark:hover:text-white',
      isPrimary ? 'font-semibold' : 'font-medium',
      isUtility ? 'text-[13px]' : '',
    ].join(' '),
    'aria-current': active ? 'page' : undefined,
  }, [
    h('span', { className: 'min-w-0 flex-1 truncate' }, label),
    count ? h('span', {
      className: 'shrink-0 px-1 text-[11px] font-semibold tabular-nums text-slate-400 dark:text-slate-500',
    }, count) : null,
  ]);
}

function SectionHeader({ label, count }) {
  return h('div', { className: 'flex items-center justify-between gap-2 px-2 pt-3 pb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500' }, [
    h('span', null, label),
    Number(count || 0) > 0 ? h('span', { className: 'tabular-nums' }, String(count)) : null,
  ]);
}

function DisclosureButton({ label, open, count, onClick }) {
  return h('button', {
    type: 'button',
    onClick,
    className: 'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs font-semibold text-slate-500 transition-colors hover:bg-slate-100/80 hover:text-slate-800 focus:outline-none focus:ring-1 focus:ring-netnet-purple/50 dark:text-slate-400 dark:hover:bg-white/10 dark:hover:text-white',
    'aria-expanded': open ? 'true' : 'false',
  }, [
    h(CaretIcon, { open }),
    h('span', { className: 'min-w-0 flex-1 truncate' }, label),
    h('span', { className: 'text-[11px] tabular-nums text-slate-400 dark:text-slate-500' }, String(count || 0)),
  ]);
}

function JobRows({ jobs = [], activeLocation, onSelectLocation, collapsed = false }) {
  if (collapsed) return null;
  return h('div', { className: 'space-y-0.5' }, jobs.map((channel) => h(ChannelRow, {
    key: channel.id,
    label: channel.title,
    count: subtleCount(channel.unreadCount || channel.mentionCount),
    active: isActiveLocation(activeLocation, 'job', channel.id),
    emphasis: 'primary',
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
  const [activeOpen, setActiveOpen] = useState(true);
  const [pendingOpen, setPendingOpen] = useState(false);
  const [completedOpen, setCompletedOpen] = useState(false);
  const activeJobs = jobChannels.active || [];
  const pendingJobs = jobChannels.pending || [];
  const completedJobs = jobChannels.completed || [];

  return h('aside', {
    className: 'flex h-full w-full flex-col overflow-hidden border-l border-slate-200 bg-white dark:border-white/10 dark:bg-slate-950/50 lg:w-[300px] lg:shrink-0',
    'data-chat-channel-panel': 'true',
  }, [
    h('header', { className: 'flex items-center justify-between border-b border-slate-200 px-3 py-2.5 dark:border-white/10' }, [
      h('div', { className: 'text-sm font-semibold text-slate-900 dark:text-white' }, 'Channels'),
      h('button', {
        type: 'button',
        onClick: onClose,
        className: 'inline-flex h-7 w-7 items-center justify-center rounded-md text-slate-400 hover:bg-slate-100 hover:text-slate-700 focus:outline-none focus:ring-1 focus:ring-netnet-purple/50 dark:hover:bg-white/10 dark:hover:text-white',
        'aria-label': 'Collapse channel list',
      }, h(CloseIcon)),
    ]),
    h('div', { className: 'min-h-0 flex-1 overflow-y-auto px-2 py-2' }, [
      h('section', { className: 'space-y-0.5' }, utilityViews.map((view) => h(ChannelRow, {
        key: view.id,
        label: view.label,
        count: subtleCount(utilityCounts[view.id]),
        active: isActiveLocation(activeLocation, 'utility', view.id),
        emphasis: 'utility',
        onClick: () => onSelectLocation({ type: 'utility', id: view.id }),
      }))),
      h('section', { className: 'mt-2 border-t border-slate-100 pt-2 dark:border-white/10' }, [
        h(ChannelRow, {
          label: generalChannel?.title || 'General',
          count: subtleCount(generalChannel?.unreadCount || generalChannel?.mentionCount),
          active: isActiveLocation(activeLocation, 'general', generalChannel?.id),
          emphasis: 'normal',
          onClick: () => onSelectLocation({ type: 'general', id: generalChannel?.id || 'general' }),
        }),
      ]),
      h('section', { className: 'mt-2 space-y-0.5 border-t border-slate-100 pt-1 dark:border-white/10' }, [
        h(SectionHeader, { label: 'Job Channels', count: activeJobs.length + pendingJobs.length + completedJobs.length }),
        h(DisclosureButton, {
          label: 'Active',
          open: activeOpen,
          count: activeJobs.length,
          onClick: () => setActiveOpen((value) => !value),
        }),
        h(JobRows, {
          jobs: activeJobs,
          activeLocation,
          onSelectLocation,
          collapsed: !activeOpen,
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
      h('section', { className: 'mt-2 space-y-0.5 border-t border-slate-100 pt-1 dark:border-white/10' }, [
        h(SectionHeader, { label: 'Direct Messages', count: directMessages.length }),
        ...directMessages.map((channel) => h(ChannelRow, {
          key: channel.id,
          label: channel.title,
          count: subtleCount(channel.unreadCount || channel.mentionCount),
          active: isActiveLocation(activeLocation, 'direct', channel.id),
          emphasis: 'normal',
          onClick: () => onSelectLocation({ type: 'direct', id: channel.id }),
        })),
      ]),
    ]),
  ]);
}
