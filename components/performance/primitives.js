const { createElement: h, useState, useEffect, useRef } = React;
const { createPortal } = ReactDOM;

export function PerfCard({ children, className = '', variant = 'primary' }) {
  const variantClass = variant === 'secondary'
    ? 'rounded-xl p-4'
    : 'rounded-2xl p-5';
  return h('div', {
    className: [
      'border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900/80 shadow-sm',
      variantClass,
      className,
    ].join(' '),
  }, children);
}

export function PerfSectionTitle({ title, subtitle, rightSlot, className = '' }) {
  return h('div', { className: `flex items-center justify-between gap-3 flex-wrap ${className}` }, [
    h('div', { className: 'space-y-1' }, [
      h('div', { className: 'text-lg font-semibold text-slate-900 dark:text-white' }, title),
      subtitle ? h('div', { className: 'text-sm text-slate-600 dark:text-slate-300' }, subtitle) : null,
    ]),
    rightSlot || null,
  ]);
}

export function InfoPopover({ title = 'Info', content, iconLabel = 'Info', widthPx = 520, onOpenChange }) {
  const btnRef = useRef(null);
  const popRef = useRef(null);
  const [hoverOpen, setHoverOpen] = useState(false);
  const [pinnedOpen, setPinnedOpen] = useState(false);
  const [coords, setCoords] = useState({ top: 0, left: 0, maxHeight: 320 });
  const closeTimer = useRef(null);
  const hoverTimer = useRef(null);

  const clamp = (n, min, max) => Math.min(max, Math.max(min, n));
  const isOpen = hoverOpen || pinnedOpen;
  useEffect(() => {
    onOpenChange?.(isOpen);
  }, [isOpen, onOpenChange]);

  const positionPanel = () => {
    const rect = btnRef.current?.getBoundingClientRect();
    if (!rect) return;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const margin = 12;
    const gap = 10;
    const minUsefulHeight = 240;
    const panelWidth = Math.min(widthPx, vw - margin * 2);
    const left = clamp(rect.left + rect.width / 2 - panelWidth / 2, margin, vw - panelWidth - margin);
    const spaceBelow = vh - rect.bottom - gap - margin;
    const spaceAbove = rect.top - gap - margin;
    const placeAbove = spaceBelow < minUsefulHeight && spaceAbove > spaceBelow;
    const maxHeight = Math.max(160, Math.min(placeAbove ? spaceAbove : spaceBelow, vh - margin * 2));
    const stylePos = placeAbove
      ? { left, maxHeight, bottom: vh - rect.top + gap }
      : { left, maxHeight, top: rect.bottom + gap };
    setCoords(stylePos);
  };

  const openPanel = () => {
    clearTimeout(closeTimer.current);
    clearTimeout(hoverTimer.current);
    setHoverOpen(true);
    positionPanel();
  };

  const scheduleClose = () => {
    clearTimeout(closeTimer.current);
    closeTimer.current = setTimeout(() => {
      if (!pinnedOpen) setHoverOpen(false);
    }, 180);
  };
  const cancelClose = () => {
    clearTimeout(closeTimer.current);
    clearTimeout(hoverTimer.current);
  };

  useEffect(() => {
    if (!isOpen) return;
    positionPanel();
    const onKey = (e) => { if (e.key === 'Escape') { e.preventDefault(); setPinnedOpen(false); setHoverOpen(false); } };
    const onPointer = (e) => {
      const pop = popRef.current;
      const btn = btnRef.current;
      if (pop && pop.contains(e.target)) return;
      if (btn && btn.contains(e.target)) return;
      setPinnedOpen(false);
      setHoverOpen(false);
    };
    const onHash = () => {
      setPinnedOpen(false);
      setHoverOpen(false);
    };
    window.addEventListener('resize', positionPanel);
    window.addEventListener('scroll', positionPanel, true);
    document.addEventListener('keydown', onKey);
    document.addEventListener('pointerdown', onPointer, true);
    window.addEventListener('hashchange', onHash);
    return () => {
      window.removeEventListener('resize', positionPanel);
      window.removeEventListener('scroll', positionPanel, true);
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('pointerdown', onPointer, true);
      window.removeEventListener('hashchange', onHash);
    };
  }, [isOpen, widthPx]);

  const tooltip = isOpen ? createPortal(
    h('div', { className: 'fixed inset-0 z-[2000] pointer-events-none' }, [
      h('div', {
        ref: popRef,
        role: 'dialog',
        className: 'pointer-events-auto rounded-2xl border border-slate-200/70 dark:border-white/15 bg-slate-900 text-slate-100 shadow-2xl p-4 space-y-3 max-w-full z-[2100]',
        style: {
          width: `${Math.min(widthPx, window.innerWidth - 24)}px`,
          left: `${coords.left || 0}px`,
          top: coords.top != null ? `${coords.top}px` : undefined,
          bottom: coords.bottom != null ? `${coords.bottom}px` : undefined,
          maxHeight: `${coords.maxHeight || 320}px`,
          overflowY: 'auto',
          overscrollBehavior: 'contain',
          WebkitOverflowScrolling: 'touch',
          position: 'fixed',
        },
        onMouseEnter: cancelClose,
        onMouseLeave: scheduleClose,
        onMouseDown: (e) => e.stopPropagation(),
        onClick: (e) => e.stopPropagation(),
      }, [
        h('div', { className: 'text-sm font-semibold' }, title),
        h('div', { className: 'space-y-2 text-sm leading-relaxed text-slate-200' }, content),
      ]),
    ]),
    document.body
  ) : null;

  return h('span', {
    className: 'inline-flex items-center',
    onMouseEnter: () => { if (!pinnedOpen) { clearTimeout(hoverTimer.current); hoverTimer.current = setTimeout(openPanel, 50); } },
    onMouseLeave: () => { if (!pinnedOpen) scheduleClose(); },
  }, [
    h('button', {
      ref: btnRef,
      type: 'button',
      'aria-label': iconLabel,
      'aria-expanded': isOpen,
      className: 'inline-flex items-center justify-center w-6 h-6 rounded-full border border-slate-300 dark:border-white/20 text-slate-600 dark:text-slate-200 bg-white dark:bg-slate-800 shadow-sm transition transform hover:scale-110 focus:scale-110 hover:text-netnet-purple focus:text-netnet-purple focus:outline-none',
      onMouseEnter: () => { if (!pinnedOpen) openPanel(); },
      onMouseLeave: () => { if (!pinnedOpen) scheduleClose(); },
      onFocus: () => { if (!pinnedOpen) openPanel(); },
      onBlur: () => { if (!pinnedOpen) scheduleClose(); },
      onClick: (e) => {
        e.preventDefault();
        e.stopPropagation();
        const nextPinned = !pinnedOpen;
        setPinnedOpen(nextPinned);
        if (nextPinned) {
          setHoverOpen(false);
          positionPanel();
        } else {
          setHoverOpen(false);
        }
      },
      onKeyDown: (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          e.stopPropagation();
          const nextPinned = !pinnedOpen;
          setPinnedOpen(nextPinned);
          if (nextPinned) {
            setHoverOpen(false);
            positionPanel();
          } else {
            setHoverOpen(false);
          }
        }
      },
    }, h('span', { className: 'text-xs font-semibold' }, 'i')),
    tooltip,
  ]);
}

