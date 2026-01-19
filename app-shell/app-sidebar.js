import { APP_ICONS, ICONS, SIDEBAR_LINKS } from './app-constants.js';
import { __norm, __paint, getSidebarMode, setSidebarMode, getOSKind, getCurrentRole } from './app-helpers.js';
import { navigate } from '../router.js';

const MODE_FULL = 'full';
const MODE_COMPACT = 'compact';

let currentMode = MODE_FULL;
let sidebarListenersBound = false;
let openSectionKey = null;
let manualClosedKey = null;
let sidebarShortcutBound = false;

function isSectionActive(hash, item) {
  const normalizedHash = __norm(hash || '#/app');
  const base = __norm(item?.basePath || item?.path || '');
  if (!base) return false;
  return normalizedHash === base || normalizedHash.startsWith(base + '/') || normalizedHash.startsWith(base);
}

function getDefaultPath(item) {
  if (item?.subs?.length) {
    const first = item.subs[0];
    if (first?.path) return first.path;
  }
  return item?.path;
}

function renderSection(item) {
  const iconSet = ICONS[item.key];
  if (!iconSet) return '';
  const hasSubs = Array.isArray(item.subs) && item.subs.length > 0;
  const imgClass = item.key === 'me' ? 'h-5 w-5' : 'h-6 w-6';
  const subLinks = hasSubs
    ? item.subs.map(sub => `<a href="${sub.path}" class="sidebar-sub-link" data-role="sub-link" data-section-key="${item.key}">${sub.name}</a>`).join('')
    : '';
  const flyoutContent = hasSubs
    ? `<div class="sidebar-flyout__header">${item.name}</div><div class="sidebar-flyout__subs">${subLinks}</div>`
    : `<div class="sidebar-flyout__header">${item.name}</div>`;
  return `
    <div class="sidebar-item" data-section-key="${item.key}" data-has-subs="${hasSubs ? 'true' : 'false'}">
      <a href="${item.path}" class="sidebar-link" data-role="section-link" title="${item.name}" aria-label="${item.name}">
        <img data-icon="${item.key}" alt="${item.name}" class="${imgClass} flex-shrink-0" data-light-idle="${iconSet.light.idle}" data-light-active="${iconSet.light.active}" data-dark-idle="${iconSet.dark.idle}" data-dark-active="${iconSet.dark.active}"/>
        <span class="sidebar-label">${item.name}</span>
        <span class="flyout-label">${item.name}</span>
        ${hasSubs ? '<span class="sidebar-chevron" aria-hidden="true">&#9662;</span>' : ''}
      </a>
      ${hasSubs ? `<div class="sidebar-subnav" data-subnav="${item.key}">${subLinks}</div>` : ''}
      <div class="sidebar-flyout">${flyoutContent}</div>
    </div>`;
}

