import { getContactsData } from './contacts-data.js';
import { navigate } from '../router.js';
import { mountCompanyLookup } from './company-lookup.js';

const US_STATES = [
  'AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA','HI','ID','IL','IN','IA','KS','KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ','NM','NY','NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT','VT','VA','WA','WV','WI','WY','DC'
];

const SOCIAL_ICON_MAP = {
  linkedin: `<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2h0a2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6Z" /><rect width="4" height="12" x="2" y="9" /><circle cx="4" cy="4" r="2" /></svg>`,
  facebook: `<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3Z"/></svg>`,
  x: `<svg viewBox="0 0 24 24" aria-hidden="true" fill="currentColor"><path d="M18.901 2.004h3.286l-7.182 8.208 8.45 11.784H16.21l-4.743-6.207-5.425 6.207H2.757l7.675-8.782L2.301 2.004h5.327l4.278 5.654zM17.61 19.602h1.822L6.486 4.292H4.533z"/></svg>`,
  instagram: `<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="5" ry="5"/><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/><line x1="17.5" y1="6.5" x2="17.5" y2="6.5"/></svg>`,
  tiktok: `<svg viewBox="0 0 24 24" aria-hidden="true" fill="currentColor"><path d="M21 8.33a5.46 5.46 0 0 1-3.33-1.11v6.07a5.71 5.71 0 1 1-5.71-5.71 6 6 0 0 1 .71 0v3.17a2.76 2.76 0 1 0 2 2.65V2h3a5.45 5.45 0 0 0 3.33 1.14Z"/></svg>`,
  whatsapp: `<svg viewBox="0 0 24 24" aria-hidden="true" fill="currentColor"><path d="M20.52 3.48A11.86 11.86 0 0 0 12 0a12 12 0 0 0-10.2 18.32L0 24l5.8-1.77A12 12 0 0 0 24 12a11.86 11.86 0 0 0-3.48-8.52ZM12 21.68a9.66 9.66 0 0 1-4.92-1.36l-.35-.21-3.45 1 1-3.35-.23-.35A9.69 9.69 0 1 1 12 21.68Zm5.3-7.26c-.3-.15-1.78-.88-2.05-.98s-.48-.15-.68.15-.78.98-.95 1.18-.35.22-.65.07a7.91 7.91 0 0 1-2.34-1.44 8.77 8.77 0 0 1-1.62-2c-.17-.3 0-.46.13-.61s.3-.35.45-.52a2 2 0 0 0 .3-.5.54.54 0 0 0 0-.52c-.08-.15-.68-1.61-.93-2.22s-.5-.52-.68-.53h-.58a1.12 1.12 0 0 0-.8.37A3.35 3.35 0 0 0 6 9.1 5.82 5.82 0 0 0 7.21 12a13.28 13.28 0 0 0 5.08 5 5.93 5.93 0 0 0 3.48 1.1 3 3 0 0 0 2-.78 2.56 2.56 0 0 0 .55-1.6c.07-.16.07-.29.05-.32s-.12-.1-.3-.2Z"/></svg>`,
  youtube: `<svg viewBox="0 0 24 24" aria-hidden="true" fill="currentColor"><path d="M23.5 6.2s-.2-1.6-.8-2.3c-.8-.9-1.7-.9-2.1-1C17.8 2.7 12 2.7 12 2.7h-.1s-5.8 0-8.6.2c-.5.1-1.4.1-2.1 1C.6 4.6.5 6.2.5 6.2S0 8.1 0 10v1.9c0 1.9.5 3.8.5 3.8s.2 1.6.8 2.3c.8.9 1.9.8 2.4.9 1.7.2 7.3.2 7.3.2s5.8 0 8.6-.2c.5-.1 1.3-.1 2.1-1 .6-.7.8-2.3.8-2.3S24 13.8 24 11.9V10c0-1.9-.5-3.8-.5-3.8ZM9.6 14.9V7.1l6.5 3.9Z"/></svg>`,
  snapchat: `<svg viewBox="0 0 24 24" aria-hidden="true" fill="currentColor"><path d="M12 2c2.9 0 5.7 2 5.7 6.3 0 1-.1 1.8-.1 2.1 0 .2.2.4.4.5 1.2.6 2.4 1.2 3 1.5.3.2.5.5.4.8-.1.4-.7.5-1.3.7-.6.2-1.2.5-1.1.9 0 .3.3.6 1.2.7.6.1.8.6.6 1-.4.7-1.7 1.3-3.4 1.5-.1 0-.2.1-.2.2-.2.6-.6 1.3-1 1.3-.4 0-.8-.3-1.3-.6-.6-.4-1.3-.8-2.9-.8h-.5c-1.6 0-2.3.4-2.9.8-.5.3-.9.6-1.3.6-.4 0-.8-.7-1-1.3 0-.1-.1-.2-.2-.2-1.7-.2-3-1-3.4-1.5-.3-.4-.1-.9.6-1 .9-.1 1.2-.4 1.2-.7 0-.4-.6-.7-1.1-.9-.7-.2-1.2-.3-1.3-.7-.1-.3.1-.6.4-.8.6-.3 1.8-.9 3-1.5.2-.1.4-.3.4-.5 0-.4-.1-1.1-.1-2.1C6.3 4 9.1 2 12 2Z"/></svg>`,
  threads: `<svg viewBox="0 0 24 24" aria-hidden="true" fill="currentColor"><path d="M18.944 15.202c-.218-.142-.44-.278-.664-.408a5.137 5.137 0 0 0 .258-1.548c.054-1.557-.364-2.928-1.205-4.08-1.003-1.374-2.476-2.236-4.372-2.558-.458-.077-.923-.115-1.384-.112-1.8.008-3.296.504-4.448 1.474C5.941 9.27 5.39 10.617 5.39 12.42c0 1.664.513 3.043 1.526 4.094 1.033 1.073 2.47 1.653 4.271 1.716.074.003.147.005.222.005 1.66 0 3.049-.467 4.138-1.387a4.38 4.38 0 0 0 1.419-2.483h-2.5c-.132.382-.38.72-.722.97-.47.35-1.094.526-1.855.526-.07 0-.142-.002-.214-.005-1.149-.045-1.953-.38-2.541-1.039-.403-.453-.633-1.07-.69-1.871h7.262c.125-.71.185-1.423.185-2.132 0-.034-.001-.067-.002-.101.341.223.667.468.973.734.923.809 1.403 1.77 1.403 2.858 0 2.028-1.47 3.44-3.824 3.44h-.002c-.632 0-1.216-.094-1.738-.28l-.536 2.07c.7.22 1.45.33 2.238.33h.004c1.45 0 2.772-.324 3.83-.937 1.603-.918 2.506-2.544 2.506-4.458 0-1.632-.67-3.025-1.994-4.1Z"/></svg>`,
  reddit: `<svg viewBox="0 0 24 24" aria-hidden="true" fill="currentColor"><path d="M22 12.36c0-.98-.8-1.78-1.78-1.78-.48 0-.92.19-1.24.5-1.22-.87-2.86-1.42-4.67-1.5l.94-4.43 3.08.65c0 1 1.13 1.5 1.83.8.77-.77.2-2.07-.88-2.07-.62 0-1.12.4-1.3.95l-3.43-.72c-.23-.05-.45.1-.5.32l-1.04 4.9c-1.87.07-3.56.62-4.82 1.5-.32-.32-.77-.5-1.24-.5-.98 0-1.78.8-1.78 1.78 0 .73.43 1.34 1.04 1.62-.03.18-.04.36-.04.55 0 2.65 2.82 4.8 6.29 4.8 3.47 0 6.29-2.15 6.29-4.8 0-.18-.01-.37-.04-.55.6-.28 1.04-.9 1.04-1.62Zm-13.5.41c0-.78.64-1.41 1.42-1.41.78 0 1.41.63 1.41 1.41 0 .78-.63 1.41-1.41 1.41-.78 0-1.42-.63-1.42-1.41Zm7.55 3.18c-.86.86-2.43.93-2.99.93-.56 0-2.13-.07-2.99-.93-.13-.13-.13-.35 0-.48.13-.13.35-.13.48 0 .55.55 1.72.75 2.51.75.79 0 1.97-.2 2.51-.75.13-.13.35-.13.48 0 .14.13.14.35 0 .48Zm-.1-1.77c-.78 0-1.41-.63-1.41-1.41 0-.78.63-1.41 1.41-1.41.78 0 1.42.63 1.42 1.41 0 .78-.64 1.41-1.42 1.41Z"/></svg>`,
  pinterest: `<svg viewBox="0 0 24 24" aria-hidden="true" fill="currentColor"><path d="M12.04 2C7.12 2 4 5.46 4 9.35c0 1.82.77 3.41 2.43 4 0 .11-.09.5-.11.61-.05.27-.21 1.1-.91 3.75 0 0-.02.11 0 .14a.33.33 0 0 0 .25.11c.1 0 .21-.05.26-.1.12-.14 1.71-1.78 2.31-2.4.18-.18.35-.24.52-.24.26 0 .53.12.81.24.52.21 1.12.46 2 .46 3.9 0 6.96-3.05 6.96-6.96C18.52 5.23 15.63 2 12.04 2Zm.28 11.68c-.56 0-1.11-.12-1.53-.32-.19-.08-.4-.21-.59-.21-.23 0-.43.13-.63.32-.1.1-.27.27-.48.48l-.16.17.05-.22c.11-.5.22-1 .28-1.27l.04-.2c.02-.09 0-.2-.13-.25-1.39-.6-2.05-1.8-2.05-3.14 0-2.6 1.96-4.95 5.34-4.95 2.86 0 4.94 2.16 4.94 5.02 0 2.85-2.03 5.57-4.98 5.57Z"/></svg>`,
  globe: `<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10" /><path d="M2 12h20" /><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10Z" /></svg>`,
};

