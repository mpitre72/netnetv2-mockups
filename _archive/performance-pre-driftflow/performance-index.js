import { navigate } from '../router.js';
import { SectionHeader } from '../components/layout/SectionHeader.js';
import { KPIBox, StackedMeter, RowActionsMenu, MovedDateIndicator, FilterChips } from '../components/performance/primitives.js';
import {
  performanceJobs,
  performanceDeliverables,
  performanceTeam,
  performanceTasks,
  performanceServiceTypes,
  performanceTimeEntries,
  performanceSalesDeals,
  performanceSalesActivities,
} from './performance-data.js';

const { createElement: h, useEffect, useMemo, useState } = React;
const { createRoot, createPortal } = ReactDOM;

const PERFORMANCE_SWITCHER = [
  { label: 'Overview', value: 'overview' },
  { label: 'Capacity & Forecast', value: 'capacity' },
  { label: 'Service Types', value: 'service-types' },
  { label: 'Team', value: 'team' },
  { label: 'Reports', value: 'reports' },
];
const REPORTS_TABS = [
  { label: 'Time', value: 'time' },
  { label: 'Team', value: 'team' },
  { label: 'Sales', value: 'sales' },
  { label: 'Job', value: 'job' },
];

function getReportRange(state) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  let start = new Date(today);
  const end = new Date(today);
  if (state.range === 'last-7') {
    start.setDate(end.getDate() - 6);
  } else if (state.range === 'last-30') {
    start.setDate(end.getDate() - 29);
  } else if (state.range === 'last-90') {
    start.setDate(end.getDate() - 89);
  } else if (state.range === 'custom' && state.start && state.end) {
    const s = new Date(state.start);
    const e = new Date(state.end);
    if (!isNaN(s) && !isNaN(e)) {
      start = s;
      end.setTime(e.getTime());
    }
  } else {
    start.setDate(end.getDate() - 29);
  }
  start.setHours(0, 0, 0, 0);
  end.setHours(0, 0, 0, 0);
  const days = Math.round((end - start) / (1000 * 60 * 60 * 24)) + 1;
  return { start, end, days };
}

function getPreviousRange(range) {
  const length = range.days;
  const end = new Date(range.start);
  end.setDate(end.getDate() - 1);
  const start = new Date(end);
  start.setDate(end.getDate() - (length - 1));
  return { start, end, days: length };
}

const FILTER_PRESETS = {
  'on-time': { label: 'On-Time' },
  'jobs-at-risk': { label: 'Jobs at Risk' },
  'capacity': { label: 'Capacity (14d)' },
  'overdue-soon': { label: 'Overdue & Due Soon' },
};

const CAPACITY_WINDOW_DAYS = 14;
const SERVICE_LOOKBACK_DAYS = 30;
const REPORT_DEFAULT_RANGE = 'last-30';
const REPORT_DEFAULT_GROUP = 'service-type';
const REPORT_COLORS = ['#6D28D9', '#0EA5E9', '#22C55E', '#F59E0B', '#F97316', '#EF4444', '#14B8A6'];

let root = null;

function clampPercent(value) {
  const num = Number.isFinite(value) ? value : 0;
  if (num < 0) return 0;
  if (num > 200) return 200;
  return num;
}

function getTimelinePercent(start, end) {
  const s = new Date(start).getTime();
  const e = new Date(end).getTime();
  const n = new Date().getTime();
  if (isNaN(s) || isNaN(e)) return 0;
  if (e <= s) return 100;
  const p = ((n - s) / (e - s)) * 100;
  return isNaN(p) ? 0 : Math.max(0, p);
}

function parsePerformanceRoute(hash) {
  const raw = (hash || location.hash || '').replace('#', '');
  const [pathPart, queryString = ''] = raw.split('?');
  const trimmed = pathPart.replace('/app/performance', '').replace(/^\/+/, '');
  return { path: trimmed || 'overview', queryString };
}

function getHorizonFromQuery(queryString = '') {
  const params = new URLSearchParams(queryString);
  const raw = parseInt(params.get('horizonDays') || '', 10);
  if (raw === 14 || raw === 30 || raw === 60) return raw;
  return 30;
}

function updateHashWithFilters(filters) {
  const base = '#/app/performance/overview';
  const query = filters.length ? `?filters=${encodeURIComponent(filters.join(','))}` : '';
  const target = `${base}${query}`;
  if (location.hash === target) {
    window.dispatchEvent(new HashChangeEvent('hashchange'));
  } else {
    navigate(target);
  }
}

function updateHashWithHorizon(horizon) {
  const base = '#/app/performance/capacity';
  const params = new URLSearchParams(location.hash.split('?')[1] || '');
  params.set('horizonDays', horizon);
  const query = `?${params.toString()}`;
  const target = `${base}${query}`;
  navigate(target);
}

function parseFiltersFromQuery(queryString = '') {
  const params = new URLSearchParams(queryString);
  const raw = params.get('filters') || '';
  return raw.split(',').map((f) => f.trim()).filter(Boolean);
}

function parseReportState(queryString = '', defaultGroup = REPORT_DEFAULT_GROUP) {
  const params = new URLSearchParams(queryString);
  const range = params.get('range') || REPORT_DEFAULT_RANGE;
  const compare = params.get('compare') === '1';
  const groupBy = params.get('groupBy') || defaultGroup;
  const start = params.get('start') || '';
  const end = params.get('end') || '';
  return { range, compare, groupBy, start, end };
}

function updateReportQuery(next) {
  const params = new URLSearchParams(location.hash.split('?')[1] || '');
  if (next.range) params.set('range', next.range);
  if (next.compare != null) params.set('compare', next.compare ? '1' : '0');
  if (next.groupBy) params.set('groupBy', next.groupBy);
  if (next.start) params.set('start', next.start);
  else params.delete('start');
  if (next.end) params.set('end', next.end);
  else params.delete('end');
  return params.toString();
}

// -----------------------------
// Reports: Custom Date Picker
// -----------------------------
function pad2(n) {
  return String(n).padStart(2, '0');
}

function formatISODate(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return '';
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

function parseISODate(iso) {
  if (!iso || typeof iso !== 'string') return null;
  const parts = iso.split('-').map((p) => parseInt(p, 10));
  if (parts.length !== 3 || parts.some((p) => !Number.isFinite(p))) return null;
  const [y, m, d] = parts;
  return new Date(y, m - 1, d);
}

function formatCurrency(amount, { compact = false } = {}) {
  const n = Number(amount || 0);
  if (compact) {
    const abs = Math.abs(n);
    if (abs >= 1_000_000) {
      const v = Math.round((n / 1_000_000) * 10) / 10;
      return `$${String(v).replace(/\.0$/, '')}M`;
    }
    if (abs >= 1_000) {
      const v = Math.round((n / 1_000) * 10) / 10;
      return `$${String(v).replace(/\.0$/, '')}k`;
    }
  }
  try {
    // Intl may not be available in some sandboxed environments; fall back below.
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 0,
    }).format(n);
  } catch (e) {
    return `$${Math.round(n).toLocaleString()}`;
  }
}

function addDays(date, days) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function addMonths(date, months) {
  return new Date(date.getFullYear(), date.getMonth() + months, 1);
}

function isSameDay(a, b) {
  if (!(a instanceof Date) || !(b instanceof Date)) return false;
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function isBeforeDay(a, b) {
  if (!(a instanceof Date) || !(b instanceof Date)) return false;
  const ax = new Date(a.getFullYear(), a.getMonth(), a.getDate()).getTime();
  const bx = new Date(b.getFullYear(), b.getMonth(), b.getDate()).getTime();
  return ax < bx;
}

function isBetweenInclusive(day, start, end) {
  if (!(day instanceof Date) || !(start instanceof Date) || !(end instanceof Date)) return false;
  const dx = new Date(day.getFullYear(), day.getMonth(), day.getDate()).getTime();
  const sx = new Date(start.getFullYear(), start.getMonth(), start.getDate()).getTime();
  const ex = new Date(end.getFullYear(), end.getMonth(), end.getDate()).getTime();
  return dx >= sx && dx <= ex;
}

function clamp(n, min, max) {
  return Math.min(max, Math.max(min, n));
}

const REPORT_MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];
const REPORT_WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

function getMonthGrid(monthDate) {
  const year = monthDate.getFullYear();
  const month = monthDate.getMonth();
  const first = new Date(year, month, 1);
  const startOffset = first.getDay(); // Sunday = 0
  const gridStart = new Date(year, month, 1 - startOffset);

  const days = [];
  for (let i = 0; i < 42; i += 1) {
    const d = addDays(gridStart, i);
    days.push({
      date: d,
      inMonth: d.getMonth() === month,
      key: `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`,
    });
  }

  const weeks = [];
  for (let w = 0; w < 6; w += 1) {
    weeks.push(days.slice(w * 7, w * 7 + 7));
  }
  return weeks;
}

