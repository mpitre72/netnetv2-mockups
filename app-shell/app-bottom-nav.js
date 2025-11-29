export function renderMobileBottomNav() {
  const meIcon = 'https://hellonetnet.com/wp-content/uploads/2025/11/Me-Active-white.svg';
  const timeIcon = 'https://hellonetnet.com/wp-content/uploads/2025/11/Time-Active-white.svg';
  const chatIcon = 'https://hellonetnet.com/wp-content/uploads/2025/11/Chat-Active-white.svg';
  return `
    <div id="mobileBottomNav" class="mobile-bottom-nav md:hidden">
      <button onclick="navigate('#/app/me')" class="flex items-center justify-center w-12 h-12 rounded-full active:bg-white/10">
        <img src="${meIcon}" alt="Me" class="w-7 h-7" />
      </button>
      <button onclick="navigate('#/app/net-net-bot')" class="flex items-center justify-center w-12 h-12 rounded-full active:bg-white/10">
        <img src="https://hellonetnet.com/wp-content/uploads/2025/11/AI-Active-white.svg" alt="Net Net Bot" class="w-7 h-7" />
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
