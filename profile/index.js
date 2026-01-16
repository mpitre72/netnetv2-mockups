import { getActiveWorkspace } from '../app-shell/app-helpers.js';
import { SectionHeader } from '../components/layout/SectionHeader.js';

const { createElement: h } = React;
const { createRoot } = ReactDOM;

const PROFILE_STORAGE_KEY = 'netnet_user_profile_v1';
const USER_EMAIL_KEY = 'netnet_userEmail';

function readJson(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw);
  } catch (e) {
    return fallback;
  }
}

function writeJson(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    // Ignore storage errors in prototype
  }
}

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

function currentUserEmail() {
  try {
    const stored = localStorage.getItem(USER_EMAIL_KEY);
    return normalizeEmail(stored || 'marc@hellonetnet.com');
  } catch (e) {
    return 'marc@hellonetnet.com';
  }
}

function teamKey(wsId) {
  return `netnet_ws_${wsId}_team_v1`;
}

function loadTeamMembers(wsId) {
  const data = readJson(teamKey(wsId), []);
  return Array.isArray(data) ? data : [];
}

function splitName(fullName) {
  const parts = String(fullName || '').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return { firstName: '', lastName: '' };
  if (parts.length === 1) return { firstName: parts[0], lastName: '' };
  return { firstName: parts[0], lastName: parts.slice(1).join(' ') };
}

function getDisplayName(profile) {
  const fullName = [profile.firstName, profile.lastName].filter(Boolean).join(' ').trim();
  return fullName || profile.email || 'User';
}

function getInitials(profile) {
  const name = getDisplayName(profile);
  const parts = name.split(/\s+/).filter(Boolean);
  const initials = parts.slice(0, 2).map(part => part[0]).join('');
  return (initials || 'NN').toUpperCase();
}

function ensureUserProfile() {
  const email = currentUserEmail();
  const stored = readJson(PROFILE_STORAGE_KEY, null);
  if (stored && typeof stored === 'object') {
    const next = {
      firstName: String(stored.firstName || '').trim(),
      lastName: String(stored.lastName || '').trim(),
      email: normalizeEmail(stored.email || email) || email,
      photoDataUrl: stored.photoDataUrl || null,
    };
    if (normalizeEmail(next.email) !== email) {
      next.email = email;
    }
    writeJson(PROFILE_STORAGE_KEY, next);
    return next;
  }

  const wsId = getActiveWorkspace()?.id || 'default';
  const members = loadTeamMembers(wsId);
  const match = members.find(member => normalizeEmail(member.email) === email);
  const fallback = match ? splitName(match.name) : { firstName: '', lastName: '' };
  const firstName = match?.firstName || fallback.firstName || '';
  const lastName = match?.lastName || fallback.lastName || '';
  const seed = {
    firstName,
    lastName,
    email,
    photoDataUrl: match?.photoDataUrl || null,
  };
  writeJson(PROFILE_STORAGE_KEY, seed);
  return seed;
}

function saveUserProfile(profile) {
  writeJson(PROFILE_STORAGE_KEY, profile);
}

function syncTeamMember(profile) {
  const wsId = getActiveWorkspace()?.id || 'default';
  const members = loadTeamMembers(wsId);
  const email = normalizeEmail(profile.email);
  const target = members.find(member => normalizeEmail(member.email) === email);
  if (!target) return;
  target.firstName = profile.firstName;
  target.lastName = profile.lastName;
  target.name = [profile.firstName, profile.lastName].filter(Boolean).join(' ').trim();
  target.photoDataUrl = profile.photoDataUrl || null;
  writeJson(teamKey(wsId), members);
}

function showToast(message) {
  if (typeof window?.showToast === 'function') {
    window.showToast(message);
  }
}

