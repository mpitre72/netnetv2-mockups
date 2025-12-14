import { SectionHeader } from '../components/layout/SectionHeader.js';
import { navigate } from '../router.js';

const { createElement: h } = React;
const { createRoot } = ReactDOM;

const IMPORT_SESSION_KEY = 'netnet_contacts_import_session';
const IMPORT_HISTORY_KEY = 'netnet_contacts_import_history';

const steps = [
  { key: 'upload', label: 'Upload' },
  { key: 'map', label: 'Map Fields' },
  { key: 'results', label: 'Results' },
];

const personBaseFields = [
  { id: 'person.email', label: 'Person Email', required: true },
  { id: 'person.firstName', label: 'First Name' },
  { id: 'person.lastName', label: 'Last Name' },
  { id: 'person.title', label: 'Title' },
  { id: 'person.mobile', label: 'Mobile Phone' },
  { id: 'person.officePhone', label: 'Office Phone' },
  { id: 'person.company', label: 'Company (lookup)' },
];

const personSocialFields = [
  { id: 'person.linkedin', label: 'LinkedIn' },
  { id: 'person.facebook', label: 'Facebook' },
  { id: 'person.x', label: 'X / Twitter' },
  { id: 'person.instagram', label: 'Instagram' },
  { id: 'person.tiktok', label: 'TikTok' },
  { id: 'person.whatsapp', label: 'WhatsApp' },
  { id: 'person.youtube', label: 'YouTube' },
  { id: 'person.snapchat', label: 'Snapchat' },
  { id: 'person.threads', label: 'Threads' },
  { id: 'person.reddit', label: 'Reddit' },
  { id: 'person.pinterest', label: 'Pinterest' },
  { id: 'person.website', label: 'Website (Personal)' },
];

const personAddressUS = [
  { id: 'person.address1', label: 'Address 1' },
  { id: 'person.address2', label: 'Address 2' },
  { id: 'person.city', label: 'City' },
  { id: 'person.state', label: 'State' },
  { id: 'person.zip', label: 'ZIP Code' },
];

const personAddressIntl = [
  { id: 'person.addressLine1', label: 'Address Line 1' },
  { id: 'person.addressLine2', label: 'Address Line 2' },
  { id: 'person.addressLine3', label: 'Address Line 3' },
  { id: 'person.cityTown', label: 'City / Town' },
  { id: 'person.region', label: 'Region / Province' },
  { id: 'person.postalCode', label: 'Postal Code' },
  { id: 'person.country', label: 'Country' },
];

const companyBaseFields = [
  { id: 'company.name', label: 'Company Name' },
  { id: 'company.industry', label: 'Industry' },
  { id: 'company.description', label: 'Description' },
  { id: 'company.email', label: 'Email' },
  { id: 'company.officePhone', label: 'Office Phone' },
  { id: 'company.altPhone', label: 'Alternate Phone' },
  { id: 'company.website', label: 'Website' },
];

const companySocialFields = [
  { id: 'company.linkedin', label: 'LinkedIn' },
  { id: 'company.facebook', label: 'Facebook' },
  { id: 'company.x', label: 'X / Twitter' },
  { id: 'company.instagram', label: 'Instagram' },
  { id: 'company.tiktok', label: 'TikTok' },
  { id: 'company.whatsapp', label: 'WhatsApp' },
  { id: 'company.youtube', label: 'YouTube' },
  { id: 'company.snapchat', label: 'Snapchat' },
  { id: 'company.threads', label: 'Threads' },
  { id: 'company.reddit', label: 'Reddit' },
  { id: 'company.pinterest', label: 'Pinterest' },
  { id: 'company.websiteAlt', label: 'Alternate Website' },
];

const companyAddressUS = [
  { id: 'company.address1', label: 'Address 1' },
  { id: 'company.address2', label: 'Address 2' },
  { id: 'company.city', label: 'City' },
  { id: 'company.state', label: 'State' },
  { id: 'company.zip', label: 'ZIP Code' },
];

