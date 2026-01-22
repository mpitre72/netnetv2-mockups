import { SectionHeader } from '../components/layout/SectionHeader.js';
import { navigate } from '../router.js';
import { openQuickTaskDrawer } from '../quick-tasks/quick-task-detail.js';
const { createElement: h, useEffect, useMemo, useRef, useState } = React;
const { createRoot } = ReactDOM;

const MY_LISTS_STORAGE_KEY = 'netnet_my_lists_items_v1';
const MY_LISTS_FOLDERS_STORAGE_KEY = 'netnet_my_lists_folders_v1';
export const NETNET_LAST_LIST_ITEM_KEY = 'netnet_my_lists_last_item_v1';
const MENU_ACTIONS = [
  { key: 'move', label: 'Move to folder…' },
  { key: 'create-task', label: 'Create Task…' },
  { key: 'delete', label: 'Delete' },
];

function safeLoadItems() {
  try {
    const raw = localStorage.getItem(MY_LISTS_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(parsed)) return [];
    return parsed.map((item) => ({
      ...item,
      isArchived: !!item.isArchived,
      folderId: item.folderId ?? null,
    }));
  } catch (e) {
    return [];
  }
}

function safeSaveItems(items) {
  try {
    localStorage.setItem(MY_LISTS_STORAGE_KEY, JSON.stringify(items));
  } catch (e) {
    // Ignore write failures in prototype
  }
}

export function addMyListItem({ title, notes = '', folderId = null } = {}) {
  const trimmed = String(title || '').trim();
  if (!trimmed) return null;
  const items = safeLoadItems();
  const item = {
    id: uid(),
    title: trimmed,
    notes: String(notes || '').trim(),
    isArchived: false,
    createdAt: Date.now(),
    folderId: folderId ?? null,
  };
  safeSaveItems([item, ...items]);
  return item;
}

export function loadMyListItems() {
  return safeLoadItems();
}

export function deleteMyListItem(itemId) {
  if (!itemId) return false;
  const items = safeLoadItems();
  const next = items.filter((item) => String(item.id) !== String(itemId));
  if (next.length === items.length) return false;
  safeSaveItems(next);
  return true;
}

function rememberLastListItem(itemId) {
  try {
    if (!itemId) return;
    localStorage.setItem(NETNET_LAST_LIST_ITEM_KEY, String(itemId));
  } catch (e) {
    // Ignore storage errors in prototype
  }
}