function renderSocialIcon(key) {
  if (SOCIAL_ICON_MAP[key]) return SOCIAL_ICON_MAP[key];
  return SOCIAL_ICON_MAP.globe;
}

function boolFromCountry(country) {
  return (country && country.toUpperCase() !== 'USA');
}

function safeToast(msg) {
  if (typeof window !== 'undefined' && typeof window.showToast === 'function') {
    window.showToast(msg);
  } else {
    console.log(msg);
  }
}

function buildIntlToggle(isIntl) {
  return `
    <label class="inline-flex items-center cursor-pointer select-none">
      <input type="checkbox" class="sr-only peer" id="intl-toggle" ${isIntl ? 'checked' : ''}>
      <div class="relative w-10 h-5 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-netnet-purple dark:peer-focus:ring-white rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all dark:border-gray-600 peer-checked:bg-netnet-purple"></div>
      <span class="ms-2 text-xs font-medium text-gray-500 dark:text-gray-300">International</span>
    </label>
  `;
}

function renderAddressFields(type, isIntl) {
  if (isIntl) {
    return `
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div class="col-span-1 md:col-span-2">
          <label class="block text-xs font-semibold uppercase text-gray-500 dark:text-gray-400 mb-1">Address Line 1</label>
          <input class="w-full h-10 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white px-3 focus:ring-2 focus:ring-netnet-purple focus:outline-none" placeholder="Street, building" />
        </div>
        <div class="col-span-1 md:col-span-2">
          <label class="block text-xs font-semibold uppercase text-gray-500 dark:text-gray-400 mb-1">Address Line 2</label>
          <input class="w-full h-10 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white px-3 focus:ring-2 focus:ring-netnet-purple focus:outline-none" placeholder="Suite, unit (optional)" />
        </div>
        <div class="col-span-1 md:col-span-2">
          <label class="block text-xs font-semibold uppercase text-gray-500 dark:text-gray-400 mb-1">Address Line 3</label>
          <input class="w-full h-10 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white px-3 focus:ring-2 focus:ring-netnet-purple focus:outline-none" placeholder="Floor, building (optional)" />
        </div>
        <div>
          <label class="block text-xs font-semibold uppercase text-gray-500 dark:text-gray-400 mb-1">City / Town</label>
          <input class="w-full h-10 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white px-3 focus:ring-2 focus:ring-netnet-purple focus:outline-none" />
        </div>
        <div>
          <label class="block text-xs font-semibold uppercase text-gray-500 dark:text-gray-400 mb-1">Region / Province</label>
          <input class="w-full h-10 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white px-3 focus:ring-2 focus:ring-netnet-purple focus:outline-none" />
        </div>
        <div>
          <label class="block text-xs font-semibold uppercase text-gray-500 dark:text-gray-400 mb-1">Postal Code</label>
          <input class="w-full h-10 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white px-3 focus:ring-2 focus:ring-netnet-purple focus:outline-none" />
        </div>
        <div>
          <label class="block text-xs font-semibold uppercase text-gray-500 dark:text-gray-400 mb-1">Country</label>
          <input class="w-full h-10 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white px-3 focus:ring-2 focus:ring-netnet-purple focus:outline-none" placeholder="Country" />
        </div>
      </div>
    `;
  }
  return `
    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div class="col-span-1 md:col-span-2">
        <label class="block text-xs font-semibold uppercase text-gray-500 dark:text-gray-400 mb-1">Address 1</label>
        <input class="w-full h-10 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white px-3 focus:ring-2 focus:ring-netnet-purple focus:outline-none" placeholder="Street address" />
      </div>
      <div class="col-span-1 md:col-span-2">
        <label class="block text-xs font-semibold uppercase text-gray-500 dark:text-gray-400 mb-1">Address 2</label>
        <input class="w-full h-10 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white px-3 focus:ring-2 focus:ring-netnet-purple focus:outline-none" placeholder="Suite, Floor, etc." />
      </div>
      <div>
        <label class="block text-xs font-semibold uppercase text-gray-500 dark:text-gray-400 mb-1">City</label>
        <input class="w-full h-10 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white px-3 focus:ring-2 focus:ring-netnet-purple focus:outline-none" />
      </div>
      <div>
        <label class="block text-xs font-semibold uppercase text-gray-500 dark:text-gray-400 mb-1">State</label>
        <select class="w-full h-10 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white px-3 focus:ring-2 focus:ring-netnet-purple focus:outline-none">
          <option value="" selected disabled>Select</option>
          ${US_STATES.map(s => `<option value="${s}">${s}</option>`).join('')}
        </select>
      </div>
      <div>
        <label class="block text-xs font-semibold uppercase text-gray-500 dark:text-gray-400 mb-1">ZIP Code</label>
        <input class="w-full h-10 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white px-3 focus:ring-2 focus:ring-netnet-purple focus:outline-none" />
      </div>
    </div>
  `;
}

