import { APP_ICONS, LOGO_ASSETS, TIMER_ICONS } from './app-constants.js';

export function renderTopBar() {
  return `
    <header id="app-top-bar" class="hidden md:flex bg-netnet-purple items-center justify-between px-4">
      <a href="#/app/me" id="top-bar-logo-link" class="flex-shrink-0">
        <img src="${LOGO_ASSETS.dark.idle}" id="top-bar-logo-img" alt="Net Net" class="h-[30px] w-auto ml-3" />
      </a>
      <div id="workspaceTabs" class="hidden lg:flex items-end gap-2 ml-10 overflow-x-auto scrollbar-none self-stretch h-full"></div>
      <div class="ml-auto flex items-center gap-4 pr-3">
        <button id="timerBtn" class="relative inline-flex items-center justify-center h-9 w-9 rounded-full hover:bg-white/15 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-transparent focus:ring-white/40">
          <img id="timerIcon" alt="Timer" class="h-5 w-5 select-none pointer-events-none" />
          <span class="flyout-label bg-gray-800 text-white dark:bg-gray-100 dark:text-black">Time</span>
        </button>
        <span class="h-5 w-px bg-white/25"></span>
        <button id="helpBtn" class="relative flex items-center justify-center h-9 w-9 rounded-full text-white/90 hover:text-white hover:bg-white/15" aria-label="Help">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 1 1 5.82 1c0 2-3 2-3 4"/><line x1="12" y1="17" x2="12" y2="17"/></svg>
          <span class="flyout-label bg-gray-800 text-white dark:bg-gray-100 dark:text-black">Get Help</span>
        </button>
        <button id="notifBtn" class="relative flex items-center justify-center h-9 w-9 rounded-full text-white/90 hover:text-white hover:bg-white/15" aria-label="Notifications">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M18 8a6 6 0 10-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 01-3.46 0"/></svg>
          <span class="flyout-label bg-gray-800 text-white dark:bg-gray-100 dark:text-black">Notifications</span>
        </button>
        <button id="appThemeBtn" type="button" class="flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm border-white/25 text-white/90 hover:bg-white/15 hover:text-white">
          <span class="inline-flex items-center dark:hidden"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="4"></circle><path d="M12 1v3M12 20v3M4.22 4.22l2.12 2.12M17.66 17.66l2.12 2.12M1 12h3M20 12h3M4.22 19.78l2.12-2.12M17.66 6.34l2.12-2.12"/></svg><span class="ml-1.5">Light</span></span>
          <span class="hidden dark:inline-flex items-center"><svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg><span class="ml-1.5">Dark</span></span>
        </button>
      </div>
    </header>
  `;
}

export function wireTopBarLogo() {
  const img = document.getElementById('top-bar-logo-img');
  if (img) img.src = LOGO_ASSETS.dark.idle;
  const link = document.getElementById('top-bar-logo-link');
  if (link) { link.onmouseenter = null; link.onmouseleave = null; }
}

export function wireAppTimer() {
  const button = document.getElementById('timerBtn');
  const img = document.getElementById('timerIcon');
  const mButton = document.getElementById('mobileTimerBtn');
  const mImg = document.getElementById('mobileTimerIcon');
  const key = 'timerActive';
  let running = !!(JSON.parse(localStorage.getItem(key)));
  const touch = window.matchMedia && window.matchMedia('(hover:none)').matches;
  function paint(active) {
    const useActive = touch ? true : !!active;
    const url = useActive ? TIMER_ICONS.active : TIMER_ICONS.idle;
    if (img && img.getAttribute('src') !== url) img.setAttribute('src', url);
    if (mImg) mImg.setAttribute('src', TIMER_ICONS.active);
  }
  paint(running);
  const toggle = () => {
    running = !running;
    localStorage.setItem(key, JSON.stringify(running));
    paint(running);
  };
  if (button) {
    if (!touch) {
      button.onmouseenter = () => paint(true);
      button.onmouseleave = () => paint(running);
    } else {
      button.onmouseenter = button.onmouseleave = null;
    }
    button.onclick = toggle;
  }
  if (mButton) { mButton.onclick = toggle; }
}
