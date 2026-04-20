import { mountSectionPageShell } from '../components/layout/section-page-shell.js';
import {
  chatUtilityViews,
  defaultChatLocation,
  directMessages as seededDirectMessages,
  generalChannel as seededGeneralChannel,
  jobChannels as seededJobChannels,
  workRefs,
} from '../data/mock-chat.js';
import { loadTeamMembers } from '../quick-tasks/quick-tasks-store.js';
import { ChatChannelPanel } from './chat-channel-panel.js';
import { ChatHeader } from './chat-header.js';
import { ChatMainSurface } from './chat-main-surface.js';
import {
  applyChatFilters,
  buildMentionCatalog,
  filterKey,
  getComposerWorkOptions,
  makeFilterFromOption,
  normalizeMentionLabel,
} from './chat-mention-utils.js';

const { createElement: h, useEffect, useMemo, useState } = React;
const { createRoot } = ReactDOM;

const CHAT_LAST_LOCATION_KEY = 'netnet_chat_last_location_v1';

let headerRoot = null;
let bodyRoot = null;
let currentContainer = null;

function safeLoad(key, fallback = null) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch (err) {
    return fallback;
  }
}

function safeSave(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (err) {
    // Ignore storage failures in this local UI foundation.
  }
}

function cloneChatSeed() {
  return {
    generalChannel: JSON.parse(JSON.stringify(seededGeneralChannel)),
    jobChannels: JSON.parse(JSON.stringify(seededJobChannels)),
    directMessages: JSON.parse(JSON.stringify(seededDirectMessages)),
  };
}

function getAllChannels({ generalChannel, jobChannels, directMessages }) {
  return [
    generalChannel,
    ...(jobChannels.active || []),
    ...(jobChannels.pending || []),
    ...(jobChannels.completed || []),
    ...directMessages,
  ].filter(Boolean);
}

function isValidLocation(location, chatState = {
  generalChannel: seededGeneralChannel,
  jobChannels: seededJobChannels,
  directMessages: seededDirectMessages,
}) {
  const { generalChannel, jobChannels, directMessages } = chatState;
  if (!location || !location.type || !location.id) return false;
  if (location.type === 'utility') return chatUtilityViews.some((view) => view.id === location.id);
  if (location.type === 'general') return generalChannel?.id === location.id;
  if (location.type === 'job') {
    return [...(jobChannels.active || []), ...(jobChannels.pending || []), ...(jobChannels.completed || [])]
      .some((channel) => channel.id === location.id);
  }
  if (location.type === 'direct') return directMessages.some((channel) => channel.id === location.id);
  return false;
}

function loadInitialLocation() {
  const remembered = safeLoad(CHAT_LAST_LOCATION_KEY, null);
  return isValidLocation(remembered) ? remembered : defaultChatLocation;
}

function findSelectedChannel(location, chatState) {
  if (!location) return null;
  if (location.type === 'general') return chatState.generalChannel;
  if (location.type === 'job' || location.type === 'direct') {
    return getAllChannels(chatState).find((channel) => channel.id === location.id) || null;
  }
  return null;
}

function getCurrentViewLabel(location, selectedChannel) {
  if (selectedChannel?.title) return selectedChannel.title;
  const utility = chatUtilityViews.find((view) => view.id === location?.id);
  return utility?.label || 'Stream';
}

function toMessageItem(channel, message) {
  const messageId = String(message.id);
  return {
    ...message,
    id: `${channel.id}-${messageId}`,
    messageId,
    sourceId: channel.id,
    sourceType: channel.type,
    sourceLabel: channel.title,
    threadId: `${channel.id}:${messageId}`,
    replies: (message.replies || []).map((reply) => ({
      ...reply,
      id: `${channel.id}-${messageId}-${reply.id}`,
      replyId: String(reply.id),
      parentId: messageId,
      sourceId: channel.id,
      sourceType: channel.type,
      sourceLabel: channel.title,
      threadId: `${channel.id}:${messageId}`,
    })),
  };
}

function getStreamItems(chatState) {
  return getAllChannels(chatState)
    .flatMap((channel) => (channel.messages || []).map((message) => toMessageItem(channel, message)))
    .sort((a, b) => Number(a.sortAt || 0) - Number(b.sortAt || 0));
}

function getUtilityItems(location, streamItems) {
  if (location?.id === 'unread') return streamItems.filter((item) => item.isUnread);
  if (location?.id === 'mentions') return streamItems.filter((item) => item.hasMention);
  return streamItems;
}

function getChannelItems(channel) {
  if (!channel) return [];
  return (channel.messages || [])
    .map((message) => toMessageItem(channel, message))
    .sort((a, b) => Number(a.sortAt || 0) - Number(b.sortAt || 0));
}

function getUtilityCounts(streamItems) {
  return {
    stream: streamItems.length,
    unread: streamItems.filter((item) => item.isUnread).length,
    mentions: streamItems.filter((item) => item.hasMention).length,
  };
}

function toggleFilterList(filters, filter) {
  const key = filterKey(filter);
  return filters.some((item) => filterKey(item) === key)
    ? filters.filter((item) => filterKey(item) !== key)
    : [...filters, filter];
}

