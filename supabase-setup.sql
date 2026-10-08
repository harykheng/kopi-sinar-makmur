-- ================================================================
-- SETUP LENGKAP
-- Jalankan SEKALI di Supabase SQL Editor
-- ================================================================


-- ----------------------------------------------------------------
-- 1. EXTENSION (sudah aktif di Supabase, ini untuk jaga-jaga)
-- ----------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS "pgcrypto";


-- ----------------------------------------------------------------
-- 2. TABEL PRODUCTS
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS products (
  id            UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  name          TEXT        NOT NULL,
  description   TEXT,
  price         INTEGER     NOT NULL CHECK (price >= 0),
  image_url     TEXT,
  is_new        BOOLEAN     NOT NULL DEFAULT false,
  is_bestseller BOOLEAN     NOT NULL DEFAULT false,
  is_visible    BOOLEAN     NOT NULL DEFAULT true,
  variants      JSONB       DEFAULT '[]'::jsonb,
  stock_qty     INTEGER,
  daily_capacity INTEGER,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Safe to re-run on an existing install that predates stock_qty.
ALTER TABLE products ADD COLUMN IF NOT EXISTS stock_qty INTEGER;
COMMENT ON COLUMN products.stock_qty IS 'NULL = stok tidak dilacak (selalu tersedia). Angka = stok dikurangi otomatis oleh place_order() tiap ada order.';

ALTER TABLE products ADD COLUMN IF NOT EXISTS daily_capacity INTEGER;
COMMENT ON COLUMN products.daily_capacity IS 'NULL = kapasitas harian tidak dibatasi. Angka = berapa banyak produk ini sanggup dibuat untuk SATU tanggal pengambilan. Beda dari stock_qty: stock_qty itu satu angka global yang dikurangi permanen, daily_capacity berlaku per orders.order_date dan otomatis penuh lagi di tanggal berikutnya. Terpakainya dihitung dari tabel orders (lihat get_capacity_usage() di §7), bukan disimpan sebagai counter.';

ALTER TABLE products ENABLE ROW LEVEL SECURITY;

-- Pengunjung hanya bisa baca produk yang tampil (is_visible = true)
DROP POLICY IF EXISTS "Public read visible products" ON products;
CREATE POLICY "Public read visible products"
  ON products FOR SELECT TO anon
  USING (is_visible = true);

-- Admin bisa baca SEMUA produk (termasuk yang disembunyikan)
DROP POLICY IF EXISTS "Admin read all products" ON products;
CREATE POLICY "Admin read all products"
  ON products FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Admin insert products" ON products;
CREATE POLICY "Admin insert products"
  ON products FOR INSERT TO authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "Admin update products" ON products;
CREATE POLICY "Admin update products"
  ON products FOR UPDATE TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Admin delete products" ON products;
CREATE POLICY "Admin delete products"
  ON products FOR DELETE TO authenticated
  USING (true);


-- ----------------------------------------------------------------
-- 3. TABEL PROMO_CODES
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS promo_codes (
  id             UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  code           TEXT        NOT NULL UNIQUE,
  discount_type  TEXT        NOT NULL CHECK (discount_type IN ('percent', 'flat')),
  discount_value INTEGER     NOT NULL CHECK (discount_value > 0),
  min_order      INTEGER     NOT NULL DEFAULT 0,
  expires_at     TIMESTAMPTZ,
  is_active      BOOLEAN     NOT NULL DEFAULT true,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE promo_codes ENABLE ROW LEVEL SECURITY;

-- Customer hanya bisa baca promo yang aktif (untuk validasi kode saat checkout)
DROP POLICY IF EXISTS "Public read active promo" ON promo_codes;
CREATE POLICY "Public read active promo"
  ON promo_codes FOR SELECT TO anon
  USING (is_active = true);

DROP POLICY IF EXISTS "Admin full access promo" ON promo_codes;
CREATE POLICY "Admin full access promo"
  ON promo_codes FOR ALL TO authenticated
  USING (true) WITH CHECK (true);


-- ----------------------------------------------------------------
-- 4. TABEL SETTINGS (single row, id selalu 1)
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS settings (
  id               INTEGER     PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  brand_name       TEXT,
  brand_icon       TEXT,
  logo_url         TEXT,
  logo_text_url    TEXT,
  favicon_url      TEXT,
  store_address    TEXT,
  store_hours      TEXT,
  store_maps_url   TEXT,
  banner_title     TEXT,
  banner_subtitle  TEXT,
  banner_image_url TEXT,
  instagram_url    TEXT,
  tiktok_url       TEXT,
  store_mode       TEXT    NOT NULL DEFAULT 'sameday',
  preorder_lead_days INTEGER NOT NULL DEFAULT 0,
  order_horizon_days INTEGER NOT NULL DEFAULT 7,
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE settings ADD COLUMN IF NOT EXISTS logo_text_url TEXT;
ALTER TABLE settings ADD COLUMN IF NOT EXISTS favicon_url TEXT;

-- Mode toko. Mesinnya sama persis untuk keduanya; yang berbeda cuma kalender
-- di langkah 1 dan kalimat di sekitarnya. 'sameday' = perilaku lama (boleh
-- pesan untuk hari ini), 'preorder' = toko yang mengerjakan pesanan per
-- tanggal dan butuh tenggang.
ALTER TABLE settings ADD COLUMN IF NOT EXISTS store_mode TEXT NOT NULL DEFAULT 'sameday';
ALTER TABLE settings ADD COLUMN IF NOT EXISTS preorder_lead_days INTEGER NOT NULL DEFAULT 0;
ALTER TABLE settings ADD COLUMN IF NOT EXISTS order_horizon_days INTEGER NOT NULL DEFAULT 7;

COMMENT ON COLUMN settings.store_mode IS 'sameday | preorder. Cuma mengubah kalender langkah 1 dan copy-nya, bukan alur atau tabel yang dipakai.';
COMMENT ON COLUMN settings.preorder_lead_days IS 'Tenggang minimal dalam hari sebelum tanggal pengambilan paling awal. Diabaikan saat store_mode = sameday. Ini tenggang tingkat TOKO, bukan lead time per produk.';
COMMENT ON COLUMN settings.order_horizon_days IS 'Berapa hari ke depan yang boleh dipilih customer, dihitung dari tanggal paling awal yang tersedia.';

-- Postgres tidak punya ADD CONSTRAINT IF NOT EXISTS, jadi DROP dulu supaya
-- file ini tetap aman di-re-run di instance yang sudah jalan.
ALTER TABLE settings DROP CONSTRAINT IF EXISTS settings_store_mode_check;
ALTER TABLE settings ADD  CONSTRAINT settings_store_mode_check CHECK (store_mode IN ('sameday', 'preorder'));

ALTER TABLE settings DROP CONSTRAINT IF EXISTS settings_lead_days_check;
ALTER TABLE settings ADD  CONSTRAINT settings_lead_days_check CHECK (preorder_lead_days BETWEEN 0 AND 60);

ALTER TABLE settings DROP CONSTRAINT IF EXISTS settings_horizon_check;
ALTER TABLE settings ADD  CONSTRAINT settings_horizon_check CHECK (order_horizon_days BETWEEN 1 AND 60);

ALTER TABLE settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read settings" ON settings;
CREATE POLICY "Public read settings"
  ON settings FOR SELECT TO anon
  USING (true);

DROP POLICY IF EXISTS "Admin full access settings" ON settings;
CREATE POLICY "Admin full access settings"
  ON settings FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

-- Seed row id=1 wajib ada dari awal — kalau kosong, query `.single()` di
-- useSettings() balik 406 (bukan RLS, tapi PostgREST nganggep "0 rows" invalid
-- buat query yang expect exactly 1 row).
INSERT INTO settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING;


-- ----------------------------------------------------------------
-- 5. TABEL ORDERS
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS orders (
  id                UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  order_number      TEXT        NOT NULL UNIQUE,
  customer_name     TEXT        NOT NULL,
  customer_wa       TEXT        NOT NULL,
  order_type        TEXT        NOT NULL CHECK (order_type IN ('pickup', 'delivery')),
  order_date        DATE        NOT NULL,
  order_date_label  TEXT,
  delivery_address  TEXT,
  note              TEXT,
  items             JSONB       NOT NULL,
  subtotal          INTEGER     NOT NULL,
  promo_code        TEXT,
  discount_amount   INTEGER     NOT NULL DEFAULT 0,
  shipping_cost     INTEGER,
  shipping_label    TEXT,
  total             INTEGER     NOT NULL,
  qris_string       TEXT,
  status            TEXT        NOT NULL DEFAULT 'pending'
                      CHECK (status IN ('pending', 'confirmed', 'done', 'cancelled')),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

-- WAJIB ada — ini yang paling sering ke-skip kalau setup manual, dan bikin
-- checkout customer gagal 42501 "row violates row-level security policy".
DROP POLICY IF EXISTS "Public insert orders" ON orders;
CREATE POLICY "Public insert orders"
  ON orders FOR INSERT TO anon
  WITH CHECK (true);

DROP POLICY IF EXISTS "Admin full access orders" ON orders;
CREATE POLICY "Admin full access orders"
  ON orders FOR ALL TO authenticated
  USING (true) WITH CHECK (true);


-- ----------------------------------------------------------------
-- 6. REALTIME — buat notifikasi "pesanan baru" live di dashboard admin
-- ----------------------------------------------------------------
-- Tanpa ini, dashboard admin tetap jalan normal (cuma harus refresh manual
-- buat lihat pesanan baru) — tidak wajib untuk fitur checkout/pesanan bekerja,
-- cuma dibutuhkan kalau mau notifikasi live (lihat useNewOrderAlerts.js).
-- Realtime tetap tunduk ke RLS: anon tidak dikasih SELECT di tabel ini
-- (lihat §5), jadi customer tidak ikut kebagian event ini — hanya admin yang
-- login (authenticated, kena policy "Admin full access orders" di atas).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'orders'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE orders;
  END IF;
END $$;


-- ----------------------------------------------------------------
-- 6b. TANGGAL LIBUR
-- ----------------------------------------------------------------
-- Tanggal toko tutup. Beda dari kuota yang habis: kuota penuh itu "hari ini
-- sudah penuh pesanan", libur itu "hari ini memang tidak menerima pesanan".
-- Customer perlu melihat bedanya, jadi get_full_dates() di §7 mengembalikan
-- alasannya, bukan cuma daftar tanggal.
--
-- Level TOKO, bukan per produk. Yang dibutuhkan toko adalah "Minggu saya
-- libur", dan itu menutup semua produk sekaligus. Kuota per produk per tanggal
-- belum dibuat karena belum ada yang membutuhkannya dan ada jalan keluarnya
-- (admin ubah daily_capacity produk itu sehari itu).
CREATE TABLE IF NOT EXISTS closed_dates (
  closed_date DATE        PRIMARY KEY,
  note        TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE closed_dates IS 'Tanggal toko tutup. Ditegakkan place_order() (§7), bukan cuma disembunyikan di kalender, supaya menutup tanggal tidak jadi kosmetik.';

ALTER TABLE closed_dates ENABLE ROW LEVEL SECURITY;

-- anon SENGAJA tidak dikasih policy SELECT. Customer memang melihat tanggal
-- liburnya, tapi lewat get_full_dates() yang SECURITY DEFINER dan sudah
-- melaporkan alasannya, jadi SELECT langsung ke tabel ini tidak pernah
-- dibutuhkan. Pola yang sama dengan `orders` dan `lookup_order()`: satu jalan
-- sempit, bukan policy terbuka. Kalau nanti kalender mau menampilkan `note`
-- ("Libur Lebaran"), tambahkan kolomnya ke balikan get_full_dates(), jangan
-- buka SELECT-nya.
DROP POLICY IF EXISTS "Public read closed dates" ON closed_dates;

DROP POLICY IF EXISTS "Admin full access closed dates" ON closed_dates;
CREATE POLICY "Admin full access closed dates"
  ON closed_dates FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

-- GRANT eksplisit, tidak seperti tabel lain di file ini yang mengandalkan
-- default privileges Supabase. Tabel-tabel itu lahir bersamaan dengan
-- instance-nya; `closed_dates` lahir belakangan di instance yang sudah jalan,
-- dan default privileges bisa saja sudah diubah sejak itu. Policy RLS mengatur
-- BARIS mana yang boleh dibaca, GRANT mengatur boleh menyentuh tabelnya sama
-- sekali; tanpa keduanya, tab Pengaturan gagal membaca dan menulis tanggal
-- libur padahal policy-nya sudah benar.
GRANT SELECT, INSERT, UPDATE, DELETE ON closed_dates TO authenticated;


-- ----------------------------------------------------------------
-- 7. KUOTA HARIAN + FUNCTION place_order()
-- ----------------------------------------------------------------
-- Dua konsep berbeda dipakai bareng di sini:
--
--   products.stock_qty       satu angka global, dikurangi permanen tiap ada
--                            order. Cocok buat barang yang memang stok.
--   products.daily_capacity  berapa banyak yang sanggup DIBUAT untuk satu
--                            tanggal pengambilan. Tidak pernah dikurangi:
--                            terpakainya dihitung ulang dari tabel orders,
--                            jadi tanggal berikutnya otomatis penuh lagi.
--
-- Kenapa kuota dihitung, bukan disimpan sebagai counter seperti stock_qty:
--   1. Pesanan dibatalkan otomatis melepas slotnya, tanpa perlu function
--      pengembali kuota (updateOrderStatus() cuma mengubah kolom status).
--   2. Pesanan `pending` yang tidak pernah diverifikasi ikut lepas sendiri
--      lewat batas 24 jam di bawah, jadi orang yang membuka QRIS lalu kabur
--      tidak mengunci slot selamanya.
--   3. Angka terpakai tidak bisa melenceng dari kenyataan, karena cuma ada
--      satu sumber.
--
-- Batas 24 jam itu SENGAJA sama dengan PENDING_EXPIRE_MS di
-- src/shared/hooks/useOrders.js, yang menyembunyikan pending kedaluwarsa dari
-- daftar admin. Kalau salah satunya diubah, ubah dua-duanya, kalau tidak
-- pesanan bisa mengunci kuota padahal adminnya sendiri sudah tidak melihatnya.

-- Baris item pesanan yang masih menghitung untuk satu tanggal. Dipakai
-- get_capacity_usage() di bawah DAN place_order(), supaya browser dan cek
-- atomic saat checkout tidak mungkin memakai definisi "masih berlaku" yang
-- berbeda.
--
-- Item tanpa `pid` (baris yang ditulis sebelum cartSnapshot() menyimpan id
-- produk, lihat src/shared/lib/cart.js) tidak ikut terhitung: tidak ada cara
-- mencocokkannya ke produk yang bisa diandalkan, dan menebak lewat nama akan
-- salah begitu produknya di-rename.
CREATE OR REPLACE FUNCTION active_order_item_qty(p_date DATE)
RETURNS TABLE (product_id UUID, qty INTEGER)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT (item->>'pid')::UUID, (item->>'qty')::INTEGER
  FROM orders o
  CROSS JOIN LATERAL jsonb_array_elements(
    CASE WHEN jsonb_typeof(o.items) = 'array' THEN o.items ELSE '[]'::jsonb END
  ) AS item
  WHERE o.order_date = p_date
    AND o.status <> 'cancelled'
    AND NOT (o.status = 'pending' AND o.created_at < now() - INTERVAL '24 hours')
    AND item->>'pid' IS NOT NULL;
$$;

-- Helper internal, BUKAN buat dipanggil browser. Postgres memberi EXECUTE ke
-- PUBLIC secara default untuk function baru, jadi tanpa REVOKE ini anon bisa
-- memanggilnya langsung dan melewati penyempitan di get_capacity_usage() di
-- bawah: balikannya mencakup SEMUA produk, termasuk yang kuotanya tidak diisi
-- dan karena itu sengaja tidak diumumkan. get_capacity_usage(), get_full_dates()
-- dan place_order() tetap bisa memakainya karena ketiganya SECURITY DEFINER
-- dan berjalan sebagai pemilik function ini.
REVOKE EXECUTE ON FUNCTION active_order_item_qty(DATE) FROM PUBLIC;


-- Dipanggil browser lewat rpc() buat menampilkan sisa slot di katalog.
-- Balikannya SENGAJA sempit: cuma (product_id, terpakai) untuk satu tanggal,
-- dan cuma untuk produk yang kapasitasnya memang dibatasi. Tidak ada satu pun
-- kolom pesanan yang ikut keluar, jadi ini tidak membuka apa pun yang tidak
-- sudah tampil di katalog sebagai "sisa N". `orders` tetap tanpa policy SELECT
-- untuk anon, pola yang sama dengan lookup_order() di §8.
CREATE OR REPLACE FUNCTION get_capacity_usage(p_date DATE)
RETURNS TABLE (product_id UUID, used INTEGER)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT a.product_id, SUM(a.qty)::INTEGER
  FROM active_order_item_qty(p_date) a
  JOIN products p ON p.id = a.product_id
  WHERE p.daily_capacity IS NOT NULL
  GROUP BY a.product_id;
$$;

GRANT EXECUTE ON FUNCTION get_capacity_usage(DATE) TO anon;
GRANT EXECUTE ON FUNCTION get_capacity_usage(DATE) TO authenticated;


-- Tanggal dalam rentang yang SUDAH TIDAK BISA DIPESAN SAMA SEKALI: tidak ada
-- satu pun produk tampil yang masih punya sisa di tanggal itu. Dipakai langkah
-- 1 buat mematikan chip tanggalnya, supaya customer tidak memilih tanggal,
-- masuk katalog, lalu menemukan semuanya "Penuh" dan harus mundur lagi.
--
-- Dihitung di sini, bukan di browser, karena jawabannya butuh SEMUA produk
-- dikali SEMUA tanggal dalam rentang: mengerjakannya di klien berarti langkah
-- 1 harus mengambil daftar produk dan pemakaian tiap tanggal lebih dulu,
-- padahal yang dibutuhkannya cuma satu daftar tanggal.
--
-- "Masih bisa" = stoknya bukan nol DAN kuota tanggal itu belum penuh. Produk
-- tanpa stok terlacak (NULL) dianggap selalu ada, sama seperti di tempat lain.
-- Toko yang belum punya produk tampil sama sekali tidak menghasilkan tanggal
-- penuh: secara harfiah memang tidak ada yang bisa dipesan, tapi mematikan
-- seluruh kalender di toko yang katalognya masih kosong cuma bikin bingung,
-- bukan memberi tahu apa pun.
-- `reason` membedakan dua sebab yang buat customer artinya beda jauh:
-- 'closed' = toko memang libur tanggal itu, 'full' = tanggalnya sudah penuh
-- pesanan. Menyamakan keduanya bikin customer mengira toko kehabisan padahal
-- cuma libur, atau sebaliknya menunggu padahal memang sudah penuh.
--
-- Libur diperiksa lebih dulu dan menang: tanggal yang libur DAN penuh tetap
-- dilaporkan sebagai libur, karena itu sebab yang lebih mendasar.
-- DROP dulu, bukan cuma CREATE OR REPLACE. Function ini pernah mengembalikan
-- (full_date) saja, dan Postgres menolak mengubah tipe balikan lewat REPLACE:
-- "cannot change return type of existing function". Tanpa DROP, file ini jalan
-- mulus di instance baru tapi GAGAL di instance yang sudah punya versi lama,
-- yaitu justru semua instance yang sedang dipakai. GRANT-nya ikut hilang
-- bersama function lama, makanya diberikan ulang di bawah.
DROP FUNCTION IF EXISTS get_full_dates(DATE, DATE);

CREATE OR REPLACE FUNCTION get_full_dates(p_from DATE, p_to DATE)
RETURNS TABLE (full_date DATE, reason TEXT)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  WITH days AS (
    SELECT generate_series(p_from, LEAST(p_to, p_from + 60), '1 day'::INTERVAL)::DATE AS d
  ),
  prods AS (
    SELECT id, stock_qty, daily_capacity FROM products WHERE is_visible = true
  )
  SELECT days.d,
         CASE WHEN EXISTS (SELECT 1 FROM closed_dates c WHERE c.closed_date = days.d)
              THEN 'closed' ELSE 'full' END
  FROM days
  WHERE EXISTS (SELECT 1 FROM closed_dates c WHERE c.closed_date = days.d)
     OR (
       EXISTS (SELECT 1 FROM prods)
       AND NOT EXISTS (
         SELECT 1 FROM prods p
         WHERE COALESCE(p.stock_qty, 1) > 0
           AND (
             p.daily_capacity IS NULL
             OR p.daily_capacity > COALESCE(
                  (SELECT SUM(a.qty) FROM active_order_item_qty(days.d) a WHERE a.product_id = p.id),
                  0)
           )
       )
     )
  ORDER BY days.d;
$$;

GRANT EXECUTE ON FUNCTION get_full_dates(DATE, DATE) TO anon;
GRANT EXECUTE ON FUNCTION get_full_dates(DATE, DATE) TO authenticated;


-- Dipanggil dari browser lewat supabase.rpc('place_order', ...) sebagai
-- pengganti insert langsung ke `orders`. Alasannya WAJIB backend (bukan
-- sekadar preferensi): cek-lalu-kurangi stok dari JS punya race condition
-- kalau 2 customer checkout produk yang sama nyaris bersamaan — dua-duanya
-- bisa lolos cek stok sebelum salah satu sempat nulis hasil kurangnya.
-- Function ini jalan sebagai satu transaksi Postgres: tiap item di
-- stock_items dikurangi dari products.stock_qty HANYA kalau stok cukup;
-- begitu ada satu item yang gagal, seluruh transaksi (termasuk kurang
-- stok yang sudah sempat jalan di item sebelumnya) di-rollback dan order
-- TIDAK jadi ke-insert. Produk dengan stock_qty NULL dianggap tak terbatas,
-- tidak pernah dikurangi/gagal.
--
-- Function ini juga menegakkan products.daily_capacity untuk
-- order_data->>'order_date' (lihat penjelasan kuota di awal §7). Alasan harus
-- di sini sama persis dengan alasan stok: browser bisa membaca sisa kuota lalu
-- checkout, tapi tidak bisa menjamin tidak ada order lain yang menyelip di
-- antara keduanya.
--
-- SECURITY DEFINER supaya bisa UPDATE products.stock_qty walau anon tidak
-- (dan sengaja tidak diberi) policy UPDATE langsung ke tabel products —
-- akses ke situ hanya lewat function sempit ini, bukan policy terbuka.
CREATE OR REPLACE FUNCTION place_order(order_data JSONB, stock_items JSONB)
RETURNS SETOF orders
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  item JSONB;
  affected INTEGER;
  prod_name TEXT;
  v_order_date DATE := (order_data->>'order_date')::DATE;
  v_product_id UUID;
  v_qty INTEGER;
  v_capacity INTEGER;
  v_used INTEGER;
BEGIN
  -- Tanggal libur ditolak paling awal. Kalendernya memang sudah mematikan chip
  -- tanggal itu, tapi tanpa penegakan di sini menutup tanggal cuma kosmetik:
  -- tanggal bisa ditutup setelah customer memilihnya, dan pesanan yang sudah
  -- terlanjur dibuka tetap bisa lolos.
  IF EXISTS (SELECT 1 FROM closed_dates WHERE closed_date = v_order_date) THEN
    RAISE EXCEPTION 'TOKO_TUTUP: Toko libur di tanggal itu, pilih tanggal lain ya';
  END IF;

  -- Cek kuota harian, sebelum stok dikurangi, supaya pesanan yang lewat
  -- kuota tidak sempat menyentuh stock_qty sama sekali.
  --
  -- Diagregasi per produk (bukan diiterasi per baris stock_items seperti loop
  -- stok di bawah) karena cara menghitungnya beda. Stok berkurang langsung di
  -- tabel products, jadi iterasi kedua sudah melihat hasil iterasi pertama.
  -- Kuota dihitung dari tabel orders, dan order ini belum di-insert, jadi tiap
  -- iterasi akan membaca angka terpakai yang sama: dua varian dari produk yang
  -- sama masing-masing 3 buah akan lolos dua kali terhadap sisa 5, lalu
  -- menghasilkan 6. Menjumlahkannya dulu menutup celah itu.
  --
  -- SELECT ... FOR UPDATE mengunci baris produknya, dan itu yang membuat cek
  -- ini aman terhadap dua checkout bersamaan: transaksi kedua menunggu sampai
  -- yang pertama commit, lalu menghitung ulang dengan order pertama sudah
  -- masuk. Diurutkan per product_id supaya semua transaksi mengambil kunci
  -- dalam urutan yang sama, jadi dua order dengan produk yang sama tapi urutan
  -- keranjang berbeda tidak bisa saling mengunci.
  FOR v_product_id, v_qty IN
    SELECT (e->>'product_id')::UUID, SUM((e->>'qty')::INTEGER)
    FROM jsonb_array_elements(stock_items) e
    GROUP BY 1
    ORDER BY 1
  LOOP
    SELECT daily_capacity, name INTO v_capacity, prod_name
    FROM products WHERE id = v_product_id
    FOR UPDATE;

    IF v_capacity IS NOT NULL THEN
      SELECT COALESCE(SUM(qty), 0) INTO v_used
      FROM active_order_item_qty(v_order_date)
      WHERE product_id = v_product_id;

      IF v_used + v_qty > v_capacity THEN
        IF v_capacity - v_used > 0 THEN
          RAISE EXCEPTION 'KUOTA_HABIS: % untuk tanggal itu sisa % lagi',
            COALESCE(prod_name, 'Produk ini'), v_capacity - v_used;
        ELSE
          RAISE EXCEPTION 'KUOTA_HABIS: % sudah penuh untuk tanggal itu',
            COALESCE(prod_name, 'Produk ini');
        END IF;
      END IF;
    END IF;
  END LOOP;

  FOR item IN SELECT * FROM jsonb_array_elements(stock_items)
  LOOP
    UPDATE products
    SET stock_qty = stock_qty - (item->>'qty')::INTEGER
    WHERE id = (item->>'product_id')::UUID
      AND (stock_qty IS NULL OR stock_qty >= (item->>'qty')::INTEGER);

    GET DIAGNOSTICS affected = ROW_COUNT;

    IF affected = 0 THEN
      SELECT name INTO prod_name FROM products WHERE id = (item->>'product_id')::UUID;
      RAISE EXCEPTION 'STOK_HABIS: % stoknya tidak cukup', COALESCE(prod_name, 'Produk ini');
    END IF;
  END LOOP;

  RETURN QUERY
  INSERT INTO orders (
    order_number, customer_name, customer_wa, order_type, order_date, order_date_label,
    delivery_address, note, items, subtotal, promo_code, discount_amount,
    shipping_cost, shipping_label, total, qris_string, status
  )
  SELECT
    order_data->>'order_number', order_data->>'customer_name', order_data->>'customer_wa',
    order_data->>'order_type', (order_data->>'order_date')::DATE, order_data->>'order_date_label',
    order_data->>'delivery_address', order_data->>'note', order_data->'items',
    (order_data->>'subtotal')::INTEGER, order_data->>'promo_code', (order_data->>'discount_amount')::INTEGER,
    (order_data->>'shipping_cost')::INTEGER, order_data->>'shipping_label', (order_data->>'total')::INTEGER,
    order_data->>'qris_string', COALESCE(order_data->>'status', 'pending')
  RETURNING *;
END;
$$;

GRANT EXECUTE ON FUNCTION place_order(JSONB, JSONB) TO anon;


-- Membatalkan pesanan DAN mengembalikan stoknya, dalam satu transaksi.
--
-- Kenapa harus function, bukan update biasa dari browser seperti sebelumnya:
-- `updateOrderStatus()` cuma membalik kolom status dan tidak pernah
-- mengembalikan apa pun, jadi tiap pembatalan menghanguskan stok secara
-- permanen. Kuota harian tidak kena karena dihitung ulang dari tabel orders
-- (lihat §7), tapi products.stock_qty itu counter sungguhan yang sudah
-- terlanjur dikurangi place_order().
--
-- Idempoten, dan itu bukan kemewahan: tombol Batalkan bisa tertekan dua kali,
-- dan tanpa syarat `status <> 'cancelled'` stoknya akan bertambah dua kali.
-- Transisi pertama yang menang, sisanya tidak mengubah apa-apa.
--
-- Produk dengan stock_qty NULL dilewati karena memang tidak pernah dikurangi.
-- Item tanpa `pid` (baris yang ditulis sebelum cartSnapshot() menyimpan id
-- produk) juga dilewati: tidak ada cara mencocokkannya ke produk yang bisa
-- diandalkan, dan menebak lewat nama akan salah begitu produknya di-rename.
--
-- Batasan yang diterima sadar: kalau sebuah produk diubah dari tak terbatas
-- (NULL) menjadi terlacak SETELAH pesanannya masuk, pembatalan akan menambah
-- stok yang sebenarnya tidak pernah diambil. Mencatat persis apa yang dikurangi
-- saat order dibuat akan menutup celah ini, tapi itu kolom baru untuk kasus
-- yang jarang, dan angka stok yang diubah manual admin memang sudah menimpa
-- hitungan otomatis.
CREATE OR REPLACE FUNCTION cancel_order(p_order_id UUID)
RETURNS SETOF orders
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_items JSONB;
BEGIN
  UPDATE orders
  SET status = 'cancelled', updated_at = now()
  WHERE id = p_order_id AND status <> 'cancelled'
  RETURNING items INTO v_items;

  IF FOUND THEN
    UPDATE products p
    SET stock_qty = p.stock_qty + agg.qty
    FROM (
      SELECT (item->>'pid')::UUID AS pid, SUM((item->>'qty')::INTEGER) AS qty
      FROM jsonb_array_elements(
        CASE WHEN jsonb_typeof(v_items) = 'array' THEN v_items ELSE '[]'::jsonb END
      ) AS item
      WHERE item->>'pid' IS NOT NULL
      GROUP BY 1
    ) agg
    WHERE p.id = agg.pid AND p.stock_qty IS NOT NULL;
  END IF;

  RETURN QUERY SELECT * FROM orders WHERE id = p_order_id;
END;
$$;

-- Hanya admin. anon tidak pernah membatalkan pesanan siapa pun, dan tanpa
-- REVOKE ini Postgres memberi EXECUTE ke PUBLIC secara default sehingga siapa
-- saja yang punya id pesanan bisa membatalkannya sekaligus menambah stok.
REVOKE EXECUTE ON FUNCTION cancel_order(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION cancel_order(UUID) TO authenticated;


-- ----------------------------------------------------------------
-- 8. FUNCTION lookup_order() — cek status pesanan tanpa login
-- ----------------------------------------------------------------
-- Dipakai halaman /tracking/ (lihat src/tracking/). `orders` RLS sengaja
-- insert-only untuk anon (lihat CLAUDE.md "Kenapa begini") — customer tidak
-- pernah dikasih SELECT langsung ke tabel ini, karena policy SELECT terbuka
-- bakal bisa di-scan buat ngintip data pesanan customer lain. Function ini
-- jalan lewat rpc(), bukan lewat query builder biasa: hanya balikin 1 baris
-- kalau order_number DAN customer_wa-nya cocok berbarengan (order_number
-- itu sendiri sudah acak/susah ditebak — 5 karakter base36 setelah prefix —
-- jadi kombinasi keduanya cukup aman buat skala UMKM tanpa perlu akun/OTP).
CREATE OR REPLACE FUNCTION lookup_order(p_order_number TEXT, p_customer_wa TEXT)
RETURNS SETOF orders
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT * FROM orders
  WHERE order_number = p_order_number
    AND customer_wa = p_customer_wa;
$$;

GRANT EXECUTE ON FUNCTION lookup_order(TEXT, TEXT) TO anon;


-- ----------------------------------------------------------------
-- 9. STORAGE BUCKET (foto produk, logo, banner)
-- ----------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public)
VALUES ('product-images', 'product-images', true)
ON CONFLICT (id) DO NOTHING;

-- Siapapun bisa lihat foto (public)
DROP POLICY IF EXISTS "Public read images" ON storage.objects;
CREATE POLICY "Public read images"
  ON storage.objects FOR SELECT TO public
  USING (bucket_id = 'product-images');

-- Hanya admin yang bisa upload foto
DROP POLICY IF EXISTS "Admin upload images" ON storage.objects;
CREATE POLICY "Admin upload images"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'product-images');

-- Hanya admin yang bisa hapus foto
DROP POLICY IF EXISTS "Admin delete images" ON storage.objects;
CREATE POLICY "Admin delete images"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'product-images');

-- Hanya admin yang bisa update file — WAJIB ada juga, walau kelihatan tidak
-- kepakai: upload dengan { upsert: true } (dipakai SettingsTab untuk logo/
-- banner) dijalankan Storage API sebagai INSERT ... ON CONFLICT DO UPDATE,
-- dan Postgres butuh privilege UPDATE (lolos RLS UPDATE) untuk cabang itu
-- SAAT PLANNING — walau ujungnya tidak ada baris yang bentrok. Tanpa policy
-- ini, upload dengan upsert:true gagal 400 "new row violates row-level
-- security policy" meskipun policy INSERT-nya sendiri sudah benar.
DROP POLICY IF EXISTS "Admin update images" ON storage.objects;
CREATE POLICY "Admin update images"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'product-images');


-- ----------------------------------------------------------------
-- 10. BUAT AKUN ADMIN
--    Email    : admin@youremail.com
--    Password : admin123   ← ganti setelah pertama login!
-- ----------------------------------------------------------------
DO $$
DECLARE
  v_uid UUID := gen_random_uuid();
BEGIN
  -- Hanya buat kalau email belum ada
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE email = 'admin@youremail.com') THEN

    INSERT INTO auth.users (
      instance_id,
      id,
      aud,
      role,
      email,
      encrypted_password,
      email_confirmed_at,
      raw_app_meta_data,
      raw_user_meta_data,
      created_at,
      updated_at,
      confirmation_token,
      email_change,
      email_change_token_new,
      recovery_token
    ) VALUES (
      '00000000-0000-0000-0000-000000000000',
      v_uid,
      'authenticated',
      'authenticated',
      'admin@youremail.com',
      crypt('admin123', gen_salt('bf')),
      now(),                                               -- langsung confirmed, tidak perlu verifikasi email
      '{"provider":"email","providers":["email"]}',
      '{}',
      now(),
      now(),
      '', '', '', ''
    );

    -- Identity record diperlukan agar login email/password bisa bekerja
    INSERT INTO auth.identities (
      id,
      user_id,
      provider_id,
      identity_data,
      provider,
      last_sign_in_at,
      created_at,
      updated_at
    ) VALUES (
      v_uid,
      v_uid,
      'admin@youremail.com',
      jsonb_build_object(
        'sub',            v_uid::text,
        'email',          'admin@youremail.com',
        'email_verified', true,
        'provider',       'email'
      ),
      'email',
      now(),
      now(),
      now()
    );

    RAISE NOTICE 'Akun admin berhasil dibuat: admin@youremail.com';
  ELSE
    RAISE NOTICE 'Akun admin sudah ada, dilewati.';
  END IF;
END $$;


-- ----------------------------------------------------------------
-- 11. VERIFIKASI — cek hasil setup
-- ----------------------------------------------------------------
SELECT 'products table'   AS item, COUNT(*)::text AS info FROM products
UNION ALL
SELECT 'promo_codes table', COUNT(*)::text FROM promo_codes
UNION ALL
SELECT 'settings row',     COALESCE((SELECT 'id=1 ada' FROM settings WHERE id = 1), 'TIDAK ADA')
UNION ALL
SELECT 'orders table',     COUNT(*)::text FROM orders
UNION ALL
SELECT 'orders realtime',  COALESCE((SELECT 'aktif' FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'orders'), 'TIDAK AKTIF')
UNION ALL
SELECT 'place_order function', COALESCE((SELECT 'ada' FROM pg_proc WHERE proname = 'place_order'), 'TIDAK ADA')
UNION ALL
SELECT 'lookup_order function', COALESCE((SELECT 'ada' FROM pg_proc WHERE proname = 'lookup_order'), 'TIDAK ADA')
UNION ALL
SELECT 'storage bucket',   COALESCE((SELECT name FROM storage.buckets WHERE id = 'product-images'), 'TIDAK ADA')
UNION ALL
SELECT 'admin user',       COALESCE((SELECT email FROM auth.users WHERE email = 'admin@youremail.com'), 'TIDAK ADA')
UNION ALL
SELECT 'daily_visits table', COALESCE((SELECT 'ada' FROM pg_tables WHERE tablename = 'daily_visits'), 'TIDAK ADA')
UNION ALL
SELECT 'track_visit function', COALESCE((SELECT 'ada' FROM pg_proc WHERE proname = 'track_visit'), 'TIDAK ADA');


-- ----------------------------------------------------------------
-- 12. TABEL DAILY_VISITS + FUNCTION track_visit() — hitung pengunjung
--     halaman katalog customer per hari
-- ----------------------------------------------------------------
-- Satu baris per tanggal (bukan satu baris per visit) supaya tabelnya gak
-- tumbuh gak terbatas — dihitung lewat UPSERT counter, bukan INSERT log.
CREATE TABLE IF NOT EXISTS daily_visits (
  visit_date DATE    PRIMARY KEY,
  count      INTEGER NOT NULL DEFAULT 0
);

ALTER TABLE daily_visits ENABLE ROW LEVEL SECURITY;

-- Cuma admin yang boleh baca angkanya — anon nulis lewat track_visit() di
-- bawah (SECURITY DEFINER), gak pernah dikasih SELECT/INSERT/UPDATE langsung
-- ke tabel ini, sama pola-nya kayak place_order()/products.stock_qty.
DROP POLICY IF EXISTS "Admin read daily visits" ON daily_visits;
CREATE POLICY "Admin read daily visits"
  ON daily_visits FOR SELECT TO authenticated
  USING (true);

-- Dipanggil dari src/customer/App.jsx sekali tiap kunjungan (lihat
-- shared/lib/visits.js). UPSERT + count = count + 1 atomic di satu statement
-- supaya dua kunjungan bersamaan gak saling timpa (race condition sama kayak
-- alasan place_order() jadi function, bukan sekadar preferensi).
CREATE OR REPLACE FUNCTION track_visit()
RETURNS VOID
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  INSERT INTO daily_visits (visit_date, count)
  VALUES (CURRENT_DATE, 1)
  ON CONFLICT (visit_date) DO UPDATE SET count = daily_visits.count + 1;
$$;

GRANT EXECUTE ON FUNCTION track_visit() TO anon;
