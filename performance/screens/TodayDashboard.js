import { navigate } from '../../router.js';
import { PerfCard, PerfSectionTitle } from '../../components/performance/primitives.js';

const { createElement: h, useEffect, useRef, useState } = React;
const { createPortal } = ReactDOM;

const ACTIONS = [
  'Mark as reviewed',
  'Complete deliverable',
  'Change due date',
  'Reassign tasks',
  'Create change order',
];

const JOBS_THAT_NEED_YOU = [
  {
    id: 'brightline-website-rebuild',
    client: 'Brightline',
    job: 'Website rebuild',
    type: 'Project',
    reason: 'Design deliverable is over plan and due in 2 days.',
    metricLabel: 'Effort',
    metricValue: '108% used',
    tone: 'red',
    actionMode: 'menu',
    activeActions: ACTIONS,
  },
  {
    id: 'vela-always-on-retainer',
    client: 'Vela Outdoors',
    job: 'Always-on retainer',
    type: 'Retainer',
    reason: 'This retainer cycle has used 82% of planned hours in week 2.',
    metricLabel: 'Cycle used',
    metricValue: '82% used',
    tone: 'amber',
    primaryAction: 'Review retainer',
  },
  {
    id: 'cedar-brand-refresh',
    client: 'Cedar & Co.',
    job: 'Brand refresh',
    type: 'Project',
    reason: 'One task has no assignee before its deliverable is due.',
    label: 'Assignment gap',
    tone: 'amber',
    primaryAction: 'Review Job',
  },
];

function showPrototypeToast(message) {
  if (typeof window !== 'undefined' && typeof window.showToast === 'function') {
    window.showToast(message);
  }
}

function statusClasses(tone) {
  if (tone === 'red') {
    return {
      dot: 'bg-rose-500',
      text: 'text-rose-700 dark:text-rose-200',
      bg: 'bg-rose-50 dark:bg-rose-950/30',
      border: 'border-rose-200 dark:border-rose-800/70',
    };
  }
  return {
    dot: 'bg-amber-500',
    text: 'text-amber-700 dark:text-amber-200',
    bg: 'bg-amber-50 dark:bg-amber-950/30',
    border: 'border-amber-200 dark:border-amber-800/70',
  };
}

