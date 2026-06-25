import { PerfCard, PerfSectionTitle } from '../../components/performance/primitives.js';

const { createElement: h } = React;

const SERVICE_TYPE_TRENDS = [
  {
    id: 'development',
    serviceType: 'Development',
    recent: '22% over first plan',
    prior: 'Before that: 34% over',
    evidence: '9 closed Deliverables · 240 planned hours',
    currentPlan: 'After approved changes: 8% over updated plan',
    percent: 22,
  },
  {
    id: 'design',
    serviceType: 'Design',
    recent: '10% over first plan',
    prior: 'Before that: 16% over',
    evidence: '7 closed Deliverables · 120 planned hours',
    currentPlan: 'After approved changes: 4% over updated plan',
    percent: 10,
  },
  {
    id: 'content',
    serviceType: 'Content',
    recent: '8% under first plan',
    prior: 'Before that: 4% under',
    evidence: '6 closed Deliverables · 80 planned hours',
    currentPlan: 'After approved changes: on plan',
    percent: 8,
  },
  {
    id: 'strategy',
    serviceType: 'Strategy',
    recent: 'On plan',
    prior: 'Before that: 6% over',
    evidence: '5 closed Deliverables · 60 planned hours',
    currentPlan: 'After approved changes: on plan',
    percent: 2,
  },
];

const CLOSED_DELIVERABLE_GAPS = [
  {
    id: 'brightline-website-rebuild',
    client: 'Brightline',
    job: 'Website rebuild',
    deliverable: 'Closed Deliverable',
    serviceTypes: [
      { id: 'development', name: 'Development', gap: '46h more than first plan · 18h more than updated plan' },
      { id: 'design', name: 'Design', gap: '22h more than first plan · 5h more than updated plan' },
    ],
    context: 'Approved changes added 45h.',
  },
  {
    id: 'northwind-cms-cleanup',
    client: 'Northwind',
    job: 'CMS cleanup',
    deliverable: 'Closed Deliverable',
    serviceTypes: [
      { id: 'development', name: 'Development', gap: '18h more than first plan · 18h more than updated plan' },
    ],
    context: 'No approved changes.',
  },
  {
    id: 'cedar-brand-refresh',
    client: 'Cedar & Co.',
    job: 'Brand refresh',
    deliverable: 'Closed, but tasks still open',
    serviceTypes: [
      { id: 'design', name: 'Design', gap: '16h under first plan' },
    ],
    context: 'Review whether this was faster work, reduced scope, or missing time.',
  },
];

function ServiceTypeTrends() {
  const maxPercent = Math.max(...SERVICE_TYPE_TRENDS.map((item) => item.percent));

  return h('section', { className: 'space-y-3' }, [
    h(PerfSectionTitle, {
      title: 'Service Type trends',
      subtitle: 'Compares the last 3 months with the 3 months before that.',
    }),
    h(PerfCard, { className: 'space-y-1 p-2 sm:p-3' },
      SERVICE_TYPE_TRENDS.map((item) => {
        const width = Math.max(10, Math.round((item.percent / maxPercent) * 100));
        return h('div', { key: item.id, className: 'grid gap-3 rounded-xl px-3 py-4 sm:grid-cols-[160px_1fr_230px] sm:items-center sm:px-4' }, [
          h('div', { className: 'space-y-1' }, [
            h('h3', { className: 'text-base font-semibold text-slate-950 dark:text-white' }, item.serviceType),
            h('p', { className: 'text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400' }, 'Closed Deliverables'),
          ]),
          h('div', { className: 'space-y-2' }, [
            h('div', { className: 'flex flex-wrap items-baseline justify-between gap-2' }, [
              h('div', { className: 'text-base font-semibold text-slate-950 dark:text-white' }, item.recent),
              h('div', { className: 'text-sm text-slate-500 dark:text-slate-400' }, item.prior),
            ]),
            h('div', { className: 'h-2 overflow-hidden rounded-sm bg-slate-200 dark:bg-slate-800' }, [
              h('div', {
                className: 'h-full rounded-sm bg-[#2563eb] dark:bg-[#3b82f6]',
                style: { width: `${width}%` },
              }),
            ]),
            h('p', { className: 'text-sm text-slate-600 dark:text-slate-300' }, item.evidence),
          ]),
          h('div', { className: 'rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-700 dark:bg-slate-950/60 dark:text-slate-200' }, item.currentPlan),
        ]);
      })
    ),
  ]);
}

