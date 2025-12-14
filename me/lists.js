import { SectionHeader } from '../components/layout/SectionHeader.js';

const { createElement: h } = React;
const { createRoot } = ReactDOM;

const LISTS_STORAGE_KEY = 'netnet_lists_v1';
const LIST_ITEMS_STORAGE_KEY = 'netnet_list_items_v1';
const SELECTED_LIST_KEY = 'netnet_selected_list_v1';

function safeLoad(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch (e) {
    return fallback;
  }
}

function safeSave(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    // Ignore write failures in prototype
  }
}

function uid(prefix = 'id') {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(16).slice(2)}`;
}

function hydrateLists() {
  const fallback = [
    { id: 'inbox', name: 'Inbox', sortOrder: 0 },
    { id: 'ideas', name: 'Ideas', sortOrder: 1 },
    { id: 'personal', name: 'Personal', sortOrder: 2 },
  ];
  const stored = safeLoad(LISTS_STORAGE_KEY, fallback);
  if (!Array.isArray(stored) || !stored.length) return fallback;
  return stored;
}

function hydrateItems() {
  const stored = safeLoad(LIST_ITEMS_STORAGE_KEY, []);
  return Array.isArray(stored) ? stored : [];
}

function hydrateSelected(lists) {
  const stored = safeLoad(SELECTED_LIST_KEY, '');
  const exists = lists.find((l) => l.id === stored);
  return exists ? exists.id : (lists[0]?.id || '');
}

const listsState = {
  lists: [],
  items: [],
  selectedListId: '',
  showArchived: false,
  expandedItemId: null,
  editingListId: null,
};

function saveLists(lists) {
  safeSave(LISTS_STORAGE_KEY, lists);
}

function saveItems(items) {
  safeSave(LIST_ITEMS_STORAGE_KEY, items);
}

function saveSelected(id) {
  safeSave(SELECTED_LIST_KEY, id);
}

function setSelectedList(id) {
  listsState.selectedListId = id;
  saveSelected(id);
}

function getSortedLists() {
  return [...listsState.lists].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
}

function getActiveItems(includeArchived = false) {
  return listsState.items
    .filter((item) => item.listId === listsState.selectedListId)
    .filter((item) => includeArchived ? true : !item.isArchived)
    .sort((a, b) => b.createdAt - a.createdAt);
}

function addList(name) {
  const trimmed = (name || '').trim();
  if (!trimmed) return;
  const maxOrder = listsState.lists.reduce((acc, l) => Math.max(acc, l.sortOrder ?? 0), 0);
  const list = { id: uid('list'), name: trimmed, sortOrder: maxOrder + 1 };
  listsState.lists.push(list);
  saveLists(listsState.lists);
  setSelectedList(list.id);
}

function renameList(id, name) {
  const target = listsState.lists.find((l) => l.id === id);
  if (!target) return;
  const trimmed = (name || '').trim();
  if (!trimmed) return;
  target.name = trimmed;
  saveLists(listsState.lists);
}

function reorderList(id, direction) {
  const ordered = getSortedLists();
  const idx = ordered.findIndex((l) => l.id === id);
  if (idx === -1) return;
  const swapIdx = direction < 0 ? idx - 1 : idx + 1;
  if (swapIdx < 0 || swapIdx >= ordered.length) return;
  const a = ordered[idx];
  const b = ordered[swapIdx];
  const temp = a.sortOrder;
  a.sortOrder = b.sortOrder;
  b.sortOrder = temp;
  listsState.lists = ordered;
  saveLists(listsState.lists);
  setSelectedList(id);
}

function deleteList(id) {
  if (!id) return;
  if (listsState.lists.length <= 1) return;
  const idx = listsState.lists.findIndex((l) => l.id === id);
  if (idx === -1) return;
  listsState.lists.splice(idx, 1);
  listsState.items = listsState.items.filter((i) => i.listId !== id);
  saveLists(listsState.lists);
  saveItems(listsState.items);
  const next = listsState.lists[idx] || listsState.lists[idx - 1] || listsState.lists[0];
  setSelectedList(next?.id || '');
}

function addItem(title) {
  const trimmed = (title || '').trim();
  if (!trimmed || !listsState.selectedListId) return;
  const item = {
    id: uid('item'),
    listId: listsState.selectedListId,
    title: trimmed,
    description: '',
    isArchived: false,
    createdAt: Date.now(),
  };
  listsState.items.unshift(item);
  saveItems(listsState.items);
}

function updateItemTitle(id, title) {
  const target = listsState.items.find((i) => i.id === id);
  if (!target) return;
  const trimmed = (title || '').trim();
  target.title = trimmed || target.title;
  saveItems(listsState.items);
}

function updateItemDescription(id, desc) {
  const target = listsState.items.find((i) => i.id === id);
  if (!target) return;
  target.description = desc || '';
  saveItems(listsState.items);
}

function archiveItem(id) {
  const target = listsState.items.find((i) => i.id === id);
  if (!target) return;
  target.isArchived = true;
  saveItems(listsState.items);
}

function restoreItem(id) {
  const target = listsState.items.find((i) => i.id === id);
  if (!target) return;
  target.isArchived = false;
  saveItems(listsState.items);
}

let headerRoot = null;
let headerContainer = null;
let itemsContainer = null;
let inputEl = null;
let archiveToggleBtn = null;
let openMenu = null;
let composerContainer = null;

function closeOpenMenu() {
  if (openMenu && openMenu.remove) openMenu.remove();
  openMenu = null;
}

function renderManageOverlay() {
  const existing = document.getElementById('meListsManageOverlay');
  if (existing) existing.remove();
  const overlay = document.createElement('div');
  overlay.id = 'meListsManageOverlay';
  overlay.className = 'fixed inset-0 z-50 flex items-center justify-center px-4';
  overlay.innerHTML = `
    <div class="absolute inset-0 bg-black/40 backdrop-blur-sm"></div>
    <div class="relative w-full max-w-md rounded-2xl bg-white dark:bg-slate-900 shadow-2xl border border-slate-200 dark:border-white/10 p-4 space-y-4">
      <div class="flex items-center justify-between">
        <div>
          <p class="text-[11px] uppercase tracking-wide text-slate-500 dark:text-white/60">Manage Lists</p>
          <h3 class="text-lg font-semibold text-slate-900 dark:text-white">Folders</h3>
        </div>
        <button type="button" id="meListsManageClose" class="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800" aria-label="Close manage lists">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </div>
      <div class="space-y-2 max-h-[320px] overflow-y-auto pr-1" id="meListsManageBody"></div>
      <div class="flex items-center gap-2">
        <input type="text" id="meListsManageAdd" placeholder="New list name" class="flex-1 rounded-md border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-800 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-netnet-purple" />
        <button type="button" id="meListsManageAddBtn" class="px-3 py-2 rounded-md bg-netnet-purple text-white text-sm font-semibold hover:bg-[#6020df]">Add</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);
  const body = overlay.querySelector('#meListsManageBody');
  const renderListRows = () => {
    if (!body) return;
    const lists = getSortedLists();
    body.innerHTML = lists.map((list, idx) => `
      <div class="flex items-center gap-2 rounded-lg border border-slate-100 dark:border-white/10 bg-white/70 dark:bg-slate-800/70 px-2 py-2">
        <input data-role="rename" data-id="${list.id}" value="${list.name.replace(/"/g, '&quot;')}" class="flex-1 bg-transparent border-none text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-netnet-purple rounded" />
        <div class="flex items-center gap-1">
          <button type="button" data-role="reorder-up" data-id="${list.id}" class="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-700" aria-label="Move up" ${idx === 0 ? 'disabled' : ''}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 19V5"/><path d="m5 12 7-7 7 7"/></svg>
          </button>
          <button type="button" data-role="reorder-down" data-id="${list.id}" class="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-700" aria-label="Move down" ${idx === lists.length - 1 ? 'disabled' : ''}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14"/><path d="m19 12-7 7-7-7"/></svg>
          </button>
          <button type="button" data-role="delete" data-id="${list.id}" class="p-1 rounded hover:bg-red-50 dark:hover:bg-red-900/40 text-red-500" aria-label="Delete list" ${lists.length <= 1 ? 'disabled' : ''}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
          </button>
        </div>
      </div>
    `).join('');

    body.querySelectorAll('[data-role="rename"]').forEach((input) => {
      const id = input.getAttribute('data-id');
      const commit = () => {
        renameList(id, input.value);
        renderItemsPanel();
      };
      input.onkeydown = (e) => {
        if (e.key === 'Enter') { e.preventDefault(); commit(); }
        if (e.key === 'Escape') { input.blur(); }
      };
      input.onblur = commit;
    });

    body.querySelectorAll('[data-role="reorder-up"]').forEach((btn) => {
      btn.onclick = () => { reorderList(btn.getAttribute('data-id'), -1); renderItemsPanel(); renderComposer(); renderListRows(); };
    });
    body.querySelectorAll('[data-role="reorder-down"]').forEach((btn) => {
      btn.onclick = () => { reorderList(btn.getAttribute('data-id'), 1); renderItemsPanel(); renderComposer(); renderListRows(); };
    });
    body.querySelectorAll('[data-role="delete"]').forEach((btn) => {
      btn.onclick = () => {
        const id = btn.getAttribute('data-id');
        if (confirm('Delete this list? Items in it will be removed.')) {
          deleteList(id);
          renderItemsPanel();
          renderComposer();
          renderListRows();
        }
      };
    });
  };

  renderListRows();

  const close = () => overlay.remove();
  const addInput = overlay.querySelector('#meListsManageAdd');
  const addBtn = overlay.querySelector('#meListsManageAddBtn');
  const closeBtn = overlay.querySelector('#meListsManageClose');
  overlay.querySelector('.absolute')?.addEventListener('click', close);
  if (closeBtn) closeBtn.onclick = close;
  const handleAdd = () => {
    if (!addInput) return;
    addList(addInput.value);
    addInput.value = '';
    renderItemsPanel();
    renderManageOverlay();
  };
  if (addBtn) addBtn.onclick = handleAdd;
  if (addInput) {
    addInput.onkeydown = (e) => { if (e.key === 'Enter') { e.preventDefault(); handleAdd(); } };
    setTimeout(() => addInput.focus(), 50);
  }
}

