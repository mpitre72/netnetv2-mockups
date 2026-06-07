import { getCurrentRole } from '../app-shell/app-helpers.js';

const { createElement: h, useMemo, useState } = React;
const { createRoot } = ReactDOM;

const cardBase = 'rounded-[30px] border border-slate-200/70 dark:border-white/10 bg-white/95 dark:bg-slate-900/80 shadow-[0_22px_70px_rgba(15,23,42,0.10)] dark:shadow-[0_26px_80px_rgba(0,0,0,0.28)]';
const glassPanelBase = 'rounded-[26px] border border-slate-200/70 dark:border-white/10 bg-slate-50/80 dark:bg-slate-950/30';
const sectionLabelClass = 'text-[10px] font-semibold uppercase tracking-[0.26em] text-slate-500 dark:text-slate-400';
const helperTextClass = 'text-sm leading-6 text-slate-600 dark:text-slate-300';
const purple = '#711FFF';

const weeklyTimeData = [
  { day: 'Sun', date: 'Jun 7', hours: 3.2, state: 'today' },
  { day: 'Mon', date: 'Jun 8', hours: 2.4, state: 'logged' },
  { day: 'Tue', date: 'Jun 9', hours: 1.8, state: 'logged' },
  { day: 'Wed', date: 'Jun 10', hours: 0, state: 'empty' },
  { day: 'Thu', date: 'Jun 11', hours: 2.1, state: 'logged' },
  { day: 'Fri', date: 'Jun 12', hours: 2.5, state: 'logged' },
  { day: 'Sat', date: 'Jun 13', hours: 0, state: 'empty' },
];

const taskTrendData = [
  { month: 'Jan', count: 14 },
  { month: 'Feb', count: 16 },
  { month: 'Mar', count: 12 },
  { month: 'Apr', count: 19 },
  { month: 'May', count: 17 },
  { month: 'Jun', count: 18 },
];

const serviceMixData = [
  { name: 'UX Design', hours: 77, percent: 64, color: '#8B5CF6' },
  { name: 'Research', hours: 26, percent: 22, color: '#38BDF8' },
  { name: 'QA Review', hours: 17, percent: 14, color: '#34D399' },
];

const estimationTrendData = [
  { month: 'Jan', percent: 68, tasks: 19 },
  { month: 'Feb', percent: 74, tasks: 21 },
  { month: 'Mar', percent: 79, tasks: 24 },
  { month: 'Apr', percent: 81, tasks: 22 },
  { month: 'May', percent: 84, tasks: 25 },
  { month: 'Jun', percent: 82, tasks: 12 },
];

const demoTeamMembers = [
  { id: 'marc-pitre', name: 'Marc Pitre' },
  { id: 'arthur-iturres', name: 'Arthur Iturres' },
  { id: 'kumail-abas', name: 'Kumail Abas' },
];

const mcpServerUrl = 'https://mcp.netnet.app/mcp';

function SectionHeading({ label, helper }) {
  return h('div', { className: 'flex flex-col gap-2 md:flex-row md:items-end md:justify-between' }, [
    h('div', { className: sectionLabelClass }, label),
    helper ? h('div', { className: `${helperTextClass} max-w-xl md:text-right` }, helper) : null,
  ]);
}

function TeamMemberSwitcher({ value, onChange, visible }) {
  if (!visible) return null;
  const selected = demoTeamMembers.find((member) => member.id === value) || demoTeamMembers[0];

  return h('div', { className: 'flex w-full flex-col gap-1.5 sm:w-[340px] sm:shrink-0 sm:items-end' }, [
    h('div', { className: 'text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-500 dark:text-slate-400' }, 'Viewing'),
    h('label', { className: 'relative block w-full min-w-[220px] sm:w-[340px]' }, [
      h('span', { className: 'sr-only' }, 'Team Member'),
      h('div', { className: 'pointer-events-none flex h-11 items-center justify-between rounded-2xl border border-slate-200/80 bg-white/90 px-4 pr-11 text-sm shadow-sm dark:border-white/10 dark:bg-slate-950/60' }, [
        h('span', { className: 'min-w-0 truncate font-semibold text-slate-900 dark:text-white' }, selected.name),
        h('span', { className: 'ml-2 rounded-full bg-netnet-purple/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-netnet-purple dark:bg-netnet-purple/20 dark:text-violet-200' }, 'Team Member'),
      ]),
      h('span', {
        className: 'pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500',
        'aria-hidden': 'true',
      }, h('svg', { viewBox: '0 0 20 20', className: 'h-4 w-4', fill: 'currentColor' }, [
        h('path', { d: 'M5.23 7.21a.75.75 0 0 1 1.06.02L10 11.168l3.71-3.938a.75.75 0 1 1 1.08 1.04l-4.25 4.512a.75.75 0 0 1-1.08 0L5.21 8.27a.75.75 0 0 1 .02-1.06Z' }),
      ])),
      h('select', {
        value,
        onChange: (event) => onChange(event.target.value),
        className: 'absolute inset-0 h-full w-full cursor-pointer appearance-none opacity-0',
        'aria-label': 'Team Member',
      }, demoTeamMembers.map((member) => h('option', { key: member.id, value: member.id }, member.name))),
    ]),
  ]);
}

