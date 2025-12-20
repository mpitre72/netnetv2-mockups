import { ICONS } from '../app-shell/app-constants.js';
import { __isDark } from '../app-shell/app-helpers.js';
import { SectionHeader } from '../components/layout/SectionHeader.js';
import { renderMeListsPage, getListsHeaderState, setListsSearch, toggleListsPanel, toggleListsArchive, toggleListsMultiSelect, refreshListsBody } from './lists.js';
import { renderMyListsHeader, renderMyListsPage } from './my-lists.js';
import { navigate } from '../router.js';

const { createElement: h } = React;
const { createRoot } = ReactDOM;

const ME_SWITCHER = [
  { value: 'tasks', label: 'My Tasks', hash: '#/app/me/tasks' },
  { value: 'my-lists', label: 'My Lists', hash: '#/app/me/my-lists' },
  { value: 'time', label: 'My Time', hash: '#/app/me/time' },
  { value: 'performance', label: 'My Performance', hash: '#/app/me/performance' },
];
const KNOWN_ME_PAGES = ['tasks', 'my-lists', 'time', 'performance', 'lists'];

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
  const activePage = KNOWN_ME_PAGES.includes(page) ? page : 'tasks';
  container.classList.remove('flex', 'items-center', 'justify-center', 'h-full');
  container.innerHTML = `
    <div class="w-full h-full flex flex-col gap-4">
      <div id="meHeaderRoot" class="px-4 pt-2 pb-3 md:pt-3 md:pb-2"></div>
      <div id="meBody" class="flex-1"></div>
    </div>
  `;

  const headerRootEl = document.getElementById('meHeaderRoot');
  const renderPlain = () => {
    if (!headerRootEl) return;
    const plainSwitcher = ME_SWITCHER;
    headerRootEl.innerHTML = `
      <div class="flex flex-col gap-2">
        <div class="flex items-center gap-2">
          <h1 class="text-2xl font-semibold text-slate-900 dark:text-white">Me</h1>
        </div>
        <div class="inline-flex flex-wrap items-center gap-2">
          ${plainSwitcher.map(opt => `
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
        const match = plainSwitcher.find(m => m.value === val);
        navigate(match?.hash || '#/app/me/tasks');
      });
    });
  };

  const renderListsHeader = () => {
    if (!headerRootEl) return;
    const state = getListsHeaderState();
    const rightIcons = [];
    const micro = (child, onClick, aria) => h('button', {
      type: 'button',
      className: 'nn-btn nn-btn--micro inline-flex items-center justify-center text-slate-700 dark:text-white bg-white dark:bg-slate-900 border border-slate-300 dark:border-white/10 hover:bg-slate-50 dark:hover:bg-slate-800 focus-visible:ring-2 focus-visible:ring-netnet-purple',
      onClick,
      'aria-label': aria,
      title: aria,
    }, child);
    const folderIcon = h('svg', {
      width: 16,
      height: 16,
      viewBox: '0 0 24 24',
      fill: 'none',
      stroke: 'currentColor',
      strokeWidth: 1.8,
      strokeLinecap: 'round',
      strokeLinejoin: 'round',
      className: state.panelOpen
        ? (__isDark() ? 'text-emerald-400' : 'text-netnet-purple')
        : 'text-slate-700 dark:text-white',
    }, [
      h('path', { d: 'M3 6h5l2 2h11v10a2 2 0 0 1-2 2H3z' }),
      h('path', { d: 'M3 6h5l2 2h9a2 2 0 0 1 2 2' }),
    ]);
    const archiveIcon = h('svg', { width: 16, height: 16, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round', className: state.showArchived ? 'text-netnet-purple' : 'text-slate-700 dark:text-white' }, [
      h('rect', { x: 3, y: 4, width: 18, height: 4, rx: 1 }),
      h('path', { d: 'M5 8v11a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8' }),
      h('line', { x1: 10, y1: 12, x2: 14, y2: 12 }),
    ]);
    rightIcons.push(micro(folderIcon, () => { toggleListsPanel(); renderListsHeader(); refreshListsBody(); }, 'Manage lists'));
    rightIcons.push(micro(archiveIcon, () => { toggleListsArchive(); renderListsHeader(); refreshListsBody(); }, state.showArchived ? 'Hide archive' : 'Show archive'));

    const leftActions = [
      h('button', {
        type: 'button',
        className: 'nn-btn nn-btn--micro inline-flex items-center justify-center text-slate-700 dark:text-white bg-white dark:bg-slate-900 border border-slate-300 dark:border-white/10 hover:bg-slate-50 dark:hover:bg-slate-800 focus-visible:ring-2 focus-visible:ring-netnet-purple',
        onClick: () => { toggleListsMultiSelect(); renderListsHeader(); refreshListsBody(); },
        'aria-pressed': state.multiSelect ? 'true' : 'false',
        'aria-label': state.multiSelect ? 'Exit multi-select mode' : 'Enter multi-select mode',
        title: state.multiSelect ? 'Exit multi-select mode' : 'Enter multi-select mode',
      }, h('svg', { viewBox: '0 0 24 24', className: 'h-4 w-4', fill: 'none', stroke: 'currentColor', strokeWidth: '1.8' }, [
        h('rect', { x: '4', y: '4', width: '16', height: '16', rx: '2' }),
        h('path', { d: 'M8 12l3 3 5-6' }),
      ])),
    ];

    const root = createRoot(headerRootEl);
    root.render(h(SectionHeader, {
      title: h('div', { className: 'flex items-center gap-2' }, [
        h('span', { className: 'text-sm text-slate-500 dark:text-white/70' }, 'Me'),
        h('span', { className: 'text-slate-400 dark:text-white/50' }, '›'),
        h('span', { className: 'text-2xl font-semibold text-slate-900 dark:text-white' }, 'Lists'),
      ]),
      showHelpIcon: true,
      showSecondaryRow: true,
      leftActions,
      showSearch: true,
      searchPlaceholder: 'Search list…',
      searchValue: state.search,
      onSearchChange: (val) => { setListsSearch(val); refreshListsBody(); },
      videoHelpConfig: {
        primary: {
          title: 'Lists overview',
          description: 'Capture and organize pre-task items.',
          videoUrl: 'https://videos.hellonetnet.com/watch/wo5umvj3',
          thumbnailSrc: 'public/assets/samples/vid-jobs.jpg',
        },
      },
      switcherOptions: ME_SWITCHER,
      switcherValue: 'my-lists',
      onSwitcherChange: (val) => {
        const match = ME_SWITCHER.find((m) => m.value === val);
        navigate(match?.hash || '#/app/me/tasks');
      },
      rightActions: rightIcons,
    }));
  };

  if (activePage === 'my-lists') {
    renderMyListsHeader(headerRootEl);
  } else if (activePage === 'lists') {
    renderListsHeader();
  } else {
    if (headerRootEl) {
      try {
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
          leftActions: [],
        }));
      } catch (e) {
        renderPlain();
      }
    }
  }

  const body = document.getElementById('meBody');
  if (!body) return;

  if (activePage === 'my-lists') {
    renderMyListsPage(body);
    return;
  }

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