function getPresetRange(presetId, today) {
  const t = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  if (presetId === 'today') return { start: t, end: t };
  if (presetId === 'yesterday') {
    const y = addDays(t, -1);
    return { start: y, end: y };
  }
  if (presetId === 'this-week') {
    const start = addDays(t, -t.getDay());
    return { start, end: t };
  }
  if (presetId === 'last-week') {
    const end = addDays(addDays(t, -t.getDay()), -1);
    const start = addDays(end, -6);
    return { start, end };
  }
  if (presetId === 'this-month') {
    const start = new Date(t.getFullYear(), t.getMonth(), 1);
    return { start, end: t };
  }
  if (presetId === 'last-month') {
    const start = new Date(t.getFullYear(), t.getMonth() - 1, 1);
    const end = new Date(t.getFullYear(), t.getMonth(), 0);
    return { start, end };
  }
  if (presetId === 'this-year') {
    const start = new Date(t.getFullYear(), 0, 1);
    return { start, end: t };
  }
  if (presetId === 'last-year') {
    const start = new Date(t.getFullYear() - 1, 0, 1);
    const end = new Date(t.getFullYear() - 1, 11, 31);
    return { start, end };
  }
  if (presetId === 'last-7') {
    return { start: addDays(t, -6), end: t };
  }
  if (presetId === 'last-30') {
    return { start: addDays(t, -29), end: t };
  }
  if (presetId === 'last-90') {
    return { start: addDays(t, -89), end: t };
  }
  return null;
}

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
            // Presets
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

            // Calendars
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

            // Selected
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

function enrichJobs() {
  return performanceJobs.map((job) => {
    const effortPct = clampPercent((job.actualHours / (job.estHours || 1)) * 100);
    const timelinePct = clampPercent(getTimelinePercent(job.startDate, job.plannedEnd));
    const atRisk = effortPct > 85 || timelinePct > 85;
    const onTime = effortPct <= 85 && timelinePct <= 85;
    return { ...job, effortPct, timelinePct, atRisk, onTime };
  });
}

function enrichDeliverables() {
  const today = new Date();
  const next7 = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);
  return performanceDeliverables.map((d) => {
    const effortPct = clampPercent(d.effortConsumed || 0);
    const timelinePct = clampPercent(d.durationConsumed || 0);
    const dueDate = new Date(d.due);
    const overdue = !isNaN(dueDate) && dueDate < today;
    const dueSoon = !isNaN(dueDate) && dueDate >= today && dueDate <= next7;
    const atRisk = effortPct > 85 || timelinePct > 85 || overdue;
    return { ...d, effortPct, timelinePct, overdue, dueSoon, atRisk };
  });
}

function computeKPIs(jobs, deliverables) {
  const activeJobs = jobs.filter((j) => j.status === 'active');
  const onTimeJobs = activeJobs.filter((j) => j.onTime).length;
  const onTimeRatio = activeJobs.length ? Math.round((onTimeJobs / activeJobs.length) * 100) : 0;
  const jobsAtRisk = activeJobs.filter((j) => j.atRisk).length;

  const today = new Date();
  const next14 = new Date(today.getTime() + CAPACITY_WINDOW_DAYS * 24 * 60 * 60 * 1000);
  const hoursDue = deliverables
    .filter((d) => {
      const due = new Date(d.due);
      return !isNaN(due) && due >= today && due <= next14;
    })
    .reduce((sum, d) => sum + (d.estHours || 20), 0);
  const capacity = 160;
  const capacityRatio = Math.round((hoursDue / capacity) * 100);

  const overdue = deliverables.filter((d) => d.overdue).length;
  const dueSoon = deliverables.filter((d) => d.dueSoon).length;

  return {
    onTimeRatio,
    jobsAtRisk,
    capacity,
    hoursDue,
    capacityRatio,
    overdue,
    dueSoon,
  };
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

function buildServiceTypeContext(serviceTypes, jobs, deliverables, tasks, timeEntries) {
  const serviceTypeMaps = buildServiceTypeMaps(serviceTypes);
  const jobMap = new Map(jobs.map((j) => [j.id, j]));
  const deliverableMap = new Map(deliverables.map((d) => [d.id, d]));
  const taskMap = new Map(tasks.map((t) => [t.id, t]));
  const deliverableTasks = new Map();
  tasks.forEach((task) => {
    const list = deliverableTasks.get(task.deliverableId) || [];
    list.push(task);
    deliverableTasks.set(task.deliverableId, list);
  });
  const entriesByTask = new Map();
  timeEntries.forEach((entry) => {
    const list = entriesByTask.get(entry.taskId) || [];
    list.push(entry);
    entriesByTask.set(entry.taskId, list);
  });
  return {
    serviceTypes,
    serviceTypeMaps,
    jobMap,
    deliverableMap,
    taskMap,
    deliverableTasks,
    entriesByTask,
    timeEntries,
  };
}

function computeEffortMixLast30Days(ctx) {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - SERVICE_LOOKBACK_DAYS);
  const totals = {};
  let totalHours = 0;

  ctx.timeEntries.forEach((entry) => {
    const entryDate = new Date(entry.date);
    if (isNaN(entryDate) || entryDate < cutoff) return;
    const task = ctx.taskMap.get(entry.taskId);
    const deliverable = task ? ctx.deliverableMap.get(task.deliverableId) : null;
    const job = deliverable ? ctx.jobMap.get(deliverable.jobId) : null;
    const serviceTypeId = resolveServiceTypeId({ entry, task, job, serviceTypeMaps: ctx.serviceTypeMaps });
    const hours = Math.max(0, Number(entry.hours) || 0);
    if (!serviceTypeId || hours <= 0) return;
    totals[serviceTypeId] = (totals[serviceTypeId] || 0) + hours;
    totalHours += hours;
  });

  const items = ctx.serviceTypes
    .map((st) => ({
      id: st.id,
      name: st.name,
      hours: Math.round((totals[st.id] || 0) * 10) / 10,
      percent: totalHours ? Math.round(((totals[st.id] || 0) / totalHours) * 100) : 0,
    }))
    .filter((item) => item.hours > 0)
    .sort((a, b) => b.hours - a.hours);

  return { items, totalHours: Math.round(totalHours * 10) / 10 };
}

function buildDeliverableServiceMix(deliverable, ctx) {
  const tasks = ctx.deliverableTasks.get(deliverable.id) || [];
  const mix = {};
  let totalHours = 0;

  tasks.forEach((task) => {
    const entries = ctx.entriesByTask.get(task.id) || [];
    entries.forEach((entry) => {
      const job = ctx.jobMap.get(deliverable.jobId);
      const serviceTypeId = resolveServiceTypeId({ entry, task, job, serviceTypeMaps: ctx.serviceTypeMaps });
      const hours = Math.max(0, Number(entry.hours) || 0);
      if (!serviceTypeId || hours <= 0) return;
      mix[serviceTypeId] = (mix[serviceTypeId] || 0) + hours;
      totalHours += hours;
    });
  });

  if (totalHours === 0) {
    tasks.forEach((task) => {
      const job = ctx.jobMap.get(deliverable.jobId);
      const serviceTypeId = resolveServiceTypeId({ task, job, serviceTypeMaps: ctx.serviceTypeMaps });
      if (!serviceTypeId) return;
      const weight = Number.isFinite(task.estimatedHours)
        ? task.estimatedHours
        : Number.isFinite(task.actualHours)
          ? task.actualHours
          : 1;
      mix[serviceTypeId] = (mix[serviceTypeId] || 0) + weight;
      totalHours += weight;
    });
  }

  if (totalHours === 0) {
    const job = ctx.jobMap.get(deliverable.jobId);
    const serviceTypeId = resolveServiceTypeId({ job, serviceTypeMaps: ctx.serviceTypeMaps });
    if (serviceTypeId) {
      const weight = deliverable.estHours || 1;
      mix[serviceTypeId] = weight;
      totalHours = weight;
    }
  }

  return { mix, totalHours };
}

