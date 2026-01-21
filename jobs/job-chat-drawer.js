import { getCurrentUser, getCurrentUserId, loadTeamMembers } from '../quick-tasks/quick-tasks-store.js';
import { addJobChatMessage, retagJobChatMessage } from './jobs-store.js';

const { createElement: h, useEffect, useMemo, useRef, useState } = React;

function getInitials(name) {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '?';
  const first = parts[0][0] || '';
  const last = parts.length > 1 ? parts[parts.length - 1][0] : '';
  return `${first}${last}`.toUpperCase();
}

function formatTimestamp(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(date);
}

function getActiveTrigger(value, cursor) {
  if (!value || cursor == null) return null;
  const before = value.slice(0, cursor);
  const atIndex = Math.max(before.lastIndexOf('@'), before.lastIndexOf('~'));
  if (atIndex < 0) return null;
  const trigger = before[atIndex];
  if (atIndex > 0 && /\S/.test(before[atIndex - 1])) return null;
  const query = before.slice(atIndex + 1);
  if (/\s/.test(query)) return null;
  return { type: trigger === '@' ? 'people' : 'smart', start: atIndex, query };
}

function renderMessageBody(text) {
  const lines = String(text || '').split('\n');
  const renderLine = (line, lineIndex) => {
    const parts = line.split(/(\s+)/);
    return parts.map((part, partIndex) => {
      if (!part) return '';
      const trimmed = part.trim();
      if (trimmed.startsWith('@') || trimmed.startsWith('~')) {
        return h('span', { key: `${lineIndex}-${partIndex}`, className: 'text-netnet-purple dark:text-emerald-200 font-semibold' }, part);
      }
      return part;
    });
  };
  return lines.map((line, idx) => (
    h('span', { key: `line-${idx}` }, [
      ...renderLine(line, idx),
      idx < lines.length - 1 ? h('br', { key: `br-${idx}` }) : null,
    ])
  ));
}