function DashboardHeader({ selectedMemberId, onMemberChange, canSwitchMembers }) {
  const selectedMember = demoTeamMembers.find((member) => member.id === selectedMemberId) || demoTeamMembers[0];
  return h('div', { className: 'flex flex-col gap-5 rounded-[28px] border border-slate-200/70 bg-white/70 px-5 py-5 shadow-[0_14px_48px_rgba(15,23,42,0.07)] dark:border-white/10 dark:bg-slate-950/25 md:flex-row md:items-end md:justify-between md:px-6' }, [
    h('div', { className: 'min-w-0 flex-1 space-y-2.5' }, [
      h('h2', { className: 'text-2xl font-semibold tracking-normal text-slate-950 dark:text-white md:text-3xl' }, 'My Performance'),
      h('p', { className: 'max-w-xl text-sm leading-6 text-slate-600 dark:text-slate-300' }, 'Your time, completion, mix, and accuracy.'),
      h('p', { className: 'text-xs font-medium text-slate-500 dark:text-slate-400' }, [
        'Showing Performance of ',
        h('span', { className: 'text-emerald-400' }, selectedMember.name),
      ]),
    ]),
    h(TeamMemberSwitcher, {
      value: selectedMemberId,
      onChange: onMemberChange,
      visible: canSwitchMembers,
    }),
  ]);
}

function MetricBlock({ label, value, size = 'large', tone = 'neutral' }) {
  const valueClass = size === 'large'
    ? 'text-5xl md:text-6xl'
    : 'text-3xl md:text-4xl';
  const toneClass = tone === 'green'
    ? 'text-emerald-400'
    : 'text-slate-950 dark:text-white';

  return h('div', { className: 'space-y-2.5' }, [
    h('div', { className: 'text-sm font-medium text-slate-500 dark:text-slate-400' }, label),
    h('div', { className: `${valueClass} font-semibold tracking-normal leading-none ${toneClass}` }, value),
  ]);
}

function HoursValue({ amount, size = 'large', className = '' }) {
  const numberClass = size === 'large'
    ? 'text-5xl md:text-6xl'
    : size === 'month'
      ? 'text-4xl'
      : 'text-3xl md:text-4xl';
  const unitClass = size === 'large'
    ? 'text-xs md:text-sm'
    : 'text-[10px] md:text-xs';

  return h('div', { className: `flex items-baseline gap-1.5 font-semibold leading-none tracking-normal text-slate-950 dark:text-white ${className}` }, [
    h('span', { className: numberClass }, amount),
    h('span', { className: `${unitClass} font-semibold text-slate-500 dark:text-slate-400` }, 'hrs'),
  ]);
}

