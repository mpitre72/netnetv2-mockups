import { APP_ICONS, ICONS, LOGO_ASSETS, SIDEBAR_LINKS, WORKSPACES, TIMER_ICONS } from './app-constants.js';
import { renderTopBar, wireTopBarLogo, wireAppTimer } from './app-header.js';
import { renderSidebar, wireSidebarIcons } from './app-sidebar.js';
import { renderMobileBottomNav } from './app-bottom-nav.js';
import { initWorkspaceTabs, renderWorkspaceTabs } from './app-tabs.js';
import { __isDark, getActiveWorkspace, setActiveWorkspace, setTheme } from './app-helpers.js';
import { setAuthenticated, navigate } from '../router.js';

function renderMobileHeader() {
  return `
    <div id="mobile-header" class="mobile-header md:hidden bg-white dark:bg-slate-900 shadow-sm">
      <img id="mobile-header-logo" src="${LOGO_ASSETS.dark.idle}" alt="Net Net" class="h-6 w-auto" />
    </div>
  `;
}

function renderMobileMenu(hash) {
  const activeWS = getActiveWorkspace();
  return `
    <div id="mobileMenuOverlay" class="mobile-menu-overlay md:hidden bg-white dark:bg-[#0F172A]">
      <div class="p-6 flex-1 overflow-y-auto">
        <div class="flex justify-end mb-4">
          <button id="mobileMenuCloseBtn" class="p-2 text-gray-500 dark:text-gray-400">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
        <nav class="space-y-6 mb-8">
          ${SIDEBAR_LINKS.map(item => {
            const iconSrc = ICONS[item.key].light.idle;
            const isActive = item.path === hash || (item.key === 'me' && hash.startsWith('#/app/me'));
            const subMenu = (item.subs && isActive) ? `
              <div class="ml-10 mt-1 flex flex-col gap-3 text-sm text-slate-600 dark:text-slate-300 border-l-2 border-gray-200 dark:border-gray-700 pl-4">
                ${item.subs.map(sub => `<button type="button" class="text-left hover:text-slate-900 dark:hover:text-white mobile-menu-link ${hash.startsWith(sub.path) ? 'text-netnet-purple font-medium dark:text-white' : ''}" data-path="${sub.path}">${sub.name}</button>`).join('')}
              </div>` : '';
            return `
              <button class="mobile-menu-link w-full flex items-center gap-4 text-left" data-path="${item.path}">
                <img src="${iconSrc}" class="w-6 h-6" data-mobile-menu-icon="${item.key}">
                <span class="text-lg font-semibold text-gray-900 dark:text-white">${item.name}</span>
              </button>${subMenu}`;
          }).join('')}
        </nav>
        <div class="w-full h-px bg-gray-200 dark:bg-white/10 mb-8"></div>
        <nav class="space-y-6">
          <button class="mobile-menu-link w-full flex items-center gap-4 text-left" data-path="#/app/settings">
            <div class="w-6 h-6 text-gray-500 dark:text-gray-400">${APP_ICONS.settings}</div>
            <span class="text-base font-medium text-gray-700 dark:text-gray-300">Settings</span>
          </button>
          <button class="mobile-menu-link w-full flex items-center gap-4 text-left" data-path="#/app/profile">
            <div class="w-6 h-6 text-gray-500 dark:text-gray-400">${APP_ICONS.avatar}</div>
            <span class="text-base font-medium text-gray-700 dark:text-gray-300">Profile</span>
          </button>
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-4">
              <div class="w-6 h-6 text-gray-500 dark:text-gray-400 flex justify-center"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="5"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg></div>
              <span class="text-base font-medium text-gray-700 dark:text-gray-300">Appearance</span>
            </div>
            <button id="mobileThemeToggle" class="relative inline-flex h-6 w-11 items-center rounded-full bg-gray-200 dark:bg-netnet-purple transition-colors">
              <span class="translate-x-1 dark:translate-x-6 inline-block h-4 w-4 transform rounded-full bg-white transition-transform"></span>
            </button>
          </div>
          <button id="mobileWorkspaceMenuButton" type="button" class="w-full flex items-center gap-4 text-left">
            <span class="inline-flex items-center justify-center rounded-full bg-white shadow-sm border border-gray-200 dark:border-gray-600" style="width:28px;height:28px;">
              <img id="mobileWorkspaceMenuIcon" src="${activeWS.icon}" alt="${activeWS.name}" class="h-5 w-5 object-contain"/>
            </span>
            <span class="text-base font-medium text-gray-700 dark:text-gray-300">Workspace</span>
          </button>
          <button id="mobileLogoutBtn" class="w-full flex items-center gap-4 text-left">
            <div class="w-6 h-6 text-gray-500 dark:text-gray-400">${APP_ICONS.logout}</div>
            <span class="text-base font-medium text-gray-700 dark:text-gray-300">Log out</span>
          </button>
        </nav>
      </div>
    </div>
  `;
}

