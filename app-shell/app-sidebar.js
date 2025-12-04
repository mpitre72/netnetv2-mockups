import { APP_ICONS, ICONS, SIDEBAR_LINKS } from './app-constants.js';
import { __isDark, __isMeActive, __norm, __paint } from './app-helpers.js';

export function renderSidebar(hash) {
  return `
    <aside id="app-sidebar" class="hidden md:flex bg-[#0F172A] dark:bg-[#0F172A] flex-col justify-between p-2 overflow-hidden">
      <div class="flex-1 overflow-y-auto pr-1">
        <nav class="space-y-2">
          ${SIDEBAR_LINKS.map(item => {
            const iconSet = ICONS[item.key];
            if (!iconSet) return '';
            const imgClass = item.key === 'me' ? 'h-5 w-5' : 'h-6 w-6';
            const isActive = item.path === hash || (item.key === 'me' && hash.startsWith('#/app/me'));
            const subMenu = (item.subs && isActive) ? `
            <div class="mt-1 ml-4 flex flex-col gap-1 text-sm text-slate-600 dark:text-slate-300">
              ${item.subs.map(sub => `<a href="${sub.path}" class="flex items-center gap-2 hover:text-slate-900 dark:hover:text-white p-1 pl-2 rounded transition-colors ${hash.startsWith(sub.path) ? 'text-netnet-purple font-medium dark:text-white' : ''}"><span>${sub.name}</span></a>`).join('')}
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
        <nav class="space-y-2 mt-4">
          <a href="#/app/settings" class="relative flex items-center justify-center lg:justify-start lg:px-4 h-12 w-12 lg:w-auto rounded-lg text-gray-600 dark:text-slate-200 hover:bg-gray-200 dark:hover:bg-gray-800">
            <span class="flex-shrink-0">${APP_ICONS.settings}</span>
            <span class="flyout-label lg:ml-3 bg-gray-800 text-white dark:bg-gray-100 dark:text-black lg:bg-transparent lg:text-gray-700 lg:dark:text-gray-200 lg:static lg:opacity-100 lg:transform-none lg:p-0 lg:pointer-events-auto">Settings</span>
          </a>
        </nav>
      </div>
      <div class="mt-4 flex flex-col gap-2">
        <div class="user-profile-bar flex items-center gap-3 rounded-lg px-3 py-2 bg-slate-900/80 border border-slate-700">
          <div class="h-8 w-8 rounded-full bg-slate-700 flex items-center justify-center text-slate-200 text-sm font-semibold">
            MP
          </div>
          <div class="flex flex-col">
            <span class="text-sm font-semibold text-slate-100">Marc Pitre</span>
            <span class="text-xs text-slate-400">Owner</span>
          </div>
        </div>
        <button id="workspaceSwitcherButton" type="button" class="relative flex items-center justify-center lg:justify-start lg:px-4 h-12 w-12 lg:w-auto rounded-lg text-gray-600 dark:text-slate-200 hover:bg-gray-200 dark:hover:bg-gray-800 w-full transition-colors">
          <img id="workspaceSwitcherIcon" src="" alt="Workspace" class="h-6 w-6 flex-shrink-0 rounded-full object-contain"/>
          <span class="flyout-label lg:ml-3 bg-gray-800 text-white dark:bg-gray-100 dark:text-black lg:bg-transparent lg:text-gray-700 lg:dark:text-gray-200 lg:static lg:opacity-100 lg:transform-none lg:p-0 lg:pointer-events-auto">Workspace</span>
        </button>
        <a href="#/auth/login" id="logout-btn" class="relative flex items-center justify-center lg:justify-start lg:px-4 h-12 w-12 lg:w-auto rounded-lg text-gray-600 dark:text-slate-200 hover:bg-gray-200 dark:hover:bg-gray-800">
          <span class="flex-shrink-0">${APP_ICONS.logout}</span>
          <span class="flyout-label lg:ml-3 bg-gray-800 text-white dark:bg-gray-100 dark:text-black lg:bg-transparent lg:text-gray-700 lg:dark:text-gray-200 lg:static lg:opacity-100 lg:transform-none lg:p-0 lg:pointer-events-auto">Log out</span>
        </a>
      </div>
    </aside>
  `;
}

export function wireSidebarIcons() {
  const canHover = matchMedia && matchMedia('(hover:hover)').matches;
  const hash = __norm(location.hash || '#/app');
  document.querySelectorAll('nav a[href^="#/app"]').forEach(a => {
    const img = a.querySelector('img[data-icon]');
    if (!img) return;
    const href  = __norm(a.getAttribute('href') || '');
    const key   = (img.getAttribute('data-icon') || '').toLowerCase().trim();
    const isActive = (key === 'me') ? __isMeActive(hash) : (hash === href || hash.startsWith(href + '/'));
    __paint(img, isActive);
    a.onmouseenter = a.onmouseleave = a.onfocus = a.onblur = null;
    if (canHover) {
      a.onmouseenter = () => __paint(img, true);
      a.onmouseleave = () => {
        const now = __norm(location.hash || '#/app');
        const activeNow = (key === 'me') ? __isMeActive(now) : (now === href || now.startsWith(href + '/'));
        __paint(img, activeNow);
      };
      a.onfocus = a.onmouseenter;
      a.onblur  = a.onmouseleave;
    }
  });
}
