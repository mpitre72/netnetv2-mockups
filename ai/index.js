import { ICONS } from '../app-shell/app-constants.js';
import { __isDark } from '../app-shell/app-helpers.js';

const CHAT_UI_ICONS = {
  clip: `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/></svg>`,
  mic: `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>`,
  send: `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="19" x2="12" y2="5"/><polyline points="5 12 12 5 19 12"/></svg>`
};

const GREETING_VARIATIONS = [
  "Great question, I’ve analyzed your request and the related data points inside of Net Net. Would you like me to give you a 90-day summary?",
  "Thanks for reaching out! I’ve reviewed your request. Would you like a summary of your data over the last 90 days?",
  "Interesting question! I've analyzed your request—do you want me to summarize the last 90 days of data for you?"
];

function getBotIconSrc(active = true) {
  const dark = __isDark();
  const set = ICONS.bot;
  return dark ? (active ? set.dark.active : set.dark.idle) : (active ? set.light.active : set.light.idle);
}

function renderBotLayout() {
  const iconSrc = getBotIconSrc(true);
  return `
    <div class="flex flex-col h-full relative bg-transparent">
      <div class="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shrink-0">
        <div class="flex items-center gap-3">
          <div class="w-8 h-8 rounded-full bg-netnet-purple/10 flex items-center justify-center"><img src="${iconSrc}" class="w-5 h-5 object-contain" /></div>
          <h2 class="font-semibold text-gray-900 dark:text-white">Net Net Bot</h2>
        </div>
        <div class="flex items-center gap-2">
          <button id="new-chat-btn" class="px-3 py-1.5 text-sm font-medium text-netnet-purple dark:text-white bg-netnet-purple/10 dark:bg-white/10 rounded-md hover:bg-netnet-purple/20 dark:hover:bg-white/20 transition-colors">+ New Chat</button>
          <button id="chat-history-btn" class="px-3 py-1.5 text-sm font-medium text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800 rounded-md transition-colors">Chat History</button>
        </div>
      </div>
      <div id="chat-messages" class="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50 dark:bg-[#0B1120]">
        <div class="flex gap-3 chat-msg-container">
          <div class="w-8 h-8 rounded-full bg-white dark:bg-gray-800 shadow-sm flex items-center justify-center shrink-0"><img src="${iconSrc}" class="w-5 h-5 object-contain"></div>
          <div class="flex flex-col gap-2 max-w-[85%]"><div class="bg-white dark:bg-gray-800 p-3 rounded-2xl rounded-tl-none shadow-sm text-gray-800 dark:text-gray-200 text-sm chat-msg-text">Hello! I can help you with tasks, time tracking, or performance insights. What's on your mind?</div></div>
        </div>
      </div>
      <div class="p-4 bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700 shrink-0">
        <div class="relative flex items-center gap-2 bg-gray-100 dark:bg-gray-800 rounded-3xl px-3 py-2.5">
          <button class="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 rounded-full transition-colors h-10 w-10 flex items-center justify-center" onclick="showToast('File upload simulated')">${CHAT_UI_ICONS.clip}</button>
          <textarea id="chat-input" rows="1" class="flex-1 bg-transparent border-none focus:ring-0 focus:outline-none text-gray-900 dark:text-white placeholder-gray-500 text-sm leading-5 resize-none py-2 max-h-[200px] overflow-y-auto min-h-[44px]" placeholder="Ask the AI Bot about tasks, time, or performance..."></textarea>
          <button class="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 rounded-full transition-colors h-10 w-10 flex items-center justify-center" onclick="showToast('Voice input simulated')">${CHAT_UI_ICONS.mic}</button>
          <button id="chat-send-btn" disabled class="p-2 bg-gray-300 dark:bg-gray-700 text-white rounded-full disabled:opacity-50 enabled:bg-netnet-purple transition-all h-10 w-10 flex items-center justify-center">${CHAT_UI_ICONS.send}</button>
        </div>
      </div>
    </div>
  `;
}

