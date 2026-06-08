import { navigate } from '../../router.js';
import { getCurrentRole } from '../../app-shell/app-helpers.js';
import { KPIBox } from '../../components/performance/primitives.js';
import { openSingleDatePickerPopover } from '../../quick-tasks/quick-task-detail.js';
import { getCurrentUserId, loadServiceTypes, loadTeamMembers } from '../../quick-tasks/quick-tasks-store.js';
import {
  getMyTimeEntryAccess,
  loadMyTimeEntries,
  loadMyTimeTaskLockMap,
  loadPermittedMyTimeTaskCatalog,
  updateMyTimeEntry,
} from '../../me/time-store.js';
import {
  formatDurationDraftValue,
  parseDurationInputToMinutes,
  parseIsoLocal,
  toLocalIso,
} from '../../me/time-helpers.js';
import { JobsReport } from './JobsReport.js';
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

const REPORT_EXPORT_OPTIONS = [
  { key: 'csv', label: 'Export CSV' },
  { key: 'print', label: 'Print-friendly view' },
];

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

function DateRangePickerPopover({ open, anchorRect, initialStart, initialEnd, onApply, onClose, presetsOverride = null, getPresetRangeForId = getPresetRange, initialPreset = '' }) {
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
    setActivePreset(initialPreset && initialPreset !== 'custom' ? initialPreset : '');
    const s = parseISODate(initialStart);
    const e = parseISODate(initialEnd);
    setDraftStart(s || null);
    setDraftEnd(e || null);
    const base = s || new Date();
    setViewMonth(new Date(base.getFullYear(), base.getMonth(), 1));
  }, [open, initialStart, initialEnd, initialPreset]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === 'Escape') onClose?.();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  const presets = presetsOverride || [
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
    setActivePreset('');
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
    if (activePreset === 'all') {
      onApply?.({ range: 'all', start: '', end: '' });
      onClose?.();
      return;
    }
    if (!draftStart || !draftEnd) {
      setError('Select a start date and an end date.');
      return;
    }
    if (isBeforeDay(draftEnd, draftStart)) {
      setError('End date must be on or after start date.');
      return;
    }
    onApply?.({ range: activePreset || 'custom', start: formatISODate(draftStart), end: formatISODate(draftEnd) });
    onClose?.();
  };

  const setPreset = (id) => {
    if (id === 'all') {
      setError('');
      setActivePreset(id);
      setDraftStart(null);
      setDraftEnd(null);
      return;
    }
    const today = new Date();
    const r = getPresetRangeForId(id, today);
    if (!r) return;
    setError('');
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
              h('div', { className: 'text-sm font-semibold' }, 'Date range'),
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
                  activePreset === 'all'
                    ? h('div', null, [
                        h('div', { className: `text-[11px] ${chipMuted}` }, 'Range'),
                        h('div', { className: `mt-0.5 text-sm font-semibold ${panelValueText}` }, 'All dates'),
                      ])
                    : [
                        h('div', { key: 'start' }, [
                          h('div', { className: `text-[11px] ${chipMuted}` }, 'Start date'),
                          h('div', { className: `mt-0.5 font-mono text-sm ${panelValueText}` }, draftStart ? formatISODate(draftStart) : '—'),
                        ]),
                        h('div', { key: 'end' }, [
                          h('div', { className: `text-[11px] ${chipMuted}` }, 'End date'),
                          h('div', { className: `mt-0.5 font-mono text-sm ${panelValueText}` }, draftEnd ? formatISODate(draftEnd) : '—'),
                        ]),
                      ],
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

function ReportsControlBar({ report, state, onChange, onPrintFriendly, onExportCsv }) {
  const presets = [
    { label: 'Last 7 days', value: 'last-7' },
    { label: 'Last 30 days', value: 'last-30' },
    { label: 'Last 90 days', value: 'last-90' },
    { label: 'Custom', value: 'custom' },
  ];
  const groups = [
    { label: 'Service Type', value: 'service-type' },
    { label: 'Team Member', value: 'team-member' },
    { label: 'Jobs', value: 'job' },
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
        ? h('div', { className: 'absolute right-0 mt-2 w-48 rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 shadow-lg z-10' },
            REPORT_EXPORT_OPTIONS.map((opt) =>
              h('button', {
                key: opt.key,
                type: 'button',
                className: 'w-full text-left px-3 py-2 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800',
                onClick: () => {
                  if (opt.key === 'csv') onExportCsv?.();
                  if (opt.key === 'print') onPrintFriendly?.();
                  setExportOpen(false);
                },
              }, opt.label)
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
  const [printFriendly, setPrintFriendly] = useState(false);
  useEffect(() => {
    setReportState(parseReportState(queryString, defaultGroup));
  }, [queryString, defaultGroup]);
  const onNav = (val) => {
    navigate(`#/app/performance/reports/${val}?${location.hash.split('?')[1] || ''}`);
  };
  const onStateChange = (next) => setReportState(next);
  const onExportCsv = () => {
    console.log('[Export] CSV');
  };

  const label = REPORTS_TABS.find((t) => t.value === report)?.label || 'Report';
  return h('div', { className: 'space-y-6' }, [
    printFriendly
      ? h('div', { className: 'rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-600 shadow-sm dark:border-white/10 dark:bg-slate-900/80 dark:text-slate-300' }, [
          h('div', { className: 'flex flex-wrap items-center justify-between gap-3' }, [
            h('div', { className: 'space-y-1' }, [
              h('div', { className: 'text-sm font-semibold text-slate-900 dark:text-white' }, 'Print-friendly view'),
              h('div', null, 'Controls are hidden for browser printing. Use your browser print command when ready.'),
            ]),
            h('button', {
              type: 'button',
              className: 'rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 dark:border-white/10 dark:text-slate-100 dark:hover:bg-white/10',
              onClick: () => setPrintFriendly(false),
            }, 'Exit print-friendly view'),
          ]),
        ])
      : [
          h('div', { className: 'flex items-center justify-between flex-wrap gap-3' }, [
            h(ReportsSubnav, { active: report, onChange: onNav }),
            h('span', { className: 'text-sm text-slate-500 dark:text-slate-400' }, label),
          ]),
          report === 'job' || report === 'time' || report === 'team' || report === 'sales'
            ? null
            : h(ReportsControlBar, {
                report,
                state: reportState,
                onChange: onStateChange,
                onPrintFriendly: () => setPrintFriendly(true),
                onExportCsv,
              }),
        ],
    report === 'time'
      ? h(TimeReport, {
          queryString,
          printFriendly,
          onPrintFriendly: () => setPrintFriendly(true),
        })
      : report === 'team'
        ? h(TeamReport, {
            queryString,
            printFriendly,
            onPrintFriendly: () => setPrintFriendly(true),
          })
        : report === 'sales'
          ? h(SalesOpportunityReport, {
              queryString,
              printFriendly,
              onPrintFriendly: () => setPrintFriendly(true),
            })
          : report === 'job'
            ? h(JobsReport, {
                printFriendly,
                onPrintFriendly: () => setPrintFriendly(true),
              })
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

const TIME_REPORT_MEMBER_NAMES = {
  tm1: 'Marc Pitre',
  tm2: 'Arthur Iturres',
  tm3: 'Kumail Abas',
  tm4: 'Priya Shah',
  tm5: 'Leo Martin',
  tm6: 'Nina Patel',
};

function getTimeReportMemberName(memberId, member) {
  return TIME_REPORT_MEMBER_NAMES[memberId] || member?.name || 'Unassigned';
}

function formatTimeHours(value, digits = 1) {
  const n = Number(value || 0);
  return `${n.toFixed(digits).replace(/\.0$/, '')} hrs`;
}

function formatTimeReportDate(date, options = {}) {
  if (!date) return '';
  const { includeYear = false } = options;
  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    ...(includeYear ? { year: 'numeric' } : {}),
  });
}

function formatTimeReportWeekday(date) {
  return date ? date.toLocaleDateString(undefined, { weekday: 'short' }) : '';
}

function getTimeEntryContextLabel(entry) {
  if (entry.type === 'quick') return 'Quick Task';
  if (!entry.job) return 'Other';
  const client = entry.job.client ? ` (${entry.job.client})` : '';
  return `Job #${entry.job.id} - ${entry.job.name}${client}`;
}

function csvEscape(value) {
  const str = value == null ? '' : String(value);
  return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
}

function downloadCsv(filename, rows) {
  const csv = rows.map((row) => row.map(csvEscape).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function exportTimeReportCsv(state) {
  const range = getReportRange(state);
  const entries = enrichTimeEntriesForRange(range);
  const rows = [
    ['Task', 'Job or Quick Task Context', 'Team Member', 'Service Type', 'Date', 'Hours', 'Notes'],
    ...entries.map((entry) => [
      entry.taskTitle,
      getTimeEntryContextLabel(entry),
      entry.memberName || 'Unassigned',
      entry.serviceType?.name || 'Other',
      formatISODate(entry.date),
      entry.duration.toFixed(1),
      entry.notes || '',
    ]),
  ];
  downloadCsv(`time-report-${formatISODate(range.start)}-${formatISODate(range.end)}.csv`, rows);
}

function enrichTimeEntriesForRange(range) {
  const ctx = buildTimeContext();
  const entries = performanceTimeEntries.map((entry, idx) => {
    const task = entry.taskId ? ctx.taskMap.get(entry.taskId) : null;
    const deliverable = task ? ctx.deliverableMap.get(task.deliverableId) : null;
    const job = deliverable ? ctx.jobMap.get(deliverable.jobId) : null;
    const memberId = entry.memberId || task?.assigneeId || null;
    const member = memberId ? ctx.teamMap.get(memberId) : null;
    const memberName = getTimeReportMemberName(memberId, member);
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
      memberName,
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
      label = e.memberName || 'Other';
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

const TIME_DEFAULT_RANGE = 'this-week';
const TIME_RANGE_OPTIONS = [
  { value: 'all', label: 'All Dates' },
  { value: 'today', label: 'Today' },
  { value: 'yesterday', label: 'Yesterday' },
  { value: 'this-week', label: 'This Week' },
  { value: 'last-week', label: 'Last Week' },
  { value: 'this-month', label: 'This Month' },
  { value: 'last-month', label: 'Last Month' },
  { value: 'this-year', label: 'This Year' },
  { value: 'last-year', label: 'Last Year' },
  { value: 'custom', label: 'Custom' },
];
const TIME_PICKER_PRESETS = TIME_RANGE_OPTIONS
  .filter((option) => option.value !== 'custom')
  .map((option) => ({ id: option.value, label: option.label }));
const TIME_GROUP_OPTIONS = [
  { value: 'none', label: 'None' },
  { value: 'service-type', label: 'Service Types' },
  { value: 'team-member', label: 'Team Members' },
  { value: 'job', label: 'Jobs' },
  { value: 'client', label: 'Clients' },
];
const TIME_WORK_CONTEXT_OPTIONS = [
  { value: 'all', label: 'All' },
  { value: 'client', label: 'Client' },
  { value: 'internal', label: 'Internal' },
];
const TIME_TASK_SOURCE_OPTIONS = [
  { value: 'all', label: 'Job & Quick Tasks' },
  { value: 'job', label: 'Job Tasks' },
  { value: 'quick', label: 'Quick Tasks' },
];
const TIME_DURATION_FORMATS = {
  decimal: 'decimal',
  clock: 'clock',
};
const TIME_DURATION_FORMAT_STORAGE_KEY = 'netnet_time_report_duration_format_v1';
const TIME_DEMO_SERVICE_TYPE_LABELS = {
  strategy: 'Strategy',
  research: 'Research',
  qa: 'QA Review',
};
const TIME_TABLE_COLUMNS = 'minmax(96px,1fr) minmax(64px,0.62fr) minmax(180px,2.15fr) minmax(78px,0.72fr) minmax(74px,0.64fr) minmax(68px,0.54fr) minmax(72px,0.48fr)';

function getTimeServiceTypeLabel(serviceTypeId, serviceType = null) {
  const id = String(serviceTypeId || '').trim();
  return serviceType?.name || TIME_DEMO_SERVICE_TYPE_LABELS[id] || 'Other';
}

function endOfMonth(date) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0);
}

function startOfWeekSunday(date) {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  d.setDate(d.getDate() - d.getDay());
  return d;
}

function endOfWeekSaturday(date) {
  const d = startOfWeekSunday(date);
  d.setDate(d.getDate() + 6);
  return d;
}

function getTimePresetRange(presetId, today = new Date()) {
  const t = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  if (presetId === 'today') return { start: t, end: t };
  if (presetId === 'yesterday') {
    const y = addDays(t, -1);
    return { start: y, end: y };
  }
  if (presetId === 'this-week') return { start: startOfWeekSunday(t), end: endOfWeekSaturday(t) };
  if (presetId === 'last-week') {
    const end = addDays(startOfWeekSunday(t), -1);
    return { start: startOfWeekSunday(end), end };
  }
  if (presetId === 'this-month') return { start: new Date(t.getFullYear(), t.getMonth(), 1), end: endOfMonth(t) };
  if (presetId === 'last-month') {
    const start = new Date(t.getFullYear(), t.getMonth() - 1, 1);
    return { start, end: endOfMonth(start) };
  }
  if (presetId === 'this-year') return { start: new Date(t.getFullYear(), 0, 1), end: new Date(t.getFullYear(), 11, 31) };
  if (presetId === 'last-year') return { start: new Date(t.getFullYear() - 1, 0, 1), end: new Date(t.getFullYear() - 1, 11, 31) };
  return null;
}

function dayCount(start, end) {
  if (!start || !end) return 0;
  return Math.round((end - start) / (1000 * 60 * 60 * 24)) + 1;
}

function splitMultiParam(value) {
  return String(value || '').split(',').map((item) => item.trim()).filter(Boolean);
}

function parseTimeReportState(queryString = '') {
  const params = new URLSearchParams(queryString);
  const rangeValue = params.get('range') || TIME_DEFAULT_RANGE;
  const allowedRanges = new Set(TIME_RANGE_OPTIONS.map((option) => option.value));
  const groupValue = params.get('groupBy') || 'none';
  const allowedGroups = new Set(TIME_GROUP_OPTIONS.map((option) => option.value));
  return {
    range: allowedRanges.has(rangeValue) ? rangeValue : TIME_DEFAULT_RANGE,
    start: params.get('start') || '',
    end: params.get('end') || '',
    company: params.get('company') || 'all',
    job: params.get('job') || 'all',
    serviceTypes: splitMultiParam(params.get('serviceTypes')),
    teamMembers: splitMultiParam(params.get('teamMembers')),
    workContext: ['all', 'client', 'internal'].includes(params.get('workContext')) ? params.get('workContext') : 'all',
    taskSource: ['all', 'job', 'quick'].includes(params.get('taskSource')) ? params.get('taskSource') : 'all',
    groupBy: allowedGroups.has(groupValue) ? groupValue : 'none',
  };
}

function navigateTimeReportState(next) {
  const params = new URLSearchParams();
  params.set('range', next.range || TIME_DEFAULT_RANGE);
  if (next.range === 'custom' && next.start && next.end) {
    params.set('start', next.start);
    params.set('end', next.end);
  }
  if (next.company && next.company !== 'all') params.set('company', next.company);
  if (next.job && next.job !== 'all') params.set('job', next.job);
  if (next.serviceTypes?.length) params.set('serviceTypes', next.serviceTypes.join(','));
  if (next.teamMembers?.length) params.set('teamMembers', next.teamMembers.join(','));
  if (next.workContext && next.workContext !== 'all') params.set('workContext', next.workContext);
  if (next.taskSource && next.taskSource !== 'all') params.set('taskSource', next.taskSource);
  if (next.groupBy && next.groupBy !== 'none') params.set('groupBy', next.groupBy);
  navigate(`#/app/performance/reports/time?${params.toString()}`);
}

function getTimeRangeLabel(range) {
  if (range?.isAllDates) return 'All dates';
  return `${formatTimeReportDate(range.start, { includeYear: true })} to ${formatTimeReportDate(range.end, { includeYear: true })}`;
}

function resolveTimeReportRange(state, rows = []) {
  if (state.range === 'all') {
    const dates = rows.map((row) => row.dateObj).filter(Boolean).sort((a, b) => a - b);
    const fallback = new Date();
    const start = dates[0] || new Date(fallback.getFullYear(), fallback.getMonth(), 1);
    const end = dates[dates.length - 1] || endOfMonth(fallback);
    return { start, end, days: dayCount(start, end), isAllDates: true, label: 'All dates' };
  }
  if (state.range === 'custom' && state.start && state.end) {
    const start = parseISODate(state.start);
    const end = parseISODate(state.end);
    if (start && end && !isBeforeDay(end, start)) {
      return { start, end, days: dayCount(start, end), isAllDates: false, label: getTimeRangeLabel({ start, end }) };
    }
  }
  const preset = getTimePresetRange(state.range, new Date()) || getTimePresetRange(TIME_DEFAULT_RANGE, new Date());
  return { ...preset, days: dayCount(preset.start, preset.end), isAllDates: false, label: getTimeRangeLabel(preset) };
}

function getDurationHoursFromMinutes(minutes) {
  return Math.max(0, Number(minutes) || 0) / 60;
}

function getStoredTimeDurationFormat() {
  if (typeof localStorage === 'undefined') return TIME_DURATION_FORMATS.decimal;
  try {
    const stored = localStorage.getItem(TIME_DURATION_FORMAT_STORAGE_KEY);
    return stored === TIME_DURATION_FORMATS.clock ? TIME_DURATION_FORMATS.clock : TIME_DURATION_FORMATS.decimal;
  } catch (e) {
    return TIME_DURATION_FORMATS.decimal;
  }
}

function persistTimeDurationFormat(format) {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(TIME_DURATION_FORMAT_STORAGE_KEY, format === TIME_DURATION_FORMATS.clock ? TIME_DURATION_FORMATS.clock : TIME_DURATION_FORMATS.decimal);
  } catch (e) {
    // Ignore prototype storage failures.
  }
}

function formatTimeDurationMinutes(minutes, format = TIME_DURATION_FORMATS.decimal) {
  const safeMinutes = Math.max(0, Number(minutes) || 0);
  if (format === TIME_DURATION_FORMATS.clock) {
    const totalMinutes = Math.round(safeMinutes);
    const hours = Math.floor(totalMinutes / 60);
    const mins = totalMinutes % 60;
    return `${hours}:${String(mins).padStart(2, '0')}`;
  }
  const hours = Math.round((safeMinutes / 60) * 100) / 100;
  return `${hours.toFixed(2).replace(/\.?0+$/, '')} hrs`;
}

function formatTimeDurationHours(hours, format = TIME_DURATION_FORMATS.decimal) {
  return formatTimeDurationMinutes(Math.max(0, Number(hours) || 0) * 60, format);
}

function formatDurationDraftForMode(minutes, format = TIME_DURATION_FORMATS.decimal) {
  const safeMinutes = Math.max(0, Number(minutes) || 0);
  if (format === TIME_DURATION_FORMATS.clock) {
    const totalMinutes = Math.round(safeMinutes);
    return `${Math.floor(totalMinutes / 60)}:${String(totalMinutes % 60).padStart(2, '0')}`;
  }
  return formatDurationDraftValue(safeMinutes);
}

function timeStringToMinutes(value) {
  const match = /^(\d{1,2}):([0-5]\d)$/.exec(String(value || '').trim());
  if (!match) return null;
  return (Number(match[1]) * 60) + Number(match[2]);
}

function minutesToTimeString(minutes) {
  const safeMinutes = ((Math.round(Number(minutes) || 0) % 1440) + 1440) % 1440;
  const hours = Math.floor(safeMinutes / 60);
  const mins = safeMinutes % 60;
  return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
}

function getDurationMinutesFromClockRange(startTime, endTime) {
  const start = timeStringToMinutes(startTime);
  const end = timeStringToMinutes(endTime);
  if (start == null || end == null || end < start) return null;
  return end - start;
}

function buildTimeReportRows(entries, members, serviceTypes, taskCatalog) {
  const memberMap = new Map(members.map((member) => [String(member.id), member]));
  const serviceTypeMap = new Map(serviceTypes.map((type) => [String(type.id), type]));
  const taskMap = new Map(taskCatalog.map((task) => [String(task.id), task]));
  return entries.map((entry) => {
    const dateObj = parseIsoLocal(entry.date);
    if (!dateObj) return null;
    const linkedTask = entry.taskId ? taskMap.get(String(entry.taskId)) : null;
    const serviceTypeId = String(entry.serviceTypeId || linkedTask?.serviceTypeId || '').trim();
    const serviceType = serviceTypeId ? serviceTypeMap.get(serviceTypeId) : null;
    const member = memberMap.get(String(entry.userId || ''));
    const workContext = entry.contextType === 'internal' ? 'internal' : 'client';
    const company = workContext === 'internal' ? 'Internal' : (entry.companyName || 'Client');
    const taskSource = entry.jobName ? 'job' : 'quick';
    const durationMinutes = Math.max(0, Number(entry.duration_minutes) || 0);
    return {
      id: String(entry.id || ''),
      raw: entry,
      dateObj,
      dateIso: toLocalIso(dateObj),
      taskName: entry.taskTitle || 'Untitled task',
      jobName: entry.jobName || '',
      company,
      description: entry.notes || '',
      userId: String(entry.userId || ''),
      teamMemberName: member?.name || member?.email || 'Unassigned',
      serviceTypeId,
      serviceTypeName: getTimeServiceTypeLabel(serviceTypeId, serviceType),
      timeLabel: entry.startTime && entry.endTime ? `${entry.startTime} to ${entry.endTime}` : (entry.startTime || 'Manual'),
      durationMinutes,
      hours: getDurationHoursFromMinutes(durationMinutes),
      workContext,
      taskSource,
      lockReason: entry.lockReason || '',
    };
  }).filter(Boolean).sort((a, b) => b.dateObj - a.dateObj || String(b.timeLabel).localeCompare(String(a.timeLabel)));
}

function filterTimeReportRows(rows, state, range) {
  return rows.filter((row) => {
    if (!range.isAllDates && (row.dateObj < range.start || row.dateObj > range.end)) return false;
    if (state.company !== 'all' && row.company !== state.company) return false;
    if (state.job !== 'all' && row.jobName !== state.job) return false;
    if (state.serviceTypes.length && !state.serviceTypes.includes(row.serviceTypeId || 'other')) return false;
    if (state.teamMembers.length && !state.teamMembers.includes(row.userId)) return false;
    if (state.workContext !== 'all' && row.workContext !== state.workContext) return false;
    if (state.taskSource !== 'all' && row.taskSource !== state.taskSource) return false;
    return true;
  });
}

function uniqueOptions(rows, valueFn, labelFn) {
  const map = new Map();
  rows.forEach((row) => {
    const value = valueFn(row);
    if (!value) return;
    map.set(String(value), labelFn(row));
  });
  return Array.from(map.entries())
    .map(([value, label]) => ({ value, label }))
    .sort((a, b) => a.label.localeCompare(b.label));
}

function buildTimeFilterOptions(rows, members, serviceTypes) {
  const rowServiceTypeIds = new Set(rows.map((row) => row.serviceTypeId || 'other'));
  const serviceTypeMap = new Map(serviceTypes.map((type) => [String(type.id), type]));
  const serviceOptions = serviceTypes
    .filter((type) => rowServiceTypeIds.has(String(type.id)))
    .map((type) => ({ value: String(type.id), label: type.name || 'Service Type' }));
  rowServiceTypeIds.forEach((id) => {
    if (!id || id === 'other' || serviceTypeMap.has(id)) return;
    serviceOptions.push({ value: id, label: getTimeServiceTypeLabel(id) });
  });
  if (rowServiceTypeIds.has('other')) serviceOptions.push({ value: 'other', label: 'Other' });
  return {
    companies: [{ value: 'all', label: 'All companies' }, ...uniqueOptions(rows, (row) => row.company, (row) => row.company)],
    jobs: [{ value: 'all', label: 'All jobs' }, ...uniqueOptions(rows, (row) => row.jobName, (row) => row.jobName)],
    serviceTypes: serviceOptions.sort((a, b) => a.label.localeCompare(b.label)),
    teamMembers: members.map((member) => ({ value: String(member.id), label: member.name || member.email || 'Team member' })),
  };
}

function buildTimeChartData(rows, range) {
  const mode = range.isAllDates ? 'monthly' : range.days <= 31 ? 'daily' : range.days <= 120 ? 'weekly' : 'monthly';
  const items = [];
  const addItem = (key, label, caption, start, end) => {
    const hours = rows
      .filter((row) => row.dateObj >= start && row.dateObj <= end)
      .reduce((sum, row) => sum + row.hours, 0);
    items.push({ key, label, caption, hours, start, end });
  };

  if (mode === 'daily') {
    for (let d = new Date(range.start); d <= range.end; d.setDate(d.getDate() + 1)) {
      const date = new Date(d);
      addItem(formatISODate(date), formatTimeReportWeekday(date), formatTimeReportDate(date), date, date);
    }
  } else if (mode === 'weekly') {
    for (let d = startOfWeekSunday(range.start); d <= range.end; d.setDate(d.getDate() + 7)) {
      const start = new Date(d);
      const end = endOfWeekSaturday(start);
      addItem(formatISODate(start), formatTimeReportDate(start), `${formatTimeReportDate(start)} to ${formatTimeReportDate(end)}`, start, end);
    }
  } else {
    for (let d = new Date(range.start.getFullYear(), range.start.getMonth(), 1); d <= range.end; d.setMonth(d.getMonth() + 1)) {
      const start = new Date(d.getFullYear(), d.getMonth(), 1);
      const end = endOfMonth(start);
      addItem(`${start.getFullYear()}-${start.getMonth()}`, start.toLocaleDateString(undefined, { month: 'short' }), String(start.getFullYear()), start, end);
    }
  }

  return {
    mode,
    items,
    totalHours: rows.reduce((sum, row) => sum + row.hours, 0),
    max: Math.max(...items.map((item) => item.hours), 0),
  };
}

function TimeAdaptiveBars({ data, durationFormat = TIME_DURATION_FORMATS.decimal }) {
  const minWidth = data.mode === 'daily' ? '42px' : data.mode === 'weekly' ? '68px' : '72px';
  const modeLabel = data.mode === 'daily' ? 'Daily bars' : data.mode === 'weekly' ? 'Weekly bars' : 'Monthly bars';
  const max = data.max || 1;
  return h('div', { className: 'rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-slate-900/80', 'data-demo': 'time-report-adaptive-chart' }, [
    h('div', { className: 'flex flex-wrap items-end justify-between gap-3' }, [
      h('div', { className: 'space-y-1' }, [
        h('h3', { className: 'text-base font-semibold text-slate-900 dark:text-white' }, 'Hours by date'),
        h('p', { className: 'text-xs text-slate-500 dark:text-slate-400' }, `${modeLabel}. Weekly bars run Sunday to Saturday.`),
      ]),
      h('div', { className: 'text-right' }, [
        h('div', { className: 'text-2xl font-semibold text-slate-900 dark:text-white' }, formatTimeDurationHours(data.totalHours, durationFormat)),
        h('div', { className: 'text-xs text-slate-500 dark:text-slate-400' }, 'Total hours'),
      ]),
    ]),
    data.items.length
      ? h('div', {
          className: 'mt-5 grid items-end gap-2 overflow-x-auto pb-2',
          style: { gridTemplateColumns: `repeat(${data.items.length}, minmax(${minWidth}, 1fr))` },
        }, data.items.map((item) => {
          const height = item.hours > 0 ? Math.max(6, Math.round((item.hours / max) * 100)) : 0;
          return h('div', { key: item.key, className: 'flex min-w-0 flex-col items-center gap-2' }, [
            h('div', { className: 'h-5 text-[10px] font-semibold', style: { color: '#10b981' } }, item.hours > 0 ? formatTimeDurationHours(item.hours, durationFormat) : ''),
            h('div', { className: 'flex h-44 w-full items-end border-b border-slate-200 dark:border-white/10' }, [
              h('div', {
                className: item.hours > 0 ? 'w-full bg-[var(--color-brand-purple,#711FFF)]' : 'w-full bg-slate-100 dark:bg-white/10',
                style: { height: item.hours > 0 ? `${height}%` : '3px' },
                title: `${item.caption}: ${formatTimeDurationHours(item.hours, durationFormat)}`,
              }),
            ]),
            h('div', { className: 'h-11 text-center leading-tight' }, [
              h('div', { className: 'text-[10px] font-semibold text-slate-700 dark:text-slate-200' }, item.label),
              h('div', { className: 'text-[10px] text-slate-500 dark:text-slate-400' }, item.caption),
            ]),
          ]);
        }))
      : h('div', { className: 'mt-5 rounded-lg border border-dashed border-slate-200 p-6 text-sm text-slate-500 dark:border-white/10 dark:text-slate-400' }, 'No time entries for this range.'),
  ]);
}

function buildTimeBreakdown(rows, keyFn, labelFn) {
  const totals = new Map();
  rows.forEach((row) => {
    const key = keyFn(row) || 'other';
    const label = labelFn(row) || 'Other';
    const current = totals.get(key) || { id: key, label, hours: 0 };
    current.hours += row.hours;
    totals.set(key, current);
  });
  const arr = Array.from(totals.values()).sort((a, b) => b.hours - a.hours);
  const total = arr.reduce((sum, item) => sum + item.hours, 0) || 1;
  return arr.slice(0, 6).map((item, idx) => ({
    ...item,
    percent: Math.round((item.hours / total) * 100),
    color: REPORT_COLORS[idx % REPORT_COLORS.length],
  }));
}

function TimeSummaryCard({ title, items, durationFormat = TIME_DURATION_FORMATS.decimal }) {
  const totalHours = items.reduce((sum, item) => sum + item.hours, 0);
  let cursor = 0;
  const segments = items.map((item) => {
    const start = cursor;
    const end = cursor + item.percent;
    cursor = end;
    return `${item.color} ${start}% ${end}%`;
  }).join(', ') || 'rgba(148,163,184,0.25) 0% 100%';
  return h('div', { className: 'rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-slate-900/80', 'data-demo': 'time-summary-card' }, [
    h('div', { className: 'flex items-center justify-between gap-3' }, [
      h('h4', { className: 'text-sm font-semibold text-slate-900 dark:text-white' }, title),
      h('span', { className: 'text-xs font-medium text-slate-500 dark:text-slate-400' }, formatTimeDurationHours(totalHours, durationFormat)),
    ]),
    items.length
      ? h('div', { className: 'mt-4 flex items-center gap-4' }, [
          h('div', {
            className: 'relative h-24 w-24 shrink-0 rounded-full border border-slate-200 dark:border-white/10',
            style: { backgroundImage: `conic-gradient(${segments})` },
          }, [
            h('div', { className: 'absolute inset-5 rounded-full bg-white dark:bg-slate-900' }),
          ]),
          h('div', { className: 'min-w-0 flex-1 space-y-2' }, items.map((item) =>
            h('div', { key: item.id, className: 'grid grid-cols-[10px_minmax(0,1fr)_auto] items-center gap-2 text-sm' }, [
              h('span', { className: 'h-2.5 w-2.5 rounded-sm', style: { backgroundColor: item.color } }),
              h('span', { className: 'truncate text-slate-700 dark:text-slate-200' }, item.label),
              h('span', { className: 'text-xs text-slate-500 dark:text-slate-400' }, `${item.percent}%`),
            ])
          )),
        ])
      : h('div', { className: 'mt-4 rounded-lg border border-dashed border-slate-200 p-4 text-sm text-slate-500 dark:border-white/10 dark:text-slate-400' }, 'No data for these filters.'),
  ]);
}

function TimeSelectControl({ label, value, options, onChange, className = 'min-w-[170px]' }) {
  return h('label', { className: `flex flex-col gap-1 ${className}` }, [
    h('span', { className: 'text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400' }, label),
    h('select', {
      value,
      onChange: (event) => onChange(event.target.value),
      className: 'h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-800 dark:border-white/10 dark:bg-slate-900 dark:text-white',
    }, options.map((option) => h('option', { key: option.value, value: option.value }, option.label))),
  ]);
}

function TimeMultiSelect({ label, values, options, onChange, allLabel }) {
  const [open, setOpen] = useState(false);
  const selected = new Set(values || []);
  const selectedCount = selected.size;
  const toggle = (value) => {
    const next = new Set(selected);
    if (next.has(value)) next.delete(value);
    else next.add(value);
    onChange(Array.from(next));
  };
  return h('div', { className: 'relative min-w-[190px]' }, [
    h('div', { className: 'text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400' }, label),
    h('button', {
      type: 'button',
      className: 'mt-1 flex h-10 w-full items-center justify-between gap-2 rounded-lg border border-slate-300 bg-white px-3 text-left text-sm text-slate-800 dark:border-white/10 dark:bg-slate-900 dark:text-white',
      onClick: () => setOpen((current) => !current),
    }, [
      h('span', { className: 'truncate' }, selectedCount ? `${selectedCount} selected` : allLabel),
      h('span', { className: 'text-slate-400' }, '▾'),
    ]),
    open
      ? h('div', { className: 'absolute left-0 z-20 mt-2 max-h-72 w-72 overflow-auto rounded-xl border border-slate-200 bg-white p-2 shadow-xl dark:border-white/10 dark:bg-slate-950' }, [
          options.length
            ? options.map((option) => h('label', { key: option.value, className: 'flex cursor-pointer items-center gap-2 rounded-lg px-2 py-2 text-sm text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-white/5' }, [
                h('input', {
                  type: 'checkbox',
                  checked: selected.has(option.value),
                  onChange: () => toggle(option.value),
                  className: 'h-4 w-4 rounded border-slate-300 text-[var(--color-brand-purple,#711FFF)] focus:ring-[var(--color-brand-purple,#711FFF)]',
                }),
                h('span', { className: 'truncate' }, option.label),
              ]))
            : h('div', { className: 'px-2 py-3 text-sm text-slate-500 dark:text-slate-400' }, 'No options'),
          selectedCount
            ? h('button', {
                type: 'button',
                className: 'mt-1 w-full rounded-lg px-2 py-2 text-left text-xs font-semibold text-[var(--color-brand-purple,#711FFF)] hover:bg-slate-50 dark:hover:bg-white/5',
                onClick: () => onChange([]),
              }, 'Clear selection')
            : null,
        ])
      : null,
  ]);
}

function TimeDateRangeControl({ state, onChange }) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerAnchor, setPickerAnchor] = useState(null);
  const [pickerInitial, setPickerInitial] = useState({ start: '', end: '' });
  const selectedOption = TIME_RANGE_OPTIONS.find((option) => option.value === state.range);
  const openPicker = (anchorEl) => {
    const base = state.range === 'custom' && state.start && state.end
      ? { start: state.start, end: state.end }
      : (() => {
          const r = getTimePresetRange(state.range, new Date()) || getTimePresetRange(TIME_DEFAULT_RANGE, new Date());
          return { start: formatISODate(r.start), end: formatISODate(r.end) };
        })();
    setPickerInitial(base);
    setPickerAnchor(anchorEl?.getBoundingClientRect?.() || null);
    setPickerOpen(true);
  };
  return h('div', { className: 'min-w-[118px]' }, [
    h('div', { className: 'flex flex-col gap-1' }, [
      h('span', { className: 'text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400' }, 'Date Range'),
      h('button', {
        type: 'button',
        className: 'inline-flex h-8 w-full items-center justify-center rounded-md bg-blue-600 px-3 text-xs font-semibold text-white shadow-sm transition hover:bg-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:ring-offset-2 focus:ring-offset-white dark:bg-blue-500 dark:hover:bg-blue-400 dark:focus:ring-offset-slate-950',
        onClick: (event) => openPicker(event.currentTarget),
      }, [
        h('span', { className: 'truncate' }, selectedOption?.label || 'Date Range'),
      ]),
    ]),
    h(DateRangePickerPopover, {
      open: pickerOpen,
      anchorRect: pickerAnchor,
      initialStart: pickerInitial.start,
      initialEnd: pickerInitial.end,
      presetsOverride: TIME_PICKER_PRESETS,
      getPresetRangeForId: getTimePresetRange,
      initialPreset: state.range,
      onClose: () => setPickerOpen(false),
      onApply: ({ range, start, end }) => {
        const nextRange = range && range !== 'custom' ? range : 'custom';
        onChange({ range: nextRange, start: nextRange === 'custom' ? start : '', end: nextRange === 'custom' ? end : '' });
        setPickerOpen(false);
      },
    }),
  ]);
}

function TimeExportMenu({ onCsv, onPrintFriendly }) {
  const [open, setOpen] = useState(false);
  return h('div', { className: 'relative' }, [
    h('button', {
      type: 'button',
      className: 'mt-5 inline-flex h-10 items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-800 hover:bg-slate-50 dark:border-white/10 dark:bg-slate-900 dark:text-white dark:hover:bg-slate-800',
      onClick: () => setOpen((current) => !current),
    }, ['Export', h('span', { key: 'chev', className: 'text-slate-400' }, '▾')]),
    open
      ? h('div', { className: 'absolute right-0 z-20 mt-2 w-48 rounded-lg border border-slate-200 bg-white shadow-lg dark:border-white/10 dark:bg-slate-900' },
          REPORT_EXPORT_OPTIONS.map((option) => h('button', {
            key: option.key,
            type: 'button',
            className: 'w-full px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800',
            onClick: () => {
              if (option.key === 'csv') onCsv();
              if (option.key === 'print') onPrintFriendly();
              setOpen(false);
            },
          }, option.label))
        )
      : null,
  ]);
}

function TimeDurationFormatGlyph({ kind }) {
  if (kind === TIME_DURATION_FORMATS.clock) {
    return h('svg', {
      viewBox: '0 0 24 24',
      fill: 'none',
      stroke: 'currentColor',
      strokeWidth: '2',
      strokeLinecap: 'round',
      strokeLinejoin: 'round',
      className: 'h-4 w-4',
      'aria-hidden': 'true',
    }, [
      h('circle', { cx: '12', cy: '12', r: '8.5' }),
      h('path', { d: 'M12 7.5v5l3 2' }),
    ]);
  }

  return h('svg', {
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: '2',
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    className: 'h-4 w-4',
    'aria-hidden': 'true',
  }, [
    h('rect', { x: '4.5', y: '6', width: '15', height: '12', rx: '2.5' }),
    h('path', { d: 'M8 12h.01M12 12h.01M16 12h.01' }),
  ]);
}

function TimeDurationFormatToggle({ value, onChange }) {
  return h('div', { className: 'min-w-[74px]' }, [
    h('div', { className: 'text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400' }, 'Display'),
    h('div', { className: 'mt-1 inline-flex h-8 rounded-md border border-slate-300 bg-white p-0.5 dark:border-white/10 dark:bg-slate-900', role: 'tablist', 'aria-label': 'Duration display format' }, [
      [
        { value: TIME_DURATION_FORMATS.decimal, label: 'Decimal' },
        { value: TIME_DURATION_FORMATS.clock, label: 'Clock' },
      ].map((option) => h('button', {
        key: option.value,
        type: 'button',
        role: 'tab',
        'aria-selected': value === option.value ? 'true' : 'false',
        'aria-label': `${option.label} duration format`,
        title: option.label,
        className: `inline-flex h-7 w-8 items-center justify-center rounded transition ${value === option.value ? 'bg-blue-600 text-white shadow-sm dark:bg-blue-500' : 'text-slate-400 hover:bg-slate-50 hover:text-slate-700 dark:text-slate-500 dark:hover:bg-white/5 dark:hover:text-slate-200'}`,
        onClick: () => onChange(option.value),
      }, h(TimeDurationFormatGlyph, { kind: option.value }))),
    ]),
  ]);
}

function TimeReportControls({ state, options, durationFormat, onDurationFormatChange, onChange, onExportCsv, onPrintFriendly }) {
  const patch = (next) => onChange({ ...state, ...next });
  return h('div', { className: 'rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-slate-900/80', 'data-demo': 'time-report-controls' }, [
    h('div', { className: 'flex flex-wrap items-end gap-3' }, [
      h(TimeDateRangeControl, { state, onChange: patch }),
      h(TimeDurationFormatToggle, { value: durationFormat, onChange: onDurationFormatChange }),
      h(TimeSelectControl, { label: 'Company', value: state.company, options: options.companies, onChange: (company) => patch({ company }) }),
      h(TimeSelectControl, { label: 'Job', value: state.job, options: options.jobs, onChange: (job) => patch({ job }) }),
      h(TimeMultiSelect, { label: 'Service Types', values: state.serviceTypes, options: options.serviceTypes, allLabel: 'All service types', onChange: (serviceTypes) => patch({ serviceTypes }) }),
      h(TimeMultiSelect, { label: 'Team Members', values: state.teamMembers, options: options.teamMembers, allLabel: 'All team members', onChange: (teamMembers) => patch({ teamMembers }) }),
      h(TimeSelectControl, { label: 'Work Context', value: state.workContext, options: TIME_WORK_CONTEXT_OPTIONS, onChange: (workContext) => patch({ workContext }), className: 'min-w-[150px]' }),
      h(TimeSelectControl, { label: 'Task Source', value: state.taskSource, options: TIME_TASK_SOURCE_OPTIONS, onChange: (taskSource) => patch({ taskSource }), className: 'min-w-[180px]' }),
      h(TimeSelectControl, { label: 'Group By', value: state.groupBy, options: TIME_GROUP_OPTIONS, onChange: (groupBy) => patch({ groupBy }), className: 'min-w-[160px]' }),
      h(TimeExportMenu, { onCsv: onExportCsv, onPrintFriendly }),
    ]),
  ]);
}

function TimeActiveFilters({ state, rangeLabel, options }) {
  const lookup = (list, value, fallback) => list.find((item) => item.value === value)?.label || fallback;
  const multiLabel = (list, values, allLabel) => {
    if (!values?.length) return allLabel;
    const labels = values.map((value) => lookup(list, value, value));
    return labels.length > 2 ? `${labels.slice(0, 2).join(', ')} +${labels.length - 2}` : labels.join(', ');
  };
  const chips = [
    `Date Range: ${rangeLabel}`,
    `Company: ${lookup(options.companies, state.company, 'All companies')}`,
    `Job: ${lookup(options.jobs, state.job, 'All jobs')}`,
    `Service Types: ${multiLabel(options.serviceTypes, state.serviceTypes, 'All service types')}`,
    `Team Members: ${multiLabel(options.teamMembers, state.teamMembers, 'All team members')}`,
    `Work Context: ${lookup(TIME_WORK_CONTEXT_OPTIONS, state.workContext, 'All')}`,
    `Task Source: ${lookup(TIME_TASK_SOURCE_OPTIONS, state.taskSource, 'Job & Quick Tasks')}`,
    `Group By: ${lookup(TIME_GROUP_OPTIONS, state.groupBy, 'None')}`,
  ];
  return h('div', { className: 'flex flex-wrap gap-2 text-xs text-slate-600 dark:text-slate-300', 'data-demo': 'time-active-filters' },
    chips.map((chip) => h('span', { key: chip, className: 'rounded-full border border-slate-200 bg-white px-3 py-1 dark:border-white/10 dark:bg-slate-900' }, chip))
  );
}

function groupTimeRows(rows, groupBy) {
  if (groupBy === 'none') return [{ id: 'all', title: 'All time entries', rows, hours: rows.reduce((sum, row) => sum + row.hours, 0) }];
  const map = new Map();
  rows.forEach((row) => {
    let id = 'other';
    let title = 'Other';
    if (groupBy === 'service-type') {
      id = row.serviceTypeId || 'other';
      title = row.serviceTypeName || 'Other';
    } else if (groupBy === 'team-member') {
      id = row.userId || 'unassigned';
      title = row.teamMemberName || 'Unassigned';
    } else if (groupBy === 'job') {
      id = row.jobName || 'quick-tasks';
      title = row.jobName || 'Quick Tasks';
    } else if (groupBy === 'client') {
      id = row.company || 'Internal';
      title = row.company || 'Internal';
    }
    const group = map.get(id) || { id, title, rows: [], hours: 0 };
    group.rows.push(row);
    group.hours += row.hours;
    map.set(id, group);
  });
  return Array.from(map.values())
    .filter((group) => group.rows.length > 0)
    .sort((a, b) => b.hours - a.hours || a.title.localeCompare(b.title));
}

function TimeEditableDisplay({ children, onClick, className = '', title = 'Click to edit' }) {
  return h('button', {
    type: 'button',
    title,
    className: `w-full rounded-md text-left transition hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-[var(--color-brand-purple,#711FFF)]/30 dark:hover:bg-white/5 ${className}`,
    onClick,
  }, children);
}

function TimeInlineInput({ value, onCommitValue, onCancel, type = 'text', className = '', placeholder = '', autoFocus = true }) {
  const [localValue, setLocalValue] = useState(value || '');
  const canceledRef = useRef(false);
  useEffect(() => {
    setLocalValue(value || '');
  }, [value]);
  const commit = () => {
    if (canceledRef.current) return;
    onCommitValue(localValue);
  };
  const cancel = () => {
    canceledRef.current = true;
    onCancel();
  };
  return h('input', {
    type,
    value: localValue,
    placeholder,
    autoFocus,
    className: `h-9 w-full min-w-0 rounded-lg border border-slate-300 bg-white px-2.5 text-sm text-slate-800 dark:border-white/10 dark:bg-slate-950 dark:text-white ${className}`,
    onChange: (event) => setLocalValue(event.target.value || ''),
    onBlur: commit,
    onKeyDown: (event) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        commit();
      }
      if (event.key === 'Escape') {
        event.preventDefault();
        cancel();
      }
    },
  });
}

function TimeInlineTextarea({ value, onCommitValue, onCancel }) {
  const [localValue, setLocalValue] = useState(value || '');
  const canceledRef = useRef(false);
  useEffect(() => {
    setLocalValue(value || '');
  }, [value]);
  const commit = () => {
    if (canceledRef.current) return;
    onCommitValue(localValue);
  };
  const cancel = () => {
    canceledRef.current = true;
    onCancel();
  };
  return h('textarea', {
    rows: 4,
    value: localValue,
    autoFocus: true,
    className: 'w-full min-w-0 rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-sm leading-5 text-slate-800 dark:border-white/10 dark:bg-slate-950 dark:text-white',
    onChange: (event) => setLocalValue(event.target.value || ''),
    onBlur: commit,
    onKeyDown: (event) => {
      if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
        event.preventDefault();
        commit();
      }
      if (event.key === 'Escape') {
        event.preventDefault();
        cancel();
      }
    },
  });
}

function TimeInlineTimerRangeEditor({ startTime, endTime, onCommitValue, onCancel }) {
  const [draft, setDraft] = useState({ startTime: startTime || '', endTime: endTime || '' });
  const containerRef = useRef(null);
  const canceledRef = useRef(false);
  useEffect(() => {
    setDraft({ startTime: startTime || '', endTime: endTime || '' });
  }, [startTime, endTime]);
  const commit = () => {
    if (canceledRef.current) return;
    onCommitValue(draft);
  };
  const cancel = () => {
    canceledRef.current = true;
    onCancel();
  };
  const handleBlur = () => {
    setTimeout(() => {
      if (canceledRef.current) return;
      if (containerRef.current?.contains(document.activeElement)) return;
      commit();
    }, 0);
  };
  const handleKeyDown = (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      commit();
    }
    if (event.key === 'Escape') {
      event.preventDefault();
      cancel();
    }
  };
  return h('div', { ref: containerRef, className: 'flex min-w-0 flex-col gap-1' }, [
    h('input', {
      type: 'text',
      value: draft.startTime,
      autoFocus: true,
      placeholder: 'Start',
      className: 'h-8 w-full min-w-0 rounded-md border border-slate-300 bg-white px-2 text-xs text-slate-800 dark:border-white/10 dark:bg-slate-950 dark:text-white',
      onChange: (event) => setDraft((current) => ({ ...current, startTime: event.target.value || '' })),
      onBlur: handleBlur,
      onKeyDown: handleKeyDown,
    }),
    h('input', {
      type: 'text',
      value: draft.endTime,
      placeholder: 'End',
      className: 'h-8 w-full min-w-0 rounded-md border border-slate-300 bg-white px-2 text-xs text-slate-800 dark:border-white/10 dark:bg-slate-950 dark:text-white',
      onChange: (event) => setDraft((current) => ({ ...current, endTime: event.target.value || '' })),
      onBlur: handleBlur,
      onKeyDown: handleKeyDown,
    }),
  ]);
}

function TimeInlineSelect({ value, options, onCommitValue, onCancel, disabled = false }) {
  const canceledRef = useRef(false);
  const commit = (nextValue) => {
    if (canceledRef.current) return;
    onCommitValue(nextValue || '');
  };
  const cancel = () => {
    canceledRef.current = true;
    onCancel?.();
  };
  return h('select', {
    value,
    disabled,
    autoFocus: true,
    className: 'h-9 w-full min-w-0 rounded-lg border border-slate-300 bg-white px-2.5 text-sm text-slate-800 disabled:opacity-70 dark:border-white/10 dark:bg-slate-950 dark:text-white',
    onChange: (event) => commit(event.target.value || ''),
    onBlur: () => commit(value || ''),
    onKeyDown: (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        cancel();
      }
    },
  }, options.map((option) => h('option', { key: option.value, value: option.value }, option.label)));
}

