import { supabase } from './supabaseClient.js';

async function uploadProductImage(file) {
  const ext = file.name.split('.').pop().toLowerCase();
  const fileName = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

  const { error: uploadError } = await supabase.storage
    .from('product-images')
    .upload(fileName, file, { upsert: false });
  if (uploadError) throw uploadError;

  const { data: urlData } = supabase.storage.from('product-images').getPublicUrl(fileName);
  return urlData.publicUrl;
}

export async function saveProduct({
  productId, name, description, price, isNew, isBestseller, isVisible,
  variants, stockQty, dailyCapacity, imageFile, existingImageUrl,
}) {
  let imageUrl = existingImageUrl || null;
  if (imageFile) {
    imageUrl = await uploadProductImage(imageFile);
  }

  const payload = {
    name,
    description: description || null,
    price,
    image_url: imageUrl,
    is_new: isNew,
    is_bestseller: isBestseller,
    is_visible: isVisible,
    variants,
    stock_qty: stockQty,
    daily_capacity: dailyCapacity,
  };

  if (productId) {
    const { error } = await supabase.from('products').update(payload).eq('id', productId);
    if (error) throw error;
  } else {
    const { error } = await supabase.from('products').insert(payload);
    if (error) throw error;
  }
}

export async function deleteProduct(productId) {
  const { error } = await supabase.from('products').delete().eq('id', productId);
  if (error) throw error;
}

// Bulk create from CSV import (see ProductImportModal.jsx). Rows are already
// validated/parsed by the caller, this just inserts. No image_url/variants:
// those aren't representable in a flat CSV row, admin adds them after via
// the normal edit form.
export async function importProducts(rows) {
  const payload = rows.map((r) => ({
    name: r.name,
    description: r.description || null,
    price: r.price,
    is_new: r.isNew,
    is_bestseller: r.isBestseller,
    is_visible: r.isVisible,
    stock_qty: r.stockQty,
    daily_capacity: r.dailyCapacity,
  }));
  const { error } = await supabase.from('products').insert(payload);
  if (error) throw error;
}