export function renderSidebar(hash) {
  const mode = getSidebarMode();
  const role = getCurrentRole();
  const roleLabel = role.charAt(0).toUpperCase() + role.slice(1);
  const canAccessSettings = role === 'admin' || role === 'owner';
  const order = ['me', 'contacts', 'sales', 'jobs', 'quick', 'chat', 'performance', 'nnu'];
  const orderedLinks = order
    .map(key => SIDEBAR_LINKS.find(item => item.key === key))
    .filter(Boolean);
  return `
    <aside id="app-sidebar" class="app-sidebar hidden md:flex bg-[#0F172A] dark:bg-[#0F172A] flex-col justify-between p-2 overflow-visible sidebar--${mode}" data-mode="${mode}">
      <div class="flex-1 flex flex-col sidebar-body">
        <nav id="sidebar-sections" class="space-y-1 overflow-y-auto pr-1 sidebar-nav">
          ${orderedLinks.map(renderSection).join('')}
        </nav>
      </div>
      <div id="sidebar-functions" class="mt-4 flex flex-col gap-2 px-1 pb-1">
        ${canAccessSettings ? `
        <a href="#/app/settings" class="sidebar-link utility-link" title="Settings" aria-label="Settings">
          <span class="flex-shrink-0">${APP_ICONS.settings}</span>
          <span class="sidebar-label">Settings</span>
          <span class="flyout-label">Settings</span>
        </a>
        ` : ''}
        <button id="workspaceSwitcherButton" type="button" class="sidebar-link utility-link w-full" title="Workspace" aria-label="Workspace">
          <img id="workspaceSwitcherIcon" src="" alt="Workspace" class="h-6 w-6 flex-shrink-0 rounded-full object-contain"/>
          <span class="sidebar-label">Workspace</span>
          <span class="flyout-label">Workspace</span>
        </button>
        <a href="#/auth/login" id="logout-btn" class="sidebar-link utility-link" title="Log out" aria-label="Log out">
          <span class="flex-shrink-0">${APP_ICONS.logout}</span>
          <span class="sidebar-label">Log out</span>
          <span class="flyout-label">Log out</span>
        </a>
        <div class="sidebar-profile" role="group">
          <button
            type="button"
            id="sidebarProfileBtn"
            class="sidebar-profile-main"
            title="Profile"
            aria-label="Profile"
          >
            <div class="h-8 w-8 rounded-full bg-slate-700 flex items-center justify-center text-slate-200 text-sm font-semibold">MP</div>
            <div class="flex flex-col">
              <span class="text-sm font-semibold text-slate-100 sidebar-profile-name">Marc Pitre</span>
              <span class="text-xs text-slate-400 sidebar-profile-role">${roleLabel}</span>
            </div>
          </button>
          <button type="button" id="sidebarModeToggle" class="sidebar-profile-toggle" data-mode="${mode}">
            <span class="toggle-icon" aria-hidden="true"></span>
          </button>
        </div>
      </div>
    </aside>
  `;
}

function updateProfileChevron(mode) {
  const toggleIcon = document.querySelector('#sidebarModeToggle .toggle-icon');
  if (!toggleIcon) return;
  toggleIcon.textContent = mode === MODE_COMPACT ? '›' : '‹';
}

function applySidebarMode(mode) {
  currentMode = mode === MODE_COMPACT ? MODE_COMPACT : MODE_FULL;
  setSidebarMode(currentMode);
  const sidebar = document.getElementById('app-sidebar');
  if (!sidebar) return;
  sidebar.setAttribute('data-mode', currentMode);
  sidebar.classList.toggle('sidebar--compact', currentMode === MODE_COMPACT);
  sidebar.classList.toggle('sidebar--full', currentMode === MODE_FULL);
  sidebar.style.setProperty('--sidebar-width', currentMode === MODE_COMPACT ? '76px' : '256px');
  updateProfileChevron(currentMode);
}

function currentActiveKey(hash) {
  const normalizedHash = __norm(hash || location.hash || '#/app');
  const found = SIDEBAR_LINKS.find(item => isSectionActive(normalizedHash, item));
  return found ? found.key : null;
}

function updateOpenSectionForHash(hash) {
  const normalizedHash = __norm(hash || location.hash || '#/app');
  const activeKey = currentActiveKey(normalizedHash);
  const activeItem = SIDEBAR_LINKS.find(item => item.key === activeKey);
  manualClosedKey = null;
  if (activeItem && activeItem.subs && activeItem.subs.length) {
    openSectionKey = activeKey;
  } else if (!activeItem || !activeItem.subs || !activeItem.subs.length) {
    openSectionKey = null;
  }
}

