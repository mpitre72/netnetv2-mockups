// Simple throttle utility. Ensures fn runs at most once every `wait` ms.
export function throttle(fn, wait = 200) {
  let last = 0;
  let trailingArgs = null;

  function invoke(ctx, args) {
    last = Date.now();
    fn.apply(ctx, args);
  }

  return function throttled(...args) {
    const now = Date.now();
    const remaining = wait - (now - last);
    if (remaining <= 0) {
      invoke(this, args);
    } else {
      trailingArgs = args;
      setTimeout(() => {
        if (trailingArgs) {
          invoke(this, trailingArgs);
          trailingArgs = null;
        }
      }, remaining);
    }
  };
}