function buildHeader({ title, backTarget, showIntlToggle, isIntl }) {
  return `
    <div class="flex flex-col gap-3 md:flex-row md:items-center md:justify-between mb-6">
      <div class="flex items-center gap-3 md:gap-4">
        <button onclick="navigate('${backTarget}')" class="inline-flex items-center justify-center w-8 h-8 rounded-full border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-200 bg-white/70 dark:bg-slate-900/40 hover:bg-slate-100 dark:hover:bg-slate-800 transition" aria-label="Back to Contacts" title="Back to Contacts">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.75 19.5 8.25 12l7.5-7.5"/></svg>
        </button>
        <h1 class="text-2xl font-bold text-gray-900 dark:text-white">${title}</h1>
      </div>
      <div class="flex items-center gap-3">
        ${showIntlToggle ? buildIntlToggle(isIntl) : ''}
        <button type="button" id="cancel-btn" class="inline-flex items-center justify-center h-10 px-3 rounded-lg border border-gray-200 dark:border-gray-700 text-sm font-medium text-gray-700 dark:text-gray-200 bg-white/80 dark:bg-gray-900/60 hover:bg-gray-50 dark:hover:bg-gray-800 transition">Cancel</button>
        <button type="submit" form="entity-form" class="inline-flex items-center justify-center h-10 px-4 rounded-lg bg-netnet-purple text-white text-sm font-semibold hover:bg-[#6020df] transition shadow">Save</button>
      </div>
    </div>
  `;
}

