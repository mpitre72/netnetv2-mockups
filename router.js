import { openTabForHash } from './app-shell/app-tabs.js';

const DEFAULT_HASH = '#/app/contacts';

function parseRoute(hash) {
  const h = hash || DEFAULT_HASH;
  const companyMatch = h.match(/^#\/app\/contacts\/company\/(\d+)$/);
  const personMatch = h.match(/^#\/app\/contacts\/person\/(\d+)$/);
  const meTime = h.startsWith('#/app/me/time');
  const mePerf = h.startsWith('#/app/me/performance');
  const meTasks = h.startsWith('#/app/me') || h === '#/app/me' || h === '#/app/me/';
  const jobs = h.startsWith('#/app/jobs');
  const sales = h.startsWith('#/app/sales');
  const quick = h.startsWith('#/app/quick-tasks');
  const chat = h.startsWith('#/app/chat');
  const reports = h.startsWith('#/app/reports');
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

  if (companyMatch) return { name: 'company', id: parseInt(companyMatch[1], 10) };
  if (personMatch) return { name: 'person', id: parseInt(personMatch[1], 10) };
  if (meTime) return { name: 'me', page: 'time' };
  if (mePerf) return { name: 'me', page: 'performance' };
  if (meTasks) return { name: 'me', page: 'tasks' };
  if (jobs) return { name: 'jobs' };
  if (sales) return { name: 'sales' };
  if (quick) return { name: 'quick' };
  if (chat) return { name: 'chat' };
  if (reports) return { name: 'reports' };
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
  return { name: 'contacts' };
}

function handleRoute(renderers) {
  const hash = location.hash || DEFAULT_HASH;
  const route = parseRoute(hash);
  openTabForHash(hash);
  if (route.name === 'company' || route.name === 'person') {
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
  } else if (route.name === 'reports') {
    renderers.reports();
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
    renderers.contacts();
  }
}

export function initRouter(renderers) {
  window.addEventListener('hashchange', () => handleRoute(renderers));
  handleRoute(renderers);
}

export function navigate(hash) {
  if (!hash) return;
  if (location.hash === hash) {
    window.dispatchEvent(new HashChangeEvent('hashchange'));
  } else {
    location.hash = hash;
  }
}
