export const APP_ICONS = {
  settings: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 0 2.12l-.15.1a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l-.22-.38a2 2 0 0 0-.73-2.73l-.15-.1a2 2 0 0 1 0-2.12l.15-.1a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/></svg>`,
  avatar: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>`,
  logout: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>`,
  close: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`
};

const REPORTS_ICON_SET = { light:  { idle: 'public/assets/brand/nav/Reports-Idle.svg', active: 'public/assets/brand/nav/Reports-Active.svg' }, dark:   { idle: 'public/assets/brand/nav/Reports-Idle-white.svg', active: 'public/assets/brand/nav/Reports-Active-white.svg' } };

export const ICONS = {
  me: { light: { idle: 'public/assets/brand/nav/Me-Idle.svg', active: 'public/assets/brand/nav/Me-Active.svg' }, dark:  { idle: 'public/assets/brand/nav/Me-Idle-white.svg', active: 'public/assets/brand/nav/Me-Active-white.svg' } },
  contacts: { light: { idle: 'public/assets/brand/nav/Contacts-Idle.svg', active: 'public/assets/brand/nav/Contacts-Active.svg' }, dark:  { idle: 'public/assets/brand/nav/Contacts-Idle-white.svg', active: 'public/assets/brand/nav/Contacts-Active-white.svg' } },
  sales: { light: { idle: 'public/assets/brand/nav/Sales-Idle.svg', active: 'public/assets/brand/nav/Sales-Active.svg' }, dark:  { idle: 'public/assets/brand/nav/Sales-Idle-white.svg', active: 'public/assets/brand/nav/Sales-Active-white.svg' } },
  jobs: { light: { idle: 'public/assets/brand/nav/Jobs-Idle.svg', active: 'public/assets/brand/nav/Jobs-Active.svg' }, dark:  { idle: 'public/assets/brand/nav/Jobs-Idle-white.svg', active: 'public/assets/brand/nav/Jobs-Active-white.svg' } },
  quick: { light: { idle: 'public/assets/brand/nav/QuickTasks-Idle.svg', active: 'public/assets/brand/nav/QuickTasks-Active.svg' }, dark:  { idle: 'public/assets/brand/nav/QuickTasks-Idle-white.svg', active: 'public/assets/brand/nav/QuickTasks-Active-white.svg' } },
  chat: { light: { idle: 'public/assets/brand/nav/Chat-Idle.svg', active: 'public/assets/brand/nav/Chat-Active.svg' }, dark:  { idle: 'public/assets/brand/nav/Chat-Idle-white.svg', active: 'public/assets/brand/nav/Chat-Active-white.svg' } },
  performance: { ...REPORTS_ICON_SET },
  reports: { ...REPORTS_ICON_SET }, // legacy alias
  nnu: { light: { idle: 'public/assets/brand/nav/NNU-Idle.svg', active: 'public/assets/brand/nav/NNU-Active.svg' }, dark:  { idle: 'public/assets/brand/nav/NNU-Idle-white.svg', active: 'public/assets/brand/nav/NNU-Active-white.svg' } },
  bot: { light: { idle: 'public/assets/brand/nav/AI-Idle.svg', active: 'public/assets/brand/nav/AI-Active.svg' }, dark:  { idle: 'public/assets/brand/nav/AI-Idle-white.svg', active: 'public/assets/brand/nav/AI-Active-white.svg' } }
};

export const LOGO_ASSETS = {
  dark: { idle: 'public/assets/brand/logos/logo-white.svg', active: 'public/assets/brand/logos/logo-white.svg' },
  light: { idle: 'public/assets/brand/logos/logo-standard.svg', active: 'public/assets/brand/logos/logo-standard.svg' }
};

export const TIMER_ICONS = {
  idle:  'public/assets/brand/chrome/Time-Idle-white.svg',
  active:'public/assets/brand/chrome/Time-Active-white.svg'
};

export const SIDEBAR_LINKS = [
  { 
    name: 'Me', 
    path: '#/app/me/tasks', 
    basePath: '#/app/me',
    key: 'me',
    subs: [
        { key: 'me-tasks', name: 'My Tasks', path: '#/app/me/tasks' },
        { key: 'me-lists', name: 'Lists', path: '#/app/me/lists' },
        { key: 'me-time', name: 'My Time', path: '#/app/me/time' },
        { key: 'me-performance', name: 'My Performance', path: '#/app/me/performance' },
    ]
  },
  { name: 'Net Net Bot', path: '#/app/net-net-bot', basePath: '#/app/net-net-bot', key: 'bot' },
  { name: 'Contacts', path: '#/app/contacts', basePath: '#/app/contacts', key: 'contacts' },
  { name: 'Sales', path: '#/app/sales', basePath: '#/app/sales', key: 'sales' },
  { name: 'Jobs', path: '#/app/jobs', basePath: '#/app/jobs', key: 'jobs' },
  { name: 'Quick Tasks', path: '#/app/quick-tasks', basePath: '#/app/quick-tasks', key: 'quick' },
  { name: 'Chat', path: '#/app/chat', basePath: '#/app/chat', key: 'chat' },
  { name: 'Performance', path: '#/app/performance', basePath: '#/app/performance', key: 'performance' },
  { name: 'Net Net U', path: '#/app/net-net-u', basePath: '#/app/net-net-u', key: 'nnu' },
];

export const WORKSPACES = [
  { id: 'netnet', name: 'Net Net', icon: 'public/assets/samples/Net-Net-Symbol.svg' },
  { id: 'fathom', name: 'Fathom', icon: 'public/assets/samples/Fathom-Symbol-Blue-square.svg' },
  { id: 'rhi', name: 'Right Here Interactive', icon: 'public/assets/samples/Favicon-Red.svg' }
];

export const WORKSPACE_SAMPLE_ICONS = {
  netnet: 'public/assets/samples/Net-Net-Symbol.svg',
  fathom: 'public/assets/samples/Fathom-Symbol-Blue-square.svg',
  rhi: 'public/assets/samples/Favicon-Red.svg',
};

export const WORKSPACE_KEY = 'activeWorkspace';
export const THEME_KEY = 'theme';
export const SIDEBAR_MODE_KEY = 'netnet_sidebarMode';
