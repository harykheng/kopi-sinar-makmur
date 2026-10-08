// Static distance-based shipping fallback, used when Biteship is unavailable
// or returns no couriers for a location. Ported verbatim from js/catalog.js.

export function haversineDistance(lat1, lng1, lat2, lng2) {
  const R    = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a    = Math.sin(dLat / 2) ** 2
             + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180)
             * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function calcShippingRate(km) {
  if (km <= 3)  return 8000;
  if (km <= 6)  return 15000;
  if (km <= 10) return 22000;
  return null; // di luar jangkauan
}
