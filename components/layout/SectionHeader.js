const { createElement: h, useState, useEffect } = React;

const VIDEO_HELP_ICONS = {
  light: {
    idle: 'public/assets/brand/chrome/VidHelp-Idle.svg',
    active: 'public/assets/brand/chrome/VidHelp-Active.svg',
  },
  dark: {
    idle: 'public/assets/brand/chrome/VidHelp-Idle-white.svg',
    active: 'public/assets/brand/chrome/VidHelp-Active-white.svg',
  },
};

function isDark() {
  if (typeof document === 'undefined') return false;
  return document.documentElement.classList.contains('dark');
}

function VideoHelpIcon({ isActive = false, onClick }) {
  const [isHovered, setIsHovered] = useState(false);
  const dark = isDark();
  const useActive = isActive || isHovered;
  const src = useActive
    ? (dark ? VIDEO_HELP_ICONS.dark.active : VIDEO_HELP_ICONS.light.active)
    : (dark ? VIDEO_HELP_ICONS.dark.idle : VIDEO_HELP_ICONS.light.idle);
  return h('img', {
    src,
    alt: 'Video help',
    role: 'button',
    tabIndex: 0,
    className: 'h-6 w-6 cursor-pointer select-none transition-opacity hover:opacity-90',
    onClick,
    onMouseEnter: () => setIsHovered(true),
  onMouseLeave: () => setIsHovered(false),
  onKeyDown: (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onClick && onClick();
      }
    },
    'aria-label': 'Open video help',
  });
}