function buildCompanyFormBody(isIntl) {
  const socialIcons = [
    { name: 'LinkedIn', key: 'linkedin' },
    { name: 'Facebook', key: 'facebook' },
    { name: 'X', key: 'x' },
    { name: 'Instagram', key: 'instagram' },
    { name: 'TikTok', key: 'tiktok' },
    { name: 'WhatsApp', key: 'whatsapp' },
    { name: 'YouTube', key: 'youtube' },
    { name: 'Snapchat', key: 'snapchat' },
    { name: 'Threads', key: 'threads' },
    { name: 'Reddit', key: 'reddit' },
    { name: 'Pinterest', key: 'pinterest' },
    { name: 'Website', key: 'globe' },
  ];
  return `
    <div class="bg-white dark:bg-gray-800 rounded-xl shadow border border-gray-200 dark:border-gray-700 p-6 space-y-8">
      <div>
        <h4 class="text-sm font-bold text-gray-900 dark:text-white border-b border-gray-200 dark:border-gray-700 pb-1 mb-3">Company Details</h4>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div class="md:col-span-2">
            <label class="block text-xs font-semibold uppercase text-gray-500 dark:text-gray-400 mb-1">Company Name</label>
            <input required class="w-full h-10 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white px-3 focus:ring-2 focus:ring-netnet-purple focus:outline-none" />
          </div>
          <div>
            <label class="block text-xs font-semibold uppercase text-gray-500 dark:text-gray-400 mb-1">Industry</label>
            <input class="w-full h-10 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white px-3 focus:ring-2 focus:ring-netnet-purple focus:outline-none" />
          </div>
          <div class="md:col-span-2">
            <label class="block text-xs font-semibold uppercase text-gray-500 dark:text-gray-400 mb-1">Description</label>
            <textarea class="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white px-3 py-2 focus:ring-2 focus:ring-netnet-purple focus:outline-none" rows="4"></textarea>
          </div>
        </div>
      </div>
      <div>
        <div class="flex items-center justify-between border-b border-gray-200 dark:border-gray-700 pb-1 mb-3">
          <h4 class="text-sm font-bold text-gray-900 dark:text-white">Contact Info</h4>
          <label class="inline-flex items-center gap-2 text-xs text-gray-600 dark:text-gray-300">
            <span>US</span>
            <input type="checkbox" id="company-intl-toggle" class="sr-only peer">
            <div class="relative w-9 h-5 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-netnet-purple dark:peer-focus:ring-white rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all dark:border-gray-600 peer-checked:bg-netnet-purple"></div>
            <span>Intl</span>
          </label>
        </div>
        <div class="space-y-5">
          <div class="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <label class="block text-xs font-semibold uppercase text-gray-500 dark:text-gray-400 mb-1">Email</label>
              <input type="email" class="w-full h-10 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white px-3 focus:ring-2 focus:ring-netnet-purple focus:outline-none" />
            </div>
            <div>
              <label class="block text-xs font-semibold uppercase text-gray-500 dark:text-gray-400 mb-1">Office Phone</label>
              <input class="w-full h-10 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white px-3 focus:ring-2 focus:ring-netnet-purple focus:outline-none" />
            </div>
            <div>
              <label class="block text-xs font-semibold uppercase text-gray-500 dark:text-gray-400 mb-1">Alternate Phone</label>
              <input class="w-full h-10 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white px-3 focus:ring-2 focus:ring-netnet-purple focus:outline-none" />
            </div>
            <div>
              <label class="block text-xs font-semibold uppercase text-gray-500 dark:text-gray-400 mb-1">Website</label>
              <input class="w-full h-10 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white px-3 focus:ring-2 focus:ring-netnet-purple focus:outline-none" />
            </div>
          </div>
          <div id="company-address-fields">
            ${renderAddressFields('company', isIntl)}
          </div>
        </div>
      </div>
      <div>
        <h4 class="text-sm font-bold text-gray-900 dark:text-white border-b border-gray-200 dark:border-gray-700 pb-1 mb-3">Social Profiles</h4>
        <div id="company-social-list" class="space-y-3">
          ${socialIcons.map(s => `
            <div class="flex items-center gap-4">
              <div class="social-icon-container">
                ${SOCIAL_ICON_MAP[s.key]}
              </div>
              <div class="flex-1">
                <input aria-label="${s.name}" class="w-full h-10 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white px-3 focus:ring-2 focus:ring-netnet-purple focus:outline-none" placeholder="${s.name} URL or handle" />
              </div>
            </div>
          `).join('')}
        </div>
        <button type="button" id="add-company-social-btn" class="mt-3 inline-flex items-center gap-2 text-sm text-netnet-purple hover:underline">
          <span>+ Add custom social</span>
        </button>
      </div>
    </div>
  `;
}