function WeeklyTimeBarChart({ data }) {
  const maxHours = Math.max(...data.map((item) => item.hours), 1);

  return h('div', { className: `${glassPanelBase} relative overflow-hidden px-4 pb-4 pt-5 md:px-6 md:pb-5` }, [
    h('div', { className: 'relative grid h-44 grid-cols-7 items-end gap-2 border-b border-slate-200/80 dark:border-white/10 md:gap-5' },
      data.map((item) => {
        const height = Math.max(18, Math.round((item.hours / maxHours) * 148));

        return h('div', { key: item.day, className: 'flex h-full min-w-0 items-end justify-center' }, [
          item.hours > 0
            ? h('div', {
                className: 'w-full max-w-[22px] bg-netnet-purple md:max-w-[30px]',
                style: { height: `${height}px` },
              })
            : h('div', { className: 'mb-5 h-8 w-full max-w-[30px] rounded-sm border border-dashed border-slate-300/80 bg-white/40 dark:border-white/15 dark:bg-white/[0.02]' }),
        ]);
      })
    ),
    h('div', { className: 'grid grid-cols-7 gap-2 pt-3 md:gap-5' },
      data.map((item) => {
        return h('div', { key: `${item.day}-label`, className: 'min-w-0 text-center' }, [
          h('div', { className: 'text-xs font-semibold text-slate-500 dark:text-slate-400' }, item.day),
          h('div', { className: 'mt-1 text-[11px] font-medium text-slate-400 dark:text-slate-500' }, item.date),
          h('div', { className: `mt-1 text-[11px] ${item.hours ? 'font-semibold text-emerald-400' : 'text-slate-400 dark:text-slate-500'}` }, item.hours ? `${item.hours} hrs` : '-'),
        ]);
      })
    ),
  ]);
}

function MonthlyCapacityCard() {
  return h('div', { className: 'relative overflow-hidden rounded-b-[30px] border border-t-0 border-slate-200/70 bg-slate-50/80 p-5 shadow-[0_18px_50px_rgba(15,23,42,0.06)] dark:border-white/10 dark:bg-slate-950/30 md:p-6' }, [
    h('div', { className: 'flex flex-col gap-5 md:flex-row md:items-center md:justify-between' }, [
      h('div', { className: 'space-y-2.5' }, [
        h('div', { className: sectionLabelClass }, 'THIS MONTH'),
        h(HoursValue, { amount: '120', size: 'month' }),
        h('div', { className: helperTextClass }, 'of 160hrs monthly capacity · 75%'),
      ]),
      h('div', { className: 'w-full space-y-3 md:w-[360px]' }, [
        h('div', { className: 'flex items-end justify-between gap-3' }, [
          h('div', { className: 'text-sm font-semibold text-slate-800 dark:text-slate-100' }, '120 hrs / 160 hrs'),
          h('div', { className: 'text-xs font-semibold text-slate-500 dark:text-slate-400' }, '75% of monthly capacity'),
        ]),
        h('div', { className: 'h-12 overflow-hidden rounded-md border border-slate-300/80 bg-slate-200 dark:border-white/10 dark:bg-slate-800' }, [
          h('div', {
            className: 'h-full bg-netnet-purple',
            style: { width: '75%' },
          }),
        ]),
      ]),
    ]),
  ]);
}

function TimeLoggedSection() {
  return h('section', { className: 'space-y-5' }, [
    h(SectionHeading, {
      label: 'TIME LOGGED',
      helper: 'Log time each day to keep this dashboard accurate.',
    }),
    h('div', { className: `${cardBase} overflow-hidden p-5 md:p-7` }, [
      h('div', { className: 'grid gap-7 md:grid-cols-[minmax(0,0.8fr)_minmax(360px,1.2fr)] md:items-stretch' }, [
        h('div', { className: 'flex flex-col justify-between gap-8' }, [
          h('div', { className: 'flex flex-wrap items-end gap-9 md:gap-12' }, [
            h(MetricBlock, { label: 'Today', value: h(HoursValue, { amount: '3.2' }) }),
            h(MetricBlock, { label: 'This Week', value: h(HoursValue, { amount: '12', size: 'medium' }), size: 'medium' }),
          ]),
          h('div', { className: 'space-y-2 rounded-2xl bg-slate-50/80 px-4 py-3 text-left ring-1 ring-slate-200/70 dark:bg-white/[0.03] dark:ring-white/10' }, [
            h('div', { className: 'text-sm font-semibold text-slate-800 dark:text-slate-100' }, 'Jun 7 - Jun 13, 2026'),
            h('div', { className: helperTextClass }, 'Last logged today at 4:42 PM'),
          ]),
        ]),
        h(WeeklyTimeBarChart, { data: weeklyTimeData }),
      ]),
    ]),
    h(MonthlyCapacityCard),
  ]);
}

