// Net Net V2 Contacts module (modularized from index.html)
// Relies on window.mockContactsData (set by /data/mock-contacts.js)

import { renderContactsLayout } from './contacts-list.js';
import { renderCompanyProfile } from './contacts-profile-company.js';
import { renderPersonProfile } from './contacts-profile-person.js';
import { ContactsSearchBar } from '../components/ContactsSearchBar.js';
import { renderCompanyFormPage, renderPersonFormPage } from './contacts-forms.js';
import { getContactsData } from './contacts-data.js';
import {
  getListState,
  updateListState,
  setLastSubview,
  getContactsEntryHash,
} from './contacts-ui-state.js';

function buildContactsState({ search = '' } = {}) {
  return {
    search: search || '',
    expanded: new Set(),
  };
}

function renderLinkIcons(comp) {
  // Randomly decide which links to show for demo purposes
  const options = [];
  if (comp.website) options.push({ href: 'https://hellonetnet.com', label: 'Website', icon: 'M3 5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v0.5H3V5Zm0 3h18v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8Zm2 2v9h14v-9H5Zm4 7h6v-2H9v2Z' });
  const socials = comp.socials || {};
  if (socials.twitter) options.push({ href: 'https://x.com', label: 'X', icon: 'M4 3h4.5l3.1 4.5L14.7 3H19l-6 7.2L20 21h-4.5l-3.3-4.7L8 21H4l6.3-7.4L4 3Z' });
  if (socials.facebook) options.push({ href: 'https://facebook.com', label: 'Facebook', icon: 'M22 12a10 10 0 1 0-11.6 9.9v-7h-2v-3h2V9a3 3 0 0 1 3-3h3v3h-3v2h3l-.5 3h-2.5v7A10 10 0 0 0 22 12Z' });
  if (socials.instagram) options.push({ href: 'https://www.instagram.com', label: 'Instagram', icon: 'M7 2h10a5 5 0 0 1 5 5v10a5 5 0 0 1-5 5H7a5 5 0 0 1-5-5V7a5 5 0 0 1 5-5Zm0 2a3 3 0 0 0-3 3v10a3 3 0 0 0 3 3h10a3 3 0 0 0 3-3V7a3 3 0 0 0-3-3H7Zm9.5 1a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3ZM12 8.5A3.5 3.5 0 1 1 8.5 12 3.5 3.5 0 0 1 12 8.5Zm0 2A1.5 1.5 0 1 0 13.5 12 1.5 1.5 0 0 0 12 10.5Z' });

  if (!options.length) return `<span class="text-gray-400 dark:text-gray-500">-</span>`;

  // Randomly pick a subset for demo (anywhere from 0 to all available)
  const shuffled = options.sort(() => 0.5 - Math.random());
  const count = Math.max(0, Math.min(options.length, Math.floor(Math.random() * (options.length + 1))));
  const chosen = shuffled.slice(0, count || 1); // ensure at least one when options exist

  const makeLink = (href, label, svg) => `<a href="${href}" target="_blank" rel="noreferrer" class="contact-link-icon inline-flex items-center justify-center w-8 h-8 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 mx-0.5" aria-label="${label}">${svg}</a>`;
  const iconSvg = (path) => `<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" class="text-gray-600 dark:text-gray-300"><path d="${path}"/></svg>`;
  return chosen.map(opt => makeLink(opt.href, opt.label, iconSvg(opt.icon))).join('');
}

