export function getContactsData() {
  const data = (typeof window !== 'undefined') ? window.mockContactsData : null;
  if (!Array.isArray(data)) return [];
  return data;
}
