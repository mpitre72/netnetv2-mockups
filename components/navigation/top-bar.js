import { timeIcons } from '../../app-shell/app-icons-config.js';

const { createElement: h } = React;

function HeaderIconButton({ ariaLabel, children }) {
  return h(
    'button',
    {
      type: 'button',
      className: 'header-icon-button header-icon-button--small relative',
      'aria-label': ariaLabel,
    },
    children
  );
}

function TimerPreviewButton() {
  return h(
    'button',
    {
      type: 'button',
      className: 'time-icon-button relative inline-flex items-center justify-center h-9 w-9',
      'aria-label': 'Timer',
    },
    [
      h('img', {
        src: timeIcons.idle,
        alt: 'Timer',
        className: 'h-5 w-5 select-none pointer-events-none',
      }),
      h('span', { className: 'time-icon-dot', 'aria-hidden': 'true' }),
    ]
  );
}

export function TopBarChromeDemo() {
  return h(
    'div',
    { className: 'bg-netnet-purple rounded-lg px-3 py-2 flex items-center gap-3 justify-end' },
    [
      h(TimerPreviewButton),
      h('span', { className: 'h-5 w-px bg-white/25' }),
      h(
        HeaderIconButton,
        { ariaLabel: 'Help and documentation' },
        h(
          'svg',
          {
            className: 'header-icon-glyph-small',
            viewBox: '0 0 24 24',
            fill: 'none',
            stroke: 'currentColor',
            strokeWidth: '2',
          },
          [
            h('circle', { cx: '12', cy: '12', r: '10' }),
            h('path', { d: 'M9.5 9a2.5 2.5 0 1 1 3.5 2.3c-.7.3-1 1-1 1.7V14' }),
            h('circle', { cx: '12', cy: '17', r: '1' }),
          ]
        )
      ),
      h(
        HeaderIconButton,
        { ariaLabel: 'Notifications' },
        h(
          'svg',
          {
            className: 'header-icon-glyph-small',
            viewBox: '0 0 24 24',
            fill: 'none',
            stroke: 'currentColor',
            strokeWidth: '1.8',
          },
          [
            h('path', { d: 'M18 8a6 6 0 10-12 0c0 7-3 9-3 9h18s-3-2-3-9' }),
            h('path', { d: 'M13.73 21a2 2 0 01-3.46 0' }),
          ]
        )
      ),
      h(
        HeaderIconButton,
        { ariaLabel: 'Toggle light and dark theme' },
        h(
          'svg',
          {
            className: 'header-icon-glyph-small',
            viewBox: '0 0 24 24',
            fill: 'currentColor',
          },
          [
            h('path', { d: 'M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z' }),
          ]
        )
      ),
    ]
  );
}
