import { ICONS } from '../app-shell/app-constants.js';
import { __isDark } from '../app-shell/app-helpers.js';

function getMeIconSrc(active) {
  const dark = __isDark();
  const set = ICONS.me;
  return dark ? (active ? set.dark.active : set.dark.idle) : (active ? set.light.active : set.light.idle);
}

function meIconPaint(active) {
  const img = document.getElementById('meFeaturedIcon');
  if (!img) return;
  const src = getMeIconSrc(active);
  if (img.getAttribute('src') !== src) img.setAttribute('src', src);
}

function meIconSwap(hover) { meIconPaint(!!hover); }

export function renderMePage(page, container = document.getElementById('app-main')) {
  if (!container) {
    console.warn('[MeModule] container not found for renderMePage.');
    return;
  }
  let html = '';
  if (page === 'time') {
    html = `
          <section class="relative mx-auto max-w-2xl">
            <div class="mx-auto w-full rounded-2xl border bg-white/90 dark:bg-slate-800/90 backdrop-blur-sm shadow-xl border-black/10 dark:border-white/10 px-6 py-8 md:px-8 md:py-10 text-center">
              <button type="button" class="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full ring-1 ring-black/10 dark:ring-white/10 bg-white dark:bg-slate-700 shadow-inner" aria-label="Me icon" onmouseenter="meIconSwap(true)" onmouseleave="meIconSwap(false)" onclick="meIconSwap(true)">
                <img id="meFeaturedIcon" alt="Me" class="h-7 w-7 select-none pointer-events-none">
              </button>
              <h2 class="text-xl md:text-2xl font-semibold text-slate-900 dark:text-white">You Don't Have Any Time Logged yet</h2>
              <p class="mt-2 text-sm md:text-base text-slate-600 dark:text-slate-300">Once you start logging time, it will appear here in your personal timesheets.</p>
              <div class="mt-6 flex items-center justify-center gap-3">
                <button type="button" id="openDrawerBtn" class="inline-flex h-10 items-center justify-center rounded-md border px-4 text-sm font-medium border-slate-300 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700" onclick="openDrawer()">Open Context Panel</button>
                <button type="button" class="inline-flex h-10 items-center justify-center rounded-md px-4 text-sm font-semibold text-white transition-colors" style="background:#711FFF;" onmouseover="this.style.background='#6020df';" onmouseout="this.style.background='#711FFF';">+ New Time Entry</button>
              </div>
            </div>
          </section>`;
  } else if (page === 'performance') {
    html = `
          <section class="relative mx-auto max-w-2xl">
            <div class="mx-auto w-full rounded-2xl border bg-white/90 dark:bg-slate-800/90 backdrop-blur-sm shadow-xl border-black/10 dark:border-white/10 px-6 py-8 md:px-8 md:py-10 text-center">
              <button type="button" class="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full ring-1 ring-black/10 dark:ring-white/10 bg-white dark:bg-slate-700 shadow-inner" aria-label="Me icon" onmouseenter="meIconSwap(true)" onmouseleave="meIconSwap(false)" onclick="meIconSwap(true)">
                <img id="meFeaturedIcon" alt="Me" class="h-7 w-7 select-none pointer-events-none">
              </button>
              <h2 class="text-xl md:text-2xl font-semibold text-slate-900 dark:text-white">You Don't Have Any performance KPI's Yet</h2>
              <p class="mt-2 text-sm md:text-base text-slate-600 dark:text-slate-300">As you complete work and log time, your personal performance KPI’s will appear here.</p>
              <div class="mt-6 flex items-center justify-center gap-3">
                <button type="button" id="openDrawerBtn" class="inline-flex h-10 items-center justify-center rounded-md border px-4 text-sm font-medium border-slate-300 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700" onclick="openDrawer()">Open Context Panel</button>
                <button type="button" class="inline-flex h-10 items-center justify-center rounded-md px-4 text-sm font-semibold text-white transition-colors" style="background:#711FFF;" onmouseover="this.style.background='#6020df';" onmouseout="this.style.background='#711FFF';">+ View Performance Tips</button>
              </div>
            </div>
          </section>`;
  } else {
    html = `
          <section class="relative mx-auto max-w-2xl">
            <div class="mx-auto w-full rounded-2xl border bg-white/90 dark:bg-slate-800/90 backdrop-blur-sm shadow-xl border-black/10 dark:border-white/10 px-6 py-8 md:px-8 md:py-10 text-center">
              <button type="button" class="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full ring-1 ring-black/10 dark:ring-white/10 bg-white dark:bg-slate-700 shadow-inner" aria-label="Me icon" onmouseenter="meIconSwap(true)" onmouseleave="meIconSwap(false)" onclick="meIconSwap(true)">
                <img id="meFeaturedIcon" alt="Me" class="h-7 w-7 select-none pointer-events-none">
              </button>
              <h2 class="text-xl md:text-2xl font-semibold text-slate-900 dark:text-white">You do not have any tasks assigned</h2>
              <p class="mt-2 text-sm md:text-base text-slate-600 dark:text-slate-300">Once tasks are assigned, they will appear here</p>
              <div class="mt-6 flex items-center justify-center gap-3">
                <button type="button" id="openDrawerBtn" class="inline-flex h-10 items-center justify-center rounded-md border px-4 text-sm font-medium border-slate-300 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700" onclick="openDrawer()">Open Context Panel</button>
                <button type="button" class="inline-flex h-10 items-center justify-center rounded-md px-4 text-sm font-semibold text-white transition-colors" style="background:#711FFF;" onmouseover="this.style.background='#6020df';" onmouseout="this.style.background='#711FFF';">+ New Task</button>
              </div>
            </div>
          </section>`;
  }
  container.innerHTML = html;
  meIconPaint(false);
}

// Expose swaps globally to preserve inline handlers
if (typeof window !== 'undefined') {
  window.meIconSwap = meIconSwap;
  window.meIconPaint = meIconPaint;
  window.openDrawer = window.openDrawer || function () {
    const shell = document.getElementById('app-shell');
    if (shell) shell.classList.remove('drawer-closed');
  };
}
