import { SectionHeader } from '../components/layout/SectionHeader.js';
import { mountCompanyLookup } from '../contacts/company-lookup.js';
import { mountPersonLookup } from '../contacts/person-lookup.js';
import { getContactsData, getIndividualsData } from '../contacts/contacts-data.js';

const { createElement: h } = React;
const { createRoot } = ReactDOM;

const LISTS_STORAGE_KEY = 'netnet_lists_v1';
const LIST_NODES_STORAGE_KEY = 'netnet_folders_v1';
const LEGACY_NODES_STORAGE_KEY = 'netnet_list_nodes_v1';
const LIST_ITEMS_STORAGE_KEY = 'netnet_list_items_v1';
const SELECTED_LIST_KEY = 'netnet_selected_list_v1';
const QUICK_TASK_ASSIGN_KEY = 'netnet_quick_task_assign_v1';

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
    { id: 'default', name: 'Default', sortOrder: 0, type: 'list', parentId: null },
    { id: 'ideas', name: 'Ideas', sortOrder: 1, type: 'list', parentId: null },
    { id: 'personal', name: 'Personal', sortOrder: 2, type: 'list', parentId: null },
  ];
  const storedNodes = safeLoad(LIST_NODES_STORAGE_KEY, null) || safeLoad(LEGACY_NODES_STORAGE_KEY, null);
  if (Array.isArray(storedNodes) && storedNodes.length) return storedNodes;
  const stored = safeLoad(LISTS_STORAGE_KEY, fallback);
  if (!Array.isArray(stored) || !stored.length) return fallback;
  const migrated = stored.map((l, idx) => {
    const name = (l.name || '').toLowerCase();
    const normalizedName = name === 'inbox' || name === 'capture' ? 'Default' : l.name;
    const normalizedId = name === 'inbox' || name === 'capture' ? 'default' : l.id;
    return {
      id: normalizedId,
      name: normalizedName,
      sortOrder: typeof l.sortOrder === 'number' ? l.sortOrder : idx,
      type: l.type || 'list',
      parentId: l.parentId ?? null,
    };
  });
  const hasDefault = migrated.some((l) => (l.name || '').toLowerCase() === 'default');
  if (!hasDefault) migrated.unshift({ id: 'default', name: 'Default', sortOrder: -1, type: 'list', parentId: null });
  return migrated;
}

function hydrateItems() {
  const stored = safeLoad(LIST_ITEMS_STORAGE_KEY, []);
  return Array.isArray(stored) ? stored : [];
}

function hydrateSelected(lists) {
  const stored = safeLoad(SELECTED_LIST_KEY, '');
  const exists = lists.find((l) => l.id === stored && l.type === 'list');
  const firstList = lists.find((l) => l.type === 'list');
  return exists ? exists.id : (firstList?.id || '');
}

function hydrateQuickTaskAssign() {
  const stored = safeLoad(QUICK_TASK_ASSIGN_KEY, null);
  if (!stored || typeof stored !== 'object') return { companyId: null, personId: null };
  return {
    companyId: stored.companyId || null,
    personId: stored.personId || null,
  };
}

const listsState = {
  lists: [],
  items: [],
  selectedListId: '',
  showArchived: false,
  expandedItemId: null,
  editingListId: null,
  search: '',
  multiSelect: false,
  selectedIds: new Set(),
  panelOpen: false,
  micActive: false,
  folderCollapsed: {},
  activeNodeId: '',
  addingChildFor: null,
  quickTaskAssignment: hydrateQuickTaskAssign(),
};

function saveLists(lists) {
  safeSave(LIST_NODES_STORAGE_KEY, lists);
}

function saveItems(items) {
  safeSave(LIST_ITEMS_STORAGE_KEY, items);
}

function saveSelected(id) {
  safeSave(SELECTED_LIST_KEY, id);
}

function saveQuickTaskAssign(assign) {
  safeSave(QUICK_TASK_ASSIGN_KEY, assign);
}

function setSelectedList(id) {
  listsState.selectedListId = id;
  listsState.activeNodeId = id;
  saveSelected(id);
}

function getSortedLists() {
  return [...listsState.lists].filter((l) => l.type === 'list').sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
}

function getFolders() {
  return listsState.lists.filter((n) => n.type === 'folder');
}

function getChildren(parentId = null) {
  return listsState.lists.filter((n) => (n.parentId ?? null) === (parentId ?? null)).sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
}

function isDescendant(nodeId, potentialParentId) {
  if (!potentialParentId) return false;
  let current = listsState.lists.find((n) => n.id === nodeId);
  while (current && current.parentId) {
    if (current.parentId === potentialParentId) return true;
    current = listsState.lists.find((n) => n.id === current.parentId);
  }
  return false;
}

function getActiveItems(includeArchived = false) {
  const term = (listsState.search || '').toLowerCase();
  return listsState.items
    .filter((item) => item.listId === listsState.selectedListId)
    .filter((item) => includeArchived ? true : !item.isArchived)
    .filter((item) => {
      if (!term) return true;
      const t = (item.title || '').toLowerCase();
      const d = (item.description || '').toLowerCase();
      return t.includes(term) || d.includes(term);
    })
    .sort((a, b) => b.createdAt - a.createdAt);
}

