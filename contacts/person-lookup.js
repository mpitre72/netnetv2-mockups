import { getContactsData, getIndividualsData } from './contacts-data.js';
import { createCompany, findCompanyByName } from './company-lookup.js';

let personIdSeed = null;

function ensurePersonSeed() {
  if (personIdSeed !== null) return;
  const companyMax = getContactsData().reduce((acc, co) => {
    const peopleMax = (co.people || []).reduce((pAcc, person) => Math.max(pAcc, Number(person.id) || 0), 0);
    return Math.max(acc, peopleMax);
  }, 0);
  const standaloneMax = getIndividualsData().reduce((acc, person) => Math.max(acc, Number(person.id) || 0), 0);
  personIdSeed = Math.max(companyMax, standaloneMax, 2000);
}

function nextPersonId() {
  ensurePersonSeed();
  personIdSeed += 1;
  return personIdSeed;
}

function getCompaniesMutable() {
  const data = (typeof window !== 'undefined') ? window.mockContactsData : null;
  return Array.isArray(data) ? data : [];
}

function getIndividualsMutable() {
  const data = (typeof window !== 'undefined') ? window.mockIndividualsData : null;
  return Array.isArray(data) ? data : [];
}

function normalizeEmail(email) {
  return (email || '').trim().toLowerCase();
}

function isEmailTaken(email) {
  const target = normalizeEmail(email);
  if (!target) return false;
  const companyHit = getContactsData().some(co =>
    (co.people || []).some(p => normalizeEmail(p.email) === target));
  if (companyHit) return true;
  return getIndividualsData().some(p => normalizeEmail(p.email) === target);
}

function findCompanyById(id) {
  return getContactsData().find(c => String(c.id) === String(id)) || null;
}

function makePersonName(firstName, lastName, fallbackEmail) {
  const full = [firstName, lastName].filter(Boolean).join(' ').trim();
  return full || fallbackEmail || 'New Person';
}

function addPersonToCompany(company, payload) {
  const person = {
    id: nextPersonId(),
    name: makePersonName(payload.firstName, payload.lastName, payload.email),
    title: payload.title || '',
    email: payload.email,
  };
  company.people = company.people || [];
  company.people.push(person);
  return person;
}

function addStandalonePerson(payload) {
  const person = {
    id: nextPersonId(),
    name: makePersonName(payload.firstName, payload.lastName, payload.email),
    title: payload.title || '',
    email: payload.email,
  };
  const list = getIndividualsMutable();
  list.push(person);
  return person;
}

function filterPeople(term, companyId) {
  const q = (term || '').trim().toLowerCase();
  if (companyId) {
    const company = findCompanyById(companyId);
    const people = company?.people || [];
    const matches = q
      ? people.filter(p => (p.name || '').toLowerCase().includes(q) || (p.email || '').toLowerCase().includes(q))
      : people.slice();
    return matches.slice(0, 8).map(p => ({
      id: p.id,
      name: p.name,
      email: p.email,
      companyId: company?.id || null,
      companyName: company?.name || '',
      type: 'company',
    }));
  }
  const people = getIndividualsData();
  const matches = q
    ? people.filter(p => (p.name || '').toLowerCase().includes(q) || (p.email || '').toLowerCase().includes(q))
    : people.slice(0, 8);
  return matches.slice(0, 8).map(p => ({
    id: p.id,
    name: p.name,
    email: p.email,
    companyId: null,
    companyName: '',
    type: 'standalone',
  }));
}

function renderDropdownItems(matches, term) {
  const addRow = term.trim()
    ? `<li class="lookup-item add" data-action="add">+ Add new person "${term}"</li>`
    : '';
  const rows = matches.map((p, idx) =>
    `<li class="lookup-item" data-id="${p.id}" data-idx="${idx}">${p.name}</li>`).join('');
  return `${rows}${addRow}`;
}

function renderModal({ term = '', company }) {
  const companyLabel = company ? `<p class="lookup-modal__body">Adding to <strong>${company.name}</strong>.</p>` : '';
  const companyField = company
    ? ''
    : `
      <label class="lookup-modal__label">Company (optional)</label>
      <input id="quick-add-company" class="lookup-input" placeholder="Company name" />
    `;
  return `
    <div class="lookup-modal-backdrop" role="presentation"></div>
    <div class="lookup-modal" role="dialog" aria-modal="true" aria-label="Quick Add Person">
      <div class="lookup-modal__header">
        <h3>Quick Add Person</h3>
      </div>
      ${companyLabel}
      <label class="lookup-modal__label">First Name</label>
      <input id="quick-add-first" class="lookup-input" value="${term.replace(/"/g, '&quot;')}" placeholder="First name" />
      <label class="lookup-modal__label">Last Name</label>
      <input id="quick-add-last" class="lookup-input" placeholder="Last name" />
      <label class="lookup-modal__label">Email</label>
      <input id="quick-add-email" class="lookup-input" placeholder="name@example.com" />
      ${companyField}
      <p id="quick-add-error" class="lookup-error" aria-live="polite"></p>
      <div class="lookup-modal__actions">
        <button type="button" class="lookup-btn ghost" data-action="cancel">Cancel</button>
        <button type="button" class="lookup-btn primary" data-action="save">Save & Continue</button>
      </div>
    </div>
  `;
}