const companyAddressIntl = [
  { id: 'company.addressLine1', label: 'Address Line 1' },
  { id: 'company.addressLine2', label: 'Address Line 2' },
  { id: 'company.addressLine3', label: 'Address Line 3' },
  { id: 'company.cityTown', label: 'City / Town' },
  { id: 'company.region', label: 'Region / Province' },
  { id: 'company.postalCode', label: 'Postal Code' },
  { id: 'company.country', label: 'Country' },
];

function getTargetFields(group, addrMode = 'us') {
  const isIntl = addrMode === 'intl';
  if (group === 'Person') {
    return [
      ...personBaseFields,
      ...(isIntl ? personAddressIntl : personAddressUS),
      ...personSocialFields,
    ];
  }
  return [
    ...companyBaseFields,
    ...(isIntl ? companyAddressIntl : companyAddressUS),
    ...companySocialFields,
  ];
}

export function loadHistory() {
  try {
    const raw = localStorage.getItem(IMPORT_HISTORY_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
}

function saveHistory(list) {
  try {
    localStorage.setItem(IMPORT_HISTORY_KEY, JSON.stringify(list.slice(0, 10)));
  } catch (e) {
    // noop
  }
}

function loadSession() {
  try {
    const raw = localStorage.getItem(IMPORT_SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    return null;
  }
}

function saveSession(session) {
  try {
    localStorage.setItem(IMPORT_SESSION_KEY, JSON.stringify(session));
  } catch (e) {
    // noop
  }
}

function clearSession() {
  try {
    localStorage.removeItem(IMPORT_SESSION_KEY);
  } catch (e) {
    // ignore
  }
}

export function resetImportSession() {
  clearSession();
}

function buildMockColumns(filename) {
  const sample = [
    { sourceName: 'Email', examples: ['ava.mitchell@example.com', 'leo.garcia@example.com'], mappedTo: 'person.email', origin: 'auto' },
    { sourceName: 'First Name', examples: ['Ava', 'Leo'], mappedTo: null, origin: null },
    { sourceName: 'Last Name', examples: ['Mitchell', 'Garcia'], mappedTo: null, origin: null },
    { sourceName: 'Title', examples: ['Founder', 'Producer'], mappedTo: null, origin: null },
    { sourceName: 'Mobile', examples: ['917-555-0101', '415-555-0132'], mappedTo: null, origin: null },
    { sourceName: 'Company', examples: ['Indie North', 'Studio Lumen'], mappedTo: 'company.name', origin: 'auto' },
    { sourceName: 'City', examples: ['Portland', 'San Francisco'], mappedTo: null, origin: null },
    { sourceName: 'State', examples: ['OR', 'CA'], mappedTo: null, origin: null },
    { sourceName: 'LinkedIn', examples: ['linkedin.com/in/avamitchell', 'linkedin.com/in/leogarcia'], mappedTo: 'person.linkedin', origin: 'auto' },
    { sourceName: 'Instagram Handle', examples: ['@ava.writes', '@leo.producer'], mappedTo: null, origin: null },
  ];
  return sample.map((item, idx) => ({
    id: `col-${idx + 1}`,
    sourceName: item.sourceName,
    examples: item.examples,
    mappedTo: item.mappedTo || null,
    mappedOrigin: item.origin || null,
    skipped: false,
  }));
}

function getColumnStatus(col) {
  if (col.skipped) return 'skipped';
  if (col.mappedTo) {
    return col.mappedOrigin === 'manual' ? 'mapped' : 'auto';
  }
  return 'needs';
}

function getStatusChip(status) {
  const map = {
    auto: { label: 'Auto', cls: 'status-auto' },
    mapped: { label: 'Mapped', cls: 'status-auto' },
    needs: { label: 'Needs attention', cls: 'status-needs' },
    skipped: { label: 'Skipped', cls: 'status-skipped' },
  };
  const info = map[status] || map.needs;
  return `<span class="mapping-status ${info.cls}">${info.label}</span>`;
}

function renderStepper(step) {
  return `
    <div class="contacts-import-stepper">
      ${steps.map((s, idx) => {
        const active = s.key === step;
        const done = steps.findIndex(st => st.key === step) > idx;
        return `
          <div class="step ${active ? 'active' : ''} ${done ? 'done' : ''}">
            <span class="step-index">${idx + 1}</span>
            <span class="step-label">${s.label}</span>
          </div>
        `;
      }).join('')}
    </div>
  `;
}

function goToContactsMain() {
  if (typeof navigate === 'function') {
    navigate('#/app/contacts');
  } else {
    window.location.hash = '#/app/contacts';
  }
}

function showCancelConfirm(onConfirm) {
  const overlay = document.createElement('div');
  overlay.className = 'nn-modal-overlay';
  overlay.innerHTML = `
    <div class="nn-modal-card">
      <div class="space-y-3">
        <h3 class="text-lg font-semibold">Cancel import?</h3>
        <p class="text-sm text-slate-600 dark:text-slate-200 import-modal-copy">Are you sure you want to cancel? Your Import will not complete.</p>
        <div class="flex items-center justify-end gap-2">
          <button type="button" class="nn-btn nn-btn--full" id="import-cancel-stay">Keep going</button>
          <button type="button" class="nn-btn nn-btn--full" id="import-cancel-confirm">Cancel import</button>
        </div>
      </div>
    </div>
  `;
  const remove = () => overlay.remove();
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) remove();
  });
  overlay.querySelector('#import-cancel-stay')?.addEventListener('click', remove);
  overlay.querySelector('#import-cancel-confirm')?.addEventListener('click', () => {
    remove();
    onConfirm && onConfirm();
  });
  document.body.appendChild(overlay);
}

