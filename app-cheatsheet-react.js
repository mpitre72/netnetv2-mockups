import { netnetLogos, navIcons, socialIcons, timeIcons } from './app-shell/app-icons-config.js';

const { createElement: h } = React;
const { createRoot } = ReactDOM;

const sizeClasses = { sm: 'h-6', md: 'h-8', lg: 'h-12' };
const cardBase = 'rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 shadow-sm';

function Section({ title, children }) {
  return h('section', { className: 'space-y-4' }, [
    h('div', { className: 'flex items-center gap-3' }, [
      h('h2', { className: 'text-lg font-semibold text-slate-900 dark:text-white' }, title),
      h('div', { className: 'h-px flex-1 bg-slate-200 dark:bg-white/10' }),
    ]),
    children,
  ]);
}

function NetNetLogo({ mode = 'light', size = 'md' }) {
  const src = netnetLogos[mode]?.idle;
  return h('img', {
    src,
    alt: 'Net Net logo',
    className: `${sizeClasses[size] || sizeClasses.md} w-auto drop-shadow-sm`,
    loading: 'lazy',
  });
}

function NavIcon({ section = 'me', mode = 'light', active = false, size = 'md' }) {
  const entry = navIcons[section];
  const src = entry?.[mode]?.[active ? 'active' : 'idle'];
  const cl = {
    sm: 'h-5 w-5',
    md: 'h-6 w-6',
    lg: 'h-8 w-8',
  }[size] || 'h-6 w-6';
  return h('img', { src, alt: `${section} icon`, className: `${cl} object-contain`, loading: 'lazy' });
}

function SocialIcon({ network, mode = 'light' }) {
  const src = socialIcons[network]?.[mode] || socialIcons.website?.[mode];
  const labelMap = {
    linkedin: 'LinkedIn',
    x: 'X',
    facebook: 'Facebook',
    instagram: 'Instagram',
    youtube: 'YouTube',
    tiktok: 'TikTok',
    whatsapp: 'WhatsApp',
    snapchat: 'Snapchat',
    threads: 'Threads',
    reddit: 'Reddit',
    pinterest: 'Pinterest',
    website: 'Website',
    personalWebsite: 'Personal Website',
    email: 'Email',
  };
  const label = labelMap[network] || (network.charAt(0).toUpperCase() + network.slice(1));
  return h(
    'div',
    { className: 'icon-stack' },
    [
      h(
        'button',
        { type: 'button', className: 'nn-btn nn-btn--social', 'aria-label': `${network} icon` },
        h('img', { src, alt: `${network} icon`, className: 'h-5 w-5 object-contain' })
      ),
      h('span', { className: 'text-[11px] text-slate-500 dark:text-slate-300' }, label),
    ]
  );
}

function NetNetButton({ variant = 'primary', label = 'Button', size = 'md', state = 'default', fullWidth = false, icon }) {
  const base =
    'inline-flex items-center justify-center gap-2 font-semibold rounded-md transition duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-netnet-purple focus-visible:ring-offset-white dark:focus-visible:ring-offset-slate-900';
  const sizeMap = { sm: 'px-3 py-2 text-sm', md: 'px-4 py-2.5 text-sm', lg: 'px-5 py-3 text-base' };
  const common = sizeMap[size] || sizeMap.md;
  const variantStyles = {
    primary: {
      base: 'bg-netnet-purple text-white shadow-md shadow-netnet-purple/25',
      hover: 'bg-[#5c1ad8] shadow-lg',
      active: 'bg-[#5116c3] shadow-inner translate-y-[1px]',
      disabled: 'bg-netnet-purple/50 text-white/70 shadow-none cursor-not-allowed',
    },
    secondary: {
      base: 'bg-white text-slate-900 border border-slate-200 shadow-sm dark:bg-slate-900 dark:text-white dark:border-slate-700',
      hover: 'bg-slate-50 border-slate-300 dark:bg-slate-800 dark:border-slate-600',
      active: 'bg-slate-100 border-slate-400 translate-y-[1px] dark:bg-slate-700 dark:border-slate-500',
      disabled: 'bg-slate-100 text-slate-400 border-slate-200 shadow-none cursor-not-allowed dark:bg-slate-800 dark:text-slate-500 dark:border-slate-700',
    },
    ghost: {
      base: 'bg-transparent text-slate-700 dark:text-white',
      hover: 'bg-slate-100 dark:bg-white/10',
      active: 'bg-slate-200 translate-y-[1px] dark:bg-white/15',
      disabled: 'text-slate-400 cursor-not-allowed dark:text-slate-500',
    },
    icon: {
      base: 'p-2 w-10 h-10 text-slate-700 bg-white border border-slate-200 rounded-full shadow-sm dark:bg-slate-900 dark:text-white dark:border-slate-700',
      hover: 'bg-slate-50 text-netnet-purple border-slate-300 dark:bg-slate-800 dark:text-netnet-purple dark:border-slate-600',
      active: 'bg-slate-100 translate-y-[1px] dark:bg-slate-700',
      disabled: 'text-slate-400 border-slate-200 shadow-none cursor-not-allowed dark:text-slate-500 dark:border-slate-700',
    },
  };
  const v = variantStyles[variant] || variantStyles.primary;
  const stateClass = state === 'hover' ? v.hover : state === 'active' ? v.active : state === 'disabled' ? v.disabled : v.base;
  const content = icon ? h('span', { className: 'inline-flex items-center justify-center' }, icon) : h('span', null, label);
  const width = fullWidth ? 'w-full' : '';
  return h(
    'button',
    {
      type: 'button',
      className: [base, common, stateClass, variant === 'icon' ? '' : '', width].filter(Boolean).join(' '),
      disabled: state === 'disabled',
      'aria-disabled': state === 'disabled',
    },
    content
  );
}

