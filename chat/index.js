import { mountSectionPageShell } from '../components/layout/section-page-shell.js';
import { chatUtilityViews, defaultChatLocation, directMessages, generalChannel, jobChannels } from '../data/mock-chat.js';
import { ChatChannelPanel } from './chat-channel-panel.js';
import { ChatHeader } from './chat-header.js';
import { ChatMainSurface } from './chat-main-surface.js';

const { createElement: h, useMemo, useState } = React;
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

function getAllChannels() {
  return [
    generalChannel,
    ...(jobChannels.active || []),
    ...(jobChannels.pending || []),
    ...(jobChannels.completed || []),
    ...directMessages,
  ].filter(Boolean);
}

function isValidLocation(location) {
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

function findSelectedChannel(location) {
  if (!location) return null;
  if (location.type === 'general') return generalChannel;
  if (location.type === 'job' || location.type === 'direct') {
    return getAllChannels().find((channel) => channel.id === location.id) || null;
  }
  return null;
}

function getCurrentViewLabel(location, selectedChannel) {
  if (selectedChannel?.title) return selectedChannel.title;
  const utility = chatUtilityViews.find((view) => view.id === location?.id);
  return utility?.label || 'Stream';
}

function toMessageItem(channel, message) {
  return {
    ...message,
    id: `${channel.id}-${message.id}`,
    sourceId: channel.id,
    sourceType: channel.type,
    sourceLabel: channel.title,
  };
}

function getStreamItems() {
  return getAllChannels()
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

function initialPanelOpen() {
  if (typeof window === 'undefined') return true;
  return window.innerWidth >= 1024;
}

function ChatShell() {
  const [activeLocation, setActiveLocation] = useState(() => loadInitialLocation());
  const [channelPanelOpen, setChannelPanelOpen] = useState(() => initialPanelOpen());
  const [searchQuery, setSearchQuery] = useState('');

  const streamItems = useMemo(() => getStreamItems(), []);
  const selectedChannel = useMemo(() => findSelectedChannel(activeLocation), [activeLocation]);
  const currentViewLabel = useMemo(
    () => getCurrentViewLabel(activeLocation, selectedChannel),
    [activeLocation, selectedChannel],
  );
  const messages = useMemo(() => (
    activeLocation?.type === 'utility'
      ? getUtilityItems(activeLocation, streamItems)
      : getChannelItems(selectedChannel)
  ), [activeLocation, selectedChannel, streamItems]);
  const utilityCounts = useMemo(() => getUtilityCounts(streamItems), [streamItems]);

  const selectLocation = (location) => {
    const nextLocation = isValidLocation(location) ? location : defaultChatLocation;
    setActiveLocation(nextLocation);
    safeSave(CHAT_LAST_LOCATION_KEY, nextLocation);
  };

  const streamMode = activeLocation?.type === 'utility';

  return h('div', { className: 'flex h-full min-h-0 flex-col gap-2', 'data-chat-reset-root': 'true' }, [
    h(ChatHeader, {
      key: 'header',
      currentViewLabel,
      searchQuery,
      onSearchChange: setSearchQuery,
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
