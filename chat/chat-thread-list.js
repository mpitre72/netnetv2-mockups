const { createElement: h } = React;

const GROUP_LABELS = {
  attention: 'Attention',
  work: 'Work',
  people: 'People',
  slack: 'Slack',
};

function Badge({ children, tone = 'default' }) {
  const toneClass = tone === 'purple'
    ? 'bg-netnet-purple text-white'
    : 'bg-slate-100 text-slate-500 dark:bg-white/10 dark:text-slate-300';
  return h('span', {
    className: `ml-auto inline-flex min-w-[1.5rem] items-center justify-center rounded-full px-1.5 py-0.5 text-[11px] font-semibold ${toneClass}`,
  }, children);
}

function BucketButton({ bucket, active, emphasized = false, onClick }) {
  const isPending = !!bucket.pending;
  return h('button', {
    type: 'button',
    onClick,
    className: [
      'flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition-colors',
      emphasized ? 'min-h-[44px] font-semibold' : 'font-medium',
      active
        ? 'bg-netnet-purple text-white shadow-sm'
        : emphasized
          ? 'bg-netnet-purple/10 text-netnet-purple ring-1 ring-netnet-purple/15 hover:bg-netnet-purple/15 dark:bg-white/10 dark:text-white dark:ring-white/10 dark:hover:bg-white/15'
          : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-white/10 dark:hover:text-white',
      isPending ? 'opacity-80' : '',
    ].join(' '),
    'aria-current': active ? 'page' : undefined,
  }, [
    h('span', { className: 'truncate' }, bucket.label),
    bucket.pending
      ? h('span', { className: active ? 'ml-auto text-[11px] text-white/80' : 'ml-auto text-[11px] text-slate-400 dark:text-slate-500' }, 'Ready')
      : bucket.count
        ? h(Badge, { tone: active || emphasized ? 'purple' : 'default' }, bucket.count)
        : null,
  ]);
}

function ConversationMeta({ conversation }) {
  const items = [
    conversation.isUnread || conversation.unreadCount ? 'Unread' : '',
    conversation.hasMention || conversation.mentionCount ? 'Mention' : '',
    conversation.hasDecision || conversation.decisionCount ? 'Decision' : '',
  ].filter(Boolean);
  if (!items.length) return null;
  return h('div', { className: 'mt-2 flex flex-wrap gap-1.5' }, items.map((item) =>
    h('span', {
      key: item,
      className: 'rounded-md bg-slate-100 px-1.5 py-0.5 text-[11px] font-medium text-slate-500 dark:bg-white/10 dark:text-slate-300',
    }, item)
  ));
}

function JobStreamRow({ conversation, selected, onSelect }) {
  return h('button', {
    type: 'button',
    onClick: onSelect,
    className: [
      'w-full rounded-lg border p-3 text-left transition-colors',
      selected
        ? 'border-netnet-purple bg-netnet-purple/10 shadow-sm dark:border-white/30 dark:bg-white/10'
        : 'border-netnet-purple/15 bg-white hover:border-netnet-purple/40 hover:bg-netnet-purple/5 dark:border-white/10 dark:bg-white/5 dark:hover:border-white/25 dark:hover:bg-white/10',
    ].join(' '),
    'aria-current': selected ? 'page' : undefined,
  }, [
    h('div', { className: 'mb-2 flex items-center gap-2' }, [
      h('span', {
        className: 'rounded-md bg-netnet-purple px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white',
      }, conversation.streamKind === 'internal' ? 'Internal' : 'Client'),
      h('span', { className: 'ml-auto text-[11px] font-medium text-slate-400 dark:text-slate-500' }, conversation.timestampDisplay || conversation.lastActivity),
    ]),
    h('div', { className: 'truncate text-sm font-semibold text-slate-900 dark:text-white' }, conversation.title),
    h('div', { className: 'mt-1 line-clamp-2 text-xs leading-5 text-slate-500 dark:text-slate-400' }, conversation.preview || conversation.subtitle),
    h(ConversationMeta, { conversation }),
  ]);
}