function buildPersonFormBody(isIntl, companies) {
  const socialIcons = [
    { name: 'LinkedIn', key: 'linkedin' },
    { name: 'Facebook', key: 'facebook' },
    { name: 'X', key: 'x' },
    { name: 'Instagram', key: 'instagram' },
    { name: 'TikTok', key: 'tiktok' },
    { name: 'WhatsApp', key: 'whatsapp' },
    { name: 'YouTube', key: 'youtube' },
    { name: 'Snapchat', key: 'snapchat' },
    { name: 'Threads', key: 'threads' },
    { name: 'Reddit', key: 'reddit' },
    { name: 'Pinterest', key: 'pinterest' },
    { name: 'Website (Personal)', key: 'globe' },
  ];
  return `
    <div class="bg-white dark:bg-gray-800 rounded-xl shadow border border-gray-200 dark:border-gray-700 p-6 space-y-8">
      <div>
        <h4 class="text-sm font-bold text-gray-900 dark:text-white border-b border-gray-200 dark:border-gray-700 pb-1 mb-3">Contact Details</h4>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div>
            <label class="block text-xs font-semibold uppercase text-gray-500 dark:text-gray-400 mb-1">First Name</label>
            <input required class="w-full h-10 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white px-3 focus:ring-2 focus:ring-netnet-purple focus:outline-none" />
          </div>
          <div>
            <label class="block text-xs font-semibold uppercase text-gray-500 dark:text-gray-400 mb-1">Last Name</label>
            <input required class="w-full h-10 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white px-3 focus:ring-2 focus:ring-netnet-purple focus:outline-none" />
          </div>
          <div class="md:col-span-2">
            <div id="company-lookup-slot"></div>
          </div>
          <div class="md:col-span-2">
            <label class="block text-xs font-semibold uppercase text-gray-500 dark:text-gray-400 mb-1">Title</label>
            <input class="w-full h-10 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white px-3 focus:ring-2 focus:ring-netnet-purple focus:outline-none" />
          </div>
        </div>
      </div>
      <div>
        <div class="flex items-center justify-between border-b border-gray-200 dark:border-gray-700 pb-1 mb-3">
          <h4 class="text-sm font-bold text-gray-900 dark:text-white">Contact Info</h4>
          <label class="inline-flex items-center gap-2 text-xs text-gray-600 dark:text-gray-300">
            <span>US</span>
            <input type="checkbox" id="contact-intl-toggle" class="sr-only peer">
            <div class="relative w-9 h-5 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-netnet-purple dark:peer-focus:ring-white rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all dark:border-gray-600 peer-checked:bg-netnet-purple"></div>
            <span>Intl</span>
          </label>
        </div>
        <div class="space-y-5">
          <div class="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <label class="block text-xs font-semibold uppercase text-gray-500 dark:text-gray-400 mb-1">Office Phone</label>
              <input class="w-full h-10 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white px-3 focus:ring-2 focus:ring-netnet-purple focus:outline-none" placeholder="${isIntl ? '+44 20 7946 0018' : '(212) 555-1234'}" />
            </div>
            <div>
              <label class="block text-xs font-semibold uppercase text-gray-500 dark:text-gray-400 mb-1">Mobile Phone</label>
              <input class="w-full h-10 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white px-3 focus:ring-2 focus:ring-netnet-purple focus:outline-none" placeholder="${isIntl ? '+44 7700 900123' : '(917) 555-0000'}" />
            </div>
          </div>
          <div id="contact-address-fields">
            ${renderAddressFields('person', isIntl)}
          </div>
        </div>
      </div>
      <div>
        <h4 class="text-sm font-bold text-gray-900 dark:text-white border-b border-gray-200 dark:border-gray-700 pb-1 mb-3">Social Profiles</h4>
        <div id="social-profiles-list" class="space-y-3">
          ${socialIcons.map(s => `
            <div class="flex items-center gap-4">
              <div class="social-icon-container">
                ${renderSocialIcon(s.key)}
              </div>
              <div class="flex-1">
                <input aria-label="${s.name}" class="w-full h-10 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white px-3 focus:ring-2 focus:ring-netnet-purple focus:outline-none" placeholder="${s.name} URL or handle" />
              </div>
            </div>
          `).join('')}
        </div>
        <button type="button" id="add-social-btn" class="mt-3 inline-flex items-center gap-2 text-sm text-netnet-purple hover:underline">
          <span>+ Add custom social</span>
        </button>
      </div>
    </div>
  `;
}

