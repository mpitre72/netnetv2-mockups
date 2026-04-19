function ensureModalLayer(id) {
  let layer = document.getElementById(id);
  if (!layer) {
    layer = document.createElement('div');
    layer.id = id;
    document.body.appendChild(layer);
  }
  return layer;
}

function normalizeText(value) {
  return String(value || '').trim().toLowerCase();
}

function formatTaskContext(task) {
  const parts = [task?.jobName || '', task?.deliverableName || ''].filter(Boolean);
  const taskLine = parts.length ? parts.join(' > ') : '';
  const companyLine = task?.contextType === 'internal'
    ? 'Internal'
    : (task?.companyName || 'Client');
  return [taskLine, companyLine].filter(Boolean).join(' • ');
}

function filterTasks(tasks = [], query = '', limit = 8) {
  const needle = normalizeText(query);
  const filtered = !needle
    ? tasks
    : tasks.filter((task) => normalizeText(task.searchIndex || '').includes(needle));
  return filtered.slice(0, limit);
}

export function openMyTimeTaskResolverPopover({
  anchorEl,
  tasks = [],
  onSelect,
  onClose,
} = {}) {
  if (!anchorEl) return null;

  const layer = ensureModalLayer('my-time-task-resolver-layer');
  layer.className = 'fixed inset-0 z-[1150]';
  layer.innerHTML = '';

  const backdrop = document.createElement('div');
  backdrop.className = 'absolute inset-0';

  const popover = document.createElement('div');
  popover.className = 'fixed w-[360px] rounded-xl border border-slate-200 bg-white p-3 shadow-2xl dark:border-white/10 dark:bg-slate-950/95';
  popover.setAttribute('role', 'dialog');
  popover.setAttribute('aria-label', 'Select task');

  const searchInput = document.createElement('input');
  searchInput.type = 'text';
  searchInput.placeholder = 'Search tasks...';
  searchInput.className = 'h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-800 outline-none ring-0 focus:border-netnet-purple dark:border-white/10 dark:bg-slate-900 dark:text-white';
  searchInput.setAttribute('aria-label', 'Search tasks');

  const resultsWrap = document.createElement('div');
  resultsWrap.className = 'mt-3 max-h-[320px] overflow-y-auto rounded-lg border border-slate-200/80 dark:border-white/10';

  popover.appendChild(searchInput);
  popover.appendChild(resultsWrap);
  layer.appendChild(backdrop);
  layer.appendChild(popover);

  let query = '';

  const positionPopover = () => {
    const rect = anchorEl.getBoundingClientRect();
    const popoverRect = popover.getBoundingClientRect();
    const padding = 12;
    let left = rect.left;
    let top = rect.bottom + 8;
    if (left + popoverRect.width > window.innerWidth - padding) {
      left = window.innerWidth - padding - popoverRect.width;
    }
    if (left < padding) left = padding;
    if (top + popoverRect.height > window.innerHeight - padding) {
      top = rect.top - popoverRect.height - 8;
    }
    if (top < padding) top = padding;
    popover.style.left = `${left}px`;
    popover.style.top = `${top}px`;
  };

  const close = () => {
    layer.innerHTML = '';
    layer.className = '';
    document.removeEventListener('keydown', handleKeyDown);
    onClose?.();
  };

  const renderResults = () => {
    resultsWrap.innerHTML = '';
    const matches = filterTasks(tasks, query);

    if (!matches.length) {
      const empty = document.createElement('div');
      empty.className = 'px-3 py-4 text-sm text-slate-500 dark:text-white/60';
      empty.textContent = 'No matching tasks';
      resultsWrap.appendChild(empty);
      positionPopover();
      return matches;
    }

    matches.forEach((task, index) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'flex w-full flex-col items-start gap-1 border-b border-slate-200/80 px-3 py-3 text-left transition-colors hover:bg-slate-50 focus:bg-slate-50 focus:outline-none dark:border-white/10 dark:hover:bg-white/5 dark:focus:bg-white/5';
      if (index === matches.length - 1) button.classList.remove('border-b');
      button.dataset.taskId = task.id;

      const title = document.createElement('div');
      title.className = 'text-sm font-semibold text-slate-900 dark:text-white';
      title.textContent = task.title || 'Untitled task';

      const context = document.createElement('div');
      context.className = 'text-xs text-slate-500 dark:text-white/60';
      context.textContent = formatTaskContext(task);

      button.appendChild(title);
      button.appendChild(context);
      button.addEventListener('click', () => {
        onSelect?.(task);
        close();
      });
      resultsWrap.appendChild(button);
    });

    positionPopover();
    return matches;
  };

  const handleKeyDown = (event) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      close();
    }
    if (event.key === 'Enter' && document.activeElement === searchInput) {
      const [firstMatch] = filterTasks(tasks, query, 1);
      if (!firstMatch) return;
      event.preventDefault();
      onSelect?.(firstMatch);
      close();
    }
  };

  backdrop.addEventListener('click', close);
  searchInput.addEventListener('input', (event) => {
    query = event.target.value || '';
    renderResults();
  });

  document.addEventListener('keydown', handleKeyDown);
  renderResults();
  positionPopover();
  window.requestAnimationFrame(() => searchInput.focus());

  return close;
}