function TimeDescriptionCell({ row, expanded, onToggle, editable = false, onEdit = null }) {
  const text = String(row.description || '').trim();
  if (!text) {
    return editable
      ? h(TimeEditableDisplay, { onClick: onEdit, className: 'px-2 py-1 text-sm text-slate-400 dark:text-slate-500', title: 'Click to add description' }, 'No description')
      : h('span', { className: 'text-sm text-slate-400 dark:text-slate-500' }, 'No description');
  }
  const canToggle = text.length > 90;
  return h('div', { className: 'space-y-1' }, [
    editable
      ? h(TimeEditableDisplay, { onClick: onEdit, className: 'px-2 py-1 text-sm leading-5 text-slate-700 dark:text-slate-200', title: 'Click to edit description' },
          h('span', {
            className: 'block',
            style: expanded ? undefined : { maxHeight: '42px', overflow: 'hidden' },
            title: expanded ? '' : text,
          }, text)
        )
      : h('div', {
          className: 'text-sm leading-5 text-slate-700 dark:text-slate-200',
          style: expanded ? undefined : { maxHeight: '42px', overflow: 'hidden' },
          title: expanded ? '' : text,
        }, text),
    canToggle
      ? h('button', {
          type: 'button',
          className: 'text-xs font-semibold text-[var(--color-brand-purple,#711FFF)]',
          onClick: onToggle,
        }, expanded ? 'Show less' : 'Show more')
      : null,
  ]);
}

