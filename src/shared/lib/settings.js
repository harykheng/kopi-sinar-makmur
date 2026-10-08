import { supabase } from './supabaseClient.js';

// Dijepit di sini juga, bukan cuma di CHECK constraint-nya, supaya form yang
// dikosongkan menyimpan default yang masuk akal daripada ditolak database.
function clampDays(value, fallback, min = 0) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(60, Math.floor(n)));
}

async function uploadSettingsImage(file, prefix) {
  const ext = file.name.split('.').pop().toLowerCase();
  const fileName = `${prefix}-${Date.now()}.${ext}`;
  const { error: uploadError } = await supabase.storage
    .from('product-images')
    .upload(fileName, file, { upsert: true });
  if (uploadError) throw uploadError;
  const { data: urlData } = supabase.storage.from('product-images').getPublicUrl(fileName);
  return urlData.publicUrl;
}

export async function saveSettings({
  brandName, brandIcon, storeAddress, storeHours, storeMapsUrl,
  bannerTitle, bannerSubtitle, instagramUrl, tiktokUrl,
  storeMode, preorderLeadDays, orderHorizonDays,
  logoFile, logoTextFile, faviconFile, bannerImageFile,
  existingLogoUrl, existingLogoTextUrl, existingFaviconUrl, existingBannerImageUrl,
}) {
  let logoUrl = existingLogoUrl || null;
  if (logoFile) logoUrl = await uploadSettingsImage(logoFile, 'logo');

  let logoTextUrl = existingLogoTextUrl || null;
  if (logoTextFile) logoTextUrl = await uploadSettingsImage(logoTextFile, 'logo-text');

  let faviconUrl = existingFaviconUrl || null;
  if (faviconFile) faviconUrl = await uploadSettingsImage(faviconFile, 'favicon');

  let bannerImageUrl = existingBannerImageUrl || null;
  if (bannerImageFile) bannerImageUrl = await uploadSettingsImage(bannerImageFile, 'banner');

  const { error } = await supabase.from('settings').upsert({
    id: 1,
    brand_name: brandName,
    brand_icon: brandIcon || '🏪',
    logo_url: logoUrl,
    logo_text_url: logoTextUrl,
    favicon_url: faviconUrl,
    store_address: storeAddress,
    store_hours: storeHours,
    store_maps_url: storeMapsUrl || null,
    banner_title: bannerTitle,
    banner_subtitle: bannerSubtitle,
    banner_image_url: bannerImageUrl,
    instagram_url: instagramUrl || null,
    tiktok_url: tiktokUrl || null,
    store_mode: storeMode === 'preorder' ? 'preorder' : 'sameday',
    // Tenggang cuma berlaku di mode preorder. Dinolkan di mode sameday supaya
    // angka sisa dari percobaan sebelumnya tidak diam-diam memotong kalender
    // setelah admin balik ke mode biasa.
    preorder_lead_days: storeMode === 'preorder' ? clampDays(preorderLeadDays, 0) : 0,
    order_horizon_days: clampDays(orderHorizonDays, 7, 1),
    updated_at: new Date().toISOString(),
  });
  if (error) throw error;

  return { logoUrl, logoTextUrl, faviconUrl, bannerImageUrl };
}
