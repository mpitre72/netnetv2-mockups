const { createElement: h } = React;

export function Section({ title, children }) {
  return h('section', { className: 'space-y-4' }, [
    h('div', { className: 'flex items-center gap-3' }, [
      h('h2', { className: 'text-lg font-semibold text-slate-900 dark:text-white' }, title),
      h('div', { className: 'h-px flex-1 bg-slate-200 dark:bg-white/10' }),
    ]),
    children,
  ]);
}
