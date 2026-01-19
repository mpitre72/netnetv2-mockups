import { netnetLogos, navIcons, socialIcons, timeIcons } from './app-shell/app-icons-config.js';
import { Section } from './components/Section.js';
import { NetNetLogo } from './components/NetNetLogo.js';
import { NavIcon } from './components/NavIcon.js';
import { SocialIcon } from './components/SocialIcon.js';
import { NetNetButton } from './components/NetNetButton.js';
import { Tabs, Tab, NewTabButton } from './components/navigation/tabs.js';
import { TopBarChromeDemo } from './components/navigation/top-bar.js';
import { EffortTimelineMeterReact } from './components/metrics/effort-timeline-meter.js';
import { SectionHeader } from './components/layout/SectionHeader.js';
import { KPIBox, StackedMeter, RowActionsMenu, MovedDateIndicator, FilterChips, ProgressConfidenceChip, ReviewedBadge, DriftReasonChips } from './components/performance/primitives.js';
import { FlowMeterGallery, getStateFromScore } from './components/performance/flow-meter-gallery.js';

const { createElement: h, useState } = React;
const { createRoot } = ReactDOM;

const cardBase = 'rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 shadow-sm';

function LogoGrid() {
  const items = [
    { key: 'light-idle', label: 'Light / Idle', src: netnetLogos.light?.idle, alt: 'Net Net logo – light / idle' },
    { key: 'dark-idle', label: 'Dark / Idle', src: netnetLogos.dark?.idle, alt: 'Net Net logo – dark / idle' },
  ];
  return h(
    'div',
    { className: 'grid grid-cols-2 gap-6' },
    items.map((item) =>
      h(
        'div',
        {
          key: item.key,
          className: `${cardBase} p-5 flex flex-col items-center gap-3`,
        },
        [
          h(NetNetLogo, { src: item.src, alt: item.alt, size: 'lg' }),
          h('div', { className: 'text-xs font-semibold tracking-wide uppercase text-slate-500 dark:text-white/60 text-center' }, item.label),
          item.key === 'dark-idle'
            ? h('div', { className: 'text-[11px] text-slate-500 dark:text-white/60 text-center' }, 'Used in top purple bar')
            : null,
        ]
      )
    )
  );
}

function NavIconGrid() {
  const sections = ['me', 'bot', 'contacts', 'sales', 'jobs', 'quickTasks', 'chat', 'performance', 'netNetU'];
  const themes = ['light', 'dark'];
  const labels = {
    me: 'Me',
    bot: 'Net Net',
    contacts: 'Contacts',
    sales: 'Sales',
    jobs: 'Jobs',
    quickTasks: 'Quick Tasks',
    chat: 'Chat',
    performance: 'Performance',
    netNetU: 'Net Net U',
  };
  return h(
    'div',
    { className: 'space-y-4' },
    themes.map((mode) =>
      h(
        'div',
        { key: mode, className: `${cardBase} p-4` },
        [
          h('div', { className: 'text-sm font-semibold mb-3 text-slate-700 dark:text-white capitalize' }, `${mode} theme`),
          h(
            'div',
            { className: 'grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4' },
            sections.map((section) => {
              const alignClass = section === 'performance' ? 'items-end' : 'items-center';
              const entry = navIcons[section];
              const idleSrc = entry?.[mode]?.idle;
              const activeSrc = entry?.[mode]?.active;
              const label = labels[section] || section;
              return h(
                'div',
                {
                  key: `${mode}-${section}`,
                  className: `flex ${alignClass} gap-3 rounded-lg border border-slate-100 dark:border-white/5 p-3`,
                },
                [
                  h('div', { className: 'flex items-center gap-2' }, [
                    h(NavIcon, { src: idleSrc, alt: `${label} icon (${mode})`, size: 'md' }),
                    h(NavIcon, { src: activeSrc, alt: `${label} icon (${mode} active)`, size: 'md' }),
                  ]),
                  h(
                    'span',
                    { className: 'text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-white/60' },
                    label
                  ),
                ]
              );
            })
          ),
        ]
      )
    )
  );
}