export function renderProfilePage(container = document.getElementById('app-main')) {
  if (!container) {
    console.warn('[ProfileModule] container not found for renderProfilePage.');
    return;
  }

  const savedProfile = ensureUserProfile();
  const draft = { ...savedProfile };

  container.classList.remove('flex', 'items-center', 'justify-center', 'h-full');
  container.innerHTML = `
    <div class="w-full h-full flex flex-col gap-4 pb-12">
      <div id="profileHeaderRoot" class="px-4 pt-2 pb-2 md:pt-3 md:pb-2"></div>
      <div class="flex-1 px-4">
        <div class="mx-auto w-full max-w-3xl space-y-6">
          <section class="rounded-2xl border border-slate-200 dark:border-white/10 bg-white/90 dark:bg-slate-800/90 shadow-sm px-6 py-6 md:px-8 md:py-7">
            <div class="flex flex-col gap-1">
              <h2 class="text-lg font-semibold text-slate-900 dark:text-white">Profile information</h2>
              <p class="text-sm text-slate-500 dark:text-slate-400">Update your name and photo.</p>
            </div>
            <div class="mt-5 flex flex-col gap-6">
              <div class="flex flex-col md:flex-row md:items-center gap-4">
                <div id="profile-photo-preview" class="h-20 w-20 rounded-full border border-slate-200 dark:border-white/10 bg-slate-100 dark:bg-slate-900 flex items-center justify-center overflow-hidden text-slate-500 dark:text-slate-200 text-sm font-semibold"></div>
                <div class="flex flex-col gap-2">
                  <div class="flex flex-wrap items-center gap-2">
                    <button type="button" id="profile-photo-upload-btn" class="lookup-btn primary">Upload photo</button>
                    <button type="button" id="profile-photo-remove-btn" class="lookup-btn ghost" disabled>Remove photo</button>
                  </div>
                  <input id="profile-photo-input" type="file" accept="image/png,image/jpeg,image/webp" class="hidden" />
                  <p class="text-xs text-slate-500 dark:text-slate-400">This photo is used across Net Net. Workspace admins will see it in Team settings.</p>
                </div>
              </div>
              <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label class="lookup-modal__label">First name</label>
                  <input id="profile-first-name" type="text" class="lookup-input" />
                </div>
                <div>
                  <label class="lookup-modal__label">Last name</label>
                  <input id="profile-last-name" type="text" class="lookup-input" />
                </div>
              </div>
              <div>
                <label class="lookup-modal__label">Email</label>
                <input id="profile-email" type="email" class="lookup-input bg-slate-50 text-slate-500 cursor-not-allowed dark:bg-slate-900 dark:text-slate-400" disabled />
              </div>
            </div>
            <div class="mt-6 pt-4 border-t border-slate-200 dark:border-white/10 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <p id="profile-unsaved" class="text-xs text-slate-500 dark:text-slate-400 hidden">Unsaved changes</p>
              <div class="flex items-center gap-2">
                <button type="button" id="profile-cancel-btn" class="lookup-btn ghost">Cancel</button>
                <button type="button" id="profile-save-btn" class="lookup-btn primary" disabled>Save changes</button>
              </div>
            </div>
          </section>

          <section class="rounded-2xl border border-slate-200 dark:border-white/10 bg-white/90 dark:bg-slate-800/90 shadow-sm px-6 py-6 md:px-8 md:py-7">
            <div class="flex flex-col gap-1">
              <h2 class="text-lg font-semibold text-slate-900 dark:text-white">Change password</h2>
              <p class="text-sm text-slate-500 dark:text-slate-400">Update your password. This is a prototype-only action.</p>
            </div>
            <form id="profile-password-form" class="mt-5 space-y-4">
              <div>
                <label class="lookup-modal__label">Current password</label>
                <input id="profile-current-password" type="password" class="lookup-input" autocomplete="current-password" />
              </div>
              <div>
                <label class="lookup-modal__label">New password</label>
                <input id="profile-new-password" type="password" class="lookup-input" autocomplete="new-password" />
              </div>
              <div>
                <label class="lookup-modal__label">Confirm new password</label>
                <input id="profile-confirm-password" type="password" class="lookup-input" autocomplete="new-password" />
              </div>
              <p id="profile-password-error" class="text-xs text-red-600 dark:text-red-400 hidden"></p>
              <div class="flex items-center justify-end">
                <button type="submit" class="lookup-btn primary">Update password</button>
              </div>
            </form>
          </section>
        </div>
      </div>
    </div>
  `;

  const headerRoot = document.getElementById('profileHeaderRoot');
  if (headerRoot) {
    const root = createRoot(headerRoot);
    root.render(h('div', { className: 'space-y-1' }, [
      h(SectionHeader, {
        title: 'Profile',
        showHelpIcon: true,
        showSecondaryRow: false,
      }),
      h('p', { className: 'text-sm text-slate-500 dark:text-slate-400' }, 'Manage your name, photo, and password.'),
    ]));
  }

  const firstNameInput = container.querySelector('#profile-first-name');
  const lastNameInput = container.querySelector('#profile-last-name');
  const emailInput = container.querySelector('#profile-email');
  const photoPreview = container.querySelector('#profile-photo-preview');
  const photoInput = container.querySelector('#profile-photo-input');
  const photoUploadBtn = container.querySelector('#profile-photo-upload-btn');
  const photoRemoveBtn = container.querySelector('#profile-photo-remove-btn');
  const saveBtn = container.querySelector('#profile-save-btn');
  const cancelBtn = container.querySelector('#profile-cancel-btn');
  const unsavedHint = container.querySelector('#profile-unsaved');

  if (firstNameInput) firstNameInput.value = draft.firstName || '';
  if (lastNameInput) lastNameInput.value = draft.lastName || '';
  if (emailInput) emailInput.value = draft.email || '';

  const renderPhotoPreview = () => {
    if (!photoPreview) return;
    photoPreview.innerHTML = '';
    if (draft.photoDataUrl) {
      const img = document.createElement('img');
      img.src = draft.photoDataUrl;
      img.alt = getDisplayName(draft);
      img.className = 'h-full w-full object-cover';
      photoPreview.appendChild(img);
    } else {
      const span = document.createElement('span');
      span.textContent = getInitials(draft);
      photoPreview.appendChild(span);
    }
    photoRemoveBtn?.toggleAttribute('disabled', !draft.photoDataUrl);
  };

  const isDirty = () => {
    return ['firstName', 'lastName', 'email', 'photoDataUrl']
      .some((key) => (draft[key] || '') !== (savedProfile[key] || ''));
  };

  const updateDirtyState = () => {
    const dirty = isDirty();
    if (saveBtn) saveBtn.toggleAttribute('disabled', !dirty);
    if (unsavedHint) unsavedHint.classList.toggle('hidden', !dirty);
  };

  renderPhotoPreview();
  updateDirtyState();

  if (firstNameInput) {
    firstNameInput.oninput = (e) => {
      draft.firstName = e.target.value;
      renderPhotoPreview();
      updateDirtyState();
    };
  }
  if (lastNameInput) {
    lastNameInput.oninput = (e) => {
      draft.lastName = e.target.value;
      renderPhotoPreview();
      updateDirtyState();
    };
  }

  if (photoUploadBtn && photoInput) {
    photoUploadBtn.onclick = () => photoInput.click();
    photoInput.onchange = () => {
      const file = photoInput.files && photoInput.files[0];
      if (!file) return;
      if (!file.type.startsWith('image/')) {
        showToast('Please choose an image file.');
        photoInput.value = '';
        return;
      }
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === 'string') {
          draft.photoDataUrl = reader.result;
          renderPhotoPreview();
          updateDirtyState();
        }
      };
      reader.readAsDataURL(file);
      photoInput.value = '';
    };
  }

  if (photoRemoveBtn) {
    photoRemoveBtn.onclick = () => {
      draft.photoDataUrl = null;
      renderPhotoPreview();
      updateDirtyState();
    };
  }

  if (cancelBtn) {
    cancelBtn.onclick = () => {
      draft.firstName = savedProfile.firstName || '';
      draft.lastName = savedProfile.lastName || '';
      draft.email = savedProfile.email || '';
      draft.photoDataUrl = savedProfile.photoDataUrl || null;
      if (firstNameInput) firstNameInput.value = draft.firstName || '';
      if (lastNameInput) lastNameInput.value = draft.lastName || '';
      if (emailInput) emailInput.value = draft.email || '';
      renderPhotoPreview();
      updateDirtyState();
    };
  }

  if (saveBtn) {
    saveBtn.onclick = () => {
      const next = {
        firstName: String(draft.firstName || '').trim(),
        lastName: String(draft.lastName || '').trim(),
        email: savedProfile.email || draft.email || currentUserEmail(),
        photoDataUrl: draft.photoDataUrl || null,
      };
      draft.firstName = next.firstName;
      draft.lastName = next.lastName;
      draft.email = next.email;
      draft.photoDataUrl = next.photoDataUrl;
      savedProfile.firstName = next.firstName;
      savedProfile.lastName = next.lastName;
      savedProfile.email = next.email;
      savedProfile.photoDataUrl = next.photoDataUrl;
      saveUserProfile(next);
      syncTeamMember(next);
      if (firstNameInput) firstNameInput.value = next.firstName || '';
      if (lastNameInput) lastNameInput.value = next.lastName || '';
      renderPhotoPreview();
      updateDirtyState();
    };
  }

  const passwordForm = container.querySelector('#profile-password-form');
  const currentPasswordInput = container.querySelector('#profile-current-password');
  const newPasswordInput = container.querySelector('#profile-new-password');
  const confirmPasswordInput = container.querySelector('#profile-confirm-password');
  const passwordError = container.querySelector('#profile-password-error');

  const showPasswordError = (message) => {
    if (!passwordError) return;
    passwordError.textContent = message;
    passwordError.classList.remove('hidden');
  };

  const clearPasswordError = () => {
    if (!passwordError) return;
    passwordError.textContent = '';
    passwordError.classList.add('hidden');
  };

  if (passwordForm) {
    passwordForm.onsubmit = (e) => {
      e.preventDefault();
      const current = currentPasswordInput?.value || '';
      const next = newPasswordInput?.value || '';
      const confirm = confirmPasswordInput?.value || '';
      clearPasswordError();
      if (!current || !next || !confirm) {
        showPasswordError('All fields are required.');
        return;
      }
      if (next !== confirm) {
        showPasswordError('New password and confirmation must match.');
        return;
      }
      if (currentPasswordInput) currentPasswordInput.value = '';
      if (newPasswordInput) newPasswordInput.value = '';
      if (confirmPasswordInput) confirmPasswordInput.value = '';
      showToast('Password updated');
    };
  }
}
