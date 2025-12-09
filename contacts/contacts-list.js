// Renders the contacts list page shell (filters + table) using the original
// markup from the monolithic index.html. Data is only used to populate filter
// option lists; rows are rendered/wired by contacts/index.js.

export function renderContactsLayout(data = [], subview = 'companies') {
  return `
    <div class="flex flex-col h-full relative bg-[var(--color-bg-app,#020617)]">
      <div class="fixed inset-x-0 bottom-[calc(72px+env(safe-area-inset-bottom))] z-30 bg-white/90 dark:bg-gray-900/90 backdrop-blur-md px-4 pt-2 pb-3 md:sticky md:top-0 md:z-20 md:bg-white/70 md:dark:bg-gray-900/80 md:pt-3 md:pb-2 md:backdrop-blur-md">
        <div class="flex flex-col md:flex-row items-center gap-3 w-full">
          <div class="flex items-center gap-2 w-full">
            <button id="contacts-expand-toggle" type="button" class="new-action-icon" aria-label="Expand all" title="Expand all">
              <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
                <path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7"/>
              </svg>
            </button>
            <div class="flex-1" id="contacts-search-mount"></div>
          </div>
          <div class="hidden md:flex items-center gap-2 text-slate-500 dark:text-slate-300">
            <button
              onclick="navigate('#/app/contacts/companies/new')"
              class="new-action-icon"
              aria-label="+ New Company"
              data-tooltip="+ New Company"
            >
              <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6">
                <path stroke-linecap="round" stroke-linejoin="round" d="M3 21h18M6 21V8a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v13M9 21v-4h6v4M9 12h6M9 9h6" />
              </svg>
            </button>
            <button
              onclick="navigate('#/app/contacts/people/new')"
              class="new-action-icon"
              aria-label="+ New Person"
              data-tooltip="+ New Person"
            >
              <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6">
                <path stroke-linecap="round" stroke-linejoin="round" d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <path stroke-linecap="round" stroke-linejoin="round" d="M17 11v6m3-3h-6" />
              </svg>
            </button>
            <button
              onclick="navigate('#/app/contacts/import')"
              class="new-action-icon"
              aria-label="Import Contacts"
              data-tooltip="Import Contacts"
            >
              <svg class="w-5 h-5 transform rotate-180" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6">
                <path stroke-linecap="round" stroke-linejoin="round" d="M12 3v12m0 0 4-4m-4 4-4-4m-6 8h20" />
              </svg>
            </button>
          </div>
        </div>
      </div>
      <div class="flex-1 overflow-y-auto contacts-scroll pb-36 md:pb-0">
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