function renderUploadStep(state, scope, renderHeader) {
  const body = scope.querySelector('#contacts-import-body');
  if (!body) return;
  body.innerHTML = `
    <div class="import-card">
      <div class="import-instructions">
        <h3>Get ready to import</h3>
        <p>Upload a CSV or XLSX file. You’ll map your columns to Net Net fields in the next step. Download the sample files below if you need a starting point.</p>
      </div>
      <div class="upload-zone" id="contacts-upload-zone">
        <div class="upload-graphic upload-graphic-import">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6">
            <path d="M12 21V9" />
            <path d="M8 13l4-4 4 4" />
            <path d="M6 3h12" />
          </svg>
        </div>
        <p class="upload-title">Drag & drop a CSV or XLSX</p>
        <p class="upload-subtitle">Or choose a file from your computer</p>
        <div class="upload-actions">
          <div class="upload-btn-row">
            <label class="nn-btn nn-btn--full cursor-pointer">
              Choose file
            <input type="file" id="contacts-upload-input" class="hidden" accept=".csv,.xlsx,.xls" />
          </label>
          </div>
        </div>
      </div>
      <div class="template-links template-button-row">
        <button class="nn-btn nn-btn--mini compact-icon-btn" id="download-xls-btn" type="button">
          <svg class="h-4 w-4" viewBox="0 0 24 24" fill="currentColor"><path d="M5 2h10l4 4v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2Zm10 5h3.5L15 3.5V7Z"/><path d="M7.2 12h1.4l.9 1.4.9-1.4h1.4l-1.6 2.4 1.6 2.4h-1.4l-.9-1.4-.9 1.4H7.2l1.6-2.4-1.6-2.4Zm4.8 0h1.3l.9 1.5.9-1.5h1.3l-1.5 2.5 1.5 2.3h-1.3l-.9-1.4-.9 1.4H12l1.5-2.3L12 12Zm5.2 0c.9 0 1.5.5 1.5 1.2 0 .5-.3.9-.8 1.1.5.1.9.5.9 1 0 .8-.7 1.3-1.6 1.3h-2V12h2Zm.4 1.6c.3 0 .5-.2.5-.4 0-.3-.2-.4-.5-.4h-.7v.8h.7Zm.2 1.7c.3 0 .5-.2.5-.5s-.2-.5-.5-.5h-.9v1h.9Z"/></svg>
          <span>Download XLS Sample</span>
        </button>
        <button class="nn-btn nn-btn--mini compact-icon-btn" id="download-csv-btn" type="button">
          <svg class="h-4 w-4" viewBox="0 0 24 24" fill="currentColor"><path d="M5 2h10l4 4v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2Zm10 5h3.5L15 3.5V7Z"/><path d="M8.2 13c0-1 .8-1.8 2-1.8.6 0 1.2.2 1.6.6l-.5.7c-.3-.3-.6-.4-1-.4-.6 0-1 .4-1 .9 0 .6.4 1 .9 1 .4 0 .7-.1 1-.4l.5.6c-.4.4-1 .6-1.7.6-1.1 0-2-.8-2-1.8Zm4 1.8.3-.8c.3.2.7.4 1.1.4.3 0 .5-.1.5-.3 0-.6-1.8-.2-1.8-1.4 0-.7.6-1.2 1.4-1.2.4 0 .9.1 1.3.3l-.3.8c-.3-.1-.7-.3-1-.3-.2 0-.4.1-.4.3 0 .5 1.8.2 1.8 1.4 0 .7-.6 1.2-1.5 1.2-.5 0-1.1-.1-1.4-.3Zm3.4.1c-.5-.2-.8-.7-.8-1.3 0-.9.6-1.6 1.6-1.6.5 0 .9.2 1.3.5l-.4.6c-.2-.2-.4-.3-.7-.3-.3 0-.6.2-.6.6 0 .4.3.6.6.6.3 0 .6-.1.8-.3l.4.5c-.3.4-.7.6-1.3.6-.3 0-.6-.1-.9-.3Z"/></svg>
          <span>Download CSV Sample</span>
        </button>
        <button class="nn-btn nn-btn--mini compact-icon-btn" id="view-history-btn" type="button">
          <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M3 5h18"/><path d="M3 12h18"/><path d="M3 19h18"/><path d="M9 9V7"/><path d="M9 16v-2"/><path d="M9 23v-2"/></svg>
          <span>View Past Uploads</span>
        </button>
      </div>
    </div>
  `;

  const fileInput = body.querySelector('#contacts-upload-input');
  const uploadZone = body.querySelector('#contacts-upload-zone');
  const goToMap = (fileName) => {
    const session = {
      filename: fileName || 'contacts-upload.csv',
      uploadedAt: new Date().toISOString(),
      parsedColumns: buildMockColumns(fileName),
      overwriteExisting: true,
      step: 'map',
    };
    state.session = session;
    state.step = 'map';
    state.selectedColumnId = session.parsedColumns[0]?.id || null;
    saveSession(session);
    renderHeader && renderHeader();
    renderImportView(state, scope, renderHeader);
  };

  fileInput?.addEventListener('change', (e) => {
    const file = e.target.files && e.target.files[0];
    goToMap(file ? file.name : 'contacts-upload.csv');
  });

  uploadZone?.addEventListener('dragover', (e) => {
    e.preventDefault();
    uploadZone.classList.add('dragging');
  });
  uploadZone?.addEventListener('dragleave', () => uploadZone.classList.remove('dragging'));
  uploadZone?.addEventListener('drop', (e) => {
    e.preventDefault();
    uploadZone.classList.remove('dragging');
    const file = e.dataTransfer?.files?.[0];
    goToMap(file ? file.name : 'contacts-upload.csv');
  });

  const triggerDownload = (path, name) => {
    const a = document.createElement('a');
    a.href = path;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };
  body.querySelector('#download-xls-btn')?.addEventListener('click', () => {
    triggerDownload('/templates/contacts-sample.xlsx', 'contacts-sample.xlsx');
  });
  body.querySelector('#download-csv-btn')?.addEventListener('click', () => {
    triggerDownload('/templates/contacts-sample.csv', 'contacts-sample.csv');
  });
  body.querySelector('#view-history-btn')?.addEventListener('click', () => {
    navigate('#/app/contacts/import/history');
  });
}

