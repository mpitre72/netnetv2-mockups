import { SectionHeader } from '../components/layout/SectionHeader.js';
import { navigate } from '../router.js';
import { getActiveWorkspace, getCurrentRole } from '../app-shell/app-helpers.js';

const { createElement: h } = React;
const { createRoot } = ReactDOM;

const SETTINGS_TABS = [
  {
    key: 'team',
    label: 'Team',
    hash: '#/app/settings/team',
    title: 'Team',
  },
  {
    key: 'service-types',
    label: 'Service Types',
    hash: '#/app/settings/service-types',
    title: 'Service Types',
    blurb: 'Service Types and Service Groups will live here.',
  },
  {
    key: 'workspace',
    label: 'Workspace Settings',
    hash: '#/app/settings/workspace',
    title: 'Workspace Settings',
    blurb: 'Workspace name, logo, time zone, and currency will live here.',
  },
  {
    key: 'templates',
    label: 'Templates',
    hash: '#/app/settings/templates',
    title: 'Templates',
    blurb: 'Templates are coming soon.',
  },
  {
    key: 'subscription',
    label: 'Subscription',
    hash: '#/app/settings/subscription',
    title: 'Subscription',
    blurb: 'Subscription settings will live here.',
  },
  {
    key: 'terms',
    label: 'Terms & Conditions',
    hash: '#/app/settings/terms',
    title: 'Terms & Conditions',
    blurb: 'Terms & Conditions will be shown here.',
  },
];

const TEAM_UI_STATE = {
  search: '',
  status: 'active',
  role: 'all',
};

const SERVICE_TYPES_UI_STATE = {
  view: 'types',
  search: '',
  status: 'active',
  group: 'all',
  groupSearch: '',
};

const WORKSPACE_UI_STATE = {
  draft: null,
  saved: null,
};

const SUBSCRIPTION_UI_STATE = {
  draft: null,
};

const TERMS_MD_URLS = [
  'public/assets/legal/Net%20Net%20Terms%20%26%20Conditions.md',
  '/public/assets/legal/Net%20Net%20Terms%20%26%20Conditions.md',
  '/assets/legal/Net%20Net%20Terms%20%26%20Conditions.md',
];

const SUBSCRIPTION_SUBTABS = [
  {
    key: 'subscription',
    label: 'Subscription',
    hash: '#/app/settings/subscription/subscription',
  },
  {
    key: 'payment',
    label: 'Payment Info',
    hash: '#/app/settings/subscription/payment',
  },
  {
    key: 'activity',
    label: 'Activity',
    hash: '#/app/settings/subscription/activity',
  },
];

const ROLE_LABELS = {
  member: 'Member',
  lead: 'Lead',
  admin: 'Admin',
  owner: 'Owner',
};

const FALLBACK_SERVICE_TYPES = [
  { id: 'pm', name: 'Project Management', billable: false, baseRate: null, status: 'active', serviceGroupId: null },
  { id: 'design', name: 'Design', billable: true, baseRate: 0, status: 'active', serviceGroupId: null },
  { id: 'development', name: 'Development', billable: true, baseRate: 0, status: 'active', serviceGroupId: null },
  { id: 'seo', name: 'SEO', billable: true, baseRate: 0, status: 'active', serviceGroupId: null },
];

let openMenuRef = null;

function getActiveTab(tabKey) {
  return SETTINGS_TABS.find(tab => tab.key === tabKey) || SETTINGS_TABS[0];
}

function getSubscriptionSubtabFromHash() {
  const match = (location.hash || '').match(/^#\/app\/settings\/subscription\/([^/?#]+)/);
  return match ? match[1] : null;
}

function getActiveSubscriptionSubtab(subtabKey) {
  return SUBSCRIPTION_SUBTABS.find(tab => tab.key === subtabKey) || SUBSCRIPTION_SUBTABS[0];
}

function workspaceId() {
  return getActiveWorkspace()?.id || 'default';
}

function readJson(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw);
  } catch (e) {
    return fallback;
  }
}

function writeJson(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    // Ignore storage errors in prototype
  }
}

function teamKey(wsId) {
  return `netnet_ws_${wsId}_team_v1`;
}

function invitesKey(wsId) {
  return `netnet_ws_${wsId}_team_invites_v1`;
}

function serviceTypesKey(wsId) {
  return `netnet_ws_${wsId}_service_types_v1`;
}

function serviceGroupsKey(wsId) {
  return `netnet_ws_${wsId}_service_groups_v1`;
}

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

function currentUserEmail() {
  const stored = localStorage.getItem('netnet_userEmail');
  return normalizeEmail(stored || 'marc@hellonetnet.com');
}