export function renderAppShell(hash = '#/app/me/tasks') {
  return `
    <div id="app-shell" class="drawer-closed bg-white dark:bg-black">
      ${renderMobileHeader()}
      ${renderTopBar()}
      ${renderSidebar(hash)}
      <main id="app-main"></main>
      ${renderMobileBottomNav()}
      ${renderMobileMenu(hash)}
      <div id="drawer-container"></div>
    </div>
  `;
}

function renderNotificationsDrawer() {
  return `
    <div id="app-drawer-backdrop"></div>
    <aside id="app-drawer" class="bg-white dark:bg-slate-900 text-slate-900 dark:text-white p-5 flex flex-col gap-4 w-full max-w-md">
      <div class="flex items-center justify-between">
        <h2 class="text-lg font-semibold">Notifications</h2>
        <button type="button" id="drawerCloseBtn" class="text-slate-500 hover:text-slate-800 dark:text-white/70 dark:hover:text-white">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </div>
      <div class="flex flex-col gap-3 text-sm">
        <div class="rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 p-3">
          <p class="text-slate-900 dark:text-white"><strong class="text-slate-900 dark:text-white">Marc</strong> assigned to work on <a href="#" class="text-netnet-purple underline">Job 1234 Website Redesign</a> for Globex Corporation.</p>
          <p class="text-slate-500 dark:text-white/60 text-xs mt-1">10 minutes ago</p>
        </div>
        <div class="rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 p-3">
          <p class="text-slate-900 dark:text-white"><strong class="text-slate-900 dark:text-white">Sherri</strong> mentioned you in a chat:</p>
          <p class="text-slate-800 dark:text-white/80 italic mt-1">"Hey @Arthur, the design comps look good."</p>
          <p class="text-slate-500 dark:text-white/60 text-xs mt-1">1 hour ago</p>
        </div>
        <div class="rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 p-3">
          <p class="text-slate-900 dark:text-white"><strong class="text-slate-900 dark:text-white">Bill</strong> completed the task <strong class="text-slate-900 dark:text-white">"New Hamburger Menu"</strong> in ITK Redesign Job.</p>
          <p class="text-slate-500 dark:text-white/60 text-xs mt-1">2 hours ago</p>
        </div>
        <div class="rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 p-3">
          <p class="text-slate-900 dark:text-white">You have <span class="text-orange-500 font-semibold">3 tasks</span> that are due tomorrow. <a href="#" class="text-netnet-purple underline">View them?</a></p>
          <p class="text-slate-500 dark:text-white/60 text-xs mt-1">5 hours ago</p>
        </div>
      </div>
    </aside>
  `;
}

function renderContextPanelDrawer(sectionName = 'this section') {
  return `
    <div id="app-drawer-backdrop"></div>
    <aside id="app-drawer" class="bg-white dark:bg-slate-900 text-slate-900 dark:text-white p-5 flex flex-col gap-3 w-full max-w-md">
      <div class="flex items-center justify-between">
        <div>
          <h2 class="text-lg font-semibold">Context Panel</h2>
          <p class="text-xs text-slate-500 dark:text-white/70 mt-0.5">Additional context for ${sectionName}</p>
        </div>
        <button type="button" id="drawerCloseBtn" class="text-slate-500 hover:text-slate-800 dark:text-white/70 dark:hover:text-white">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </div>
      <div class="space-y-2 text-sm">
        <p class="text-slate-700 dark:text-white/80">This is a generic context panel placeholder. In the full product it will show related details, quick actions, and helpful links for this section.</p>
        <ul class="list-disc list-inside text-slate-600 dark:text-white/70 space-y-1">
          <li>Contextual tips and next steps</li>
          <li>Shortcuts to related records</li>
          <li>Inline actions without leaving the page</li>
        </ul>
      </div>
    </aside>
  `;
}

