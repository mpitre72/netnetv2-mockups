const { createElement: h } = React;

function clampPercent(value) {
  const num = Number.isFinite(value) ? value : 0;
  if (num < 0) return 0;
  if (num > 200) return 200; // allow small overflow for visual emphasis
  return num;
}

function getMeterColors(percent) {
  if (percent > 100) {
    return { bar: 'bg-red-500', text: 'text-red-600 dark:text-red-300' };
  }
  if (percent >= 85) {
    return { bar: 'bg-amber-500', text: 'text-amber-600 dark:text-amber-300' };
  }
  return { bar: 'bg-emerald-500', text: 'text-emerald-600 dark:text-emerald-300' };
}

export function renderEffortTimelineMeter({
  effortPercent = 0,
  timelinePercent = 0,
  effortLabel = 'Effort',
  timelineLabel = 'Timeline',
  summaryText,
} = {}) {
  const safeEffort = clampPercent(effortPercent);
  const safeTimeline = clampPercent(timelinePercent);
  const effortColors = getMeterColors(safeEffort);
  const timelineColors = getMeterColors(safeTimeline);

  return `
    <div class="flex flex-col gap-2 min-w-[220px]">
      ${summaryText ? `<div class="text-[11px] font-mono text-slate-500 dark:text-slate-400">${summaryText}</div>` : ''}
      <div class="space-y-1">
        <div class="flex items-center justify-between text-[11px] uppercase tracking-wide text-slate-500 dark:text-slate-400">
          <span>${effortLabel}</span>
          <span class="font-semibold ${effortColors.text}">${Math.round(safeEffort)}%</span>
        </div>
        <div class="h-2 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
          <div class="${effortColors.bar} h-full rounded-full transition-all" style="width:${Math.min(safeEffort, 120)}%"></div>
        </div>
      </div>
      <div class="space-y-1">
        <div class="flex items-center justify-between text-[11px] uppercase tracking-wide text-slate-500 dark:text-slate-400">
          <span>${timelineLabel}</span>
          <span class="font-semibold ${timelineColors.text}">${Math.round(safeTimeline)}%</span>
        </div>
        <div class="h-2 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
          <div class="${timelineColors.bar} h-full rounded-full transition-all" style="width:${Math.min(safeTimeline, 120)}%"></div>
        </div>
      </div>
    </div>
  `;
}

export function EffortTimelineMeterReact(props = {}) {
  const {
    effortPercent = 0,
    timelinePercent = 0,
    effortLabel = 'Effort',
    timelineLabel = 'Timeline',
    summaryText,
  } = props;

  const safeEffort = clampPercent(effortPercent);
  const safeTimeline = clampPercent(timelinePercent);
  const effortColors = getMeterColors(safeEffort);
  const timelineColors = getMeterColors(safeTimeline);

  return h(
    'div',
    { className: 'flex flex-col gap-2 min-w-[220px]' },
    [
      summaryText
        ? h('div', { className: 'text-[11px] font-mono text-slate-500 dark:text-slate-400' }, summaryText)
        : null,
      h('div', { className: 'space-y-1' }, [
        h(
          'div',
          { className: 'flex items-center justify-between text-[11px] uppercase tracking-wide text-slate-500 dark:text-slate-400' },
          [
            h('span', null, effortLabel),
            h('span', { className: `font-semibold ${effortColors.text}` }, `${Math.round(safeEffort)}%`),
          ]
        ),
        h('div', { className: 'h-2 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden' }, [
          h('div', { className: `${effortColors.bar} h-full rounded-full transition-all`, style: { width: `${Math.min(safeEffort, 120)}%` } }),
        ]),
      ]),
      h('div', { className: 'space-y-1' }, [
        h(
          'div',
          { className: 'flex items-center justify-between text-[11px] uppercase tracking-wide text-slate-500 dark:text-slate-400' },
          [
            h('span', null, timelineLabel),
            h('span', { className: `font-semibold ${timelineColors.text}` }, `${Math.round(safeTimeline)}%`),
          ]
        ),
        h('div', { className: 'h-2 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden' }, [
          h('div', { className: `${timelineColors.bar} h-full rounded-full transition-all`, style: { width: `${Math.min(safeTimeline, 120)}%` } }),
        ]),
      ]),
    ]
  );
}
