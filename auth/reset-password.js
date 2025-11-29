export function renderResetPassword(container = document.getElementById('app-main')) {
  if (!container) return;
  container.innerHTML = `
    <div class="relative z-10">
      <div class="w-full flex flex-col items-center px-4 sm:px-6 py-12 relative">
        <div class="w-full flex justify-center mb-6">
          <img class="auth-logo block" src="https://hellonetnet.com/wp-content/uploads/2024/12/logo-standard.svg" alt="Net Net" style="width:clamp(120px,33%,160px);height:auto;">
        </div>
        <h1 class="text-4xl font-semibold text-gray-900 dark:text-white">Set new password</h1>
      </div>
      <div class="auth-center-wrap">
        <div class="auth-card mt-6 border border-gray-200 bg-white shadow-lg p-6 md:p-8 dark:border-white/10 dark:bg-[#1F2430]">
          <form id="resetForm" class="space-y-4" onsubmit="event.preventDefault(); navigate('#/auth/success');">
            <div class="space-y-1">
              <label class="text-sm block text-gray-700 dark:text-white/80">New password</label>
              <div class="pwd-wrap">
                <input id="rstPass" type="password" required placeholder="••••••••" class="w-full h-11 pr-10 rounded-md ring-1 ring-gray-300 bg-white text-gray-900 placeholder-gray-400 focus:ring-2 focus:ring-netnet-purple dark:bg-white/5 dark:text-white dark:placeholder-white/40 dark:ring-white/15"/>
                <button type="button" id="rstToggle1" class="pwd-eye" aria-label="Show password"></button>
              </div>
            </div>
            <div class="space-y-1">
              <label class="text-sm block text-gray-700 dark:text-white/80">Confirm password</label>
              <div class="pwd-wrap">
                <input id="rstPass2" type="password" required placeholder="••••••••" class="w-full h-11 pr-10 rounded-md ring-1 ring-gray-300 bg-white text-gray-900 placeholder-gray-400 focus:ring-2 focus:ring-netnet-purple dark:bg-white/5 dark:text-white dark:placeholder-white/40 dark:ring-white/15"/>
                <button type="button" id="rstToggle2" class="pwd-eye" aria-label="Show confirm password"></button>
              </div>
            </div>
            <p id="rstMsg" class="text-sm h-5 text-red-500/90"></p>
            <button id="rstBtn" class="w-full h-11 rounded-md bg-netnet-purple text-white font-semibold disabled:opacity-50" disabled>Update password</button>
          </form>
        </div>
      </div>
      <p class="mt-6 text-sm text-gray-600 dark:text-white/70 text-center"><a href="#/auth/login" class="underline">Back to log in</a></p>
    </div>
  `;

  const p1 = container.querySelector('#rstPass');
  const p2 = container.querySelector('#rstPass2');
  const msg = container.querySelector('#rstMsg');
  const btn = container.querySelector('#rstBtn');
  const t1 = container.querySelector('#rstToggle1');
  const t2 = container.querySelector('#rstToggle2');

  const sync = () => {
    if (!p1 || !p2 || !btn || !msg) return;
    const v1 = p1.value;
    const v2 = p2.value;
    if (v1 && v2) {
      if (v1 !== v2) {
        msg.textContent = 'Passwords do not match.';
        btn.disabled = true;
      } else {
        msg.textContent = '';
        btn.disabled = false;
      }
    } else {
      msg.textContent = '';
      btn.disabled = true;
    }
  };
  if (p1) p1.addEventListener('input', sync);
  if (p2) p2.addEventListener('input', sync);

  if (t1 && p1) t1.onclick = () => { p1.type = p1.type === 'password' ? 'text' : 'password'; };
  if (t2 && p2) t2.onclick = () => { p2.type = p2.type === 'password' ? 'text' : 'password'; };
}

if (typeof window !== 'undefined') {
  window.renderResetPassword = renderResetPassword;
}
