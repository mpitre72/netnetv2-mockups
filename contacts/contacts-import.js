import { SectionHeader } from '../components/layout/SectionHeader.js';

const { createElement: h } = React;
const { createRoot } = ReactDOM;

const IMPORT_SESSION_KEY = 'netnet_contacts_import_session';
const IMPORT_HISTORY_KEY = 'netnet_contacts_import_history';

const fieldCatalog = [
  {
    group: 'Person',
    fields: [
      { id: 'person.email', label: 'Person Email', required: true },
      { id: 'person.firstName', label: 'First Name' },
      { id: 'person.lastName', label: 'Last Name' },
      { id: 'person.title', label: 'Title' },
      { id: 'person.mobile', label: 'Mobile' },
      { id: 'person.officePhone', label: 'Office Phone' },
      { id: 'person.city', label: 'City' },
      { id: 'person.state', label: 'State' },
      { id: 'person.zip', label: 'ZIP' },
      { id: 'person.linkedin', label: 'LinkedIn' },
      { id: 'person.x', label: 'X / Twitter' },
      { id: 'person.instagram', label: 'Instagram' },
      { id: 'person.website', label: 'Website' },
    ],
  },
  {
    group: 'Company',
    fields: [
      { id: 'company.name', label: 'Company Name' },
      { id: 'company.website', label: 'Company Website' },
      { id: 'company.phone', label: 'Company Phone' },
      { id: 'company.city', label: 'Company City' },
      { id: 'company.state', label: 'Company State' },
      { id: 'company.zip', label: 'Company ZIP' },
      { id: 'company.linkedin', label: 'Company LinkedIn' },
      { id: 'company.instagram', label: 'Company Instagram' },
      { id: 'company.x', label: 'Company X / Twitter' },
    ],
  },
  {
    group: 'Address',
    fields: [
      { id: 'address.street', label: 'Street' },
      { id: 'address.city', label: 'City' },
      { id: 'address.state', label: 'State' },
      { id: 'address.postal', label: 'Postal Code' },
      { id: 'address.country', label: 'Country' },
    ],
  },
  {
    group: 'Social',
    fields: [
      { id: 'social.linkedin', label: 'LinkedIn' },
      { id: 'social.facebook', label: 'Facebook' },
      { id: 'social.instagram', label: 'Instagram' },
      { id: 'social.x', label: 'X / Twitter' },
      { id: 'social.website', label: 'Website' },
    ],
  },
  {
    group: 'Other',
    fields: [
      { id: 'other.notes', label: 'Notes' },
      { id: 'other.tags', label: 'Tags' },
    ],
  },
];