function TimeActivityRows({
  rows,
  expandedAll,
  expandedRows,
  onToggleNote,
  editingId,
  editingField,
  editDraft,
  setEditDraft,
  editError,
  serviceTypeOptions,
  members,
  canChangeMember,
  canEditRow,
  onStartFieldEdit,
  onCancelEdit,
  onSaveEdit,
  onOpenEditDate,
  durationFormat,
  printFriendly,
}) {
  const serviceOptions = [{ value: '', label: 'Other' }, ...(serviceTypeOptions || [])];
  const memberOptions = members.map((member) => ({ value: String(member.id), label: member.name || member.email || 'Team member' }));

  const headerCellClass = 'min-w-0 leading-4';
  const bodyCellClass = 'min-w-0';
  const compactTextClass = 'min-w-0 truncate text-slate-600 dark:text-slate-300';
  const serviceChipClass = 'inline-flex max-w-full min-w-0 rounded-md bg-slate-100 px-2 py-1 text-xs font-medium text-slate-700 dark:bg-slate-800 dark:text-slate-200';

  return h('div', { className: 'min-w-0' }, [
    h('div', {
      className: 'grid w-full min-w-0 gap-3 border-b border-slate-100 px-4 py-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:border-white/5 dark:text-slate-400 lg:gap-4 lg:px-5',
      style: { gridTemplateColumns: TIME_TABLE_COLUMNS },
    }, [
      h('div', { className: headerCellClass }, 'Task Name'),
      h('div', { className: headerCellClass }, 'Company'),
      h('div', { className: headerCellClass }, 'Description'),
      h('div', { className: headerCellClass }, 'Team Member'),
      h('div', { className: headerCellClass }, 'Service Type'),
      h('div', { className: headerCellClass }, 'Time'),
      h('div', { className: `${headerCellClass} text-right` }, 'Duration'),
    ]),
    h('div', { className: 'divide-y divide-slate-100 dark:divide-white/5' }, rows.map((row) => {
      const expanded = expandedAll || expandedRows.has(row.id);
      const isEditing = !printFriendly && editingId === row.id;
      const editable = !printFriendly && canEditRow(row);
      const activeField = isEditing ? editingField : '';
      const commitPatch = (patch) => {
        if (!editDraft) return;
        const nextDraft = { ...editDraft, ...patch };
        setEditDraft(nextDraft);
        onSaveEdit(row, nextDraft);
      };
      const commitTimerPatch = (patch) => {
        if (!editDraft) return;
        const nextDraft = { ...editDraft, entryType: 'timer', _recalculateFromClock: true, ...patch };
        const clockMinutes = getDurationMinutesFromClockRange(nextDraft.startTime, nextDraft.endTime);
        if (clockMinutes != null) nextDraft.duration = formatDurationDraftValue(clockMinutes);
        setEditDraft(nextDraft);
        onSaveEdit(row, nextDraft);
      };
      const showError = editError ? h('div', { className: 'mt-1 text-xs text-rose-600 dark:text-rose-300' }, editError) : null;
      const isTimerEntry = row.raw.entryType === 'timer' && (row.raw.startTime || row.raw.endTime);
      const sourceLabel = row.raw.entryType === 'timer' ? 'Timer' : 'Manual';

      const taskDisplay = h('div', { className: 'min-w-0' }, [
        h('div', {
          className: 'font-semibold leading-5 text-slate-900 dark:text-white',
          style: { maxHeight: '40px', overflow: 'hidden' },
          title: row.taskName,
        }, row.taskName),
        row.jobName
          ? h('div', { className: 'truncate text-xs text-slate-500 dark:text-slate-400' }, `↳ ${row.jobName}`)
          : null,
      ]);

      const descriptionEditor = activeField === 'notes' && editDraft
        ? h('div', { className: 'min-w-0' }, [
            h(TimeInlineTextarea, {
              value: editDraft.notes,
              onCommitValue: (notes) => commitPatch({ notes }),
              onCancel: onCancelEdit,
            }),
            showError,
          ])
        : null;

      const timeEditor = activeField === 'time' && editDraft
        ? h('div', { className: 'min-w-0 space-y-2' }, [
            isTimerEntry
              ? h(TimeInlineTimerRangeEditor, {
                  startTime: editDraft.startTime || '',
                  endTime: editDraft.endTime || '',
                  onCommitValue: ({ startTime, endTime }) => commitTimerPatch({ startTime, endTime }),
                  onCancel: onCancelEdit,
                })
              : h('div', { className: 'rounded-lg bg-slate-50 px-2.5 py-2 text-sm font-semibold text-slate-600 dark:bg-white/5 dark:text-slate-300' }, 'Manual'),
            showError,
          ])
        : null;

      return h('div', { key: row.id, 'data-demo': 'time-report-activity-row' },
        h('div', {
          className: 'grid w-full min-w-0 items-start gap-3 px-4 py-3 text-sm lg:gap-4 lg:px-5',
          style: { gridTemplateColumns: TIME_TABLE_COLUMNS },
        }, [
          h('div', { className: `${bodyCellClass} space-y-1` }, [
            taskDisplay,
            row.lockReason ? h('div', { className: 'text-xs text-amber-600 dark:text-amber-300' }, row.lockReason) : null,
          ]),
          h('div', { className: compactTextClass, title: row.company }, row.company),
          descriptionEditor || h(TimeDescriptionCell, {
            row,
            expanded,
            onToggle: () => onToggleNote(row.id),
            editable,
            onEdit: () => onStartFieldEdit(row, 'notes'),
          }),
          activeField === 'user' && editDraft
            ? h('div', { className: 'min-w-0' }, [
                h(TimeInlineSelect, {
                  value: editDraft.userId,
                  disabled: !canChangeMember,
                  options: memberOptions,
                  onCommitValue: (userId) => commitPatch({ userId: userId || editDraft.userId }),
                  onCancel: onCancelEdit,
                }),
                showError,
              ])
            : (editable
                ? h(TimeEditableDisplay, { onClick: () => onStartFieldEdit(row, 'user'), className: 'truncate px-2 py-1 text-slate-600 dark:text-slate-300', title: 'Click to edit team member' }, row.teamMemberName)
                : h('div', { className: compactTextClass, title: row.teamMemberName }, row.teamMemberName)),
          activeField === 'serviceType' && editDraft
            ? h('div', { className: 'min-w-0' }, [
                h(TimeInlineSelect, {
                  value: editDraft.serviceTypeId,
                  options: serviceOptions,
                  onCommitValue: (serviceTypeId) => commitPatch({ serviceTypeId }),
                  onCancel: onCancelEdit,
                }),
                showError,
              ])
            : h('div', { className: 'min-w-0' }, editable
                ? h(TimeEditableDisplay, { onClick: () => onStartFieldEdit(row, 'serviceType'), className: 'px-1 py-1', title: 'Click to edit service type' },
                    h('span', { className: serviceChipClass, title: row.serviceTypeName },
                      h('span', { className: 'min-w-0 truncate' }, row.serviceTypeName)
                    )
                  )
                : h('span', { className: serviceChipClass, title: row.serviceTypeName },
                    h('span', { className: 'min-w-0 truncate' }, row.serviceTypeName)
                  )),
          timeEditor || (editable && isTimerEntry
            ? h(TimeEditableDisplay, {
                onClick: () => onStartFieldEdit(row, 'time'),
                className: 'px-2 py-1 text-xs leading-4 text-slate-600 dark:text-slate-300',
                title: 'Click to edit timer time in and time out',
              }, [
                h('div', { className: 'text-xs font-semibold text-slate-700 dark:text-slate-200' }, sourceLabel),
                h('div', { className: 'break-words' }, row.timeLabel),
              ])
            : h('div', { className: 'min-w-0 text-xs leading-4 text-slate-600 dark:text-slate-300' }, [
                h('div', { className: 'text-xs font-semibold text-slate-700 dark:text-slate-200' }, sourceLabel),
                h('div', { className: 'break-words' }, isTimerEntry ? row.timeLabel : 'Manual'),
              ])),
          activeField === 'duration' && editDraft
            ? h('div', { className: 'min-w-0 text-right' }, [
                h(TimeInlineInput, {
                  value: formatDurationDraftForMode(row.durationMinutes, durationFormat),
                  className: 'text-right font-semibold',
                  placeholder: durationFormat === TIME_DURATION_FORMATS.clock ? '1:30' : '1.5',
                  onCommitValue: (duration) => commitPatch({ duration }),
                  onCancel: onCancelEdit,
                }),
                showError,
              ])
            : (editable
                ? h(TimeEditableDisplay, { onClick: () => onStartFieldEdit(row, 'duration'), className: 'px-2 py-1 text-right text-base font-semibold tabular-nums text-slate-900 dark:text-white', title: 'Click to edit duration' }, formatTimeDurationMinutes(row.durationMinutes, durationFormat))
                : h('div', { className: 'text-right text-base font-semibold tabular-nums text-slate-900 dark:text-white' }, formatTimeDurationMinutes(row.durationMinutes, durationFormat))),
        ])
      );
    })),
  ]);
}

