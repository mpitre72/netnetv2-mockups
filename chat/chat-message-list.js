import { formatWorkMentionLabel, parseMessageTokens } from './chat-mention-utils.js';

const { createElement: h } = React;
const DEFAULT_VISIBLE_REPLY_COUNT = 2;

function getInitials(name = '') {
  return String(name || '?')
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase() || '?';
}

function tokenClass(type) {
  if (type === 'job') return 'chat-mention-token chat-mention-token--job';
  if (type === 'deliverable') return 'chat-mention-token chat-mention-token--deliverable';
  if (type === 'task') return 'chat-mention-token chat-mention-token--task';
  if (type === 'person') return 'chat-mention-token chat-mention-token--person';
  return 'text-slate-700 underline decoration-slate-300 hover:text-slate-950 hover:decoration-slate-500 dark:text-slate-100 dark:decoration-white/30 dark:hover:text-white';
}

function getWorkSegmentParts(token, mentionCatalog) {
  const ref = token.ref;
  if (!ref) return [{ type: token.type || 'job', label: token.label, ref: null }];
  if (ref.type === 'job') return [{ type: 'job', label: ref.label, ref }];

  const job = mentionCatalog?.jobs?.find((candidate) => candidate.jobId === ref.jobId);
  const parts = job ? [{ type: 'job', label: job.label, ref: job }] : [];

  if (ref.type === 'deliverable') {
    parts.push({ type: 'deliverable', label: ref.label, ref });
    return parts;
  }

  const deliverable = mentionCatalog?.deliverables?.find((candidate) => candidate.id === ref.deliverableId);
  if (deliverable) parts.push({ type: 'deliverable', label: deliverable.label, ref: deliverable });
  parts.push({ type: 'task', label: ref.label, ref });
  return parts;
}

function MentionSegment({ segment, item, onMentionClick }) {
  return h('button', {
    type: 'button',
    className: [
      'inline rounded-sm px-0.5 font-semibold underline-offset-2 transition-colors focus:outline-none focus:ring-1 focus:ring-netnet-purple/40',
      onMentionClick ? 'cursor-pointer' : 'cursor-default',
      tokenClass(segment.type),
    ].join(' '),
    onClick: onMentionClick ? () => onMentionClick({
      kind: 'mention',
      trigger: segment.type === 'person' ? 'person' : 'work',
      type: segment.type,
      label: segment.label,
      raw: segment.raw || segment.label,
      ref: segment.ref,
    }, item) : undefined,
    title: `Filter by ${segment.label}`,
    'data-chat-mention-segment': segment.type,
    'data-chat-mention-label': segment.raw || segment.label,
  }, segment.raw || segment.label);
}

function WorkMentionToken({ token, item, mentionCatalog, onMentionClick }) {
  const segments = getWorkSegmentParts(token, mentionCatalog);
  const display = token.ref ? formatWorkMentionLabel(token.ref) : token.label;
  const displayParts = display.split('/');
  const alignedSegments = segments.length === displayParts.length
    ? segments.map((segment, index) => ({ ...segment, raw: displayParts[index] }))
    : segments;

  return h('span', {
    className: 'inline',
    'data-chat-smart-mention': token.type,
    title: display,
  }, [
    h('span', { key: 'open', className: tokenClass(alignedSegments[alignedSegments.length - 1]?.type || token.type) }, '[['),
    ...alignedSegments.flatMap((segment, index) => [
      index ? h('span', { key: `${segment.type}-${index}-slash`, className: 'text-slate-400 dark:text-slate-500' }, '/') : null,
      h(MentionSegment, {
        key: `${segment.type}-${segment.ref?.id || segment.label}-${index}`,
        segment,
        item,
        onMentionClick,
      }),
    ]).filter(Boolean),
    h('span', { key: 'close', className: tokenClass(alignedSegments[alignedSegments.length - 1]?.type || token.type) }, ']]'),
  ]);
}