function renderResults(state, scope, renderHeader) {
  const body = scope.querySelector('#contacts-import-body');
  if (!body) return;
  const history = loadHistory();
  const latest = history[0];
  const stats = latest?.stats || state.results || {
    processed: 120,
    peopleCreated: 64,
    peopleUpdated: 40,
    companiesCreated: 10,
    companiesUpdated: 6,
    failed: 6,
  };
  const makeStat = (label, value) => `
    <div class="stat-card">
      <p class="stat-label">${label}</p>
      <p class="stat-value">${value}</p>
    </div>
  `;
  body.innerHTML = `
    <div class="results-grid">
      ${makeStat('Total rows processed', stats.processed)}
      ${makeStat('People created', stats.peopleCreated)}
      ${makeStat('People updated', stats.peopleUpdated)}
      ${makeStat('Companies created', stats.companiesCreated)}
      ${makeStat('Companies updated', stats.companiesUpdated)}
      ${makeStat('Failed rows', stats.failed)}
    </div>
    <div class="results-actions flex items-center gap-3 justify-between">
      <div class="results-download-heading" id="download-exceptions">Download Exceptions</div>
    </div>
    <div class="import-history">
      <div class="history-header">
        <h3>Recent imports</h3>
      </div>
      <div class="history-table">
        <div class="history-row head">
          <div>Filename</div>
          <div>Date</div>
          <div>Processed</div>
          <div>Failed</div>
          <div>Exceptions</div>
        </div>
        ${history.length ? history.map(item => `
          <div class="history-row">
            <div>${item.filename}</div>
            <div>${new Date(item.uploadedAt).toLocaleString()}</div>
            <div>${item.stats.processed}</div>
            <div>${item.stats.failed}</div>
            <div><a href="#" class="history-download" data-id="${item.id}">Download</a></div>
          </div>
        `).join('') : '<div class="history-empty">No imports yet.</div>'}
      </div>
    </div>
    <div class="results-finish">
      <button class="nn-btn nn-btn--full" id="results-finish-btn" type="button">Finished</button>
    </div>
  `;

  const downloadExceptions = () => {
    const csv = 'Email,First Name,Last Name,Failure reason\ninvalid@example,Test,User,Invalid email\n';
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'import-exceptions.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  body.querySelector('#download-exceptions')?.addEventListener('click', downloadExceptions);
  body.querySelector('#results-finish-btn')?.addEventListener('click', () => {
    resetImportSession();
    goToContactsMain();
  });
  body.querySelectorAll('.history-download').forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      downloadExceptions();
    });
  });
}

