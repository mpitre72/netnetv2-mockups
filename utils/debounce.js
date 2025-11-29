// Simple debounce utility. Returns a debounced version of fn that waits `wait`
// ms after the last call before executing.
export function debounce(fn, wait = 200) {
  let t;
  return function debounced(...args) {
    clearTimeout(t);
    t = setTimeout(() => fn.apply(this, args), wait);
  };
}
