const { createElement: h } = React;

function stopEvent(event) {
  event.stopPropagation();
}

export function TaskSystemRow({
  taskId,
  expanded = false,
  onToggle,
  cells = [],
  expandedContent = null,
  colSpan = null,
  rowClassName = '',
  expandedRowClassName = '',
  toggleLabelExpanded = 'Collapse task',
  toggleLabelCollapsed = 'Expand task',
  rowProps = {},
  expandedCellClassName = 'px-6 pb-4',
}) {
  const nextColSpan = Number(colSpan) || (cells.length + 1);
  const toggle = () => onToggle?.(taskId);

  return h(React.Fragment, { key: taskId }, [
    h('tr', {
      ...rowProps,
      className: rowClassName,
      tabIndex: rowProps.tabIndex ?? 0,
      role: rowProps.role || 'button',
      'aria-expanded': expanded ? 'true' : 'false',
      onClick: (event) => {
        rowProps.onClick?.(event);
        if (event.defaultPrevented) return;
        toggle();
      },
      onKeyDown: (event) => {
        rowProps.onKeyDown?.(event);
        if (event.defaultPrevented) return;
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          toggle();
        }
      },
    }, [
      h('td', { className: 'px-6 py-3 text-sm text-gray-700 dark:text-gray-200 align-middle w-10' }, [
        h('button', {
          type: 'button',
          className: 'h-8 w-8 rounded-md border border-slate-200 dark:border-white/10 text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-white/5 disabled:opacity-50 flex items-center justify-center',
          onMouseDown: stopEvent,
          onClick: (event) => {
            stopEvent(event);
            toggle();
          },
          onKeyDown: stopEvent,
          'aria-label': expanded ? toggleLabelExpanded : toggleLabelCollapsed,
        }, [
          h('svg', {
            viewBox: '0 0 24 24',
            className: 'h-4 w-4 transition-transform duration-200',
            style: { transform: expanded ? 'rotate(90deg)' : 'rotate(0deg)' },
            fill: 'none',
            stroke: 'currentColor',
            strokeWidth: '2',
          }, [
            h('path', { d: 'M9 6l6 6-6 6', strokeLinecap: 'round', strokeLinejoin: 'round' }),
          ]),
        ]),
      ]),
      ...cells,
    ]),
    expanded
      ? h('tr', { className: expandedRowClassName }, [
        h('td', { colSpan: nextColSpan, className: expandedCellClassName }, expandedContent),
      ])
      : null,
  ]);
}