function formatDate(iso) {
  if (!iso) return '—';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatCurrency(value) {
  if (!Number.isFinite(value)) return '—';
  const rounded = Math.round(value);
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(rounded);
}

function normalizeName(value) {
  return String(value || '').trim().toLowerCase();
}

function createId(prefix) {
  return `${prefix}_${Math.random().toString(36).slice(2, 9)}`;
}

function workspaceSettingsKey(wsId) {
  return `netnet_ws_${wsId}_workspace_settings_v1`;
}

function subscriptionKey(wsId) {
  return `netnet_ws_${wsId}_subscription_v1`;
}

function subscriptionActivityKey(wsId) {
  return `netnet_ws_${wsId}_subscription_activity_v1`;
}

function subscriptionInvoicesKey(wsId) {
  return `netnet_ws_${wsId}_subscription_invoices_v1`;
}

function normalizeWorkspaceSettings(data, workspaceName = 'Net Net') {
  return {
    name: String(data?.name || workspaceName || 'Net Net').trim() || 'Net Net',
    logoDataUrl: data?.logoDataUrl || null,
    timezone: data?.timezone || 'America/New_York',
    currency: data?.currency || 'USD',
  };
}

function loadWorkspaceSettings(wsId) {
  const workspace = getActiveWorkspace();
  const fallbackName = workspace?.name || 'Net Net';
  const stored = readJson(workspaceSettingsKey(wsId), null);
  const normalized = normalizeWorkspaceSettings(stored, fallbackName);
  if (!stored) {
    writeJson(workspaceSettingsKey(wsId), normalized);
  }
  return normalized;
}

function saveWorkspaceSettings(wsId, settings) {
  writeJson(workspaceSettingsKey(wsId), settings);
}

function formatDateTime(iso) {
  if (!iso) return '—';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function seedSubscriptionState() {
  const nextRenewal = new Date();
  nextRenewal.setDate(nextRenewal.getDate() + 30);
  return {
    cadence: 'monthly',
    planId: 'active-jobs-standard',
    planLabel: 'Active Jobs',
    priceLabel: '$30 / active job / month',
    paymentMethod: {
      brand: 'Visa',
      last4: '4242',
      expMonth: 12,
      expYear: 2027,
    },
    nextRenewalDate: nextRenewal.toISOString(),
    usage: {
      activeJobsCount: 3,
      notes: '',
    },
  };
}

function seedSubscriptionActivity() {
  const now = new Date();
  const shift = (days, hours = 0) => {
    const d = new Date(now);
    d.setDate(d.getDate() - days);
    d.setHours(d.getHours() - hours);
    return d.toISOString();
  };
  return [
    { id: createId('act'), createdAt: shift(1, 2), type: 'job_activated', message: 'Job “Net Net V2 (NEW)” — ACTIVATED' },
    { id: createId('act'), createdAt: shift(2, 3), type: 'job_deactivated', message: 'Job “Net Net V2” — ARCHIVED' },
    { id: createId('act'), createdAt: shift(4, 1), type: 'plan_changed', message: 'Plan changed — Active Jobs' },
    { id: createId('act'), createdAt: shift(7, 4), type: 'cadence_changed', message: 'Cadence changed — Monthly → Annual' },
    { id: createId('act'), createdAt: shift(9, 2), type: 'payment_updated', message: 'Payment method updated — Visa **** 4242' },
    { id: createId('act'), createdAt: shift(12, 1), type: 'invoice_paid', message: 'Invoice paid — Active Jobs subscription' },
    { id: createId('act'), createdAt: shift(15, 5), type: 'invoice_paid', message: 'Invoice paid — Active Jobs subscription' },
    { id: createId('act'), createdAt: shift(18, 2), type: 'invoice_failed', message: 'Invoice failed — Card requires update' },
  ];
}

function seedSubscriptionInvoices() {
  const now = new Date();
  const shift = (months) => {
    const d = new Date(now);
    d.setMonth(d.getMonth() - months);
    return d.toISOString();
  };
  return [
    { id: createId('inv'), date: shift(0), amount: '$90.00', status: 'paid', label: 'Monthly subscription', url: null },
    { id: createId('inv'), date: shift(1), amount: '$90.00', status: 'paid', label: 'Monthly subscription', url: null },
    { id: createId('inv'), date: shift(2), amount: '$90.00', status: 'due', label: 'Monthly subscription', url: null },
    { id: createId('inv'), date: shift(3), amount: '$90.00', status: 'paid', label: 'Monthly subscription', url: null },
  ];
}

function loadSubscriptionState(wsId) {
  const stored = readJson(subscriptionKey(wsId), null);
  if (stored) return stored;
  const seeded = seedSubscriptionState();
  writeJson(subscriptionKey(wsId), seeded);
  return seeded;
}

function saveSubscriptionState(wsId, state) {
  writeJson(subscriptionKey(wsId), state);
}

function loadSubscriptionActivity(wsId) {
  const stored = readJson(subscriptionActivityKey(wsId), null);
  if (Array.isArray(stored) && stored.length) return stored;
  const seeded = seedSubscriptionActivity();
  writeJson(subscriptionActivityKey(wsId), seeded);
  return seeded;
}

function saveSubscriptionActivity(wsId, events) {
  writeJson(subscriptionActivityKey(wsId), events);
}

function loadSubscriptionInvoices(wsId) {
  const stored = readJson(subscriptionInvoicesKey(wsId), null);
  if (Array.isArray(stored) && stored.length) return stored;
  const seeded = seedSubscriptionInvoices();
  writeJson(subscriptionInvoicesKey(wsId), seeded);
  return seeded;
}

function saveSubscriptionInvoices(wsId, invoices) {
  writeJson(subscriptionInvoicesKey(wsId), invoices);
}

function hasWorkspaceChanges(draft, saved) {
  if (!draft || !saved) return false;
  return ['name', 'logoDataUrl', 'timezone', 'currency']
    .some((key) => (draft[key] || null) !== (saved[key] || null));
}

function loadTeamMembersRaw(wsId) {
  const data = readJson(teamKey(wsId), []);
  return Array.isArray(data) ? data : [];
}

function isServiceTypeUsed(wsId, typeId) {
  const members = loadTeamMembersRaw(wsId);
  return members.some(member => Array.isArray(member.typicalServiceTypeIds)
    && member.typicalServiceTypeIds.includes(typeId));
}

const LEGACY_TEAM_EMAILS = new Set([
  'marc@netnet.com',
  'jade@netnet.com',
  'sam@netnet.com',
  'avery@netnet.com',
]);
const LEGACY_INVITE_EMAILS = new Set([
  'nina@netnet.com',
  'pat@netnet.com',
]);
const LEGACY_SERVICE_TYPE_IDS = new Set([
  'branding',
  'web',
  'dev',
  'video',
  'print',
]);

function isLegacyTeamSeed(list) {
  if (!Array.isArray(list) || list.length !== LEGACY_TEAM_EMAILS.size) return false;
  return list.every(member => LEGACY_TEAM_EMAILS.has(normalizeEmail(member.email)));
}

function isLegacyInviteSeed(list) {
  if (!Array.isArray(list) || list.length !== LEGACY_INVITE_EMAILS.size) return false;
  return list.every(invite => LEGACY_INVITE_EMAILS.has(normalizeEmail(invite.email)));
}

function isLegacyServiceTypes(list) {
  if (!Array.isArray(list) || list.length !== LEGACY_SERVICE_TYPE_IDS.size) return false;
  return list.every(item => LEGACY_SERVICE_TYPE_IDS.has(String(item.id)));
}

function ensureTeamSeed(wsId) {
  const seed = [
    {
      id: 'team_marc_pitre',
      name: 'Marc Pitre',
      email: 'marc@hellonetnet.com',
      role: 'owner',
      status: 'active',
      monthlyCapacityHours: 40,
      monthlySeatCost: 18700,
      typicalServiceTypeIds: ['pm', 'design'],
    },
    {
      id: 'team_arthur_iturres',
      name: 'Arthur Iturres',
      email: 'arthur@hellonetnet.com',
      role: 'owner',
      status: 'active',
      monthlyCapacityHours: 40,
      monthlySeatCost: 10450,
      typicalServiceTypeIds: ['development'],
    },
    {
      id: 'team_andres_naranjo',
      name: 'Andres Naranjo',
      email: 'andres@hellonetnet.com',
      role: 'owner',
      status: 'active',
      monthlyCapacityHours: 40,
      monthlySeatCost: 7950,
      typicalServiceTypeIds: ['development'],
    },
    {
      id: 'team_kumail_abas',
      name: 'Kumail Abas',
      email: 'ceo@itkumail.com',
      role: 'admin',
      status: 'active',
      monthlyCapacityHours: 20,
      monthlySeatCost: 3250,
      typicalServiceTypeIds: ['design', 'seo', 'pm'],
    },
  ];
  const existing = readJson(teamKey(wsId), null);
  if (Array.isArray(existing) && existing.length) {
    if (isLegacyTeamSeed(existing)) {
      writeJson(teamKey(wsId), seed);
      return seed;
    }
    return existing;
  }
  writeJson(teamKey(wsId), seed);
  return seed;
}

function ensureInvitesSeed(wsId) {
  const now = new Date().toISOString();
  const seed = [
    {
      id: 'invite_bishwajit_halder',
      name: 'Bishwajit Halder',
      email: 'bishwajit@righthereinteractive.com',
      role: 'member',
      invitedAt: now,
      lastSentAt: now,
    },
    {
      id: 'invite_marcos_barreto',
      name: 'Marcos Barreto',
      email: 'marcos@righthereinteractive.com',
      role: 'member',
      invitedAt: now,
      lastSentAt: now,
    },
  ];
  const existing = readJson(invitesKey(wsId), null);
  if (Array.isArray(existing) && existing.length) {
    if (isLegacyInviteSeed(existing)) {
      writeJson(invitesKey(wsId), seed);
      return seed;
    }
    return existing;
  }
  writeJson(invitesKey(wsId), seed);
  return seed;
}

function ensureServiceTypesSeed(wsId) {
  const existing = readJson(serviceTypesKey(wsId), null);
  if (Array.isArray(existing) && existing.length) {
    if (isLegacyServiceTypes(existing)) {
      writeJson(serviceTypesKey(wsId), FALLBACK_SERVICE_TYPES);
      return FALLBACK_SERVICE_TYPES;
    }
    return existing;
  }
  writeJson(serviceTypesKey(wsId), FALLBACK_SERVICE_TYPES);
  return FALLBACK_SERVICE_TYPES;
}

function ensureServiceGroupsSeed(wsId) {
  const existing = readJson(serviceGroupsKey(wsId), null);
  if (Array.isArray(existing)) return existing;
  writeJson(serviceGroupsKey(wsId), []);
  return [];
}

function loadTeamMembers(wsId) {
  const members = ensureTeamSeed(wsId);
  return members.map(member => ({
    ...member,
    monthlyCapacityHours: Number.isFinite(member.monthlyCapacityHours) ? member.monthlyCapacityHours : null,
    monthlySeatCost: Number.isFinite(member.monthlySeatCost) ? member.monthlySeatCost : null,
    typicalServiceTypeIds: Array.isArray(member.typicalServiceTypeIds) ? member.typicalServiceTypeIds : [],
  }));
}

function saveTeamMembers(wsId, members) {
  writeJson(teamKey(wsId), members);
}

function loadInvites(wsId) {
  return ensureInvitesSeed(wsId);
}

function saveInvites(wsId, invites) {
  writeJson(invitesKey(wsId), invites);
}

function loadServiceTypes(wsId) {
  const list = ensureServiceTypesSeed(wsId);
  return list.map(item => {
    const active = item.active !== false && item.status !== 'inactive';
    return { ...item, active };
  });
}

function saveServiceTypes(wsId, types) {
  writeJson(serviceTypesKey(wsId), types);
}

function loadServiceGroups(wsId) {
  return ensureServiceGroupsSeed(wsId);
}

function saveServiceGroups(wsId, groups) {
  writeJson(serviceGroupsKey(wsId), groups);
}

function showToast(msg) {
  if (typeof window?.showToast === 'function') {
    window.showToast(msg);
  }
}

function ensureModalLayer(id) {
  let layer = document.getElementById(id);
  if (!layer) {
    layer = document.createElement('div');
    layer.id = id;
    document.body.appendChild(layer);
  }
  return layer;
}

function showConfirmModal({ title, message, confirmLabel = 'Confirm', cancelLabel = 'Cancel', onConfirm }) {
  const layer = ensureModalLayer('settings-confirm-layer');
  layer.innerHTML = `
    <div class="nn-modal-overlay" role="presentation">
      <div class="nn-modal-card" role="dialog" aria-modal="true" aria-label="${title}">
        <div class="lookup-modal__header">
          <h3>${title}</h3>
        </div>
        <p class="lookup-modal__body">${message}</p>
        <div class="lookup-modal__actions">
          <button type="button" class="lookup-btn ghost" data-action="cancel">${cancelLabel}</button>
          <button type="button" class="lookup-btn primary" data-action="confirm">${confirmLabel}</button>
        </div>
      </div>
    </div>
  `;
  const overlay = layer.querySelector('.nn-modal-overlay');
  const hide = () => { layer.innerHTML = ''; };
  overlay.onclick = (e) => { if (e.target === overlay) hide(); };
  layer.querySelector('[data-action="cancel"]').onclick = hide;
  layer.querySelector('[data-action="confirm"]').onclick = () => {
    hide();
    if (onConfirm) onConfirm();
  };
}

function showChoiceModal({ title, message, confirmLabel = 'Confirm', cancelLabel = 'Cancel', onConfirm }) {
  const layer = ensureModalLayer('settings-choice-layer');
  layer.innerHTML = `
    <div class="nn-modal-overlay" role="presentation">
      <div class="nn-modal-card" role="dialog" aria-modal="true" aria-label="${title}">
        <div class="lookup-modal__header">
          <h3>${title}</h3>
        </div>
        <p class="lookup-modal__body">${message}</p>
        <div class="lookup-modal__actions">
          <button type="button" class="lookup-btn ghost" data-action="cancel">${cancelLabel}</button>
          <button type="button" class="lookup-btn primary" data-action="confirm">${confirmLabel}</button>
        </div>
      </div>
    </div>
  `;
  const overlay = layer.querySelector('.nn-modal-overlay');
  const hide = () => { layer.innerHTML = ''; };
  overlay.onclick = (e) => { if (e.target === overlay) hide(); };
  layer.querySelector('[data-action="cancel"]').onclick = hide;
  layer.querySelector('[data-action="confirm"]').onclick = () => {
    hide();
    if (onConfirm) onConfirm();
  };
}

function closeMenu() {
  if (!openMenuRef) return;
  const { menu, cleanup } = openMenuRef;
  if (menu && menu.parentElement) menu.parentElement.removeChild(menu);
  if (cleanup) cleanup();
  openMenuRef = null;
}

function openMenu(buttonEl, items) {
  closeMenu();
  const menu = document.createElement('div');
  menu.className = 'absolute right-0 mt-2 w-44 rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 shadow-xl text-sm overflow-hidden z-40';
  menu.innerHTML = items.map(item => `
    <button type="button" data-key="${item.key}" ${item.disabled ? 'disabled' : ''} class="w-full text-left px-3 py-2 ${item.disabled ? 'opacity-60 cursor-not-allowed' : 'hover:bg-slate-100 dark:hover:bg-white/10'} ${item.danger ? 'text-red-600 dark:text-red-400' : 'text-slate-700 dark:text-slate-200'}" title="${item.title || ''}">
      ${item.label}
    </button>
  `).join('');
  const cleanup = () => {
    document.removeEventListener('click', onClickAway, true);
    document.removeEventListener('keydown', onKey, true);
  };
  const onClickAway = (e) => {
    if (!menu.contains(e.target) && e.target !== buttonEl) closeMenu();
  };
  const onKey = (e) => {
    if (e.key === 'Escape') closeMenu();
  };
  menu.querySelectorAll('button[data-key]').forEach(btn => {
    btn.onclick = () => {
      const key = btn.getAttribute('data-key');
      const found = items.find(item => item.key === key);
      if (found?.disabled) return;
      closeMenu();
      if (found && typeof found.onClick === 'function') found.onClick();
    };
  });
  buttonEl.parentElement.style.position = 'relative';
  buttonEl.parentElement.appendChild(menu);
  openMenuRef = { menu, cleanup };
  setTimeout(() => {
    document.addEventListener('click', onClickAway, true);
    document.addEventListener('keydown', onKey, true);
  }, 0);
}

function renderEmptyState(message) {
  return `
    <div class="px-6 py-10 text-center text-sm text-slate-500 dark:text-slate-400">
      ${message}
    </div>
  `;
}

function renderTeamTab(container) {
  const wsId = workspaceId();
  const role = getCurrentRole();
  const canSeeSeatCost = role === 'owner';
  const members = loadTeamMembers(wsId);
  const invites = loadInvites(wsId);
  const serviceTypes = loadServiceTypes(wsId);

  const search = TEAM_UI_STATE.search.trim().toLowerCase();
  const statusFilter = TEAM_UI_STATE.status;
  const roleFilter = TEAM_UI_STATE.role;
  const filtered = members.filter(member => {
    if (statusFilter !== 'all' && member.status !== statusFilter) return false;
    if (roleFilter !== 'all' && member.role !== roleFilter) return false;
    if (search) {
      const hay = `${member.name || ''} ${member.email || ''}`.toLowerCase();
      if (!hay.includes(search)) return false;
    }
    return true;
  });

  const memberRows = filtered.length
    ? filtered.map(member => {
      const typeCount = member.typicalServiceTypeIds?.length || 0;
      const capacity = Number.isFinite(member.monthlyCapacityHours) ? `${member.monthlyCapacityHours}h` : '—';
      const seatCost = formatCurrency(member.monthlySeatCost);
      const statusBadge = member.status === 'active'
        ? '<span class="px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300">Active</span>'
        : '<span class="px-2 py-0.5 rounded-full text-xs font-medium bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-200">Deactivated</span>';
      return `
        <tr class="border-b border-slate-200 dark:border-white/10">
          <td class="px-4 py-3 text-sm font-medium text-slate-900 dark:text-white">
            <button type="button" class="text-netnet-purple dark:text-white hover:underline" data-member-open="${member.id}">${member.name || 'Unnamed'}</button>
          </td>
          <td class="px-4 py-3 text-sm text-slate-600 dark:text-slate-300">${member.email || '—'}</td>
          <td class="px-4 py-3 text-sm text-slate-700 dark:text-slate-200">${ROLE_LABELS[member.role] || member.role}</td>
          <td class="px-4 py-3 text-sm">${statusBadge}</td>
          <td class="px-4 py-3 text-sm text-slate-700 dark:text-slate-200">${capacity}</td>
          <td class="px-4 py-3 text-sm text-slate-600 dark:text-slate-300">${typeCount ? `${typeCount} selected` : '—'}</td>
          ${canSeeSeatCost ? `<td class="px-4 py-3 text-sm text-slate-700 dark:text-slate-200">${seatCost}</td>` : ''}
          <td class="px-3 py-3 text-right">
            <button type="button" class="team-more-btn h-8 w-8 rounded-md border border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/10" data-member-menu="${member.id}" aria-label="Member actions">
              &#8942;
            </button>
          </td>
        </tr>
      `;
    }).join('')
    : renderEmptyState('No team members match the current filters.');

  const inviteRows = invites.map(invite => `
    <tr class="border-b border-slate-200 dark:border-white/10">
      <td class="px-4 py-3 text-sm text-netnet-purple dark:text-white">${invite.name || '—'}</td>
      <td class="px-4 py-3 text-sm text-slate-700 dark:text-slate-200">${invite.email}</td>
      <td class="px-4 py-3 text-sm text-slate-700 dark:text-slate-200">${ROLE_LABELS[invite.role || 'member']}</td>
      <td class="px-4 py-3 text-sm text-slate-600 dark:text-slate-300">${formatDate(invite.invitedAt)}</td>
      <td class="px-4 py-3 text-sm text-slate-600 dark:text-slate-300">${formatDate(invite.lastSentAt)}</td>
      <td class="px-3 py-3 text-right">
        <button type="button" class="invite-more-btn h-8 w-8 rounded-md border border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/10" data-invite-menu="${invite.id}" aria-label="Invite actions">
          &#8942;
        </button>
      </td>
    </tr>
  `).join('');

  container.innerHTML = `
    <div class="space-y-6">
      <div class="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div class="flex flex-col gap-2 md:flex-row md:items-center md:gap-3 flex-1">
          <input id="team-search" type="search" placeholder="Search team…" value="${TEAM_UI_STATE.search}" class="h-10 w-full md:w-64 rounded-md border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 text-slate-900 dark:text-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-netnet-purple"/>
          <select id="team-status-filter" class="h-10 rounded-md border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-netnet-purple">
            <option value="active" ${statusFilter === 'active' ? 'selected' : ''}>Active</option>
            <option value="deactivated" ${statusFilter === 'deactivated' ? 'selected' : ''}>Deactivated</option>
            <option value="all" ${statusFilter === 'all' ? 'selected' : ''}>All</option>
          </select>
          <select id="team-role-filter" class="h-10 rounded-md border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-netnet-purple">
            <option value="all" ${roleFilter === 'all' ? 'selected' : ''}>All roles</option>
            <option value="member" ${roleFilter === 'member' ? 'selected' : ''}>Member</option>
            <option value="lead" ${roleFilter === 'lead' ? 'selected' : ''}>Lead</option>
            <option value="admin" ${roleFilter === 'admin' ? 'selected' : ''}>Admin</option>
            <option value="owner" ${roleFilter === 'owner' ? 'selected' : ''}>Owner</option>
          </select>
        </div>
        <button id="team-invite-btn" type="button" class="inline-flex items-center justify-center h-10 px-4 rounded-md bg-netnet-purple text-white text-sm font-semibold hover:brightness-110">
          Invite
        </button>
      </div>

      <div class="rounded-2xl border border-slate-200 dark:border-white/10 bg-white/90 dark:bg-slate-800/90 shadow-sm overflow-hidden">
        <div class="overflow-x-auto">
          <table class="w-full text-left border-collapse">
            <thead class="bg-slate-50 dark:bg-slate-900/60 text-xs uppercase text-slate-500 dark:text-slate-400 font-semibold">
              <tr>
                <th class="px-4 py-3 border-b border-slate-200 dark:border-white/10">Name</th>
                <th class="px-4 py-3 border-b border-slate-200 dark:border-white/10">Email</th>
                <th class="px-4 py-3 border-b border-slate-200 dark:border-white/10">Role</th>
                <th class="px-4 py-3 border-b border-slate-200 dark:border-white/10">Status</th>
                <th class="px-4 py-3 border-b border-slate-200 dark:border-white/10">Monthly capacity</th>
                <th class="px-4 py-3 border-b border-slate-200 dark:border-white/10">Typical service types</th>
                ${canSeeSeatCost ? '<th class="px-4 py-3 border-b border-slate-200 dark:border-white/10">Monthly seat cost</th>' : ''}
                <th class="px-3 py-3 border-b border-slate-200 dark:border-white/10 text-right"></th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-200 dark:divide-white/10">
              ${memberRows}
            </tbody>
          </table>
        </div>
      </div>

      ${invites.length ? `
        <div class="space-y-3">
          <div class="flex items-center justify-between">
            <h3 class="text-base font-semibold text-slate-900 dark:text-white">Pending Invites</h3>
            <span class="text-xs text-slate-500 dark:text-slate-400">${invites.length} pending</span>
          </div>
          <div class="rounded-2xl border border-slate-200 dark:border-white/10 bg-white/90 dark:bg-slate-800/90 shadow-sm overflow-hidden">
            <div class="overflow-x-auto">
              <table class="w-full text-left border-collapse">
                <thead class="bg-slate-50 dark:bg-slate-900/60 text-xs uppercase text-slate-500 dark:text-slate-400 font-semibold">
                  <tr>
                    <th class="px-4 py-3 border-b border-slate-200 dark:border-white/10">Name</th>
                    <th class="px-4 py-3 border-b border-slate-200 dark:border-white/10">Email</th>
                    <th class="px-4 py-3 border-b border-slate-200 dark:border-white/10">Role</th>
                    <th class="px-4 py-3 border-b border-slate-200 dark:border-white/10">Invited</th>
                    <th class="px-4 py-3 border-b border-slate-200 dark:border-white/10">Last sent</th>
                    <th class="px-3 py-3 border-b border-slate-200 dark:border-white/10 text-right"></th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-slate-200 dark:divide-white/10">
                  ${inviteRows}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ` : ''}
    </div>
  `;

  const searchInput = container.querySelector('#team-search');
  const statusSelect = container.querySelector('#team-status-filter');
  const roleSelect = container.querySelector('#team-role-filter');
  const inviteBtn = container.querySelector('#team-invite-btn');
  if (searchInput) {
    searchInput.oninput = (e) => {
      TEAM_UI_STATE.search = e.target.value || '';
      renderTeamTab(container);
    };
  }
  if (statusSelect) {
    statusSelect.onchange = (e) => {
      TEAM_UI_STATE.status = e.target.value || 'active';
      renderTeamTab(container);
    };
  }
  if (roleSelect) {
    roleSelect.onchange = (e) => {
      TEAM_UI_STATE.role = e.target.value || 'all';
      renderTeamTab(container);
    };
  }
  if (inviteBtn) {
    inviteBtn.onclick = () => openInviteModal(wsId, role);
  }

  container.querySelectorAll('[data-member-open]').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-member-open');
      if (id) openMemberDrawer(wsId, id);
    });
  });

  container.querySelectorAll('[data-member-menu]').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-member-menu');
      if (!id) return;
      const member = members.find(m => m.id === id);
      if (!member) return;
      const menuItems = [
        { key: 'edit', label: 'Edit', onClick: () => openMemberDrawer(wsId, member.id) },
        member.status === 'active'
          ? { key: 'deactivate', label: 'Deactivate', danger: true, onClick: () => handleDeactivate(wsId, member) }
          : { key: 'reactivate', label: 'Reactivate', onClick: () => handleReactivate(wsId, member) },
      ];
      openMenu(btn, menuItems);
    });
  });

  container.querySelectorAll('[data-invite-menu]').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-invite-menu');
      if (!id) return;
      const invite = invites.find(i => i.id === id);
      if (!invite) return;
      openMenu(btn, [
        { key: 'resend', label: 'Resend invite', onClick: () => handleResendInvite(wsId, invite) },
        { key: 'delete', label: 'Delete invite', danger: true, onClick: () => handleDeleteInvite(wsId, invite) },
      ]);
    });
  });
}

