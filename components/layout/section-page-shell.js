export function mountSectionPageShell(container, {
  headerId = 'section-page-header',
  bodyId = 'section-page-body',
} = {}) {
  if (!container) return { headerMount: null, bodyMount: null };

  container.className = 'h-full w-full';
  container.innerHTML = `
    <div class="flex h-full w-full flex-col gap-4">
      <div id="${headerId}" class="space-y-3 px-4 pt-4"></div>
      <div id="${bodyId}" class="flex-1 space-y-4 px-4 pb-12"></div>
    </div>
  `;

  return {
    headerMount: container.querySelector(`#${headerId}`),
    bodyMount: container.querySelector(`#${bodyId}`),
  };
}
