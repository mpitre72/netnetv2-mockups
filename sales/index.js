import { ICONS } from '../app-shell/app-constants.js';
import { __isDark } from '../app-shell/app-helpers.js';

function getSalesIconSrc(active) {
  const dark = __isDark();
  const set = ICONS.sales;
  return dark ? (active ? set.dark.active : set.dark.idle) : (active ? set.light.active : set.light.idle);
}

function salesIconPaint(active) {
  const el = document.getElementById('salesFeaturedIcon');
  if (!el) return;
  const src = getSalesIconSrc(active);
  if (el.getAttribute('src') !== src) el.setAttribute('src', src);
}

function salesIconSwap(hover) { salesIconPaint(!!hover); }

export function renderSalesPage(container = document.getElementById('app-main')) {
  if (!container) {
    console.warn('[SalesModule] container not found for renderSalesPage.');
    return;
  }
  container.innerHTML = `
    <div class="h-full flex items-center justify-center">
      <section class="relative mx-auto max-w-2xl">
        <div class="mx-auto w-full rounded-2xl border bg-white/90 dark:bg-slate-800/90 backdrop-blur-sm shadow-xl border-black/10 dark:border-white/10 px-6 py-8 md:px-8 md:py-10 text-center">
          <button type="button" class="me-featured-icon mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full ring-1 ring-black/10 dark:ring-white/10 bg-white dark:bg-slate-700 shadow-inner" aria-label="Sales icon" onmouseenter="salesIconSwap(true)" onmouseleave="salesIconSwap(false)" onclick="salesIconSwap(true)">
            <img id="salesFeaturedIcon" alt="Sales" class="h-7 w-7 select-none pointer-events-none">
          </button>
          <h2 class="text-xl md:text-2xl font-semibold text-slate-900 dark:text-white">No sales found</h2>
          <p class="mt-2 text-sm md:text-base text-slate-600 dark:text-slate-300">Once sales opportunities are created, they will appear here</p>
          <div class="mt-6 flex items-center justify-center gap-3">
            <button type="button" id="openDrawerBtn" class="inline-flex h-10 items-center justify-center rounded-md border px-4 text-sm font-medium border-slate-300 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700">Open Context Panel</button>
            <button type="button" class="inline-flex h-10 items-center justify-center rounded-md px-4 text-sm font-semibold text-white transition-colors" style="background:#711FFF;" onmouseover="this.style.background='#6020df';" onmouseout="this.style.background='#711FFF';">+ New Sales</button>
          </div>
        </div>
      </section>
    </div>
  `;
  salesIconPaint(false);
  const btn = container.querySelector('#openDrawerBtn');
  if (btn) btn.onclick = () => {
    const shell = document.getElementById('app-shell');
    if (shell) shell.classList.remove('drawer-closed');
  };
}

// Expose swaps globally to preserve inline handlers
if (typeof window !== 'undefined') {
  window.salesIconSwap = salesIconSwap;
  window.salesIconPaint = salesIconPaint;
}
