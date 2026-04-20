import { filterMentionOptions, formatWorkMentionLabel } from './chat-mention-utils.js';

const { createElement: h, useEffect, useMemo, useRef, useState } = React;

function SendIcon() {
  return h('svg', { width: 18, height: 18, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': 'true' }, [
    h('line', { x1: 12, y1: 19, x2: 12, y2: 5 }),
    h('polyline', { points: '5 12 12 5 19 12' }),
  ]);
}

function ComposerHint({ children }) {
  return h('span', {
    className: 'text-xs font-medium text-slate-400 dark:text-slate-500',
  }, children);
}

function optionMeta(option = {}) {
  if (option.type === 'person') return 'Person';
  if (option.type === 'job') return 'Job';
  if (option.type === 'deliverable') return option.jobLabel ? `Deliverable · ${option.jobLabel}` : 'Deliverable';
  if (option.type === 'task') return option.deliverableLabel ? `Task · ${option.deliverableLabel}` : 'Task';
  return '';
}

function MentionMenu({ trigger, options = [], activeIndex = 0, onChoose, onHover }) {
  if (!trigger) return null;
  const label = trigger === 'work' ? 'Work references' : 'People';
  const selectedIndex = Math.min(activeIndex, Math.max(options.length - 1, 0));
  return h('div', {
    className: 'absolute bottom-full left-0 z-50 mb-2 w-[min(360px,calc(100vw-3rem))] overflow-hidden rounded-lg border border-slate-200 bg-white shadow-xl dark:border-white/10 dark:bg-slate-950',
    role: 'listbox',
    'aria-label': label,
    'data-chat-mention-menu': trigger,
  }, [
    h('div', { className: 'border-b border-slate-100 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-400 dark:border-white/10 dark:text-slate-500' }, label),
    options.length ? h('div', { className: 'max-h-72 overflow-y-auto p-1' }, options.map((option, index) => h('button', {
      key: `${option.type}-${option.id}`,
      type: 'button',
      role: 'option',
      'aria-selected': index === selectedIndex ? 'true' : 'false',
      className: [
        'flex w-full min-w-0 flex-col items-start gap-0.5 rounded-md px-2 py-2 text-left transition-colors focus:outline-none',
        index === selectedIndex
          ? 'bg-netnet-purple/10 text-netnet-purple dark:bg-white/10 dark:text-white'
          : 'text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-white/10',
      ].join(' '),
      onMouseEnter: () => onHover?.(index),
      onMouseDown: (event) => {
        event.preventDefault();
        onChoose?.(option);
      },
    }, [
      h('span', { className: 'max-w-full truncate text-sm font-semibold' }, (
        option.type === 'person' ? option.label : formatWorkMentionLabel(option)
      )),
      h('span', { className: 'max-w-full truncate text-xs text-slate-400 dark:text-slate-500' }, optionMeta(option)),
    ]))) : h('div', { className: 'px-3 py-4 text-sm text-slate-400 dark:text-slate-500' }, 'No matches'),
  ]);
}