function TimeActivitySection({ group, collapsed, onToggleGroup, groupBy, durationFormat = TIME_DURATION_FORMATS.decimal, children }) {
  if (groupBy === 'none') return children;
  return h('section', { className: 'overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-white/10 dark:bg-slate-900/80', 'data-demo': 'time-report-group' }, [
    h('button', {
      type: 'button',
      className: 'flex w-full items-center justify-between gap-3 bg-slate-50 px-5 py-3 text-left dark:bg-slate-950/50',
      onClick: onToggleGroup,
    }, [
      h('div', { className: 'space-y-0.5' }, [
        h('div', { className: 'text-sm font-semibold text-slate-900 dark:text-white' }, group.title),
        h('div', { className: 'text-xs text-slate-500 dark:text-slate-400' }, `${group.rows.length} entries`),
      ]),
      h('div', { className: 'flex items-center gap-3' }, [
        h('span', { className: 'text-sm font-semibold text-slate-900 dark:text-white' }, formatTimeDurationHours(group.hours, durationFormat)),
        h('span', { className: 'text-slate-400' }, collapsed ? '▸' : '▾'),
      ]),
    ]),
    collapsed ? null : children,
  ]);
}

function TimeReport({ queryString, printFriendly = false, onPrintFriendly }) {
  const [state, setState] = useState(() => parseTimeReportState(queryString));
  useEffect(() => {
    setState(parseTimeReportState(queryString));
  }, [queryString]);

  const role = useMemo(() => getCurrentRole(), []);
  const isAdminLike = role === 'owner' || role === 'admin';
  const members = useMemo(() => loadTeamMembers(), []);
  const serviceTypes = useMemo(() => loadServiceTypes(), []);
  const currentUserId = useMemo(() => getCurrentUserId(members) || members[0]?.id || '', [members]);
  const taskCatalog = useMemo(() => loadPermittedMyTimeTaskCatalog({ actorUserId: currentUserId, actorRole: role }), [currentUserId, role]);
  const taskLockMap = useMemo(() => loadMyTimeTaskLockMap(), [taskCatalog]);
  const [storedEntries, setStoredEntries] = useState(() => loadMyTimeEntries({ catalog: taskCatalog }));
  const [expandedRows, setExpandedRows] = useState(() => new Set());
  const [expandedAll, setExpandedAll] = useState(false);
  const [collapsedGroups, setCollapsedGroups] = useState(() => new Set());
  const [editingId, setEditingId] = useState('');
  const [editingField, setEditingField] = useState('');
  const [editDraft, setEditDraft] = useState(null);
  const [editError, setEditError] = useState('');
  const [durationFormat, setDurationFormat] = useState(() => getStoredTimeDurationFormat());
  const overlayCleanupRef = useRef(null);

  useEffect(() => {
    setStoredEntries(loadMyTimeEntries({ catalog: taskCatalog }));
  }, [taskCatalog]);

  useEffect(() => {
    return () => {
      if (typeof overlayCleanupRef.current === 'function') overlayCleanupRef.current();
    };
  }, []);

  useEffect(() => {
    setCollapsedGroups(new Set());
  }, [state.groupBy]);

  const allRows = useMemo(() => buildTimeReportRows(storedEntries, members, serviceTypes, taskCatalog), [storedEntries, members, serviceTypes, taskCatalog]);
  const range = useMemo(() => resolveTimeReportRange(state, allRows), [state, allRows]);
  const filteredRows = useMemo(() => filterTimeReportRows(allRows, state, range), [allRows, state, range]);
  const options = useMemo(() => buildTimeFilterOptions(allRows, members, serviceTypes), [allRows, members, serviceTypes]);
  const chartData = useMemo(() => buildTimeChartData(filteredRows, range), [filteredRows, range]);
  const rangeLabel = getTimeRangeLabel(range);
  const groupedRows = useMemo(() => groupTimeRows(filteredRows, state.groupBy), [filteredRows, state.groupBy]);
  const summaryCards = useMemo(() => [
    { title: 'Client vs Internal', items: buildTimeBreakdown(filteredRows, (row) => row.workContext, (row) => row.workContext === 'internal' ? 'Internal' : 'Client') },
    { title: 'Service Type Mix', items: buildTimeBreakdown(filteredRows, (row) => row.serviceTypeId || 'other', (row) => row.serviceTypeName) },
    { title: 'Team Member Mix', items: buildTimeBreakdown(filteredRows, (row) => row.userId, (row) => row.teamMemberName) },
    { title: 'Job Mix', items: buildTimeBreakdown(filteredRows, (row) => row.jobName || 'quick-tasks', (row) => row.jobName || 'Quick Tasks') },
  ], [filteredRows]);

  const applyState = (next) => {
    setState(next);
    navigateTimeReportState(next);
    setEditingId('');
    setEditingField('');
  };

  const changeDurationFormat = (format) => {
    const normalized = format === TIME_DURATION_FORMATS.clock ? TIME_DURATION_FORMATS.clock : TIME_DURATION_FORMATS.decimal;
    setDurationFormat(normalized);
    persistTimeDurationFormat(normalized);
    cancelEdit();
  };

  const toggleNote = (rowId) => {
    setExpandedRows((current) => {
      const next = new Set(current);
      if (next.has(rowId)) next.delete(rowId);
      else next.add(rowId);
      return next;
    });
  };

  const canEditRow = (row) => {
    const access = getMyTimeEntryAccess(row.raw, {
      actorUserId: currentUserId,
      actorRole: role,
      selectedUserId: isAdminLike ? row.userId : currentUserId,
      taskLockMap,
    });
    return !!access.canEdit;
  };

  const startFieldEdit = (row, field) => {
    setEditError('');
    setEditingId(row.id);
    setEditingField(field);
    setEditDraft({
      date: row.dateIso,
      duration: formatDurationDraftValue(row.durationMinutes),
      notes: row.description,
      taskName: row.taskName,
      nextTaskId: '',
      serviceTypeId: row.serviceTypeId || '',
      userId: row.userId,
      entryType: row.raw.entryType === 'timer' ? 'timer' : 'manual',
      startTime: row.raw.startTime || '',
      endTime: row.raw.endTime || '',
    });
  };

  const closeOverlay = () => {
    if (typeof overlayCleanupRef.current === 'function') {
      const cleanup = overlayCleanupRef.current;
      overlayCleanupRef.current = null;
      cleanup();
    }
  };

  const cancelEdit = () => {
    closeOverlay();
    setEditingId('');
    setEditingField('');
    setEditDraft(null);
    setEditError('');
  };

  const openEditDate = (row, anchorEl, onSelectDate = null) => {
    if (!editDraft) return;
    closeOverlay();
    overlayCleanupRef.current = openSingleDatePickerPopover({
      anchorEl,
      value: editDraft.date || row.dateIso,
      onSelect: (nextDate) => {
        setEditDraft((current) => current ? { ...current, date: nextDate || current.date } : current);
        if (typeof onSelectDate === 'function') onSelectDate(nextDate || editDraft.date || row.dateIso);
        overlayCleanupRef.current = null;
      },
      onClear: () => {},
      onClose: () => {
        overlayCleanupRef.current = null;
        anchorEl?.focus?.();
      },
    });
  };

  const saveEdit = (row, draftOverride = null) => {
    const draft = draftOverride || editDraft;
    if (!draft) return false;
    setEditError('');
    let parsed = parseDurationInputToMinutes(draft.duration);
    if (draft._recalculateFromClock) {
      const clockMinutes = getDurationMinutesFromClockRange(draft.startTime, draft.endTime);
      if (clockMinutes == null || clockMinutes <= 0) {
        setEditError('Enter an end time after the start time.');
        return false;
      }
      parsed = { valid: true, minutes: clockMinutes };
    }
    if (!parsed.valid || parsed.minutes <= 0) {
      setEditError('Enter a positive duration like 1.5 or 1:30.');
      return false;
    }
    const updates = {
      date: draft.date || row.dateIso,
      duration_minutes: parsed.minutes,
      notes: draft.notes || '',
      serviceTypeId: draft.serviceTypeId || '',
      userId: isAdminLike ? draft.userId || row.userId : row.userId,
      entryType: draft.entryType === 'timer' ? 'timer' : 'manual',
      startTime: draft.entryType === 'timer' ? String(draft.startTime || '') : '',
      endTime: draft.entryType === 'timer' ? String(draft.endTime || '') : '',
    };
    const nextEntries = updateMyTimeEntry(row.id, updates, {
      catalog: taskCatalog,
      actorUserId: currentUserId,
      actorRole: role,
      selectedUserId: isAdminLike ? row.userId : currentUserId,
      taskLockMap,
    });
    setStoredEntries(nextEntries);
    setEditingId('');
    setEditingField('');
    setEditDraft(null);
    setEditError('');
    closeOverlay();
    return true;
  };

  const exportCsv = () => {
    const grouped = state.groupBy !== 'none';
    const groupLookup = new Map();
    groupedRows.forEach((group) => group.rows.forEach((row) => groupLookup.set(row.id, group.title)));
    const baseHeader = ['Task Name', 'Job Name', 'Company', 'Description', 'Team Member', 'Service Type', 'Date', 'Time', 'Duration', 'Work Context', 'Task Source'];
    const rows = [
      grouped ? ['Group', ...baseHeader] : baseHeader,
      ...filteredRows.map((row) => {
        const values = [
          row.taskName,
          row.jobName,
          row.company,
          row.description,
          row.teamMemberName,
          row.serviceTypeName,
          row.dateIso,
          row.timeLabel,
          formatTimeDurationMinutes(row.durationMinutes, durationFormat),
          row.workContext === 'internal' ? 'Internal' : 'Client',
          row.taskSource === 'job' ? 'Job Tasks' : 'Quick Tasks',
        ];
        return grouped ? [groupLookup.get(row.id) || '', ...values] : values;
      }),
    ];
    downloadCsv(`time-report-${state.range === 'all' ? 'all-dates' : `${formatISODate(range.start)}-${formatISODate(range.end)}`}.csv`, rows);
  };

  return h('div', { className: 'space-y-6', 'data-demo': 'time-report' }, [
    h('div', { className: 'space-y-3' }, [
      h('div', { className: 'flex flex-wrap items-end justify-between gap-3' }, [
        h('div', { className: 'space-y-1' }, [
          h('h2', { className: 'text-2xl font-semibold text-slate-900 dark:text-white' }, 'Time Report'),
          h('p', { className: 'text-sm text-slate-600 dark:text-slate-300', 'data-demo': 'time-selected-date-range' }, rangeLabel),
        ]),
        h('span', { className: 'text-sm text-slate-500 dark:text-slate-400' }, `${filteredRows.length} entries`),
      ]),
      h(TimeActiveFilters, { state, rangeLabel, options }),
    ]),
    printFriendly ? null : h(TimeReportControls, {
      state,
      options,
      durationFormat,
      onDurationFormatChange: changeDurationFormat,
      onChange: applyState,
      onExportCsv: exportCsv,
      onPrintFriendly,
    }),
    h(TimeAdaptiveBars, { data: chartData, durationFormat }),
    h('div', { className: 'grid grid-cols-1 gap-4 lg:grid-cols-2', 'data-demo': 'time-summary-cards' },
      summaryCards.map((card) => h(TimeSummaryCard, { key: card.title, title: card.title, items: card.items, durationFormat }))
    ),
    h('div', { className: 'rounded-xl border border-slate-200 bg-white shadow-sm dark:border-white/10 dark:bg-slate-900/80', 'data-demo': 'time-report-activity' }, [
      h('div', { className: 'flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-4 dark:border-white/5' }, [
        h('div', { className: 'space-y-1' }, [
          h('h3', { className: 'text-lg font-semibold text-slate-900 dark:text-white' }, 'Time Report Activity'),
          h('p', { className: 'text-sm text-slate-600 dark:text-slate-300' }, 'Correct entries before sharing or exporting.'),
        ]),
        h('button', {
          type: 'button',
          className: 'rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 dark:border-white/10 dark:text-slate-100 dark:hover:bg-white/10',
          onClick: () => {
            setExpandedAll((current) => !current);
            setExpandedRows(new Set());
          },
        }, expandedAll ? 'Collapse all notes' : 'Expand all notes'),
      ]),
      filteredRows.length
        ? h('div', { className: 'space-y-4 p-4' }, groupedRows.map((group) => {
            const collapsed = collapsedGroups.has(group.id);
            return h(TimeActivitySection, {
              key: group.id,
              group,
              groupBy: state.groupBy,
              collapsed,
              durationFormat,
              onToggleGroup: () => setCollapsedGroups((current) => {
                const next = new Set(current);
                if (next.has(group.id)) next.delete(group.id);
                else next.add(group.id);
                return next;
              }),
            }, h(TimeActivityRows, {
              rows: group.rows,
              expandedAll,
              expandedRows,
              onToggleNote: toggleNote,
              editingId,
              editingField,
              editDraft,
              setEditDraft,
              editError,
              serviceTypeOptions: options.serviceTypes,
              members,
              canChangeMember: isAdminLike,
              canEditRow,
              onStartFieldEdit: startFieldEdit,
              onCancelEdit: cancelEdit,
              onSaveEdit: saveEdit,
              onOpenEditDate: openEditDate,
              durationFormat,
              printFriendly,
            }));
          }))
        : h('div', { className: 'p-5 text-sm text-slate-600 dark:text-slate-300' }, 'No time entries match these filters.'),
    ]),
  ]);
}

