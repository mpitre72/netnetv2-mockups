import { getContactsData } from './contacts-data.js';

let companyIdSeed = 10000;

function nextCompanyId() {
  companyIdSeed += 1;
  return companyIdSeed;
}

function getCompaniesMutable() {
  const data = (typeof window !== 'undefined') ? window.mockContactsData : null;
  return Array.isArray(data) ? data : [];
}

function getGlobalModalLayer(id) {
  if (typeof document === 'undefined') return null;
  let layer = document.getElementById(id);
  if (!layer) {
    layer = document.createElement('div');
    layer.id = id;
    document.body.appendChild(layer);
  }
  return layer;
}

function normalizeName(name) {
  return (name || '').trim().toLowerCase();
}

export function findCompanyByName(name) {
  const target = normalizeName(name);
  if (!target) return null;
  return getContactsData().find(c => normalizeName(c.name) === target) || null;
}

function addCompany(name) {
  const companies = getCompaniesMutable();
  const newCo = {
    id: nextCompanyId(),
    name,
    website: '',
    phone: '',
    city: '',
    state: '',
    people: [],
  };
  companies.push(newCo);
  return newCo;
}

function filterCompanies(term) {
  const data = getContactsData();
  const q = (term || '').trim().toLowerCase();
  if (!q) return data.slice(0, 8);
  return data.filter(c => c.name.toLowerCase().includes(q)).slice(0, 8);
}

function renderDropdownItems(matches, term) {
  const addRow = term.trim()
    ? `<li class="lookup-item add" data-action="add">+ Add new company "${term}"</li>`
    : '';
  const matchRows = matches.map((m, idx) =>
    `<li class="lookup-item" data-id="${m.id}" data-idx="${idx}">${m.name}</li>`).join('');
  return `${matchRows}${addRow}`;
}

function renderModal(term) {
  return `
    <div class="nn-modal-overlay" role="presentation" data-modal="quick-add-company">
      <div class="lookup-modal" role="dialog" aria-modal="true" aria-label="Quick Add Company">
        <div class="lookup-modal__header">
          <h3>Quick Add Company</h3>
        </div>
        <p class="lookup-modal__body">We’ll create this company so you can continue.<br>You can fill in full details later in Contacts.</p>
        <label class="lookup-modal__label">Company Name</label>
        <input id="quick-add-name" class="lookup-input" value="${term.replace(/"/g, '&quot;')}" placeholder="Company name" />
        <p id="quick-add-error" class="lookup-error" aria-live="polite"></p>
        <div class="lookup-modal__actions">
          <button type="button" class="lookup-btn ghost" data-action="cancel">Cancel</button>
          <button type="button" class="lookup-btn primary" data-action="save">Save & Continue</button>
        </div>
      </div>
    </div>
  `;
}

