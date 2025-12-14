export function renderMobileBottomNav() {
  const meIcon = 'public/assets/brand/nav/Me-Active-white.svg';
  const timeIcon = 'public/assets/brand/chrome/Time-Active-white.svg';
  const chatIcon = 'public/assets/brand/nav/Chat-Active-white.svg';
  // TODO: Replace with final Lists icon asset once designed
  const listsIcon = 'public/assets/brand/nav/QuickTasks-Active-white.svg';
  return `
    <div id="mobileBottomNav" class="mobile-bottom-nav hidden-desktop">
      <button onclick="navigate('#/app/me')" class="flex items-center justify-center w-12 h-12 rounded-full active:bg-white/10">
        <img src="${meIcon}" alt="Me" class="w-7 h-7" />
      </button>
      <button onclick="navigate('#/app/me/lists')" class="flex items-center justify-center w-12 h-12 rounded-full active:bg-white/10">
        <img src="${listsIcon}" alt="Lists" class="w-7 h-7" />
      </button>
      <button onclick="navigate('#/app/net-net-bot')" class="flex items-center justify-center w-12 h-12 rounded-full active:bg-white/10">
        <img src="public/assets/brand/nav/AI-Active-white.svg" alt="Net Net Bot" class="w-7 h-7" />
      </button>
      <button id="mobileTimerBtn" class="flex items-center justify-center w-12 h-12 rounded-full active:bg-white/10">
        <img id="mobileTimerIcon" src="${timeIcon}" alt="Timer" class="w-7 h-7" />
      </button>
      <button onclick="navigate('#/app/chat')" class="flex items-center justify-center w-12 h-12 rounded-full active:bg-white/10">
        <img src="${chatIcon}" alt="Chat" class="w-7 h-7" />
      </button>
      <button id="mobileMenuBtn" class="flex items-center justify-center w-12 h-12 rounded-full active:bg-white/10">
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
      </button>
    </div>
  `;
}