function buildRiskClusters(atRiskDeliverables, ctx) {
  const buckets = new Map();
  atRiskDeliverables.forEach((del) => {
    const { mix } = buildDeliverableServiceMix(del, ctx);
    Object.entries(mix).forEach(([serviceTypeId, hours]) => {
      const bucket = buckets.get(serviceTypeId) || { hours: 0, count: 0 };
      bucket.hours += hours;
      bucket.count += 1;
      buckets.set(serviceTypeId, bucket);
    });
  });

  const items = ctx.serviceTypes
    .map((st) => {
      const bucket = buckets.get(st.id) || { hours: 0, count: 0 };
      return {
        id: st.id,
        name: st.name,
        hours: Math.round(bucket.hours * 10) / 10,
        count: bucket.count,
      };
    })
    .filter((item) => item.count > 0 || item.hours > 0)
    .sort((a, b) => (b.count - a.count) || (b.hours - a.hours));

  return items;
}

function getLast30Entries(entries) {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - SERVICE_LOOKBACK_DAYS);
  return entries.filter((entry) => {
    const d = new Date(entry.date);
    return !isNaN(d) && d >= cutoff;
  });
}

function buildDrilldown(selectedId, atRiskDeliverables, ctx) {
  if (!selectedId) return [];
  return atRiskDeliverables
    .map((del) => {
      const { mix, totalHours } = buildDeliverableServiceMix(del, ctx);
      const share = mix[selectedId];
      if (!share) return null;
      const sharePct = totalHours ? Math.round((share / totalHours) * 1000) / 10 : null;
      return { deliverable: del, share, sharePct, totalHours };
    })
    .filter(Boolean)
    .sort((a, b) => (b.share - a.share) || (b.totalHours - a.totalHours));
}

function useCapacityData(queryString) {
  const horizonDays = getHorizonFromQuery(queryString);
  const jobs = useMemo(() => enrichJobs(), []);
  const deliverables = useMemo(() => enrichDeliverables(), []);
  const tasks = useMemo(() => performanceTasks, []);

  const teamCapacity = useMemo(() => {
    return performanceTeam.map((tm) => ({
      ...tm,
      horizonCapacity: capacityFromHorizon(tm.monthlyCapacityHours, horizonDays),
    }));
  }, [horizonDays]);

  const demand = useMemo(
    () => computeDemand({ horizonDays, jobs, deliverables, tasks }),
    [horizonDays, jobs, deliverables, tasks]
  );

  const memberRows = teamCapacity.map((tm) => {
    const demandHours = demand.perMember[tm.id] || 0;
    const utilization = tm.horizonCapacity ? Math.round((demandHours / tm.horizonCapacity) * 100) : 0;
    const tone = utilization > 100 ? 'red' : utilization > 85 ? 'amber' : 'green';
    return { ...tm, demandHours, utilization, tone };
  });

  const totalCapacity = teamCapacity.reduce((sum, tm) => sum + tm.horizonCapacity, 0);
  const summaryUtilization = totalCapacity ? Math.round((demand.totalDemand / totalCapacity) * 100) : 0;
  const summaryTone = summaryUtilization > 100 ? 'red' : summaryUtilization > 85 ? 'amber' : 'green';

  return {
    horizonDays,
    memberRows,
    demand,
    totalCapacity,
    summaryUtilization,
    summaryTone,
    serviceTypeDemand: demand.serviceTypeDemand,
    teamCapacity,
    deliverables,
  };
}

function applyFilters(jobs, deliverables, filters) {
  if (!filters.length) return { jobs: jobs.filter((j) => j.status === 'active'), deliverables };
  const has = (id) => filters.includes(id);

  let filteredJobs = jobs.filter((j) => j.status === 'active');
  let filteredDeliverables = [...deliverables];

  if (has('on-time')) filteredJobs = filteredJobs.filter((j) => j.onTime);
  if (has('jobs-at-risk')) filteredJobs = filteredJobs.filter((j) => j.atRisk);
  if (has('capacity')) {
    const today = new Date();
    const next14 = new Date(today.getTime() + CAPACITY_WINDOW_DAYS * 24 * 60 * 60 * 1000);
    const jobIdsDueSoon = new Set(
      deliverables
        .filter((d) => {
          const due = new Date(d.due);
          return !isNaN(due) && due >= today && due <= next14;
        })
        .map((d) => d.jobId)
    );
    filteredJobs = filteredJobs.filter((j) => jobIdsDueSoon.has(j.id) || j.atRisk);
    filteredDeliverables = filteredDeliverables.filter((d) => {
      const due = new Date(d.due);
      return !isNaN(due) && due >= today && due <= next14;
    });
  }
  if (has('overdue-soon')) {
    filteredDeliverables = filteredDeliverables.filter((d) => d.overdue || d.dueSoon);
  }

  return { jobs: filteredJobs, deliverables: filteredDeliverables };
}

function FilterBar({ filters, setFilters }) {
  return h('div', { className: 'flex items-center justify-between flex-wrap gap-3' }, [
    h('div', { className: 'flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300' }, [
      h('span', { className: 'text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400 font-semibold' }, 'Filters'),
      h('span', null, filters.length ? filters.map((f) => FILTER_PRESETS[f]?.label || f).join(' · ') : 'None'),
    ]),
    filters.length
      ? h(FilterChips, {
          filters: filters.map((f) => FILTER_PRESETS[f]?.label || f),
          onRemove: (label) => {
            const match = Object.entries(FILTER_PRESETS).find(([, v]) => v.label === label);
            const id = match ? match[0] : null;
            if (!id) return;
            const next = filters.filter((f) => f !== id);
            setFilters(next);
            updateHashWithFilters(next);
          },
          onClear: () => {
            setFilters([]);
            updateHashWithFilters([]);
          },
          clearLabel: 'Clear filters',
          dataDemoWrapper: 'perf-filter-chips',
          dataDemoClear: 'clear-filters',
        })
      : null,
  ]);
}

function KPISection({ kpis, setFilters }) {
  return h('div', { className: 'grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4' }, [
    h(KPIBox, {
      dataDemo: 'kpi-box',
      tone: 'green',
      title: 'On-Time Effort Ratio',
      value: `${kpis.onTimeRatio}%`,
      subtext: 'Target ≥ 85%',
      onClick: () => { setFilters(['on-time']); updateHashWithFilters(['on-time']); },
    }),
    h(KPIBox, {
      tone: kpis.jobsAtRisk > 0 ? 'amber' : 'green',
      title: 'Jobs at Risk',
      value: kpis.jobsAtRisk,
      subtext: 'Active jobs needing attention',
      onClick: () => { setFilters(['jobs-at-risk']); updateHashWithFilters(['jobs-at-risk']); },
    }),
    h(KPIBox, {
      tone: kpis.capacityRatio > 110 ? 'red' : kpis.capacityRatio >= 85 ? 'amber' : 'green',
      title: 'Capacity Next 14 Days',
      value: `${kpis.capacityRatio}%`,
      subtext: `${kpis.hoursDue}h due • Cap ${kpis.capacity}h`,
      onClick: () => { updateHashWithHorizon(14); },
    }),
    h(KPIBox, {
      tone: kpis.overdue > 0 ? 'red' : 'green',
      title: 'Overdue & Due Soon',
      value: `Overdue ${kpis.overdue} | Due Soon ${kpis.dueSoon}`,
      subtext: '7-day window',
      onClick: () => { setFilters(['overdue-soon']); updateHashWithFilters(['overdue-soon']); },
    }),
  ]);
}

function PortfolioTable({ jobs, onRowClick }) {
  return h('div', { className: 'rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900/80 shadow-sm overflow-hidden', 'data-demo': 'portfolio-table' }, [
    h('div', { className: 'overflow-x-auto' },
      h('table', { className: 'min-w-full text-sm' }, [
        h('thead', { className: 'bg-slate-50 dark:bg-slate-800/60 text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400' }, [
          h('tr', null, [
            h('th', { className: 'px-5 py-3 text-left font-semibold' }, 'Job'),
            h('th', { className: 'px-5 py-3 text-left font-semibold' }, 'Client'),
            h('th', { className: 'px-5 py-3 text-left font-semibold' }, 'Effort / Timeline'),
            h('th', { className: 'px-5 py-3 text-right font-semibold' }, 'Actions'),
          ]),
        ]),
        h('tbody', { className: 'divide-y divide-slate-100 dark:divide-white/5' },
          jobs.map((job) =>
            h('tr', { key: job.id, className: 'hover:bg-slate-50 dark:hover:bg-slate-800/40 cursor-pointer', onClick: () => onRowClick(job) }, [
              h('td', { className: 'px-5 py-4 font-semibold text-slate-900 dark:text-white whitespace-nowrap' }, job.name),
              h('td', { className: 'px-5 py-4 text-slate-600 dark:text-slate-300 whitespace-nowrap' }, job.client),
              h('td', { className: 'px-5 py-4' },
                h(StackedMeter, {
                  variant: 'inline',
                  showHeader: false,
                  effort: { actual: Math.round(job.actualHours), baseline: Math.round(job.estHours), unit: 'h' },
                  timeline: { actual: Math.round(job.timelinePct), baseline: 100, unit: '%' },
                  completed: job.status === 'completed',
                })
              ),
              h('td', { className: 'px-5 py-4 text-right whitespace-nowrap', onClick: (e) => e.stopPropagation() },
                h(RowActionsMenu, {
                  dataDemoButton: 'row-actions-button',
                  dataDemoMenu: 'row-actions-menu',
                  onSelect: (item) => {
                    if (typeof window?.showToast === 'function') window.showToast(`${item} → coming next`);
                    else console.log('[RowAction]', item);
                  },
                })
              ),
            ])
          )
        ),
      ])
    ),
  ]);
}

