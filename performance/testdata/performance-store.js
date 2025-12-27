const KEY = 'netnet_testdata_performance_v1';

export function getStore() {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    return null;
  }
}

export function setStore(next) {
  try {
    localStorage.setItem(KEY, JSON.stringify(next || {}));
  } catch (e) {
    // ignore prototype storage errors
  }
}

export function clearStore() {
  try {
    localStorage.removeItem(KEY);
  } catch (e) {
    // ignore prototype storage errors
  }
}

export const PERFORMANCE_STORE_KEY = KEY;
