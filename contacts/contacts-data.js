export function getContactsData() {
  const data = (typeof window !== 'undefined') ? window.mockContactsData : null;
  if (!Array.isArray(data)) return [];
  return data;
}

export function getIndividualsData() {
  const data = (typeof window !== 'undefined') ? window.mockIndividualsData : null;
  if (!Array.isArray(data)) return [];
  return data;
}