function renderHeader() {
  if (!headerContainer) return;
  if (!headerRoot) headerRoot = createRoot(headerContainer);
  headerRoot.render(h(SectionHeader, {
    title: 'Lists',
    showHelpIcon: false,
    showSecondaryRow: false,
  }));
}

function getBottomOffset() {
  const nav = document.getElementById('mobileBottomNav');
  const navHeight = nav ? nav.offsetHeight || 64 : 0;
  const isMobile = window.innerWidth < 768;
  const base = isMobile && navHeight ? navHeight + 12 : 16;
  return base;
}

function renderComposer() {
  if (!composerContainer) return;
  const bottomSpace = getBottomOffset();
  composerContainer.innerHTML = `
    <div id="meListComposerBar" class="fixed inset-x-0 z-40">
      <div class="mx-auto max-w-5xl px-4">
        <div class="rounded-2xl border border-slate-200 dark:border-white/10 bg-white/95 dark:bg-slate-900/95 shadow-lg backdrop-blur flex items-center gap-2 px-3 py-2" style="bottom:auto;">
          <form id="meListNewItemForm" class="flex items-center gap-2 w-full">
            <div class="flex-1 rounded-xl border border-slate-200 dark:border-white/20 bg-white dark:bg-slate-800 px-3 py-2 flex items-center gap-2 focus-within:ring-2 focus-within:ring-netnet-purple">
              <span class="text-slate-400">+</span>
              <input id="meListNewItemInput" type="text" placeholder="Add a list item" class="flex-1 bg-transparent focus:outline-none text-sm text-slate-900 dark:text-white" autocomplete="off" />
            </div>
            <button type="submit" class="sr-only">Add</button>
          </form>
        </div>
      </div>
    </div>
  `;
  const bar = document.getElementById('meListComposerBar');
  if (bar) {
    const safe = 'env(safe-area-inset-bottom, 0px)';
    bar.style.bottom = `calc(${safe} + ${bottomSpace}px)`;
  }
  const form = document.getElementById('meListNewItemForm');
  inputEl = document.getElementById('meListNewItemInput');
  if (form && inputEl) {
    form.onsubmit = (e) => {
      e.preventDefault();
      addItem(inputEl.value);
      inputEl.value = '';
      inputEl.focus();
      renderItemsPanel();
    };
    setTimeout(() => inputEl.focus(), 30);
  }
}

