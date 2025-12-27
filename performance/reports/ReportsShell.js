import { navigate } from '../../router.js';
import { KPIBox } from '../../components/performance/primitives.js';
import {
  performanceTeam,
  performanceJobs,
  performanceDeliverables,
  performanceTasks,
  performanceTimeEntries,
  performanceSalesDeals,
  performanceSalesActivities,
  performanceServiceTypes,
} from '../performance-data.js';
import {
  REPORTS_TABS,
  REPORT_DEFAULT_GROUP,
  REPORT_COLORS,
  parseReportState,
  updateReportQuery,
  getReportRange,
  getPreviousRange,
  formatISODate,
  parseISODate,
  addDays,
  addMonths,
  getMonthGrid,
  getPresetRange,
  isBeforeDay,
  isBetweenInclusive,
  isSameDay,
} from './reports-logic.js';

const { createElement: h, useEffect, useMemo, useRef, useState } = React;
const { createPortal } = ReactDOM;

function formatCurrency(amount, { compact = false } = {}) {
  const n = Number(amount || 0);
  if (compact) {
    const abs = Math.abs(n);
    if (abs >= 1_000_000) {
      const v = Math.round((n / 1_000_000) * 10) / 10;
      return `$${String(v).replace(/\\.0$/, '')}M`;
    }
    if (abs >= 1_000) {
      const v = Math.round((n / 1_000) * 10) / 10;
      return `$${String(v).replace(/\\.0$/, '')}k`;
    }
  }
  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 0,
    }).format(n);
  } catch (e) {
    return `$${Math.round(n).toLocaleString()}`;
  }
}

const REPORT_MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];
const REPORT_WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

function CalendarMonth({ monthDate, startDate, endDate, onPick, onPrev, onNext, showPrev, showNext, isDark }) {
  const weeks = getMonthGrid(monthDate);
  const monthLabel = `${REPORT_MONTH_NAMES[monthDate.getMonth()]} ${monthDate.getFullYear()}`;

  const navBtnClass = isDark
    ? 'h-8 w-8 rounded-lg border border-white/10 bg-white/5 text-white/80 hover:bg-white/10'
    : 'h-8 w-8 rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-100';
  const monthLabelClass = isDark ? 'text-sm font-semibold text-white/90' : 'text-sm font-semibold text-slate-900';
  const weekdayRowClass = isDark ? 'grid grid-cols-7 gap-1 text-xs text-white/40' : 'grid grid-cols-7 gap-1 text-xs text-slate-500';
  const outOfMonthTone = isDark ? 'text-white/25 hover:text-white/60' : 'text-slate-300 hover:text-slate-500';
  const inMonthTone = isDark ? 'text-white/80 hover:bg-white/10' : 'text-slate-700 hover:bg-slate-100';
  const inRangeBg = isDark ? 'bg-netnet-purple/20' : 'bg-netnet-purple/15';
  const edgeShadow = isDark ? 'shadow-[0_0_0_1px_rgba(255,255,255,0.15)]' : 'shadow-[0_0_0_1px_rgba(15,23,42,0.14)]';
  const todayRingClass = isDark ? 'ring-1 ring-white/15' : 'ring-1 ring-slate-300';

  return h('div', { className: 'space-y-2 min-w-[280px]' }, [
    h('div', { className: 'flex items-center justify-between gap-2' }, [
      h('button', {
        type: 'button',
        onClick: showPrev ? onPrev : undefined,
        disabled: !showPrev,
        className: `${navBtnClass} ${showPrev ? '' : 'opacity-0 pointer-events-none'}`,
        title: 'Previous month',
      }, '‹'),
      h('div', { className: monthLabelClass }, monthLabel),
      h('button', {
        type: 'button',
        onClick: showNext ? onNext : undefined,
        disabled: !showNext,
        className: `${navBtnClass} ${showNext ? '' : 'opacity-0 pointer-events-none'}`,
        title: 'Next month',
      }, '›'),
    ]),
    h('div', { className: weekdayRowClass }, REPORT_WEEKDAYS.map((d) => h('div', { key: d, className: 'text-center' }, d))),
    h('div', { className: 'grid grid-cols-7 gap-1' },
      weeks.flat().map(({ date, inMonth, key }) => {
        const isStart = startDate && isSameDay(date, startDate);
        const isEnd = endDate && isSameDay(date, endDate);
        const inRange = startDate && endDate && isBetweenInclusive(date, startDate, endDate);
        const isToday = isSameDay(date, new Date());

        const base = 'h-9 w-9 rounded-lg text-sm transition-colors';
        const tone = !inMonth ? outOfMonthTone : inMonthTone;
        const rangeClass = inRange ? inRangeBg : '';
        const edgeClass = (isStart || isEnd) ? `bg-netnet-purple text-white ${edgeShadow}` : '';
        const todayRing = isToday ? todayRingClass : '';

        return h('button', {
          key,
          type: 'button',
          className: `${base} ${tone} ${rangeClass} ${edgeClass} ${todayRing}`,
          onClick: () => onPick(date),
        }, date.getDate());
      })
    ),
  ]);
}

