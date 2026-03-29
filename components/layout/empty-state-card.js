const { createElement: h } = React;

export function EmptyStateCard({
  title,
  description,
  action = null,
  className = '',
} = {}) {
  return h('section', {
    className: [
      'rounded-2xl border border-slate-200 dark:border-white/10',
      'bg-white/90 dark:bg-slate-900/60 p-6 text-center shadow-sm',
      className,
    ].filter(Boolean).join(' '),
  }, [
    h('h3', { key: 'title', className: 'text-base font-semibold text-slate-900 dark:text-white' }, title || ''),
    description
      ? h('p', { key: 'description', className: 'mt-2 text-sm text-slate-500 dark:text-slate-400' }, description)
      : null,
    action
      ? h('div', { key: 'action', className: 'mt-4 flex items-center justify-center' }, action)
      : null,
  ]);
}
