const { createElement: h } = React;

export function ChatConversationEmptyState({ bucketLabel = 'this bucket', emptyState = null } = {}) {
  const title = emptyState?.title || `Choose a conversation from ${bucketLabel}`;
  const description = emptyState?.description || `Select a conversation in ${bucketLabel} to bring the delivery discussion into focus.`;
  return h('div', {
    className: 'flex h-full min-h-[420px] items-center justify-center px-8 text-center',
    'data-chat-empty': 'conversation',
  }, [
    h('div', { className: 'max-w-sm' }, [
      h('div', {
        className: 'mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-lg border border-slate-200 bg-white text-netnet-purple shadow-sm dark:border-white/10 dark:bg-slate-900',
        'aria-hidden': 'true',
      }, [
        h('svg', { viewBox: '0 0 24 24', className: 'h-5 w-5', fill: 'none', stroke: 'currentColor', strokeWidth: '1.7' }, [
          h('path', { d: 'M4 6.5A2.5 2.5 0 0 1 6.5 4h11A2.5 2.5 0 0 1 20 6.5v7A2.5 2.5 0 0 1 17.5 16H10l-4.2 3.2A.5.5 0 0 1 5 18.8V16.5A2.5 2.5 0 0 1 4 14.5v-8Z' }),
        ]),
      ]),
      h('h2', { className: 'text-base font-semibold text-slate-900 dark:text-white' }, title),
      h('p', { className: 'mt-2 text-sm leading-6 text-slate-500 dark:text-slate-400' }, description),
    ]),
  ]);
}

export function ChatContextEmptyState() {
  return h('div', {
    className: 'rounded-lg border border-dashed border-slate-200 bg-slate-50/80 p-4 text-sm text-slate-500 dark:border-white/10 dark:bg-white/5 dark:text-slate-400',
    'data-chat-empty': 'work-context',
  }, [
    h('p', { className: 'font-medium text-slate-700 dark:text-slate-200' }, 'No structured work context attached'),
    h('p', { className: 'mt-2 leading-5' }, 'This panel is reserved for linked work, decisions, and resources. Replies belong in the conversation flow.'),
  ]);
}