export function applyMainWrapperClass(hash) {
  const main = document.getElementById('app-main');
  if (!main) return;

  const h = hash || '#/app/me/tasks';

  const isComponents = h.startsWith('#/app/components');
  const isMeLists = h.startsWith('#/app/me/lists');
  const isReportsOrTable =
    h.startsWith('#/app/performance') ||
    h.startsWith('#/app/contacts') ||
    h.startsWith('#/app/net-net-bot') ||
    h.startsWith('#/app/settings') ||
    h.startsWith('#/app/profile') ||
    h.startsWith('#/app/net-net-u') ||
    h.startsWith('#/app/jobs') ||
    h.startsWith('#/app/sales') ||
    h.startsWith('#/app/quick-tasks') ||
    h.startsWith('#/app/contacts/company/') ||
    h.startsWith('#/app/contacts/person/');

  const base = (isComponents || isMeLists)
    ? 'p-4 sm:p-6 lg:p-8 pb-14 overflow-y-auto'
    : isReportsOrTable
    ? 'p-4 sm:p-6 lg:p-8 pb-14 overflow-hidden'
    : 'p-4 sm:p-6 lg:p-8 pb-14 flex items-center justify-center';

  main.className = base;
}

function wireMobileHeaderLogo() {
  const img = document.getElementById('mobile-header-logo');
  if (!img) return;
  const isDark = __isDark();
  img.src = isDark ? LOGO_ASSETS.dark.idle : LOGO_ASSETS.light.idle;
}

function wireMobileMenu() {
  const overlay = document.getElementById('mobileMenuOverlay');
  const openBtn = document.getElementById('mobileMenuBtn');
  const closeBtn = document.getElementById('mobileMenuCloseBtn');
  if (!overlay || !openBtn || !closeBtn) return;
  const links = overlay.querySelectorAll('.mobile-menu-link');
  links.forEach(link => {
    link.addEventListener('click', () => {
      const path = link.getAttribute('data-path');
      if (path) navigate(path);
      overlay.classList.remove('open');
    });
  });
  openBtn.onclick = () => overlay.classList.add('open');
  closeBtn.onclick = () => overlay.classList.remove('open');
}

function initWorkspaceSwitcher() {
  let menu = document.getElementById('workspaceSwitcherMenu');
  if (!menu) {
    menu = document.createElement('div');
    menu.id = 'workspaceSwitcherMenu';
    document.body.appendChild(menu);
  }
  menu.innerHTML = '';
  const triggerBtn = document.getElementById('workspaceSwitcherButton');
  const triggerIcon = document.getElementById('workspaceSwitcherIcon');
  const active = getActiveWorkspace();
  if (triggerIcon) triggerIcon.src = active.icon;
  document.addEventListener('click', (e) => {
    if (menu.classList.contains('open') && !menu.contains(e.target) && e.target !== triggerBtn && !triggerBtn?.contains(e.target)) {
      menu.classList.remove('open');
    }
  });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') menu.classList.remove('open'); });

  menu.innerHTML = '';
  WORKSPACES.forEach(ws => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'workspace-dial-btn';
    btn.innerHTML = `<img src="${ws.icon}" alt="${ws.name}">`;
    btn.title = ws.name;
    btn.onclick = (e) => {
        e.stopPropagation();
        setActiveWorkspace(ws.id);
        if (triggerIcon) triggerIcon.src = ws.icon;
        menu.classList.remove('open');
    };
    menu.appendChild(btn);
  });
  if (triggerBtn) {
    const activeWs = getActiveWorkspace();
    if (triggerIcon) triggerIcon.src = activeWs.icon;
    triggerBtn.onclick = (e) => {
      e.stopPropagation();
      const isOpen = menu.classList.contains('open');
      if (isOpen) {
        menu.classList.remove('open');
      } else {
        const rect = triggerBtn.getBoundingClientRect();
        menu.style.left = (rect.right + 8) + 'px'; 
        const mid = rect.top + (rect.height / 2);
        menu.style.top = (mid - 32) + 'px'; 
        menu.classList.add('open');
      }
    };
  }
}