function safeLoadFolders() {
  try {
    const raw = localStorage.getItem(MY_LISTS_FOLDERS_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return sanitizeFolders(Array.isArray(parsed) ? parsed : []);
  } catch (e) {
    return [];
  }
}

function safeSaveFolders(folders) {
  try {
    localStorage.setItem(MY_LISTS_FOLDERS_STORAGE_KEY, JSON.stringify(folders));
  } catch (e) {
    // Ignore write failures in prototype
  }
}

function sanitizeFolders(folders) {
  if (!Array.isArray(folders)) return [];
  const withIds = folders.filter((f) => f && f.id).map((f) => {
    const rawName = typeof f.name === 'string' ? f.name.trim() : '';
    return {
      id: f.id,
      name: rawName || 'General',
    parentId: f.parentId ?? null,
    sortOrder: typeof f.sortOrder === 'number' ? f.sortOrder : 0,
    };
  });
  const idSet = new Set(withIds.map((f) => f.id));
  const idMap = new Map(withIds.map((f) => [f.id, f]));

  // Fix missing parent references
  withIds.forEach((f) => {
    if (!f.parentId || !idSet.has(f.parentId) || f.parentId === f.id) {
      f.parentId = null;
    }
  });

  // Break cycles
  withIds.forEach((f) => {
    const path = new Set([f.id]);
    let current = f;
    while (current.parentId) {
      const parent = idMap.get(current.parentId);
      if (!parent) {
        current.parentId = null;
        break;
      }
      if (path.has(parent.id)) {
        current.parentId = null;
        break;
      }
      path.add(parent.id);
      current = parent;
    }
  });

  return normalizeSortOrders(withIds, null);
}

function uid() {
  return `mylist-${Date.now().toString(36)}-${Math.random().toString(16).slice(2)}`;
}

function MyListsNav({ active }) {
  const NAV = [
    { value: 'tasks', label: 'My Tasks', hash: '#/app/me/tasks' },
    { value: 'my-lists', label: 'My Lists', hash: '#/app/me/my-lists' },
    { value: 'time', label: 'My Time', hash: '#/app/me/time' },
    { value: 'performance', label: 'My Performance', hash: '#/app/me/performance' },
  ];
  return h('div', { className: 'flex flex-wrap items-center gap-2' },
    NAV.map((opt) => h('button', {
      key: opt.value,
      type: 'button',
      'data-my-lists-nav': opt.value,
      className: `px-3 py-1 rounded-full text-sm font-medium border transition-colors ${opt.value === active
        ? 'bg-[var(--color-brand-purple,#711FFF)] text-white border-transparent shadow-sm'
        : 'border-slate-200 dark:border-white/20 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800'}`,
      onClick: () => navigate(opt.hash),
    }, opt.label)),
  );
}

function IconMic() {
  return h('svg', { viewBox: '0 0 24 24', className: 'h-4 w-4' }, [
    h('rect', { x: 9, y: 4, width: 6, height: 12, rx: 3, ry: 3, fill: 'currentColor' }),
    h('path', { d: 'M5 11a7 7 0 0 0 14 0', stroke: 'currentColor', strokeWidth: 1.8, fill: 'none', strokeLinecap: 'round' }),
    h('path', { d: 'M12 19v3', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round' }),
  ]);
}

function ToggleButton({ active, onClick, label }) {
  return h('button', {
    type: 'button',
    onClick,
    'aria-pressed': active ? 'true' : 'false',
    className: `inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm font-medium transition-colors ${
      active
        ? 'border-[var(--color-brand-purple,#711FFF)] text-[var(--color-brand-purple,#711FFF)] bg-[var(--color-brand-purple,#711FFF)]/10'
        : 'border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-100 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800'
    }`,
  }, label);
}

function getChildren(nodes, parentId = null) {
  return nodes
    .filter((n) => (n.parentId ?? null) === (parentId ?? null))
    .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
}

function folderDotClass(depth) {
  if (depth <= 0) return 'bg-emerald-500';
  if (depth === 1) return 'bg-amber-400';
  if (depth === 2) return 'bg-netnet-purple';
  return 'bg-white/80';
}

function getBottomOffset() {
  if (typeof window === 'undefined') return 16;
  const nav = document.getElementById('mobileBottomNav');
  const navHeight = nav ? nav.offsetHeight || 64 : 0;
  const isMobile = window.innerWidth < 768;
  return isMobile && navHeight ? navHeight + 12 : 16;
}

function isDescendant(nodes, nodeId, potentialParentId) {
  if (!nodeId || !potentialParentId) return false;
  let current = nodes.find((n) => n.id === potentialParentId);
  while (current) {
    if (current.parentId === nodeId) return true;
    current = nodes.find((n) => n.id === current.parentId);
  }
  return false;
}

function normalizeSortOrders(nodes, parentId = null) {
  const next = [...nodes];
  const children = getChildren(next, parentId);
  children.forEach((child, idx) => {
    child.sortOrder = idx;
    normalizeSortOrders(next, child.id);
  });
  return next;
}

function moveFolder(nodes, dragId, targetId, makeChild = false) {
  if (dragId === targetId) return nodes;
  const drag = nodes.find((n) => n.id === dragId);
  const target = nodes.find((n) => n.id === targetId);
  if (!drag || !target) return nodes;
  if (isDescendant(nodes, drag.id, target.id)) return nodes;
  const next = [...nodes];
  const dragRef = next.find((n) => n.id === drag.id);
  if (!dragRef) return nodes;
  dragRef.parentId = makeChild ? target.id : (target.parentId ?? null);
  const siblings = getChildren(next, dragRef.parentId).filter((s) => s.id !== dragRef.id);
  const targetIdx = siblings.findIndex((s) => s.id === target.id);
  if (targetIdx >= 0) siblings.splice(targetIdx, 0, dragRef);
  const ordered = targetIdx >= 0 ? siblings : [...siblings, dragRef];
  ordered.forEach((node, idx) => { node.sortOrder = idx; });
  return normalizeSortOrders(next, null);
}

function ControlsRow({
  multiSelect,
  setMultiSelect,
  selectedCount,
  allSelected,
  onToggleSelectAll,
  onOpenDeleteConfirm,
  searchTerm,
  setSearchTerm,
  foldersOpen,
  setFoldersOpen,
  showArchive,
  setShowArchive,
  onClearSelection,
}) {
  const microBtn = (child, onClick, aria, active = false) => h('button', {
    type: 'button',
    className: `nn-btn nn-btn--micro inline-flex items-center justify-center text-slate-700 dark:text-white bg-white dark:bg-slate-900 border border-slate-300 dark:border-white/10 hover:bg-slate-50 dark:hover:bg-slate-800 focus-visible:ring-2 focus-visible:ring-netnet-purple ${active ? 'ring-1 ring-netnet-purple text-netnet-purple' : ''}`,
    onClick,
    'aria-label': aria,
  }, child);
  const multiBtn = h('button', {
    type: 'button',
    className: 'nn-btn nn-btn--micro inline-flex items-center justify-center text-slate-700 dark:text-white bg-white dark:bg-slate-900 border border-slate-300 dark:border-white/10 hover:bg-slate-50 dark:hover:bg-slate-800 focus-visible:ring-2 focus-visible:ring-netnet-purple',
    onClick: () => {
      const next = !multiSelect;
      setMultiSelect(next);
      if (!next) onClearSelection?.();
    },
    'aria-pressed': multiSelect ? 'true' : 'false',
    title: multiSelect ? 'Cancel multi-select' : 'Multi-select',
  }, h('svg', {
    width: 16,
    height: 16,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.8,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    className: multiSelect ? 'text-netnet-purple' : 'text-slate-700 dark:text-white',
  }, multiSelect
    ? [h('line', { x1: 6, y1: 6, x2: 18, y2: 18 }), h('line', { x1: 6, y1: 18, x2: 18, y2: 6 })]
    : [h('rect', { x: 4, y: 4, width: 16, height: 16, rx: 2 }), h('path', { d: 'M8 12h8' }), h('path', { d: 'M12 8v8' })]));

  const NAV = [
    { value: 'tasks', label: 'My Tasks', hash: '#/app/me/tasks' },
    { value: 'my-lists', label: 'My Lists', hash: '#/app/me/my-lists' },
    { value: 'time', label: 'My Time', hash: '#/app/me/time' },
    { value: 'performance', label: 'My Performance', hash: '#/app/me/performance' },
  ];

  const folderIcon = h('svg', { width: 16, height: 16, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round', className: foldersOpen ? 'text-netnet-purple' : 'text-slate-700 dark:text-white' }, [
    h('path', { d: 'M3 6h5l2 2h11v10a2 2 0 0 1-2 2H3z' }),
    h('path', { d: 'M3 6h5l2 2h9a2 2 0 0 1 2 2' }),
  ]);
  const archiveIcon = h('svg', { width: 16, height: 16, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round', className: showArchive ? 'text-netnet-purple' : 'text-slate-700 dark:text-white' }, [
    h('rect', { x: 3, y: 4, width: 18, height: 4, rx: 1 }),
    h('path', { d: 'M5 8v11a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8' }),
    h('line', { x1: 10, y1: 12, x2: 14, y2: 12 }),
  ]);

  return h('div', { className: 'flex items-center gap-2 flex-wrap md:flex-nowrap rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 shadow-sm px-3 py-2' }, [
    h('div', { className: 'flex items-center gap-2 flex-shrink-0' }, [
      multiBtn,
      multiSelect ? h('label', { className: 'inline-flex items-center gap-2 text-sm text-slate-700 dark:text-slate-100' }, [
        h('input', {
          type: 'checkbox',
          checked: allSelected,
          onChange: onToggleSelectAll,
          className: 'mt-1 h-4 w-4 border border-slate-300 dark:border-white/20 bg-white dark:bg-slate-900',
        }),
        h('span', null, `Select all${selectedCount ? ` (${selectedCount})` : ''}`),
      ]) : null,
      multiSelect ? h('button', {
        type: 'button',
        onClick: onOpenDeleteConfirm,
        disabled: selectedCount === 0,
        className: `inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm font-medium transition-colors ${selectedCount === 0
          ? 'border-slate-200 dark:border-white/10 text-slate-400 dark:text-white/40 bg-white dark:bg-slate-900 cursor-not-allowed'
          : 'border-slate-200 dark:border-white/10 text-red-600 dark:text-red-400 bg-white dark:bg-slate-900 hover:bg-red-50 dark:hover:bg-red-900/40'}`,
        title: 'Delete selected items',
      }, [
        h('svg', { viewBox: '0 0 24 24', className: 'h-4 w-4', fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round' }, [
          h('polyline', { points: '3 6 5 6 21 6' }),
          h('path', { d: 'M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6' }),
          h('path', { d: 'M10 11v6' }),
          h('path', { d: 'M14 11v6' }),
          h('path', { d: 'M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2' }),
        ]),
        h('span', null, 'Trash'),
      ]) : null,
    ]),
    h('div', { className: 'flex items-center gap-2 flex-wrap' }, NAV.map((opt) => h('button', {
      key: opt.value,
      type: 'button',
      className: `px-3 py-1 rounded-full text-sm font-medium border transition-colors ${opt.value === 'my-lists'
        ? 'bg-[var(--color-brand-purple,#711FFF)] text-white border-transparent shadow-sm'
        : 'border-slate-200 dark:border-white/20 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800'}`,
      onClick: () => navigate(opt.hash),
    }, opt.label))),
    h('div', { className: 'flex-1 min-w-[220px]' }, [
      h('div', { className: 'relative w-full' }, [
        h('input', {
          type: 'search',
          placeholder: 'Search lists…',
          value: searchTerm,
          onChange: (e) => setSearchTerm(e.target.value),
          className: 'w-full rounded-md border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 px-3 py-2 text-sm text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-[var(--color-brand-purple,#711FFF)]',
        }),
      ]),
    ]),
    h('div', { className: 'flex items-center gap-2 flex-shrink-0 ml-auto' }, [
      microBtn(folderIcon, () => setFoldersOpen((v) => !v), 'Lists panel', foldersOpen),
      microBtn(archiveIcon, () => setShowArchive(!showArchive), 'Toggle archive', showArchive),
    ]),
  ]);
}

function MenuButton({ onToggle, isOpen }) {
  return h('button', {
    type: 'button',
    className: `p-1 rounded-md border border-transparent hover:border-slate-200 dark:hover:border-white/10 text-slate-600 dark:text-white ${isOpen ? 'bg-slate-100 dark:bg-slate-800' : ''}`,
    onClick: (e) => {
      e.stopPropagation();
      onToggle(e);
    },
    title: 'More options',
  }, h('svg', { viewBox: '0 0 24 24', className: 'h-5 w-5', fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round' }, [
    h('circle', { cx: 12, cy: 6, r: 1 }),
    h('circle', { cx: 12, cy: 12, r: 1 }),
    h('circle', { cx: 12, cy: 18, r: 1 }),
  ]));
}

function OptionsMenu({ isOpen, onClose, position }) {
  if (!isOpen) return null;
  return h('div', {
    className: 'absolute right-0 top-8 z-50 w-44 rounded-md border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 shadow-lg py-1',
    onClick: (e) => e.stopPropagation(),
    style: position ? { position: 'fixed', top: position.top, left: position.left } : { position: 'fixed' },
  }, MENU_ACTIONS.map(action => {
    const destructive = action.key === 'delete';
    const base = 'w-full text-left px-3 py-2 text-sm';
    const palette = destructive
      ? 'text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/40'
      : 'text-slate-700 dark:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-800';
    return h('button', {
      key: action.key,
      type: 'button',
      className: `${base} ${palette}`,
      onClick: () => { onClose(action.key); },
    }, action.label);
  }));
}

function FolderOptionsMenu({ isOpen, onClose, position }) {
  if (!isOpen) return null;
  return h('div', {
    className: 'absolute right-0 top-8 z-50 w-44 rounded-md border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 shadow-lg py-1',
    onClick: (e) => e.stopPropagation(),
    style: position ? { position: 'fixed', top: position.top, left: position.left } : { position: 'fixed' },
  }, [
    h('button', {
      type: 'button',
      className: 'w-full text-left px-3 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/40',
      onClick: () => onClose('delete'),
    }, 'Delete folder…'),
  ]);
}

function ItemsList({
  items,
  multiSelect,
  selectedIds,
  onSelectToggle,
  onToggleComplete,
  openMenuId,
  setOpenMenuId,
  setOpenMenuPos,
  openMenuPos,
  isArchiveView,
  onMoveRequest,
  onCreateTask,
  onDeleteItem,
  editingTitleId,
  titleDraft,
  onStartEditTitle,
  onChangeTitleDraft,
  onSaveTitle,
  onCancelEditTitle,
  editingNotesId,
  notesDraft,
  onStartEditNotes,
  onChangeNotesDraft,
  onSaveNotes,
  onCancelEditNotes,
}) {
  if (!items.length) {
    return h('div', { className: 'text-sm text-slate-500 dark:text-slate-300' }, isArchiveView ? 'No archived items yet.' : 'No list items yet.');
  }
  const showSelection = !!multiSelect;
  return h('div', { className: 'space-y-3' },
    items.map((item) => h('div', {
      key: item.id,
      className: 'relative w-full rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 p-3 shadow-sm',
      style: { overflow: 'visible' },
      onClick: () => rememberLastListItem(item.id),
    }, [
      h('div', { className: 'flex items-start justify-between gap-3' }, [
        h('div', { className: 'flex items-start gap-3 flex-1 min-w-0' }, [
          showSelection ? h('input', {
            type: 'checkbox',
            checked: selectedIds.has(item.id),
            onChange: () => onSelectToggle(item.id),
            className: 'mt-1 h-4 w-4 border border-slate-300 dark:border-white/30 bg-white dark:bg-slate-900',
          }) : null,
          !showSelection ? h('button', {
            type: 'button',
            onClick: () => onToggleComplete(item.id),
            className: 'mt-1 h-5 w-5 flex items-center justify-center rounded border border-slate-300 dark:border-white/30 bg-white dark:bg-slate-800 text-slate-500 hover:border-netnet-purple focus-visible:ring-2 focus-visible:ring-netnet-purple',
            title: isArchiveView ? 'Restore to active' : 'Mark complete (archive)',
          }, item.isArchived
            ? h('svg', { width: 14, height: 14, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' }, [
              h('polyline', { points: '15 18 9 12 15 6' }),
            ])
            : h('svg', { width: 14, height: 14, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' }, [
              h('polyline', { points: '20 6 9 17 4 12' }),
            ])
          ) : null,
          h('div', { className: 'flex-1 min-w-0 space-y-1' }, [
            editingTitleId === item.id && !showSelection ? h('input', {
              type: 'text',
              value: titleDraft,
              onChange: (e) => onChangeTitleDraft(e.target.value),
              onKeyDown: (e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  onSaveTitle(item.id, titleDraft);
                }
                if (e.key === 'Escape') {
                  e.preventDefault();
                  onCancelEditTitle();
                }
              },
              onBlur: () => onSaveTitle(item.id, titleDraft),
              className: 'w-full bg-transparent border-none px-0 text-sm font-medium text-slate-900 dark:text-white focus:outline-none focus:ring-0',
              autoFocus: true,
            }) : h('div', {
              className: 'text-sm font-medium text-slate-900 dark:text-white cursor-text',
              onClick: showSelection ? undefined : () => onStartEditTitle(item),
            }, item.title),
            editingNotesId === item.id && !showSelection ? h('textarea', {
              value: notesDraft,
              rows: 3,
              onChange: (e) => onChangeNotesDraft(e.target.value),
              onKeyDown: (e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  onSaveNotes(item.id, notesDraft);
                }
                if (e.key === 'Escape') {
                  e.preventDefault();
                  onCancelEditNotes();
                }
              },
              onBlur: () => onSaveNotes(item.id, notesDraft),
              className: 'mt-1 w-full rounded-lg border border-slate-200 dark:border-white/15 bg-white/80 dark:bg-slate-800 px-3 py-2 text-sm text-slate-700 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-netnet-purple',
              autoFocus: true,
            }) : h('p', {
              className: 'mt-1 text-sm text-slate-600 dark:text-slate-300 cursor-text',
              onClick: showSelection ? undefined : () => onStartEditNotes(item),
            }, (item.notes || '').trim() ? item.notes : 'Add description'),
          ]),
        ]),
        h('div', { className: 'flex items-center gap-2' }, [
          isArchiveView ? h('span', { className: 'text-[11px] uppercase tracking-wide text-slate-400 dark:text-white/60' }, 'Archived') : null,
          h('div', { className: 'relative flex items-center' }, [
            h(MenuButton, {
              onToggle: (evt) => {
                const isOpen = openMenuId === item.id;
                if (isOpen) {
                  setOpenMenuId(null);
                  setOpenMenuPos(null);
                  return;
                }
                const rect = evt?.currentTarget?.getBoundingClientRect?.();
                if (rect) {
                  const left = Math.max(8, rect.right - 176);
                  const top = rect.bottom + 6;
                  setOpenMenuPos({ left, top });
                } else {
                  setOpenMenuPos(null);
                }
                setOpenMenuId(item.id);
              },
              isOpen: openMenuId === item.id,
            }),
            h(OptionsMenu, {
              isOpen: openMenuId === item.id,
              position: openMenuPos,
              onClose: (action) => {
                setOpenMenuId(null);
                setOpenMenuPos(null);
                if (action === 'move') onMoveRequest?.(item);
                if (action === 'create-task') onCreateTask?.(item);
                if (action === 'delete') onDeleteItem?.(item);
              },
            }),
          ]),
        ]),
      ]),
    ])),
  );
}

function openFullEditorModal(desc, onSave) {
  const layerId = 'my-lists-full-editor';
  let layer = document.getElementById(layerId);
  if (!layer) {
    layer = document.createElement('div');
    layer.id = layerId;
    document.body.appendChild(layer);
  }
  layer.innerHTML = `
    <div class="nn-modal-overlay" role="presentation">
      <div class="nn-modal-card max-w-4xl w-full" role="dialog" aria-modal="true" aria-label="Full editor" data-full-editor="true">
        <div class="lookup-modal__header flex items-center justify-between">
          <h3>Full editor</h3>
          <button type="button" id="myListsFullEditorClose" class="p-2 rounded hover:bg-slate-100 dark:hover:bg-slate-800" aria-label="Close full editor">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
        <div class="lookup-modal__body">
          <div class="rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 p-3 min-h-[320px]">
            <p class="text-xs uppercase tracking-wide text-slate-500 dark:text-white/60 mb-2">Description</p>
            <div contenteditable="true" id="myListsFullEditorInput" class="min-h-[160px] rounded-md border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-800 p-3 text-sm text-slate-800 dark:text-white">${desc || ''}</div>
          </div>
        </div>
        <div class="lookup-modal__actions">
          <button type="button" class="lookup-btn ghost" id="myListsFullEditorCancel">Cancel</button>
          <button type="button" class="lookup-btn primary" id="myListsFullEditorSave">Save</button>
        </div>
      </div>
    </div>
  `;
  const cleanup = () => { layer.innerHTML = ''; };
  layer.querySelector('#myListsFullEditorCancel')?.addEventListener('click', cleanup);
  layer.querySelector('#myListsFullEditorClose')?.addEventListener('click', cleanup);
  layer.querySelector('.nn-modal-overlay')?.addEventListener('click', (e) => { if (e.target === layer.querySelector('.nn-modal-overlay')) cleanup(); });
  layer.querySelector('#myListsFullEditorSave')?.addEventListener('click', () => {
    const val = layer.querySelector('#myListsFullEditorInput')?.innerHTML || '';
    cleanup();
    if (onSave) onSave(val);
  });
}

function AddItemBar({ value, onChange, onSubmit }) {
  const inputRef = useRef(null);
  useEffect(() => {
    if (inputRef.current) inputRef.current.focus();
  }, []);

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      onSubmit();
    }
  };

  return h('div', { className: 'flex items-center gap-3' }, [
    h('input', {
      ref: inputRef,
      type: 'text',
      placeholder: 'Add a list item',
      value,
      onChange: (e) => onChange(e.target.value),
      onKeyDown: handleKeyDown,
      className: 'flex-1 rounded-md border border-slate-300 dark:border-white/10 bg-white dark:bg-slate-900 px-3 py-2 text-sm text-slate-900 dark:text-white shadow-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-brand-purple,#711FFF)]',
    }),
    h('button', {
      type: 'button',
      className: 'inline-flex h-10 w-10 items-center justify-center rounded-md border border-slate-300 dark:border-white/10 bg-white dark:bg-slate-900 text-slate-600 dark:text-white/80 shadow-sm',
      title: 'Microphone (stub)',
      'aria-label': 'Microphone (stub)',
    }, h(IconMic)),
  ]);
}

