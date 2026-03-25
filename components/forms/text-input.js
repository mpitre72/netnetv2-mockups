const { createElement: h } = React;

export function TextInput({
  id,
  label = '',
  value = '',
  onChange,
  type = 'text',
  placeholder = '',
  className = '',
  multiline = false,
  rows = 3,
  hint = '',
  error = '',
  inputMode,
  ...rest
} = {}) {
  const inputClassName = ['lookup-input', className].filter(Boolean).join(' ');
  const sharedProps = {
    id,
    value,
    onChange,
    placeholder,
    className: inputClassName,
    inputMode,
    ...rest,
  };

  return h('div', null, [
    label ? h('label', { key: 'label', htmlFor: id, className: 'lookup-modal__label' }, label) : null,
    multiline
      ? h('textarea', {
        key: 'input',
        ...sharedProps,
        rows,
        style: { height: 'auto', minHeight: '88px', paddingTop: '8px', paddingBottom: '8px' },
      })
      : h('input', {
        key: 'input',
        ...sharedProps,
        type,
      }),
    error
      ? h('p', { key: 'error', className: 'mt-1 text-xs text-red-600 dark:text-red-400' }, error)
      : hint
        ? h('p', { key: 'hint', className: 'mt-1 text-xs text-slate-500 dark:text-slate-400' }, hint)
        : null,
  ]);
}
