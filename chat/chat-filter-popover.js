import { filterKey, makeFilterFromOption } from './chat-mention-utils.js';

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

function CloseIcon({ size = 14 }) {
  return h('svg', {
    width: size,
    height: size,
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

function isActive(option, activeFilters = []) {
  const key = filterKey(makeFilterFromOption(option));
  return activeFilters.some((filter) => filterKey(filter) === key);
}

function FilterItem({ option, activeFilters, onToggleFilter, children }) {
  const active = isActive(option, activeFilters);
  return h('button', {
    type: 'button',
    className: [
      'flex min-w-0 flex-1 items-center justify-between gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors focus:outline-none focus:ring-1 focus:ring-netnet-purple/40',
      active
        ? 'bg-netnet-purple/10 font-semibold text-netnet-purple ring-1 ring-netnet-purple/15 dark:bg-white/10 dark:text-white dark:ring-white/10'
        : 'text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-white/10',
    ].join(' '),
    onClick: () => onToggleFilter?.(makeFilterFromOption(option)),
  }, children || [
    h('span', { className: 'min-w-0 truncate' }, option.label),
    active ? h('span', { className: 'text-[11px] font-semibold text-netnet-purple dark:text-white' }, 'On') : null,
  ]);
}

function DisclosureRow({ id, label, open, onToggle, children }) {
  return h('div', { className: 'min-w-0' }, [
    h('button', {
      type: 'button',
      className: 'flex w-full min-w-0 items-center gap-1 rounded-md px-1 py-1 text-left text-xs font-semibold uppercase tracking-wide text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 focus:outline-none focus:ring-1 focus:ring-netnet-purple/40 dark:hover:bg-white/10 dark:hover:text-white',
      'aria-expanded': open ? 'true' : 'false',
      onClick: () => onToggle(id),
    }, [
      h(CaretIcon, { open }),
      h('span', { className: 'truncate' }, label),
    ]),
    open ? h('div', { className: 'mt-1 space-y-1 pl-4' }, children) : null,
  ]);
}

function JobTree({ job, catalog, activeFilters, openIds, onToggleOpen, onToggleFilter }) {
  const deliverables = catalog.deliverables.filter((item) => item.jobId === job.jobId);
  const jobOpen = openIds.has(job.jobId);
  return h('div', { className: 'space-y-1' }, [
    h('div', { className: 'flex items-center gap-1' }, [
      deliverables.length ? h('button', {
        type: 'button',
        className: 'flex h-7 w-6 shrink-0 items-center justify-center rounded-md text-slate-400 hover:bg-slate-100 hover:text-slate-700 focus:outline-none focus:ring-1 focus:ring-netnet-purple/40 dark:hover:bg-white/10 dark:hover:text-white',
        'aria-label': `${jobOpen ? 'Collapse' : 'Expand'} ${job.label}`,
        'aria-expanded': jobOpen ? 'true' : 'false',
        onClick: () => onToggleOpen(job.jobId),
      }, h(CaretIcon, { open: jobOpen })) : h('span', { className: 'w-6 shrink-0' }),
      h(FilterItem, { option: job, activeFilters, onToggleFilter }),
    ]),
    jobOpen && deliverables.length ? h('div', { className: 'space-y-1 pl-7' }, deliverables.map((deliverable) => (
      h(DeliverableTree, {
        key: deliverable.id,
        deliverable,
        catalog,
        activeFilters,
        openIds,
        onToggleOpen,
        onToggleFilter,
      })
    ))) : null,
  ]);
}

function DeliverableTree({ deliverable, catalog, activeFilters, openIds, onToggleOpen, onToggleFilter }) {
  const tasks = catalog.tasks.filter((item) => item.deliverableId === deliverable.id);
  const deliverableOpen = openIds.has(deliverable.id);
  return h('div', { className: 'space-y-1' }, [
    h('div', { className: 'flex items-center gap-1' }, [
      tasks.length ? h('button', {
        type: 'button',
        className: 'flex h-7 w-6 shrink-0 items-center justify-center rounded-md text-slate-400 hover:bg-slate-100 hover:text-slate-700 focus:outline-none focus:ring-1 focus:ring-netnet-purple/40 dark:hover:bg-white/10 dark:hover:text-white',
        'aria-label': `${deliverableOpen ? 'Collapse' : 'Expand'} ${deliverable.label}`,
        'aria-expanded': deliverableOpen ? 'true' : 'false',
        onClick: () => onToggleOpen(deliverable.id),
      }, h(CaretIcon, { open: deliverableOpen })) : h('span', { className: 'w-6 shrink-0' }),
      h(FilterItem, { option: deliverable, activeFilters, onToggleFilter }),
    ]),
    deliverableOpen && tasks.length ? h('div', { className: 'space-y-1 pl-7' }, tasks.map((task) => (
      h(FilterItem, { key: task.id, option: task, activeFilters, onToggleFilter })
    ))) : null,
  ]);
}

function PeopleList({ people, activeFilters, onToggleFilter }) {
  if (!people.length) {
    return h('div', { className: 'px-2 py-2 text-sm text-slate-400 dark:text-slate-500' }, 'No people yet');
  }
  return h('div', { className: 'space-y-1' }, people.map((person) => (
    h(FilterItem, { key: person.id, option: person, activeFilters, onToggleFilter })
  )));
}

export function ActiveFilterBar({ activeFilters = [], onRemoveFilter, onClearFilters }) {
  if (!activeFilters.length) return null;
  return h('div', {
    className: 'flex flex-wrap items-center gap-2 border-b border-slate-200 bg-slate-50/60 px-3 py-2 text-xs dark:border-white/10 dark:bg-white/[0.03] sm:px-4',
    'data-chat-active-filters': 'true',
  }, [
    h('span', { className: 'font-semibold text-slate-400 dark:text-slate-500' }, 'Filters'),
    ...activeFilters.map((filter) => h('button', {
      key: filterKey(filter),
      type: 'button',
      className: 'inline-flex max-w-[240px] items-center gap-1.5 rounded-md border border-slate-200 bg-white px-2 py-1 font-semibold text-slate-600 transition-colors hover:border-netnet-purple/40 hover:text-netnet-purple focus:outline-none focus:ring-1 focus:ring-netnet-purple/40 dark:border-white/10 dark:bg-slate-900 dark:text-slate-200',
      title: `Remove ${filter.label}`,
      'aria-label': `Remove ${filter.label}`,
      onClick: () => onRemoveFilter?.(filter),
    }, [
      h('span', { className: 'truncate' }, filter.label),
      h(CloseIcon, { size: 12 }),
    ])),
    h('button', {
      type: 'button',
      className: 'ml-auto font-semibold text-slate-400 hover:text-netnet-purple focus:outline-none focus:ring-1 focus:ring-netnet-purple/40 dark:text-slate-500 dark:hover:text-white',
      onClick: onClearFilters,
    }, 'Clear'),
  ]);
}

export function ChatFilterPopover({
  catalog,
  activeLocation,
  selectedChannel,
  activeFilters = [],
  onToggleFilter,
  onClose,
}) {
  const isJobChannel = activeLocation?.type === 'job' && selectedChannel?.id;
  const initialOpen = isJobChannel ? [selectedChannel.id] : [];
  const [openIds, setOpenIds] = useState(() => new Set(initialOpen));
  const [peopleOpen, setPeopleOpen] = useState(true);
  const currentJobDeliverables = isJobChannel
    ? catalog.deliverables.filter((item) => item.jobId === selectedChannel.id)
    : [];
  const people = catalog.people || [];

  const toggleOpen = (id) => {
    setOpenIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return h('div', {
    className: 'absolute right-3 top-[58px] z-50 w-[min(360px,calc(100vw-2rem))] rounded-lg border border-slate-200 bg-white p-2 shadow-xl dark:border-white/10 dark:bg-slate-950',
    role: 'dialog',
    'aria-label': 'Chat filters',
    'data-chat-filter-popover': 'true',
  }, [
    h('div', { className: 'mb-2 flex items-center justify-between gap-3 px-1' }, [
      h('div', null, [
        h('div', { className: 'text-sm font-semibold text-slate-950 dark:text-white' }, 'Filter Chat'),
        h('div', { className: 'text-xs text-slate-400 dark:text-slate-500' }, isJobChannel ? 'This job is already selected' : 'Choose work or people'),
      ]),
      h('button', {
        type: 'button',
        className: 'rounded-md px-2 py-1 text-xs font-semibold text-slate-400 hover:bg-slate-100 hover:text-slate-700 focus:outline-none focus:ring-1 focus:ring-netnet-purple/40 dark:hover:bg-white/10 dark:hover:text-white',
        onClick: onClose,
      }, 'Close'),
    ]),
    h('div', { className: 'max-h-[420px] space-y-2 overflow-y-auto pr-1' }, [
      isJobChannel
        ? h(DisclosureRow, {
          id: selectedChannel.id,
          label: 'Deliverables',
          open: openIds.has(selectedChannel.id),
          onToggle: toggleOpen,
        }, currentJobDeliverables.length
          ? currentJobDeliverables.map((deliverable) => h(DeliverableTree, {
            key: deliverable.id,
            deliverable,
            catalog,
            activeFilters,
            openIds,
            onToggleOpen: toggleOpen,
            onToggleFilter,
          }))
          : h('div', { className: 'px-2 py-2 text-sm text-slate-400 dark:text-slate-500' }, 'No deliverables yet'))
        : h(DisclosureRow, {
          id: 'jobs',
          label: 'Jobs',
          open: openIds.has('jobs'),
          onToggle: toggleOpen,
        }, (catalog.jobs || []).map((job) => h(JobTree, {
          key: job.id,
          job,
          catalog,
          activeFilters,
          openIds,
          onToggleOpen: toggleOpen,
          onToggleFilter,
        }))),
      h('div', { className: 'border-t border-slate-100 pt-2 dark:border-white/10' }, [
        h('button', {
          type: 'button',
          className: 'flex w-full items-center gap-1 rounded-md px-1 py-1 text-left text-xs font-semibold uppercase tracking-wide text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 focus:outline-none focus:ring-1 focus:ring-netnet-purple/40 dark:hover:bg-white/10 dark:hover:text-white',
          'aria-expanded': peopleOpen ? 'true' : 'false',
          onClick: () => setPeopleOpen((open) => !open),
        }, [
          h(CaretIcon, { open: peopleOpen }),
          h('span', null, 'People'),
        ]),
        peopleOpen ? h('div', { className: 'mt-1 pl-4' }, h(PeopleList, {
          people,
          activeFilters,
          onToggleFilter,
        })) : null,
      ]),
    ]),
  ]);
}