function renderPersonLinks(comp, person) {
  const icons = [];
  const makeLink = (href, label, svg) => `<a href="${href}" target="_blank" rel="noreferrer" class="contact-link-icon inline-flex items-center justify-center w-8 h-8 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 mx-0.5" aria-label="${label}">${svg}</a>`;
  const iconSvg = (path) => `<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" class="text-gray-600 dark:text-gray-300"><path d="${path}"/></svg>`;
  // email is mandatory
  if (person.email) {
    icons.push(makeLink(`mailto:${person.email}`, 'Email', iconSvg('M4 4h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Zm0 2v.01L12 13l8-6.99V6H4Z')));
  }
  const options = [];
  if (comp.website) options.push({ href: 'https://hellonetnet.com', label: 'Website', icon: 'M3 5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v0.5H3V5Zm0 3h18v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8Zm2 2v9h14v-9H5Zm4 7h6v-2H9v2Z' });
  const socials = comp.socials || {};
  if (socials.twitter) options.push({ href: 'https://x.com', label: 'X', icon: 'M4 3h4.5l3.1 4.5L14.7 3H19l-6 7.2L20 21h-4.5l-3.3-4.7L8 21H4l6.3-7.4L4 3Z' });
  if (socials.facebook) options.push({ href: 'https://facebook.com', label: 'Facebook', icon: 'M22 12a10 10 0 1 0-11.6 9.9v-7h-2v-3h2V9a3 3 0 0 1 3-3h3v3h-3v2h3l-.5 3h-2.5v7A10 10 0 0 0 22 12Z' });
  if (socials.instagram) options.push({ href: 'https://www.instagram.com', label: 'Instagram', icon: 'M7 2h10a5 5 0 0 1 5 5v10a5 5 0 0 1-5 5H7a5 5 0 0 1-5-5V7a5 5 0 0 1 5-5Zm0 2a3 3 0 0 0-3 3v10a3 3 0 0 0 3 3h10a3 3 0 0 0 3-3V7a3 3 0 0 0-3-3H7Zm9.5 1a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3ZM12 8.5A3.5 3.5 0 1 1 8.5 12 3.5 3.5 0 0 1 12 8.5Zm0 2A1.5 1.5 0 1 0 13.5 12 1.5 1.5 0 0 0 12 10.5Z' });
  if (options.length) {
    const shuffled = options.sort(() => 0.5 - Math.random());
    const count = Math.floor(Math.random() * (options.length + 1));
    const chosen = shuffled.slice(0, count);
    chosen.forEach(opt => icons.push(makeLink(opt.href, opt.label, iconSvg(opt.icon))));
  }
  return icons.length ? icons.join('') : `<span class="text-gray-400 dark:text-gray-500">-</span>`;
}

function renderLocation(comp) {
  const hasCity = comp.city && comp.city.trim() !== '';
  const hasState = comp.state && comp.state.trim() !== '';
  if (!hasCity && !hasState) return `<span class="text-gray-400 dark:text-gray-500">-</span>`;
  if (hasCity && hasState) return `${comp.city}, ${comp.state}`;
  return hasCity ? comp.city : comp.state;
}

function renderPhone(comp) {
  if (!comp.phone) return `<span class="text-gray-400 dark:text-gray-500">-</span>`;
  return comp.phone;
}

