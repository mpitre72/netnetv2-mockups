function normalizeText(value) {
  return String(value || '').trim().toLowerCase();
}

export function startOfLocalDay(value = new Date()) {
  return new Date(value.getFullYear(), value.getMonth(), value.getDate());
}

export function parseIsoLocal(value) {
  const iso = String(value || '').trim();
  if (!iso) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!match) return null;
  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
}

export function shiftDays(base, days) {
  const next = startOfLocalDay(base);
  next.setDate(next.getDate() + days);
  return next;
}

export function toLocalIso(date) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function toMonthKey(date) {
  return `${date.getFullYear()}-${`${date.getMonth() + 1}`.padStart(2, '0')}`;
}

export function monthKeyToDate(monthKey) {
  const match = /^(\d{4})-(\d{2})$/.exec(String(monthKey || ''));
  if (!match) return startOfLocalDay();
  return new Date(Number(match[1]), Number(match[2]) - 1, 1);
}

export function formatMonthLabel(monthKey) {
  return monthKeyToDate(monthKey).toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
}

export function getPreviousMonthKey(monthKey) {
  const date = monthKeyToDate(monthKey);
  date.setMonth(date.getMonth() - 1);
  return toMonthKey(date);
}

export function minutesToHours(minutes) {
  return (Math.max(0, Number(minutes) || 0) / 60);
}

export function formatDurationMinutes(minutes) {
  const hours = Math.round(minutesToHours(minutes) * 100) / 100;
  return `${hours % 1 ? hours.toFixed(1) : hours}`.replace(/\.0$/, '') + 'h';
}

export function formatFixedDurationHours(minutes) {
  const hours = Math.max(0, Number(minutes) || 0) / 60;
  return hours.toFixed(2);
}

export function formatDurationDraftValue(minutes) {
  const hours = Math.round(minutesToHours(minutes) * 100) / 100;
  return hours.toFixed(2).replace(/\.?0+$/, '');
}