function DeliverablesTable({ deliverables, onRowClick }) {
  return h('div', { className: 'rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900/80 shadow-sm overflow-hidden', 'data-demo': 'deliverables-table' }, [
    h('div', { className: 'overflow-x-auto' },
      h('table', { className: 'min-w-full text-sm' }, [
        h('thead', { className: 'bg-slate-50 dark:bg-slate-800/60 text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400' }, [
          h('tr', null, [
            h('th', { className: 'px-5 py-3 text-left font-semibold' }, 'Job / Deliverable'),
            h('th', { className: 'px-5 py-3 text-left font-semibold' }, 'Effort vs Timeline'),
            h('th', { className: 'px-5 py-3 text-left font-semibold' }, 'Owner'),
            h('th', { className: 'px-5 py-3 text-left font-semibold' }, 'Due'),
            h('th', { className: 'px-5 py-3 text-right font-semibold' }, 'Actions'),
          ]),
        ]),
        h('tbody', { className: 'divide-y divide-slate-100 dark:divide-white/5' },
          deliverables.map((d) =>
            h('tr', { key: d.id, className: 'hover:bg-slate-50 dark:hover:bg-slate-800/40 cursor-pointer', onClick: () => onRowClick(d) }, [
              h('td', { className: 'px-5 py-4' }, [
                h('div', { className: 'font-semibold text-slate-900 dark:text-white' }, d.jobName || `Job ${d.jobId}`),
                h('div', { className: 'text-sm text-slate-600 dark:text-slate-400' }, d.name),
              ]),
              h('td', { className: 'px-5 py-4' },
                h(StackedMeter, {
                  variant: 'inline',
                  showHeader: false,
                  effort: { actual: Math.round(d.effortConsumed), baseline: 100, unit: '%' },
                  timeline: { actual: Math.round(d.durationConsumed), baseline: 100, unit: '%' },
                  completed: d.status === 'completed',
                })
              ),
              h('td', { className: 'px-5 py-4 whitespace-nowrap text-slate-700 dark:text-slate-200' }, d.owner),
              h('td', { className: 'px-5 py-4 whitespace-nowrap flex items-center gap-2 text-slate-700 dark:text-slate-200' }, [
                d.originalDue
                  ? h(MovedDateIndicator, {
                      dataDemoChip: 'moved-date-chip',
                      dataDemoPopover: 'moved-date-popover',
                      originalDate: d.originalDue,
                      newDate: d.due,
                      changedAt: d.changedAt || 'Updated recently',
                      changedBy: d.owner,
                    })
                  : h('span', null, d.due),
                d.overdue
                  ? h('span', { className: 'text-xs font-semibold text-red-600 dark:text-red-300' }, 'Overdue')
                  : d.dueSoon
                    ? h('span', { className: 'text-xs font-semibold text-amber-600 dark:text-amber-300' }, 'Due soon')
                    : null,
              ]),
              h('td', { className: 'px-5 py-4 text-right whitespace-nowrap', onClick: (e) => e.stopPropagation() },
                h(RowActionsMenu, {
                  onSelect: (item) => {
                    if (typeof window?.showToast === 'function') window.showToast(`${item} → coming next`);
                    else console.log('[RowAction]', item);
                  },
                })
              ),
            ])
          )
        ),
      ])
    ),
  ]);
}

function PerformanceOverview({ queryString }) {
  const [filters, setFilters] = useState(parseFiltersFromQuery(queryString));

  const jobs = useMemo(() => enrichJobs(), []);
  const enrichedDeliverables = useMemo(() => {
    const d = enrichDeliverables();
    return d.map((del) => {
      const job = jobs.find((j) => j.id === del.jobId);
      return { ...del, jobName: job?.name || `Job ${del.jobId}` };
    });
  }, [jobs]);
  const deliverables = useMemo(
    () => enrichedDeliverables.filter((del) => del.atRisk || del.overdue || del.dueSoon),
    [enrichedDeliverables]
  );

  useEffect(() => {
    setFilters(parseFiltersFromQuery(queryString));
  }, [queryString]);

  const kpis = useMemo(() => computeKPIs(jobs, enrichedDeliverables), [jobs, enrichedDeliverables]);
  const filtered = useMemo(() => applyFilters(jobs, deliverables, filters), [jobs, deliverables, filters]);

  const goJob = (job) => navigate(`#/app/performance/job/${job.id}`);
  const goDeliverable = (d) => navigate(`#/app/performance/job/${d.jobId}?deliverable=${d.id}`);

  return h('div', { className: 'space-y-8' }, [
    h(FilterBar, { filters, setFilters }),
    h(KPISection, { kpis, setFilters }),
    h('div', { className: 'space-y-3' }, [
      h('div', { className: 'flex items-center justify-between' }, [
        h('h3', { className: 'text-lg font-semibold text-slate-900 dark:text-white' }, 'Portfolio Status'),
        h('span', { className: 'text-sm text-slate-500 dark:text-slate-400' }, `${filtered.jobs.length} active jobs`),
      ]),
      h(PortfolioTable, { jobs: filtered.jobs, onRowClick: goJob }),
    ]),
    h('div', { className: 'space-y-3' }, [
      h('div', { className: 'flex items-center justify-between' }, [
        h('h3', { className: 'text-lg font-semibold text-slate-900 dark:text-white' }, 'At-Risk Deliverables'),
        h('span', { className: 'text-sm text-slate-500 dark:text-slate-400' }, `${filtered.deliverables.length} deliverables`),
      ]),
      h(DeliverablesTable, { deliverables: filtered.deliverables, onRowClick: goDeliverable }),
    ]),
  ]);
}

function HorizonSelector({ value, onChange }) {
  const options = [14, 30, 60];
  return h('div', { className: 'inline-flex items-center gap-2 rounded-full border border-slate-300 dark:border-white/10 bg-white dark:bg-slate-900 shadow-sm p-1' },
    options.map((opt) =>
      h('button', {
        key: opt,
        type: 'button',
        className: [
          'px-3 py-1 text-sm font-semibold rounded-full transition',
          opt === value
            ? 'bg-netnet-purple text-white shadow'
            : 'text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800'
        ].join(' '),
        onClick: () => onChange(opt),
      }, `${opt}d`)
    )
  );
}

function CapacitySummary({ totalCapacity, demand, utilization, tone, horizonDays }) {
  return h('div', { className: 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4' }, [
    h(KPIBox, { tone: 'green', title: 'Horizon', value: `${horizonDays} days`, subtext: 'Selected window' }),
    h(KPIBox, { tone: tone, title: 'Demand (hrs)', value: Math.round(demand.totalDemand), subtext: 'Known demand' }),
    h(KPIBox, { tone: tone, title: 'Capacity (hrs)', value: Math.round(totalCapacity), subtext: 'Team capacity' }),
    h(KPIBox, { tone: tone, title: 'Utilization', value: `${utilization}%`, subtext: tone === 'red' ? 'Overbooked' : tone === 'amber' ? 'Tight' : 'Balanced' }),
  ]);
}