export function ActionModal({ title, description, children, onConfirm, onCancel, confirmLabel = 'Confirm', cancelLabel = 'Cancel' }) {
  return createPortal(
    h(React.Fragment, null,
      h('div', { className: 'fixed inset-0 z-50 flex items-center justify-center' }, [
        h('div', { className: 'absolute inset-0 bg-slate-900/50 backdrop-blur-sm', onClick: onCancel }),
        h('div', { className: 'relative w-full max-w-lg rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 shadow-2xl p-5 space-y-4' }, [
          h('div', { className: 'space-y-1' }, [
            h('h3', { className: 'text-lg font-semibold text-slate-900 dark:text-white' }, title),
            description ? h('p', { className: 'text-sm text-slate-600 dark:text-slate-300' }, description) : null,
          ]),
          children,
          h('div', { className: 'flex items-center justify-end gap-2' }, [
            h('button', { type: 'button', className: 'px-4 py-2 text-sm rounded-lg border border-slate-300 dark:border-white/20 text-slate-700 dark:text-white hover:bg-slate-50 dark:hover:bg-slate-800', onClick: onCancel }, cancelLabel),
            h('button', { type: 'button', className: 'px-4 py-2 text-sm rounded-lg bg-netnet-purple text-white hover:brightness-110', onClick: onConfirm }, confirmLabel),
          ]),
        ]),
      ])
    ),
    document.body
  );
}