function removeFilterFromList(filters, filter) {
  const key = filterKey(filter);
  return filters.filter((item) => filterKey(item) !== key);
}

function resolveMentionFilter(token, mentionCatalog) {
  if (!token) return null;
  if (token.ref) return makeFilterFromOption(token.ref);
  if (token.type === 'person') {
    return {
      type: 'person',
      id: `person-${normalizeMentionLabel(token.label).replace(/\s+/g, '-')}`,
      label: token.label,
    };
  }
  return {
    type: token.type,
    id: `${token.type}-${normalizeMentionLabel(token.label).replace(/\s+/g, '-')}`,
    label: token.label,
  };
}

function updateChannelMessage(chatState, sourceId, updater) {
  const updateMessages = (channel) => {
    if (!channel || channel.id !== sourceId) return channel;
    return {
      ...channel,
      messages: (channel.messages || []).map(updater),
    };
  };

  return {
    generalChannel: updateMessages(chatState.generalChannel),
    jobChannels: {
      active: (chatState.jobChannels.active || []).map(updateMessages),
      pending: (chatState.jobChannels.pending || []).map(updateMessages),
      completed: (chatState.jobChannels.completed || []).map(updateMessages),
    },
    directMessages: (chatState.directMessages || []).map(updateMessages),
  };
}

function addReplyToParent(chatState, replyTarget, reply) {
  return updateChannelMessage(chatState, replyTarget.sourceId, (message) => {
    if (String(message.id) !== String(replyTarget.messageId)) return message;
    return {
      ...message,
      replies: [...(message.replies || []), reply],
    };
  });
}

function addTopLevelMessage(chatState, channel, message) {
  if (!channel) return chatState;
  const appendMessage = (candidate) => (
    candidate?.id === channel.id
      ? { ...candidate, messages: [...(candidate.messages || []), message] }
      : candidate
  );
  return {
    generalChannel: appendMessage(chatState.generalChannel),
    jobChannels: {
      active: (chatState.jobChannels.active || []).map(appendMessage),
      pending: (chatState.jobChannels.pending || []).map(appendMessage),
      completed: (chatState.jobChannels.completed || []).map(appendMessage),
    },
    directMessages: (chatState.directMessages || []).map(appendMessage),
  };
}

function makeLocalTimestamp() {
  return { label: 'Now', sortAt: Date.now() };
}

function initialPanelOpen() {
  if (typeof window === 'undefined') return true;
  return window.innerWidth >= 1024;
}