export function mountCompanyLookup(root, { label = 'Company', placeholder = 'Search companies...', value = null, onChange = () => {} } = {}) {
  if (!root) return;
  const state = {
    open: false,
    matches: filterCompanies(''),
    term: value?.name || '',
    highlighted: -1,
  };

  root.innerHTML = `
    <div class="lookup-field">
      <label class="lookup-label">${label}</label>
      <div class="lookup-input-wrap">
        <input type="text" class="lookup-input" placeholder="${placeholder}" value="${state.term}" aria-label="${label}" />
        <div class="lookup-menu-card" style="display:none;"></div>
      </div>
    </div>
  `;

  const input = root.querySelector('input.lookup-input');
  const menu = root.querySelector('.lookup-menu-card');
  const modalLayer = getGlobalModalLayer('quick-add-company-layer');

  function renderMenu() {
    const hasItems = state.matches.length > 0 || state.term.trim();
    if (!state.open || !hasItems) {
      menu.style.display = 'none';
      return;
    }
    menu.innerHTML = `<ul class="lookup-menu">${renderDropdownItems(state.matches, state.term)}</ul>`;
    menu.style.display = 'block';
    menu.querySelectorAll('.lookup-item').forEach((item, idx) => {
      item.classList.toggle('active', idx === state.highlighted);
    });
  }

  function closeMenu() {
    state.open = false;
    renderMenu();
  }

  function openMenu() {
    state.open = true;
    renderMenu();
  }

  function updateMatches(term) {
    state.matches = filterCompanies(term);
    state.highlighted = state.matches.length ? 0 : -1;
    renderMenu();
  }

  function selectCompany(company) {
    state.term = company?.name || '';
    input.value = state.term;
    onChange(company);
    closeMenu();
  }

  function openQuickCreate(prefill) {
    if (!modalLayer) return;
    modalLayer.innerHTML = renderModal(prefill);
    modalLayer.style.display = 'block';
    const nameInput = modalLayer.querySelector('#quick-add-name');
    const errorEl = modalLayer.querySelector('#quick-add-error');
    nameInput.focus();
    const endPos = nameInput.value.length;
    nameInput.setSelectionRange(endPos, endPos);
    modalLayer.addEventListener('click', (e) => {
      if (e.target.classList.contains('nn-modal-overlay')) {
        modalLayer.innerHTML = '';
        modalLayer.style.display = 'none';
        input.focus();
      }
    }, { once: true });
    modalLayer.querySelectorAll('[data-action]').forEach(btn => {
      btn.onclick = () => {
        if (btn.dataset.action === 'cancel') {
          modalLayer.innerHTML = '';
          modalLayer.style.display = 'none';
          input.focus();
        } else {
          const name = nameInput.value.trim();
          if (!name) {
            errorEl.textContent = 'Company name is required.';
            nameInput.focus();
            return;
          }
          if (findCompanyByName(name)) {
            errorEl.textContent = 'Company name already exists.';
            nameInput.focus();
            return;
          }
          const newCo = addCompany(name);
          modalLayer.innerHTML = '';
          modalLayer.style.display = 'none';
          selectCompany(newCo);
          if (typeof window !== 'undefined' && typeof window.showToast === 'function') {
            window.showToast('Company created. You can complete details later in Contacts.');
          }
        }
      };
    });
  }

  input.addEventListener('focus', () => {
    updateMatches(input.value);
    openMenu();
  });

  input.addEventListener('input', (e) => {
    state.term = e.target.value;
    if (!state.term.trim()) {
      onChange(null);
    }
    updateMatches(state.term);
    openMenu();
  });

  input.addEventListener('keydown', (e) => {
    const items = Array.from(menu.querySelectorAll('.lookup-item'));
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (!items.length) return;
      state.highlighted = (state.highlighted + 1 + items.length) % items.length;
      renderMenu();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (!items.length) return;
      state.highlighted = (state.highlighted - 1 + items.length) % items.length;
      renderMenu();
    } else if (e.key === 'Enter') {
      const target = items[state.highlighted];
      if (target) {
        const id = target.dataset.id;
        if (target.dataset.action === 'add') {
          openQuickCreate(state.term);
        } else if (id) {
          const match = state.matches.find(m => String(m.id) === id);
          if (match) selectCompany(match);
        }
      }
    } else if (e.key === 'Escape') {
      closeMenu();
    }
  });

  menu.addEventListener('mousedown', (e) => {
    e.preventDefault();
    const li = e.target.closest('.lookup-item');
    if (!li) return;
    if (li.dataset.action === 'add') {
      openQuickCreate(state.term);
    } else {
      const id = li.dataset.id;
      const match = state.matches.find(m => String(m.id) === id);
      if (match) selectCompany(match);
    }
  });

  document.addEventListener('click', (e) => {
    if (!root.contains(e.target)) {
      closeMenu();
    }
  });

  updateMatches(state.term);
}

export function createCompany(name) {
  const trimmed = (name || '').trim();
  if (!trimmed) return { error: 'Company name is required.' };
  if (findCompanyByName(trimmed)) return { error: 'Company name already exists.' };
  const company = addCompany(trimmed);
  return { company };
}