export function JobChatDrawer({
  isOpen,
  job,
  jobNumber,
  target,
  messages = [],
  readOnly = false,
  onClose,
  onChatUpdate,
}) {
  const [composerText, setComposerText] = useState('');
  const [mentionState, setMentionState] = useState(null);
  const [mentionIndex, setMentionIndex] = useState(0);
  const [mentionIds, setMentionIds] = useState({ people: [], deliverables: [], tasks: [] });
  const [retagState, setRetagState] = useState(null);
  const composerRef = useRef(null);
  const members = useMemo(() => loadTeamMembers(), []);
  const currentUserId = useMemo(() => getCurrentUserId(members) || 'currentUser', [members]);
  const currentUser = useMemo(() => getCurrentUser(members), [members]);
  const memberMap = useMemo(() => new Map(members.map((member) => [String(member.id), member])), [members]);

  useEffect(() => {
    if (!isOpen) {
      setComposerText('');
      setMentionState(null);
      setMentionIndex(0);
      setMentionIds({ people: [], deliverables: [], tasks: [] });
      setRetagState(null);
    }
  }, [isOpen]);

  if (!isOpen || !job) return null;

  const deliverables = Array.isArray(job.deliverables) ? job.deliverables : [];
  const activeTarget = target || { type: 'job' };
  const isArchived = readOnly || job.status === 'archived';

  const teamIds = Array.isArray(job.teamUserIds) ? job.teamUserIds.map((id) => String(id)) : [];
  let peopleOptions = teamIds.length
    ? members.filter((member) => teamIds.includes(String(member.id)))
    : members;
  if (job.jobLeadUserId && !peopleOptions.some((member) => String(member.id) === String(job.jobLeadUserId))) {
    const lead = memberMap.get(String(job.jobLeadUserId));
    if (lead) peopleOptions = [lead, ...peopleOptions];
  }
  const showTeamHint = teamIds.length === 0;

  const smartOptions = useMemo(() => {
    const list = [];
    deliverables.forEach((deliverable) => {
      const deliverableLabel = deliverable.name || 'Deliverable';
      list.push({
        type: 'deliverable',
        id: String(deliverable.id),
        label: deliverableLabel,
        deliverableId: deliverable.id,
      });
      (deliverable.tasks || []).forEach((task) => {
        list.push({
          type: 'task',
          id: String(task.id),
          label: `${deliverableLabel} / ${task.title || 'Task'}`,
          deliverableId: deliverable.id,
          taskId: task.id,
        });
      });
    });
    return list;
  }, [deliverables]);

  const peopleMentions = peopleOptions.map((member) => ({
    id: String(member.id),
    label: member.name || member.email || 'Member',
    subtitle: member.email || '',
  }));

  const mentionOptions = useMemo(() => {
    if (!mentionState) return [];
    const query = mentionState.query.toLowerCase();
    const list = mentionState.type === 'people' ? peopleMentions : smartOptions;
    if (!query) return list;
    return list.filter((item) => item.label.toLowerCase().includes(query));
  }, [mentionState, peopleMentions, smartOptions]);

  const messagesForJob = useMemo(
    () => (messages || []).filter((message) => String(message.jobId) === String(job.id)),
    [messages, job.id]
  );

  const visibleMessages = useMemo(() => {
    if (activeTarget.type === 'task' && activeTarget.taskId) {
      return messagesForJob.filter((message) => message.tagTarget?.type === 'task' && String(message.taskId) === String(activeTarget.taskId));
    }
    if (activeTarget.type === 'deliverable' && activeTarget.deliverableId) {
      return messagesForJob.filter((message) => {
        if (message.tagTarget?.type === 'deliverable') {
          return String(message.deliverableId) === String(activeTarget.deliverableId);
        }
        if (message.tagTarget?.type === 'task') {
          return String(message.deliverableId) === String(activeTarget.deliverableId);
        }
        return false;
      });
    }
    return messagesForJob;
  }, [activeTarget, messagesForJob]);

  const contextDeliverable = deliverables.find((deliverable) => String(deliverable.id) === String(activeTarget.deliverableId)) || null;
  const contextTask = contextDeliverable?.tasks?.find((task) => String(task.id) === String(activeTarget.taskId)) || null;

  const contextLine = (() => {
    const label = jobNumber || job.id;
    const jobLabel = `Job ${label} ${job.name || 'Job'}`;
    if (activeTarget.type === 'task' && contextTask && contextDeliverable) {
      return `${jobLabel} - ${contextDeliverable.name || 'Deliverable'} / ${contextTask.title || 'Task'}`;
    }
    if (activeTarget.type === 'deliverable' && contextDeliverable) {
      return `${jobLabel} - ${contextDeliverable.name || 'Deliverable'}`;
    }
    return jobLabel;
  })();

  const applyTextUpdate = (value, cursor) => {
    setComposerText(value);
    setTimeout(() => {
      if (!composerRef.current) return;
      composerRef.current.focus();
      composerRef.current.selectionStart = cursor;
      composerRef.current.selectionEnd = cursor;
    }, 0);
    setMentionState(getActiveTrigger(value, cursor));
    setMentionIndex(0);
  };

  const insertTrigger = (symbol) => {
    const input = composerRef.current;
    if (!input) return;
    const start = input.selectionStart ?? composerText.length;
    const end = input.selectionEnd ?? composerText.length;
    const before = composerText.slice(0, start);
    const after = composerText.slice(end);
    const next = `${before}${symbol}${after}`;
    applyTextUpdate(next, start + symbol.length);
  };

  const addMentionId = (type, id) => {
    setMentionIds((prev) => {
      const key = type === 'people' ? 'people' : type === 'deliverable' ? 'deliverables' : 'tasks';
      const next = new Set(prev[key].map((item) => String(item)));
      next.add(String(id));
      return { ...prev, [key]: Array.from(next) };
    });
  };

  const handleSelectMention = (option) => {
    if (!mentionState || !option) return;
    const input = composerRef.current;
    const cursor = input?.selectionStart ?? composerText.length;
    const before = composerText.slice(0, mentionState.start);
    const after = composerText.slice(cursor);
    const token = mentionState.type === 'people'
      ? `@${option.label}`
      : `~${option.label}`;
    const next = `${before}${token} ${after}`;
    applyTextUpdate(next, before.length + token.length + 1);
    if (mentionState.type === 'people') {
      addMentionId('people', option.id);
    } else if (option.type === 'deliverable') {
      addMentionId('deliverable', option.deliverableId);
    } else if (option.type === 'task') {
      addMentionId('deliverable', option.deliverableId);
      addMentionId('task', option.taskId);
    }
    setMentionState(null);
  };

  const handleComposerChange = (event) => {
    const value = event.target.value;
    const cursor = event.target.selectionStart ?? value.length;
    setComposerText(value);
    setMentionState(getActiveTrigger(value, cursor));
    setMentionIndex(0);
  };

  const handleComposerKeyDown = (event) => {
    if (mentionState && mentionOptions.length) {
      if (event.key === 'ArrowDown') {
        event.preventDefault();
        setMentionIndex((prev) => (prev + 1) % mentionOptions.length);
        return;
      }
      if (event.key === 'ArrowUp') {
        event.preventDefault();
        setMentionIndex((prev) => (prev - 1 + mentionOptions.length) % mentionOptions.length);
        return;
      }
      if (event.key === 'Enter') {
        event.preventDefault();
        handleSelectMention(mentionOptions[mentionIndex]);
        return;
      }
      if (event.key === 'Escape') {
        event.preventDefault();
        setMentionState(null);
        return;
      }
    }
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      if (!isArchived) handleSend();
    }
  };

  const handleSend = () => {
    if (isArchived) return;
    const trimmed = composerText.trim();
    if (!trimmed) return;
    const payload = {
      jobId: job.id,
      deliverableId: activeTarget.type !== 'job' ? activeTarget.deliverableId || null : null,
      taskId: activeTarget.type === 'task' ? activeTarget.taskId || null : null,
      authorUserId: currentUserId,
      createdAt: new Date().toISOString(),
      body: trimmed,
      mentions: {
        peopleMentions: mentionIds.people,
        smartMentions: {
          deliverableIds: mentionIds.deliverables,
          taskIds: mentionIds.tasks,
        },
      },
      tagTarget: {
        type: activeTarget.type || 'job',
        deliverableId: activeTarget.deliverableId || null,
        taskId: activeTarget.taskId || null,
      },
    };
    addJobChatMessage(payload);
    setComposerText('');
    setMentionState(null);
    setMentionIndex(0);
    setMentionIds({ people: [], deliverables: [], tasks: [] });
    if (typeof onChatUpdate === 'function') onChatUpdate();
  };

  const canRetagMessage = (message) => {
    if (isArchived) return false;
    if (!message) return false;
    const isAuthor = String(message.authorUserId) === String(currentUserId);
    const isLead = job.jobLeadUserId && String(job.jobLeadUserId) === String(currentUserId);
    const role = currentUser?.role || '';
    const isPrivileged = role === 'admin' || role === 'owner';
    return isAuthor || isLead || isPrivileged;
  };

  const handleRetag = (message) => {
    const targetType = message.tagTarget?.type || 'job';
    setRetagState({
      message,
      type: targetType,
      deliverableId: message.deliverableId || null,
      taskId: message.taskId || null,
    });
  };

  const confirmRetag = () => {
    if (!retagState?.message) return;
    retagJobChatMessage(retagState.message.id, {
      type: retagState.type,
      deliverableId: retagState.deliverableId || null,
      taskId: retagState.taskId || null,
      changedByUserId: currentUserId,
    });
    setRetagState(null);
    if (typeof onChatUpdate === 'function') onChatUpdate();
  };

  const taskOptions = deliverables.flatMap((deliverable) => (
    (deliverable.tasks || []).map((task) => ({
      id: task.id,
      label: `${deliverable.name || 'Deliverable'} / ${task.title || 'Task'}`,
      deliverableId: deliverable.id,
      taskId: task.id,
    }))
  ));

  return h('div', { className: 'fixed inset-0 z-50' }, [
    h('div', {
      className: 'absolute inset-0 bg-black/30',
      onClick: () => onClose && onClose(),
    }),
    h('aside', { className: 'absolute right-0 top-0 bottom-0 w-full max-w-md bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-white/10 shadow-xl flex flex-col' }, [
      h('div', { className: 'flex items-start justify-between gap-3 px-5 py-4 border-b border-slate-200 dark:border-white/10' }, [
        h('div', { className: 'space-y-1' }, [
          h('div', { className: 'text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400' }, 'Chat'),
          h('div', { className: 'text-sm font-semibold text-slate-900 dark:text-white' }, contextLine),
          isArchived
            ? h('div', { className: 'text-xs text-slate-500 dark:text-slate-400' }, 'Archived - chat is read-only.')
            : null,
        ]),
        h('button', {
          type: 'button',
          className: 'h-9 w-9 rounded-full border border-slate-200 dark:border-white/10 text-slate-500 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white',
          onClick: () => onClose && onClose(),
          'aria-label': 'Close chat',
        }, 'x'),
      ]),
      h('div', { className: 'flex-1 overflow-y-auto px-5 py-4 space-y-4 bg-slate-50 dark:bg-[#0B1120]' }, [
        visibleMessages.length
          ? visibleMessages.map((message) => {
            const author = memberMap.get(String(message.authorUserId));
            const authorName = author?.name || author?.email || 'Member';
            const canRetag = canRetagMessage(message);
            return h('div', { key: message.id, className: 'flex gap-3 items-start' }, [
              h('div', { className: 'h-8 w-8 rounded-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-white/10 flex items-center justify-center text-xs font-semibold text-slate-600 dark:text-slate-200' }, getInitials(authorName)),
              h('div', { className: 'flex-1 space-y-2' }, [
                h('div', { className: 'flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400' }, [
                  h('span', { className: 'font-semibold text-slate-700 dark:text-slate-200' }, authorName),
                  h('span', null, formatTimestamp(message.createdAt)),
                ]),
                h('div', { className: 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 text-slate-800 dark:text-slate-100 text-sm rounded-2xl rounded-tl-none p-3 shadow-sm' }, renderMessageBody(message.body)),
                h('div', { className: 'flex items-center gap-2 text-xs' }, [
                  h('button', {
                    type: 'button',
                    className: canRetag
                      ? 'text-slate-500 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                      : 'text-slate-300 dark:text-slate-600 cursor-not-allowed',
                    onClick: () => {
                      if (canRetag) handleRetag(message);
                    },
                    title: canRetag ? 'Retag message' : 'Only the author, lead, admins, or owner can retag.',
                    disabled: !canRetag,
                  }, 'Retag'),
                ]),
              ]),
            ]);
          })
          : h('div', { className: 'text-sm text-slate-500 dark:text-slate-400 text-center py-8' }, 'No messages yet.'),
      ]),
      h('div', { className: 'border-t border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 px-4 py-3 space-y-2' }, [
        mentionState && mentionOptions.length
          ? h('div', { className: 'max-h-48 overflow-y-auto rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 shadow-xl text-sm' }, [
            mentionOptions.map((option, index) => {
              const isActive = index === mentionIndex;
              const base = 'w-full text-left px-3 py-2 flex items-start gap-2';
              const activeClass = isActive ? 'bg-slate-100 dark:bg-slate-800' : 'hover:bg-slate-50 dark:hover:bg-slate-800/60';
              return h('button', {
                key: option.id || option.label,
                type: 'button',
                className: `${base} ${activeClass}`,
                onClick: () => handleSelectMention(option),
              }, [
                h('div', { className: 'flex-1' }, [
                  h('div', { className: 'text-sm font-semibold text-slate-700 dark:text-slate-200' }, option.label),
                  option.subtitle
                    ? h('div', { className: 'text-xs text-slate-500 dark:text-slate-400' }, option.subtitle)
                    : null,
                ]),
                mentionState.type === 'smart'
                  ? h('span', { className: 'text-[11px] uppercase tracking-wide text-slate-400 dark:text-slate-500' }, option.type === 'task' ? 'Task' : 'Deliverable')
                  : null,
              ]);
            }),
            mentionState.type === 'people' && showTeamHint
              ? h('div', { className: 'px-3 py-2 text-xs text-slate-500 dark:text-slate-400 border-t border-slate-200 dark:border-white/10' }, 'Set Job Team in Settings to restrict assignees.')
              : null,
          ])
          : null,
        h('div', { className: 'flex items-end gap-2 bg-slate-100 dark:bg-slate-800 rounded-2xl px-3 py-2' }, [
          h('div', { className: 'flex flex-col flex-1' }, [
            h('textarea', {
              ref: composerRef,
              rows: 1,
              value: composerText,
              onChange: handleComposerChange,
              onKeyDown: handleComposerKeyDown,
              placeholder: isArchived ? 'Chat is read-only for archived jobs.' : 'Write a message...',
              disabled: isArchived,
              className: 'w-full bg-transparent border-none focus:ring-0 focus:outline-none text-slate-900 dark:text-white placeholder-slate-500 text-sm leading-5 resize-none max-h-[180px] overflow-y-auto min-h-[44px] disabled:opacity-60',
            }),
            h('div', { className: 'flex items-center gap-2 mt-2' }, [
              h('button', {
                type: 'button',
                className: 'text-xs font-semibold text-slate-500 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white',
                onClick: () => insertTrigger('~'),
                disabled: isArchived,
                title: 'Tag a deliverable or task (~)',
              }, '~'),
              h('span', { className: 'text-[11px] text-slate-400 dark:text-slate-500' }, 'Use @ for people, ~ for work items'),
            ]),
          ]),
          h('button', {
            type: 'button',
            className: 'p-2 bg-slate-300 dark:bg-slate-700 text-white rounded-full disabled:opacity-50 enabled:bg-netnet-purple transition-colors h-9 w-9 flex items-center justify-center',
            disabled: isArchived || composerText.trim().length === 0,
            onClick: handleSend,
            'aria-label': 'Send message',
          }, h('svg', { width: 18, height: 18, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: '2' }, [
            h('line', { x1: 12, y1: 19, x2: 12, y2: 5 }),
            h('polyline', { points: '5 12 12 5 19 12' }),
          ])),
        ]),
      ]),
      retagState
        ? h('div', { className: 'fixed inset-0 z-[60] flex items-center justify-center px-4' }, [
          h('div', { className: 'absolute inset-0 bg-black/40', onClick: () => setRetagState(null) }),
          h('div', { className: 'relative z-10 w-full max-w-md rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 p-5 space-y-4 shadow-xl' }, [
            h('div', { className: 'text-base font-semibold text-slate-900 dark:text-white' }, 'Retag message'),
            h('div', { className: 'flex items-center gap-2' }, [
              ['job', 'deliverable', 'task'].map((type) => h('button', {
                key: type,
                type: 'button',
                className: retagState.type === type
                  ? 'rounded-full bg-netnet-purple text-white px-3 py-1.5 text-xs font-semibold'
                  : 'rounded-full border border-slate-200 dark:border-white/10 px-3 py-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white',
                onClick: () => setRetagState((prev) => ({ ...prev, type })),
              }, type === 'job' ? 'Job' : type === 'deliverable' ? 'Deliverable' : 'Task')),
            ]),
            retagState.type === 'deliverable'
              ? h('select', {
                value: retagState.deliverableId || '',
                onChange: (event) => setRetagState((prev) => ({ ...prev, deliverableId: event.target.value || null })),
                className: 'w-full rounded-md border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 px-3 py-2 text-sm text-slate-700 dark:text-slate-200',
              }, [
                h('option', { value: '' }, 'Select deliverable'),
                ...deliverables.map((deliverable) => (
                  h('option', { key: deliverable.id, value: deliverable.id }, deliverable.name || 'Deliverable')
                )),
              ])
              : null,
            retagState.type === 'task'
              ? h('select', {
                value: retagState.taskId || '',
                onChange: (event) => {
                  const nextTask = taskOptions.find((option) => String(option.taskId) === String(event.target.value));
                  setRetagState((prev) => ({
                    ...prev,
                    taskId: event.target.value || null,
                    deliverableId: nextTask?.deliverableId || prev.deliverableId || null,
                  }));
                },
                className: 'w-full rounded-md border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 px-3 py-2 text-sm text-slate-700 dark:text-slate-200',
              }, [
                h('option', { value: '' }, 'Select task'),
                ...taskOptions.map((option) => (
                  h('option', { key: option.id, value: option.taskId }, option.label)
                )),
              ])
              : null,
            h('div', { className: 'flex items-center justify-end gap-2' }, [
              h('button', {
                type: 'button',
                className: 'inline-flex items-center justify-center h-9 px-4 rounded-md border border-slate-200 dark:border-white/10 text-sm font-semibold text-slate-700 dark:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-800',
                onClick: () => setRetagState(null),
              }, 'Cancel'),
              h('button', {
                type: 'button',
                className: 'inline-flex items-center justify-center h-9 px-4 rounded-md bg-netnet-purple text-white text-sm font-semibold hover:brightness-110',
                onClick: confirmRetag,
                disabled: (retagState.type === 'deliverable' && !retagState.deliverableId)
                  || (retagState.type === 'task' && !retagState.taskId),
              }, 'Save'),
            ]),
          ]),
        ])
        : null,
    ]),
  ]);
}