function renderMobile(person) {
  if (!person.mobile) return `<span class="text-gray-400 dark:text-gray-500">-</span>`;
  return person.mobile;
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
  const searchHasTerm = s !== '';

  data.forEach(comp => {
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
      return pTextMatch;
    });

    const hasMatchingPeople = matchingPeople.length > 0;
    const companyMatchesCriteria = compTextMatch;

    if (companyMatchesCriteria || hasMatchingPeople) {
      const autoExpand = searchHasTerm && hasMatchingPeople;
      const isExpanded = state.expanded.has(comp.id) || autoExpand;
      const chevronRotation = isExpanded ? 'rotate(180deg)' : 'rotate(0deg)';

      const compRow = document.createElement('tr');
      compRow.className =
        "bg-white dark:bg-gray-800 border-b border-gray-100 dark:border-gray-700 " +
        "hover:bg-gray-50 dark:hover:bg-gray-750 transition-colors cursor-pointer group";
      compRow.onclick = (e) => {
        if (e.target.closest && e.target.closest('a')) return;
        toggleContactRow(comp.id, state, scope);
      };
      compRow.innerHTML = `
        <td class="px-6 py-4 text-gray-400">
          <svg class="w-4 h-4 transition-transform duration-200" style="transform:${chevronRotation};" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path>
          </svg>
        </td>
        <td class="px-6 py-4 font-semibold text-gray-900 dark:text-white">
          <a href="#/app/contacts/company/${comp.id}" class="hover:underline hover:text-netnet-purple transition-colors">
            ${comp.name}
          </a>
        </td>
        <td class="px-6 py-4">
          ${renderLinkIcons(comp)}
        </td>
        <td class="px-6 py-4 text-gray-600 dark:text-gray-300">${renderPhone(comp)}</td>
        <td class="px-6 py-4 text-gray-600 dark:text-gray-300">${renderLocation(comp)}</td>
      `;
      tbody.appendChild(compRow);

      if (isExpanded) {
        const detailsRow = document.createElement('tr');
        detailsRow.className = "bg-gray-50 dark:bg-gray-900/50 shadow-inner";

        const peopleToShow = searchHasTerm ? matchingPeople : people;

        let innerContent = '';
        if (peopleToShow.length === 0) {
          innerContent = `
            <div class="p-4 text-sm text-gray-500 italic text-center">
              No people match the current filters.
            </div>`;
        } else {
          innerContent = `
            <table class="w-full text-sm">
              <thead class="text-xs text-gray-500 dark:text-gray-400 uppercase bg-gray-100 dark:bg-gray-800">
                <tr>
                  <th class="px-6 py-2 w-10"></th>
                  <th class="px-6 py-2">Name</th>
                  <th class="px-6 py-2">Title</th>
                  <th class="px-6 py-2">Links</th>
                  <th class="px-6 py-2">Mobile</th>
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
                    <td class="px-6 py-3">${renderPersonLinks(comp, p)}</td>
                    <td class="px-6 py-3 text-gray-600 dark:text-gray-400">${renderMobile(p)}</td>
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

export function initContactsModule(rootEl, { subview = 'companies', listState = {} } = {}) {
  const scope = rootEl || document;
  const searchInput = scope.querySelector('#contact-search');
  const tbody = scope.querySelector('#contacts-table-body');
  const scrollArea = scope.querySelector('.contacts-scroll');

  if (!tbody) {
    console.warn('[ContactsModule] contacts table body not found.');
    return;
  }

  const state = buildContactsState({ search: listState.search });

  // Expose global handlers so legacy code can still call them if needed
  if (typeof window !== 'undefined') {
    window.toggleContactRow = (id) => toggleContactRow(id, state, scope);
  }

  if (searchInput) {
    searchInput.value = state.search;
    searchInput.addEventListener('input', (e) => {
      state.search = e.target.value || '';
      updateListState(subview, { search: state.search });
      renderTable(state, scope);
    });
  }

  if (scrollArea) {
    scrollArea.scrollTop = listState.scrollY || 0;
    scrollArea.addEventListener('scroll', () => {
      updateListState(subview, { scrollY: scrollArea.scrollTop });
    });
  }

  scope.addEventListener('click', (e) => {
    const link = e.target.closest && e.target.closest('a[href^="#/app/contacts/"]');
    if (!link) return;
    const href = link.getAttribute('href') || '';
    if (href.includes('/company/')) {
      setLastSubview('companies');
    } else if (href.includes('/person/')) {
      setLastSubview('people');
    }
    updateListState(subview, { search: state.search, scrollY: scrollArea ? scrollArea.scrollTop : 0 });
  });

  renderTable(state, scope);
}

// Render + wire in one step (useful for router)
export function renderContacts(rootEl, subview = 'companies', id = null) {
  const container = rootEl || document.getElementById('app-main');
  if (!container) {
    console.warn('[ContactsModule] container not found for renderContacts.');
    return;
  }
  if (subview === 'company-new' || subview === 'company-edit') {
    renderCompanyFormPage({ mode: subview === 'company-new' ? 'create' : 'edit', id: subview === 'company-edit' ? id : null, container });
    return;
  }
  if (subview === 'person-new' || subview === 'person-edit') {
    renderPersonFormPage({ mode: subview === 'person-new' ? 'create' : 'edit', id: subview === 'person-edit' ? id : null, container });
    return;
  }
  const normalizedSubview = subview === 'people' ? 'people' : 'companies';
  const data = getContactsData();
  const listState = getListState(normalizedSubview);
  setLastSubview(normalizedSubview);
  container.innerHTML = renderContactsLayout(data, normalizedSubview);
  // Mount the floating search bar markup
  const searchMount = container.querySelector('#contacts-search-mount');
  if (searchMount) {
    searchMount.innerHTML = ContactsSearchBar({ value: listState.search || '' });
  }
  initContactsModule(container, { subview: normalizedSubview, listState });
}

export function renderContactProfile(type, id, { container, mockReportData } = {}) {
  const target = container || document.getElementById('profile-container');
  if (!target) {
    console.warn('[ContactsModule] profile container not found.');
    return;
  }
  setLastSubview(type === 'person' ? 'people' : 'companies');

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
