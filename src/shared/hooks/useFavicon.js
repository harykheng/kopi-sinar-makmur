import { useEffect } from 'react';

// Favicon per klien di-upload lewat Pengaturan admin (settings.favicon_url) dan
// dipasang saat runtime, bukan dengan mengganti file di public/. Alasannya satu
// build dipakai banyak klien: file di public/ ikut ter-bundle sekali waktu build,
// sedangkan settings dibaca per-instance dari Supabase.
//
// Link ikon statis di index.html tetap jadi fallback (dipakai selama settings
// belum kebaca, atau kalau klien tidak upload apa-apa).
const MANAGED_ATTR = 'data-ordi-favicon';

function upsertIconLink(rel, href) {
  let link = document.head.querySelector(`link[${MANAGED_ATTR}="${rel}"]`);
  if (!link) {
    link = document.createElement('link');
    link.setAttribute('rel', rel);
    link.setAttribute(MANAGED_ATTR, rel);
    document.head.appendChild(link);
  }
  if (link.getAttribute('href') !== href) link.setAttribute('href', href);
}

export function useFavicon(faviconUrl) {
  useEffect(() => {
    if (!faviconUrl) return;

    // Link statis harus dibuang, bukan cuma ditimpa: browser memilih ikon
    // berdasarkan atribut `sizes`, jadi favicon-32x32.png yang dibiarkan bisa
    // menang dari favicon custom yang tidak punya `sizes`.
    document.head
      .querySelectorAll(`link[rel~="icon"]:not([${MANAGED_ATTR}]), link[rel~="apple-touch-icon"]:not([${MANAGED_ATTR}])`)
      .forEach((el) => el.remove());

    upsertIconLink('icon', faviconUrl);
    upsertIconLink('apple-touch-icon', faviconUrl);
  }, [faviconUrl]);
}