function initMobileWorkspaceSwitcher() {
  const trigger = document.getElementById('mobileWorkspaceMenuButton');
  const icon = document.getElementById('mobileWorkspaceMenuIcon');
  const sheet = document.getElementById('mobileWorkspaceSheet');
  const panel = document.getElementById('mobileWorkspacePanel');
  const options = document.getElementById('mobileWorkspaceOptions');
  if (!trigger || !icon || !sheet || !panel || !options) return;

  const applyIcon = () => {
    const ws = getActiveWorkspace();
    icon.src = ws.icon; icon.alt = ws.name;
  };

  const closeSheet = () => {
    sheet.style.opacity = '0';
    panel.style.transform = 'translateY(100%)';
    setTimeout(() => sheet.classList.add('pointer-events-none'), 200);
  };

  const openSheet = () => {
    sheet.classList.remove('pointer-events-none');
    sheet.style.opacity = '1';
    panel.style.transform = 'translateY(0%)';
  };

  options.innerHTML = WORKSPACES.map(ws => `
    <button type="button" class="mobile-workspace-option flex flex-col items-center gap-1 group" data-workspace-id="${ws.id}">
      <span class="inline-flex items-center justify-center rounded-full bg-white shadow-md transition-transform group-active:scale-95" style="width:56px;height:56px;">
        <img src="${ws.icon}" alt="${ws.name}" class="h-8 w-8"/>
      </span>
      <span class="mt-1 block text-[11px] text-slate-200">${ws.name}</span>
    </button>
  `).join('');

  options.querySelectorAll('.mobile-workspace-option').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-workspace-id');
      if (id) {
        setActiveWorkspace(id);
        applyIcon();
        const deskIcon = document.getElementById('workspaceSwitcherIcon');
        const found = WORKSPACES.find(w => w.id === id);
        if (deskIcon && found) deskIcon.src = found.icon;
      }
      closeSheet();
    });
  });

  trigger.addEventListener('click', (e) => {
    e.stopPropagation();
    openSheet();
  });
  sheet.addEventListener('click', (e) => { if (e.target === sheet) closeSheet(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeSheet(); });

  applyIcon();
}

export function wireAppShell(hash) {
  const appThemeBtn = document.getElementById('appThemeBtn');
  if (appThemeBtn) {
    appThemeBtn.removeAttribute('title');
    appThemeBtn.onclick = () => {
      const isDark = __isDark();
      const next = isDark ? 'light' : 'dark';
      setTheme(next);
      refreshDynamicIcons();
    };
  }
  const openDrawerBtn = document.getElementById('openDrawerBtn');
  if (openDrawerBtn) {
    openDrawerBtn.onclick = () => {
      const lb = document.getElementById('video-help-lightbox');
      if (lb) lb.remove();
      const drawer = document.getElementById('drawer-container');
      const shell = document.getElementById('app-shell');
      if (drawer) {
        drawer.innerHTML = renderContextPanelDrawer('This section');
      }
      if (shell) shell.classList.remove('drawer-closed');
      wireGenericDrawerClose();
    };
  }
  const cheatSheetBtn = document.getElementById('settingsCheatSheetBtn');
  if (cheatSheetBtn) {
    cheatSheetBtn.onclick = () => {
      location.hash = '#/app/components';
    };
  }
  const logoutBtn = document.getElementById('logout-btn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', (e) => {
      e.preventDefault();
      localStorage.removeItem('timerActive');
      setAuthenticated(false);
      navigate('#/auth/login');
    });
  }
  const profileBtn = document.getElementById('sidebarProfileBtn');
  if (profileBtn) {
    profileBtn.onclick = () => { location.hash = '#/app/profile'; };
  }
  const notifBtn = document.getElementById('notifBtn');
  if (notifBtn) {
    notifBtn.onclick = () => {
      const lb = document.getElementById('video-help-lightbox');
      if (lb) lb.remove();
      const shell = document.getElementById('app-shell');
      const drawer = document.getElementById('drawer-container');
      if (drawer) {
        drawer.innerHTML = renderNotificationsDrawer();
      }
      if (shell) shell.classList.remove('drawer-closed');
      wireGenericDrawerClose();
    };
  }
  wireSidebarIcons(hash); wireTopBarLogo(); wireAppTimer(); wireMobileEvents(); 
  if (hash.startsWith('#/app/net-net-bot')) {
    // chat events placeholder
  }
  initWorkspaceSwitcher(); initMobileWorkspaceSwitcher(); 
  refreshDynamicIcons();
}

