import { PerfCard, PerfSectionTitle } from '../../components/performance/primitives.js';

const { createElement: h, useState } = React;

const CAPACITY_MONTHS = {
  this: {
    label: 'This month',
    headline: '34h open in measured capacity. Some work is not counted.',
    summary: '126 of 160 measured hours are spoken for.',
    knownLoadNote: 'Known load includes time already logged this month plus committed remaining work paced through due dates.',
    people: [
      { id: 'dana', name: 'Dana Kim', role: 'Development', capacity: 40, spokenFor: 46, line: '46 of 40h spoken for · 6h over' },
      { id: 'noor', name: 'Noor Ahmed', role: 'Design', capacity: 40, spokenFor: 38, line: '38 of 40h spoken for · 2h open' },
      { id: 'marc', name: 'Marc Pitre', role: 'Owner', capacity: 40, spokenFor: 24, line: '24 of 40h spoken for · 16h open' },
      { id: 'ravi', name: 'Ravi Mehta', role: 'Support', capacity: null, spokenFor: 14, line: 'Capacity not set · 14h spoken for', note: 'Not included in measured capacity.' },
    ],
    notCounted: 'What’s not counted: 22h assigned to people without capacity, 18h unassigned, 40h retainer work not planned yet, 5 tasks missing estimates.',
    notCountedDetails: [
      { label: 'Capacity not set', value: '22h assigned to people without capacity' },
      { label: 'Unassigned demand', value: '18h unassigned' },
      { label: 'Retainer work not planned yet', value: '40h committed cycle work not assigned to tasks' },
      { label: 'Unknown work', value: '5 tasks missing estimates' },
    ],
  },
  next: {
    label: 'Next month',
    headline: '58h open next month. 102 of 160 measured hours are spoken for.',
    summary: 'Next month shows known committed work only.',
    knownLoadNote: 'Known load includes committed remaining work paced through due dates.',
    people: [
      { id: 'dana', name: 'Dana Kim', role: 'Development', capacity: 40, spokenFor: 34, line: '34 of 40h spoken for · 6h open' },
      { id: 'noor', name: 'Noor Ahmed', role: 'Design', capacity: 40, spokenFor: 28, line: '28 of 40h spoken for · 12h open' },
      { id: 'marc', name: 'Marc Pitre', role: 'Owner', capacity: 40, spokenFor: 22, line: '22 of 40h spoken for · 18h open' },
      { id: 'ravi', name: 'Ravi Mehta', role: 'Support', capacity: null, spokenFor: 10, line: 'Capacity not set · 10h spoken for', note: 'Not included in measured capacity.' },
    ],
    notCounted: 'What’s not counted: 30h retainer work not planned yet, 12h unassigned, 3 tasks missing dates.',
    notCountedDetails: [
      { label: 'Retainer work not planned yet', value: '30h committed cycle work not assigned to tasks' },
      { label: 'Unassigned demand', value: '12h unassigned' },
      { label: 'Unknown work', value: '3 tasks missing dates' },
    ],
  },
};

function MonthToggle({ value, onChange }) {
  return h('div', { className: 'inline-flex rounded-full border border-slate-300 bg-white p-1 shadow-sm dark:border-white/10 dark:bg-slate-900' },
    Object.entries(CAPACITY_MONTHS).map(([key, item]) => {
      const active = key === value;
      return h('button', {
        key,
        type: 'button',
        className: [
          'rounded-full px-4 py-2 text-sm font-semibold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-netnet-purple',
          active
            ? 'bg-[var(--color-brand-purple,#711FFF)] text-white shadow-sm'
            : 'text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-white/10',
        ].join(' '),
        onClick: () => onChange(key),
      }, item.label);
    })
  );
}

function CapacityBar({ person }) {
  if (!person.capacity) {
    return h('div', { className: 'mt-3 h-3 rounded-sm border border-dashed border-slate-300 bg-slate-50 dark:border-white/15 dark:bg-slate-950' });
  }
  const fill = Math.min(100, Math.round((person.spokenFor / person.capacity) * 100));
  return h('div', { className: 'mt-3 h-3 overflow-hidden rounded-sm bg-slate-200 dark:bg-slate-800' }, [
    h('div', {
      className: 'h-full rounded-sm bg-[#2563eb] dark:bg-[#3b82f6]',
      style: { width: `${fill}%` },
    }),
  ]);
}

