const { createElement: h } = React;

const PRIMARY_BUTTON_CLASS = [
  'inline-flex h-10 items-center justify-center rounded-md px-4',
  'bg-netnet-purple text-sm font-semibold text-white shadow-sm transition',
  'hover:brightness-110 focus-visible:outline-none focus-visible:ring-2',
  'focus-visible:ring-netnet-purple focus-visible:ring-offset-2',
  'focus-visible:ring-offset-white dark:focus-visible:ring-offset-slate-900',
  'disabled:cursor-not-allowed disabled:opacity-60',
].join(' ');

export function PrimaryButton({
  children,
  label,
  type = 'button',
  className = '',
  onClick,
  disabled = false,
  ...rest
} = {}) {
  return h('button', {
    type,
    className: [PRIMARY_BUTTON_CLASS, className].filter(Boolean).join(' '),
    onClick,
    disabled,
    ...rest,
  }, children ?? label ?? '');
}
