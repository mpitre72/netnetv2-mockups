const DELIVERABLE_TYPES_STORAGE_KEY = 'netnet_deliverable_types_v1';

function createId(prefix) {
  return `${prefix}_${Math.random().toString(36).slice(2, 9)}`;
}

function readJson(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw);
  } catch (e) {
    return fallback;
  }
}

function writeJson(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    // Ignore storage errors in prototype mode.
  }
}

export function normalizeDeliverableTypeName(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function normalizeDeliverableTypeEntry(entry) {
  const name = normalizeDeliverableTypeName(typeof entry === 'string' ? entry : entry?.name);
  if (!name) return null;
  return {
    id: String(typeof entry === 'object' && entry?.id ? entry.id : createId('deliverable_type')),
    name,
    createdAt: typeof entry === 'object' && entry?.createdAt ? String(entry.createdAt) : null,
  };
}

function dedupeDeliverableTypes(entries = []) {
  const byName = new Map();
  (entries || []).forEach((entry) => {
    const normalized = normalizeDeliverableTypeEntry(entry);
    if (!normalized) return;
    const key = normalized.name.toLowerCase();
    const existing = byName.get(key);
    if (!existing) {
      byName.set(key, normalized);
      return;
    }
    byName.set(key, {
      id: existing.id || normalized.id,
      name: normalized.name,
      createdAt: existing.createdAt || normalized.createdAt || null,
    });
  });
  return Array.from(byName.values()).sort((a, b) => a.name.localeCompare(b.name));
}

export function loadDeliverableTypes() {
  const parsed = readJson(DELIVERABLE_TYPES_STORAGE_KEY, []);
  const normalized = dedupeDeliverableTypes(Array.isArray(parsed) ? parsed : []);
  writeJson(DELIVERABLE_TYPES_STORAGE_KEY, normalized);
  return normalized;
}

export function saveDeliverableTypes(types = []) {
  const normalized = dedupeDeliverableTypes(types);
  writeJson(DELIVERABLE_TYPES_STORAGE_KEY, normalized);
  return normalized;
}

export function loadDeliverableTypeOptions() {
  return loadDeliverableTypes().map((type) => type.name);
}

export function rememberDeliverableType(value, existingOptions = null) {
  const nextName = normalizeDeliverableTypeName(value);
  const base = Array.isArray(existingOptions) && existingOptions.length
    ? (existingOptions || []).map((name) => ({ name }))
    : loadDeliverableTypes();
  if (!nextName) return dedupeDeliverableTypes(base).map((type) => type.name);
  const saved = saveDeliverableTypes([
    ...base,
    { name: nextName, createdAt: new Date().toISOString() },
  ]);
  return saved.map((type) => type.name);
}

export function createDeliverableType(name) {
  const nextName = normalizeDeliverableTypeName(name);
  if (!nextName) throw new Error('Name is required.');
  return saveDeliverableTypes([
    ...loadDeliverableTypes(),
    { name: nextName, createdAt: new Date().toISOString() },
  ]);
}

export function updateDeliverableType(id, name) {
  const nextName = normalizeDeliverableTypeName(name);
  if (!nextName) throw new Error('Name is required.');
  const existing = loadDeliverableTypes();
  const current = existing.find((type) => String(type.id) === String(id));
  if (!current) throw new Error('Deliverable Type not found.');
  return saveDeliverableTypes(existing.map((type) => (
    String(type.id) === String(id)
      ? { ...type, name: nextName }
      : type
  )));
}

export function deleteDeliverableType(id) {
  return saveDeliverableTypes(loadDeliverableTypes().filter((type) => String(type.id) !== String(id)));
}