function wireGenericDrawerClose() {
  const shell = document.getElementById('app-shell');
  const closeBtn = document.querySelector('#app-drawer #drawerCloseBtn, #app-drawer #sectionHelpClose, #app-drawer #notificationsClose');
  const backdrop = document.getElementById('app-drawer-backdrop');
  const cleanupVideo = () => {
    const lb = document.getElementById('video-help-lightbox');
    if (lb) lb.remove();
  };
  if (closeBtn) closeBtn.onclick = () => { shell?.classList.add('drawer-closed'); cleanupVideo(); };
  if (backdrop) backdrop.onclick = () => { shell?.classList.add('drawer-closed'); cleanupVideo(); };
}

function refreshDynamicIcons() {
  wireSidebarIcons();
  wireTopBarLogo();
  wireMobileHeaderLogo();
  const performanceIcon = document.getElementById('performanceFeaturedIcon');
  if (performanceIcon) {
    const dark = __isDark();
    const src = performanceIcon.getAttribute(dark ? 'data-dark-idle' : 'data-light-idle');
    if (src && performanceIcon.getAttribute('src') !== src) performanceIcon.setAttribute('src', src);
  }
  const ti = document.getElementById('timerIcon');
  const tb = document.getElementById('timerBtn');
  if (ti) {
    const active = !!JSON.parse(localStorage.getItem('timerActive') || 'false');
    const touch = window.matchMedia && window.matchMedia('(hover:none)').matches;
    const showActiveVisual = touch || !active; // inverted mapping
    ti.src = showActiveVisual ? TIMER_ICONS.active : TIMER_ICONS.idle;
    if (tb) tb.classList.toggle('time-icon-active', showActiveVisual);
  }
}

function wireMobileEvents() {
  const overlay = document.getElementById('mobileMenuOverlay');
  const menuBtn = document.getElementById('mobileMenuBtn');
  if (menuBtn && overlay) {
    menuBtn.addEventListener('click', () => overlay.classList.add('open'));
  }
  const closeBtn = document.getElementById('mobileMenuCloseBtn');
  if (closeBtn && overlay) {
    closeBtn.addEventListener('click', () => overlay.classList.remove('open'));
  }
  const links = overlay ? overlay.querySelectorAll('.mobile-menu-link') : [];
  links.forEach(btn => {
    btn.addEventListener('click', () => {
      const path = btn.getAttribute('data-path');
      if (path) navigate(path);
      overlay.classList.remove('open');
    });
  });
  const mobileLogoutBtn = document.getElementById('mobileLogoutBtn');
  if (mobileLogoutBtn) {
    mobileLogoutBtn.addEventListener('click', () => {
      localStorage.removeItem('timerActive');
      setAuthenticated(false);
      navigate('#/auth/login');
      if (overlay) overlay.classList.remove('open');
    });
  }
  const themeToggle = document.getElementById('mobileThemeToggle');
  if (themeToggle) {
    const knob = themeToggle.querySelector('span');
    const applyMobileThemeUI = () => {
      const dark = __isDark();
      if (knob) {
        knob.classList.toggle('translate-x-1', !dark);
        knob.classList.toggle('dark:translate-x-6', dark);
        knob.classList.toggle('translate-x-6', dark);
      }
    };
    applyMobileThemeUI();
    themeToggle.onclick = () => {
      const next = __isDark() ? 'light' : 'dark';
      setTheme(next);
      refreshDynamicIcons();
      applyMobileThemeUI();
    };
  }
  const drawerCloseBtn = document.getElementById('drawerCloseBtn');
  const appShell = document.getElementById('app-shell');
  const backdrop = document.getElementById('app-drawer-backdrop');
  const drawerPanel = document.getElementById('app-drawer');
  const closeDrawer = () => {
    if (appShell) appShell.classList.add('drawer-closed');
  };
  if (drawerCloseBtn) drawerCloseBtn.onclick = closeDrawer;
  if (backdrop) backdrop.onclick = closeDrawer;
}

export function mountShell(hash) {
  const root = document.getElementById('app-root') || document.body;
  root.innerHTML = renderAppShell(hash);
  const drawer = document.getElementById('drawer-container');
  if (drawer) drawer.innerHTML = renderNotificationsDrawer();
  initWorkspaceTabs();
  renderWorkspaceTabs();
  wireAppShell(hash);
}
