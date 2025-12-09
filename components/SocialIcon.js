const { createElement: h } = React;

export function SocialIcon({ src, alt = 'Social icon', href }) {
  if (!src) {
    console.warn('[SocialIcon] Missing src');
    return null;
  }
  const iconImg = h('img', {
    src,
    alt,
    className: 'h-5 w-5 object-contain',
    loading: 'lazy',
  });

  const baseClass =
    'inline-flex items-center justify-center h-12 w-12 rounded-lg border border-slate-200 text-slate-700 dark:text-white bg-white dark:bg-slate-900 shadow-sm';

  if (href) {
    return h(
      'a',
      {
        href,
        target: '_blank',
        rel: 'noopener noreferrer',
        className: `${baseClass} hover:border-netnet-purple/60 transition`,
      },
      iconImg
    );
  }

  return h('div', { className: baseClass }, iconImg);
}
