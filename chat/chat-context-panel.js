import { ChatContextEmptyState } from './chat-empty-states.js';

const { createElement: h } = React;

function ContextItem({ item }) {
  return h('div', {
    className: 'rounded-lg border border-slate-200 bg-white px-3 py-2.5 dark:border-white/10 dark:bg-white/5',
  }, [
    h('div', { className: 'text-sm font-semibold text-slate-800 dark:text-slate-100' }, item.title),
    item.meta
      ? h('div', { className: 'mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400' }, item.meta)
      : null,
  ]);
}

function ContextSection({ title, items = [], emptyText }) {
  return h('section', { className: 'space-y-2' }, [
    h('div', { className: 'flex items-center justify-between gap-2' }, [
      h('h3', { className: 'text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400' }, title),
      h('span', { className: 'text-xs text-slate-400 dark:text-slate-500' }, String(items.length)),
    ]),
    items.length
      ? h('div', { className: 'space-y-2' }, items.map((item) => h(ContextItem, { key: `${title}-${item.title}`, item })))
      : h('div', {
        className: 'rounded-lg border border-dashed border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-500 dark:border-white/10 dark:bg-white/5 dark:text-slate-400',
      }, emptyText),
  ]);
}

export function ChatContextPanel({ conversation }) {
  const context = conversation?.workContext || null;
  return h('aside', {
    className: 'flex min-h-0 flex-col overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm dark:border-white/10 dark:bg-slate-900/70',
    'data-chat-right-panel': 'work-context',
  }, [
    h('header', { className: 'border-b border-slate-200 px-4 py-3 dark:border-white/10' }, [
      h('div', { className: 'text-sm font-semibold text-slate-900 dark:text-white' }, 'Work Context'),
      h('p', { className: 'mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400' }, 'Linked work, decisions, and resources for the selected conversation.'),
    ]),
    h('div', { className: 'min-h-0 flex-1 space-y-5 overflow-y-auto p-4' }, context
      ? [
        h(ContextSection, {
          key: 'linked-work',
          title: 'Linked Work',
          items: context.linkedWork || [],
          emptyText: 'No work objects linked yet.',
        }),
        h(ContextSection, {
          key: 'decisions',
          title: 'Decisions',
          items: context.decisions || [],
          emptyText: 'No pinned decisions yet.',
        }),
        h(ContextSection, {
          key: 'resources',
          title: 'Resources',
          items: context.resources || [],
          emptyText: 'No resources attached yet.',
        }),
      ]
      : h(ChatContextEmptyState)),
  ]);
}