function renderMappingStep(state, scope, renderHeader) {
  const body = scope.querySelector('#contacts-import-body');
  if (!body || !state.session) return;
  const columns = state.session.parsedColumns || [];
  const selected = columns.find(c => c.id === state.selectedColumnId) || columns[0];
  if (!selected && columns[0]) state.selectedColumnId = columns[0].id;
  const autoMapped = columns.filter(c => getColumnStatus(c) === 'auto').length;
  const mappedManual = columns.filter(c => getColumnStatus(c) === 'mapped').length;
  const mappedTotal = autoMapped + mappedManual;
  const needsAttention = columns.filter(c => getColumnStatus(c) === 'needs').length;
  const skipped = columns.filter(c => getColumnStatus(c) === 'skipped').length;
  const requiredMapped = columns.some(c => c.mappedTo === 'person.email' && !c.skipped);

  const groupTabs = ['Person', 'Company'];
  if (!state.activeGroup) state.activeGroup = groupTabs[0];
  if (!state.personAddrMode) state.personAddrMode = 'us';
  if (!state.companyAddrMode) state.companyAddrMode = 'us';

  const renderColumnRow = (col) => `
    <div class="source-row ${col.id === state.selectedColumnId ? 'active' : ''}" data-id="${col.id}">
      <div class="source-main">
        <div class="source-name">${col.sourceName}</div>
        <div class="source-examples">${(col.examples || []).slice(0, 2).join(' • ')}</div>
      </div>
      ${getStatusChip(getColumnStatus(col))}
    </div>
  `;

  const selectedGroup = state.activeGroup;
  const searchValue = state.searchTerm || '';
  const matchesSearch = (label) => label.toLowerCase().includes(searchValue.toLowerCase());
  const currentAddrMode = selectedGroup === 'Person' ? state.personAddrMode : state.companyAddrMode;
  const targetFields = getTargetFields(selectedGroup, currentAddrMode);
  const renderFieldOption = (field) => `
    <button class="target-option ${selected?.mappedTo === field.id ? 'selected' : ''}" data-target="${field.id}">
      <div class="target-label">${field.label}${field.required ? ' *' : ''}</div>
      <div class="target-meta">${field.id}</div>
    </button>
  `;

  body.innerHTML = `
    <div class="mapping-layout">
      <div class="source-pane">
        <div class="pane-title">Source columns</div>
        <div class="mapping-summary">
          <div class="pill auto">Mapped: ${mappedTotal}</div>
          <div class="pill needs">Needs attention: ${needsAttention}</div>
          <div class="pill skipped">Skipped: ${skipped}</div>
        </div>
        <div class="source-list">
          ${columns.map(renderColumnRow).join('')}
        </div>
      </div>
      <div class="target-pane">
        ${selected ? `
          <div class="pane-title">Map “${selected.sourceName}”</div>
          <div class="examples-row">${(selected.examples || []).slice(0, 3).join(' • ')}</div>
          <label class="skip-toggle">
            <input type="checkbox" ${selected.skipped ? 'checked' : ''} id="skip-column-toggle" />
            <span>Skip this column</span>
          </label>
          <div class="target-controls">
            <div class="group-tabs">
              ${groupTabs.map(g => `<button class="group-tab ${state.activeGroup === g ? 'active' : ''}" data-group="${g}">${g}</button>`).join('')}
            </div>
            <div class="addr-toggle-row">
              <span class="addr-toggle-label">Address format</span>
              <label class="inline-flex items-center gap-2 text-xs text-gray-600 dark:text-gray-300 addr-switch" data-group="${selectedGroup}">
                <span>US</span>
                <input type="checkbox" class="sr-only peer" ${currentAddrMode === 'intl' ? 'checked' : ''}>
                <div class="relative w-9 h-5 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-netnet-purple dark:peer-focus:ring-white rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all dark:border-gray-600 peer-checked:bg-netnet-purple"></div>
                <span>Intl</span>
              </label>
            </div>
            <div class="target-search">
              <input type="text" id="mapping-search" placeholder="Search Net Net fields…" value="${searchValue}" />
            </div>
            <div class="target-options">
              ${targetFields.filter(f => !searchValue || matchesSearch(f.label)).map(renderFieldOption).join('') || '<div class="empty-state">No fields match your search.</div>'}
            </div>
            <div class="overwrite-row">
              <label>
                <input type="checkbox" id="overwrite-toggle" ${state.session.overwriteExisting ? 'checked' : ''} />
                Overwrite existing values
              </label>
            </div>
          </div>
        ` : '<div class="empty-state p-4 text-center text-gray-500">Select a source column to map.</div>'}
      </div>
    </div>
    <div class="import-footer">
      ${!requiredMapped ? '<div class="required-warning">Person Email is required to import.</div>' : ''}
      <div class="flex items-center gap-3">
        <button class="nn-btn nn-btn--full" type="button" id="map-cancel-btn">Cancel</button>
        <button class="nn-btn nn-btn--full ${requiredMapped ? '' : 'disabled opacity-50'}" id="start-import">Import</button>
      </div>
    </div>
  `;

  body.querySelectorAll('.source-row').forEach(row => {
    row.addEventListener('click', () => {
      state.selectedColumnId = row.getAttribute('data-id');
      renderMappingStep(state, scope, renderHeader);
    });
  });

  body.querySelectorAll('.group-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      state.activeGroup = tab.getAttribute('data-group');
      renderMappingStep(state, scope, renderHeader);
    });
  });

  body.querySelectorAll('.addr-switch input').forEach(input => {
    input.addEventListener('change', () => {
      const group = input.closest('.addr-switch')?.getAttribute('data-group');
      const mode = input.checked ? 'intl' : 'us';
      if (group === 'Person') state.personAddrMode = mode;
      else state.companyAddrMode = mode;
      renderMappingStep(state, scope, renderHeader);
    });
  });

  body.querySelector('#mapping-search')?.addEventListener('input', (e) => {
    state.searchTerm = e.target.value;
    renderMappingStep(state, scope, renderHeader);
  });

  body.querySelectorAll('.target-option').forEach(btn => {
    btn.addEventListener('click', () => {
      const target = btn.getAttribute('data-target');
      if (!selected) return;
      selected.mappedTo = target;
      selected.skipped = false;
      selected.mappedOrigin = 'manual';
      saveSession(state.session);
      renderMappingStep(state, scope, renderHeader);
    });
  });

  body.querySelector('#skip-column-toggle')?.addEventListener('change', (e) => {
    if (!selected) return;
    const checked = e.target.checked;
    selected.skipped = checked;
    if (checked) selected.mappedTo = null;
    if (checked) selected.mappedOrigin = null;
    saveSession(state.session);
    renderMappingStep(state, scope, renderHeader);
  });

  body.querySelector('#overwrite-toggle')?.addEventListener('change', (e) => {
    state.session.overwriteExisting = e.target.checked;
    saveSession(state.session);
  });

  body.querySelector('#start-import')?.addEventListener('click', () => {
    if (!requiredMapped) return;
    const results = {
      processed: 120,
      peopleCreated: 64,
      peopleUpdated: 40,
      companiesCreated: 12,
      companiesUpdated: 8,
      failed: 6,
    };
    const history = loadHistory();
    const record = {
      id: `run-${Date.now()}`,
      filename: state.session.filename,
      uploadedAt: state.session.uploadedAt,
      stats: results,
    };
    history.unshift(record);
    saveHistory(history);
    state.results = results;
    state.step = 'results';
    clearSession();
    renderHeader && renderHeader();
    renderImportView(state, scope, renderHeader);
  });

  body.querySelector('#map-cancel-btn')?.addEventListener('click', () => {
    showCancelConfirm(() => {
      resetImportSession();
      goToContactsMain();
    });
  });
}