function DateRangePickerPopover({ open, anchorRect, initialStart, initialEnd, onApply, onClose }) {
  const [draftStart, setDraftStart] = useState(() => parseISODate(initialStart) || null);
  const [draftEnd, setDraftEnd] = useState(() => parseISODate(initialEnd) || null);
  const [viewMonth, setViewMonth] = useState(() => {
    const base = parseISODate(initialStart) || new Date();
    return new Date(base.getFullYear(), base.getMonth(), 1);
  });
  const [error, setError] = useState('');
  const [activePreset, setActivePreset] = useState('');

  useEffect(() => {
    if (!open) return;
    setError('');
    setActivePreset('');
    const s = parseISODate(initialStart);
    const e = parseISODate(initialEnd);
    setDraftStart(s || null);
    setDraftEnd(e || null);
    const base = s || new Date();
    setViewMonth(new Date(base.getFullYear(), base.getMonth(), 1));
  }, [open, initialStart, initialEnd]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === 'Escape') onClose?.();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  const presets = [
    { id: 'today', label: 'Today' },
    { id: 'yesterday', label: 'Yesterday' },
    { id: 'this-week', label: 'This Week' },
    { id: 'last-week', label: 'Last Week' },
    { id: 'this-month', label: 'This Month' },
    { id: 'last-month', label: 'Last Month' },
    { id: 'this-year', label: 'This Year' },
    { id: 'last-year', label: 'Last Year' },
    { id: 'last-7', label: 'Last 7 days' },
    { id: 'last-30', label: 'Last 30 days' },
    { id: 'last-90', label: 'Last 90 days' },
  ];

  const month2 = addMonths(viewMonth, 1);

  const pickDay = (d) => {
    setError('');
    if (!draftStart || (draftStart && draftEnd)) {
      setDraftStart(d);
      setDraftEnd(null);
      return;
    }
    if (draftStart && !draftEnd) {
      if (isBeforeDay(d, draftStart)) {
        setDraftEnd(draftStart);
        setDraftStart(d);
      } else {
        setDraftEnd(d);
      }
    }
  };

  const apply = () => {
    if (!draftStart || !draftEnd) {
      setError('Select a start date and an end date.');
      return;
    }
    if (isBeforeDay(draftEnd, draftStart)) {
      setError('End date must be on or after start date.');
      return;
    }
    onApply?.({ start: formatISODate(draftStart), end: formatISODate(draftEnd) });
    onClose?.();
  };

  const setPreset = (id) => {
    const today = new Date();
    const r = getPresetRange(id, today);
    if (!r) return;
    setActivePreset(id);
    setDraftStart(r.start);
    setDraftEnd(r.end);
    setViewMonth(new Date(r.start.getFullYear(), r.start.getMonth(), 1));
  };

  const isDark = typeof document !== 'undefined' && (document.documentElement.classList.contains('dark') || document.body.classList.contains('dark'));
  const overlayClass = isDark ? 'bg-slate-950/60' : 'bg-slate-200/70';
  const surfaceClass = isDark
    ? 'border-white/10 bg-slate-950/90 text-white'
    : 'border-slate-200 bg-white text-slate-900';
  const subtleText = isDark ? 'text-white/50' : 'text-slate-500';
  const headerBorder = isDark ? 'border-white/10' : 'border-slate-200';
  const presetIdle = isDark ? 'border-white/10 bg-white/5 text-white/80 hover:bg-white/10' : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50';
  const presetActive = isDark ? 'border-netnet-purple bg-netnet-purple/20 text-white' : 'border-netnet-purple bg-netnet-purple/10 text-slate-900';
  const chipBg = isDark ? 'bg-slate-800 text-white/90' : 'bg-slate-100 text-slate-800';
  const chipMuted = isDark ? 'text-white/50' : 'text-slate-500';

  const panelCardClass = isDark
    ? 'rounded-xl border border-white/10 bg-white/5'
    : 'rounded-xl border border-slate-200 bg-slate-50';
  const tipCardClass = isDark
    ? 'rounded-xl border border-white/10 bg-white/5'
    : 'rounded-xl border border-slate-200 bg-white';
  const panelValueText = isDark ? 'text-white' : 'text-slate-900';

  const footerBg = isDark ? 'bg-slate-950/60' : 'bg-slate-50';
  const hintTextClass = isDark ? 'text-white/45' : 'text-slate-500';

  const escButtonClass = isDark
    ? 'h-9 px-3 rounded-lg border border-white/10 bg-white/5 text-xs text-white/70 hover:bg-white/10'
    : 'h-9 px-3 rounded-lg border border-slate-200 bg-white text-xs text-slate-700 hover:bg-slate-100';
  const cancelButtonClass = isDark
    ? 'h-9 px-4 rounded-lg border border-white/10 bg-white/5 text-white/80 hover:bg-white/10'
    : 'h-9 px-4 rounded-lg border border-slate-300 bg-white text-slate-700 hover:bg-slate-100';

  const errorTextClass = isDark ? 'text-xs text-red-300' : 'text-xs text-red-600';

  return createPortal(
    h('div', { className: 'fixed inset-0 z-[9999] flex items-center justify-center' }, [
      h('div', {
        className: `absolute inset-0 backdrop-blur-sm ${overlayClass}`,
        'data-demo': 'date-range-overlay',
        onMouseDown: () => onClose?.(),
      }),
      h('div', {
        className: 'relative w-full max-w-5xl max-h-[85vh] mx-4',
        style: { pointerEvents: 'none' },
        onMouseDown: (e) => e.stopPropagation(),
      },
        h('div', { className: `rounded-2xl border shadow-2xl overflow-hidden h-full overflow-auto ${surfaceClass}`, 'data-demo': 'date-range-picker', style: { pointerEvents: 'auto' } }, [
          h('div', { className: `flex items-center justify-between px-5 py-4 border-b ${headerBorder}` }, [
            h('div', { className: 'space-y-0.5' }, [
              h('div', { className: 'text-sm font-semibold' }, 'Custom date range'),
              h('div', { className: `text-xs ${subtleText}` }, 'Pick a start and end date, or use a quick preset.'),
            ]),
            h('button', {
              type: 'button',
              onClick: () => onClose?.(),
              className: escButtonClass,
            }, 'Esc'),
          ]),

          h('div', { className: 'p-5 grid grid-cols-1 lg:grid-cols-[180px_1fr_220px] gap-5' }, [
            h('div', { className: 'space-y-2' }, [
              h('div', { className: `text-xs font-semibold uppercase tracking-wide ${subtleText}` }, 'Presets'),
              h('div', { className: 'space-y-1' }, presets.map((p) => {
                const active = activePreset === p.id;
                return h('button', {
                  key: p.id,
                  type: 'button',
                  onClick: () => setPreset(p.id),
                  className: `w-full text-left px-3 py-2 rounded-lg border ${active ? presetActive : presetIdle}`,
                }, p.label);
              })),
            ]),
            h('div', { className: 'flex flex-col gap-4' }, [
              h('div', { className: 'flex flex-wrap gap-4 items-start justify-center' }, [
                h(CalendarMonth, {
                  monthDate: viewMonth,
                  startDate: draftStart,
                  endDate: draftEnd,
                  onPick: pickDay,
                  showPrev: true,
                  showNext: false,
                  onPrev: () => setViewMonth((m) => addMonths(m, -1)),
                  isDark,
                }),
                h(CalendarMonth, {
                  monthDate: month2,
                  startDate: draftStart,
                  endDate: draftEnd,
                  onPick: pickDay,
                  showPrev: false,
                  showNext: true,
                  onNext: () => setViewMonth((m) => addMonths(m, 1)),
                  isDark,
                }),
              ]),
              h('div', { className: `flex items-center justify-center gap-3 text-xs ${subtleText}` }, [
                h('div', { className: 'inline-flex items-center gap-2' }, [
                  h('span', { className: 'h-2 w-2 rounded-full bg-netnet-purple' }),
                  h('span', null, 'Start / End'),
                ]),
                h('div', { className: 'inline-flex items-center gap-2' }, [
                  h('span', { className: 'h-2 w-2 rounded-full bg-netnet-purple/30' }),
                  h('span', null, 'In range'),
                ]),
              ]),
            ]),
            h('div', { className: 'space-y-4' }, [
              h('div', { className: 'space-y-2' }, [
                h('div', { className: `text-xs font-semibold uppercase tracking-wide ${subtleText}` }, 'Selection'),
                h('div', { className: `${panelCardClass} p-3 space-y-3` }, [
                  h('div', null, [
                    h('div', { className: `text-[11px] ${chipMuted}` }, 'Start date'),
                    h('div', { className: `mt-0.5 font-mono text-sm ${panelValueText}` }, draftStart ? formatISODate(draftStart) : '—'),
                  ]),
                  h('div', null, [
                    h('div', { className: `text-[11px] ${chipMuted}` }, 'End date'),
                    h('div', { className: `mt-0.5 font-mono text-sm ${panelValueText}` }, draftEnd ? formatISODate(draftEnd) : '—'),
                  ]),
                ]),
                error ? h('div', { className: errorTextClass }, error) : null,
              ]),
              h('div', { className: `${tipCardClass} p-3` }, [
                h('div', { className: `text-xs ${isDark ? 'text-white/60' : 'text-slate-600'}` }, 'Tip'),
                h('div', { className: `mt-1 text-xs ${hintTextClass}` }, 'Click a start date, then an end date. Clicking a new date after selecting a range starts a fresh selection.'),
              ]),
            ]),
          ]),

          h('div', { className: `flex items-center justify-between gap-3 px-5 py-4 border-t ${headerBorder} ${footerBg}` }, [
            h('div', { className: `text-xs ${hintTextClass}` }, 'Esc to close'),
            h('div', { className: 'flex items-center gap-2' }, [
              h('button', {
                type: 'button',
                onClick: () => onClose?.(),
                className: cancelButtonClass,
              }, 'Cancel'),
              h('button', {
                type: 'button',
                onClick: apply,
                className: 'h-9 px-4 rounded-lg bg-netnet-purple text-white hover:brightness-110',
              }, 'Apply'),
            ]),
          ]),
        ])
      ),
    ]),
    document.body
  );
}

