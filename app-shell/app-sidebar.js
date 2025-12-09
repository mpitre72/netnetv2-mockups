import { APP_ICONS, ICONS, SIDEBAR_LINKS } from './app-constants.js';
import { __norm, __paint } from './app-helpers.js';

function isSectionActive(hash, item) {
  const normalizedHash = __norm(hash || '#/app');
  const base = __norm(item?.basePath || item?.path || '');
  if (!base) return false;
  return normalizedHash.startsWith(base);
}

export function renderSidebar(hash) {
  const order = ['me', 'bot', 'contacts', 'sales', 'jobs', 'quick', 'chat', 'reports', 'nnu'];
  const orderedLinks = order
    .map(key => SIDEBAR_LINKS.find(item => item.key === key))
    .filter(Boolean);
  return `
    <aside id="app-sidebar" class="hidden md:flex bg-[#0F172A] dark:bg-[#0F172A] flex-col justify-between p-2 overflow-hidden">
      <div class="flex-1 flex flex-col overflow-hidden">
        <nav id="sidebar-sections" class="space-y-2 overflow-y-auto pr-1">
          ${orderedLinks.map(item => {
            const iconSet = ICONS[item.key];
            if (!iconSet) return '';
            const imgClass = item.key === 'me' ? 'h-5 w-5' : 'h-6 w-6';
            const active = isSectionActive(hash, item);
            const subMenu = (item.subs && active) ? `
            <div class="mt-1 ml-4 flex flex-col gap-1 text-sm text-slate-600 dark:text-slate-300">
              ${item.subs.map(sub => {
                const subActive = __norm(hash || '#/app').startsWith(__norm(sub.path || ''));
                const subClasses = [
                  'block rounded px-2 py-1 hover:bg-slate-800/60 hover:text-white',
                  subActive ? 'text-white bg-slate-800/60' : '',
                ].join(' ');
                return `<a href="${sub.path}" class="${subClasses}"><span>${sub.name}</span></a>`;
              }).join('')}
            </div>` : '';
            return `
            <div class="flex flex-col">
              <a href="${item.path}" class="relative flex items-center justify-center lg:justify-start lg:px-4 h-12 w-12 lg:w-auto rounded-lg hover:bg-gray-200 dark:hover:bg-gray-800 transition-colors text-gray-600 dark:text-slate-200" aria-label="${item.name}">
                <img data-icon="${item.key}" alt="${item.name}" class="${imgClass} flex-shrink-0" data-light-idle="${iconSet.light.idle}" data-light-active="${iconSet.light.active}" data-dark-idle="${iconSet.dark.idle}" data-dark-active="${iconSet.dark.active}"/>
                <span class="flyout-label lg:ml-3 bg-gray-800 text-white dark:bg-gray-100 dark:text-black lg:bg-transparent lg:text-gray-700 lg:dark:text-gray-200 lg:static lg:opacity-100 lg:transform-none lg:p-0 lg:pointer-events-auto">${item.name}</span>
              </a>${subMenu}
            </div>`;
          }).join('')}
        </nav>
      </div>
      <div id="sidebar-functions" class="mt-4 flex flex-col gap-2">
        <a href="#/app/settings" class="relative flex items-center justify-center lg:justify-start lg:px-4 h-12 w-12 lg:w-auto rounded-lg text-gray-600 dark:text-slate-200 hover:bg-gray-200 dark:hover:bg-gray-800">
          <span class="flex-shrink-0">${APP_ICONS.settings}</span>
          <span class="flyout-label lg:ml-3 bg-gray-800 text-white dark:bg-gray-100 dark:text-black lg:bg-transparent lg:text-gray-700 lg:dark:text-gray-200 lg:static lg:opacity-100 lg:transform-none lg:p-0 lg:pointer-events-auto">Settings</span>
        </a>
        <button id="workspaceSwitcherButton" type="button" class="relative flex items-center justify-center lg:justify-start lg:px-4 h-12 w-12 lg:w-auto rounded-lg text-gray-600 dark:text-slate-200 hover:bg-gray-200 dark:hover:bg-gray-800 w-full transition-colors">
          <img id="workspaceSwitcherIcon" src="" alt="Workspace" class="h-6 w-6 flex-shrink-0 rounded-full object-contain"/>
          <span class="flyout-label lg:ml-3 bg-gray-800 text-white dark:bg-gray-100 dark:text-black lg:bg-transparent lg:text-gray-700 lg:dark:text-gray-200 lg:static lg:opacity-100 lg:transform-none lg:p-0 lg:pointer-events-auto">Workspace</span>
        </button>
        <a href="#/auth/login" id="logout-btn" class="relative flex items-center justify-center lg:justify-start lg:px-4 h-12 w-12 lg:w-auto rounded-lg text-gray-600 dark:text-slate-200 hover:bg-gray-200 dark:hover:bg-gray-800">
          <span class="flex-shrink-0">${APP_ICONS.logout}</span>
          <span class="flyout-label lg:ml-3 bg-gray-800 text-white dark:bg-gray-100 dark:text-black lg:bg-transparent lg:text-gray-700 lg:dark:text-gray-200 lg:static lg:opacity-100 lg:transform-none lg:p-0 lg:pointer-events-auto">Log out</span>
        </a>
        <button
          type="button"
          id="sidebarProfileBtn"
          class="user-profile-bar flex items-center gap-3 rounded-lg px-3 py-2 bg-slate-900/80 border border-slate-700 hover:bg-slate-800 hover:border-slate-500 text-left w-full"
        >
          <div class="h-8 w-8 rounded-full bg-slate-700 flex items-center justify-center text-slate-200 text-sm font-semibold">MP</div>
          <div class="flex flex-col">
            <span class="text-sm font-semibold text-slate-100">Marc Pitre</span>
            <span class="text-xs text-slate-400">Owner</span>
          </div>
        </button>
      </div>
    </aside>
  `;
}

export function wireSidebarIcons() {
  const canHover = matchMedia && matchMedia('(hover:hover)').matches;
  const hash = __norm(location.hash || '#/app');
  const linkMap = Object.fromEntries(SIDEBAR_LINKS.map(item => [item.key, item]));
  document.querySelectorAll('nav a[href^="#/app"]').forEach(a => {
    const img = a.querySelector('img[data-icon]');
    if (!img) return;
    const href  = __norm(a.getAttribute('href') || '');
    const key   = (img.getAttribute('data-icon') || '').toLowerCase().trim();
    const item = linkMap[key];
    const isActive = item ? isSectionActive(hash, item) : (hash === href || hash.startsWith(href + '/'));
    __paint(img, isActive);
    a.onmouseenter = a.onmouseleave = a.onfocus = a.onblur = null;
    if (canHover) {
      a.onmouseenter = () => __paint(img, true);
      a.onmouseleave = () => {
        const now = __norm(location.hash || '#/app');
        const activeNow = item ? isSectionActive(now, item) : (now === href || now.startsWith(href + '/'));
        __paint(img, activeNow);
      };
      a.onfocus = a.onmouseenter;
      a.onblur  = a.onmouseleave;
    }
  });
}