const TEAM_DEFAULT_RANGE = 'this-month';
const TEAM_GROUP_OPTIONS = [
  { value: 'team-member', label: 'Team Members' },
  { value: 'service-type', label: 'Service Types' },
  { value: 'job', label: 'Jobs' },
  { value: 'client', label: 'Clients' },
];
const TEAM_TABLE_COLUMNS = 'minmax(170px,1.35fr) minmax(135px,0.9fr) minmax(96px,0.7fr) minmax(96px,0.64fr) minmax(86px,0.52fr) minmax(82px,0.5fr) minmax(84px,0.52fr) minmax(92px,0.58fr) minmax(132px,0.8fr)';

function parseTeamReportState(queryString = '') {
  const params = new URLSearchParams(queryString);
  const allowedRanges = new Set(TIME_RANGE_OPTIONS.map((option) => option.value));
  const allowedGroups = new Set(TEAM_GROUP_OPTIONS.map((option) => option.value));
  const rangeValue = params.get('range') || TEAM_DEFAULT_RANGE;
  const groupValue = params.get('groupBy') || 'team-member';
  return {
    range: allowedRanges.has(rangeValue) ? rangeValue : TEAM_DEFAULT_RANGE,
    start: params.get('start') || '',
    end: params.get('end') || '',
    teamMembers: splitMultiParam(params.get('teamMembers')),
    serviceTypes: splitMultiParam(params.get('serviceTypes')),
    job: params.get('job') || 'all',
    client: params.get('client') || 'all',
    workContext: ['all', 'client', 'internal'].includes(params.get('workContext')) ? params.get('workContext') : 'all',
    groupBy: allowedGroups.has(groupValue) ? groupValue : 'team-member',
  };
}

function navigateTeamReportState(next) {
  const params = new URLSearchParams();
  params.set('range', next.range || TEAM_DEFAULT_RANGE);
  if (next.range === 'custom' && next.start && next.end) {
    params.set('start', next.start);
    params.set('end', next.end);
  }
  if (next.teamMembers?.length) params.set('teamMembers', next.teamMembers.join(','));
  if (next.serviceTypes?.length) params.set('serviceTypes', next.serviceTypes.join(','));
  if (next.job && next.job !== 'all') params.set('job', next.job);
  if (next.client && next.client !== 'all') params.set('client', next.client);
  if (next.workContext && next.workContext !== 'all') params.set('workContext', next.workContext);
  if (next.groupBy && next.groupBy !== 'team-member') params.set('groupBy', next.groupBy);
  navigate(`#/app/performance/reports/team?${params.toString()}`);
}

function resolveTeamReportRange(state, rows = []) {
  if (state.range === 'all') {
    const dates = rows.map((row) => row.dateObj).filter(Boolean).sort((a, b) => a - b);
    const fallback = new Date();
    const start = dates[0] || new Date(fallback.getFullYear(), fallback.getMonth(), 1);
    const end = dates[dates.length - 1] || endOfMonth(fallback);
    return { start, end, days: dayCount(start, end), isAllDates: true, label: 'All dates' };
  }
  if (state.range === 'custom' && state.start && state.end) {
    const start = parseISODate(state.start);
    const end = parseISODate(state.end);
    if (start && end && !isBeforeDay(end, start)) {
      return { start, end, days: dayCount(start, end), isAllDates: false, label: getTimeRangeLabel({ start, end }) };
    }
  }
  const preset = getTimePresetRange(state.range, new Date()) || getTimePresetRange(TEAM_DEFAULT_RANGE, new Date());
  return { ...preset, days: dayCount(preset.start, preset.end), isAllDates: false, label: getTimeRangeLabel(preset) };
}

function getTeamCapacityForRange(member, range) {
  const monthlyCapacity = Math.max(0, Number(member?.monthlyCapacityHours) || 0);
  if (!monthlyCapacity) return 0;
  if (range?.isAllDates) return monthlyCapacity;
  let capacity = 0;
  for (let d = new Date(range.start); d <= range.end; d.setDate(d.getDate() + 1)) {
    capacity += monthlyCapacity / endOfMonth(d).getDate();
  }
  return Math.round(capacity * 10) / 10;
}

function getTaskDueDate(task, deliverable) {
  if (task && Object.prototype.hasOwnProperty.call(task, 'dueAt')) return parseISODate(task.dueAt);
  return parseISODate(task?.dueDate) || parseISODate(deliverable?.due);
}

function getTimelineStatus(row, range) {
  if (!row.dueDate) return { label: 'No due date', type: 'no-due-date' };
  if (row.completedDate) {
    const lateDays = dayCount(row.dueDate, row.completedDate) - 1;
    return lateDays <= 0
      ? { label: 'On time', type: 'on-time' }
      : { label: `Late by ${lateDays} ${lateDays === 1 ? 'day' : 'days'}`, type: 'late' };
  }
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  if (isBeforeDay(row.dueDate, today)) {
    const lateDays = dayCount(row.dueDate, today) - 1;
    return { label: `Still open, ${lateDays} ${lateDays === 1 ? 'day' : 'days'} late`, type: 'still-open-late' };
  }
  if (!range?.isAllDates && isBeforeDay(range.end, row.dueDate)) {
    return { label: 'Not due yet', type: 'not-due-yet' };
  }
  const daysUntil = dayCount(today, row.dueDate) - 1;
  return { label: `Due in ${daysUntil} ${daysUntil === 1 ? 'day' : 'days'}`, type: 'due-soon' };
}

function buildTeamReportRows() {
  const ctx = buildTimeContext();
  return performanceTasks.map((task) => {
    if (!task?.assigneeId) return null;
    const assignedDate = parseISODate(task.assignedAt);
    if (!assignedDate) return null;
    const deliverable = task ? ctx.deliverableMap.get(task.deliverableId) : null;
    const job = deliverable ? ctx.jobMap.get(deliverable.jobId) : null;
    const memberId = task.assigneeId || 'unassigned';
    const member = ctx.teamMap.get(memberId);
    const serviceTypeId = task.serviceTypeId || resolveServiceTypeId({ entry: null, task, job, serviceTypeMaps: ctx.serviceTypeMaps }) || 'other';
    const serviceType = performanceServiceTypes.find((service) => service.id === serviceTypeId);
    const workContext = job ? 'client' : 'internal';
    const completedDate = task.completedAt ? parseISODate(task.completedAt) : null;
    const dueDate = getTaskDueDate(task, deliverable);
    const status = task.status || (completedDate ? 'completed' : 'in-progress');
    return {
      id: task.id,
      taskId: task.id,
      taskName: task.title || deliverable?.name || 'Assigned task',
      assignedDate,
      dateObj: assignedDate,
      assignedDateIso: formatISODate(assignedDate),
      completedDate,
      completedDateIso: completedDate ? formatISODate(completedDate) : '',
      dueDate,
      dueDateIso: dueDate ? formatISODate(dueDate) : '',
      teamMemberId: memberId,
      teamMemberName: getTimeReportMemberName(memberId, member),
      memberCapacityHours: Math.max(0, Number(member?.monthlyCapacityHours) || 0),
      jobId: job ? String(job.id) : 'internal',
      jobName: job?.name || 'Internal Work',
      company: job?.client || 'Internal',
      clientId: job?.client || 'Internal',
      serviceTypeId,
      serviceTypeName: getTimeServiceTypeLabel(serviceTypeId, serviceType),
      assignedHours: Math.max(0, Number(task.estimatedHours) || 0),
      loggedHours: 0,
      status,
      workContext,
    };
  }).filter(Boolean).sort((a, b) => b.assignedDate - a.assignedDate || a.teamMemberName.localeCompare(b.teamMemberName));
}

function buildTeamFilterOptions(rows) {
  return {
    teamMembers: uniqueOptions(rows, (row) => row.teamMemberId, (row) => row.teamMemberName),
    serviceTypes: uniqueOptions(rows, (row) => row.serviceTypeId, (row) => row.serviceTypeName),
    jobs: [{ value: 'all', label: 'All jobs' }, ...uniqueOptions(rows, (row) => row.jobId, (row) => row.jobName)],
    clients: [{ value: 'all', label: 'All clients' }, ...uniqueOptions(rows, (row) => row.clientId, (row) => row.company)],
  };
}

function filterTeamReportRows(rows, state, range) {
  return rows.filter((row) => {
    if (!range.isAllDates && (row.assignedDate < range.start || row.assignedDate > range.end)) return false;
    if (state.teamMembers.length && !state.teamMembers.includes(row.teamMemberId)) return false;
    if (state.serviceTypes.length && !state.serviceTypes.includes(row.serviceTypeId)) return false;
    if (state.job !== 'all' && row.jobId !== state.job) return false;
    if (state.client !== 'all' && row.clientId !== state.client) return false;
    if (state.workContext !== 'all' && row.workContext !== state.workContext) return false;
    return true;
  });
}

