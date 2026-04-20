const { createElement: h } = React;

function getInitials(name = '') {
  return String(name || '?')
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase() || '?';
}

function MessageText({ text }) {
  const parts = String(text || '').split(/(\[\[[^\]]+\]\]|@[A-Za-z][A-Za-z.'-]*)/g).filter(Boolean);
  return h('p', { className: 'text-[15px] leading-7 text-slate-800 dark:text-slate-100' }, parts.map((part, index) => {
    const isWorkRef = part.startsWith('[[') && part.endsWith(']]');
    const isPersonRef = part.startsWith('@');
    if (isWorkRef || isPersonRef) {
      return h('span', {
        key: `${part}-${index}`,
        className: isWorkRef
          ? 'rounded-md bg-netnet-purple/10 px-1.5 py-0.5 font-semibold text-netnet-purple dark:bg-white/10 dark:text-white'
          : 'rounded-md bg-slate-100 px-1.5 py-0.5 font-semibold text-slate-700 dark:bg-white/10 dark:text-slate-100',
      }, part);
    }
    return part;
  }));
}

function SourceLabel({ label }) {
  if (!label) return null;
  return h('div', {
    className: 'pb-1 pt-3 text-xs font-semibold text-slate-400 dark:text-slate-500',
    'data-chat-source-label': 'true',
  }, label);
}

export function ChatMessageRow({ item, showSourceLabel = false }) {
  if (!item) return null;
  return h('div', { className: 'space-y-2', 'data-chat-message-wrap': 'true' }, [
    showSourceLabel ? h(SourceLabel, { label: item.sourceLabel }) : null,
    h('article', {
      className: 'flex gap-3 py-2',
      'data-chat-message-row': 'true',
    }, [
      h('div', {
        className: 'mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-semibold text-slate-500 ring-1 ring-slate-200 dark:bg-white/10 dark:text-slate-100 dark:ring-white/10',
        'aria-hidden': 'true',
      }, getInitials(item.author)),
      h('div', { className: 'min-w-0 flex-1' }, [
        h('div', { className: 'flex flex-wrap items-baseline gap-2' }, [
          h('span', { className: 'text-sm font-semibold text-slate-950 dark:text-white' }, item.author),
          h('span', { className: 'text-xs text-slate-400 dark:text-slate-500' }, item.timestamp),
        ]),
        h('div', { className: 'mt-1' }, h(MessageText, { text: item.body || item.text })),
      ]),
    ]),
  ]);
}

export function ChatMessageList({ items = [], streamMode = false }) {
  if (!items.length) {
    return h('div', {
      className: 'flex min-h-[300px] items-center justify-center text-center text-sm text-slate-500 dark:text-slate-400',
      'data-chat-message-empty': 'true',
    }, 'No messages here yet.');
  }

  let previousSource = null;
  return h('div', {
    className: 'mx-auto w-full max-w-5xl space-y-1',
    'data-chat-message-list': 'true',
    'data-chat-stream-mode': streamMode ? 'true' : 'false',
  }, items.map((item) => {
    const showSourceLabel = streamMode && item.sourceLabel && item.sourceLabel !== previousSource;
    previousSource = item.sourceLabel || previousSource;
    return h(ChatMessageRow, {
      key: item.id,
      item,
      showSourceLabel,
    });
  }));
}