function renderImportView(state, scope, renderHeader) {
  renderHeader && renderHeader();
  if (state.step === 'upload') {
    renderUploadStep(state, scope, renderHeader);
  } else if (state.step === 'map') {
    renderMappingStep(state, scope, renderHeader);
  } else {
    renderResults(state, scope, renderHeader);
  }
}

export function renderContactsImport(container) {
  const root = container || document.getElementById('app-main');
  if (!root) return;
  const savedSession = loadSession();
  const state = {
    step: savedSession?.step || 'upload',
    session: savedSession,
    selectedColumnId: savedSession?.parsedColumns?.[0]?.id || null,
    activeGroup: null,
    searchTerm: '',
    results: null,
    personAddrMode: 'us',
    companyAddrMode: 'us',
  };

  root.innerHTML = `
    <div class="contacts-import-page">
      <div id="contacts-import-header-root"></div>
      <div class="contacts-import-content">
        <div id="contacts-import-body"></div>
      </div>
    </div>
  `;

  const headerEl = root.querySelector('#contacts-import-header-root');
  const headerRoot = headerEl && createRoot ? createRoot(headerEl) : null;
  const switcherOptions = steps.map(s => ({ label: s.label, value: s.key }));
  let renderHeader = () => {};
  const handleStepChange = (next) => {
    if (next === 'upload') {
      state.step = 'upload';
    } else if (next === 'map') {
      if (state.session) {
        state.step = 'map';
      } else {
        return;
      }
    } else if (next === 'results') {
      if (state.step === 'results' || state.results) {
        state.step = 'results';
      } else {
        return;
      }
    }
    renderHeader();
    renderImportView(state, root, renderHeader);
  };
  renderHeader = () => {
    if (!headerRoot) return;
    headerRoot.render(h(SectionHeader, {
      title: 'Contacts Import',
      showHelpIcon: true,
      showSearch: false,
      switcherOptions,
      switcherValue: state.step,
      onSwitcherChange: handleStepChange,
      leftActions: null,
      rightActions: null,
    }));
  };
  renderHeader();
  renderImportView(state, root, renderHeader);
}