function ClosedDeliverableCard({ row }) {
  return h('div', { className: 'grid gap-4 rounded-xl px-3 py-4 sm:grid-cols-[1fr_1.5fr_auto] sm:items-start sm:px-4' }, [
    h('div', { className: 'space-y-2' }, [
      h('div', { className: 'text-sm font-semibold text-slate-500 dark:text-slate-400' }, row.client),
      h('h3', { className: 'text-lg font-semibold text-slate-950 dark:text-white' }, row.job),
      h('span', { className: 'inline-flex rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-semibold text-slate-600 dark:border-white/10 dark:bg-slate-950 dark:text-slate-300' }, row.deliverable),
    ]),
    h('div', { className: 'space-y-3' }, [
      h('div', { className: 'grid gap-2' },
      row.serviceTypes.map((service) =>
        h('div', { key: service.id, className: 'rounded-lg bg-slate-50 px-3 py-2 dark:bg-slate-950/60' }, [
          h('div', { className: 'text-sm font-semibold text-slate-900 dark:text-white' }, service.name),
          h('div', { className: 'mt-1 text-sm leading-5 text-slate-600 dark:text-slate-300' }, service.gap),
        ])
      )
      ),
      h('div', { className: 'text-sm leading-6 text-slate-600 dark:text-slate-300' }, row.context),
    ]),
  ]);
}

function ClosedDeliverablesSection() {
  return h('section', { className: 'space-y-3' }, [
    h(PerfSectionTitle, {
      title: 'Closed Deliverables to review',
      subtitle: 'Shows where planned hours and logged time were farthest apart.',
    }),
    h(PerfCard, { className: 'divide-y divide-slate-200 p-2 dark:divide-white/10 sm:p-3' },
      CLOSED_DELIVERABLE_GAPS.map((row) => h(ClosedDeliverableCard, { key: row.id, row }))
    ),
  ]);
}

function DefinitionStrip() {
  const items = [
    { label: 'First plan', value: 'the original planned hours' },
    { label: 'Approved changes', value: 'updates to the plan' },
    { label: 'Logged time', value: 'what actually happened' },
  ];

  return h(PerfCard, { variant: 'secondary', className: 'grid gap-3 text-sm leading-6 text-slate-600 dark:text-slate-300 md:grid-cols-3' },
    items.map((item) =>
      h('div', { key: item.label, className: 'rounded-lg bg-white/70 px-3 py-2 dark:bg-slate-950/50' }, [
        h('div', { className: 'text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400' }, item.label),
        h('div', { className: 'mt-1 text-slate-700 dark:text-slate-200' }, item.value),
      ])
    )
  );
}

export function PlanVsActualDashboard() {
  return h('div', { className: 'space-y-6' }, [
    h('div', { className: 'space-y-3' }, [
      h('p', { className: 'text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400' }, 'Owner view'),
      h('div', { className: 'space-y-2' }, [
        h('h1', { className: 'text-3xl font-semibold tracking-tight text-slate-950 dark:text-white' }, 'Plan vs Actual'),
        h('p', { className: 'max-w-3xl text-sm leading-6 text-slate-600 dark:text-slate-300' }, 'When a Deliverable closes, Net Net compares planned hours to the time actually logged by Service Type.'),
        h('p', { className: 'max-w-3xl text-sm font-semibold leading-6 text-slate-700 dark:text-slate-200' }, 'Recently closed work may still change if someone adds time.'),
      ]),
    ]),

    h('section', { className: 'grid gap-4 lg:grid-cols-[1.4fr_0.9fr]' }, [
      h(PerfCard, { className: 'space-y-5 p-6' }, [
        h('div', { className: 'space-y-2' }, [
          h('p', { className: 'text-2xl font-semibold text-slate-950 dark:text-white' }, 'Service Type plans are getting closer.'),
          h('p', { className: 'text-base leading-7 text-slate-600 dark:text-slate-300' }, 'In closed Deliverables from the last 3 months, logged time was 22% higher than the first plan. After approved changes, it was 8% higher than the updated plan.'),
        ]),
        h('div', { className: 'flex flex-wrap gap-2' }, [
          h('span', { className: 'rounded-full bg-[#2563eb]/10 px-3 py-1.5 text-sm font-semibold text-[#1d4ed8] dark:bg-[#3b82f6]/15 dark:text-[#93c5fd]' }, '22% over first plan'),
          h('span', { className: 'rounded-full bg-slate-100 px-3 py-1.5 text-sm font-semibold text-slate-700 dark:bg-slate-950 dark:text-slate-200' }, '8% over updated plan'),
        ]),
      ]),
      h(PerfCard, { variant: 'secondary', className: 'space-y-2 p-6' }, [
        h('p', { className: 'text-lg font-semibold text-slate-950 dark:text-white' }, 'Approved changes changed the plan'),
        h('p', { className: 'text-sm leading-6 text-slate-600 dark:text-slate-300' }, 'Change Orders added 14% more planned Service Type hours in the last 3 months.'),
      ]),
    ]),

    h(ServiceTypeTrends),

    h(ClosedDeliverablesSection),

    h(PerfCard, { variant: 'secondary', className: 'text-sm leading-6 text-slate-600 dark:text-slate-300' },
      'We can add Deliverable Type trends later once Deliverables are labeled consistently.'
    ),

    h(DefinitionStrip),
  ]);
}
