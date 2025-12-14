import { openTabForHash } from './app-shell/app-tabs.js';
import { getContactsEntryHash } from './contacts/contacts-ui-state.js';

const DEFAULT_HASH = '#/auth/login';
const APP_DEFAULT_HASH = '#/app/me/tasks';
const LOGIN_HASH = '#/auth/login';

// Temporary, simple auth stub for prototype
const AUTH_STORAGE_KEY = 'netnet_isAuthenticated';

export function isAuthenticated() {
  try {
    return localStorage.getItem(AUTH_STORAGE_KEY) === 'true';
  } catch (e) {
    return false;
  }
}

export function setAuthenticated(value) {
  try {
    localStorage.setItem(AUTH_STORAGE_KEY, value ? 'true' : 'false');
  } catch (e) {
    // Ignore storage errors in prototype
  }
}

function parseRoute(hash) {
  const h = hash || DEFAULT_HASH;
  const companyMatch = h.match(/^#\/app\/contacts\/company\/(\d+)$/);
  const companyEdit = h.match(/^#\/app\/contacts\/companies\/(\d+)\/edit$/);
  const companyNew = h === '#/app/contacts/companies/new';
  const personMatch = h.match(/^#\/app\/contacts\/person\/(\d+)$/);
  const personEdit = h.match(/^#\/app\/contacts\/people\/(\d+)\/edit$/);
  const personNew = h === '#/app/contacts/people/new';
  const contactsImport = /^#\/app\/contacts\/import\/?$/.test(h);
  const contactsImportHistory = /^#\/app\/contacts\/import\/history\/?$/.test(h);
  const contactsCompanies = /^#\/app\/contacts\/companies\/?$/.test(h);
  const contactsPeople = /^#\/app\/contacts\/people\/?$/.test(h);
  const contactsRoot = /^#\/app\/contacts\/?$/.test(h);
  const meLists = h.startsWith('#/app/me/lists');
  const meTime = h.startsWith('#/app/me/time');
  const mePerf = h.startsWith('#/app/me/performance');
  const meTasks = h.startsWith('#/app/me') || h === '#/app/me' || h === '#/app/me/';
  const jobs = h.startsWith('#/app/jobs');
  const sales = h.startsWith('#/app/sales');
  const quick = h.startsWith('#/app/quick-tasks');
  const chat = h.startsWith('#/app/chat');
  const performance = h.startsWith('#/app/performance');
  const legacyReports = h.startsWith('#/app/reports');
  const components = h.startsWith('#/app/components');
  const settings = h.startsWith('#/app/settings');
  const profile = h.startsWith('#/app/profile');
  const nnu = h.startsWith('#/app/net-net-u');
  const bot = h.startsWith('#/app/net-net-bot');
  const authLogin = h === '#/auth/login' || h === '#/auth';
  const authRegister = h === '#/auth/register';
  const authForgot = h === '#/auth/forgot';
  const authCheckEmail = h === '#/auth/check-email';
  const authReset = h === '#/auth/reset';
  const authResetSuccess = h === '#/auth/success';
  const authVerifyCode = h === '#/auth/verify-code';
  const authVerifySuccess = h === '#/auth/verify-success';

  if (companyEdit) return { name: 'company-edit', id: parseInt(companyEdit[1], 10) };
  if (companyNew) return { name: 'company-new' };
  if (companyMatch) return { name: 'company', id: parseInt(companyMatch[1], 10) };
  if (personEdit) return { name: 'person-edit', id: parseInt(personEdit[1], 10) };
  if (personNew) return { name: 'person-new' };
  if (personMatch) return { name: 'person', id: parseInt(personMatch[1], 10) };
  if (contactsImportHistory) return { name: 'contacts-import-history' };
  if (contactsImport) return { name: 'contacts-import' };
  if (contactsCompanies) return { name: 'contacts-companies', subview: 'companies' };
  if (contactsPeople) return { name: 'contacts-people', subview: 'people' };
  if (contactsRoot) return { name: 'contacts-root' };
  if (meLists) return { name: 'me', page: 'lists' };
  if (meTime) return { name: 'me', page: 'time' };
  if (mePerf) return { name: 'me', page: 'performance' };
  if (meTasks) return { name: 'me', page: 'tasks' };
  if (jobs) return { name: 'jobs' };
  if (sales) return { name: 'sales' };
  if (quick) return { name: 'quick' };
  if (chat) return { name: 'chat' };
  if (performance || legacyReports) return { name: 'performance', legacy: legacyReports };
  if (components) return { name: 'components' };
  if (settings) return { name: 'settings' };
  if (profile) return { name: 'profile' };
  if (nnu) return { name: 'nnu' };
  if (bot) return { name: 'bot' };
  if (authLogin) return { name: 'auth-login' };
  if (authRegister) return { name: 'auth-register' };
  if (authForgot) return { name: 'auth-forgot' };
  if (authCheckEmail) return { name: 'auth-check' };
  if (authReset) return { name: 'auth-reset' };
  if (authResetSuccess) return { name: 'auth-reset-success' };
  if (authVerifyCode) return { name: 'auth-verify-code' };
  if (authVerifySuccess) return { name: 'auth-verify-success' };
  return { name: 'auth-login' };
}

function handleRoute(renderers) {
  const hash = location.hash || DEFAULT_HASH;
  const route = parseRoute(hash);

  if (route.name === 'auth-login' && hash !== LOGIN_HASH) {
    navigate(LOGIN_HASH);
    return;
  }

  if (!route.name.startsWith('auth')) {
    openTabForHash(hash);
  }

  if (route.name === 'contacts-root') {
    const targetHash = getContactsEntryHash();
    if (location.hash !== targetHash) {
      navigate(targetHash);
      return;
    }
    renderers.contacts({ name: 'contacts-companies', subview: 'companies' });
  } else if (route.name === 'contacts-companies' || route.name === 'contacts-people') {
    renderers.contacts(route);
  } else if (route.name === 'contacts-import' || route.name === 'contacts-import-history') {
    renderers.contacts(route);
  } else if (route.name === 'company-new' || route.name === 'company-edit') {
    renderers.contacts({ name: route.name, id: route.id });
  } else if (route.name === 'person-new' || route.name === 'person-edit') {
    renderers.contacts({ name: route.name, id: route.id });
  } else if (route.name === 'company' || route.name === 'person') {
    renderers.profile(route.name, route.id);
  } else if (route.name === 'me') {
    renderers.me(route.page);
  } else if (route.name === 'jobs') {
    renderers.jobs();
  } else if (route.name === 'sales') {
    renderers.sales();
  } else if (route.name === 'quick') {
    renderers.quick();
  } else if (route.name === 'chat') {
    renderers.chat();
  } else if (route.name === 'performance') {
    if (route.legacy) {
      const newHash = (location.hash || '').replace('#/app/reports', '#/app/performance');
      if (newHash && newHash !== location.hash) {
        navigate(newHash);
        return;
      }
    }
    renderers.performance();
  } else if (route.name === 'components') {
    renderers.components();
  } else if (route.name === 'settings') {
    renderers.settings();
  } else if (route.name === 'profile') {
    renderers.profilePage();
  } else if (route.name === 'nnu') {
    renderers.nnu();
  } else if (route.name === 'bot') {
    renderers.bot();
  } else if (route.name.startsWith('auth')) {
    renderers.auth(route.name);
  } else {
    // Unknown route fallback: go to login
    navigate(LOGIN_HASH);
  }
}

export function initRouter(renderers) {
  const normalizeHashForAuth = (hash) => {
    const currentHash = hash || '';
    const authed = isAuthenticated();

    // ✅ ALWAYS go to login when there's no hash or just "#"
    if (!currentHash || currentHash === '#') {
      return LOGIN_HASH;
    }

    // If not authenticated and trying to hit an /app route, force login
    if (!authed && currentHash.startsWith('#/app')) {
      return LOGIN_HASH;
    }

    return currentHash;
  };

  const processRoute = () => {
    const desiredHash = normalizeHashForAuth(location.hash);
    if (location.hash !== desiredHash) {
      location.hash = desiredHash;
      return;
    }
    handleRoute(renderers);
  };

  window.addEventListener('hashchange', processRoute);
  processRoute();
}

export function navigate(hash) {
  if (!hash) return;
  if (location.hash === hash) {
    window.dispatchEvent(new HashChangeEvent('hashchange'));
  } else {
    location.hash = hash;
  }
}
