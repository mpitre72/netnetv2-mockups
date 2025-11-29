// Renders the contacts list page shell (filters + table) using the original
// markup from the monolithic index.html. Data is only used to populate filter
// option lists; rows are rendered/wired by contacts/index.js.

export function renderContactsLayout(data = []) {
  const cities = [...new Set(data.map(c => c.city))];
  const states = [...new Set(data.map(c => c.state))];
  const titles = [...new Set(data.flatMap(c => (c.people || []).map(p => p.title)))];

  return `
    <div class="flex flex-col h-full relative">
      <div class="sticky top-0 z-20 flex flex-col md:flex-row items-center justify-between px-4 py-3 gap-4 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shrink-0">
        <div class="flex flex-col md:flex-row items-center gap-3 w-full md:w-auto flex-1">
          <div class="relative w-full md:w-64">
            <div class="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-gray-400">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
              </svg>
            </div>
            <input type="text" id="contact-search" placeholder="Search companies or people..." class="w-full h-10 pl-10 pr-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-netnet-purple focus:border-transparent">
          </div>
          <select id="filter-city" class="w-full md:w-40 h-10 px-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm text-gray-700 dark:text-gray-300 focus:ring-2 focus:ring-netnet-purple">
            <option value="all">All Cities</option>
            ${cities.map(c => `<option value="${c}">${c}</option>`).join('')}
          </select>
          <select id="filter-state" class="w-full md:w-32 h-10 px-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm text-gray-700 dark:text-gray-300 focus:ring-2 focus:ring-netnet-purple">
            <option value="all">All States</option>
            ${states.map(s => `<option value="${s}">${s}</option>`).join('')}
          </select>
          <select id="filter-title" class="w-full md:w-40 h-10 px-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm text-gray-700 dark:text-gray-300 focus:ring-2 focus:ring-netnet-purple">
            <option value="all">All Titles</option>
            ${titles.map(t => `<option value="${t}">${t}</option>`).join('')}
          </select>
        </div>
        <button onclick="showToast('New Contact feature coming soon')" class="w-full md:w-auto px-4 py-2 bg-netnet-purple text-white font-medium rounded-lg hover:bg-[#6020df] transition-colors flex items-center justify-center gap-2">
          <span>+ New Contact</span>
        </button>
      </div>
      <div class="flex-1 overflow-y-auto">
        <table class="w-full text-left border-collapse">
          <thead class="bg-gray-50 dark:bg-gray-800/80 sticky top-0 z-10 text-xs uppercase text-gray-500 dark:text-gray-400 font-semibold backdrop-blur-sm">
            <tr>
              <th class="px-6 py-3 border-b border-gray-200 dark:border-gray-700 w-10"></th>
              <th class="px-6 py-3 border-b border-gray-200 dark:border-gray-700">Company Name</th>
              <th class="px-6 py-3 border-b border-gray-200 dark:border-gray-700 hidden md:table-cell">Website</th>
              <th class="px-6 py-3 border-b border-gray-200 dark:border-gray-700">City</th>
              <th class="px-6 py-3 border-b border-gray-200 dark:border-gray-700">State</th>
            </tr>
          </thead>
          <tbody id="contacts-table-body" class="divide-y divide-gray-100 dark:divide-gray-800"></tbody>
        </table>
      </div>
    </div>
  `;
}