function openPromotionStub(type, item) {
  const shell = document.getElementById('app-shell');
  const drawer = document.getElementById('drawer-container');
  if (!drawer || !shell) return;
  const friendly = type === 'job' ? 'Job Task' : 'Quick Task';
  drawer.innerHTML = `
    <div id="app-drawer-backdrop"></div>
    <aside id="app-drawer" class="bg-white dark:bg-slate-900 text-slate-900 dark:text-white p-5 flex flex-col gap-4 w-full max-w-md">
      <div class="flex items-center justify-between">
        <div>
          <p class="text-xs uppercase tracking-wide text-slate-500 dark:text-white/60">Promote</p>
          <h2 class="text-lg font-semibold">Create ${friendly}</h2>
        </div>
        <button type="button" id="drawerCloseBtn" class="text-slate-500 hover:text-slate-800 dark:text-white/70 dark:hover:text-white" aria-label="Close promotion stub">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </div>
      <div class="space-y-3">
        <label class="flex flex-col gap-1 text-sm">
          <span class="text-xs uppercase tracking-wide text-slate-500 dark:text-white/60">Title</span>
          <input id="promoTitle" value="${item.title.replace(/"/g, '&quot;')}" class="w-full rounded-md border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-800 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-netnet-purple" />
        </label>
        <label class="flex flex-col gap-1 text-sm">
          <span class="text-xs uppercase tracking-wide text-slate-500 dark:text-white/60">Description</span>
          <textarea id="promoDesc" rows="3" class="w-full rounded-md border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-800 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-netnet-purple">${(item.description || '').replace(/</g, '&lt;')}</textarea>
        </label>
      </div>
      <div class="flex items-center justify-end gap-3">
        <button type="button" id="promoCancel" class="px-4 py-2 text-sm font-medium rounded-md border border-slate-200 dark:border-white/10">Cancel</button>
        <button type="button" id="promoCreate" class="px-4 py-2 text-sm font-semibold rounded-md bg-netnet-purple text-white hover:bg-[#6020df]">Create</button>
      </div>
    </aside>
  `;
  shell.classList.remove('drawer-closed');
  const close = () => shell.classList.add('drawer-closed');
  const closeBtn = drawer.querySelector('#drawerCloseBtn');
  const backdrop = drawer.querySelector('#app-drawer-backdrop');
  const cancel = drawer.querySelector('#promoCancel');
  const create = drawer.querySelector('#promoCreate');
  const titleInput = drawer.querySelector('#promoTitle');
  const descInput = drawer.querySelector('#promoDesc');
  [closeBtn, backdrop, cancel].forEach((el) => {
    if (el) el.onclick = close;
  });
  if (create) {
    create.onclick = () => {
      updateItemTitle(item.id, titleInput?.value || item.title);
      updateItemDescription(item.id, descInput?.value || item.description || '');
      archiveItem(item.id);
      renderItemsPanel();
      close();
    };
  }
}

