// Renders the contacts list page shell (filters + table) using the original
// markup from the monolithic index.html. Data is only used to populate filter
// option lists; rows are rendered/wired by contacts/index.js.

export function renderContactsLayout(data = [], subview = 'companies') {
  return `
    <div class="flex flex-col h-full relative bg-[var(--color-bg-app,#020617)]">
      <div class="contacts-header-shell fixed inset-x-0 bottom-[calc(72px+env(safe-area-inset-bottom))] z-30 bg-white/90 dark:bg-gray-900/90 backdrop-blur-md px-4 pt-2 pb-3 md:sticky md:top-0 md:z-20 md:bg-white/70 md:dark:bg-gray-900/80 md:pt-3 md:pb-2 md:backdrop-blur-md">
        <div id="contacts-section-header-root" class="w-full"></div>
      </div>
      <div class="flex-1 overflow-y-auto contacts-scroll pb-36 md:pb-0">
        <div id="contacts-grouped-view">
          <table class="w-full text-left border-collapse">
            <thead class="contacts-column-header-row bg-gray-50 dark:bg-gray-800/80 sticky top-0 z-10 text-xs uppercase text-gray-500 dark:text-gray-400 font-semibold backdrop-blur-sm">
              <tr>
                <th class="px-6 py-3 border-b border-gray-200 dark:border-gray-700 w-10"></th>
                <th class="px-6 py-3 border-b border-gray-200 dark:border-gray-700">Company Name</th>
                <th class="px-6 py-3 border-b border-gray-200 dark:border-gray-700">Links</th>
                <th class="px-6 py-3 border-b border-gray-200 dark:border-gray-700">Phone</th>
                <th class="px-6 py-3 border-b border-gray-200 dark:border-gray-700">Location</th>
                <th class="px-4 py-3 border-b border-gray-200 dark:border-gray-700 w-10 text-right"></th>
              </tr>
            </thead>
            <tbody id="contacts-table-body" class="divide-y divide-gray-100 dark:divide-gray-800"></tbody>
          </table>
        </div>
        <div id="contacts-flat-view" class="hidden">
          <table class="w-full text-left border-collapse">
            <thead class="bg-gray-50 dark:bg-gray-800/80 sticky top-0 z-10 text-xs uppercase text-gray-500 dark:text-gray-400 font-semibold backdrop-blur-sm">
              <tr>
                <th class="px-6 py-3 border-b border-gray-200 dark:border-gray-700 w-10 text-center">
                  <input id="contacts-flat-select-all" type="checkbox" class="rounded border-gray-300 text-netnet-purple focus:ring-netnet-purple" aria-label="Select all people">
                </th>
                <th class="px-6 py-3 border-b border-gray-200 dark:border-gray-700">Name</th>
                <th class="px-6 py-3 border-b border-gray-200 dark:border-gray-700">Company</th>
                <th class="px-6 py-3 border-b border-gray-200 dark:border-gray-700">Title</th>
                <th class="px-6 py-3 border-b border-gray-200 dark:border-gray-700">Links</th>
                <th class="px-6 py-3 border-b border-gray-200 dark:border-gray-700">Mobile</th>
                <th class="px-6 py-3 border-b border-gray-200 dark:border-gray-700">Location</th>
                <th class="px-4 py-3 border-b border-gray-200 dark:border-gray-700 w-10 text-right"></th>
              </tr>
            </thead>
            <tbody id="contacts-flat-body" class="divide-y divide-gray-100 dark:divide-gray-800"></tbody>
          </table>
        </div>
      </div>
    </div>
  `;
}
