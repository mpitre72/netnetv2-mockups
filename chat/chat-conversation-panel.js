import { ChatMessageInput } from './chat-message-input.js';
import { ChatMessageList } from './chat-message-list.js';
import { ChatConversationEmptyState } from './chat-empty-states.js';

const { createElement: h } = React;

function getConversationVariant(conversation = {}) {
  return conversation.conversationType || conversation.bucketKey || conversation.type || 'all';
}

function getHeaderConfig(conversation = {}) {
  const variant = getConversationVariant(conversation);
  if (variant === 'job-streams') {
    const streamKind = conversation.streamKind === 'internal' ? 'Internal Job Stream' : 'Client Job Stream';
    const linkedCount = (conversation.workContext?.linkedWork || []).length;
    return {
      variant,
      label: streamKind,
      badge: conversation.statusLabel || streamKind,
      detail: linkedCount ? `${linkedCount} linked work items` : 'Work-aware conversation',
      toneClass: 'bg-netnet-purple/10 text-netnet-purple ring-netnet-purple/15 dark:bg-white/10 dark:text-white dark:ring-white/10',
    };
  }
  if (variant === 'direct-chats') {
    return {
      variant,
      label: 'Direct Chat',
      badge: 'People',
      detail: 'One-to-one delivery coordination',
      toneClass: 'bg-slate-100 text-slate-600 ring-slate-200 dark:bg-white/10 dark:text-slate-200 dark:ring-white/10',
    };
  }
  if (variant === 'group-chats') {
    const count = (conversation.participants || []).length;
    return {
      variant,
      label: 'Group Chat',
      badge: count ? `${count} people` : 'Team',
      detail: 'Small team delivery coordination',
      toneClass: 'bg-slate-100 text-slate-600 ring-slate-200 dark:bg-white/10 dark:text-slate-200 dark:ring-white/10',
    };
  }
  if (variant === 'slack-channels') {
    return {
      variant,
      label: 'Slack Channel',
      badge: 'Future Sync',
      detail: 'Placeholder for synced Slack channel history',
      toneClass: 'bg-slate-100 text-slate-500 ring-slate-200 dark:bg-white/10 dark:text-slate-300 dark:ring-white/10',
    };
  }
  return {
    variant,
    label: conversation.eyebrow || 'Conversation',
    badge: conversation.statusLabel || 'Chat',
    detail: 'Delivery conversation',
    toneClass: 'bg-slate-100 text-slate-600 ring-slate-200 dark:bg-white/10 dark:text-slate-200 dark:ring-white/10',
  };
}

function HeaderMeta({ label, value }) {
  if (!value) return null;
  return h('div', { className: 'rounded-lg border border-slate-200 bg-white/80 px-3 py-2 dark:border-white/10 dark:bg-white/5' }, [
    h('div', { className: 'text-[10px] font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500' }, label),
    h('div', { className: 'mt-0.5 max-w-[180px] truncate text-xs font-semibold text-slate-700 dark:text-slate-200' }, value),
  ]);
}

function ConversationHeader({ conversation, variant }) {
  const participantLabel = (conversation.participants || []).join(', ');
  const config = getHeaderConfig({ ...conversation, conversationType: variant || conversation.conversationType });
  return h('header', {
    className: 'border-b border-slate-200 bg-white px-5 py-4 dark:border-white/10 dark:bg-slate-950/60',
    'data-chat-conversation-header': 'true',
    'data-chat-conversation-type': config.variant,
  }, [
    h('div', { className: 'flex flex-wrap items-start justify-between gap-3' }, [
      h('div', { className: 'min-w-0 flex-1' }, [
        h('div', { className: 'mb-1 flex flex-wrap items-center gap-2' }, [
          h('span', { className: 'text-xs font-semibold uppercase tracking-wide text-netnet-purple dark:text-white/80' }, config.label),
          h('span', { className: `rounded-md px-1.5 py-0.5 text-[11px] font-semibold ring-1 ${config.toneClass}` }, config.badge),
        ]),
        h('h2', { className: 'truncate text-lg font-semibold text-slate-900 dark:text-white' }, conversation.title),
        h('p', { className: 'mt-1 line-clamp-1 text-sm text-slate-500 dark:text-slate-400' }, conversation.preview || conversation.subtitle),
      ]),
      h('div', { className: 'flex flex-wrap justify-end gap-2' }, [
        h(HeaderMeta, { label: 'Context', value: config.detail }),
        h(HeaderMeta, { label: 'Last activity', value: conversation.timestampDisplay || conversation.lastActivity }),
      ]),
    ]),
    h('div', { className: 'mt-3 flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400' }, [
      h('span', { className: 'font-medium text-slate-600 dark:text-slate-300' }, config.variant === 'slack-channels' ? 'Sync status' : 'Participants'),
      h('span', { className: 'min-w-0 truncate' }, config.variant === 'slack-channels' ? 'Slack sync is not connected yet.' : participantLabel),
    ]),
  ]);
}

export function ChatConversationPanel({ conversation, activeBucketLabel, emptyState }) {
  return h('section', {
    className: 'flex min-h-0 flex-col overflow-hidden rounded-lg border border-slate-200 bg-slate-50 shadow-sm dark:border-white/10 dark:bg-slate-950/40',
    'data-chat-center-panel': 'true',
  }, conversation
    ? [
      h(ConversationHeader, { key: 'header', conversation, variant: conversation.conversationType }),
      h('div', {
        key: 'messages',
        className: 'min-h-0 flex-1 overflow-y-auto px-5 py-5',
        'data-chat-message-stream': 'true',
      }, h(ChatMessageList, {
        conversationId: conversation.id,
        messages: conversation.messages || [],
        conversationType: conversation.conversationType,
      })),
      h(ChatMessageInput, { key: 'composer', conversationType: conversation.conversationType }),
    ]
    : h(ChatConversationEmptyState, { bucketLabel: activeBucketLabel, emptyState }));
}