function normalizeServiceType(type) {
  const status = type.status || (type.active === false ? 'inactive' : 'active');
  const billable = Boolean(type.billable);
  const baseRate = Number.isFinite(type.baseRate) ? type.baseRate : null;
  return {
    id: type.id,
    name: type.name || '',
    description: type.description || '',
    billable,
    baseRate: billable ? baseRate : null,
    status,
    serviceGroupId: type.serviceGroupId || null,
  };
}

function normalizeServiceGroup(group) {
  return {
    id: group.id,
    name: group.name || '',
    description: group.description || '',
  };
}

function renderServiceTypesTab(container) {
  const wsId = workspaceId();
  const rawTypes = loadServiceTypes(wsId);
  const rawGroups = loadServiceGroups(wsId);
  const types = rawTypes.map(normalizeServiceType);
  const groups = rawGroups.map(normalizeServiceGroup);
  const view = SERVICE_TYPES_UI_STATE.view;

  const groupMap = new Map(groups.map(group => [group.id, group]));

  const statusFilter = SERVICE_TYPES_UI_STATE.status;
  const groupFilter = SERVICE_TYPES_UI_STATE.group;
  const search = SERVICE_TYPES_UI_STATE.search.trim().toLowerCase();

  const filteredTypes = types.filter(type => {
    if (statusFilter !== 'all' && type.status !== statusFilter) return false;
    if (groupFilter !== 'all') {
      if (groupFilter === 'ungrouped' && type.serviceGroupId) return false;
      if (groupFilter !== 'ungrouped' && type.serviceGroupId !== groupFilter) return false;
    }
    if (search) {
      const hay = `${type.name} ${type.description}`.toLowerCase();
      if (!hay.includes(search)) return false;
    }
    return true;
  });

  const groupSearch = SERVICE_TYPES_UI_STATE.groupSearch.trim().toLowerCase();
  const filteredGroups = groups.filter(group => {
    if (!groupSearch) return true;
    const hay = `${group.name} ${group.description}`.toLowerCase();
    return hay.includes(groupSearch);
  });

  const typesRows = filteredTypes.length
    ? filteredTypes.map(type => {
      const groupName = type.serviceGroupId ? (groupMap.get(type.serviceGroupId)?.name || '—') : '—';
      const billableLabel = type.billable ? 'Yes' : 'No';
      const baseRateLabel = type.billable ? formatCurrency(type.baseRate) : '—';
      const statusBadge = type.status === 'active'
        ? '<span class="px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300">Active</span>'
        : '<span class="px-2 py-0.5 rounded-full text-xs font-medium bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-200">Inactive</span>';
      return `
        <tr class="border-b border-slate-200 dark:border-white/10">
          <td class="px-4 py-3 text-sm font-medium text-slate-900 dark:text-white">
            <button type="button" class="text-netnet-purple dark:text-white hover:underline" data-service-type-open="${type.id}">${type.name || 'Untitled'}</button>
          </td>
          <td class="px-4 py-3 text-sm text-slate-600 dark:text-slate-300">${groupName}</td>
          <td class="px-4 py-3 text-sm text-slate-700 dark:text-slate-200">${billableLabel}</td>
          <td class="px-4 py-3 text-sm text-slate-700 dark:text-slate-200">${baseRateLabel}</td>
          <td class="px-4 py-3 text-sm">${statusBadge}</td>
          <td class="px-3 py-3 text-right">
            <button type="button" class="service-type-more-btn h-8 w-8 rounded-md border border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/10" data-service-type-menu="${type.id}" aria-label="Service type actions">
              &#8942;
            </button>
          </td>
        </tr>
      `;
    }).join('')
    : renderEmptyState('No service types match the current filters.');

  const groupRows = filteredGroups.length
    ? filteredGroups.map(group => {
      const count = types.filter(type => type.serviceGroupId === group.id).length;
      return `
        <tr class="border-b border-slate-200 dark:border-white/10">
          <td class="px-4 py-3 text-sm font-medium text-slate-900 dark:text-white">
            <button type="button" class="text-netnet-purple dark:text-white hover:underline" data-service-group-open="${group.id}">${group.name || 'Untitled'}</button>
          </td>
          <td class="px-4 py-3 text-sm text-slate-600 dark:text-slate-300">${group.description || '—'}</td>
          <td class="px-4 py-3 text-sm text-slate-700 dark:text-slate-200">${count}</td>
          <td class="px-3 py-3 text-right">
            <button type="button" class="service-group-more-btn h-8 w-8 rounded-md border border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/10" data-service-group-menu="${group.id}" aria-label="Service group actions">
              &#8942;
            </button>
          </td>
        </tr>
      `;
    }).join('')
    : renderEmptyState('No service groups match the current search.');

  container.innerHTML = `
    <div class="space-y-6">
      <div class="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div class="flex flex-wrap items-center gap-2">
          <div class="inline-flex items-center gap-1 rounded-full border border-slate-200 dark:border-white/10 bg-white/80 dark:bg-slate-900/60 px-1 py-1">
            <button type="button" data-service-toggle="types" class="px-3 py-1 rounded-full text-sm font-medium ${view === 'types' ? 'bg-netnet-purple text-white' : 'text-slate-700 dark:text-slate-200'}">Service Types</button>
            <button type="button" data-service-toggle="groups" class="px-3 py-1 rounded-full text-sm font-medium ${view === 'groups' ? 'bg-netnet-purple text-white' : 'text-slate-700 dark:text-slate-200'}">Service Groups</button>
          </div>
          ${view === 'types' ? `
            <input id="service-types-search" type="search" placeholder="Search service types…" value="${SERVICE_TYPES_UI_STATE.search}" class="h-10 w-full md:w-64 rounded-md border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 text-slate-900 dark:text-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-netnet-purple"/>
            <select id="service-types-status-filter" class="h-10 rounded-md border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-netnet-purple">
              <option value="active" ${statusFilter === 'active' ? 'selected' : ''}>Active</option>
              <option value="inactive" ${statusFilter === 'inactive' ? 'selected' : ''}>Inactive</option>
              <option value="all" ${statusFilter === 'all' ? 'selected' : ''}>All</option>
            </select>
            <select id="service-types-group-filter" class="h-10 rounded-md border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-netnet-purple">
              <option value="all" ${groupFilter === 'all' ? 'selected' : ''}>All groups</option>
              <option value="ungrouped" ${groupFilter === 'ungrouped' ? 'selected' : ''}>Ungrouped</option>
              ${groups.map(group => `<option value="${group.id}" ${groupFilter === group.id ? 'selected' : ''}>${group.name}</option>`).join('')}
            </select>
          ` : `
            <input id="service-groups-search" type="search" placeholder="Search service groups…" value="${SERVICE_TYPES_UI_STATE.groupSearch}" class="h-10 w-full md:w-64 rounded-md border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 text-slate-900 dark:text-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-netnet-purple"/>
            <span class="text-xs text-slate-500 dark:text-slate-400">Service Groups are optional. Use them to organize Service Types.</span>
          `}
        </div>
        <button id="service-types-primary-btn" type="button" class="inline-flex items-center justify-center h-10 px-4 rounded-md bg-netnet-purple text-white text-sm font-semibold hover:brightness-110">
          ${view === 'types' ? 'New service type' : 'New group'}
        </button>
      </div>

      <div class="rounded-2xl border border-slate-200 dark:border-white/10 bg-white/90 dark:bg-slate-800/90 shadow-sm overflow-hidden">
        <div class="overflow-x-auto">
          ${view === 'types' ? `
            <table class="w-full text-left border-collapse">
              <thead class="bg-slate-50 dark:bg-slate-900/60 text-xs uppercase text-slate-500 dark:text-slate-400 font-semibold">
                <tr>
                  <th class="px-4 py-3 border-b border-slate-200 dark:border-white/10">Name</th>
                  <th class="px-4 py-3 border-b border-slate-200 dark:border-white/10">Service group</th>
                  <th class="px-4 py-3 border-b border-slate-200 dark:border-white/10">Billable</th>
                  <th class="px-4 py-3 border-b border-slate-200 dark:border-white/10">Base rate</th>
                  <th class="px-4 py-3 border-b border-slate-200 dark:border-white/10">Status</th>
                  <th class="px-3 py-3 border-b border-slate-200 dark:border-white/10 text-right"></th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-200 dark:divide-white/10">
                ${typesRows}
              </tbody>
            </table>
          ` : `
            <table class="w-full text-left border-collapse">
              <thead class="bg-slate-50 dark:bg-slate-900/60 text-xs uppercase text-slate-500 dark:text-slate-400 font-semibold">
                <tr>
                  <th class="px-4 py-3 border-b border-slate-200 dark:border-white/10">Name</th>
                  <th class="px-4 py-3 border-b border-slate-200 dark:border-white/10">Description</th>
                  <th class="px-4 py-3 border-b border-slate-200 dark:border-white/10">Service types</th>
                  <th class="px-3 py-3 border-b border-slate-200 dark:border-white/10 text-right"></th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-200 dark:divide-white/10">
                ${groupRows}
              </tbody>
            </table>
          `}
        </div>
      </div>
    </div>
  `;

  container.querySelectorAll('[data-service-toggle]').forEach(btn => {
    btn.addEventListener('click', () => {
      const next = btn.getAttribute('data-service-toggle');
      if (!next || next === SERVICE_TYPES_UI_STATE.view) return;
      SERVICE_TYPES_UI_STATE.view = next;
      renderServiceTypesTab(container);
    });
  });

  if (view === 'types') {
    container.querySelector('#service-types-search')?.addEventListener('input', (e) => {
      SERVICE_TYPES_UI_STATE.search = e.target.value || '';
      renderServiceTypesTab(container);
    });
    container.querySelector('#service-types-status-filter')?.addEventListener('change', (e) => {
      SERVICE_TYPES_UI_STATE.status = e.target.value || 'active';
      renderServiceTypesTab(container);
    });
    container.querySelector('#service-types-group-filter')?.addEventListener('change', (e) => {
      SERVICE_TYPES_UI_STATE.group = e.target.value || 'all';
      renderServiceTypesTab(container);
    });
    container.querySelector('#service-types-primary-btn')?.addEventListener('click', () => {
      openServiceTypeDrawer(wsId);
    });
    container.querySelectorAll('[data-service-type-open]').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-service-type-open');
        if (!id) return;
        const type = types.find(t => t.id === id);
        if (type) openServiceTypeDrawer(wsId, type);
      });
    });
    container.querySelectorAll('[data-service-type-menu]').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-service-type-menu');
        if (!id) return;
        const type = types.find(t => t.id === id);
        if (!type) return;
        const used = isServiceTypeUsed(wsId, type.id);
        const menuItems = [
          { key: 'edit', label: 'Edit', onClick: () => openServiceTypeDrawer(wsId, type) },
          type.status === 'active'
            ? { key: 'deactivate', label: 'Deactivate', danger: true, onClick: () => handleDeactivateServiceType(wsId, type) }
            : { key: 'reactivate', label: 'Reactivate', onClick: () => handleReactivateServiceType(wsId, type) },
          {
            key: 'delete',
            label: 'Delete',
            danger: true,
            disabled: used,
            title: used ? 'Used in historical data. Deactivate instead.' : '',
            onClick: () => handleDeleteServiceType(wsId, type),
          },
        ];
        openMenu(btn, menuItems);
      });
    });
  } else {
    container.querySelector('#service-groups-search')?.addEventListener('input', (e) => {
      SERVICE_TYPES_UI_STATE.groupSearch = e.target.value || '';
      renderServiceTypesTab(container);
    });
    container.querySelector('#service-types-primary-btn')?.addEventListener('click', () => {
      openServiceGroupDrawer(wsId);
    });
    container.querySelectorAll('[data-service-group-open]').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-service-group-open');
        if (!id) return;
        const group = groups.find(g => g.id === id);
        if (group) openServiceGroupDrawer(wsId, group);
      });
    });
    container.querySelectorAll('[data-service-group-menu]').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-service-group-menu');
        if (!id) return;
        const group = groups.find(g => g.id === id);
        if (!group) return;
        const menuItems = [
          { key: 'edit', label: 'Edit', onClick: () => openServiceGroupDrawer(wsId, group) },
          { key: 'delete', label: 'Delete', danger: true, onClick: () => handleDeleteServiceGroup(wsId, group) },
        ];
        openMenu(btn, menuItems);
      });
    });
  }
}

