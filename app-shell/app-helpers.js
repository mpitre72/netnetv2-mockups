import { ICONS, WORKSPACES, WORKSPACE_KEY, THEME_KEY } from './app-constants.js';

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
