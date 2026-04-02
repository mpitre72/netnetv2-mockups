import { getDisplayName } from '../quick-tasks/quick-tasks-helpers.js';

const { createElement: h, useMemo } = React;

function parseCurrencyAmount(value) {
  const cleaned = String(value || '').replace(/[^0-9.-]/g, '');
  if (!cleaned) return null;
  const numeric = Number(cleaned);
  return Number.isFinite(numeric) ? numeric : null;
}

function formatCurrency(value) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(Number(value) || 0);
}

export function SalesSummaryStrip({ opportunities = [], members = [] }) {
  const summary = useMemo(() => opportunities.reduce((acc, opportunity) => {
    const type = String(opportunity?.type || '').trim().toLowerCase();
    const projectValue = parseCurrencyAmount(opportunity?.projectValue || opportunity?.value?.project?.effectiveValue || '');
    const retainerValue = parseCurrencyAmount(opportunity?.retainerValue || opportunity?.value?.retainer?.effectiveMonthly || '');
    const combinedValue = (projectValue || 0) + (retainerValue || 0);

    if (type === 'project' || type === 'both') {
      acc.projectCount += 1;
      if (projectValue !== null) acc.projectTotal += projectValue;
    }

    if (type === 'retainer' || type === 'both') {
      acc.retainerCount += 1;
      if (retainerValue !== null) acc.retainerTotal += retainerValue;
    }

    if (String(opportunity?.clarity || '').trim().toLowerCase() === 'clear') {
      acc.clearCount += 1;
    }

    const ownerKey = String(opportunity?.ownerId || '').trim();
    if (ownerKey) {
      const currentOwner = acc.owners.get(ownerKey) || { total: 0, count: 0 };
      currentOwner.total += combinedValue;
      currentOwner.count += 1;
      acc.owners.set(ownerKey, currentOwner);
    }

    return acc;
  }, {
    projectCount: 0,
    projectTotal: 0,
    retainerCount: 0,
    retainerTotal: 0,
    clearCount: 0,
    owners: new Map(),
  }), [opportunities]);

  const topOwner = useMemo(() => {
    let bestId = '';
    let best = null;
    summary.owners.forEach((value, key) => {
      if (!best || value.total > best.total) {
        bestId = key;
        best = value;
      }
    });
    if (!bestId || !best) {
      return { name: '-', totalLabel: '', countLabel: '' };
    }
    const owner = (members || []).find((member) => String(member.id) === bestId) || null;
    const name = getDisplayName(owner) || owner?.email || '-';
    return {
      name,
      totalLabel: formatCurrency(best.total),
      countLabel: `(${best.count})`,
    };
  }, [members, summary.owners]);

  const blockClassName = 'min-w-0 rounded-2xl border-2 border-emerald-500/80 bg-emerald-500/[0.10] px-4 py-3 text-center dark:border-emerald-400/85 dark:bg-emerald-400/[0.08]';
  const labelClassName = 'text-[11px] font-medium uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400';
  const valueClassName = 'mt-1 text-[24px] font-bold leading-none tracking-[-0.03em] text-slate-900 dark:text-white tabular-nums';
  const secondaryClassName = 'mt-1 truncate text-xs font-medium text-slate-500 dark:text-slate-400';

  return h('div', {
    className: 'grid grid-cols-4 gap-3',
  }, [
    h('div', {
      className: blockClassName,
    }, [
      h('div', { className: labelClassName }, `Projects (${summary.projectCount})`),
      h('div', { className: valueClassName }, formatCurrency(summary.projectTotal)),
    ]),
    h('div', {
      className: blockClassName,
    }, [
      h('div', { className: labelClassName }, `Retainers (${summary.retainerCount})`),
      h('div', { className: valueClassName }, `${formatCurrency(summary.retainerTotal)}/mo`),
    ]),
    h('div', {
      className: blockClassName,
    }, [
      h('div', { className: labelClassName }, `Clear (${summary.clearCount})`),
      h('div', { className: valueClassName }, String(summary.clearCount)),
    ]),
    h('div', {
      className: blockClassName,
    }, [
      h('div', { className: labelClassName }, 'Top Owner'),
      h('div', { className: `${valueClassName} truncate` }, topOwner.name),
      h('div', { className: `${secondaryClassName} tabular-nums` }, topOwner.totalLabel ? `${topOwner.totalLabel} ${topOwner.countLabel}`.trim() : ''),
    ]),
  ]);
}