function TasksCompletedCard() {
  const maxValue = Math.max(...taskTrendData.map((item) => item.count), 1);

  return h('div', { className: `${cardBase} relative flex min-h-full flex-col overflow-hidden p-5 md:p-7` }, [
    h('div', { className: 'pointer-events-none absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-emerald-400/50 to-transparent' }),
    h('div', { className: 'space-y-3.5' }, [
      h('div', { className: sectionLabelClass }, 'TASKS COMPLETED THIS MONTH'),
      h('div', { className: 'flex items-end gap-4' }, [
        h('div', { className: 'text-7xl font-semibold leading-none tracking-normal text-emerald-400' }, '18'),
        h('div', { className: 'pb-2 text-lg font-semibold text-slate-950 dark:text-white' }, 'Keep it up.'),
      ]),
      h('p', { className: 'max-w-xl text-sm leading-6 text-slate-600 dark:text-slate-300' }, 'Completing tasks when they are done keeps your work history accurate.'),
    ]),
    h('div', { className: 'my-6 h-px bg-gradient-to-r from-transparent via-slate-200 to-transparent dark:via-white/10' }),
    h('div', { className: 'mt-auto space-y-5' }, [
      h('div', { className: 'flex items-center justify-between gap-3' }, [
        h('div', { className: 'space-y-1' }, [
          h('div', { className: 'text-sm font-semibold text-slate-800 dark:text-slate-100' }, 'Tasks completed by month'),
          h('div', { className: 'text-xs leading-5 text-slate-500 dark:text-slate-400' }, 'Compare this month to your recent pattern.'),
        ]),
        h('div', { className: 'text-xs font-semibold text-slate-500 dark:text-slate-400' }, 'avg 16 / mo'),
      ]),
      h('div', { className: `${glassPanelBase} grid h-44 grid-cols-6 items-end gap-2 px-3 pb-4 pt-5 sm:gap-3 sm:px-5` },
        taskTrendData.map((item, index) => {
          const isCurrent = index === taskTrendData.length - 1;
          const height = Math.max(26, Math.round((item.count / maxValue) * 92));
          return h('div', { key: item.month, className: 'flex h-full min-w-0 flex-col items-center justify-end gap-2' }, [
            h('div', { className: 'flex h-[116px] w-full flex-col items-center justify-end gap-1.5' }, [
              h('div', { className: `text-[11px] font-semibold tabular-nums ${isCurrent ? 'text-emerald-500 dark:text-emerald-300' : 'text-slate-500 dark:text-slate-400'}` }, item.count),
              h('div', {
                className: [
                  'w-full max-w-[22px] transition-all',
                  isCurrent
                    ? 'bg-emerald-400'
                    : 'bg-slate-300/75 dark:bg-slate-700/60',
                ].join(' '),
                style: { height: `${height}px` },
              }),
            ]),
            h('div', { className: `w-full truncate text-center text-[10px] font-medium leading-4 ${isCurrent ? 'text-slate-700 dark:text-slate-200' : 'text-slate-400 dark:text-slate-500'}` }, item.month),
          ]);
        })
      ),
    ]),
  ]);
}

function ServiceTypeDonutChart({ data }) {
  let offset = 0;
  let labelStart = 0;

  return h('div', { className: `${glassPanelBase} relative flex min-h-[250px] items-center justify-center px-4 py-6` }, [
    h('svg', {
      viewBox: '0 0 220 220',
      className: 'h-auto w-full max-w-[260px] overflow-visible',
      role: 'img',
      'aria-label': 'Service Type Mix donut chart',
    }, [
      h('circle', {
        cx: 110,
        cy: 110,
        r: 62,
        fill: 'none',
        stroke: 'currentColor',
        strokeWidth: 26,
        className: 'text-slate-200/80 dark:text-white/10',
      }),
      ...data.map((item) => {
        const segment = h('circle', {
          key: `${item.name}-segment`,
          cx: 110,
          cy: 110,
          r: 62,
          fill: 'none',
          stroke: item.color,
          strokeWidth: 26,
          strokeLinecap: 'butt',
          pathLength: 100,
          strokeDasharray: `${item.percent} ${100 - item.percent}`,
          strokeDashoffset: -offset,
          transform: 'rotate(-90 110 110)',
          opacity: 0.78,
        });
        offset += item.percent;
        return segment;
      }),
      ...data.map((item) => {
        const midpoint = (labelStart + item.percent / 2) * 3.6;
        const point = polarToCartesian(110, 110, 94, midpoint);
        labelStart += item.percent;
        return h('text', {
          key: `${item.name}-label`,
          x: point.x,
          y: point.y,
          textAnchor: 'middle',
          dominantBaseline: 'middle',
          className: 'fill-slate-700 dark:fill-slate-200',
          style: { fontSize: 12, fontWeight: 700 },
        }, `${item.percent}%`);
      }),
      h('circle', { cx: 110, cy: 110, r: 42, fill: 'currentColor', className: 'text-white dark:text-slate-900' }),
      h('text', { x: 110, y: 104, textAnchor: 'middle', className: 'fill-slate-950 dark:fill-white', style: { fontSize: 20, fontWeight: 700 } }, '120'),
      h('text', { x: 110, y: 123, textAnchor: 'middle', className: 'fill-slate-500 dark:fill-slate-400', style: { fontSize: 11, fontWeight: 600 } }, 'hrs'),
    ]),
  ]);
}

