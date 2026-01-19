import { ICONS } from '../app-shell/app-constants.js';
import { updateTimerVisuals } from '../app-shell/app-header.js';
import { __isDark } from '../app-shell/app-helpers.js';
import {
  addMyListItem,
  deleteMyListItem,
  loadMyListItems,
  NETNET_LAST_LIST_ITEM_KEY,
} from '../me/my-lists.js';
import { performanceDeliverables, performanceJobs } from '../performance/performance-data.js';
import { addJobTaskTimeEntry, createJobTask, getEffectiveState } from '../performance/testdata/performance-state.js';
import { getContactsData, getIndividualsData } from '../contacts/contacts-data.js';
import {
  addTimeEntry,
  createQuickTask,
  getCurrentUser,
  getCurrentUserId,
  getLocalDateISO,
  getMemberById,
  getServiceTypeById,
  loadQuickTasks,
  loadServiceTypes,
  loadTeamMembers,
} from '../quick-tasks/quick-tasks-store.js';

const NETNET_PENDING_KEY = 'netnet_ai_open_panel_v1';
const NETNET_PREFILL_KEY = 'netnet_ai_open_panel_prefill_v1';
const NETNET_THREAD_KEY = 'netnet_ai_thread_v1';
const NETNET_LIST_CONTEXT_KEY = NETNET_LAST_LIST_ITEM_KEY || 'netnet_my_lists_last_item_v1';
const TIMER_ACTIVE_KEY = 'timerActive';
const TIMER_TASK_KEY = 'timerTaskId';
const TIMER_STARTED_KEY = 'timerStartedAt';

const NETNET_STATE = {
  loaded: false,
  messages: [],
  input: '',
  autoSendPrompt: '',
  flow: {
    currentFlow: 'none',
    slots: {},
    awaiting: null,
    sourceText: '',
    context: {},
  },
  pendingProposalId: null,
};

const NETNET_SUGGESTIONS = [
  'Summarize my tasks',
  'Show overdue items',
  'Draft a status update',
  'What is blocking this week?',
  'Prepare a client check-in',
];

const INTENT_CAPTURE_RE = /\b(add|create|capture|note|remind|reminder|list|task|todo|follow\s*up)\b/i;
const INTENT_TIME_RE = /\b(log|track|add)\s+(time|hours?)\b|\b(hours?|mins?|minutes?)\b/i;
const INTENT_JOB_RE = /\b(job|deliverable|project)\b/i;
const INTENT_CONVERT_RE = /\b(convert|promote)\b/i;
const INTENT_CONVERT_TASK_RE = /\b(turn|make)\b.*\btask\b/i;
const INTENT_TASK_RE = /\btask\b/i;
const INTENT_QUICK_TASK_RE = /\bquick\s+task\b/i;
const INTENT_JOB_TASK_RE = /\bjob\s+task\b|\btask\b.*\b(job|deliverable|project)\b/i;
const INTENT_TIMER_START_RE = /\b(start|begin)\s+(?:a\s+)?timer\b|\bstart\s+timing\b/i;
const INTENT_TIMER_STOP_RE = /\b(stop|pause)\s+(?:my\s+)?timer\b|\bstop\s+timing\b/i;
const INTENT_TIMER_SWITCH_RE = /\bswitch\s+(?:timer|timing)\b|\bswitch\s+timer\s+to\b/i;

