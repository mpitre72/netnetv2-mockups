export function installCrashOverlay() {
  if (window.__nnCrashOverlayInstalled) return;
  window.__nnCrashOverlayInstalled = true;

  const showOverlay = (message) => {
    let overlay = document.getElementById('nn-crash-overlay');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = 'nn-crash-overlay';
      overlay.style.position = 'fixed';
      overlay.style.top = '12px';
      overlay.style.left = '12px';
      overlay.style.zIndex = '9999';
      overlay.style.padding = '12px 14px';
      overlay.style.maxWidth = '380px';
      overlay.style.borderRadius = '10px';
      overlay.style.background = 'rgba(15,23,42,0.94)';
      overlay.style.color = '#f8fafc';
      overlay.style.fontFamily = 'Inter, system-ui, sans-serif';
      overlay.style.fontSize = '13px';
      overlay.style.boxShadow = '0 10px 40px rgba(0,0,0,0.35)';
      overlay.style.border = '1px solid rgba(255,255,255,0.15)';
      overlay.style.pointerEvents = 'auto';
      overlay.style.whiteSpace = 'pre-wrap';
      overlay.style.wordBreak = 'break-word';
      document.body.appendChild(overlay);
    }
    overlay.innerHTML = `<strong>Net Net crashed</strong><div style="margin-top:6px;">${message}</div>`;
  };

  window.addEventListener('error', (evt) => {
    const msg = evt?.error?.stack || evt?.message || 'Unknown error';
    showOverlay(msg);
  });

  window.addEventListener('unhandledrejection', (evt) => {
    const reason = evt?.reason;
    const msg = reason?.stack || reason?.message || String(reason);
    showOverlay(msg);
  });

  window.showCrashOverlay = showOverlay;
}
