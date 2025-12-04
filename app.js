import './data/mock-contacts.js';
import './data/mock-reports.js';
import { renderContacts, renderContactProfile } from './contacts/index.js';
import { renderMePage } from './me/index.js';
import { renderJobsPage } from './jobs/index.js';
import { renderSalesPage } from './sales/index.js';
import { renderQuickTasksPage } from './quick-tasks/index.js';
import { renderChatPage } from './chat/index.js';
import { renderReportsPage } from './reports/index.js';
import { renderSettingsPage } from './settings/index.js';
import { renderProfilePage } from './profile/index.js';
import { renderNnuPage } from './net-net-u/index.js';
import { renderNetNetBot } from './ai/index.js';
import { renderAuthScreen, mountAuthShell } from './auth/auth-shell.js';
import { initRouter, navigate } from './router.js';
import { mountShell, applyMainWrapperClass } from './app-shell/app-layout.js';
import { setTheme, getTheme } from './app-shell/app-helpers.js';

// Environment detection for Net Net (GitHub Pages vs Local)
const detectedEnv = (typeof window !== 'undefined' && window.location.hostname === 'mpitre72.github.io')
  ? 'GitHub Pages'
  : 'Local';
if (typeof window !== 'undefined') {
  window.__NETNET_ENV__ = detectedEnv;
  window.addEventListener('DOMContentLoaded', () => {
    if (document.querySelector('.env-indicator')) return;
    const badge = document.createElement('div');
    badge.className = 'env-indicator';
    badge.textContent = `Environment: ${detectedEnv}`;
    document.body.appendChild(badge);
  });
}

function ensureToast() {
  if (!document.getElementById('toast-container')) {
    const toast = document.createElement('div');
    toast.id = 'toast-container';
    toast.style.position = 'fixed';
    toast.style.top = '16px';
    toast.style.right = '16px';
    toast.style.zIndex = '9999';
    toast.style.display = 'flex';
    toast.style.flexDirection = 'column';
    toast.style.gap = '8px';
    document.body.appendChild(toast);
  }
}

function showToast(msg) {
  const container = document.getElementById('toast-container');
  if (!container) return;
  const el = document.createElement('div');
  el.className = 'toast-msg';
  el.textContent = msg;
  container.appendChild(el);
  setTimeout(() => {
    el.style.opacity = '0';
    el.style.transition = 'opacity 0.3s ease';
    setTimeout(() => el.remove(), 300);
  }, 2000);
}

let currentShell = null;

function unmountCheatSheet() {
  if (typeof window !== 'undefined' && window.unmountComponentsCheatSheetReactView) {
    window.unmountComponentsCheatSheetReactView();
  }
}

function ensureShell(type, hash) {
  const rootHash = hash || location.hash || '#/app/me/tasks';
  if (type === currentShell) {
    return;
  }
  if (type === 'auth') {
    mountAuthShell();
  } else {
    mountShell(rootHash);
    applyMainWrapperClass(rootHash);
  }
  currentShell = type;
}

function renderRoute(route) {
  const isAuthRoute = route.name.startsWith('auth');
  if (isAuthRoute) {
    unmountCheatSheet();
    ensureShell('auth', location.hash);
    renderAuthScreen(route.name);
    return;
  }

  ensureShell('app', location.hash);
  applyMainWrapperClass(location.hash || '#/app/me/tasks');
  const main = document.getElementById('app-main');
  if (!main) return;
  if (route.name === 'components') {
    main.innerHTML = '<div id="components-cheat-sheet-root" class="w-full"></div>';
    if (typeof window !== 'undefined' && window.renderComponentsCheatSheetReactView) {
      window.renderComponentsCheatSheetReactView();
    }
    return;
  }
  unmountCheatSheet();
  if (route.name === 'company' || route.name === 'person') {
    main.innerHTML = `<div id="profile-container" class="h-full overflow-y-auto"></div>`;
    renderContactProfile(route.name, route.id, { container: document.getElementById('profile-container') });
  } else if (route.name === 'company-new' || route.name === 'company-edit' || route.name === 'person-new' || route.name === 'person-edit') {
    renderContacts(main, route.name, route.id);
  } else if (route.name === 'me') {
    renderMePage(route.page || 'tasks', main);
  } else if (route.name === 'jobs') {
    renderJobsPage(main);
  } else if (route.name === 'sales') {
    renderSalesPage(main);
  } else if (route.name === 'quick') {
    renderQuickTasksPage(main);
  } else if (route.name === 'chat') {
    renderChatPage(main);
  } else if (route.name === 'reports') {
    renderReportsPage(main);
  } else if (route.name === 'settings') {
    renderSettingsPage(main);
  } else if (route.name === 'profile') {
    renderProfilePage(main);
  } else if (route.name === 'nnu') {
    renderNnuPage(main);
  } else if (route.name === 'bot') {
    renderNetNetBot(main);
  } else if (route.name === 'contacts-companies' || route.name === 'contacts-people' || route.name === 'contacts-root') {
    const subview = route.subview || (route.name === 'contacts-people' ? 'people' : 'companies');
    renderContacts(main, subview);
  } else {
    renderContacts(main, 'companies');
  }
}

function mountApp() {
  setTheme(getTheme());
  ensureToast();
  window.navigate = navigate;
  window.showToast = showToast;
  const initialHash = '#/auth/login';
  if (initialHash.startsWith('#/auth')) {
    mountAuthShell();
    currentShell = 'auth';
  } else {
    mountShell(initialHash);
    applyMainWrapperClass(initialHash);
    currentShell = 'app';
  }
  initRouter({
    contacts: (route) => renderRoute(route || { name: 'contacts-root', subview: 'companies' }),
    profile: (type, id) => renderRoute({ name: type, id }),
    me: (page) => renderRoute({ name: 'me', page }),
    jobs: () => renderRoute({ name: 'jobs' }),
    sales: () => renderRoute({ name: 'sales' }),
    quick: () => renderRoute({ name: 'quick' }),
    chat: () => renderRoute({ name: 'chat' }),
    reports: () => renderRoute({ name: 'reports' }),
    components: () => renderRoute({ name: 'components' }),
    settings: () => renderRoute({ name: 'settings' }),
    profilePage: () => renderRoute({ name: 'profile' }),
    nnu: () => renderRoute({ name: 'nnu' }),
    bot: () => renderRoute({ name: 'bot' }),
    auth: (name) => renderRoute({ name }),
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', mountApp);
} else {
  mountApp();
}