function TeamTable({ rows }) {
  return h('div', { className: 'rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900/80 shadow-sm overflow-hidden' }, [
    h('div', { className: 'overflow-x-auto' },
      h('table', { className: 'min-w-full text-sm' }, [
        h('thead', { className: 'bg-slate-50 dark:bg-slate-800/60 text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400' }, [
          h('tr', null, [
            h('th', { className: 'px-5 py-3 text-left font-semibold' }, 'Team Member'),
            h('th', { className: 'px-5 py-3 text-left font-semibold' }, 'Capacity (hrs)'),
            h('th', { className: 'px-5 py-3 text-left font-semibold' }, 'Demand (hrs)'),
            h('th', { className: 'px-5 py-3 text-left font-semibold' }, 'Utilization'),
          ]),
        ]),
        h('tbody', { className: 'divide-y divide-slate-100 dark:divide-white/5' },
          rows.map((r) =>
            h('tr', { key: r.id, className: 'hover:bg-slate-50 dark:hover:bg-slate-800/40' }, [
              h('td', { className: 'px-5 py-3 font-semibold text-slate-900 dark:text-white whitespace-nowrap' }, r.name),
              h('td', { className: 'px-5 py-3 text-slate-700 dark:text-slate-200' }, Math.round(r.horizonCapacity)),
              h('td', { className: 'px-5 py-3 text-slate-700 dark:text-slate-200' }, Math.round(r.demandHours)),
              h('td', { className: 'px-5 py-3 text-slate-700 dark:text-slate-200' },
                h('div', { className: 'flex items-center gap-2' }, [
                  h('span', { className: 'text-sm font-semibold' }, `${r.utilization}%`),
                  h('span', { className: `w-2.5 h-2.5 rounded-full ${r.tone === 'red' ? 'bg-red-500' : r.tone === 'amber' ? 'bg-amber-500' : 'bg-emerald-500'}` }),
                ])
              ),
            ])
          )
        ),
      ])
    ),
  ]);
}

function ServiceTypeSection({ serviceDemand, teamCapacity, deliverables }) {
  const items = Object.entries(serviceDemand).map(([svc, demand]) => {
    const cap = teamCapacity
      .filter((tm) => tm.serviceTypes?.includes(svc))
      .reduce((sum, tm) => sum + tm.horizonCapacity, 0);
    const utilization = cap ? Math.round((demand / cap) * 100) : 0;
    const tone = utilization > 100 ? 'red' : utilization > 85 ? 'amber' : 'green';
    return { svc, demand, cap, utilization, tone };
  });

  const top = items.sort((a, b) => b.utilization - a.utilization)[0];
  const drilldown = top
    ? deliverables.filter((d) => (d.serviceType || 'Mixed') === top.svc)
    : [];

  return h('div', { className: 'space-y-4' }, [
    h('div', { className: 'flex items-center justify-between' }, [
      h('h3', { className: 'text-lg font-semibold text-slate-900 dark:text-white' }, 'Service Type Bottlenecks'),
      h('span', { className: 'text-sm text-slate-500 dark:text-slate-400' }, 'Demand vs capacity'),
    ]),
    h('div', { className: 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4' },
      items.map((item) =>
        h('div', { key: item.svc, className: 'rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900/80 shadow-sm p-4 space-y-2' }, [
          h('div', { className: 'flex items-center justify-between' }, [
            h('div', { className: 'text-sm font-semibold text-slate-900 dark:text-white' }, item.svc),
            h('span', { className: `w-2.5 h-2.5 rounded-full ${item.tone === 'red' ? 'bg-red-500' : item.tone === 'amber' ? 'bg-amber-500' : 'bg-emerald-500'}` }),
          ]),
          h('div', { className: 'text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wide' }, 'Demand vs Capacity'),
          h('div', { className: 'text-sm text-slate-700 dark:text-slate-200' }, `${Math.round(item.demand)}h / ${Math.round(item.cap)}h`),
          h('div', { className: 'text-sm font-semibold text-slate-900 dark:text-white' }, `${item.utilization}% utilized`),
        ])
      )
    ),
    top
      ? h('div', { className: 'rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900/80 shadow-sm p-4 space-y-3' }, [
          h('div', { className: 'flex items-center justify-between' }, [
            h('div', { className: 'text-sm font-semibold text-slate-900 dark:text-white' }, `Deliverables contributing to ${top.svc}`),
            h('span', { className: 'text-xs text-slate-500 dark:text-slate-400' }, `${drilldown.length} items`),
          ]),
          h('div', { className: 'space-y-2' },
            drilldown.map((d) =>
              h('div', { key: d.id, className: 'flex items-center justify-between text-sm text-slate-700 dark:text-slate-200' }, [
                h('span', null, `${d.jobName || 'Job'} – ${d.name}`),
                h('span', { className: 'text-xs text-slate-500 dark:text-slate-400' }, `${Math.round(d.estHours || 0)}h est`),
              ])
            )
          ),
        ])
      : null,
  ]);
}

function CapacityForecast({ queryString }) {
  const { horizonDays, memberRows, demand, totalCapacity, summaryUtilization, summaryTone, serviceTypeDemand, teamCapacity, deliverables } = useCapacityData(queryString);

  return h('div', { className: 'space-y-8' }, [
    h('div', { className: 'flex items-center justify-between flex-wrap gap-3' }, [
      h('h2', { className: 'text-xl font-semibold text-slate-900 dark:text-white' }, 'Capacity & Forecast'),
      h(HorizonSelector, { value: horizonDays, onChange: updateHashWithHorizon }),
    ]),
    h(CapacitySummary, {
      totalCapacity,
      demand,
      utilization: summaryUtilization,
      tone: summaryTone,
      horizonDays,
    }),
    h('div', { className: 'rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900/80 shadow-sm p-4 space-y-2' }, [
      h('div', { className: 'flex items-center gap-4 text-sm text-slate-700 dark:text-slate-200' }, [
        h('span', { className: 'font-semibold' }, 'Unassigned Demand:'),
        h('span', null, `${Math.round(demand.unassignedDemand)}h`),
      ]),
      h('div', { className: 'flex items-center gap-4 text-sm text-slate-700 dark:text-slate-200' }, [
        h('span', { className: 'font-semibold' }, 'Unknown Demand:'),
        h('span', null, `${Math.round(demand.unknownDemand)}h`),
      ]),
    ]),
    h('div', { className: 'space-y-3' }, [
      h('div', { className: 'flex items-center justify-between' }, [
        h('h3', { className: 'text-lg font-semibold text-slate-900 dark:text-white' }, 'Team Allocation'),
        h('span', { className: 'text-sm text-slate-500 dark:text-slate-400' }, `${memberRows.length} team members`),
      ]),
      h(TeamTable, { rows: memberRows }),
    ]),
    h(ServiceTypeSection, { serviceDemand: serviceTypeDemand, teamCapacity, deliverables }),
  ]);
}

function computeTeamLOE(ctx) {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - SERVICE_LOOKBACK_DAYS);
  const completed = ctx.deliverables.filter((d) => {
    if (d.status !== 'completed') return false;
    const completedDate = new Date(d.completedAt || d.due);
    return !isNaN(completedDate) && completedDate >= cutoff && completedDate <= new Date();
  });
  if (!completed.length) return { rows: [], completedCount: 0 };

  const memberMap = new Map();

  completed.forEach((del) => {
    const tasks = ctx.deliverableTasks.get(del.id) || [];
    const entriesAll = tasks.flatMap((task) => ctx.entriesByTask.get(task.id) || []);
    const baseline = Number(del.estHours) || tasks.reduce((sum, t) => sum + (Number(t.estimatedHours) || 0), 0) || 1;
    const actual = entriesAll.reduce((sum, e) => sum + (Number(e.hours) || 0), 0);
    const varianceRatio = baseline ? actual / baseline : 1;

    const entriesLast30 = entriesAll.filter((e) => {
      const d = new Date(e.date);
      return !isNaN(d) && d >= cutoff;
    });

    entriesLast30.forEach((entry) => {
      const task = ctx.taskMap.get(entry.taskId);
      const memberId = task?.assigneeId;
      if (!memberId) return;
      const hours = Math.max(0, Number(entry.hours) || 0);
      if (hours <= 0) return;
      const current = memberMap.get(memberId) || { hours: 0, weighted: 0 };
      current.hours += hours;
      current.weighted += varianceRatio * hours;
      memberMap.set(memberId, current);
    });
  });

  const rows = ctx.team.map((tm) => {
    const stats = memberMap.get(tm.id) || { hours: 0, weighted: 0 };
    const ratio = stats.hours ? stats.weighted / stats.hours : null;
    const percent = ratio != null ? Math.round(ratio * 100) : null;
    const tone = percent == null ? 'neutral' : percent <= 100 ? 'green' : percent <= 115 ? 'amber' : 'red';
    return { ...tm, hours: stats.hours, ratio, percent, tone };
  });

  return { rows, completedCount: completed.length };
}