function getTeamTaskLoggedHours(taskId, assigneeId, range) {
  return performanceTimeEntries.reduce((sum, entry) => {
    if (entry.taskId !== taskId) return sum;
    const date = parseISODate(entry.date);
    if (!date) return sum;
    if (!range.isAllDates && (date < range.start || date > range.end)) return sum;
    const task = performanceTasks.find((item) => item.id === entry.taskId);
    const entryMemberId = entry.memberId || task?.assigneeId || '';
    if (entryMemberId !== assigneeId) return sum;
    return sum + Math.max(0, Number(entry.hours) || 0);
  }, 0);
}

function hydrateTeamLoggedHours(rows, range) {
  return rows.map((row) => {
    const timelineStatus = getTimelineStatus(row, range);
    const dueInRange = !!row.dueDate && (range.isAllDates || (row.dueDate >= range.start && row.dueDate <= range.end));
    return {
      ...row,
      loggedHours: getTeamTaskLoggedHours(row.taskId, row.teamMemberId, range),
      capacityHours: getTeamCapacityForRange({ monthlyCapacityHours: row.memberCapacityHours }, range),
      completedInRange: row.status === 'completed' && row.completedDate && (range.isAllDates || (row.completedDate >= range.start && row.completedDate <= range.end)),
      dueInRange,
      timelineStatus: timelineStatus.label,
      timelineStatusType: timelineStatus.type,
      completedOnTime: dueInRange && timelineStatus.type === 'on-time',
      lateOrStillOpen: timelineStatus.type === 'late' || timelineStatus.type === 'still-open-late',
    };
  });
}

function summarizeTeamRows(rows) {
  const assignedTasks = rows.length;
  const completedTasks = rows.filter((row) => row.completedInRange).length;
  const assignedHours = rows.reduce((sum, row) => sum + row.assignedHours, 0);
  const loggedHours = rows.reduce((sum, row) => sum + row.loggedHours, 0);
  const dueItems = rows.filter((row) => row.dueInRange).length;
  const completedOnTime = rows.filter((row) => row.completedOnTime).length;
  const lateStillOpen = rows.filter((row) => row.dueInRange && row.lateOrStillOpen).length;
  const completionRate = assignedTasks ? Math.round((completedTasks / assignedTasks) * 100) : null;
  const capacityByMember = new Map();
  rows.forEach((row) => {
    if (!row.teamMemberId || capacityByMember.has(row.teamMemberId)) return;
    capacityByMember.set(row.teamMemberId, row.capacityHours || 0);
  });
  const capacityHours = Array.from(capacityByMember.values()).reduce((sum, value) => sum + value, 0);
  return { assignedTasks, completedTasks, assignedHours, loggedHours, dueItems, completedOnTime, lateStillOpen, completionRate, capacityHours };
}

function formatCompletionSummary(summary) {
  if (!summary.assignedTasks) return '-';
  return `${summary.completedTasks} of ${summary.assignedTasks} completed`;
}

function getTeamGroupValue(row, groupBy) {
  if (groupBy === 'team-member') return { id: row.teamMemberId, title: row.teamMemberName };
  if (groupBy === 'service-type') return { id: row.serviceTypeId, title: row.serviceTypeName };
  if (groupBy === 'job') return { id: row.jobId, title: row.jobName };
  if (groupBy === 'client') return { id: row.clientId, title: row.company };
  return { id: 'all', title: 'All activity' };
}

function groupTeamRows(rows, groupBy) {
  const groups = new Map();
  rows.forEach((row) => {
    const value = getTeamGroupValue(row, groupBy);
    const group = groups.get(value.id) || { id: value.id, title: value.title, rows: [] };
    group.rows.push(row);
    groups.set(value.id, group);
  });
  return Array.from(groups.values())
    .filter((group) => group.rows.length > 0)
    .map((group) => ({ ...group, summary: summarizeTeamRows(group.rows) }))
    .sort((a, b) => b.summary.assignedTasks - a.summary.assignedTasks || a.title.localeCompare(b.title));
}

function TeamMetricCard({ title, value, subtext }) {
  return h('div', { className: 'rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-slate-900/80', 'data-demo': 'team-summary-card' }, [
    h('div', { className: 'text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400' }, title),
    h('div', { className: 'mt-2 text-2xl font-semibold text-slate-900 dark:text-white' }, value),
    subtext ? h('div', { className: 'mt-1 text-sm text-slate-600 dark:text-slate-300' }, subtext) : null,
  ]);
}

function TeamReportControls({ state, options, onChange, onExportCsv, onPrintFriendly }) {
  const patch = (next) => onChange({ ...state, ...next });
  return h('div', { className: 'rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-slate-900/80', 'data-demo': 'team-report-controls' }, [
    h('div', { className: 'flex flex-wrap items-end gap-3' }, [
      h(TimeDateRangeControl, { state, onChange: patch }),
      h(TimeMultiSelect, { label: 'Team Members', values: state.teamMembers, options: options.teamMembers, allLabel: 'All team members', onChange: (teamMembers) => patch({ teamMembers }) }),
      h(TimeMultiSelect, { label: 'Service Types', values: state.serviceTypes, options: options.serviceTypes, allLabel: 'All service types', onChange: (serviceTypes) => patch({ serviceTypes }) }),
      h(TimeSelectControl, { label: 'Jobs', value: state.job, options: options.jobs, onChange: (job) => patch({ job }) }),
      h(TimeSelectControl, { label: 'Clients', value: state.client, options: options.clients, onChange: (client) => patch({ client }) }),
      h(TimeSelectControl, { label: 'Work Context', value: state.workContext, options: TIME_WORK_CONTEXT_OPTIONS, onChange: (workContext) => patch({ workContext }), className: 'min-w-[150px]' }),
      h(TimeSelectControl, { label: 'Group By', value: state.groupBy, options: TEAM_GROUP_OPTIONS, onChange: (groupBy) => patch({ groupBy }), className: 'min-w-[160px]' }),
      h(TimeExportMenu, { onCsv: onExportCsv, onPrintFriendly }),
    ]),
  ]);
}

function TeamActiveFilters({ state, rangeLabel, options }) {
  const lookup = (list, value, fallback) => list.find((item) => item.value === value)?.label || fallback;
  const multiLabel = (list, values, allLabel) => {
    if (!values?.length) return allLabel;
    const labels = values.map((value) => lookup(list, value, value));
    return labels.length > 2 ? `${labels.slice(0, 2).join(', ')} +${labels.length - 2}` : labels.join(', ');
  };
  const chips = [
    `Date Range: ${rangeLabel}`,
    `Team Members: ${multiLabel(options.teamMembers, state.teamMembers, 'All team members')}`,
    `Service Types: ${multiLabel(options.serviceTypes, state.serviceTypes, 'All service types')}`,
    `Jobs: ${lookup(options.jobs, state.job, 'All jobs')}`,
    `Clients: ${lookup(options.clients, state.client, 'All clients')}`,
    `Work Context: ${lookup(TIME_WORK_CONTEXT_OPTIONS, state.workContext, 'All')}`,
    `Group By: ${lookup(TEAM_GROUP_OPTIONS, state.groupBy, 'Team Members')}`,
  ];
  return h('div', { className: 'flex flex-wrap gap-2 text-xs text-slate-600 dark:text-slate-300', 'data-demo': 'team-active-filters' },
    chips.map((chip) => h('span', { key: chip, className: 'rounded-full border border-slate-200 bg-white px-3 py-1 dark:border-white/10 dark:bg-slate-900' }, chip))
  );
}

function TeamPerformanceByMember({ rows }) {
  const groups = groupTeamRows(rows, 'team-member');
  return h('div', { className: 'rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-slate-900/80', 'data-demo': 'team-performance-by-member' }, [
    h('div', { className: 'flex flex-wrap items-end justify-between gap-3' }, [
      h('div', { className: 'space-y-1' }, [
        h('h3', { className: 'text-base font-semibold text-slate-900 dark:text-white' }, 'Team Performance by Team Member'),
        h('p', { className: 'text-xs text-slate-500 dark:text-slate-400' }, 'Effort and timeline context during the selected date range.'),
      ]),
    ]),
    groups.length
      ? h('div', { className: 'mt-5 overflow-hidden rounded-lg border border-slate-200 dark:border-white/10' }, [
          h('div', { className: 'grid grid-cols-[minmax(150px,1.2fr)_repeat(6,minmax(88px,0.75fr))] gap-3 bg-slate-50 px-4 py-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:bg-slate-950/50 dark:text-slate-400' }, [
            h('div', null, 'Team Member'),
            h('div', { className: 'text-right' }, 'Capacity'),
            h('div', { className: 'text-right' }, 'Assigned'),
            h('div', { className: 'text-right' }, 'Logged'),
            h('div', { className: 'text-right' }, 'Due Items'),
            h('div', { className: 'text-right' }, 'On Time'),
            h('div', { className: 'text-right' }, 'Late / Open'),
          ]),
          h('div', { className: 'divide-y divide-slate-100 dark:divide-white/5' }, groups.map((group) =>
            h('div', { key: group.id, className: 'grid grid-cols-[minmax(150px,1.2fr)_repeat(6,minmax(88px,0.75fr))] items-center gap-3 px-4 py-3 text-sm' }, [
              h('div', { className: 'truncate font-semibold text-slate-900 dark:text-white', title: group.title }, group.title),
              h('div', { className: 'text-right tabular-nums text-slate-600 dark:text-slate-300' }, formatTimeDurationHours(group.summary.capacityHours)),
              h('div', { className: 'text-right tabular-nums text-slate-600 dark:text-slate-300' }, formatTimeDurationHours(group.summary.assignedHours)),
              h('div', { className: 'text-right tabular-nums text-slate-600 dark:text-slate-300' }, formatTimeDurationHours(group.summary.loggedHours)),
              h('div', { className: 'text-right tabular-nums text-slate-600 dark:text-slate-300' }, group.summary.dueItems),
              h('div', { className: 'text-right tabular-nums text-slate-600 dark:text-slate-300' }, group.summary.completedOnTime),
              h('div', { className: 'text-right tabular-nums text-slate-600 dark:text-slate-300' }, group.summary.lateStillOpen),
            ]),
          )),
        ])
      : h('div', { className: 'mt-5 rounded-lg border border-dashed border-slate-200 p-6 text-sm text-slate-500 dark:border-white/10 dark:text-slate-400' }, 'No assigned work for these filters.'),
  ]);
}

function TeamActivityRows({ rows }) {
  const headerCellClass = 'min-w-0 leading-4';
  const cellClass = 'min-w-0';
  return h('div', { className: 'min-w-0' }, [
    h('div', {
      className: 'grid w-full min-w-0 gap-3 border-b border-slate-100 px-4 py-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:border-white/5 dark:text-slate-400 lg:gap-4 lg:px-5',
      style: { gridTemplateColumns: TEAM_TABLE_COLUMNS },
    }, [
      h('div', { className: headerCellClass }, 'Task'),
      h('div', { className: headerCellClass }, 'Job'),
      h('div', { className: headerCellClass }, 'Company'),
      h('div', { className: headerCellClass }, 'Service Type'),
      h('div', { className: `${headerCellClass} text-right` }, 'Assigned Hours'),
      h('div', { className: `${headerCellClass} text-right` }, 'Logged Hours'),
      h('div', { className: headerCellClass }, 'Due Date'),
      h('div', { className: headerCellClass }, 'Completed Date'),
      h('div', { className: headerCellClass }, 'Timeline Status'),
    ]),
    h('div', { className: 'divide-y divide-slate-100 dark:divide-white/5' }, rows.map((row) =>
      h('div', {
        key: row.id,
        className: 'grid w-full min-w-0 items-start gap-3 px-4 py-3 text-sm lg:gap-4 lg:px-5',
        style: { gridTemplateColumns: TEAM_TABLE_COLUMNS },
        'data-demo': 'team-report-activity-row',
      }, [
        h('div', { className: `${cellClass} font-semibold leading-5 text-slate-900 dark:text-white`, style: { maxHeight: '40px', overflow: 'hidden' }, title: row.taskName }, row.taskName),
        h('div', { className: `${cellClass} truncate text-slate-600 dark:text-slate-300`, title: row.jobName }, row.jobName),
        h('div', { className: `${cellClass} truncate text-slate-600 dark:text-slate-300`, title: row.company }, row.company),
        h('div', { className: cellClass },
          h('span', { className: 'inline-flex max-w-full min-w-0 rounded-md bg-slate-100 px-2 py-1 text-xs font-medium text-slate-700 dark:bg-slate-800 dark:text-slate-200', title: row.serviceTypeName },
            h('span', { className: 'min-w-0 truncate' }, row.serviceTypeName)
          )
        ),
        h('div', { className: 'text-right font-semibold tabular-nums text-slate-900 dark:text-white' }, formatTimeDurationHours(row.assignedHours)),
        h('div', { className: 'text-right font-semibold tabular-nums text-slate-900 dark:text-white' }, formatTimeDurationHours(row.loggedHours)),
        h('div', { className: `${cellClass} text-slate-600 dark:text-slate-300` }, row.dueDate ? formatTimeReportDate(row.dueDate, { includeYear: true }) : '-'),
        h('div', { className: `${cellClass} text-slate-600 dark:text-slate-300` }, row.completedDate ? formatTimeReportDate(row.completedDate, { includeYear: true }) : '-'),
        h('div', { className: `${cellClass} text-slate-600 dark:text-slate-300` }, row.timelineStatus),
      ])
    )),
  ]);
}

function TeamActivitySection({ group, groupBy, collapsed, onToggleGroup, children }) {
  if (groupBy === 'none') return children;
  return h('section', { className: 'overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-white/10 dark:bg-slate-900/80', 'data-demo': 'team-report-group' }, [
    h('button', {
      type: 'button',
      className: 'flex w-full items-center justify-between gap-3 bg-slate-50 px-5 py-3 text-left dark:bg-slate-950/50',
      onClick: onToggleGroup,
    }, [
      h('div', { className: 'space-y-0.5' }, [
        h('div', { className: 'text-sm font-semibold text-slate-900 dark:text-white' }, group.title),
        h('div', { className: 'text-xs text-slate-500 dark:text-slate-400' }, `${group.summary.dueItems} due • ${group.summary.completedOnTime} on time • ${group.summary.lateStillOpen} late / open`),
      ]),
      h('div', { className: 'flex flex-wrap items-center justify-end gap-3 text-xs text-slate-500 dark:text-slate-400' }, [
        groupBy === 'team-member' ? h('span', null, `${formatTimeDurationHours(group.summary.capacityHours)} capacity`) : null,
        h('span', null, `${formatTimeDurationHours(group.summary.assignedHours)} assigned`),
        h('span', null, `${formatTimeDurationHours(group.summary.loggedHours)} logged`),
        h('span', { className: 'text-slate-400' }, collapsed ? '▸' : '▾'),
      ]),
    ]),
    collapsed ? null : children,
  ]);
}

