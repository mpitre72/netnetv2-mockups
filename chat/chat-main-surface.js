import { ChatComposer } from './chat-composer.js';
import { ActiveFilterBar, ChatFilterPopover } from './chat-filter-popover.js';
import { ChatMessageList } from './chat-message-list.js';

const { createElement: h } = React;

function getSurfaceKicker(location) {
  if (location?.type === 'utility') {
    if (location.id === 'stream') return 'Stream';
    if (location.id === 'unread') return 'Unread';
    if (location.id === 'mentions') return 'Mentions';
  }
  if (location?.type === 'general') return 'General';
  if (location?.type === 'job') return 'Job Channel';
  if (location?.type === 'direct') return 'Direct Message';
  return 'Chat';
}

function getSurfaceDescription(location, selectedChannel) {
  if (location?.type === 'utility' && location.id === 'stream') {
    return 'All recent channel and direct activity';
  }
  if (location?.type === 'utility' && location.id === 'unread') {
    return 'Unread activity across Chat';
  }
  if (location?.type === 'utility' && location.id === 'mentions') {
    return 'Messages where someone mentioned you';
  }
  return selectedChannel?.subtitle || 'Channel conversation';
}

function formatMessageCount(count) {
  const value = Number(count || 0);
  return `${value} ${value === 1 ? 'message' : 'messages'}`;
}

export function ChatMainSurface({
  activeLocation,
  selectedChannel,
  title,
  messages = [],
  streamMode = false,
  filterOpen = false,
  activeFilters = [],
  mentionCatalog,
  expandedThreadIds,
  replyTarget,
  composerText = '',
  composerDisabled = false,
  composerMentionOptions,
  onComposerChange,
  onComposerSubmit,
  onCancelReply,
  onStartReply,
  onToggleThread,
  onMentionClick,
  onToggleFilter,
  onRemoveFilter,
  onClearFilters,
  onCloseFilter,
}) {
  const composerMode = streamMode ? 'stream' : 'channel';
  return h('main', {
    className: 'relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-white dark:bg-slate-950/50',
    'data-chat-main-surface': 'true',
    'data-chat-view-type': activeLocation?.type || '',
    'data-chat-view-id': activeLocation?.id || '',
  }, [
    h('header', {
      className: 'border-b border-slate-200 py-2 dark:border-white/10',
      'data-chat-surface-header': 'true',
    }, h('div', { className: 'flex min-w-0 items-center justify-between gap-3' }, [
      h('div', { className: 'min-w-0' }, [
        h('div', { className: 'text-[11px] font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500' }, getSurfaceKicker(activeLocation)),
        h('div', { className: 'mt-0.5 flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-0.5' }, [
          h('h2', { className: 'min-w-0 truncate text-base font-semibold text-slate-950 dark:text-white' }, title || 'Stream'),
          h('p', { className: 'min-w-0 truncate text-xs text-slate-500 dark:text-slate-400' }, getSurfaceDescription(activeLocation, selectedChannel)),
        ]),
      ]),
      h('div', { className: 'shrink-0 rounded-md bg-slate-50 px-2 py-1 text-xs font-semibold text-slate-400 dark:bg-white/5 dark:text-slate-500' }, formatMessageCount(messages.length)),
    ])),
    h(ActiveFilterBar, {
      activeFilters,
      onRemoveFilter,
      onClearFilters,
    }),
    filterOpen ? h(ChatFilterPopover, {
      catalog: mentionCatalog,
      activeLocation,
      selectedChannel,
      activeFilters,
      onToggleFilter,
      onClose: onCloseFilter,
    }) : null,
    h('div', {
      className: 'min-h-0 flex-1 overflow-y-auto py-3 pb-24 sm:py-4',
      'data-chat-message-stream': 'true',
    }, h(ChatMessageList, {
      items: messages,
      streamMode,
      mentionCatalog,
      expandedThreadIds,
      replyTarget,
      onStartReply,
      onToggleThread,
      onMentionClick,
    })),
    h(ChatComposer, {
      mode: composerMode,
      value: composerText,
      replyTarget,
      disabled: composerDisabled,
      mentionOptions: composerMentionOptions,
      onChange: onComposerChange,
      onSubmit: onComposerSubmit,
      onCancelReply,
    }),
  ]);
}