export function SectionHeader({
  title,
  showHelpIcon = false,
  switcherOptions,
  switcherValue,
  onSwitcherChange,
  leftActions,
  rightActions,
  actions, // backward compatibility: treated as rightActions
  showSearch = false,
  searchPlaceholder = 'Search',
  searchValue = '',
  onSearchChange,
  videoHelpConfig,
  showSecondaryRow = true,
  className = '',
}) {
  const [localSearch, setLocalSearch] = useState(searchValue || '');
  const [helpActive, setHelpActive] = useState(false);

  useEffect(() => {
    setLocalSearch(searchValue || '');
  }, [searchValue]);

  const openHelp = () => {
    setHelpActive(true);
    const shell = document.getElementById('app-shell');
    const drawer = document.getElementById('drawer-container');
    if (!drawer) return;

    const closeDrawer = () => {
      shell?.classList.add('drawer-closed');
      const lightbox = document.getElementById('video-help-lightbox');
      if (lightbox) lightbox.remove();
      setHelpActive(false);
    };

    const renderVideoDrawer = () => {
      const fallbackConfig = {
        primary: {
          title: 'Managing Jobs',
          description: 'Learn how to manage Jobs in Net Net.',
          videoUrl: 'https://videos.hellonetnet.com/watch/wo5umvj3',
          thumbnailSrc: 'public/assets/samples/vid-jobs.jpg',
        },
        related: [
          {
            title: 'Quick Tasks vs. Job Tasks',
            description: 'Compare Quick Tasks to full Job Tasks.',
            videoUrl: 'https://videos.hellonetnet.com/watch/_GCLvxjV',
            thumbnailSrc: 'public/assets/samples/vid-jobs.jpg',
          },
          {
            title: 'Deliverables & Tasks',
            description: 'How grouping tasks into deliverables works.',
            videoUrl: 'https://videos.hellonetnet.com/watch/SlwetZGk',
            thumbnailSrc: 'public/assets/samples/vid-jobs.jpg',
          },
          {
            title: "Job KPI's",
            description: 'Understand Job-level performance metrics.',
            videoUrl: 'https://videos.hellonetnet.com/watch/mrN5rbMM',
            thumbnailSrc: 'public/assets/samples/vid-jobs.jpg',
          },
          {
            title: 'Activating Estimates To Jobs',
            description: 'Turn approved estimates into active Jobs.',
            videoUrl: 'https://videos.hellonetnet.com/watch/USScaUJq',
            thumbnailSrc: 'public/assets/samples/vid-jobs.jpg',
          },
          {
            title: 'Utilizing Chat with Smart Mentions!',
            description: 'Use Smart Mentions to keep Job conversations in context.',
            videoUrl: 'https://videos.hellonetnet.com/watch/J6L4QHnS',
            thumbnailSrc: 'public/assets/samples/vid-chat.jpg',
          },
        ],
      };
      const cfg = videoHelpConfig && videoHelpConfig.primary ? videoHelpConfig : fallbackConfig;
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
            </div>
            <button type="button" id="sectionHelpClose" class="text-slate-500 hover:text-slate-800 dark:text-white/70 dark:hover:text-white p-1" aria-label="Close video help">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          </div>
          <div class="flex-1 overflow-y-auto p-4 space-y-5">
            <div class="space-y-3">
              <div class="text-xs uppercase tracking-wide text-slate-500 dark:text-white/70">Video Lesson</div>
              ${
                videos[0]
                  ? `
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
                `
                  : '<div class="text-sm text-slate-600 dark:text-white/70">No primary video provided.</div>'
              }
            </div>
            <div class="space-y-3">
              <div class="text-xs uppercase tracking-wide text-slate-500 dark:text-white/70">Related Videos</div>
              <div class="flex flex-col gap-3">
                ${videos.slice(1).map((vid) => `
                  <button class="group text-left w-full rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 p-2 hover:bg-slate-50 dark:hover:bg-white/10 transition-colors flex gap-3" data-video-index="${vid.index}">
                    <div class="relative h-20 w-28 flex-shrink-0 overflow-hidden rounded-md">
                      <img src="${vid.thumbnailSrc || ''}" alt="Thumbnail for ${vid.title || 'video'}" class="w-full h-full object-cover">
                      <div class="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                      <div class="absolute inset-0 flex items-center justify-center">
                        <div class="h-8 w-8 rounded-full bg-netnet-purple text-white flex items-center justify-center shadow">
                          <svg viewBox="0 0 24 24" class="h-4 w-4" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
                        </div>
                      </div>
                    </div>
                    <div class="flex-1 space-y-1">
                      <div class="text-sm font-semibold text-slate-900 dark:text-white line-clamp-2">${vid.title || ''}</div>
                      <p class="text-xs text-slate-600 dark:text-white/70 line-clamp-3">${vid.description || ''}</p>
                    </div>
                  </button>
                `).join('')}
              </div>
            </div>
          </div>
        </aside>
      `;

      const lightboxId = 'video-help-lightbox';
      const ensureLightbox = () => {
        let lb = document.getElementById(lightboxId);
        if (!lb) {
          lb = document.createElement('div');
          lb.id = lightboxId;
          document.body.appendChild(lb);
        }
        return lb;
      };

      const closeLightbox = () => {
        const lb = document.getElementById(lightboxId);
        if (lb) {
          lb.innerHTML = '';
          lb.className = '';
        }
      };

      const openLightbox = (video) => {
        if (!video) return;
        const lb = ensureLightbox();
        lb.className = 'fixed inset-0 z-[1200]';
        lb.innerHTML = `
          <div class="absolute inset-0 bg-black/60" id="vh-lightbox-backdrop"></div>
          <div class="absolute inset-0 flex items-center justify-center p-4">
            <div class="w-full max-w-[960px] max-w-[85vw] bg-white dark:bg-slate-900 text-slate-900 dark:text-white rounded-xl shadow-2xl overflow-hidden relative">
              <div class="flex items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-white/10">
                <div class="text-sm font-semibold">${video.title || 'Video'}</div>
                <button type="button" id="vh-lightbox-close" class="text-slate-500 hover:text-slate-800 dark:text-white/70 dark:hover:text-white" aria-label="Close video player">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                </button>
              </div>
              <div class="bg-black">
                <iframe id="vh-player" src="${video.videoUrl || ''}" class="w-full h-[60vh] max-h-[80vh]" allow="autoplay; encrypted-media" allowfullscreen></iframe>
              </div>
              <div class="flex items-center justify-between px-4 py-3 border-t border-slate-200 dark:border-white/10 text-sm">
                <div class="flex items-center gap-3">
                  <button id="vh-replay" class="text-slate-700 dark:text-white/80 hover:text-slate-900 dark:hover:text-white flex items-center gap-1">
                    <svg viewBox="0 0 24 24" class="h-4 w-4" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 5v4l3-3"/><path d="M12 3a9 9 0 1 0 9 9"/></svg>
                    <span>Replay</span>
                  </button>
                  ${video.index < videos.length - 1 ? `<button id="vh-next" class="text-slate-700 dark:text-white/80 hover:text-slate-900 dark:hover:text-white flex items-center gap-1">
                    <span>Next</span>
                    <svg viewBox="0 0 24 24" class="h-4 w-4" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M5 12h14"/><path d="M13 5l7 7-7 7"/></svg>
                  </button>` : '<span class="text-slate-400 dark:text-white/50">Last video</span>'}
                </div>
                <button id="vh-backlist" class="text-slate-600 dark:text-white/70 hover:text-slate-900 dark:hover:text-white text-sm underline">Back to video list</button>
              </div>
            </div>
          </div>
        `;

        const closeBtn = document.getElementById('vh-lightbox-close');
        const backdrop = document.getElementById('vh-lightbox-backdrop');
        const backList = document.getElementById('vh-backlist');
        const replayBtn = document.getElementById('vh-replay');
        const nextBtn = document.getElementById('vh-next');
        const player = document.getElementById('vh-player');

        const handleClose = () => {
          closeLightbox();
        };
        if (closeBtn) closeBtn.onclick = handleClose;
        if (backdrop) backdrop.onclick = handleClose;
        if (backList) backList.onclick = handleClose;
        document.onkeydown = (e) => {
          if (e.key === 'Escape') handleClose();
        };
        if (replayBtn) {
          replayBtn.onclick = () => {
            if (player && player.tagName === 'IFRAME') {
              const src = player.getAttribute('src') || '';
              player.setAttribute('src', src);
            }
          };
        }
        if (nextBtn) {
          nextBtn.onclick = () => {
            const next = videos[video.index + 1];
            if (!next) return;
            openLightbox(next);
          };
        }
      };

      const cards = drawer.querySelectorAll('[data-video-index]');
      cards.forEach(card => {
        card.addEventListener('click', () => {
          const idx = Number(card.getAttribute('data-video-index') || '0');
          const vid = videos.find(v => v.index === idx);
          openLightbox(vid);
        });
      });

      const closeBtn = document.getElementById('sectionHelpClose');
      if (closeBtn) closeBtn.onclick = closeDrawer;
      const backdrop = document.getElementById('app-drawer-backdrop');
      if (backdrop) backdrop.onclick = () => {
        closeLightbox();
        closeDrawer();
      };
    };

    shell?.classList.remove('drawer-closed');
    renderVideoDrawer();
  };

  const resolvedRightActions = rightActions || actions;
  const secondaryVisible = showSecondaryRow !== false;

  return h(
    'div',
    { className: `w-full flex flex-col gap-3 ${className}` },
    [
      // Top row: help + title
      h(
        'div',
        { className: 'flex items-center gap-3 section-header-top' },
        [
          showHelpIcon ? h(VideoHelpIcon, { isActive: helpActive, onClick: openHelp }) : null,
          h('h1', { className: 'text-2xl font-semibold text-slate-900 dark:text-white leading-tight' }, title),
        ].filter(Boolean)
      ),
      // Bottom row: left actions | switcher | search | right actions
      h(
        'div',
        { className: `flex flex-wrap items-center gap-3 w-full section-header-bottom ${secondaryVisible ? '' : 'section-header-bottom--hidden'}` },
        [
          leftActions ? h('div', { className: 'flex items-center gap-2' }, leftActions) : null,
          switcherOptions && switcherOptions.length
            ? h(
                'div',
                { className: 'inline-flex items-center gap-1 rounded-full border border-slate-300 dark:border-white/10 bg-slate-50 dark:bg-slate-800 px-1 py-1' },
                switcherOptions.map((opt) =>
                  h(
                    'button',
                    {
                      key: opt.value,
                      type: 'button',
                      className: [
                        'px-3 py-1 rounded-full text-sm font-medium transition-colors border',
                        opt.value === switcherValue
                          ? 'bg-[var(--color-brand-purple,#711FFF)] dark:bg-[var(--color-brand-purple,#711FFF)] text-white shadow-sm border-transparent'
                          : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white bg-transparent border-transparent hover:bg-slate-100 hover:border-slate-300 dark:hover:bg-white/10 dark:hover:border-white/25',
                      ].join(' '),
                      onClick: () => onSwitcherChange && onSwitcherChange(opt.value),
                    },
                    opt.label
                  )
                )
              )
            : null,
          showSearch
            ? h(
                'div',
                { className: 'flex-1 min-w-[200px] section-header-search' },
                h('input', {
                  type: 'search',
                  value: localSearch,
                  onChange: (e) => {
                    setLocalSearch(e.target.value);
                    onSearchChange && onSearchChange(e.target.value);
                  },
                  placeholder: searchPlaceholder,
                  className:
                    'w-full rounded-lg border border-slate-300 dark:border-white/10 bg-white dark:bg-slate-900 px-3 py-2 text-sm text-slate-800 dark:text-white shadow-inner focus:outline-none focus:ring-2 focus:ring-netnet-purple',
                })
              )
            : null,
          resolvedRightActions ? h('div', { className: 'flex items-center gap-2' }, resolvedRightActions) : null,
        ].filter(Boolean)
      ),
    ]
  );
}
