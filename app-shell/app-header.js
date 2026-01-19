import { APP_ICONS, LOGO_ASSETS, TIMER_ICONS } from './app-constants.js';

export function renderTopBar() {
  return `
    <header id="app-top-bar" class="hidden md:flex bg-netnet-purple items-center gap-4 px-2 relative">
      <div class="flex items-center h-full flex-shrink-0" style="width: var(--sidebar-width); min-width: var(--sidebar-width);">
        <a href="#/app/me" id="top-bar-logo-link" class="flex items-center h-full px-4">
          <img src="${LOGO_ASSETS.dark.idle}" id="top-bar-logo-img" alt="Net Net" class="h-[30px] w-auto" />
        </a>
      </div>
      <div id="workspaceTabs" class="hidden lg:flex items-end gap-2 ml-10 overflow-x-auto scrollbar-none self-stretch h-full flex-1"></div>
      <div id="build-indicator-slot" class="build-indicator-slot" aria-hidden="true"></div>
      <div class="flex items-center h-full gap-3 pr-3 justify-end" style="width: var(--sidebar-width); min-width: var(--sidebar-width);">
        <button id="timerBtn" type="button" aria-label="Open time tracking" class="time-icon-button relative inline-flex items-center justify-center h-9 w-9">
          <img id="timerIcon" alt="Timer" class="h-5 w-5 select-none pointer-events-none" />
          <span class="time-icon-dot" aria-hidden="true"></span>
          <span class="flyout-label">Time</span>
        </button>
        <span class="h-5 w-px bg-white/25"></span>
        <button id="netnetBtn" class="header-icon-button header-icon-button--small relative" aria-label="Open Net Net" title="Net Net">
          <img src="public/assets/brand/nav/AI-Active-white.svg" alt="" aria-hidden="true" class="h-4 w-4 select-none pointer-events-none" />
        </button>
        <button id="helpBtn" class="header-icon-button header-icon-button--small relative" aria-label="Help and documentation">
          <svg class="header-icon-glyph-small" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M9.5 9a2.5 2.5 0 1 1 3.5 2.3c-.7.3-1 1-1 1.7V14"/><circle cx="12" cy="17" r="1"/></svg>
        </button>
        <button id="notifBtn" class="header-icon-button header-icon-button--small relative" aria-label="Notifications">
          <svg class="header-icon-glyph-small" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M18 8a6 6 0 10-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 01-3.46 0"/></svg>
        </button>
        <button id="appThemeBtn" type="button" class="header-icon-button header-icon-button--small relative" aria-label="Toggle light and dark theme">
          <span class="inline-flex items-center dark:hidden"><svg class="header-icon-glyph-small" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="4"></circle><path d="M12 1v3M12 20v3M4.22 4.22l2.12 2.12M17.66 17.66l2.12 2.12M1 12h3M20 12h3M4.22 19.78l2.12-2.12M17.66 6.34l2.12-2.12"/></svg></span>
          <span class="hidden dark:inline-flex items-center"><svg class="header-icon-glyph-small" viewBox="0 0 24 24" fill="currentColor"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg></span>
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
  let running = !!(JSON.parse(localStorage.getItem(key) || 'false'));
  const touch = window.matchMedia && window.matchMedia('(hover:none)').matches;
  const setVisualState = (isActiveVisual) => {
    const url = isActiveVisual ? TIMER_ICONS.active : TIMER_ICONS.idle;
    if (img && img.getAttribute('src') !== url) img.setAttribute('src', url);
    if (mImg) mImg.setAttribute('src', TIMER_ICONS.active); // mobile stays active visual
    if (button) {
      button.classList.toggle('time-icon-active', isActiveVisual);
    }
  };

  // Initial paint: touch devices always show active; desktop reflects running state
  setVisualState(touch || running);

  const readRunning = () => {
    try {
      return !!JSON.parse(localStorage.getItem(key) || 'false');
    } catch (e) {
      return false;
    }
  };

  const toggle = () => {
    running = !running;
    try {
      localStorage.setItem(key, JSON.stringify(running));
    } catch (e) {
      // ignore storage errors in prototype
    }
    setVisualState(touch || running);
  };
  if (button) {
    if (!touch) {
      // Hover shows active visual, leave restores to running state
      button.onmouseenter = () => setVisualState(true);
      button.onmouseleave = () => setVisualState(readRunning());
    } else {
      button.onmouseenter = button.onmouseleave = null;
    }
    button.onclick = toggle;
  }
  if (mButton) { mButton.onclick = toggle; }
}

export function updateTimerVisuals(isRunning = null) {
  const img = document.getElementById('timerIcon');
  const button = document.getElementById('timerBtn');
  const mImg = document.getElementById('mobileTimerIcon');
  const touch = window.matchMedia && window.matchMedia('(hover:none)').matches;
  let running = isRunning;
  if (running === null) {
    try {
      running = !!JSON.parse(localStorage.getItem('timerActive') || 'false');
    } catch (e) {
      running = false;
    }
  }
  const isActiveVisual = touch || running;
  const url = isActiveVisual ? TIMER_ICONS.active : TIMER_ICONS.idle;
  if (img && img.getAttribute('src') !== url) img.setAttribute('src', url);
  if (mImg) mImg.setAttribute('src', TIMER_ICONS.active);
  if (button) button.classList.toggle('time-icon-active', isActiveVisual);
  return isActiveVisual;
}
