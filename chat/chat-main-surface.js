import { ChatComposer } from './chat-composer.js';
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
    return 'All work channels and direct messages, ordered by latest activity.';
  }
  if (location?.type === 'utility' && location.id === 'unread') {
    return 'Seeded unread activity across your Chat channels.';
  }
  if (location?.type === 'utility' && location.id === 'mentions') {
    return 'Seeded messages where someone mentioned you.';
  }
  return selectedChannel?.subtitle || 'Channel conversation';
}

export function ChatMainSurface({
  activeLocation,
  selectedChannel,
  title,
  messages = [],
  streamMode = false,
}) {
  const composerMode = streamMode ? 'stream' : 'channel';
  return h('main', {
    className: 'flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-white dark:bg-slate-950/50',
    'data-chat-main-surface': 'true',
    'data-chat-view-type': activeLocation?.type || '',
    'data-chat-view-id': activeLocation?.id || '',
  }, [
    h('header', {
      className: 'border-b border-slate-200 px-3 py-3 sm:px-4 dark:border-white/10',
      'data-chat-surface-header': 'true',
    }, [
      h('div', { className: 'text-xs font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500' }, getSurfaceKicker(activeLocation)),
      h('h2', { className: 'mt-1 text-xl font-semibold text-slate-950 dark:text-white' }, title || 'Stream'),
      h('p', { className: 'mt-1 max-w-2xl text-sm leading-6 text-slate-500 dark:text-slate-400' }, getSurfaceDescription(activeLocation, selectedChannel)),
    ]),
    h('div', {
      className: 'min-h-0 flex-1 overflow-y-auto px-3 py-4 pb-28 sm:px-4',
      'data-chat-message-stream': 'true',
    }, h(ChatMessageList, { items: messages, streamMode })),
    h(ChatComposer, { mode: composerMode }),
  ]);
}