export const STOPLIGHT = {
  green: { bg: 'bg-emerald-50 dark:bg-emerald-900/20', border: 'border-emerald-200 dark:border-emerald-800', text: 'text-emerald-700 dark:text-emerald-200', dot: 'bg-emerald-500' },
  amber: { bg: 'bg-amber-50 dark:bg-amber-900/20', border: 'border-amber-200 dark:border-amber-800', text: 'text-amber-700 dark:text-amber-200', dot: 'bg-amber-500' },
  red: { bg: 'bg-red-50 dark:bg-red-900/20', border: 'border-red-200 dark:border-red-800', text: 'text-red-700 dark:text-red-200', dot: 'bg-red-500' },
};

export function KPIBox({ title, value, subtext, tone = 'green', disabled = false, onClick, dataDemo } = {}) {
  const c = STOPLIGHT[tone] || STOPLIGHT.green;
  const disabledClasses = disabled ? 'opacity-60 cursor-not-allowed' : 'hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-netnet-purple';
  const valueClasses = disabled ? 'text-slate-400 dark:text-slate-600' : 'text-slate-900 dark:text-white';

  return h(
    'button',
    {
      type: 'button',
      'data-demo': dataDemo,
      disabled,
      onClick: disabled ? undefined : onClick,
      className: [
        'w-full text-left rounded-xl border shadow-sm p-4 flex flex-col gap-2 transition',
        c.bg,
        c.border,
        disabledClasses,
      ].join(' ')
    },
    [
      h('div', { className: 'flex items-center justify-between gap-2' }, [
        h('div', { className: 'flex items-center gap-2' }, [
          h('span', { className: `w-2.5 h-2.5 rounded-full ${c.dot}` }),
          h('p', { className: 'text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400' }, title),
        ]),
        disabled ? h('span', { className: 'text-[11px] text-slate-400 dark:text-slate-500' }, 'Disabled') : null,
      ]),
      h('div', { className: `text-2xl font-bold ${valueClasses}` }, value),
      h('p', { className: 'text-sm text-slate-600 dark:text-slate-300' }, subtext),
    ]
  );
}

function clampPercent(value) {
  const num = Number.isFinite(value) ? value : 0;
  if (num < 0) return 0;
  if (num > 200) return 200;
  return num;
}

function getStackedMeterColors(percent, { completed = false } = {}) {
  if (completed) {
    return percent > 100
      ? { bar: 'bg-red-500', text: 'text-red-600 dark:text-red-300' }
      : { bar: 'bg-emerald-500', text: 'text-emerald-600 dark:text-emerald-300' };
  }
  if (percent > 100) return { bar: 'bg-red-500', text: 'text-red-600 dark:text-red-300' };
  if (percent >= 85) return { bar: 'bg-amber-500', text: 'text-amber-600 dark:text-amber-300' };
  return { bar: 'bg-emerald-500', text: 'text-emerald-600 dark:text-emerald-300' };
}

function StackedMeterBar({ label, actual, baseline, unit = 'h', completed = false }) {
  const pct = clampPercent((actual / (baseline || 1)) * 100);
  const colors = getStackedMeterColors(pct, { completed });
  const summary = `${actual}/${baseline}${unit}`;

  return h('div', { className: 'space-y-1' }, [
    h(
      'div',
      { className: 'flex items-center justify-between text-[11px] uppercase tracking-wide text-slate-500 dark:text-slate-400' },
      [
        h('span', null, label),
        h('span', { className: `font-semibold ${colors.text}` }, `${Math.round(pct)}%`),
      ]
    ),
    h('div', { className: 'flex items-center justify-between text-[12px] text-slate-600 dark:text-slate-300' }, [
      h('span', null, summary),
      h('span', { className: 'text-xs text-slate-500 dark:text-slate-400' }, completed ? 'Completed' : 'Active'),
    ]),
    h('div', { className: 'h-2 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden' }, [
      h('div', { className: `${colors.bar} h-full rounded-full transition-all`, style: { width: `${Math.min(pct, 130)}%` } }),
    ]),
  ]);
}

