const { createElement: h } = React;

const iconSizeClasses = {
  sm: 'h-5 w-5',
  md: 'h-6 w-6',
  lg: 'h-8 w-8',
};

export function NavIcon({ src, alt = 'Navigation icon', size = 'md' }) {
  if (!src) {
    console.warn('[NavIcon] Missing src');
    return null;
  }
  const cl = iconSizeClasses[size] || iconSizeClasses.md;
  return h('img', {
    src,
    alt,
    className: `${cl} object-contain`,
    loading: 'lazy',
  });
}
