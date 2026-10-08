export const DAYS   = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];
export const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Ags', 'Sep', 'Okt', 'Nov', 'Des'];

export function formatPrice(price) {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency', currency: 'IDR', minimumFractionDigits: 0,
  }).format(price);
}

// Tanggal yang boleh dipilih customer, sebagai
// { value: 'YYYY-MM-DD', label, isToday, isTomorrow, day, date, month }.
//
// leadDays  : tenggang sebelum tanggal paling awal (toko PO yang butuh H-2
//             mengirim 2, jadi hari ini dan besok tidak pernah ditawarkan).
// horizonDays: berapa hari ke depan yang ditawarkan dari tanggal paling awal.
//
// Keduanya datang dari tabel `settings`, dan defaultnya persis perilaku lama
// (mulai hari ini, 7 hari) supaya toko yang tidak mengisi apa pun tidak
// berubah.
export function buildDateChips({ leadDays = 0, horizonDays = 7 } = {}) {
  // Satu aturan untuk dua-duanya: nilai yang tidak masuk akal (negatif, nol,
  // bukan angka) jatuh ke default, nilai yang masuk akal dipotong di batas
  // atas. Tanpa aturan tunggal ini, `0` dan `-5` bisa berakhir beda sendiri:
  // yang satu jatuh ke default lewat `||`, yang satu terjepit jadi 1 hari.
  const rawLead = Number(leadDays);
  const lead = Number.isFinite(rawLead) && rawLead > 0 ? Math.min(60, Math.floor(rawLead)) : 0;
  const rawHorizon = Number(horizonDays);
  const horizon = Number.isFinite(rawHorizon) && rawHorizon > 0 ? Math.min(60, Math.floor(rawHorizon)) : 7;

  const today = new Date();
  // Dibandingkan sebagai tanggal, bukan sebagai posisi ke-0 dan ke-1 dalam
  // daftar: begitu ada tenggang, chip pertama bukan lagi hari ini, dan
  // menamainya "Hari ini" akan menyesatkan.
  const todayValue = dateKeyOf(today);
  const tomorrowDate = new Date(today);
  tomorrowDate.setDate(today.getDate() + 1);
  const tomorrowValue = dateKeyOf(tomorrowDate);

  const chips = [];
  for (let i = 0; i < horizon; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + lead + i);
    // dateKeyOf, not toISOString(), which converts to UTC first: in WIB (UTC+7)
    // a visit before 07:00 would key every chip to the previous calendar day, so
    // the chip reading "Hari ini" would store yesterday as the order date.
    const value = dateKeyOf(d);
    const isToday = value === todayValue;
    const isTomorrow = value === tomorrowValue;
    const label = isToday
      ? `Hari ini, ${d.getDate()} ${MONTHS[d.getMonth()]}`
      : isTomorrow
        ? `Besok, ${d.getDate()} ${MONTHS[d.getMonth()]}`
        : `${DAYS[d.getDay()]}, ${d.getDate()} ${MONTHS[d.getMonth()]}`;
    chips.push({
      value,
      label,
      isToday,
      isTomorrow,
      day: DAYS[d.getDay()],
      date: d.getDate(),
      month: MONTHS[d.getMonth()],
    });
  }
  return chips;
}

export function formatOrderDate(isoString) {
  return new Date(isoString).toLocaleDateString('id-ID', {
    day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

export function formatExpiryDate(isoString) {
  return new Date(isoString).toLocaleDateString('id-ID', {
    day: 'numeric', month: 'short', year: 'numeric',
  });
}

// First letter of a product name, used as the image placeholder when a product
// has no photo. Neutral by design: the template serves many kinds of shops, so
// no food/drink emoji is assumed here.
export function productInitial(name) {
  const ch = (name || '').trim().charAt(0);
  return ch ? ch.toUpperCase() : '·';
}

// 'YYYY-MM-DD' for a Date, read from its local parts. Deliberately not
// toISOString().split('T')[0], which converts to UTC first and therefore names
// the previous day for anyone east of Greenwich during the early morning.
export function dateKeyOf(date) {
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${mm}-${dd}`;
}

export function todayKey() {
  return dateKeyOf(new Date());
}

// Short label for a 'YYYY-MM-DD' key, e.g. 'Hari ini' / 'Besok' / 'Sen 25 Sep'.
// Recomputed from the key on purpose rather than reusing orders.order_date_label:
// that label is frozen when the order is placed, so an order taken yesterday for
// the next day still reads "Besok" today, when it has become "Hari ini".
export function formatDateKey(key) {
  const parts = String(key || '').split('-');
  if (parts.length !== 3) return String(key || '');
  const [y, m, d] = parts.map(Number);
  const date = new Date(y, m - 1, d);
  // Round-tripping the parsed date back to a key rejects everything a plain NaN
  // check misses: an out-of-range month (MONTHS[12] would print "undefined") and
  // a day that rolls into the next month (31 Feb becoming 3 Mar).
  if (dateKeyOf(date) !== key) return String(key);

  const today = new Date();
  if (key === dateKeyOf(today)) return 'Hari ini';
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);
  if (key === dateKeyOf(tomorrow)) return 'Besok';

  return `${DAYS[date.getDay()]} ${d} ${MONTHS[m - 1]}`;
}
