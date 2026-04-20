export function getConversationType(conversation = {}) {
  return conversation.conversationType || conversation.bucketKey || conversation.type || '';
}

export function hasDecisionPresence(conversation = {}) {
  return Boolean(
    conversation.hasDecision ||
    conversation.decisionCount > 0 ||
    (conversation.workContext?.decisions || []).length > 0 ||
    (conversation.messages || []).some((message) => message?.tone === 'decision'),
  );
}

export function hasMentionPresence(conversation = {}) {
  return Boolean(
    conversation.hasMention ||
    conversation.mentionCount > 0 ||
    (conversation.messages || []).some((message) => message?.tone === 'mention'),
  );
}

export function hasUnreadPresence(conversation = {}) {
  return Boolean(conversation.isUnread || conversation.unreadCount > 0);
}

export function filterChatConversations(conversations = [], bucketKey = 'all') {
  if (bucketKey === 'all') return conversations;
  if (bucketKey === 'unread') return conversations.filter(hasUnreadPresence);
  if (bucketKey === 'mentions') return conversations.filter(hasMentionPresence);
  if (bucketKey === 'decisions') return conversations.filter(hasDecisionPresence);
  return conversations.filter((conversation) => getConversationType(conversation) === bucketKey);
}

export function getBucketCount(conversations = [], bucketKey = 'all') {
  return filterChatConversations(conversations, bucketKey).length;
}

export function withConversationCounts(bucketGroups = [], conversations = []) {
  return bucketGroups.map((group) => ({
    ...group,
    buckets: (group.buckets || []).map((bucket) => ({
      ...bucket,
      count: getBucketCount(conversations, bucket.key),
    })),
  }));
}

export function getBucketLabel(bucketGroups = [], bucketKey = 'all') {
  for (const group of bucketGroups) {
    const bucket = (group.buckets || []).find((item) => item.key === bucketKey);
    if (bucket) return bucket.label;
  }
  return 'Conversations';
}

export function getBucketEmptyState(bucketKey = 'all') {
  const copy = {
    all: {
      title: 'No conversations here yet.',
      description: 'New Job Streams, Direct Chats, and Group Chats will appear here.',
    },
    unread: {
      title: 'No unread conversations here.',
      description: 'Anything needing fresh attention will appear in this bucket.',
    },
    mentions: {
      title: 'No mentions here right now.',
      description: 'Conversations that mention you will collect here.',
    },
    decisions: {
      title: 'No decision-linked conversations here yet.',
      description: 'Conversations with seeded decisions will appear here.',
    },
    'job-streams': {
      title: 'No Job Streams here yet.',
      description: 'Client and internal job conversations will appear here.',
    },
    'direct-chats': {
      title: 'No Direct Chats here yet.',
      description: 'One-to-one conversations will appear here.',
    },
    'group-chats': {
      title: 'No Group Chats here yet.',
      description: 'Small team conversations will appear here.',
    },
    'slack-channels': {
      title: 'Slack Channels are ready for sync.',
      description: 'Connected Slack channel conversations will appear here once sync is enabled.',
    },
  };
  return copy[bucketKey] || copy.all;
}
