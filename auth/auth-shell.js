import { setTheme, getTheme, __isDark } from '../app-shell/app-helpers.js';
import { navigate } from '../router.js';
import { setAuthenticated } from '../router.js';

const LOGO_LIGHT = 'public/assets/brand/logos/logo-standard.svg';
const LOGO_DARK = 'public/assets/brand/logos/logo-white.svg';
const LOGIN_SUCCESS_ROUTE = '#/app/me/tasks';

function authLogoSrc() {
  return __isDark() ? LOGO_DARK : LOGO_LIGHT;
}

function renderSwitcher(activeTab) {
  const loginSelected = activeTab === 'login';
  const registerSelected = activeTab === 'register';
  return `
    <div class="auth-switch mt-6 mb-4 flex justify-center">
      <div class="switch-shell auth-switcher-inner">
        <a href="#/auth/login" role="tab" class="switch-tab text-gray-700 dark:text-white/85" aria-selected="${loginSelected}">Log in</a>
        <a href="#/auth/register" role="tab" class="switch-tab text-gray-700 dark:text-white/85" aria-selected="${registerSelected}">Sign up</a>
      </div>
    </div>
  `;
}

function authHeader(title, subtitle = '') {
  return `
      <div class="w-full flex justify-center mb-6">
        <img class="auth-logo block" src="${authLogoSrc()}" alt="Net Net" style="width:clamp(120px,33%,160px);height:auto;">
      </div>
      <h1 class="auth-title text-gray-900 dark:text-white">${title}</h1>
      ${subtitle ? `<p class="mt-2 text-sm text-gray-600 dark:text-white/70">${subtitle}</p>` : ''}
  `;
}

function authFooterNote() {
  return `
    <div class="auth-bottom-note">
      <span>Net Net is workflow management software, built to measure performance to make profitability more predictable.
        Learn More at <a href="https://hellonetnet.com" target="_blank" rel="noopener">hellonetnet.com</a>.
      </span>
    </div>
  `;
}

