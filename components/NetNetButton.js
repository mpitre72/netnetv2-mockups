const { createElement: h } = React;

const baseButtonClass =
  'inline-flex items-center justify-center gap-2 font-semibold rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-netnet-purple focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-slate-900';

const sizeMap = { sm: 'px-3 py-2 text-sm', md: 'px-4 py-2.5 text-sm', lg: 'px-5 py-3 text-base' };

const variantStyles = {
  primary: {
    base: 'bg-netnet-purple text-white shadow-md shadow-netnet-purple/25',
    hover: 'bg-[#5c1ad8] shadow-lg',
    active: 'bg-[#5116c3] shadow-inner translate-y-[1px]',
    disabled: 'bg-netnet-purple/50 text-white/70 shadow-none cursor-not-allowed',
  },
  secondary: {
    base: 'bg-white text-slate-900 border border-slate-200 shadow-sm dark:bg-slate-900 dark:text-white dark:border-slate-700',
    hover: 'bg-slate-50 border-slate-300 dark:bg-slate-800 dark:border-slate-600',
    active: 'bg-slate-100 border-slate-400 translate-y-[1px] dark:bg-slate-700 dark:border-slate-500',
    disabled:
      'bg-slate-100 text-slate-400 border-slate-200 shadow-none cursor-not-allowed dark:bg-slate-800 dark:text-slate-500 dark:border-slate-700',
  },
  ghost: {
    base: 'bg-transparent text-slate-700 dark:text-white',
    hover: 'bg-slate-100 dark:bg-white/10',
    active: 'bg-slate-200 translate-y-[1px] dark:bg-white/15',
    disabled: 'text-slate-400 cursor-not-allowed dark:text-slate-500',
  },
  icon: {
    base:
      'p-2 w-10 h-10 text-slate-700 bg-white border border-slate-200 rounded-md shadow-sm dark:bg-slate-900 dark:text-white dark:border-slate-700',
    hover:
      'bg-slate-50 text-netnet-purple border-slate-300 dark:bg-slate-800 dark:text-netnet-purple dark:border-slate-600',
    active: 'bg-slate-100 translate-y-[1px] dark:bg-slate-700',
    disabled: 'text-slate-400 border-slate-200 shadow-none cursor-not-allowed dark:text-slate-500 dark:border-slate-700',
  },
};

export function NetNetButton({
  variant = 'primary',
  label = 'Button',
  size = 'md',
  state = 'default',
  fullWidth = false,
  icon,
}) {
  const v = variantStyles[variant] || variantStyles.primary;
  const stateClass =
    state === 'hover'
      ? v.hover
      : state === 'active'
      ? v.active
      : state === 'disabled'
      ? v.disabled
      : v.base;

  const content = icon
    ? h('span', { className: 'inline-flex items-center justify-center' }, icon)
    : h('span', null, label);

  const width = fullWidth ? 'w-full' : '';
  const sizeClass = sizeMap[size] || sizeMap.md;

  return h(
    'button',
    {
      type: 'button',
      className: `${baseButtonClass} ${sizeClass} ${stateClass} ${width}`,
      disabled: state === 'disabled',
    },
    content
  );
}
