const { createElement: h, useState, useEffect, useRef } = React;
const { createPortal } = ReactDOM;

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

export function RowActionsMenu({ onSelect, dataDemoButton, dataDemoMenu } = {}) {
  const btnRef = useRef(null);
  const menuRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState({ top: 0, left: 0 });

  const menuItems = ['Reassign', 'Change Order', 'Move Date'];

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
    const handleClick = (e) => {
      if (!menuRef.current || !btnRef.current) return;
      if (!menuRef.current.contains(e.target) && !btnRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener('keydown', handleKey);
    document.addEventListener('click', handleClick);
    return () => {
      document.removeEventListener('keydown', handleKey);
      document.removeEventListener('click', handleClick);
    };
  }, [open]);

  const menu = open ? createPortal(
    h('div', { className: 'fixed inset-0 z-50', role: 'presentation' }, [
      h('div', { className: 'absolute inset-0', onClick: () => setOpen(false) }),
      h(
        'div',
        {
          ref: menuRef,
          'data-demo': dataDemoMenu,
          className: 'absolute min-w-[180px] rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 shadow-xl overflow-hidden',
          style: { top: `${coords.top}px`, left: `${coords.left}px` },
        },
        menuItems.map((item) =>
          h(
            'button',
            {
              key: item,
              type: 'button',
              className: 'w-full text-left px-4 py-2.5 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-white/10 transition-colors',
              onClick: () => {
                console.log(`[RowActions] ${item}`);
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
    const handleClick = (e) => {
      if (!chipRef.current || !popRef.current) return;
      if (!popRef.current.contains(e.target) && !chipRef.current.contains(e.target)) setOpen(false);
    };
    const handleKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('click', handleClick);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('click', handleClick);
      document.removeEventListener('keydown', handleKey);
    };
  }, [open]);

  const popover = open ? createPortal(
    h('div', { className: 'fixed inset-0 z-40', role: 'presentation' }, [
      h('div', { className: 'absolute inset-0', onClick: () => setOpen(false) }),
      h(
        'div',
        {
          ref: popRef,
          'data-demo': dataDemoPopover,
          className: 'absolute w-64 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 shadow-xl p-4 space-y-2 text-sm text-slate-800 dark:text-slate-100',
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
