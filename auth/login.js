import { setAuthenticated } from '../router.js';

const logoDark = 'public/assets/brand/logos/logo-white.svg';
const logoLight = 'public/assets/brand/logos/logo-standard.svg';

function authHeader(title, subtitle = '') {
  const isDark = document.documentElement.classList.contains('dark');
  const logo = isDark ? logoDark : logoLight;
  return `
    <div class="w-full flex flex-col items-center px-4 sm:px-6 py-12 relative">
      <div class="w-full flex justify-center mb-6">
        <img class="auth-logo block" src="${logo}" alt="Net Net" style="width:clamp(120px,33%,160px);height:auto;">
      </div>
      <h1 class="text-4xl font-semibold text-gray-900 dark:text-white">${title}</h1>
      ${subtitle ? `<p class="mt-2 text-sm text-gray-600 dark:text-white/70">${subtitle}</p>` : ''}
    </div>
  `;
}

function authSwitcher(isLogin) {
  return `
    <div class="auth-switch mt-6 mb-4 flex justify-center">
      <div class="switch-shell auth-switcher-inner">
        <a href="#/auth/login" role="tab" class="switch-tab text-gray-700 dark:text-white/85" aria-selected="${isLogin}">Log in</a>
        <a href="#/auth/register" role="tab" class="switch-tab text-gray-700 dark:text-white/85" aria-selected="${!isLogin}">Sign up</a>
      </div>
    </div>
  `;
}

function renderLoginForm() {
  return `
    <form class="space-y-4">
      <div class="space-y-1">
        <label class="text-sm block text-gray-700 dark:text-white/80">Email</label>
        <input type="email" required placeholder="Enter your email" class="w-full h-11 rounded-md ring-1 ring-gray-300 bg-white text-gray-900 placeholder-gray-400 focus:ring-2 focus:ring-netnet-purple dark:bg-white/5 dark:text-white dark:placeholder-white/40 dark:ring-white/15"/>
      </div>
      <div class="space-y-1">
        <label class="text-sm block text-gray-700 dark:text-white/80">Password</label>
        <div class="pwd-wrap">
          <input id="loginPass" type="password" required placeholder="••••••••" class="w-full h-11 pr-10 rounded-md ring-1 ring-gray-300 bg-white text-gray-900 placeholder-gray-400 focus:ring-2 focus:ring-netnet-purple dark:bg-white/5 dark:text-white dark:placeholder-white/40 dark:ring-white/15"/>
          <button type="button" id="loginToggleEye" class="pwd-eye" aria-label="Show password"></button>
        </div>
      </div>
      <div class="flex items-center justify-between text-sm">
        <label class="inline-flex items-center gap-2 text-gray-600 dark:text-white/70">
          <input type="checkbox" class="rounded border-gray-300 dark:border-white/30"> Remember for 30 days
        </label>
        <a href="#/auth/forgot" class="text-netnet-purple">Forgot password?</a>
      </div>
      <button class="w-full h-11 rounded-md bg-netnet-purple text-white font-semibold">Sign in</button>
      <div class="relative my-2">
        <div class="absolute inset-0 flex items-center"><div class="w-full border-t border-gray-200 dark:border-white/10"></div></div>
        <div class="relative flex justify-center">
          <span class="px-2 text-xs text-gray-500 dark:text-white/60 bg-white dark:bg-[#1F2430]">OR</span>
        </div>
      </div>
      <button id="googleLoginBtn" type="button" class="w-full h-11 rounded-md border border-gray-300 text-gray-900 flex items-center justify-center gap-2 dark:border-white/20 dark:text-white">
        <img src="https://www.google.com/favicon.ico" alt="" class="h-4 w-4"> Continue with Google
      </button>
    </form>
  `;
}

export function renderLogin(container = document.getElementById('app-main')) {
  if (!container) return;
  const isLogin = true;
  container.innerHTML = `
    <div class="relative z-10">
      ${authHeader('Welcome back')}
      ${authSwitcher(isLogin)}
      <div class="auth-card mt-6 border border-gray-200 bg-white shadow-lg p-6 md:p-8 dark:border-white/10 dark:bg-[#1F2430]">
        ${renderLoginForm()}
        <p class="mt-4 text-sm text-gray-600 dark:text-white/70">
          Don't have an account? <a class="underline" href="#/auth/register">Sign up</a>
        </p>
      </div>
      <div class="auth-grid"><div class="grid-box"></div></div>
    </div>
  `;

  const pass = container.querySelector('#loginPass');
  const toggle = container.querySelector('#loginToggleEye');
  if (toggle && pass) {
    toggle.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>`;
    toggle.onclick = () => {
      pass.type = pass.type === 'password' ? 'text' : 'password';
    };
  }

  const form = container.querySelector('form');
  if (form) {
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      setAuthenticated(true);
      navigate('#/app/me/tasks');
    });
  }
}

// expose for router convenience
if (typeof window !== 'undefined') {
  window.renderLogin = renderLogin;
}