function handleDeactivateServiceType(wsId, type) {
  showConfirmModal({
    title: 'Deactivate service type?',
    message: 'It will no longer be selectable for new work, but stays in reporting and history.',
    confirmLabel: 'Deactivate',
    onConfirm: () => {
      const types = loadServiceTypes(wsId).map(normalizeServiceType);
      const target = types.find(t => t.id === type.id);
      if (!target) return;
      target.status = 'inactive';
      saveServiceTypes(wsId, types);
      showToast('Service type deactivated');
      const container = document.getElementById('settingsServiceTypesRoot');
      if (container) renderServiceTypesTab(container);
    },
  });
}

function handleReactivateServiceType(wsId, type) {
  showConfirmModal({
    title: 'Reactivate service type?',
    message: 'It will be selectable for new work again.',
    confirmLabel: 'Reactivate',
    onConfirm: () => {
      const types = loadServiceTypes(wsId).map(normalizeServiceType);
      const target = types.find(t => t.id === type.id);
      if (!target) return;
      target.status = 'active';
      saveServiceTypes(wsId, types);
      showToast('Service type reactivated');
      const container = document.getElementById('settingsServiceTypesRoot');
      if (container) renderServiceTypesTab(container);
    },
  });
}

function handleDeleteServiceType(wsId, type) {
  if (isServiceTypeUsed(wsId, type.id)) {
    showToast('Used in historical data. Deactivate instead.');
    return;
  }
  showConfirmModal({
    title: 'Delete service type?',
    message: 'This action is irreversible.',
    confirmLabel: 'Delete',
    onConfirm: () => {
      const next = loadServiceTypes(wsId).map(normalizeServiceType).filter(t => t.id !== type.id);
      saveServiceTypes(wsId, next);
      showToast('Service type deleted');
      const container = document.getElementById('settingsServiceTypesRoot');
      if (container) renderServiceTypesTab(container);
    },
  });
}

function openServiceTypeDrawer(wsId, existingType = null) {
  const types = loadServiceTypes(wsId).map(normalizeServiceType);
  const groups = loadServiceGroups(wsId).map(normalizeServiceGroup);
  const isNew = !existingType;
  const draft = existingType
    ? { ...existingType }
    : {
      id: createId('service_type'),
      name: '',
      description: '',
      billable: true,
      baseRate: null,
      status: 'active',
      serviceGroupId: null,
    };

  const drawer = document.getElementById('drawer-container');
  const shell = document.getElementById('app-shell');
  if (!drawer) return;
  drawer.innerHTML = `
    <div id="app-drawer-backdrop"></div>
    <aside id="app-drawer" class="bg-white dark:bg-slate-900 text-slate-900 dark:text-white p-0 flex flex-col w-full max-w-md">
      <div class="flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-white/10">
        <div>
          <h2 class="text-lg font-semibold">${isNew ? 'New service type' : 'Edit service type'}</h2>
          <p class="text-xs text-slate-500 dark:text-white/60">${isNew ? 'Create a service type.' : draft.name}</p>
        </div>
        <button type="button" id="drawerCloseBtn" class="text-slate-500 hover:text-slate-800 dark:text-white/70 dark:hover:text-white">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </div>
      <div class="flex-1 overflow-y-auto px-5 py-4 space-y-4">
        <div>
          <label class="lookup-modal__label">Name</label>
          <input id="service-type-name" type="text" class="lookup-input" value="${draft.name}" />
        </div>
        <div>
          <label class="lookup-modal__label">Description</label>
          <textarea id="service-type-description" rows="3" class="lookup-input">${draft.description}</textarea>
        </div>
        <div>
          <label class="lookup-modal__label">Service Group</label>
          <select id="service-type-group" class="lookup-input">
            <option value="">No group</option>
            ${groups.map(group => `<option value="${group.id}" ${draft.serviceGroupId === group.id ? 'selected' : ''}>${group.name}</option>`).join('')}
          </select>
        </div>
        <div class="flex items-center gap-2">
          <input id="service-type-billable" type="checkbox" ${draft.billable ? 'checked' : ''} />
          <label for="service-type-billable" class="text-sm text-slate-700 dark:text-slate-200">Billable</label>
        </div>
        <div>
          <label class="lookup-modal__label">Base Rate</label>
          <input id="service-type-rate" type="number" min="0" class="lookup-input" value="${Number.isFinite(draft.baseRate) ? draft.baseRate : ''}" ${draft.billable ? '' : 'disabled'} />
          <p id="service-type-rate-hint" class="text-xs text-slate-500 dark:text-slate-400 mt-1 ${draft.billable ? '' : 'hidden'}">Base rate is required when billable.</p>
          <p id="service-type-error" class="text-xs text-red-600 dark:text-red-400 mt-1 hidden"></p>
        </div>
      </div>
      <div class="px-5 py-4 border-t border-slate-200 dark:border-white/10 flex items-center justify-end gap-2">
        <button type="button" id="drawerCancelBtn" class="lookup-btn ghost">Cancel</button>
        <button type="button" id="drawerSaveBtn" class="lookup-btn primary">${isNew ? 'Create' : 'Save'}</button>
      </div>
    </aside>
  `;
  if (shell) shell.classList.remove('drawer-closed');

  const closeDrawer = () => { shell?.classList.add('drawer-closed'); };
  drawer.querySelector('#app-drawer-backdrop')?.addEventListener('click', closeDrawer);
  drawer.querySelector('#drawerCloseBtn')?.addEventListener('click', closeDrawer);
  drawer.querySelector('#drawerCancelBtn')?.addEventListener('click', closeDrawer);

  const nameInput = drawer.querySelector('#service-type-name');
  const descriptionInput = drawer.querySelector('#service-type-description');
  const groupSelect = drawer.querySelector('#service-type-group');
  const billableInput = drawer.querySelector('#service-type-billable');
  const rateInput = drawer.querySelector('#service-type-rate');
  const rateHint = drawer.querySelector('#service-type-rate-hint');
  const errorEl = drawer.querySelector('#service-type-error');

  const syncBillable = () => {
    if (!rateInput || !billableInput) return;
    if (billableInput.checked) {
      rateInput.removeAttribute('disabled');
      rateHint?.classList.remove('hidden');
    } else {
      rateInput.setAttribute('disabled', 'true');
      rateInput.value = '';
      rateHint?.classList.add('hidden');
    }
  };
  if (billableInput) {
    billableInput.onchange = syncBillable;
  }
  syncBillable();

  drawer.querySelector('#drawerSaveBtn')?.addEventListener('click', () => {
    const name = nameInput?.value.trim() || '';
    const description = descriptionInput?.value.trim() || '';
    const groupId = groupSelect?.value || null;
    const billable = Boolean(billableInput?.checked);
    const baseRate = billable ? Number(rateInput?.value) : null;
    const normalized = normalizeName(name);
    const nameTaken = types.some(t => normalizeName(t.name) === normalized && t.id !== draft.id);
    if (!name) {
      errorEl.textContent = 'Name is required.';
      errorEl.classList.remove('hidden');
      return;
    }
    if (nameTaken) {
      errorEl.textContent = 'Name must be unique.';
      errorEl.classList.remove('hidden');
      return;
    }
    if (billable && (!Number.isFinite(baseRate) || baseRate < 0)) {
      errorEl.textContent = 'Base rate must be a number ≥ 0.';
      errorEl.classList.remove('hidden');
      return;
    }
    errorEl.classList.add('hidden');
    const nextType = {
      ...draft,
      name,
      description,
      billable,
      baseRate: billable ? baseRate : null,
      serviceGroupId: groupId || null,
    };
    const nextTypes = isNew
      ? [...types, nextType]
      : types.map(t => (t.id === draft.id ? nextType : t));
    saveServiceTypes(wsId, nextTypes);
    showToast(isNew ? 'Service type created' : 'Service type updated');
    closeDrawer();
    const container = document.getElementById('settingsServiceTypesRoot');
    if (container) renderServiceTypesTab(container);
  });
}