function ReportsControlBar({ report, state, onChange }) {
  const presets = [
    { label: 'Last 7 days', value: 'last-7' },
    { label: 'Last 30 days', value: 'last-30' },
    { label: 'Last 90 days', value: 'last-90' },
    { label: 'Custom', value: 'custom' },
  ];
  const groups = report === 'sales'
    ? [
        { label: 'Service Type', value: 'service-type' },
        { label: 'Owner', value: 'team-member' },
        { label: 'Opportunity', value: 'job' },
        { label: 'Client', value: 'client' },
        { label: 'Stage', value: 'deliverable-type' },
      ]
    : [
        { label: 'Service Type', value: 'service-type' },
        { label: 'Team Member', value: 'team-member' },
        { label: 'Job', value: 'job' },
        { label: 'Client', value: 'client' },
        { label: 'Deliverable Type', value: 'deliverable-type' },
      ];

  const [exportOpen, setExportOpen] = useState(false);
  const customBtnRef = useRef(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerAnchor, setPickerAnchor] = useState(null);
  const [pickerInitial, setPickerInitial] = useState({ start: '', end: '' });
  const getSafeAnchorRect = (el) => {
    if (!el) return { top: 40, left: 20, width: 0, height: 0, right: 20, bottom: 40 };
    const rect = el.getBoundingClientRect();
    const safeTop = Math.max(0, rect.top);
    const safeLeft = Math.max(0, rect.left);
    const safeRight = Math.max(safeLeft + rect.width, rect.right);
    const safeBottom = Math.max(safeTop + rect.height, rect.bottom);
    return { top: safeTop, left: safeLeft, width: rect.width, height: rect.height, right: safeRight, bottom: safeBottom };
  };

  const openCustomPicker = () => {
    const rect = getSafeAnchorRect(customBtnRef.current);
    const r = getReportRange(state);
    const defaultStart = (state.range === 'custom' && state.start)
      ? state.start
      : r.start.toISOString().split('T')[0];
    const defaultEnd = (state.range === 'custom' && state.end)
      ? state.end
      : r.end.toISOString().split('T')[0];
    setPickerInitial({ start: defaultStart, end: defaultEnd });
    setPickerAnchor(rect);
    setPickerOpen(true);
  };

  const handleRange = (val) => {
    if (val === 'custom') {
      openCustomPicker();
      return;
    }
    setPickerOpen(false);
    const next = { ...state, range: val, start: '', end: '' };
    const qs = updateReportQuery(next);
    navigate(`#${location.hash.split('?')[0].replace('#', '')}?${qs}`);
    onChange && onChange(next);
  };
  const handleCompare = () => {
    const next = { ...state, compare: !state.compare };
    const qs = updateReportQuery(next);
    navigate(`#${location.hash.split('?')[0].replace('#', '')}?${qs}`);
    onChange && onChange(next);
  };
  const handleGroup = (val) => {
    const next = { ...state, groupBy: val };
    const qs = updateReportQuery(next);
    navigate(`#${location.hash.split('?')[0].replace('#', '')}?${qs}`);
    onChange && onChange(next);
  };

  const applyCustom = ({ start, end }) => {
    const next = { ...state, range: 'custom', start, end };
    const qs = updateReportQuery(next);
    navigate(`#${location.hash.split('?')[0].replace('#', '')}?${qs}`);
    onChange && onChange(next);
    setPickerOpen(false);
  };

  return h('div', { className: 'rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900/80 shadow-sm p-3 flex flex-wrap items-center gap-3', 'data-demo': 'reports-control-bar' }, [
    h('div', { className: 'flex items-center gap-2' }, [
      h('span', { className: 'text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400' }, 'Date Range'),
      h('div', { className: 'inline-flex items-center gap-1 rounded-full border border-slate-300 dark:border-white/10 bg-slate-50 dark:bg-slate-800 px-1 py-1' },
        presets.map((p) =>
          h('button', {
            key: p.value,
            ref: p.value === 'custom' ? customBtnRef : null,
            type: 'button',
            className: [
              'px-3 py-1 rounded-full text-sm font-medium transition-colors border',
              state.range === p.value
                ? 'bg-[var(--color-brand-purple,#711FFF)] text-white shadow-sm border-transparent'
                : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white bg-transparent border-transparent hover:bg-slate-100 hover:border-slate-300 dark:hover:bg-white/10 dark:hover:border-white/25',
            ].join(' '),
            onClick: () => handleRange(p.value),
          }, p.label)
        )
      ),
    ]),
    h('div', { className: 'flex items-center gap-2' }, [
      h('label', { className: 'flex items-center gap-2 text-sm text-slate-700 dark:text-slate-200 cursor-pointer' }, [
        h('input', {
          type: 'checkbox',
          checked: state.compare,
          onChange: handleCompare,
          className: 'h-4 w-4 rounded border-slate-300 dark:border-white/20 text-[var(--color-brand-purple,#711FFF)] focus:ring-[var(--color-brand-purple,#711FFF)]',
        }),
        h('span', null, 'Compare to previous'),
      ]),
    ]),
    h('div', { className: 'flex items-center gap-2' }, [
      h('span', { className: 'text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400' }, 'Group By'),
      h('select', {
        value: state.groupBy,
        onChange: (e) => handleGroup(e.target.value),
        className: 'rounded-lg border border-slate-300 dark:border-white/10 bg-white dark:bg-slate-900 px-3 py-2 text-sm text-slate-800 dark:text-white',
      }, groups.map((g) => h('option', { key: g.value, value: g.value }, g.label))),
    ]),
    h('div', { className: 'relative' }, [
      h('button', {
        type: 'button',
        className: 'inline-flex items-center gap-2 rounded-lg border border-slate-300 dark:border-white/10 bg-white dark:bg-slate-900 px-3 py-2 text-sm font-semibold text-slate-800 dark:text-white hover:bg-slate-50 dark:hover:bg-slate-800',
        onClick: () => setExportOpen((o) => !o),
      }, [
        h('span', null, 'Export'),
        h('svg', { viewBox: '0 0 24 24', className: 'h-4 w-4', fill: 'none', stroke: 'currentColor', strokeWidth: '1.8' }, [
          h('path', { d: 'M6 9l6 6 6-6' }),
        ]),
      ]),
      exportOpen
        ? h('div', { className: 'absolute right-0 mt-2 w-40 rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 shadow-lg z-10' },
            ['PDF', 'XLS', 'CSV'].map((opt) =>
              h('button', {
                key: opt,
                type: 'button',
                className: 'w-full text-left px-3 py-2 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800',
                onClick: () => { console.log(`[Export] ${opt}`); setExportOpen(false); },
              }, `Export as ${opt}`)
            )
          )
        : null,
    ]),

    h(DateRangePickerPopover, {
      open: pickerOpen,
      anchorRect: pickerAnchor,
      initialStart: pickerInitial.start,
      initialEnd: pickerInitial.end,
      onClose: () => setPickerOpen(false),
      onApply: applyCustom,
    }),
  ]);
}

function ReportsSubnav({ active, onChange }) {
  return h('div', { className: 'inline-flex items-center gap-1 rounded-full border border-slate-300 dark:border-white/10 bg-slate-50 dark:bg-slate-800 px-1 py-1' },
    REPORTS_TABS.map((tab) =>
      h('button', {
        key: tab.value,
        type: 'button',
        className: [
          'px-3 py-1 rounded-full text-sm font-medium transition-colors border',
          tab.value === active
            ? 'bg-[var(--color-brand-purple,#711FFF)] dark:bg-[var(--color-brand-purple,#711FFF)] text-white shadow-sm border-transparent'
            : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white bg-transparent border-transparent hover:bg-slate-100 hover:border-slate-300 dark:hover:bg-white/10 dark:hover:border-white/25',
        ].join(' '),
        onClick: () => onChange(tab.value),
      }, tab.label)
    )
  );
}

export function ReportsShell({ report, queryString }) {
  const params = useMemo(() => new URLSearchParams(queryString), [queryString]);
  const defaultGroup = report === 'team' ? 'team-member' : REPORT_DEFAULT_GROUP;
  const [reportState, setReportState] = useState(parseReportState(queryString, defaultGroup));
  useEffect(() => {
    setReportState(parseReportState(queryString, defaultGroup));
  }, [queryString, defaultGroup]);
  const onNav = (val) => {
    navigate(`#/app/performance/reports/${val}?${location.hash.split('?')[1] || ''}`);
  };
  const onStateChange = (next) => setReportState(next);

  const label = REPORTS_TABS.find((t) => t.value === report)?.label || 'Report';
  const salesView = params.get('view') || '';

  return h('div', { className: 'space-y-6' }, [
    h('div', { className: 'flex items-center justify-between flex-wrap gap-3' }, [
      h(ReportsSubnav, { active: report, onChange: onNav }),
      h('span', { className: 'text-sm text-slate-500 dark:text-slate-400' }, label),
    ]),
    h(ReportsControlBar, { report, state: reportState, onChange: onStateChange }),
    report === 'time'
      ? h(TimeReport, { state: reportState })
      : report === 'team'
        ? h(TeamReport, { state: reportState })
        : report === 'sales'
          ? h(SalesReport, { state: reportState, view: salesView })
          : h('div', { className: 'space-y-4' }, [
            h('div', { className: 'rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900/80 shadow-sm p-5 space-y-2' }, [
              h('h3', { className: 'text-lg font-semibold text-slate-900 dark:text-white' }, `${label} Report Snapshot`),
              h('p', { className: 'text-sm text-slate-600 dark:text-slate-300' }, 'Snapshot (placeholder)'),
            ]),
            h('div', { className: 'rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900/80 shadow-sm p-5 space-y-2' }, [
              h('h3', { className: 'text-lg font-semibold text-slate-900 dark:text-white' }, `${label} Report Activity`),
              h('p', { className: 'text-sm text-slate-600 dark:text-slate-300' }, 'Activity (placeholder)'),
            ]),
          ]),
  ]);
}

function buildServiceTypeMaps(serviceTypes) {
  const byId = new Map();
  const byName = new Map();
  serviceTypes.forEach((st) => {
    byId.set(st.id, st);
    if (st.name) byName.set(String(st.name).toLowerCase(), st);
  });
  return { byId, byName };
}

