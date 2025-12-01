const STORAGE_KEY = 'netnet_contacts_ui_state';

const defaultListState = () => ({
  filters: {},
  search: '',
  sort: null,
  scrollY: 0,
});

const defaultState = () => ({
  lastSubview: 'companies',
  companiesList: defaultListState(),
  peopleList: defaultListState(),
});

let memoryState = defaultState();

function ensureShape(raw) {
  const base = defaultState();
  const next = { ...base, ...(raw || {}) };
  next.lastSubview = next.lastSubview === 'people' ? 'people' : 'companies';
  next.companiesList = { ...defaultListState(), ...(raw?.companiesList || {}) };
  next.peopleList = { ...defaultListState(), ...(raw?.peopleList || {}) };
  return next;
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return memoryState;
    const parsed = JSON.parse(raw);
    memoryState = ensureShape(parsed);
    return memoryState;
  } catch (e) {
    return memoryState;
  }
}

function persist(state) {
  memoryState = ensureShape(state);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(memoryState));
  } catch (e) {
    // swallow storage errors in prototype
  }
  return memoryState;
}

export function getContactsUIState() {
  return loadState();
}

export function getLastSubview() {
  return loadState().lastSubview || 'companies';
}

export function setLastSubview(subview) {
  const current = loadState();
  current.lastSubview = subview === 'people' ? 'people' : 'companies';
  return persist(current).lastSubview;
}

export function getListState(subview = 'companies') {
  const state = loadState();
  const key = subview === 'people' ? 'peopleList' : 'companiesList';
  return state[key];
}

export function updateListState(subview = 'companies', partial = {}) {
  const state = loadState();
  const key = subview === 'people' ? 'peopleList' : 'companiesList';
  state[key] = { ...defaultListState(), ...state[key], ...(partial || {}) };
  return persist(state)[key];
}

export function getContactsEntryHash() {
  const last = getLastSubview();
  return last === 'people' ? '#/app/contacts/people' : '#/app/contacts/companies';
}