function MessageText({ text, item, mentionCatalog, onMentionClick }) {
  const tokens = parseMessageTokens(text, mentionCatalog);
  return h('p', { className: 'max-w-[72ch] text-[15px] leading-6 text-slate-800 dark:text-slate-100' }, tokens.map((token, index) => {
    if (token.kind !== 'mention') return token.text;
    if (token.trigger === 'work') {
      return h(WorkMentionToken, {
        key: `${token.raw}-${index}`,
        token,
        item,
        mentionCatalog,
        onMentionClick,
      });
    }
    const clickable = !!onMentionClick;
    return h(MentionSegment, {
      key: `${token.raw}-${index}`,
      segment: { type: 'person', label: token.label, raw: token.raw, ref: token.ref },
      item,
      onMentionClick: clickable ? onMentionClick : null,
    });
  }));
}

function SourceLabel({ label }) {
  if (!label) return null;
  return h('div', {
    className: 'flex items-center gap-2 px-2 pb-1 pt-3 text-[11px] font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500 sm:px-3',
    'data-chat-source-label': 'true',
  }, [
    h('span', { className: 'shrink-0' }, label),
    h('span', { className: 'h-px min-w-8 flex-1 bg-slate-100 dark:bg-white/10', 'aria-hidden': 'true' }),
  ]);
}

function replyCountLabel(count) {
  const value = Number(count || 0);
  if (!value) return '';
  return `${value} ${value === 1 ? 'reply' : 'replies'}`;
}

function getRecentReplyAuthors(replies = [], limit = 3) {
  const authors = [];
  [...replies].reverse().forEach((reply) => {
    const author = reply?.author;
    if (!author || authors.includes(author)) return;
    authors.push(author);
  });
  return authors.slice(0, limit);
}

function StackedReplyAvatars({ replies = [] }) {
  const authors = getRecentReplyAuthors(replies);
  if (!authors.length) return null;

  return h('span', {
    className: 'flex shrink-0 -space-x-1',
    'aria-hidden': 'true',
  }, authors.map((author, index) => h('span', {
    key: `${author}-${index}`,
    className: 'inline-flex h-6 w-6 items-center justify-center rounded-full border-2 border-white bg-slate-100 text-[10px] font-semibold text-slate-500 shadow-sm dark:border-slate-950 dark:bg-slate-800 dark:text-slate-200',
    title: author,
  }, getInitials(author))));
}

function ReplyRollupRow({ replies = [], expanded = false, onToggle }) {
  if (replies.length <= DEFAULT_VISIBLE_REPLY_COUNT) return null;

  const label = replyCountLabel(replies.length);
  return h('button', {
    type: 'button',
    className: 'mt-1 inline-flex items-center gap-2 rounded-md px-2 py-1 text-xs font-semibold text-slate-500 transition-colors hover:bg-slate-50 hover:text-netnet-purple focus:outline-none focus:ring-1 focus:ring-netnet-purple/40 dark:text-slate-400 dark:hover:bg-white/5 dark:hover:text-white',
    'aria-expanded': expanded ? 'true' : 'false',
    'aria-label': expanded ? `Collapse ${label}` : `Expand ${label}`,
    'data-chat-thread-rollup': 'true',
    'data-chat-thread-rollup-expanded': expanded ? 'true' : 'false',
    'data-chat-thread-rollup-count': String(replies.length),
    onClick: onToggle,
  }, [
    h(StackedReplyAvatars, { key: 'avatars', replies }),
    h('span', { key: 'label', className: 'whitespace-nowrap' }, label),
  ]);
}

function MessageAnatomy({ item, compact = false, mentionCatalog, onMentionClick }) {
  return h('article', {
    className: [
      'flex gap-3 px-2 sm:px-3',
      compact ? 'py-1' : 'py-1.5',
    ].join(' '),
    'data-chat-message-row': compact ? 'reply' : 'true',
  }, [
    h('div', {
      className: [
        'mt-1 flex shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-semibold text-slate-500 ring-1 ring-slate-200 dark:bg-white/10 dark:text-slate-100 dark:ring-white/10',
        compact ? 'h-8 w-8' : 'h-9 w-9',
      ].join(' '),
      'aria-hidden': 'true',
    }, getInitials(item.author)),
    h('div', { className: 'min-w-0 flex-1' }, [
      h('div', { className: 'flex flex-wrap items-baseline gap-2' }, [
        h('span', { className: 'text-sm font-semibold text-slate-950 dark:text-white' }, item.author),
        h('span', { className: 'text-xs text-slate-400 dark:text-slate-500' }, item.timestamp),
      ]),
      h('div', { className: 'mt-1' }, h(MessageText, {
        text: item.body || item.text,
        item,
        mentionCatalog,
        onMentionClick,
      })),
    ]),
  ]);
}