function resolveServiceTypeId({ entry, task, job, serviceTypeMaps }) {
  const fromEntry = entry?.serviceTypeId && serviceTypeMaps.byId.get(entry.serviceTypeId);
  if (fromEntry) return entry.serviceTypeId;
  const fromTask = task?.serviceTypeId && serviceTypeMaps.byId.get(task.serviceTypeId);
  if (fromTask) return task.serviceTypeId;
  const jobType = job?.serviceType && serviceTypeMaps.byName.get(String(job.serviceType).toLowerCase());
  if (jobType) return jobType.id;
  return null;
}

function buildTimeContext() {
  const serviceTypeMaps = buildServiceTypeMaps(performanceServiceTypes);
  const teamMap = new Map(performanceTeam.map((m) => [m.id, m]));
  const jobMap = new Map(performanceJobs.map((j) => [j.id, j]));
  const deliverableMap = new Map(performanceDeliverables.map((d) => [d.id, d]));
  const taskMap = new Map(performanceTasks.map((t) => [t.id, t]));
  return { teamMap, jobMap, deliverableMap, taskMap, serviceTypeMaps };
}

function enrichTimeEntriesForRange(range) {
  const ctx = buildTimeContext();
  const entries = performanceTimeEntries.map((entry, idx) => {
    const task = entry.taskId ? ctx.taskMap.get(entry.taskId) : null;
    const deliverable = task ? ctx.deliverableMap.get(task.deliverableId) : null;
    const job = deliverable ? ctx.jobMap.get(deliverable.jobId) : null;
    const memberId = entry.memberId || task?.assigneeId || null;
    const member = memberId ? ctx.teamMap.get(memberId) : null;
    const serviceTypeId = entry.serviceTypeId || resolveServiceTypeId({ entry, task, job, serviceTypeMaps: ctx.serviceTypeMaps });
    const serviceType = performanceServiceTypes.find((s) => s.id === serviceTypeId);
    const dateObj = new Date(entry.date);
    const type = entry.quickTask ? 'quick' : 'job';
    return {
      uid: entry.id || `te-${idx}`,
      date: isNaN(dateObj) ? null : dateObj,
      duration: Number(entry.hours) || 0,
      notes: entry.notes || '',
      taskTitle: entry.title || task?.title || entry.taskTitle || 'Task',
      type,
      job,
      deliverable,
      member,
      memberId,
      serviceType,
      serviceTypeId: serviceTypeId || 'other',
      raw: entry,
    };
  }).filter((e) => e.date && e.date >= range.start && e.date <= range.end);
  return entries.sort((a, b) => b.date - a.date);
}

function buildDailyTotals(entries, range) {
  const days = [];
  for (let d = new Date(range.start); d <= range.end; d.setDate(d.getDate() + 1)) {
    days.push({ date: new Date(d), hours: 0 });
  }
  entries.forEach((e) => {
    const key = e.date.toISOString().split('T')[0];
    const day = days.find((d) => d.date.toISOString().split('T')[0] === key);
    if (day) day.hours += e.duration;
  });
  const max = Math.max(...days.map((d) => d.hours), 0);
  return { days, max };
}

function buildTopGroups(entries, key) {
  const totals = {};
  entries.forEach((e) => {
    let k = 'other';
    let label = 'Other';
    if (key === 'service-type') {
      k = e.serviceTypeId || 'other';
      label = e.serviceType?.name || 'Other';
    } else if (key === 'job') {
      k = e.job?.id ? `job-${e.job.id}` : 'other';
      label = e.job ? `${e.job.name}` : 'Other';
    } else if (key === 'team-member') {
      k = e.memberId || 'other';
      label = e.member?.name || 'Other';
    } else if (key === 'client') {
      k = e.job?.client ? `client-${e.job.client}` : 'other';
      label = e.job?.client || 'Other';
    }
    totals[k] = totals[k] || { id: k, label, hours: 0 };
    totals[k].hours += e.duration;
  });
  const arr = Object.values(totals).sort((a, b) => b.hours - a.hours);
  const top = arr.slice(0, 5);
  const otherHours = arr.slice(5).reduce((sum, item) => sum + item.hours, 0);
  if (otherHours > 0) top.push({ id: 'other', label: 'Other', hours: otherHours });
  const totalHours = arr.reduce((sum, item) => sum + item.hours, 0) || 1;
  return top.map((item, idx) => ({
    ...item,
    percent: Math.round((item.hours / totalHours) * 100),
    color: REPORT_COLORS[idx % REPORT_COLORS.length],
  }));
}

function TimeBars({ data }) {
  const max = data.max || 1;
  return h('div', { className: 'w-full', 'data-demo': 'time-bars' },
    h('div', { className: 'flex items-end gap-1 h-36' },
      data.days.map((d, idx) => {
        const height = max === 0 ? 0 : Math.round((d.hours / max) * 100);
        const label = d.date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
        return h('div', { key: idx, className: 'flex-1 flex flex-col items-center gap-1' }, [
          h('div', {
            className: 'w-full rounded-t-md bg-[var(--color-brand-purple,#711FFF)] dark:bg-[var(--color-brand-purple,#711FFF)] transition-all',
            style: { height: `${height}%`, minHeight: d.hours > 0 ? '6px' : '4px', opacity: d.hours > 0 ? 1 : 0.35 },
            title: `${label}: ${d.hours.toFixed(1)}h`,
          }),
          h('div', { className: 'text-[10px] text-slate-500 dark:text-slate-400 rotate-45 origin-top-left' }, label),
        ]);
      })
    )
  );
}

function TimeDonut({ title, items }) {
  const total = items.reduce((sum, i) => sum + i.percent, 0) || 1;
  let current = 0;
  const segments = items.map((i) => {
    const start = current;
    const end = current + i.percent;
    current = end;
    return `${i.color} ${start}% ${end}%`;
  }).join(', ');
  return h('div', { className: 'rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900/80 shadow-sm p-4 space-y-3', 'data-demo': 'time-donut' }, [
    h('div', { className: 'flex items-center justify-between' }, [
      h('h4', { className: 'text-sm font-semibold text-slate-900 dark:text-white' }, title),
      h('span', { className: 'text-xs text-slate-500 dark:text-slate-400' }, `${total}%`),
    ]),
    items.length === 0
      ? h('div', { className: 'text-sm text-slate-600 dark:text-slate-300' }, 'No data')
      : h('div', { className: 'flex items-center gap-4' }, [
          h('div', {
            className: 'h-24 w-24 rounded-full border border-slate-200 dark:border-white/10',
            style: { backgroundImage: `conic-gradient(${segments})` },
          }),
          h('div', { className: 'space-y-1 text-sm text-slate-700 dark:text-slate-200' },
            items.map((i) =>
              h('div', { key: i.id, className: 'flex items-center gap-2' }, [
                h('span', { className: 'inline-block w-2.5 h-2.5 rounded-full', style: { backgroundColor: i.color } }),
                h('span', { className: 'flex-1' }, i.label),
                h('span', { className: 'text-xs text-slate-500 dark:text-slate-400' }, `${i.hours.toFixed(1)}h (${i.percent}%)`),
              ])
            )
          ),
        ]),
  ]);
}