function addList(name, parentId = null) {
  const trimmed = (name || '').trim();
  if (!trimmed) return;
  const siblings = listsState.lists.filter((n) => (n.parentId ?? null) === (parentId ?? null));
  const maxOrder = siblings.reduce((acc, l) => Math.max(acc, l.sortOrder ?? 0), -1);
  const list = { id: uid('list'), name: trimmed, sortOrder: maxOrder + 1, type: 'list', parentId };
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

function addFolder(name, parentId = null) {
  const trimmed = (name || '').trim();
  if (!trimmed) return;
  const siblings = listsState.lists.filter((n) => (n.parentId ?? null) === (parentId ?? null));
  const maxOrder = siblings.reduce((acc, l) => Math.max(acc, l.sortOrder ?? 0), -1);
  const folder = { id: uid('folder'), name: trimmed, sortOrder: maxOrder + 1, type: 'folder', parentId };
  listsState.lists.push(folder);
  saveLists(listsState.lists);
}

function moveNode(id, newParentId = null) {
  const node = listsState.lists.find((n) => n.id === id);
  if (!node) return;
  if (node.id === newParentId) return;
  if (isDescendant(newParentId, node.id)) return;
  node.parentId = newParentId ?? null;
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

function deleteList(id, { cascade = false } = {}) {
  if (!id) return;
  const node = listsState.lists.find((l) => l.id === id);
  if (!node) return;
  if (node.type === 'folder') {
    const children = listsState.lists.filter((n) => n.parentId === id);
    if (children.length && !cascade) return;
    children.forEach((child) => deleteList(child.id, { cascade: true }));
    listsState.lists = listsState.lists.filter((n) => n.id !== id);
    saveLists(listsState.lists);
    return;
  }
  if (listsState.lists.filter((l) => l.type === 'list').length <= 1) return;
  listsState.lists = listsState.lists.filter((l) => l.id !== id);
  listsState.items = listsState.items.filter((i) => i.listId !== id);
  saveLists(listsState.lists);
  saveItems(listsState.items);
  const next = getSortedLists()[0];
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

function moveItemToList(itemId, listId) {
  const target = listsState.items.find((i) => i.id === itemId);
  if (!target || !listId) return;
  target.listId = listId;
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
let dragItemId = null;
let panelContainer = null;

function isDarkTheme() {
  return typeof document !== 'undefined' && document.documentElement.classList.contains('dark');
}

function closeOpenMenu() {
  if (openMenu && openMenu.remove) openMenu.remove();
  openMenu = null;
}

export function openListsVideoHelp() {
  const shell = document.getElementById('app-shell');
  const drawer = document.getElementById('drawer-container');
  if (!drawer) return;

  const closeDrawer = () => {
    shell?.classList.add('drawer-closed');
    const lightbox = document.getElementById('video-help-lightbox');
    if (lightbox) lightbox.remove();
  };

  const renderVideoDrawer = () => {
    const cfg = {
      primary: {
        title: 'Lists Overview',
        description: 'Capture items quickly, then promote to tasks.',
        videoUrl: 'https://videos.hellonetnet.com/watch/wo5umvj3',
        thumbnailSrc: 'public/assets/samples/vid-jobs.jpg',
      },
      related: [],
    };
    const videos = [
      { ...(cfg.primary || {}), index: 0 },
      ...(cfg.related || []).map((v, idx) => ({ ...v, index: idx + 1 })),
    ].filter(v => v.videoUrl);

    drawer.innerHTML = `
      <div id="app-drawer-backdrop"></div>
      <aside id="app-drawer" class="bg-white dark:bg-slate-900 text-slate-900 dark:text-white p-0 flex flex-col w-full max-w-md">
        <div class="flex items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-white/10">
          <div>
            <h2 class="text-base font-semibold">Video Help</h2>
            <p class="text-xs text-slate-500 dark:text-white/70">Lists guidance</p>
          </div>
          <button type="button" id="sectionHelpClose" class="text-slate-500 hover:text-slate-800 dark:text-white/70 dark:hover:text-white p-1" aria-label="Close video help">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
        <div class="flex-1 overflow-y-auto p-4 space-y-5">
          ${videos[0] ? `
            <button class="w-full text-left group relative rounded-lg overflow-hidden border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5" data-video-index="0">
              <div class="relative h-48">
                <img src="${videos[0].thumbnailSrc || ''}" alt="Thumbnail for ${videos[0].title || 'video'}" class="w-full h-full object-cover">
                <div class="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                <div class="absolute inset-0 flex items-center justify-center">
                  <div class="h-12 w-12 rounded-full bg-netnet-purple text-white flex items-center justify-center shadow-lg">
                    <svg viewBox="0 0 24 24" class="h-5 w-5" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
                  </div>
                </div>
              </div>
              <div class="p-3 space-y-1">
                <div class="text-sm font-semibold text-slate-900 dark:text-white">${videos[0].title || ''}</div>
                <p class="text-xs text-slate-600 dark:text-white/70">${videos[0].description || ''}</p>
              </div>
            </button>
          ` : '<div class="text-sm text-slate-600 dark:text-white/70">No video provided.</div>'}
        </div>
      </aside>
    `;

    const closeBtn = drawer.querySelector('#sectionHelpClose');
    const backdrop = drawer.querySelector('#app-drawer-backdrop');
    const buttons = drawer.querySelectorAll('[data-video-index]');
    buttons.forEach(btn => {
      btn.addEventListener('click', () => {
        window.open(videos[0]?.videoUrl || 'https://videos.hellonetnet.com', '_blank');
      });
    });
    const close = () => closeDrawer();
    if (closeBtn) closeBtn.onclick = close;
    if (backdrop) backdrop.onclick = close;
    shell?.classList.remove('drawer-closed');
  };

  renderVideoDrawer();
}

export function getListsHeaderState() {
  return {
    search: listsState.search,
    showArchived: listsState.showArchived,
    panelOpen: listsState.panelOpen,
    micActive: listsState.micActive,
    multiSelect: listsState.multiSelect,
  };
}

export function setListsSearch(val) {
  listsState.search = val || '';
}

export function toggleListsPanel() {
  listsState.panelOpen = !listsState.panelOpen;
  renderManagePanel();
}

export function toggleListsArchive() {
  listsState.showArchived = !listsState.showArchived;
  listsState.selectedIds = new Set();
  listsState.multiSelect = false;
  renderItemsPanel();
}

export function toggleListsMultiSelect() {
  listsState.multiSelect = !listsState.multiSelect;
  if (!listsState.multiSelect) listsState.selectedIds = new Set();
  renderItemsPanel();
}

export function refreshListsBody() {
  renderItemsPanel();
  renderManagePanel();
  renderComposer(false);
}
function renderManagePanel() {
  if (!panelContainer) return;
  panelContainer.innerHTML = '';
  panelContainer.className = listsState.panelOpen
    ? 'w-80 h-full flex-shrink-0 transition-all duration-200'
    : 'w-0 h-full overflow-hidden transition-all duration-200';
  if (!listsState.panelOpen) return;
  const panel = document.createElement('div');
  panel.className = 'h-full flex flex-col bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-white/10 shadow-lg';
  panel.innerHTML = `
    <div class="flex items-center justify-between px-4 py-3 border-b border-slate-100 dark:border-white/10">
      <div>
        <p class="text-[11px] uppercase tracking-wide text-slate-500 dark:text-white/60">YOUR</p>
        <p class="text-base font-semibold text-slate-900 dark:text-white">Folders</p>
      </div>
      <button type="button" id="meListsPanelClose" class="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800" aria-label="Close lists panel">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </div>
      <div class="flex-1 overflow-y-auto px-3 py-3 space-y-2" id="meListsPanelBody"></div>
      <div class="border-t border-slate-100 dark:border-white/10 px-3 py-2 flex items-center gap-2 sticky bottom-0 bg-white dark:bg-slate-900">
        <input id="meListsPanelComposerInput" type="text" placeholder="New folder" class="flex-1 rounded-md border border-slate-200 dark:border-white/15 bg-white dark:bg-slate-800 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-netnet-purple" />
        <button type="button" id="meListsPanelSubfolderBtn" class="nn-btn nn-btn--micro inline-flex items-center justify-center text-slate-700 dark:text-white bg-white dark:bg-slate-900 border border-slate-300 dark:border-white/10 hover:bg-slate-50 dark:hover:bg-slate-800 focus-visible:ring-2 focus-visible:ring-netnet-purple" title="Sub-folder" aria-label="Sub-folder">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7h5l2 2h11v9a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2z"/><path d="M8 7V5a2 2 0 0 1 2-2h3" /></svg>
        </button>
        <button type="button" id="meListsPanelAddFolderBtn" class="nn-btn nn-btn--micro inline-flex items-center justify-center text-white bg-netnet-purple border border-slate-300 dark:border-white/10 hover:bg-[#6020df] focus-visible:ring-2 focus-visible:ring-netnet-purple" title="Add folder" aria-label="Add folder">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
        </button>
        <span class="text-[11px] text-slate-400 dark:text-white/60">Composer OK — Build E</span>
      </div>
  `;
  panelContainer.appendChild(panel);

  const body = panel.querySelector('#meListsPanelBody');
  const dragState = { id: null };
  const renderTree = (parentId = null, depth = 0) => {
    const children = getChildren(parentId);
    return children.map((node) => {
      const isFolder = node.type === 'folder';
      const isActive = node.id === listsState.activeNodeId;
      const nameClass = isActive ? (isDarkTheme() ? 'font-semibold text-emerald-400' : 'font-semibold text-netnet-purple') : 'text-slate-800 dark:text-white';
      const indent = depth * 14;
      const collapsed = !!listsState.folderCollapsed[node.id];
      const handleColor = isDarkTheme() ? 'text-white' : 'text-netnet-purple';
      return `
        <div class="space-y-1" data-node="${node.id}">
          <div class="group flex items-center gap-2 rounded-lg border border-slate-200 dark:border-white/10 px-2 py-2 bg-white/80 dark:bg-slate-800/70" style="margin-left:${indent}px" data-list-id="${node.id}" draggable="true" data-type="${node.type}">
            <button type="button" data-role="drag-handle" aria-label="Drag to reorder" class="cursor-grab p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-700 opacity-70 group-hover:opacity-100">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" class="${handleColor}"><circle cx="9" cy="5" r="1"/><circle cx="15" cy="5" r="1"/><circle cx="9" cy="12" r="1"/><circle cx="15" cy="12" r="1"/><circle cx="9" cy="19" r="1"/><circle cx="15" cy="19" r="1"/></svg>
            </button>
            ${isFolder ? `
              <button type="button" data-role="toggle" data-id="${node.id}" aria-label="Toggle folder" class="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-700">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="${collapsed ? '' : 'rotate-90'} transition-transform"><polyline points="9 18 15 12 9 6"/></svg>
              </button>
            ` : '<div class="w-6"></div>'}
            <button type="button" data-role="switch" data-id="${node.id}" class="flex-1 text-left text-sm ${nameClass}">${node.name}</button>
            <div class="flex items-center gap-1">
              ${isFolder ? `
                <button type="button" data-role="add-subfolder" data-id="${node.id}" class="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-700" aria-label="Add subfolder">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 5v14"/><path d="M5 12h14"/></svg>
                </button>
              ` : ''}
              <button type="button" data-role="delete" data-id="${node.id}" class="p-1 rounded hover:bg-red-50 dark:hover:bg-red-900/40 text-red-500" aria-label="Delete" ${(node.type === 'list' && listsState.lists.filter((n) => n.type === 'list').length <= 1) ? 'disabled' : ''}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
              </button>
            </div>
          </div>
          ${isFolder && listsState.addingChildFor === node.id ? `
            <div class="flex items-center gap-2" style="margin-left:${indent + 14}px">
              <input data-role="new-subfolder-input" data-parent="${node.id}" type="text" placeholder="New sub-folder" class="flex-1 rounded-md border border-slate-200 dark:border-white/15 bg-white dark:bg-slate-800 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-netnet-purple" />
            </div>
          ` : ''}
          ${isFolder && collapsed ? '' : renderTree(node.id, depth + 1)}
        </div>
      `;
    }).join('');
  };
  body.innerHTML = renderTree(null, 0);

  panel.querySelectorAll('[data-role="switch"]').forEach((btn) => {
    btn.onclick = () => {
      const id = btn.getAttribute('data-id');
      const node = listsState.lists.find((n) => n.id === id);
      if (node?.type === 'list') {
        setSelectedList(node.id);
        listsState.activeNodeId = node.id;
        listsState.expandedItemId = null;
        listsState.selectedIds = new Set();
        renderItemsPanel();
        renderComposer(false);
      } else if (node?.type === 'folder') {
        listsState.activeNodeId = node.id;
        listsState.folderCollapsed[id] = !listsState.folderCollapsed[id];
        renderManagePanel();
      }
    };
  });
  const rows = panel.querySelectorAll('[data-list-id]');
  rows.forEach((row) => {
    row.addEventListener('dragstart', (e) => {
      dragState.id = row.getAttribute('data-list-id');
      e.dataTransfer.effectAllowed = 'move';
    });
    row.addEventListener('dragover', (e) => {
      e.preventDefault();
      row.classList.add(isDarkTheme() ? 'border-emerald-400' : 'border-netnet-purple');
    });
    row.addEventListener('dragleave', () => row.classList.remove('border-emerald-400', 'border-netnet-purple'));
    row.addEventListener('drop', (e) => {
      e.preventDefault();
      row.classList.remove('border-emerald-400', 'border-netnet-purple');
      const targetId = row.getAttribute('data-list-id');
      if (!dragState.id || dragState.id === targetId) return;
      const moving = listsState.lists.find((n) => n.id === dragState.id);
      const target = listsState.lists.find((n) => n.id === targetId);
      if (!moving || !target) return;
      // Prevent cycles
      if (target.type === 'folder' && isDescendant(target.id, moving.id)) return;

      // Reparent if dropping onto folder
      const newParent = target.type === 'folder' ? target.id : target.parentId ?? null;
      moving.parentId = newParent;

      // Reorder within new parent
      const siblings = listsState.lists
        .filter((n) => (n.parentId ?? null) === (newParent ?? null))
        .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
      const fromIdx = siblings.findIndex((n) => n.id === moving.id);
      if (fromIdx > -1) siblings.splice(fromIdx, 1);
      const toIdx = siblings.findIndex((n) => n.id === target.id);
      const insertAt = target.type === 'folder' ? siblings.length : Math.max(0, toIdx);
      siblings.splice(insertAt, 0, moving);
      siblings.forEach((n, idx) => { n.sortOrder = idx; });

      saveLists(listsState.lists);
      renderManagePanel();
    });
  });
  panel.querySelectorAll('[data-role="delete"]').forEach((btn) => {
    btn.onclick = () => {
      if (confirm('Delete this list? Items will be removed.')) {
        deleteList(btn.getAttribute('data-id'));
        renderItemsPanel();
        renderManagePanel();
      }
    };
  });
  panel.querySelectorAll('[data-role="add-subfolder"]').forEach((btn) => {
    btn.onclick = () => {
      listsState.addingChildFor = btn.getAttribute('data-id');
      renderManagePanel();
    };
  });

  const closeBtn = panel.querySelector('#meListsPanelClose');
  if (closeBtn) closeBtn.onclick = () => { listsState.panelOpen = false; renderManagePanel(); };
  const composerInput = panel.querySelector('#meListsPanelComposerInput');
  const subfolderBtn = panel.querySelector('#meListsPanelSubfolderBtn');
  const addFolderBtn = panel.querySelector('#meListsPanelAddFolderBtn');

  const getTrimmedName = () => (composerInput?.value || '').trim();
  const isActiveFolder = () => {
    const active = listsState.lists.find((n) => n.id === listsState.activeNodeId);
    return active && active.type === 'folder';
  };
  const updateComposerDisabled = () => {
    const name = getTrimmedName();
    const hasName = !!name;
    const hasActiveFolder = isActiveFolder();
    if (subfolderBtn) {
      subfolderBtn.disabled = !hasName || !hasActiveFolder;
      subfolderBtn.classList.toggle('opacity-50', subfolderBtn.disabled);
    }
    if (addFolderBtn) {
      addFolderBtn.disabled = !hasName;
      addFolderBtn.classList.toggle('opacity-50', addFolderBtn.disabled);
    }
  };

  const createRootFolder = () => {
    const name = getTrimmedName();
    if (!name) return;
    addFolder(name, null);
    if (composerInput) {
      composerInput.value = '';
      composerInput.focus();
    }
    renderManagePanel();
  };

  const createSubFolder = () => {
    const name = getTrimmedName();
    const active = listsState.lists.find((n) => n.id === listsState.activeNodeId);
    if (!name || !active || active.type !== 'folder') return;
    addFolder(name, active.id);
    if (composerInput) {
      composerInput.value = '';
      composerInput.focus();
    }
    renderManagePanel();
  };

  if (composerInput) {
    composerInput.onkeydown = (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        if (isActiveFolder()) createSubFolder();
        else createRootFolder();
      }
      if (e.key === 'Escape') {
        composerInput.value = '';
        updateComposerDisabled();
      }
    };
    composerInput.oninput = updateComposerDisabled;
  }
  if (subfolderBtn) subfolderBtn.onclick = createSubFolder;
  if (addFolderBtn) addFolderBtn.onclick = createRootFolder;
  updateComposerDisabled();
  body.querySelectorAll('[data-role="new-subfolder-input"]').forEach((input) => {
    const parentId = input.getAttribute('data-parent');
    input.onkeydown = (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        addFolder(input.value, parentId);
        listsState.addingChildFor = null;
        renderManagePanel();
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        listsState.addingChildFor = null;
        renderManagePanel();
      }
    };
    setTimeout(() => input.focus(), 20);
  });
}
function renderManageOverlay() {
  // Deprecated overlay (arrows removed)
  return null;
}

function renderHeader() {
  if (!headerContainer) return;
  if (!headerRoot) headerRoot = createRoot(headerContainer);
  const rightActions = [];
  const micIcon = h('svg', { width: 16, height: 16, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round', className: listsState.micActive ? 'text-netnet-purple' : 'text-slate-700 dark:text-white' }, [
    h('path', { d: 'M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z' }),
    h('path', { d: 'M19 10v2a7 7 0 0 1-14 0v-2' }),
    h('line', { x1: 12, y1: 19, x2: 12, y2: 23 }),
    h('line', { x1: 8, y1: 23, x2: 16, y2: 23 }),
  ]);
  const archiveIcon = h('svg', { width: 16, height: 16, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round', className: listsState.showArchived ? 'text-netnet-purple' : 'text-slate-700 dark:text-white' }, [
    h('rect', { x: 3, y: 4, width: 18, height: 4, rx: 1 }),
    h('path', { d: 'M5 8v11a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8' }),
    h('line', { x1: 10, y1: 12, x2: 14, y2: 12 }),
  ]);
  const folderIcon = h('svg', { width: 16, height: 16, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round', className: listsState.panelOpen ? 'text-netnet-purple' : 'text-slate-700 dark:text-white' }, [
    h('path', { d: 'M3 6h5l2 2h11v10a2 2 0 0 1-2 2H3z' }),
    h('path', { d: 'M3 6h5l2 2h9a2 2 0 0 1 2 2' }),
  ]);
  const microBtn = (child, onClick, aria) => h('button', {
    type: 'button',
    className: 'nn-btn nn-btn--micro inline-flex items-center justify-center text-slate-700 dark:text-white bg-white dark:bg-slate-900 border border-slate-300 dark:border-white/10 hover:bg-slate-50 dark:hover:bg-slate-800 focus-visible:ring-2 focus-visible:ring-netnet-purple',
    onClick,
    'aria-label': aria,
  }, child);
  const multiBtn = h('button', {
    type: 'button',
    className: 'nn-btn nn-btn--micro inline-flex items-center justify-center text-slate-700 dark:text-white bg-white dark:bg-slate-900 border border-slate-300 dark:border-white/10 hover:bg-slate-50 dark:hover:bg-slate-800 focus-visible:ring-2 focus-visible:ring-netnet-purple',
    onClick: () => {
      listsState.multiSelect = !listsState.multiSelect;
      if (!listsState.multiSelect) listsState.selectedIds = new Set();
      renderItemsPanel();
      renderHeader();
    },
    'aria-pressed': listsState.multiSelect ? 'true' : 'false',
  }, listsState.multiSelect ? 'Cancel' : 'Multi-select');
  const leftActions = [multiBtn];
  rightActions.push(microBtn(folderIcon, () => { listsState.panelOpen = !listsState.panelOpen; renderManagePanel(); renderHeader(); }, 'Lists panel'));
  rightActions.push(microBtn(archiveIcon, () => {
    listsState.showArchived = !listsState.showArchived;
    listsState.selectedIds = new Set();
    listsState.multiSelect = false;
    renderItemsPanel();
    renderHeader();
  }, 'Toggle archive'));
  rightActions.push(microBtn(micIcon, () => {
    listsState.micActive = !listsState.micActive;
    renderHeader();
  }, 'Toggle mic'));
  rightActions.push(microBtn(
    h('svg', { width: 16, height: 16, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round', className: 'text-slate-700 dark:text-white' }, [
      h('circle', { cx: 12, cy: 12, r: 10 }),
      h('polygon', { points: '10 8 16 12 10 16 10 8' }),
    ]),
    () => openVideoHelp(),
    'Video help'
  ));
  if (listsState.showArchived) {
    rightActions.push(microBtn(
      h('svg', { width: 14, height: 14, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round' }, [
        h('polyline', { points: '3 6 5 6 21 6' }),
        h('path', { d: 'M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6' }),
        h('path', { d: 'M10 11v6' }),
        h('path', { d: 'M14 11v6' }),
        h('path', { d: 'M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2' }),
      ]),
      () => {
        if (confirm('Empty archive? This cannot be undone.')) {
          listsState.items = listsState.items.filter((i) => !i.isArchived);
          saveItems(listsState.items);
          renderItemsPanel();
          renderHeader();
        }
      },
      'Empty archive'
    ));
  }
  if (listsState.multiSelect && listsState.selectedIds.size > 0 && !listsState.showArchived) {
    rightActions.push(microBtn(
      h('svg', { width: 14, height: 14, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round' }, [
        h('polyline', { points: '3 6 5 6 21 6' }),
        h('path', { d: 'M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6' }),
        h('path', { d: 'M10 11v6' }),
        h('path', { d: 'M14 11v6' }),
        h('path', { d: 'M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2' }),
      ]),
      () => {
        if (confirm('Delete selected items?')) {
          listsState.items = listsState.items.filter((i) => !listsState.selectedIds.has(i.id));
          listsState.selectedIds = new Set();
          saveItems(listsState.items);
          renderItemsPanel();
          renderHeader();
        }
      },
      'Delete selected'
    ));
  }
  headerRoot.render(h(SectionHeader, {
    title: h('div', { className: 'flex items-center gap-2' }, [
      h('span', { className: 'text-sm text-slate-500 dark:text-white/70' }, 'Me'),
      h('span', { className: 'text-slate-400 dark:text-white/50' }, '›'),
      h('span', { className: 'text-2xl font-semibold text-slate-900 dark:text-white' }, 'Lists'),
    ]),
    showHelpIcon: false,
    showSecondaryRow: true,
    leftActions,
    showSearch: true,
    searchPlaceholder: 'Search list…',
    searchValue: listsState.search,
    onSearchChange: (val) => {
      listsState.search = val || '';
      renderItemsPanel();
    },
    rightActions,
  }));
}

function getBottomOffset() {
  const nav = document.getElementById('mobileBottomNav');
  const navHeight = nav ? nav.offsetHeight || 64 : 0;
  const isMobile = window.innerWidth < 768;
  const base = isMobile && navHeight ? navHeight + 12 : 16;
  return base;
}

function renderComposer(focusInput = false) {
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
              <button type="button" id="meListMicToggle" class="p-2 rounded-full text-slate-500 dark:text-white/80 hover:bg-slate-100 dark:hover:bg-slate-800 focus-visible:ring-2 focus-visible:ring-netnet-purple" aria-pressed="${listsState.micActive ? 'true' : 'false'}" aria-label="${listsState.micActive ? 'Disable mic' : 'Enable mic'}">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="${listsState.micActive ? 'text-netnet-purple' : ''}">
                  <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
                  <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                  <line x1="12" y1="19" x2="12" y2="23" />
                  <line x1="8" y1="23" x2="16" y2="23" />
                </svg>
              </button>
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
  const micToggle = document.getElementById('meListMicToggle');
  if (form && inputEl) {
    form.onsubmit = (e) => {
      e.preventDefault();
      addItem(inputEl.value);
      inputEl.value = '';
      inputEl.focus();
      renderItemsPanel();
    };
    if (focusInput) setTimeout(() => inputEl.focus(), 30);
    if (listsState.micActive) inputEl.classList.add('ring-2', 'ring-netnet-purple');
    else inputEl.classList.remove('ring-2', 'ring-netnet-purple');
  }
  if (micToggle) {
    micToggle.onclick = () => {
      listsState.micActive = !listsState.micActive;
      renderComposer(false);
    };
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
    <button type="button" data-action="create-task" class="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-slate-100 dark:hover:bg-slate-700">
      <span class="text-sm font-semibold text-slate-800 dark:text-white">Create Task</span>
    </button>
    <button type="button" data-action="move" class="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-slate-100 dark:hover:bg-slate-700">
      <span class="text-sm text-slate-800 dark:text-white">Move to…</span>
    </button>
    <button type="button" data-action="delete" class="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-red-50 dark:hover:bg-red-900/30 text-red-600 dark:text-red-300">
      <span class="text-sm font-semibold">Delete</span>
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
    if (action === 'create-task') openCreateTaskPanel(item);
    if (action === 'move') openMoveMenu(item);
    if (action === 'delete') {
      if (confirm('Delete this item?')) {
        listsState.items = listsState.items.filter((i) => i.id !== item.id);
        saveItems(listsState.items);
        renderItemsPanel();
      }
    }
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

function openMoveMenu(item) {
  closeOpenMenu();
  const menu = document.createElement('div');
  menu.className = 'fixed z-50 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-800 shadow-lg min-w-[180px]';
  const lists = getSortedLists();
  menu.innerHTML = `
    <div class="py-1">
      ${lists.map((list) => `
        <button type="button" data-role="move-to" data-id="${list.id}" class="w-full text-left px-3 py-2 text-sm ${list.id === item.listId ? 'bg-slate-100 dark:bg-slate-700 font-semibold' : 'hover:bg-slate-50 dark:hover:bg-slate-700'}">${list.name}</button>
      `).join('')}
    </div>
  `;
  document.body.appendChild(menu);
  openMenu = menu;
  menu.style.top = '40%';
  menu.style.left = '50%';
  menu.style.transform = 'translate(-50%, -50%)';
  menu.querySelectorAll('[data-role="move-to"]').forEach((btn) => {
    btn.onclick = () => {
      moveItemToList(item.id, btn.getAttribute('data-id'));
      renderItemsPanel();
      closeOpenMenu();
    };
  });
  setTimeout(() => document.addEventListener('click', closeOpenMenu, { once: true }), 0);
}

function openFullEditorModal(desc, onSave) {
  const layerId = 'lists-full-editor';
  let layer = document.getElementById(layerId);
  if (!layer) {
    layer = document.createElement('div');
    layer.id = layerId;
    document.body.appendChild(layer);
  }
  layer.innerHTML = `
    <div class="nn-modal-overlay" role="presentation">
      <div class="nn-modal-card max-w-4xl w-full" role="dialog" aria-modal="true" aria-label="Full editor">
        <div class="lookup-modal__header flex items-center justify-between">
          <h3>Full editor</h3>
          <button type="button" id="listsFullEditorClose" class="p-2 rounded hover:bg-slate-100 dark:hover:bg-slate-800" aria-label="Close full editor">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
        <div class="lookup-modal__body">
          <div class="rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 p-3 min-h-[320px]">
            <p class="text-xs uppercase tracking-wide text-slate-500 dark:text-white/60 mb-2">Description</p>
            <div contenteditable="true" id="listsFullEditorInput" class="min-h-[160px] rounded-md border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-800 p-3 text-sm text-slate-800 dark:text-white">${desc || ''}</div>
          </div>
        </div>
        <div class="lookup-modal__actions">
          <button type="button" class="lookup-btn ghost" id="listsFullEditorCancel">Cancel</button>
          <button type="button" class="lookup-btn primary" id="listsFullEditorSave">Save</button>
        </div>
      </div>
    </div>
  `;
  const cleanup = () => { layer.innerHTML = ''; };
  layer.querySelector('#listsFullEditorCancel')?.addEventListener('click', cleanup);
  layer.querySelector('#listsFullEditorClose')?.addEventListener('click', cleanup);
  layer.querySelector('.nn-modal-overlay')?.addEventListener('click', (e) => { if (e.target === layer.querySelector('.nn-modal-overlay')) cleanup(); });
  layer.querySelector('#listsFullEditorSave')?.addEventListener('click', () => {
    const val = layer.querySelector('#listsFullEditorInput')?.innerHTML || '';
    cleanup();
    if (onSave) onSave(val);
  });
}

function openCreateTaskPanel(item) {
  const shell = document.getElementById('app-shell');
  const drawer = document.getElementById('drawer-container');
  if (!drawer || !shell) return;
  const existingDesc = item.description || '';
  drawer.innerHTML = `
    <div id="app-drawer-backdrop"></div>
    <aside id="app-drawer" class="bg-white dark:bg-slate-900 text-slate-900 dark:text-white p-0 flex flex-col w-full max-w-md">
      <div class="flex items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-white/10">
        <div>
          <p class="text-[11px] uppercase tracking-wide text-slate-500 dark:text-white/60">Create Task</p>
          <h2 class="text-lg font-semibold">From list item</h2>
        </div>
        <button type="button" id="drawerCloseBtn" class="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800" aria-label="Close create task">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </div>
      <div class="p-4 space-y-4 text-sm" id="listsCreateTaskBody">
        <div class="inline-flex rounded-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-white/10 p-1" role="group" aria-label="Task type">
          <button type="button" data-role="task-type" data-value="quick" class="px-3 py-1 rounded-full text-sm font-semibold bg-white dark:bg-slate-700 shadow border border-slate-200 dark:border-white/10">Quick Task</button>
          <button type="button" data-role="task-type" data-value="job" class="px-3 py-1 rounded-full text-sm text-slate-600 dark:text-white/70">Job Task</button>
        </div>
        <div class="space-y-2" data-panel="quick">
          <label class="flex flex-col gap-1">Assignee <input class="rounded-md border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-800 px-3 py-2" placeholder="Select assignee (mock)" /></label>
          <label class="flex flex-col gap-1">Due date <input type="date" class="rounded-md border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-800 px-3 py-2" /></label>
          <label class="flex flex-col gap-1">Estimated hours <input type="number" class="rounded-md border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-800 px-3 py-2" placeholder="0" /></label>
          <label class="flex flex-col gap-1">Client <input class="rounded-md border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-800 px-3 py-2" placeholder="Search clients (mock)" /></label>
          <div class="pt-2 border-t border-slate-200 dark:border-white/10">
            <p class="text-[11px] uppercase tracking-wide text-slate-500 dark:text-white/60">Contact</p>
            <div id="listsQuickContactLookup" class="mt-2 space-y-3"></div>
          </div>
        </div>
        <div class="space-y-2 hidden" data-panel="job">
          <label class="flex flex-col gap-1">Job <input class="rounded-md border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-800 px-3 py-2" placeholder="Select job (mock)" /></label>
          <label class="flex flex-col gap-1">Deliverable <input class="rounded-md border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-800 px-3 py-2" placeholder="Select deliverable (mock)" /></label>
          <label class="flex flex-col gap-1">Assignee <input class="rounded-md border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-800 px-3 py-2" placeholder="Select assignee (mock)" /></label>
          <label class="flex flex-col gap-1">Due date <input type="date" class="rounded-md border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-800 px-3 py-2" /></label>
          <label class="flex flex-col gap-1">Estimated hours <input type="number" class="rounded-md border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-800 px-3 py-2" placeholder="0" /></label>
        </div>
        <label class="flex flex-col gap-1">Title <input id="listsCreateTitle" class="rounded-md border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-800 px-3 py-2" value="${item.title.replace(/"/g, '&quot;')}" /></label>
        <div class="space-y-2">
          <div class="flex items-center justify-between">
            <span class="text-xs uppercase tracking-wide text-slate-500 dark:text-white/60">Description</span>
            <button type="button" id="listsOpenFullEditor" class="text-xs text-netnet-purple dark:text-white hover:underline">Open full editor</button>
          </div>
          <div class="rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900">
            <div class="flex items-center gap-2 px-2 py-1 border-b border-slate-100 dark:border-white/10 text-slate-500 dark:text-white/70 text-xs">
              <span class="px-2 py-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800">B</span>
              <span class="px-2 py-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800">I</span>
              <span class="px-2 py-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800">Link</span>
            </div>
            <div id="listsCreateDesc" contenteditable="true" class="min-h-[140px] px-3 py-2 text-sm text-slate-800 dark:text-white focus:outline-none" aria-label="Description">${existingDesc}</div>
          </div>
        </div>
      </div>
      <div class="p-4 border-t border-slate-200 dark:border-white/10 flex items-center justify-end gap-3">
        <button type="button" id="listsCreateCancel" class="px-4 py-2 rounded-md border border-slate-200 dark:border-white/10 text-sm">Cancel</button>
        <button type="button" id="listsCreateSave" class="px-4 py-2 rounded-md bg-netnet-purple text-white text-sm font-semibold hover:bg-[#6020df]">Create</button>
      </div>
    </aside>
  `;
  shell.classList.remove('drawer-closed');
  const close = () => shell.classList.add('drawer-closed');
  const togglePanels = (type) => {
    drawer.querySelectorAll('[data-panel]').forEach((el) => el.classList.toggle('hidden', el.getAttribute('data-panel') !== type));
    drawer.querySelectorAll('[data-role="task-type"]').forEach((btn) => {
      const active = btn.getAttribute('data-value') === type;
      btn.classList.toggle('bg-white', active);
      btn.classList.toggle('dark:bg-slate-700', active);
      btn.classList.toggle('shadow', active);
      btn.classList.toggle('border', active);
      btn.classList.toggle('text-slate-600', !active);
      btn.classList.toggle('dark:text-white/70', !active);
    });
  };
  drawer.querySelectorAll('[data-role="task-type"]').forEach((btn) => {
    btn.onclick = () => togglePanels(btn.getAttribute('data-value') || 'quick');
  });
  togglePanels('quick');

  const contactRoot = drawer.querySelector('#listsQuickContactLookup');
  if (contactRoot) {
    const findCompanyById = (id) => getContactsData().find(c => String(c.id) === String(id)) || null;
    const findPersonById = (id) => {
      const companies = getContactsData();
      for (const company of companies) {
        const match = (company.people || []).find(p => String(p.id) === String(id));
        if (match) return { ...match, companyId: company.id, companyName: company.name, type: 'company' };
      }
      const standalone = getIndividualsData().find(p => String(p.id) === String(id));
      return standalone ? { ...standalone, companyId: null, companyName: '', type: 'standalone' } : null;
    };

    let selectedCompany = listsState.quickTaskAssignment.companyId
      ? findCompanyById(listsState.quickTaskAssignment.companyId)
      : null;
    let selectedPerson = listsState.quickTaskAssignment.personId
      ? findPersonById(listsState.quickTaskAssignment.personId)
      : null;

    const updateAssignment = () => {
      listsState.quickTaskAssignment = {
        companyId: selectedCompany?.id || null,
        personId: selectedPerson?.id || null,
      };
      saveQuickTaskAssign(listsState.quickTaskAssignment);
    };

    contactRoot.innerHTML = `
      <div id="quickTaskCompanyLookup"></div>
      <div id="quickTaskPersonLookup"></div>
    `;
    const companySlot = contactRoot.querySelector('#quickTaskCompanyLookup');
    const personSlot = contactRoot.querySelector('#quickTaskPersonLookup');

    let personLookupApi = null;
    const renderCompanyLookup = (value) => {
      if (!companySlot) return;
      companySlot.innerHTML = '';
      mountCompanyLookup(companySlot, {
        label: 'Company',
        placeholder: 'Search companies...',
        value,
        onChange: (company) => {
          selectedCompany = company;
          if (!company) {
            selectedPerson = null;
          }
          personLookupApi?.setCompany(company);
          personLookupApi?.setValue(null);
          updateAssignment();
        },
      });
    };

    renderCompanyLookup(selectedCompany);
    if (personSlot) {
      personLookupApi = mountPersonLookup(personSlot, {
        label: 'Person',
        placeholder: selectedCompany ? 'Search people...' : 'Search people...',
        value: selectedPerson,
        company: selectedCompany,
        onChange: (person, meta) => {
          selectedPerson = person;
          if (meta?.companyCreated && !selectedCompany) {
            selectedCompany = meta.companyCreated;
            renderCompanyLookup(selectedCompany);
            personLookupApi?.setCompany(selectedCompany);
          }
          updateAssignment();
        },
      });
    }
    updateAssignment();
  }

  drawer.querySelector('#drawerCloseBtn')?.addEventListener('click', close);
  drawer.querySelector('#listsCreateCancel')?.addEventListener('click', close);
  drawer.querySelector('#app-drawer-backdrop')?.addEventListener('click', close);
  drawer.querySelector('#listsCreateSave')?.addEventListener('click', () => {
    // mock create: archive item and close
    archiveItem(item.id);
    renderItemsPanel();
    close();
  });
  drawer.querySelector('#listsOpenFullEditor')?.addEventListener('click', () => {
    const descInput = drawer.querySelector('#listsCreateDesc');
    openFullEditorModal(descInput?.innerHTML || '', (val) => {
      if (descInput) descInput.innerHTML = val;
    });
  });
}

function renderItemsPanel() {
  if (!itemsContainer) return;
  closeOpenMenu();
  const activeList = listsState.lists.find((l) => l.id === listsState.selectedListId);
  const items = getActiveItems(listsState.showArchived);
  itemsContainer.innerHTML = `
    <div class="flex flex-col gap-2">
      <div class="flex items-center gap-2 px-2">
        <span class="inline-flex items-center gap-2 rounded-full border border-transparent px-2 py-1 text-sm font-semibold text-slate-800 dark:text-white">
          <span class="h-2 w-2 rounded-full bg-netnet-purple"></span>
          <span>${activeList?.name || 'Default'}</span>
        </span>
      </div>
    </div>
    <div id="meListItems" class="flex-1 overflow-y-auto contacts-scroll pb-36 md:pb-32">
      <div id="meListItemsScroll" class="space-y-2 bg-white/70 dark:bg-slate-900/60 border border-slate-100 dark:border-white/10 shadow-sm px-0"></div>
    </div>
  `;

  archiveToggleBtn = document.getElementById('toggleArchived');
  if (archiveToggleBtn) {
    archiveToggleBtn.onclick = () => {
      listsState.showArchived = !listsState.showArchived;
      listsState.selectedIds = new Set();
      listsState.multiSelect = false;
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
      const isSelected = listsState.selectedIds.has(item.id);
      return `
        <div class="group relative flex items-start gap-3 rounded-none border border-slate-200/70 dark:border-white/10 bg-white/80 dark:bg-slate-900/70 px-6 py-3 focus-within:border-netnet-purple ${rowMuted}" draggable="true" data-drag-id="${item.id}">
          <div class="mt-1 flex items-center">
            ${listsState.multiSelect ? `
              <input type="checkbox" data-role="select" data-id="${item.id}" ${isSelected ? 'checked' : ''} class="h-4 w-4 rounded border-slate-300 dark:border-white/30 text-netnet-purple focus:ring-netnet-purple" aria-label="Select item">
            ` : `
              <button type="button" data-role="${actionRole}" data-id="${item.id}" class="h-5 w-5 flex items-center justify-center rounded border border-slate-300 dark:border-white/30 bg-white dark:bg-slate-800 text-slate-500 hover:border-netnet-purple focus-visible:ring-2 focus-visible:ring-netnet-purple" aria-label="${actionLabel}">
                ${isArchived ? '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>' : '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>'}
              </button>
            `}
          </div>
          <div class="flex-1 space-y-2">
            <div class="flex items-center gap-2">
              <input data-role="title" data-id="${item.id}" value="${item.title.replace(/"/g, '&quot;')}" class="w-full bg-transparent border-none px-0 text-sm font-medium text-slate-900 dark:text-white focus:outline-none focus:ring-0" />
              ${badge}
            </div>
            ${isExpanded ? `
              <textarea data-role="description" data-id="${item.id}" rows="3" class="w-full rounded-lg border border-slate-200 dark:border-white/15 bg-white/80 dark:bg-slate-800 px-3 py-2 text-sm text-slate-700 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-netnet-purple">${desc.replace(/</g, '&lt;')}</textarea>
            ` : (desc ? `<p class="text-sm text-slate-600 dark:text-slate-300 line-clamp-2">${desc}</p>` : `<button type="button" data-role="expand" data-id="${item.id}" class="text-xs text-slate-500 dark:text-white/60 hover:text-netnet-purple">Add description</button>`)}
          </div>
          <div class="flex items-start">
            <button type="button" data-role="menu" data-id="${item.id}" class="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-700 focus-visible:ring-2 focus-visible:ring-netnet-purple text-slate-600 dark:text-white" aria-label="Open item menu">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="5" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="12" cy="19" r="1"/></svg>
            </button>
          </div>
        </div>
      `;
    }).join('');

    const pad = getBottomOffset() + 160;
    listArea.style.paddingBottom = `${pad}px`;

    listArea.querySelectorAll('[data-role="select"]').forEach((input) => {
      input.onchange = () => {
        const id = input.getAttribute('data-id');
        if (input.checked) listsState.selectedIds.add(id); else listsState.selectedIds.delete(id);
        renderHeader();
      };
    });
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
      if (item) {
        wireLongPress(row, item);
        row.ondragstart = (e) => { dragItemId = item.id; e.dataTransfer?.setData('text/plain', item.id); };
      }
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
          listsState.selectedIds = new Set();
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
  if (manageBtn) manageBtn.onclick = () => { listsState.panelOpen = !listsState.panelOpen; renderManagePanel(); };

  renderManagePanel();
}

export function renderMeListsPage(container = document.getElementById('app-main'), options = {}) {
  if (!container) {
    console.warn('[MeLists] container not found.');
    return;
  }

  const withHeader = options.withHeader !== false;

  listsState.lists = hydrateLists();
  listsState.items = hydrateItems().map((i) => {
    if (i.listId === 'inbox') return { ...i, listId: 'default' };
    if (i.listId === 'capture') return { ...i, listId: 'default' };
    return i;
  });
  saveLists(listsState.lists);
  saveItems(listsState.items);
  listsState.selectedListId = hydrateSelected(listsState.lists);
  listsState.activeNodeId = listsState.selectedListId || '';
  listsState.selectedIds = new Set();
  listsState.multiSelect = false;

  container.classList.remove('flex', 'items-center', 'justify-center', 'h-full');
  container.innerHTML = `
    <div class="w-full h-full flex flex-col gap-3">
      ${withHeader ? '<div id="meListsHeader" class="px-4"></div>' : ''}
      <div class="flex-1 overflow-hidden px-2 md:px-4">
        <div class="h-full flex gap-4">
          <div id="meListsItems" class="flex-1 h-full"></div>
          <div id="meListsPanelContainer" class="w-0 h-full overflow-hidden transition-all duration-200"></div>
        </div>
      </div>
    </div>
    <div id="meListComposer"></div>
  `;

  headerContainer = withHeader ? document.getElementById('meListsHeader') : null;
  itemsContainer = document.getElementById('meListsItems');
  composerContainer = document.getElementById('meListComposer');
  panelContainer = document.getElementById('meListsPanelContainer');

  if (withHeader) renderHeader();
  renderItemsPanel();
  renderManagePanel();
  renderComposer(false);
}