function ServiceTypeMixCard() {
  return h('div', { className: `${cardBase} relative flex min-h-full flex-col overflow-hidden p-5 md:p-7` }, [
    h('div', { className: 'pointer-events-none absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-sky-400/40 to-transparent' }),
    h('div', { className: 'space-y-3.5' }, [
      h('div', { className: sectionLabelClass }, 'SERVICE TYPE MIX'),
      h('p', { className: 'text-sm leading-6 text-slate-600 dark:text-slate-300' }, 'Where your effort went this month · only shown when you work across multiple types.'),
    ]),
    h('div', { className: 'mt-auto space-y-5 pt-6' }, [
      h(ServiceTypeDonutChart, { data: serviceMixData }),
      h('div', { className: 'space-y-4' },
        serviceMixData.map((item) =>
          h('div', { key: item.name, className: 'grid grid-cols-[1fr_auto] items-center gap-4' }, [
            h('div', { className: 'flex min-w-0 items-center gap-3' }, [
              h('span', { className: 'h-2.5 w-2.5 shrink-0 rounded-full ring-4 ring-slate-100 dark:ring-white/5', style: { background: item.color } }),
              h('span', { className: 'truncate text-sm font-medium text-slate-800 dark:text-slate-100' }, item.name),
            ]),
            h('div', { className: 'tabular-nums text-sm text-slate-500 dark:text-slate-400' }, `${item.hours}hrs`),
          ]),
        )
      ),
    ]),
  ]);
}

function TaskAndServiceSection() {
  return h('section', { className: 'grid gap-6 lg:grid-cols-2' }, [
    h(TasksCompletedCard),
    h(ServiceTypeMixCard),
  ]);
}

function polarToCartesian(cx, cy, radius, angleInDegrees) {
  const angleInRadians = (angleInDegrees - 90) * Math.PI / 180;
  return {
    x: cx + (radius * Math.cos(angleInRadians)),
    y: cy + (radius * Math.sin(angleInRadians)),
  };
}

function EstimationTrendChart({ data }) {
  const maxPercent = Math.max(...data.map((item) => item.percent), 100);

  return h('div', { className: 'space-y-5' }, [
    h('div', { className: 'space-y-2' }, [
      h('div', { className: 'text-sm font-semibold text-slate-900 dark:text-white' }, 'Six-month estimation trend'),
      h('p', { className: 'text-sm leading-6 text-slate-600 dark:text-slate-300' }, 'Monthly share of completed tasks that came in at or under assigned LOE.'),
    ]),
    h('div', { className: `${glassPanelBase} grid h-64 grid-cols-6 items-end gap-2 px-3 pb-4 pt-5 sm:gap-3 sm:px-5` },
      data.map((item, index) => {
        const isCurrent = index === data.length - 1;
        const height = Math.max(46, Math.round((item.percent / maxPercent) * 140));

        return h('div', { key: item.month, className: 'flex h-full min-w-0 flex-col items-center justify-end gap-2' }, [
          h('div', { className: 'flex h-[170px] w-full flex-col items-center justify-end gap-1.5' }, [
            h('div', { className: `text-[11px] font-semibold tabular-nums ${isCurrent ? 'text-netnet-purple' : 'text-slate-500 dark:text-slate-400'}` }, `${item.percent}%`),
            h('div', {
              className: [
                'w-full max-w-[34px] transition-all',
                isCurrent
                  ? 'bg-netnet-purple shadow-[0_0_18px_rgba(113,31,255,0.28)]'
                  : 'bg-slate-300/80 dark:bg-slate-700/70',
              ].join(' '),
              style: { height: `${height}px` },
            }),
          ]),
          h('div', { className: `text-center text-[11px] font-semibold ${isCurrent ? 'text-slate-800 dark:text-slate-100' : 'text-slate-500 dark:text-slate-400'}` }, item.month),
          h('div', { className: 'text-center text-[10px] leading-4 text-slate-400 dark:text-slate-500' }, `${item.tasks} tasks`),
        ]);
      })
    ),
  ]);
}

