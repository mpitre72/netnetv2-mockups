import { ICONS } from '../app-shell/app-constants.js';
import { __isDark } from '../app-shell/app-helpers.js';

function getNnuIconSrc(active) {
  const dark = __isDark();
  const set = ICONS.nnu;
  return dark ? (active ? set.dark.active : set.dark.idle) : (active ? set.light.active : set.light.idle);
}

function nnuIconPaint(active) {
  const el = document.getElementById('nnuFeaturedIcon');
  if (!el) return;
  const src = getNnuIconSrc(active);
  if (el.getAttribute('src') !== src) el.setAttribute('src', src);
}
function nnuIconSwap(hover) { nnuIconPaint(!!hover); }

export function renderNnuPage(container = document.getElementById('app-main')) {
  if (!container) {
    console.warn('[NnuModule] container not found for renderNnuPage.');
    return;
  }
  container.innerHTML = `
    <section class="relative mx-auto max-w-2xl">
      <div class="mx-auto w-full rounded-2xl border bg-white/90 dark:bg-slate-800/90 backdrop-blur-sm shadow-xl border-black/10 dark:border-white/10 px-6 py-8 md:px-8 md:py-10 text-center">
        <button type="button" class="me-featured-icon mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full ring-1 ring-black/10 dark:ring-white/10 bg-white dark:bg-slate-700 shadow-inner" aria-label="Net Net U icon" onmouseenter="nnuIconSwap(true)" onmouseleave="nnuIconSwap(false)" onclick="nnuIconSwap(true)">
          <img id="nnuFeaturedIcon" alt="Net Net U" class="h-7 w-7 select-none pointer-events-none">
        </button>
        <h2 class="text-xl md:text-2xl font-semibold text-slate-900 dark:text-white">Welcome to Net Net University</h2>
        <p class="mt-2 text-sm md:text-base text-slate-600 dark:text-slate-300">Learning content and tutorials will be available here soon.</p>
        <div class="mt-6">
          <button type="button" class="inline-flex h-10 items-center justify-center rounded-md px-4 text-sm font-semibold text-white transition-colors" style="background:#711FFF;" onmouseover="this.style.background='#6020df';" onmouseout="this.style.background='#711FFF';">Explore Content</button>
        </div>
      </div>
    </section>
  `;
  nnuIconPaint(false);
}

if (typeof window !== 'undefined') {
  window.nnuIconSwap = nnuIconSwap;
  window.nnuIconPaint = nnuIconPaint;
}
