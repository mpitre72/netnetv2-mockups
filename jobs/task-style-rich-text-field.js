const { createElement: h } = React;

export function TaskStyleRichTextField({
  label,
  value,
  onChange,
  onBlur,
  onKeyDown,
  autoFocus = false,
  disabled = false,
  rows = 3,
  footerText = 'Enter to save · Esc to cancel',
  muted = false,
}) {
  return h('div', {
    className: [
      'rounded-xl border border-slate-200 dark:border-white/10 p-3',
      muted ? 'bg-slate-100 dark:bg-slate-950/70' : 'bg-slate-50 dark:bg-slate-900',
    ].join(' '),
  }, [
    h('div', {
      className: [
        'mb-2 text-[11px] uppercase tracking-wide',
        muted ? 'text-slate-400 dark:text-slate-500' : 'text-slate-500 dark:text-slate-400',
      ].join(' '),
    }, label),
    h('div', { className: 'mb-2 flex flex-wrap items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-1 dark:border-white/10 dark:bg-slate-950/40' }, [
      h('button', { type: 'button', disabled: true, className: 'px-2 py-1 text-[11px] font-semibold text-slate-400 dark:text-slate-500' }, 'B'),
      h('button', { type: 'button', disabled: true, className: 'px-2 py-1 text-[11px] italic text-slate-400 dark:text-slate-500' }, 'I'),
      h('button', { type: 'button', disabled: true, className: 'px-2 py-1 text-[11px] underline text-slate-400 dark:text-slate-500' }, 'U'),
      h('button', { type: 'button', disabled: true, className: 'px-2 py-1 text-[11px] text-slate-400 dark:text-slate-500' }, '•'),
      h('button', { type: 'button', disabled: true, className: 'px-2 py-1 text-[11px] text-slate-400 dark:text-slate-500' }, 'Link'),
      h('button', { type: 'button', disabled: true, className: 'px-2 py-1 text-[11px] text-slate-400 dark:text-slate-500' }, 'H1'),
      h('button', { type: 'button', disabled: true, className: 'px-2 py-1 text-[11px] text-slate-400 dark:text-slate-500' }, 'Quote'),
      h('button', { type: 'button', disabled: true, className: 'px-2 py-1 text-[11px] text-slate-400 dark:text-slate-500' }, 'Code'),
    ]),
    h('textarea', {
      value: value || '',
      rows,
      autoFocus,
      disabled,
      onChange: (event) => onChange?.(event.target.value),
      onBlur,
      onKeyDown,
      className: [
        'w-full rounded-md border border-slate-200 px-3 py-2 text-sm text-slate-700 dark:border-white/10 dark:text-slate-200',
        muted ? 'bg-slate-50 dark:bg-slate-950/70' : 'bg-white dark:bg-slate-900',
      ].join(' '),
    }),
    footerText
      ? h('div', { className: 'mt-2 text-[11px] text-slate-400 dark:text-slate-500' }, footerText)
      : null,
  ]);
}
