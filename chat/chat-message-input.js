const { createElement: h } = React;

function ComposerPill({ children, tone = 'default' }) {
  const toneClass = tone === 'work'
    ? 'text-netnet-purple ring-netnet-purple/15 dark:text-white dark:ring-white/10'
    : 'text-slate-600 ring-slate-200 dark:text-slate-200 dark:ring-white/10';
  return h('span', {
    className: `inline-flex items-center rounded-md bg-white px-2 py-1 text-xs font-semibold ring-1 dark:bg-slate-900 ${toneClass}`,
  }, children);
}

export function ChatMessageInput({ conversationType }) {
  const isSlack = conversationType === 'slack-channels';
  return h('div', {
    className: 'border-t border-slate-200 bg-white p-4 dark:border-white/10 dark:bg-slate-950/60',
    'data-chat-composer-placeholder': 'true',
    'data-chat-composer-type': conversationType || '',
  }, [
    h('div', {
      className: 'rounded-lg border border-slate-200 bg-slate-50 px-3 py-3 shadow-inner dark:border-white/10 dark:bg-white/5',
    }, [
      h('div', { className: 'flex min-h-[60px] items-start text-sm leading-6 text-slate-400 dark:text-slate-500' }, [
        h('span', null, isSlack ? 'Slack sync is not connected yet...' : 'Write a message...'),
      ]),
      h('div', { className: 'mt-3 flex flex-wrap items-center gap-2 border-t border-slate-200 pt-3 dark:border-white/10' }, [
        h(ComposerPill, { tone: 'work' }, '[[ work references'),
        h(ComposerPill, null, '@ people'),
        h('span', { className: 'ml-auto text-xs text-slate-400 dark:text-slate-500' }, 'Composer placeholder'),
      ]),
    ]),
  ]);
}
