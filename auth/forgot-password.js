export function renderForgotPassword(container = document.getElementById('app-main')) {
  if (!container) return;
  container.innerHTML = `
    <div class="relative z-10">
      <div class="w-full flex flex-col items-center px-4 sm:px-6 py-12 relative">
        <div class="w-full flex justify-center mb-6">
          <img class="auth-logo block" src="https://hellonetnet.com/wp-content/uploads/2024/12/logo-standard.svg" alt="Net Net" style="width:clamp(120px,33%,160px);height:auto;">
        </div>
        <h1 class="text-4xl font-semibold text-gray-900 dark:text-white">Forgot password</h1>
      </div>
      <div class="auth-center-wrap">
        <div class="auth-card mt-6 border border-gray-200 bg-white shadow-lg p-6 md:p-8 dark:border-white/10 dark:bg-[#1F2430]">
          <form class="space-y-4" onsubmit="event.preventDefault(); navigate('#/auth/check-email');">
            <div class="space-y-1">
              <label class="text-sm block text-gray-700 dark:text-white/80">Email</label>
              <input type="email" required placeholder="Enter your email" class="w-full h-11 rounded-md ring-1 ring-gray-300 bg-white text-gray-900 placeholder-gray-400 focus:ring-2 focus:ring-netnet-purple dark:bg-white/5 dark:text-white dark:placeholder-white/40 dark:ring-white/15"/>
            </div>
            <button class="w-full h-11 rounded-md bg-netnet-purple text-white font-semibold">Send reset link</button>
          </form>
        </div>
      </div>
      <p class="mt-6 text-sm text-gray-600 dark:text-white/70 text-center">Remembered it? <a href="#/auth/login" class="underline">Back to log in</a></p>
    </div>
  `;
}

if (typeof window !== 'undefined') {
  window.renderForgotPassword = renderForgotPassword;
}