export function mountPersonLookup(root, {
  label = 'Person',
  placeholder = 'Search people...',
  value = null,
  company = null,
  onChange = () => {},
} = {}) {
  if (!root) return { setCompany: () => {}, setValue: () => {} };
  const state = {
    open: false,
    term: value?.name || '',
    matches: filterPeople(value?.name || '', company?.id || null),
    highlighted: -1,
    company,
  };

  root.innerHTML = `
    <div class="lookup-field">
      <label class="lookup-label">${label}</label>
      <div class="lookup-input-wrap">
        <input type="text" class="lookup-input" placeholder="${placeholder}" value="${state.term}" aria-label="${label}" />
        <div class="lookup-menu-card" style="display:none;"></div>
      </div>
    </div>
    <div class="lookup-modal-layer" style="display:none;"></div>
  `;

  const input = root.querySelector('input.lookup-input');
  const menu = root.querySelector('.lookup-menu-card');
  const modalLayer = root.querySelector('.lookup-modal-layer');

  const emitChange = (person, meta = {}) => {
    onChange(person, meta);
  };

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
    state.matches = filterPeople(term, state.company?.id || null);
    state.highlighted = state.matches.length ? 0 : -1;
    renderMenu();
  }

  function selectPerson(person) {
    state.term = person?.name || '';
    input.value = state.term;
    emitChange(person);
    closeMenu();
  }

  function openQuickCreate(prefill) {
    modalLayer.innerHTML = renderModal({ term: prefill, company: state.company });
    modalLayer.style.display = 'block';
    const firstInput = modalLayer.querySelector('#quick-add-first');
    const lastInput = modalLayer.querySelector('#quick-add-last');
    const emailInput = modalLayer.querySelector('#quick-add-email');
    const companyInput = modalLayer.querySelector('#quick-add-company');
    const errorEl = modalLayer.querySelector('#quick-add-error');
    firstInput?.focus();
    modalLayer.addEventListener('click', (e) => {
      if (e.target.classList.contains('lookup-modal-backdrop')) {
        modalLayer.style.display = 'none';
        input.focus();
      }
    }, { once: true });
    modalLayer.querySelectorAll('[data-action]').forEach(btn => {
      btn.onclick = () => {
        if (btn.dataset.action === 'cancel') {
          modalLayer.style.display = 'none';
          input.focus();
          return;
        }
        const email = (emailInput?.value || '').trim();
        const firstName = (firstInput?.value || '').trim();
        const lastName = (lastInput?.value || '').trim();
        const companyName = (companyInput?.value || '').trim();
        if (!email) {
          errorEl.textContent = 'Email is required.';
          emailInput?.focus();
          return;
        }
        if (isEmailTaken(email)) {
          errorEl.textContent = 'A person with this email already exists.';
          emailInput?.focus();
          return;
        }
        let companyRef = state.company;
        let createdCompany = null;
        if (!companyRef && companyName) {
          if (findCompanyByName(companyName)) {
            errorEl.textContent = 'Company name already exists.';
            return;
          }
          const result = createCompany(companyName);
          if (result?.error) {
            errorEl.textContent = result.error;
            return;
          }
          createdCompany = result?.company || null;
          companyRef = createdCompany;
        }
        let person = null;
        if (companyRef) {
          const mutableCompanies = getCompaniesMutable();
          const target = mutableCompanies.find(c => String(c.id) === String(companyRef.id));
          if (!target) {
            errorEl.textContent = 'Company not found.';
            return;
          }
          person = addPersonToCompany(target, { firstName, lastName, email });
          person = { ...person, companyId: companyRef.id, companyName: companyRef.name, type: 'company' };
        } else {
          const standalone = addStandalonePerson({ firstName, lastName, email });
          person = { ...standalone, companyId: null, companyName: '', type: 'standalone' };
        }
        modalLayer.style.display = 'none';
        selectPerson(person);
        emitChange(person, { companyCreated: createdCompany });
        if (typeof window !== 'undefined' && typeof window.showToast === 'function') {
          window.showToast('Person created. You can complete details later in Contacts.');
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
    if (!state.term.trim()) emitChange(null);
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
          if (match) selectPerson(match);
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
      if (match) selectPerson(match);
    }
  });

  document.addEventListener('click', (e) => {
    if (!root.contains(e.target)) {
      closeMenu();
    }
  });

  updateMatches(state.term);

  return {
    setCompany(nextCompany) {
      state.company = nextCompany || null;
      state.term = '';
      input.value = '';
      emitChange(null);
      updateMatches('');
      closeMenu();
    },
    setValue(person) {
      state.term = person?.name || '';
      input.value = state.term;
    },
  };
}
