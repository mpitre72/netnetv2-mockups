import { ICONS } from '../app-shell/app-constants.js';
import { __isDark } from '../app-shell/app-helpers.js';
import { openNetNetPanel } from '../ai/netnet-panel.js';

const CHAT_STATE = {
  messages: [],
};

const NETNET_MENTION_RE = /(^|\\s)@netnet\\b/i;
const WRITE_INTENT_PATTERNS = [
  /\\bcreate\\b/i,
  /\\badd\\b/i,
  /\\blog\\s+time\\b/i,
  /\\bstart\\s+timer\\b/i,
  /\\bstart\\s+timing\\b/i,
  /\\bstop\\s+timer\\b/i,
  /\\bpause\\s+timer\\b/i,
  /\\bswitch\\s+timer\\b/i,
  /\\bassign\\b/i,
  /\\bdue\\b/i,
  /\\bschedule\\b/i,
  /\\bupdate\\b/i,
  /\\bdelete\\b/i,
];

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function getChatIconSrc(active) {
  const dark = __isDark();
  const set = ICONS.chat;
  return dark ? (active ? set.dark.active : set.dark.idle) : (active ? set.light.active : set.light.idle);
}

function getNetNetIconSrc(active) {
  const dark = __isDark();
  const set = ICONS.bot;
  return dark ? (active ? set.dark.active : set.dark.idle) : (active ? set.light.active : set.light.idle);
}

function isWriteIntent(text) {
  return WRITE_INTENT_PATTERNS.some((pattern) => pattern.test(text));
}

function renderMessageHtml(message) {
  const safeText = escapeHtml(message.text).replace(/\\n/g, '<br>');
  if (message.role === 'user') {
    return `
      <div class="flex justify-end">
        <div class="max-w-[80%] bg-netnet-purple text-white text-sm rounded-2xl rounded-br-none p-3 shadow-sm">
          ${safeText}
        </div>
      </div>
    `;
  }
  const iconSrc = getNetNetIconSrc(true);
  const reviewPrompt = message.prompt ? encodeURIComponent(message.prompt) : '';
  return `
    <div class="flex gap-3 items-start">
      <div class="w-8 h-8 rounded-full bg-netnet-purple/10 flex items-center justify-center shrink-0">
        <img src="${iconSrc}" class="w-4 h-4 object-contain" alt="" aria-hidden="true" />
      </div>
      <div class="flex flex-col gap-1 max-w-[80%]">
        <span class="text-xs font-semibold text-slate-500 dark:text-slate-300">Net Net</span>
        <div class="bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-100 text-sm rounded-2xl rounded-tl-none p-3 shadow-sm">
          ${safeText}
        </div>
        ${message.showReview ? `
          <button type="button" class="mt-1 inline-flex w-fit items-center gap-2 text-xs font-semibold text-netnet-purple dark:text-white hover:underline" data-review-prompt="${reviewPrompt}" aria-label="Review in panel">
            Review in panel
          </button>
        ` : ''}
      </div>
    </div>
  `;
}

function renderEmptyState() {
  return `
    <div id="chat-empty-state" class="text-center text-sm text-slate-500 dark:text-slate-300">
      Start a conversation or mention <span class="font-semibold text-slate-700 dark:text-white">@netnet</span> for help.
    </div>
  `;
}