function loadHistory() {
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

function buildMockColumns(filename) {
  const sample = [
    { sourceName: 'Email', examples: ['ava.mitchell@example.com', 'leo.garcia@example.com'] },
    { sourceName: 'First Name', examples: ['Ava', 'Leo'] },
    { sourceName: 'Last Name', examples: ['Mitchell', 'Garcia'] },
    { sourceName: 'Title', examples: ['Founder', 'Producer'] },
    { sourceName: 'Mobile', examples: ['917-555-0101', '415-555-0132'] },
    { sourceName: 'Company', examples: ['Indie North', 'Studio Lumen'] },
    { sourceName: 'City', examples: ['Portland', 'San Francisco'] },
    { sourceName: 'State', examples: ['OR', 'CA'] },
    { sourceName: 'LinkedIn', examples: ['linkedin.com/in/avamitchell', 'linkedin.com/in/leogarcia'] },
    { sourceName: 'Instagram Handle', examples: ['@ava.writes', '@leo.producer'] },
    { sourceName: 'Notes', examples: ['Met at SXSW', 'Prefers SMS'] },
  ];
  const aliasMap = [
    { match: /email/i, target: 'person.email' },
    { match: /first/i, target: 'person.firstName' },
    { match: /last/i, target: 'person.lastName' },
    { match: /title/i, target: 'person.title' },
    { match: /mobile|cell/i, target: 'person.mobile' },
    { match: /company|organization/i, target: 'company.name' },
    { match: /city/i, target: 'person.city' },
    { match: /state/i, target: 'person.state' },
    { match: /linkedin/i, target: 'person.linkedin' },
    { match: /instagram/i, target: 'person.instagram' },
    { match: /notes/i, target: 'other.notes' },
  ];
  return sample.map((item, idx) => {
    const alias = aliasMap.find(a => a.match.test(item.sourceName));
    return {
      id: `col-${idx + 1}`,
      sourceName: item.sourceName,
      examples: item.examples,
      mappedTo: alias ? alias.target : null,
      skipped: false,
      status: alias ? 'auto' : 'needs',
    };
  });
}

function getStatusChip(status) {
  const map = {
    auto: { label: 'Auto', cls: 'status-auto' },
    needs: { label: 'Needs attention', cls: 'status-needs' },
    skipped: { label: 'Skipped', cls: 'status-skipped' },
  };
  const info = map[status] || map.needs;
  return `<span class="mapping-status ${info.cls}">${info.label}</span>`;
}

function renderStepper(step) {
  const steps = [
    { key: 'upload', label: 'Upload' },
    { key: 'map', label: 'Map Fields' },
    { key: 'results', label: 'Results' },
  ];
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

function renderUploadStep(state, scope) {
  const body = scope.querySelector('#contacts-import-body');
  if (!body) return;
  body.innerHTML = `
    <div class="import-card">
      <div class="upload-zone" id="contacts-upload-zone">
        <div class="upload-graphic">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6">
            <path d="M12 16V4" />
            <path d="m6 10 6-6 6 6" />
            <path d="M20 16v2a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-2" />
          </svg>
        </div>
        <p class="upload-title">Drag & drop a CSV or XLSX</p>
        <p class="upload-subtitle">Or choose a file from your computer</p>
        <div class="upload-actions">
          <label class="nn-btn nn-btn--primary cursor-pointer">
            Choose file
            <input type="file" id="contacts-upload-input" class="hidden" accept=".csv,.xlsx,.xls" />
          </label>
          <div class="template-links">
            <a href="/templates/contacts-sample.csv" download class="template-link">Download CSV template</a>
            <a href="/templates/contacts-sample.xlsx" download class="template-link">Download XLSX template</a>
          </div>
        </div>
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
    renderImportView(state, scope);
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
}

function renderResults(state, scope) {
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
    <div class="results-actions">
      <button class="nn-btn nn-btn--primary" id="download-exceptions">Download Exceptions</button>
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
  body.querySelectorAll('.history-download').forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      downloadExceptions();
    });
  });
}

function renderMappingStep(state, scope) {
  const body = scope.querySelector('#contacts-import-body');
  if (!body || !state.session) return;
  const columns = state.session.parsedColumns || [];
  const selected = columns.find(c => c.id === state.selectedColumnId) || columns[0];
  if (!selected && columns[0]) state.selectedColumnId = columns[0].id;
  const autoMapped = columns.filter(c => c.mappedTo && !c.skipped).length;
  const needsAttention = columns.filter(c => !c.mappedTo && !c.skipped).length;
  const skipped = columns.filter(c => c.skipped).length;
  const requiredMapped = columns.some(c => c.mappedTo === 'person.email' && !c.skipped);

  const groupTabs = fieldCatalog.map(f => f.group);
  if (!state.activeGroup) state.activeGroup = groupTabs[0];

  const renderColumnRow = (col) => `
    <div class="source-row ${col.id === state.selectedColumnId ? 'active' : ''}" data-id="${col.id}">
      <div class="source-main">
        <div class="source-name">${col.sourceName}</div>
        <div class="source-examples">${(col.examples || []).slice(0, 2).join(' • ')}</div>
      </div>
      ${getStatusChip(col.skipped ? 'skipped' : (col.mappedTo ? 'auto' : 'needs'))}
    </div>
  `;

  const selectedGroup = fieldCatalog.find(g => g.group === state.activeGroup) || fieldCatalog[0];
  const searchValue = state.searchTerm || '';
  const matchesSearch = (label) => label.toLowerCase().includes(searchValue.toLowerCase());
  const renderFieldOption = (field) => `
    <button class="target-option ${selected?.mappedTo === field.id ? 'selected' : ''}" data-target="${field.id}">
      <div class="target-label">${field.label}${field.required ? ' *' : ''}</div>
      <div class="target-meta">${field.id}</div>
    </button>
  `;

  body.innerHTML = `
    <div class="mapping-summary">
      <div class="pill auto">Auto-mapped: ${autoMapped}</div>
      <div class="pill needs">Needs attention: ${needsAttention}</div>
      <div class="pill skipped">Skipped: ${skipped}</div>
    </div>
    <div class="mapping-layout">
      <div class="source-pane">
        <div class="pane-title">Source columns</div>
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
            <div class="target-search">
              <input type="text" id="mapping-search" placeholder="Search Net Net fields…" value="${searchValue}" />
            </div>
            <div class="target-options">
              ${selectedGroup.fields.filter(f => !searchValue || matchesSearch(f.label)).map(renderFieldOption).join('') || '<div class="empty-state">No fields match your search.</div>'}
            </div>
            <div class="overwrite-row">
              <label>
                <input type="checkbox" id="overwrite-toggle" ${state.session.overwriteExisting ? 'checked' : ''} />
                Overwrite existing values
              </label>
              <div class="overwrite-advanced">Advanced overwrite controls (coming soon)</div>
            </div>
          </div>
        ` : '<div class="empty-state p-4 text-center text-gray-500">Select a source column to map.</div>'}
      </div>
    </div>
    <div class="import-footer">
      ${!requiredMapped ? '<div class="required-warning">Person Email is required to import.</div>' : ''}
      <button class="nn-btn nn-btn--primary ${requiredMapped ? '' : 'disabled opacity-50'}" id="start-import">Import</button>
    </div>
  `;

  body.querySelectorAll('.source-row').forEach(row => {
    row.addEventListener('click', () => {
      state.selectedColumnId = row.getAttribute('data-id');
      renderMappingStep(state, scope);
    });
  });

  body.querySelectorAll('.group-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      state.activeGroup = tab.getAttribute('data-group');
      renderMappingStep(state, scope);
    });
  });

  body.querySelector('#mapping-search')?.addEventListener('input', (e) => {
    state.searchTerm = e.target.value;
    renderMappingStep(state, scope);
  });

  body.querySelectorAll('.target-option').forEach(btn => {
    btn.addEventListener('click', () => {
      const target = btn.getAttribute('data-target');
      if (!selected) return;
      selected.mappedTo = target;
      selected.skipped = false;
      selected.status = 'auto';
      saveSession(state.session);
      renderMappingStep(state, scope);
    });
  });

  body.querySelector('#skip-column-toggle')?.addEventListener('change', (e) => {
    if (!selected) return;
    const checked = e.target.checked;
    selected.skipped = checked;
    if (checked) selected.mappedTo = null;
    saveSession(state.session);
    renderMappingStep(state, scope);
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
    renderImportView(state, scope);
  });
}

function renderImportView(state, scope) {
  const stepperMount = scope.querySelector('#contacts-import-stepper');
  if (stepperMount) stepperMount.innerHTML = renderStepper(state.step);
  if (state.step === 'upload') {
    renderUploadStep(state, scope);
  } else if (state.step === 'map') {
    renderMappingStep(state, scope);
  } else {
    renderResults(state, scope);
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
  };

  root.innerHTML = `
    <div class="contacts-import-page">
      <div id="contacts-import-header-root"></div>
      <div class="contacts-import-content">
        <div id="contacts-import-stepper"></div>
        <div id="contacts-import-body"></div>
      </div>
    </div>
  `;

  const headerEl = root.querySelector('#contacts-import-header-root');
  if (headerEl && createRoot) {
    const headerRoot = createRoot(headerEl);
    headerRoot.render(h(SectionHeader, {
      title: 'Contacts Import',
      showHelpIcon: true,
      showSearch: false,
      leftActions: [],
      rightActions: [],
    }));
  }

  renderImportView(state, root);
}
