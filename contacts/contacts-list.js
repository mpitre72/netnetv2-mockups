// Renders the contacts list page shell (filters + table) using the original
// markup from the monolithic index.html. Data is only used to populate filter
// option lists; rows are rendered/wired by contacts/index.js.

export function renderContactsLayout(data = []) {
  return `
    <div class="flex flex-col h-full relative">
      <div class="sticky top-0 z-20 bg-white/70 dark:bg-gray-900/80 backdrop-blur-md px-4 pt-3 pb-2">
        <div class="flex flex-col md:flex-row items-center gap-3">
          <div class="flex-1 w-full" id="contacts-search-mount"></div>
          <button onclick="showToast('New Contact feature coming soon')" class="w-full md:w-auto px-4 py-2 bg-netnet-purple text-white font-medium rounded-lg hover:bg-[#6020df] transition-colors flex items-center justify-center gap-2">
            <span>+ New Contact</span>
          </button>
        </div>
      </div>
      <div class="flex-1 overflow-y-auto contacts-scroll">
        <table class="w-full text-left border-collapse">
          <thead class="bg-gray-50 dark:bg-gray-800/80 sticky top-0 z-10 text-xs uppercase text-gray-500 dark:text-gray-400 font-semibold backdrop-blur-sm">
            <tr>
              <th class="px-6 py-3 border-b border-gray-200 dark:border-gray-700 w-10"></th>
              <th class="px-6 py-3 border-b border-gray-200 dark:border-gray-700">Company Name</th>
              <th class="px-6 py-3 border-b border-gray-200 dark:border-gray-700">Links</th>
              <th class="px-6 py-3 border-b border-gray-200 dark:border-gray-700">Phone</th>
              <th class="px-6 py-3 border-b border-gray-200 dark:border-gray-700">Location</th>
            </tr>
          </thead>
          <tbody id="contacts-table-body" class="divide-y divide-gray-100 dark:divide-gray-800"></tbody>
        </table>
      </div>
    </div>
  `;
}