function renderLoginForm() {
  return `
    <form id="loginForm" class="space-y-4">
      <div class="space-y-1">
        <label class="text-sm block text-gray-700 dark:text-white/80">Email</label>
        <input id="loginEmail" type="email" required placeholder="Enter your email" class="w-full h-11 rounded-md ring-1 ring-gray-300 bg-white text-gray-900 placeholder-gray-400 focus:ring-2 focus:ring-netnet-purple dark:bg-white/5 dark:text-white dark:placeholder-white/40 dark:ring-white/15"/>
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
      <button id="login-btn" class="w-full text-white font-semibold auth-btn-disabled" disabled>Sign in</button>
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

function renderRegisterForm() {
  return `
    <form id="registerForm" class="space-y-4">
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div class="space-y-1">
          <label class="text-sm block text-gray-700 dark:text-white/80">First name</label>
          <input id="regFirst" type="text" required placeholder="First name" class="w-full h-11 rounded-md ring-1 ring-gray-300 bg-white text-gray-900 placeholder-gray-400 px-3 focus:ring-2 focus:ring-netnet-purple dark:bg-white/5 dark:text-white dark:placeholder-white/40 dark:ring-white/15">
        </div>
        <div class="space-y-1">
          <label class="text-sm block text-gray-700 dark:text-white/80">Last name</label>
          <input id="regLast" type="text" required placeholder="Last name" class="w-full h-11 rounded-md ring-1 ring-gray-300 bg-white text-gray-900 placeholder-gray-400 px-3 focus:ring-2 focus:ring-netnet-purple dark:bg-white/5 dark:text-white dark:placeholder-white/40 dark:ring-white/15">
        </div>
      </div>
      <div class="space-y-1">
        <label class="text-sm block text-gray-700 dark:text-white/80">Email</label>
        <input id="regEmail" type="email" required placeholder="you@example.com" class="w-full h-11 rounded-md ring-1 ring-gray-300 bg-white text-gray-900 placeholder-gray-400 px-3 focus:ring-2 focus:ring-netnet-purple dark:bg-white/5 dark:text-white dark:placeholder-white/40 dark:ring-white/15">
      </div>
      <div class="space-y-1">
        <label class="text-sm block text-gray-700 dark:text-white/80">Password</label>
        <div class="pwd-wrap">
          <input id="regPass" type="password" required placeholder="••••••••" class="w-full h-11 pr-10 rounded-md ring-1 ring-gray-300 bg-white text-gray-900 placeholder-gray-400 focus:ring-2 focus:ring-netnet-purple dark:bg-white/5 dark:text-white dark:placeholder-white/40 dark:ring-white/15"/>
          <button type="button" id="regToggle1" class="pwd-eye" aria-label="Show password"></button>
        </div>
      </div>
      <div class="space-y-1">
        <label class="text-sm block text-gray-700 dark:text-white/80">Repeat password</label>
        <div class="pwd-wrap">
          <input id="regPass2" type="password" required placeholder="••••••••" class="w-full h-11 pr-10 rounded-md ring-1 ring-gray-300 bg-white text-gray-900 placeholder-gray-400 focus:ring-2 focus:ring-netnet-purple dark:bg-white/5 dark:text-white dark:placeholder-white/40 dark:ring-white/15"/>
          <button type="button" id="regToggle2" class="pwd-eye" aria-label="Show repeat password"></button>
        </div>
      </div>
      <p id="regMsg" class="text-sm h-5 text-red-500/90"></p>
      <button
        id="regSubmit"
        class="w-full text-white font-semibold auth-btn-disabled"
        disabled
      >
        Create account
      </button>
      <div class="relative my-2">
        <div class="absolute inset-0 flex items-center"><div class="w-full border-t border-gray-200 dark:border-white/10"></div></div>
        <div class="relative flex justify-center">
          <span class="px-2 text-xs text-gray-500 dark:text-white/60 bg-white dark:bg-[#1F2430]">OR</span>
        </div>
      </div>
      <button id="googleSignupBtn" type="button" class="google-btn w-full rounded-md border border-gray-300 text-gray-900 flex items-center justify-center gap-2 dark:border-white/20 dark:text-white">
        <img src="https://www.google.com/favicon.ico" alt="" class="h-4 w-4"> Continue with Google
      </button>
    </form>
  `;
}

function renderForgotForm() {
  return `
    <div class="auth-center-wrap">
      <div class="auth-card mt-6 border border-gray-200 bg-white shadow-lg p-6 md:p-8 dark:border-white/10 dark:bg-[#1F2430]">
        <form id="forgotForm" class="space-y-4">
          <div class="space-y-1">
            <label class="text-sm block text-gray-700 dark:text-white/80">Email</label>
            <input id="forgotEmail" type="email" required placeholder="Enter your email" class="w-full h-11 rounded-md ring-1 ring-gray-300 bg-white text-gray-900 placeholder-gray-400 focus:ring-2 focus:ring-netnet-purple dark:bg-white/5 dark:text-white dark:placeholder-white/40 dark:ring-white/15"/>
          </div>
          <button id="reset-btn" class="w-full text-white font-semibold auth-btn-disabled" disabled>Send reset link</button>
        </form>
      </div>
    </div>
    <p class="mt-6 text-sm text-gray-600 dark:text-white/70 text-center">Remembered it? <a href="#/auth/login" class="underline">Back to log in</a></p>
  `;
}

function renderCheckEmailCard() {
  return `
    <div class="auth-center-wrap">
      <div class="auth-card mt-6 border border-gray-200 bg-white shadow-lg p-6 md:p-8 dark:border-white/10 dark:bg-[#1F2430] text-center">
        <p class="text-sm text-gray-600 dark:text-white/70 mb-4">Didn’t get it?</p>
        <a href="#/auth/reset" class="inline-flex items-center justify-center h-11 px-5 rounded-md bg-netnet-purple text-white font-semibold">Open reset</a>
      </div>
    </div>
    <p class="mt-6 text-sm text-gray-600 dark:text-white/70 text-center"><a href="#/auth/login" class="underline">Back to log in</a></p>
  `;
}

function renderResetForm() {
  return `
    <div class="auth-center-wrap">
      <div class="auth-card mt-6 border border-gray-200 bg-white shadow-lg p-6 md:p-8 dark:border-white/10 dark:bg-[#1F2430]">
        <form id="resetForm" class="space-y-4">
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
  `;
}

function renderResetSuccess() {
  return `
    <div class="auth-center-wrap">
      <div class="auth-card mt-6 border border-gray-200 bg-white shadow-lg p-6 md:p-8 dark:border-white/10 dark:bg-[#1F2430] text-center">
        <a href="#/auth/login" class="inline-flex items-center justify-center h-11 px-5 rounded-md bg-netnet-purple text-white font-semibold">Return to log in</a>
      </div>
    </div>
  `;
}

function renderVerifyCodeCard() {
  const inputs = Array.from({ length: 4 }).map((_, i) => `
    <input class="code-box" inputmode="numeric" pattern="[0-9]*" maxlength="1" aria-label="Digit ${i + 1}" data-code-index="${i}">
  `).join('');
  return `
    <div class="auth-center-wrap">
      <div class="auth-card mt-6 border border-gray-200 bg-white shadow-lg p-6 md:p-8 dark:border-white/10 dark:bg-[#1F2430]">
        <form id="verifyForm" class="space-y-6">
          <div class="code-grid">
            ${inputs}
          </div>
          <button id="verify-btn" class="w-full text-white font-semibold auth-btn-disabled mt-2" disabled>Verify email</button>
          <p class="text-sm text-gray-600 dark:text-white/70 text-center">Didn’t receive the email? <a href="#/auth/verify-code" class="underline">Click to resend</a></p>
        </form>
        <div class="mt-4 text-center">
          <a href="#/auth/login" class="text-sm underline">Back to log in</a>
        </div>
      </div>
    </div>
  `;
}

function renderVerifySuccess() {
  return `
    <div class="auth-center-wrap">
      <div class="auth-card mt-6 border border-gray-200 bg-white shadow-lg p-6 md:p-8 dark:border-white/10 dark:bg-[#1F2430] text-center">
        <a href="#/app/me/tasks" class="inline-flex items-center justify-center h-11 px-5 rounded-md bg-netnet-purple text-white font-semibold">Continue</a>
      </div>
    </div>
  `;
}

function renderSwitcherHidden() {
  return '';
}

function buildAuthPage(routeName) {
  switch (routeName) {
    case 'auth-register':
      return `
        <div class="relative z-10 w-full flex flex-col items-center px-4 sm:px-6 py-12">
          ${authHeader('Create your account', 'Let’s get you set up.')}
          ${renderSwitcher('register')}
          <div class="auth-card mt-6 border border-gray-200 bg-white shadow-lg p-5 md:p-6 dark:border-white/10 dark:bg-[#1F2430]">
            ${renderRegisterForm()}
          </div>
          <p class="mt-6 text-sm text-gray-600 dark:text-white/70">
            Already have an account? <a class="underline" href="#/auth/login">Log in</a>
          </p>
        </div>
      `;
    case 'auth-forgot':
      return `
        <div class="relative z-10">
          ${authHeader('Forgot password')}
          ${renderSwitcherHidden()}
          ${renderForgotForm()}
        </div>
      `;
    case 'auth-check':
      return `
        <div class="relative z-10">
          ${authHeader('Check your email', 'We sent a reset link to your inbox.')}
          ${renderSwitcherHidden()}
          ${renderCheckEmailCard()}
        </div>
      `;
    case 'auth-reset':
      return `
        <div class="relative z-10">
          ${authHeader('Set new password')}
          ${renderSwitcherHidden()}
          ${renderResetForm()}
        </div>
      `;
    case 'auth-reset-success':
      return `
        <div class="relative z-10">
          ${authHeader('Password updated')}
          ${renderSwitcherHidden()}
          ${renderResetSuccess()}
        </div>
      `;
    case 'auth-verify-code':
      return `
        <div class="relative z-10">
          ${authHeader('Check your email', 'Enter the 4-digit code we sent.')}
          ${renderSwitcherHidden()}
          ${renderVerifyCodeCard()}
        </div>
      `;
    case 'auth-verify-success':
      return `
        <div class="relative z-10">
          ${authHeader('Email verified')}
          ${renderSwitcherHidden()}
          ${renderVerifySuccess()}
        </div>
      `;
    case 'auth-login':
    default:
      return `
        <div class="relative z-10 w-full flex flex-col items-center px-4 sm:px-6 py-12">
          ${authHeader('Log in to your account', 'Welcome back! Please enter your details.')}
          ${renderSwitcher('login')}
          <div class="auth-card mt-6 border border-gray-200 bg-white shadow-lg p-5 md:p-6 dark:border-white/10 dark:bg-[#1F2430]">
            ${renderLoginForm()}
          </div>
          <p class="mt-6 text-sm text-gray-600 dark:text-white/70">
            Don't have an account? <a class="underline" href="#/auth/register">Sign up</a>
          </p>
        </div>
      `;
  }
}

function wirePasswordEye(toggleId, inputId) {
  const toggle = document.getElementById(toggleId);
  const input = document.getElementById(inputId);
  if (toggle && input) {
    toggle.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>`;
    toggle.addEventListener('click', () => {
      input.type = input.type === 'password' ? 'text' : 'password';
    });
  }
}