function openServiceGroupDrawer(wsId, existingGroup = null) {
  const groups = loadServiceGroups(wsId).map(normalizeServiceGroup);
  const isNew = !existingGroup;
  const draft = existingGroup
    ? { ...existingGroup }
    : { id: createId('service_group'), name: '', description: '' };

  const drawer = document.getElementById('drawer-container');
  const shell = document.getElementById('app-shell');
  if (!drawer) return;
  drawer.innerHTML = `
    <div id="app-drawer-backdrop"></div>
    <aside id="app-drawer" class="bg-white dark:bg-slate-900 text-slate-900 dark:text-white p-0 flex flex-col w-full max-w-md">
      <div class="flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-white/10">
        <div>
          <h2 class="text-lg font-semibold">${isNew ? 'New service group' : 'Edit service group'}</h2>
          <p class="text-xs text-slate-500 dark:text-white/60">${isNew ? 'Create a service group.' : draft.name}</p>
        </div>
        <button type="button" id="drawerCloseBtn" class="text-slate-500 hover:text-slate-800 dark:text-white/70 dark:hover:text-white">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </div>
      <div class="flex-1 overflow-y-auto px-5 py-4 space-y-4">
        <div>
          <label class="lookup-modal__label">Name</label>
          <input id="service-group-name" type="text" class="lookup-input" value="${draft.name}" />
        </div>
        <div>
          <label class="lookup-modal__label">Description</label>
          <textarea id="service-group-description" rows="3" class="lookup-input">${draft.description}</textarea>
        </div>
        <p id="service-group-error" class="text-xs text-red-600 dark:text-red-400 hidden"></p>
      </div>
      <div class="px-5 py-4 border-t border-slate-200 dark:border-white/10 flex items-center justify-end gap-2">
        <button type="button" id="drawerCancelBtn" class="lookup-btn ghost">Cancel</button>
        <button type="button" id="drawerSaveBtn" class="lookup-btn primary">${isNew ? 'Create' : 'Save'}</button>
      </div>
    </aside>
  `;
  if (shell) shell.classList.remove('drawer-closed');

  const closeDrawer = () => { shell?.classList.add('drawer-closed'); };
  drawer.querySelector('#app-drawer-backdrop')?.addEventListener('click', closeDrawer);
  drawer.querySelector('#drawerCloseBtn')?.addEventListener('click', closeDrawer);
  drawer.querySelector('#drawerCancelBtn')?.addEventListener('click', closeDrawer);

  drawer.querySelector('#drawerSaveBtn')?.addEventListener('click', () => {
    const name = drawer.querySelector('#service-group-name')?.value.trim() || '';
    const description = drawer.querySelector('#service-group-description')?.value.trim() || '';
    const normalized = normalizeName(name);
    const nameTaken = groups.some(g => normalizeName(g.name) === normalized && g.id !== draft.id);
    const errorEl = drawer.querySelector('#service-group-error');
    if (!name) {
      errorEl.textContent = 'Name is required.';
      errorEl.classList.remove('hidden');
      return;
    }
    if (nameTaken) {
      errorEl.textContent = 'Name must be unique.';
      errorEl.classList.remove('hidden');
      return;
    }
    errorEl.classList.add('hidden');
    const nextGroup = { ...draft, name, description };
    const nextGroups = isNew
      ? [...groups, nextGroup]
      : groups.map(g => (g.id === draft.id ? nextGroup : g));
    saveServiceGroups(wsId, nextGroups);
    showToast(isNew ? 'Service group created' : 'Service group updated');
    closeDrawer();
    const container = document.getElementById('settingsServiceTypesRoot');
    if (container) renderServiceTypesTab(container);
  });
}

function handleDeleteServiceGroup(wsId, group) {
  showConfirmModal({
    title: 'Delete service group?',
    message: 'Service types in this group will become ungrouped.',
    confirmLabel: 'Delete group',
    onConfirm: () => {
      const groups = loadServiceGroups(wsId).map(normalizeServiceGroup).filter(g => g.id !== group.id);
      const types = loadServiceTypes(wsId).map(normalizeServiceType).map(type => (
        type.serviceGroupId === group.id ? { ...type, serviceGroupId: null } : type
      ));
      saveServiceGroups(wsId, groups);
      saveServiceTypes(wsId, types);
      showToast('Service group deleted');
      const container = document.getElementById('settingsServiceTypesRoot');
      if (container) renderServiceTypesTab(container);
    },
  });
}

function renderWorkspaceSettingsTab(container) {
  const wsId = workspaceId();
  const timezones = [
    { value: 'America/New_York', label: 'Eastern (America/New_York)' },
    { value: 'America/Chicago', label: 'Central (America/Chicago)' },
    { value: 'America/Denver', label: 'Mountain (America/Denver)' },
    { value: 'America/Los_Angeles', label: 'Pacific (America/Los_Angeles)' },
    { value: 'America/Phoenix', label: 'Arizona (America/Phoenix)' },
    { value: 'America/Anchorage', label: 'Alaska (America/Anchorage)' },
    { value: 'Pacific/Honolulu', label: 'Hawaii (Pacific/Honolulu)' },
    { value: 'Europe/London', label: 'London (Europe/London)' },
    { value: 'Europe/Berlin', label: 'Berlin (Europe/Berlin)' },
    { value: 'Europe/Paris', label: 'Paris (Europe/Paris)' },
    { value: 'Asia/Dubai', label: 'Dubai (Asia/Dubai)' },
    { value: 'Asia/Kolkata', label: 'India (Asia/Kolkata)' },
    { value: 'Asia/Singapore', label: 'Singapore (Asia/Singapore)' },
    { value: 'Asia/Tokyo', label: 'Tokyo (Asia/Tokyo)' },
    { value: 'Australia/Sydney', label: 'Sydney (Australia/Sydney)' },
  ];
  const currencies = [
    { value: 'USD', label: 'USD' },
    { value: 'CAD', label: 'CAD' },
    { value: 'GBP', label: 'GBP' },
    { value: 'EUR', label: 'EUR' },
    { value: 'AUD', label: 'AUD' },
  ];

  const saved = loadWorkspaceSettings(wsId);
  const draft = WORKSPACE_UI_STATE.draft || { ...saved };
  WORKSPACE_UI_STATE.saved = saved;
  WORKSPACE_UI_STATE.draft = draft;
  const hasChanges = hasWorkspaceChanges(draft, saved);

  container.innerHTML = `
    <div class="space-y-6 pb-12">
      <section class="rounded-2xl border border-slate-200 dark:border-white/10 bg-white/90 dark:bg-slate-800/90 backdrop-blur-sm shadow-sm px-6 py-6 md:px-8 md:py-8 space-y-6">
        <div>
          <label class="lookup-modal__label">Workspace Name</label>
          <input id="workspace-name" type="text" class="lookup-input" value="${draft.name || ''}" />
        </div>
        <div>
          <label class="lookup-modal__label">Workspace Logo</label>
          <div class="flex items-center gap-4">
            <div class="h-16 w-16 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 flex items-center justify-center overflow-hidden">
              ${draft.logoDataUrl
                ? `<img src="${draft.logoDataUrl}" alt="Workspace logo" class="h-full w-full object-cover" />`
                : '<span class="text-xs text-slate-500 dark:text-slate-400">No logo</span>'}
            </div>
            <div class="flex flex-col gap-2">
              <button type="button" id="workspace-logo-upload-btn" class="lookup-btn primary">Upload logo</button>
              <button type="button" id="workspace-logo-remove-btn" class="lookup-btn ghost" ${draft.logoDataUrl ? '' : 'disabled'}>Remove logo</button>
            </div>
          </div>
          <input id="workspace-logo-input" type="file" accept="image/png,image/jpeg,image/webp" class="hidden" />
        </div>
        <div>
          <label class="lookup-modal__label">Default Time Zone</label>
          <select id="workspace-timezone" class="lookup-input">
            ${timezones.map(tz => `<option value="${tz.value}" ${draft.timezone === tz.value ? 'selected' : ''}>${tz.label}</option>`).join('')}
          </select>
        </div>
        <div>
          <label class="lookup-modal__label">Currency</label>
          <select id="workspace-currency" class="lookup-input">
            ${currencies.map(curr => `<option value="${curr.value}" ${draft.currency === curr.value ? 'selected' : ''}>${curr.label}</option>`).join('')}
          </select>
        </div>
      </section>

      ${hasChanges ? `
        <div class="sticky bottom-4 z-20">
          <div class="rounded-2xl border border-slate-200 dark:border-white/10 bg-white/95 dark:bg-slate-900/95 backdrop-blur shadow-lg px-4 py-3 flex items-center justify-between">
            <span class="text-sm text-slate-700 dark:text-slate-200">Unsaved changes</span>
            <div class="flex items-center gap-2">
              <button type="button" id="workspace-cancel" class="lookup-btn ghost">Cancel</button>
              <button type="button" id="workspace-save" class="lookup-btn primary">Save changes</button>
            </div>
          </div>
        </div>
      ` : ''}
    </div>
  `;

  const rerender = () => renderWorkspaceSettingsTab(container);

  const nameInput = container.querySelector('#workspace-name');
  if (nameInput) {
    nameInput.oninput = (e) => {
      draft.name = e.target.value;
      rerender();
    };
  }
  const timezoneSelect = container.querySelector('#workspace-timezone');
  if (timezoneSelect) {
    timezoneSelect.onchange = (e) => {
      draft.timezone = e.target.value;
      rerender();
    };
  }
  const currencySelect = container.querySelector('#workspace-currency');
  if (currencySelect) {
    currencySelect.onchange = (e) => {
      draft.currency = e.target.value;
      rerender();
    };
  }

  const logoInput = container.querySelector('#workspace-logo-input');
  const uploadBtn = container.querySelector('#workspace-logo-upload-btn');
  const removeBtn = container.querySelector('#workspace-logo-remove-btn');
  if (uploadBtn && logoInput) {
    uploadBtn.onclick = () => logoInput.click();
    logoInput.onchange = () => {
      const file = logoInput.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        draft.logoDataUrl = String(reader.result || '');
        rerender();
      };
      reader.readAsDataURL(file);
    };
  }
  if (removeBtn) {
    removeBtn.onclick = () => {
      draft.logoDataUrl = null;
      rerender();
    };
  }

  const cancelBtn = container.querySelector('#workspace-cancel');
  if (cancelBtn) {
    cancelBtn.onclick = () => {
      WORKSPACE_UI_STATE.draft = { ...saved };
      rerender();
    };
  }

  const saveBtn = container.querySelector('#workspace-save');
  if (saveBtn) {
    saveBtn.onclick = () => {
      const next = normalizeWorkspaceSettings(draft, saved.name);
      if (!next.name.trim()) {
        showToast('Workspace name is required.');
        return;
      }
      if (!next.timezone) {
        showToast('Time zone is required.');
        return;
      }
      if (!next.currency) {
        showToast('Currency is required.');
        return;
      }
      const finalize = () => {
        saveWorkspaceSettings(wsId, next);
        WORKSPACE_UI_STATE.saved = next;
        WORKSPACE_UI_STATE.draft = { ...next };
        showToast('Workspace settings saved');
        rerender();
      };
      if (next.currency !== saved.currency) {
        showConfirmModal({
          title: `Change currency to ${next.currency}?`,
          message: [
            'Net Net will not convert existing monetary values.',
            'Service type base rates and monthly seat costs keep their numeric values.',
            'Review and update values manually after changing currency.',
          ].join(' '),
          confirmLabel: 'Change currency',
          onConfirm: finalize,
        });
        return;
      }
      finalize();
    };
  }
}

function appendSubscriptionActivity(wsId, event) {
  const events = loadSubscriptionActivity(wsId);
  events.unshift(event);
  saveSubscriptionActivity(wsId, events);
}