function SocialIconsRow() {
  const socialNetworks = ['linkedin', 'x', 'facebook', 'instagram', 'youtube', 'tiktok', 'whatsapp', 'snapchat', 'threads', 'reddit', 'pinterest'];
  const socialLabels = {
    linkedin: 'LinkedIn',
    x: 'X',
    facebook: 'Facebook',
    instagram: 'Instagram',
    youtube: 'YouTube',
    tiktok: 'TikTok',
    whatsapp: 'WhatsApp',
    snapchat: 'Snapchat',
    threads: 'Threads',
    reddit: 'Reddit',
    pinterest: 'Pinterest',
  };
  const utilityIcons = [
    { key: 'website', label: 'Website' },
    { key: 'personalWebsite', label: 'Personal Website' },
    { key: 'email', label: 'Email' },
  ];
  return h(
    'div',
    { className: 'grid grid-cols-1 gap-6' },
    [
      h(
        'div',
        { className: `${cardBase} p-4 bg-white dark:bg-slate-900 text-slate-700 dark:text-white` },
        [
          h('div', { className: 'text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400 mb-3' }, 'Social'),
          h(
            'div',
            { className: 'social-icons-row' },
            socialNetworks.map((network) =>
              h(
                'div',
                { key: `social-${network}`, className: 'icon-stack' },
                [
                  h(SocialIcon, { src: socialIcons[network]?.light, alt: socialLabels[network] || network }),
                  h('span', { className: 'text-[11px] text-slate-500 dark:text-slate-300' }, socialLabels[network] || network),
                ]
              )
            )
          ),
          h('div', { className: 'text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400 mt-6 mb-3' }, 'Contact / Utility'),
          h(
            'div',
            { className: 'social-icons-row' },
            utilityIcons.map((item) =>
              h(
                'div',
                { key: item.key, className: 'icon-stack' },
                [
                  h(SocialIcon, { src: socialIcons[item.key]?.light, alt: item.label }),
                  h('span', { className: 'icon-label' }, item.label),
                ]
              )
            )
          ),
        ]
      ),
    ]
  );
}

function ChromeButton({ label, icon, state = 'default', size = 'full' }) {
  const sizeClass = size === 'mini' ? 'nn-btn--mini' : 'nn-btn--full';
  const stateClass = state === 'disabled' ? 'opacity-50 cursor-not-allowed' : state === 'active' ? 'translate-y-[1px]' : '';
  return h(
    'div',
    { className: 'flex items-center gap-2' },
    [
      h(
        'button',
        {
          type: 'button',
          className: ['nn-btn', sizeClass, stateClass].filter(Boolean).join(' '),
          disabled: state === 'disabled',
        },
        size === 'mini'
          ? [icon]
          : [
              icon,
              h('span', { className: 'text-sm font-semibold whitespace-nowrap' }, label),
            ]
      ),
    ]
  );
}