function wireRegisterValidation() {
  const p1 = document.getElementById('regPass');
  const p2 = document.getElementById('regPass2');
  const msg = document.getElementById('regMsg');
  const submit = document.getElementById('regSubmit');
  const form = document.getElementById('registerForm');
  const toggle1 = document.getElementById('regToggle1');
  const toggle2 = document.getElementById('regToggle2');

  wirePasswordEye('regToggle1', 'regPass');
  wirePasswordEye('regToggle2', 'regPass2');

  const applyState = (valid) => {
    if (!submit) return;
    submit.disabled = !valid;
    submit.classList.remove('auth-btn-enabled', 'auth-btn-disabled');
    submit.classList.add(valid ? 'auth-btn-enabled' : 'auth-btn-disabled');
  };

  const sync = () => {
    if (!p1 || !p2 || !submit || !msg) return;
    const v1 = p1.value;
    const v2 = p2.value;
    if (v1 && v2) {
      if (v1 !== v2) {
        msg.textContent = 'Passwords do not match.';
        applyState(false);
      } else {
        msg.textContent = '';
        applyState(true);
      }
    } else {
      msg.textContent = '';
      applyState(false);
    }
  };
  applyState(false);
  if (p1) p1.addEventListener('input', sync);
  if (p2) p2.addEventListener('input', sync);
  if (form) {
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      if (!submit || submit.disabled) return;
      navigate('#/auth/verify-code');
    });
  }
}

