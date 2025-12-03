import { netnetLogos, navIcons, socialIcons, timeIcons } from './app-shell/app-icons-config.js';

const { createElement: h } = React;
const { createRoot } = ReactDOM;

const sizeClasses = { sm: 'h-6', md: 'h-8', lg: 'h-12' };
const cardBase = 'rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 shadow-sm';
const cheatSheetStyles = `
  .cs-tab {
    position: relative;
    display: flex;
    align-items: center;
    max-width: 200px;
    flex-shrink: 0;
    padding: 0.35rem 0.8rem;
    border-radius: 0.5rem 0.5rem 0 0;
    border: 1px solid rgba(255,255,255,0.12);
    background-color: rgba(255,255,255,0.12);
    color: rgba(255,255,255,0.75);
    font-size: 0.85rem;
    font-weight: 600;
    white-space: nowrap;
    cursor: default;
    transition: background-color 0.15s ease, border-color 0.15s ease, color 0.15s ease;
  }
  .cs-tab:not(.cs-tab--new)::before {
    content: "";
    flex: 0 0 20px;
    margin-right: 0.25rem;
  }
  .cs-tab:hover { background-color: rgba(255,255,255,0.20); border-color: rgba(255,255,255,0.20); }
  .cs-tab--active { border-color: rgba(255,255,255,0.32); background-color: rgba(255,255,255,0.32); color: #ffffff; }
  .cs-tab__label { flex: 1 1 auto; text-align: center; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; padding: 0 0.4rem; }
  .cs-tab__close { flex: 0 0 20px; height: 20px; margin-left: 0.25rem; display: inline-flex; align-items: center; justify-content: center; border-radius: 9999px; font-size: 0.7rem; line-height: 1; opacity: 0; pointer-events: none; transition: opacity 0.15s ease, background-color 0.15s ease; }
  .cs-tab:hover .cs-tab__close { opacity: 1; pointer-events: auto; }
  .cs-tab__close:hover { background-color: rgba(0,0,0,0.08); }
  .cs-tab--new { justify-content: center; border-style: dashed; border-color: rgba(255,255,255,0.35); background-color: transparent; color: rgba(255,255,255,0.9); padding-left: 0.75rem; padding-right: 0.75rem; }
  .cs-tab--new:hover { background-color: rgba(255,255,255,0.18); border-color: rgba(255,255,255,0.35); }
`;

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

function SocialIcon({ network, mode = 'light', href }) {
  const src = socialIcons[network]?.[mode] || socialIcons.website?.[mode];
  const iconImg = h('img', { src, alt: `${network} icon`, className: 'h-5 w-5 object-contain' });
  const baseClass =
    'inline-flex items-center justify-center h-12 w-12 rounded-lg border border-slate-200 dark:border-white/10 text-slate-700 dark:text-white bg-white dark:bg-slate-900 shadow-sm';
  if (href) {
    return h(
      'a',
      { href, target: '_blank', rel: 'noopener noreferrer', className: `${baseClass} hover:border-netnet-purple/60 transition` },
      iconImg
    );
  }
  return h('div', { className: baseClass }, iconImg);
}

function NetNetButton({ variant = 'primary', label = 'Button', size = 'md', state = 'rest', fullWidth = false, icon }) {
  const base =
    'inline-flex items-center justify-center gap-2 font-semibold rounded-md transition-colors transition-shadow duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-netnet-purple focus-visible:ring-offset-white dark:focus-visible:ring-offset-slate-900';
  const sizeMap = { sm: 'px-3 py-2 text-sm', md: 'px-4 py-2.5 text-sm', lg: 'px-5 py-3 text-base' };
  const common = sizeMap[size] || sizeMap.md;
  const variants = {
    primary: 'bg-netnet-purple text-white shadow-md shadow-netnet-purple/20 hover:bg-netnet-purple/90 active:bg-netnet-purple/80',
    secondary:
      'bg-white text-slate-900 border border-slate-200 shadow-sm hover:border-slate-300 hover:bg-slate-50 dark:bg-slate-900 dark:text-white dark:border-slate-700 dark:hover:border-slate-600 dark:hover:bg-slate-800',
    ghost: 'bg-transparent text-slate-900 hover:bg-slate-100 active:bg-slate-200 dark:text-white dark:hover:bg-white/10 dark:active:bg-white/5',
    icon: 'p-2 text-slate-700 bg-white border border-slate-200 rounded-full shadow-sm hover:bg-slate-50 active:bg-slate-100 dark:bg-slate-900 dark:text-white dark:border-slate-700 dark:hover:bg-slate-800 dark:active:bg-slate-700',
  };
  const stateStyles = {
    rest: '',
    hover: 'ring-2 ring-netnet-purple/30',
    active: 'translate-y-[1px] shadow-inner',
    disabled: 'opacity-60 cursor-not-allowed pointer-events-none',
  };
  const content = icon
    ? h('span', { className: 'inline-flex items-center justify-center' }, icon)
    : h('span', null, label);
  const width = fullWidth ? 'w-full' : '';
  return h(
    'button',
    {
      type: 'button',
      className: [base, common, variants[variant] || variants.primary, stateStyles[state] || '', width]
        .filter(Boolean)
        .join(' '),
      disabled: state === 'disabled',
      'aria-disabled': state === 'disabled',
    },
    content
  );
}