export function ChatComposer({
  mode = 'channel',
  value = '',
  disabled = false,
  replyTarget = null,
  mentionOptions = {},
  onChange,
  onSubmit,
  onCancelReply,
}) {
  const textareaRef = useRef(null);
  const [mentionMenu, setMentionMenu] = useState(null);
  const [activeMentionIndex, setActiveMentionIndex] = useState(0);
  const canSend = !disabled && String(value || '').trim().length > 0;
  const menuOptions = useMemo(() => {
    if (!mentionMenu) return [];
    const options = mentionMenu.trigger === 'work'
      ? mentionOptions.work || []
      : mentionOptions.people || [];
    return filterMentionOptions(options, mentionMenu.query, 8);
  }, [mentionMenu, mentionOptions]);

  useEffect(() => {
    if (replyTarget && !disabled) textareaRef.current?.focus();
  }, [replyTarget, disabled]);

  useEffect(() => {
    if (disabled) setMentionMenu(null);
  }, [disabled]);

  const detectMentionMenu = (nextValue, caret) => {
    if (disabled || caret == null) {
      setMentionMenu(null);
      return;
    }
    const beforeCaret = String(nextValue || '').slice(0, caret);
    const workStart = beforeCaret.lastIndexOf('[[');
    const atStart = beforeCaret.lastIndexOf('@');
    const workQuery = workStart >= 0 ? beforeCaret.slice(workStart + 2) : '';
    const atQuery = atStart >= 0 ? beforeCaret.slice(atStart + 1) : '';
    const workActive = workStart >= 0
      && workStart > atStart
      && !workQuery.includes(']]')
      && !workQuery.includes('\n');
    const personActive = atStart >= 0
      && atStart > workStart
      && /^[A-Za-z.' -]*$/.test(atQuery)
      && (atStart === 0 || /[\s([{:]/.test(beforeCaret[atStart - 1]));

    if (workActive) {
      setMentionMenu({ trigger: 'work', start: workStart, end: caret, query: workQuery });
      setActiveMentionIndex(0);
      return;
    }
    if (personActive) {
      setMentionMenu({ trigger: 'person', start: atStart, end: caret, query: atQuery });
      setActiveMentionIndex(0);
      return;
    }
    setMentionMenu(null);
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    if (canSend) onSubmit?.();
  };

  const chooseMention = (option) => {
    if (!mentionMenu || !option) return;
    const currentValue = String(value || '');
    const raw = mentionMenu.trigger === 'work' ? `[[${formatWorkMentionLabel(option)}]]` : `@${option.label}`;
    const nextChar = currentValue[mentionMenu.end] || '';
    const suffix = nextChar && /\s/.test(nextChar) ? '' : ' ';
    const nextValue = `${currentValue.slice(0, mentionMenu.start)}${raw}${suffix}${currentValue.slice(mentionMenu.end)}`;
    const nextCaret = mentionMenu.start + raw.length + suffix.length;
    onChange?.(nextValue);
    setMentionMenu(null);
    window.requestAnimationFrame(() => {
      textareaRef.current?.focus();
      textareaRef.current?.setSelectionRange(nextCaret, nextCaret);
    });
  };

  const handleKeyDown = (event) => {
    if (mentionMenu) {
      if (event.key === 'ArrowDown') {
        event.preventDefault();
        setActiveMentionIndex((index) => Math.min(index + 1, Math.max(menuOptions.length - 1, 0)));
        return;
      }
      if (event.key === 'ArrowUp') {
        event.preventDefault();
        setActiveMentionIndex((index) => Math.max(index - 1, 0));
        return;
      }
      if (event.key === 'Escape') {
        event.preventDefault();
        setMentionMenu(null);
        return;
      }
      if (event.key === 'Enter' && menuOptions.length) {
        event.preventDefault();
        chooseMention(menuOptions[activeMentionIndex] || menuOptions[0]);
        return;
      }
      if (event.key === 'Enter') {
        event.preventDefault();
        return;
      }
    }
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      if (canSend) onSubmit?.();
    }
  };

  const handleChange = (event) => {
    const nextValue = event.target.value;
    onChange?.(nextValue);
    detectMentionMenu(nextValue, event.target.selectionStart);
  };

  return h('div', {
    className: 'sticky bottom-0 z-40 border-t border-slate-200 bg-white/90 py-2.5 backdrop-blur dark:border-white/10 dark:bg-slate-950/90',
    'data-chat-composer': mode,
    'data-chat-composer-disabled': disabled ? 'true' : 'false',
  }, [
    h('form', {
      onSubmit: handleSubmit,
      className: [
        'w-full rounded-lg border px-3 py-2 transition-colors focus-within:ring-2 focus-within:ring-netnet-purple/35',
        disabled
          ? 'border-slate-200 bg-slate-50/90 text-slate-500 dark:border-white/10 dark:bg-white/5 dark:text-slate-400'
          : 'border-netnet-purple/60 bg-white text-slate-400 shadow-sm focus:border-netnet-purple dark:border-netnet-purple/60 dark:bg-slate-900/95 dark:text-slate-500',
      ].join(' '),
      'aria-disabled': disabled ? 'true' : undefined,
    }, [
      replyTarget ? h('div', {
        className: 'mb-2 flex items-center justify-between gap-3 rounded-md bg-netnet-purple/5 px-2 py-1.5 text-xs text-slate-500 dark:bg-white/5 dark:text-slate-300',
        'data-chat-reply-target': replyTarget.threadId,
      }, [
        h('span', { className: 'min-w-0 truncate' }, [
          'Replying to ',
          h('strong', { className: 'font-semibold text-slate-700 dark:text-white' }, replyTarget.author || 'message'),
          replyTarget.sourceLabel ? ` in ${replyTarget.sourceLabel}` : '',
        ]),
        h('button', {
          type: 'button',
          className: 'shrink-0 font-semibold text-netnet-purple hover:brightness-110 dark:text-white',
          onClick: onCancelReply,
        }, 'Cancel'),
      ]) : null,
      h('div', { className: 'relative flex items-end gap-2' }, [
        h('textarea', {
          ref: textareaRef,
          'data-chat-composer-input': 'true',
          'data-chat-composer-input-disabled': disabled ? 'true' : 'false',
          'aria-label': replyTarget ? 'Write a reply' : 'Write a message',
          rows: 1,
          value,
          disabled,
          placeholder: disabled
            ? 'Choose Reply on a message to respond from Stream.'
            : replyTarget
              ? 'Write a reply...'
              : 'Write a message...',
          onChange: handleChange,
          onKeyDown: handleKeyDown,
          onClick: (event) => detectMentionMenu(value, event.target.selectionStart),
          className: 'min-h-[34px] max-h-[160px] flex-1 resize-none border-0 bg-transparent p-0 text-sm leading-6 text-slate-900 outline-none placeholder:text-slate-400 focus:ring-0 disabled:cursor-default disabled:text-slate-500 dark:text-white dark:placeholder:text-slate-500 dark:disabled:text-slate-400',
        }),
        mentionMenu ? h(MentionMenu, {
          trigger: mentionMenu.trigger,
          options: menuOptions,
          activeIndex: activeMentionIndex,
          onChoose: chooseMention,
          onHover: setActiveMentionIndex,
        }) : null,
        h('button', {
          type: 'submit',
          className: 'mb-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-300 text-white transition-colors enabled:bg-netnet-purple enabled:hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-slate-700 dark:enabled:bg-netnet-purple',
          disabled: !canSend,
          'aria-label': replyTarget ? 'Send reply' : 'Send message',
          title: replyTarget ? 'Send reply' : 'Send message',
        }, h(SendIcon)),
      ]),
      h('div', { className: 'mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-slate-200 pt-2 dark:border-white/10' }, [
        h(ComposerHint, null, '[[ work references'),
        h(ComposerHint, null, '@ people'),
        h('span', { className: 'ml-auto text-xs text-slate-400 dark:text-slate-500' }, (
          disabled
            ? 'No new top-level messages'
            : replyTarget
              ? 'Reply mode'
              : 'Top-level message'
        )),
      ]),
    ]),
  ]);
}
