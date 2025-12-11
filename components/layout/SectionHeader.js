const { createElement: h, useState, useEffect } = React;

export function SectionHeader({
  title,
  showHelpIcon = false,
  switcherOptions,
  switcherValue,
  onSwitcherChange,
  actions,
  showSearch = false,
  searchPlaceholder = 'Search',
  searchValue = '',
  onSearchChange,
  className = '',
}) {
  const [localSearch, setLocalSearch] = useState(searchValue || '');

  useEffect(() => {
    setLocalSearch(searchValue || '');
  }, [searchValue]);

  const openHelp = () => {
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
      const closeBtn = document.getElementById('sectionHelpClose');
      if (closeBtn) {
        closeBtn.onclick = () => {
          shell?.classList.add('drawer-closed');
        };
      }
      const backdrop = document.getElementById('app-drawer-backdrop');
      if (backdrop) {
        backdrop.onclick = () => shell?.classList.add('drawer-closed');
      }
    }
  };

  return h(
    'div',
    { className: `w-full flex flex-col gap-3 ${className}` },
    [
      h(
        'div',
        { className: 'flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between' },
        [
          h(
            'div',
            { className: 'flex flex-col gap-2 lg:flex-row lg:items-center lg:gap-4' },
            [
              h(
                'div',
                { className: 'flex items-center gap-3' },
                [
                  showHelpIcon
                    ? h(
                        'button',
                        {
                          type: 'button',
                          className: 'inline-flex h-10 w-10 items-center justify-center rounded-lg border border-slate-700 bg-slate-900 text-white hover:border-slate-500 hover:bg-slate-800 transition-colors',
                          'aria-label': 'Open video help',
                          onClick: openHelp,
                        },
                        h('svg', { viewBox: '0 0 24 24', className: 'h-5 w-5', fill: 'none', stroke: 'currentColor', strokeWidth: '1.8' }, [
                          h('circle', { cx: '12', cy: '12', r: '10' }),
                          h('path', { d: 'M9.5 9a2.5 2.5 0 1 1 3.5 2.3c-.7.3-1 1-1 1.7V15' }),
                          h('circle', { cx: '12', cy: '18', r: '1' }),
                        ])
                      )
                    : null,
                  h('h1', { className: 'text-2xl lg:text-3xl font-semibold text-slate-900 dark:text-white' }, title),
                ]
              ),
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
            ]
          ),
          actions
            ? h('div', { className: 'flex items-center gap-2 justify-start lg:justify-end flex-wrap' }, actions)
            : null,
        ]
      ),
      showSearch
        ? h(
            'div',
            { className: 'flex items-center w-full lg:w-auto' },
            h('input', {
              type: 'search',
              value: localSearch,
              onChange: (e) => {
                setLocalSearch(e.target.value);
                onSearchChange && onSearchChange(e.target.value);
              },
              placeholder: searchPlaceholder,
              className:
                'w-full lg:min-w-[280px] rounded-lg border border-slate-300 dark:border-white/10 bg-white dark:bg-slate-900 px-3 py-2 text-sm text-slate-800 dark:text-white shadow-inner focus:outline-none focus:ring-2 focus:ring-netnet-purple',
            })
          )
        : null,
    ]
  );
}
