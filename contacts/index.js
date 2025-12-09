// Net Net V2 Contacts module (modularized from index.html)
// Relies on window.mockContactsData (set by /data/mock-contacts.js)

import { renderContactsLayout } from './contacts-list.js';
import { renderCompanyProfile } from './contacts-profile-company.js';
import { renderPersonProfile } from './contacts-profile-person.js';
import { ContactsSearchBar } from '../components/ContactsSearchBar.js';
import { renderCompanyFormPage, renderPersonFormPage } from './contacts-forms.js';
import { getContactsData, getIndividualsData } from './contacts-data.js';
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

let expandLabelUpdater = null;
function setExpandLabelUpdater(fn) {
  expandLabelUpdater = fn;
}

function buildContactsGroups() {
  const companies = getContactsData();
  const individuals = getIndividualsData()
    .filter(p => !p.companyId && !p.companyName);
  const groups = [
    ...companies,
    ...(individuals.length ? [{
      id: 'individuals',
      name: 'Individuals',
      people: individuals,
      phone: '',
      city: '',
      state: '',
      socials: {},
    }] : []),
  ];
  return groups;
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

function renderPersonLinks(_comp, person) {
  const decorateIcon = (svg) => svg.replace('<svg', '<svg class="w-4 h-4 text-gray-600 dark:text-gray-300"');
  const iconMap = {
    linkedin: decorateIcon(`<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2h0a2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6Z" /><rect width="4" height="12" x="2" y="9" /><circle cx="4" cy="4" r="2" /></svg>`),
    facebook: decorateIcon(`<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3Z"/></svg>`),
    x: decorateIcon(`<svg viewBox="0 0 24 24" aria-hidden="true" fill="currentColor"><path d="M18.901 2.004h3.286l-7.182 8.208 8.45 11.784H16.21l-4.743-6.207-5.425 6.207H2.757l7.675-8.782L2.301 2.004h5.327l4.278 5.654zM17.61 19.602h1.822L6.486 4.292H4.533z"/></svg>`),
    instagram: decorateIcon(`<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="5" ry="5"/><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/><line x1="17.5" y1="6.5" x2="17.5" y2="6.5"/></svg>`),
    tiktok: decorateIcon(`<svg viewBox="0 0 24 24" aria-hidden="true" fill="currentColor"><path d="M21 8.33a5.46 5.46 0 0 1-3.33-1.11v6.07a5.71 5.71 0 1 1-5.71-5.71 6 6 0 0 1 .71 0v3.17a2.76 2.76 0 1 0 2 2.65V2h3a5.45 5.45 0 0 0 3.33 1.14Z"/></svg>`),
    whatsapp: decorateIcon(`<svg viewBox="0 0 24 24" aria-hidden="true" fill="currentColor"><path d="M20.52 3.48A11.86 11.86 0 0 0 12 0a12 12 0 0 0-10.2 18.32L0 24l5.8-1.77A12 12 0 0 0 24 12a11.86 11.86 0 0 0-3.48-8.52ZM12 21.68a9.66 9.66 0 0 1-4.92-1.36l-.35-.21-3.45 1 1-3.35-.23-.35A9.69 9.69 0 1 1 12 21.68Zm5.3-7.26c-.3-.15-1.78-.88-2.05-.98s-.48-.15-.68.15-.78.98-.95 1.18-.35.22-.65.07a7.91 7.91 0 0 1-2.34-1.44 8.77 8.77 0 0 1-1.62-2c-.17-.3 0-.46.13-.61s.3-.35.45-.52a2 2 0 0 0 .3-.5.54.54 0 0 0 0-.52c-.08-.15-.68-1.61-.93-2.22s-.5-.52-.68-.53h-.58a1.12 1.12 0 0 0-.8.37A3.35 3.35 0 0 0 6 9.1 5.82 5.82 0 0 0 7.21 12a13.28 13.28 0 0 0 5.08 5 5.93 5.93 0 0 0 3.48 1.1 3 3 0 0 0 2-.78 2.56 2.56 0 0 0 .55-1.6c.07-.16.07-.29.05-.32s-.12-.1-.3-.2Z"/></svg>`),
    youtube: decorateIcon(`<svg viewBox="0 0 24 24" aria-hidden="true" fill="currentColor"><path d="M23.5 6.2s-.2-1.6-.8-2.3c-.8-.9-1.7-.9-2.1-1C17.8 2.7 12 2.7 12 2.7h-.1s-5.8 0-8.6.2c-.5.1-1.4.1-2.1 1C.6 4.6.5 6.2.5 6.2S0 8.1 0 10v1.9c0 1.9.5 3.8.5 3.8s.2 1.6.8 2.3c.8.9 1.9.8 2.4.9 1.7.2 7.3.2 7.3.2s5.8 0 8.6-.2c.5-.1 1.3-.1 2.1-1 .6-.7.8-2.3.8-2.3S24 13.8 24 11.9V10c0-1.9-.5-3.8-.5-3.8ZM9.6 14.9V7.1l6.5 3.9Z"/></svg>`),
    snapchat: decorateIcon(`<svg viewBox="0 0 24 24" aria-hidden="true" fill="currentColor"><path d="M12 2c2.9 0 5.7 2 5.7 6.3 0 1-.1 1.8-.1 2.1 0 .2.2.4.4.5 1.2.6 2.4 1.2 3 1.5.3.2.5.5.4.8-.1.4-.7.5-1.3.7-.6.2-1.2.5-1.1.9 0 .3.3.6 1.2.7.6.1.8.6.6 1-.4.7-1.7 1.3-3.4 1.5-.1 0-.2.1-.2.2-.2.6-.6 1.3-1 1.3-.4 0-.8-.3-1.3-.6-.6-.4-1.3-.8-2.9-.8h-.5c-1.6 0-2.3.4-2.9.8-.5.3-.9.6-1.3.6-.4 0-.8-.7-1-1.3 0-.1-.1-.2-.2-.2-1.7-.2-3-1-3.4-1.5-.3-.4-.1-.9.6-1 .9-.1 1.2-.4 1.2-.7 0-.4-.6-.7-1.1-.9-.7-.2-1.2-.3-1.3-.7-.1-.3.1-.6.4-.8.6-.3 1.8-.9 3-1.5.2-.1.4-.3.4-.5 0-.4-.1-1.1-.1-2.1C6.3 4 9.1 2 12 2Z"/></svg>`),
    threads: decorateIcon(`<svg viewBox="0 0 24 24" aria-hidden="true" fill="currentColor"><path d="M18.944 15.202c-.218-.142-.44-.278-.664-.408a5.137 5.137 0 0 0 .258-1.548c.054-1.557-.364-2.928-1.205-4.08-1.003-1.374-2.476-2.236-4.372-2.558-.458-.077-.923-.115-1.384-.112-1.8.008-3.296.504-4.448 1.474C5.941 9.27 5.39 10.617 5.39 12.42c0 1.664.513 3.043 1.526 4.094 1.033 1.073 2.47 1.653 4.271 1.716.074.003.147.005.222.005 1.66 0 3.049-.467 4.138-1.387a4.38 4.38 0 0 0 1.419-2.483h-2.5c-.132.382-.38.72-.722.97-.47.35-1.094.526-1.855.526-.07 0-.142-.002-.214-.005-1.149-.045-1.953-.38-2.541-1.039-.403-.453-.633-1.07-.69-1.871h7.262c.125-.71.185-1.423.185-2.132 0-.034-.001-.067-.002-.101.341.223.667.468.973.734.923.809 1.403 1.77 1.403 2.858 0 2.028-1.47 3.44-3.824 3.44h-.002c-.632 0-1.216-.094-1.738-.28l-.536 2.07c.7.22 1.45.33 2.238.33h.004c1.45 0 2.772-.324 3.83-.937 1.603-.918 2.506-2.544 2.506-4.458 0-1.632-.67-3.025-1.994-4.1Z"/></svg>`),
    reddit: decorateIcon(`<svg viewBox="0 0 24 24" aria-hidden="true" fill="currentColor"><path d="M22 12.36c0-.98-.8-1.78-1.78-1.78-.48 0-.92.19-1.24.5-1.22-.87-2.86-1.42-4.67-1.5l.94-4.43 3.08.65c0 1 1.13 1.5 1.83.8.77-.77.2-2.07-.88-2.07-.62 0-1.12.4-1.3.95l-3.43-.72c-.23-.05-.45.1-.5.32l-1.04 4.9c-1.87.07-3.56.62-4.82 1.5-.32-.32-.77-.5-1.24-.5-.98 0-1.78.8-1.78 1.78 0 .73.43 1.34 1.04 1.62-.03.18-.04.36-.04.55 0 2.65 2.82 4.8 6.29 4.8 3.47 0 6.29-2.15 6.29-4.8 0-.18-.01-.37-.04-.55.6-.28 1.04-.9 1.04-1.62Zm-13.5.41c0-.78.64-1.41 1.42-1.41.78 0 1.41.63 1.41 1.41 0 .78-.63 1.41-1.41 1.41-.78 0-1.42-.63-1.42-1.41Zm7.55 3.18c-.86.86-2.43.93-2.99.93-.56 0-2.13-.07-2.99-.93-.13-.13-.13-.35 0-.48.13-.13.35-.13.48 0 .55.55 1.72.75 2.51.75.79 0 1.97-.2 2.51-.75.13-.13.35-.13.48 0 .14.13.14.35 0 .48Zm-.1-1.77c-.78 0-1.41-.63-1.41-1.41 0-.78.63-1.41 1.41-1.41.78 0 1.42.63 1.42 1.41 0 .78-.64 1.41-1.42 1.41Z"/></svg>`),
    pinterest: decorateIcon(`<svg viewBox="0 0 24 24" aria-hidden="true" fill="currentColor"><path d="M12.04 2C7.12 2 4 5.46 4 9.35c0 1.82.77 3.41 2.43 4 0 .11-.09.5-.11.61-.05.27-.21 1.1-.91 3.75 0 0-.02.11 0 .14a.33.33 0 0 0 .25.11c.1 0 .21-.05.26-.1.12-.14 1.71-1.78 2.31-2.4.18-.18.35-.24.52-.24.26 0 .53.12.81.24.52.21 1.12.46 2 .46 3.9 0 6.96-3.05 6.96-6.96C18.52 5.23 15.63 2 12.04 2Zm.28 11.68c-.56 0-1.11-.12-1.53-.32-.19-.08-.4-.21-.59-.21-.23 0-.43.13-.63.32-.1.1-.27.27-.48.48l-.16.17.05-.22c.11-.5.22-1 .28-1.27l.04-.2c.02-.09 0-.2-.13-.25-1.39-.6-2.05-1.8-2.05-3.14 0-2.6 1.96-4.95 5.34-4.95 2.86 0 4.94 2.16 4.94 5.02 0 2.85-2.03 5.57-4.98 5.57Z"/></svg>`),
    globe: decorateIcon(`<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10" /><path d="M2 12h20" /><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10Z" /></svg>`),
  };

  const socialKeys = [
    { key: 'linkedin', value: person.linkedin },
    { key: 'facebook', value: person.facebook },
    { key: 'x', value: person.x || person.twitter },
    { key: 'instagram', value: person.instagram },
    { key: 'tiktok', value: person.tiktok },
    { key: 'whatsapp', value: person.whatsapp },
    { key: 'youtube', value: person.youtube },
    { key: 'snapchat', value: person.snapchat },
    { key: 'threads', value: person.threads },
    { key: 'reddit', value: person.reddit },
    { key: 'pinterest', value: person.pinterest },
    { key: 'globe', value: person.website },
  ].filter(item => item.value);

  const links = [];
  if (person.email) {
    links.push(
      `<a href="mailto:${person.email}" class="email-chip" aria-label="Email ${person.name}">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2Z"/><path d="m22 6-10 7L2 6"/></svg>
      </a>`
    );
  }

  const makeSocialLink = (href, label, key) =>
    `<a href="${href}" target="_blank" rel="noreferrer" class="contact-link-icon inline-flex items-center justify-center w-8 h-8 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 mx-0.5" aria-label="${label}">
      ${iconMap[key] || iconMap.globe}
    </a>`;

  socialKeys.forEach(({ key, value }) => {
    links.push(makeSocialLink(value, key, key));
  });

  return links.length ? links.join('') : `<span class="text-gray-400 dark:text-gray-500">-</span>`;
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
  const data = buildContactsGroups();
  tbody.innerHTML = '';
  const s = state.search.toLowerCase();
  const searchHasTerm = s !== '';

  const notifyExpandState = () => {
    if (typeof expandLabelUpdater === 'function') {
      const allExpanded = data.length > 0 && data.every(d => state.expanded.has(d.id));
      expandLabelUpdater(allExpanded);
    }
  };

  data.forEach(comp => {
    const isIndividuals = comp.id === 'individuals';
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

      const baseRowBg = comp.id === 'individuals'
        ? 'contacts-individuals-header-row'
        : 'bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-750';

      const compRow = document.createElement('tr');
      compRow.className =
        "contacts-row " + baseRowBg + " border-b border-gray-100 dark:border-gray-700 " +
        "transition-colors cursor-pointer group";
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
          ${isIndividuals
            ? `<span class="hover:text-netnet-purple transition-colors">${comp.name}</span>`
            : `<a href="#/app/contacts/company/${comp.id}" class="hover:underline hover:text-netnet-purple transition-colors">
            ${comp.name}
          </a>`}
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
        detailsRow.className = "bg-gray-50 dark:bg-gray-900/50 shadow-inner" + (isIndividuals ? " individuals-group" : "");

        const peopleToShow = searchHasTerm ? matchingPeople : people;

        let innerContent = '';
        if (peopleToShow.length === 0) {
          innerContent = `
            <div class="p-4 text-sm text-gray-500 italic text-center">
              No people match the current filters.
            </div>`;
        } else {
          innerContent = `
            <table class="w-full text-sm contacts-employee-table">
              <thead class="contacts-employee-header-row text-xs text-gray-500 dark:text-gray-400 uppercase bg-gray-100 dark:bg-gray-800">
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

  notifyExpandState();
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
  const expandToggleBtn = scope.querySelector('#contacts-expand-toggle');

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

  if (expandToggleBtn) {
    setExpandLabelUpdater((allExpanded) => {
      const icon = allExpanded
        ? `<svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path stroke-linecap="round" stroke-linejoin="round" d="M19 15l-7-7-7 7"/></svg>`
        : `<svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7"/></svg>`;
      expandToggleBtn.innerHTML = icon;
      expandToggleBtn.setAttribute('aria-label', allExpanded ? 'Collapse all' : 'Expand all');
      expandToggleBtn.setAttribute('title', allExpanded ? 'Collapse all' : 'Expand all');
    });
    expandToggleBtn.addEventListener('click', () => {
      const groups = buildContactsGroups();
      const allExpanded = groups.length > 0 && groups.every(g => state.expanded.has(g.id));
      if (allExpanded) {
        state.expanded.clear();
      } else {
        groups.forEach(g => state.expanded.add(g.id));
      }
      renderTable(state, scope);
    });
  }

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
