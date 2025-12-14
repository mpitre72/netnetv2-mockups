import { ICONS } from '../app-shell/app-constants.js';
import { __isDark } from '../app-shell/app-helpers.js';
import { SectionHeader } from '../components/layout/SectionHeader.js';
import { renderMeListsPage } from './lists.js';
import { navigate } from '../router.js';

const { createElement: h } = React;
const { createRoot } = ReactDOM;

const ME_SWITCHER = [
  { value: 'tasks', label: 'My Tasks', hash: '#/app/me/tasks' },
  { value: 'lists', label: 'Lists', hash: '#/app/me/lists' },
  { value: 'time', label: 'My Time', hash: '#/app/me/time' },
  { value: 'performance', label: 'My Performance', hash: '#/app/me/performance' },
];

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
  const activePage = ME_SWITCHER.find((m) => m.value === page)?.value || 'tasks';
  container.classList.remove('flex', 'items-center', 'justify-center', 'h-full');
  container.innerHTML = `
    <div class="w-full max-w-6xl mx-auto space-y-6">
      <div id="meHeaderRoot"></div>
      <div id="meBody"></div>
    </div>
  `;

  const headerRootEl = document.getElementById('meHeaderRoot');
  if (headerRootEl) {
    const renderPlain = () => {
      headerRootEl.innerHTML = `
        <div class="flex flex-col gap-2">
          <div class="flex items-center gap-2">
            <h1 class="text-2xl font-semibold text-slate-900 dark:text-white">Me</h1>
            <span class="text-xs px-2 py-1 rounded-full bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200" aria-label="Me sub-nav debug">Me Sub-Nav Active (Debug)</span>
          </div>
          <div class="inline-flex flex-wrap items-center gap-2">
            ${ME_SWITCHER.map(opt => `
              <button data-plain-me-nav="${opt.value}" class="px-3 py-1 rounded-full text-sm font-medium border ${opt.value === activePage ? 'bg-[var(--color-brand-purple,#711FFF)] text-white border-transparent shadow-sm' : 'border-slate-200 dark:border-white/20 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800'}">
                ${opt.label}
              </button>
            `).join('')}
          </div>
        </div>
      `;
      headerRootEl.querySelectorAll('[data-plain-me-nav]').forEach(btn => {
        btn.addEventListener('click', () => {
          const val = btn.getAttribute('data-plain-me-nav');
          const match = ME_SWITCHER.find(m => m.value === val);
          navigate(match?.hash || '#/app/me/tasks');
        });
      });
    };
    try {
      if (!SectionHeader || !createRoot || !h) {
        renderPlain();
      } else {
        const root = createRoot(headerRootEl);
        root.render(h(SectionHeader, {
          title: 'Me',
          showHelpIcon: false,
          switcherOptions: ME_SWITCHER,
          switcherValue: activePage,
          onSwitcherChange: (val) => {
            const match = ME_SWITCHER.find((m) => m.value === val);
            navigate(match?.hash || '#/app/me/tasks');
          },
          showSecondaryRow: true,
          leftActions: [
            h('span', {
              className: 'text-xs px-2 py-1 rounded-full bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200',
            }, 'Me Sub-Nav Active (Debug)'), // TODO: remove debug label after verification
          ],
        }));
      }
    } catch (e) {
      console.warn('[MeModule] Falling back to plain header render', e);
      renderPlain();
    }
  }

  const body = document.getElementById('meBody');
  if (!body) return;

  if (activePage === 'lists') {
    renderMeListsPage(body, { withHeader: false });
    return;
  }

  let html = '';
  if (activePage === 'time') {
    html = `
      <section class="relative mx-auto">
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
  } else if (activePage === 'performance') {
    html = `
      <section class="relative mx-auto">
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
      <section class="relative mx-auto">
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
  body.innerHTML = html;
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