function TeamReport({ queryString, printFriendly = false, onPrintFriendly }) {
  const [state, setState] = useState(() => parseTeamReportState(queryString));
  const [collapsedGroups, setCollapsedGroups] = useState(() => new Set());
  useEffect(() => {
    setState(parseTeamReportState(queryString));
  }, [queryString]);
  useEffect(() => {
    setCollapsedGroups(new Set());
  }, [state.groupBy]);

  const allRows = useMemo(() => buildTeamReportRows(), []);
  const range = useMemo(() => resolveTeamReportRange(state, allRows), [state, allRows]);
  const filteredRows = useMemo(() => hydrateTeamLoggedHours(filterTeamReportRows(allRows, state, range), range), [allRows, state, range]);
  const options = useMemo(() => buildTeamFilterOptions(allRows), [allRows]);
  const rangeLabel = getTimeRangeLabel(range);
  const groupedRows = useMemo(() => groupTeamRows(filteredRows, state.groupBy), [filteredRows, state.groupBy]);
  const summary = useMemo(() => summarizeTeamRows(filteredRows), [filteredRows]);

  const applyState = (next) => {
    setState(next);
    navigateTeamReportState(next);
  };

  const exportCsv = () => {
    const groupLookup = new Map();
    groupedRows.forEach((group) => group.rows.forEach((row) => groupLookup.set(row.id, group.title)));
    const baseHeader = ['Team Member', 'Task', 'Job', 'Company', 'Service Type', 'Assigned Hours', 'Logged Hours', 'Due Date', 'Completed Date', 'Timeline Status'];
    const rows = [
      ['Group', ...baseHeader],
      ...filteredRows.map((row) => {
        const values = [
          row.teamMemberName,
          row.taskName,
          row.jobName,
          row.company,
          row.serviceTypeName,
          row.assignedHours.toFixed(2).replace(/\.?0+$/, ''),
          row.loggedHours.toFixed(2).replace(/\.?0+$/, ''),
          row.dueDateIso,
          row.completedDateIso,
          row.timelineStatus,
        ];
        return [groupLookup.get(row.id) || '', ...values];
      }),
    ];
    downloadCsv(`team-report-${formatISODate(range.start)}-${formatISODate(range.end)}.csv`, rows);
  };

  return h('div', { className: 'space-y-6' }, [
    h('div', { className: 'space-y-3' }, [
      h('div', { className: 'flex flex-wrap items-end justify-between gap-3' }, [
        h('div', { className: 'space-y-1' }, [
          h('h2', { className: 'text-2xl font-semibold text-slate-900 dark:text-white' }, 'Team Report'),
          h('p', { className: 'text-sm text-slate-600 dark:text-slate-300' }, 'Assigned effort, logged effort, due work, and on-time completion by Team Member.'),
          h('p', { className: 'text-sm text-slate-600 dark:text-slate-300', 'data-demo': 'team-selected-date-range' }, rangeLabel),
        ]),
        h('span', { className: 'text-sm text-slate-500 dark:text-slate-400' }, `${filteredRows.length} assigned tasks`),
      ]),
      h(TeamActiveFilters, { state, rangeLabel, options }),
    ]),
    printFriendly ? null : h(TeamReportControls, {
      state,
      options,
      onChange: applyState,
      onExportCsv: exportCsv,
      onPrintFriendly,
    }),
    h('div', { className: 'grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4', 'data-demo': 'team-summary-cards' }, [
      h(TeamMetricCard, { title: 'Assigned Hours', value: formatTimeDurationHours(summary.assignedHours), subtext: 'Assigned task LOE' }),
      h(TeamMetricCard, { title: 'Logged Hours', value: formatTimeDurationHours(summary.loggedHours), subtext: 'Logged against assigned tasks' }),
      h(TeamMetricCard, { title: 'Due Items', value: String(summary.dueItems), subtext: 'Assigned work due in range' }),
      h(TeamMetricCard, { title: 'Completed On Time', value: String(summary.completedOnTime), subtext: `${summary.completedOnTime} of ${summary.dueItems} due items` }),
    ]),
    h(TeamPerformanceByMember, { rows: filteredRows }),
    h('div', { className: 'rounded-xl border border-slate-200 bg-white shadow-sm dark:border-white/10 dark:bg-slate-900/80', 'data-demo': 'team-report-activity' }, [
      h('div', { className: 'flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-4 dark:border-white/5' }, [
        h('div', { className: 'space-y-1' }, [
          h('h3', { className: 'text-lg font-semibold text-slate-900 dark:text-white' }, 'Team Member Detail'),
          h('p', { className: 'text-sm text-slate-600 dark:text-slate-300' }, 'Assigned work, logged hours, due items, and on-time completion for the selected date range.'),
        ]),
        h('span', { className: 'text-sm text-slate-500 dark:text-slate-400' }, `${filteredRows.length} assigned tasks`),
      ]),
      filteredRows.length
        ? h('div', { className: 'space-y-4 p-4' }, groupedRows.map((group) => {
            const collapsed = collapsedGroups.has(group.id);
            return h(TeamActivitySection, {
              key: group.id,
              group,
              groupBy: state.groupBy,
              collapsed,
              onToggleGroup: () => setCollapsedGroups((current) => {
                const next = new Set(current);
                if (next.has(group.id)) next.delete(group.id);
                else next.add(group.id);
                return next;
              }),
            }, h(TeamActivityRows, { rows: group.rows }));
          }))
        : h('div', { className: 'p-5 text-sm text-slate-600 dark:text-slate-300' }, 'No assigned work matches these filters.'),
    ]),
  ]);
}

