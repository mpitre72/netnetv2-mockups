import { navigate } from '../../router.js';
import { PerfCard, PerfSectionTitle } from '../../components/performance/primitives.js';

const { createElement: h, useState } = React;

const SUPPORT_CARDS = [
  {
    id: 'noor',
    name: 'Noor Ahmed',
    role: 'Development',
    signal: '2 assigned tasks are overdue.',
    action: 'Review tasks',
    href: '#/app/me/tasks',
  },
  {
    id: 'ravi',
    name: 'Ravi Mehta',
    role: 'Development',
    signal: '42 of 40h spoken for this month.',
    action: 'Review capacity',
    href: '#/app/performance/capacity',
  },
];

const QUIET_PEOPLE = [
  { id: 'dana', name: 'Dana Kim', role: 'Design' },
  { id: 'marc', name: 'Marc Pitre', role: 'Owner' },
  { id: 'arthur', name: 'Arthur Iturres', role: 'Development' },
  { id: 'kumail', name: 'Kumail Abas', role: 'Design' },
  { id: 'mina', name: 'Mina Rivera', role: 'Research' },
  { id: 'sasha', name: 'Sasha Lee', role: 'QA' },
];

function SupportCard({ person }) {
  return h(PerfCard, { className: 'space-y-4' }, [
    h('div', { className: 'space-y-1' }, [
      h('h3', { className: 'text-xl font-semibold text-slate-950 dark:text-white' }, person.name),
      h('p', { className: 'text-sm font-semibold text-slate-500 dark:text-slate-400' }, person.role),
    ]),
    h('p', { className: 'text-sm leading-6 text-slate-700 dark:text-slate-200' }, person.signal),
    h('button', {
      type: 'button',
      className: 'inline-flex items-center justify-center rounded-full bg-[var(--color-brand-purple,#711FFF)] px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:brightness-110 focus:outline-none focus-visible:ring-2 focus-visible:ring-netnet-purple focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-slate-900',
      onClick: () => navigate(person.href),
    }, person.action),
  ]);
}

export function TeamDashboard() {
  const [showAll, setShowAll] = useState(false);

  return h('div', { className: 'space-y-6' }, [
    h('div', { className: 'space-y-3' }, [
      h('p', { className: 'text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400' }, 'Owner view'),
      h('div', { className: 'space-y-2' }, [
        h('h1', { className: 'text-3xl font-semibold tracking-tight text-slate-950 dark:text-white' }, 'Team'),
        h('p', { className: 'text-sm font-semibold text-[var(--color-brand-purple,#711FFF)]' }, 'Team Support'),
        h('p', { className: 'max-w-3xl text-sm leading-6 text-slate-600 dark:text-slate-300' }, 'Support surface only. Performance and estimate patterns are handled separately.'),
        h('p', { className: 'max-w-3xl text-sm font-semibold leading-6 text-slate-700 dark:text-slate-200' }, 'Some active work has not been logged recently, so Team signals may be incomplete.'),
      ]),
    ]),

    h(PerfCard, { className: 'space-y-2 p-6' }, [
      h('p', { className: 'text-2xl font-semibold text-slate-950 dark:text-white' }, '2 people may need a check-in.'),
      h('p', { className: 'text-base text-slate-600 dark:text-slate-300' }, '5 more people have no active support signals.'),
    ]),

    h('section', { className: 'space-y-3' }, [
      h(PerfSectionTitle, { title: 'People to check in with' }),
      h('div', { className: 'grid gap-4 lg:grid-cols-3' },
        SUPPORT_CARDS.map((person) => h(SupportCard, { key: person.id, person }))
      ),
      h(PerfCard, { variant: 'secondary', className: 'flex flex-wrap items-center justify-between gap-3 text-sm' }, [
        h('span', { className: 'font-semibold text-slate-700 dark:text-slate-200' }, '5 more people have no active support signals.'),
        h('button', {
          type: 'button',
          className: 'font-semibold text-[var(--color-brand-purple,#711FFF)] hover:underline',
          onClick: () => setShowAll((value) => !value),
        }, showAll ? 'Hide all' : 'View all'),
      ]),
    ]),

    showAll ? h('section', { className: 'space-y-3' }, [
      h('h2', { className: 'text-lg font-semibold text-slate-950 dark:text-white' }, 'Other people'),
      h(PerfCard, { className: 'grid gap-2 sm:grid-cols-2 lg:grid-cols-3' },
        QUIET_PEOPLE.map((person) =>
          h('div', { key: person.id, className: 'rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 dark:border-white/10 dark:bg-slate-950/60' }, [
            h('div', { className: 'text-sm font-semibold text-slate-900 dark:text-white' }, person.name),
            h('div', { className: 'text-xs text-slate-500 dark:text-slate-400' }, person.role),
            h('div', { className: 'mt-1 text-xs text-slate-600 dark:text-slate-300' }, 'No active support signals.'),
          ])
        )
      ),
    ]) : null,

    h(PerfCard, { variant: 'secondary', className: 'text-sm leading-6 text-slate-600 dark:text-slate-300' },
      'Support signals come from active tasks, overdue work, time recency, and measured capacity.'
    ),
  ]);
}