function PersonRow({ person }) {
  return h('div', { className: 'rounded-xl border border-slate-200 bg-white p-4 dark:border-white/10 dark:bg-slate-900/80' }, [
    h('div', { className: 'flex flex-wrap items-start justify-between gap-3' }, [
      h('div', null, [
        h('div', { className: 'text-base font-semibold text-slate-950 dark:text-white' }, person.name),
        person.role ? h('div', { className: 'text-sm text-slate-500 dark:text-slate-400' }, person.role) : null,
      ]),
      h('div', { className: 'text-sm font-semibold text-slate-700 dark:text-slate-200' }, person.line),
    ]),
    h(CapacityBar, { person }),
    person.note ? h('div', { className: 'mt-2 text-xs font-semibold text-slate-500 dark:text-slate-400' }, person.note) : null,
  ]);
}

function NotCountedPanel({ data }) {
  const [expanded, setExpanded] = useState(false);

  return h(PerfCard, { className: 'space-y-3' }, [
    h('div', { className: 'flex flex-wrap items-center justify-between gap-3' }, [
      h('p', { className: 'text-sm font-semibold text-slate-800 dark:text-slate-100' }, data.notCounted),
      h('button', {
        type: 'button',
        className: 'rounded-full border border-slate-300 bg-white px-3 py-1.5 text-sm font-semibold text-slate-700 transition hover:border-netnet-purple hover:text-netnet-purple dark:border-white/15 dark:bg-slate-950 dark:text-slate-100',
        onClick: () => setExpanded((value) => !value),
      }, expanded ? 'Hide details' : 'View details'),
    ]),
    expanded ? h('div', { className: 'grid gap-3 md:grid-cols-2' },
      data.notCountedDetails.map((item) =>
        h('div', { key: item.label, className: 'rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-white/10 dark:bg-slate-950/60' }, [
          h('div', { className: 'text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400' }, item.label),
          h('div', { className: 'mt-1 text-sm text-slate-700 dark:text-slate-200' }, item.value),
        ])
      )
    ) : null,
  ]);
}

export function CapacityDashboard() {
  const [monthKey, setMonthKey] = useState('this');
  const data = CAPACITY_MONTHS[monthKey] || CAPACITY_MONTHS.this;

  return h('div', { className: 'space-y-6' }, [
    h('div', { className: 'space-y-3' }, [
      h('p', { className: 'text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400' }, 'Owner view'),
      h('div', { className: 'flex flex-wrap items-end justify-between gap-4' }, [
        h('div', { className: 'space-y-2' }, [
          h('h1', { className: 'text-3xl font-semibold tracking-tight text-slate-950 dark:text-white' }, 'Capacity'),
          h('p', { className: 'max-w-3xl text-sm leading-6 text-slate-600 dark:text-slate-300' }, 'Based on each person’s monthly capacity setting. Time off and holidays are not included yet.'),
        ]),
        h(MonthToggle, { value: monthKey, onChange: setMonthKey }),
      ]),
    ]),

    h(PerfCard, { className: 'space-y-3 p-6' }, [
      h('p', { className: 'text-2xl font-semibold text-slate-950 dark:text-white' }, data.headline),
      h('p', { className: 'text-base text-slate-600 dark:text-slate-300' }, data.summary),
      h('p', { className: 'text-sm text-slate-500 dark:text-slate-400' }, data.knownLoadNote),
    ]),

    h('section', { className: 'space-y-3' }, [
      h(PerfSectionTitle, {
        title: 'People',
        subtitle: 'Sorted tightest first. Bars show measured monthly capacity only.',
      }),
      h('div', { className: 'grid gap-3' }, data.people.map((person) => h(PersonRow, { key: person.id, person }))),
    ]),

    h(NotCountedPanel, { data }),
  ]);
}
