const { createElement: h } = React;

function ComposerHint({ children }) {
  return h('span', {
    className: 'inline-flex items-center rounded-md border border-slate-200 px-2 py-1 text-xs font-semibold text-slate-500 dark:border-white/10 dark:text-slate-300',
  }, children);
}

export function ChatComposer({ mode = 'channel' }) {
  const isStream = mode === 'stream';
  return h('div', {
    className: 'sticky bottom-0 z-40 border-t border-slate-200 bg-white/90 px-3 py-3 backdrop-blur sm:px-4 dark:border-white/10 dark:bg-slate-950/90',
    'data-chat-composer': mode,
  }, [
    h('div', {
      className: [
        'mx-auto max-w-5xl rounded-2xl border px-3 py-2 transition-colors focus:outline-none focus:ring-2 focus:ring-netnet-purple',
        isStream
          ? 'border-dashed border-slate-200 bg-slate-50 text-slate-500 dark:border-white/10 dark:bg-white/5 dark:text-slate-400'
          : 'border-slate-200 bg-white text-slate-400 shadow-lg focus:border-netnet-purple dark:border-white/20 dark:bg-slate-900/95 dark:text-slate-500',
      ].join(' '),
      tabIndex: isStream ? -1 : 0,
      'aria-disabled': isStream ? 'true' : undefined,
    }, [
      h('div', { className: 'min-h-[34px] text-sm leading-6' }, (
        isStream
          ? 'Stream is read-first. Reply inline from message actions; start new top-level messages inside channels.'
          : 'Write a message...'
      )),
      h('div', { className: 'mt-2 flex flex-wrap items-center gap-2 border-t border-slate-200 pt-2 dark:border-white/10' }, [
        h(ComposerHint, null, '[[ work references'),
        h(ComposerHint, null, '@ people'),
        h('span', { className: 'ml-auto text-xs text-slate-400 dark:text-slate-500' }, isStream ? 'No new top-level messages' : 'Composer placeholder'),
      ]),
    ]),
  ]);
}
