import { clearStore } from '../performance/testdata/performance-store.js';

export function renderSettingsPage(container = document.getElementById('app-main')) {
  if (!container) {
    console.warn('[SettingsModule] container not found for renderSettingsPage.');
    return;
  }
  container.innerHTML = `
    <div class="h-full flex items-center justify-center">
      <section class="relative mx-auto max-w-2xl">
        <div class="mx-auto w-full rounded-2xl border bg-white/90 dark:bg-slate-800/90 backdrop-blur-sm shadow-xl border-black/10 dark:border-white/10 px-6 py-8 md:px-8 md:py-10 text-center">
          <h2 class="text-xl md:text-2xl font-semibold text-slate-900 dark:text-white">Workspace Settings</h2>
          <p class="mt-2 text-sm md:text-base text-slate-600 dark:text-slate-300">General/team/templates/work-types/billing settings will appear here.</p>
          <div class="mt-6 flex items-center justify-center gap-3">
            <button type="button" id="openDrawerBtn" class="inline-flex h-10 items-center justify-center rounded-md border px-4 text-sm font-medium border-slate-300 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700">Open Context Panel</button>
            <button type="button" id="settingsCheatSheetBtn" class="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-slate-600 bg-slate-900 text-slate-100 px-4 py-2 text-sm font-medium hover:bg-slate-800 hover:text-white">Cheat Sheet</button>
          </div>
          <div class="mt-4 flex justify-center">
            <button type="button" id="clearPerfTestData" class="text-xs text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white/80 underline-offset-4 hover:underline">
              Clear test data
            </button>
          </div>
        </div>
      </section>
    </div>
  `;

  // Wire buttons locally (Settings renders after shell mount)
  const cheatSheetBtn = document.getElementById('settingsCheatSheetBtn');
  if (cheatSheetBtn) {
    cheatSheetBtn.onclick = () => { location.hash = '#/app/components'; };
  }
  const openDrawerBtn = document.getElementById('openDrawerBtn');
  if (openDrawerBtn) {
    openDrawerBtn.onclick = () => {
      const shell = document.getElementById('app-shell');
      if (shell) shell.classList.remove('drawer-closed');
    };
  }
  const clearTestBtn = document.getElementById('clearPerfTestData');
  if (clearTestBtn) {
    clearTestBtn.onclick = () => {
      clearStore();
      if (typeof window?.showToast === 'function') {
        window.showToast('Test data cleared');
      }
      location.reload();
    };
  }
}
