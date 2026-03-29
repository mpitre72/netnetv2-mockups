const { createElement: h } = React;

export function SelectInput({
  id,
  label = '',
  value = '',
  onChange,
  options = [],
  className = '',
  children,
  ...rest
} = {}) {
  const renderedOptions = children || options.map((option) => h('option', {
    key: option.value,
    value: option.value,
    disabled: !!option.disabled,
  }, option.label));

  return h('div', null, [
    label ? h('label', { key: 'label', htmlFor: id, className: 'lookup-modal__label' }, label) : null,
    h('select', {
      key: 'select',
      id,
      value,
      onChange,
      className: ['lookup-input', className].filter(Boolean).join(' '),
      ...rest,
    }, renderedOptions),
  ]);
}
