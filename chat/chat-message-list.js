const { createElement: h, useEffect, useState } = React;

function getInitials(name = '') {
  return String(name || '?')
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase() || '?';
}

function groupMessagesByDay(messages = []) {
  const groups = [];
  messages.forEach((message) => {
    const label = message.dayLabel || message.dateLabel || 'Conversation';
    const last = groups[groups.length - 1];
    if (!last || last.label !== label) {
      groups.push({ label, messages: [message] });
      return;
    }
    last.messages.push(message);
  });
  return groups;
}

function DayDivider({ label }) {
  return h('div', { className: 'flex items-center gap-3 py-1', 'data-chat-day-divider': 'true' }, [
    h('div', { className: 'h-px flex-1 bg-slate-200 dark:bg-white/10' }),
    h('span', { className: 'rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-400 dark:border-white/10 dark:bg-slate-900 dark:text-slate-500' }, label),
    h('div', { className: 'h-px flex-1 bg-slate-200 dark:bg-white/10' }),
  ]);
}

function MessageText({ text }) {
  const parts = String(text || '').split(/(\[\[[^\]]+\]\]|@[A-Za-z][A-Za-z.'-]*)/g).filter(Boolean);
  return h('p', { className: 'text-sm leading-6' }, parts.map((part, index) => {
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

function getReplySummary(replies = []) {
  const count = replies.length;
  const authors = Array.from(new Set(replies.map((reply) => reply.author).filter(Boolean)));
  const participantCue = authors.slice(0, 3).map((author) => String(author).split(/\s+/)[0]).join(', ');
  const overflow = authors.length > 3 ? ` +${authors.length - 3}` : '';
  return {
    count,
    countLabel: `${count} ${count === 1 ? 'reply' : 'replies'}`,
    participantCue: participantCue ? `${participantCue}${overflow}` : '',
  };
}

export function ChatMessageRow({ message, variant = 'parent' }) {
  if (!message) return null;
  const isReply = variant === 'reply';
  return h('article', {
    className: `flex gap-3 ${isReply ? 'py-1' : ''}`,
    'data-chat-message-row': 'true',
    'data-chat-message-variant': variant,
  }, [
    h('div', {
      className: `${isReply ? 'h-7 w-7 rounded-md text-[10px]' : 'mt-1 h-9 w-9 rounded-lg text-xs'} flex shrink-0 items-center justify-center bg-white font-semibold text-slate-600 ring-1 ring-slate-200 dark:bg-slate-900 dark:text-white dark:ring-white/10`,
      'aria-hidden': 'true',
    }, getInitials(message.author)),
    h('div', { className: 'min-w-0 flex-1' }, [
      h('div', { className: 'mb-1 flex flex-wrap items-baseline gap-2' }, [
        h('span', { className: `${isReply ? 'text-[13px]' : 'text-sm'} font-semibold text-slate-900 dark:text-white` }, message.author),
        message.role
          ? h('span', { className: 'text-xs text-slate-500 dark:text-slate-400' }, message.role)
          : null,
        h('span', { className: 'text-xs text-slate-400 dark:text-slate-500' }, message.timestamp),
      ]),
      h('div', {
        className: `${isReply ? 'rounded-md border-slate-200/80 bg-white/80 px-3 py-2.5 shadow-none dark:border-white/10 dark:bg-slate-900/50' : 'rounded-lg border-slate-200 bg-white px-3.5 py-3 shadow-sm dark:border-white/10 dark:bg-slate-900/70'} border text-slate-800 dark:text-slate-100`,
      }, h(MessageText, { text: message.text })),
    ]),
  ]);
}

function InlineReplyThread({ parentMessage, isExpanded, onToggle }) {
  const replies = parentMessage.replies || [];
  if (!replies.length) return null;
  const summary = getReplySummary(replies);
  const threadId = `chat-inline-thread-${parentMessage.id}`;

  return h('div', {
    className: 'ml-12 mt-3 border-l border-slate-200 pl-4 dark:border-white/10',
    'data-chat-inline-thread': 'true',
    'data-chat-inline-thread-expanded': isExpanded ? 'true' : 'false',
  }, [
    h('button', {
      type: 'button',
      className: 'inline-flex items-center gap-2 rounded-md px-2 py-1 text-xs font-semibold text-slate-500 transition hover:bg-white hover:text-slate-800 focus:outline-none focus:ring-2 focus:ring-netnet-purple/30 dark:text-slate-400 dark:hover:bg-white/10 dark:hover:text-white',
      'aria-expanded': isExpanded ? 'true' : 'false',
      'aria-controls': threadId,
      onClick: onToggle,
    }, [
      h('span', { className: 'h-1.5 w-1.5 rounded-full bg-netnet-purple/70 dark:bg-white/70', 'aria-hidden': 'true' }),
      h('span', null, isExpanded ? `Hide ${summary.countLabel}` : `Show ${summary.countLabel}`),
      summary.participantCue
        ? h('span', { className: 'font-medium text-slate-400 dark:text-slate-500' }, `from ${summary.participantCue}`)
        : null,
    ]),
    isExpanded
      ? h('div', { id: threadId, className: 'mt-3 space-y-3' }, replies.map((reply) => (
        h(ChatMessageRow, { key: reply.id, message: reply, variant: 'reply' })
      )))
      : null,
  ]);
}

function MessageThreadBlock({ message, isExpanded, onToggle }) {
  return h('div', { 'data-chat-message-thread-block': 'true' }, [
    h(ChatMessageRow, { key: 'message', message, variant: 'parent' }),
    h(InlineReplyThread, {
      key: 'thread',
      parentMessage: message,
      isExpanded,
      onToggle,
    }),
  ]);
}

export function ChatMessageList({ conversationId, messages = [], conversationType }) {
  const [expandedThreadIds, setExpandedThreadIds] = useState(() => new Set());

  useEffect(() => {
    setExpandedThreadIds(new Set());
  }, [conversationId]);

  const toggleThread = (messageId) => {
    setExpandedThreadIds((current) => {
      const next = new Set(current);
      if (next.has(messageId)) {
        next.delete(messageId);
      } else {
        next.add(messageId);
      }
      return next;
    });
  };

  const groups = groupMessagesByDay(messages);
  return h('div', {
    className: 'space-y-6',
    'data-chat-message-area': 'true',
    'data-chat-message-conversation-type': conversationType || '',
  }, groups.map((group) => h('section', { key: group.label, className: 'space-y-4' }, [
    h(DayDivider, { label: group.label }),
    ...group.messages.map((message) => h(MessageThreadBlock, {
      key: message.id,
      message,
      isExpanded: expandedThreadIds.has(message.id),
      onToggle: () => toggleThread(message.id),
    })),
  ])));
}