function wireResetValidation() {
  wirePasswordEye('rstToggle1', 'rstPass');
  wirePasswordEye('rstToggle2', 'rstPass2');
  const p1 = document.getElementById('rstPass');
  const p2 = document.getElementById('rstPass2');
  const msg = document.getElementById('rstMsg');
  const btn = document.getElementById('rstBtn');
  const form = document.getElementById('resetForm');

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
  if (form) {
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      if (!btn || btn.disabled) return;
      navigate('#/auth/success');
    });
  }
}

function wireLoginForm() {
  wirePasswordEye('loginToggleEye', 'loginPass');
  const form = document.getElementById('loginForm');
  const emailInput = document.getElementById('loginEmail');
  const passInput = document.getElementById('loginPass');
  const btn = document.getElementById('login-btn');
  const googleBtn = document.getElementById('googleLoginBtn');

  let loginEmail = '';
  let loginPassword = '';
  let loginFormValid = false;

  const updateButton = () => {
    if (!btn) return;
    if (loginFormValid) {
      btn.disabled = false;
      btn.classList.remove('auth-btn-disabled');
      btn.classList.add('auth-btn-enabled');
    } else {
      btn.disabled = true;
      btn.classList.remove('auth-btn-enabled');
      btn.classList.add('auth-btn-disabled');
    }
  };

  const validateLoginForm = () => {
    const hasEmail = loginEmail.trim().length > 0;
    const hasPassword = loginPassword.trim().length > 0;
    const emailLooksValid = loginEmail.includes('@');
    loginFormValid = hasEmail && hasPassword && emailLooksValid;
  };

  if (emailInput) {
    emailInput.addEventListener('input', (e) => {
      loginEmail = e.target.value || '';
      validateLoginForm();
      updateButton();
    });
  }

  if (passInput) {
    passInput.addEventListener('input', (e) => {
      loginPassword = e.target.value || '';
      validateLoginForm();
      updateButton();
    });
  }

  updateButton();

  if (form) {
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      if (btn && btn.disabled) return;
      setAuthenticated(true);
      navigate(LOGIN_SUCCESS_ROUTE);
    });
  }

  if (googleBtn) {
    googleBtn.addEventListener('click', (e) => {
      e.preventDefault();
      setAuthenticated(true);
      navigate(LOGIN_SUCCESS_ROUTE);
    });
  }
}