function TimeEntryRow({ entry, onEdit, onDelete, isEditing, editingValue, setEditingValue, onSave }) {
  const formatDate = (d) => d ? d.toISOString().split('T')[0] : '';
  const contextLine = entry.type === 'job' && entry.job
    ? `↳ Job #${entry.job.id} — ${entry.job.name}${entry.job.client ? ` (${entry.job.client})` : ''}`
    : null;
  return h('div', { className: 'divide-y divide-slate-100 dark:divide-white/5', 'data-demo': 'time-entry-row' }, [
    !isEditing
      ? h('div', { className: 'px-4 py-3 flex flex-col md:flex-row md:items-center md:justify-between gap-3' }, [
          h('div', { className: 'space-y-1' }, [
            h('div', { className: 'text-sm font-semibold text-slate-900 dark:text-white' }, entry.taskTitle),
            contextLine
              ? h('div', { className: 'text-xs text-slate-500 dark:text-slate-400' }, contextLine)
              : null,
            entry.notes
              ? h('div', { className: 'text-xs text-slate-600 dark:text-slate-300' }, entry.notes)
              : null,
          ]),
          h('div', { className: 'flex items-center gap-4 text-sm text-slate-600 dark:text-slate-300' }, [
            h('span', null, entry.member?.name || 'Unassigned'),
            h('span', { className: 'text-xs rounded-full bg-slate-100 dark:bg-slate-800 px-2 py-1' }, entry.serviceType?.name || 'Other'),
            h('span', null, formatDate(entry.date)),
            h('span', { className: 'font-semibold text-slate-900 dark:text-white' }, `${entry.duration.toFixed(1)}h`),
            h('div', { className: 'flex items-center gap-2' }, [
              h('button', { type: 'button', className: 'text-xs text-[var(--color-brand-purple,#711FFF)]', onClick: () => onEdit(entry) }, 'Edit'),
              h('button', { type: 'button', className: 'text-xs text-red-600 dark:text-red-300', onClick: () => onDelete(entry) }, 'Delete'),
            ]),
          ]),
        ])
      : h('div', { className: 'px-4 py-3 flex flex-col gap-3 bg-slate-50 dark:bg-slate-800/60' }, [
          h('div', { className: 'flex flex-wrap gap-3' }, [
            h('label', { className: 'text-sm text-slate-600 dark:text-slate-300 flex flex-col gap-1' }, [
              'Date',
              h('input', { type: 'date', className: 'rounded border border-slate-300 dark:border-white/10 bg-white dark:bg-slate-900 px-2 py-1 text-sm', value: editingValue.date, onChange: (e) => setEditingValue((v) => ({ ...v, date: e.target.value })) }),
            ]),
            h('label', { className: 'text-sm text-slate-600 dark:text-slate-300 flex flex-col gap-1' }, [
              'Hours',
              h('input', { type: 'number', step: '0.1', min: '0', className: 'rounded border border-slate-300 dark:border-white/10 bg-white dark:bg-slate-900 px-2 py-1 text-sm', value: editingValue.duration, onChange: (e) => setEditingValue((v) => ({ ...v, duration: e.target.value })) }),
            ]),
          ]),
          h('label', { className: 'text-sm text-slate-600 dark:text-slate-300 flex flex-col gap-1' }, [
            'Notes',
            h('textarea', { className: 'rounded border border-slate-300 dark:border-white/10 bg-white dark:bg-slate-900 px-2 py-1 text-sm', value: editingValue.notes, onChange: (e) => setEditingValue((v) => ({ ...v, notes: e.target.value })) }),
          ]),
          h('div', { className: 'flex items-center gap-2' }, [
            h('button', { type: 'button', className: 'px-3 py-1 rounded bg-[var(--color-brand-purple,#711FFF)] text-white text-sm', onClick: onSave }, 'Save'),
            h('button', { type: 'button', className: 'px-3 py-1 rounded bg-slate-200 dark:bg-slate-700 text-sm text-slate-800 dark:text-white', onClick: () => onEdit(null) }, 'Cancel'),
          ]),
        ]),
  ]);
}

function TimeReport({ state }) {
  const range = useMemo(() => getReportRange(state), [state]);
  const prevRange = useMemo(() => getPreviousRange(range), [range]);
  const baseEntries = useMemo(() => enrichTimeEntriesForRange(range), [range]);
  const [entries, setEntries] = useState(baseEntries);
  useEffect(() => { setEntries(baseEntries); }, [baseEntries]);

  const daily = useMemo(() => buildDailyTotals(entries, range), [entries, range]);
  const groups = useMemo(() => ({
    service: buildTopGroups(entries, 'service-type'),
    job: buildTopGroups(entries, 'job'),
    member: buildTopGroups(entries, 'team-member'),
  }), [entries]);

  const primaryDonutKey = state.groupBy || REPORT_DEFAULT_GROUP;
  const donutOrder = ['service-type', 'job', 'team-member'].sort((a, b) => (a === primaryDonutKey ? -1 : b === primaryDonutKey ? 1 : 0));
  const donutMap = {
    'service-type': { title: 'Service Types', data: groups.service },
    job: { title: 'Jobs', data: groups.job },
    'team-member': { title: 'Team Members', data: groups.member },
  };

  const [editingId, setEditingId] = useState(null);
  const [editingValue, setEditingValue] = useState({ date: '', duration: '', notes: '' });

  const startEdit = (entry) => {
    if (!entry) {
      setEditingId(null);
      return;
    }
    setEditingId(entry.uid);
    setEditingValue({
      date: entry.date ? entry.date.toISOString().split('T')[0] : '',
      duration: entry.duration.toString(),
      notes: entry.notes || '',
    });
  };

  const saveEdit = () => {
    setEntries((prev) => prev.map((e) => {
      if (e.uid !== editingId) return e;
      const nextDate = new Date(editingValue.date);
      return {
        ...e,
        date: isNaN(nextDate) ? e.date : nextDate,
        duration: Math.max(0, Number(editingValue.duration) || 0),
        notes: editingValue.notes || '',
      };
    }));
    setEditingId(null);
  };

  const deleteEntry = (entry) => {
    if (!entry) return;
    if (confirm('Delete this time entry?')) {
      setEntries((prev) => prev.filter((e) => e.uid !== entry.uid));
    }
  };

  return h('div', { className: 'space-y-6' }, [
    state.compare
      ? h('div', { className: 'text-sm text-slate-600 dark:text-slate-300' }, `Comparing to: ${prevRange.start.toISOString().split('T')[0]} → ${prevRange.end.toISOString().split('T')[0]}`)
      : null,
    h('div', { className: 'rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900/80 shadow-sm p-5 space-y-4' }, [
      h('div', { className: 'flex items-center justify-between' }, [
        h('h3', { className: 'text-lg font-semibold text-slate-900 dark:text-white' }, 'Time Report Snapshot'),
        h('span', { className: 'text-sm text-slate-500 dark:text-slate-400' }, `${range.start.toISOString().split('T')[0]} → ${range.end.toISOString().split('T')[0]}`),
      ]),
      entries.length === 0
        ? h('div', { className: 'text-sm text-slate-600 dark:text-slate-300' }, 'No time entries for this period.')
        : h(React.Fragment, null, [
            h(TimeBars, { data: daily }),
            h('div', { className: 'grid grid-cols-1 md:grid-cols-3 gap-3' },
              donutOrder.map((key) => {
                const cfg = donutMap[key];
                return h(TimeDonut, { key, title: cfg.title, items: cfg.data });
              })
            ),
          ]),
    ]),
    h('div', { className: 'rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900/80 shadow-sm' }, [
      h('div', { className: 'px-5 py-4 border-b border-slate-100 dark:border-white/5 flex items-center justify-between' }, [
        h('div', { className: 'space-y-1' }, [
          h('h3', { className: 'text-lg font-semibold text-slate-900 dark:text-white' }, 'Time Report Activity'),
          h('p', { className: 'text-sm text-slate-600 dark:text-slate-300' }, 'Entries in the selected date range.'),
        ]),
        h('span', { className: 'text-sm text-slate-500 dark:text-slate-400' }, `${entries.length} entries`),
      ]),
      entries.length === 0
        ? h('div', { className: 'p-5 text-sm text-slate-600 dark:text-slate-300' }, 'No time entries for this period.')
        : h('div', { className: 'divide-y divide-slate-100 dark:divide-white/5' },
            entries.map((entry) =>
              h(TimeEntryRow, {
                key: entry.uid,
                entry,
                onEdit: startEdit,
                onDelete: deleteEntry,
                isEditing: editingId === entry.uid,
                editingValue,
                setEditingValue,
                onSave: saveEdit,
              })
            )
          ),
    ]),
  ]);
}

function getGroupLabel(entry, group) {
  if (group === 'team-member') return { id: entry.memberId || 'unassigned', label: entry.member?.name || 'Unassigned' };
  if (group === 'service-type') return { id: entry.serviceTypeId || 'other', label: entry.serviceType?.name || 'Other' };
  if (group === 'deliverable-type') return { id: entry.deliverable?.type || 'job-deliverable', label: entry.deliverable?.type || 'Job Deliverable' };
  if (group === 'job') return { id: entry.job?.id ? `job-${entry.job.id}` : 'other', label: entry.job?.name || 'Other' };
  if (group === 'client') return { id: entry.job?.client ? `client-${entry.job.client}` : 'other', label: entry.job?.client || 'Other' };
  return { id: 'other', label: 'Other' };
}

