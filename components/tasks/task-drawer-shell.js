const { createElement: h } = React;

export function TaskDrawerShell({
  eyebrow = '',
  title = '',
  badges = null,
  headerContent = null,
  onClose,
  children,
  footer = null,
}) {
  return h(React.Fragment, null, [
    h('div', {
      id: 'app-drawer-backdrop',
      onClick: onClose,
    }),
    h('aside', { id: 'app-drawer', className: 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white p-0 flex flex-col w-full max-w-md h-full' }, [
      h('div', { className: 'flex items-start justify-between gap-4 px-5 py-4 border-b border-slate-200 dark:border-white/10' }, [
        headerContent
          ? h('div', { className: 'min-w-0 flex-1' }, headerContent)
          : h('div', { className: 'space-y-2 min-w-0' }, [
            eyebrow
              ? h('div', { className: 'text-[11px] uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400' }, eyebrow)
              : null,
            h('div', { className: 'text-lg font-semibold text-slate-900 dark:text-white' }, title),
            badges ? h('div', { className: 'flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400' }, badges) : null,
          ]),
        h('button', {
          type: 'button',
          className: 'h-9 w-9 rounded-full border border-slate-200 dark:border-white/10 text-slate-500 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white',
          onClick: onClose,
          'aria-label': 'Close task drawer',
        }, 'x'),
      ]),
      h('div', { className: 'flex-1 overflow-y-auto px-5 py-5 space-y-5' }, children),
      footer
        ? h('div', { className: 'border-t border-slate-200 dark:border-white/10 px-5 py-4 space-y-3' }, footer)
        : null,
    ]),
  ]);
}
