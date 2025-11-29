import { SIDEBAR_LINKS } from './app-constants.js';

const TAB_STORAGE_KEY = 'netnet_workspace_tabs';
let workspaceTabs = [];
let activeTabId = null;

function isDesktop() { return window.innerWidth >= 1024; }

function labelForRoute(hash) {
  const h = hash || '';
  if (h.startsWith('#/app/me')) return 'My Tasks';
  if (h.startsWith('#/app/net-net-bot')) return 'Net Net Bot';
  if (h.startsWith('#/app/contacts/company')) return 'Company Profile';
  if (h.startsWith('#/app/contacts/person')) return 'Person Profile';
  if (h.startsWith('#/app/contacts')) return 'Contacts';
  if (h.startsWith('#/app/sales')) return 'Sales';
  if (h.startsWith('#/app/jobs')) return 'Jobs';
  if (h.startsWith('#/app/quick')) return 'Quick Tasks';
  if (h.startsWith('#/app/chat')) return 'Chat';
  if (h.startsWith('#/app/reports')) return 'Reports';
  if (h.startsWith('#/app/net-net-u')) return 'Net Net U';
  return 'Net Net';
}

function saveTabs() {
  try { localStorage.setItem(TAB_STORAGE_KEY, JSON.stringify({ tabs: workspaceTabs, activeId: activeTabId })); } catch(e) {}
}
function restoreTabs() {
  try {
    const raw = localStorage.getItem(TAB_STORAGE_KEY);
    if (!raw) return;
    const data = JSON.parse(raw);
    if (Array.isArray(data.tabs)) workspaceTabs = data.tabs;
    if (data.activeId) activeTabId = data.activeId;
  } catch(e) {}
}

function ensureHomeTab() {
  if (!workspaceTabs.length) {
    const homeHash = '#/app/contacts';
    const id = 'tab-' + Date.now();
    workspaceTabs.push({ id: id, hash: homeHash, label: 'Contacts' });
    activeTabId = id;
  }
}

export function renderWorkspaceTabs() {
  const bar = document.getElementById('workspaceTabs');
  if (!bar) return;
  if (!isDesktop()) { bar.innerHTML = ''; return; }
  bar.innerHTML = '';
  workspaceTabs.forEach(tab => {
    const isActive = tab.id === activeTabId;
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'workspace-tab' + (isActive ? ' workspace-tab--active' : '');
    btn.dataset.tabId = tab.id;
    btn.innerHTML = `<span class="workspace-tab__label">${tab.label}</span><span class="workspace-tab__close" aria-label="Close tab">&times;</span>`;
    btn.addEventListener('click', (e) => {
      const isClose = e.target.classList.contains('workspace-tab__close');
      if (isClose) { e.stopPropagation(); closeTab(tab.id); } 
      else if (!isActive) { activeTabId = tab.id; if (tab.hash && location.hash !== tab.hash) { location.hash = tab.hash; } else { renderWorkspaceTabs(); } }
    });
    bar.appendChild(btn);
  });
  const add = document.createElement('button');
  add.type = 'button';
  add.className = 'workspace-tab workspace-tab--new';
  add.textContent = '+';
  add.title = 'Open new tab';
  add.addEventListener('click', () => {
    const currentHash = location.hash || '#/app/contacts';
    const id = 'tab-' + Date.now();
    workspaceTabs.push({ id, hash: currentHash, label: labelForRoute(currentHash) });
    activeTabId = id;
    saveTabs(); renderWorkspaceTabs();
  });
  bar.appendChild(add);
}

export function initWorkspaceTabs() {
  if (!isDesktop()) return;
  restoreTabs();
  ensureHomeTab();
  window.addEventListener('resize', () => { renderWorkspaceTabs(); });
}

export function openTabForHash(hash) {
  if (!isDesktop()) return;
  if (activeTabId) {
    const tab = workspaceTabs.find(t => t.id === activeTabId);
    if (tab) {
      if (tab.hash !== hash) { tab.hash = hash; tab.label = labelForRoute(hash); saveTabs(); renderWorkspaceTabs(); }
      return;
    }
  }
  if (workspaceTabs.length === 0) {
    const id = 'tab-' + Date.now();
    workspaceTabs.push({ id: id, hash: hash, label: labelForRoute(hash) });
    activeTabId = id;
    saveTabs(); renderWorkspaceTabs();
  } else {
    activeTabId = workspaceTabs[0].id;
    workspaceTabs[0].hash = hash;
    workspaceTabs[0].label = labelForRoute(hash);
    saveTabs(); renderWorkspaceTabs();
  }
}

export function switchActiveTabTo(hash) {
  if (!isDesktop()) { window.navigate(hash); return; }
  if (!activeTabId && workspaceTabs.length > 0) activeTabId = workspaceTabs[0].id;
  else if (!activeTabId && workspaceTabs.length === 0) ensureHomeTab();
  const tab = workspaceTabs.find(t => t.id === activeTabId);
  if (tab) { tab.hash = hash; tab.label = labelForRoute(hash); saveTabs(); renderWorkspaceTabs(); }
  window.navigate(hash);
}

export function closeTab(id) {
  const idx = workspaceTabs.findIndex(t => t.id === id);
  if (idx === -1) return;
  workspaceTabs.splice(idx, 1);
  if (activeTabId === id) {
    const next = workspaceTabs[idx] || workspaceTabs[idx - 1];
    if (next) { activeTabId = next.id; if (next.hash && next.hash !== location.hash) { location.hash = next.hash; return; } } 
    else { ensureHomeTab(); const homeTab = workspaceTabs[0]; if (homeTab.hash !== location.hash) { location.hash = homeTab.hash; return; } }
  }
  saveTabs(); renderWorkspaceTabs();
}