function EstimationAccuracySection() {
  return h('section', { className: 'space-y-5' }, [
    h(SectionHeading, {
      label: 'ESTIMATION ACCURACY',
      helper: 'How completed work tracks to its assigned plan over time',
    }),
    h('div', { className: `${cardBase} relative overflow-hidden` }, [
      h('div', { className: 'pointer-events-none absolute inset-x-10 top-0 h-px bg-gradient-to-r from-transparent via-netnet-purple/40 to-transparent' }),
      h('div', { className: 'grid gap-0 lg:grid-cols-2' }, [
        h('div', { className: 'space-y-6 p-5 md:p-8 lg:border-r lg:border-slate-200/70 lg:dark:border-white/10' }, [
          h('div', { className: sectionLabelClass }, 'ON OR UNDER PLAN'),
          h('div', { className: 'text-7xl font-semibold leading-none tracking-normal text-slate-950 dark:text-white' }, '82%'),
          h('div', { className: 'text-lg font-semibold text-slate-950 dark:text-white' }, 'On or under plan this month'),
          h('p', { className: 'text-sm leading-6 text-slate-600 dark:text-slate-300' }, 'Completed tasks this month came in at or under their assigned LOE.'),
          h('div', { className: 'rounded-2xl border border-slate-200/80 bg-slate-50/80 p-4 text-sm leading-6 text-slate-600 dark:border-white/10 dark:bg-white/[0.03] dark:text-slate-300' }, [
            h('p', null, 'Estimation accuracy is not always a reflection of personal performance. It can also point to unclear tasks, changing scope, or estimates that need improvement.'),
            h('p', { className: 'mt-3 font-semibold text-slate-800 dark:text-slate-100' }, 'Use this trend to start better conversations about planning and LOE over time.'),
          ]),
        ]),
        h('div', { className: 'flex items-center justify-center bg-slate-50/80 p-5 dark:bg-white/[0.04] md:p-8' }, [
          h(EstimationTrendChart, { data: estimationTrendData }),
        ]),
      ]),
    ]),
  ]);
}

function providerSection(title, body, steps = []) {
  return `
    <section class="rounded-2xl border border-slate-200/80 bg-white/85 p-4 dark:border-white/10 dark:bg-white/[0.04]">
      <h3 class="text-sm font-semibold text-slate-950 dark:text-white">${title}</h3>
      <p class="mt-1 text-sm leading-6 text-slate-600 dark:text-slate-300">${body}</p>
      ${steps.length ? `
        <ul class="mt-3 space-y-2 text-sm leading-6 text-slate-600 dark:text-slate-300">
          ${steps.map((step) => `<li class="flex gap-2"><span class="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-netnet-purple"></span><span>${step}</span></li>`).join('')}
        </ul>
      ` : ''}
    </section>
  `;
}

