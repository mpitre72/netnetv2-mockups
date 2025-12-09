import { netnetLogos, navIcons, socialIcons, timeIcons } from './app-shell/app-icons-config.js';
import { Section } from './components/Section.js';
import { NetNetLogo } from './components/NetNetLogo.js';
import { NavIcon } from './components/NavIcon.js';
import { SocialIcon } from './components/SocialIcon.js';
import { NetNetButton } from './components/NetNetButton.js';
import { Tabs, Tab, NewTabButton } from './components/navigation/tabs.js';
import { TopBarChromeDemo } from './components/navigation/top-bar.js';

const { createElement: h, useState } = React;
const { createRoot } = ReactDOM;

const cardBase = 'rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 shadow-sm';

function LogoGrid() {
  const items = [
    { key: 'light-idle', label: 'Light / Idle', src: netnetLogos.light?.idle, alt: 'Net Net logo – light / idle' },
    { key: 'dark-idle', label: 'Dark / Idle', src: netnetLogos.dark?.idle, alt: 'Net Net logo – dark / idle' },
  ];
  return h(
    'div',
    { className: 'grid grid-cols-2 gap-6' },
    items.map((item) =>
      h(
        'div',
        {
          key: item.key,
          className: `${cardBase} p-5 flex flex-col items-center gap-3`,
        },
        [
          h(NetNetLogo, { src: item.src, alt: item.alt, size: 'lg' }),
          h('div', { className: 'text-xs font-semibold tracking-wide uppercase text-slate-500 dark:text-white/60 text-center' }, item.label),
          item.key === 'dark-idle'
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
              const entry = navIcons[section];
              const idleSrc = entry?.[mode]?.idle;
              const activeSrc = entry?.[mode]?.active;
              const label = labels[section] || section;
              return h(
                'div',
                {
                  key: `${mode}-${section}`,
                  className: `flex ${alignClass} gap-3 rounded-lg border border-slate-100 dark:border-white/5 p-3`,
                },
                [
                  h('div', { className: 'flex items-center gap-2' }, [
                    h(NavIcon, { src: idleSrc, alt: `${label} icon (${mode})`, size: 'md' }),
                    h(NavIcon, { src: activeSrc, alt: `${label} icon (${mode} active)`, size: 'md' }),
                  ]),
                  h(
                    'span',
                    { className: 'text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-white/60' },
                    label
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
  const socialLabels = {
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
  };
  const utilityIcons = [
    { key: 'website', label: 'Website' },
    { key: 'personalWebsite', label: 'Personal Website' },
    { key: 'email', label: 'Email' },
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
            socialNetworks.map((network) =>
              h(
                'div',
                { key: `social-${network}`, className: 'icon-stack' },
                [
                  h(SocialIcon, { src: socialIcons[network]?.light, alt: socialLabels[network] || network }),
                  h('span', { className: 'text-[11px] text-slate-500 dark:text-slate-300' }, socialLabels[network] || network),
                ]
              )
            )
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
                  h(SocialIcon, { src: socialIcons[item.key]?.light, alt: item.label }),
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

function DesktopTabsDemo() {
  const [value, setValue] = useState('components');

  return h(
    'div',
    { className: 'rounded-lg overflow-hidden shadow-sm ring-1 ring-slate-200 dark:ring-white/10 bg-netnet-purple px-3 py-2' },
    h(
      Tabs,
      {
        value,
        onChange: setValue,
        className: 'items-center gap-2',
      },
      [
        h(Tab, { key: 'components', value: 'components', label: 'Components', closable: true }),
        h(Tab, { key: 'me', value: 'me', label: 'Me / Tasks', closable: true }),
        h(Tab, { key: 'contacts', value: 'contacts', label: 'Contacts', closable: true }),
        h(NewTabButton, {
          key: 'new',
          onClick: () => {
            setValue('new');
          },
        }),
      ]
    )
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
      h(Section, { title: 'Top Bar Chrome' }, h(TopBarChromeDemo)),
      h(Section, { title: 'Desktop Tabs' }, h(DesktopTabsDemo)),
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