function PeopleConversationRow({ conversation, selected, onSelect }) {
  const isDirect = conversation.conversationType === 'direct-chats' || conversation.type === 'direct';
  return h('button', {
    type: 'button',
    onClick: onSelect,
    className: [
      'flex w-full items-start gap-3 rounded-lg px-3 py-2.5 text-left transition-colors',
      selected
        ? 'bg-slate-100 text-slate-900 dark:bg-white/10 dark:text-white'
        : 'text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-white/10',
    ].join(' '),
    'aria-current': selected ? 'page' : undefined,
  }, [
    h('div', {
      className: 'mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-[11px] font-semibold text-slate-500 ring-1 ring-slate-200 dark:bg-white/10 dark:text-slate-200 dark:ring-white/10',
      'aria-hidden': 'true',
    }, isDirect ? conversation.title.split(/\s+/).map((part) => part[0]).join('').slice(0, 2) : 'GC'),
    h('div', { className: 'min-w-0 flex-1' }, [
      h('div', { className: 'flex items-center gap-2' }, [
        h('span', { className: 'truncate text-sm font-semibold' }, conversation.title),
        h('span', { className: 'ml-auto text-[11px] text-slate-400 dark:text-slate-500' }, conversation.timestampDisplay || conversation.lastActivity),
      ]),
      h('div', { className: 'mt-1 truncate text-xs text-slate-500 dark:text-slate-400' }, conversation.preview || conversation.subtitle),
    ]),
  ]);
}

function SlackConversationRow({ conversation, selected, onSelect }) {
  return h('button', {
    type: 'button',
    onClick: onSelect,
    className: [
      'w-full rounded-lg border px-3 py-3 text-left transition-colors',
      selected
        ? 'border-slate-300 bg-slate-100 text-slate-900 dark:border-white/25 dark:bg-white/10 dark:text-white'
        : 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-white hover:text-slate-900 dark:border-white/10 dark:bg-white/5 dark:text-slate-300 dark:hover:bg-white/10 dark:hover:text-white',
    ].join(' '),
    'aria-current': selected ? 'page' : undefined,
  }, [
    h('div', { className: 'flex items-center gap-2' }, [
      h('span', { className: 'truncate text-sm font-semibold' }, conversation.title),
      h('span', { className: 'ml-auto rounded-md bg-white px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-400 ring-1 ring-slate-200 dark:bg-slate-900 dark:text-slate-400 dark:ring-white/10' }, 'Future'),
    ]),
    h('div', { className: 'mt-1 line-clamp-2 text-xs leading-5 text-slate-500 dark:text-slate-400' }, conversation.preview || conversation.subtitle),
  ]);
}

function ConversationListEmptyState({ title, description }) {
  return h('div', {
    className: 'rounded-lg border border-dashed border-slate-200 bg-slate-50 px-3 py-4 text-sm dark:border-white/10 dark:bg-white/5',
    'data-chat-list-empty': 'true',
  }, [
    h('div', { className: 'font-medium text-slate-700 dark:text-slate-200' }, title),
    description
      ? h('p', { className: 'mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400' }, description)
      : null,
  ]);
}

function SectionLabel({ groupKey }) {
  return h('div', {
    className: 'px-3 text-[11px] font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500',
  }, GROUP_LABELS[groupKey] || groupKey);
}

