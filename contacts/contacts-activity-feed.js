// Activity feed renderer used by contact profiles (company/person).
// Expects CHAT_UI_ICONS and showToast to exist globally (as in the original app).

export function renderContactsActivityFeed(data, type, mockReportData) {
  const activities = data.activities || [];
  const sorted = [...activities].sort((a, b) => new Date(b.date) - new Date(a.date));
  const jobItems = (type === 'company' && mockReportData?.jobs)
    ? mockReportData.jobs.map(j => ({ type: 'job', ...j }))
    : [];

  const allItems = [...sorted, ...jobItems].sort((a, b) => {
    const dA = a.date || a.startDate;
    const dB = b.date || b.startDate;
    return new Date(dB) - new Date(dA);
  });

  return `
    <div class="flex flex-col h-full bg-gray-50 dark:bg-gray-900 border-l border-gray-200 dark:border-gray-700">
      <div class="p-4 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
        <h3 class="text-sm font-semibold text-gray-900 dark:text-white uppercase mb-3">Activity Feed</h3>
        <div class="relative">
          <textarea id="quick-note" rows="2" class="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-sm p-3 pr-10 focus:ring-1 focus:ring-netnet-purple focus:outline-none resize-none" placeholder="Add a note..."></textarea>
          <button class="absolute right-2 bottom-2 text-gray-400 hover:text-netnet-purple" onclick="showToast('Voice note started...')">
            ${typeof CHAT_UI_ICONS !== 'undefined' ? CHAT_UI_ICONS.mic : ''}
          </button>
        </div>
        <div class="mt-2 flex justify-end">
          <button id="add-note-btn" class="px-3 py-1 bg-netnet-purple text-white text-xs font-medium rounded hover:bg-[#6020df]">Add Note</button>
        </div>
      </div>
      <div class="flex-1 overflow-y-auto p-4 space-y-4">
        ${allItems.length === 0 ? '<div class="text-center text-sm text-gray-500 mt-4">No activity yet.</div>' : ''}
        ${allItems.map(item => {
          let icon = ''; 
          let content = '';
          let dateStr = item.date || item.startDate;
          
          if (item.type === 'note') {
            icon = `<div class="w-8 h-8 rounded-full bg-yellow-100 dark:bg-yellow-900/30 flex items-center justify-center text-yellow-600 dark:text-yellow-400"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></div>`;
            content = `<div class="text-sm text-gray-800 dark:text-gray-200">${item.text}</div><div class="text-xs text-gray-400 mt-1">Note by ${item.user}</div>`;
          } else if (item.type === 'email') {
            icon = `<div class="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 dark:text-blue-400"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg></div>`;
            content = `<div class="font-medium text-sm text-gray-900 dark:text-white">${item.subject}</div><div class="text-sm text-gray-500 dark:text-gray-400 truncate">${item.snippet}</div>`;
          } else if (item.type === 'meeting') {
            icon = `<div class="w-8 h-8 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center text-purple-600 dark:text-purple-400"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg></div>`;
            content = `<div class="font-medium text-sm text-gray-900 dark:text-white">${item.title}</div><div class="text-xs text-gray-400 mt-1">Meeting</div>`;
          } else if (item.type === 'job') {
            icon = `<div class="w-8 h-8 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center text-green-600 dark:text-green-400"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg></div>`;
            content = `<div class="font-medium text-sm text-gray-900 dark:text-white">Active Job: ${item.name}</div><div class="text-xs text-gray-400 mt-1">Due: ${item.plannedEnd}</div>`;
          }
          
          return `
            <div class="flex gap-3">
              <div class="flex-shrink-0 pt-1">${icon}</div>
              <div class="flex-1 pb-4 border-b border-gray-100 dark:border-gray-800 last:border-0">
                <div class="flex justify-between items-start">
                  <div class="flex-1">${content}</div>
                  <span class="text-[10px] text-gray-400 whitespace-nowrap ml-2">${dateStr}</span>
                </div>
              </div>
            </div>
          `;
        }).join('')}
      </div>
    </div>
  `;
}
