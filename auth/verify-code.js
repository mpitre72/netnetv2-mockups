export function renderVerifyCode(container = document.getElementById('app-main')) {
  if (!container) return;
  container.innerHTML = `
    <div class="relative z-10">
      <div class="w-full flex flex-col items-center px-4 sm:px-6 py-12 relative">
        <div class="w-full flex justify-center mb-6">
          <img class="auth-logo block" src="public/assets/brand/logos/logo-standard.svg" alt="Net Net" style="width:clamp(120px,33%,160px);height:auto;">
        </div>
        <h1 class="text-4xl font-semibold text-gray-900 dark:text-white">Check your email</h1>
        <p class="mt-2 text-sm text-gray-600 dark:text-white/70">Enter the 4-digit code we sent.</p>
      </div>
      <div class="auth-center-wrap">
        <div class="auth-card mt-6 border border-gray-200 bg-white shadow-lg p-6 md:p-8 dark:border-white/10 dark:bg-[#1F2430]">
          <form class="space-y-6" onsubmit="event.preventDefault(); navigate('#/auth/verify-success');">
            <div class="code-grid">
              ${Array.from({length:4}).map((_,i)=>`<input class="code-box" inputmode="numeric" pattern="[0-9]*" maxlength="1" aria-label="Digit ${i+1}" data-code-index="${i}">`).join('')}
            </div>
            <button class="w-full h-11 rounded-md bg-netnet-purple text-white font-semibold mt-2">Verify email</button>
            <p class="text-sm text-gray-600 dark:text-white/70 text-center">Didn’t receive the email? <a href="#/auth/verify-code" class="underline">Click to resend</a></p>
          </form>
          <div class="mt-4 text-center">
            <a href="#/auth/login" class="text-sm underline">Back to log in</a>
          </div>
        </div>
      </div>
    </div>
  `;

  const inputs = container.querySelectorAll('.code-box');
  inputs.forEach((inp, idx) => {
    inp.addEventListener('input', () => {
      if (inp.value && inputs[idx + 1]) inputs[idx + 1].focus();
    });
  });
}

if (typeof window !== 'undefined') {
  window.renderVerifyCode = renderVerifyCode;
}
