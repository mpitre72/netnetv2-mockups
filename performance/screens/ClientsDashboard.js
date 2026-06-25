import { PerfCard, PerfSectionTitle } from '../../components/performance/primitives.js';

const { createElement: h, useState } = React;

const CLIENTS_THAT_NEED_YOU = [
  {
    id: 'brightline',
    name: 'Brightline',
    count: '3 active Jobs · 1 Quick Task',
    reason: 'Website rebuild has one deliverable over plan. One Quick Task is overdue.',
    action: 'View Client Work',
    tone: 'red',
  },
  {
    id: 'vela-outdoors',
    name: 'Vela Outdoors',
    count: '1 Retainer',
    reason: 'This retainer cycle has used 82% of planned hours in week 2.',
    action: 'View Client Work',
    tone: 'amber',
  },
  {
    id: 'northwind',
    name: 'Northwind',
    count: '2 active Jobs',
    reason: '1 job needs attention. The other is steady.',
    action: 'View Client Work',
    tone: 'amber',
  },
  {
    id: 'cedar-co',
    name: 'Cedar & Co.',
    count: '2 active Jobs',
    reason: 'One task has no assignee before its deliverable is due.',
    action: 'View Client Work',
    tone: 'amber',
  },
];

const STEADY_CLIENTS = [
  'Atlas Studio',
  'Bluebird Health',
  'Clover Labs',
  'Evergreen Supply',
  'Fieldstone Market',
  'Harborline',
  'Juniper House',
  'Morrow Works',
  'Slate & Pine',
];

function showPrototypeToast(message) {
  if (typeof window !== 'undefined' && typeof window.showToast === 'function') {
    window.showToast(message);
  }
}

function toneClasses(tone) {
  if (tone === 'red') {
    return {
      dot: 'bg-rose-500',
      bg: 'bg-rose-50 dark:bg-rose-950/30',
      border: 'border-rose-200 dark:border-rose-800/70',
      text: 'text-rose-700 dark:text-rose-200',
    };
  }
  return {
    dot: 'bg-amber-500',
    bg: 'bg-amber-50 dark:bg-amber-950/30',
    border: 'border-amber-200 dark:border-amber-800/70',
    text: 'text-amber-700 dark:text-amber-200',
  };
}

function ClientCard({ client }) {
  const tone = toneClasses(client.tone);
  return h(PerfCard, { className: `space-y-4 ${tone.bg} ${tone.border}` }, [
    h('div', { className: 'flex items-start justify-between gap-3' }, [
      h('div', { className: 'space-y-1' }, [
        h('div', { className: 'flex items-center gap-2' }, [
          h('span', { className: `h-2.5 w-2.5 rounded-full ${tone.dot}` }),
          h('h3', { className: 'text-xl font-semibold text-slate-950 dark:text-white' }, client.name),
        ]),
        h('p', { className: 'text-sm font-semibold text-slate-600 dark:text-slate-300' }, client.count),
      ]),
    ]),
    h('p', { className: `text-sm leading-6 ${tone.text}` }, client.reason),
    h('button', {
      type: 'button',
      className: 'inline-flex items-center justify-center rounded-full bg-[var(--color-brand-purple,#711FFF)] px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:brightness-110 focus:outline-none focus-visible:ring-2 focus-visible:ring-netnet-purple focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-slate-900',
      onClick: () => showPrototypeToast(`${client.action} opened for ${client.name}.`),
    }, client.action),
  ]);
}

export function ClientsDashboard() {
  const [showAll, setShowAll] = useState(false);

  return h('div', { className: 'space-y-6' }, [
    h('div', { className: 'space-y-2' }, [
      h('p', { className: 'text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400' }, 'Owner view'),
      h('h1', { className: 'text-3xl font-semibold tracking-tight text-slate-950 dark:text-white' }, 'Clients'),
      h(PerfCard, { className: 'space-y-2 p-6' }, [
        h('p', { className: 'text-2xl font-semibold text-slate-950 dark:text-white' }, '4 clients need attention.'),
        h('p', { className: 'text-base text-slate-600 dark:text-slate-300' }, '9 client relationships are steady.'),
      ]),
    ]),

    h('section', { className: 'space-y-3' }, [
      h(PerfSectionTitle, { title: 'Clients that need you' }),
      h('div', { className: 'grid gap-4 lg:grid-cols-2' },
        CLIENTS_THAT_NEED_YOU.map((client) => h(ClientCard, { key: client.id, client }))
      ),
      h(PerfCard, { variant: 'secondary', className: 'flex flex-wrap items-center justify-between gap-3 text-sm' }, [
        h('span', { className: 'font-semibold text-emerald-700 dark:text-emerald-200' }, '9 more clients with active work are steady.'),
        h('button', {
          type: 'button',
          className: 'font-semibold text-[var(--color-brand-purple,#711FFF)] hover:underline',
          onClick: () => setShowAll((value) => !value),
        }, showAll ? 'Hide steady clients' : 'View all'),
      ]),
    ]),

    showAll ? h('section', { className: 'space-y-3' }, [
      h('h2', { className: 'text-lg font-semibold text-slate-950 dark:text-white' }, 'Steady clients'),
      h(PerfCard, { className: 'grid gap-2 sm:grid-cols-2 lg:grid-cols-3' },
        STEADY_CLIENTS.map((client) =>
          h('div', { key: client, className: 'flex items-center gap-2 rounded-lg border border-emerald-100 bg-emerald-50/70 px-3 py-2 text-sm font-semibold text-emerald-800 dark:border-emerald-800/60 dark:bg-emerald-950/20 dark:text-emerald-200' }, [
            h('span', { className: 'h-2 w-2 rounded-full bg-emerald-500' }),
            h('span', null, client),
          ])
        )
      ),
    ]) : null,
  ]);
}