export function renderCompanyFormPage({ mode = 'create', id = null, container } = {}) {
  const target = container || document.getElementById('app-main');
  if (!target) return;
  const companies = getContactsData();
  const existing = mode === 'edit' && id ? companies.find(c => c.id === id) : null;
  const isIntl = boolFromCountry(existing?.country);
  const title = mode === 'edit' ? 'Edit Company' : 'New Company';
  const backTarget = mode === 'edit' && id ? `#/app/contacts/company/${id}` : '#/app/contacts/companies';

  target.innerHTML = `
    <div class="h-full overflow-y-auto p-4 md:p-8 bg-[var(--color-bg-app,#020617)]">
      <div class="max-w-3xl mx-auto">
        ${buildHeader({ title, backTarget, showIntlToggle: false, isIntl })}
        <form id="entity-form" class="space-y-6">
          ${buildCompanyFormBody(isIntl)}
        </form>
      </div>
    </div>
  `;

  const toggle = target.querySelector('#company-intl-toggle');
  const form = target.querySelector('#entity-form');
  const cancelBtn = target.querySelector('#cancel-btn');
  const redrawAddress = (intl) => {
    const wrap = form.querySelector('#company-address-fields');
    if (wrap) wrap.innerHTML = renderAddressFields('company', intl);
  };
  if (toggle) {
    toggle.checked = isIntl;
    toggle.addEventListener('change', () => redrawAddress(toggle.checked));
  }
  if (cancelBtn) {
    cancelBtn.onclick = () => navigate(backTarget);
  }
  if (form) {
    form.onsubmit = (e) => {
      e.preventDefault();
      safeToast('Company saved');
      if (mode === 'edit' && id) {
        navigate(`#/app/contacts/company/${id}`);
      } else {
        const fallbackId = companies?.[0]?.id || 1;
        navigate(`#/app/contacts/company/${fallbackId}`);
      }
    };
  }
  const companySocialList = target.querySelector('#company-social-list');
  const addCompanySocialBtn = target.querySelector('#add-company-social-btn');
  if (addCompanySocialBtn && companySocialList) {
    addCompanySocialBtn.onclick = () => {
      const div = document.createElement('div');
      div.className = 'flex items-center gap-4';
      div.innerHTML = `
        <div class="social-icon-container">
          ${SOCIAL_ICON_MAP.globe}
        </div>
        <div class="flex-1 grid grid-cols-1 md:grid-cols-2 gap-2">
          <input class="h-10 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white px-3 focus:ring-2 focus:ring-netnet-purple focus:outline-none" placeholder="Social name" />
          <input class="h-10 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white px-3 focus:ring-2 focus:ring-netnet-purple focus:outline-none" placeholder="URL or handle" />
        </div>
      `;
      companySocialList.appendChild(div);
    };
  }
}

