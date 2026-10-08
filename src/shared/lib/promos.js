import { supabase } from './supabaseClient.js';

export async function savePromo({ promoId, code, discountType, discountValue, minOrder, expiresAt, isActive }) {
  const payload = {
    code,
    discount_type: discountType,
    discount_value: discountValue,
    min_order: minOrder,
    expires_at: expiresAt,
    is_active: isActive,
  };

  if (promoId) {
    const { error } = await supabase.from('promo_codes').update(payload).eq('id', promoId);
    if (error) throw error;
  } else {
    const { error } = await supabase.from('promo_codes').insert(payload);
    if (error) throw error;
  }
}

export async function deletePromo(promoId) {
  const { error } = await supabase.from('promo_codes').delete().eq('id', promoId);
  if (error) throw error;
}

// Used by the customer checkout to validate a promo code against min_order.
export async function fetchActivePromoByCode(code) {
  const { data, error } = await supabase
    .from('promo_codes')
    .select('*')
    .eq('code', code)
    .eq('is_active', true)
    .single();
  if (error || !data) return null;
  return data;
}