function openMcpHelpDrawer() {
  const drawer = document.getElementById('drawer-container');
  const shell = document.getElementById('app-shell');
  if (!drawer || !shell) return;

  drawer.dataset.drawerView = 'mcp-help';
  drawer.innerHTML = `
    <div id="app-drawer-backdrop"></div>
    <aside id="app-drawer" class="bg-white dark:bg-slate-900 text-slate-900 dark:text-white p-0 flex flex-col w-full max-w-md h-full">
      <div class="flex items-start justify-between gap-4 border-b border-slate-200 dark:border-white/10 px-5 py-4">
        <div>
          <p class="text-[10px] font-semibold uppercase tracking-[0.22em] text-netnet-purple">Net Net MCP</p>
          <h2 class="mt-1 text-lg font-semibold text-slate-950 dark:text-white">Set up Net Net MCP</h2>
          <p class="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">Connect your Net Net data to the LLM tool you already use.</p>
        </div>
        <button type="button" id="drawerCloseBtn" class="rounded-full p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-800 dark:text-white/70 dark:hover:bg-white/10 dark:hover:text-white" aria-label="Close MCP setup help">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </div>

      <div class="flex-1 overflow-y-auto px-5 py-5">
        <div class="space-y-5">
          <section class="rounded-3xl border border-netnet-purple/20 bg-netnet-purple/5 p-4 dark:bg-netnet-purple/10">
            <h3 class="text-sm font-semibold text-slate-950 dark:text-white">What the MCP is for</h3>
            <p class="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">The Net Net MCP lets an LLM read your Net Net data through a controlled server connection. Paste the server URL into your provider's MCP settings, then ask questions about your work, time, tasks, and patterns.</p>
            <div class="mt-4 rounded-2xl border border-slate-200 bg-white p-3 dark:border-white/10 dark:bg-slate-950/60">
              <p class="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">Server URL</p>
              <div class="mt-2 flex items-center gap-2">
                <code id="mcpServerUrl" class="min-w-0 flex-1 truncate rounded-lg bg-slate-100 px-3 py-2 text-xs font-semibold text-slate-800 dark:bg-white/10 dark:text-white">${mcpServerUrl}</code>
                <button type="button" id="copyMcpUrlBtn" class="shrink-0 rounded-lg bg-netnet-purple px-3 py-2 text-xs font-semibold text-white">Copy</button>
              </div>
              <p id="copyMcpUrlStatus" class="mt-2 min-h-[16px] text-xs text-slate-500 dark:text-slate-400"></p>
            </div>
          </section>

          <section class="rounded-2xl border border-slate-200/80 bg-white/85 p-4 dark:border-white/10 dark:bg-white/[0.04]">
            <h3 class="text-sm font-semibold text-slate-950 dark:text-white">General setup</h3>
            <ol class="mt-3 space-y-2 text-sm leading-6 text-slate-600 dark:text-slate-300">
              <li>1. Open your provider's connector, integration, or MCP server settings.</li>
              <li>2. Add a new MCP server and paste <span class="font-semibold text-slate-900 dark:text-white">${mcpServerUrl}</span>.</li>
              <li>3. Save the connection, then return to chat and ask for the Net Net data view you need.</li>
            </ol>
          </section>

          ${providerSection('Claude', 'Claude is the clearest reference example for MCP setup.', [
            'Open Claude settings and look for MCP, Connectors, or integrations.',
            `Add a custom MCP server and paste ${mcpServerUrl}.`,
            'Start a new chat and ask Claude to inspect or summarize your Net Net work data.',
          ])}
          ${providerSection('ChatGPT', 'Use this as reference guidance. ChatGPT setup labels may vary by plan and connector surface.', [
            'Open connector or tool settings where custom MCP servers are managed.',
            `Paste ${mcpServerUrl} as the server URL.`,
            'After connecting, ask ChatGPT for the dashboard, pattern, or slice of work you want.',
          ])}
          ${providerSection('Gemini', 'Use this as reference guidance because Gemini connection flows may vary.', [
            'Find the area for extensions, tools, or MCP-style connectors.',
            `Use ${mcpServerUrl} as the Net Net server endpoint.`,
            'Ask Gemini to build a focused view from your Net Net data.',
          ])}
          ${providerSection('Perplexity', 'Use this as reference guidance for Perplexity if MCP or connector setup is available in your workspace.', [
            'Open the provider settings for connectors or custom tools.',
            `Paste ${mcpServerUrl} when prompted for the MCP server URL.`,
            'Ask Perplexity for research-style summaries or specific patterns from Net Net.',
          ])}
          ${providerSection('Grok', 'Use this as reference guidance if your Grok workspace exposes MCP or tool connector settings.', [
            'Look for custom tools, connectors, or MCP server configuration.',
            `Add ${mcpServerUrl} as the Net Net MCP endpoint.`,
            'Ask Grok for the exact Net Net view or comparison you want to explore.',
          ])}

          <p class="rounded-2xl border border-slate-200/80 bg-slate-50 p-4 text-xs leading-5 text-slate-500 dark:border-white/10 dark:bg-white/[0.03] dark:text-slate-400">Long-form support docs will live in Crisp later. For now, this in-app panel is the prototype setup guide.</p>
        </div>
      </div>
    </aside>
  `;

  const closeDrawer = () => {
    shell.classList.add('drawer-closed');
  };

  drawer.querySelector('#drawerCloseBtn')?.addEventListener('click', closeDrawer);
  drawer.querySelector('#app-drawer-backdrop')?.addEventListener('click', closeDrawer);
  drawer.querySelector('#copyMcpUrlBtn')?.addEventListener('click', async () => {
    const status = drawer.querySelector('#copyMcpUrlStatus');
    try {
      if (!navigator.clipboard?.writeText) {
        throw new Error('Clipboard unavailable');
      }
      await navigator.clipboard.writeText(mcpServerUrl);
      if (status) status.textContent = 'Copied.';
    } catch (e) {
      if (status) status.textContent = 'Copy unavailable. Select the URL and copy it manually.';
    }
  });

  shell.classList.remove('drawer-closed');
}