function renderSubscriptionTab(container, route = {}) {
  const wsId = workspaceId();
  const role = getCurrentRole();
  const isOwner = role === 'owner';
  const state = loadSubscriptionState(wsId);
  const activity = loadSubscriptionActivity(wsId);
  const activeSubtab = getActiveSubscriptionSubtab(route.subtab || getSubscriptionSubtabFromHash());

  const payment = state.paymentMethod || {};
  const paymentLabel = payment.brand && payment.last4
    ? `${payment.brand} **** ${payment.last4}`
    : 'No payment method on file';
  const expiryLabel = payment.expMonth && payment.expYear ? `Exp ${payment.expMonth}/${payment.expYear}` : '—';

  const activityRows = activity.map(item => `
    <tr class="border-b border-slate-200 dark:border-white/10">
      <td class="px-4 py-3 text-sm text-slate-600 dark:text-slate-300">${formatDateTime(item.createdAt)}</td>
      <td class="px-4 py-3 text-sm text-slate-700 dark:text-slate-200">${item.message || ''}</td>
    </tr>
  `).join('');

  const subnav = `
    <div class="flex flex-wrap items-center gap-2">
      <div class="inline-flex items-center gap-1 rounded-full border border-slate-200 dark:border-white/10 bg-white/80 dark:bg-slate-900/60 p-1">
        ${SUBSCRIPTION_SUBTABS.map(tab => `
          <button type="button" data-subscription-tab="${tab.key}" class="px-3 py-1 rounded-full text-sm font-medium ${
            tab.key === activeSubtab.key
              ? 'bg-netnet-purple text-white shadow-sm'
              : 'text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/10'
          }">${tab.label}</button>
        `).join('')}
      </div>
    </div>
  `;

  const subscriptionSubview = `
    <section class="rounded-2xl border border-slate-200 dark:border-white/10 bg-white/90 dark:bg-slate-800/90 shadow-sm px-6 py-6 md:px-8 md:py-8 space-y-4">
      <div class="flex items-start justify-between gap-4">
        <div class="space-y-2">
          <h3 class="text-lg font-semibold text-slate-900 dark:text-white">Current Plan</h3>
          <div class="text-sm text-slate-600 dark:text-slate-300">${state.planLabel}</div>
          <div class="text-sm text-slate-600 dark:text-slate-300">${state.priceLabel}</div>
        </div>
        <div class="text-right text-sm text-slate-600 dark:text-slate-300">
          <div>Cadence: <span class="text-slate-900 dark:text-white font-medium">${state.cadence === 'annual' ? 'Annual' : 'Monthly'}</span></div>
          <div>Active jobs: <span class="text-slate-900 dark:text-white font-medium">${state.usage?.activeJobsCount ?? 3}</span></div>
          <div>Next renewal: <span class="text-slate-900 dark:text-white font-medium">${formatDateTime(state.nextRenewalDate)}</span></div>
        </div>
      </div>
      <div class="flex items-center gap-3">
        <button type="button" id="subscription-plan-btn" class="lookup-btn primary" ${isOwner ? '' : 'disabled'}>Change plan…</button>
        ${!isOwner ? '<span class="text-xs text-slate-500 dark:text-slate-400">Owner only</span>' : ''}
      </div>
    </section>
  `;

  const paymentSubview = `
    <section class="rounded-2xl border border-slate-200 dark:border-white/10 bg-white/90 dark:bg-slate-800/90 shadow-sm px-6 py-6 md:px-8 md:py-8 space-y-4">
      <div class="flex items-start justify-between gap-4">
        <div>
          <h3 class="text-lg font-semibold text-slate-900 dark:text-white">Payment Method</h3>
          <div class="text-sm text-slate-600 dark:text-slate-300">${paymentLabel}</div>
          <div class="text-sm text-slate-500 dark:text-slate-400">${expiryLabel}</div>
        </div>
        <div class="flex items-center gap-3">
          <button type="button" id="subscription-payment-btn" class="lookup-btn primary" ${isOwner ? '' : 'disabled'}>Update payment method…</button>
          ${!isOwner ? '<span class="text-xs text-slate-500 dark:text-slate-400">Owner only</span>' : ''}
        </div>
      </div>
    </section>
  `;

  const activitySubview = `
    <section class="rounded-2xl border border-slate-200 dark:border-white/10 bg-white/90 dark:bg-slate-800/90 shadow-sm overflow-hidden">
      <div class="px-6 py-4 border-b border-slate-200 dark:border-white/10">
        <h3 class="text-lg font-semibold text-slate-900 dark:text-white">Activity</h3>
      </div>
      <div class="overflow-x-auto">
        <table class="w-full text-left border-collapse">
          <thead class="bg-slate-50 dark:bg-slate-900/60 text-xs uppercase text-slate-500 dark:text-slate-400 font-semibold">
            <tr>
              <th class="px-4 py-3 border-b border-slate-200 dark:border-white/10">Date</th>
              <th class="px-4 py-3 border-b border-slate-200 dark:border-white/10">Activity</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-200 dark:divide-white/10">
            ${activityRows}
          </tbody>
        </table>
      </div>
    </section>
  `;

  const viewContent = activeSubtab.key === 'payment'
    ? paymentSubview
    : activeSubtab.key === 'activity'
      ? activitySubview
      : subscriptionSubview;

  container.innerHTML = `
    <div class="space-y-6 pb-12">
      ${subnav}
      ${viewContent}
    </div>
  `;

  container.querySelectorAll('[data-subscription-tab]').forEach(btn => {
    btn.addEventListener('click', () => {
      const key = btn.getAttribute('data-subscription-tab');
      const match = SUBSCRIPTION_SUBTABS.find(tab => tab.key === key);
      navigate(match?.hash || '#/app/settings/subscription/subscription');
    });
  });

  const planBtn = container.querySelector('#subscription-plan-btn');
  if (planBtn) {
    planBtn.onclick = () => {
      if (!isOwner) return;
      openPlanModal(wsId, state);
    };
  }

  const paymentBtn = container.querySelector('#subscription-payment-btn');
  if (paymentBtn) {
    paymentBtn.onclick = () => {
      if (!isOwner) return;
      openPaymentModal(wsId, state);
    };
  }
}

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function safeUrl(url) {
  const trimmed = String(url || '').trim();
  if (/^(https?:|mailto:)/i.test(trimmed)) return trimmed;
  return '#';
}

function renderInlineMarkdown(text) {
  let output = escapeHtml(text);
  output = output.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (match, label, url) => {
    const href = safeUrl(url);
    return `<a href="${href}" target="_blank" rel="noopener noreferrer" class="text-netnet-purple dark:text-white hover:underline">${label}</a>`;
  });
  output = output.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  output = output.replace(/\*([^*]+)\*/g, '<em>$1</em>');
  return output;
}

function renderMarkdownBody(md) {
  const lines = String(md || '').split(/\r?\n/);
  const html = [];
  let paragraph = [];
  let listType = null;

  const flushParagraph = () => {
    if (!paragraph.length) return;
    html.push(`<p class="text-sm md:text-base text-slate-700 dark:text-slate-200">${renderInlineMarkdown(paragraph.join(' '))}</p>`);
    paragraph = [];
  };

  const closeList = () => {
    if (!listType) return;
    html.push(`</${listType}>`);
    listType = null;
  };

  const openList = (type) => {
    const classes = type === 'ol' ? 'list-decimal' : 'list-disc';
    html.push(`<${type} class="list-inside ${classes} space-y-1 text-sm md:text-base text-slate-700 dark:text-slate-200">`);
    listType = type;
  };

  lines.forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed) {
      flushParagraph();
      closeList();
      return;
    }

    const headingMatch = trimmed.match(/^(#{1,3})\s+(.*)$/);
    if (headingMatch) {
      flushParagraph();
      closeList();
      const level = headingMatch[1].length;
      const headingText = renderInlineMarkdown(headingMatch[2]);
      const headingClass = level === 1
        ? 'text-xl md:text-2xl'
        : level === 2
          ? 'text-lg md:text-xl'
          : 'text-base md:text-lg';
      html.push(`<h${level} class="${headingClass} font-semibold text-slate-900 dark:text-white">${headingText}</h${level}>`);
      return;
    }

    const orderedMatch = trimmed.match(/^\d+\.\s+(.*)$/);
    const unorderedMatch = trimmed.match(/^[-*]\s+(.*)$/);
    if (orderedMatch || unorderedMatch) {
      flushParagraph();
      const nextType = orderedMatch ? 'ol' : 'ul';
      if (listType !== nextType) {
        closeList();
        openList(nextType);
      }
      const itemText = renderInlineMarkdown((orderedMatch || unorderedMatch)[1]);
      html.push(`<li>${itemText}</li>`);
      return;
    }

    closeList();
    paragraph.push(trimmed);
  });

  flushParagraph();
  closeList();
  return html.join('\n');
}

function extractLastUpdated(md) {
  const match = String(md || '').match(/^\s*\*\*LAST UPDATED:\s*([^*]+)\*\*/im);
  return match ? match[1].trim() : 'May 30, 2025';
}

function stripLastUpdatedLine(md) {
  return String(md || '').replace(/^\s*\*\*LAST UPDATED:[^\n]*\n?/im, '');
}

async function fetchTermsMarkdown() {
  let lastError = null;
  for (const url of TERMS_MD_URLS) {
    try {
      const res = await fetch(url);
      if (!res.ok) {
        lastError = new Error(`HTTP ${res.status}`);
        continue;
      }
      const text = await res.text();
      return { text, url };
    } catch (err) {
      lastError = err;
    }
  }
  throw lastError || new Error('Failed to load terms');
}

function renderTermsTab(container) {
  const fallbackUpdated = 'May 30, 2025';
  const renderLayout = (bodyHtml, lastUpdated, isError = false) => `
    <div class="space-y-4 pb-12">
      <section class="rounded-2xl border border-slate-200 dark:border-white/10 bg-white/90 dark:bg-slate-800/90 shadow-sm px-6 py-6 md:px-8 md:py-8 space-y-4">
        <div class="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h3 class="text-lg font-semibold text-slate-900 dark:text-white">Terms & Conditions</h3>
            <p class="text-sm text-slate-500 dark:text-slate-400">Last updated: ${lastUpdated}</p>
          </div>
        </div>
        <div class="rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-slate-900/60 overflow-hidden">
          <div class="max-h-[70vh] overflow-y-auto px-4 py-4 space-y-3">
            ${isError ? '<p class="text-sm text-slate-600 dark:text-slate-300">Terms could not be loaded.</p>' : bodyHtml}
          </div>
        </div>
      </section>
    </div>
  `;

  container.innerHTML = renderLayout('<p class="text-sm text-slate-600 dark:text-slate-300">Loading terms…</p>', fallbackUpdated);

  fetchTermsMarkdown()
    .then(({ text, url }) => {
      window.__netnetTermsDebug = { urlUsed: url };
      const lastUpdated = extractLastUpdated(text);
      const cleaned = stripLastUpdatedLine(text);
      const bodyHtml = renderMarkdownBody(cleaned);
      container.innerHTML = renderLayout(bodyHtml, lastUpdated);
    })
    .catch((err) => {
      window.__netnetTermsDebug = { urlUsed: null };
      console.warn('[Terms] Unable to load markdown', { tried: TERMS_MD_URLS, error: err?.message || err });
      container.innerHTML = renderLayout('', fallbackUpdated, true);
    });
}

function renderTemplatesTab(container) {
  container.innerHTML = `
    <div class="space-y-6 pb-12">
      <section class="rounded-2xl border border-slate-200 dark:border-white/10 bg-white/90 dark:bg-slate-800/90 shadow-sm px-6 py-6 md:px-8 md:py-8 space-y-4">
        <div>
          <h3 class="text-lg font-semibold text-slate-900 dark:text-white">Deliverable Templates</h3>
          <p class="mt-2 text-sm text-slate-600 dark:text-slate-300">Reusable deliverables you can drop into a new Job.</p>
          <p class="text-sm text-slate-600 dark:text-slate-300">Each template can include a name, description, and default LOE by Service Type.</p>
          <p class="text-sm text-slate-600 dark:text-slate-300">After inserting, you can edit everything inside the Job setup.</p>
        </div>
        <button type="button" class="lookup-btn primary" disabled>Coming soon</button>
      </section>

      <section class="rounded-2xl border border-slate-200 dark:border-white/10 bg-white/90 dark:bg-slate-800/90 shadow-sm px-6 py-6 md:px-8 md:py-8 space-y-4">
        <div>
          <h3 class="text-lg font-semibold text-slate-900 dark:text-white">Job Templates</h3>
          <p class="mt-2 text-sm text-slate-600 dark:text-slate-300">Prebuilt job starters for productized services and repeatable engagements.</p>
          <p class="text-sm text-slate-600 dark:text-slate-300">A Job Template includes a full set of deliverables and a suggested structure.</p>
          <p class="text-sm text-slate-600 dark:text-slate-300">Pick one during Job creation to get 85–90% done instantly, then customize.</p>
        </div>
        <button type="button" class="lookup-btn primary" disabled>Coming soon</button>
      </section>
    </div>
  `;
}