const ACTION_VARIANTS = {
  primary: 'bg-netnet-purple text-white border-transparent hover:bg-[#6020df]',
  secondary: 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-100 border-slate-200 dark:border-white/10 hover:bg-slate-50 dark:hover:bg-slate-800',
  subtle: 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-200 border-slate-200 dark:border-white/10 hover:border-slate-300 dark:hover:border-white/20',
};

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function createMessageId(prefix = 'msg') {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(16).slice(2, 6)}`;
}

function getNetNetIconSrc(active = true) {
  const dark = __isDark();
  const set = ICONS.bot;
  return dark ? (active ? set.dark.active : set.dark.idle) : (active ? set.light.active : set.light.idle);
}

function formatDateLabel(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function normalizeText(value) {
  return String(value || '').trim().toLowerCase();
}

function ensureThreadLoaded() {
  if (NETNET_STATE.loaded) return;
  try {
    const raw = localStorage.getItem(NETNET_THREAD_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed.messages)) {
        NETNET_STATE.messages = parsed.messages.filter((msg) => msg && msg.role && typeof msg.text === 'string');
      }
      if (parsed.flow && typeof parsed.flow === 'object') {
        NETNET_STATE.flow = {
          currentFlow: parsed.flow.currentFlow || 'none',
          slots: parsed.flow.slots && typeof parsed.flow.slots === 'object' ? parsed.flow.slots : {},
          awaiting: parsed.flow.awaiting || null,
          sourceText: parsed.flow.sourceText || '',
          context: parsed.flow.context && typeof parsed.flow.context === 'object' ? parsed.flow.context : {},
        };
      }
      if (parsed.pendingProposalId) {
        NETNET_STATE.pendingProposalId = parsed.pendingProposalId;
      } else {
        const pending = NETNET_STATE.messages.find((msg) => msg.type === 'proposal');
        NETNET_STATE.pendingProposalId = pending ? pending.id : null;
      }
    }
  } catch (e) {
    NETNET_STATE.messages = [];
  }
  NETNET_STATE.loaded = true;
}

function persistThreadState() {
  try {
    const payload = {
      messages: NETNET_STATE.messages,
      flow: NETNET_STATE.flow,
      pendingProposalId: NETNET_STATE.pendingProposalId,
    };
    localStorage.setItem(NETNET_THREAD_KEY, JSON.stringify(payload));
  } catch (e) {
    // Ignore storage errors in prototype
  }
}

function resetFlowState() {
  NETNET_STATE.flow = {
    currentFlow: 'none',
    slots: {},
    awaiting: null,
    sourceText: '',
    context: {},
  };
  persistThreadState();
}

function setAwaiting(type, data = {}) {
  NETNET_STATE.flow.awaiting = { type, ...data };
  persistThreadState();
}

function clearAwaiting() {
  NETNET_STATE.flow.awaiting = null;
  persistThreadState();
}

function hasPendingProposal() {
  return !!NETNET_STATE.pendingProposalId;
}

function parseYesNo(text) {
  const val = normalizeText(text);
  if (!val) return null;
  if (['yes', 'y', 'yeah', 'yep', 'sure', 'ok', 'okay'].includes(val)) return true;
  if (['no', 'n', 'nope', 'nah', 'cancel'].includes(val)) return false;
  return null;
}

function isRefusalText(text) {
  const val = normalizeText(text);
  if (!val) return false;
  return ['no', 'nope', 'nah', 'skip', 'later', 'not sure', 'dont know', "don't know", 'idk', 'cancel'].some((phrase) =>
    val.includes(phrase),
  );
}

function extractTitleCandidate(text) {
  let candidate = String(text || '').trim();
  candidate = candidate.replace(/^(add|create|capture|note|remind|reminder|task|todo|follow\s*up)\b\s*(me\s+to\s+)?/i, '');
  candidate = candidate.replace(/^\s*(a|an|the)\s+/i, '');
  return candidate.trim();
}

function extractNotesCandidate(text, titleCandidate) {
  const raw = String(text || '').trim();
  const marker = raw.match(/\b(notes?|details?)\s*:\s*(.+)$/i);
  if (marker && marker[2]) return marker[2].trim();
  if (raw.includes('\n')) return raw;
  if (titleCandidate && raw.length > titleCandidate.length + 20) return raw;
  if (raw.length > 80) return raw;
  return '';
}

function parseHoursInput(text) {
  const raw = normalizeText(text);
  if (!raw) return null;
  const minuteMatch = raw.match(/(\d+(?:\.\d+)?)\s*(m|min|mins|minutes)\b/);
  if (minuteMatch) {
    const mins = Number(minuteMatch[1]);
    if (!Number.isNaN(mins) && mins > 0) return Math.round((mins / 60) * 100) / 100;
  }
  const hourMatch = raw.match(/(\d+(?:\.\d+)?)\s*(h|hr|hrs|hour|hours)?\b/);
  if (hourMatch) {
    const hours = Number(hourMatch[1]);
    if (!Number.isNaN(hours) && hours > 0) return Math.round(hours * 100) / 100;
  }
  return null;
}

function parseDateFromText(text) {
  const raw = normalizeText(text);
  if (!raw) return null;
  if (raw.includes('today')) return getLocalDateISO(new Date());
  if (raw.includes('tomorrow')) {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return getLocalDateISO(d);
  }
  if (raw.includes('yesterday')) {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return getLocalDateISO(d);
  }
  const isoMatch = raw.match(/(\d{4}-\d{2}-\d{2})/);
  if (isoMatch) return isoMatch[1];
  return null;
}

function parseNoteFromText(text) {
  const marker = String(text || '').match(/\b(notes?|details?)\s*:\s*(.+)$/i);
  return marker && marker[2] ? marker[2].trim() : '';
}

function detectTimerIntent(text) {
  if (INTENT_TIMER_STOP_RE.test(text)) return 'stop';
  if (INTENT_TIMER_SWITCH_RE.test(text)) return 'switch';
  if (INTENT_TIMER_START_RE.test(text)) return 'start';
  const lowered = normalizeText(text);
  if (lowered.includes('switch') && (lowered.includes('timer') || lowered.includes('timing') || lowered.includes('tracking'))) {
    return 'switch';
  }
  return null;
}

function detectConvertIntent(text) {
  if (INTENT_CONVERT_RE.test(text)) return 'explicit';
  if (INTENT_CONVERT_TASK_RE.test(text) && /\b(this|that|item|list)\b/i.test(text || '')) return 'maybe';
  return '';
}

function extractTimerTaskHint(text) {
  return String(text || '')
    .replace(/\b(start|begin|switch)\s+(?:timer|timing)?\s*(?:on|to|for)?/i, '')
    .replace(/\b(stop|pause)\s+(?:my\s+)?(?:timer|timing)\b/i, '')
    .trim();
}

function readTimerState() {
  try {
    const active = JSON.parse(localStorage.getItem(TIMER_ACTIVE_KEY) || 'false');
    const taskId = localStorage.getItem(TIMER_TASK_KEY);
    const startedAt = Number(localStorage.getItem(TIMER_STARTED_KEY) || 0);
    if (!active || !taskId || !startedAt) return { active: false, taskId: null, startedAt: 0 };
    return { active: true, taskId, startedAt };
  } catch (e) {
    return { active: false, taskId: null, startedAt: 0 };
  }
}

function writeTimerState({ active, taskId, startedAt }) {
  try {
    localStorage.setItem(TIMER_ACTIVE_KEY, JSON.stringify(!!active));
    if (taskId) {
      localStorage.setItem(TIMER_TASK_KEY, String(taskId));
    } else {
      localStorage.removeItem(TIMER_TASK_KEY);
    }
    if (startedAt) {
      localStorage.setItem(TIMER_STARTED_KEY, String(startedAt));
    } else {
      localStorage.removeItem(TIMER_STARTED_KEY);
    }
    updateTimerVisuals(active);
    return true;
  } catch (e) {
    return false;
  }
}

function startTimerForTask(taskId) {
  if (!taskId) return false;
  return writeTimerState({ active: true, taskId, startedAt: Date.now() });
}

function stopTimerState() {
  return writeTimerState({ active: false, taskId: null, startedAt: null });
}

function restoreTimerState(state) {
  if (!state) return false;
  return writeTimerState(state);
}

function computeElapsedMinutes(startedAt, now = Date.now()) {
  const diff = Math.max(0, now - startedAt);
  const minutes = Math.round(diff / 60000);
  return Math.max(1, minutes);
}

function minutesToHours(minutes) {
  return Math.round((minutes / 60) * 100) / 100;
}

function formatDuration(minutes) {
  if (!minutes && minutes !== 0) return '';
  const hrs = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hrs && mins) return `${hrs}h ${mins}m`;
  if (hrs) return `${hrs}h`;
  return `${mins}m`;
}

function formatTimeLabel(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

function extractDescriptionCandidate(text, titleCandidate) {
  const raw = String(text || '').trim();
  const marker = raw.match(/\b(desc|description|details?)\s*:\s*(.+)$/i);
  if (marker && marker[2]) return marker[2].trim();
  if (titleCandidate && raw.length > titleCandidate.length + 20) return raw;
  if (raw.length > 80) return raw;
  return '';
}

function sortByName(a, b) {
  return String(a?.name || '').localeCompare(String(b?.name || ''));
}

function getCompanyOptions(limit = 5) {
  const list = getContactsData().filter((company) => company && company.id !== undefined);
  return [...list].sort(sortByName).slice(0, limit);
}

function findCompanyById(id) {
  return getContactsData().find((company) => String(company.id) === String(id)) || null;
}

function findCompaniesByName(term) {
  const needle = normalizeText(term);
  if (!needle) return [];
  return getContactsData().filter((company) => normalizeText(company?.name).includes(needle));
}

function getPeopleForCompany(companyId) {
  const company = findCompanyById(companyId);
  const people = Array.isArray(company?.people) ? company.people : [];
  return people.map((person) => ({
    id: person.id,
    name: person.name,
    companyId: company?.id || null,
    companyName: company?.name || '',
    type: 'company',
  }));
}

function getAllPeople() {
  const companies = getContactsData();
  const fromCompanies = companies.flatMap((company) => {
    const people = Array.isArray(company?.people) ? company.people : [];
    return people.map((person) => ({
      id: person.id,
      name: person.name,
      companyId: company.id || null,
      companyName: company.name || '',
      type: 'company',
    }));
  });
  const individuals = getIndividualsData().map((person) => ({
    id: person.id,
    name: person.name,
    companyId: null,
    companyName: '',
    type: 'standalone',
  }));
  return [...fromCompanies, ...individuals];
}

function findPersonById(id) {
  const all = getAllPeople();
  return all.find((person) => String(person.id) === String(id)) || null;
}

function findPeopleByName(term, companyId = null) {
  const needle = normalizeText(term);
  if (!needle) return [];
  const list = companyId ? getPeopleForCompany(companyId) : getAllPeople();
  return list.filter((person) => normalizeText(person?.name).includes(needle));
}

function getServiceTypeOptions(limit = 5) {
  const list = loadServiceTypes().filter((type) => type.active);
  return [...list].sort(sortByName).slice(0, limit);
}

function findServiceTypesByName(term) {
  const needle = normalizeText(term);
  if (!needle) return [];
  return loadServiceTypes().filter((type) => normalizeText(type?.name).includes(needle));
}

function getAssigneeOptions(limit = 5) {
  const list = loadTeamMembers();
  return [...list].sort(sortByName).slice(0, limit);
}

function findMembersByName(term) {
  const needle = normalizeText(term);
  if (!needle) return [];
  return loadTeamMembers().filter((member) => normalizeText(member?.name).includes(needle));
}

function getQuickTaskOptions(limit = 5) {
  const tasks = loadQuickTasks();
  const sorted = [...tasks].sort((a, b) => (b.updatedAt || b.createdAt || 0) - (a.updatedAt || a.createdAt || 0));
  return sorted.slice(0, limit);
}

function getJobTasks() {
  const state = getEffectiveState?.();
  const tasks = state && Array.isArray(state.tasks) ? state.tasks : [];
  return tasks;
}

function getJobTaskDisplayName(task) {
  if (!task) return 'Job Task';
  const deliverable = findDeliverableById(task.deliverableId);
  return task.title || deliverable?.name || `Job Task ${task.id || ''}`.trim();
}

function getJobTaskContext(task) {
  if (!task) return { jobId: null, deliverableId: null, jobName: '', deliverableName: '', label: '' };
  const deliverable = findDeliverableById(task.deliverableId);
  const jobId = task.jobId || deliverable?.jobId || null;
  const job = jobId ? findJobById(jobId) : null;
  const jobName = job?.name || (jobId ? `Job ${jobId}` : 'Job');
  const deliverableName = deliverable?.name || '';
  const label = deliverableName ? `${jobName} > ${deliverableName}` : jobName;
  return {
    jobId,
    deliverableId: task.deliverableId || null,
    jobName,
    deliverableName,
    label,
  };
}

function getJobTaskOptions(limit = 5) {
  const tasks = getJobTasks();
  const sorted = [...tasks].sort((a, b) => getJobTaskDisplayName(a).localeCompare(getJobTaskDisplayName(b)));
  return sorted.slice(0, limit);
}

function getQuickTaskContextLabel(task) {
  if (!task) return 'Quick Task';
  const anchorLabel = getAnchorLabel(task);
  return anchorLabel ? `Quick Task - ${anchorLabel}` : 'Quick Task';
}

function buildLogTimeMetaFromTask(taskType, task) {
  if (!task) {
    return {
      taskType,
      taskId: '',
      taskTitle: '',
      taskContext: taskType === 'job' ? 'Job Task' : 'Quick Task',
    };
  }
  if (taskType === 'job') {
    const context = getJobTaskContext(task);
    return {
      taskType: 'job',
      taskId: task.id,
      taskTitle: getJobTaskDisplayName(task),
      taskContext: context.label || 'Job Task',
      jobId: context.jobId,
      deliverableId: context.deliverableId,
      jobName: context.jobName,
      deliverableName: context.deliverableName,
    };
  }
  return {
    taskType: 'quick',
    taskId: task.id,
    taskTitle: task.title || 'Quick Task',
    taskContext: getQuickTaskContextLabel(task),
  };
}

function getLogTimeTaskMeta(taskType, taskId, fallbackTitle = '') {
  const type = taskType === 'job' ? 'job' : 'quick';
  const task = type === 'job' ? getJobTaskById(taskId) : getQuickTaskById(taskId);
  if (task) return buildLogTimeMetaFromTask(type, task);
  return {
    taskType: type,
    taskId,
    taskTitle: fallbackTitle || '',
    taskContext: type === 'job' ? 'Job Task' : 'Quick Task',
  };
}

function formatLogTimeTaskLabel(meta) {
  if (!meta) return '';
  const title = meta.taskTitle || 'Task';
  return meta.taskContext ? `${title} (${meta.taskContext})` : title;
}

function parseLogTimeTaskValue(value = '') {
  const raw = String(value || '').trim();
  if (!raw) return { taskType: 'quick', taskId: '' };
  const [prefix, ...rest] = raw.split(':');
  if (['quick', 'job'].includes(prefix) && rest.length) {
    return { taskType: prefix, taskId: rest.join(':') };
  }
  return { taskType: 'quick', taskId: raw };
}

function getUnifiedTaskOptions(limit = 5) {
  const quickTasks = getQuickTaskOptions(limit);
  const jobTasks = getJobTaskOptions(limit);
  const combined = [];
  const max = Math.max(quickTasks.length, jobTasks.length);
  for (let i = 0; i < max && combined.length < limit; i += 1) {
    if (quickTasks[i]) combined.push({ taskType: 'quick', task: quickTasks[i] });
    if (combined.length >= limit) break;
    if (jobTasks[i]) combined.push({ taskType: 'job', task: jobTasks[i] });
  }
  return combined;
}

function findQuickTaskMatches(text) {
  const tasks = loadQuickTasks();
  const needle = normalizeText(text);
  if (!needle) return [];
  return tasks.filter((task) => {
    const title = normalizeText(task.title);
    return title && (needle.includes(title) || title.includes(needle));
  });
}

function matchQuickTaskByTitle(text) {
  const matches = findQuickTaskMatches(text);
  return matches.length === 1 ? matches[0] : null;
}

function findJobTaskMatches(text) {
  const tasks = getJobTasks();
  const needle = normalizeText(text);
  if (!needle) return [];
  return tasks.filter((task) => {
    const title = normalizeText(getJobTaskDisplayName(task));
    return title && (needle.includes(title) || title.includes(needle));
  });
}

function findUnifiedTaskMatches(text) {
  const matches = [
    ...findQuickTaskMatches(text).map((task) => ({ taskType: 'quick', task })),
    ...findJobTaskMatches(text).map((task) => ({ taskType: 'job', task })),
  ];
  return matches;
}

function buildLogTimeTaskActions(options) {
  return options.map((option) => {
    const meta = buildLogTimeMetaFromTask(option.taskType, option.task);
    return {
      action: 'select-task',
      value: `${option.taskType}:${option.task.id}`,
      label: formatLogTimeTaskLabel(meta),
      variant: 'secondary',
      ariaLabel: `Select ${meta.taskTitle || 'task'}`,
    };
  });
}

function getMyListOptions(limit = 5) {
  const items = loadMyListItems().filter((item) => item && !item.isArchived);
  return items.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)).slice(0, limit);
}

function extractQuotedText(text) {
  const match = String(text || '').match(/["“']([^"”']+)["”']/);
  return match && match[1] ? match[1].trim() : '';
}

function findMyListItemById(items, itemId) {
  return items.find((item) => String(item.id) === String(itemId)) || null;
}

function matchMyListItemsByTitle(text, items) {
  const list = Array.isArray(items) ? items.filter((item) => item && item.title) : [];
  if (!list.length) return [];
  const quoted = extractQuotedText(text);
  if (quoted) {
    const needle = normalizeText(quoted);
    const matches = list.filter((item) => {
      const title = normalizeText(item.title);
      return title === needle || (needle.length >= 3 && title.includes(needle));
    });
    if (matches.length) return matches;
  }
  const normalized = normalizeText(text);
  if (!normalized) return [];
  const exact = list.filter((item) => normalizeText(item.title) === normalized);
  if (exact.length) return exact;
  const includes = list.filter((item) => {
    const title = normalizeText(item.title);
    return title.length >= 3 && normalized.includes(title);
  });
  if (includes.length) return includes;
  return list.filter((item) => {
    const title = normalizeText(item.title);
    return title.length >= 3 && title.includes(normalized) && normalized.length >= 3;
  });
}

function isOnMyListsRoute() {
  return String(location?.hash || '').startsWith('#/app/me/my-lists');
}

function getContextualListItem(text, items) {
  if (!isOnMyListsRoute()) return null;
  if (!/\b(this|that|this item|that item|list item)\b/i.test(text || '')) return null;
  let lastId = null;
  try {
    lastId = localStorage.getItem(NETNET_LIST_CONTEXT_KEY);
  } catch (e) {
    lastId = null;
  }
  if (lastId) {
    const match = findMyListItemById(items, lastId);
    if (match) return match;
  }
  if (items.length === 1) return items[0];
  return null;
}

function getJobOptions(limit = 5) {
  const list = Array.isArray(performanceJobs) ? performanceJobs : [];
  const sorted = [...list].sort((a, b) => String(a?.name || '').localeCompare(String(b?.name || '')));
  return sorted.slice(0, limit);
}

function findJobById(jobId) {
  const list = Array.isArray(performanceJobs) ? performanceJobs : [];
  return list.find((job) => String(job.id) === String(jobId)) || null;
}

function matchJobByName(text) {
  const list = Array.isArray(performanceJobs) ? performanceJobs : [];
  const needle = normalizeText(text);
  if (!needle) return null;
  const directMatches = list.filter((job) => needle.includes(normalizeText(job.name)));
  if (directMatches.length === 1) return directMatches[0];
  const partialMatches = list.filter((job) => normalizeText(job.name).includes(needle));
  if (partialMatches.length === 1) return partialMatches[0];
  return null;
}

function getDeliverablesForJob(jobId) {
  const list = Array.isArray(performanceDeliverables) ? performanceDeliverables : [];
  return list.filter((del) => String(del.jobId) === String(jobId));
}

function findDeliverableById(deliverableId) {
  const list = Array.isArray(performanceDeliverables) ? performanceDeliverables : [];
  return list.find((del) => String(del.id) === String(deliverableId)) || null;
}

function matchDeliverableByName(text, jobId) {
  const list = getDeliverablesForJob(jobId);
  const needle = normalizeText(text);
  if (!needle) return null;
  const directMatches = list.filter((del) => needle.includes(normalizeText(del.name)));
  if (directMatches.length === 1) return directMatches[0];
  const partialMatches = list.filter((del) => normalizeText(del.name).includes(needle));
  if (partialMatches.length === 1) return partialMatches[0];
  return null;
}

function getQuickTaskById(taskId) {
  return loadQuickTasks().find((task) => String(task.id) === String(taskId)) || null;
}

function getJobTaskById(taskId) {
  return getJobTasks().find((task) => String(task.id) === String(taskId)) || null;
}

function renderActions(actions = [], messageId) {
  if (!actions.length) return '';
  return `
    <div class="mt-2 flex flex-wrap gap-2">
      ${actions.map((action) => {
        const variant = ACTION_VARIANTS[action.variant || 'secondary'] || ACTION_VARIANTS.secondary;
        return `
          <button
            type="button"
            class="inline-flex items-center justify-center rounded-md border px-3 py-1.5 text-xs font-semibold ${variant}"
            data-netnet-action="${action.action}"
            data-netnet-value="${escapeHtml(action.value || '')}"
            data-netnet-message-id="${messageId}"
            aria-label="${escapeHtml(action.ariaLabel || action.label)}"
          >
            ${escapeHtml(action.label)}
          </button>
        `;
      }).join('')}
    </div>
  `;
}

function getAnchorLabel(data = {}) {
  const anchorType = data.anchorType;
  if (anchorType === 'internal' || data.isInternal) return 'Internal';
  const person = data.personName || findPersonById(data.personId)?.name || '';
  const company = data.companyName || findCompanyById(data.companyId)?.name || '';
  if (person && company) return `${person} - ${company}`;
  if (person) return person;
  if (company) return company;
  return 'Client';
}

function normalizeAnchorType(value) {
  if (['internal', 'client_company', 'client_person'].includes(value)) return value;
  return '';
}

function coerceHours(value) {
  if (typeof value === 'number' && value > 0) return value;
  const parsed = parseHoursInput(String(value || ''));
  if (parsed) return parsed;
  const num = Number(value);
  return Number.isFinite(num) && num > 0 ? num : null;
}

function validateQuickTaskData(data = {}) {
  const anchorType = normalizeAnchorType(data.anchorType);
  const title = String(data.title || '').trim();
  if (!title) return { ok: false, reason: 'Title is required.' };
  if (!anchorType) return { ok: false, reason: 'Choose Internal or Client.' };
  if (anchorType === 'client_company' && !data.companyId) {
    return { ok: false, reason: 'Company is required.' };
  }
  if (anchorType === 'client_person' && !data.personId) {
    return { ok: false, reason: 'Person is required.' };
  }
  if (!data.serviceTypeId) return { ok: false, reason: 'Service Type is required.' };
  const hours = coerceHours(data.loeHours);
  if (!hours) return { ok: false, reason: 'LOE hours are required.' };
  if (!data.dueDate) return { ok: false, reason: 'Due date is required.' };
  if (!data.assigneeUserId) return { ok: false, reason: 'Assignee is required.' };
  return { ok: true };
}

function validateJobTaskData(data = {}) {
  const title = String(data.title || '').trim();
  if (!title) return { ok: false, reason: 'Title is required.' };
  if (!data.jobId) return { ok: false, reason: 'Job is required.' };
  if (!data.deliverableId) return { ok: false, reason: 'Deliverable is required.' };
  const deliverable = findDeliverableById(data.deliverableId);
  if (!deliverable || String(deliverable.jobId) !== String(data.jobId)) {
    return { ok: false, reason: 'Deliverable must belong to the selected job.' };
  }
  if (!data.serviceTypeId) return { ok: false, reason: 'Service Type is required.' };
  const hours = coerceHours(data.loeHours);
  if (!hours) return { ok: false, reason: 'LOE hours are required.' };
  if (!data.dueDate) return { ok: false, reason: 'Due date is required.' };
  if (!data.assigneeUserId) return { ok: false, reason: 'Assignee is required.' };
  return { ok: true };
}

function validateTimerProposal(kind, data = {}) {
  if (kind === 'start_timer') {
    return data.taskId ? { ok: true } : { ok: false, reason: 'Quick Task is required.' };
  }
  if (kind === 'stop_timer') {
    const hours = coerceHours(data.hours);
    if (!data.taskId) return { ok: false, reason: 'Quick Task is required.' };
    if (!data.date) return { ok: false, reason: 'Date is required.' };
    if (!hours) return { ok: false, reason: 'Hours are required.' };
    return { ok: true };
  }
  if (kind === 'switch_timer') {
    const hours = coerceHours(data.hours);
    if (!data.fromTaskId || !data.toTaskId) return { ok: false, reason: 'Quick Task is required.' };
    if (!data.date) return { ok: false, reason: 'Date is required.' };
    if (!hours) return { ok: false, reason: 'Hours are required.' };
    return { ok: true };
  }
  return { ok: true };
}

function renderProposalSummary(message) {
  const proposal = message.proposal || {};
  const data = proposal.data || {};
  const isLogTime = proposal.kind === 'log_time';
  const isConvertList = proposal.kind === 'convert_list_item';
  const isQuickTask = proposal.kind === 'create_quick_task' || isConvertList;
  const isJobTask = proposal.kind === 'create_job_task';
  const isStartTimer = proposal.kind === 'start_timer';
  const isStopTimer = proposal.kind === 'stop_timer';
  const isSwitchTimer = proposal.kind === 'switch_timer';
  const logTimeMeta = isLogTime ? getLogTimeTaskMeta(data.taskType, data.taskId, data.taskTitle || '') : null;
  const logTimeTitle = logTimeMeta?.taskTitle || data.taskTitle || '';
  const logTimeContext = data.taskContext || logTimeMeta?.taskContext || '';
  const typeLabel = isLogTime
    ? 'Log time'
    : isJobTask
      ? 'Create Job Task'
    : isConvertList
      ? 'Convert My Lists item to Quick Task'
      : isQuickTask
        ? 'Create Quick Task'
      : isStartTimer
        ? 'Start timer'
        : isStopTimer
          ? 'Stop timer'
          : isSwitchTimer
            ? 'Switch timer'
            : 'Create My Lists item';
  const validation = isJobTask
    ? validateJobTaskData(data)
    : isQuickTask
      ? validateQuickTaskData(data)
      : (isStartTimer || isStopTimer || isSwitchTimer)
        ? validateTimerProposal(proposal.kind, data)
        : { ok: true };
  const confirmDisabled = !validation.ok;
  const anchorLabel = isQuickTask ? getAnchorLabel(data) : '';
  const serviceTypeName = (isQuickTask || isJobTask)
    ? (data.serviceTypeName || getServiceTypeById(data.serviceTypeId)?.name || '')
    : '';
  const assigneeName = (isQuickTask || isJobTask)
    ? (data.assigneeName || getMemberById(data.assigneeUserId)?.name || '')
    : '';
  const timerTaskTitle = (data.taskTitle || getQuickTaskById(data.taskId)?.title || '');
  const fromTaskTitle = (data.fromTaskTitle || getQuickTaskById(data.fromTaskId)?.title || '');
  const toTaskTitle = (data.toTaskTitle || getQuickTaskById(data.toTaskId)?.title || '');
  const details = isLogTime
    ? `
      <div class="grid gap-2 text-sm">
        <div class="flex justify-between gap-4"><span class="text-slate-500 dark:text-slate-300">Task</span><span class="font-medium text-slate-900 dark:text-white">${escapeHtml(logTimeTitle)}</span></div>
        ${logTimeContext ? `<div class="flex justify-between gap-4"><span class="text-slate-500 dark:text-slate-300">Context</span><span class="font-medium text-slate-900 dark:text-white">${escapeHtml(logTimeContext)}</span></div>` : ''}
        <div class="flex justify-between gap-4"><span class="text-slate-500 dark:text-slate-300">Date</span><span class="font-medium text-slate-900 dark:text-white">${escapeHtml(formatDateLabel(data.date))}</span></div>
        <div class="flex justify-between gap-4"><span class="text-slate-500 dark:text-slate-300">Hours</span><span class="font-medium text-slate-900 dark:text-white">${escapeHtml(String(data.hours || ''))}h</span></div>
        ${data.note ? `<div class="flex flex-col gap-1"><span class="text-slate-500 dark:text-slate-300">Note</span><span class="text-slate-900 dark:text-white">${escapeHtml(data.note)}</span></div>` : ''}
      </div>
    `
    : isJobTask
      ? `
      <div class="grid gap-2 text-sm">
        <div class="flex flex-col gap-1"><span class="text-slate-500 dark:text-slate-300">Title</span><span class="font-medium text-slate-900 dark:text-white">${escapeHtml(data.title || '')}</span></div>
        ${data.description ? `<div class="flex flex-col gap-1"><span class="text-slate-500 dark:text-slate-300">Description</span><span class="text-slate-900 dark:text-white">${escapeHtml(data.description)}</span></div>` : ''}
        <div class="flex justify-between gap-4"><span class="text-slate-500 dark:text-slate-300">Job</span><span class="font-medium text-slate-900 dark:text-white">${escapeHtml(data.jobName || findJobById(data.jobId)?.name || '')}</span></div>
        <div class="flex justify-between gap-4"><span class="text-slate-500 dark:text-slate-300">Deliverable</span><span class="font-medium text-slate-900 dark:text-white">${escapeHtml(data.deliverableName || findDeliverableById(data.deliverableId)?.name || '')}</span></div>
        <div class="flex justify-between gap-4"><span class="text-slate-500 dark:text-slate-300">Service Type</span><span class="font-medium text-slate-900 dark:text-white">${escapeHtml(serviceTypeName)}</span></div>
        <div class="flex justify-between gap-4"><span class="text-slate-500 dark:text-slate-300">LOE</span><span class="font-medium text-slate-900 dark:text-white">${escapeHtml(String(data.loeHours || ''))}h</span></div>
        <div class="flex justify-between gap-4"><span class="text-slate-500 dark:text-slate-300">Due Date</span><span class="font-medium text-slate-900 dark:text-white">${escapeHtml(formatDateLabel(data.dueDate))}</span></div>
        <div class="flex justify-between gap-4"><span class="text-slate-500 dark:text-slate-300">Assignee</span><span class="font-medium text-slate-900 dark:text-white">${escapeHtml(assigneeName)}</span></div>
      </div>
    `
    : isQuickTask
      ? `
      <div class="grid gap-2 text-sm">
        ${isConvertList ? `<div class="flex flex-col gap-1"><span class="text-slate-500 dark:text-slate-300">Source list item</span><span class="font-medium text-slate-900 dark:text-white">${escapeHtml(data.sourceItemTitle || '')}</span></div>` : ''}
        <div class="flex flex-col gap-1"><span class="text-slate-500 dark:text-slate-300">Title</span><span class="font-medium text-slate-900 dark:text-white">${escapeHtml(data.title || '')}</span></div>
        ${data.description ? `<div class="flex flex-col gap-1"><span class="text-slate-500 dark:text-slate-300">Description</span><span class="text-slate-900 dark:text-white">${escapeHtml(data.description)}</span></div>` : ''}
        <div class="flex justify-between gap-4"><span class="text-slate-500 dark:text-slate-300">Client/Internal</span><span class="font-medium text-slate-900 dark:text-white">${escapeHtml(anchorLabel)}</span></div>
        <div class="flex justify-between gap-4"><span class="text-slate-500 dark:text-slate-300">Service Type</span><span class="font-medium text-slate-900 dark:text-white">${escapeHtml(serviceTypeName)}</span></div>
        <div class="flex justify-between gap-4"><span class="text-slate-500 dark:text-slate-300">LOE</span><span class="font-medium text-slate-900 dark:text-white">${escapeHtml(String(data.loeHours || ''))}h</span></div>
        <div class="flex justify-between gap-4"><span class="text-slate-500 dark:text-slate-300">Due Date</span><span class="font-medium text-slate-900 dark:text-white">${escapeHtml(formatDateLabel(data.dueDate))}</span></div>
        <div class="flex justify-between gap-4"><span class="text-slate-500 dark:text-slate-300">Assignee</span><span class="font-medium text-slate-900 dark:text-white">${escapeHtml(assigneeName)}</span></div>
        ${isConvertList ? `<div class="flex justify-between gap-4"><span class="text-slate-500 dark:text-slate-300">Post-conversion</span><span class="font-medium text-slate-900 dark:text-white">${escapeHtml(data.removeSource ? 'Remove list item' : 'Keep list item')}</span></div>` : ''}
      </div>
    `
      : isStartTimer
        ? `
      <div class="grid gap-2 text-sm">
        <div class="flex justify-between gap-4"><span class="text-slate-500 dark:text-slate-300">Task</span><span class="font-medium text-slate-900 dark:text-white">${escapeHtml(timerTaskTitle)}</span></div>
      </div>
    `
        : isStopTimer
          ? `
      <div class="grid gap-2 text-sm">
        <div class="flex justify-between gap-4"><span class="text-slate-500 dark:text-slate-300">Task</span><span class="font-medium text-slate-900 dark:text-white">${escapeHtml(timerTaskTitle)}</span></div>
        <div class="flex justify-between gap-4"><span class="text-slate-500 dark:text-slate-300">Start</span><span class="font-medium text-slate-900 dark:text-white">${escapeHtml(formatTimeLabel(data.startedAt))}</span></div>
        <div class="flex justify-between gap-4"><span class="text-slate-500 dark:text-slate-300">Elapsed</span><span class="font-medium text-slate-900 dark:text-white">${escapeHtml(formatDuration(data.elapsedMinutes || 0))}</span></div>
        <div class="flex justify-between gap-4"><span class="text-slate-500 dark:text-slate-300">Date</span><span class="font-medium text-slate-900 dark:text-white">${escapeHtml(formatDateLabel(data.date))}</span></div>
        <div class="flex justify-between gap-4"><span class="text-slate-500 dark:text-slate-300">Hours</span><span class="font-medium text-slate-900 dark:text-white">${escapeHtml(String(data.hours || ''))}h</span></div>
      </div>
    `
          : isSwitchTimer
            ? `
      <div class="grid gap-2 text-sm">
        <div class="flex justify-between gap-4"><span class="text-slate-500 dark:text-slate-300">From</span><span class="font-medium text-slate-900 dark:text-white">${escapeHtml(fromTaskTitle)}</span></div>
        <div class="flex justify-between gap-4"><span class="text-slate-500 dark:text-slate-300">To</span><span class="font-medium text-slate-900 dark:text-white">${escapeHtml(toTaskTitle)}</span></div>
        <div class="flex justify-between gap-4"><span class="text-slate-500 dark:text-slate-300">Elapsed</span><span class="font-medium text-slate-900 dark:text-white">${escapeHtml(formatDuration(data.elapsedMinutes || 0))}</span></div>
        <div class="flex justify-between gap-4"><span class="text-slate-500 dark:text-slate-300">Date</span><span class="font-medium text-slate-900 dark:text-white">${escapeHtml(formatDateLabel(data.date))}</span></div>
        <div class="flex justify-between gap-4"><span class="text-slate-500 dark:text-slate-300">Hours</span><span class="font-medium text-slate-900 dark:text-white">${escapeHtml(String(data.hours || ''))}h</span></div>
      </div>
    `
      : `
      <div class="grid gap-2 text-sm">
        <div class="flex flex-col gap-1"><span class="text-slate-500 dark:text-slate-300">Title</span><span class="font-medium text-slate-900 dark:text-white">${escapeHtml(data.title || '')}</span></div>
        ${data.notes ? `<div class="flex flex-col gap-1"><span class="text-slate-500 dark:text-slate-300">Notes</span><span class="text-slate-900 dark:text-white">${escapeHtml(data.notes)}</span></div>` : ''}
      </div>
    `;

  return `
    <div class="rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 p-4 shadow-sm">
      <div class="text-xs uppercase tracking-wide text-slate-400 dark:text-slate-400">Proposal</div>
      <div class="mt-1 text-sm font-semibold text-slate-900 dark:text-white">${typeLabel}</div>
      <div class="mt-3">
        ${details}
      </div>
      <div class="mt-4 flex flex-wrap gap-2">
        <button type="button" class="inline-flex items-center justify-center rounded-md border px-3 py-1.5 text-xs font-semibold ${ACTION_VARIANTS.primary} ${confirmDisabled ? 'opacity-50 cursor-not-allowed' : ''}" data-netnet-proposal-action="confirm" data-proposal-id="${message.id}" aria-label="Confirm proposal" ${confirmDisabled ? 'disabled' : ''}>Confirm</button>
        <button type="button" class="inline-flex items-center justify-center rounded-md border px-3 py-1.5 text-xs font-semibold ${ACTION_VARIANTS.secondary}" data-netnet-proposal-action="edit" data-proposal-id="${message.id}" aria-label="Edit proposal">Edit</button>
        <button type="button" class="inline-flex items-center justify-center rounded-md border px-3 py-1.5 text-xs font-semibold ${ACTION_VARIANTS.secondary}" data-netnet-proposal-action="cancel" data-proposal-id="${message.id}" aria-label="Cancel proposal">Cancel</button>
      </div>
    </div>
  `;
}

function renderProposalEdit(message) {
  const proposal = message.proposal || {};
  const data = proposal.data || {};
  const isLogTime = proposal.kind === 'log_time';
  const isConvertList = proposal.kind === 'convert_list_item';
  const isQuickTask = proposal.kind === 'create_quick_task' || isConvertList;
  const isJobTask = proposal.kind === 'create_job_task';
  const isStartTimer = proposal.kind === 'start_timer';
  const isStopTimer = proposal.kind === 'stop_timer';
  const isSwitchTimer = proposal.kind === 'switch_timer';
  const tasks = loadQuickTasks();
  const taskOptions = tasks.map((task) => `
    <option value="${escapeHtml(task.id)}" ${String(task.id) === String(data.taskId) ? 'selected' : ''}>${escapeHtml(task.title || 'Untitled')}</option>
  `).join('');
  const logTimeOptions = getUnifiedTaskOptions(10).map((option) => {
    const meta = buildLogTimeMetaFromTask(option.taskType, option.task);
    const value = `${option.taskType}:${option.task.id}`;
    const isSelected = data.taskId && String(option.task.id) === String(data.taskId) && (data.taskType ? data.taskType === option.taskType : option.taskType === 'quick');
    return `
      <option value="${escapeHtml(value)}" ${isSelected ? 'selected' : ''}>${escapeHtml(formatLogTimeTaskLabel(meta))}</option>
    `;
  }).join('');

  if (isJobTask) {
    const jobs = Array.isArray(performanceJobs) ? performanceJobs : [];
    const jobOptions = jobs.map((job) => `
      <option value="${escapeHtml(job.id)}" ${String(job.id) === String(data.jobId) ? 'selected' : ''}>${escapeHtml(job.name || 'Job')}</option>
    `).join('');
    const deliverables = data.jobId ? getDeliverablesForJob(data.jobId) : [];
    const deliverableOptions = deliverables.map((del) => `
      <option value="${escapeHtml(del.id)}" ${String(del.id) === String(data.deliverableId) ? 'selected' : ''}>${escapeHtml(del.name || 'Deliverable')}</option>
    `).join('');
    const serviceTypes = loadServiceTypes().filter((type) => type.active).sort(sortByName);
    const members = loadTeamMembers().sort(sortByName);
    const serviceOptions = serviceTypes.map((type) => `
      <option value="${escapeHtml(type.id)}" ${String(type.id) === String(data.serviceTypeId) ? 'selected' : ''}>${escapeHtml(type.name)}</option>
    `).join('');
    const assigneeOptions = members.map((member) => `
      <option value="${escapeHtml(member.id)}" ${String(member.id) === String(data.assigneeUserId) ? 'selected' : ''}>${escapeHtml(member.name || member.email || 'Team member')}</option>
    `).join('');
    const validation = validateJobTaskData(data);
    return `
      <div class="rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 p-4 shadow-sm">
        <div class="text-xs uppercase tracking-wide text-slate-400 dark:text-slate-400">Edit Proposal</div>
        <div class="mt-3 grid gap-3 text-sm">
          <label class="flex flex-col gap-1">
            <span class="text-xs text-slate-500 dark:text-slate-300">Title</span>
            <input type="text" data-proposal-id="${message.id}" data-proposal-field="title" value="${escapeHtml(data.title || '')}" class="rounded-md border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 px-2 py-2 text-sm text-slate-900 dark:text-white" />
          </label>
          <label class="flex flex-col gap-1">
            <span class="text-xs text-slate-500 dark:text-slate-300">Description (optional)</span>
            <textarea data-proposal-id="${message.id}" data-proposal-field="description" rows="2" class="rounded-md border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 px-2 py-2 text-sm text-slate-900 dark:text-white">${escapeHtml(data.description || '')}</textarea>
          </label>
          <label class="flex flex-col gap-1">
            <span class="text-xs text-slate-500 dark:text-slate-300">Job</span>
            <select data-proposal-id="${message.id}" data-proposal-field="jobId" class="rounded-md border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 px-2 py-2 text-sm text-slate-900 dark:text-white">
              <option value="">Select job…</option>
              ${jobOptions}
            </select>
          </label>
          <label class="flex flex-col gap-1">
            <span class="text-xs text-slate-500 dark:text-slate-300">Deliverable</span>
            <select data-proposal-id="${message.id}" data-proposal-field="deliverableId" class="rounded-md border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 px-2 py-2 text-sm text-slate-900 dark:text-white" ${data.jobId ? '' : 'disabled'}>
              <option value="">Select deliverable…</option>
              ${deliverableOptions}
            </select>
          </label>
          <label class="flex flex-col gap-1">
            <span class="text-xs text-slate-500 dark:text-slate-300">Service Type</span>
            <select data-proposal-id="${message.id}" data-proposal-field="serviceTypeId" class="rounded-md border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 px-2 py-2 text-sm text-slate-900 dark:text-white">
              <option value="">Select Service Type…</option>
              ${serviceOptions}
            </select>
          </label>
          <label class="flex flex-col gap-1">
            <span class="text-xs text-slate-500 dark:text-slate-300">LOE hours</span>
            <input type="text" data-proposal-id="${message.id}" data-proposal-field="loeHours" value="${escapeHtml(String(data.loeHours || ''))}" placeholder="1.5" class="rounded-md border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 px-2 py-2 text-sm text-slate-900 dark:text-white" />
          </label>
          <label class="flex flex-col gap-1">
            <span class="text-xs text-slate-500 dark:text-slate-300">Due date</span>
            <input type="date" data-proposal-id="${message.id}" data-proposal-field="dueDate" value="${escapeHtml(data.dueDate || '')}" class="rounded-md border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 px-2 py-2 text-sm text-slate-900 dark:text-white" />
          </label>
          <label class="flex flex-col gap-1">
            <span class="text-xs text-slate-500 dark:text-slate-300">Assignee</span>
            <select data-proposal-id="${message.id}" data-proposal-field="assigneeUserId" class="rounded-md border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 px-2 py-2 text-sm text-slate-900 dark:text-white">
              <option value="">Select assignee…</option>
              ${assigneeOptions}
            </select>
          </label>
          <div data-proposal-id="${message.id}" data-proposal-error class="text-xs text-rose-500 ${validation.ok ? 'hidden' : ''}">${escapeHtml(validation.ok ? '' : validation.reason)}</div>
        </div>
        <div class="mt-4 flex flex-wrap gap-2">
          <button type="button" class="inline-flex items-center justify-center rounded-md border px-3 py-1.5 text-xs font-semibold ${ACTION_VARIANTS.primary} ${validation.ok ? '' : 'opacity-50 cursor-not-allowed'}" data-netnet-proposal-action="save" data-proposal-id="${message.id}" aria-label="Save proposal changes" ${validation.ok ? '' : 'disabled'}>Save</button>
          <button type="button" class="inline-flex items-center justify-center rounded-md border px-3 py-1.5 text-xs font-semibold ${ACTION_VARIANTS.secondary}" data-netnet-proposal-action="cancel" data-proposal-id="${message.id}" aria-label="Cancel proposal">Cancel</button>
        </div>
      </div>
    `;
  }

  if (isQuickTask) {
    const serviceTypes = loadServiceTypes().filter((type) => type.active).sort(sortByName);
    const members = loadTeamMembers().sort(sortByName);
    const companies = getContactsData().slice().sort(sortByName);
    const people = getAllPeople().sort(sortByName);
    const anchorValue = normalizeAnchorType(data.anchorType) || '';
    const serviceOptions = serviceTypes.map((type) => `
      <option value="${escapeHtml(type.id)}" ${String(type.id) === String(data.serviceTypeId) ? 'selected' : ''}>${escapeHtml(type.name)}</option>
    `).join('');
    const assigneeOptions = members.map((member) => `
      <option value="${escapeHtml(member.id)}" ${String(member.id) === String(data.assigneeUserId) ? 'selected' : ''}>${escapeHtml(member.name || member.email || 'Team member')}</option>
    `).join('');
    const companyOptions = companies.map((company) => `
      <option value="${escapeHtml(company.id)}" ${String(company.id) === String(data.companyId) ? 'selected' : ''}>${escapeHtml(company.name || 'Company')}</option>
    `).join('');
    const personOptions = people.map((person) => {
      const label = person.companyName ? `${person.name} (${person.companyName})` : person.name;
      return `
        <option value="${escapeHtml(person.id)}" ${String(person.id) === String(data.personId) ? 'selected' : ''}>${escapeHtml(label || 'Person')}</option>
      `;
    }).join('');
    const validation = validateQuickTaskData({ ...data, anchorType: anchorValue });
    return `
      <div class="rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 p-4 shadow-sm">
        <div class="text-xs uppercase tracking-wide text-slate-400 dark:text-slate-400">Edit Proposal</div>
        <div class="mt-3 grid gap-3 text-sm">
          ${isConvertList ? `
          <div class="flex flex-col gap-1">
            <span class="text-xs text-slate-500 dark:text-slate-300">Source list item</span>
            <span class="text-sm font-medium text-slate-900 dark:text-white">${escapeHtml(data.sourceItemTitle || '')}</span>
          </div>
          <label class="flex flex-col gap-1">
            <span class="text-xs text-slate-500 dark:text-slate-300">Post-conversion</span>
            <select data-proposal-id="${message.id}" data-proposal-field="removeSource" class="rounded-md border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 px-2 py-2 text-sm text-slate-900 dark:text-white">
              <option value="keep" ${data.removeSource ? '' : 'selected'}>Keep list item</option>
              <option value="remove" ${data.removeSource ? 'selected' : ''}>Remove list item</option>
            </select>
          </label>
          ` : ''}
          <label class="flex flex-col gap-1">
            <span class="text-xs text-slate-500 dark:text-slate-300">Title</span>
            <input type="text" data-proposal-id="${message.id}" data-proposal-field="title" value="${escapeHtml(data.title || '')}" class="rounded-md border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 px-2 py-2 text-sm text-slate-900 dark:text-white" />
          </label>
          <label class="flex flex-col gap-1">
            <span class="text-xs text-slate-500 dark:text-slate-300">Description (optional)</span>
            <textarea data-proposal-id="${message.id}" data-proposal-field="description" rows="2" class="rounded-md border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 px-2 py-2 text-sm text-slate-900 dark:text-white">${escapeHtml(data.description || '')}</textarea>
          </label>
          <label class="flex flex-col gap-1">
            <span class="text-xs text-slate-500 dark:text-slate-300">Client/Internal</span>
            <select data-proposal-id="${message.id}" data-proposal-field="anchorType" class="rounded-md border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 px-2 py-2 text-sm text-slate-900 dark:text-white">
              <option value="">Select…</option>
              <option value="internal" ${anchorValue === 'internal' ? 'selected' : ''}>Internal</option>
              <option value="client_company" ${anchorValue === 'client_company' ? 'selected' : ''}>Client — Company</option>
              <option value="client_person" ${anchorValue === 'client_person' ? 'selected' : ''}>Client — Person</option>
            </select>
          </label>
          <label class="flex flex-col gap-1">
            <span class="text-xs text-slate-500 dark:text-slate-300">Company</span>
            <select data-proposal-id="${message.id}" data-proposal-field="companyId" class="rounded-md border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 px-2 py-2 text-sm text-slate-900 dark:text-white">
              <option value="">Select company…</option>
              ${companyOptions}
            </select>
          </label>
          <label class="flex flex-col gap-1">
            <span class="text-xs text-slate-500 dark:text-slate-300">Person</span>
            <select data-proposal-id="${message.id}" data-proposal-field="personId" class="rounded-md border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 px-2 py-2 text-sm text-slate-900 dark:text-white">
              <option value="">Select person…</option>
              ${personOptions}
            </select>
          </label>
          <label class="flex flex-col gap-1">
            <span class="text-xs text-slate-500 dark:text-slate-300">Service Type</span>
            <select data-proposal-id="${message.id}" data-proposal-field="serviceTypeId" class="rounded-md border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 px-2 py-2 text-sm text-slate-900 dark:text-white">
              <option value="">Select Service Type…</option>
              ${serviceOptions}
            </select>
          </label>
          <label class="flex flex-col gap-1">
            <span class="text-xs text-slate-500 dark:text-slate-300">LOE hours</span>
            <input type="text" data-proposal-id="${message.id}" data-proposal-field="loeHours" value="${escapeHtml(String(data.loeHours || ''))}" placeholder="1.5" class="rounded-md border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 px-2 py-2 text-sm text-slate-900 dark:text-white" />
          </label>
          <label class="flex flex-col gap-1">
            <span class="text-xs text-slate-500 dark:text-slate-300">Due date</span>
            <input type="date" data-proposal-id="${message.id}" data-proposal-field="dueDate" value="${escapeHtml(data.dueDate || '')}" class="rounded-md border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 px-2 py-2 text-sm text-slate-900 dark:text-white" />
          </label>
          <label class="flex flex-col gap-1">
            <span class="text-xs text-slate-500 dark:text-slate-300">Assignee</span>
            <select data-proposal-id="${message.id}" data-proposal-field="assigneeUserId" class="rounded-md border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 px-2 py-2 text-sm text-slate-900 dark:text-white">
              <option value="">Select assignee…</option>
              ${assigneeOptions}
            </select>
          </label>
          <div data-proposal-id="${message.id}" data-proposal-error class="text-xs text-rose-500 ${validation.ok ? 'hidden' : ''}">${escapeHtml(validation.ok ? '' : validation.reason)}</div>
        </div>
        <div class="mt-4 flex flex-wrap gap-2">
          <button type="button" class="inline-flex items-center justify-center rounded-md border px-3 py-1.5 text-xs font-semibold ${ACTION_VARIANTS.primary} ${validation.ok ? '' : 'opacity-50 cursor-not-allowed'}" data-netnet-proposal-action="save" data-proposal-id="${message.id}" aria-label="Save proposal changes" ${validation.ok ? '' : 'disabled'}>Save</button>
          <button type="button" class="inline-flex items-center justify-center rounded-md border px-3 py-1.5 text-xs font-semibold ${ACTION_VARIANTS.secondary}" data-netnet-proposal-action="cancel" data-proposal-id="${message.id}" aria-label="Cancel proposal">Cancel</button>
        </div>
      </div>
    `;
  }

  if (isStartTimer) {
    const validation = validateTimerProposal('start_timer', data);
    return `
      <div class="rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 p-4 shadow-sm">
        <div class="text-xs uppercase tracking-wide text-slate-400 dark:text-slate-400">Edit Proposal</div>
        <div class="mt-3 grid gap-3 text-sm">
          <label class="flex flex-col gap-1">
            <span class="text-xs text-slate-500 dark:text-slate-300">Quick Task</span>
            <select data-proposal-id="${message.id}" data-proposal-field="taskId" class="rounded-md border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 px-2 py-2 text-sm text-slate-900 dark:text-white">
              <option value="">Select Quick Task…</option>
              ${taskOptions}
            </select>
          </label>
          <div data-proposal-id="${message.id}" data-proposal-error class="text-xs text-rose-500 ${validation.ok ? 'hidden' : ''}">${escapeHtml(validation.ok ? '' : validation.reason)}</div>
        </div>
        <div class="mt-4 flex flex-wrap gap-2">
          <button type="button" class="inline-flex items-center justify-center rounded-md border px-3 py-1.5 text-xs font-semibold ${ACTION_VARIANTS.primary} ${validation.ok ? '' : 'opacity-50 cursor-not-allowed'}" data-netnet-proposal-action="save" data-proposal-id="${message.id}" aria-label="Save proposal changes" ${validation.ok ? '' : 'disabled'}>Save</button>
          <button type="button" class="inline-flex items-center justify-center rounded-md border px-3 py-1.5 text-xs font-semibold ${ACTION_VARIANTS.secondary}" data-netnet-proposal-action="cancel" data-proposal-id="${message.id}" aria-label="Cancel proposal">Cancel</button>
        </div>
      </div>
    `;
  }

  if (isStopTimer) {
    const validation = validateTimerProposal('stop_timer', data);
    return `
      <div class="rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 p-4 shadow-sm">
        <div class="text-xs uppercase tracking-wide text-slate-400 dark:text-slate-400">Edit Proposal</div>
        <div class="mt-3 grid gap-3 text-sm">
          <div class="flex flex-col gap-1">
            <span class="text-xs text-slate-500 dark:text-slate-300">Task</span>
            <span class="text-sm font-medium text-slate-900 dark:text-white">${escapeHtml(data.taskTitle || '')}</span>
          </div>
          <label class="flex flex-col gap-1">
            <span class="text-xs text-slate-500 dark:text-slate-300">Date</span>
            <input type="date" data-proposal-id="${message.id}" data-proposal-field="date" value="${escapeHtml(data.date || '')}" class="rounded-md border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 px-2 py-2 text-sm text-slate-900 dark:text-white" />
          </label>
          <label class="flex flex-col gap-1">
            <span class="text-xs text-slate-500 dark:text-slate-300">Hours</span>
            <input type="text" data-proposal-id="${message.id}" data-proposal-field="hours" value="${escapeHtml(String(data.hours || ''))}" placeholder="1.5" class="rounded-md border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 px-2 py-2 text-sm text-slate-900 dark:text-white" />
          </label>
          <div data-proposal-id="${message.id}" data-proposal-error class="text-xs text-rose-500 ${validation.ok ? 'hidden' : ''}">${escapeHtml(validation.ok ? '' : validation.reason)}</div>
        </div>
        <div class="mt-4 flex flex-wrap gap-2">
          <button type="button" class="inline-flex items-center justify-center rounded-md border px-3 py-1.5 text-xs font-semibold ${ACTION_VARIANTS.primary} ${validation.ok ? '' : 'opacity-50 cursor-not-allowed'}" data-netnet-proposal-action="save" data-proposal-id="${message.id}" aria-label="Save proposal changes" ${validation.ok ? '' : 'disabled'}>Save</button>
          <button type="button" class="inline-flex items-center justify-center rounded-md border px-3 py-1.5 text-xs font-semibold ${ACTION_VARIANTS.secondary}" data-netnet-proposal-action="cancel" data-proposal-id="${message.id}" aria-label="Cancel proposal">Cancel</button>
        </div>
      </div>
    `;
  }

  if (isSwitchTimer) {
    const toTaskOptions = tasks.map((task) => `
      <option value="${escapeHtml(task.id)}" ${String(task.id) === String(data.toTaskId) ? 'selected' : ''}>${escapeHtml(task.title || 'Untitled')}</option>
    `).join('');
    const validation = validateTimerProposal('switch_timer', data);
    return `
      <div class="rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 p-4 shadow-sm">
        <div class="text-xs uppercase tracking-wide text-slate-400 dark:text-slate-400">Edit Proposal</div>
        <div class="mt-3 grid gap-3 text-sm">
          <div class="flex flex-col gap-1">
            <span class="text-xs text-slate-500 dark:text-slate-300">From</span>
            <span class="text-sm font-medium text-slate-900 dark:text-white">${escapeHtml(data.fromTaskTitle || '')}</span>
          </div>
          <label class="flex flex-col gap-1">
            <span class="text-xs text-slate-500 dark:text-slate-300">To</span>
            <select data-proposal-id="${message.id}" data-proposal-field="toTaskId" class="rounded-md border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 px-2 py-2 text-sm text-slate-900 dark:text-white">
              <option value="">Select Quick Task…</option>
              ${toTaskOptions}
            </select>
          </label>
          <label class="flex flex-col gap-1">
            <span class="text-xs text-slate-500 dark:text-slate-300">Date</span>
            <input type="date" data-proposal-id="${message.id}" data-proposal-field="date" value="${escapeHtml(data.date || '')}" class="rounded-md border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 px-2 py-2 text-sm text-slate-900 dark:text-white" />
          </label>
          <label class="flex flex-col gap-1">
            <span class="text-xs text-slate-500 dark:text-slate-300">Hours</span>
            <input type="text" data-proposal-id="${message.id}" data-proposal-field="hours" value="${escapeHtml(String(data.hours || ''))}" placeholder="1.5" class="rounded-md border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 px-2 py-2 text-sm text-slate-900 dark:text-white" />
          </label>
          <div data-proposal-id="${message.id}" data-proposal-error class="text-xs text-rose-500 ${validation.ok ? 'hidden' : ''}">${escapeHtml(validation.ok ? '' : validation.reason)}</div>
        </div>
        <div class="mt-4 flex flex-wrap gap-2">
          <button type="button" class="inline-flex items-center justify-center rounded-md border px-3 py-1.5 text-xs font-semibold ${ACTION_VARIANTS.primary} ${validation.ok ? '' : 'opacity-50 cursor-not-allowed'}" data-netnet-proposal-action="save" data-proposal-id="${message.id}" aria-label="Save proposal changes" ${validation.ok ? '' : 'disabled'}>Save</button>
          <button type="button" class="inline-flex items-center justify-center rounded-md border px-3 py-1.5 text-xs font-semibold ${ACTION_VARIANTS.secondary}" data-netnet-proposal-action="cancel" data-proposal-id="${message.id}" aria-label="Cancel proposal">Cancel</button>
        </div>
      </div>
    `;
  }

  const body = isLogTime
    ? `
      <div class="grid gap-3 text-sm">
        <label class="flex flex-col gap-1">
          <span class="text-xs text-slate-500 dark:text-slate-300">Task</span>
          <select data-proposal-id="${message.id}" data-proposal-field="taskId" class="rounded-md border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 px-2 py-2 text-sm text-slate-900 dark:text-white">
            <option value="">Select task…</option>
            ${logTimeOptions}
          </select>
        </label>
        <label class="flex flex-col gap-1">
          <span class="text-xs text-slate-500 dark:text-slate-300">Date</span>
          <input type="date" data-proposal-id="${message.id}" data-proposal-field="date" value="${escapeHtml(data.date || '')}" class="rounded-md border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 px-2 py-2 text-sm text-slate-900 dark:text-white" />
        </label>
        <label class="flex flex-col gap-1">
          <span class="text-xs text-slate-500 dark:text-slate-300">Hours</span>
          <input type="text" data-proposal-id="${message.id}" data-proposal-field="hours" value="${escapeHtml(String(data.hours || ''))}" placeholder="1.5" class="rounded-md border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 px-2 py-2 text-sm text-slate-900 dark:text-white" />
        </label>
        <label class="flex flex-col gap-1">
          <span class="text-xs text-slate-500 dark:text-slate-300">Note (optional)</span>
          <textarea data-proposal-id="${message.id}" data-proposal-field="note" rows="2" class="rounded-md border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 px-2 py-2 text-sm text-slate-900 dark:text-white">${escapeHtml(data.note || '')}</textarea>
        </label>
      </div>
    `
    : `
      <div class="grid gap-3 text-sm">
        <label class="flex flex-col gap-1">
          <span class="text-xs text-slate-500 dark:text-slate-300">Title</span>
          <input type="text" data-proposal-id="${message.id}" data-proposal-field="title" value="${escapeHtml(data.title || '')}" class="rounded-md border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 px-2 py-2 text-sm text-slate-900 dark:text-white" />
        </label>
        <label class="flex flex-col gap-1">
          <span class="text-xs text-slate-500 dark:text-slate-300">Notes (optional)</span>
          <textarea data-proposal-id="${message.id}" data-proposal-field="notes" rows="2" class="rounded-md border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 px-2 py-2 text-sm text-slate-900 dark:text-white">${escapeHtml(data.notes || '')}</textarea>
        </label>
      </div>
    `;

  return `
    <div class="rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 p-4 shadow-sm">
      <div class="text-xs uppercase tracking-wide text-slate-400 dark:text-slate-400">Edit Proposal</div>
      <div class="mt-3">
        ${body}
      </div>
      <div class="mt-4 flex flex-wrap gap-2">
        <button type="button" class="inline-flex items-center justify-center rounded-md border px-3 py-1.5 text-xs font-semibold ${ACTION_VARIANTS.primary}" data-netnet-proposal-action="save" data-proposal-id="${message.id}" aria-label="Save proposal changes">Save</button>
        <button type="button" class="inline-flex items-center justify-center rounded-md border px-3 py-1.5 text-xs font-semibold ${ACTION_VARIANTS.secondary}" data-netnet-proposal-action="cancel" data-proposal-id="${message.id}" aria-label="Cancel proposal">Cancel</button>
      </div>
    </div>
  `;
}

function readQuickTaskProposalFields(proposalId) {
  const getValue = (field) =>
    document.querySelector(`[data-proposal-id="${proposalId}"][data-proposal-field="${field}"]`);
  const titleInput = getValue('title');
  const descInput = getValue('description');
  const anchorInput = getValue('anchorType');
  const companyInput = getValue('companyId');
  const personInput = getValue('personId');
  const serviceInput = getValue('serviceTypeId');
  const loeInput = getValue('loeHours');
  const dueInput = getValue('dueDate');
  const assigneeInput = getValue('assigneeUserId');
  const removeSourceInput = getValue('removeSource');

  const anchorType = normalizeAnchorType(anchorInput?.value || '');
  let companyId = companyInput?.value || '';
  let personId = personInput?.value || '';
  let companyName = '';
  let personName = '';
  if (anchorType === 'internal') {
    companyId = '';
    personId = '';
  }
  const person = personId ? findPersonById(personId) : null;
  if (person) {
    personName = person.name || '';
    if (!companyId && person.companyId) {
      companyId = person.companyId;
    }
  }
  const company = companyId ? findCompanyById(companyId) : null;
  companyName = company?.name || (person?.companyName || '');
  if (anchorType === 'client_person' && !personId) {
    companyId = '';
    companyName = '';
  }

  const serviceTypeId = serviceInput?.value || '';
  const serviceTypeName = serviceTypeId ? getServiceTypeById(serviceTypeId)?.name || '' : '';
  const assigneeUserId = assigneeInput?.value || '';
  const assigneeName = assigneeUserId ? getMemberById(assigneeUserId)?.name || '' : '';
  const removeSource = removeSourceInput ? removeSourceInput.value === 'remove' : undefined;

  return {
    title: titleInput?.value?.trim() || '',
    description: descInput?.value?.trim() || '',
    anchorType,
    companyId: companyId || null,
    companyName: companyName || '',
    personId: personId || null,
    personName,
    serviceTypeId: serviceTypeId || '',
    serviceTypeName,
    loeHours: coerceHours(loeInput?.value || ''),
    dueDate: dueInput?.value || '',
    assigneeUserId: assigneeUserId || '',
    assigneeName,
    removeSource,
  };
}

function readLogTimeProposalFields(proposalId) {
  const getValue = (field) =>
    document.querySelector(`[data-proposal-id="${proposalId}"][data-proposal-field="${field}"]`);
  const taskInput = getValue('taskId');
  const dateInput = getValue('date');
  const hoursInput = getValue('hours');
  const noteInput = getValue('note');

  const { taskType, taskId } = parseLogTimeTaskValue(taskInput?.value || '');
  const meta = getLogTimeTaskMeta(taskType, taskId);

  return {
    taskId: meta.taskId || taskId,
    taskType: meta.taskType || taskType,
    taskTitle: meta.taskTitle || '',
    taskContext: meta.taskContext || '',
    jobId: meta.jobId || null,
    deliverableId: meta.deliverableId || null,
    jobName: meta.jobName || '',
    deliverableName: meta.deliverableName || '',
    date: dateInput?.value || '',
    hours: parseHoursInput(hoursInput?.value || ''),
    note: noteInput?.value?.trim() || '',
  };
}

function updateQuickTaskEditState(proposalId) {
  if (!proposalId) return;
  const data = readQuickTaskProposalFields(proposalId);
  const validation = validateQuickTaskData(data);
  const saveBtn = document.querySelector(`[data-netnet-proposal-action="save"][data-proposal-id="${proposalId}"]`);
  if (saveBtn) {
    saveBtn.disabled = !validation.ok;
    saveBtn.classList.toggle('opacity-50', !validation.ok);
    saveBtn.classList.toggle('cursor-not-allowed', !validation.ok);
  }
  const errorEl = document.querySelector(`[data-proposal-id="${proposalId}"][data-proposal-error]`);
  if (errorEl) {
    errorEl.textContent = validation.ok ? '' : validation.reason;
    errorEl.classList.toggle('hidden', validation.ok);
  }
}

function readJobTaskProposalFields(proposalId) {
  const getValue = (field) =>
    document.querySelector(`[data-proposal-id="${proposalId}"][data-proposal-field="${field}"]`);
  const titleInput = getValue('title');
  const descInput = getValue('description');
  const jobInput = getValue('jobId');
  const deliverableInput = getValue('deliverableId');
  const serviceInput = getValue('serviceTypeId');
  const loeInput = getValue('loeHours');
  const dueInput = getValue('dueDate');
  const assigneeInput = getValue('assigneeUserId');

  const jobId = jobInput?.value || '';
  const deliverableId = deliverableInput?.value || '';
  const serviceTypeId = serviceInput?.value || '';
  const assigneeUserId = assigneeInput?.value || '';

  const jobName = jobId ? findJobById(jobId)?.name || '' : '';
  const deliverableName = deliverableId ? findDeliverableById(deliverableId)?.name || '' : '';
  const serviceTypeName = serviceTypeId ? getServiceTypeById(serviceTypeId)?.name || '' : '';
  const assigneeName = assigneeUserId ? getMemberById(assigneeUserId)?.name || '' : '';

  return {
    title: titleInput?.value?.trim() || '',
    description: descInput?.value?.trim() || '',
    jobId: jobId || '',
    jobName,
    deliverableId: deliverableId || '',
    deliverableName,
    serviceTypeId: serviceTypeId || '',
    serviceTypeName,
    loeHours: coerceHours(loeInput?.value || ''),
    dueDate: dueInput?.value || '',
    assigneeUserId: assigneeUserId || '',
    assigneeName,
  };
}

function updateJobTaskEditState(proposalId, dataOverride = null) {
  if (!proposalId) return;
  const data = dataOverride || readJobTaskProposalFields(proposalId);
  const validation = validateJobTaskData(data);
  const saveBtn = document.querySelector(`[data-netnet-proposal-action="save"][data-proposal-id="${proposalId}"]`);
  const error = document.querySelector(`[data-proposal-id="${proposalId}"][data-proposal-error]`);
  if (saveBtn) {
    saveBtn.disabled = !validation.ok;
    saveBtn.classList.toggle('opacity-50', !validation.ok);
    saveBtn.classList.toggle('cursor-not-allowed', !validation.ok);
  }
  if (error) {
    error.textContent = validation.ok ? '' : validation.reason || 'Please complete the required fields.';
    error.classList.toggle('hidden', validation.ok);
  }
}

function readTimerProposalFields(proposalId, kind) {
  const getValue = (field) =>
    document.querySelector(`[data-proposal-id="${proposalId}"][data-proposal-field="${field}"]`);
  if (kind === 'start_timer') {
    const taskInput = getValue('taskId');
    const taskId = taskInput?.value || '';
    const task = taskId ? loadQuickTasks().find((item) => String(item.id) === String(taskId)) : null;
    return {
      taskId: taskId || '',
      taskTitle: task?.title || '',
    };
  }
  if (kind === 'stop_timer') {
    const dateInput = getValue('date');
    const hoursInput = getValue('hours');
    return {
      date: dateInput?.value || '',
      hours: coerceHours(hoursInput?.value || ''),
    };
  }
  if (kind === 'switch_timer') {
    const toTaskInput = getValue('toTaskId');
    const dateInput = getValue('date');
    const hoursInput = getValue('hours');
    const toTaskId = toTaskInput?.value || '';
    const toTask = toTaskId ? loadQuickTasks().find((item) => String(item.id) === String(toTaskId)) : null;
    return {
      toTaskId: toTaskId || '',
      toTaskTitle: toTask?.title || '',
      date: dateInput?.value || '',
      hours: coerceHours(hoursInput?.value || ''),
    };
  }
  return {};
}

function updateTimerEditState(proposalId, kind, baseData) {
  if (!proposalId) return;
  const delta = readTimerProposalFields(proposalId, kind);
  const data = { ...baseData, ...delta };
  const validation = validateTimerProposal(kind, data);
  const saveBtn = document.querySelector(`[data-netnet-proposal-action="save"][data-proposal-id="${proposalId}"]`);
  if (saveBtn) {
    saveBtn.disabled = !validation.ok;
    saveBtn.classList.toggle('opacity-50', !validation.ok);
    saveBtn.classList.toggle('cursor-not-allowed', !validation.ok);
  }
  const errorEl = document.querySelector(`[data-proposal-id="${proposalId}"][data-proposal-error]`);
  if (errorEl) {
    errorEl.textContent = validation.ok ? '' : validation.reason;
    errorEl.classList.toggle('hidden', validation.ok);
  }
}

function renderProposalMessage(message) {
  const proposal = message.proposal || {};
  const body = proposal.mode === 'edit'
    ? renderProposalEdit(message)
    : renderProposalSummary(message);
  return `
    <div class="flex gap-3 items-start">
      <div class="w-8 h-8 rounded-full bg-netnet-purple/10 flex items-center justify-center shrink-0">
        <img src="${getNetNetIconSrc(true)}" class="w-4 h-4 object-contain" alt="" aria-hidden="true" data-netnet-icon="true" />
      </div>
      <div class="flex flex-col gap-2 w-full">
        <span class="text-xs font-semibold text-slate-500 dark:text-slate-300">Net Net</span>
        ${body}
      </div>
    </div>
  `;
}

function renderMessageHtml(message) {
  if (message.type === 'proposal') return renderProposalMessage(message);
  const safeText = escapeHtml(message.text).replace(/\n/g, '<br>');
  if (message.role === 'user') {
    return `
      <div class="flex justify-end">
        <div class="max-w-[85%] bg-netnet-purple text-white text-sm rounded-2xl rounded-br-none p-3 shadow-sm">
          ${safeText}
        </div>
      </div>
    `;
  }
  return `
    <div class="flex gap-3 items-start">
      <div class="w-8 h-8 rounded-full bg-netnet-purple/10 flex items-center justify-center shrink-0">
        <img src="${getNetNetIconSrc(true)}" class="w-4 h-4 object-contain" alt="" aria-hidden="true" data-netnet-icon="true" />
      </div>
      <div class="flex flex-col gap-1 max-w-[85%]">
        <span class="text-xs font-semibold text-slate-500 dark:text-slate-300">Net Net</span>
        <div class="bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-100 text-sm rounded-2xl rounded-tl-none p-3 shadow-sm">
          ${safeText}
        </div>
        ${renderActions(message.actions || [], message.id)}
      </div>
    </div>
  `;
}

function renderSuggestions() {
  return `
    <div class="flex flex-wrap gap-2">
      ${NETNET_SUGGESTIONS.map((item) => `
        <button type="button" class="px-3 py-1.5 rounded-full text-xs font-medium bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-200 border border-slate-200 dark:border-white/10 hover:border-slate-300 dark:hover:border-white/20 transition-colors" data-netnet-suggestion="${escapeHtml(item)}" aria-label="Use suggestion: ${escapeHtml(item)}">
          ${escapeHtml(item)}
        </button>
      `).join('')}
    </div>
  `;
}

function renderNetNetDrawer() {
  const iconSrc = getNetNetIconSrc(true);
  const hasMessages = NETNET_STATE.messages.length > 0;
  const messagesHtml = hasMessages
    ? NETNET_STATE.messages.map(renderMessageHtml).join('')
    : `${renderMessageHtml({ role: 'netnet', text: 'How can I help?' })}${renderSuggestions()}`;
  return `
    <div id="app-drawer-backdrop"></div>
    <aside id="app-drawer" class="bg-white dark:bg-slate-900 text-slate-900 dark:text-white p-0 flex flex-col w-full max-w-md h-full">
      <div class="flex items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 shrink-0">
        <div class="flex items-center gap-3">
          <div class="w-8 h-8 rounded-full bg-netnet-purple/10 flex items-center justify-center">
            <img src="${iconSrc}" class="w-4 h-4 object-contain" alt="Net Net" data-netnet-icon="true" />
          </div>
          <h2 class="text-lg font-semibold">Net Net</h2>
        </div>
        <div class="flex items-center gap-2">
          <button id="netnet-new-btn" type="button" class="px-3 py-1.5 text-xs font-semibold text-netnet-purple dark:text-white bg-netnet-purple/10 dark:bg-white/10 rounded-md hover:bg-netnet-purple/20 dark:hover:bg-white/20 transition-colors" aria-label="New Net Net conversation">New</button>
          <button type="button" id="drawerCloseBtn" class="text-slate-500 hover:text-slate-800 dark:text-white/70 dark:hover:text-white" aria-label="Close Net Net">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
      </div>
      <div id="netnet-thread" class="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50 dark:bg-[#0B1120]">
        ${messagesHtml}
      </div>
      <div class="p-4 border-t border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 shrink-0">
        <div class="flex items-end gap-2 bg-slate-100 dark:bg-slate-800 rounded-2xl px-3 py-2">
          <textarea id="netnet-input" rows="1" class="flex-1 bg-transparent border-none focus:ring-0 focus:outline-none text-slate-900 dark:text-white placeholder-slate-500 text-sm leading-5 resize-none max-h-[180px] overflow-y-auto min-h-[44px]" placeholder="Ask Net Net..."></textarea>
          <button id="netnet-send-btn" disabled class="p-2 bg-slate-300 dark:bg-slate-700 text-white rounded-full disabled:opacity-50 enabled:bg-netnet-purple transition-colors h-9 w-9 flex items-center justify-center" aria-label="Send to Net Net">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="19" x2="12" y2="5"/><polyline points="5 12 12 5 19 12"/></svg>
          </button>
        </div>
      </div>
    </aside>
  `;
}

function closeDrawer() {
  const shell = document.getElementById('app-shell');
  if (shell) shell.classList.add('drawer-closed');
}

function appendMessage(msgList, message) {
  const nextMessage = {
    id: message.id || createMessageId('nn'),
    role: message.role || 'netnet',
    text: message.text || '',
    type: message.type || 'text',
    proposal: message.proposal,
    actions: message.actions || [],
  };
  if (nextMessage.type === 'proposal') {
    NETNET_STATE.pendingProposalId = nextMessage.id;
  }
  NETNET_STATE.messages.push(nextMessage);
  persistThreadState();
  if (msgList) {
    if (NETNET_STATE.messages.length === 1) msgList.innerHTML = '';
    msgList.insertAdjacentHTML('beforeend', renderMessageHtml(nextMessage));
    msgList.scrollTop = msgList.scrollHeight;
  }
  return nextMessage;
}

function updateMessage(messageId, updates = {}) {
  const idx = NETNET_STATE.messages.findIndex((msg) => msg.id === messageId);
  if (idx < 0) return null;
  const next = { ...NETNET_STATE.messages[idx], ...updates };
  NETNET_STATE.messages[idx] = next;
  persistThreadState();
  return next;
}

function removeMessage(messageId) {
  NETNET_STATE.messages = NETNET_STATE.messages.filter((msg) => msg.id !== messageId);
  if (NETNET_STATE.pendingProposalId === messageId) {
    NETNET_STATE.pendingProposalId = null;
  }
  persistThreadState();
}

function appendNetNetMessage(msgList, text, actions = []) {
  return appendMessage(msgList, { role: 'netnet', text, actions });
}

function appendUserMessage(msgList, text) {
  return appendMessage(msgList, { role: 'user', text });
}

function askIntentClarification(msgList, text) {
  NETNET_STATE.flow = {
    currentFlow: 'clarify_intent',
    slots: {},
    awaiting: null,
    sourceText: text,
    context: {},
  };
  setAwaiting('intent_choice');
  appendNetNetMessage(msgList, 'Do you want this captured for later (My Lists) or created as a task?', [
    { action: 'intent-choice', value: 'my_lists', label: 'My Lists', variant: 'primary', ariaLabel: 'Choose My Lists' },
    { action: 'intent-choice', value: 'task', label: 'Task', variant: 'secondary', ariaLabel: 'Choose Task' },
  ]);
}

function startMyListsFlow(msgList, sourceText) {
  const titleCandidate = extractTitleCandidate(sourceText || '');
  const notesCandidate = extractNotesCandidate(sourceText || '', titleCandidate);
  NETNET_STATE.flow = {
    currentFlow: 'create_list_item',
    slots: { title: '', notes: '' },
    awaiting: null,
    sourceText,
    context: { titleCandidate, notesCandidate, askedNotes: false },
  };

  if (titleCandidate) {
    setAwaiting('confirm_title', { candidate: titleCandidate });
    appendNetNetMessage(msgList, `Use this as the list item title: "${titleCandidate}"?`, [
      { action: 'confirm-title', value: 'yes', label: 'Yes', variant: 'primary', ariaLabel: 'Confirm list item title' },
      { action: 'confirm-title', value: 'no', label: 'No', variant: 'secondary', ariaLabel: 'Reject list item title' },
    ]);
  } else {
    setAwaiting('list_title');
    appendNetNetMessage(msgList, 'What should the list item title be?');
  }
}

function askNotesConfirmation(msgList, notesCandidate) {
  if (!notesCandidate) {
    showListProposal(msgList);
    return;
  }
  setAwaiting('confirm_notes', { candidate: notesCandidate });
  appendNetNetMessage(msgList, 'Do you want the extra details saved as notes?', [
    { action: 'confirm-notes', value: 'yes', label: 'Yes', variant: 'primary', ariaLabel: 'Save notes' },
    { action: 'confirm-notes', value: 'no', label: 'No', variant: 'secondary', ariaLabel: 'Skip notes' },
  ]);
}

function showListProposal(msgList) {
  clearAwaiting();
  const { title, notes } = NETNET_STATE.flow.slots || {};
  const proposal = {
    kind: 'create_list_item',
    mode: 'view',
    data: {
      title: title || '',
      notes: notes || '',
    },
  };
  appendMessage(msgList, { role: 'netnet', type: 'proposal', proposal });
  NETNET_STATE.flow = { ...NETNET_STATE.flow, currentFlow: 'none', awaiting: null };
  persistThreadState();
}

function askConvertIntentConfirm(msgList, sourceText) {
  NETNET_STATE.flow = {
    currentFlow: 'convert_list_item',
    slots: {},
    awaiting: null,
    sourceText,
    context: {},
  };
  setAwaiting('convert_intent_confirm');
  appendNetNetMessage(msgList, 'Do you want to convert a My Lists item into a Quick Task?', [
    { action: 'convert-intent', value: 'yes', label: 'Yes', variant: 'primary', ariaLabel: 'Confirm conversion' },
    { action: 'convert-intent', value: 'no', label: 'No', variant: 'secondary', ariaLabel: 'Cancel conversion' },
  ]);
}

function startConvertListItemFlow(msgList, sourceText) {
  const items = loadMyListItems().filter((item) => item && !item.isArchived);
  if (!items.length) {
    resetFlowState();
    appendNetNetMessage(msgList, 'I could not find any active My Lists items yet. Create one first, then I can convert it.');
    return;
  }
  NETNET_STATE.flow = {
    currentFlow: 'convert_list_item',
    slots: {},
    awaiting: null,
    sourceText,
    context: {},
  };
  const contextual = getContextualListItem(sourceText, items);
  if (contextual) {
    askConvertKeepRemove(msgList, contextual);
    return;
  }
  const matches = matchMyListItemsByTitle(sourceText, items);
  if (matches.length === 1) {
    askConvertKeepRemove(msgList, matches[0]);
    return;
  }
  if (matches.length > 1) {
    setAwaiting('convert_list_item_choice');
    appendNetNetMessage(msgList, 'Which list item do you want to convert?', [
      ...matches.slice(0, 5).map((item) => ({
        action: 'convert-list-item',
        value: item.id,
        label: item.title || 'Untitled',
        variant: 'secondary',
        ariaLabel: `Select ${item.title || 'list item'}`,
      })),
      { action: 'convert-list-search', value: 'search', label: 'Search…', variant: 'subtle', ariaLabel: 'Search list items' },
    ]);
    return;
  }
  const quoted = extractQuotedText(sourceText || '');
  if (quoted) {
    setAwaiting('convert_list_item_choice');
    appendNetNetMessage(msgList, 'I couldn’t find that list item. Want to pick one?', [
      ...getMyListOptions().map((item) => ({
        action: 'convert-list-item',
        value: item.id,
        label: item.title || 'Untitled',
        variant: 'secondary',
        ariaLabel: `Select ${item.title || 'list item'}`,
      })),
      { action: 'convert-list-search', value: 'search', label: 'Search…', variant: 'subtle', ariaLabel: 'Search list items' },
    ]);
    return;
  }
  setAwaiting('convert_list_item_choice');
  appendNetNetMessage(msgList, 'Which list item do you want to convert?', [
    ...getMyListOptions().map((item) => ({
      action: 'convert-list-item',
      value: item.id,
      label: item.title || 'Untitled',
      variant: 'secondary',
      ariaLabel: `Select ${item.title || 'list item'}`,
    })),
    { action: 'convert-list-search', value: 'search', label: 'Search…', variant: 'subtle', ariaLabel: 'Search list items' },
  ]);
}

function askConvertKeepRemove(msgList, item) {
  NETNET_STATE.flow.context = {
    ...NETNET_STATE.flow.context,
    sourceListItem: {
      id: item.id,
      title: item.title || '',
      notes: item.notes || '',
      folderId: item.folderId ?? null,
    },
    removeSource: null,
  };
  setAwaiting('convert_keep_choice');
  appendNetNetMessage(msgList, 'I can turn this My Lists item into a Quick Task. Do you want to keep the original list item, or remove it after creating the task?', [
    { action: 'convert-keep', value: 'keep', label: 'Keep list item', variant: 'primary', ariaLabel: 'Keep list item' },
    { action: 'convert-remove', value: 'remove', label: 'Remove list item', variant: 'secondary', ariaLabel: 'Remove list item' },
    { action: 'cancel-flow', value: 'cancel', label: 'Cancel', variant: 'subtle', ariaLabel: 'Cancel' },
  ]);
  persistThreadState();
}

function beginConvertToQuickTask(msgList, removeSource) {
  const sourceItem = NETNET_STATE.flow.context?.sourceListItem;
  if (!sourceItem) {
    resetFlowState();
    appendNetNetMessage(msgList, 'I couldn’t find that list item. Want to pick one?');
    return;
  }
  NETNET_STATE.flow.context.removeSource = !!removeSource;
  persistThreadState();
  startQuickTaskFlow(msgList, NETNET_STATE.flow.sourceText || sourceItem.title || '', {
    prefill: {
      title: sourceItem.title || '',
      description: sourceItem.notes || '',
    },
    conversion: {
      sourceItem,
      removeSource: !!removeSource,
    },
  });
}

function startLogTimeFlow(msgList, sourceText) {
  const matches = findUnifiedTaskMatches(sourceText || '');
  const matchedTask = matches.length === 1 ? matches[0] : null;
  const hours = parseHoursInput(sourceText || '');
  const date = parseDateFromText(sourceText || '');
  const note = parseNoteFromText(sourceText || '');

  NETNET_STATE.flow = {
    currentFlow: 'log_time',
    slots: {
      taskId: matchedTask ? matchedTask.task.id : null,
      taskType: matchedTask ? matchedTask.taskType : '',
      taskTitle: matchedTask ? getLogTimeTaskMeta(matchedTask.taskType, matchedTask.task.id).taskTitle : '',
      hours: hours || null,
      date: date || '',
      note: note || '',
    },
    awaiting: null,
    sourceText,
    context: {
      taskMatches: matches.length > 1 ? matches : [],
    },
  };

  continueLogTimeFlow(msgList);
}

function continueLogTimeFlow(msgList) {
  const slots = NETNET_STATE.flow.slots || {};
  if (!slots.taskId) {
    const matches = Array.isArray(NETNET_STATE.flow.context?.taskMatches)
      ? NETNET_STATE.flow.context.taskMatches
      : [];
    const options = matches.length ? matches : getUnifiedTaskOptions();
    if (!options.length) {
      resetFlowState();
      appendNetNetMessage(msgList, 'I could not find any tasks yet. Create a Quick Task or Job Task first, then I can log time.');
      return;
    }
    setAwaiting('task_choice');
    appendNetNetMessage(msgList, 'Which task should I log time to?', [
      ...buildLogTimeTaskActions(options),
      { action: 'task-search', value: 'search', label: 'Search…', variant: 'subtle', ariaLabel: 'Search tasks' },
    ]);
    return;
  }
  if (!slots.taskType) {
    slots.taskType = getJobTaskById(slots.taskId) ? 'job' : 'quick';
  }
  if (!slots.hours) {
    setAwaiting('hours');
    appendNetNetMessage(msgList, 'How much time?');
    return;
  }
  if (!slots.date) {
    setAwaiting('date');
    appendNetNetMessage(msgList, 'What date should I log this to?', [
      { action: 'select-date', value: 'today', label: 'Today', variant: 'secondary', ariaLabel: 'Use today' },
      { action: 'select-date', value: 'yesterday', label: 'Yesterday', variant: 'secondary', ariaLabel: 'Use yesterday' },
      { action: 'select-date', value: 'pick', label: 'Pick date…', variant: 'subtle', ariaLabel: 'Pick a date' },
    ]);
    return;
  }
  showTimeProposal(msgList);
}

function showTimeProposal(msgList) {
  clearAwaiting();
  const slots = NETNET_STATE.flow.slots || {};
  const taskMeta = getLogTimeTaskMeta(slots.taskType, slots.taskId, slots.taskTitle || '');
  const proposal = {
    kind: 'log_time',
    mode: 'view',
    data: {
      taskId: taskMeta.taskId || slots.taskId,
      taskType: taskMeta.taskType || slots.taskType || 'quick',
      taskTitle: taskMeta.taskTitle || slots.taskTitle || '',
      taskContext: taskMeta.taskContext || '',
      jobId: taskMeta.jobId || null,
      deliverableId: taskMeta.deliverableId || null,
      jobName: taskMeta.jobName || '',
      deliverableName: taskMeta.deliverableName || '',
      hours: slots.hours,
      date: slots.date,
      note: slots.note || '',
    },
  };
  appendMessage(msgList, { role: 'netnet', type: 'proposal', proposal });
  NETNET_STATE.flow = { ...NETNET_STATE.flow, currentFlow: 'none', awaiting: null };
  persistThreadState();
}

function startTimerFlow(msgList, sourceText) {
  const hint = extractTimerTaskHint(sourceText || '');
  const matchedTask = matchQuickTaskByTitle(hint || sourceText || '');
  NETNET_STATE.flow = {
    currentFlow: 'start_timer',
    slots: {
      taskId: matchedTask ? matchedTask.id : null,
      taskTitle: matchedTask ? matchedTask.title : '',
    },
    awaiting: null,
    sourceText,
    context: {},
  };
  continueStartTimerFlow(msgList);
}

function continueStartTimerFlow(msgList) {
  const slots = NETNET_STATE.flow.slots || {};
  if (!slots.taskId) {
    const options = getQuickTaskOptions();
    if (!options.length) {
      resetFlowState();
      appendNetNetMessage(msgList, 'I could not find any Quick Tasks yet. Create one first, then I can start a timer.');
      return;
    }
    setAwaiting('timer_start_task');
    appendNetNetMessage(msgList, 'Which Quick Task should I start the timer on?', [
      ...options.map((task) => ({
        action: 'timer-start-task',
        value: task.id,
        label: task.title || 'Untitled',
        variant: 'secondary',
        ariaLabel: `Start timer on ${task.title || 'Quick Task'}`,
      })),
      { action: 'timer-start-search', value: 'search', label: 'Search…', variant: 'subtle', ariaLabel: 'Search Quick Tasks' },
    ]);
    return;
  }
  showStartTimerProposal(msgList);
}

function showStartTimerProposal(msgList) {
  clearAwaiting();
  const slots = NETNET_STATE.flow.slots || {};
  const proposal = {
    kind: 'start_timer',
    mode: 'view',
    data: {
      taskId: slots.taskId,
      taskTitle: slots.taskTitle || '',
    },
  };
  appendMessage(msgList, { role: 'netnet', type: 'proposal', proposal });
  NETNET_STATE.flow = { ...NETNET_STATE.flow, currentFlow: 'none', awaiting: null };
  persistThreadState();
}

function startStopTimerFlow(msgList, sourceText) {
  const timer = readTimerState();
  if (!timer.active) {
    resetFlowState();
    appendNetNetMessage(msgList, 'No active timer is running.');
    return;
  }
  const task = getQuickTaskById(timer.taskId);
  if (!task) {
    resetFlowState();
    appendNetNetMessage(msgList, 'Timer control for Job tasks is coming next. For now, I can start a timer on a Quick Task.', [
      { action: 'open-quick-tasks', value: 'open', label: 'Open Quick Tasks', variant: 'secondary', ariaLabel: 'Open Quick Tasks' },
    ]);
    return;
  }
  const elapsedMinutes = computeElapsedMinutes(timer.startedAt);
  const hours = minutesToHours(elapsedMinutes);
  const date = parseDateFromText(sourceText || '');
  NETNET_STATE.flow = {
    currentFlow: 'stop_timer',
    slots: {
      taskId: task.id,
      taskTitle: task.title || '',
      startedAt: timer.startedAt,
      elapsedMinutes,
      hours,
      date: date || '',
    },
    awaiting: null,
    sourceText,
    context: {},
  };
  continueStopTimerFlow(msgList);
}

function continueStopTimerFlow(msgList) {
  const slots = NETNET_STATE.flow.slots || {};
  if (!slots.date) {
    setAwaiting('timer_stop_date');
    appendNetNetMessage(msgList, 'What date should I log this to?', [
      { action: 'timer-stop-date', value: 'today', label: 'Today', variant: 'secondary', ariaLabel: 'Use today' },
      { action: 'timer-stop-date', value: 'yesterday', label: 'Yesterday', variant: 'secondary', ariaLabel: 'Use yesterday' },
      { action: 'timer-stop-date', value: 'pick', label: 'Pick date…', variant: 'subtle', ariaLabel: 'Pick a date' },
    ]);
    return;
  }
  showStopTimerProposal(msgList);
}

function showStopTimerProposal(msgList) {
  clearAwaiting();
  const slots = NETNET_STATE.flow.slots || {};
  const proposal = {
    kind: 'stop_timer',
    mode: 'view',
    data: {
      taskId: slots.taskId,
      taskTitle: slots.taskTitle || '',
      startedAt: slots.startedAt,
      elapsedMinutes: slots.elapsedMinutes,
      hours: slots.hours,
      date: slots.date,
    },
  };
  appendMessage(msgList, { role: 'netnet', type: 'proposal', proposal });
  NETNET_STATE.flow = { ...NETNET_STATE.flow, currentFlow: 'none', awaiting: null };
  persistThreadState();
}

function startSwitchTimerFlow(msgList, sourceText) {
  const timer = readTimerState();
  if (!timer.active) {
    startTimerFlow(msgList, sourceText);
    return;
  }
  const fromTask = getQuickTaskById(timer.taskId);
  if (!fromTask) {
    resetFlowState();
    appendNetNetMessage(msgList, 'Timer control for Job tasks is coming next. For now, I can start a timer on a Quick Task.', [
      { action: 'open-quick-tasks', value: 'open', label: 'Open Quick Tasks', variant: 'secondary', ariaLabel: 'Open Quick Tasks' },
    ]);
    return;
  }
  const hint = extractTimerTaskHint(sourceText || '');
  const matchedTask = matchQuickTaskByTitle(hint || sourceText || '');
  const elapsedMinutes = computeElapsedMinutes(timer.startedAt);
  const hours = minutesToHours(elapsedMinutes);
  const date = parseDateFromText(sourceText || '');
  NETNET_STATE.flow = {
    currentFlow: 'switch_timer',
    slots: {
      fromTaskId: fromTask.id,
      fromTaskTitle: fromTask.title || '',
      toTaskId: matchedTask ? matchedTask.id : null,
      toTaskTitle: matchedTask ? matchedTask.title : '',
      startedAt: timer.startedAt,
      elapsedMinutes,
      hours,
      date: date || '',
    },
    awaiting: null,
    sourceText,
    context: {},
  };
  continueSwitchTimerFlow(msgList);
}

function continueSwitchTimerFlow(msgList) {
  const slots = NETNET_STATE.flow.slots || {};
  if (!slots.toTaskId) {
    const options = getQuickTaskOptions();
    if (!options.length) {
      resetFlowState();
      appendNetNetMessage(msgList, 'I could not find any Quick Tasks yet. Create one first, then I can switch the timer.');
      return;
    }
    setAwaiting('timer_switch_task');
    appendNetNetMessage(msgList, 'Which Quick Task should I switch the timer to?', [
      ...options.map((task) => ({
        action: 'timer-switch-task',
        value: task.id,
        label: task.title || 'Untitled',
        variant: 'secondary',
        ariaLabel: `Switch timer to ${task.title || 'Quick Task'}`,
      })),
      { action: 'timer-switch-search', value: 'search', label: 'Search…', variant: 'subtle', ariaLabel: 'Search Quick Tasks' },
    ]);
    return;
  }
  if (!slots.date) {
    setAwaiting('timer_switch_date');
    appendNetNetMessage(msgList, 'What date should I log the current timer to?', [
      { action: 'timer-switch-date', value: 'today', label: 'Today', variant: 'secondary', ariaLabel: 'Use today' },
      { action: 'timer-switch-date', value: 'yesterday', label: 'Yesterday', variant: 'secondary', ariaLabel: 'Use yesterday' },
      { action: 'timer-switch-date', value: 'pick', label: 'Pick date…', variant: 'subtle', ariaLabel: 'Pick a date' },
    ]);
    return;
  }
  if (String(slots.toTaskId) === String(slots.fromTaskId)) {
    resetFlowState();
    appendNetNetMessage(msgList, 'The timer is already running on that Quick Task.');
    return;
  }
  showSwitchTimerProposal(msgList);
}

function showSwitchTimerProposal(msgList) {
  clearAwaiting();
  const slots = NETNET_STATE.flow.slots || {};
  const proposal = {
    kind: 'switch_timer',
    mode: 'view',
    data: {
      fromTaskId: slots.fromTaskId,
      fromTaskTitle: slots.fromTaskTitle || '',
      toTaskId: slots.toTaskId,
      toTaskTitle: slots.toTaskTitle || '',
      startedAt: slots.startedAt,
      elapsedMinutes: slots.elapsedMinutes,
      hours: slots.hours,
      date: slots.date,
    },
  };
  appendMessage(msgList, { role: 'netnet', type: 'proposal', proposal });
  NETNET_STATE.flow = { ...NETNET_STATE.flow, currentFlow: 'none', awaiting: null };
  persistThreadState();
}

function startQuickTaskFlow(msgList, sourceText, options = {}) {
  const prefill = options.prefill || {};
  const conversion = options.conversion || null;
  const titleCandidate = prefill.title ? '' : extractTitleCandidate(sourceText || '');
  const descriptionCandidate = prefill.description ? '' : extractDescriptionCandidate(sourceText || '', titleCandidate);
  const loeCandidate = parseHoursInput(sourceText || '');
  const dateCandidate = parseDateFromText(sourceText || '');
  const flowKind = options.flowKind || (conversion ? 'convert_list_item' : 'create_quick_task');
  NETNET_STATE.flow = {
    currentFlow: flowKind,
    slots: {
      title: prefill.title || '',
      description: prefill.description || '',
      anchorType: '',
      companyId: null,
      companyName: '',
      personId: null,
      personName: '',
      serviceTypeId: '',
      serviceTypeName: '',
      loeHours: null,
      dueDate: '',
      assigneeUserId: '',
      assigneeName: '',
    },
    awaiting: null,
    sourceText,
    context: {
      titleCandidate,
      titleCandidateAsked: false,
      descriptionCandidate,
      descriptionAsked: !!prefill.description,
      loeCandidate,
      loeCandidateAsked: false,
      dateCandidate,
      dateCandidateAsked: false,
      companyPersonAsked: false,
      companyPersonNeeded: false,
      conversion,
    },
  };
  persistThreadState();
  continueQuickTaskFlow(msgList);
}

function continueQuickTaskFlow(msgList) {
  const slots = NETNET_STATE.flow.slots || {};
  const context = NETNET_STATE.flow.context || {};

  if (!slots.title) {
    if (context.titleCandidate && !context.titleCandidateAsked) {
      context.titleCandidateAsked = true;
      NETNET_STATE.flow.context = context;
      setAwaiting('qt_confirm_title', { candidate: context.titleCandidate });
      appendNetNetMessage(msgList, `Use this as the task title: "${context.titleCandidate}"?`, [
        { action: 'qt-confirm-title', value: 'yes', label: 'Yes', variant: 'primary', ariaLabel: 'Confirm task title' },
        { action: 'qt-confirm-title', value: 'no', label: 'No', variant: 'secondary', ariaLabel: 'Reject task title' },
      ]);
      persistThreadState();
      return;
    }
    setAwaiting('qt_title');
    appendNetNetMessage(msgList, 'What should the Quick Task be called?');
    return;
  }

  if (!slots.anchorType) {
    setAwaiting('qt_anchor_type');
    appendNetNetMessage(msgList, 'Is this Internal work, or for a Client?', [
      { action: 'qt-anchor', value: 'internal', label: 'Internal', variant: 'primary', ariaLabel: 'Internal work' },
      { action: 'qt-anchor', value: 'client', label: 'Client', variant: 'secondary', ariaLabel: 'Client work' },
    ]);
    return;
  }

  if (slots.anchorType === 'client_company' && !slots.companyId) {
    const companies = getCompanyOptions();
    if (!companies.length) {
      resetFlowState();
      appendNetNetMessage(msgList, 'I could not find any client companies yet. Add a company first, then I can create the task.');
      return;
    }
    setAwaiting('qt_company_select');
    appendNetNetMessage(msgList, 'Which company is this for?', [
      ...companies.map((company) => ({
        action: 'qt-company',
        value: company.id,
        label: company.name || 'Company',
        variant: 'secondary',
        ariaLabel: `Select ${company.name || 'company'}`,
      })),
      { action: 'qt-company-search', value: 'search', label: 'Search…', variant: 'subtle', ariaLabel: 'Search companies' },
    ]);
    return;
  }

  if (slots.anchorType === 'client_company' && slots.companyId && !context.companyPersonAsked) {
    context.companyPersonAsked = true;
    NETNET_STATE.flow.context = context;
    setAwaiting('qt_company_person');
    appendNetNetMessage(msgList, `Add a specific person at ${slots.companyName || 'this company'}?`, [
      { action: 'qt-company-person', value: 'yes', label: 'Yes', variant: 'secondary', ariaLabel: 'Add a person' },
      { action: 'qt-company-person', value: 'no', label: 'No', variant: 'subtle', ariaLabel: 'Skip person' },
    ]);
    persistThreadState();
    return;
  }

  if (slots.anchorType === 'client_company' && context.companyPersonNeeded && !slots.personId) {
    const people = getPeopleForCompany(slots.companyId);
    if (!people.length) {
      setAwaiting('qt_person_search');
      appendNetNetMessage(msgList, 'Type the person name.');
      return;
    }
    setAwaiting('qt_person_select');
    appendNetNetMessage(msgList, 'Which person should I attach?', [
      ...people.slice(0, 5).map((person) => ({
        action: 'qt-person',
        value: person.id,
        label: person.name || 'Person',
        variant: 'secondary',
        ariaLabel: `Select ${person.name || 'person'}`,
      })),
      { action: 'qt-person-search', value: 'search', label: 'Search…', variant: 'subtle', ariaLabel: 'Search people' },
    ]);
    return;
  }

  if (slots.anchorType === 'client_person' && !slots.personId) {
    const people = getAllPeople();
    if (!people.length) {
      resetFlowState();
      appendNetNetMessage(msgList, 'I could not find any people in Contacts yet. Add a person first, then I can create the task.');
      return;
    }
    setAwaiting('qt_person_select');
    appendNetNetMessage(msgList, 'Which person is this for?', [
      ...people.slice(0, 5).map((person) => ({
        action: 'qt-person',
        value: person.id,
        label: person.companyName ? `${person.name} (${person.companyName})` : person.name,
        variant: 'secondary',
        ariaLabel: `Select ${person.name || 'person'}`,
      })),
      { action: 'qt-person-search', value: 'search', label: 'Search…', variant: 'subtle', ariaLabel: 'Search people' },
    ]);
    return;
  }

  if (!slots.serviceTypeId) {
    const serviceTypes = getServiceTypeOptions();
    if (!serviceTypes.length) {
      resetFlowState();
      appendNetNetMessage(msgList, 'I could not find any Service Types yet. Add one in Settings, then I can create the task.');
      return;
    }
    setAwaiting('qt_service_type');
    appendNetNetMessage(msgList, 'Which Service Type should I use?', [
      ...serviceTypes.map((type) => ({
        action: 'qt-service-type',
        value: type.id,
        label: type.name || 'Service Type',
        variant: 'secondary',
        ariaLabel: `Select ${type.name || 'service type'}`,
      })),
      { action: 'qt-service-type-search', value: 'search', label: 'Search…', variant: 'subtle', ariaLabel: 'Search Service Types' },
    ]);
    return;
  }

  if (!slots.loeHours) {
    if (context.loeCandidate && !context.loeCandidateAsked) {
      context.loeCandidateAsked = true;
      NETNET_STATE.flow.context = context;
      setAwaiting('qt_confirm_loe', { candidate: context.loeCandidate });
      appendNetNetMessage(msgList, `Use ${context.loeCandidate} hours for LOE?`, [
        { action: 'qt-confirm-loe', value: 'yes', label: 'Yes', variant: 'primary', ariaLabel: 'Confirm LOE' },
        { action: 'qt-confirm-loe', value: 'no', label: 'No', variant: 'secondary', ariaLabel: 'Reject LOE' },
      ]);
      persistThreadState();
      return;
    }
    setAwaiting('qt_loe');
    appendNetNetMessage(msgList, 'How many hours should I estimate (LOE)?');
    return;
  }

  if (!slots.dueDate) {
    if (context.dateCandidate && !context.dateCandidateAsked) {
      context.dateCandidateAsked = true;
      NETNET_STATE.flow.context = context;
      setAwaiting('qt_confirm_due', { candidate: context.dateCandidate });
      appendNetNetMessage(msgList, `Use ${formatDateLabel(context.dateCandidate)} as the due date?`, [
        { action: 'qt-confirm-due', value: 'yes', label: 'Yes', variant: 'primary', ariaLabel: 'Confirm due date' },
        { action: 'qt-confirm-due', value: 'no', label: 'No', variant: 'secondary', ariaLabel: 'Reject due date' },
      ]);
      persistThreadState();
      return;
    }
    setAwaiting('qt_due_date');
    appendNetNetMessage(msgList, 'What is the due date?', [
      { action: 'qt-due-date', value: 'today', label: 'Today', variant: 'secondary', ariaLabel: 'Use today' },
      { action: 'qt-due-date', value: 'tomorrow', label: 'Tomorrow', variant: 'secondary', ariaLabel: 'Use tomorrow' },
      { action: 'qt-due-date', value: 'pick', label: 'Pick date…', variant: 'subtle', ariaLabel: 'Pick a date' },
    ]);
    return;
  }

  if (!slots.assigneeUserId) {
    const members = getAssigneeOptions();
    if (!members.length) {
      resetFlowState();
      appendNetNetMessage(msgList, 'I could not find any team members yet. Add one first, then I can create the task.');
      return;
    }
    const currentUser = getCurrentUser(members);
    const actions = [];
    if (currentUser?.id) {
      actions.push({
        action: 'qt-assignee',
        value: currentUser.id,
        label: `Assign to me (${currentUser.name || 'Me'})`,
        variant: 'primary',
        ariaLabel: `Assign to ${currentUser.name || 'me'}`,
      });
    }
    actions.push(
      ...members.map((member) => ({
        action: 'qt-assignee',
        value: member.id,
        label: member.name || member.email || 'Team member',
        variant: 'secondary',
        ariaLabel: `Assign to ${member.name || 'team member'}`,
      })),
    );
    actions.push({
      action: 'qt-assignee-search',
      value: 'search',
      label: 'Search…',
      variant: 'subtle',
      ariaLabel: 'Search team members',
    });
    setAwaiting('qt_assignee');
    appendNetNetMessage(msgList, 'Who should I assign this to?', actions);
    return;
  }

  if (!context.descriptionAsked) {
    context.descriptionAsked = true;
    NETNET_STATE.flow.context = context;
    if (context.descriptionCandidate) {
      setAwaiting('qt_confirm_description', { candidate: context.descriptionCandidate });
      appendNetNetMessage(msgList, 'Use the extra details as the description?', [
        { action: 'qt-confirm-description', value: 'yes', label: 'Yes', variant: 'secondary', ariaLabel: 'Use description' },
        { action: 'qt-confirm-description', value: 'no', label: 'No', variant: 'subtle', ariaLabel: 'Skip description' },
      ]);
    } else {
      setAwaiting('qt_description_choice');
      appendNetNetMessage(msgList, 'Add a description?', [
        { action: 'qt-description-choice', value: 'yes', label: 'Yes', variant: 'secondary', ariaLabel: 'Add description' },
        { action: 'qt-description-choice', value: 'no', label: 'No', variant: 'subtle', ariaLabel: 'Skip description' },
      ]);
    }
    persistThreadState();
    return;
  }

  showQuickTaskProposal(msgList);
}

function showQuickTaskProposal(msgList) {
  clearAwaiting();
  const slots = NETNET_STATE.flow.slots || {};
  const conversion = NETNET_STATE.flow.context?.conversion || null;
  const sourceItem = conversion?.sourceItem || null;
  const removeSource = conversion?.removeSource || false;
  const serviceTypeName = slots.serviceTypeName || getServiceTypeById(slots.serviceTypeId)?.name || '';
  const assigneeName = slots.assigneeName || getMemberById(slots.assigneeUserId)?.name || '';
  const proposal = {
    kind: conversion ? 'convert_list_item' : 'create_quick_task',
    mode: 'view',
    data: {
      title: slots.title,
      description: slots.description || '',
      anchorType: slots.anchorType,
      companyId: slots.companyId || null,
      companyName: slots.companyName || '',
      personId: slots.personId || null,
      personName: slots.personName || '',
      serviceTypeId: slots.serviceTypeId,
      serviceTypeName,
      loeHours: slots.loeHours,
      dueDate: slots.dueDate,
      assigneeUserId: slots.assigneeUserId,
      assigneeName,
      sourceItemId: sourceItem?.id || null,
      sourceItemTitle: sourceItem?.title || '',
      sourceItemNotes: sourceItem?.notes || '',
      sourceItemFolderId: sourceItem?.folderId ?? null,
      removeSource: !!removeSource,
    },
  };
  appendMessage(msgList, { role: 'netnet', type: 'proposal', proposal });
  NETNET_STATE.flow = { ...NETNET_STATE.flow, currentFlow: 'none', awaiting: null };
  persistThreadState();
}

function askTaskTypeClarification(msgList, text) {
  NETNET_STATE.flow = {
    currentFlow: 'clarify_task_type',
    slots: {},
    awaiting: null,
    sourceText: text,
    context: {},
  };
  setAwaiting('task_type_choice');
  appendNetNetMessage(msgList, 'Is this a Quick Task (standalone) or a Job Task (inside a job)?', [
    { action: 'task-type', value: 'quick', label: 'Quick Task', variant: 'primary', ariaLabel: 'Choose Quick Task' },
    { action: 'task-type', value: 'job', label: 'Job Task', variant: 'secondary', ariaLabel: 'Choose Job Task' },
    { action: 'task-type', value: 'list', label: 'My Lists', variant: 'secondary', ariaLabel: 'Choose My Lists' },
  ]);
}

function startJobTaskFlow(msgList, sourceText) {
  const jobs = Array.isArray(performanceJobs) ? performanceJobs : [];
  const deliverables = Array.isArray(performanceDeliverables) ? performanceDeliverables : [];
  if (!jobs.length || !deliverables.length) {
    resetFlowState();
    appendNetNetMessage(msgList, 'I couldn’t load Jobs right now. Please try again.');
    return;
  }
  const titleCandidate = extractTitleCandidate(sourceText || '');
  const descriptionCandidate = extractDescriptionCandidate(sourceText || '', titleCandidate);
  const jobCandidate = matchJobByName(sourceText || '');
  const deliverableCandidate = jobCandidate ? matchDeliverableByName(sourceText || '', jobCandidate.id) : null;
  const loeCandidate = parseHoursInput(sourceText || '');
  const dateCandidate = parseDateFromText(sourceText || '');
  NETNET_STATE.flow = {
    currentFlow: 'create_job_task',
    slots: {
      title: '',
      description: '',
      jobId: '',
      jobName: '',
      deliverableId: '',
      deliverableName: '',
      serviceTypeId: '',
      serviceTypeName: '',
      loeHours: null,
      dueDate: '',
      assigneeUserId: '',
      assigneeName: '',
    },
    awaiting: null,
    sourceText,
    context: {
      titleCandidate,
      titleCandidateAsked: false,
      descriptionCandidate,
      descriptionAsked: false,
      jobCandidate,
      jobCandidateAsked: false,
      loeCandidate,
      loeCandidateAsked: false,
      dateCandidate,
      dateCandidateAsked: false,
      deliverableCandidate,
      deliverableCandidateAsked: false,
    },
  };
  persistThreadState();
  continueJobTaskFlow(msgList);
}

function continueJobTaskFlow(msgList) {
  const slots = NETNET_STATE.flow.slots || {};
  const context = NETNET_STATE.flow.context || {};

  if (!slots.title) {
    if (context.titleCandidate && !context.titleCandidateAsked) {
      context.titleCandidateAsked = true;
      NETNET_STATE.flow.context = context;
      setAwaiting('jt_confirm_title', { candidate: context.titleCandidate });
      appendNetNetMessage(msgList, `Use this as the task title: "${context.titleCandidate}"?`, [
        { action: 'jt-confirm-title', value: 'yes', label: 'Yes', variant: 'primary', ariaLabel: 'Confirm task title' },
        { action: 'jt-confirm-title', value: 'no', label: 'No', variant: 'secondary', ariaLabel: 'Reject task title' },
      ]);
      persistThreadState();
      return;
    }
    setAwaiting('jt_title');
    appendNetNetMessage(msgList, 'What should the Job Task be called?');
    return;
  }

  if (!slots.jobId) {
    if (context.jobCandidate && !context.jobCandidateAsked) {
      context.jobCandidateAsked = true;
      NETNET_STATE.flow.context = context;
      setAwaiting('jt_confirm_job', { candidate: context.jobCandidate });
      appendNetNetMessage(msgList, `Use "${context.jobCandidate.name || 'this job'}" as the job?`, [
        { action: 'jt-confirm-job', value: 'yes', label: 'Yes', variant: 'primary', ariaLabel: 'Confirm job' },
        { action: 'jt-confirm-job', value: 'no', label: 'No', variant: 'secondary', ariaLabel: 'Reject job' },
      ]);
      persistThreadState();
      return;
    }
    const jobs = getJobOptions();
    setAwaiting('jt_job_select');
    appendNetNetMessage(msgList, 'Which job?', [
      ...jobs.map((job) => ({
        action: 'jt-job',
        value: job.id,
        label: job.name || 'Job',
        variant: 'secondary',
        ariaLabel: `Select ${job.name || 'job'}`,
      })),
      { action: 'jt-job-search', value: 'search', label: 'Search…', variant: 'subtle', ariaLabel: 'Search jobs' },
    ]);
    return;
  }

  if (!slots.deliverableId) {
    const deliverables = getDeliverablesForJob(slots.jobId);
    if (!deliverables.length) {
      resetFlowState();
      appendNetNetMessage(msgList, 'That job doesn’t have any deliverables yet. Job Tasks require a deliverable.', [
        { action: 'capture-my-lists', value: 'capture', label: 'Capture in My Lists instead', variant: 'primary', ariaLabel: 'Capture in My Lists instead' },
        { action: 'cancel-flow', value: 'cancel', label: 'Cancel', variant: 'secondary', ariaLabel: 'Cancel' },
      ]);
      return;
    }
    if (!context.deliverableCandidate && NETNET_STATE.flow.sourceText) {
      context.deliverableCandidate = matchDeliverableByName(NETNET_STATE.flow.sourceText, slots.jobId);
      NETNET_STATE.flow.context = context;
    }
    if (context.deliverableCandidate && !context.deliverableCandidateAsked) {
      context.deliverableCandidateAsked = true;
      NETNET_STATE.flow.context = context;
      setAwaiting('jt_confirm_deliverable', { candidate: context.deliverableCandidate });
      appendNetNetMessage(msgList, `Use "${context.deliverableCandidate.name || 'this deliverable'}"?`, [
        { action: 'jt-confirm-deliverable', value: 'yes', label: 'Yes', variant: 'primary', ariaLabel: 'Confirm deliverable' },
        { action: 'jt-confirm-deliverable', value: 'no', label: 'No', variant: 'secondary', ariaLabel: 'Reject deliverable' },
      ]);
      persistThreadState();
      return;
    }
    setAwaiting('jt_deliverable_select');
    appendNetNetMessage(msgList, 'Which deliverable should this task live under?', [
      ...deliverables.slice(0, 5).map((del) => ({
        action: 'jt-deliverable',
        value: del.id,
        label: del.name || 'Deliverable',
        variant: 'secondary',
        ariaLabel: `Select ${del.name || 'deliverable'}`,
      })),
      { action: 'jt-deliverable-search', value: 'search', label: 'Search…', variant: 'subtle', ariaLabel: 'Search deliverables' },
    ]);
    return;
  }

  if (!slots.serviceTypeId) {
    const serviceTypes = getServiceTypeOptions();
    if (!serviceTypes.length) {
      resetFlowState();
      appendNetNetMessage(msgList, 'I could not find any Service Types yet. Add one in Settings, then I can create the task.');
      return;
    }
    setAwaiting('jt_service_type');
    appendNetNetMessage(msgList, 'Which Service Type should I use?', [
      ...serviceTypes.map((type) => ({
        action: 'jt-service-type',
        value: type.id,
        label: type.name || 'Service Type',
        variant: 'secondary',
        ariaLabel: `Select ${type.name || 'service type'}`,
      })),
      { action: 'jt-service-type-search', value: 'search', label: 'Search…', variant: 'subtle', ariaLabel: 'Search Service Types' },
    ]);
    return;
  }

  if (!slots.loeHours) {
    if (context.loeCandidate && !context.loeCandidateAsked) {
      context.loeCandidateAsked = true;
      NETNET_STATE.flow.context = context;
      setAwaiting('jt_confirm_loe', { candidate: context.loeCandidate });
      appendNetNetMessage(msgList, `Use ${context.loeCandidate} hours for LOE?`, [
        { action: 'jt-confirm-loe', value: 'yes', label: 'Yes', variant: 'primary', ariaLabel: 'Confirm LOE' },
        { action: 'jt-confirm-loe', value: 'no', label: 'No', variant: 'secondary', ariaLabel: 'Reject LOE' },
      ]);
      persistThreadState();
      return;
    }
    setAwaiting('jt_loe');
    appendNetNetMessage(msgList, 'How many hours should I estimate (LOE)?');
    return;
  }

  if (!slots.dueDate) {
    if (context.dateCandidate && !context.dateCandidateAsked) {
      context.dateCandidateAsked = true;
      NETNET_STATE.flow.context = context;
      setAwaiting('jt_confirm_due', { candidate: context.dateCandidate });
      appendNetNetMessage(msgList, `Use ${formatDateLabel(context.dateCandidate)} as the due date?`, [
        { action: 'jt-confirm-due', value: 'yes', label: 'Yes', variant: 'primary', ariaLabel: 'Confirm due date' },
        { action: 'jt-confirm-due', value: 'no', label: 'No', variant: 'secondary', ariaLabel: 'Reject due date' },
      ]);
      persistThreadState();
      return;
    }
    setAwaiting('jt_due_date');
    appendNetNetMessage(msgList, 'What is the due date?', [
      { action: 'jt-due-date', value: 'today', label: 'Today', variant: 'secondary', ariaLabel: 'Use today' },
      { action: 'jt-due-date', value: 'tomorrow', label: 'Tomorrow', variant: 'secondary', ariaLabel: 'Use tomorrow' },
      { action: 'jt-due-date', value: 'pick', label: 'Pick date…', variant: 'subtle', ariaLabel: 'Pick a date' },
    ]);
    return;
  }

  if (!slots.assigneeUserId) {
    const members = getAssigneeOptions();
    if (!members.length) {
      resetFlowState();
      appendNetNetMessage(msgList, 'I could not find any team members yet. Add one first, then I can create the task.');
      return;
    }
    const currentUser = getCurrentUser(members);
    const actions = [];
    if (currentUser?.id) {
      actions.push({
        action: 'jt-assignee',
        value: currentUser.id,
        label: `Assign to me (${currentUser.name || 'Me'})`,
        variant: 'primary',
        ariaLabel: `Assign to ${currentUser.name || 'me'}`,
      });
    }
    actions.push(
      ...members.map((member) => ({
        action: 'jt-assignee',
        value: member.id,
        label: member.name || member.email || 'Team member',
        variant: 'secondary',
        ariaLabel: `Assign to ${member.name || 'team member'}`,
      })),
    );
    actions.push({
      action: 'jt-assignee-search',
      value: 'search',
      label: 'Search…',
      variant: 'subtle',
      ariaLabel: 'Search team members',
    });
    setAwaiting('jt_assignee');
    appendNetNetMessage(msgList, 'Who should I assign this to?', actions);
    return;
  }

  if (!context.descriptionAsked) {
    context.descriptionAsked = true;
    NETNET_STATE.flow.context = context;
    if (context.descriptionCandidate) {
      setAwaiting('jt_confirm_description', { candidate: context.descriptionCandidate });
      appendNetNetMessage(msgList, 'Use the extra details as the description?', [
        { action: 'jt-confirm-description', value: 'yes', label: 'Yes', variant: 'secondary', ariaLabel: 'Use description' },
        { action: 'jt-confirm-description', value: 'no', label: 'No', variant: 'subtle', ariaLabel: 'Skip description' },
      ]);
    } else {
      setAwaiting('jt_description_choice');
      appendNetNetMessage(msgList, 'Add a description?', [
        { action: 'jt-description-choice', value: 'yes', label: 'Yes', variant: 'secondary', ariaLabel: 'Add description' },
        { action: 'jt-description-choice', value: 'no', label: 'No', variant: 'subtle', ariaLabel: 'Skip description' },
      ]);
    }
    persistThreadState();
    return;
  }

  showJobTaskProposal(msgList);
}

function showJobTaskProposal(msgList) {
  clearAwaiting();
  const slots = NETNET_STATE.flow.slots || {};
  const job = findJobById(slots.jobId);
  const deliverable = findDeliverableById(slots.deliverableId);
  const serviceTypeName = slots.serviceTypeName || getServiceTypeById(slots.serviceTypeId)?.name || '';
  const assigneeName = slots.assigneeName || getMemberById(slots.assigneeUserId)?.name || '';
  const proposal = {
    kind: 'create_job_task',
    mode: 'view',
    data: {
      title: slots.title,
      description: slots.description || '',
      jobId: slots.jobId,
      jobName: slots.jobName || job?.name || '',
      deliverableId: slots.deliverableId,
      deliverableName: slots.deliverableName || deliverable?.name || '',
      serviceTypeId: slots.serviceTypeId,
      serviceTypeName,
      loeHours: slots.loeHours,
      dueDate: slots.dueDate,
      assigneeUserId: slots.assigneeUserId,
      assigneeName,
    },
  };
  appendMessage(msgList, { role: 'netnet', type: 'proposal', proposal });
  NETNET_STATE.flow = { ...NETNET_STATE.flow, currentFlow: 'none', awaiting: null };
  persistThreadState();
}

function offerCaptureInstead(msgList, message = 'Capture in My Lists instead?') {
  const sourceText = NETNET_STATE.flow.sourceText || '';
  resetFlowState();
  NETNET_STATE.flow.sourceText = sourceText;
  setAwaiting('capture_instead');
  appendNetNetMessage(msgList, message, [
    { action: 'capture-my-lists', value: 'capture', label: 'Capture in My Lists', variant: 'primary', ariaLabel: 'Capture in My Lists' },
    { action: 'cancel-flow', value: 'cancel', label: 'Cancel', variant: 'secondary', ariaLabel: 'Cancel' },
  ]);
}

function handleIntentChoice(msgList, choice) {
  const sourceText = NETNET_STATE.flow.sourceText || '';
  if (choice === 'task') {
    askTaskTypeClarification(msgList, sourceText);
    return;
  }
  startMyListsFlow(msgList, sourceText);
}

function handleAwaitingResponse(msgList, text) {
  const awaiting = NETNET_STATE.flow.awaiting;
  if (!awaiting) return false;
  const lowered = normalizeText(text);
  if (lowered === 'cancel') {
    cancelFlow(msgList);
    return true;
  }

  switch (awaiting.type) {
    case 'intent_choice': {
      if (lowered.includes('list')) {
        handleIntentChoice(msgList, 'my_lists');
        return true;
      }
      if (lowered.includes('task')) {
        handleIntentChoice(msgList, 'task');
        return true;
      }
      appendNetNetMessage(msgList, 'Please choose My Lists or Task.');
      return true;
    }
    case 'task_type_choice': {
      if (lowered.includes('quick')) {
        startQuickTaskFlow(msgList, NETNET_STATE.flow.sourceText || '');
        return true;
      }
      if (lowered.includes('job')) {
        startJobTaskFlow(msgList, NETNET_STATE.flow.sourceText || '');
        return true;
      }
      if (lowered.includes('list')) {
        startMyListsFlow(msgList, NETNET_STATE.flow.sourceText || '');
        return true;
      }
      appendNetNetMessage(msgList, 'Please choose Quick Task, Job Task, or My Lists.');
      return true;
    }
    case 'capture_instead': {
      const decision = parseYesNo(text);
      if (decision === null) {
        appendNetNetMessage(msgList, 'Please reply Yes or No.');
        return true;
      }
      if (decision) {
        startMyListsFlow(msgList, NETNET_STATE.flow.sourceText || '');
      } else {
        cancelFlow(msgList);
      }
      return true;
    }
    case 'confirm_title': {
      const decision = parseYesNo(text);
      if (decision === null) {
        appendNetNetMessage(msgList, 'Please reply Yes or No.');
        return true;
      }
      if (decision) {
        NETNET_STATE.flow.slots.title = awaiting.candidate || '';
        clearAwaiting();
        const notesCandidate = NETNET_STATE.flow.context?.notesCandidate || '';
        askNotesConfirmation(msgList, notesCandidate);
      } else {
        setAwaiting('list_title');
        appendNetNetMessage(msgList, 'Okay. What should the list item title be?');
      }
      return true;
    }
    case 'list_title': {
      const title = String(text || '').trim();
      if (!title) {
        appendNetNetMessage(msgList, 'Please share a title for the list item.');
        return true;
      }
      NETNET_STATE.flow.slots.title = title;
      clearAwaiting();
      const notesCandidate = NETNET_STATE.flow.context?.notesCandidate || '';
      askNotesConfirmation(msgList, notesCandidate);
      return true;
    }
    case 'confirm_notes': {
      const decision = parseYesNo(text);
      if (decision === null) {
        appendNetNetMessage(msgList, 'Please reply Yes or No.');
        return true;
      }
      if (decision) {
        NETNET_STATE.flow.slots.notes = awaiting.candidate || '';
      }
      clearAwaiting();
      showListProposal(msgList);
      return true;
    }
    case 'convert_intent_confirm': {
      const decision = parseYesNo(text);
      if (decision === null) {
        appendNetNetMessage(msgList, 'Please reply Yes or No.');
        return true;
      }
      if (decision) {
        startConvertListItemFlow(msgList, NETNET_STATE.flow.sourceText || '');
      } else {
        cancelFlow(msgList);
      }
      return true;
    }
    case 'convert_list_item_choice':
    case 'convert_list_item_search': {
      const items = loadMyListItems().filter((item) => item && !item.isArchived);
      const matches = matchMyListItemsByTitle(text, items);
      if (!matches.length) {
        appendNetNetMessage(msgList, 'I couldn’t find that list item. Want to pick one?', [
          ...getMyListOptions().map((item) => ({
            action: 'convert-list-item',
            value: item.id,
            label: item.title || 'Untitled',
            variant: 'secondary',
            ariaLabel: `Select ${item.title || 'list item'}`,
          })),
          { action: 'convert-list-search', value: 'search', label: 'Search…', variant: 'subtle', ariaLabel: 'Search list items' },
        ]);
        return true;
      }
      if (matches.length > 1) {
        setAwaiting('convert_list_item_choice');
        appendNetNetMessage(msgList, 'Which list item do you want to convert?', matches.slice(0, 5).map((item) => ({
          action: 'convert-list-item',
          value: item.id,
          label: item.title || 'Untitled',
          variant: 'secondary',
          ariaLabel: `Select ${item.title || 'list item'}`,
        })));
        return true;
      }
      askConvertKeepRemove(msgList, matches[0]);
      return true;
    }
    case 'convert_keep_choice': {
      const lowered = normalizeText(text);
      if (lowered.includes('keep')) {
        beginConvertToQuickTask(msgList, false);
        return true;
      }
      if (lowered.includes('remove') || lowered.includes('delete')) {
        beginConvertToQuickTask(msgList, true);
        return true;
      }
      appendNetNetMessage(msgList, 'Please choose Keep list item or Remove list item.');
      return true;
    }
    case 'timer_start_task':
    case 'timer_start_search': {
      const match = matchQuickTaskByTitle(text);
      if (!match) {
        appendNetNetMessage(msgList, 'I could not find that Quick Task. Pick one from the list or try another name.');
        return true;
      }
      NETNET_STATE.flow.slots.taskId = match.id;
      NETNET_STATE.flow.slots.taskTitle = match.title || '';
      clearAwaiting();
      continueStartTimerFlow(msgList);
      return true;
    }
    case 'timer_stop_date':
    case 'timer_stop_date_manual': {
      const date = parseDateFromText(text);
      if (!date) {
        appendNetNetMessage(msgList, 'Please share a date like Today, Yesterday, or 2026-01-18.');
        return true;
      }
      NETNET_STATE.flow.slots.date = date;
      clearAwaiting();
      continueStopTimerFlow(msgList);
      return true;
    }
    case 'timer_switch_task':
    case 'timer_switch_search': {
      const match = matchQuickTaskByTitle(text);
      if (!match) {
        appendNetNetMessage(msgList, 'I could not find that Quick Task. Pick one from the list or try another name.');
        return true;
      }
      NETNET_STATE.flow.slots.toTaskId = match.id;
      NETNET_STATE.flow.slots.toTaskTitle = match.title || '';
      clearAwaiting();
      continueSwitchTimerFlow(msgList);
      return true;
    }
    case 'timer_switch_date':
    case 'timer_switch_date_manual': {
      const date = parseDateFromText(text);
      if (!date) {
        appendNetNetMessage(msgList, 'Please share a date like Today, Yesterday, or 2026-01-18.');
        return true;
      }
      NETNET_STATE.flow.slots.date = date;
      clearAwaiting();
      continueSwitchTimerFlow(msgList);
      return true;
    }
    case 'qt_confirm_title': {
      const decision = parseYesNo(text);
      if (decision === null) {
        appendNetNetMessage(msgList, 'Please reply Yes or No.');
        return true;
      }
      if (decision) {
        NETNET_STATE.flow.slots.title = awaiting.candidate || '';
        clearAwaiting();
        continueQuickTaskFlow(msgList);
      } else {
        setAwaiting('qt_title');
        appendNetNetMessage(msgList, 'Okay. What should the Quick Task be called?');
      }
      return true;
    }
    case 'qt_title': {
      if (isRefusalText(text)) {
        offerCaptureInstead(msgList, 'I need a title to create a task. Capture in My Lists instead?');
        return true;
      }
      const title = String(text || '').trim();
      if (!title) {
        appendNetNetMessage(msgList, 'Please share a task title.');
        return true;
      }
      NETNET_STATE.flow.slots.title = title;
      clearAwaiting();
      continueQuickTaskFlow(msgList);
      return true;
    }
    case 'qt_anchor_type': {
      if (isRefusalText(text)) {
        offerCaptureInstead(msgList, 'I need to know if this is Internal or Client work. Capture in My Lists instead?');
        return true;
      }
      if (lowered.includes('internal')) {
        NETNET_STATE.flow.slots.anchorType = 'internal';
        NETNET_STATE.flow.slots.companyId = null;
        NETNET_STATE.flow.slots.companyName = '';
        NETNET_STATE.flow.slots.personId = null;
        NETNET_STATE.flow.slots.personName = '';
        clearAwaiting();
        continueQuickTaskFlow(msgList);
        return true;
      }
      if (lowered.includes('client')) {
        clearAwaiting();
        setAwaiting('qt_client_type');
        appendNetNetMessage(msgList, 'Company or Person?', [
          { action: 'qt-client-type', value: 'company', label: 'Company', variant: 'secondary', ariaLabel: 'Client company' },
          { action: 'qt-client-type', value: 'person', label: 'Person', variant: 'secondary', ariaLabel: 'Client person' },
        ]);
        return true;
      }
      appendNetNetMessage(msgList, 'Please choose Internal or Client.');
      return true;
    }
    case 'qt_client_type': {
      if (isRefusalText(text)) {
        offerCaptureInstead(msgList, 'I need a client type to create this task. Capture in My Lists instead?');
        return true;
      }
      if (lowered.includes('company')) {
        NETNET_STATE.flow.slots.anchorType = 'client_company';
        NETNET_STATE.flow.slots.companyId = null;
        NETNET_STATE.flow.slots.companyName = '';
        NETNET_STATE.flow.slots.personId = null;
        NETNET_STATE.flow.slots.personName = '';
        clearAwaiting();
        continueQuickTaskFlow(msgList);
        return true;
      }
      if (lowered.includes('person')) {
        NETNET_STATE.flow.slots.anchorType = 'client_person';
        NETNET_STATE.flow.slots.companyId = null;
        NETNET_STATE.flow.slots.companyName = '';
        NETNET_STATE.flow.slots.personId = null;
        NETNET_STATE.flow.slots.personName = '';
        clearAwaiting();
        continueQuickTaskFlow(msgList);
        return true;
      }
      appendNetNetMessage(msgList, 'Please choose Company or Person.');
      return true;
    }
    case 'qt_company_select':
    case 'qt_company_search': {
      if (isRefusalText(text)) {
        offerCaptureInstead(msgList, 'I need a client company to create this task. Capture in My Lists instead?');
        return true;
      }
      const matches = findCompaniesByName(text);
      if (!matches.length) {
        appendNetNetMessage(msgList, 'I could not find that company. Try another name.');
        return true;
      }
      if (matches.length === 1) {
        const match = matches[0];
        NETNET_STATE.flow.slots.companyId = match.id;
        NETNET_STATE.flow.slots.companyName = match.name || '';
        NETNET_STATE.flow.context.companyPersonAsked = false;
        NETNET_STATE.flow.context.companyPersonNeeded = false;
        clearAwaiting();
        continueQuickTaskFlow(msgList);
        return true;
      }
      setAwaiting('qt_company_select');
      appendNetNetMessage(msgList, 'Select the company.', matches.slice(0, 5).map((company) => ({
        action: 'qt-company',
        value: company.id,
        label: company.name || 'Company',
        variant: 'secondary',
        ariaLabel: `Select ${company.name || 'company'}`,
      })));
      return true;
    }
    case 'qt_person_select':
    case 'qt_person_search': {
      if (isRefusalText(text)) {
        offerCaptureInstead(msgList, 'I need a client person to create this task. Capture in My Lists instead?');
        return true;
      }
      const companyId = NETNET_STATE.flow.slots.companyId || null;
      const matches = findPeopleByName(text, companyId);
      if (!matches.length) {
        appendNetNetMessage(msgList, 'I could not find that person. Try another name.');
        return true;
      }
      if (matches.length === 1) {
        const match = matches[0];
        NETNET_STATE.flow.slots.personId = match.id;
        NETNET_STATE.flow.slots.personName = match.name || '';
        if (match.companyId) {
          NETNET_STATE.flow.slots.companyId = match.companyId;
          NETNET_STATE.flow.slots.companyName = match.companyName || '';
        }
        clearAwaiting();
        continueQuickTaskFlow(msgList);
        return true;
      }
      setAwaiting('qt_person_select');
      appendNetNetMessage(msgList, 'Select the person.', matches.slice(0, 5).map((person) => ({
        action: 'qt-person',
        value: person.id,
        label: person.companyName ? `${person.name} (${person.companyName})` : person.name,
        variant: 'secondary',
        ariaLabel: `Select ${person.name || 'person'}`,
      })));
      return true;
    }
    case 'qt_service_type':
    case 'qt_service_type_search': {
      if (isRefusalText(text)) {
        offerCaptureInstead(msgList, 'I need a Service Type to create this task. Capture in My Lists instead?');
        return true;
      }
      const matches = findServiceTypesByName(text);
      if (!matches.length) {
        appendNetNetMessage(msgList, 'I could not find that Service Type. Try another name.');
        return true;
      }
      if (matches.length === 1) {
        const match = matches[0];
        NETNET_STATE.flow.slots.serviceTypeId = match.id;
        NETNET_STATE.flow.slots.serviceTypeName = match.name || '';
        clearAwaiting();
        continueQuickTaskFlow(msgList);
        return true;
      }
      setAwaiting('qt_service_type');
      appendNetNetMessage(msgList, 'Select the Service Type.', matches.slice(0, 5).map((type) => ({
        action: 'qt-service-type',
        value: type.id,
        label: type.name || 'Service Type',
        variant: 'secondary',
        ariaLabel: `Select ${type.name || 'service type'}`,
      })));
      return true;
    }
    case 'qt_assignee':
    case 'qt_assignee_search': {
      if (isRefusalText(text)) {
        offerCaptureInstead(msgList, 'I need an assignee to create this task. Capture in My Lists instead?');
        return true;
      }
      const matches = findMembersByName(text);
      if (!matches.length) {
        appendNetNetMessage(msgList, 'I could not find that team member. Try another name.');
        return true;
      }
      if (matches.length === 1) {
        const match = matches[0];
        NETNET_STATE.flow.slots.assigneeUserId = match.id;
        NETNET_STATE.flow.slots.assigneeName = match.name || '';
        clearAwaiting();
        continueQuickTaskFlow(msgList);
        return true;
      }
      setAwaiting('qt_assignee');
      appendNetNetMessage(msgList, 'Select the assignee.', matches.slice(0, 5).map((member) => ({
        action: 'qt-assignee',
        value: member.id,
        label: member.name || member.email || 'Team member',
        variant: 'secondary',
        ariaLabel: `Assign to ${member.name || 'team member'}`,
      })));
      return true;
    }
    case 'qt_company_person': {
      const decision = parseYesNo(text);
      if (decision === null) {
        appendNetNetMessage(msgList, 'Please reply Yes or No.');
        return true;
      }
      NETNET_STATE.flow.context.companyPersonNeeded = decision;
      clearAwaiting();
      continueQuickTaskFlow(msgList);
      return true;
    }
    case 'qt_confirm_loe': {
      const decision = parseYesNo(text);
      if (decision === null) {
        appendNetNetMessage(msgList, 'Please reply Yes or No.');
        return true;
      }
      if (decision) {
        NETNET_STATE.flow.slots.loeHours = awaiting.candidate || null;
        clearAwaiting();
        continueQuickTaskFlow(msgList);
      } else {
        setAwaiting('qt_loe');
        appendNetNetMessage(msgList, 'Okay. How many hours should I estimate (LOE)?');
      }
      return true;
    }
    case 'qt_loe': {
      if (isRefusalText(text)) {
        offerCaptureInstead(msgList, 'I need LOE hours to create a task. Capture in My Lists instead?');
        return true;
      }
      const hours = parseHoursInput(text);
      if (!hours) {
        appendNetNetMessage(msgList, 'Please share the LOE as hours (e.g. 1.5) or minutes (e.g. 90m).');
        return true;
      }
      NETNET_STATE.flow.slots.loeHours = hours;
      clearAwaiting();
      continueQuickTaskFlow(msgList);
      return true;
    }
    case 'qt_confirm_due': {
      const decision = parseYesNo(text);
      if (decision === null) {
        appendNetNetMessage(msgList, 'Please reply Yes or No.');
        return true;
      }
      if (decision) {
        NETNET_STATE.flow.slots.dueDate = awaiting.candidate || '';
        clearAwaiting();
        continueQuickTaskFlow(msgList);
      } else {
        setAwaiting('qt_due_date');
        appendNetNetMessage(msgList, 'What is the due date?', [
          { action: 'qt-due-date', value: 'today', label: 'Today', variant: 'secondary', ariaLabel: 'Use today' },
          { action: 'qt-due-date', value: 'tomorrow', label: 'Tomorrow', variant: 'secondary', ariaLabel: 'Use tomorrow' },
          { action: 'qt-due-date', value: 'pick', label: 'Pick date…', variant: 'subtle', ariaLabel: 'Pick a date' },
        ]);
      }
      return true;
    }
    case 'qt_due_date':
    case 'qt_due_date_manual': {
      if (isRefusalText(text)) {
        offerCaptureInstead(msgList, 'I need a due date to create a task. Capture in My Lists instead?');
        return true;
      }
      const date = parseDateFromText(text);
      if (!date) {
        appendNetNetMessage(msgList, 'Please share a date like Today, Tomorrow, or 2026-01-18.');
        return true;
      }
      NETNET_STATE.flow.slots.dueDate = date;
      clearAwaiting();
      continueQuickTaskFlow(msgList);
      return true;
    }
    case 'qt_confirm_description': {
      const decision = parseYesNo(text);
      if (decision === null) {
        appendNetNetMessage(msgList, 'Please reply Yes or No.');
        return true;
      }
      if (decision) {
        NETNET_STATE.flow.slots.description = awaiting.candidate || '';
      }
      clearAwaiting();
      continueQuickTaskFlow(msgList);
      return true;
    }
    case 'qt_description_choice': {
      const decision = parseYesNo(text);
      if (decision === null) {
        appendNetNetMessage(msgList, 'Please reply Yes or No.');
        return true;
      }
      if (decision) {
        setAwaiting('qt_description');
        appendNetNetMessage(msgList, 'Add the description text.');
        return true;
      }
      clearAwaiting();
      continueQuickTaskFlow(msgList);
      return true;
    }
    case 'qt_description': {
      const desc = String(text || '').trim();
      if (!desc) {
        appendNetNetMessage(msgList, 'Please share a short description.');
        return true;
      }
      NETNET_STATE.flow.slots.description = desc;
      clearAwaiting();
      continueQuickTaskFlow(msgList);
      return true;
    }
    case 'jt_confirm_title': {
      const decision = parseYesNo(text);
      if (decision === null) {
        appendNetNetMessage(msgList, 'Please reply Yes or No.');
        return true;
      }
      if (decision) {
        NETNET_STATE.flow.slots.title = awaiting.candidate || '';
        clearAwaiting();
        continueJobTaskFlow(msgList);
      } else {
        setAwaiting('jt_title');
        appendNetNetMessage(msgList, 'Okay. What should the Job Task be called?');
      }
      return true;
    }
    case 'jt_title': {
      if (isRefusalText(text)) {
        offerCaptureInstead(msgList, 'I need a title to create a Job Task. Capture in My Lists instead?');
        return true;
      }
      const title = String(text || '').trim();
      if (!title) {
        appendNetNetMessage(msgList, 'Please share a task title.');
        return true;
      }
      NETNET_STATE.flow.slots.title = title;
      clearAwaiting();
      continueJobTaskFlow(msgList);
      return true;
    }
    case 'jt_confirm_job': {
      const decision = parseYesNo(text);
      if (decision === null) {
        appendNetNetMessage(msgList, 'Please reply Yes or No.');
        return true;
      }
      if (decision) {
        const candidate = awaiting.candidate || {};
        NETNET_STATE.flow.slots.jobId = candidate.id;
        NETNET_STATE.flow.slots.jobName = candidate.name || '';
        clearAwaiting();
        continueJobTaskFlow(msgList);
      } else {
        setAwaiting('jt_job_select');
        appendNetNetMessage(msgList, 'Which job?');
      }
      return true;
    }
    case 'jt_confirm_deliverable': {
      const decision = parseYesNo(text);
      if (decision === null) {
        appendNetNetMessage(msgList, 'Please reply Yes or No.');
        return true;
      }
      if (decision) {
        const candidate = awaiting.candidate || {};
        NETNET_STATE.flow.slots.deliverableId = candidate.id;
        NETNET_STATE.flow.slots.deliverableName = candidate.name || '';
        clearAwaiting();
        continueJobTaskFlow(msgList);
      } else {
        setAwaiting('jt_deliverable_select');
        appendNetNetMessage(msgList, 'Which deliverable should this task live under?');
      }
      return true;
    }
    case 'jt_job_select':
    case 'jt_job_search': {
      if (isRefusalText(text)) {
        offerCaptureInstead(msgList, 'I need a job to create this task. Capture in My Lists instead?');
        return true;
      }
      const match = matchJobByName(text);
      if (!match) {
        appendNetNetMessage(msgList, 'I could not find that job. Try another name.');
        return true;
      }
      NETNET_STATE.flow.slots.jobId = match.id;
      NETNET_STATE.flow.slots.jobName = match.name || '';
      NETNET_STATE.flow.slots.deliverableId = '';
      NETNET_STATE.flow.slots.deliverableName = '';
      clearAwaiting();
      continueJobTaskFlow(msgList);
      return true;
    }
    case 'jt_deliverable_select':
    case 'jt_deliverable_search': {
      if (isRefusalText(text)) {
        offerCaptureInstead(msgList, 'I need a deliverable to create this Job Task. Capture in My Lists instead?');
        return true;
      }
      const match = matchDeliverableByName(text, NETNET_STATE.flow.slots.jobId);
      if (!match) {
        appendNetNetMessage(msgList, 'I could not find that deliverable. Try another name.');
        return true;
      }
      NETNET_STATE.flow.slots.deliverableId = match.id;
      NETNET_STATE.flow.slots.deliverableName = match.name || '';
      clearAwaiting();
      continueJobTaskFlow(msgList);
      return true;
    }
    case 'jt_service_type':
    case 'jt_service_type_search': {
      if (isRefusalText(text)) {
        offerCaptureInstead(msgList, 'I need a Service Type to create this task. Capture in My Lists instead?');
        return true;
      }
      const matches = findServiceTypesByName(text);
      if (!matches.length) {
        appendNetNetMessage(msgList, 'I could not find that Service Type. Try another name.');
        return true;
      }
      if (matches.length === 1) {
        const match = matches[0];
        NETNET_STATE.flow.slots.serviceTypeId = match.id;
        NETNET_STATE.flow.slots.serviceTypeName = match.name || '';
        clearAwaiting();
        continueJobTaskFlow(msgList);
        return true;
      }
      setAwaiting('jt_service_type');
      appendNetNetMessage(msgList, 'Select the Service Type.', matches.slice(0, 5).map((type) => ({
        action: 'jt-service-type',
        value: type.id,
        label: type.name || 'Service Type',
        variant: 'secondary',
        ariaLabel: `Select ${type.name || 'service type'}`,
      })));
      return true;
    }
    case 'jt_confirm_loe': {
      const decision = parseYesNo(text);
      if (decision === null) {
        appendNetNetMessage(msgList, 'Please reply Yes or No.');
        return true;
      }
      if (decision) {
        NETNET_STATE.flow.slots.loeHours = awaiting.candidate || null;
        clearAwaiting();
        continueJobTaskFlow(msgList);
      } else {
        setAwaiting('jt_loe');
        appendNetNetMessage(msgList, 'Okay. How many hours should I estimate (LOE)?');
      }
      return true;
    }
    case 'jt_loe': {
      if (isRefusalText(text)) {
        offerCaptureInstead(msgList, 'I need LOE hours to create a Job Task. Capture in My Lists instead?');
        return true;
      }
      const hours = parseHoursInput(text);
      if (!hours) {
        appendNetNetMessage(msgList, 'Please share the LOE as hours (e.g. 1.5) or minutes (e.g. 90m).');
        return true;
      }
      NETNET_STATE.flow.slots.loeHours = hours;
      clearAwaiting();
      continueJobTaskFlow(msgList);
      return true;
    }
    case 'jt_confirm_due': {
      const decision = parseYesNo(text);
      if (decision === null) {
        appendNetNetMessage(msgList, 'Please reply Yes or No.');
        return true;
      }
      if (decision) {
        NETNET_STATE.flow.slots.dueDate = awaiting.candidate || '';
        clearAwaiting();
        continueJobTaskFlow(msgList);
      } else {
        setAwaiting('jt_due_date');
        appendNetNetMessage(msgList, 'What is the due date?', [
          { action: 'jt-due-date', value: 'today', label: 'Today', variant: 'secondary', ariaLabel: 'Use today' },
          { action: 'jt-due-date', value: 'tomorrow', label: 'Tomorrow', variant: 'secondary', ariaLabel: 'Use tomorrow' },
          { action: 'jt-due-date', value: 'pick', label: 'Pick date…', variant: 'subtle', ariaLabel: 'Pick a date' },
        ]);
      }
      return true;
    }
    case 'jt_due_date':
    case 'jt_due_date_manual': {
      if (isRefusalText(text)) {
        offerCaptureInstead(msgList, 'I need a due date to create a Job Task. Capture in My Lists instead?');
        return true;
      }
      const date = parseDateFromText(text);
      if (!date) {
        appendNetNetMessage(msgList, 'Please share a date like Today, Tomorrow, or 2026-01-18.');
        return true;
      }
      NETNET_STATE.flow.slots.dueDate = date;
      clearAwaiting();
      continueJobTaskFlow(msgList);
      return true;
    }
    case 'jt_assignee':
    case 'jt_assignee_search': {
      if (isRefusalText(text)) {
        offerCaptureInstead(msgList, 'I need an assignee to create this task. Capture in My Lists instead?');
        return true;
      }
      const matches = findMembersByName(text);
      if (!matches.length) {
        appendNetNetMessage(msgList, 'I could not find that team member. Try another name.');
        return true;
      }
      if (matches.length === 1) {
        const match = matches[0];
        NETNET_STATE.flow.slots.assigneeUserId = match.id;
        NETNET_STATE.flow.slots.assigneeName = match.name || '';
        clearAwaiting();
        continueJobTaskFlow(msgList);
        return true;
      }
      setAwaiting('jt_assignee');
      appendNetNetMessage(msgList, 'Select the assignee.', matches.slice(0, 5).map((member) => ({
        action: 'jt-assignee',
        value: member.id,
        label: member.name || member.email || 'Team member',
        variant: 'secondary',
        ariaLabel: `Assign to ${member.name || 'team member'}`,
      })));
      return true;
    }
    case 'jt_confirm_description': {
      const decision = parseYesNo(text);
      if (decision === null) {
        appendNetNetMessage(msgList, 'Please reply Yes or No.');
        return true;
      }
      if (decision) {
        NETNET_STATE.flow.slots.description = awaiting.candidate || '';
      }
      clearAwaiting();
      continueJobTaskFlow(msgList);
      return true;
    }
    case 'jt_description_choice': {
      const decision = parseYesNo(text);
      if (decision === null) {
        appendNetNetMessage(msgList, 'Please reply Yes or No.');
        return true;
      }
      if (decision) {
        setAwaiting('jt_description');
        appendNetNetMessage(msgList, 'Add the description text.');
        return true;
      }
      clearAwaiting();
      continueJobTaskFlow(msgList);
      return true;
    }
    case 'jt_description': {
      const desc = String(text || '').trim();
      if (!desc) {
        appendNetNetMessage(msgList, 'Please share a short description.');
        return true;
      }
      NETNET_STATE.flow.slots.description = desc;
      clearAwaiting();
      continueJobTaskFlow(msgList);
      return true;
    }
    case 'task_choice': {
      const matches = findUnifiedTaskMatches(text);
      if (!matches.length) {
        appendNetNetMessage(msgList, 'I could not find that task. Pick one from the list or try another name.');
        return true;
      }
      if (matches.length > 1) {
        setAwaiting('task_choice');
        appendNetNetMessage(msgList, 'Which task did you mean?', [
          ...buildLogTimeTaskActions(matches.slice(0, 5)),
          { action: 'task-search', value: 'search', label: 'Search…', variant: 'subtle', ariaLabel: 'Search tasks' },
        ]);
        return true;
      }
      const match = matches[0];
      NETNET_STATE.flow.slots.taskId = match.task.id;
      NETNET_STATE.flow.slots.taskType = match.taskType;
      NETNET_STATE.flow.slots.taskTitle = getLogTimeTaskMeta(match.taskType, match.task.id).taskTitle;
      clearAwaiting();
      continueLogTimeFlow(msgList);
      return true;
    }
    case 'task_search': {
      const matches = findUnifiedTaskMatches(text);
      if (!matches.length) {
        appendNetNetMessage(msgList, 'Still not finding that task. Try another name.');
        return true;
      }
      if (matches.length > 1) {
        setAwaiting('task_choice');
        appendNetNetMessage(msgList, 'Which task did you mean?', [
          ...buildLogTimeTaskActions(matches.slice(0, 5)),
          { action: 'task-search', value: 'search', label: 'Search…', variant: 'subtle', ariaLabel: 'Search tasks' },
        ]);
        return true;
      }
      const match = matches[0];
      NETNET_STATE.flow.slots.taskId = match.task.id;
      NETNET_STATE.flow.slots.taskType = match.taskType;
      NETNET_STATE.flow.slots.taskTitle = getLogTimeTaskMeta(match.taskType, match.task.id).taskTitle;
      clearAwaiting();
      continueLogTimeFlow(msgList);
      return true;
    }
    case 'hours': {
      const hours = parseHoursInput(text);
      if (!hours) {
        appendNetNetMessage(msgList, 'Please share the time as hours (e.g. 1.5) or minutes (e.g. 90m).');
        return true;
      }
      NETNET_STATE.flow.slots.hours = hours;
      clearAwaiting();
      continueLogTimeFlow(msgList);
      return true;
    }
    case 'date':
    case 'date_manual': {
      const date = parseDateFromText(text);
      if (!date) {
        appendNetNetMessage(msgList, 'Please share a date like Today, Yesterday, or 2026-01-18.');
        return true;
      }
      NETNET_STATE.flow.slots.date = date;
      clearAwaiting();
      continueLogTimeFlow(msgList);
      return true;
    }
    default:
      return false;
  }
}

function handleUserMessage(msgList, text) {
  appendUserMessage(msgList, text);

  if (handleAwaitingResponse(msgList, text)) return;

  const timerIntent = detectTimerIntent(text);
  if (timerIntent) {
    if (INTENT_JOB_RE.test(text)) {
      resetFlowState();
      appendNetNetMessage(msgList, 'Timer control for Job tasks is coming next. For now, I can start a timer on a Quick Task.', [
        { action: 'open-quick-tasks', value: 'open', label: 'Open Quick Tasks', variant: 'secondary', ariaLabel: 'Open Quick Tasks' },
      ]);
      return;
    }
    if (timerIntent === 'stop') {
      startStopTimerFlow(msgList, text);
      return;
    }
    if (timerIntent === 'switch') {
      startSwitchTimerFlow(msgList, text);
      return;
    }
    const activeTimer = readTimerState();
    if (activeTimer.active) {
      startSwitchTimerFlow(msgList, text);
      return;
    }
    startTimerFlow(msgList, text);
    return;
  }

  if (INTENT_TIME_RE.test(text)) {
    startLogTimeFlow(msgList, text);
    return;
  }

  const convertIntent = detectConvertIntent(text);
  if (convertIntent) {
    if (INTENT_JOB_RE.test(text)) {
      resetFlowState();
      appendNetNetMessage(msgList, 'Job Task conversion is coming next. For now, I can convert a My Lists item into a Quick Task.');
      return;
    }
    const mentionsList = /\b(list|item)\b/i.test(text || '');
    if (convertIntent === 'maybe' && !mentionsList && !isOnMyListsRoute()) {
      askConvertIntentConfirm(msgList, text);
      return;
    }
    startConvertListItemFlow(msgList, text);
    return;
  }

  if (INTENT_JOB_TASK_RE.test(text)) {
    startJobTaskFlow(msgList, text);
    return;
  }

  if (INTENT_QUICK_TASK_RE.test(text)) {
    startQuickTaskFlow(msgList, text);
    return;
  }

  if (INTENT_TASK_RE.test(text) && !INTENT_JOB_TASK_RE.test(text)) {
    askTaskTypeClarification(msgList, text);
    return;
  }

  if (INTENT_CAPTURE_RE.test(text)) {
    askIntentClarification(msgList, text);
    return;
  }

  appendNetNetMessage(msgList, 'I can capture items for My Lists, create Quick Tasks, create Job Tasks, log time to tasks, or control Quick Task timers. What would you like to do?');
}

function cancelFlow(msgList) {
  resetFlowState();
  appendNetNetMessage(msgList, 'Okay — canceled.');
}

function navigateToMyLists() {
  if (typeof window.navigate === 'function') {
    window.navigate('#/app/me/my-lists');
  } else {
    location.hash = '#/app/me/my-lists';
  }
}

function navigateToQuickTasks() {
  if (typeof window.navigate === 'function') {
    window.navigate('#/app/quick-tasks');
  } else {
    location.hash = '#/app/quick-tasks';
  }
}

function navigateToJobs() {
  if (typeof window.navigate === 'function') {
    window.navigate('#/app/jobs');
  } else {
    location.hash = '#/app/jobs';
  }
}

function handleActionClick(msgList, action, value, label) {
  switch (action) {
    case 'intent-choice':
      appendUserMessage(msgList, label);
      handleIntentChoice(msgList, value);
      break;
    case 'capture-my-lists':
      appendUserMessage(msgList, label);
      startMyListsFlow(msgList, NETNET_STATE.flow.sourceText || '');
      break;
    case 'cancel-flow':
      appendUserMessage(msgList, label);
      cancelFlow(msgList);
      break;
    case 'confirm-title':
      appendUserMessage(msgList, label);
      handleAwaitingResponse(msgList, value === 'yes' ? 'yes' : 'no');
      break;
    case 'confirm-notes':
      appendUserMessage(msgList, label);
      handleAwaitingResponse(msgList, value === 'yes' ? 'yes' : 'no');
      break;
    case 'task-type':
      appendUserMessage(msgList, label);
      if (value === 'quick') {
        startQuickTaskFlow(msgList, NETNET_STATE.flow.sourceText || '');
      } else if (value === 'job') {
        startJobTaskFlow(msgList, NETNET_STATE.flow.sourceText || '');
      } else {
        startMyListsFlow(msgList, NETNET_STATE.flow.sourceText || '');
      }
      break;
    case 'convert-intent':
      appendUserMessage(msgList, label);
      if (value === 'yes') {
        startConvertListItemFlow(msgList, NETNET_STATE.flow.sourceText || '');
      } else {
        cancelFlow(msgList);
      }
      break;
    case 'convert-list-item': {
      appendUserMessage(msgList, label);
      const items = loadMyListItems().filter((item) => item && !item.isArchived);
      const match = items.find((item) => String(item.id) === String(value));
      if (match) {
        askConvertKeepRemove(msgList, match);
      } else {
        appendNetNetMessage(msgList, 'I couldn’t find that list item. Want to pick one?');
      }
      break;
    }
    case 'convert-list-search':
      appendUserMessage(msgList, label);
      setAwaiting('convert_list_item_search');
      appendNetNetMessage(msgList, 'Type the list item name.');
      break;
    case 'convert-keep':
      appendUserMessage(msgList, label);
      beginConvertToQuickTask(msgList, false);
      break;
    case 'convert-remove':
      appendUserMessage(msgList, label);
      beginConvertToQuickTask(msgList, true);
      break;
    case 'timer-start-task': {
      appendUserMessage(msgList, label);
      const match = getQuickTaskById(value);
      if (match) {
        NETNET_STATE.flow.slots.taskId = match.id;
        NETNET_STATE.flow.slots.taskTitle = match.title || '';
        clearAwaiting();
        continueStartTimerFlow(msgList);
      }
      break;
    }
    case 'timer-start-search':
      appendUserMessage(msgList, label);
      setAwaiting('timer_start_search');
      appendNetNetMessage(msgList, 'Type the Quick Task name.');
      break;
    case 'timer-stop-date': {
      appendUserMessage(msgList, label);
      if (value === 'today') {
        NETNET_STATE.flow.slots.date = getLocalDateISO(new Date());
        clearAwaiting();
        continueStopTimerFlow(msgList);
      } else if (value === 'yesterday') {
        const d = new Date();
        d.setDate(d.getDate() - 1);
        NETNET_STATE.flow.slots.date = getLocalDateISO(d);
        clearAwaiting();
        continueStopTimerFlow(msgList);
      } else {
        setAwaiting('timer_stop_date_manual');
        appendNetNetMessage(msgList, 'Enter a date (YYYY-MM-DD).');
      }
      break;
    }
    case 'timer-switch-task': {
      appendUserMessage(msgList, label);
      const match = getQuickTaskById(value);
      if (match) {
        NETNET_STATE.flow.slots.toTaskId = match.id;
        NETNET_STATE.flow.slots.toTaskTitle = match.title || '';
        clearAwaiting();
        continueSwitchTimerFlow(msgList);
      }
      break;
    }
    case 'timer-switch-search':
      appendUserMessage(msgList, label);
      setAwaiting('timer_switch_search');
      appendNetNetMessage(msgList, 'Type the Quick Task name.');
      break;
    case 'timer-switch-date': {
      appendUserMessage(msgList, label);
      if (value === 'today') {
        NETNET_STATE.flow.slots.date = getLocalDateISO(new Date());
        clearAwaiting();
        continueSwitchTimerFlow(msgList);
      } else if (value === 'yesterday') {
        const d = new Date();
        d.setDate(d.getDate() - 1);
        NETNET_STATE.flow.slots.date = getLocalDateISO(d);
        clearAwaiting();
        continueSwitchTimerFlow(msgList);
      } else {
        setAwaiting('timer_switch_date_manual');
        appendNetNetMessage(msgList, 'Enter a date (YYYY-MM-DD).');
      }
      break;
    }
    case 'qt-confirm-title':
    case 'qt-confirm-loe':
    case 'qt-confirm-due':
    case 'qt-confirm-description':
    case 'qt-description-choice':
      appendUserMessage(msgList, label);
      handleAwaitingResponse(msgList, value === 'yes' ? 'yes' : 'no');
      break;
    case 'qt-anchor':
      appendUserMessage(msgList, label);
      if (value === 'internal') {
        NETNET_STATE.flow.slots.anchorType = 'internal';
        NETNET_STATE.flow.slots.companyId = null;
        NETNET_STATE.flow.slots.companyName = '';
        NETNET_STATE.flow.slots.personId = null;
        NETNET_STATE.flow.slots.personName = '';
        clearAwaiting();
        continueQuickTaskFlow(msgList);
      } else {
        clearAwaiting();
        setAwaiting('qt_client_type');
        appendNetNetMessage(msgList, 'Company or Person?', [
          { action: 'qt-client-type', value: 'company', label: 'Company', variant: 'secondary', ariaLabel: 'Client company' },
          { action: 'qt-client-type', value: 'person', label: 'Person', variant: 'secondary', ariaLabel: 'Client person' },
        ]);
      }
      break;
    case 'qt-client-type':
      appendUserMessage(msgList, label);
      NETNET_STATE.flow.slots.anchorType = value === 'company' ? 'client_company' : 'client_person';
      NETNET_STATE.flow.slots.companyId = null;
      NETNET_STATE.flow.slots.companyName = '';
      NETNET_STATE.flow.slots.personId = null;
      NETNET_STATE.flow.slots.personName = '';
      clearAwaiting();
      continueQuickTaskFlow(msgList);
      break;
    case 'qt-company': {
      appendUserMessage(msgList, label);
      const match = findCompanyById(value);
      if (match) {
        NETNET_STATE.flow.slots.companyId = match.id;
        NETNET_STATE.flow.slots.companyName = match.name || '';
        NETNET_STATE.flow.context.companyPersonAsked = false;
        NETNET_STATE.flow.context.companyPersonNeeded = false;
        clearAwaiting();
        continueQuickTaskFlow(msgList);
      }
      break;
    }
    case 'qt-company-search':
      appendUserMessage(msgList, label);
      setAwaiting('qt_company_search');
      appendNetNetMessage(msgList, 'Type the company name.');
      break;
    case 'qt-company-person':
      appendUserMessage(msgList, label);
      NETNET_STATE.flow.context.companyPersonNeeded = value === 'yes';
      clearAwaiting();
      continueQuickTaskFlow(msgList);
      break;
    case 'qt-person': {
      appendUserMessage(msgList, label);
      const match = findPersonById(value);
      if (match) {
        NETNET_STATE.flow.slots.personId = match.id;
        NETNET_STATE.flow.slots.personName = match.name || '';
        if (match.companyId) {
          NETNET_STATE.flow.slots.companyId = match.companyId;
          NETNET_STATE.flow.slots.companyName = match.companyName || '';
        }
        clearAwaiting();
        continueQuickTaskFlow(msgList);
      }
      break;
    }
    case 'qt-person-search':
      appendUserMessage(msgList, label);
      setAwaiting('qt_person_search');
      appendNetNetMessage(msgList, 'Type the person name.');
      break;
    case 'qt-service-type': {
      appendUserMessage(msgList, label);
      const match = getServiceTypeById(value);
      if (match) {
        NETNET_STATE.flow.slots.serviceTypeId = match.id;
        NETNET_STATE.flow.slots.serviceTypeName = match.name || '';
        clearAwaiting();
        continueQuickTaskFlow(msgList);
      }
      break;
    }
    case 'qt-service-type-search':
      appendUserMessage(msgList, label);
      setAwaiting('qt_service_type_search');
      appendNetNetMessage(msgList, 'Type the Service Type name.');
      break;
    case 'qt-assignee': {
      appendUserMessage(msgList, label);
      const match = getMemberById(value);
      if (match) {
        NETNET_STATE.flow.slots.assigneeUserId = match.id;
        NETNET_STATE.flow.slots.assigneeName = match.name || '';
        clearAwaiting();
        continueQuickTaskFlow(msgList);
      }
      break;
    }
    case 'qt-assignee-search':
      appendUserMessage(msgList, label);
      setAwaiting('qt_assignee_search');
      appendNetNetMessage(msgList, 'Type the team member name.');
      break;
    case 'qt-due-date': {
      appendUserMessage(msgList, label);
      if (value === 'today') {
        NETNET_STATE.flow.slots.dueDate = getLocalDateISO(new Date());
        clearAwaiting();
        continueQuickTaskFlow(msgList);
      } else if (value === 'tomorrow') {
        const d = new Date();
        d.setDate(d.getDate() + 1);
        NETNET_STATE.flow.slots.dueDate = getLocalDateISO(d);
        clearAwaiting();
        continueQuickTaskFlow(msgList);
      } else {
        setAwaiting('qt_due_date_manual');
        appendNetNetMessage(msgList, 'Enter a date (YYYY-MM-DD).');
      }
      break;
    }
    case 'jt-confirm-title':
    case 'jt-confirm-job':
    case 'jt-confirm-deliverable':
    case 'jt-confirm-loe':
    case 'jt-confirm-due':
    case 'jt-confirm-description':
    case 'jt-description-choice':
      appendUserMessage(msgList, label);
      handleAwaitingResponse(msgList, value === 'yes' ? 'yes' : 'no');
      break;
    case 'jt-job': {
      appendUserMessage(msgList, label);
      const match = findJobById(value);
      if (match) {
        NETNET_STATE.flow.slots.jobId = match.id;
        NETNET_STATE.flow.slots.jobName = match.name || '';
        NETNET_STATE.flow.slots.deliverableId = '';
        NETNET_STATE.flow.slots.deliverableName = '';
        clearAwaiting();
        continueJobTaskFlow(msgList);
      }
      break;
    }
    case 'jt-job-search':
      appendUserMessage(msgList, label);
      setAwaiting('jt_job_search');
      appendNetNetMessage(msgList, 'Type the job name.');
      break;
    case 'jt-deliverable': {
      appendUserMessage(msgList, label);
      const match = findDeliverableById(value);
      if (match) {
        NETNET_STATE.flow.slots.deliverableId = match.id;
        NETNET_STATE.flow.slots.deliverableName = match.name || '';
        clearAwaiting();
        continueJobTaskFlow(msgList);
      }
      break;
    }
    case 'jt-deliverable-search':
      appendUserMessage(msgList, label);
      setAwaiting('jt_deliverable_search');
      appendNetNetMessage(msgList, 'Type the deliverable name.');
      break;
    case 'jt-service-type': {
      appendUserMessage(msgList, label);
      const match = getServiceTypeById(value);
      if (match) {
        NETNET_STATE.flow.slots.serviceTypeId = match.id;
        NETNET_STATE.flow.slots.serviceTypeName = match.name || '';
        clearAwaiting();
        continueJobTaskFlow(msgList);
      }
      break;
    }
    case 'jt-service-type-search':
      appendUserMessage(msgList, label);
      setAwaiting('jt_service_type_search');
      appendNetNetMessage(msgList, 'Type the Service Type name.');
      break;
    case 'jt-assignee': {
      appendUserMessage(msgList, label);
      const match = getMemberById(value);
      if (match) {
        NETNET_STATE.flow.slots.assigneeUserId = match.id;
        NETNET_STATE.flow.slots.assigneeName = match.name || '';
        clearAwaiting();
        continueJobTaskFlow(msgList);
      }
      break;
    }
    case 'jt-assignee-search':
      appendUserMessage(msgList, label);
      setAwaiting('jt_assignee_search');
      appendNetNetMessage(msgList, 'Type the team member name.');
      break;
    case 'jt-due-date': {
      appendUserMessage(msgList, label);
      if (value === 'today') {
        NETNET_STATE.flow.slots.dueDate = getLocalDateISO(new Date());
        clearAwaiting();
        continueJobTaskFlow(msgList);
      } else if (value === 'tomorrow') {
        const d = new Date();
        d.setDate(d.getDate() + 1);
        NETNET_STATE.flow.slots.dueDate = getLocalDateISO(d);
        clearAwaiting();
        continueJobTaskFlow(msgList);
      } else {
        setAwaiting('jt_due_date_manual');
        appendNetNetMessage(msgList, 'Enter a date (YYYY-MM-DD).');
      }
      break;
    }
    case 'select-task': {
      appendUserMessage(msgList, label);
      const parsed = parseLogTimeTaskValue(value);
      const task = parsed.taskType === 'job'
        ? getJobTaskById(parsed.taskId)
        : getQuickTaskById(parsed.taskId);
      if (!task) {
        appendNetNetMessage(msgList, 'I could not find that task. Pick one from the list or try another name.');
        return;
      }
      const meta = buildLogTimeMetaFromTask(parsed.taskType, task);
      NETNET_STATE.flow.slots.taskId = meta.taskId;
      NETNET_STATE.flow.slots.taskType = meta.taskType;
      NETNET_STATE.flow.slots.taskTitle = meta.taskTitle || '';
      clearAwaiting();
      continueLogTimeFlow(msgList);
      break;
    }
    case 'task-search':
      appendUserMessage(msgList, label);
      setAwaiting('task_search');
      appendNetNetMessage(msgList, 'Type the task name.');
      break;
    case 'select-date': {
      appendUserMessage(msgList, label);
      if (value === 'today') {
        NETNET_STATE.flow.slots.date = getLocalDateISO(new Date());
        clearAwaiting();
        continueLogTimeFlow(msgList);
      } else if (value === 'yesterday') {
        const d = new Date();
        d.setDate(d.getDate() - 1);
        NETNET_STATE.flow.slots.date = getLocalDateISO(d);
        clearAwaiting();
        continueLogTimeFlow(msgList);
      } else {
        setAwaiting('date_manual');
        appendNetNetMessage(msgList, 'Enter a date (YYYY-MM-DD).');
      }
      break;
    }
    case 'open-my-lists':
      navigateToMyLists();
      break;
    case 'open-quick-tasks':
      navigateToQuickTasks();
      break;
    case 'open-jobs':
      navigateToJobs();
      break;
    default:
      break;
  }
}

function handleProposalAction(msgList, action, proposalId) {
  const message = NETNET_STATE.messages.find((msg) => msg.id === proposalId);
  if (!message || message.type !== 'proposal') return;

  if (action === 'edit') {
    updateMessage(proposalId, { proposal: { ...message.proposal, mode: 'edit' } });
    refreshPanel({ focusInput: false });
    return;
  }

  if (action === 'cancel') {
    removeMessage(proposalId);
    NETNET_STATE.pendingProposalId = null;
    persistThreadState();
    refreshPanel({ focusInput: false });
    const nextList = document.getElementById('netnet-thread');
    appendNetNetMessage(nextList, 'Okay — canceled.');
    return;
  }

  if (action === 'save') {
    if (message.proposal.kind === 'create_list_item') {
      const titleInput = document.querySelector(`[data-proposal-id="${proposalId}"][data-proposal-field="title"]`);
      const notesInput = document.querySelector(`[data-proposal-id="${proposalId}"][data-proposal-field="notes"]`);
      const title = titleInput ? titleInput.value.trim() : '';
      if (!title) {
        appendNetNetMessage(msgList, 'Title is required.');
        return;
      }
      const notes = notesInput ? notesInput.value.trim() : '';
      updateMessage(proposalId, {
        proposal: { ...message.proposal, mode: 'view', data: { title, notes } },
      });
      refreshPanel({ focusInput: false });
      return;
    }

    if (message.proposal.kind === 'create_job_task') {
      const data = readJobTaskProposalFields(proposalId);
      const validation = validateJobTaskData(data);
      if (!validation.ok) {
        updateJobTaskEditState(proposalId, data);
        appendNetNetMessage(msgList, validation.reason || 'Please complete the required fields.');
        return;
      }
      updateMessage(proposalId, {
        proposal: {
          ...message.proposal,
          mode: 'view',
          data,
        },
      });
      refreshPanel({ focusInput: false });
      return;
    }

    if (message.proposal.kind === 'create_quick_task' || message.proposal.kind === 'convert_list_item') {
      const data = readQuickTaskProposalFields(proposalId);
      const nextData = { ...(message.proposal.data || {}), ...data };
      if (typeof data.removeSource !== 'boolean') {
        nextData.removeSource = !!message.proposal.data?.removeSource;
      }
      const validation = validateQuickTaskData(nextData);
      if (!validation.ok) {
        updateQuickTaskEditState(proposalId);
        appendNetNetMessage(msgList, validation.reason || 'Please complete the required fields.');
        return;
      }
      updateMessage(proposalId, {
        proposal: {
          ...message.proposal,
          mode: 'view',
          data: nextData,
        },
      });
      refreshPanel({ focusInput: false });
      return;
    }

    if (message.proposal.kind === 'start_timer') {
      const data = {
        ...message.proposal.data,
        ...readTimerProposalFields(proposalId, 'start_timer'),
      };
      const validation = validateTimerProposal('start_timer', data);
      if (!validation.ok) {
        updateTimerEditState(proposalId, 'start_timer', data);
        appendNetNetMessage(msgList, validation.reason || 'Please choose a Quick Task.');
        return;
      }
      updateMessage(proposalId, {
        proposal: { ...message.proposal, mode: 'view', data },
      });
      refreshPanel({ focusInput: false });
      return;
    }

    if (message.proposal.kind === 'stop_timer') {
      const data = {
        ...message.proposal.data,
        ...readTimerProposalFields(proposalId, 'stop_timer'),
      };
      const validation = validateTimerProposal('stop_timer', data);
      if (!validation.ok) {
        updateTimerEditState(proposalId, 'stop_timer', data);
        appendNetNetMessage(msgList, validation.reason || 'Please complete the required fields.');
        return;
      }
      updateMessage(proposalId, {
        proposal: { ...message.proposal, mode: 'view', data },
      });
      refreshPanel({ focusInput: false });
      return;
    }

    if (message.proposal.kind === 'switch_timer') {
      const data = {
        ...message.proposal.data,
        ...readTimerProposalFields(proposalId, 'switch_timer'),
      };
      const validation = validateTimerProposal('switch_timer', data);
      if (!validation.ok) {
        updateTimerEditState(proposalId, 'switch_timer', data);
        appendNetNetMessage(msgList, validation.reason || 'Please complete the required fields.');
        return;
      }
      updateMessage(proposalId, {
        proposal: { ...message.proposal, mode: 'view', data },
      });
      refreshPanel({ focusInput: false });
      return;
    }

    const data = readLogTimeProposalFields(proposalId);
    if (!data.taskId || !data.hours || !data.date) {
      appendNetNetMessage(msgList, 'Task, date, and hours are required.');
      return;
    }

    updateMessage(proposalId, {
      proposal: {
        ...message.proposal,
        mode: 'view',
        data: {
          ...message.proposal.data,
          ...data,
        },
      },
    });
    refreshPanel({ focusInput: false });
    return;
  }

  if (action === 'confirm') {
    const proposal = message.proposal || {};
    if (proposal.kind === 'create_list_item') {
      const data = proposal.data || {};
      const created = addMyListItem({
        title: data.title,
        notes: data.notes || '',
        folderId: null,
      });
      removeMessage(proposalId);
      NETNET_STATE.pendingProposalId = null;
      persistThreadState();
      const title = created?.title || data.title;
      refreshPanel({ focusInput: false });
      const nextList = document.getElementById('netnet-thread');
      appendNetNetMessage(nextList, `Done — added to My Lists: ${title}`, [
        { action: 'open-my-lists', value: 'open', label: 'Open My Lists', variant: 'secondary', ariaLabel: 'Open My Lists' },
      ]);
      return;
    }

    if (proposal.kind === 'log_time') {
      const data = proposal.data || {};
      const user = getCurrentUser();
      const meta = getLogTimeTaskMeta(data.taskType, data.taskId, data.taskTitle || '');
      let updated = null;
      if (data.taskType === 'job') {
        updated = addJobTaskTimeEntry(data.taskId, {
          date: data.date,
          hours: data.hours,
          note: data.note || '',
          createdAt: Date.now(),
          createdByUserId: getCurrentUserId(),
          createdVia: 'netnet_ai',
        });
      } else {
        updated = addTimeEntry(data.taskId, {
          date: data.date,
          hours: data.hours,
          note: data.note || '',
          createdAt: Date.now(),
          createdByUserId: getCurrentUserId(),
          createdByName: user?.name || 'Net Net',
          createdVia: 'netnet_ai',
        });
      }
      removeMessage(proposalId);
      NETNET_STATE.pendingProposalId = null;
      persistThreadState();
      refreshPanel({ focusInput: false });
      const nextList = document.getElementById('netnet-thread');
      if (updated) {
        const actions = data.taskType === 'job'
          ? [{ action: 'open-jobs', value: 'open', label: 'Open job', variant: 'secondary', ariaLabel: 'Open job' }]
          : [];
        appendNetNetMessage(
          nextList,
          `Done — logged ${data.hours}h to ${meta.taskTitle || data.taskTitle} on ${formatDateLabel(data.date)}.`,
          actions,
        );
      } else {
        appendNetNetMessage(nextList, 'I could not log that time entry. Please try again.');
      }
      return;
    }

    if (proposal.kind === 'start_timer') {
      const data = proposal.data || {};
      const validation = validateTimerProposal('start_timer', data);
      if (!validation.ok) {
        appendNetNetMessage(msgList, 'I couldn’t start that timer yet.');
        return;
      }
      const taskTitle = data.taskTitle || getQuickTaskById(data.taskId)?.title || 'this Quick Task';
      const started = startTimerForTask(data.taskId);
      removeMessage(proposalId);
      NETNET_STATE.pendingProposalId = null;
      persistThreadState();
      refreshPanel({ focusInput: false });
      const nextList = document.getElementById('netnet-thread');
      if (started) {
        appendNetNetMessage(nextList, `Timer started on ${taskTitle}.`);
      } else {
        appendNetNetMessage(nextList, 'I couldn’t start that timer right now.');
      }
      return;
    }

    if (proposal.kind === 'stop_timer') {
      const data = proposal.data || {};
      const validation = validateTimerProposal('stop_timer', data);
      if (!validation.ok) {
        appendNetNetMessage(msgList, 'I couldn’t stop that timer yet.');
        return;
      }
      const taskTitle = data.taskTitle || getQuickTaskById(data.taskId)?.title || 'this Quick Task';
      const prevState = readTimerState();
      const stopped = stopTimerState();
      if (!stopped) {
        appendNetNetMessage(msgList, 'I couldn’t stop that timer right now.');
        return;
      }
      const user = getCurrentUser();
      const updated = addTimeEntry(data.taskId, {
        date: data.date,
        hours: coerceHours(data.hours),
        note: data.note || '',
        createdAt: Date.now(),
        createdByUserId: getCurrentUserId(),
        createdByName: user?.name || 'Net Net',
        createdVia: 'netnet_ai',
      });
      if (!updated) {
        restoreTimerState(prevState);
        appendNetNetMessage(msgList, 'I couldn’t log that time entry. Please try again.');
        return;
      }
      removeMessage(proposalId);
      NETNET_STATE.pendingProposalId = null;
      persistThreadState();
      refreshPanel({ focusInput: false });
      const nextList = document.getElementById('netnet-thread');
      appendNetNetMessage(nextList, `Done — stopped timer and logged ${data.hours}h to ${taskTitle} on ${formatDateLabel(data.date)}.`);
      return;
    }

    if (proposal.kind === 'switch_timer') {
      const data = proposal.data || {};
      const validation = validateTimerProposal('switch_timer', data);
      if (!validation.ok) {
        appendNetNetMessage(msgList, 'I couldn’t switch that timer yet.');
        return;
      }
      const fromTitle = data.fromTaskTitle || getQuickTaskById(data.fromTaskId)?.title || 'this Quick Task';
      const toTitle = data.toTaskTitle || getQuickTaskById(data.toTaskId)?.title || 'this Quick Task';
      const prevState = readTimerState();
      const stopped = stopTimerState();
      if (!stopped) {
        appendNetNetMessage(msgList, 'I couldn’t stop the current timer right now.');
        return;
      }
      const user = getCurrentUser();
      const updated = addTimeEntry(data.fromTaskId, {
        date: data.date,
        hours: coerceHours(data.hours),
        note: data.note || '',
        createdAt: Date.now(),
        createdByUserId: getCurrentUserId(),
        createdByName: user?.name || 'Net Net',
        createdVia: 'netnet_ai',
      });
      if (!updated) {
        restoreTimerState(prevState);
        appendNetNetMessage(msgList, 'I couldn’t log that time entry. Please try again.');
        return;
      }
      const started = startTimerForTask(data.toTaskId);
      if (!started) {
        restoreTimerState(prevState);
        appendNetNetMessage(msgList, 'I couldn’t start the new timer. Please try again.');
        return;
      }
      removeMessage(proposalId);
      NETNET_STATE.pendingProposalId = null;
      persistThreadState();
      refreshPanel({ focusInput: false });
      const nextList = document.getElementById('netnet-thread');
      appendNetNetMessage(nextList, `Switched timer: logged ${data.hours}h to ${fromTitle} and started timer on ${toTitle}.`);
      return;
    }

    if (proposal.kind === 'create_job_task') {
      const data = proposal.data || {};
      const validation = validateJobTaskData(data);
      if (!validation.ok) {
        appendNetNetMessage(msgList, 'I couldn’t create that Job Task right now.');
        return;
      }
      const created = createJobTask({
        title: data.title,
        description: data.description || '',
        jobId: data.jobId,
        deliverableId: data.deliverableId,
        serviceTypeId: data.serviceTypeId,
        loeHours: data.loeHours,
        dueDate: data.dueDate,
        assigneeUserId: data.assigneeUserId,
        createdAt: Date.now(),
        createdByUserId: getCurrentUserId(),
        createdVia: 'netnet_ai',
      });
      removeMessage(proposalId);
      NETNET_STATE.pendingProposalId = null;
      persistThreadState();
      refreshPanel({ focusInput: false });
      const nextList = document.getElementById('netnet-thread');
      if (created) {
        appendNetNetMessage(nextList, `Done — created Job Task: ${created.title || data.title}`, [
          { action: 'open-jobs', value: 'open', label: 'Open job', variant: 'secondary', ariaLabel: 'Open job' },
        ]);
      } else {
        appendNetNetMessage(nextList, 'I couldn’t create that Job Task right now.');
      }
      return;
    }

    if (proposal.kind === 'convert_list_item') {
      const data = proposal.data || {};
      const validation = validateQuickTaskData(data);
      if (!validation.ok) {
        appendNetNetMessage(msgList, 'I couldn’t create that task right now.');
        return;
      }
      const created = createQuickTask({
        title: data.title,
        description: data.description || '',
        dueDate: data.dueDate,
        assigneeUserId: data.assigneeUserId,
        assignorUserId: getCurrentUserId(),
        serviceTypeId: data.serviceTypeId,
        loeHours: data.loeHours,
        isInternal: data.anchorType === 'internal',
        companyId: data.anchorType === 'internal' ? null : data.companyId || null,
        personId: data.personId || null,
        createdAt: Date.now(),
        createdByUserId: getCurrentUserId(),
        createdVia: 'netnet_ai',
        sourceListItemId: data.sourceItemId || null,
        sourceListId: data.sourceItemFolderId ?? null,
      });
      let deleteFailed = false;
      if (created && data.removeSource && data.sourceItemId) {
        const deleted = deleteMyListItem(data.sourceItemId);
        deleteFailed = !deleted;
      }
      if (created && data.removeSource && !data.sourceItemId) {
        deleteFailed = true;
      }
      removeMessage(proposalId);
      NETNET_STATE.pendingProposalId = null;
      persistThreadState();
      refreshPanel({ focusInput: false });
      const nextList = document.getElementById('netnet-thread');
      if (created) {
        const actions = [
          { action: 'open-quick-tasks', value: 'open', label: 'Open task', variant: 'secondary', ariaLabel: 'Open task' },
        ];
        if (!data.removeSource || deleteFailed) {
          actions.push({ action: 'open-my-lists', value: 'open', label: 'View list item', variant: 'secondary', ariaLabel: 'View list item' });
        }
        appendNetNetMessage(nextList, `Done — created Quick Task from My Lists item: ${created.title || data.title}`, actions);
        if (deleteFailed) {
          appendNetNetMessage(nextList, 'I created the task, but I could not remove the list item.');
        }
      } else {
        appendNetNetMessage(nextList, 'I couldn’t create that task right now.');
      }
      return;
    }

    if (proposal.kind === 'create_quick_task') {
      const data = proposal.data || {};
      const validation = validateQuickTaskData(data);
      if (!validation.ok) {
        appendNetNetMessage(msgList, 'I couldn’t create that task right now.');
        return;
      }
      const created = createQuickTask({
        title: data.title,
        description: data.description || '',
        dueDate: data.dueDate,
        assigneeUserId: data.assigneeUserId,
        assignorUserId: getCurrentUserId(),
        serviceTypeId: data.serviceTypeId,
        loeHours: data.loeHours,
        isInternal: data.anchorType === 'internal',
        companyId: data.anchorType === 'internal' ? null : data.companyId || null,
        personId: data.personId || null,
        createdAt: Date.now(),
        createdByUserId: getCurrentUserId(),
        createdVia: 'netnet_ai',
      });
      removeMessage(proposalId);
      NETNET_STATE.pendingProposalId = null;
      persistThreadState();
      refreshPanel({ focusInput: false });
      const nextList = document.getElementById('netnet-thread');
      if (created) {
        appendNetNetMessage(nextList, `Done — created Quick Task: ${created.title || data.title}`, [
          { action: 'open-quick-tasks', value: 'open', label: 'Open task', variant: 'secondary', ariaLabel: 'Open task' },
        ]);
      } else {
        appendNetNetMessage(nextList, 'I couldn’t create that task right now.');
      }
      return;
    }
  }
}

function wireNetNetPanel({ focusInput = true } = {}) {
  const input = document.getElementById('netnet-input');
  const sendBtn = document.getElementById('netnet-send-btn');
  const msgList = document.getElementById('netnet-thread');
  const newBtn = document.getElementById('netnet-new-btn');
  const closeBtn = document.getElementById('drawerCloseBtn');
  const backdrop = document.getElementById('app-drawer-backdrop');
  const suggestionBtns = document.querySelectorAll('[data-netnet-suggestion]');

  const MIN_INPUT_HEIGHT = 44;
  const autoResize = () => {
    if (!input) return;
    input.style.height = 'auto';
    const nextHeight = Math.max(input.scrollHeight, MIN_INPUT_HEIGHT);
    input.style.height = `${nextHeight}px`;
  };
  const updateSendState = () => {
    if (!sendBtn || !input) return;
    const value = input.value.trim();
    sendBtn.disabled = value.length === 0;
    NETNET_STATE.input = input.value;
    autoResize();
  };

  let suggestionLock = false;
  const send = (payload) => {
    if (!payload) return;
    handleUserMessage(msgList, payload);
    if (input) input.value = '';
    NETNET_STATE.input = '';
    updateSendState();
  };

  const tryClose = () => {
    if (hasPendingProposal()) {
      const ok = window.confirm('Discard the proposal draft?');
      if (!ok) return;
    }
    closeDrawer();
  };

  if (input) {
    input.value = NETNET_STATE.input;
    input.addEventListener('input', updateSendState);
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        if (!sendBtn?.disabled) send(input.value.trim());
      }
    });
    if (focusInput) input.focus();
    autoResize();
  }
  if (sendBtn) sendBtn.addEventListener('click', () => send(input?.value.trim() || ''));
  if (newBtn) {
    newBtn.addEventListener('click', () => {
      NETNET_STATE.messages = [];
      NETNET_STATE.input = '';
      NETNET_STATE.pendingProposalId = null;
      resetFlowState();
      refreshPanel({ focusInput: true });
    });
  }
  if (closeBtn) closeBtn.addEventListener('click', tryClose);
  if (backdrop) backdrop.addEventListener('click', tryClose);

  if (msgList) {
    const handleProposalFieldChange = (event) => {
      const field = event.target.closest('[data-proposal-field]');
      if (!field) return;
      const proposalId = field.getAttribute('data-proposal-id');
      const message = NETNET_STATE.messages.find((msg) => msg.id === proposalId);
      if (
        message?.proposal?.kind
        && ['create_quick_task', 'convert_list_item'].includes(message.proposal.kind)
        && message.proposal.mode === 'edit'
      ) {
        updateQuickTaskEditState(proposalId);
      }
      if (message?.proposal?.kind === 'create_job_task' && message.proposal.mode === 'edit') {
        const fieldName = field.getAttribute('data-proposal-field');
        if (fieldName === 'jobId') {
          const nextData = { ...(message.proposal.data || {}), ...readJobTaskProposalFields(proposalId) };
          if (String(nextData.jobId || '') !== String(message.proposal.data?.jobId || '')) {
            nextData.deliverableId = '';
            nextData.deliverableName = '';
          }
          updateMessage(proposalId, { proposal: { ...message.proposal, data: nextData } });
          refreshPanel({ focusInput: false });
          return;
        }
        updateJobTaskEditState(proposalId);
      }
      if (
        message?.proposal?.kind
        && ['start_timer', 'stop_timer', 'switch_timer'].includes(message.proposal.kind)
        && message.proposal.mode === 'edit'
      ) {
        updateTimerEditState(proposalId, message.proposal.kind, message.proposal.data || {});
      }
    };
    msgList.addEventListener('input', handleProposalFieldChange);
    msgList.addEventListener('change', handleProposalFieldChange);
    msgList.addEventListener('click', (e) => {
      const actionBtn = e.target.closest('[data-netnet-action]');
      if (actionBtn) {
        const action = actionBtn.getAttribute('data-netnet-action');
        const value = actionBtn.getAttribute('data-netnet-value') || '';
        const label = actionBtn.textContent.trim();
        handleActionClick(msgList, action, value, label);
        return;
      }
      const proposalBtn = e.target.closest('[data-netnet-proposal-action]');
      if (proposalBtn) {
        const action = proposalBtn.getAttribute('data-netnet-proposal-action');
        const proposalId = proposalBtn.getAttribute('data-proposal-id');
        handleProposalAction(msgList, action, proposalId);
      }
    });
  }

  suggestionBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      if (suggestionLock) return;
      const suggestion = btn.getAttribute('data-netnet-suggestion') || '';
      if (input) {
        input.value = suggestion;
        updateSendState();
        input.focus();
      }
      if (!suggestion) return;
      suggestionLock = true;
      send(suggestion);
      window.setTimeout(() => {
        suggestionLock = false;
      }, 350);
    });
  });

  if (NETNET_STATE.autoSendPrompt) {
    const prompt = NETNET_STATE.autoSendPrompt;
    NETNET_STATE.autoSendPrompt = '';
    send(prompt);
  }

  updateSendState();
  if (msgList) msgList.scrollTop = msgList.scrollHeight;
}

function refreshPanel({ focusInput = false } = {}) {
  const drawer = document.getElementById('drawer-container');
  const shell = document.getElementById('app-shell');
  if (!drawer || !shell) return;
  drawer.innerHTML = renderNetNetDrawer();
  drawer.dataset.drawerView = 'netnet';
  shell.classList.remove('drawer-closed');
  wireNetNetPanel({ focusInput });
}

export function openNetNetPanel({ prefillPrompt, focusInput = true, autoSend = true } = {}) {
  ensureThreadLoaded();
  const drawer = document.getElementById('drawer-container');
  const shell = document.getElementById('app-shell');
  if (!drawer || !shell) {
    queueNetNetPanelOpen(prefillPrompt);
    return false;
  }
  if (typeof prefillPrompt === 'string') {
    NETNET_STATE.input = prefillPrompt;
    if (autoSend) NETNET_STATE.autoSendPrompt = prefillPrompt;
  }
  drawer.innerHTML = renderNetNetDrawer();
  drawer.dataset.drawerView = 'netnet';
  shell.classList.remove('drawer-closed');
  wireNetNetPanel({ focusInput });
  return true;
}

export function toggleNetNetPanel(options = {}) {
  const shell = document.getElementById('app-shell');
  const drawer = document.getElementById('drawer-container');
  const isOpen = shell && !shell.classList.contains('drawer-closed');
  const view = drawer?.dataset?.drawerView || '';
  if (isOpen && view === 'netnet') {
    closeDrawer();
    return;
  }
  openNetNetPanel(options);
}

export function queueNetNetPanelOpen(prefillPrompt) {
  try {
    localStorage.setItem(NETNET_PENDING_KEY, 'true');
    if (typeof prefillPrompt === 'string') {
      localStorage.setItem(NETNET_PREFILL_KEY, prefillPrompt);
    } else {
      localStorage.removeItem(NETNET_PREFILL_KEY);
    }
  } catch (e) {
    // Ignore storage errors in prototype
  }
}

export function flushNetNetPanelOpen() {
  try {
    const pending = localStorage.getItem(NETNET_PENDING_KEY) === 'true';
    if (!pending) return;
    const prefill = localStorage.getItem(NETNET_PREFILL_KEY);
    const opened = openNetNetPanel({ prefillPrompt: prefill || undefined, autoSend: true });
    if (opened) {
      localStorage.removeItem(NETNET_PENDING_KEY);
      localStorage.removeItem(NETNET_PREFILL_KEY);
    }
  } catch (e) {
    // Ignore storage errors in prototype
  }
}

export function refreshNetNetPanelIcons() {
  document.querySelectorAll('[data-netnet-icon="true"]').forEach((icon) => {
    icon.src = getNetNetIconSrc(true);
  });
}
