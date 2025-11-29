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
import { renderLogin } from './auth/login.js';
import { renderRegister } from './auth/register.js';
import { renderForgotPassword } from './auth/forgot-password.js';
import { renderForgotPasswordCheckEmail } from './auth/forgot-password-check-email.js';
import { renderResetPassword } from './auth/reset-password.js';
import { renderResetSuccess } from './auth/reset-success.js';
import { renderVerifyCode } from './auth/verify-code.js';
import { renderVerifySuccess } from './auth/verify-success.js';
import { initRouter, navigate } from './router.js';
import { mountShell } from './app-shell/app-layout.js';
import { setTheme, getTheme } from './app-shell/app-helpers.js';

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

function renderRoute(route) {
  const main = document.getElementById('app-main');
  if (!main) return;
  if (route.name === 'company' || route.name === 'person') {
    main.innerHTML = `<div id="profile-container" class="h-full overflow-y-auto"></div>`;
    renderContactProfile(route.name, route.id, { container: document.getElementById('profile-container') });
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
  } else if (route.name === 'auth-login') {
    renderLogin(main);
  } else if (route.name === 'auth-register') {
    renderRegister(main);
  } else if (route.name === 'auth-forgot') {
    renderForgotPassword(main);
  } else if (route.name === 'auth-check') {
    renderForgotPasswordCheckEmail(main);
  } else if (route.name === 'auth-reset') {
    renderResetPassword(main);
  } else if (route.name === 'auth-reset-success') {
    renderResetSuccess(main);
  } else if (route.name === 'auth-verify-code') {
    renderVerifyCode(main);
  } else if (route.name === 'auth-verify-success') {
    renderVerifySuccess(main);
  } else {
    renderContacts(main);
  }
}

function mountApp() {
  setTheme(getTheme());
  ensureToast();
  window.navigate = navigate;
  window.showToast = showToast;
  mountShell(location.hash || '#/app/contacts');
  initRouter({
    contacts: () => renderRoute({ name: 'contacts' }),
    profile: (type, id) => renderRoute({ name: type, id }),
    me: (page) => renderRoute({ name: 'me', page }),
    jobs: () => renderRoute({ name: 'jobs' }),
    sales: () => renderRoute({ name: 'sales' }),
    quick: () => renderRoute({ name: 'quick' }),
    chat: () => renderRoute({ name: 'chat' }),
    reports: () => renderRoute({ name: 'reports' }),
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
