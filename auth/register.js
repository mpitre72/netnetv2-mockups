import { renderLogin } from './login.js';

export function renderRegister(container = document.getElementById('app-main')) {
  if (!container) return;
  container.innerHTML = `
    <div class="relative z-10">
      <div class="w-full flex flex-col items-center px-4 sm:px-6 py-12 relative">
        <div class="w-full flex justify-center mb-6">
          <img class="auth-logo block" src="https://hellonetnet.com/wp-content/uploads/2024/12/logo-standard.svg" alt="Net Net" style="width:clamp(120px,33%,160px);height:auto;">
        </div>
        <h1 class="text-4xl font-semibold text-gray-900 dark:text-white">Create your account</h1>
      </div>
      <div class="auth-switch mt-6 mb-4 flex justify-center">
        <div class="switch-shell auth-switcher-inner">
          <a href="#/auth/login" role="tab" class="switch-tab text-gray-700 dark:text-white/85">Log in</a>
          <a href="#/auth/register" role="tab" class="switch-tab text-gray-700 dark:text-white/85" aria-selected="true">Sign up</a>
        </div>
      </div>
      <div class="auth-card mt-6 border border-gray-200 bg-white shadow-lg p-6 md:p-8 dark:border-white/10 dark:bg-[#1F2430]">
        <form class="space-y-4" onsubmit="event.preventDefault(); navigate('#/auth/verify-code');">
          <div class="space-y-1">
            <label class="text-sm block text-gray-700 dark:text-white/80">Name</label>
            <input type="text" required placeholder="Jane Smith" class="w-full h-11 rounded-md ring-1 ring-gray-300 bg-white text-gray-900 placeholder-gray-400 focus:ring-2 focus:ring-netnet-purple dark:bg-white/5 dark:text-white dark:placeholder-white/40 dark:ring-white/15"/>
          </div>
          <div class="space-y-1">
            <label class="text-sm block text-gray-700 dark:text-white/80">Email</label>
            <input type="email" required placeholder="you@company.com" class="w-full h-11 rounded-md ring-1 ring-gray-300 bg-white text-gray-900 placeholder-gray-400 focus:ring-2 focus:ring-netnet-purple dark:bg-white/5 dark:text-white dark:placeholder-white/40 dark:ring-white/15"/>
          </div>
          <div class="space-y-1">
            <label class="text-sm block text-gray-700 dark:text-white/80">Password</label>
            <div class="pwd-wrap">
              <input id="regPass" type="password" required placeholder="••••••••" class="w-full h-11 pr-10 rounded-md ring-1 ring-gray-300 bg-white text-gray-900 placeholder-gray-400 focus:ring-2 focus:ring-netnet-purple dark:bg-white/5 dark:text-white dark:placeholder-white/40 dark:ring-white/15"/>
              <button type="button" id="regToggleEye" class="pwd-eye" aria-label="Show password"></button>
            </div>
          </div>
          <button class="w-full h-11 rounded-md bg-netnet-purple text-white font-semibold">Create account</button>
        </form>
        <p class="mt-4 text-sm text-gray-600 dark:text-white/70">
          Already have an account? <a class="underline" href="#/auth/login">Log in</a>
        </p>
      </div>
      <div class="auth-grid"><div class="grid-box"></div></div>
    </div>
  `;

  const pass = container.querySelector('#regPass');
  const toggle = container.querySelector('#regToggleEye');
  if (toggle && pass) {
    toggle.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>`;
    toggle.onclick = () => {
      pass.type = pass.type === 'password' ? 'text' : 'password';
    };
  }
}

// keep both exports accessible
if (typeof window !== 'undefined') {
  window.renderRegister = renderRegister;
  window.renderLogin = renderLogin;
}
