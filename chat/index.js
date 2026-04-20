import { SectionHeader } from '../components/layout/SectionHeader.js';
import { mountSectionPageShell } from '../components/layout/section-page-shell.js';
import { chatBucketGroups, chatConversations, defaultChatConversationId } from '../data/mock-chat.js';
import { filterChatConversations, getBucketEmptyState, getBucketLabel, withConversationCounts } from './chat-conversation-filters.js';
import { ChatContextPanel } from './chat-context-panel.js';
import { ChatConversationPanel } from './chat-conversation-panel.js';
import { ChatThreadList } from './chat-thread-list.js';

const { createElement: h, useMemo, useState } = React;
const { createRoot } = ReactDOM;

let headerRoot = null;
let bodyRoot = null;
let currentContainer = null;

function findConversation(conversationId) {
  return chatConversations.find((conversation) => conversation.id === conversationId) || null;
}

function ChatShell() {
  const [activeBucketKey, setActiveBucketKey] = useState('all');
  const [selectedConversationId, setSelectedConversationId] = useState(defaultChatConversationId);

  const bucketGroupsWithCounts = useMemo(
    () => withConversationCounts(chatBucketGroups, chatConversations),
    [],
  );
  const filteredConversations = useMemo(
    () => filterChatConversations(chatConversations, activeBucketKey),
    [activeBucketKey],
  );
  const selectedConversation = useMemo(
    () => findConversation(selectedConversationId),
    [selectedConversationId],
  );
  const activeBucketLabel = useMemo(
    () => getBucketLabel(bucketGroupsWithCounts, activeBucketKey),
    [bucketGroupsWithCounts, activeBucketKey],
  );
  const bucketEmptyState = useMemo(
    () => getBucketEmptyState(activeBucketKey),
    [activeBucketKey],
  );
  const centerEmptyState = useMemo(() => (
    filteredConversations.length
      ? {
        title: `Choose a conversation from ${activeBucketLabel}`,
        description: `Select a conversation in ${activeBucketLabel} to load its messages and work context.`,
      }
      : bucketEmptyState
  ), [filteredConversations.length, activeBucketLabel, bucketEmptyState]);

  const handleBucketSelect = (bucketKey) => {
    const nextConversations = filterChatConversations(chatConversations, bucketKey);
    setActiveBucketKey(bucketKey);
    setSelectedConversationId((currentId) => (
      nextConversations.some((conversation) => conversation.id === currentId) ? currentId : null
    ));
  };

  const handleConversationSelect = (conversationId) => {
    setSelectedConversationId(conversationId);
  };

  return h('section', {
    className: 'grid h-full min-h-[640px] min-w-0 grid-cols-1 gap-4 xl:grid-cols-[300px_minmax(520px,1fr)_320px]',
    'data-chat-shell': 'three-panel',
  }, [
    h(ChatThreadList, {
      key: 'left',
      bucketGroups: bucketGroupsWithCounts,
      conversations: filteredConversations,
      activeBucketKey,
      activeBucketLabel,
      emptyState: bucketEmptyState,
      selectedConversationId,
      onBucketSelect: handleBucketSelect,
      onConversationSelect: handleConversationSelect,
    }),
    h(ChatConversationPanel, {
      key: 'center',
      conversation: selectedConversation,
      activeBucketLabel,
      emptyState: centerEmptyState,
    }),
    h(ChatContextPanel, {
      key: 'right',
      conversation: selectedConversation,
    }),
  ]);
}

function mountChatRoots(container) {
  const { headerMount, bodyMount } = mountSectionPageShell(container, {
    headerId: 'chat-header',
    bodyId: 'chat-body',
  });

  if (!headerMount || !bodyMount) return false;
  bodyMount.className = 'nn-content-container min-h-0 flex-1 pb-8';
  headerRoot = createRoot(headerMount);
  bodyRoot = createRoot(bodyMount);
  currentContainer = container;
  return true;
}

export function renderChatPage(container = document.getElementById('app-main')) {
  if (!container) {
    console.warn('[ChatModule] container not found for renderChatPage.');
    return;
  }

  if (currentContainer !== container || !headerRoot || !bodyRoot) {
    unmountChatPage();
    if (!mountChatRoots(container)) return;
  }

  headerRoot.render(h(SectionHeader, {
    breadcrumbs: [
      { label: 'Chat' },
    ],
    showHelpIcon: true,
    showSecondaryRow: false,
    className: 'mb-1',
  }));

  bodyRoot.render(h(ChatShell));
}

export function unmountChatPage() {
  if (!headerRoot && !bodyRoot && !currentContainer) return;
  try {
    headerRoot?.unmount();
    bodyRoot?.unmount();
  } catch (err) {
    console.warn('[ChatModule] Failed to unmount chat root.', err);
  }
  headerRoot = null;
  bodyRoot = null;
  if (currentContainer) {
    currentContainer.innerHTML = '';
    currentContainer = null;
  }
}
