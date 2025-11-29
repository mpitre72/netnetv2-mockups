export function renderForgotPasswordCheckEmail(container = document.getElementById('app-main')) {
  if (!container) return;
  container.innerHTML = `
    <div class="relative z-10">
      <div class="w-full flex flex-col items-center px-4 sm:px-6 py-12 relative">
        <div class="w-full flex justify-center mb-6">
          <img class="auth-logo block" src="https://hellonetnet.com/wp-content/uploads/2024/12/logo-standard.svg" alt="Net Net" style="width:clamp(120px,33%,160px);height:auto;">
        </div>
        <h1 class="text-4xl font-semibold text-gray-900 dark:text-white">Check your email</h1>
        <p class="mt-2 text-sm text-gray-600 dark:text-white/70">We sent a reset link to your inbox.</p>
      </div>
      <div class="auth-center-wrap">
        <div class="auth-card mt-6 border border-gray-200 bg-white shadow-lg p-6 md:p-8 dark:border-white/10 dark:bg-[#1F2430] text-center">
          <p class="text-sm text-gray-600 dark:text-white/70 mb-4">Didn’t get it?</p>
          <a href="#/auth/reset" class="inline-flex items-center justify-center h-11 px-5 rounded-md bg-netnet-purple text-white font-semibold">Open reset</a>
        </div>
      </div>
      <p class="mt-6 text-sm text-gray-600 dark:text-white/70 text-center"><a href="#/auth/login" class="underline">Back to log in</a></p>
    </div>
  `;
}

if (typeof window !== 'undefined') {
  window.renderForgotPasswordCheckEmail = renderForgotPasswordCheckEmail;
}