function openPlanModal(wsId, state) {
  const layer = ensureModalLayer('subscription-plan-layer');
  layer.innerHTML = `
    <div class="nn-modal-overlay" role="presentation">
      <div class="nn-modal-card" role="dialog" aria-modal="true" aria-label="Change plan">
        <div class="lookup-modal__header">
          <h3>Change plan</h3>
        </div>
        <div class="space-y-3">
          <label class="lookup-modal__label">Cadence</label>
          <select id="plan-cadence" class="lookup-input">
            <option value="monthly" ${state.cadence === 'monthly' ? 'selected' : ''}>Monthly</option>
            <option value="annual" ${state.cadence === 'annual' ? 'selected' : ''}>Annual</option>
          </select>
          <label class="lookup-modal__label">Plan</label>
          <select id="plan-id" class="lookup-input">
            <option value="active-jobs-standard" selected>Active Jobs</option>
          </select>
        </div>
        <div class="lookup-modal__actions">
          <button type="button" class="lookup-btn ghost" data-action="cancel">Cancel</button>
          <button type="button" class="lookup-btn primary" data-action="confirm">Update plan</button>
        </div>
      </div>
    </div>
  `;
  const hide = () => { layer.innerHTML = ''; };
  const overlay = layer.querySelector('.nn-modal-overlay');
  overlay.onclick = (e) => { if (e.target === overlay) hide(); };
  layer.querySelector('[data-action="cancel"]').onclick = hide;
  layer.querySelector('[data-action="confirm"]').onclick = () => {
    const cadence = layer.querySelector('#plan-cadence')?.value || 'monthly';
    const planId = layer.querySelector('#plan-id')?.value || 'active-jobs-standard';
    const next = {
      ...state,
      cadence,
      planId,
      planLabel: 'Active Jobs',
      priceLabel: cadence === 'annual' ? 'Annual prepay (discounted)' : '$30 / active job / month',
    };
    saveSubscriptionState(wsId, next);
    if (cadence !== state.cadence) {
      appendSubscriptionActivity(wsId, {
        id: createId('act'),
        createdAt: new Date().toISOString(),
        type: 'cadence_changed',
        message: `Cadence changed — ${state.cadence === 'annual' ? 'Annual' : 'Monthly'} → ${cadence === 'annual' ? 'Annual' : 'Monthly'}`,
      });
    }
    if (planId !== state.planId) {
      appendSubscriptionActivity(wsId, {
        id: createId('act'),
        createdAt: new Date().toISOString(),
        type: 'plan_changed',
        message: 'Plan changed — Active Jobs',
      });
    }
    showToast('Plan updated');
    hide();
    const container = document.getElementById('settingsSubscriptionRoot');
    if (container) renderSubscriptionTab(container);
  };
}

function openPaymentModal(wsId, state) {
  const layer = ensureModalLayer('subscription-payment-layer');
  const payment = state.paymentMethod || {};
  layer.innerHTML = `
    <div class="nn-modal-overlay" role="presentation">
      <div class="nn-modal-card" role="dialog" aria-modal="true" aria-label="Update payment method">
        <div class="lookup-modal__header">
          <h3>Update payment method</h3>
        </div>
        <div class="space-y-3">
          <label class="lookup-modal__label">Brand</label>
          <select id="payment-brand" class="lookup-input">
            ${['Visa', 'Mastercard', 'Amex'].map(brand => `<option value="${brand}" ${payment.brand === brand ? 'selected' : ''}>${brand}</option>`).join('')}
          </select>
          <label class="lookup-modal__label">Last 4</label>
          <input id="payment-last4" type="text" class="lookup-input" value="${payment.last4 || ''}" maxlength="4" />
          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="lookup-modal__label">Exp month</label>
              <input id="payment-exp-month" type="number" min="1" max="12" class="lookup-input" value="${payment.expMonth || ''}" />
            </div>
            <div>
              <label class="lookup-modal__label">Exp year</label>
              <input id="payment-exp-year" type="number" min="2024" class="lookup-input" value="${payment.expYear || ''}" />
            </div>
          </div>
          <p id="payment-error" class="text-xs text-red-600 dark:text-red-400 hidden"></p>
        </div>
        <div class="lookup-modal__actions">
          <button type="button" class="lookup-btn ghost" data-action="cancel">Cancel</button>
          <button type="button" class="lookup-btn primary" data-action="confirm">Save</button>
        </div>
      </div>
    </div>
  `;
  const hide = () => { layer.innerHTML = ''; };
  const overlay = layer.querySelector('.nn-modal-overlay');
  overlay.onclick = (e) => { if (e.target === overlay) hide(); };
  layer.querySelector('[data-action="cancel"]').onclick = hide;
  layer.querySelector('[data-action="confirm"]').onclick = () => {
    const brand = layer.querySelector('#payment-brand')?.value || '';
    const last4 = layer.querySelector('#payment-last4')?.value || '';
    const expMonth = Number(layer.querySelector('#payment-exp-month')?.value);
    const expYear = Number(layer.querySelector('#payment-exp-year')?.value);
    const errorEl = layer.querySelector('#payment-error');
    if (!brand || !/^\d{4}$/.test(last4) || !Number.isFinite(expMonth) || expMonth < 1 || expMonth > 12 || !Number.isFinite(expYear)) {
      errorEl.textContent = 'Enter valid payment details.';
      errorEl.classList.remove('hidden');
      return;
    }
    errorEl.classList.add('hidden');
    const next = {
      ...state,
      paymentMethod: { brand, last4, expMonth, expYear },
    };
    saveSubscriptionState(wsId, next);
    appendSubscriptionActivity(wsId, {
      id: createId('act'),
      createdAt: new Date().toISOString(),
      type: 'payment_updated',
      message: `Payment method updated — ${brand} **** ${last4}`,
    });
    showToast('Payment method updated');
    hide();
    const container = document.getElementById('settingsSubscriptionRoot');
    if (container) renderSubscriptionTab(container);
  };
}

function inviteRoleOptions(currentRole) {
  const options = ['member', 'lead', 'admin'];
  if (currentRole === 'owner') options.push('owner');
  return options;
}

function roleOptionsForMember(currentRole, member) {
  if (currentRole !== 'owner' && member.role === 'owner') {
    return [member.role];
  }
  const options = ['member', 'lead', 'admin'];
  if (currentRole === 'owner') options.push('owner');
  return options;
}

function openInviteModal(wsId, currentRole) {
  const layer = ensureModalLayer('settings-invite-layer');
  const options = inviteRoleOptions(currentRole);
  layer.innerHTML = `
    <div class="nn-modal-overlay" role="presentation">
      <div class="nn-modal-card" role="dialog" aria-modal="true" aria-label="Invite team member">
        <div class="lookup-modal__header">
          <h3>Invite team member</h3>
        </div>
        <div class="space-y-3">
          <label class="lookup-modal__label">Email</label>
          <input type="email" id="invite-email" class="lookup-input" placeholder="name@company.com" />
          <label class="lookup-modal__label">Role</label>
          <select id="invite-role" class="lookup-input">
            ${options.map(opt => `<option value="${opt}" ${opt === 'member' ? 'selected' : ''}>${ROLE_LABELS[opt]}</option>`).join('')}
          </select>
          <p id="invite-error" class="text-xs text-red-600 dark:text-red-400 hidden"></p>
        </div>
        <div class="lookup-modal__actions">
          <button type="button" class="lookup-btn ghost" data-action="cancel">Cancel</button>
          <button type="button" class="lookup-btn primary" data-action="confirm">Send invite</button>
        </div>
      </div>
    </div>
  `;

  const hide = () => { layer.innerHTML = ''; };
  const overlay = layer.querySelector('.nn-modal-overlay');
  overlay.onclick = (e) => { if (e.target === overlay) hide(); };
  layer.querySelector('[data-action="cancel"]').onclick = hide;

  const emailInput = layer.querySelector('#invite-email');
  const roleSelect = layer.querySelector('#invite-role');
  const errorEl = layer.querySelector('#invite-error');
  layer.querySelector('[data-action="confirm"]').onclick = () => {
    const email = normalizeEmail(emailInput.value || '');
    const role = roleSelect.value || 'member';
    const emailValid = /^\S+@\S+\.\S+$/.test(email);
    const showError = (msg) => {
      errorEl.textContent = msg;
      errorEl.classList.remove('hidden');
    };
    errorEl.classList.add('hidden');
    if (!emailValid) {
      showError('Enter a valid email address.');
      return;
    }
    const members = loadTeamMembers(wsId);
    const invites = loadInvites(wsId);
    const member = members.find(m => normalizeEmail(m.email) === email);
    if (member && member.status === 'active') {
      showError('This email already belongs to an active member.');
      return;
    }
    if (member && member.status === 'deactivated') {
      hide();
      showChoiceModal({
        title: 'Member is deactivated',
        message: 'This email belongs to a deactivated team member. Reactivate them instead of sending a new invite.',
        confirmLabel: 'Reactivate',
        onConfirm: () => {
          member.status = 'active';
          saveTeamMembers(wsId, members);
          showToast('Member reactivated');
          const container = document.getElementById('settingsTeamRoot');
          if (container) renderTeamTab(container);
          openMemberDrawer(wsId, member.id);
        },
      });
      return;
    }
    if (invites.some(invite => normalizeEmail(invite.email) === email)) {
      showError('There is already a pending invite for this email.');
      return;
    }
    if (role === 'owner' && currentRole !== 'owner') {
      showError('Only Owners can invite another Owner.');
      return;
    }
    const now = new Date().toISOString();
    invites.push({
      id: `invite_${Math.random().toString(36).slice(2, 9)}`,
      email,
      role,
      invitedAt: now,
      lastSentAt: now,
    });
    saveInvites(wsId, invites);
    hide();
    showToast(`Invite sent to ${email}`);
    const container = document.getElementById('settingsTeamRoot');
    if (container) renderTeamTab(container);
  };
}

function handleResendInvite(wsId, invite) {
  const invites = loadInvites(wsId);
  const target = invites.find(i => i.id === invite.id);
  if (!target) return;
  target.lastSentAt = new Date().toISOString();
  saveInvites(wsId, invites);
  showToast('Invite resent');
  const container = document.getElementById('settingsTeamRoot');
  if (container) renderTeamTab(container);
}

function handleDeleteInvite(wsId, invite) {
  showConfirmModal({
    title: 'Delete invite?',
    message: 'This will remove the pending invite and the recipient will need to be invited again.',
    confirmLabel: 'Delete invite',
    onConfirm: () => {
      const invites = loadInvites(wsId).filter(i => i.id !== invite.id);
      saveInvites(wsId, invites);
      showToast('Invite deleted');
      const container = document.getElementById('settingsTeamRoot');
      if (container) renderTeamTab(container);
    },
  });
}

function countActiveOwners(members) {
  return members.filter(m => m.role === 'owner' && m.status === 'active').length;
}

function canDeactivate(member, members) {
  const email = normalizeEmail(member.email);
  if (email && email === currentUserEmail()) return { ok: false, reason: 'You cannot deactivate yourself.' };
  if (member.role === 'owner' && countActiveOwners(members) <= 1) {
    return { ok: false, reason: 'You cannot deactivate the last Owner.' };
  }
  return { ok: true };
}

function handleDeactivate(wsId, member) {
  const members = loadTeamMembers(wsId);
  const current = members.find(m => m.id === member.id);
  if (!current) return;
  const guard = canDeactivate(current, members);
  if (!guard.ok) {
    showToast(guard.reason);
    return;
  }
  showConfirmModal({
    title: 'Deactivate member?',
    message: 'They will lose access, be removed from assignment picklists, and history will be preserved.',
    confirmLabel: 'Deactivate',
    onConfirm: () => {
      current.status = 'deactivated';
      saveTeamMembers(wsId, members);
      showToast('Member deactivated');
      const container = document.getElementById('settingsTeamRoot');
      if (container) renderTeamTab(container);
    },
  });
}

function handleReactivate(wsId, member) {
  const members = loadTeamMembers(wsId);
  const current = members.find(m => m.id === member.id);
  if (!current) return;
  showConfirmModal({
    title: 'Reactivate member?',
    message: 'They will regain access to this workspace.',
    confirmLabel: 'Reactivate',
    onConfirm: () => {
      current.status = 'active';
      saveTeamMembers(wsId, members);
      showToast('Member reactivated');
      const container = document.getElementById('settingsTeamRoot');
      if (container) renderTeamTab(container);
    },
  });
}

