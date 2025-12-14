import { SectionHeader } from '../components/layout/SectionHeader.js';
import { loadHistory } from './contacts-import.js';
import { navigate } from '../router.js';

const { createElement: h } = React;
const { createRoot } = ReactDOM;

export function renderContactsImportHistory(container) {
  const root = container || document.getElementById('app-main');
  if (!root) return;
  const history = loadHistory();
  root.innerHTML = `
    <div class="contacts-import-page">
      <div id="contacts-import-history-header-root"></div>
      <div class="contacts-import-content">
        <div class="import-history">
          <div class="history-header flex items-center justify-between">
            <h3>Past uploads</h3>
            <button class="nn-btn nn-btn--full" id="back-to-import-btn" type="button">Back to Import</button>
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
      </div>
    </div>
  `;

  const headerEl = root.querySelector('#contacts-import-history-header-root');
  if (headerEl && createRoot) {
    const headerRoot = createRoot(headerEl);
    headerRoot.render(h(SectionHeader, {
      title: 'Past Uploads',
      showHelpIcon: true,
      showSearch: false,
      showSecondaryRow: false,
    }));
  }

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

  root.querySelectorAll('.history-download').forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      downloadExceptions();
    });
  });
  root.querySelector('#back-to-import-btn')?.addEventListener('click', () => {
    navigate('#/app/contacts/import');
  });
}
