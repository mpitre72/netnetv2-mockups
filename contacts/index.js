// Net Net V2 Contacts module (modularized from index.html)
// Relies on window.mockContactsData (set by /data/mock-contacts.js)

import { renderContactsLayout } from './contacts-list.js';
import { renderCompanyProfile } from './contacts-profile-company.js';
import { renderPersonProfile } from './contacts-profile-person.js';

function getContactsData() {
  const data = (typeof window !== 'undefined') ? window.mockContactsData : null;
  if (!Array.isArray(data)) {
    console.warn('[ContactsModule] window.mockContactsData is not an array or not defined.');
    return [];
  }
  return data;
}

function buildContactsState() {
  return {
    search: '',
    filters: { city: 'all', state: 'all', title: 'all' },
    expanded: new Set(),
  };
}

function renderTable(state, scope) {
  const tbody = scope.querySelector('#contacts-table-body');
  if (!tbody) {
    console.warn('[ContactsModule] contacts table body not found.');
    return;
  }
  const data = getContactsData();
  tbody.innerHTML = '';
  const s = state.search.toLowerCase();
  const { city, state: st, title } = state.filters;

  data.forEach(comp => {
    const compCityMatch = city === 'all' || comp.city === city;
    const compStateMatch = st === 'all' || comp.state === st;
    const compTextMatch =
      comp.name.toLowerCase().includes(s) ||
      comp.city.toLowerCase().includes(s);

    const people = comp.people || [];
    const matchingPeople = people.filter(p => {
      const pTextMatch =
        s === '' ||
        p.name.toLowerCase().includes(s) ||
        p.email.toLowerCase().includes(s) ||
        p.title.toLowerCase().includes(s);
      const pCityMatch = city === 'all' || p.city === city;
      const pStateMatch = st === 'all' || p.state === st;
      const pTitleMatch = title === 'all' || p.title === title;
      return pTextMatch && pCityMatch && pStateMatch && pTitleMatch;
    });

    const hasMatchingPeople = matchingPeople.length > 0;
    const companyMatchesCriteria =
      compTextMatch && compCityMatch && compStateMatch && (title === 'all');

    if (companyMatchesCriteria || hasMatchingPeople) {
      const isExpanded = state.expanded.has(comp.id);
      const chevronRotation = isExpanded ? 'rotate(180deg)' : 'rotate(0deg)';

      const compRow = document.createElement('tr');
      compRow.className =
        "bg-white dark:bg-gray-800 border-b border-gray-100 dark:border-gray-700 " +
        "hover:bg-gray-50 dark:hover:bg-gray-750 transition-colors cursor-pointer group";
      compRow.onclick = (e) => {
        if (e.target.tagName === 'A') return;
        toggleContactRow(comp.id, state, scope);
      };
      compRow.innerHTML = `
        <td class="px-6 py-4 text-gray-400">
          <svg class="w-4 h-4 transition-transform duration-200" style="transform:${chevronRotation};" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path>
          </svg>
        </td>
        <td class="px-6 py-4 font-semibold text-gray-900 dark:text-white">${comp.name}</td>
        <td class="px-6 py-4 text-netnet-purple dark:text-blue-400 hidden md:table-cell">
          <a href="https://${comp.website}" target="_blank" class="hover:underline">${comp.website}</a>
        </td>
        <td class="px-6 py-4 text-gray-600 dark:text-gray-300">${comp.city}</td>
        <td class="px-6 py-4 text-gray-600 dark:text-gray-300">${comp.state}</td>
      `;
      tbody.appendChild(compRow);

      if (isExpanded) {
        const detailsRow = document.createElement('tr');
        detailsRow.className = "bg-gray-50 dark:bg-gray-900/50 shadow-inner";

        const peopleToShow =
          (s !== '' || city !== 'all' || st !== 'all' || title !== 'all')
            ? matchingPeople
            : people;

        let innerContent = '';
        if (peopleToShow.length === 0) {
          innerContent = `
            <div class="p-4 text-sm text-gray-500 italic text-center">
              No people match the current filters.
              <div class="mt-2">
                <a href="#/app/contacts/company/${comp.id}" class="text-netnet-purple hover:underline font-medium">
                  View Company Profile
                </a>
              </div>
            </div>`;
        } else {
          innerContent = `
            <div class="px-6 py-2 flex justify-end">
              <a href="#/app/contacts/company/${comp.id}" class="text-xs text-netnet-purple hover:underline font-semibold uppercase tracking-wide">
                View Company Profile &rarr;
              </a>
            </div>
            <table class="w-full text-sm">
              <thead class="text-xs text-gray-500 dark:text-gray-400 uppercase bg-gray-100 dark:bg-gray-800 sticky top-[32px] z-20">
                <tr>
                  <th class="px-6 py-2 w-10"></th>
                  <th class="px-6 py-2">Name</th>
                  <th class="px-6 py-2">Title</th>
                  <th class="px-6 py-2">Email</th>
                  <th class="px-6 py-2">Location</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-gray-200 dark:divide-gray-700">
                ${peopleToShow.map(p => `
                  <tr class="hover:bg-gray-100 dark:hover:bg-gray-800/70">
                    <td></td>
                    <td class="px-6 py-3 font-medium text-gray-900 dark:text-gray-200">
                      <a href="#/app/contacts/person/${p.id}" class="hover:underline hover:text-netnet-purple transition-colors">
                        ${p.name}
                      </a>
                    </td>
                    <td class="px-6 py-3 text-gray-600 dark:text-gray-400">${p.title}</td>
                    <td class="px-6 py-3 text-gray-600 dark:text-gray-400">${p.email}</td>
                    <td class="px-6 py-3 text-gray-600 dark:text-gray-400">${p.city}, ${p.state}</td>
                  </tr>`).join('')}
              </tbody>
            </table>`;
        }

        detailsRow.innerHTML = `
          <td colspan="5" class="p-0 border-b border-gray-200 dark:border-gray-700">
            ${innerContent}
          </td>`;
        tbody.appendChild(detailsRow);
      }
    }
  });

  if (tbody.children.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="5" class="p-8 text-center text-gray-500">
          No contacts match your search.
        </td>
      </tr>`;
  }
}

function toggleContactRow(id, state, scope) {
  if (state.expanded.has(id)) {
    state.expanded.delete(id);
  } else {
    state.expanded.add(id);
  }
  renderTable(state, scope);
}

export function initContactsModule(rootEl) {
  const scope = rootEl || document;
  const searchInput = scope.querySelector('#contact-search');
  const citySelect = scope.querySelector('#filter-city');
  const stateSelect = scope.querySelector('#filter-state');
  const titleSelect = scope.querySelector('#filter-title');
  const tbody = scope.querySelector('#contacts-table-body');

  if (!tbody) {
    console.warn('[ContactsModule] contacts table body not found.');
    return;
  }

  const state = buildContactsState();

  // Expose global handlers so legacy code can still call them if needed
  if (typeof window !== 'undefined') {
    window.toggleContactRow = (id) => toggleContactRow(id, state, scope);
  }

  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      state.search = e.target.value || '';
      renderTable(state, scope);
    });
  }

  if (citySelect && stateSelect && titleSelect) {
    [citySelect, stateSelect, titleSelect].forEach(sel => {
      sel.addEventListener('change', () => {
        state.filters = {
          city: citySelect.value || 'all',
          state: stateSelect.value || 'all',
          title: titleSelect.value || 'all',
        };
        renderTable(state, scope);
      });
    });
  }

  renderTable(state, scope);
}

// Render + wire in one step (useful for router)
export function renderContacts(rootEl) {
  const container = rootEl || document.getElementById('app-main');
  if (!container) {
    console.warn('[ContactsModule] container not found for renderContacts.');
    return;
  }
  const data = getContactsData();
  container.innerHTML = renderContactsLayout(data);
  initContactsModule(container);
}

export function renderContactProfile(type, id, { container, mockReportData } = {}) {
  const target = container || document.getElementById('profile-container');
  if (!target) {
    console.warn('[ContactsModule] profile container not found.');
    return;
  }

  const contacts = getContactsData();
  let data = null;
  if (type === 'company') {
    data = contacts.find(c => c.id === id);
  } else {
    contacts.forEach(c => {
      const p = (c.people || []).find(person => person.id === id);
      if (p) data = { ...p, companyName: c.name, companyId: c.id };
    });
  }

  if (!data) {
    target.innerHTML = `<div class="p-8 text-center text-gray-500">Item not found.</div>`;
    return;
  }

  const profileState = { isEditing: false, isIntl: false };
  const reports = mockReportData || (typeof window !== 'undefined' ? window.mockReportData : undefined);

  const render = () => {
    const html = (type === 'company')
      ? renderCompanyProfile(data, profileState, reports)
      : renderPersonProfile(data, profileState, reports);
    target.innerHTML = html;

    const fmtToggle = target.querySelector('#fmt-toggle');
    if (fmtToggle) fmtToggle.onchange = (e) => { profileState.isIntl = e.target.checked; render(); };

    const saveBtn = target.querySelector('#save-btn');
    const cancelBtn = target.querySelector('#cancel-btn');
    const editBtn = target.querySelector('#edit-btn');
    if (saveBtn) saveBtn.onclick = () => { profileState.isEditing = false; if (typeof showToast === 'function') showToast('Saved successfully'); render(); };
    if (cancelBtn) cancelBtn.onclick = () => { profileState.isEditing = false; render(); };
    if (editBtn) editBtn.onclick = () => { profileState.isEditing = true; render(); };

    const addNoteBtn = target.querySelector('#add-note-btn');
    const noteInput = target.querySelector('#quick-note');
    if (addNoteBtn && noteInput) {
      addNoteBtn.onclick = () => {
        const text = noteInput.value.trim();
        if (text) {
          const newNote = { type:'note', text, date: new Date().toISOString().split('T')[0], user:'Me' };
          if (!data.activities) data.activities = [];
          data.activities.unshift(newNote);
          if (typeof showToast === 'function') showToast('Note added');
          render();
        }
      };
    }
  };

  render();
}

// Make module callable from index.html delegator
if (typeof window !== 'undefined') {
  window.initContactsModule = initContactsModule;
  window.wireProfileEvents = (type, id) => renderContactProfile(type, id);
}