function DesktopAppTab({ label, active = false }) {
  return h(
    'button',
    {
      type: 'button',
      className: ['workspace-tab', active ? 'workspace-tab--active' : ''].join(' '),
    },
    [
      h('span', { className: 'workspace-tab__label' }, label),
      h('span', { className: 'workspace-tab__close' }, '\u00d7'),
    ]
  );
}

function DesktopTabBar() {
  return h(
    'div',
    { className: 'rounded-lg overflow-hidden shadow-sm ring-1 ring-slate-200 dark:ring-white/10 bg-netnet-purple px-3 py-2' },
    h(
      'div',
      { id: 'workspaceTabs', className: 'flex items-center gap-2' },
      [
        h(DesktopAppTab, { label: 'Components', active: true }),
        h(DesktopAppTab, { label: 'Me / Tasks' }),
        h(DesktopAppTab, { label: 'Contacts' }),
        h('button', { type: 'button', className: 'workspace-tab workspace-tab--new' }, '+'),
      ]
    )
  );
}

function LogoGrid() {
  const items = [
    { mode: 'light', label: 'Light / Idle' },
    { mode: 'dark', label: 'Dark / Idle' },
  ];
  return h(
    'div',
    { className: 'grid grid-cols-2 gap-6' },
    items.map((item) =>
      h(
        'div',
        {
          key: `${item.mode}-idle`,
          className: `${cardBase} p-5 flex flex-col items-center gap-3`,
        },
        [
          h(NetNetLogo, { mode: item.mode, size: 'lg' }),
          h('div', { className: 'text-xs font-semibold tracking-wide uppercase text-slate-500 dark:text-white/60 text-center' }, item.label),
          item.mode === 'dark'
            ? h('div', { className: 'text-[11px] text-slate-500 dark:text-white/60 text-center' }, 'Used in top purple bar')
            : null,
        ]
      )
    )
  );
}

function NavIconGrid() {
  const sections = ['me', 'bot', 'contacts', 'sales', 'jobs', 'quickTasks', 'chat', 'reports', 'netNetU'];
  const themes = ['light', 'dark'];
  const labels = {
    me: 'Me',
    bot: 'Net Net Bot',
    contacts: 'Contacts',
    sales: 'Sales',
    jobs: 'Jobs',
    quickTasks: 'Quick Tasks',
    chat: 'Chat',
    reports: 'Reports',
    netNetU: 'Net Net U',
  };
  return h(
    'div',
    { className: 'space-y-4' },
    themes.map((mode) =>
      h(
        'div',
        { key: mode, className: `${cardBase} p-4` },
        [
          h('div', { className: 'text-sm font-semibold mb-3 text-slate-700 dark:text-white capitalize' }, `${mode} theme`),
          h(
            'div',
            { className: 'grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4' },
            sections.map((section) => {
              const alignClass = section === 'reports' ? 'items-end' : 'items-center';
              return h(
                'div',
                {
                  key: `${mode}-${section}`,
                  className: `flex ${alignClass} gap-3 rounded-lg border border-slate-100 dark:border-white/5 p-3`,
                },
                [
                  h('div', { className: 'flex items-center gap-2' }, [
                    h(NavIcon, { section, mode, active: false }),
                    h(NavIcon, { section, mode, active: true }),
                  ]),
                  h(
                    'span',
                    { className: 'text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-white/60' },
                    labels[section] || section
                  ),
                ]
              );
            })
          ),
        ]
      )
    )
  );
}

