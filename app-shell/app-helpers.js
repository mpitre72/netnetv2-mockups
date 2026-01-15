import { ICONS, WORKSPACES, WORKSPACE_KEY, THEME_KEY, SIDEBAR_MODE_KEY } from './app-constants.js';

const ROLE_KEY = 'netnet_userRole';
const VALID_ROLES = ['member', 'lead', 'admin', 'owner'];

export function __isDark() {
  return document.documentElement.classList.contains('dark');
}

export function __norm(s) {
  return (s || '').replace(/\/+$/, '');
}

export function __isMeActive(h) {
  const hh = __norm(h || '');
  return hh === '#/app' || hh === '#/app/' || hh.startsWith('#/app/me');
}

export function __paint(img, active) {
  const theme = __isDark() ? 'dark' : 'light';
  const attr  = active ? `data-${theme}-active` : `data-${theme}-idle`;
  const url   = img.getAttribute(attr);
  if (url && img.getAttribute('src') !== url) img.setAttribute('src', url);
}

export function getTheme() {
  const saved = localStorage.getItem(THEME_KEY);
  if (saved === 'dark' || saved === 'light') return saved;
  return matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function setTheme(t) {
  document.documentElement.classList.toggle('dark', t === 'dark');
  localStorage.setItem(THEME_KEY, t);
}

export function getActiveWorkspace() {
  const saved = localStorage.getItem(WORKSPACE_KEY);
  const found = WORKSPACES.find(w => w.id === saved);
  return found || WORKSPACES[0];
}

export function setActiveWorkspace(id) {
  localStorage.setItem(WORKSPACE_KEY, id);
}

export function applyWorkspaceIcon(imgEl) {
  const active = getActiveWorkspace();
  if (imgEl) {
    imgEl.src = active.icon;
    imgEl.alt = active.name;
  }
}

export function getIconSet(key) {
  return ICONS[key];
}

export function getSidebarMode() {
  const saved = localStorage.getItem(SIDEBAR_MODE_KEY);
  if (saved === 'compact' || saved === 'full') return saved;
  return 'full';
}

export function setSidebarMode(mode) {
  const next = mode === 'compact' ? 'compact' : 'full';
  localStorage.setItem(SIDEBAR_MODE_KEY, next);
}

export function getOSKind() {
  const ua = navigator.userAgent || '';
  const platform = navigator.platform || '';
  const isMac = /Mac/.test(platform) || /Mac OS/.test(ua);
  const isWin = /Win/.test(platform) || /Windows/.test(ua);
  if (isMac) return 'mac';
  if (isWin) return 'windows';
  return 'other';
}

function normalizeRole(role) {
  const value = String(role || '').toLowerCase();
  return VALID_ROLES.includes(value) ? value : 'owner';
}

export function getCurrentRole() {
  try {
    return normalizeRole(localStorage.getItem(ROLE_KEY));
  } catch (e) {
    return 'owner';
  }
}

export function setCurrentRole(role) {
  const next = normalizeRole(role);
  try {
    localStorage.setItem(ROLE_KEY, next);
  } catch (e) {
    // Ignore storage errors in prototype
  }
  return next;
}