function openPromotionMenu(item, anchor) {
  closeOpenMenu();
  const menu = document.createElement('div');
  menu.className = 'fixed z-50 bg-white dark:bg-slate-800 rounded-lg shadow-lg border border-slate-200 dark:border-white/10 w-48';
  menu.innerHTML = `
    <button type="button" data-action="promote-quick" class="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-slate-100 dark:hover:bg-slate-700">
      <span class="text-xs uppercase tracking-wide text-slate-500 dark:text-white/60">Promote</span>
      <span class="text-sm font-semibold text-slate-800 dark:text-white">Quick Task</span>
    </button>
    <button type="button" data-action="promote-job" class="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-slate-100 dark:hover:bg-slate-700">
      <span class="text-xs uppercase tracking-wide text-slate-500 dark:text-white/60">Promote</span>
      <span class="text-sm font-semibold text-slate-800 dark:text-white">Job Task</span>
    </button>
  `;
  const close = () => closeOpenMenu();
  document.body.appendChild(menu);
  openMenu = menu;
  const rect = anchor?.getBoundingClientRect();
  const menuRect = menu.getBoundingClientRect();
  if (rect) {
    const left = rect.right - (menuRect.width || 192);
    menu.style.top = `${rect.bottom + 6}px`;
    menu.style.left = `${Math.max(8, left)}px`;
  } else {
    menu.style.bottom = '80px';
    menu.style.left = '50%';
    menu.style.transform = 'translateX(-50%)';
  }
  const handle = (e) => {
    const action = e.target.closest('[data-action]')?.getAttribute('data-action');
    if (!action) return;
    if (action === 'promote-quick') openPromotionStub('quick', item);
    if (action === 'promote-job') openPromotionStub('job', item);
    close();
  };
  menu.addEventListener('click', handle);
  setTimeout(() => {
    document.addEventListener('click', close, { once: true });
  }, 0);
}