function TakeActionMenu({ job }) {
  const buttonRef = useRef(null);
  const menuRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState({ top: 0, left: 0 });

  const openMenu = () => {
    const rect = buttonRef.current?.getBoundingClientRect();
    if (!rect) return;
    const width = 240;
    setCoords({
      top: rect.bottom + 8,
      left: Math.min(Math.max(12, rect.left), window.innerWidth - width - 12),
    });
    setOpen(true);
  };

  useEffect(() => {
    if (!open) return;
    const closeOnPointer = (event) => {
      if (menuRef.current?.contains(event.target) || buttonRef.current?.contains(event.target)) return;
      setOpen(false);
    };
    const closeOnKey = (event) => {
      if (event.key === 'Escape') setOpen(false);
    };
    const closeOnHash = () => setOpen(false);
    document.addEventListener('pointerdown', closeOnPointer, true);
    document.addEventListener('keydown', closeOnKey);
    window.addEventListener('hashchange', closeOnHash);
    window.addEventListener('resize', closeOnHash);
    return () => {
      document.removeEventListener('pointerdown', closeOnPointer, true);
      document.removeEventListener('keydown', closeOnKey);
      window.removeEventListener('hashchange', closeOnHash);
      window.removeEventListener('resize', closeOnHash);
    };
  }, [open]);

  const menu = open ? createPortal(
    h('div', { className: 'fixed inset-0 z-[2200] pointer-events-none', role: 'presentation' }, [
      h('div', {
        ref: menuRef,
        role: 'menu',
        className: 'pointer-events-auto absolute w-[240px] overflow-hidden rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 shadow-2xl',
        style: { top: `${coords.top}px`, left: `${coords.left}px` },
      }, ACTIONS.map((label) => {
        const active = job.activeActions.includes(label);
        return h(active ? 'button' : 'div', {
          key: label,
          type: active ? 'button' : undefined,
          role: 'menuitem',
          'aria-disabled': active ? undefined : 'true',
          className: [
            'w-full px-4 py-3 text-left text-sm',
            active
              ? 'text-slate-700 dark:text-slate-100 hover:bg-slate-50 dark:hover:bg-white/10'
              : 'cursor-not-allowed bg-slate-50/80 text-slate-400 dark:bg-white/[0.04] dark:text-slate-500',
          ].join(' '),
          onClick: active ? () => {
            setOpen(false);
            showPrototypeToast(`${label} saved for ${job.job}.`);
          } : undefined,
        }, [
          h('div', { className: 'font-semibold' }, label),
          !active ? h('div', { className: 'mt-0.5 text-xs leading-4 text-slate-400 dark:text-slate-500' }, job.disabledReason) : null,
        ]);
      })),
    ]),
    document.body
  ) : null;

  return h('div', { className: 'relative inline-flex' }, [
    h('button', {
      ref: buttonRef,
      type: 'button',
      'aria-haspopup': 'menu',
      'aria-expanded': open,
      className: 'inline-flex items-center justify-center rounded-full bg-[var(--color-brand-purple,#711FFF)] px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:brightness-110 focus:outline-none focus-visible:ring-2 focus-visible:ring-netnet-purple focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-slate-900',
      onClick: () => {
        if (open) {
          setOpen(false);
          return;
        }
        openMenu();
      },
    }, 'Take action'),
    menu,
  ]);
}

function JobCard({ job }) {
  const tone = statusClasses(job.tone);
  return h(PerfCard, { className: `space-y-4 ${tone.bg} ${tone.border}` }, [
    h('div', { className: 'flex items-start justify-between gap-3' }, [
      h('div', { className: 'space-y-1' }, [
        h('div', { className: 'flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-white' }, [
          h('span', { className: `h-2.5 w-2.5 rounded-full ${tone.dot}` }),
          h('span', null, job.client),
        ]),
        h('h3', { className: 'text-xl font-semibold text-slate-950 dark:text-white' }, job.job),
      ]),
      h('span', { className: 'shrink-0 rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 dark:border-white/10 dark:bg-slate-950 dark:text-slate-200' }, job.type),
    ]),
    h('p', { className: `text-sm leading-6 ${tone.text}` }, job.reason),
    job.label ? h('p', { className: 'inline-flex w-fit rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-600 dark:border-white/10 dark:bg-slate-950 dark:text-slate-300' }, job.label) : null,
    job.metricValue ? h('div', { className: 'rounded-xl border border-white/70 bg-white/80 p-3 dark:border-white/10 dark:bg-slate-950/60' }, [
      h('div', { className: 'text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400' }, job.metricLabel),
      h('div', { className: 'mt-1 text-2xl font-bold text-slate-950 dark:text-white' }, job.metricValue),
    ]) : null,
    h('div', { className: 'flex flex-wrap items-center gap-2 pt-1' }, [
      job.actionMode === 'menu'
        ? h(TakeActionMenu, { job })
        : h('button', {
          type: 'button',
          className: 'inline-flex items-center justify-center rounded-full bg-[var(--color-brand-purple,#711FFF)] px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:brightness-110 focus:outline-none focus-visible:ring-2 focus-visible:ring-netnet-purple focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-slate-900',
          onClick: () => showPrototypeToast(`${job.primaryAction} opened for ${job.job}.`),
        }, job.primaryAction),
      h('button', {
        type: 'button',
        className: 'inline-flex items-center justify-center rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-netnet-purple hover:text-netnet-purple dark:border-white/15 dark:bg-slate-950 dark:text-slate-100',
        onClick: () => showPrototypeToast(`Message started for ${job.client}.`),
      }, 'Message'),
    ]),
  ]);
}