function renderBotMessage(msgList, htmlContent) {
  const iconSrc = getBotIconSrc(true);
  const botDiv = document.createElement('div');
  botDiv.className = "flex gap-3 chat-msg-container";
  botDiv.innerHTML = `
    <div class="w-8 h-8 rounded-full bg-white dark:bg-gray-800 shadow-sm flex items-center justify-center shrink-0">
      <img src="${iconSrc}" class="w-5 h-5 object-contain">
    </div>
    <div class="flex flex-col gap-2 max-w-[85%]">
      <div class="bg-white dark:bg-gray-800 p-3 rounded-2xl rounded-tl-none shadow-sm text-gray-800 dark:text-gray-200 text-sm chat-msg-text">${htmlContent}</div>
      <div class="flex items-center gap-3 px-1">
        <button class="chat-action-copy p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors" title="Copy"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg></button>
        <button class="chat-action-up p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors" title="Helpful"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"/></svg></button>
        <button class="chat-action-down p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors" title="Not Helpful"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 15v4a3 3 0 0 0 3 3l4-9V2H5.72a2 2 0 0 0-2 1.7l-1.38 9a2 2 0 0 0 2 2.3zm7-13h2.67A2.31 2.31 0 0 1 22 4v7a2.31 2.31 0 0 1-2.33 2H17"/></svg></button>
        <button class="chat-action-share p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors" title="Share"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg></button>
      </div>
    </div>
  `;
  msgList.appendChild(botDiv);
  msgList.scrollTop = msgList.scrollHeight;
}

function wireChatActions(msgList) {
  if (!msgList || msgList.hasAttribute('data-wired')) return;
  msgList.setAttribute('data-wired', 'true');
  msgList.addEventListener('click', (e) => {
    const t = e.target.closest('button');
    if (!t) return;
    if (t.classList.contains('chat-action-copy')) {
      const msgText = t.closest('.chat-msg-container').querySelector('.chat-msg-text').textContent;
      navigator.clipboard.writeText(msgText).then(() => { if (typeof showToast === 'function') showToast('Copied to clipboard'); });
    } else if (t.classList.contains('chat-action-up')) {
      if (typeof showToast === 'function') showToast('Thanks for the feedback!');
      t.classList.toggle('text-green-500');
      const down = t.parentElement.querySelector('.chat-action-down');
      if (down) down.classList.remove('text-red-500');
    } else if (t.classList.contains('chat-action-down')) {
      if (typeof showToast === 'function') showToast('Thanks for the feedback.');
      t.classList.toggle('text-red-500');
      const up = t.parentElement.querySelector('.chat-action-up');
      if (up) up.classList.remove('text-green-500');
    } else if (t.classList.contains('chat-action-share')) {
      if (typeof showToast === 'function') showToast('Share feature coming soon');
    }
  });
}