function ReplyThread({
  item,
  expanded = false,
  mentionCatalog,
  onMentionClick,
  onToggleThread,
}) {
  const replies = [...(item.replies || [])].sort((a, b) => Number(a.sortAt || 0) - Number(b.sortAt || 0));
  if (!replies.length) return null;
  const visibleReplies = expanded ? replies : replies.slice(0, DEFAULT_VISIBLE_REPLY_COUNT);
  return h('div', {
    className: 'ml-[34px] border-l border-slate-100 py-1 pl-3 dark:border-white/10 sm:ml-[42px]',
    'data-chat-inline-thread': item.threadId,
    'data-chat-inline-thread-expanded': expanded ? 'true' : 'false',
    'data-chat-inline-thread-visible-replies': String(visibleReplies.length),
    'data-chat-inline-thread-total-replies': String(replies.length),
  }, [
    ...visibleReplies.map((reply) => h(MessageAnatomy, {
      key: reply.id,
      item: reply,
      compact: true,
      mentionCatalog,
      onMentionClick,
    })),
    h('div', {
      key: 'rollup',
      className: 'px-2 sm:px-3',
    }, h(ReplyRollupRow, {
      replies,
      expanded,
      onToggle: () => onToggleThread?.(item.threadId),
    })),
  ]);
}

export function ChatMessageRow({
  item,
  showSourceLabel = false,
  expanded = false,
  mentionCatalog,
  replyTarget = null,
  onStartReply,
  onToggleThread,
  onMentionClick,
}) {
  if (!item) return null;
  const replyCount = (item.replies || []).length;
  const isReplyTarget = replyTarget?.threadId === item.threadId;
  return h('div', { 'data-chat-message-wrap': 'true' }, [
    showSourceLabel ? h(SourceLabel, { label: item.sourceLabel }) : null,
    h(MessageAnatomy, { item, mentionCatalog, onMentionClick }),
    h('div', {
      className: 'ml-[48px] flex flex-wrap items-center gap-3 px-2 pb-1 text-xs sm:ml-[56px] sm:px-3',
      'data-chat-message-actions': item.threadId,
    }, [
      h('button', {
        type: 'button',
        className: [
          'font-semibold transition-colors hover:text-netnet-purple focus:outline-none focus:ring-1 focus:ring-netnet-purple/40',
          isReplyTarget ? 'text-netnet-purple' : 'text-slate-400 dark:text-slate-500',
        ].join(' '),
        onClick: () => onStartReply?.(item),
      }, isReplyTarget ? 'Replying' : 'Reply'),
      replyCount ? h('span', {
        className: 'font-semibold text-slate-400 dark:text-slate-500',
        'data-chat-reply-count': String(replyCount),
      }, replyCountLabel(replyCount)) : null,
    ]),
    replyCount ? h(ReplyThread, {
      item,
      expanded,
      mentionCatalog,
      onMentionClick,
      onToggleThread,
    }) : null,
  ]);
}

export function ChatMessageList({
  items = [],
  streamMode = false,
  mentionCatalog,
  expandedThreadIds,
  replyTarget = null,
  onStartReply,
  onToggleThread,
  onMentionClick,
}) {
  if (!items.length) {
    return h('div', {
      className: 'flex min-h-[300px] items-center justify-center px-3 text-center text-sm text-slate-500 dark:text-slate-400',
      'data-chat-message-empty': 'true',
    }, 'No messages here yet.');
  }

  let previousSource = null;
  return h('div', {
    className: 'w-full space-y-0',
    'data-chat-message-list': 'true',
    'data-chat-stream-mode': streamMode ? 'true' : 'false',
  }, items.map((item) => {
    const showSourceLabel = streamMode && item.sourceLabel && item.sourceLabel !== previousSource;
    previousSource = item.sourceLabel || previousSource;
    return h(ChatMessageRow, {
      key: item.id,
      item,
      showSourceLabel,
      expanded: expandedThreadIds?.has(item.threadId) || item.filterMatchedReply,
      mentionCatalog,
      replyTarget,
      onStartReply,
      onToggleThread,
      onMentionClick,
    });
  }));
}