function computeHygiene(ctx) {
  const entriesLast30 = getLast30Entries(ctx.timeEntries);
  const perMemberDates = new Map();
  entriesLast30.forEach((entry) => {
    const task = ctx.taskMap.get(entry.taskId);
    const memberId = task?.assigneeId;
    if (!memberId) return;
    const d = new Date(entry.date);
    if (isNaN(d)) return;
    const key = d.toISOString().split('T')[0];
    const set = perMemberDates.get(memberId) || new Set();
    set.add(key);
    perMemberDates.set(memberId, set);
  });
  return ctx.team.map((tm) => {
    const days = perMemberDates.get(tm.id)?.size || 0;
    const percent = Math.round((days / SERVICE_LOOKBACK_DAYS) * 100);
    return { ...tm, daysLogged: days, percent };
  });
}

function computeServiceMixByMember(ctx) {
  const entriesLast30 = getLast30Entries(ctx.timeEntries);
  const perMember = new Map();
  entriesLast30.forEach((entry) => {
    const task = ctx.taskMap.get(entry.taskId);
    const job = task ? ctx.jobMap.get(ctx.deliverableMap.get(task.deliverableId)?.jobId) : null;
    const memberId = task?.assigneeId;
    if (!memberId) return;
    const serviceTypeId = resolveServiceTypeId({ entry, task, job, serviceTypeMaps: ctx.serviceTypeMaps }) || 'other';
    const hours = Math.max(0, Number(entry.hours) || 0);
    if (hours <= 0) return;
    const bucket = perMember.get(memberId) || {};
    bucket[serviceTypeId] = (bucket[serviceTypeId] || 0) + hours;
    perMember.set(memberId, bucket);
  });

  return ctx.team.map((tm) => {
    const mix = perMember.get(tm.id) || {};
    const total = Object.values(mix).reduce((a, b) => a + b, 0);
    const sorted = Object.entries(mix).sort((a, b) => b[1] - a[1]);
    const top = sorted.slice(0, 3).map(([id, hrs]) => ({ id, hrs }));
    const otherHours = sorted.slice(3).reduce((sum, [, hrs]) => sum + hrs, 0);
    if (otherHours > 0) top.push({ id: 'other', hrs: otherHours });
    return { ...tm, total, top };
  });
}