function openMemberDrawer(wsId, memberId) {
  const members = loadTeamMembers(wsId);
  const member = members.find(m => m.id === memberId);
  if (!member) return;
  const serviceTypes = loadServiceTypes(wsId);
  const currentRole = getCurrentRole();
  const canSeeSeatCost = currentRole === 'owner';
  const roleOptions = roleOptionsForMember(currentRole, member);
  const selectedIds = new Set(member.typicalServiceTypeIds || []);
  const listIds = new Set(serviceTypes.map(t => t.id));
  const extraSelected = Array.from(selectedIds).filter(id => !listIds.has(id));
  const draft = {
    ...member,
    typicalServiceTypeIds: Array.from(selectedIds),
  };

  const drawer = document.getElementById('drawer-container');
  if (!drawer) return;
  const shell = document.getElementById('app-shell');
  drawer.innerHTML = `
    <div id="app-drawer-backdrop"></div>
    <aside id="app-drawer" class="bg-white dark:bg-slate-900 text-slate-900 dark:text-white p-0 flex flex-col w-full max-w-md">
      <div class="flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-white/10">
        <div>
          <h2 class="text-lg font-semibold">${member.name || 'Team member'}</h2>
          <p class="text-xs text-slate-500 dark:text-white/60">${member.email || ''}</p>
        </div>
        <button type="button" id="drawerCloseBtn" class="text-slate-500 hover:text-slate-800 dark:text-white/70 dark:hover:text-white">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </div>
      <div class="flex-1 overflow-y-auto px-5 py-4 space-y-4">
        <div>
          <label class="lookup-modal__label">Role</label>
          <select id="member-role" class="lookup-input" ${currentRole !== 'owner' && member.role === 'owner' ? 'disabled' : ''}>
            ${roleOptions.map(opt => `<option value="${opt}" ${opt === member.role ? 'selected' : ''}>${ROLE_LABELS[opt]}</option>`).join('')}
          </select>
        </div>
        <div>
          <label class="lookup-modal__label">Estimated monthly capacity hours</label>
          <input id="member-capacity" type="number" min="0" class="lookup-input" value="${Number.isFinite(member.monthlyCapacityHours) ? member.monthlyCapacityHours : ''}" />
        </div>
        ${canSeeSeatCost ? `
        <div>
          <label class="lookup-modal__label">Monthly seat cost</label>
          <input id="member-seat-cost" type="number" min="0" class="lookup-input" value="${Number.isFinite(member.monthlySeatCost) ? member.monthlySeatCost : ''}" />
        </div>
        ` : ''}
        <div>
          <label class="lookup-modal__label">Typical service types</label>
          <input id="service-type-search" type="search" placeholder="Search service types…" class="lookup-input" />
          <div id="service-type-list" class="mt-2 space-y-1"></div>
        </div>
      </div>
      <div class="px-5 py-4 border-t border-slate-200 dark:border-white/10 flex items-center justify-between gap-3">
        <button type="button" id="member-status-btn" class="text-sm font-semibold ${member.status === 'active' ? 'text-red-600 dark:text-red-400' : 'text-netnet-purple'}">
          ${member.status === 'active' ? 'Deactivate member…' : 'Reactivate member'}
        </button>
        <div class="flex items-center gap-2">
          <button type="button" id="drawerCancelBtn" class="lookup-btn ghost">Cancel</button>
          <button type="button" id="drawerSaveBtn" class="lookup-btn primary">Save</button>
        </div>
      </div>
    </aside>
  `;
  if (shell) shell.classList.remove('drawer-closed');

  const closeDrawer = () => { shell?.classList.add('drawer-closed'); };
  const backdrop = drawer.querySelector('#app-drawer-backdrop');
  const closeBtn = drawer.querySelector('#drawerCloseBtn');
  if (backdrop) backdrop.onclick = closeDrawer;
  if (closeBtn) closeBtn.onclick = closeDrawer;
  const cancelBtn = drawer.querySelector('#drawerCancelBtn');
  if (cancelBtn) cancelBtn.onclick = closeDrawer;

  const roleSelect = drawer.querySelector('#member-role');
  if (roleSelect) {
    roleSelect.onchange = (e) => {
      draft.role = e.target.value;
    };
  }
  const capacityInput = drawer.querySelector('#member-capacity');
  if (capacityInput) {
    capacityInput.oninput = (e) => {
      const value = e.target.value;
      draft.monthlyCapacityHours = value === '' ? null : Number(value);
    };
  }
  const seatCostInput = drawer.querySelector('#member-seat-cost');
  if (seatCostInput) {
    seatCostInput.oninput = (e) => {
      const value = e.target.value;
      draft.monthlySeatCost = value === '' ? null : Number(value);
    };
  }

  const serviceList = drawer.querySelector('#service-type-list');
  const searchInput = drawer.querySelector('#service-type-search');

  const renderServiceTypeList = (query = '') => {
    if (!serviceList) return;
    const q = query.trim().toLowerCase();
    const items = serviceTypes
      .filter(item => !q || item.name.toLowerCase().includes(q))
      .map(item => {
        const checked = selectedIds.has(item.id);
        return `
          <label class="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-200">
            <input type="checkbox" data-service-id="${item.id}" ${checked ? 'checked' : ''} />
            <span>${item.name}${item.active ? '' : ' (Inactive)'}</span>
          </label>
        `;
      });
    const extra = extraSelected.map(id => `
      <label class="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-200">
        <input type="checkbox" data-service-id="${id}" checked />
        <span>${id} (Inactive)</span>
      </label>
    `);
    serviceList.innerHTML = [...items, ...extra].join('') || '<div class="text-xs text-slate-500 dark:text-slate-400">No service types found.</div>';
    serviceList.querySelectorAll('input[type="checkbox"]').forEach(input => {
      input.onchange = (e) => {
        const id = e.target.getAttribute('data-service-id');
        if (!id) return;
        if (e.target.checked) selectedIds.add(id);
        else selectedIds.delete(id);
        draft.typicalServiceTypeIds = Array.from(selectedIds);
      };
    });
  };

  renderServiceTypeList();
  if (searchInput) {
    searchInput.oninput = (e) => renderServiceTypeList(e.target.value || '');
  }

  const statusBtn = drawer.querySelector('#member-status-btn');
  if (statusBtn) {
    statusBtn.onclick = () => {
      if (member.status === 'active') {
        handleDeactivate(wsId, member);
      } else {
        handleReactivate(wsId, member);
      }
      closeDrawer();
    };
  }

  const saveBtn = drawer.querySelector('#drawerSaveBtn');
  if (saveBtn) {
    saveBtn.onclick = () => {
      const updatedMembers = loadTeamMembers(wsId);
      const target = updatedMembers.find(m => m.id === member.id);
      if (!target) {
        closeDrawer();
        return;
      }
      const ownersCount = countActiveOwners(updatedMembers);
      if (target.role === 'owner' && draft.role !== 'owner' && ownersCount <= 1) {
        showToast('You cannot demote the last Owner.');
        return;
      }
      if (draft.role === 'owner' && currentRole !== 'owner') {
        showToast('Only Owners can assign the Owner role.');
        return;
      }
      target.role = draft.role;
      const capacity = Number.isFinite(draft.monthlyCapacityHours) ? Math.max(0, draft.monthlyCapacityHours) : null;
      target.monthlyCapacityHours = capacity;
      if (currentRole === 'owner') {
        const seatCost = Number.isFinite(draft.monthlySeatCost) ? Math.max(0, draft.monthlySeatCost) : null;
        target.monthlySeatCost = seatCost;
      }
      target.typicalServiceTypeIds = Array.isArray(draft.typicalServiceTypeIds) ? draft.typicalServiceTypeIds : [];
      saveTeamMembers(wsId, updatedMembers);
      showToast('Member updated');
      closeDrawer();
      const container = document.getElementById('settingsTeamRoot');
      if (container) renderTeamTab(container);
    };
  }
}

export function renderSettingsPage(route = {}, container = document.getElementById('app-main')) {
  if (!container) {
    console.warn('[SettingsModule] container not found for renderSettingsPage.');
    return;
  }

  const activeTab = getActiveTab(route.tab);
  container.classList.remove('flex', 'items-center', 'justify-center', 'h-full');
  const isTeam = activeTab.key === 'team';
  const isServiceTypes = activeTab.key === 'service-types';
  const isWorkspace = activeTab.key === 'workspace';
  const isSubscription = activeTab.key === 'subscription';
  const isTerms = activeTab.key === 'terms';
  const isTemplates = activeTab.key === 'templates';
  container.innerHTML = `
    <div class="w-full h-full flex flex-col gap-4 pb-12">
      <div id="settingsHeaderRoot" class="px-4 pt-2 pb-2 md:pt-3 md:pb-2"></div>
      <div class="px-4">
        <div id="settingsTabs" class="flex flex-wrap items-center gap-2 border-b border-slate-200 dark:border-white/10 pb-2"></div>
      </div>
      ${isTeam ? '<div id="settingsTeamRoot" class="flex-1 px-4"></div>' : ''}
      ${isServiceTypes ? '<div id="settingsServiceTypesRoot" class="flex-1 px-4"></div>' : ''}
      ${isWorkspace ? '<div id="settingsWorkspaceRoot" class="flex-1 px-4"></div>' : ''}
      ${isSubscription ? '<div id="settingsSubscriptionRoot" class="flex-1 px-4"></div>' : ''}
      ${isTerms ? '<div id="settingsTermsRoot" class="flex-1 px-4"></div>' : ''}
      ${isTemplates ? '<div id="settingsTemplatesRoot" class="flex-1 px-4"></div>' : ''}
      ${(!isTeam && !isServiceTypes && !isWorkspace && !isSubscription && !isTerms && !isTemplates)
        ? `
          <div class="flex-1 px-4">
            <section class="rounded-2xl border border-slate-200 dark:border-white/10 bg-white/90 dark:bg-slate-800/90 backdrop-blur-sm shadow-sm px-6 py-6 md:px-8 md:py-8">
              <h2 class="text-lg md:text-xl font-semibold text-slate-900 dark:text-white">${activeTab.title}</h2>
              <p class="mt-2 text-sm md:text-base text-slate-600 dark:text-slate-300">${activeTab.blurb || ''}</p>
            </section>
          </div>
        `
        : ''}
    </div>
  `;

  const headerRoot = document.getElementById('settingsHeaderRoot');
  if (headerRoot) {
    try {
      const root = createRoot(headerRoot);
      root.render(h(SectionHeader, {
        title: 'Settings',
        showHelpIcon: false,
        showSecondaryRow: false,
        leftActions: [],
      }));
    } catch (e) {
      headerRoot.innerHTML = '<h1 class="text-2xl font-semibold text-slate-900 dark:text-white">Settings</h1>';
    }
  }

  const tabsRow = document.getElementById('settingsTabs');
  if (tabsRow) {
    tabsRow.innerHTML = SETTINGS_TABS.map(tab => `
      <button type="button" data-settings-tab="${tab.key}" class="px-3 py-1 rounded-full text-sm font-medium border ${
        tab.key === activeTab.key
          ? 'bg-[var(--color-brand-purple,#711FFF)] text-white border-transparent shadow-sm'
          : 'border-slate-200 dark:border-white/20 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800'
      }">
        ${tab.label}
      </button>
    `).join('');
    tabsRow.querySelectorAll('[data-settings-tab]').forEach(btn => {
      btn.addEventListener('click', () => {
        const key = btn.getAttribute('data-settings-tab');
        const match = SETTINGS_TABS.find(tab => tab.key === key);
        navigate(match?.hash || '#/app/settings/team');
      });
    });
  }

  if (isTeam) {
    const teamRoot = document.getElementById('settingsTeamRoot');
    if (teamRoot) renderTeamTab(teamRoot);
  }
  if (isServiceTypes) {
    const serviceTypesRoot = document.getElementById('settingsServiceTypesRoot');
    if (serviceTypesRoot) renderServiceTypesTab(serviceTypesRoot);
  }
  if (isWorkspace) {
    const workspaceRoot = document.getElementById('settingsWorkspaceRoot');
    if (workspaceRoot) renderWorkspaceSettingsTab(workspaceRoot);
  }
  if (isSubscription) {
    const subscriptionRoot = document.getElementById('settingsSubscriptionRoot');
    if (subscriptionRoot) renderSubscriptionTab(subscriptionRoot, route);
  }
  if (isTerms) {
    const termsRoot = document.getElementById('settingsTermsRoot');
    if (termsRoot) renderTermsTab(termsRoot);
  }
  if (isTemplates) {
    const templatesRoot = document.getElementById('settingsTemplatesRoot');
    if (templatesRoot) renderTemplatesTab(templatesRoot);
  }
}