export function renderChatPage(container = document.getElementById('app-main')) {
  if (!container) {
    console.warn('[ChatModule] container not found for renderChatPage.');
    return;
  }

  container.innerHTML = `
    <section class="flex flex-col h-full w-full max-w-3xl mx-auto">
      <div class="flex flex-col h-full w-full rounded-2xl border border-black/10 dark:border-white/10 bg-white/90 dark:bg-slate-900/70 shadow-xl overflow-hidden">
        <div class="flex items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-white/10 bg-white/80 dark:bg-slate-900/60">
          <div class="flex items-center gap-3">
            <div class="w-9 h-9 rounded-full bg-white dark:bg-slate-800 shadow-inner border border-slate-200 dark:border-white/10 flex items-center justify-center">
              <img id="chatFeaturedIcon" alt="Chat" class="h-4 w-4 select-none pointer-events-none">
            </div>
            <div class="flex flex-col">
              <span class="text-sm font-semibold text-slate-900 dark:text-white">Chat</span>
              <span class="text-xs text-slate-500 dark:text-slate-300">Team thread</span>
            </div>
          </div>
          <span class="text-xs text-slate-500 dark:text-slate-300">Tip: @netnet</span>
        </div>
        <div id="chat-thread" class="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50 dark:bg-[#0B1120]">
          ${CHAT_STATE.messages.length ? CHAT_STATE.messages.map(renderMessageHtml).join('') : renderEmptyState()}
        </div>
        <div class="p-4 border-t border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900">
          <div class="flex items-end gap-2 bg-slate-100 dark:bg-slate-800 rounded-2xl px-3 py-2">
            <textarea id="chat-input" rows="1" class="flex-1 bg-transparent border-none focus:ring-0 focus:outline-none text-slate-900 dark:text-white placeholder-slate-500 text-sm leading-5 resize-none max-h-[180px] overflow-y-auto min-h-[44px]" placeholder="Write a message..."></textarea>
            <button id="chat-send-btn" disabled class="p-2 bg-slate-300 dark:bg-slate-700 text-white rounded-full disabled:opacity-50 enabled:bg-netnet-purple transition-colors h-9 w-9 flex items-center justify-center" aria-label="Send message">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="19" x2="12" y2="5"/><polyline points="5 12 12 5 19 12"/></svg>
            </button>
          </div>
        </div>
      </div>
    </section>
  `;

  const icon = container.querySelector('#chatFeaturedIcon');
  if (icon) icon.src = getChatIconSrc(false);

  const input = container.querySelector('#chat-input');
  const sendBtn = container.querySelector('#chat-send-btn');
  const msgList = container.querySelector('#chat-thread');

  const MIN_INPUT_HEIGHT = 44;
  const autoResize = () => {
    if (!input) return;
    input.style.height = 'auto';
    const nextHeight = Math.max(input.scrollHeight, MIN_INPUT_HEIGHT);
    input.style.height = `${nextHeight}px`;
  };
  const updateSendState = () => {
    if (!sendBtn || !input) return;
    sendBtn.disabled = input.value.trim().length === 0;
    autoResize();
  };

  const appendMessage = (message) => {
    if (!msgList) return;
    CHAT_STATE.messages.push(message);
    const empty = msgList.querySelector('#chat-empty-state');
    if (empty) empty.remove();
    msgList.insertAdjacentHTML('beforeend', renderMessageHtml(message));
    msgList.scrollTop = msgList.scrollHeight;
  };

  const send = () => {
    if (!input || !sendBtn) return;
    const text = input.value.trim();
    if (!text) return;
    appendMessage({ role: 'user', text });
    input.value = '';
    updateSendState();
    if (NETNET_MENTION_RE.test(text)) {
      const writeIntent = isWriteIntent(text);
      appendMessage({
        role: 'netnet',
        text: writeIntent ? 'I can help. Review this in the panel.' : 'Here is a quick answer. Open the panel if you want to go deeper.',
        showReview: writeIntent,
        prompt: text,
      });
    }
  };

  if (input) {
    input.addEventListener('input', updateSendState);
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        if (!sendBtn?.disabled) send();
      }
    });
    autoResize();
  }
  if (sendBtn) sendBtn.addEventListener('click', send);
  if (msgList) {
    msgList.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-review-prompt]');
      if (!btn) return;
      const prompt = decodeURIComponent(btn.getAttribute('data-review-prompt') || '');
      if (prompt) {
        openNetNetPanel({ prefillPrompt: prompt, focusInput: true });
      } else {
        openNetNetPanel({ focusInput: true });
      }
    });
  }
  updateSendState();
}
