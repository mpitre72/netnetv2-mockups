const { createElement: h, useState, useEffect } = React;

const VIDEO_HELP_ICONS = {
  light: {
    idle: 'public/assets/brand/chrome/VidHelp-Idle.svg',
    active: 'public/assets/brand/chrome/VidHelp-Active.svg',
  },
  dark: {
    idle: 'public/assets/brand/chrome/VidHelp-Idle-white.svg',
    active: 'public/assets/brand/chrome/VidHelp-Active-white.svg',
  },
};

function isDark() {
  if (typeof document === 'undefined') return false;
  return document.documentElement.classList.contains('dark');
}

function VideoHelpIcon({ isActive = false, onClick }) {
  const [isHovered, setIsHovered] = useState(false);
  const dark = isDark();
  const useActive = isActive || isHovered;
  const src = useActive
    ? (dark ? VIDEO_HELP_ICONS.dark.active : VIDEO_HELP_ICONS.light.active)
    : (dark ? VIDEO_HELP_ICONS.dark.idle : VIDEO_HELP_ICONS.light.idle);
  return h('img', {
    src,
    alt: 'Video help',
    role: 'button',
    tabIndex: 0,
    className: 'h-6 w-6 cursor-pointer select-none transition-opacity hover:opacity-90',
    onClick,
    onMouseEnter: () => setIsHovered(true),
    onMouseLeave: () => setIsHovered(false),
    onKeyDown: (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        onClick && onClick();
      }
    },
    'aria-label': 'Open video help',
  });
}

export function SectionHeader({
  title,
  showHelpIcon = false,
  switcherOptions,
  switcherValue,
  onSwitcherChange,
  leftActions,
  rightActions,
  actions, // backward compatibility: treated as rightActions
  showSearch = false,
  searchPlaceholder = 'Search',
  searchValue = '',
  onSearchChange,
  className = '',
}) {
  const [localSearch, setLocalSearch] = useState(searchValue || '');
  const [helpActive, setHelpActive] = useState(false);

  useEffect(() => {
    setLocalSearch(searchValue || '');
  }, [searchValue]);

  const openHelp = () => {
    setHelpActive(true);
    const shell = document.getElementById('app-shell');
    const drawer = document.getElementById('drawer-container');
    if (shell) shell.classList.remove('drawer-closed');
    if (drawer) {
      drawer.innerHTML = `
        <div id="app-drawer-backdrop"></div>
        <aside id="app-drawer" class="bg-[#111827] text-white p-5 flex flex-col gap-3 w-full max-w-md">
          <div class="flex items-center justify-between">
            <h2 class="text-lg font-semibold">Video Help coming soon</h2>
            <button type="button" id="sectionHelpClose" class="text-white/70 hover:text-white">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          </div>
          <p class="text-sm text-white/80">A curated library of show-me-how videos will live here for this section.</p>
        </aside>
      `;
      const close = () => {
        shell?.classList.add('drawer-closed');
        setHelpActive(false);
      };
      const closeBtn = document.getElementById('sectionHelpClose');
      if (closeBtn) closeBtn.onclick = close;
      const backdrop = document.getElementById('app-drawer-backdrop');
      if (backdrop) backdrop.onclick = close;
    }
  };

  const resolvedRightActions = rightActions || actions;

  return h(
    'div',
    { className: `w-full flex flex-col gap-3 ${className}` },
    [
      // Top row: help + title
      h(
        'div',
        { className: 'flex items-center gap-3' },
        [
          showHelpIcon ? h(VideoHelpIcon, { isActive: helpActive, onClick: openHelp }) : null,
          h('h1', { className: 'text-2xl font-semibold text-slate-900 dark:text-white leading-tight' }, title),
        ].filter(Boolean)
      ),
      // Bottom row: left actions | switcher | search | right actions
      h(
        'div',
        { className: 'flex flex-wrap items-center gap-3 w-full' },
        [
          leftActions ? h('div', { className: 'flex items-center gap-2' }, leftActions) : null,
          switcherOptions && switcherOptions.length
            ? h(
                'div',
                { className: 'inline-flex items-center gap-1 rounded-full border border-slate-300 dark:border-white/10 bg-slate-50 dark:bg-slate-800 px-1 py-1' },
                switcherOptions.map((opt) =>
                  h(
                    'button',
                    {
                      key: opt.value,
                      type: 'button',
                      className: [
                        'px-3 py-1 rounded-full text-sm font-medium transition-colors',
                        opt.value === switcherValue
                          ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm'
                          : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white',
                      ].join(' '),
                      onClick: () => onSwitcherChange && onSwitcherChange(opt.value),
                    },
                    opt.label
                  )
                )
              )
            : null,
          showSearch
            ? h(
                'div',
                { className: 'flex-1 min-w-[200px]' },
                h('input', {
                  type: 'search',
                  value: localSearch,
                  onChange: (e) => {
                    setLocalSearch(e.target.value);
                    onSearchChange && onSearchChange(e.target.value);
                  },
                  placeholder: searchPlaceholder,
                  className:
                    'w-full rounded-lg border border-slate-300 dark:border-white/10 bg-white dark:bg-slate-900 px-3 py-2 text-sm text-slate-800 dark:text-white shadow-inner focus:outline-none focus:ring-2 focus:ring-netnet-purple',
                })
              )
            : null,
          resolvedRightActions ? h('div', { className: 'flex items-center gap-2' }, resolvedRightActions) : null,
        ].filter(Boolean)
      ),
    ]
  );
}