function ChromeButtonsRow() {
  const buttons = [
    {
      label: 'Add Company',
      state: 'default',
      icon: h('svg', { className: 'w-5 h-5', viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: '1.6' }, [
        h('path', { strokeLinecap: 'round', strokeLinejoin: 'round', d: 'M3 21h18M6 21V8a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v13M9 21v-4h6v4M9 12h6M9 9h6' }),
      ]),
    },
    {
      label: 'Add Person',
      state: 'hover',
      icon: h('svg', { className: 'w-5 h-5', viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: '1.6' }, [
        h('path', { strokeLinecap: 'round', strokeLinejoin: 'round', d: 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2' }),
        h('circle', { cx: '9', cy: '7', r: '4' }),
        h('path', { strokeLinecap: 'round', strokeLinejoin: 'round', d: 'M17 11v6m3-3h-6' }),
      ]),
    },
    {
      label: 'Upload',
      state: 'active',
      icon: h('svg', { className: 'w-5 h-5 transform rotate-180', viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: '1.6' }, [
        h('path', { strokeLinecap: 'round', strokeLinejoin: 'round', d: 'M12 3v12m0 0 4-4m-4 4-4-4m-6 8h20' }),
      ]),
    },
  ];
  return h(
    'div',
    { className: `${cardBase} p-4 flex flex-col gap-4` },
    [
      h('div', { className: 'flex items-center gap-3' }, [
        h('span', { className: 'text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400' }, 'Micro'),
        h('div', { className: 'nn-btn-row' }, [
          h(
            'button',
            { type: 'button', className: 'header-icon-button header-icon-button--small nn-btn nn-btn--micro' },
            h('svg', { className: 'header-icon-glyph-small', viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: '2' }, [
              h('circle', { cx: '12', cy: '12', r: '10' }),
              h('path', { d: 'M9.5 9a2.5 2.5 0 1 1 3.5 2.3c-.7.3-1 1-1 1.7V14' }),
              h('circle', { cx: '12', cy: '17', r: '1' }),
            ])
          ),
          h(
            'button',
            { type: 'button', className: 'header-icon-button header-icon-button--small nn-btn nn-btn--micro' },
            h('svg', { className: 'header-icon-glyph-small', viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: '1.8' }, [
              h('path', { d: 'M18 8a6 6 0 10-12 0c0 7-3 9-3 9h18s-3-2-3-9' }),
              h('path', { d: 'M13.73 21a2 2 0 01-3.46 0' }),
            ])
          ),
          h(
            'button',
            { type: 'button', className: 'header-icon-button header-icon-button--small nn-btn nn-btn--micro' },
            h('svg', { className: 'header-icon-glyph-small', viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: '1.8' }, [
              h('circle', { cx: '12', cy: '12', r: '4' }),
              h('path', { d: 'M12 1v3M12 20v3M4.22 4.22l2.12 2.12M17.66 17.66l2.12 2.12M1 12h3M20 12h3M4.22 19.78l2.12-2.12M17.66 6.34l2.12-2.12' }),
            ])
          ),
        ]),
      ]),
      h(
        'div',
        { className: 'flex items-center gap-3' },
        [
          h('span', { className: 'text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400' }, 'Mini'),
          h('div', { className: 'nn-btn-row' }, [
            h(ChromeButton, { label: 'Add Company', icon: buttons[0].icon, state: buttons[0].state, size: 'mini' }),
            h(ChromeButton, { label: 'Add Person', icon: buttons[1].icon, state: buttons[1].state, size: 'mini' }),
            h(ChromeButton, { label: 'Upload', icon: buttons[2].icon, state: buttons[2].state, size: 'mini' }),
          ]),
        ]
      ),
      h('div', { className: 'flex items-center gap-3' }, [
        h('span', { className: 'text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400' }, 'Full'),
        h('div', { className: 'nn-btn-row' },
          buttons.map((btn) => h(ChromeButton, { key: `full-${btn.label}`, label: btn.label, icon: btn.icon, state: btn.state, size: 'full' }))
        ),
      ]),
    ]
  );
}

function ButtonsGrid() {
  const variants = ['primary', 'secondary', 'ghost', 'icon'];
  const states = ['default', 'hover', 'active', 'disabled'];
  return h(
    'div',
    { className: 'space-y-3' },
    variants.map((variant) =>
      h(
        'div',
        { key: variant, className: `${cardBase} flex flex-wrap items-center gap-3 p-4` },
        [
          h('div', { className: 'w-32 text-sm font-semibold text-slate-700 dark:text-white capitalize' }, variant),
          ...states.map((state) =>
            h(NetNetButton, {
              key: `${variant}-${state}`,
              variant,
              state,
              label: state === 'default' ? 'Default' : state[0].toUpperCase() + state.slice(1),
              icon: variant === 'icon' ? h('span', { className: 'text-lg' }, '★') : null,
            })
          ),
        ]
      )
    )
  );
}

function EffortTimelineDocs() {
  const samples = [
    { key: 'balanced', label: 'Balanced job', effort: 72, timeline: 68, summary: '144/200h' },
    { key: 'risk', label: 'At risk', effort: 108, timeline: 97, summary: '108/100h' },
    { key: 'timeline', label: 'Timeline tight', effort: 82, timeline: 94, summary: '82/100h' },
  ];

  return h(
    'div',
    { className: 'space-y-4' },
    [
      h('p', { className: 'text-sm text-slate-600 dark:text-white/70' }, 'Reusable stacked meter: Effort on top, Timeline on bottom. Colors shift at 85% and 100% to highlight risk.'),
      h(
        'div',
        { className: 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4' },
        samples.map((sample) =>
          h(
            'div',
            { key: sample.key, className: `${cardBase} p-4 space-y-3` },
            [
              h('div', { className: 'text-sm font-semibold text-slate-800 dark:text-white' }, sample.label),
              h(EffortTimelineMeterReact, {
                effortPercent: sample.effort,
                timelinePercent: sample.timeline,
                summaryText: sample.summary,
              }),
            ]
          )
        )
      ),
      h(
        'div',
        { className: `${cardBase} p-4 space-y-2` },
        [
          h('div', { className: 'text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400 font-semibold' }, 'Props'),
          h(
            'ul',
            { className: 'list-disc list-inside text-sm text-slate-700 dark:text-white/80 space-y-1' },
            [
              h('li', null, '`effortPercent` and `timelinePercent`: numeric percentages (Effort always renders on top).'),
              h('li', null, '`effortLabel` / `timelineLabel`: optional labels (defaults: Effort, Timeline).'),
              h('li', null, '`summaryText`: optional mono text for quick ratios (e.g., 80/200h).'),
              h('li', null, 'Color stops: green < 85%, amber 85–100%, red beyond 100%.'),
            ]
          ),
        ]
      ),
    ]
  );
}

function FilterChipsDemo() {
  const defaultFilters = ['At risk', 'Due soon', 'High effort'];
  const [filters, setFilters] = useState(defaultFilters);

  const reset = () => setFilters(defaultFilters);
  const remove = (name) => setFilters((prev) => prev.filter((f) => f !== name));

  return h(FilterChips, {
    filters,
    onRemove: remove,
    onClear: reset,
    dataDemoWrapper: 'filter-chips',
    dataDemoClear: 'clear-filters',
  });
}

function PerformancePrimitivesSection() {
  const [kpiMessage, setKpiMessage] = useState('Click any KPI to log the action');
  const [lastAction, setLastAction] = useState('—');

  const meterSamples = [
    { key: 'green', title: 'Balanced job', completed: false, effort: { actual: 62, baseline: 100, unit: 'h' }, timeline: { actual: 55, baseline: 100, unit: 'd' } },
    { key: 'amber', title: 'Warming up', completed: false, effort: { actual: 92, baseline: 100, unit: 'h' }, timeline: { actual: 90, baseline: 100, unit: 'd' } },
    { key: 'red', title: 'At risk', completed: false, effort: { actual: 125, baseline: 100, unit: 'h' }, timeline: { actual: 118, baseline: 100, unit: 'd' } },
    { key: 'complete', title: 'Completed (no yellow)', completed: true, effort: { actual: 104, baseline: 100, unit: 'h' }, timeline: { actual: 98, baseline: 100, unit: 'd' } },
  ];

  return h('div', { className: 'space-y-8' }, [
    h('div', { className: 'space-y-3' }, [
      h('div', { className: 'flex items-center justify-between' }, [
        h('h3', { className: 'text-sm font-semibold text-slate-800 dark:text-white' }, 'KPI Boxes'),
        h('span', { className: 'text-xs text-slate-500 dark:text-slate-400' }, 'Green / Yellow / Red / Disabled'),
      ]),
      h('div', { className: 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4' }, [
        h(KPIBox, { dataDemo: 'kpi-box', tone: 'green', title: 'On-Time', value: '92%', subtext: 'Target ≥ 85%', onClick: () => { console.log('[KPI] On-Time'); setKpiMessage('Clicked On-Time'); } }),
        h(KPIBox, { tone: 'amber', title: 'Capacity', value: '93%', subtext: 'Next 14 days', onClick: () => { console.log('[KPI] Capacity'); setKpiMessage('Clicked Capacity'); } }),
        h(KPIBox, { tone: 'red', title: 'At Risk', value: '12 jobs', subtext: 'Need action', onClick: () => { console.log('[KPI] At Risk'); setKpiMessage('Clicked At Risk'); } }),
        h(KPIBox, { tone: 'green', title: 'Exports', value: 'CSV Only', subtext: 'Disabled for demo', disabled: true }),
      ]),
      h('div', { className: 'text-xs text-slate-500 dark:text-slate-400' }, kpiMessage),
    ]),

    h('div', { className: 'space-y-3' }, [
      h('h3', { className: 'text-sm font-semibold text-slate-800 dark:text-white' }, 'Stacked Meter'),
      h('p', { className: 'text-sm text-slate-600 dark:text-slate-300' }, 'Effort on top, Timeline on bottom. Active uses green/yellow/red (85% rule). Completed removes yellow.'),
      h('div', { className: 'grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4' },
        meterSamples.map((sample) =>
          h(StackedMeter, {
            key: sample.key,
            title: sample.title,
            effort: sample.effort,
            timeline: sample.timeline,
            completed: sample.completed,
          })
        )
      ),
    ]),

    h('div', { className: 'grid grid-cols-1 md:grid-cols-2 gap-4' }, [
      h('div', { className: `${cardBase} p-4 space-y-3 bg-white dark:bg-slate-900/80` }, [
        h('div', { className: 'flex items-center justify-between' }, [
          h('h3', { className: 'text-sm font-semibold text-slate-800 dark:text-white' }, 'Row Actions'),
          h('span', { className: 'text-xs text-slate-500 dark:text-slate-400' }, '⋮ menu'),
        ]),
        h('p', { className: 'text-sm text-slate-600 dark:text-slate-300' }, 'Locked order: Reviewed / Complete / Move Date / Reassign / Change Order. Closes on ESC or outside click.'),
        h(RowActionsMenu, { dataDemoButton: 'row-actions-button', dataDemoMenu: 'row-actions-menu', onSelect: (item) => setLastAction(item) }),
        h('div', { className: 'text-xs text-slate-500 dark:text-slate-400' }, `Last action: ${lastAction}`),
      ]),
      h('div', { className: `${cardBase} p-4 space-y-3 bg-white dark:bg-slate-900/80` }, [
        h('div', { className: 'flex items-center justify-between' }, [
          h('h3', { className: 'text-sm font-semibold text-slate-800 dark:text-white' }, 'Moved Date Indicator'),
          h('span', { className: 'text-xs text-slate-500 dark:text-slate-400' }, 'Popover'),
        ]),
        h('p', { className: 'text-sm text-slate-600 dark:text-slate-300' }, 'Tap or hover to see original/new dates and when it changed. Works on touch via click.'),
        h(MovedDateIndicator, {
          dataDemoChip: 'moved-date-chip',
          dataDemoPopover: 'moved-date-popover',
          originalDate: 'Jan 15, 2025',
          newDate: 'Jan 18, 2025',
          changedAt: 'Dec 20, 2024 • 2:10 PM',
          changedBy: 'PM: Casey R.',
        }),
      ]),
    ]),

    h('div', { className: 'grid grid-cols-1 md:grid-cols-2 gap-4' }, [
      h('div', { className: `${cardBase} p-4 space-y-3 bg-white dark:bg-slate-900/80` }, [
        h('div', { className: 'flex items-center justify-between' }, [
          h('h3', { className: 'text-sm font-semibold text-slate-800 dark:text-white' }, 'Confidence + Reviewed'),
          h('span', { className: 'text-xs text-slate-500 dark:text-slate-400' }, 'Attn muting'),
        ]),
        h('div', { className: 'flex items-center gap-2 flex-wrap' }, [
          h(ProgressConfidenceChip, { level: 'high', onChange: (val) => setLastAction(`Confidence → ${val || 'unset'}`) }),
          h(ProgressConfidenceChip, { level: 'low', onChange: (val) => setLastAction(`Confidence → ${val || 'unset'}`) }),
          h(ReviewedBadge, { reviewed: { by: 'Alex', at: new Date().toISOString() } }),
        ]),
        h('div', { className: 'text-xs text-slate-500 dark:text-slate-400' }, 'Confidence dropdown clears reviewed; badge shows reviewer + time.'),
      ]),
      h('div', { className: `${cardBase} p-4 space-y-3 bg-white dark:bg-slate-900/80` }, [
        h('div', { className: 'flex items-center justify-between' }, [
          h('h3', { className: 'text-sm font-semibold text-slate-800 dark:text-white' }, 'Drift Reasons'),
          h('span', { className: 'text-xs text-slate-500 dark:text-slate-400' }, 'Calm chips'),
        ]),
        h(DriftReasonChips, { reasons: [
          { id: 'overdue', label: 'Overdue', tone: 'red' },
          { id: 'dueSoon', label: 'Due soon', tone: 'amber' },
          { id: 'effortOver', label: 'Effort overrun', tone: 'amber' },
          { id: 'checkIn', label: 'Needs check-in', tone: 'amber' },
        ] }),
        h('div', { className: 'text-xs text-slate-500 dark:text-slate-400' }, 'Attach to rows to explain drift / urgency.'),
      ]),
    ]),

    h('div', { className: `${cardBase} p-4 space-y-3 bg-white dark:bg-slate-900/80` }, [
      h('div', { className: 'flex items-center justify-between' }, [
        h('h3', { className: 'text-sm font-semibold text-slate-800 dark:text-white' }, 'Filter chips + Clear'),
        h('span', { className: 'text-xs text-slate-500 dark:text-slate-400' }, 'Removable chips'),
      ]),
      h('p', { className: 'text-sm text-slate-600 dark:text-slate-300' }, 'Remove chips individually or clear to reset defaults.'),
      h(FilterChipsDemo),
    ]),
  ]);
}

function FlowMeterGallerySection() {
  const [scorePct, setScorePct] = useState(20);
  const state = getStateFromScore(scorePct);
  const dayOffAnswer = state === 'drifting' ? 'Probably not.' : state === 'watchlist' ? 'Maybe.' : 'Yeah, you could.';
  const driverLabel = state === 'drifting' ? 'Overdue items' : state === 'watchlist' ? 'A few watchlist items' : 'Everything looks steady';

  const presets = [
    { label: 'In Flow (20)', value: 20 },
    { label: 'Watchlist (75)', value: 75 },
    { label: 'Drifting (95)', value: 95 },
  ];

  return h('div', { className: 'space-y-6' }, [
    h('div', { className: `${cardBase} p-4 space-y-3 bg-white dark:bg-slate-900/80` }, [
      h('div', { className: 'flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between' }, [
        h('div', { className: 'space-y-1' }, [
          h('div', { className: 'text-sm font-semibold text-slate-800 dark:text-white' }, 'Flow Score (attention index)'),
          h('div', { className: 'text-xs text-slate-500 dark:text-slate-400' }, '0 = best (calm), 100 = highest attention'),
        ]),
        h('div', { className: 'flex items-center gap-2 flex-wrap' },
          presets.map((preset) =>
            h('button', {
              key: preset.value,
              type: 'button',
              className: 'px-3 py-2 rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 text-sm font-semibold text-slate-700 dark:text-white hover:bg-slate-50 dark:hover:bg-slate-800 transition',
              onClick: () => setScorePct(preset.value),
            }, preset.label)
          )
        ),
      ]),
      h('div', { className: 'flex items-center gap-3' }, [
        h('input', {
          type: 'range',
          min: 0,
          max: 100,
          step: 1,
          value: scorePct,
          onChange: (e) => setScorePct(Number(e.target.value)),
          className: 'w-full accent-purple-600',
          'aria-label': 'Flow score',
        }),
        h('div', { className: 'text-xs font-semibold text-slate-600 dark:text-slate-300 w-12 text-right' }, `${scorePct}`),
      ]),
    ]),
    h(FlowMeterGallery, { scorePct, driverLabel, dayOffAnswer }),
  ]);
}

function DesktopTabsDemo() {
  const [value, setValue] = useState('components');

  return h(
    'div',
    { className: 'rounded-lg overflow-hidden shadow-sm ring-1 ring-slate-200 dark:ring-white/10 bg-netnet-purple px-3 py-2' },
    h(
      Tabs,
      {
        value,
        onChange: setValue,
        className: 'items-center gap-2',
      },
      [
        h(Tab, { key: 'components', value: 'components', label: 'Components', closable: true }),
        h(Tab, { key: 'me', value: 'me', label: 'Me / Tasks', closable: true }),
        h(Tab, { key: 'contacts', value: 'contacts', label: 'Contacts', closable: true }),
        h(NewTabButton, {
          key: 'new',
          onClick: () => {
            setValue('new');
          },
        }),
      ]
    )
  );
}

function SidebarModesDemo() {
  const items = [
    {
      key: 'full',
      title: 'Expanded Mode (full)',
      points: [
        '256px wide, icons + labels',
        'Single-open accordion: active section drives sub-nav',
        'Click active section again toggles sub-nav closed/open',
      ],
    },
    {
      key: 'compact',
      title: 'Collapsed Mode (icon rail)',
      points: [
        '76px wide, icon-only rail',
        'Hover flyout shows label + sub-nav items; browser tooltips for labels',
        'Toggle via profile chevron or ⌘B / Ctrl+B, persists in storage',
      ],
    },
    {
      key: 'subnav',
      title: 'Sub-nav rules',
      points: [
        'Only sections with subs render children',
        'Active section auto-expands when navigated to',
        'Ready for future subs (Sales, Jobs, Performance)',
      ],
    },
  ];
  return h(
    'div',
    { className: 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4' },
    items.map((item) =>
      h(
        'div',
        { key: item.key, className: `${cardBase} p-4 flex flex-col gap-3` },
        [
          h('div', { className: 'text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-white/60' }, item.title),
          h(
            'ul',
            { className: 'space-y-2 text-sm text-slate-700 dark:text-white/80 list-disc list-inside' },
            item.points.map((point, idx) => h('li', { key: `${item.key}-${idx}` }, point))
          ),
        ]
      )
    )
  );
}

function ComponentsCheatSheet() {
  const [headerTab, setHeaderTab] = useState('overview');
  const [headerSearch, setHeaderSearch] = useState('');

  const jobsVideoHelpConfig = {
    primary: {
      title: 'Managing Jobs',
      description: 'Learn how to manage Jobs in Net Net.',
      videoUrl: 'https://videos.hellonetnet.com/watch/wo5umvj3',
      thumbnailSrc: 'public/assets/samples/vid-jobs.jpg',
    },
    related: [
      {
        title: 'Quick Tasks vs. Job Tasks',
        description: 'Compare Quick Tasks to full Job Tasks.',
        videoUrl: 'https://videos.hellonetnet.com/watch/_GCLvxjV',
        thumbnailSrc: 'public/assets/samples/vid-jobs.jpg',
      },
      {
        title: 'Deliverables & Tasks',
        description: 'How grouping tasks into deliverables works.',
        videoUrl: 'https://videos.hellonetnet.com/watch/SlwetZGk',
        thumbnailSrc: 'public/assets/samples/vid-jobs.jpg',
      },
      {
        title: "Job KPI's",
        description: 'Understand Job-level performance metrics.',
        videoUrl: 'https://videos.hellonetnet.com/watch/mrN5rbMM',
        thumbnailSrc: 'public/assets/samples/vid-jobs.jpg',
      },
      {
        title: 'Activating Estimates To Jobs',
        description: 'Turn approved estimates into active Jobs.',
        videoUrl: 'https://videos.hellonetnet.com/watch/USScaUJq',
        thumbnailSrc: 'public/assets/samples/vid-jobs.jpg',
      },
      {
        title: 'Utilizing Chat with Smart Mentions!',
        description: 'Use Smart Mentions to keep Job conversations in context.',
        videoUrl: 'https://videos.hellonetnet.com/watch/J6L4QHnS',
        thumbnailSrc: 'public/assets/samples/vid-chat.jpg',
      },
    ],
  };

  const MiniIconButton = ({ keyId, aria, children }) =>
    h(
      'button',
      {
        key: keyId,
        type: 'button',
        className:
          'nn-btn nn-btn--micro inline-flex items-center justify-center text-slate-700 dark:text-white bg-white dark:bg-slate-900 border border-slate-300 dark:border-white/10 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors',
        'aria-label': aria,
      },
      children
    );

  const leftMini = [
    h(MiniIconButton, {
      keyId: 'expand',
      aria: 'Expand all',
      children: h('svg', { viewBox: '0 0 24 24', className: 'h-4 w-4', fill: 'none', stroke: 'currentColor', strokeWidth: '1.8' }, [
        h('path', { d: 'M12 5v14' }),
        h('path', { d: 'M5 12h14' }),
      ]),
    }),
    h(MiniIconButton, {
      keyId: 'select',
      aria: 'Select all',
      children: h('svg', { viewBox: '0 0 24 24', className: 'h-4 w-4', fill: 'none', stroke: 'currentColor', strokeWidth: '1.8' }, [
        h('rect', { x: '4', y: '4', width: '16', height: '16', rx: '2' }),
        h('path', { d: 'M8 12l3 3 5-6' }),
      ]),
    }),
  ];

  const rightMini = [
    h(MiniIconButton, {
      keyId: 'docs',
      aria: 'Open docs',
      children: h('svg', { viewBox: '0 0 24 24', className: 'h-4 w-4', fill: 'none', stroke: 'currentColor', strokeWidth: '1.6' }, [
        h('path', { d: 'M7 4h7l4 4v10a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z' }),
        h('path', { d: 'M14 4v4h4' }),
      ]),
    }),
    h(MiniIconButton, {
      keyId: 'copy',
      aria: 'Copy usage',
      children: h('svg', { viewBox: '0 0 24 24', className: 'h-4 w-4', fill: 'none', stroke: 'currentColor', strokeWidth: '1.6' }, [
        h('rect', { x: '9', y: '9', width: '13', height: '13', rx: '2' }),
        h('path', { d: 'M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1' }),
      ]),
    }),
  ];

  const sectionHeaderVariants = [
    {
      title: 'Dashboard header',
      node: h(SectionHeader, {
        title: 'Performance Dashboard',
        showHelpIcon: true,
        leftActions: leftMini,
        rightActions: rightMini,
      }),
    },
    {
      title: 'Header with switcher',
      node: h(SectionHeader, {
        title: 'Components',
        showHelpIcon: true,
        switcherOptions: [
          { label: 'Overview', value: 'overview' },
          { label: 'Buttons', value: 'buttons' },
          { label: 'Layouts', value: 'layouts' },
        ],
        switcherValue: headerTab,
        onSwitcherChange: setHeaderTab,
        leftActions: leftMini,
        rightActions: rightMini.slice(0, 1),
      }),
    },
    {
      title: 'Header with search',
      node: h(SectionHeader, {
        title: 'Library Search',
        showHelpIcon: true,
        leftActions: leftMini,
        rightActions: rightMini,
        showSearch: true,
        searchPlaceholder: 'Search components…',
        searchValue: headerSearch,
        onSearchChange: setHeaderSearch,
      }),
    },
  ];

  return h(
    'div',
    { className: 'w-full px-4 sm:px-6 lg:px-8 py-6 space-y-8 text-slate-900 dark:text-white' },
    [
      h(SectionHeader, {
        title: 'Component Library',
        showHelpIcon: true,
        switcherOptions: [
          { label: 'Overview', value: 'overview' },
          { label: 'Buttons', value: 'buttons' },
          { label: 'Layouts', value: 'layouts' },
          { label: 'Tables', value: 'tables' },
        ],
        switcherValue: headerTab,
        onSwitcherChange: setHeaderTab,
        leftActions: leftMini,
        rightActions: rightMini,
        showSearch: true,
        searchPlaceholder: 'Search components…',
        searchValue: headerSearch,
        onSearchChange: setHeaderSearch,
        videoHelpConfig: jobsVideoHelpConfig,
        className: 'pb-2',
      }),
      h(Section, { title: 'SectionHeader Variations' }, [
        h('div', { className: 'space-y-6' },
          sectionHeaderVariants.map((item) =>
            h('div', { key: item.title, className: 'space-y-2' }, [
              h('div', { className: 'text-sm font-semibold text-slate-600 dark:text-slate-300' }, item.title),
              item.node,
            ])
          )
        ),
      ]),
      h(Section, { title: 'Net Net Logos' }, h(LogoGrid)),
      h(Section, { title: 'Navigation Icons' }, h(NavIconGrid)),
      h(Section, { title: 'Sidebar Modes' }, h(SidebarModesDemo)),
      h(Section, { title: 'Social Icons' }, h(SocialIconsRow)),
      h(Section, { title: 'Buttons' }, h(ChromeButtonsRow)),
      h(Section, { title: 'Effort vs Timeline Meter' }, h(EffortTimelineDocs)),
      h(Section, { title: 'Performance — Flow Meter Gallery' }, h(FlowMeterGallerySection)),
      h(Section, { title: 'Performance Primitives' }, h(PerformancePrimitivesSection)),
      h(Section, { title: 'Top Bar Chrome' }, h(TopBarChromeDemo)),
      h(Section, { title: 'Desktop Tabs' }, h(DesktopTabsDemo)),
    ]
  );
}

let root = null;

export function renderComponentsCheatSheetReactView() {
  const container = document.getElementById('components-cheat-sheet-root');
  if (!container) return;
  if (!root) root = createRoot(container);
  root.render(h(ComponentsCheatSheet));
}

export function unmountComponentsCheatSheetReactView() {
  if (root) {
    root.unmount();
    root = null;
  }
  const container = document.getElementById('components-cheat-sheet-root');
  if (container) container.innerHTML = '';
}

// Expose to vanilla router/app
if (typeof window !== 'undefined') {
  window.renderComponentsCheatSheetReactView = renderComponentsCheatSheetReactView;
  window.unmountComponentsCheatSheetReactView = unmountComponentsCheatSheetReactView;
}
