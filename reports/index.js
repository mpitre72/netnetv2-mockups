export function renderReportsPage(container = document.getElementById('app-main')) {
  if (!container) {
    console.warn('[ReportsModule] container not found for renderReportsPage.');
    return;
  }
  container.innerHTML = `
    <section class="relative mx-auto max-w-2xl">
      <div class="mx-auto w-full rounded-2xl border bg-white/90 dark:bg-slate-800/90 backdrop-blur-sm shadow-xl border-black/10 dark:border-white/10 px-6 py-8 md:px-8 md:py-10 text-center">
        <h2 class="text-xl md:text-2xl font-semibold text-slate-900 dark:text-white">Reports dashboard placeholder</h2>
        <p class="mt-2 text-sm md:text-base text-slate-600 dark:text-slate-300">Reporting widgets will render here.</p>
      </div>
    </section>
  `;
}
