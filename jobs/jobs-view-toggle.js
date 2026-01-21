const { createElement: h } = React;

const baseMicroBtnClass = [
  'nn-btn nn-btn--micro',
  'inline-flex items-center justify-center',
  'text-slate-700 dark:text-white',
  'bg-white dark:bg-slate-900',
  'border border-slate-300 dark:border-white/10',
  'hover:bg-slate-50 dark:hover:bg-slate-800',
  'transition-colors',
].join(' ');

export function ViewToggleGroup({ options = [], value, onChange, className = '' }) {
  return h('div', { className: `inline-flex items-center gap-1 ${className}` }, (
    (options || []).map((option) => h('button', {
      key: option.value,
      type: 'button',
      title: option.title || option.label,
      'aria-label': option.title || option.label,
      className: `${baseMicroBtnClass} ${value === option.value ? 'bg-slate-200 dark:bg-slate-800' : ''}`,
      onClick: () => onChange && onChange(option.value),
    }, option.icon || option.label))
  ));
}
