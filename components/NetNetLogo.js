const { createElement: h } = React;

const sizeClasses = { sm: 'h-6', md: 'h-8', lg: 'h-12' };

export function NetNetLogo({ src, alt = 'Net Net logo', size = 'md' }) {
  if (!src) {
    console.warn('[NetNetLogo] Missing src');
    return null;
  }
  return h('img', {
    src,
    alt,
    className: `${sizeClasses[size] || sizeClasses.md} w-auto drop-shadow-sm`,
    loading: 'lazy',
  });
}