function PerformanceTeam() {
  const serviceTypes = useMemo(() => performanceServiceTypes, []);
  const jobs = useMemo(() => enrichJobs(), []);
  const deliverables = useMemo(() => {
    const d = enrichDeliverables();
    return d.map((del) => {
      const job = jobs.find((j) => j.id === del.jobId);
      return { ...del, jobName: job?.name || `Job ${del.jobId}` };
    });
  }, [jobs]);
  const tasks = useMemo(() => performanceTasks, []);
  const timeEntries = useMemo(() => performanceTimeEntries, []);

  const ctx = useMemo(
    () => buildServiceTypeContext(serviceTypes, jobs, deliverables, tasks, timeEntries),
    [serviceTypes, jobs, deliverables, tasks, timeEntries]
  );

  const loe = useMemo(() => computeTeamLOE({ ...ctx, deliverables, team: performanceTeam }), [ctx, deliverables]);
  const hygiene = useMemo(() => computeHygiene({ ...ctx, team: performanceTeam }), [ctx]);
  const mix = useMemo(() => computeServiceMixByMember({ ...ctx, team: performanceTeam }), [ctx]);

  return h('div', { className: 'space-y-8' }, [
    h('div', { className: 'space-y-2' }, [
      h('div', { className: 'flex items-center justify-between flex-wrap gap-2' }, [
        h('h3', { className: 'text-lg font-semibold text-slate-900 dark:text-white' }, 'Team LOE Performance'),
        h('span', { className: 'text-sm text-slate-500 dark:text-slate-400' }, 'Last 30 days'),
      ]),
      h('p', { className: 'text-sm text-slate-600 dark:text-slate-300' }, 'Weighted by contributed hours on deliverables completed in the last 30 days.'),
      loe.rows.length === 0 || loe.completedCount === 0
        ? h('div', { className: 'rounded-lg border border-dashed border-slate-300 dark:border-white/15 p-4 text-sm text-slate-600 dark:text-slate-300' }, 'No completed deliverables in the last 30 days.')
        : h('div', { className: 'rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900/80 shadow-sm overflow-hidden' }, [
            h('div', { className: 'divide-y divide-slate-100 dark:divide-white/5' },
              loe.rows.map((row) => {
                const toneClass = row.tone === 'red' ? 'text-red-600 dark:text-red-300'
                  : row.tone === 'amber' ? 'text-amber-600 dark:text-amber-300'
                  : row.tone === 'green' ? 'text-emerald-600 dark:text-emerald-300'
                  : 'text-slate-500 dark:text-slate-400';
                const dotClass = row.tone === 'red' ? 'bg-red-500' : row.tone === 'amber' ? 'bg-amber-500' : 'bg-emerald-500';
                return h('div', { key: row.id, className: 'flex items-center justify-between gap-3 px-5 py-4' }, [
                  h('div', { className: 'flex items-center gap-3' }, [
                    h('div', { className: `w-2.5 h-2.5 rounded-full ${dotClass}` }),
                    h('div', { className: 'text-sm font-semibold text-slate-900 dark:text-white' }, row.name),
                  ]),
                  h('div', { className: 'text-sm text-slate-600 dark:text-slate-300 flex items-center gap-2' }, [
                    h('span', { className: `text-base font-semibold ${toneClass}` }, row.percent != null ? `${row.percent}%` : '—'),
                    h('span', { className: 'text-xs text-slate-500 dark:text-slate-400' }, row.hours ? `${Math.round(row.hours)}h weighted` : 'No recent hours'),
                  ]),
                ]);
              })
            ),
          ]),
    ]),
    h('div', { className: 'space-y-2' }, [
      h('div', { className: 'flex items-center justify-between flex-wrap gap-2' }, [
        h('h3', { className: 'text-lg font-semibold text-slate-900 dark:text-white' }, 'Time Tracking Hygiene'),
        h('span', { className: 'text-sm text-slate-500 dark:text-slate-400' }, 'Last 30 days'),
      ]),
      h('div', { className: 'rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900/80 shadow-sm overflow-hidden' }, [
        h('div', { className: 'divide-y divide-slate-100 dark:divide-white/5' },
          hygiene.map((row) =>
            h('div', { key: row.id, className: 'flex items-center justify-between gap-3 px-5 py-4' }, [
              h('div', { className: 'text-sm font-semibold text-slate-900 dark:text-white' }, row.name),
              h('div', { className: 'flex items-center gap-3 text-sm text-slate-600 dark:text-slate-300' }, [
                h('span', null, `Days logged: ${row.daysLogged} / ${SERVICE_LOOKBACK_DAYS}`),
                h('span', { className: 'text-xs text-slate-500 dark:text-slate-400' }, `${row.percent}%`),
              ]),
            ])
          )
        ),
      ]),
    ]),
    h('div', { className: 'space-y-2' }, [
      h('div', { className: 'flex items-center justify-between flex-wrap gap-2' }, [
        h('h3', { className: 'text-lg font-semibold text-slate-900 dark:text-white' }, 'Service Type Mix by Team Member'),
        h('span', { className: 'text-sm text-slate-500 dark:text-slate-400' }, 'Last 30 days'),
      ]),
      h('div', { className: 'rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900/80 shadow-sm overflow-hidden' }, [
        h('div', { className: 'divide-y divide-slate-100 dark:divide-white/5' },
          mix.map((row) =>
            h('div', { key: row.id, className: 'px-5 py-4 space-y-2' }, [
              h('div', { className: 'flex items-center justify-between' }, [
                h('div', { className: 'text-sm font-semibold text-slate-900 dark:text-white' }, row.name),
                h('div', { className: 'text-xs text-slate-500 dark:text-slate-400' }, row.total ? `${Math.round(row.total)}h` : 'No time logged in last 30 days.'),
              ]),
              row.total
                ? h('div', { className: 'flex flex-wrap gap-2' },
                    row.top.map((item) => {
                      const st = ctx.serviceTypeMaps.byId.get(item.id);
                      const label = item.id === 'other' ? 'Other' : (st?.name || item.id);
                      const pct = Math.round((item.hrs / row.total) * 100);
                      return h('span', { key: `${row.id}-${item.id}`, className: 'inline-flex items-center gap-2 rounded-full bg-slate-100 dark:bg-slate-800 text-xs text-slate-700 dark:text-slate-200 px-3 py-1' }, [
                        h('span', { className: 'font-semibold' }, label),
                        h('span', null, `${pct}%`),
                      ]);
                    })
                  )
                : null,
            ])
          )
        ),
      ]),
    ]),
  ]);
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

  const [exportOpen, setExportOpen] = React.useState(false);
  const customBtnRef = React.useRef(null);
  const [pickerOpen, setPickerOpen] = React.useState(false);
  const [pickerAnchor, setPickerAnchor] = React.useState(null);
  const [pickerInitial, setPickerInitial] = React.useState({ start: '', end: '' });
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

function ReportsShell({ report, queryString }) {
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
          ? h(SalesReport, { state: reportState })
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

function buildTimeContext() {
  const teamMap = new Map(performanceTeam.map((m) => [m.id, m]));
  const jobMap = new Map(performanceJobs.map((j) => [j.id, j]));
  const deliverableMap = new Map(performanceDeliverables.map((d) => [d.id, d]));
  const taskMap = new Map(performanceTasks.map((t) => [t.id, t]));
  return { teamMap, jobMap, deliverableMap, taskMap };
}

function enrichTimeEntriesForRange(range) {
  const ctx = buildTimeContext();
  const entries = performanceTimeEntries.map((entry, idx) => {
    const task = entry.taskId ? ctx.taskMap.get(entry.taskId) : null;
    const deliverable = task ? ctx.deliverableMap.get(task.deliverableId) : null;
    const job = deliverable ? ctx.jobMap.get(deliverable.jobId) : null;
    const memberId = entry.memberId || task?.assigneeId || null;
    const member = memberId ? ctx.teamMap.get(memberId) : null;
    const serviceTypeId = entry.serviceTypeId || resolveServiceTypeId({ entry, task, job, serviceTypeMaps: buildServiceTypeMaps(performanceServiceTypes) });
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

// -----------------------------------------------------------------------------
// Reports: Sales
// -----------------------------------------------------------------------------

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
  const isDark = document.documentElement.classList.contains('dark');
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

function SalesReport({ state }) {
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

function PerformanceServiceTypes() {
  const serviceTypes = useMemo(() => performanceServiceTypes, []);
  const jobs = useMemo(() => enrichJobs(), []);
  const deliverables = useMemo(() => enrichDeliverables(), []);
  const tasks = useMemo(() => performanceTasks, []);
  const timeEntries = useMemo(() => performanceTimeEntries, []);

  const ctx = useMemo(
    () => buildServiceTypeContext(serviceTypes, jobs, deliverables, tasks, timeEntries),
    [serviceTypes, jobs, deliverables, tasks, timeEntries]
  );
  const effortMix = useMemo(() => computeEffortMixLast30Days(ctx), [ctx]);
  const atRiskDeliverables = useMemo(() => deliverables.filter((d) => d.atRisk), [deliverables]);
  const riskClusters = useMemo(() => buildRiskClusters(atRiskDeliverables, ctx), [atRiskDeliverables, ctx]);
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    if (selected && serviceTypes.find((st) => st.id === selected)) return;
    if (effortMix.items.length) {
      setSelected(effortMix.items[0].id);
    } else if (serviceTypes[0]) {
      setSelected(serviceTypes[0].id);
    }
  }, [selected, effortMix.items, serviceTypes]);

  const drilldown = useMemo(() => buildDrilldown(selected, atRiskDeliverables, ctx), [selected, atRiskDeliverables, ctx]);
  const selectedLabel = useMemo(
    () => serviceTypes.find((st) => st.id === selected)?.name || 'Service Types',
    [serviceTypes, selected]
  );

  const goDeliverable = (del) => navigate(`#/app/performance/job/${del.jobId}?deliverable=${del.id}`);

  return h('div', { className: 'space-y-8' }, [
    h('div', { className: 'space-y-3' }, [
      h('div', { className: 'flex items-center justify-between flex-wrap gap-2' }, [
        h('h3', { className: 'text-lg font-semibold text-slate-900 dark:text-white' }, 'Service Type Effort Mix'),
        h('span', { className: 'text-sm text-slate-500 dark:text-slate-400' }, 'Last 30 days'),
      ]),
      effortMix.totalHours === 0
        ? h('div', { className: 'rounded-lg border border-dashed border-slate-300 dark:border-white/15 p-4 text-sm text-slate-600 dark:text-slate-300' }, 'No service type activity in the last 30 days.')
        : h('div', { className: 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4' },
          effortMix.items.map((item) =>
            h('button', {
              key: item.id,
              type: 'button',
              'data-demo': 'service-type-card',
              className: [
                'text-left rounded-xl border bg-white dark:bg-slate-900/80 shadow-sm p-4 transition',
                'border-slate-200 dark:border-white/10 hover:border-netnet-purple/70',
                selected === item.id ? 'ring-2 ring-netnet-purple border-netnet-purple/70' : '',
              ].join(' '),
              onClick: () => setSelected(item.id),
            }, [
              h('div', { className: 'text-sm font-semibold text-slate-900 dark:text-white' }, item.name),
              h('div', { className: 'mt-2 text-2xl font-bold text-slate-900 dark:text-white' }, `${Math.round(item.hours)}h`),
              h('div', { className: 'text-xs text-slate-500 dark:text-slate-400' }, `${item.percent}% of last 30 days`),
            ])
          )
        ),
    ]),
    h('div', { className: 'space-y-3' }, [
      h('div', { className: 'flex items-center justify-between flex-wrap gap-2' }, [
        h('h3', { className: 'text-lg font-semibold text-slate-900 dark:text-white' }, 'Service Type Risk Clustering'),
        h('span', { className: 'text-sm text-slate-500 dark:text-slate-400' }, 'Current at-risk deliverables'),
      ]),
      riskClusters.length === 0
        ? h('div', { className: 'rounded-lg border border-dashed border-slate-300 dark:border-white/15 p-4 text-sm text-slate-600 dark:text-slate-300' }, 'No at-risk deliverables right now.')
        : h('div', { className: 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4' },
          riskClusters.map((item) =>
            h('button', {
              key: item.id,
              type: 'button',
              className: [
                'text-left rounded-xl border bg-white dark:bg-slate-900/80 shadow-sm p-4 transition',
                'border-slate-200 dark:border-white/10 hover:border-netnet-purple/70',
                selected === item.id ? 'ring-2 ring-netnet-purple border-netnet-purple/70' : '',
              ].join(' '),
              onClick: () => setSelected(item.id),
            }, [
              h('div', { className: 'flex items-center justify-between' }, [
                h('div', { className: 'text-sm font-semibold text-slate-900 dark:text-white' }, item.name),
              ]),
              h('div', { className: 'mt-1 text-2xl font-bold text-slate-900 dark:text-white' }, `${Math.round(item.hours)}h at risk`),
              h('div', { className: 'text-sm text-slate-600 dark:text-slate-300' }, `${item.count} items`),
              h('div', { className: 'text-xs text-slate-500 dark:text-slate-400' }, 'Includes overdue / >85% effort or timeline'),
            ])
          )
        ),
    ]),
    h('div', { className: 'space-y-3' }, [
      h('div', { className: 'flex items-center justify-between flex-wrap gap-2' }, [
        h('h3', { className: 'text-lg font-semibold text-slate-900 dark:text-white' }, `At-risk deliverables contributing to ${selectedLabel}`),
        h('span', { className: 'text-sm text-slate-500 dark:text-slate-400' }, `${drilldown.length} items`),
      ]),
      drilldown.length === 0
        ? h('div', { className: 'rounded-lg border border-dashed border-slate-300 dark:border-white/15 p-4 text-sm text-slate-600 dark:text-slate-300' }, `No at-risk deliverables contributing to ${selectedLabel}.`)
        : h('div', { className: 'rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900/80 shadow-sm overflow-hidden' }, [
            h('div', { className: 'divide-y divide-slate-100 dark:divide-white/5' },
              drilldown.map(({ deliverable, share, sharePct }) => {
                const job = jobs.find((j) => j.id === deliverable.jobId);
                const shareLabel = sharePct != null ? `${sharePct}% of effort` : `${Math.round(share)}h`;
                return h('div', {
                  key: deliverable.id,
                  className: 'px-5 py-4 flex flex-col md:flex-row md:items-center md:justify-between gap-3 hover:bg-slate-50 dark:hover:bg-slate-800/40 cursor-pointer',
                  onClick: () => goDeliverable(deliverable),
                }, [
                  h('div', { className: 'space-y-1' }, [
                    h('div', { className: 'text-sm font-semibold text-slate-900 dark:text-white' }, `${job?.name || `Job ${deliverable.jobId}`}`),
                    h('div', { className: 'text-sm text-slate-600 dark:text-slate-300' }, deliverable.name),
                    h('div', { className: 'flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400' }, [
                      deliverable.originalDue
                        ? h(MovedDateIndicator, {
                            originalDate: deliverable.originalDue,
                            newDate: deliverable.due,
                            changedAt: deliverable.changedAt || 'Updated recently',
                            changedBy: deliverable.owner,
                          })
                        : h('span', null, deliverable.due),
                      deliverable.overdue
                        ? h('span', { className: 'text-xs font-semibold text-red-600 dark:text-red-300' }, 'Overdue')
                        : deliverable.dueSoon
                          ? h('span', { className: 'text-xs font-semibold text-amber-600 dark:text-amber-300' }, 'Due soon')
                          : null,
                    ]),
                  ]),
                  h('div', { className: 'flex items-center gap-4 w-full md:w-auto' }, [
                    h('div', { className: 'min-w-[160px]' },
                      h(StackedMeter, {
                        variant: 'inline',
                        showHeader: false,
                        effort: { actual: Math.round(deliverable.effortConsumed || 0), baseline: 100, unit: '%' },
                        timeline: { actual: Math.round(deliverable.durationConsumed || 0), baseline: 100, unit: '%' },
                        completed: deliverable.status === 'completed',
                      })
                    ),
                    h('div', { className: 'text-xs text-slate-500 dark:text-slate-400' }, shareLabel),
                  ]),
                ]);
              })
            ),
          ]),
    ]),
  ]);
}
function PerformanceComingSoon({ tab }) {
  return h('div', { className: 'max-w-4xl mx-auto px-4 py-10 lg:py-14 space-y-4 text-center text-slate-600 dark:text-slate-300' }, [
    h('p', { className: 'text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400' }, 'Performance'),
    h('h1', { className: 'text-2xl font-bold text-slate-900 dark:text-white' }, tab),
    h('p', { className: 'text-sm' }, 'This view is coming next.'),
  ]);
}

function PerformanceJobPlaceholder({ jobId }) {
  return h('div', { className: 'max-w-4xl mx-auto px-4 py-10 lg:py-14 space-y-4' }, [
    h('p', { className: 'text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400' }, 'Performance'),
    h('h1', { className: 'text-2xl font-bold text-slate-900 dark:text-white' }, `Job Report #${jobId}`),
    h('p', { className: 'text-sm text-slate-600 dark:text-slate-300' }, 'Job report coming next. Deliverable focus supported via query params.'),
  ]);
}

function PerformanceShell({ path, queryString }) {
  const normalizedPath = path || 'overview';
  const isJob = normalizedPath.startsWith('job/');
  const TITLE_MAP = {
    overview: 'Overview',
    capacity: 'Capacity & Forecast',
    'service-types': 'Service Types',
    team: 'Team',
    reports: 'Reports',
  };
  const resolvedLabel = isJob ? 'Job Report' : (TITLE_MAP[normalizedPath] || 'Performance');
  const headerTitle = h('div', { className: 'flex items-center gap-2' }, [
    h('span', { className: 'text-sm text-slate-500 dark:text-white/70' }, 'Performance'),
    h('span', { className: 'text-slate-400 dark:text-white/50' }, '›'),
    h('span', { className: 'text-2xl font-semibold text-slate-900 dark:text-white' }, resolvedLabel),
  ]);
  const activeSwitcherValue = normalizedPath.startsWith('reports')
    ? 'reports'
    : (PERFORMANCE_SWITCHER.find((opt) => opt.value === normalizedPath)?.value || 'overview');

  useEffect(() => {
    const headerRoot = document.getElementById('section-header-root');
    if (!headerRoot) return;
    if (!window.__performanceHeaderRoot) {
      window.__performanceHeaderRoot = createRoot(headerRoot);
    }
    window.__performanceHeaderRoot.render(h(SectionHeader, {
      title: headerTitle,
      showHelpIcon: true,
      switcherOptions: PERFORMANCE_SWITCHER,
      switcherValue: isJob ? 'overview' : activeSwitcherValue,
      onSwitcherChange: (val) => {
        const target = `#/app/performance/${val}`;
        navigate(target);
      },
      showSecondaryRow: true,
      videoHelpConfig: {
        primary: {
          title: 'Performance overview',
          description: 'Dashboards, reports, and actions.',
          videoUrl: 'https://videos.hellonetnet.com/watch/wo5umvj3',
        },
      },
    }));
  }, [path]);

  const content = (() => {
    if (isJob) {
      const id = normalizedPath.replace('job/', '') || '—';
      return h(PerformanceJobPlaceholder, { jobId: id });
    }
    if (normalizedPath === 'overview') {
      return h(PerformanceOverview, { queryString });
    }
    if (normalizedPath === 'capacity') {
      return h(CapacityForecast, { queryString });
    }
    if (normalizedPath === 'service-types') {
      return h(PerformanceServiceTypes, { queryString });
    }
    if (normalizedPath === 'team') {
      return h(PerformanceTeam, { queryString });
    }
    if (normalizedPath.startsWith('reports')) {
      const reportPath = normalizedPath.replace('reports/', '') || 'time';
      const activeReport = REPORTS_TABS.find((r) => r.value === reportPath)?.value || 'time';
      return h(ReportsShell, { report: activeReport, queryString });
    }
    return h(PerformanceComingSoon, { tab: PERFORMANCE_SWITCHER.find((s) => s.value === normalizedPath)?.label || 'Performance' });
  })();

  return h('div', { className: 'max-w-6xl mx-auto px-4 py-6 lg:py-8 space-y-8' }, [
    h('div', { id: 'section-header-root' }),
    content,
  ]);
}

export function renderPerformancePage(container = document.getElementById('app-main')) {
  if (!container) return;

  const rawHash = location.hash || '';
  if (rawHash === '#/app/performance' || rawHash === '#/app/performance/') {
    navigate('#/app/performance/overview');
    return;
  }

  const { path, queryString } = parsePerformanceRoute(location.hash);

  if (!path || path === '') {
    navigate('#/app/performance/overview');
    return;
  }

  if (!root) root = createRoot(container);
  root.render(h(PerformanceShell, { path, queryString }));
}
function capacityFromHorizon(monthlyHours, horizonDays) {
  const daysInMonth = 30;
  return Math.round((monthlyHours / daysInMonth) * horizonDays);
}

function computeDemand({ horizonDays, jobs, deliverables, tasks }) {
  const today = new Date();
  const horizonEnd = new Date(today.getTime() + horizonDays * 24 * 60 * 60 * 1000);

  let totalDemand = 0;
  let unassignedDemand = 0;
  let unknownDemand = 0;
  const perMember = {};
  const serviceTypeDemand = {};

  const deliverableMap = new Map(deliverables.map((d) => [d.id, d]));
  const jobMap = new Map(jobs.map((j) => [j.id, j]));

  tasks.forEach((task) => {
    const del = deliverableMap.get(task.deliverableId);
    if (!del) return;
    const job = jobMap.get(del.jobId);
    if (!job || (job.status !== 'active' && job.status !== 'pending')) return;
    const dueDate = new Date(del.due);
    if (isNaN(dueDate) || dueDate < today || dueDate > horizonEnd) return;

    let remaining = 0;
    const hasRemaining = Number.isFinite(task.remainingHours) && task.remainingHours > 0;
    const hasEst = Number.isFinite(task.estimatedHours);
    const actual = Number.isFinite(task.actualHours) ? task.actualHours : 0;

    if (hasRemaining) {
      remaining = task.remainingHours;
    } else if (hasEst) {
      remaining = Math.max(0, task.estimatedHours - actual);
    } else if (Number.isFinite(del.effortConsumed) && Number.isFinite(del.estHours)) {
      remaining = Math.max(0, (del.estHours || 0) - ((del.effortConsumed / 100) * (del.estHours || 0)));
    } else {
      unknownDemand += 0; // fallthrough handled below
    }

    if (!hasRemaining && !hasEst && (!Number.isFinite(del.estHours) || del.estHours === 0)) {
      unknownDemand += 4; // small placeholder to surface unknowns
    }

    if (remaining <= 0) {
      unknownDemand += 2; // still consider as unknown
      return;
    }

    totalDemand += remaining;

    if (task.assigneeId) {
      perMember[task.assigneeId] = (perMember[task.assigneeId] || 0) + remaining;
    } else {
      unassignedDemand += remaining;
    }

    const svc = job?.serviceType || del?.serviceType || 'Mixed';
    serviceTypeDemand[svc] = (serviceTypeDemand[svc] || 0) + remaining;
  });

  return { totalDemand, perMember, unassignedDemand, unknownDemand, serviceTypeDemand };
}
