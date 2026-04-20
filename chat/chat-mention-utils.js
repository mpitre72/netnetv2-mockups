export function normalizeMentionLabel(value = '') {
  return String(value || '')
    .replace(/^\[\[/, '')
    .replace(/\]\]$/, '')
    .replace(/^@/, '')
    .trim()
    .toLowerCase();
}

export function filterKey(filter = {}) {
  return [filter.type, filter.id || filter.label || '', filter.jobId || ''].join(':');
}

function uniqueByKey(items = []) {
  const seen = new Set();
  return items.filter((item) => {
    const key = [item.type, item.id || '', item.jobId || '', normalizeMentionLabel(item.label)].join(':');
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function personLabel(member = {}) {
  const full = [member.firstName, member.lastName].filter(Boolean).join(' ').trim();
  return member.name || full || member.email || '';
}

function optionSearchText(option = {}) {
  return [
    option.label,
    option.mentionLabel,
    option.type,
    option.jobLabel,
    option.deliverableLabel,
  ].filter(Boolean).join(' ').toLowerCase();
}

export function formatWorkMentionLabel(option = {}) {
  if (option.mentionLabel) return option.mentionLabel;
  if (option.type === 'task') {
    return [option.jobLabel, option.deliverableLabel, option.label].filter(Boolean).join('/');
  }
  if (option.type === 'deliverable') {
    return [option.jobLabel, option.label].filter(Boolean).join('/');
  }
  return option.label || '';
}

export function buildMentionCatalog(chatState, workRefs = {}, teamMembers = []) {
  const jobChannels = [
    ...(chatState?.jobChannels?.active || []),
    ...(chatState?.jobChannels?.pending || []),
    ...(chatState?.jobChannels?.completed || []),
  ];
  const jobsFromChannels = jobChannels.map((job) => ({
    type: 'job',
    id: job.id,
    jobId: job.id,
    label: job.title,
    mentionLabel: job.title,
  }));
  const jobsFromRefs = (workRefs.jobs || []).map((job) => ({
    type: 'job',
    id: job.id || job.jobId,
    jobId: job.jobId || job.id,
    label: job.label,
    mentionLabel: job.label,
    alias: !!job.alias,
  }));
  const jobAliases = jobsFromRefs.filter((job) => job.alias);
  const jobs = uniqueByKey([...jobsFromChannels, ...jobsFromRefs.filter((job) => !job.alias)].filter((job) => job.id && job.label));
  const jobLabelById = new Map(jobs.map((job) => [job.jobId || job.id, job.label]));

  const deliverables = (workRefs.deliverables || []).map((deliverable) => ({
    type: 'deliverable',
    id: deliverable.id,
    label: deliverable.label,
    jobId: deliverable.jobId,
    jobLabel: jobLabelById.get(deliverable.jobId) || '',
  })).filter((deliverable) => deliverable.id && deliverable.label)
    .map((deliverable) => ({
      ...deliverable,
      mentionLabel: formatWorkMentionLabel(deliverable),
    }));

  const deliverableLabelById = new Map(deliverables.map((deliverable) => [deliverable.id, deliverable.label]));
  const tasks = (workRefs.tasks || []).map((task) => ({
    type: 'task',
    id: task.id,
    label: task.label,
    jobId: task.jobId,
    jobLabel: jobLabelById.get(task.jobId) || '',
    deliverableId: task.deliverableId,
    deliverableLabel: deliverableLabelById.get(task.deliverableId) || '',
  })).filter((task) => task.id && task.label)
    .map((task) => ({
      ...task,
      mentionLabel: formatWorkMentionLabel(task),
    }));

  const participantNames = [
    ...(chatState?.generalChannel?.participants || []),
    ...jobChannels.flatMap((channel) => channel.participants || []),
    ...(chatState?.directMessages || []).flatMap((channel) => channel.participants || []),
  ];
  const people = uniqueByKey([
    ...participantNames.map((name) => ({
      type: 'person',
      id: `person-${normalizeMentionLabel(name).replace(/\s+/g, '-')}`,
      label: name,
    })),
    ...teamMembers.map((member) => ({
      type: 'person',
      id: member.id || member.email || personLabel(member),
      label: personLabel(member),
    })),
  ].filter((person) => person.label));

  const workOptions = uniqueByKey([...jobs, ...jobAliases, ...deliverables, ...tasks]);
  const byLabel = new Map();
  [...workOptions, ...people].forEach((option) => {
    [option.label, option.mentionLabel].filter(Boolean).forEach((label) => {
      const key = `${option.type}:${normalizeMentionLabel(label)}`;
      if (!byLabel.has(key)) byLabel.set(key, option);
    });
  });

  return {
    jobs,
    deliverables,
    tasks,
    people,
    workOptions,
    byLabel,
  };
}

export function getComposerWorkOptions(catalog, location, selectedChannel) {
  if (!catalog) return [];
  const isJobChannel = location?.type === 'job' && selectedChannel?.id;
  if (isJobChannel) {
    return [
      ...catalog.deliverables.filter((item) => item.jobId === selectedChannel.id),
      ...catalog.tasks.filter((item) => item.jobId === selectedChannel.id),
    ];
  }
  return catalog.workOptions || [];
}

export function filterMentionOptions(options = [], query = '', limit = 8) {
  const needle = String(query || '').trim().toLowerCase();
  const matches = needle
    ? options.filter((option) => optionSearchText(option).includes(needle))
    : options;
  return matches.slice(0, limit);
}

export function parseMessageTokens(text = '', catalog) {
  const source = String(text || '');
  const tokens = [];
  let index = 0;

  while (index < source.length) {
    if (source.startsWith('[[', index)) {
      const closeIndex = source.indexOf(']]', index + 2);
      if (closeIndex !== -1) {
        const rawLabel = source.slice(index + 2, closeIndex);
        const label = rawLabel.trim();
        const option = catalog?.byLabel?.get(`job:${normalizeMentionLabel(label)}`)
          || catalog?.byLabel?.get(`deliverable:${normalizeMentionLabel(label)}`)
          || catalog?.byLabel?.get(`task:${normalizeMentionLabel(label)}`)
          || null;
        tokens.push({
          kind: 'mention',
          trigger: 'work',
          type: option?.type || 'job',
          label,
          raw: source.slice(index, closeIndex + 2),
          ref: option,
        });
        index = closeIndex + 2;
        continue;
      }
    }

    if (source[index] === '@') {
      const people = [...(catalog?.people || [])].sort((a, b) => String(b.label).length - String(a.label).length);
      const match = people.find((person) => {
        const raw = `@${person.label}`;
        const next = source.slice(index, index + raw.length);
        const boundary = source[index + raw.length];
        return next.toLowerCase() === raw.toLowerCase() && (!boundary || /[\s.,!?;:]/.test(boundary));
      });
      if (match) {
        tokens.push({
          kind: 'mention',
          trigger: 'person',
          type: 'person',
          label: match.label,
          raw: source.slice(index, index + match.label.length + 1),
          ref: match,
        });
        index += match.label.length + 1;
        continue;
      }

      const fallback = source.slice(index).match(/^@[A-Za-z][A-Za-z.'-]*/);
      if (fallback) {
        const label = fallback[0].slice(1);
        const option = catalog?.byLabel?.get(`person:${normalizeMentionLabel(label)}`) || null;
        tokens.push({
          kind: 'mention',
          trigger: 'person',
          type: 'person',
          label,
          raw: fallback[0],
          ref: option,
        });
        index += fallback[0].length;
        continue;
      }
    }

    const nextWork = source.indexOf('[[', index + 1);
    const nextPerson = source.indexOf('@', index + 1);
    const candidates = [nextWork, nextPerson].filter((value) => value !== -1);
    const nextIndex = candidates.length ? Math.min(...candidates) : source.length;
    tokens.push({ kind: 'text', text: source.slice(index, nextIndex) });
    index = nextIndex;
  }

  return tokens;
}

function messageTextMatchesOption(text, filter, catalog) {
  const tokens = parseMessageTokens(text, catalog);
  return tokens.some((token) => {
    if (token.kind !== 'mention') return false;
    if (filter.type === 'person') {
      return token.type === 'person' && normalizeMentionLabel(token.label) === normalizeMentionLabel(filter.label);
    }
    if (filter.type === 'job') {
      return token.trigger === 'work'
        && (
          String(token.ref?.jobId || token.ref?.id || '') === String(filter.jobId || filter.id || '')
          || normalizeMentionLabel(token.label) === normalizeMentionLabel(filter.label)
        );
    }
    if (filter.type === 'deliverable') {
      return token.trigger === 'work'
        && (
          String(token.ref?.id || '') === String(filter.id || '')
          || String(token.ref?.deliverableId || '') === String(filter.id || '')
          || normalizeMentionLabel(token.label) === normalizeMentionLabel(filter.label)
        );
    }
    if (token.type !== filter.type) return false;
    if (token.ref?.id && filter.id) return String(token.ref.id) === String(filter.id);
    return normalizeMentionLabel(token.label) === normalizeMentionLabel(filter.label);
  });
}

function messageMatchesFilter(item, filter, catalog) {
  if (!filter) return true;
  if (filter.type === 'job') {
    return item.sourceId === filter.jobId || item.sourceId === filter.id || messageTextMatchesOption(item.body || item.text, filter, catalog);
  }
  if (filter.type === 'person') {
    return normalizeMentionLabel(item.author) === normalizeMentionLabel(filter.label)
      || messageTextMatchesOption(item.body || item.text, filter, catalog);
  }
  return messageTextMatchesOption(item.body || item.text, filter, catalog);
}

function itemMatchesAllFilters(item, filters, catalog) {
  return filters.every((filter) => messageMatchesFilter(item, filter, catalog));
}

export function applyChatFilters(items = [], activeFilters = [], context = {}) {
  const filters = (activeFilters || []).filter(Boolean);
  if (!filters.length) return items;
  const { catalog } = context;

  return items.reduce((next, item) => {
    const parentMatches = itemMatchesAllFilters(item, filters, catalog);
    if (parentMatches) {
      next.push(item);
      return next;
    }

    const matchingReplies = (item.replies || []).filter((reply) => itemMatchesAllFilters(reply, filters, catalog));
    if (matchingReplies.length) {
      next.push({
        ...item,
        replies: matchingReplies,
        filterMatchedReply: true,
      });
    }
    return next;
  }, []);
}

export function makeFilterFromOption(option = {}) {
  return {
    type: option.type,
    id: option.id,
    label: option.type === 'person' ? option.label : formatWorkMentionLabel(option),
    jobId: option.jobId,
    deliverableId: option.deliverableId,
  };
}