function DesktopAppTab({ label, active = false, closable = false }) {
  return h(
    'div',
    { className: ['cs-tab', active ? 'cs-tab--active' : '', closable ? '' : ''].join(' ') },
    [
      h('span', { className: 'cs-tab__label' }, label),
      closable ? h('span', { className: 'cs-tab__close' }, '\u00d7') : null,
    ]
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
  const utility = ['website', 'personalWebsite', 'email'];
  return h(
    'div',
    { className: 'grid grid-cols-1 md:grid-cols-2 gap-4' },
    ['light', 'dark'].map((mode) =>
      h(
        'div',
        {
          key: mode,
          className: `${cardBase} p-4 ${mode === 'dark' ? 'bg-slate-900 text-white' : 'bg-white text-slate-700'}`,
        },
        [
          h('div', { className: 'text-sm font-semibold mb-3 capitalize' }, `${mode} theme`),
          h('div', { className: 'text-xs uppercase tracking-wide text-slate-500 dark:text-white/60 mb-2' }, 'Social'),
          h(
            'div',
            { className: 'flex items-center gap-3 flex-wrap mb-3' },
            socialNetworks.map((network) => h(SocialIcon, { key: `${mode}-${network}`, network, mode }))
          ),
          h('div', { className: 'text-xs uppercase tracking-wide text-slate-500 dark:text-white/60 mb-2' }, 'Contact / Utility'),
          h(
            'div',
            { className: 'flex items-center gap-3 flex-wrap' },
            utility.map((network) => h(SocialIcon, { key: `${mode}-${network}`, network, mode }))
          ),
        ]
      )
    )
  );
}

function ContactsChromeButton({ label, icon }) {
  return h(
    'div',
    { className: 'flex items-center gap-2' },
    [
      h('button', { type: 'button', className: 'new-action-icon', 'aria-label': label }, icon),
      h('span', { className: 'text-xs text-slate-500 dark:text-white/60' }, label),
    ]
  );
}

function ContactsChromeButtonsRow() {
  const buttons = [
    {
      label: 'Contacts – Add Company',
      icon: h('svg', { className: 'w-5 h-5', viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: '1.6' }, [
        h('path', { strokeLinecap: 'round', strokeLinejoin: 'round', d: 'M3 21h18M6 21V8a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v13M9 21v-4h6v4M9 12h6M9 9h6' }),
      ]),
    },
    {
      label: 'Contacts – Add Person',
      icon: h('svg', { className: 'w-5 h-5', viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: '1.6' }, [
        h('path', { strokeLinecap: 'round', strokeLinejoin: 'round', d: 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2' }),
        h('circle', { cx: '9', cy: '7', r: '4' }),
        h('path', { strokeLinecap: 'round', strokeLinejoin: 'round', d: 'M17 11v6m3-3h-6' }),
      ]),
    },
    {
      label: 'Contacts – Upload/Import',
      icon: h('svg', { className: 'w-5 h-5 transform rotate-180', viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: '1.6' }, [
        h('path', { strokeLinecap: 'round', strokeLinejoin: 'round', d: 'M12 3v12m0 0 4-4m-4 4-4-4m-6 8h20' }),
      ]),
    },
  ];
  return h(
    'div',
    { className: `${cardBase} p-4 flex flex-wrap gap-4` },
    buttons.map((btn) => h(ContactsChromeButton, { key: btn.label, label: btn.label, icon: btn.icon }))
  );
}

function ButtonsGrid() {
  const variants = ['primary', 'secondary', 'ghost', 'icon'];
  const states = ['rest', 'hover', 'active', 'disabled'];
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
              label: state === 'rest' ? 'Default' : state[0].toUpperCase() + state.slice(1),
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
    { className: 'rounded-lg overflow-hidden shadow-sm ring-1 ring-slate-200 dark:ring-white/10' },
    h(
      'div',
      { className: 'bg-netnet-purple px-3 py-2 flex items-center gap-2' },
      [
        h(DesktopAppTab, { label: 'Components', active: true, closable: true }),
        h(DesktopAppTab, { label: 'Me / Tasks', closable: true }),
        h(DesktopAppTab, { label: 'Contacts', closable: true }),
      ]
    )
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
      h('style', { dangerouslySetInnerHTML: { __html: cheatSheetStyles } }),
      h('div', { className: 'space-y-2' }, [
        h('h1', { className: 'text-2xl font-bold' }, 'Components Cheat Sheet'),
        h('p', { className: 'text-sm text-slate-600 dark:text-white/70' }, 'Canonical reference for Net Net chrome components, states, and themes.'),
      ]),
      h(Section, { title: 'Net Net Logos' }, h(LogoGrid)),
      h(Section, { title: 'Navigation Icons' }, h(NavIconGrid)),
      h(Section, { title: 'Social Icons' }, h(SocialIconsRow)),
      h(Section, { title: 'Chrome Buttons (Contacts)' }, h(ContactsChromeButtonsRow)),
      h(Section, { title: 'Top Bar Chrome' }, h(TopBarChromeShowcase)),
      h(Section, { title: 'Buttons' }, h(ButtonsGrid)),
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