function updateSidebarState(hash) {
  const normalizedHash = __norm(hash || location.hash || '#/app');
  const activeKey = currentActiveKey(normalizedHash);
  const linkMap = Object.fromEntries(SIDEBAR_LINKS.map(item => [item.key, item]));
  const sidebar = document.getElementById('app-sidebar');
  if (!sidebar) return;

  if (openSectionKey && (!linkMap[openSectionKey] || !linkMap[openSectionKey].subs || !linkMap[openSectionKey].subs.length)) {
    openSectionKey = null;
  } else if (!openSectionKey && activeKey && linkMap[activeKey]?.subs?.length && manualClosedKey !== activeKey) {
    openSectionKey = activeKey;
  }

  sidebar.querySelectorAll('[data-section-key]').forEach(node => {
    const key = node.getAttribute('data-section-key') || '';
    const cfg = linkMap[key];
    const link = node.querySelector('[data-role="section-link"]');
    const img = node.querySelector('img[data-icon]');
    const hasSubs = !!(cfg && cfg.subs && cfg.subs.length);
    const isActive = cfg ? isSectionActive(normalizedHash, cfg) : false;
    const isOpen = hasSubs && openSectionKey === key;

    node.classList.toggle('is-active', isActive);
    node.classList.toggle('is-open', isOpen);
    if (link) {
      link.setAttribute('aria-expanded', hasSubs ? (isOpen ? 'true' : 'false') : 'false');
    }
    if (img && cfg) {
      __paint(img, isActive);
    }
    node.querySelectorAll('[data-role="sub-link"]').forEach(sub => {
      const target = __norm(sub.getAttribute('href') || '');
      const subActive = target && normalizedHash.startsWith(target);
      sub.classList.toggle('is-active', subActive);
    });
    const subNav = node.querySelector('.sidebar-subnav');
    if (subNav) subNav.setAttribute('data-open', isOpen ? 'true' : 'false');
  });
}

function handleSectionClick(e) {
  const link = e.currentTarget;
  if (!link) return;
  const wrapper = link.closest('[data-section-key]');
  const sectionKey = wrapper?.getAttribute('data-section-key');
  const config = SIDEBAR_LINKS.find(item => item.key === sectionKey);
  const hasSubs = !!(config && config.subs && config.subs.length);
  if (!config) return;

  if (!hasSubs) {
    openSectionKey = null;
    return;
  }

  e.preventDefault();
  const normalizedHash = __norm(location.hash || '#/app');
  const isActive = isSectionActive(normalizedHash, config);
  const isOpen = openSectionKey === sectionKey;

  if (!isActive) {
    openSectionKey = sectionKey || null;
    manualClosedKey = null;
    const target = getDefaultPath(config) || config.path;
    if (target) navigate(target);
  } else {
    if (isOpen) {
      openSectionKey = null;
      manualClosedKey = sectionKey || null;
      updateSidebarState(location.hash);
    } else {
      openSectionKey = sectionKey || null;
      manualClosedKey = null;
      updateSidebarState(location.hash);
      const target = link.getAttribute('href') || getDefaultPath(config);
      if (target) navigate(target);
    }
  }
}

function wireSubNavClicks() {
  document.querySelectorAll('[data-role="sub-link"]').forEach(sub => {
    if (sub.dataset.bound === 'true') return;
    sub.dataset.bound = 'true';
    sub.addEventListener('click', (e) => {
      e.preventDefault();
      const sectionKey = sub.getAttribute('data-section-key');
      if (sectionKey) openSectionKey = sectionKey;
      const href = sub.getAttribute('href');
      if (href) navigate(href);
      e.stopPropagation();
    });
  });
}

function wireSectionClicks() {
  document.querySelectorAll('[data-role="section-link"]').forEach(link => {
    if (link.dataset.bound === 'true') return;
    link.dataset.bound = 'true';
    link.addEventListener('click', handleSectionClick);
  });
}

function wireHoverPaint() {
  const canHover = matchMedia && matchMedia('(hover:hover)').matches;
  const hash = __norm(location.hash || '#/app');
  const linkMap = Object.fromEntries(SIDEBAR_LINKS.map(item => [item.key, item]));
  document.querySelectorAll('nav a[data-role="section-link"]').forEach(a => {
    const img = a.querySelector('img[data-icon]');
    if (!img) return;
    const key = (img.getAttribute('data-icon') || '').toLowerCase().trim();
    const item = linkMap[key];
    const isActive = item ? isSectionActive(hash, item) : false;
    __paint(img, isActive);
    a.onmouseenter = a.onmouseleave = a.onfocus = a.onblur = null;
    if (canHover) {
      a.onmouseenter = () => __paint(img, true);
      a.onmouseleave = () => {
        const now = __norm(location.hash || '#/app');
        const activeNow = item ? isSectionActive(now, item) : false;
        __paint(img, activeNow);
      };
      a.onfocus = a.onmouseenter;
      a.onblur  = a.onmouseleave;
    }
  });
}