export function ChatThreadList({
  bucketGroups = [],
  conversations = [],
  activeBucketKey,
  activeBucketLabel,
  emptyState,
  selectedConversationId,
  onBucketSelect,
  onConversationSelect,
}) {
  const jobStreams = conversations.filter((conversation) => conversation.conversationType === 'job-streams' || conversation.bucketKey === 'job-streams');
  const directChats = conversations.filter((conversation) => conversation.conversationType === 'direct-chats' || conversation.bucketKey === 'direct-chats');
  const groupChats = conversations.filter((conversation) => conversation.conversationType === 'group-chats' || conversation.bucketKey === 'group-chats');
  const slackChannels = conversations.filter((conversation) => conversation.conversationType === 'slack-channels' || conversation.bucketKey === 'slack-channels');
  const hasConversations = conversations.length > 0;
  const activeGroupKey = (bucketGroups.find((group) => (group.buckets || []).some((bucket) => bucket.key === activeBucketKey)) || {}).key;
  const maybeEmptyState = (groupKey) => (!hasConversations && activeGroupKey === groupKey
    ? h(ConversationListEmptyState, {
      title: emptyState?.title || `No ${activeBucketLabel || 'conversations'} here yet.`,
      description: emptyState?.description,
    })
    : null);

  return h('aside', {
    className: 'flex min-h-0 flex-col overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm dark:border-white/10 dark:bg-slate-900/70',
    'data-chat-left-panel': 'true',
  }, [
    h('div', { className: 'border-b border-slate-200 px-4 py-3 dark:border-white/10' }, [
      h('div', { className: 'text-sm font-semibold text-slate-900 dark:text-white' }, 'Conversations'),
      h('div', { className: 'mt-1 text-xs text-slate-500 dark:text-slate-400' }, 'Attention first, then work and people.'),
    ]),
    h('div', { className: 'min-h-0 flex-1 space-y-5 overflow-y-auto p-3' }, bucketGroups.map((group) => {
      if (group.key === 'work') {
        return h('section', { key: group.key, className: 'space-y-3', 'data-chat-bucket-group': 'work' }, [
          h(SectionLabel, { groupKey: group.key }),
          group.buckets.map((bucket) => h(BucketButton, {
            key: bucket.key,
            bucket,
            emphasized: true,
            active: activeBucketKey === bucket.key,
            onClick: () => onBucketSelect(bucket.key),
          })),
          h('div', { className: 'space-y-2' }, jobStreams.map((conversation) => h(JobStreamRow, {
            key: conversation.id,
            conversation,
            selected: selectedConversationId === conversation.id,
            onSelect: () => onConversationSelect(conversation.id),
          }))),
          maybeEmptyState(group.key),
        ]);
      }

      if (group.key === 'people') {
        return h('section', { key: group.key, className: 'space-y-3', 'data-chat-bucket-group': 'people' }, [
          h(SectionLabel, { groupKey: group.key }),
          group.buckets.map((bucket) => {
            const rows = bucket.key === 'direct-chats' ? directChats : groupChats;
            return h('div', { key: bucket.key, className: 'space-y-1' }, [
              h(BucketButton, {
                bucket,
                active: activeBucketKey === bucket.key,
                onClick: () => onBucketSelect(bucket.key),
              }),
              h('div', { className: 'space-y-1' }, rows.map((conversation) => h(PeopleConversationRow, {
                key: conversation.id,
                conversation,
                selected: selectedConversationId === conversation.id,
                onSelect: () => onConversationSelect(conversation.id),
              }))),
            ]);
          }),
          maybeEmptyState(group.key),
        ]);
      }

      if (group.key === 'slack') {
        return h('section', { key: group.key, className: 'space-y-3', 'data-chat-bucket-group': 'slack' }, [
          h(SectionLabel, { groupKey: group.key }),
          group.buckets.map((bucket) => h(BucketButton, {
            key: bucket.key,
            bucket,
            active: activeBucketKey === bucket.key,
            onClick: () => onBucketSelect(bucket.key),
          })),
          h('div', { className: 'space-y-2' }, slackChannels.map((conversation) => h(SlackConversationRow, {
            key: conversation.id,
            conversation,
            selected: selectedConversationId === conversation.id,
            onSelect: () => onConversationSelect(conversation.id),
          }))),
          maybeEmptyState(group.key),
        ]);
      }

      return h('section', {
        key: group.key,
        className: 'space-y-2',
        'data-chat-bucket-group': group.key,
      }, [
        h(SectionLabel, { groupKey: group.key }),
        group.buckets.map((bucket) => h(BucketButton, {
          key: bucket.key,
          bucket,
          active: activeBucketKey === bucket.key,
          onClick: () => onBucketSelect(bucket.key),
        })),
        maybeEmptyState(group.key),
      ]);
    })),
  ]);
}