function ChatShell() {
  const [chatState, setChatState] = useState(() => cloneChatSeed());
  const [activeLocation, setActiveLocation] = useState(() => loadInitialLocation());
  const [channelPanelOpen, setChannelPanelOpen] = useState(() => initialPanelOpen());
  const [searchQuery, setSearchQuery] = useState('');
  const [filterOpen, setFilterOpen] = useState(false);
  const [activeFilters, setActiveFilters] = useState([]);
  const [expandedThreadIds, setExpandedThreadIds] = useState(() => new Set());
  const [replyTarget, setReplyTarget] = useState(null);
  const [composerText, setComposerText] = useState('');

  const { generalChannel, jobChannels, directMessages } = chatState;
  const teamMembers = useMemo(() => loadTeamMembers(), []);
  const mentionCatalog = useMemo(
    () => buildMentionCatalog(chatState, workRefs, teamMembers),
    [chatState, teamMembers],
  );
  const streamItems = useMemo(() => getStreamItems(chatState), [chatState]);
  const selectedChannel = useMemo(() => findSelectedChannel(activeLocation, chatState), [activeLocation, chatState]);
  const currentViewLabel = useMemo(
    () => getCurrentViewLabel(activeLocation, selectedChannel),
    [activeLocation, selectedChannel],
  );
  const baseMessages = useMemo(() => (
    activeLocation?.type === 'utility'
      ? getUtilityItems(activeLocation, streamItems)
      : getChannelItems(selectedChannel)
  ), [activeLocation, selectedChannel, streamItems]);
  const messages = useMemo(() => applyChatFilters(baseMessages, activeFilters, {
    catalog: mentionCatalog,
    streamMode: activeLocation?.type === 'utility',
    selectedChannel,
  }), [activeFilters, activeLocation, baseMessages, mentionCatalog, selectedChannel]);
  const utilityCounts = useMemo(() => getUtilityCounts(streamItems), [streamItems]);
  const composerMentionOptions = useMemo(() => ({
    work: getComposerWorkOptions(mentionCatalog, activeLocation, selectedChannel),
    people: mentionCatalog.people || [],
  }), [activeLocation, mentionCatalog, selectedChannel]);

  useEffect(() => {
    setReplyTarget(null);
    setComposerText('');
  }, [activeLocation?.type, activeLocation?.id]);

  const selectLocation = (location) => {
    const nextLocation = isValidLocation(location, chatState) ? location : defaultChatLocation;
    setActiveFilters([]);
    setFilterOpen(false);
    setActiveLocation(nextLocation);
    safeSave(CHAT_LAST_LOCATION_KEY, nextLocation);
  };

  const streamMode = activeLocation?.type === 'utility';
  const composerDisabled = streamMode && !replyTarget;

  const toggleThread = (threadId) => {
    if (!threadId) return;
    setExpandedThreadIds((prev) => {
      const next = new Set(prev);
      if (next.has(threadId)) next.delete(threadId);
      else next.add(threadId);
      return next;
    });
  };

  const startReply = (item) => {
    if (!item) return;
    const nextTarget = {
      threadId: item.threadId,
      sourceId: item.sourceId,
      sourceLabel: item.sourceLabel,
      sourceType: item.sourceType,
      messageId: item.messageId,
      author: item.author,
    };
    setReplyTarget(nextTarget);
    setExpandedThreadIds((prev) => {
      const next = new Set(prev);
      next.add(item.threadId);
      return next;
    });
  };

  const clearReplyTarget = () => {
    setReplyTarget(null);
    setComposerText('');
  };

  const toggleActiveFilter = (filter) => {
    if (!filter) return;
    setActiveFilters((prev) => toggleFilterList(prev, filter));
  };

  const removeActiveFilter = (filter) => {
    setActiveFilters((prev) => removeFilterFromList(prev, filter));
  };

  const clearActiveFilters = () => setActiveFilters([]);

  const handleMentionClick = (token) => {
    const filter = resolveMentionFilter(token, mentionCatalog);
    if (!filter) return;

    setActiveFilters((prev) => toggleFilterList(prev, filter));
    setFilterOpen(false);
  };

  const handleComposerSubmit = () => {
    const body = String(composerText || '').trim();
    if (!body) return;
    const timestamp = makeLocalTimestamp();
    if (replyTarget) {
      const reply = {
        id: `reply-${timestamp.sortAt}`,
        parentId: replyTarget.messageId,
        author: 'Marc Pitre',
        timestamp: timestamp.label,
        sortAt: timestamp.sortAt,
        body,
        isUnread: false,
        hasMention: body.includes('@'),
      };
      setChatState((prev) => addReplyToParent(prev, replyTarget, reply));
      setExpandedThreadIds((prev) => {
        const next = new Set(prev);
        next.add(replyTarget.threadId);
        return next;
      });
      setReplyTarget(null);
      setComposerText('');
      return;
    }

    if (streamMode || !selectedChannel) return;
    const message = {
      id: `local-${timestamp.sortAt}`,
      author: 'Marc Pitre',
      timestamp: timestamp.label,
      sortAt: timestamp.sortAt,
      body,
      isUnread: false,
      hasMention: body.includes('@'),
      replies: [],
    };
    setChatState((prev) => addTopLevelMessage(prev, selectedChannel, message));
    setComposerText('');
  };

  return h('div', { className: 'flex h-full min-h-0 flex-col gap-2 px-4', 'data-chat-root': 'true' }, [
    h(ChatHeader, {
      key: 'header',
      currentViewLabel,
      searchQuery,
      onSearchChange: setSearchQuery,
      filterOpen,
      activeFilterCount: activeFilters.length,
      onToggleFilter: () => setFilterOpen((open) => !open),
      channelPanelOpen,
      onToggleChannelPanel: () => setChannelPanelOpen((open) => !open),
    }),
    h('section', {
      key: 'body',
      className: 'flex min-h-0 min-w-0 flex-1 flex-col gap-3 lg:flex-row',
      'data-chat-shell': 'stream-channel',
    }, [
      h(ChatMainSurface, {
        key: 'main',
        activeLocation,
        selectedChannel,
        title: currentViewLabel,
        messages,
        streamMode,
        filterOpen,
        activeFilters,
        mentionCatalog,
        expandedThreadIds,
        replyTarget,
        composerText,
        composerDisabled,
        composerMentionOptions,
        onComposerChange: setComposerText,
        onComposerSubmit: handleComposerSubmit,
        onCancelReply: clearReplyTarget,
        onStartReply: startReply,
        onToggleThread: toggleThread,
        onMentionClick: handleMentionClick,
        onToggleFilter: toggleActiveFilter,
        onRemoveFilter: removeActiveFilter,
        onClearFilters: clearActiveFilters,
        onCloseFilter: () => setFilterOpen(false),
      }),
      channelPanelOpen ? h(ChatChannelPanel, {
        key: 'channels',
        activeLocation,
        utilityViews: chatUtilityViews,
        generalChannel,
        jobChannels,
        directMessages,
        utilityCounts,
        onSelectLocation: selectLocation,
        onClose: () => setChannelPanelOpen(false),
      }) : null,
    ]),
  ]);
}

function mountChatRoots(container) {
  const { headerMount, bodyMount } = mountSectionPageShell(container, {
    headerId: 'chat-header',
    bodyId: 'chat-body',
  });

  if (!headerMount || !bodyMount) return false;
  headerMount.className = 'hidden';
  bodyMount.className = 'w-full min-h-0 flex-1 pb-0 pt-0';
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

  headerRoot.render(null);
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