export function TodayDashboard() {
  return h('div', { className: 'space-y-6' }, [
    h('div', { className: 'space-y-2' }, [
      h('p', { className: 'text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400' }, 'Owner view'),
      h('h1', { className: 'text-3xl font-semibold tracking-tight text-slate-950 dark:text-white' }, 'Today'),
      h('div', { className: 'grid gap-3 lg:grid-cols-[1.2fr_0.8fr]' }, [
        h(PerfCard, { className: 'space-y-2 p-6' }, [
          h('p', { className: 'text-sm font-semibold text-emerald-700 dark:text-emerald-200' }, 'Mostly current. 2 people have active work that has not been logged recently.'),
          h('p', { className: 'text-2xl font-semibold text-slate-950 dark:text-white' }, '3 jobs need a decision today.'),
          h('p', { className: 'text-base text-slate-600 dark:text-slate-300' }, 'The other 12 jobs are on track.'),
          h('p', { className: 'text-sm text-slate-500 dark:text-slate-400' }, 'Showing the top active Jobs that need a decision. Quiet Jobs are hidden.'),
        ]),
        h(PerfCard, { variant: 'secondary', className: 'space-y-2' }, [
          h('div', { className: 'text-sm font-semibold text-slate-900 dark:text-white' }, 'Capacity peek'),
          h('p', { className: 'text-sm leading-6 text-slate-600 dark:text-slate-300' }, 'Capacity details are next.'),
          h('button', {
            type: 'button',
            className: 'text-sm font-semibold text-[var(--color-brand-purple,#711FFF)] hover:underline',
            onClick: () => navigate('#/app/performance/capacity'),
          }, 'View Capacity'),
        ]),
      ]),
    ]),

    h('section', { className: 'space-y-3' }, [
      h(PerfSectionTitle, {
        title: 'Jobs that need you',
        subtitle: 'Showing the top 5 Jobs that need you.',
      }),
      h('div', { className: 'grid gap-4 lg:grid-cols-3' },
        JOBS_THAT_NEED_YOU.map((job) => h(JobCard, { key: job.id, job }))
      ),
      h(PerfCard, { variant: 'secondary', className: 'text-sm font-semibold text-emerald-700 dark:text-emerald-200' }, '12 more jobs, all on track.'),
    ]),

    h('section', { className: 'grid gap-4 lg:grid-cols-2' }, [
      h(PerfCard, { className: 'space-y-3' }, [
        h('h2', { className: 'text-lg font-semibold text-slate-950 dark:text-white' }, 'Coming up'),
        h('ul', { className: 'space-y-2 text-sm leading-6 text-slate-600 dark:text-slate-300' }, [
          h('li', null, '2 project deliverables are due in the next 2 days.'),
          h('li', null, '1 retainer cycle resets in 10 days.'),
          h('li', null, '1 Quick Task is due today.'),
        ]),
      ]),
      h(PerfCard, { className: 'space-y-3 border-slate-200 bg-slate-50/80 dark:bg-slate-900/60' }, [
        h('h2', { className: 'text-lg font-semibold text-slate-950 dark:text-white' }, 'Quick Tasks'),
        h('p', { className: 'text-base font-semibold text-slate-900 dark:text-white' }, '2 Quick Tasks need attention.'),
        h('p', { className: 'text-sm leading-6 text-slate-600 dark:text-slate-300' }, '1 is overdue. 1 is over LOE.'),
        h('button', {
          type: 'button',
          className: 'inline-flex items-center justify-center rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-netnet-purple hover:text-netnet-purple dark:border-white/15 dark:bg-slate-950 dark:text-slate-100',
          onClick: () => navigate('#/app/quick-tasks'),
        }, 'Review Quick Tasks'),
      ]),
    ]),
  ]);
}