function computeLoeForRange(range, groupBy) {
  const ctx = buildTimeContext();
  const completed = performanceDeliverables.filter((d) => {
    if (d.status !== 'completed') return false;
    const c = new Date(d.completedAt || d.due);
    return !isNaN(c) && c >= range.start && c <= range.end;
  });
  if (!completed.length) return { rows: [], activities: [] };

  const completedIds = new Set(completed.map((d) => d.id));
  const actualTotals = {};
  performanceTimeEntries.forEach((entry) => {
    const task = entry.taskId ? ctx.taskMap.get(entry.taskId) : null;
    const deliverable = task ? ctx.deliverableMap.get(task.deliverableId) : null;
    if (!deliverable || !completedIds.has(deliverable.id)) return;
    const hours = Math.max(0, Number(entry.hours) || 0);
    actualTotals[deliverable.id] = (actualTotals[deliverable.id] || 0) + hours;
  });

  const baselineMap = {};
  completed.forEach((d) => {
    const tasks = performanceTasks.filter((t) => t.deliverableId === d.id);
    const baseline = Number(d.estHours) || tasks.reduce((sum, t) => sum + (Number(t.estimatedHours) || 0), 0) || 1;
    baselineMap[d.id] = baseline;
  });

  const entriesInRange = enrichTimeEntriesForRange(range).filter((e) => e.deliverable && completedIds.has(e.deliverable.id));

  const contribPerGroup = new Map();
  const contribPerDeliverable = new Map();

  entriesInRange.forEach((entry) => {
    const deliverableId = entry.deliverable.id;
    const group = getGroupLabel(entry, groupBy);
    if (!group.id) return;
    const hours = Math.max(0, Number(entry.duration) || 0);
    if (hours <= 0) return;
    const key = group.id;
    const existing = contribPerGroup.get(key) || { id: group.id, label: group.label, hours: 0, weighted: 0 };
    const variance = (actualTotals[deliverableId] || 0) / (baselineMap[deliverableId] || 1);
    existing.hours += hours;
    existing.weighted += variance * hours;
    contribPerGroup.set(key, existing);

    const perDel = contribPerDeliverable.get(deliverableId) || [];
    perDel.push({ groupId: group.id, groupLabel: group.label, hours, variance });
    contribPerDeliverable.set(deliverableId, perDel);
  });

  const rows = Array.from(contribPerGroup.values()).map((row) => {
    const ratio = row.hours ? row.weighted / row.hours : null;
    const percent = ratio != null ? Math.round(ratio * 100) : null;
    const tone = percent == null ? 'neutral' : percent <= 100 ? 'green' : percent <= 115 ? 'amber' : 'red';
    return { ...row, percent, tone };
  }).sort((a, b) => (b.hours - a.hours));

  const activities = completed.map((del) => {
    const job = ctx.jobMap.get(del.jobId);
    const contribs = (contribPerDeliverable.get(del.id) || []).sort((a, b) => b.hours - a.hours);
    const actual = actualTotals[del.id] || 0;
    const baseline = baselineMap[del.id] || 1;
    const variance = actual / baseline;
    return { del, job, contribs, actual, baseline, variance };
  }).filter((a) => a.contribs.length > 0);

  return { rows, activities };
}

function TeamReport({ state }) {
  const range = useMemo(() => getReportRange(state), [state]);
  const prevRange = useMemo(() => getPreviousRange(range), [range]);
  const groupBy = state.groupBy || 'team-member';
  const current = useMemo(() => computeLoeForRange(range, groupBy), [range, groupBy]);
  const previous = useMemo(() => state.compare ? computeLoeForRange(prevRange, groupBy) : null, [state.compare, prevRange, groupBy]);

  const prevMap = useMemo(() => {
    if (!previous) return new Map();
    const map = new Map();
    previous.rows.forEach((r) => map.set(r.id, r));
    return map;
  }, [previous]);

  const rows = current.rows.map((row) => {
    const prev = prevMap.get(row.id);
    const delta = prev && prev.percent != null && row.percent != null ? Math.round((row.percent - prev.percent)) : null;
    return { ...row, delta };
  });

  const deltaLabel = (r) => {
    if (r.delta == null) return null;
    const dir = r.delta === 0 ? '→' : r.delta > 0 ? '↑' : '↓';
    const sign = r.delta > 0 ? '+' : '';
    return `${dir} ${sign}${r.delta}%`;
  };

  const formatDate = (d) => d ? d.toISOString().split('T')[0] : '';

  return h('div', { className: 'space-y-6' }, [
    state.compare
      ? h('div', { className: 'text-sm text-slate-600 dark:text-slate-300' }, `Comparing to: ${formatDate(prevRange.start)} → ${formatDate(prevRange.end)}`)
      : null,
    h('div', { className: 'rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900/80 shadow-sm' }, [
      h('div', { className: 'px-5 py-4 border-b border-slate-100 dark:border-white/5 flex items-center justify-between' }, [
        h('div', { className: 'space-y-1' }, [
          h('h3', { className: 'text-lg font-semibold text-slate-900 dark:text-white' }, 'Team Report Snapshot'),
          h('p', { className: 'text-sm text-slate-600 dark:text-slate-300' }, `Group by ${groupBy.replace('-', ' ')}`),
        ]),
        h('span', { className: 'text-sm text-slate-500 dark:text-slate-400' }, `${formatDate(range.start)} → ${formatDate(range.end)}`),
      ]),
      current.rows.length === 0
        ? h('div', { className: 'p-5 text-sm text-slate-600 dark:text-slate-300' }, 'No completed deliverables in this period.')
        : h('div', { className: 'divide-y divide-slate-100 dark:divide-white/5' },
            rows.map((row) => {
              const toneClass = row.tone === 'red' ? 'text-red-600 dark:text-red-300'
                : row.tone === 'amber' ? 'text-amber-600 dark:text-amber-300'
                : row.tone === 'green' ? 'text-emerald-600 dark:text-emerald-300'
                : 'text-slate-500 dark:text-slate-400';
              const dotClass = row.tone === 'red' ? 'bg-red-500' : row.tone === 'amber' ? 'bg-amber-500' : 'bg-emerald-500';
              return h('div', { key: row.id, className: 'px-5 py-3 flex items-center justify-between gap-3', 'data-demo': 'team-report-snapshot-row' }, [
                h('div', { className: 'flex items-center gap-3' }, [
                  h('span', { className: `w-2.5 h-2.5 rounded-full ${dotClass}` }),
                  h('span', { className: 'text-sm font-semibold text-slate-900 dark:text-white' }, row.label),
                ]),
                h('div', { className: 'flex items-center gap-3 text-sm text-slate-600 dark:text-slate-300' }, [
                  h('span', { className: `text-base font-semibold ${toneClass}` }, row.percent != null ? `${row.percent}%` : '—'),
                  h('span', { className: 'text-xs text-slate-500 dark:text-slate-400' }, `${Math.round(row.hours)}h`),
                  row.delta != null ? h('span', { className: 'text-xs text-slate-500 dark:text-slate-400' }, deltaLabel(row)) : null,
                ]),
              ]);
            })
          ),
    ]),
    h('div', { className: 'rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900/80 shadow-sm' }, [
      h('div', { className: 'px-5 py-4 border-b border-slate-100 dark:border-white/5 flex items-center justify-between' }, [
        h('div', { className: 'space-y-1' }, [
          h('h3', { className: 'text-lg font-semibold text-slate-900 dark:text-white' }, 'Team Report Activity'),
          h('p', { className: 'text-sm text-slate-600 dark:text-slate-300' }, 'Deliverables completed in this period with contributions.'),
        ]),
        h('span', { className: 'text-sm text-slate-500 dark:text-slate-400' }, `${current.activities.length} items`),
      ]),
      current.activities.length === 0
        ? h('div', { className: 'p-5 text-sm text-slate-600 dark:text-slate-300' }, 'No completed deliverables in this period.')
        : h('div', { className: 'divide-y divide-slate-100 dark:divide-white/5' },
            current.activities.map((item) =>
              h('div', { key: item.del.id, className: 'px-5 py-4 space-y-2', 'data-demo': 'team-report-activity-row' }, [
                h('div', { className: 'text-sm font-semibold text-slate-900 dark:text-white' }, `${item.job ? `Job #${item.job.id} — ${item.job.name}` : 'Job'}${item.job?.client ? ` (${item.job.client})` : ''}`),
                h('div', { className: 'text-sm text-slate-600 dark:text-slate-300' }, item.del.name),
                h('div', { className: 'flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400' }, [
                  h('span', null, `Baseline ${Math.round(item.baseline)}h`),
                  h('span', null, `Actual ${Math.round(item.actual)}h`),
                  h('span', null, `Variance ${(item.variance * 100).toFixed(0)}%`),
                ]),
                h('div', { className: 'flex flex-wrap gap-2 text-xs text-slate-700 dark:text-slate-200' },
                  item.contribs.slice(0, 6).map((c) =>
                    h('span', { key: c.groupId, className: 'inline-flex items-center gap-2 rounded-full bg-slate-100 dark:bg-slate-800 px-3 py-1' }, [
                      h('span', { className: 'font-semibold' }, c.groupLabel),
                      h('span', null, `${Math.round(c.hours)}h`),
                    ])
                  )
                ),
              ])
            )
          ),
    ]),
  ]);
}

const SALES_STAGE_LABELS = {
  lead: 'Lead',
  discovery: 'Discovery',
  proposal: 'Proposal',
  negotiation: 'Negotiation',
  won: 'Won',
  lost: 'Lost',
};

function getSalesStageChipClass(stage) {
  if (stage === 'won') return 'bg-emerald-500/15 text-emerald-200 border-emerald-500/30 dark:bg-emerald-500/20 dark:text-emerald-200 dark:border-emerald-500/30';
  if (stage === 'lost') return 'bg-rose-500/15 text-rose-200 border-rose-500/30 dark:bg-rose-500/20 dark:text-rose-200 dark:border-rose-500/30';
  if (stage === 'negotiation') return 'bg-amber-500/15 text-amber-200 border-amber-500/30 dark:bg-amber-500/20 dark:text-amber-200 dark:border-amber-500/30';
  if (stage === 'proposal') return 'bg-sky-500/15 text-sky-200 border-sky-500/30 dark:bg-sky-500/20 dark:text-sky-200 dark:border-sky-500/30';
  return 'bg-slate-500/10 text-slate-200 border-white/10 dark:bg-white/10 dark:text-white/70 dark:border-white/10';
}

function isDateInRange(iso, range) {
  const d = parseISODate(iso);
  if (!d) return false;
  d.setHours(0, 0, 0, 0);
  return d >= range.start && d <= range.end;
}

function buildSalesDailyWon(range, deals) {
  const days = Array.from({ length: range.days }).map((_, idx) => {
    const d = new Date(range.start);
    d.setDate(range.start.getDate() + idx);
    const iso = formatISODate(d);
    return { date: d, iso, value: 0, count: 0 };
  });
  const indexByIso = new Map(days.map((d, i) => [d.iso, i]));

  for (const deal of deals) {
    if (deal.stage !== 'won' || !deal.closedAt) continue;
    const idx = indexByIso.get(deal.closedAt);
    if (idx == null) continue;
    const amt = Number(deal.amount || 0);
    days[idx].value += amt;
    days[idx].count += 1;
  }
  return days;
}

function computeSalesMetrics(deals, range) {
  const created = deals.filter((d) => isDateInRange(d.createdAt, range));
  const won = deals.filter((d) => d.stage === 'won' && d.closedAt && isDateInRange(d.closedAt, range));
  const lost = deals.filter((d) => d.stage === 'lost' && d.closedAt && isDateInRange(d.closedAt, range));
  const open = deals.filter((d) => !['won', 'lost'].includes(d.stage));
  const pipelineValue = open.reduce((s, d) => s + Number(d.amount || 0), 0);
  const revenue = won.reduce((s, d) => s + Number(d.amount || 0), 0);
  const closedCount = won.length + lost.length;
  const winRate = closedCount ? won.length / closedCount : null;
  return {
    createdCount: created.length,
    openCount: open.length,
    wonCount: won.length,
    lostCount: lost.length,
    pipelineValue,
    revenue,
    winRate,
  };
}

function buildSalesBreakdown(deals, groupBy) {
  const serviceTypeName = (id) => performanceServiceTypes.find((s) => s.id === id)?.name || 'Other';
  const keyFn = (deal) => {
    if (groupBy === 'team-member') return deal.owner || 'Unassigned';
    if (groupBy === 'client') return deal.client || 'Unknown';
    if (groupBy === 'job') return deal.name || 'Opportunity';
    if (groupBy === 'deliverable-type') return SALES_STAGE_LABELS[deal.stage] || 'Other';
    return serviceTypeName(deal.serviceTypeId);
  };
  const title =
    groupBy === 'team-member'
      ? 'Owners'
      : groupBy === 'client'
        ? 'Clients'
        : groupBy === 'job'
          ? 'Opportunities'
          : groupBy === 'deliverable-type'
            ? 'Stages'
            : 'Service Types';

  const totals = new Map();
  for (const deal of deals) {
    const key = keyFn(deal);
    const amt = Number(deal.amount || 0);
    totals.set(key, (totals.get(key) || 0) + amt);
  }

  const rows = Array.from(totals.entries())
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value);
  const totalValue = rows.reduce((s, r) => s + r.value, 0) || 1;
  const maxItems = 6;
  const top = rows.slice(0, maxItems);
  const rest = rows.slice(maxItems);
  const otherValue = rest.reduce((s, r) => s + r.value, 0);
  const finalRows = otherValue > 0 ? [...top, { label: 'Other', value: otherValue }] : top;
  const items = finalRows.map((r, idx) => ({
    ...r,
    percent: Math.round((r.value / totalValue) * 1000) / 10,
    color: REPORT_COLORS[idx % REPORT_COLORS.length],
  }));
  return { title, items, totalValue };
}

