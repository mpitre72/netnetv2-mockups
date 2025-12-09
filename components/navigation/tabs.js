const { createElement: h, useState, Children, cloneElement } = React;

export function Tabs({ value: controlledValue, defaultValue, onChange, children, className = '' }) {
  const [internalValue, setInternalValue] = useState(defaultValue);
  const value = controlledValue !== undefined ? controlledValue : internalValue;

  function handleChange(nextValue) {
    if (controlledValue === undefined) {
      setInternalValue(nextValue);
    }
    if (typeof onChange === 'function') {
      onChange(nextValue);
    }
  }

  const items = Children.toArray(children).map((child) => {
    if (!child || typeof child !== 'object') return child;
    const childValue = child.props.value;
    const active = childValue === value;
    return cloneElement(child, {
      active,
      onChange: () => handleChange(childValue),
    });
  });

  return h(
    'div',
    {
      className: ['flex items-center gap-2 overflow-x-auto scrollbar-none w-full', className].filter(Boolean).join(' '),
    },
    items
  );
}

export function Tab({ value, label, active = false, closable = false, onChange, onClose }) {
  const classes = ['workspace-tab'];
  if (active) classes.push('workspace-tab--active');

  const labelNode = h('span', { className: 'workspace-tab__label' }, label);

  const closeNode = closable
    ? h(
        'span',
        {
          className: 'workspace-tab__close',
          'aria-label': `Close tab ${label}`,
          onClick: (e) => {
            e.stopPropagation();
            if (typeof onClose === 'function') onClose();
          },
        },
        '\u00d7'
      )
    : null;

  return h(
    'button',
    {
      type: 'button',
      className: classes.join(' '),
      onClick: () => {
        if (typeof onChange === 'function') onChange();
      },
      'data-tab-value': value,
    },
    [labelNode, closeNode]
  );
}

export function NewTabButton({ onClick }) {
  return h(
    'button',
    {
      type: 'button',
      className: 'workspace-tab workspace-tab--new',
      title: 'Open new tab',
      onClick,
    },
    '+'
  );
}
