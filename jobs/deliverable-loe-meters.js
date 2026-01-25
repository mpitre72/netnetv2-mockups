const { createElement: h } = React;

function formatHours(value) {
  const hours = Number(value) || 0;
  return `${hours % 1 ? hours.toFixed(1) : hours}h`;
}

function getStatus(maxUsage, estimated) {
  if (!estimated) return 'neutral';
  if (maxUsage >= 1) return 'over';
  if (maxUsage >= 0.85) return 'tight';
  return 'ok';
}

export function DeliverableLOEMeters({
  deliverableId,
  pools = [],
  serviceTypes = [],
  className = '',
}) {
  const typeMap = new Map((serviceTypes || []).map((type) => [String(type.id), type]));
  const activePools = (pools || []).filter((pool) => Number(pool?.estimatedHours) > 0);

  if (!activePools.length) {
    return h('div', { className: `text-xs text-slate-500 dark:text-slate-400 ${className}` }, 'Available hours: —');
  }

  return h('div', {
    className: `grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 ${className}`,
  }, activePools.map((pool, index) => {
    const estimated = Number(pool.estimatedHours) || 0;
    const assigned = Number(pool.assignedHours) || 0;
    const actual = Number(pool.actualHours) || 0;
    const maxUsage = estimated ? Math.max(assigned, actual) / estimated : 0;
    const assignedPct = estimated ? Math.min(assigned / estimated, 1) * 100 : 0;
    const actualPct = estimated ? Math.min(actual / estimated, 1) * 100 : 0;
    const overflow = estimated ? Math.max(maxUsage - 1, 0) : 0;
    const status = getStatus(maxUsage, estimated);
    const typeName = typeMap.get(String(pool.serviceTypeId))?.name || `Service ${index + 1}`;

    const trackHeight = status === 'over' ? 'h-5' : status === 'tight' ? 'h-4' : 'h-3';
    const borderClass = status === 'over'
      ? 'border-rose-400/70 dark:border-rose-400/50'
      : status === 'tight'
        ? 'border-amber-400/70 dark:border-amber-400/50'
        : 'border-slate-200 dark:border-white/10';
    const fillClass = status === 'over'
      ? 'bg-rose-300/80 dark:bg-rose-400/60'
      : status === 'tight'
        ? 'bg-amber-300/80 dark:bg-amber-400/60'
        : 'bg-emerald-300/70 dark:bg-emerald-400/50';

    return h('div', {
      key: `${deliverableId || 'deliverable'}-${pool.serviceTypeId || index}`,
      className: 'group space-y-1 rounded-lg border border-slate-200/70 dark:border-white/10 bg-white/70 dark:bg-slate-900/50 p-2',
    }, [
      h('div', { className: 'flex items-center justify-between gap-3 text-xs' }, [
        h('span', { className: 'text-slate-700 dark:text-slate-200 font-medium' }, typeName),
        h('span', {
          className: 'text-[11px] text-slate-400 dark:text-slate-500 opacity-0 group-hover:opacity-100 transition-opacity',
        }, `${formatHours(Math.max(assigned, actual))} / ${formatHours(estimated)}`),
      ]),
      h('div', {
        className: `relative w-full rounded-full border ${borderClass} ${trackHeight} bg-slate-100 dark:bg-white/10 overflow-hidden`,
        'aria-label': `${typeName} available hours`,
        title: `Estimated ${formatHours(estimated)} · Assigned ${formatHours(assigned)} · Actual ${formatHours(actual)}`,
      }, [
        h('div', {
          className: `absolute inset-y-0 left-0 ${fillClass}`,
          style: { width: `${assignedPct}%` },
        }),
        h('div', {
          className: `absolute inset-y-0 left-0 ${status === 'over' ? 'bg-rose-500/50 dark:bg-rose-400/50' : 'bg-slate-900/20 dark:bg-white/20'}`,
          style: {
            width: `${actualPct}%`,
            backgroundImage: 'repeating-linear-gradient(135deg, rgba(0,0,0,0.25) 0 6px, rgba(255,255,255,0.25) 6px 12px)',
          },
        }),
        overflow > 0
          ? h('div', {
            className: 'absolute right-0 top-0 bottom-0 w-1.5 bg-rose-500/80 dark:bg-rose-400/80',
          })
          : null,
      ]),
      h('div', {
        className: 'text-[11px] text-slate-400 dark:text-slate-500 opacity-0 group-hover:opacity-100 transition-opacity',
      }, `Assigned ${formatHours(assigned)} · Actual ${formatHours(actual)} · Estimated ${formatHours(estimated)}`),
    ]);
  }));
}