function SalesBars({ days }) {
  const isDark = typeof document !== 'undefined' && document.documentElement.classList.contains('dark');
  const max = Math.max(...days.map((d) => d.value), 1);
  return h('div', { className: 'mt-4', 'data-demo': 'sales-bars' }, [
    h('div', { className: 'flex items-center justify-between' }, [
      h('div', { className: 'text-sm font-medium text-slate-900 dark:text-white' }, 'Booked revenue (closed-won) by day'),
      h(
        'div',
        { className: 'text-xs text-slate-500 dark:text-white/50' },
        `${formatCurrency(days.reduce((s, d) => s + d.value, 0), { compact: true })} total`
      ),
    ]),
    h(
      'div',
      {
        className:
          'mt-3 grid grid-cols-' +
          Math.min(days.length, 31) +
          ' gap-1 rounded-lg border border-slate-200 bg-slate-50 p-2 dark:border-white/10 dark:bg-white/5',
        style: { gridTemplateColumns: `repeat(${days.length}, minmax(0, 1fr))` },
      },
      days.map((d) => {
        const height = Math.round((d.value / max) * 100);
        return h(
          'div',
          {
            key: d.iso,
            className: 'group relative flex h-20 flex-col items-center justify-end',
            title: `${d.iso}: ${formatCurrency(d.value)}${d.count ? ` • ${d.count} deal${d.count === 1 ? '' : 's'}` : ''}`,
          },
          [
            h('div', {
              className: `w-full rounded-sm ${isDark ? 'bg-netnet-purple/70' : 'bg-netnet-purple/60'}`,
              style: { height: `${height}%` },
            }),
            h('div', { className: 'mt-1 text-[10px] text-slate-400 dark:text-white/40' }, d.date.getDate()),
          ]
        );
      })
    ),
  ]);
}

function SalesDonut({ title, items }) {
  const total = items.reduce((s, it) => s + it.value, 0) || 1;
  let offset = 0;
  const stops = items
    .map((it) => {
      const start = offset;
      offset += it.value / total;
      return `${it.color} ${Math.round(start * 1000) / 10}% ${Math.round(offset * 1000) / 10}%`;
    })
    .join(', ');

  return h('div', { className: 'rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-slate-900/60', 'data-demo': 'sales-donut' }, [
    h('div', { className: 'flex items-center justify-between' }, [
      h('div', { className: 'text-sm font-medium text-slate-900 dark:text-white' }, title),
      h('div', { className: 'text-xs text-slate-500 dark:text-white/50' }, formatCurrency(total, { compact: true })),
    ]),
    h('div', { className: 'mt-3 flex items-center gap-4' }, [
      h('div', {
        className: 'h-20 w-20 flex-none rounded-full',
        style: { background: `conic-gradient(${stops})` },
      }),
      h(
        'div',
        { className: 'min-w-0 flex-1 space-y-1' },
        items.map((it) =>
          h('div', { key: it.label, className: 'flex items-center justify-between gap-2 text-xs' }, [
            h('div', { className: 'flex min-w-0 items-center gap-2' }, [
              h('span', { className: 'h-2 w-2 rounded-full', style: { background: it.color } }),
              h('span', { className: 'truncate text-slate-700 dark:text-white/70' }, it.label),
            ]),
            h('div', { className: 'flex flex-none items-center gap-2' }, [
              h('span', { className: 'text-slate-500 dark:text-white/50' }, formatCurrency(it.value, { compact: true })),
              h('span', { className: 'w-10 text-right text-slate-400 dark:text-white/40' }, `${it.percent}%`),
            ]),
          ])
        )
      ),
    ]),
  ]);
}

