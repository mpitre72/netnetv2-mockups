export function renderProfilePage(container = document.getElementById('app-main')) {
  if (!container) {
    console.warn('[ProfileModule] container not found for renderProfilePage.');
    return;
  }
  container.innerHTML = `
    <div class="h-full flex items-center justify-center">
      <section class="relative mx-auto max-w-2xl">
        <div class="mx-auto w-full rounded-2xl border bg-white/90 dark:bg-slate-800/90 backdrop-blur-sm shadow-xl border-black/10 dark:border-white/10 px-6 py-8 md:px-8 md:py-10 text-center">
          <h2 class="text-xl md:text-2xl font-semibold text-slate-900 dark:text-white">Profile placeholder</h2>
          <p class="mt-2 text-sm md:text-base text-slate-600 dark:text-slate-300">Profile view/edit and avatar upload will render here.</p>
          <div class="mt-6 flex items-center justify-center gap-3">
            <button type="button" id="openDrawerBtn" class="inline-flex h-10 items-center justify-center rounded-md border px-4 text-sm font-medium border-slate-300 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700">Open Context Panel</button>
          </div>
        </div>
      </section>
    </div>
  `;
}
