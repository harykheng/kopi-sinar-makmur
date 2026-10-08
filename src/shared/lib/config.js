export const config = {
  supabaseUrl: import.meta.env.VITE_SUPABASE_URL,
  supabaseAnonKey: import.meta.env.VITE_SUPABASE_ANON_KEY,
  adminWhatsapp: import.meta.env.VITE_ADMIN_WHATSAPP,
  storeName: import.meta.env.VITE_STORE_NAME || 'Nama Toko',
  orderPrefix: import.meta.env.VITE_ORDER_PREFIX || 'ORD',
  storeAddress: import.meta.env.VITE_STORE_ADDRESS || '',
  storeMapsUrl: import.meta.env.VITE_STORE_MAPS_URL || '',
  storeOpenHours: import.meta.env.VITE_STORE_OPEN_HOURS || '',
  bannerTitle: import.meta.env.VITE_BANNER_TITLE || '',
  bannerSubtitle: import.meta.env.VITE_BANNER_SUBTITLE || '',
  instagramUrl: import.meta.env.VITE_INSTAGRAM_URL || '',
  tiktokUrl: import.meta.env.VITE_TIKTOK_URL || '',
  locationIqKey: import.meta.env.VITE_LOCATIONIQ_KEY,
  storeLat: parseFloat(import.meta.env.VITE_STORE_LAT),
  storeLng: parseFloat(import.meta.env.VITE_STORE_LNG),
  defaultItemWeightG: parseInt(import.meta.env.VITE_DEFAULT_ITEM_WEIGHT_G, 10) || 300,
  // Radius (km) kotak bias pencarian alamat di sekitar toko. Bukan batas
  // jangkauan delivery (itu urusan cek ongkir), cuma bilang ke LocationIQ
  // "cari di sekitar sini dulu" supaya nama tempat yang kembar antar kota
  // (Taman Anggrek Jakarta vs Bandung) tidak ketuker.
  addressSearchRadiusKm: parseInt(import.meta.env.VITE_ADDRESS_SEARCH_RADIUS_KM, 10) || 50,
  qrisStatic: import.meta.env.VITE_QRIS_STATIC,
};