export function renderPersonFormPage({ mode = 'create', id = null, container } = {}) {
  const target = container || document.getElementById('app-main');
  if (!target) return;
  const companies = getContactsData();
  let person = null;
  if (mode === 'edit' && id) {
    companies.forEach(c => {
      const found = (c.people || []).find(p => p.id === id);
      if (found) person = { ...found, companyId: c.id, companyName: c.name };
    });
  }
  const isIntl = boolFromCountry(person?.country);
  const title = mode === 'edit' ? 'Edit Person' : 'New Person';
  const backTarget = mode === 'edit' && id ? `#/app/contacts/person/${id}` : '#/app/contacts/people';

  target.innerHTML = `
    <div class="h-full overflow-y-auto p-4 md:p-8 bg-[var(--color-bg-app,#020617)]">
      <div class="max-w-3xl mx-auto">
        ${buildHeader({ title, backTarget, showIntlToggle: false, isIntl })}
        <form id="entity-form" class="space-y-6">
          ${buildPersonFormBody(isIntl, companies)}
        </form>
      </div>
    </div>
  `;

  const toggle = target.querySelector('#contact-intl-toggle');
  const form = target.querySelector('#entity-form');
  const cancelBtn = target.querySelector('#cancel-btn');
  const addressSection = () => form.querySelector('#contact-address-fields');
  const redrawAddress = (intl) => {
    const wrap = addressSection();
    if (wrap) wrap.innerHTML = renderAddressFields('person', intl);
  };
  if (toggle) {
    toggle.checked = isIntl;
    toggle.addEventListener('change', () => redrawAddress(toggle.checked));
  }
  if (cancelBtn) cancelBtn.onclick = () => navigate(backTarget);
  if (form) {
    form.onsubmit = (e) => {
      e.preventDefault();
      safeToast('Person saved');
      if (mode === 'edit' && id) {
        navigate(`#/app/contacts/person/${id}`);
      } else {
        const firstPerson = companies?.[0]?.people?.[0];
        const fallbackId = firstPerson?.id || 1;
        navigate(`#/app/contacts/person/${fallbackId}`);
      }
    };
  }
  const companySlot = target.querySelector('#company-lookup-slot');
  if (companySlot) {
    mountCompanyLookup(companySlot, {
      label: 'Company',
      placeholder: 'Search companies...',
      value: person ? companies.find(c => c.id === person.companyId) || null : null,
      onChange: (company) => {
        if (company) person = { ...(person || {}), companyId: company.id, companyName: company.name };
        else if (person) { delete person.companyId; delete person.companyName; }
      },
    });
  }
  const socialList = target.querySelector('#social-profiles-list');
  const addSocialBtn = target.querySelector('#add-social-btn');
  if (addSocialBtn && socialList) {
    addSocialBtn.onclick = () => {
      const div = document.createElement('div');
      div.className = 'flex items-center gap-4';
      div.innerHTML = `
        <div class="social-icon-container">
          ${renderSocialIcon('globe')}
        </div>
        <div class="flex-1 grid grid-cols-1 md:grid-cols-2 gap-2">
          <input class="h-10 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white px-3 focus:ring-2 focus:ring-netnet-purple focus:outline-none" placeholder="Social name" />
          <input class="h-10 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white px-3 focus:ring-2 focus:ring-netnet-purple focus:outline-none" placeholder="URL or handle" />
        </div>
      `;
      socialList.appendChild(div);
    };
  }
}
