export const REPORTS_TABS = [
  { label: 'Time', value: 'time' },
  { label: 'Team', value: 'team' },
  { label: 'Sales', value: 'sales' },
  { label: 'Job', value: 'job' },
];

export const REPORT_DEFAULT_RANGE = 'last-30';
export const REPORT_DEFAULT_GROUP = 'service-type';
export const REPORT_COLORS = ['#6D28D9', '#0EA5E9', '#22C55E', '#F59E0B', '#F97316', '#EF4444', '#14B8A6'];

export function parseReportState(queryString = '', defaultGroup = REPORT_DEFAULT_GROUP) {
  const params = new URLSearchParams(queryString);
  const range = params.get('range') || REPORT_DEFAULT_RANGE;
  const compare = params.get('compare') === '1';
  const groupBy = params.get('groupBy') || defaultGroup;
  const start = params.get('start') || '';
  const end = params.get('end') || '';
  return { range, compare, groupBy, start, end };
}

export function updateReportQuery(next) {
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

export function getReportRange(state) {
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

export function getPreviousRange(range) {
  const length = range.days;
  const end = new Date(range.start);
  end.setDate(end.getDate() - 1);
  const start = new Date(end);
  start.setDate(end.getDate() - (length - 1));
  return { start, end, days: length };
}

function pad2(n) {
  return String(n).padStart(2, '0');
}

export function formatISODate(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return '';
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

export function parseISODate(iso) {
  if (!iso || typeof iso !== 'string') return null;
  const parts = iso.split('-').map((p) => parseInt(p, 10));
  if (parts.length !== 3 || parts.some((p) => !Number.isFinite(p))) return null;
  const [y, m, d] = parts;
  return new Date(y, m - 1, d);
}

export function addDays(date, days) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

export function addMonths(date, months) {
  return new Date(date.getFullYear(), date.getMonth() + months, 1);
}

export function isSameDay(a, b) {
  if (!(a instanceof Date) || !(b instanceof Date)) return false;
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

export function isBeforeDay(a, b) {
  if (!(a instanceof Date) || !(b instanceof Date)) return false;
  const ax = new Date(a.getFullYear(), a.getMonth(), a.getDate()).getTime();
  const bx = new Date(b.getFullYear(), b.getMonth(), b.getDate()).getTime();
  return ax < bx;
}

export function isBetweenInclusive(day, start, end) {
  if (!(day instanceof Date) || !(start instanceof Date) || !(end instanceof Date)) return false;
  const dx = new Date(day.getFullYear(), day.getMonth(), day.getDate()).getTime();
  const sx = new Date(start.getFullYear(), start.getMonth(), start.getDate()).getTime();
  const ex = new Date(end.getFullYear(), end.getMonth(), end.getDate()).getTime();
  return dx >= sx && dx <= ex;
}

export function getMonthGrid(monthDate) {
  const year = monthDate.getFullYear();
  const month = monthDate.getMonth();
  const first = new Date(year, month, 1);
  const startOffset = first.getDay();
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

export function getPresetRange(presetId, today) {
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
