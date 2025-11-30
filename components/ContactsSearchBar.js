export function ContactsSearchBar({ value = '', onChange, placeholder = 'Search companies or people...' } = {}) {
  const changeAttr = onChange ? '' : '';
  return `
    <div class="pb-2 bg-gradient-to-b from-transparent via-[#020617]/60 to-transparent dark:via-black/60 md:sticky md:top-0 md:z-20">
      <div class="flex items-center gap-3 max-w-3xl mx-auto w-full px-0">
        <label class="flex-1 group flex h-11 md:h-12 items-center gap-3 rounded-2xl border border-black/10 bg-white/80 px-4 shadow-[0_8px_24px_rgba(15,23,42,0.45)] backdrop-blur-md dark:border-white/10 dark:bg-black/40">
          <span class="inline-flex h-5 w-5 items-center justify-center text-slate-500 dark:text-slate-300 opacity-80 group-focus-within:opacity-100">
            <svg viewBox="0 0 20 20" aria-hidden="true" class="h-4 w-4">
              <path
                d="M8.5 3a5.5 5.5 0 014.382 8.864l3.127 3.127a.75.75 0 11-1.06 1.06l-3.127-3.126A5.5 5.5 0 118.5 3zm0 1.5a4 4 0 100 8 4 4 0 000-8z"
                fill="currentColor"
              />
            </svg>
          </span>
          <input
            id="contact-search"
            type="search"
            value="${value || ''}"
            placeholder="${placeholder}"
            class="flex-1 bg-transparent text-sm sm:text-base text-slate-900 placeholder:text-slate-500 focus:outline-none dark:text-slate-50 dark:placeholder:text-slate-400"
          />
        </label>
        <button
          type="button"
          aria-label="Add new contact"
          onclick="showToast('New Contact feature coming soon')"
          class="md:hidden flex h-9 w-9 items-center justify-center rounded-lg bg-netnet-purple text-white shadow-lg shadow-netnet-purple/40 ring-1 ring-white/20 transition active:translate-y-[1px]"
        >
          <svg viewBox="0 0 20 20" aria-hidden="true" class="h-5 w-5">
            <path d="M10 4.5a.75.75 0 01.75.75v4h4a.75.75 0 110 1.5h-4v4a.75.75 0 11-1.5 0v-4h-4a.75.75 0 010-1.5h4v-4A.75.75 0 0110 4.5z" fill="currentColor"/>
          </svg>
        </button>
      </div>
    </div>
  `;
}
