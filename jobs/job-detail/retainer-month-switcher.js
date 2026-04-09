import { formatCycleLabel, shiftCycleKey } from '../retainer-cycle-utils.js';

const { createElement: h } = React;

export function RetainerMonthSwitcher({ cycleKey, onChange, ariaLabel = 'Select month' }) {
  if (!cycleKey || typeof onChange !== 'function') return null;

  const handleShift = (delta) => {
    onChange(shiftCycleKey(cycleKey, delta));
  };

  return h('div', {
    className: 'inline-flex items-center gap-2 rounded-full border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 px-2 py-1',
    'aria-label': ariaLabel,
  }, [
    h('button', {
      type: 'button',
      className: 'h-8 w-8 rounded-full border border-slate-200 dark:border-white/10 text-slate-500 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white',
      onClick: () => handleShift(-1),
      'aria-label': 'Previous month',
    }, '<'),
    h('span', { className: 'px-2 text-sm font-semibold text-slate-700 dark:text-slate-200' }, formatCycleLabel(cycleKey) || cycleKey),
    h('button', {
      type: 'button',
      className: 'h-8 w-8 rounded-full border border-slate-200 dark:border-white/10 text-slate-500 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white',
      onClick: () => handleShift(1),
      'aria-label': 'Next month',
    }, '>'),
  ]);
}