function wireSidebarModeToggle() {
  const toggle = document.getElementById('sidebarModeToggle');
  if (!toggle) return;
  if (toggle.dataset.bound === 'true') return;
  toggle.dataset.bound = 'true';
  const os = getOSKind();
  const shortcutText = os === 'mac' ? '⌘B' : 'Ctrl+B';
  toggle.title = `Toggle sidebar (${shortcutText})`;
  toggle.setAttribute('aria-label', `Toggle sidebar (${shortcutText})`);
  toggle.addEventListener('click', () => {
    const next = currentMode === MODE_COMPACT ? MODE_FULL : MODE_COMPACT;
    applySidebarMode(next);
  });
  updateProfileChevron(currentMode);
}

function wireSidebarKeyboardShortcut() {
  if (sidebarShortcutBound) return;
  sidebarShortcutBound = true;
  const os = getOSKind();
  window.addEventListener('keydown', (e) => {
    const tag = (e.target && e.target.tagName || '').toLowerCase();
    const isFormField = tag === 'input' || tag === 'textarea' || tag === 'select' || (e.target && e.target.isContentEditable);
    if (isFormField) return;
    const key = (e.key || '').toLowerCase();
    const isToggle = os === 'mac'
      ? (e.metaKey && !e.ctrlKey && key === 'b')
      : (!e.metaKey && e.ctrlKey && key === 'b');
    if (!isToggle) return;
    e.preventDefault();
    const next = currentMode === MODE_COMPACT ? MODE_FULL : MODE_COMPACT;
    applySidebarMode(next);
  });
}

function debugLogSidebarFlyoutState() {
  const sidebar = document.getElementById('app-sidebar');
  const meItem = sidebar?.querySelector('.sidebar-item[data-section-key="me"]');
  const meFlyout = meItem?.querySelector('.sidebar-flyout');
  if (!meItem || !meFlyout) {
    console.warn('[Sidebar] Me flyout missing:', { meItemExists: !!meItem, meFlyoutExists: !!meFlyout });
  }
}

function wireSidebarFlyoutFallback() {
  const sidebar = document.getElementById('app-sidebar');
  if (!sidebar) return;
  const items = sidebar.querySelectorAll('.sidebar-item[data-has-subs="true"]');
  items.forEach(item => {
    if (item.dataset.flyoutBound === 'true') return;
    item.dataset.flyoutBound = 'true';
    const flyout = item.querySelector('.sidebar-flyout');
    if (!flyout) return;
    item.addEventListener('mouseenter', () => {
      if (currentMode !== MODE_COMPACT) return;
      const top = item.offsetTop;
      flyout.style.top = `${top}px`;
    });
  });
}

function ensureHashListener() {
  if (sidebarListenersBound) return;
  window.addEventListener('hashchange', () => {
    updateOpenSectionForHash(location.hash);
    updateSidebarState(location.hash);
  });
  sidebarListenersBound = true;
}

export function wireSidebar(hash) {
  const initialMode = getSidebarMode();
  applySidebarMode(initialMode);
  if (!openSectionKey && !manualClosedKey) {
    updateOpenSectionForHash(hash || location.hash || '#/app');
  }
  updateSidebarState(hash || location.hash || '#/app');
  wireSectionClicks();
  wireSubNavClicks();
  wireHoverPaint();
  wireSidebarModeToggle();
  wireSidebarKeyboardShortcut();
  wireSidebarFlyoutFallback();
  debugLogSidebarFlyoutState();
  ensureHashListener();
}

export function wireSidebarIcons(hash) {
  wireSidebar(hash);
}