function wireForgotForm() {
  const form = document.getElementById('forgotForm');
  const emailInput = document.getElementById('forgotEmail');
  const btn = document.getElementById('reset-btn');
  let resetEmail = '';
  let resetFormValid = false;

  const updateButton = () => {
    if (!btn) return;
    if (resetFormValid) {
      btn.disabled = false;
      btn.classList.remove('auth-btn-disabled');
      btn.classList.add('auth-btn-enabled');
    } else {
      btn.disabled = true;
      btn.classList.remove('auth-btn-enabled');
      btn.classList.add('auth-btn-disabled');
    }
  };

  const validateResetForm = () => {
    const hasEmail = resetEmail.trim().length > 0;
    const emailLooksValid = resetEmail.includes('@');
    resetFormValid = hasEmail && emailLooksValid;
  };

  if (emailInput) {
    emailInput.addEventListener('input', (e) => {
      resetEmail = e.target.value || '';
      validateResetForm();
      updateButton();
    });
  }

  updateButton();

  if (form) {
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      if (btn && btn.disabled) return;
      navigate('#/auth/check-email');
    });
  }
}

function wireVerifyCodeForm() {
  const inputs = Array.from(document.querySelectorAll('.code-box'));
  const btn = document.getElementById('verify-btn');

  const getCodeValue = () => inputs.map((input) => (input.value || '').trim()).join('');
  const validateCode = () => inputs.every((input) => (input.value || '').trim().length === 1);

  const updateButton = () => {
    const valid = validateCode();
    if (!btn) return;
    if (valid) {
      btn.disabled = false;
      btn.classList.remove('auth-btn-disabled');
      btn.classList.add('auth-btn-enabled');
    } else {
      btn.disabled = true;
      btn.classList.remove('auth-btn-enabled');
      btn.classList.add('auth-btn-disabled');
    }
  };

  if (inputs.length) {
    inputs.forEach((input, idx) => {
      input.addEventListener('input', (e) => {
        const value = (e.target.value || '').replace(/\D/g, '').slice(0, 1);
        e.target.value = value;
        if (value && idx < inputs.length - 1) inputs[idx + 1].focus();
        updateButton();
      });
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Backspace' && !input.value && idx > 0) {
          inputs[idx - 1].focus();
        }
      });
    });
  }

  updateButton();

  const form = document.getElementById('verifyForm');
  if (form) {
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      if (btn && btn.disabled) return;
      const code = getCodeValue();
      if (!code || code.length !== 4) return;
      navigate('#/auth/verify-success');
    });
  }
}