function SocialIconsRow() {
  const socialNetworks = ['linkedin', 'x', 'facebook', 'instagram', 'youtube', 'tiktok', 'whatsapp', 'snapchat', 'threads', 'reddit', 'pinterest'];
  const utilityIcons = [
    {
      key: 'website',
      label: 'Website',
      svg: h('svg', { className: 'header-icon-glyph-small', viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: '1.8' }, [
        h('circle', { cx: '12', cy: '12', r: '9' }),
        h('path', { d: 'M3 12h18' }),
        h('path', { d: 'M12 3a15 15 0 0 1 0 18' }),
        h('path', { d: 'M12 3a15 15 0 0 0 0 18' }),
      ]),
    },
    {
      key: 'personalWebsite',
      label: 'Personal Website',
      svg: h('svg', { className: 'header-icon-glyph-small', viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: '1.8' }, [
        h('circle', { cx: '9', cy: '8', r: '3' }),
        h('path', { d: 'M3 20c0-3 2.5-5 6-5' }),
        h('circle', { cx: '17', cy: '12', r: '3' }),
        h('path', { d: 'M17 9v-2' }),
        h('path', { d: 'M17 21v-2' }),
        h('path', { d: 'M14 12h-2' }),
        h('path', { d: 'M22 12h-2' }),
      ]),
    },
    {
      key: 'email',
      label: 'Email',
      svg: h('svg', { className: 'header-icon-glyph-small', viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: '1.8' }, [
        h('rect', { x: '3', y: '5', width: '18', height: '14', rx: '2' }),
        h('path', { d: 'M3 7l9 6 9-6' }),
      ]),
    },
  ];
  return h(
    'div',
    { className: 'grid grid-cols-1 gap-6' },
    [
      h(
        'div',
        { className: `${cardBase} p-4 bg-white dark:bg-slate-900 text-slate-700 dark:text-white` },
        [
          h('div', { className: 'text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400 mb-3' }, 'Social'),
          h(
            'div',
            { className: 'social-icons-row' },
            socialNetworks.map((network) => h(SocialIcon, { key: `social-${network}`, network, mode: 'light' }))
          ),
          h('div', { className: 'text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400 mt-6 mb-3' }, 'Contact / Utility'),
          h(
            'div',
            { className: 'social-icons-row' },
            utilityIcons.map((item) =>
              h(
                'div',
                { key: item.key, className: 'icon-stack' },
                [
                  h(
                    'button',
                    { type: 'button', className: 'nn-btn nn-btn--social', 'aria-label': item.label },
                    item.svg
                  ),
                  h('span', { className: 'icon-label' }, item.label),
                ]
              )
            )
          ),
        ]
      ),
    ]
  );
}

function ChromeButton({ label, icon, state = 'default', size = 'full' }) {
  const sizeClass = size === 'mini' ? 'nn-btn--mini' : 'nn-btn--full';
  const stateClass = state === 'disabled' ? 'opacity-50 cursor-not-allowed' : state === 'active' ? 'translate-y-[1px]' : '';
  return h(
    'div',
    { className: 'flex items-center gap-2' },
    [
      h(
        'button',
        {
          type: 'button',
          className: ['nn-btn', sizeClass, stateClass].filter(Boolean).join(' '),
          disabled: state === 'disabled',
        },
        size === 'mini'
          ? [icon]
          : [
              icon,
              h('span', { className: 'text-sm font-semibold whitespace-nowrap' }, label),
            ]
      ),
    ]
  );
}

