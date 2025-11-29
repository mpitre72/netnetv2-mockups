// Join address parts into a single line.
export function formatAddress({ address, city, state, zip, country } = {}) {
  const parts = [address, [city, state].filter(Boolean).join(', '), zip, country || 'USA'].filter(Boolean);
  return parts.join(' · ');
}