function SalesReport({ state, view }) {
  const range = useMemo(() => getReportRange(state), [state.range, state.start, state.end]);
  const prevRange = useMemo(() => getPreviousRange(range), [range.start.getTime(), range.end.getTime(), range.days]);

  const deals = performanceSalesDeals || [];
  const dealById = useMemo(() => new Map(deals.map((d) => [d.id, d])), [deals]);

  const activities = useMemo(() => {
    const rows = (performanceSalesActivities || [])
      .filter((a) => isDateInRange(a.date, range))
      .map((a) => ({ ...a, _date: parseISODate(a.date) }))
      .sort((a, b) => (b._date?.getTime() || 0) - (a._date?.getTime() || 0));
    return rows;
  }, [range.start.getTime(), range.end.getTime()]);

  const touchedDealIds = useMemo(() => new Set(activities.map((a) => a.dealId)), [activities]);
  const touchedDeals = useMemo(
    () =>
      deals.filter(
        (d) =>
          touchedDealIds.has(d.id) ||
          isDateInRange(d.createdAt, range) ||
          (d.closedAt ? isDateInRange(d.closedAt, range) : false)
      ),
    [deals, touchedDealIds, range.start.getTime(), range.end.getTime()]
  );

  const metrics = useMemo(() => computeSalesMetrics(touchedDeals, range), [touchedDeals, range.start.getTime(), range.end.getTime()]);

  const prev = useMemo(() => {
    if (!state.compare) return null;
    const prevActivities = (performanceSalesActivities || []).filter((a) => isDateInRange(a.date, prevRange));
    const prevTouched = new Set(prevActivities.map((a) => a.dealId));
    const prevDeals = deals.filter(
      (d) =>
        prevTouched.has(d.id) ||
        isDateInRange(d.createdAt, prevRange) ||
        (d.closedAt ? isDateInRange(d.closedAt, prevRange) : false)
    );
    return {
      metrics: computeSalesMetrics(prevDeals, prevRange),
      daily: buildSalesDailyWon(prevRange, deals),
    };
  }, [state.compare, prevRange.start.getTime(), prevRange.end.getTime(), deals]);

  const daily = useMemo(() => buildSalesDailyWon(range, deals), [range.start.getTime(), range.end.getTime(), deals]);

  const breakdown = useMemo(() => buildSalesBreakdown(touchedDeals, state.groupBy), [touchedDeals, state.groupBy]);
  const byStage = useMemo(() => buildSalesBreakdown(touchedDeals, 'deliverable-type'), [touchedDeals]);
  const byOwner = useMemo(() => buildSalesBreakdown(touchedDeals, 'team-member'), [touchedDeals]);

  const deltaCount = (now, before) => {
    if (before == null) return '';
    const diff = now - before;
    const sign = diff > 0 ? '+' : '';
    return `${sign}${diff} vs prev`;
  };

  const deltaCurrency = (now, before) => {
    if (before == null) return '';
    const diff = now - before;
    const sign = diff > 0 ? '+' : '';
    return `${sign}${formatCurrency(diff, { compact: true })} vs prev`;
  };

  const deltaRate = (now, before) => {
    if (before == null || now == null) return '';
    const diff = (now - before) * 100;
    const sign = diff > 0 ? '+' : '';
    return `${sign}${diff.toFixed(0)}pp vs prev`;
  };

  const winRateTone = metrics.winRate == null ? 'amber' : metrics.winRate >= 0.6 ? 'green' : metrics.winRate >= 0.4 ? 'amber' : 'red';

  return h('div', { className: 'space-y-6' }, [
    view === 'revenue-fog'
      ? h('div', { className: 'rounded-lg border border-amber-200 dark:border-amber-300/30 bg-amber-50 dark:bg-amber-900/20 px-4 py-3 text-sm text-amber-800 dark:text-amber-100' },
          'Revenue Fog focus — prioritizing haze in late-stage pipeline.')
      : null,
    h('div', { className: 'rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-slate-900/60 lg:p-6', 'data-demo': 'sales-report-snapshot' }, [
      h('div', { className: 'flex items-start justify-between gap-4' }, [
        h('div', null, [
          h('div', { className: 'text-sm font-semibold text-slate-900 dark:text-white' }, 'Sales Report Snapshot'),
          h('div', { className: 'mt-1 text-xs text-slate-500 dark:text-white/50' }, 'Pipeline + booked outcomes in the selected date range.'),
        ]),
        h('div', { className: 'text-xs text-slate-500 dark:text-white/50' }, `${formatISODate(range.start)} → ${formatISODate(range.end)}`),
      ]),
      h('div', { className: 'mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4' }, [
        h(KPIBox, {
          title: 'New opportunities',
          value: metrics.createdCount,
          subtext: state.compare ? deltaCount(metrics.createdCount, prev?.metrics?.createdCount) : `${metrics.createdCount} created`,
          tone: 'green',
        }),
        h(KPIBox, {
          title: 'Pipeline value',
          value: formatCurrency(metrics.pipelineValue, { compact: true }),
          subtext: state.compare ? deltaCurrency(metrics.pipelineValue, prev?.metrics?.pipelineValue) : `${metrics.openCount} open`,
          tone: 'amber',
        }),
        h(KPIBox, {
          title: 'Closed won',
          value: formatCurrency(metrics.revenue, { compact: true }),
          subtext: state.compare ? deltaCurrency(metrics.revenue, prev?.metrics?.revenue) : `${metrics.wonCount} won`,
          tone: 'green',
        }),
        h(KPIBox, {
          title: 'Win rate',
          value: metrics.winRate == null ? '—' : `${Math.round(metrics.winRate * 100)}%`,
          subtext: state.compare ? deltaRate(metrics.winRate, prev?.metrics?.winRate) : `${metrics.wonCount} won • ${metrics.lostCount} lost`,
          tone: winRateTone,
        }),
      ]),
      h(SalesBars, { days: daily }),
      h('div', { className: 'mt-4 grid grid-cols-1 gap-3 lg:grid-cols-3' }, [
        h(SalesDonut, { title: breakdown.title, items: breakdown.items }),
        h(SalesDonut, { title: byStage.title, items: byStage.items }),
        h(SalesDonut, { title: byOwner.title, items: byOwner.items }),
      ]),
    ]),
    h('div', { className: 'rounded-xl border border-slate-200 bg-white shadow-sm dark:border-white/10 dark:bg-slate-900/60', 'data-demo': 'sales-report-activity' }, [
      h('div', { className: 'flex items-start justify-between gap-4 border-b border-slate-100 px-4 py-4 dark:border-white/10' }, [
        h('div', null, [
          h('div', { className: 'text-sm font-semibold text-slate-900 dark:text-white' }, 'Sales Report Activity'),
          h('div', { className: 'mt-1 text-xs text-slate-500 dark:text-white/50' }, 'Events in the selected date range.'),
        ]),
        h('div', { className: 'text-xs text-slate-500 dark:text-white/50' }, `${activities.length} entries`),
      ]),
      activities.length === 0
        ? h('div', { className: 'px-4 py-10 text-sm text-slate-500 dark:text-white/50' }, 'No sales activity in this range.')
        : h(
            'div',
            { className: 'divide-y divide-slate-100 dark:divide-white/10' },
            activities.map((a) => {
              const deal = dealById.get(a.dealId);
              const stageLabel = SALES_STAGE_LABELS[deal?.stage] || 'Open';
              const stageClass = getSalesStageChipClass(deal?.stage);
              return h(
                'div',
                { key: a.id, className: 'flex flex-col gap-2 px-4 py-4 sm:flex-row sm:items-center sm:justify-between', 'data-demo': 'sales-activity-row' },
                [
                  h('div', { className: 'min-w-0' }, [
                    h('div', { className: 'truncate text-sm font-semibold text-slate-900 dark:text-white' }, deal?.name || 'Opportunity'),
                    h(
                      'div',
                      { className: 'mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-white/50' },
                      [
                        h('span', null, deal?.client || 'Unknown client'),
                        h('span', { className: 'text-slate-300 dark:text-white/20' }, '•'),
                        h('span', { className: 'font-medium text-slate-700 dark:text-white/70' }, a.type),
                        a.note ? h('span', { className: 'text-slate-400 dark:text-white/40' }, `— ${a.note}`) : null,
                      ].filter(Boolean)
                    ),
                  ]),
                  h('div', { className: 'flex flex-none items-center gap-3 text-xs' }, [
                    h('span', { className: `inline-flex items-center rounded-full border px-2 py-0.5 ${stageClass}` }, stageLabel),
                    h('span', { className: 'text-slate-700 dark:text-white/70' }, deal?.owner || '—'),
                    h('span', { className: 'text-slate-500 dark:text-white/50' }, a.date),
                    h('span', { className: 'font-semibold text-slate-900 dark:text-white' }, formatCurrency(deal?.amount || 0, { compact: true })),
                  ]),
                ]
              );
            })
          ),
    ]),
  ]);
}