function McpCalloutCard() {
  return h('section', { className: 'relative overflow-hidden rounded-[34px] border border-netnet-purple/30 bg-[#1d1236] shadow-[0_30px_90px_rgba(17,24,39,0.20)] dark:shadow-[0_34px_100px_rgba(0,0,0,0.36)]' }, [
    h('div', { className: 'pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_12%_18%,rgba(167,139,250,0.34),transparent_28%),radial-gradient(circle_at_90%_20%,rgba(113,31,255,0.42),transparent_34%),linear-gradient(135deg,rgba(113,31,255,0.28),rgba(15,23,42,0.08))]' }),
    h('div', { className: 'pointer-events-none absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-white/50 to-transparent' }),
    h('div', { className: 'relative p-6 md:p-8' }, [
      h('div', { className: 'flex flex-col gap-7 lg:flex-row lg:items-center lg:justify-between' }, [
        h('div', { className: 'flex max-w-4xl flex-col gap-5 md:flex-row md:items-start' }, [
          h('div', { className: 'flex h-14 w-14 shrink-0 items-center justify-center rounded-[22px] bg-white/10 text-sm font-semibold text-white shadow-[0_0_38px_rgba(167,139,250,0.42)] ring-1 ring-white/20' }, 'MCP'),
          h('div', { className: 'space-y-3' }, [
            h('div', { className: 'text-[10px] font-semibold uppercase tracking-[0.26em] text-violet-200' }, 'DID YOU KNOW'),
            h('h3', { className: 'text-2xl font-semibold leading-tight tracking-normal text-white md:text-3xl' }, 'Net Net has an MCP. Build whatever dashboard you want.'),
            h('p', { className: 'max-w-3xl text-sm leading-6 text-violet-50/90' }, 'Connect your Net Net data to Claude, ChatGPT, Gemini, Perplexity, or any other LLM you already use. Ask it anything. Build the views that matter to you, and dig into the specific patterns that matter most. Five-minute setup, then the data answers to you.'),
          ]),
        ]),
        h('div', { className: 'shrink-0' }, [
          h('button', { type: 'button', onClick: openMcpHelpDrawer, className: 'inline-flex h-11 items-center rounded-full bg-white px-5 text-sm font-semibold text-netnet-purple shadow-[0_18px_44px_rgba(0,0,0,0.24)] ring-1 ring-white/40 transition hover:-translate-y-0.5 hover:shadow-[0_22px_50px_rgba(0,0,0,0.28)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white' }, 'Set up the MCP'),
        ]),
      ]),
    ]),
  ]);
}

function MyPerformance() {
  const role = useMemo(() => getCurrentRole(), []);
  const canSwitchMembers = role === 'owner' || role === 'admin';
  const [selectedMemberId, setSelectedMemberId] = useState(demoTeamMembers[0].id);

  return h('div', { className: 'mx-auto max-w-[1240px] px-4 py-7 lg:px-7 lg:py-10' }, [
    h('div', { className: 'space-y-11' }, [
      h(DashboardHeader, {
        selectedMemberId,
        onMemberChange: setSelectedMemberId,
        canSwitchMembers,
      }),
      h(TimeLoggedSection),
      h(TaskAndServiceSection),
      h(EstimationAccuracySection),
      h(McpCalloutCard),
    ]),
  ]);
}

export function renderMyPerformancePage(bodyEl) {
  if (!bodyEl) return;
  bodyEl.innerHTML = '<div id="my-performance-root"></div>';
  const mount = bodyEl.querySelector('#my-performance-root');
  if (!mount) return;

  // Recreate root if the mount node changes between navigations.
  if (!window.__myPerformanceRoot || window.__myPerformanceMount !== mount) {
    window.__myPerformanceRoot = createRoot(mount);
    window.__myPerformanceMount = mount;
  }
  window.__myPerformanceRoot.render(h(MyPerformance));
}
