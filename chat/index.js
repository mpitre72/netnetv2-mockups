import { ICONS } from '../app-shell/app-constants.js';
import { __isDark } from '../app-shell/app-helpers.js';

function getChatIconSrc(active) {
  const dark = __isDark();
  const set = ICONS.chat;
  return dark ? (active ? set.dark.active : set.dark.idle) : (active ? set.light.active : set.light.idle);
}

function chatIconPaint(active) {
  const el = document.getElementById('chatFeaturedIcon');
  if (!el) return;
  const src = getChatIconSrc(active);
  if (el.getAttribute('src') !== src) el.setAttribute('src', src);
}
function chatIconSwap(hover) { chatIconPaint(!!hover); }

export function renderChatPage(container = document.getElementById('app-main')) {
  if (!container) {
    console.warn('[ChatModule] container not found for renderChatPage.');
    return;
  }
  container.innerHTML = `
    <section class="relative mx-auto max-w-2xl">
      <div class="mx-auto w-full rounded-2xl border bg-white/90 dark:bg-slate-800/90 backdrop-blur-sm shadow-xl border-black/10 dark:border-white/10 px-6 py-8 md:px-8 md:py-10 text-center">
        <button type="button" class="me-featured-icon mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full ring-1 ring-black/10 dark:ring-white/10 bg-white dark:bg-slate-700 shadow-inner" aria-label="Chat icon" onmouseenter="chatIconSwap(true)" onmouseleave="chatIconSwap(false)" onclick="chatIconSwap(true)">
          <img id="chatFeaturedIcon" alt="Chat" class="h-7 w-7 select-none pointer-events-none">
        </button>
        <h2 class="text-xl md:text-2xl font-semibold text-slate-900 dark:text-white">No conversations yet</h2>
        <p class="mt-2 text-sm md:text-base text-slate-600 dark:text-slate-300">Start a new conversation with your team</p>
        <div class="mt-6 flex items-center justify-center gap-3">
          <button type="button" class="inline-flex h-10 items-center justify-center rounded-md px-4 text-sm font-semibold text-white transition-colors" style="background:#711FFF;" onmouseover="this.style.background='#6020df';" onmouseout="this.style.background='#711FFF';">Start a Conversation</button>
        </div>
      </div>
    </section>
  `;
  chatIconPaint(false);
}

if (typeof window !== 'undefined') {
  window.chatIconSwap = chatIconSwap;
  window.chatIconPaint = chatIconPaint;
}