const LEGACY_SALES_STATUS_LABELS = {
  open: 'Open',
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
    if (groupBy === 'deliverable-type') return LEGACY_SALES_STATUS_LABELS[deal.status] || 'Other';
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
            ? 'Status'
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
    view === 'revenue-focus'
      ? h('div', { className: 'rounded-lg border border-amber-200 dark:border-amber-300/30 bg-amber-50 dark:bg-amber-900/20 px-4 py-3 text-sm text-amber-800 dark:text-amber-100' },
          'Revenue focus for selected Opportunities.')
      : null,
    h('div', { className: 'rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-slate-900/60 lg:p-6', 'data-demo': 'sales-report-snapshot' }, [
      h('div', { className: 'flex items-start justify-between gap-4' }, [
        h('div', null, [
          h('div', { className: 'text-sm font-semibold text-slate-900 dark:text-white' }, 'Sales Report Snapshot'),
          h('div', { className: 'mt-1 text-xs text-slate-500 dark:text-white/50' }, 'Booked outcomes in the selected date range.'),
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
          title: 'Open value',
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
              const stageLabel = LEGACY_SALES_STATUS_LABELS[deal?.status] || 'Open';
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

const SALES_DEFAULT_RANGE = 'this-month';
const SALES_STATUS_OPTIONS = [
  { value: 'all', label: 'All' },
  { value: 'open', label: 'Open' },
  { value: 'won', label: 'Won' },
  { value: 'lost', label: 'Lost' },
  { value: 'on-hold', label: 'On Hold' },
];
const SALES_TYPE_OPTIONS = [
  { value: 'all', label: 'All' },
  { value: 'project', label: 'Projects' },
  { value: 'retainer', label: 'Retainers' },
  { value: 'both', label: 'Both' },
];
const SALES_LINKED_JOB_OPTIONS = [
  { value: 'all', label: 'All' },
  { value: 'no-linked', label: 'No linked Job' },
  { value: 'has-linked', label: 'Has linked Job' },
  { value: 'linked-active', label: 'Linked Job active' },
  { value: 'linked-pending', label: 'Linked Job pending' },
];
const SALES_STATUS_LABELS = {
  open: 'Open',
  won: 'Won',
  lost: 'Lost',
  'on-hold': 'On Hold',
};
const SALES_TYPE_LABELS = {
  project: 'Projects',
  retainer: 'Retainers',
  both: 'Both',
};
function parseSalesReportState(queryString = '') {
  const params = new URLSearchParams(queryString);
  const allowedRanges = new Set(TIME_RANGE_OPTIONS.map((option) => option.value));
  const range = params.get('range') || SALES_DEFAULT_RANGE;
  const status = params.get('status') || 'all';
  const type = params.get('type') || 'all';
  const linkedJob = params.get('linkedJob') || 'all';
  return {
    range: allowedRanges.has(range) ? range : SALES_DEFAULT_RANGE,
    start: params.get('start') || '',
    end: params.get('end') || '',
    status: SALES_STATUS_OPTIONS.some((option) => option.value === status) ? status : 'all',
    type: SALES_TYPE_OPTIONS.some((option) => option.value === type) ? type : 'all',
    owner: params.get('owner') || 'all',
    company: params.get('company') || 'all',
    linkedJob: SALES_LINKED_JOB_OPTIONS.some((option) => option.value === linkedJob) ? linkedJob : 'all',
  };
}

function navigateSalesReportState(next) {
  const params = new URLSearchParams();
  params.set('range', next.range || SALES_DEFAULT_RANGE);
  if (next.range === 'custom' && next.start && next.end) {
    params.set('start', next.start);
    params.set('end', next.end);
  }
  if (next.status && next.status !== 'all') params.set('status', next.status);
  if (next.type && next.type !== 'all') params.set('type', next.type);
  if (next.owner && next.owner !== 'all') params.set('owner', next.owner);
  if (next.company && next.company !== 'all') params.set('company', next.company);
  if (next.linkedJob && next.linkedJob !== 'all') params.set('linkedJob', next.linkedJob);
  navigate(`#/app/performance/reports/sales?${params.toString()}`);
}

function resolveSalesRange(state, opportunities) {
  if (state.range === 'all') {
    const dates = opportunities
      .flatMap((row) => [row.createdAtObj, row.closedAtObj, ...row.activityDates])
      .filter(Boolean)
      .sort((a, b) => a - b);
    const fallback = new Date();
    const start = dates[0] || new Date(fallback.getFullYear(), fallback.getMonth(), 1);
    const end = dates[dates.length - 1] || endOfMonth(fallback);
    return { start, end, days: dayCount(start, end), isAllDates: true, label: 'All dates' };
  }
  if (state.range === 'custom' && state.start && state.end) {
    const start = parseISODate(state.start);
    const end = parseISODate(state.end);
    if (start && end && !isBeforeDay(end, start)) {
      return { start, end, days: dayCount(start, end), isAllDates: false, label: getTimeRangeLabel({ start, end }) };
    }
  }
  const preset = getTimePresetRange(state.range, new Date()) || getTimePresetRange(SALES_DEFAULT_RANGE, new Date());
  return { ...preset, days: dayCount(preset.start, preset.end), isAllDates: false, label: getTimeRangeLabel(preset) };
}

function getSalesOwnerName(ownerId) {
  return TIME_REPORT_MEMBER_NAMES[ownerId] || 'Unassigned';
}

function getSalesLinkedJobLabel(opportunity) {
  const linkedJobs = Array.isArray(opportunity.linkedJobs) ? opportunity.linkedJobs : [];
  if (!linkedJobs.length) return 'No linked Job';
  if (linkedJobs.length > 1) return 'Multiple linked Jobs';
  const job = linkedJobs[0];
  const status = job.status === 'active' ? 'active' : job.status === 'pending' ? 'pending' : job.status || 'linked';
  return `${job.name || 'Linked Job'} (${status})`;
}

function getSalesLinkedJobReadiness(opportunity) {
  const linkedJobs = Array.isArray(opportunity.linkedJobs) ? opportunity.linkedJobs : [];
  if (!linkedJobs.length) return 'no-linked';
  if (linkedJobs.some((job) => job.status === 'active')) return 'linked-active';
  if (linkedJobs.some((job) => job.status === 'pending')) return 'linked-pending';
  return 'has-linked';
}

function normalizeSalesOpportunities() {
  const activityMap = new Map();
  (performanceSalesActivities || []).forEach((activity) => {
    if (!activityMap.has(activity.dealId)) activityMap.set(activity.dealId, []);
    activityMap.get(activity.dealId).push(activity);
  });
  return (performanceSalesDeals || []).map((deal) => {
    const value = Number(deal.value ?? deal.amount ?? 0);
    const linkedJobs = Array.isArray(deal.linkedJobs) ? deal.linkedJobs : [];
    const activities = activityMap.get(deal.id) || [];
    return {
      ...deal,
      value,
      linkedJobs,
      activities,
      createdAtObj: parseISODate(deal.createdAt),
      closedAtObj: parseISODate(deal.closedAt),
      activityDates: activities.map((activity) => parseISODate(activity.date)).filter(Boolean),
      status: deal.status || 'open',
      opportunityType: deal.opportunityType || 'project',
      ownerName: getSalesOwnerName(deal.ownerId),
      linkedJobLabel: getSalesLinkedJobLabel({ ...deal, linkedJobs }),
      linkedJobReadiness: getSalesLinkedJobReadiness({ ...deal, linkedJobs }),
    };
  });
}

function salesOpportunityTouchedInRange(opportunity, range) {
  return isDateInRange(opportunity.createdAt, range) ||
    isDateInRange(opportunity.closedAt, range) ||
    opportunity.activities.some((activity) => isDateInRange(activity.date, range));
}

function salesOpportunityMatchesFilters(opportunity, state) {
  if (state.status !== 'all' && opportunity.status !== state.status) return false;
  if (state.type !== 'all' && opportunity.opportunityType !== state.type) return false;
  if (state.owner !== 'all' && opportunity.ownerId !== state.owner) return false;
  if (state.company !== 'all' && opportunity.client !== state.company) return false;
  if (state.linkedJob === 'no-linked' && opportunity.linkedJobReadiness !== 'no-linked') return false;
  if (state.linkedJob === 'has-linked' && opportunity.linkedJobReadiness === 'no-linked') return false;
  if (state.linkedJob === 'linked-active' && opportunity.linkedJobReadiness !== 'linked-active') return false;
  if (state.linkedJob === 'linked-pending' && opportunity.linkedJobReadiness !== 'linked-pending') return false;
  return true;
}

function buildSalesOptions(opportunities) {
  return {
    owners: [
      { value: 'all', label: 'All owners' },
      ...uniqueOptions(opportunities, (row) => row.ownerId, (row) => row.ownerName),
    ],
    companies: [
      { value: 'all', label: 'All companies' },
      ...uniqueOptions(opportunities, (row) => row.client, (row) => row.client),
    ],
  };
}

function buildSalesActivityRows(opportunities, state, range) {
  const rows = [];
  opportunities.forEach((opportunity) => {
    if (!salesOpportunityMatchesFilters(opportunity, state)) return;
    opportunity.activities.forEach((activity) => {
      if (!isDateInRange(activity.date, range)) return;
      rows.push({
        id: activity.id,
        opportunity,
        activity,
        dateObj: parseISODate(activity.date),
      });
    });
  });
  return rows.sort((a, b) => (b.dateObj?.getTime() || 0) - (a.dateObj?.getTime() || 0));
}

function buildSalesDistribution(opportunities, title, keyFn, { valueMode = false } = {}) {
  const totals = new Map();
  opportunities.forEach((opportunity) => {
    const label = keyFn(opportunity);
    const amount = valueMode ? opportunity.value : 1;
    totals.set(label, (totals.get(label) || 0) + amount);
  });
  const rows = Array.from(totals.entries())
    .map(([label, value]) => ({ label, value }))
    .filter((row) => row.value > 0)
    .sort((a, b) => b.value - a.value);
  const total = rows.reduce((sum, row) => sum + row.value, 0) || 1;
  return {
    title,
    valueMode,
    items: rows.map((row, idx) => ({
      ...row,
      percent: Math.round((row.value / total) * 100),
      color: REPORT_COLORS[idx % REPORT_COLORS.length],
    })),
  };
}

function buildSalesWonByDate(opportunities, range) {
  if (range.isAllDates || range.days > 45) {
    const totals = new Map();
    opportunities.forEach((opportunity) => {
      if (opportunity.status !== 'won' || !opportunity.closedAtObj || !isDateInRange(opportunity.closedAt, range)) return;
      const key = `${opportunity.closedAtObj.getFullYear()}-${String(opportunity.closedAtObj.getMonth() + 1).padStart(2, '0')}`;
      const label = opportunity.closedAtObj.toLocaleDateString(undefined, { month: 'short', year: 'numeric' });
      const existing = totals.get(key) || { key, label, value: 0, count: 0 };
      existing.value += opportunity.value;
      existing.count += 1;
      totals.set(key, existing);
    });
    return Array.from(totals.values()).sort((a, b) => a.key.localeCompare(b.key));
  }
  const days = [];
  for (let d = new Date(range.start); d <= range.end; d.setDate(d.getDate() + 1)) {
    days.push({ key: formatISODate(d), label: d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }), value: 0, count: 0 });
  }
  const index = new Map(days.map((day) => [day.key, day]));
  opportunities.forEach((opportunity) => {
    if (opportunity.status !== 'won' || !opportunity.closedAt || !isDateInRange(opportunity.closedAt, range)) return;
    const day = index.get(opportunity.closedAt);
    if (!day) return;
    day.value += opportunity.value;
    day.count += 1;
  });
  return days;
}

function SalesReportControls({ state, options, onChange, onExportCsv, onPrintFriendly }) {
  const patch = (next) => onChange({ ...state, ...next });
  return h('div', { className: 'rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-slate-900/80', 'data-demo': 'sales-report-controls' }, [
    h('div', { className: 'flex flex-wrap items-end gap-3' }, [
      h(TimeDateRangeControl, { state, onChange: patch }),
      h(TimeSelectControl, { label: 'Opportunity Status', value: state.status, options: SALES_STATUS_OPTIONS, onChange: (status) => patch({ status }), className: 'min-w-[180px]' }),
      h(TimeSelectControl, { label: 'Opportunity Type', value: state.type, options: SALES_TYPE_OPTIONS, onChange: (type) => patch({ type }), className: 'min-w-[170px]' }),
      h(TimeSelectControl, { label: 'Owner', value: state.owner, options: options.owners, onChange: (owner) => patch({ owner }), className: 'min-w-[170px]' }),
      h(TimeSelectControl, { label: 'Company', value: state.company, options: options.companies, onChange: (company) => patch({ company }), className: 'min-w-[190px]' }),
      h(TimeSelectControl, { label: 'Linked Job Status', value: state.linkedJob, options: SALES_LINKED_JOB_OPTIONS, onChange: (linkedJob) => patch({ linkedJob }), className: 'min-w-[190px]' }),
      h(TimeExportMenu, { onCsv: onExportCsv, onPrintFriendly }),
    ]),
  ]);
}

function SalesActiveFilters({ state, rangeLabel, options }) {
  const lookup = (list, value, fallback) => list.find((item) => item.value === value)?.label || fallback;
  const chips = [
    `Date Range: ${rangeLabel}`,
    `Opportunity Status: ${lookup(SALES_STATUS_OPTIONS, state.status, 'All')}`,
    `Opportunity Type: ${lookup(SALES_TYPE_OPTIONS, state.type, 'All')}`,
    `Owner: ${lookup(options.owners, state.owner, 'All owners')}`,
    `Company: ${lookup(options.companies, state.company, 'All companies')}`,
    `Linked Job Status: ${lookup(SALES_LINKED_JOB_OPTIONS, state.linkedJob, 'All')}`,
  ];
  return h('div', { className: 'flex flex-wrap gap-2', 'data-demo': 'sales-active-filters' },
    chips.map((chip) => h('span', {
      key: chip,
      className: 'rounded-full border border-slate-200 bg-white px-3 py-1 text-xs text-slate-600 shadow-sm dark:border-white/10 dark:bg-slate-900/70 dark:text-slate-300',
    }, chip))
  );
}

function SalesMixCard({ title, items, valueMode = false }) {
  const total = items.reduce((sum, item) => sum + item.value, 0);
  return h('div', { className: 'rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-slate-900/80', 'data-demo': 'sales-mix-card' }, [
    h('div', { className: 'flex items-center justify-between gap-3' }, [
      h('h3', { className: 'text-sm font-semibold text-slate-900 dark:text-white' }, title),
      h('span', { className: 'text-xs text-slate-500 dark:text-slate-400' }, valueMode ? formatCurrency(total, { compact: true }) : `${total} total`),
    ]),
    items.length
      ? h('div', { className: 'mt-4 space-y-3' }, items.map((item) => h('div', { key: item.label, className: 'space-y-1.5' }, [
          h('div', { className: 'flex items-center justify-between gap-3 text-xs' }, [
            h('div', { className: 'flex min-w-0 items-center gap-2' }, [
              h('span', { className: 'h-2.5 w-2.5 rounded-full', style: { background: item.color } }),
              h('span', { className: 'truncate font-medium text-slate-700 dark:text-slate-200' }, item.label),
            ]),
            h('span', { className: 'flex-none text-slate-500 dark:text-slate-400' }, valueMode ? formatCurrency(item.value, { compact: true }) : `${item.value}`),
          ]),
          h('div', { className: 'h-2 overflow-hidden rounded-sm bg-slate-100 dark:bg-white/10' }, [
            h('div', { className: 'h-full rounded-sm', style: { width: `${item.percent}%`, background: item.color } }),
          ]),
          h('div', { className: 'text-right text-[11px] text-slate-400 dark:text-slate-500' }, `${item.percent}%`),
        ])))
      : h('div', { className: 'mt-4 rounded-lg border border-dashed border-slate-200 px-3 py-5 text-sm text-slate-500 dark:border-white/10 dark:text-slate-400' }, 'No matching opportunities.'),
  ]);
}

function SalesWonValueChart({ rows }) {
  const max = Math.max(...rows.map((row) => row.value), 1);
  const total = rows.reduce((sum, row) => sum + row.value, 0);
  return h('div', { className: 'rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-slate-900/80', 'data-demo': 'sales-won-value-chart' }, [
    h('div', { className: 'flex items-center justify-between gap-3' }, [
      h('div', { className: 'space-y-1' }, [
        h('h3', { className: 'text-sm font-semibold text-slate-900 dark:text-white' }, 'Won by Date'),
        h('p', { className: 'text-xs text-slate-500 dark:text-slate-400' }, 'Won Opportunities in the selected date range.'),
      ]),
      h('span', { className: 'text-xs font-semibold text-slate-600 dark:text-slate-300' }, `${formatCurrency(total, { compact: true })} total`),
    ]),
    h('div', {
      className: 'mt-4 grid min-h-28 gap-1 rounded-lg border border-slate-200 bg-slate-50 p-2 dark:border-white/10 dark:bg-white/5',
      style: { gridTemplateColumns: `repeat(${Math.max(rows.length, 1)}, minmax(0, 1fr))` },
    }, rows.map((row) => {
      const height = row.value ? Math.max(8, Math.round((row.value / max) * 100)) : 0;
      return h('div', { key: row.key, className: 'flex min-w-0 flex-col items-center justify-end gap-1', title: `${row.label}: ${formatCurrency(row.value)}${row.count ? `, ${row.count} won` : ''}` }, [
        h('div', { className: 'min-h-[16px] text-center text-[10px] font-semibold text-slate-700 dark:text-slate-200' }, row.value ? formatCurrency(row.value, { compact: true }) : ''),
        h('div', {
          className: 'w-full rounded-sm bg-netnet-purple',
          style: { height: `${height}%`, opacity: row.value ? 1 : 0.12 },
        }),
        h('div', { className: 'w-full truncate text-center text-[10px] text-slate-500 dark:text-slate-400' }, row.label),
      ]);
    })),
  ]);
}

function SalesStatusChip({ status }) {
  const classes = {
    open: 'border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-300/20 dark:bg-blue-500/10 dark:text-blue-200',
    won: 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-300/20 dark:bg-emerald-500/10 dark:text-emerald-200',
    lost: 'border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-300/20 dark:bg-rose-500/10 dark:text-rose-200',
    'on-hold': 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-300/20 dark:bg-amber-500/10 dark:text-amber-200',
  };
  return h('span', { className: `inline-flex rounded-full border px-2 py-0.5 text-xs font-semibold ${classes[status] || classes.open}` }, SALES_STATUS_LABELS[status] || 'Open');
}

function getSalesJobHref(job) {
  if (!job) return '';
  if (job.href) return job.href;
  const status = String(job.status || '').toLowerCase();
  const tab = status === 'pending' ? 'plan' : 'tasks';
  return job.id ? `#/app/jobs/${job.id}/${tab}` : '';
}

function SalesLinkedJobCell({ opportunity }) {
  const linkedJobs = Array.isArray(opportunity.linkedJobs) ? opportunity.linkedJobs : [];
  if (!linkedJobs.length) return h('span', null, 'No linked Job');
  const renderLink = (job, index) => {
    const href = getSalesJobHref(job);
    const label = job.name || 'Linked Job';
    const status = job.status ? ` (${job.status})` : '';
    return h('button', {
      key: job.id || `${label}-${index}`,
      type: 'button',
      className: 'text-left font-semibold text-[var(--color-brand-purple,#711FFF)] hover:underline',
      onClick: () => href && navigate(href),
      disabled: !href,
      title: href || label,
    }, `${label}${status}`);
  };
  return h('div', { className: 'space-y-1' }, linkedJobs.map(renderLink));
}

function SalesActivityTable({ rows }) {
  const headerClass = 'px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400';
  const cellClass = 'px-3 py-3 text-sm text-slate-700 dark:text-slate-200';
  return h('div', { className: 'overflow-x-auto' }, [
    h('table', { className: 'min-w-[980px] w-full border-collapse' }, [
      h('thead', { className: 'bg-slate-50 dark:bg-white/5' }, [
        h('tr', null, ['Opportunity', 'Company', 'Owner', 'Type', 'Status', 'Linked Job', 'Date', 'Value'].map((label) =>
          h('th', { key: label, className: headerClass }, label)
        )),
      ]),
      h('tbody', { className: 'divide-y divide-slate-100 dark:divide-white/10' }, rows.map((row) => {
        const opportunity = row.opportunity;
        return h('tr', { key: row.id, 'data-demo': 'sales-activity-row' }, [
          h('td', { className: `${cellClass} font-semibold text-slate-900 dark:text-white` }, [
            h('div', null, opportunity.name || 'Opportunity'),
            h('div', { className: 'mt-1 text-xs font-normal text-slate-500 dark:text-slate-400' }, row.activity.type),
          ]),
          h('td', { className: cellClass }, opportunity.client || 'Unknown'),
          h('td', { className: cellClass }, opportunity.ownerName),
          h('td', { className: cellClass }, SALES_TYPE_LABELS[opportunity.opportunityType] || 'Projects'),
          h('td', { className: cellClass }, h(SalesStatusChip, { status: opportunity.status })),
          h('td', { className: `${cellClass} max-w-[240px]` }, h(SalesLinkedJobCell, { opportunity })),
          h('td', { className: cellClass }, formatTimeReportDate(row.dateObj, { includeYear: true })),
          h('td', { className: `${cellClass} font-semibold text-slate-900 dark:text-white` }, formatCurrency(opportunity.value, { compact: true })),
        ]);
      })),
    ]),
  ]);
}

function SalesOpportunityReport({ queryString, printFriendly, onPrintFriendly }) {
  const [state, setState] = useState(() => parseSalesReportState(queryString));
  useEffect(() => {
    setState(parseSalesReportState(queryString));
  }, [queryString]);

  const opportunities = useMemo(() => normalizeSalesOpportunities(), []);
  const range = useMemo(() => resolveSalesRange(state, opportunities), [state.range, state.start, state.end, opportunities]);
  const options = useMemo(() => buildSalesOptions(opportunities), [opportunities]);
  const filteredOpportunities = useMemo(() => opportunities.filter((opportunity) =>
    salesOpportunityMatchesFilters(opportunity, state) && salesOpportunityTouchedInRange(opportunity, range)
  ), [opportunities, state, range.start.getTime(), range.end.getTime(), range.isAllDates]);
  const activityRows = useMemo(() => buildSalesActivityRows(opportunities, state, range), [opportunities, state, range.start.getTime(), range.end.getTime(), range.isAllDates]);

  const newOpportunities = filteredOpportunities.filter((opportunity) => isDateInRange(opportunity.createdAt, range)).length;
  const openOpportunities = filteredOpportunities.filter((opportunity) => opportunity.status === 'open');
  const wonOpportunities = filteredOpportunities.filter((opportunity) => opportunity.status === 'won');
  const openValue = openOpportunities.reduce((sum, opportunity) => sum + opportunity.value, 0);
  const wonValue = wonOpportunities.reduce((sum, opportunity) => sum + opportunity.value, 0);
  const linkedOpportunityCount = filteredOpportunities.filter((opportunity) => opportunity.linkedJobs.length).length;

  const mixCards = useMemo(() => [
    buildSalesDistribution(filteredOpportunities, 'Opportunity Status Mix', (row) => SALES_STATUS_LABELS[row.status] || 'Open'),
    buildSalesDistribution(filteredOpportunities, 'Opportunity Type Mix', (row) => SALES_TYPE_LABELS[row.opportunityType] || 'Projects'),
    buildSalesDistribution(filteredOpportunities, 'Owner Mix', (row) => row.ownerName, { valueMode: true }),
  ], [filteredOpportunities]);
  const wonByDate = useMemo(() => buildSalesWonByDate(filteredOpportunities, range), [filteredOpportunities, range.start.getTime(), range.end.getTime(), range.isAllDates]);

  const applyState = (next) => {
    const clean = {
      ...next,
      start: next.range === 'custom' ? next.start : '',
      end: next.range === 'custom' ? next.end : '',
    };
    setState(clean);
    navigateSalesReportState(clean);
  };

  const exportCsv = () => {
    const rows = [
      ['Opportunity', 'Company', 'Owner', 'Type', 'Status', 'Linked Job', 'Linked Job Status', 'Date', 'Value'],
      ...activityRows.map((row) => {
        const opportunity = row.opportunity;
        return [
          opportunity.name || 'Opportunity',
          opportunity.client || 'Unknown',
          opportunity.ownerName,
          SALES_TYPE_LABELS[opportunity.opportunityType] || 'Projects',
          SALES_STATUS_LABELS[opportunity.status] || 'Open',
          opportunity.linkedJobLabel,
          opportunity.linkedJobReadiness === 'no-linked'
            ? 'No linked Job'
            : opportunity.linkedJobs.map((job) => job.status || 'linked').join(', '),
          row.activity.date,
          opportunity.value,
        ];
      }),
    ];
    downloadCsv(`sales-report-${state.range === 'all' ? 'all-dates' : `${formatISODate(range.start)}-${formatISODate(range.end)}`}.csv`, rows);
  };

  return h('div', { className: 'space-y-6', 'data-demo': 'sales-report' }, [
    h('div', { className: 'space-y-3' }, [
      h('div', { className: 'flex flex-wrap items-end justify-between gap-3' }, [
        h('div', { className: 'space-y-1' }, [
          h('h2', { className: 'text-2xl font-semibold text-slate-900 dark:text-white' }, 'Sales Report'),
          h('p', { className: 'text-sm text-slate-600 dark:text-slate-300' }, 'Opportunity value, status, ownership, and linked Job readiness for the selected date range.'),
          h('p', { className: 'text-sm text-slate-500 dark:text-slate-400', 'data-demo': 'sales-selected-date-range' }, range.label),
        ]),
        h('span', { className: 'text-sm text-slate-500 dark:text-slate-400' }, `${activityRows.length} changes`),
      ]),
      h(SalesActiveFilters, { state, rangeLabel: range.label, options }),
    ]),
    printFriendly ? null : h(SalesReportControls, {
      state,
      options,
      onChange: applyState,
      onExportCsv: exportCsv,
      onPrintFriendly,
    }),
    h('div', { className: 'grid grid-cols-1 gap-3 md:grid-cols-3', 'data-demo': 'sales-summary-cards' }, [
      h(KPIBox, { title: 'New Opportunities', value: newOpportunities, subtext: `${newOpportunities} created`, tone: 'green' }),
      h(KPIBox, { title: 'Open', value: formatCurrency(openValue, { compact: true }), subtext: `${openOpportunities.length} open`, tone: 'amber' }),
      h(KPIBox, { title: 'Won', value: formatCurrency(wonValue, { compact: true }), subtext: `${wonOpportunities.length} won`, tone: 'green' }),
    ]),
    h('div', { className: 'rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-slate-900/80', 'data-demo': 'sales-linked-jobs-summary' }, [
      h('div', { className: 'flex flex-wrap items-center justify-between gap-3' }, [
        h('div', { className: 'space-y-1' }, [
          h('h3', { className: 'text-sm font-semibold text-slate-900 dark:text-white' }, 'Opportunities linked to Jobs'),
          h('p', { className: 'text-xs text-slate-500 dark:text-slate-400' }, `${linkedOpportunityCount} of ${filteredOpportunities.length} total opportunities`),
        ]),
        h('div', { className: 'text-2xl font-semibold tabular-nums text-slate-900 dark:text-white' }, linkedOpportunityCount),
      ]),
    ]),
    h('div', { className: 'grid grid-cols-1 gap-4 lg:grid-cols-3', 'data-demo': 'sales-mix-grid' },
      mixCards.map((card) => h(SalesMixCard, { key: card.title, title: card.title, items: card.items, valueMode: card.valueMode }))
    ),
    h(SalesWonValueChart, { rows: wonByDate }),
    h('div', { className: 'rounded-xl border border-slate-200 bg-white shadow-sm dark:border-white/10 dark:bg-slate-900/80', 'data-demo': 'sales-report-activity' }, [
      h('div', { className: 'flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-4 dark:border-white/5' }, [
        h('div', { className: 'space-y-1' }, [
          h('h3', { className: 'text-lg font-semibold text-slate-900 dark:text-white' }, 'Sales Report Activity'),
          h('p', { className: 'text-sm text-slate-600 dark:text-slate-300' }, 'Opportunity changes during the selected date range.'),
        ]),
        h('span', { className: 'text-sm text-slate-500 dark:text-slate-400' }, `${activityRows.length} rows`),
      ]),
      activityRows.length
        ? h(SalesActivityTable, { rows: activityRows })
        : h('div', { className: 'p-5 text-sm text-slate-600 dark:text-slate-300' }, 'No Opportunity changes match these filters.'),
    ]),
  ]);
}