export function formatDateLabel(value) {
  const date = parseIsoLocal(value);
  if (!date) return '';
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

export function formatEarlierWeekLabel(value) {
  const date = parseIsoLocal(value);
  if (!date) return '';
  return date.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' });
}

export function buildTaskContext(entry) {
  const parts = [entry.jobName, entry.deliverableName].filter(Boolean);
  return parts.join(' > ');
}

export function startOfWeekSunday(value = new Date()) {
  const date = startOfLocalDay(value);
  date.setDate(date.getDate() - date.getDay());
  return date;
}

export function sortEntriesNewestFirst(entries = []) {
  return [...entries].sort((a, b) => {
    const byDate = b.dateObj.getTime() - a.dateObj.getTime();
    if (byDate !== 0) return byDate;
    return String(b.endTime || b.startTime || '').localeCompare(String(a.endTime || a.startTime || ''));
  });
}

export function uniqueSorted(values = []) {
  return [...new Set(values.filter(Boolean))].sort((a, b) => String(a).localeCompare(String(b)));
}

export function sumDurationMinutes(entries = []) {
  return entries.reduce((sum, entry) => sum + Math.max(0, Number(entry?.duration_minutes) || 0), 0);
}

export function prepareMyTimeEntries(entries = []) {
  return sortEntriesNewestFirst(entries
    .map((entry) => {
      const dateObj = parseIsoLocal(entry.date);
      return {
        ...entry,
        dateObj,
        monthKey: dateObj ? toMonthKey(dateObj) : '',
        searchIndex: normalizeText([
          entry.taskTitle,
          entry.jobName,
          entry.deliverableName,
          entry.companyName,
          entry.notes,
        ].join(' ')),
      };
    })
    .filter((entry) => entry.dateObj));
}

export function isEntryInCurrentWeek(entry, now = new Date()) {
  if (!entry?.dateObj) return false;
  const start = startOfWeekSunday(now);
  const end = startOfLocalDay(now);
  return entry.dateObj >= start && entry.dateObj <= end;
}

export function groupWeeklyEntries(entries = [], now = new Date()) {
  const today = startOfLocalDay(now);
  const todayIso = toLocalIso(today);
  const yesterdayIso = toLocalIso(shiftDays(today, -1));
  const allowYesterdayLabel = today.getDay() !== 0;
  const groups = [];

  const todayEntries = entries.filter((entry) => entry.date === todayIso);
  if (todayEntries.length) {
    groups.push({
      key: 'today',
      label: 'Today',
      entries: todayEntries,
      subtotalMinutes: sumDurationMinutes(todayEntries),
    });
  }

  if (allowYesterdayLabel) {
    const yesterdayEntries = entries.filter((entry) => entry.date === yesterdayIso);
    if (yesterdayEntries.length) {
      groups.push({
        key: 'yesterday',
        label: 'Yesterday',
        entries: yesterdayEntries,
        subtotalMinutes: sumDurationMinutes(yesterdayEntries),
      });
    }
  }

  const earlierEntries = entries.filter((entry) => entry.date !== todayIso && (!allowYesterdayLabel || entry.date !== yesterdayIso));
  const byDate = earlierEntries.reduce((map, entry) => {
    const key = entry.date;
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(entry);
    return map;
  }, new Map());

  [...byDate.keys()]
    .sort((a, b) => String(b).localeCompare(String(a)))
    .forEach((dateKey) => {
      const dateEntries = byDate.get(dateKey) || [];
      groups.push({
        key: `date-${dateKey}`,
        label: formatEarlierWeekLabel(dateKey),
        entries: dateEntries,
        subtotalMinutes: sumDurationMinutes(dateEntries),
      });
    });

  return groups;
}

export function filterEntries(entries = [], filters) {
  const searchNeedle = normalizeText(filters.search);
  return entries.filter((entry) => {
    if (filters.job !== 'all' && entry.jobName !== filters.job) return false;
    if (filters.company !== 'all' && entry.companyName !== filters.company) return false;
    if (filters.context !== 'all' && entry.contextType !== filters.context) return false;
    if (searchNeedle && !entry.searchIndex.includes(searchNeedle)) return false;
    return true;
  });
}

export function parseDecimalDurationToMinutes(input) {
  const trimmed = String(input || '').trim();
  if (!trimmed) return { valid: false, minutes: 0 };
  const numericValue = Number(trimmed);
  if (!Number.isFinite(numericValue) || numericValue <= 0) {
    return { valid: false, minutes: 0 };
  }
  return { valid: true, minutes: Math.round(numericValue * 60) };
}

export function parseClockDurationToMinutes(input) {
  const trimmed = String(input || '').trim();
  if (!trimmed) return { valid: false, minutes: 0 };
  const match = /^(\d+):([0-5]\d)$/.exec(trimmed);
  if (!match) return { valid: false, minutes: 0 };
  const hours = Number(match[1]) || 0;
  const minutes = Number(match[2]) || 0;
  const totalMinutes = (hours * 60) + minutes;
  if (totalMinutes <= 0) return { valid: false, minutes: 0 };
  return { valid: true, minutes: totalMinutes };
}

export function parseDurationInputToMinutes(input) {
  return String(input || '').includes(':')
    ? parseClockDurationToMinutes(input)
    : parseDecimalDurationToMinutes(input);
}

export function buildMyTimeViewModel({
  entries = [],
  effectiveUserId = '',
  loadedMonthKeys = [],
  filters = {},
  now = new Date(),
} = {}) {
  const preparedEntries = prepareMyTimeEntries(entries);
  const selectedUserEntries = preparedEntries.filter((entry) => String(entry.userId) === String(effectiveUserId));
  const weeklyCandidateEntries = selectedUserEntries.filter((entry) => isEntryInCurrentWeek(entry, now));
  const loadedMonthCandidateEntries = selectedUserEntries.filter((entry) => loadedMonthKeys.includes(entry.monthKey));

  const candidateMap = new Map();
  [...weeklyCandidateEntries, ...loadedMonthCandidateEntries].forEach((entry) => {
    candidateMap.set(entry.id, entry);
  });
  const candidateEntries = sortEntriesNewestFirst([...candidateMap.values()]);
  const availableJobs = uniqueSorted(candidateEntries.map((entry) => entry.jobName));
  const availableCompanies = uniqueSorted(
    candidateEntries
      .filter((entry) => entry.contextType === 'client')
      .map((entry) => entry.companyName),
  );

  const filteredCandidateEntries = filterEntries(candidateEntries, filters);
  const weeklyEntries = filteredCandidateEntries.filter((entry) => isEntryInCurrentWeek(entry, now));
  const weeklyGroups = groupWeeklyEntries(weeklyEntries, now);
  const weeklyTotalMinutes = sumDurationMinutes(weeklyEntries);
  const weeklyEntryIds = new Set(weeklyEntries.map((entry) => entry.id));
  const monthSections = loadedMonthKeys.map((monthKey) => {
    const rows = sortEntriesNewestFirst(
      filteredCandidateEntries.filter((entry) => entry.monthKey === monthKey && !weeklyEntryIds.has(entry.id)),
    );
    return {
      key: monthKey,
      title: formatMonthLabel(monthKey),
      rows,
      totalMinutes: sumDurationMinutes(rows),
    };
  });

  return {
    availableCompanies,
    availableJobs,
    candidateEntries,
    filteredCandidateEntries,
    monthSections,
    preparedEntries,
    selectedUserEntries,
    weeklyEntries,
    weeklyGroups,
    weeklyTotalMinutes,
  };
}
