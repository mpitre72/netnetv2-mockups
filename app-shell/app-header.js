import { LOGO_ASSETS, TIMER_ICONS } from './app-constants.js';

const DEFAULT_TIME_VISUAL_STATE = {
  hasWorkingSet: false,
  hasActiveTimer: false,
  expanded: false,
  disabled: false,
  activeTimerBarVisible: false,
  activeTimerLabel: '',
  activeTimerDuration: '',
  activeTimerStateLabel: '',
  activeTimerPaused: false,
  activeTimerConfirming: false,
  activeTimerCanToggle: false,
};

let currentTimeVisualState = { ...DEFAULT_TIME_VISUAL_STATE };

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
      <div class="flex flex-shrink-0 items-center h-full gap-2.5 pr-3 justify-end" style="min-width: var(--sidebar-width);">
        <button id="timerBtn" type="button" aria-label="Open time tracking" aria-haspopup="region" aria-expanded="false" aria-controls="global-time-bar" class="time-icon-button relative inline-flex items-center justify-center h-9 w-9">
          <img id="timerIcon" alt="Timer" class="h-5 w-5 select-none pointer-events-none" />
          <span class="time-icon-dot" aria-hidden="true"></span>
          <span class="flyout-label">Time</span>
        </button>
        <div id="topBarTimerPill" class="topbar-active-timer" role="group" aria-label="Active timer controls" tabindex="-1" hidden>
          <div class="topbar-active-timer__meta">
            <span id="topBarTimerPillTitle" class="topbar-active-timer__title"></span>
            <span id="topBarTimerPillState" class="topbar-active-timer__state"></span>
          </div>
          <div class="topbar-active-timer__controls">
            <button id="topBarTimerToggleBtn" type="button" class="topbar-active-timer__action" aria-label="Pause active timer" title="Pause timer">
              <svg id="topBarTimerToggleIcon" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M8 5h3v14H8zM13 5h3v14h-3z"></path>
              </svg>
            </button>
            <button id="topBarTimerStopBtn" type="button" class="topbar-active-timer__action" aria-label="Stop active timer" title="Stop timer">
              <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <rect x="7" y="7" width="10" height="10" rx="2"></rect>
              </svg>
            </button>
          </div>
        </div>
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

function applyTimerVisualState(state) {
  const button = document.getElementById('timerBtn');
  const img = document.getElementById('timerIcon');
  const mImg = document.getElementById('mobileTimerIcon');
  const timerPill = document.getElementById('topBarTimerPill');
  const timerPillTitle = document.getElementById('topBarTimerPillTitle');
  const timerPillState = document.getElementById('topBarTimerPillState');
  const timerToggleButton = document.getElementById('topBarTimerToggleBtn');
  const timerToggleIcon = document.getElementById('topBarTimerToggleIcon');
  const merged = {
    ...DEFAULT_TIME_VISUAL_STATE,
    ...state,
  };
  const showActiveIcon = !!(merged.hasWorkingSet || merged.hasActiveTimer || merged.expanded);
  const desktopIcon = showActiveIcon ? TIMER_ICONS.active : TIMER_ICONS.idle;

  if (img && img.getAttribute('src') !== desktopIcon) img.setAttribute('src', desktopIcon);
  if (mImg && mImg.getAttribute('src') !== TIMER_ICONS.active) mImg.setAttribute('src', TIMER_ICONS.active);
  if (button) {
    button.classList.toggle('time-icon-working-set', !!merged.hasWorkingSet);
    button.classList.toggle('time-icon-active', !!merged.hasActiveTimer);
    button.classList.toggle('time-icon-expanded', !!merged.expanded);
    button.classList.toggle('time-icon-disabled', !!merged.disabled);
    button.disabled = !!merged.disabled;
    button.setAttribute('aria-expanded', merged.expanded ? 'true' : 'false');
  }

  if (timerPill) {
    timerPill.hidden = !merged.activeTimerBarVisible;
    timerPill.classList.toggle('is-paused', !!merged.activeTimerPaused);
    timerPill.classList.toggle('is-confirming', !!merged.activeTimerConfirming);
    timerPill.tabIndex = merged.activeTimerBarVisible ? 0 : -1;
  }
  if (timerPillTitle) {
    timerPillTitle.textContent = merged.activeTimerLabel || '';
  }
  if (timerPillState) {
    timerPillState.textContent = merged.activeTimerBarVisible
      ? `${merged.activeTimerStateLabel || (merged.activeTimerPaused ? 'Paused' : 'Running')} • ${merged.activeTimerDuration || '00:00'}`
      : '';
  }
  if (timerToggleButton) {
    const nextLabel = merged.activeTimerPaused ? 'Resume timer' : 'Pause timer';
    timerToggleButton.setAttribute('aria-label', nextLabel);
    timerToggleButton.setAttribute('title', nextLabel);
    timerToggleButton.hidden = !merged.activeTimerCanToggle;
    timerToggleButton.disabled = !merged.activeTimerCanToggle;
  }
  if (timerToggleIcon) {
    timerToggleIcon.innerHTML = merged.activeTimerPaused
      ? '<path d="M8 6.5v11l9-5.5-9-5.5z"></path>'
      : '<path d="M8 5h3v14H8zM13 5h3v14h-3z"></path>';
  }
}

export function setTopBarTimeVisualState(state = {}) {
  currentTimeVisualState = {
    ...DEFAULT_TIME_VISUAL_STATE,
    ...currentTimeVisualState,
    ...state,
  };
  applyTimerVisualState(currentTimeVisualState);
  return { ...currentTimeVisualState };
}

export function wireAppTimer() {
  applyTimerVisualState(currentTimeVisualState);
}

export function updateTimerVisuals(isRunning = null) {
  const nextRunning = isRunning === null
    ? !!currentTimeVisualState.hasActiveTimer
    : !!isRunning;
  setTopBarTimeVisualState({
    hasWorkingSet: nextRunning || currentTimeVisualState.hasWorkingSet,
    hasActiveTimer: nextRunning,
    expanded: currentTimeVisualState.expanded,
    disabled: currentTimeVisualState.disabled,
  });
  return nextRunning;
}
