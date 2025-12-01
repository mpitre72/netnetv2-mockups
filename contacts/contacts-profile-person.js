import { renderContactsActivityFeed } from './contacts-activity-feed.js';

export function renderPersonProfile(data, profileState, mockReportData) {
  const { isEditing, isIntl } = profileState;
  const labelClass = "block text-xs font-semibold uppercase text-gray-500 dark:text-gray-400 mb-1";
  const inputClass = "w-full h-10 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white px-3 focus:ring-2 focus:ring-netnet-purple focus:outline-none";
  const viewValueClass = "text-gray-900 dark:text-white text-base font-medium min-h-[1.5rem]";
  const backTarget = '#/app/contacts/people';
  const backLabel = 'People';
  // TODO: Use this International toggle only on Add/Edit person screens if needed for formatting; hide in read-only view.
  const toggleHtml = '';
  const backIconBtn = `
    <button
      onclick="navigate('${backTarget}')"
      class="hidden md:inline-flex items-center justify-center w-8 h-8 rounded-full border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-200 bg-white/70 dark:bg-slate-900/40 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
      aria-label="Back to Contacts"
      title="Back to Contacts"
    >
      <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.75 19.5 8.25 12l7.5-7.5"/></svg>
    </button>`;

  const buttonsHtml = `<button onclick="navigate('#/app/contacts/people/${data.id}/edit')" class="px-3 py-1.5 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded text-sm hover:bg-gray-50 dark:hover:bg-gray-700">Edit</button>`;

  const zipLabel = isIntl ? "Postal Code" : "Zip Code";
  const stateLabel = isIntl ? "Province" : "State";
  const phoneLabel = isIntl ? "Phone (+Intl)" : "Phone (USA)";

  const [first, ...rest] = data.name.split(' ');
  const last = rest.join(' ');

  return `
    <div class="flex flex-col lg:flex-row h-full">
      <div class="flex-1 overflow-y-auto p-4 md:p-8 bg-[var(--color-bg-app,#020617)]">
        <div class="max-w-3xl mx-auto">
          <div class="flex flex-col gap-3 md:flex-row md:items-center md:justify-between mb-6">
            <div class="flex items-center gap-3 md:gap-4">
              <button onclick="navigate('${backTarget}')" class="md:hidden inline-flex items-center gap-2 h-11 px-3 rounded-lg border border-gray-200 dark:border-gray-700 text-sm font-medium text-gray-700 dark:text-gray-200 bg-white/80 dark:bg-gray-900/60 hover:bg-gray-50 dark:hover:bg-gray-800 transition">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.75 19.5 8.25 12l7.5-7.5"/></svg>
                <span>${backLabel}</span>
              </button>
              ${backIconBtn}
              <h1 class="text-2xl font-bold text-gray-900 dark:text-white">${data.name}</h1>
            </div>
            <div class="flex items-center gap-3">
              <div class="flex gap-2">${buttonsHtml}</div>
            </div>
          </div>
          <div class="bg-white dark:bg-gray-800 rounded-xl shadow border border-gray-200 dark:border-gray-700 p-6">
            <div class="space-y-6">
              <div>
                <h4 class="text-sm font-bold text-gray-900 dark:text-white border-b border-gray-200 dark:border-gray-700 pb-1 mb-3">Person Details</h4>
                <div class="grid grid-cols-1 md:grid-cols-2 gap-5">
                  ${isEditing 
                    ? `<div><label class="${labelClass}">First Name</label><input value="${first}" class="${inputClass}"></div>
                       <div><label class="${labelClass}">Last Name</label><input value="${last}" class="${inputClass}"></div>`
                    : `<div class="md:col-span-2"><label class="${labelClass}">Name</label><div class="${viewValueClass} text-lg">${data.name}</div></div>`
                  }
                  <div><label class="${labelClass}">Title</label>${isEditing ? `<input value="${data.title}" class="${inputClass}">` : `<div class="${viewValueClass}">${data.title}</div>`}</div>
                  <div><label class="${labelClass}">Company</label>
                    ${isEditing 
                      ? `<select class="${inputClass}">${(window.mockContactsData || []).map(c => `<option value="${c.id}" ${c.id === data.companyId ? 'selected':''}>${c.name}</option>`).join('')}</select>` 
                      : `<div class="${viewValueClass}"><a href="#/app/contacts/company/${data.companyId}" class="text-netnet-purple hover:underline">${data.companyName}</a></div>`}
                  </div>
                </div>
              </div>
              <div>
                <h4 class="text-sm font-bold text-gray-900 dark:text-white border-b border-gray-200 dark:border-gray-700 pb-1 mb-3">Contact Information</h4>
                <div class="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div><label class="${labelClass}">Email</label>${isEditing ? `<input value="${data.email}" class="${inputClass}">` : `<a href="mailto:${data.email}" class="text-netnet-purple hover:underline">${data.email}</a>`}</div>
                  <div><label class="${labelClass}">Mobile</label>${isEditing ? `<input value="${data.phone}" class="${inputClass}">` : `<div class="${viewValueClass}">${data.phone}</div>`}</div>
                  <div class="md:col-span-2"><label class="${labelClass}">Address 1</label>${isEditing ? `<input value="${data.address}" class="${inputClass}">` : `<div class="${viewValueClass}">${data.address}</div>`}</div>
                  <div class="md:col-span-2"><label class="${labelClass}">Address 2</label>${isEditing ? `<input value="" class="${inputClass}">` : `<div class="${viewValueClass}">-</div>`}</div>
                  <div><label class="${labelClass}">City</label>${isEditing ? `<input value="${data.city}" class="${inputClass}">` : `<div class="${viewValueClass}">${data.city}</div>`}</div>
                  <div class="grid grid-cols-2 gap-2">
                    <div><label class="${labelClass}">${stateLabel}</label>${isEditing ? `<input value="${data.state}" class="${inputClass}">` : `<div class="${viewValueClass}">${data.state}</div>`}</div>
                    <div><label class="${labelClass}">${zipLabel}</label>${isEditing ? `<input value="${data.zip}" class="${inputClass}">` : `<div class="${viewValueClass}">${data.zip}</div>`}</div>
                  </div>
                </div>
              </div>
              <div>
                <h4 class="text-sm font-bold text-gray-900 dark:text-white border-b border-gray-200 dark:border-gray-700 pb-1 mb-3">Social Media</h4>
                <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div><label class="${labelClass}">LinkedIn</label>${isEditing ? `<input value="" class="${inputClass}">` : `<div class="truncate text-sm text-netnet-purple">-</div>`}</div>
                  <div><label class="${labelClass}">Instagram</label>${isEditing ? `<input value="" class="${inputClass}">` : `<div class="truncate text-sm text-netnet-purple">-</div>`}</div>
                  <div><label class="${labelClass}">Facebook</label>${isEditing ? `<input value="" class="${inputClass}">` : `<div class="truncate text-sm text-netnet-purple">-</div>`}</div>
                </div>
              </div>
            </div>
          </div>
          <div class="hidden md:block mt-8">${backIconBtn}</div>
        </div>
      </div>
      <div class="w-full lg:w-96 border-t lg:border-t-0 lg:border-l border-gray-200 dark:border-gray-700 h-[50vh] lg:h-full flex-shrink-0">
        ${renderContactsActivityFeed(data, 'person', mockReportData)}
      </div>
    </div>
  `;
}
