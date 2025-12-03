export function renderVerifySuccess(container = document.getElementById('app-main')) {
  if (!container) return;
  container.innerHTML = `
    <div class="relative z-10">
      <div class="w-full flex flex-col items-center px-4 sm:px-6 py-12 relative">
        <div class="w-full flex justify-center mb-6">
          <img class="auth-logo block" src="public/assets/brand/logos/logo-standard.svg" alt="Net Net" style="width:clamp(120px,33%,160px);height:auto;">
        </div>
        <h1 class="text-4xl font-semibold text-gray-900 dark:text-white">Email verified</h1>
      </div>
      <div class="auth-center-wrap">
        <div class="auth-card mt-6 border border-gray-200 bg-white shadow-lg p-6 md:p-8 dark:border-white/10 dark:bg-[#1F2430] text-center">
          <a href="#/app/me" class="inline-flex items-center justify-center h-11 px-5 rounded-md bg-netnet-purple text-white font-semibold">Continue</a>
        </div>
      </div>
    </div>
  `;
}

if (typeof window !== 'undefined') {
  window.renderVerifySuccess = renderVerifySuccess;
}