export function renderNetNetBot(container = document.getElementById('app-main')) {
  if (!container) {
    console.warn('[AIModule] container not found for renderNetNetBot.');
    return;
  }
  container.innerHTML = renderBotLayout();

  const input = container.querySelector('#chat-input');
  const btn = container.querySelector('#chat-send-btn');
  const msgList = container.querySelector('#chat-messages');
  const newChatBtn = container.querySelector('#new-chat-btn');
  const historyBtn = container.querySelector('#chat-history-btn');

  let chatStage = 0;
  let greetingIndex = 0;

  const MIN_INPUT_HEIGHT = 44;
  const autoResize = () => {
    if (!input) return;
    input.style.height = 'auto';
    const nextHeight = Math.max(input.scrollHeight, MIN_INPUT_HEIGHT);
    input.style.height = nextHeight + 'px';
  };
  const check = () => { if (!btn || !input) return; btn.disabled = input.value.trim().length === 0; autoResize(); };

  wireChatActions(msgList);

  const renderDefaultBotMsg = () => {
    const iconSrc = getBotIconSrc(true);
    msgList.innerHTML = `
      <div class="flex gap-3 chat-msg-container">
        <div class="w-8 h-8 rounded-full bg-white dark:bg-gray-800 shadow-sm flex items-center justify-center shrink-0"><img src="${iconSrc}" class="w-5 h-5 object-contain"></div>
        <div class="flex flex-col gap-2 max-w-[85%]"><div class="bg-white dark:bg-gray-800 p-3 rounded-2xl rounded-tl-none shadow-sm text-gray-800 dark:text-gray-200 text-sm chat-msg-text">Hello! I can help you with tasks, time tracking, or performance insights. What's on your mind?</div></div>
      </div>`;
    chatStage = 0;
    greetingIndex = 0;
    if (input) { input.value = ''; input.style.height = 'auto'; input.focus(); }
    check();
  };

  if (newChatBtn) {
    newChatBtn.addEventListener('click', () => {
      renderDefaultBotMsg();
      if (typeof showToast === 'function') showToast('New conversation started');
    });
  }

  if (historyBtn) {
    historyBtn.addEventListener('click', () => { if (typeof showToast === 'function') showToast('Chat history coming soon'); });
  }

  function send() {
    if (!input || !msgList) return;
    const text = input.value.trim();
    if (!text) return;
    const userDiv = document.createElement('div');
    userDiv.className = "flex gap-3 justify-end chat-msg-container";
    userDiv.innerHTML = `<div class="bg-netnet-purple p-3 rounded-2xl rounded-tr-none shadow-sm text-white text-sm max-w-[85%] break-words chat-msg-text">${text.replace(/\n/g, '<br>')}</div>`;
    msgList.appendChild(userDiv);
    input.value = ''; input.style.height = 'auto'; check(); msgList.scrollTop = msgList.scrollHeight;
    setTimeout(() => {
      let botHTML = "";
      if (chatStage === 0) {
        botHTML = GREETING_VARIATIONS[greetingIndex];
        greetingIndex = (greetingIndex + 1) % GREETING_VARIATIONS.length;
        chatStage = 1;
      } else if (chatStage === 1) {
        botHTML = `<p class="mb-3">Here is the visualization of your data for the last 90 days:</p><div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-3"><div class="bg-gray-50 dark:bg-gray-700/50 p-3 rounded-lg border border-gray-100 dark:border-gray-600"><h4 class="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-2 uppercase">Jobs At Risk</h4><div class="flex items-end justify-around h-24 gap-2"><div class="w-8 bg-green-400 rounded-t" style="height:30%" title="Month 1"></div><div class="w-8 bg-yellow-400 rounded-t" style="height:60%" title="Month 2"></div><div class="w-8 bg-red-400 rounded-t" style="height:85%" title="Month 3"></div></div><div class="flex justify-around text-[10px] text-gray-400 mt-1"><span>M1</span><span>M2</span><span>M3</span></div></div><div class="bg-gray-50 dark:bg-gray-700/50 p-3 rounded-lg border border-gray-100 dark:border-gray-600 flex flex-col items-center justify-center"><h4 class="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-2 uppercase">Timeline Performance</h4><div class="w-20 h-20 rounded-full" style="background: conic-gradient(#4ade80 0% 65%, #fbbf24 65% 85%, #f87171 85% 100%);"></div><div class="flex gap-2 text-[10px] text-gray-500 mt-2"><span class="flex items-center gap-1"><span class="w-2 h-2 rounded-full bg-green-400"></span>OK</span><span class="flex items-center gap-1"><span class="w-2 h-2 rounded-full bg-yellow-400"></span>Tight</span><span class="flex items-center gap-1"><span class="w-2 h-2 rounded-full bg-red-400"></span>Late</span></div></div></div><p>Now that we have the data, would you like to know my recommendations for performance improvements?</p>`;
        chatStage = 2;
      } else if (chatStage === 2) {
        botHTML = `<p class="mb-2">Based on the analysis, here are a few recommendations:</p><ul class="list-disc pl-4 space-y-1 mb-2"><li><strong>Adjust Timeline:</strong> Job "Quantum Leap" is trending late. Consider extending the deadline by 3 days.</li><li><strong>Reallocate Effort:</strong> "Mobile App Revamp" is under-resourced. Assigning one more dev could reduce risk.</li><li><strong>Review Scope:</strong> "Data Migration" has high WIP pressure. A scope review meeting is advised.</li></ul><p>Would you like me to draft an email for the scope review?</p>`;
        chatStage = 3;
      } else {
        botHTML = "I'm standing by for your next request. I can help visualize more data or draft communications based on these insights.";
      }
      renderBotMessage(msgList, botHTML);
    }, 600);
  }

  if (input) {
    input.addEventListener('input', check);
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); if (!btn?.disabled) send(); } });
  }
  if (btn) btn.addEventListener('click', send);
  renderDefaultBotMsg();
}

// Export placeholder modules for other AI features
export { renderNetNetBot as default };