function wireLongPress(node, item) {
  let timer = null;
  const start = () => {
    timer = setTimeout(() => {
      openPromotionMenu(item);
    }, 550);
  };
  const clear = () => {
    if (timer) clearTimeout(timer);
    timer = null;
  };
  node.addEventListener('pointerdown', start);
  node.addEventListener('pointerup', clear);
  node.addEventListener('pointerleave', clear);
  node.addEventListener('pointercancel', clear);
}

function renderItemsPanel() {
  if (!itemsContainer) return;
  closeOpenMenu();
  const activeList = listsState.lists.find((l) => l.id === listsState.selectedListId);
  const items = getActiveItems(listsState.showArchived);
  itemsContainer.innerHTML = `
    <div class="flex flex-col gap-3">
      <div class="flex items-center justify-between gap-3 px-1 pt-1">
        <div class="flex items-center gap-2">
          <button type="button" id="meListSwitcher" class="inline-flex items-center gap-2 rounded-full border border-slate-200 dark:border-white/15 bg-white/80 dark:bg-slate-800 px-3 py-1.5 text-sm font-medium text-slate-800 dark:text-white hover:border-netnet-purple focus-visible:ring-2 focus-visible:ring-netnet-purple">
            <span class="h-2 w-2 rounded-full bg-netnet-purple"></span>
            <span>${activeList?.name || 'Lists'}</span>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
          </button>
          <span class="text-xs text-slate-500 dark:text-white/60">Capture layer</span>
        </div>
        <div class="flex items-center gap-2">
          <button type="button" id="meListsManageBtn" class="p-2 rounded-full border border-slate-200 dark:border-white/15 bg-white/80 dark:bg-slate-800 hover:border-netnet-purple focus-visible:ring-2 focus-visible:ring-netnet-purple" aria-label="Manage lists">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9c0 .69.4 1.31 1.02 1.6.19.1.4.15.61.15H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z"/></svg>
          </button>
          <button type="button" id="toggleArchived" class="text-xs font-semibold px-3 py-1.5 rounded-full border border-slate-200 dark:border-white/10 hover:border-netnet-purple hover:text-netnet-purple dark:hover:border-netnet-purple dark:hover:text-white" aria-pressed="${listsState.showArchived ? 'true' : 'false'}">
            ${listsState.showArchived ? 'Hide archived' : 'View archived'}
          </button>
        </div>
      </div>
    </div>
    <div id="meListItems" class="flex-1 px-1">
      <div id="meListItemsScroll" class="space-y-2 rounded-2xl bg-white/70 dark:bg-slate-900/60 border border-slate-100 dark:border-white/10 p-3 shadow-sm"></div>
    </div>
  `;

  archiveToggleBtn = document.getElementById('toggleArchived');
  if (archiveToggleBtn) {
    archiveToggleBtn.onclick = () => {
      listsState.showArchived = !listsState.showArchived;
      renderItemsPanel();
    };
  }

  const listArea = document.getElementById('meListItemsScroll');
  if (listArea) {
    listArea.innerHTML = items.length === 0 ? `
      <div class="rounded-xl border border-dashed border-slate-200 dark:border-white/15 bg-white/60 dark:bg-slate-800/60 p-6 text-center text-sm text-slate-600 dark:text-slate-300">
        <p class="font-medium mb-1">No items yet</p>
        <p class="text-xs text-slate-500 dark:text-white/60">Use the bottom bar to add items quickly.</p>
      </div>
    ` : items.map((item) => {
      const isExpanded = listsState.expandedItemId === item.id;
      const desc = item.description || '';
      const isArchived = !!item.isArchived;
      const actionLabel = isArchived ? 'Restore item' : 'Archive item';
      const actionRole = isArchived ? 'restore' : 'archive';
      const rowMuted = isArchived ? 'opacity-60' : '';
      const badge = isArchived ? '<span class="text-[11px] font-semibold uppercase tracking-wide text-amber-600 dark:text-amber-300">Archived</span>' : '';
      return `
        <div class="group relative flex items-start gap-3 rounded-xl border border-slate-200/70 dark:border-white/10 bg-white/80 dark:bg-slate-900/70 px-3 py-2.5 focus-within:border-netnet-purple ${rowMuted}">
          <button type="button" data-role="${actionRole}" data-id="${item.id}" class="mt-1 h-5 w-5 flex items-center justify-center rounded border border-slate-300 dark:border-white/30 bg-white dark:bg-slate-800 text-slate-500 hover:border-netnet-purple focus-visible:ring-2 focus-visible:ring-netnet-purple" aria-label="${actionLabel}">
            ${isArchived ? '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>' : '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>'}
          </button>
          <div class="flex-1 space-y-2">
            <div class="flex items-center gap-2">
              <input data-role="title" data-id="${item.id}" value="${item.title.replace(/"/g, '&quot;')}" class="w-full bg-transparent border-none px-0 text-sm font-medium text-slate-900 dark:text-white focus:outline-none focus:ring-0" />
              ${badge}
            </div>
            ${isExpanded ? `
              <textarea data-role="description" data-id="${item.id}" rows="3" class="w-full rounded-lg border border-slate-200 dark:border-white/15 bg-white/80 dark:bg-slate-800 px-3 py-2 text-sm text-slate-700 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-netnet-purple">${desc.replace(/</g, '&lt;')}</textarea>
            ` : (desc ? `<p class="text-sm text-slate-600 dark:text-slate-300 line-clamp-2">${desc}</p>` : `<button type="button" data-role="expand" data-id="${item.id}" class="text-xs text-slate-500 dark:text-white/60 hover:text-netnet-purple">Add description</button>`)}
          </div>
          <div class="opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition">
            <button type="button" data-role="menu" data-id="${item.id}" class="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-700 focus-visible:ring-2 focus-visible:ring-netnet-purple" aria-label="Open item menu">⋯</button>
          </div>
        </div>
      `;
    }).join('');

    const pad = getBottomOffset() + 140;
    listArea.style.paddingBottom = `${pad}px`;

    listArea.querySelectorAll('[data-role="archive"]').forEach((btn) => {
      btn.onclick = () => {
        const id = btn.getAttribute('data-id');
        archiveItem(id);
        renderItemsPanel();
      };
    });
    listArea.querySelectorAll('[data-role="restore"]').forEach((btn) => {
      btn.onclick = () => {
        const id = btn.getAttribute('data-id');
        restoreItem(id);
        renderItemsPanel();
      };
    });
    listArea.querySelectorAll('[data-role="title"]').forEach((input) => {
      const id = input.getAttribute('data-id');
      const original = input.value;
      input.onkeydown = (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          updateItemTitle(id, input.value);
          input.blur();
        } else if (e.key === 'Escape') {
          input.value = original;
          input.blur();
        }
      };
      input.onblur = () => updateItemTitle(id, input.value);
      input.onclick = () => {
        listsState.expandedItemId = id;
        renderItemsPanel();
      };
    });
    listArea.querySelectorAll('[data-role="description"]').forEach((input) => {
      const id = input.getAttribute('data-id');
      const handleSave = () => {
        updateItemDescription(id, input.value);
        listsState.expandedItemId = null;
        renderItemsPanel();
      };
      input.onkeydown = (e) => {
        if (e.key === 'Escape') {
          e.preventDefault();
          listsState.expandedItemId = null;
          renderItemsPanel();
        }
      };
      input.onblur = handleSave;
    });
    listArea.querySelectorAll('[data-role="expand"]').forEach((btn) => {
      btn.onclick = () => {
        listsState.expandedItemId = btn.getAttribute('data-id');
        renderItemsPanel();
      };
    });
    listArea.querySelectorAll('[data-role="menu"]').forEach((btn) => {
      btn.onclick = (e) => {
        e.stopPropagation();
        const id = btn.getAttribute('data-id');
        const item = listsState.items.find((i) => i.id === id);
        if (!item) return;
        openPromotionMenu(item, btn);
      };
    });
    listArea.querySelectorAll('.group').forEach((row) => {
      const id = row.querySelector('[data-role="title"]')?.getAttribute('data-id');
      const item = listsState.items.find((i) => i.id === id);
      if (item) wireLongPress(row, item);
    });
  }

  const switcherBtn = document.getElementById('meListSwitcher');
  if (switcherBtn) {
    switcherBtn.onclick = (e) => {
      e.stopPropagation();
      closeOpenMenu();
      const lists = getSortedLists();
      const menu = document.createElement('div');
      menu.className = 'fixed z-50 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-800 shadow-lg min-w-[160px]';
      menu.innerHTML = `
        <div class="py-1">
          ${lists.map((list) => `
            <button type="button" data-role="switch-to" data-id="${list.id}" class="w-full text-left px-3 py-2 text-sm ${list.id === listsState.selectedListId ? 'bg-slate-100 dark:bg-slate-700 font-semibold' : 'hover:bg-slate-50 dark:hover:bg-slate-700'}">${list.name}</button>
          `).join('')}
          <div class="px-3 py-2 border-t border-slate-100 dark:border-white/10">
            <input id="meListInlineAdd" type="text" placeholder="New list" class="w-full rounded-md border border-slate-200 dark:border-white/15 bg-white dark:bg-slate-800 px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-netnet-purple" />
          </div>
        </div>
      `;
      document.body.appendChild(menu);
      openMenu = menu;
      const rect = switcherBtn.getBoundingClientRect();
      menu.style.top = `${rect.bottom + 6}px`;
      menu.style.left = `${Math.min(rect.left, window.innerWidth - (menu.offsetWidth || 200) - 12)}px`;
      menu.querySelectorAll('[data-role="switch-to"]').forEach((btn) => {
        btn.onclick = () => {
          setSelectedList(btn.getAttribute('data-id'));
          listsState.expandedItemId = null;
          renderItemsPanel();
        };
      });
      const addInput = menu.querySelector('#meListInlineAdd');
      if (addInput) {
        addInput.onkeydown = (evt) => {
          if (evt.key === 'Enter') {
            addList(addInput.value);
            renderItemsPanel();
            closeOpenMenu();
          }
        };
        setTimeout(() => addInput.focus(), 30);
      }
      setTimeout(() => document.addEventListener('click', closeOpenMenu, { once: true }), 0);
    };
  }

  const manageBtn = document.getElementById('meListsManageBtn');
  if (manageBtn) manageBtn.onclick = () => renderManageOverlay();
}

export function renderMeListsPage(container = document.getElementById('app-main'), options = {}) {
  if (!container) {
    console.warn('[MeLists] container not found.');
    return;
  }

  const withHeader = options.withHeader !== false;

  listsState.lists = hydrateLists();
  listsState.items = hydrateItems();
  listsState.selectedListId = hydrateSelected(listsState.lists);

  container.classList.remove('flex', 'items-center', 'justify-center', 'h-full');
  container.innerHTML = `
    <div class="w-full max-w-5xl mx-auto flex flex-col gap-4 pb-12">
      ${withHeader ? '<div id="meListsHeader"></div>' : ''}
      <div class="rounded-2xl border border-slate-100 dark:border-white/10 bg-white/70 dark:bg-slate-900/70 shadow-sm p-3">
        <div id="meListsItems"></div>
      </div>
    </div>
    <div id="meListComposer"></div>
  `;

  headerContainer = withHeader ? document.getElementById('meListsHeader') : null;
  itemsContainer = document.getElementById('meListsItems');
  composerContainer = document.getElementById('meListComposer');

  renderHeader();
  renderItemsPanel();
  renderComposer();
}
