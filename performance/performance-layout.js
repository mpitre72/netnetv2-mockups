import { SectionHeader } from '../components/layout/SectionHeader.js';
import { PerfCard } from '../components/performance/primitives.js';

const { createElement: h } = React;

const NAV_ITEMS = [
  { key: 'overview', label: 'Overview', href: '#/app/performance/overview' },
  { key: 'at-risk-deliverables', label: 'At-Risk Deliverables', href: '#/app/performance/at-risk-deliverables' },
  { key: 'capacity', label: 'Capacity & Forecast', href: '#/app/performance/capacity?horizonDays=30' },
  { key: 'jobs-at-risk', label: 'Jobs at Risk', href: '#/app/performance/jobs-at-risk' },
  { key: 'reports', label: 'Reports', href: '#/app/performance/reports/time' },
];

function PerformanceNav({ activeKey }) {
  return h(
    'div',
    { className: 'flex flex-wrap gap-2' },
    NAV_ITEMS.map((item) => {
      const isActive = activeKey === item.key;
      const base =
        'inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-semibold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:ring-netnet-purple focus-visible:ring-offset-white dark:focus-visible:ring-offset-slate-900';
      const activeClasses = 'bg-[var(--color-brand-purple,#711FFF)] text-white border-transparent shadow-sm';
      const idleClasses =
        'bg-white dark:bg-slate-900 border-slate-300 dark:border-white/15 text-slate-700 dark:text-slate-100 hover:border-netnet-purple/60 hover:text-netnet-purple';
      return h(
        'a',
        {
          key: item.key,
          href: item.href,
          className: `${base} ${isActive ? activeClasses : idleClasses}`,
        },
        item.label
      );
    })
  );
}

export function PerformanceLayout({ activeKey = 'overview', children }) {
  return h('div', { className: 'space-y-6' }, [
    h(
      'div',
      { className: 'space-y-3' },
      h(SectionHeader, {
        title: 'Performance — Drift & Flow',
        showSecondaryRow: false,
        className: 'mb-2',
      })
    ),
    h(PerfCard, { variant: 'secondary', className: 'space-y-3' }, [
      h('div', { className: 'text-xs text-slate-500 dark:text-slate-400' }, 'Performance prototype: Drift & Flow baseline with reports intact.'),
      h(PerformanceNav, { activeKey }),
    ]),
    children,
  ]);
}