function ChromeButtonsRow() {
  const buttons = [
    {
      label: 'Add Company',
      state: 'default',
      icon: h('svg', { className: 'w-5 h-5', viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: '1.6' }, [
        h('path', { strokeLinecap: 'round', strokeLinejoin: 'round', d: 'M3 21h18M6 21V8a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v13M9 21v-4h6v4M9 12h6M9 9h6' }),
      ]),
    },
    {
      label: 'Add Person',
      state: 'hover',
      icon: h('svg', { className: 'w-5 h-5', viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: '1.6' }, [
        h('path', { strokeLinecap: 'round', strokeLinejoin: 'round', d: 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2' }),
        h('circle', { cx: '9', cy: '7', r: '4' }),
        h('path', { strokeLinecap: 'round', strokeLinejoin: 'round', d: 'M17 11v6m3-3h-6' }),
      ]),
    },
    {
      label: 'Upload',
      state: 'active',
      icon: h('svg', { className: 'w-5 h-5 transform rotate-180', viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: '1.6' }, [
        h('path', { strokeLinecap: 'round', strokeLinejoin: 'round', d: 'M12 3v12m0 0 4-4m-4 4-4-4m-6 8h20' }),
      ]),
    },
  ];
  return h(
    'div',
    { className: `${cardBase} p-4 flex flex-col gap-4` },
    [
      h('div', { className: 'flex items-center gap-3' }, [
        h('span', { className: 'text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400' }, 'Micro'),
        h('div', { className: 'nn-btn-row' }, [
          h(
            'button',
            { type: 'button', className: 'header-icon-button header-icon-button--small nn-btn nn-btn--micro' },
            h('svg', { className: 'header-icon-glyph-small', viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: '2' }, [
              h('circle', { cx: '12', cy: '12', r: '10' }),
              h('path', { d: 'M9.5 9a2.5 2.5 0 1 1 3.5 2.3c-.7.3-1 1-1 1.7V14' }),
              h('circle', { cx: '12', cy: '17', r: '1' }),
            ])
          ),
          h(
            'button',
            { type: 'button', className: 'header-icon-button header-icon-button--small nn-btn nn-btn--micro' },
            h('svg', { className: 'header-icon-glyph-small', viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: '1.8' }, [
              h('path', { d: 'M18 8a6 6 0 10-12 0c0 7-3 9-3 9h18s-3-2-3-9' }),
              h('path', { d: 'M13.73 21a2 2 0 01-3.46 0' }),
            ])
          ),
          h(
            'button',
            { type: 'button', className: 'header-icon-button header-icon-button--small nn-btn nn-btn--micro' },
            h('svg', { className: 'header-icon-glyph-small', viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: '1.8' }, [
              h('circle', { cx: '12', cy: '12', r: '4' }),
              h('path', { d: 'M12 1v3M12 20v3M4.22 4.22l2.12 2.12M17.66 17.66l2.12 2.12M1 12h3M20 12h3M4.22 19.78l2.12-2.12M17.66 6.34l2.12-2.12' }),
            ])
          ),
        ]),
      ]),
      h(
        'div',
        { className: 'flex items-center gap-3' },
        [
          h('span', { className: 'text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400' }, 'Mini'),
          h('div', { className: 'nn-btn-row' }, [
            h(ChromeButton, { label: 'Add Company', icon: buttons[0].icon, state: buttons[0].state, size: 'mini' }),
            h(ChromeButton, { label: 'Add Person', icon: buttons[1].icon, state: buttons[1].state, size: 'mini' }),
            h(ChromeButton, { label: 'Upload', icon: buttons[2].icon, state: buttons[2].state, size: 'mini' }),
          ]),
        ]
      ),
      h('div', { className: 'flex items-center gap-3' }, [
        h('span', { className: 'text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400' }, 'Full'),
        h('div', { className: 'nn-btn-row' },
          buttons.map((btn) => h(ChromeButton, { key: `full-${btn.label}`, label: btn.label, icon: btn.icon, state: btn.state, size: 'full' }))
        ),
      ]),
    ]
  );
}

function ButtonsGrid() {
  const variants = ['primary', 'secondary', 'ghost', 'icon'];
  const states = ['default', 'hover', 'active', 'disabled'];
  return h(
    'div',
    { className: 'space-y-3' },
    variants.map((variant) =>
      h(
        'div',
        { key: variant, className: `${cardBase} flex flex-wrap items-center gap-3 p-4` },
        [
          h('div', { className: 'w-32 text-sm font-semibold text-slate-700 dark:text-white capitalize' }, variant),
          ...states.map((state) =>
            h(NetNetButton, {
              key: `${variant}-${state}`,
              variant,
              state,
              label: state === 'default' ? 'Default' : state[0].toUpperCase() + state.slice(1),
              icon: variant === 'icon' ? h('span', { className: 'text-lg' }, '★') : null,
            })
          ),
        ]
      )
    )
  );
}

function TabsPreview() {
  return h(
    'div',
    null,
    h(DesktopTabBar)
  );
}

function TopBarChromeShowcase() {
  return h(
    'div',
    { className: `${cardBase} p-4 space-y-3` },
    [
      h('div', { className: 'text-sm font-semibold text-slate-700 dark:text-white' }, 'Top Bar Chrome'),
      h(
        'div',
        { className: 'bg-netnet-purple rounded-lg px-3 py-2 flex items-center gap-3 justify-end' },
        [
          h(
            'button',
            { type: 'button', className: 'time-icon-button relative inline-flex items-center justify-center h-9 w-9', 'aria-label': 'Timer' },
            [
              h('img', { src: timeIcons.idle, alt: 'Timer', className: 'h-5 w-5 select-none pointer-events-none' }),
              h('span', { className: 'time-icon-dot', 'aria-hidden': 'true' }),
            ]
          ),
          h('span', { className: 'h-5 w-px bg-white/25' }),
          h(
            'button',
            { className: 'header-icon-button header-icon-button--small relative', 'aria-label': 'Help and documentation' },
            h('svg', { className: 'header-icon-glyph-small', viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: '2' }, [
              h('circle', { cx: '12', cy: '12', r: '10' }),
              h('path', { d: 'M9.5 9a2.5 2.5 0 1 1 3.5 2.3c-.7.3-1 1-1 1.7V14' }),
              h('circle', { cx: '12', cy: '17', r: '1' }),
            ])
          ),
          h(
            'button',
            { className: 'header-icon-button header-icon-button--small relative', 'aria-label': 'Notifications' },
            h('svg', { className: 'header-icon-glyph-small', viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: '1.8' }, [
              h('path', { d: 'M18 8a6 6 0 10-12 0c0 7-3 9-3 9h18s-3-2-3-9' }),
              h('path', { d: 'M13.73 21a2 2 0 01-3.46 0' }),
            ])
          ),
          h(
            'button',
            { className: 'header-icon-button header-icon-button--small relative', 'aria-label': 'Toggle light and dark theme' },
            h('svg', { className: 'header-icon-glyph-small', viewBox: '0 0 24 24', fill: 'currentColor' }, [
              h('path', { d: 'M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z' }),
            ])
          ),
        ]
      ),
    ]
  );
}

function ComponentsCheatSheet() {
  return h(
    'div',
    { className: 'max-w-6xl mx-auto p-6 space-y-8 text-slate-900 dark:text-white' },
    [
      h('div', { className: 'space-y-2' }, [
        h('h1', { className: 'text-2xl font-bold' }, 'Components Cheat Sheet'),
        h('p', { className: 'text-sm text-slate-600 dark:text-white/70' }, 'Canonical reference for Net Net chrome components, states, and themes.'),
      ]),
      h(Section, { title: 'Net Net Logos' }, h(LogoGrid)),
      h(Section, { title: 'Navigation Icons' }, h(NavIconGrid)),
      h(Section, { title: 'Social Icons' }, h(SocialIconsRow)),
      h(Section, { title: 'Buttons' }, h(ChromeButtonsRow)),
      h(Section, { title: 'Top Bar Chrome' }, h(TopBarChromeShowcase)),
      h(Section, { title: 'Desktop Tabs' }, h(TabsPreview)),
    ]
  );
}

let root = null;

export function renderComponentsCheatSheetReactView() {
  const container = document.getElementById('components-cheat-sheet-root');
  if (!container) return;
  if (!root) root = createRoot(container);
  root.render(h(ComponentsCheatSheet));
}

export function unmountComponentsCheatSheetReactView() {
  if (root) {
    root.unmount();
    root = null;
  }
  const container = document.getElementById('components-cheat-sheet-root');
  if (container) container.innerHTML = '';
}

// Expose to vanilla router/app
if (typeof window !== 'undefined') {
  window.renderComponentsCheatSheetReactView = renderComponentsCheatSheetReactView;
  window.unmountComponentsCheatSheetReactView = unmountComponentsCheatSheetReactView;
}
