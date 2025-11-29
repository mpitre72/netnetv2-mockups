import { renderContactsActivityFeed } from './contacts-activity-feed.js';

export function renderCompanyProfile(data, profileState, mockReportData) {
  const { isEditing, isIntl } = profileState;
  const labelClass = "block text-xs font-semibold uppercase text-gray-500 dark:text-gray-400 mb-1";
  const inputClass = "w-full h-10 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white px-3 focus:ring-2 focus:ring-netnet-purple focus:outline-none";
  const viewValueClass = "text-gray-900 dark:text-white text-base font-medium min-h-[1.5rem]";

  const toggleHtml = `
    <label class="inline-flex items-center cursor-pointer">
      <input type="checkbox" class="sr-only peer" id="fmt-toggle" ${isIntl ? 'checked' : ''}>
      <div class="relative w-9 h-5 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-netnet-purple dark:peer-focus:ring-white rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all dark:border-gray-600 peer-checked:bg-netnet-purple"></div>
      <span class="ms-2 text-xs font-medium text-gray-500 dark:text-gray-400">International</span>
    </label>
  `;

  const buttonsHtml = isEditing 
    ? `<button id="save-btn" class="px-3 py-1.5 bg-netnet-purple text-white rounded text-sm hover:bg-[#6020df]">Save</button>
       <button id="cancel-btn" class="px-3 py-1.5 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded text-sm hover:bg-gray-50 dark:hover:bg-gray-700">Cancel</button>`
    : `<button id="edit-btn" class="px-3 py-1.5 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded text-sm hover:bg-gray-50 dark:hover:bg-gray-700">Edit</button>`;

  const zipLabel = isIntl ? "Postal Code" : "Zip Code";
  const stateLabel = isIntl ? "Province" : "State";
  const phoneLabel = isIntl ? "Phone (+Intl)" : "Phone (USA)";

  return `
    <div class="flex flex-col lg:flex-row h-full">
      <div class="flex-1 overflow-y-auto p-4 md:p-8">
        <div class="max-w-3xl mx-auto">
          <div class="flex items-start justify-between mb-6">
            <div>
              <h1 class="text-2xl font-bold text-gray-900 dark:text-white">${data.name}</h1>
              <p class="text-gray-500 dark:text-gray-400 text-sm mt-1">Company Profile</p>
            </div>
            <div class="flex flex-col items-end gap-3">
              ${toggleHtml}
              <div class="flex gap-2">${buttonsHtml}</div>
            </div>
          </div>
          <div class="bg-white dark:bg-gray-800 rounded-xl shadow border border-gray-200 dark:border-gray-700 p-6">
            <div class="space-y-6">
              <div>
                <h4 class="text-sm font-bold text-gray-900 dark:text-white border-b border-gray-200 dark:border-gray-700 pb-1 mb-3">Company Details</h4>
                <div class="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div><label class="${labelClass}">Company Name</label>${isEditing ? `<input value="${data.name}" class="${inputClass}">` : `<div class="${viewValueClass} text-lg">${data.name}</div>`}</div>
                  <div><label class="${labelClass}">Website</label>${isEditing ? `<input value="${data.website}" class="${inputClass}">` : `<a href="https://${data.website}" target="_blank" class="text-netnet-purple hover:underline">${data.website}</a>`}</div>
                  <div><label class="${labelClass}">Industry</label>${isEditing ? `<input value="${data.industry||''}" class="${inputClass}">` : `<div class="${viewValueClass}">${data.industry||'-'}</div>`}</div>
                  <div class="md:col-span-2"><label class="${labelClass}">Description</label>${isEditing ? `<textarea class="${inputClass} h-20 py-2">${data.description||''}</textarea>` : `<p class="text-sm text-gray-600 dark:text-gray-300 leading-relaxed">${data.description||'No description.'}</p>`}</div>
                </div>
              </div>
              <div>
                <h4 class="text-sm font-bold text-gray-900 dark:text-white border-b border-gray-200 dark:border-gray-700 pb-1 mb-3">Contact Information</h4>
                <div class="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div><label class="${labelClass}">Email</label>${isEditing ? `<input value="${data.email}" class="${inputClass}">` : `<div class="${viewValueClass}">${data.email}</div>`}</div>
                  <div><label class="${labelClass}">${phoneLabel}</label>${isEditing ? `<input value="${data.phone}" class="${inputClass}">` : `<div class="${viewValueClass}">${data.phone}</div>`}</div>
                  <div class="md:col-span-2"><label class="${labelClass}">Address 1</label>${isEditing ? `<input value="${data.address}" class="${inputClass}">` : `<div class="${viewValueClass}">${data.address}</div>`}</div>
                  <div class="md:col-span-2"><label class="${labelClass}">Address 2</label>${isEditing ? `<input value="" placeholder="Suite, Floor, etc." class="${inputClass}">` : `<div class="${viewValueClass}">-</div>`}</div>
                  <div><label class="${labelClass}">City</label>${isEditing ? `<input value="${data.city}" class="${inputClass}">` : `<div class="${viewValueClass}">${data.city}</div>`}</div>
                  <div class="grid grid-cols-2 gap-2">
                    <div><label class="${labelClass}">${stateLabel}</label>${isEditing ? `<input value="${data.state}" class="${inputClass}">` : `<div class="${viewValueClass}">${data.state}</div>`}</div>
                    <div><label class="${labelClass}">${zipLabel}</label>${isEditing ? `<input value="${data.zip}" class="${inputClass}">` : `<div class="${viewValueClass}">${data.zip}</div>`}</div>
                  </div>
                  <div><label class="${labelClass}">Country</label>${isEditing ? `<input value="USA" class="${inputClass}">` : `<div class="${viewValueClass}">USA</div>`}</div>
                </div>
              </div>
              <div>
                <h4 class="text-sm font-bold text-gray-900 dark:text-white border-b border-gray-200 dark:border-gray-700 pb-1 mb-3">Social Media</h4>
                <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div><label class="${labelClass}">LinkedIn</label>${isEditing ? `<input value="${data.linkedin||''}" class="${inputClass}">` : `<div class="truncate text-sm text-netnet-purple">${data.linkedin||'-'}</div>`}</div>
                  <div><label class="${labelClass}">Instagram</label>${isEditing ? `<input value="${data.socials?.instagram||''}" class="${inputClass}">` : `<div class="truncate text-sm text-netnet-purple">${data.socials?.instagram||'-'}</div>`}</div>
                  <div><label class="${labelClass}">Facebook</label>${isEditing ? `<input value="${data.socials?.facebook||''}" class="${inputClass}">` : `<div class="truncate text-sm text-netnet-purple">${data.socials?.facebook||'-'}</div>`}</div>
                </div>
              </div>
            </div>
          </div>
          <div class="mt-8">
            <button onclick="navigate('#/app/contacts')" class="text-netnet-purple hover:underline text-sm font-medium">&larr; Back to Contacts List</button>
          </div>
        </div>
      </div>
      <div class="w-full lg:w-96 border-t lg:border-t-0 lg:border-l border-gray-200 dark:border-gray-700 h-[50vh] lg:h-full flex-shrink-0">
        ${renderContactsActivityFeed(data, 'company', mockReportData)}
      </div>
    </div>
  `;
}
