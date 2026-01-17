export function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function formatDateLabel(dateStr) {
  if (!dateStr) return '-';
  const date = new Date(dateStr);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export function formatShortDate(dateStr) {
  if (!dateStr) return '-';
  const date = new Date(dateStr);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function formatHours(value) {
  const num = Number(value);
  if (!Number.isFinite(num)) return '-';
  const rounded = Math.round(num * 10) / 10;
  return `${rounded}h`;
}

export function getDisplayName(member) {
  if (!member) return '';
  const full = [member.firstName, member.lastName].filter(Boolean).join(' ').trim();
  return full || member.name || member.email || '';
}

export function getInitials(name) {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
  const initials = parts.slice(0, 2).map((part) => part[0]).join('');
  return (initials || 'NN').toUpperCase();
}

export function renderAvatar(member, { sizeClass = 'h-7 w-7', textClass = 'text-[10px]', showTooltip = true } = {}) {
  const name = getDisplayName(member);
  const tooltip = showTooltip && name ? ` data-tooltip="${escapeHtml(name)}" tabindex="0" aria-label="${escapeHtml(name)}"` : '';
  if (member?.photoDataUrl) {
    return `
      <span class="inline-flex items-center justify-center ${sizeClass} rounded-full overflow-hidden border border-slate-200 dark:border-white/10 bg-white/80"${tooltip}>
        <img src="${escapeHtml(member.photoDataUrl)}" alt="${escapeHtml(name || 'User')}" class="h-full w-full object-cover" />
      </span>
    `;
  }
  return `
    <span class="inline-flex items-center justify-center ${sizeClass} rounded-full bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 font-semibold ${textClass}"${tooltip}>
      ${escapeHtml(getInitials(name || member?.name || ''))}
    </span>
  `;
}

export function renderStatusPill(status) {
  const normalized = status === 'completed' ? 'completed' : status === 'in_progress' ? 'in_progress' : 'backlog';
  const label = normalized === 'in_progress' ? 'In Progress' : normalized === 'completed' ? 'Completed' : 'Backlog';
  const color = normalized === 'completed'
    ? 'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-200 dark:border-emerald-500/30'
    : normalized === 'in_progress'
      ? 'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-500/10 dark:text-amber-200 dark:border-amber-500/30'
      : 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-500/10 dark:text-slate-200 dark:border-slate-500/30';
  return `<span class="inline-flex items-center whitespace-nowrap rounded-full border px-2 py-0.5 text-[11px] font-semibold ${color}">${label}</span>`;
}

function parseLocalDate(dateStr) {
  if (!dateStr) return null;
  const parts = String(dateStr).split('-').map((part) => Number(part));
  if (parts.length !== 3 || parts.some((val) => Number.isNaN(val))) return null;
  return new Date(parts[0], parts[1] - 1, parts[2]);
}

function formatHourValue(value) {
  const num = Number(value);
  if (!Number.isFinite(num)) return '-';
  const rounded = Math.round(num * 10) / 10;
  return `${rounded}`.replace(/\.0$/, '');
}

function getDueMeta(dateStr) {
  const target = parseLocalDate(dateStr);
  if (!target) {
    return { label: '-', percent: 0, color: 'bg-slate-300 dark:bg-white/10', tooltip: 'No due date' };
  }
  const today = new Date();
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const diffDays = Math.ceil((target.getTime() - start.getTime()) / (24 * 60 * 60 * 1000));
  const percent = Math.max(10, Math.min(100, Math.round(100 - (Math.min(Math.max(diffDays, 0), 14) / 14) * 100)));
  const color = diffDays < 0
    ? 'bg-rose-500'
    : diffDays <= 3
      ? 'bg-amber-500'
      : 'bg-emerald-500';
  return {
    label: formatShortDate(dateStr),
    percent,
    color,
    tooltip: `Due ${formatDateLabel(dateStr)}`,
  };
}

export function renderMiniMeters(task, actualHours) {
  const estimate = Number(task?.loeHours);
  const actual = Number(actualHours);
  const estimateLabel = Number.isFinite(estimate) ? `${formatHourValue(estimate)}h` : '-';
  const actualLabel = Number.isFinite(actual) ? formatHourValue(actual) : '-';
  const loePercent = Number.isFinite(estimate) && estimate > 0 && Number.isFinite(actual)
    ? Math.min(100, Math.round((actual / estimate) * 100))
    : 0;
  const loeColor = Number.isFinite(estimate) && Number.isFinite(actual) && estimate > 0 && actual > estimate
    ? 'bg-rose-500'
    : loePercent >= 80
      ? 'bg-amber-500'
      : 'bg-emerald-500';
  const loeTooltip = Number.isFinite(estimate) && estimate > 0 && Number.isFinite(actual)
    ? `LOE: ${formatHourValue(actual)}h of ${estimateLabel} (${Math.min(999, Math.round((actual / estimate) * 100))}%)`
    : 'LOE: -';
  const dueMeta = getDueMeta(task?.dueDate);
  return `
    <div class="space-y-2 min-w-[140px]">
      <div class="space-y-1" data-tooltip="${escapeHtml(loeTooltip)}" tabindex="0">
        <div class="h-1.5 w-full rounded-full bg-slate-200 dark:bg-white/10 overflow-hidden">
          <div class="${loeColor} h-full rounded-full" style="width:${loePercent}%"></div>
        </div>
        <div class="text-[11px] text-slate-600 dark:text-slate-300">LOE ${escapeHtml(actualLabel)} / ${escapeHtml(estimateLabel)}</div>
      </div>
      <div class="space-y-1" data-tooltip="${escapeHtml(dueMeta.tooltip)}" tabindex="0">
        <div class="h-1.5 w-full rounded-full bg-slate-200 dark:bg-white/10 overflow-hidden">
          <div class="${dueMeta.color} h-full rounded-full" style="width:${dueMeta.percent}%"></div>
        </div>
        <div class="text-[11px] text-slate-600 dark:text-slate-300">Due ${escapeHtml(dueMeta.label)}</div>
      </div>
    </div>
  `;
}