function MyListsLayout() {
  const [items, setItems] = useState(() => safeLoadItems());
  const [folders, setFolders] = useState(() => safeLoadFolders());
  const [draft, setDraft] = useState('');
  const [multiSelect, setMultiSelect] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [foldersOpen, setFoldersOpen] = useState(false);
  const [showArchive, setShowArchive] = useState(false);
  const [selectedIds, setSelectedIds] = useState(() => new Set());
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [openMenuId, setOpenMenuId] = useState(null);
  const [selectedFolderId, setSelectedFolderId] = useState(null);
  const [draggingFolderId, setDraggingFolderId] = useState(null);
  const [moveModalItem, setMoveModalItem] = useState(null);
  const [folderDraft, setFolderDraft] = useState('');
  const [openMenuPos, setOpenMenuPos] = useState(null);
  const [editingFolderId, setEditingFolderId] = useState(null);
  const [folderRenameDraft, setFolderRenameDraft] = useState('');
  const [openFolderMenuId, setOpenFolderMenuId] = useState(null);
  const [openFolderMenuPos, setOpenFolderMenuPos] = useState(null);
  const [folderDeleteTargetId, setFolderDeleteTargetId] = useState(null);
  const [editingTitleId, setEditingTitleId] = useState(null);
  const [titleDraft, setTitleDraft] = useState('');
  const [editingNotesId, setEditingNotesId] = useState(null);
  const [notesDraft, setNotesDraft] = useState('');

  useEffect(() => {
    safeSaveItems(items);
  }, [items]);

  useEffect(() => {
    safeSaveFolders(folders);
  }, [folders]);

  useEffect(() => {
    setSelectedIds(new Set());
    setOpenMenuId(null);
    setOpenMenuPos(null);
  }, [multiSelect, showArchive]);

  useEffect(() => {
    const handler = () => {
      setOpenMenuId(null);
      setOpenMenuPos(null);
      setOpenFolderMenuId(null);
      setOpenFolderMenuPos(null);
    };
    document.addEventListener('click', handler);
    return () => document.removeEventListener('click', handler);
  }, []);

  useEffect(() => {
    setFolders((prev) => sanitizeFolders(prev));
  }, []);

  useEffect(() => {
    if (multiSelect) {
      setEditingTitleId(null);
      setTitleDraft('');
      setEditingNotesId(null);
      setNotesDraft('');
    }
  }, [multiSelect]);

  const normalizedSearch = (searchTerm || '').trim().toLowerCase();
  const visibleItems = useMemo(() => {
    return [...items]
      .filter((item) => !!item.isArchived === !!showArchive)
      .filter((item) => {
        if (selectedFolderId) return item.folderId === selectedFolderId;
        return true;
      })
      .filter((item) => {
        if (!normalizedSearch) return true;
        const haystack = `${item.title || ''} ${item.notes || ''}`.toLowerCase();
        return haystack.includes(normalizedSearch);
      })
      .sort((a, b) => b.createdAt - a.createdAt);
  }, [items, showArchive, normalizedSearch, selectedFolderId]);

  const currentFolder = selectedFolderId ? folders.find((f) => f.id === selectedFolderId) : null;
  const getFolderBreadcrumb = () => {
    if (!selectedFolderId) return 'All items';
    const map = new Map(folders.map((f) => [f.id, f]));
    const names = [];
    const visited = new Set();
    let current = map.get(selectedFolderId);
    while (current && !visited.has(current.id)) {
      names.push(current.name || 'General');
      visited.add(current.id);
      current = current.parentId ? map.get(current.parentId) : null;
    }
    return names.length ? names.reverse().join(' \u203a ') : 'All items';
  };
  const currentFolderLabel = getFolderBreadcrumb();

  const allSelected = visibleItems.length > 0 && visibleItems.every((item) => selectedIds.has(item.id));
  const selectedCount = Array.from(selectedIds).filter(id => visibleItems.some(item => item.id === id)).length;

  const addItem = () => {
    const trimmed = (draft || '').trim();
    if (!trimmed) return;
    const next = [{ id: uid(), title: trimmed, notes: '', isArchived: false, createdAt: Date.now(), folderId: selectedFolderId }, ...items];
    setItems(next);
    setDraft('');
  };

  const toggleComplete = (id) => {
    setItems((prev) => prev.map((item) => {
      if (item.id !== id) return item;
      const nextArchived = showArchive ? false : true;
      return { ...item, isArchived: nextArchived };
    }));
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  };

  const deleteItem = (id) => {
    setItems((prev) => prev.filter((item) => item.id !== id));
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  };

  const startEditTitle = (item) => {
    if (!item || multiSelect) return;
    setEditingTitleId(item.id);
    setTitleDraft(item.title || '');
    setEditingNotesId(null);
    setNotesDraft('');
  };

  const saveTitle = (itemId, val) => {
    const nextVal = (val || '').trim();
    if (!nextVal) {
      cancelTitleEdit();
      return;
    }
    setItems((prev) => prev.map((item) => item.id === itemId ? { ...item, title: nextVal } : item));
    setEditingTitleId(null);
    setTitleDraft('');
  };

  const cancelTitleEdit = () => {
    setEditingTitleId(null);
    setTitleDraft('');
  };

  const startEditNotes = (item) => {
    if (!item || multiSelect) return;
    setEditingTitleId(null);
    setTitleDraft('');
    setEditingNotesId(item.id);
    setNotesDraft(item.notes || '');
  };

  const saveNotes = (itemId, val) => {
    const nextVal = (val || '').trim();
    setItems((prev) => prev.map((item) => item.id === itemId ? { ...item, notes: nextVal } : item));
    setEditingNotesId(null);
    setNotesDraft('');
  };

  const cancelNotesEdit = () => {
    setEditingNotesId(null);
    setNotesDraft('');
  };

  const toggleSelect = (id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (allSelected) {
      setSelectedIds(new Set());
      return;
    }
    const next = new Set(selectedIds);
    visibleItems.forEach(item => next.add(item.id));
    setSelectedIds(next);
  };

  const confirmDelete = () => {
    if (!selectedCount) return;
    setItems((prev) => prev.filter((item) => !selectedIds.has(item.id)));
    setSelectedIds(new Set());
    setConfirmOpen(false);
    setMultiSelect(false);
  };

  const folderCounts = useMemo(() => {
    const counts = {};
    items.forEach((item) => {
      const key = item.folderId || '__root';
      counts[key] = (counts[key] || 0) + 1;
    });
    return counts;
  }, [items]);

  const getFolderDeleteSet = (targetId) => {
    const ids = new Set();
    if (!targetId) return ids;
    ids.add(targetId);
    let added = true;
    while (added) {
      added = false;
      folders.forEach((folder) => {
        if (folder.parentId && ids.has(folder.parentId) && !ids.has(folder.id)) {
          ids.add(folder.id);
          added = true;
        }
      });
    }
    return ids;
  };

  const confirmFolderDelete = () => {
    if (!folderDeleteTargetId) return;
    const removeIds = getFolderDeleteSet(folderDeleteTargetId);
    setFolders((prev) => sanitizeFolders(prev.filter((f) => !removeIds.has(f.id))));
    setItems((prev) => prev.filter((item) => !item.folderId || !removeIds.has(item.folderId)));
    if (selectedFolderId && removeIds.has(selectedFolderId)) {
      setSelectedFolderId(null);
    }
    setSelectedIds(new Set());
    setMultiSelect(false);
    setFolderDeleteTargetId(null);
    setOpenFolderMenuId(null);
    setOpenFolderMenuPos(null);
  };

  const addFolder = (name, parentId = null) => {
    const trimmed = (name || '').trim();
    if (!trimmed) return;
    const siblings = getChildren(folders, parentId);
    const next = [
      ...folders,
      {
        id: uid(),
        name: trimmed,
        parentId: parentId ?? null,
        sortOrder: siblings.length,
      },
    ];
    setFolders(sanitizeFolders(normalizeSortOrders(next, null)));
  };

  const startFolderRename = (folder) => {
    if (!folder?.id) return;
    setEditingFolderId(folder.id);
    setFolderRenameDraft(folder.name || '');
  };

  const cancelFolderRename = () => {
    setEditingFolderId(null);
    setFolderRenameDraft('');
  };

  const commitFolderRename = (folderId) => {
    if (!folderId) return;
    const trimmed = (folderRenameDraft || '').trim();
    setEditingFolderId(null);
    if (!trimmed) {
      setFolderRenameDraft('');
      return;
    }
    setFolders((prev) => sanitizeFolders(prev.map((f) => f.id === folderId ? { ...f, name: trimmed } : f)));
    setFolderRenameDraft('');
  };

  const setItemFolder = (itemId, folderId) => {
    setItems((prev) => prev.map((item) => item.id === itemId ? { ...item, folderId: folderId || null } : item));
  };

  const handleFolderDrop = (targetId, makeChild = false) => {
    if (!draggingFolderId) return;
    setFolders((prev) => {
      const clean = sanitizeFolders(prev);
      if (!targetId) {
        const next = clean.map((f) => f.id === draggingFolderId ? { ...f, parentId: null } : f);
        return sanitizeFolders(normalizeSortOrders(next, null));
      }
      if (isDescendant(clean, targetId, draggingFolderId)) return clean;
      return sanitizeFolders(moveFolder(clean, draggingFolderId, targetId, makeChild));
    });
    setDraggingFolderId(null);
  };

  const renderMoveModal = () => {
    if (!moveModalItem) return null;
    const selectable = [{ id: null, name: 'All items', parentId: null, sortOrder: -1 }, ...folders];
    const renderOption = (node, depth = 0) => {
      const count = folderCounts[node.id || '__root'] || 0;
      return h('button', {
        key: node.id || 'root',
        type: 'button',
        className: `w-full text-left px-3 py-2 text-sm hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center gap-2 text-slate-800 dark:text-white ${moveModalItem.folderId === node.id ? 'font-semibold' : ''}`,
        onClick: () => {
          setItemFolder(moveModalItem.id, node.id);
          setMoveModalItem(null);
        },
        style: { paddingLeft: `${12 * depth + 12}px` },
      }, [
        node.id ? h('span', { className: `h-2 w-2 rounded-full inline-block ${folderDotClass(depth)}` }) : h('span', { className: 'h-2 w-2 rounded-full bg-slate-300 inline-block' }),
        h('span', null, node.name),
        h('span', { className: 'ml-auto text-xs text-slate-500 dark:text-white/60' }, count),
      ]);
    };
    const renderTree = (parentId = null, depth = 0, visited = new Set()) => {
      const rows = [];
      getChildren(selectable, parentId).forEach((f) => {
        if (visited.has(f.id)) return;
        const nextVisited = new Set(visited);
        nextVisited.add(f.id);
        rows.push(renderOption(f, depth));
        rows.push(...renderTree(f.id, depth + 1, nextVisited));
      });
      return rows;
    };
    return h('div', { className: 'fixed inset-0 z-50 flex items-center justify-center px-4' }, [
      h('div', { className: 'absolute inset-0 bg-black/40 backdrop-blur-sm' }),
      h('div', { className: 'relative w-full max-w-sm rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 shadow-2xl p-4 space-y-3' }, [
        h('div', { className: 'flex items-center justify-between' }, [
          h('h2', { className: 'text-base font-semibold text-slate-900 dark:text-white' }, 'Move to folder…'),
          h('button', { type: 'button', className: 'p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-white', onClick: () => setMoveModalItem(null), 'aria-label': 'Close move modal' }, '✕'),
        ]),
        h('div', { className: 'max-h-64 overflow-y-auto rounded-lg border border-slate-100 dark:border-white/10 bg-white dark:bg-slate-900' }, renderTree(null, 0)),
        h('div', { className: 'flex justify-end' }, [
          h('button', { type: 'button', className: 'px-4 py-2 text-sm rounded-md border border-slate-200 dark:border-white/10 text-slate-700 dark:text-white', onClick: () => setMoveModalItem(null) }, 'Cancel'),
        ]),
      ]),
    ]);
  };

  const openCreateTaskDrawer = (item) => {
    openQuickTaskDrawer({
      mode: 'create',
      sourceItem: {
        id: item.id,
        title: item.title,
        notes: item.notes,
        folderId: item.folderId ?? null,
      },
      onCreated: ({ deleteSourceItem }) => {
        if (deleteSourceItem) {
          deleteItem(item.id);
        }
      },
    });
  };

  const renderModal = () => {
    if (!confirmOpen) return null;
    return h('div', { className: 'fixed inset-0 z-50 flex items-center justify-center px-4' }, [
      h('div', { className: 'absolute inset-0 bg-black/40 backdrop-blur-sm' }),
      h('div', { className: 'relative w-full max-w-md rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 shadow-2xl p-6 space-y-4' }, [
        h('h2', { className: 'text-lg font-semibold text-slate-900 dark:text-white' }, 'Delete selected items?'),
        h('p', { className: 'text-sm text-slate-600 dark:text-slate-300' }, 'This will permanently delete the selected items.'),
        h('div', { className: 'flex justify-end gap-3' }, [
          h('button', {
            type: 'button',
            className: 'inline-flex items-center justify-center rounded-md border border-slate-200 dark:border-white/20 px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-800',
            onClick: () => setConfirmOpen(false),
          }, 'Cancel'),
          h('button', {
            type: 'button',
            className: 'inline-flex items-center justify-center rounded-md bg-red-600 text-white px-4 py-2 text-sm font-semibold hover:bg-red-700',
            onClick: confirmDelete,
          }, 'Delete'),
        ]),
      ]),
    ]);
  };

  const renderFolderDeleteModal = () => {
    if (!folderDeleteTargetId) return null;
    const target = folders.find((f) => f.id === folderDeleteTargetId);
    const label = target?.name || 'this folder';
    return h('div', { className: 'fixed inset-0 z-50 flex items-center justify-center px-4' }, [
      h('div', { className: 'absolute inset-0 bg-black/40 backdrop-blur-sm' }),
      h('div', { className: 'relative w-full max-w-md rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 shadow-2xl p-6 space-y-4' }, [
        h('h2', { className: 'text-lg font-semibold text-slate-900 dark:text-white' }, `Delete "${label}"?`),
        h('p', { className: 'text-sm text-slate-600 dark:text-slate-300' }, 'All items in the folder will also be deleted.'),
        h('div', { className: 'flex justify-end gap-3' }, [
          h('button', {
            type: 'button',
            className: 'inline-flex items-center justify-center rounded-md border border-slate-200 dark:border-white/20 px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-800',
            onClick: () => setFolderDeleteTargetId(null),
          }, 'Cancel'),
          h('button', {
            type: 'button',
            className: 'inline-flex items-center justify-center rounded-md bg-red-600 text-white px-4 py-2 text-sm font-semibold hover:bg-red-700',
            onClick: confirmFolderDelete,
          }, 'Delete'),
        ]),
      ]),
    ]);
  };

  const renderFolderRow = (folder, depth = 0) => {
    const isSelected = selectedFolderId === folder.id;
    const count = folderCounts[folder.id || '__root'] || 0;
    const isEditing = editingFolderId === folder.id;
    const menuOpen = openFolderMenuId === folder.id;
    return h('div', {
      key: folder.id || 'root',
      className: `flex items-center justify-between rounded-md border border-transparent px-3 py-2.5 text-sm ${isSelected ? 'bg-[var(--color-brand-purple,#711FFF)]/10 border-[var(--color-brand-purple,#711FFF)] text-[var(--color-brand-purple,#711FFF)] dark:text-white' : 'hover:bg-slate-100 dark:hover:bg-slate-800'}`,
      draggable: !!folder.id,
      onDragStart: () => folder.id && setDraggingFolderId(folder.id),
      onDragEnd: () => setDraggingFolderId(null),
      onDragOver: (e) => { e.preventDefault(); },
      onDrop: (e) => {
        e.preventDefault();
        const makeChild = folder.id ? e.nativeEvent.offsetX > 24 : false;
        handleFolderDrop(folder.id, makeChild);
      },
      style: { paddingLeft: `${depth * 12 + 4}px` },
      onClick: () => {
        if (isEditing) return;
        setSelectedFolderId(folder.id || null);
        setSelectedIds(new Set());
        setMultiSelect(false);
        setOpenFolderMenuId(null);
        setOpenFolderMenuPos(null);
      },
    }, [
      h('div', { className: 'flex items-center gap-2 truncate' }, [
        folder.id ? h('span', { className: `h-2 w-2 rounded-full inline-block ${folderDotClass(depth)}` }) : h('span', { className: 'h-2 w-2 rounded-full bg-slate-400 inline-block' }),
        folder.id ? h('span', { className: 'text-slate-400 dark:text-white/40 cursor-grab' }, h('svg', { width: 14, height: 14, viewBox: '0 0 14 14', fill: 'currentColor' }, [
          h('circle', { cx: 3, cy: 3, r: 1 }),
          h('circle', { cx: 7, cy: 3, r: 1 }),
          h('circle', { cx: 11, cy: 3, r: 1 }),
          h('circle', { cx: 3, cy: 7, r: 1 }),
          h('circle', { cx: 7, cy: 7, r: 1 }),
          h('circle', { cx: 11, cy: 7, r: 1 }),
          h('circle', { cx: 3, cy: 11, r: 1 }),
          h('circle', { cx: 7, cy: 11, r: 1 }),
          h('circle', { cx: 11, cy: 11, r: 1 }),
        ])) : null,
        isEditing
          ? h('input', {
            type: 'text',
            value: folderRenameDraft,
            onChange: (e) => setFolderRenameDraft(e.target.value),
            onKeyDown: (e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                commitFolderRename(folder.id);
              }
              if (e.key === 'Escape') {
                e.preventDefault();
                cancelFolderRename();
              }
            },
            onBlur: () => commitFolderRename(folder.id),
            autoFocus: true,
            className: 'truncate flex-1 rounded-md border border-slate-200 dark:border-white/15 bg-white dark:bg-slate-800 px-2 py-1 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-white/50 focus:outline-none focus:ring-1 focus:ring-netnet-purple',
            onClick: (e) => e.stopPropagation(),
          })
          : h('span', {
            className: 'truncate text-slate-900 dark:text-white',
            onDoubleClick: folder.id ? () => startFolderRename(folder) : undefined,
          }, folder.name),
      ]),
      h('div', { className: 'flex items-center gap-2' }, [
        h('span', { className: 'text-xs text-slate-500 dark:text-white/70' }, count),
        folder.id ? h('div', { className: 'relative flex items-center' }, [
          h('button', {
            type: 'button',
            className: 'p-1 rounded-full hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-500 dark:text-white/70',
            onClick: (e) => {
              e.stopPropagation();
              if (menuOpen) {
                setOpenFolderMenuId(null);
                setOpenFolderMenuPos(null);
                return;
              }
              const rect = e.currentTarget.getBoundingClientRect();
              const left = Math.max(8, rect.right - 176);
              const top = rect.bottom + 6;
              setOpenFolderMenuPos({ left, top });
              setOpenFolderMenuId(folder.id);
            },
            'aria-label': 'Folder options',
          }, h('svg', { width: 16, height: 16, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' }, [
            h('circle', { cx: 12, cy: 5, r: 1 }),
            h('circle', { cx: 12, cy: 12, r: 1 }),
            h('circle', { cx: 12, cy: 19, r: 1 }),
          ])),
          h(FolderOptionsMenu, {
            isOpen: menuOpen,
            position: openFolderMenuPos,
            onClose: (action) => {
              setOpenFolderMenuId(null);
              setOpenFolderMenuPos(null);
              if (action === 'delete') setFolderDeleteTargetId(folder.id);
            },
          }),
        ]) : null,
      ]),
    ]);
  };

  const renderFolderTree = (parentId = null, depth = 0, visited = new Set()) => {
    const rows = [];
    getChildren(folders, parentId).forEach((f) => {
      if (visited.has(f.id)) return;
      const nextVisited = new Set(visited);
      nextVisited.add(f.id);
      rows.push(renderFolderRow(f, depth));
      rows.push(...renderFolderTree(f.id, depth + 1, nextVisited));
    });
    return rows;
  };

  return h('div', { className: 'h-full flex flex-col min-h-0' }, [
    h('div', { className: 'flex flex-col gap-2 px-4 flex-shrink-0' }, [
      h(ControlsRow, {
        multiSelect,
        setMultiSelect: (val) => {
          setMultiSelect(val);
          if (!val) setSelectedIds(new Set());
        },
        selectedCount,
        allSelected,
        onToggleSelectAll: toggleSelectAll,
        onOpenDeleteConfirm: () => { if (selectedCount) setConfirmOpen(true); },
        searchTerm,
        setSearchTerm,
        foldersOpen,
        setFoldersOpen,
        showArchive,
        setShowArchive: (val) => { setShowArchive(val); setSelectedIds(new Set()); },
        onClearSelection: () => setSelectedIds(new Set()),
      }),
    ]),
    h('div', { className: 'flex-1 min-h-0 flex flex-col' }, [
      h('div', { className: 'flex-1 min-h-0 overflow-y-auto px-4 py-4 bg-slate-50 dark:bg-slate-900', style: { paddingBottom: `${getBottomOffset() + 160}px` } }, [
        h('div', { className: 'flex gap-4 min-h-0' }, [
          h('div', { className: 'flex-1 min-h-0 flex flex-col space-y-2' }, [
            h('div', { className: 'flex items-center justify-between' }, [
              h('div', { className: 'text-xs uppercase tracking-wide text-slate-500 dark:text-white/60' }, showArchive ? 'Archived items' : 'Active items'),
              h('span', { className: 'text-[11px] text-slate-400 dark:text-white/60' }, `${visibleItems.length} item${visibleItems.length === 1 ? '' : 's'}`),
            ]),
            h('div', { className: 'flex items-center gap-2 text-xs text-slate-500 dark:text-white/60 truncate' }, [
              h('span', { className: 'text-slate-400 dark:text-white/50' }, '\u2022'),
              h('span', { className: 'font-medium text-slate-700 dark:text-white/80 truncate' }, currentFolderLabel),
            ]),
            h(ItemsList, {
              items: visibleItems,
              multiSelect,
              selectedIds,
              onSelectToggle: toggleSelect,
              onToggleComplete: toggleComplete,
              openMenuId,
              setOpenMenuId,
              openMenuPos,
              setOpenMenuPos,
              isArchiveView: showArchive,
              onMoveRequest: (item) => setMoveModalItem(item),
              onCreateTask: (item) => openCreateTaskDrawer(item),
              onDeleteItem: (item) => deleteItem(item.id),
              editingTitleId,
              titleDraft,
              onStartEditTitle: startEditTitle,
              onChangeTitleDraft: setTitleDraft,
              onSaveTitle: saveTitle,
              onCancelEditTitle: cancelTitleEdit,
              editingNotesId,
              notesDraft,
              onStartEditNotes: startEditNotes,
              onChangeNotesDraft: setNotesDraft,
              onSaveNotes: saveNotes,
              onCancelEditNotes: cancelNotesEdit,
            }),
          ]),
          foldersOpen ? h('div', { className: 'w-[320px] flex-shrink-0 h-full' }, [
            h('div', { className: 'flex flex-col h-full rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 shadow-md overflow-hidden' }, [
              h('div', { className: 'px-4 py-3 border-b border-slate-200 dark:border-white/10 flex items-center justify-between gap-2' }, [
                h('div', { className: 'flex flex-col leading-tight' }, [
                  h('div', { className: 'text-sm font-semibold text-slate-800 dark:text-white' }, 'Folders'),
                  h('span', { className: 'text-xs text-slate-500 dark:text-white/60' }, 'Drag to nest'),
                ]),
                h('button', {
                  type: 'button',
                  className: 'p-2 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 dark:text-white/70',
                  onClick: () => setFoldersOpen(false),
                  'aria-label': 'Close folders panel',
                }, '✕'),
              ]),
              h('div', { className: 'flex-1 min-h-0 overflow-y-auto px-2 py-2 space-y-1' }, [
                renderFolderRow({ id: null, name: 'All items' }, 0),
                ...renderFolderTree(null, 0),
              ]),
              h('div', { className: 'px-4 py-3 border-t border-slate-200 dark:border-white/10 flex items-center gap-2 bg-slate-50 dark:bg-slate-900' }, [
                h('input', {
                  type: 'text',
                  value: folderDraft,
                  onChange: (e) => setFolderDraft(e.target.value),
                  onKeyDown: (e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      const name = (folderDraft || '').trim();
                      if (name) {
                        addFolder(name, selectedFolderId);
                        setFolderDraft('');
                      }
                    }
                  },
                  placeholder: 'New folder name',
                  className: 'flex-1 rounded-md border border-slate-200 dark:border-white/15 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-white/50 focus:outline-none focus:ring-1 focus:ring-netnet-purple shadow-sm',
                }),
                h('button', {
                  type: 'button',
                  className: 'nn-btn nn-btn--micro inline-flex items-center justify-center text-white bg-netnet-purple border border-slate-300 dark:border-white/10 hover:bg-[#6020df] focus-visible:ring-2 focus-visible:ring-netnet-purple',
                  onClick: () => { addFolder(folderDraft || 'Untitled', selectedFolderId); setFolderDraft(''); },
                }, '+'),
              ]),
            ]),
          ]) : null,
        ]),
      ]),
      h('div', {
        id: 'myListsComposerBar',
        className: 'sticky bottom-0 z-40 border-t border-slate-200 dark:border-white/10 bg-white/90 dark:bg-slate-900/90 backdrop-blur px-4 py-3',
        style: { bottom: `calc(env(safe-area-inset-bottom, 0px) + ${getBottomOffset()}px)` },
      }, [
        h(AddItemBar, { value: draft, onChange: setDraft, onSubmit: addItem }),
      ]),
    ]),
    renderModal(),
    renderFolderDeleteModal(),
    renderMoveModal(),
  ]);
}

export function renderMyListsHeader(container) {
  if (!container) return;
  const root = createRoot(container);
  root.render(h(SectionHeader, {
    title: h('div', { className: 'flex items-center gap-2' }, [
      h('span', { className: 'text-sm text-slate-500 dark:text-white/70' }, 'Me'),
      h('span', { className: 'text-slate-400 dark:text-white/50' }, '›'),
      h('span', { className: 'text-2xl font-semibold text-slate-900 dark:text-white' }, 'My Lists'),
    ]),
    showHelpIcon: true,
    videoHelpConfig: {
      primary: {
        title: 'Lists Overview',
        description: 'Capture items quickly, then promote to tasks.',
        videoUrl: 'https://videos.hellonetnet.com/watch/wo5umvj3',
        thumbnailSrc: 'public/assets/samples/vid-jobs.jpg',
      },
      related: [],
    },
    showSecondaryRow: false,
  }));
}

export function renderMyListsPage(container) {
  if (!container) return;
  container.innerHTML = '';
  const root = createRoot(container);
  root.render(h(MyListsLayout));
}