export function StackedMeter({ title, effort, timeline, completed = false, dataDemo, variant = 'card', showHeader = true } = {}) {
  const containerClass = variant === 'inline'
    ? 'space-y-2'
    : 'rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900/80 shadow-sm p-4 space-y-3';

  return h(
    'div',
    { className: containerClass, 'data-demo': dataDemo },
    [
      showHeader
        ? h('div', { className: 'flex items-center justify-between' }, [
            h('div', { className: 'text-sm font-semibold text-slate-800 dark:text-white' }, title),
            h('span', { className: 'text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400' }, completed ? 'Completed' : 'In Flight'),
          ])
        : null,
      h(StackedMeterBar, { label: 'Effort', ...effort, completed }),
      h(StackedMeterBar, { label: 'Timeline', ...timeline, completed }),
    ]
  );
}

export function RowActionsMenu({ onSelect, dataDemoButton, dataDemoMenu, menuItems } = {}) {
  const btnRef = useRef(null);
  const menuRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState({ top: 0, left: 0 });

  const items = (menuItems && menuItems.length)
    ? menuItems
    : ['Mark as Reviewed', 'Complete Deliverable', 'Change Deliverable Due Date', 'Reassign Tasks In Deliverable', 'Create Change Order'];

  const openMenu = () => {
    const rect = btnRef.current?.getBoundingClientRect();
    if (!rect) return;
    setCoords({
      top: rect.bottom + 8,
      left: Math.max(8, rect.right - 200),
    });
    setOpen(true);
  };

  useEffect(() => {
    if (!open) return;
    const handleKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    const handlePointer = (e) => {
      if (!menuRef.current || !btnRef.current) return;
      if (!menuRef.current.contains(e.target) && !btnRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    const handleHash = () => setOpen(false);
    document.addEventListener('keydown', handleKey);
    document.addEventListener('pointerdown', handlePointer, true);
    window.addEventListener('hashchange', handleHash);
    return () => {
      document.removeEventListener('keydown', handleKey);
      document.removeEventListener('pointerdown', handlePointer, true);
      window.removeEventListener('hashchange', handleHash);
    };
  }, [open]);

  const menu = open ? createPortal(
    h('div', { className: 'fixed inset-0 z-50 pointer-events-none', role: 'presentation' }, [
      h(
        'div',
        {
          ref: menuRef,
          'data-demo': dataDemoMenu,
          className: 'pointer-events-auto absolute min-w-[180px] rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 shadow-xl overflow-hidden',
          style: { top: `${coords.top}px`, left: `${coords.left}px` },
        },
        items.map((item) =>
          h(
            'button',
            {
              key: item,
              type: 'button',
              className: 'w-full text-left px-4 py-2.5 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-white/10 transition-colors',
              onClick: () => {
                onSelect?.(item);
                setOpen(false);
              },
            },
            item
          )
        )
      ),
    ]),
    document.body
  ) : null;

  return h('div', { className: 'relative inline-flex items-center' }, [
    h(
      'button',
      {
        ref: btnRef,
        type: 'button',
        'aria-haspopup': 'menu',
        'aria-expanded': open,
        'data-demo': dataDemoButton,
        className: 'p-2 rounded-full border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-200 shadow-sm hover:bg-slate-100 dark:hover:bg-slate-800 transition',
        onClick: () => { open ? setOpen(false) : openMenu(); },
      },
      h('svg', { width: 16, height: 16, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' }, [
        h('circle', { cx: '12', cy: '5', r: '1.5' }),
        h('circle', { cx: '12', cy: '12', r: '1.5' }),
        h('circle', { cx: '12', cy: '19', r: '1.5' }),
      ])
    ),
    menu,
  ]);
}

const CONF_LEVELS = {
  high: { label: 'High confidence', tone: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-100' },
  med: { label: 'Medium confidence', tone: 'bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-100' },
  low: { label: 'Low confidence', tone: 'bg-rose-100 text-rose-800 dark:bg-rose-900/50 dark:text-rose-100' },
  unset: { label: 'Confidence unset', tone: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-white' },
};

export function ProgressConfidenceChip({ level, onChange, dataDemo }) {
  const [open, setOpen] = useState(false);
  const btnRef = useRef(null);
  const menuRef = useRef(null);
  const opts = [
    { value: 'high', label: 'High' },
    { value: 'med', label: 'Medium' },
    { value: 'low', label: 'Low' },
    { value: null, label: 'Unset' },
  ];
  const currentKey = level || 'unset';
  const tone = CONF_LEVELS[currentKey] || CONF_LEVELS.unset;

  useEffect(() => {
    if (!open) return;
    const onPointer = (e) => {
      if (!menuRef.current || !btnRef.current) return;
      if (!menuRef.current.contains(e.target) && !btnRef.current.contains(e.target)) setOpen(false);
    };
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    const onHash = () => setOpen(false);
    document.addEventListener('pointerdown', onPointer, true);
    document.addEventListener('keydown', onKey);
    window.addEventListener('hashchange', onHash);
    return () => {
      document.removeEventListener('pointerdown', onPointer, true);
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('hashchange', onHash);
    };
  }, [open]);

  return h('div', { className: 'relative inline-flex', 'data-demo': dataDemo }, [
    h('button', {
      ref: btnRef,
      type: 'button',
      className: `inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold border border-transparent ${tone.tone} shadow-sm`,
      onClick: () => setOpen((v) => !v),
      title: 'Set progress confidence',
    }, [
      h('span', null, tone.label),
      h('svg', { width: 12, height: 12, viewBox: '0 0 20 20', fill: 'currentColor', className: 'opacity-70' }, [
        h('path', { d: 'M5 7l5 6 5-6H5z' }),
      ]),
    ]),
    open ? createPortal(
      h('div', { className: 'fixed inset-0 z-50 pointer-events-none', role: 'presentation' }, [
        h('div', {
          ref: menuRef,
          className: 'pointer-events-auto absolute mt-2 rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 shadow-xl overflow-hidden',
          style: { top: (btnRef.current?.getBoundingClientRect().bottom || 0) + 6, left: (btnRef.current?.getBoundingClientRect().left || 0) },
        },
          opts.map((opt) =>
            h('button', {
              key: opt.value === null ? 'unset' : opt.value,
              type: 'button',
              className: 'w-full text-left px-4 py-2 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-white/10',
              onClick: () => { onChange?.(opt.value); setOpen(false); },
            }, opt.label)
          )
        ),
      ]),
      document.body
    ) : null,
  ]);
}

export function ReviewedBadge({ reviewed }) {
  if (!reviewed) return null;
  const isBool = reviewed === true;
  const date = !isBool && reviewed.at ? new Date(reviewed.at).toLocaleString() : '';
  const label = 'Reviewed';
  const title = isBool
    ? label
    : reviewed.by
      ? `${label} by ${reviewed.by}${date ? ` on ${date}` : ''}`
      : date || label;
  return h('span', {
    className: 'inline-flex items-center gap-1 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-semibold px-2 py-1',
    title,
  }, [
    h('span', { className: 'w-2 h-2 rounded-full bg-emerald-500' }),
    h('span', null, label),
  ]);
}

export function DriftReasonChips({ reasons = [] }) {
  if (!reasons || !reasons.length) return null;
  return h('div', { className: 'flex flex-wrap gap-2' },
    reasons.map((r) =>
      h('span', {
        key: r.id,
        className: `inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold ${
          r.tone === 'red'
            ? 'bg-rose-50 text-rose-700 dark:bg-rose-900/40 dark:text-rose-100'
            : r.tone === 'amber'
              ? 'bg-amber-50 text-amber-800 dark:bg-amber-900/40 dark:text-amber-100'
              : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-100'
        }`,
      }, r.label)
    )
  );
}

export function MovedDateIndicator({ originalDate, newDate, changedAt, changedBy, dataDemoChip, dataDemoPopover } = {}) {
  const chipRef = useRef(null);
  const popRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState({ top: 0, left: 0 });

  const openPopover = () => {
    const rect = chipRef.current?.getBoundingClientRect();
    if (!rect) return;
    setCoords({
      top: rect.bottom + 8,
      left: Math.max(8, rect.left),
    });
    setOpen(true);
  };

  useEffect(() => {
    if (!open) return;
    const handlePointer = (e) => {
      if (!chipRef.current || !popRef.current) return;
      if (!popRef.current.contains(e.target) && !chipRef.current.contains(e.target)) setOpen(false);
    };
    const handleKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    const handleHash = () => setOpen(false);
    document.addEventListener('pointerdown', handlePointer, true);
    document.addEventListener('keydown', handleKey);
    window.addEventListener('hashchange', handleHash);
    return () => {
      document.removeEventListener('pointerdown', handlePointer, true);
      document.removeEventListener('keydown', handleKey);
      window.removeEventListener('hashchange', handleHash);
    };
  }, [open]);

  const popover = open ? createPortal(
    h('div', { className: 'fixed inset-0 z-40 pointer-events-none', role: 'presentation' }, [
      h(
        'div',
        {
          ref: popRef,
          'data-demo': dataDemoPopover,
          className: 'pointer-events-auto absolute w-64 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 shadow-xl p-4 space-y-2 text-sm text-slate-800 dark:text-slate-100',
          style: { top: `${coords.top}px`, left: `${coords.left}px` },
        },
        [
          h('div', { className: 'flex items-center justify-between' }, [
            h('span', { className: 'text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400' }, 'Moved Date'),
            h('button', { type: 'button', className: 'text-xs text-slate-400 hover:text-slate-600 dark:hover:text-white', onClick: () => setOpen(false) }, 'Close'),
          ]),
          h('div', { className: 'flex justify-between' }, [
            h('span', { className: 'text-slate-500 dark:text-slate-400' }, 'Original'),
            h('span', { className: 'font-semibold' }, originalDate),
          ]),
          h('div', { className: 'flex justify-between' }, [
            h('span', { className: 'text-slate-500 dark:text-slate-400' }, 'New'),
            h('span', { className: 'font-semibold' }, newDate),
          ]),
          h('div', { className: 'flex justify-between' }, [
            h('span', { className: 'text-slate-500 dark:text-slate-400' }, 'Changed at'),
            h('span', { className: 'font-semibold text-right' }, changedAt),
          ]),
          changedBy
            ? h('div', { className: 'flex justify-between' }, [
                h('span', { className: 'text-slate-500 dark:text-slate-400' }, 'By'),
                h('span', { className: 'font-semibold' }, changedBy),
              ])
            : null,
        ]
      ),
    ]),
    document.body
  ) : null;

  return h('div', { className: 'inline-flex items-center gap-2' }, [
    h('div', { className: 'text-sm font-semibold text-slate-800 dark:text-white' }, newDate),
    h(
      'button',
      {
        ref: chipRef,
        type: 'button',
        'data-demo': dataDemoChip,
        className: 'inline-flex items-center gap-1 rounded-full border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-200 px-3 py-1 text-xs font-semibold hover:shadow-sm transition',
        onClick: () => { open ? setOpen(false) : openPopover(); },
      },
      [
        h('span', { className: 'w-2 h-2 rounded-full bg-amber-500' }),
        h('span', null, 'Moved'),
      ]
    ),
    popover,
  ]);
}

export function FilterChips({ filters = [], onRemove, onClear, clearLabel = 'Clear filters', dataDemoClear, dataDemoWrapper } = {}) {
  const isDefault = !filters.length;
  return h('div', { className: 'space-y-2', 'data-demo': dataDemoWrapper }, [
    h('div', { className: 'flex flex-wrap gap-2' },
      filters.length
        ? filters.map((filter) =>
            h(
              'button',
              {
                key: filter,
                type: 'button',
                className: 'inline-flex items-center gap-2 rounded-full border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 px-3 py-1 text-sm text-slate-700 dark:text-slate-200 shadow-sm hover:bg-slate-50 dark:hover:bg-slate-800 transition',
                onClick: () => onRemove?.(filter),
              },
              [
                h('span', null, filter),
                h('span', { className: 'text-slate-400' }, '×'),
              ]
            )
          )
        : h('span', { className: 'text-sm text-slate-500 dark:text-slate-300' }, 'No filters applied')
    ),
    h(
      'button',
      {
        type: 'button',
        onClick: () => onClear?.(),
        disabled: isDefault,
        'data-demo': dataDemoClear,
        className: [
          'text-sm font-semibold',
          isDefault ? 'text-slate-400 dark:text-slate-500 cursor-not-allowed' : 'text-netnet-purple hover:text-[#6020df]',
        ].join(' ')
      },
      clearLabel
    ),
  ]);
}
