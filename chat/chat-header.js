import { SectionHeader } from '../components/layout/SectionHeader.js';

const { createElement: h } = React;

function FilterIcon() {
  return h('svg', { width: 16, height: 16, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round' }, [
    h('path', { d: 'M4 6h16' }),
    h('path', { d: 'M7 12h10' }),
    h('path', { d: 'M10 18h4' }),
  ]);
}

function ChannelsIcon() {
  return h('svg', { width: 16, height: 16, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round' }, [
    h('path', { d: 'M4 6h16' }),
    h('path', { d: 'M4 12h16' }),
    h('path', { d: 'M4 18h16' }),
  ]);
}

function HeaderButton({ active = false, label, onClick, children }) {
  return h('button', {
    type: 'button',
    onClick,
    'aria-label': label,
    'aria-pressed': active ? 'true' : 'false',
    className: [
      'nn-btn nn-btn--micro inline-flex items-center justify-center border focus-visible:ring-2 focus-visible:ring-netnet-purple',
      active
        ? 'border-netnet-purple bg-netnet-purple/10 text-netnet-purple dark:border-white/20 dark:bg-white/10 dark:text-white'
        : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50 dark:border-white/10 dark:bg-slate-900 dark:text-white dark:hover:bg-slate-800',
    ].join(' '),
  }, children);
}

export function ChatHeader({
  currentViewLabel = 'Stream',
  searchQuery = '',
  onSearchChange,
  channelPanelOpen = true,
  onToggleChannelPanel,
}) {
  return h(SectionHeader, {
    breadcrumbs: [
      { label: 'Chat' },
      { label: currentViewLabel },
    ],
    showHelpIcon: false,
    showSecondaryRow: true,
    showSearch: true,
    searchPlaceholder: 'Search Chat...',
    searchValue: searchQuery,
    onSearchChange,
    className: 'mb-0',
    rightActions: [
      h(HeaderButton, { key: 'filter', label: 'Filter Chat' }, h(FilterIcon)),
      h(HeaderButton, {
        key: 'channels',
        label: channelPanelOpen ? 'Hide channel list' : 'Show channel list',
        active: channelPanelOpen,
        onClick: onToggleChannelPanel,
      }, h(ChannelsIcon)),
    ],
  });
}