function wireAuthThemeToggle() {
  const btn = document.getElementById('authThemeBtn');
  if (btn) {
    btn.onclick = () => {
      const next = __isDark() ? 'light' : 'dark';
      setTheme(next);
      setAuthLogoByTheme();
    };
  }
}

function setAuthLogoByTheme() {
  const logos = document.querySelectorAll('.auth-logo');
  const src = authLogoSrc();
  logos.forEach((logo) => {
    if (logo.getAttribute('src') !== src) logo.setAttribute('src', src);
  });
}

function wireSwitcherTabs() {
  const hash = location.hash || '#/auth/login';
  document.querySelectorAll('.switch-tab').forEach(tab => {
    const href = tab.getAttribute('href');
    tab.setAttribute('aria-selected', href === hash);
  });
}

function tweakAuthInputPadding() {
  document.querySelectorAll('.auth-card :is(input[type="email"], input[type="password"])').forEach(el => {
    el.style.paddingTop = '0.70rem';
    el.style.paddingBottom = '0.70rem';
    el.style.lineHeight = '1.35';
  });
  document.querySelectorAll('.auth-card input:not(.code-box)[type="text"], .auth-card input:not(.code-box)[type="email"], .auth-card input:not(.code-box)[type="password"]').forEach(el => {
    el.style.paddingLeft = '0.875rem';
    el.style.paddingRight = '0.875rem';
  });
}

function wireAuthInteractions(routeName) {
  wireAuthThemeToggle();
  setAuthLogoByTheme();
  wireSwitcherTabs();
  tweakAuthInputPadding();
  if (routeName === 'auth-login') {
    wireLoginForm();
  } else if (routeName === 'auth-register') {
    wireRegisterValidation();
  } else if (routeName === 'auth-forgot') {
    wireForgotForm();
  } else if (routeName === 'auth-reset') {
    wireResetValidation();
  } else if (routeName === 'auth-verify-code') {
    wireVerifyCodeForm();
  }
}

export function mountAuthShell() {
  const root = document.getElementById('app-root') || document.body;
  root.innerHTML = `
    <div id="auth-shell" class="relative min-h-[100svh] bg-white dark:bg-black text-gray-900 dark:text-white">
      <div class="absolute top-0 inset-x-0 flex justify-end p-4 z-20">
        <button id="authThemeBtn" type="button" class="flex items-center gap-2 rounded-md border px-3 py-2 text-sm border-black/10 text-gray-700 hover:bg-black/5 dark:border-white/15 dark:text-white/80 dark:hover:bg-white/10">
          <span class="inline-flex items-center dark:hidden"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="4"></circle><path d="M12 1v3M12 20v3M4.22 4.22l2.12 2.12M17.66 17.66l2.12 2.12M1 12h3M20 12h3M4.22 19.78l2.12-2.12M17.66 6.34l2.12-2.12"/></svg><span class="ml-1">Light</span></span>
          <span class="hidden dark:inline-flex items-center"><svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg><span class="ml-1">Dark</span></span>
        </button>
      </div>
      <div class="auth-grid"><div class="grid-box"></div></div>
      <div id="auth-shell-main"></div>
      ${authFooterNote()}
    </div>
  `;
  setTheme(getTheme());
  setAuthLogoByTheme();
  wireAuthThemeToggle();
}

export function renderAuthScreen(routeName) {
  const main = document.getElementById('auth-shell-main');
  if (!main) return;
  main.innerHTML = buildAuthPage(routeName);
  wireAuthInteractions(routeName);
}
