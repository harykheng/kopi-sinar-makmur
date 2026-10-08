import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';

// Leaflet's default marker icon paths break under bundlers, point them at the
// bundled asset URLs instead (standard Vite+Leaflet fix). The prototype delete
// is required too: without it, Leaflet's own path-detection logic still runs
// and produces a doubled/broken icon URL even with iconUrl set explicitly.
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
});

// Small read-only OpenStreetMap preview pinned at the resolved address coords ,
// free tile server, no API key/cost, matches this project's "avoid Maps API
// billing" stance (see CLAUDE.md). Renders nothing until coords are resolved.
export default function AddressMapPreview({ lat, lng, large }) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const markerRef = useRef(null);

  useEffect(() => {
    if (!containerRef.current || mapRef.current || lat == null || lng == null) return;

    const map = L.map(containerRef.current, {
      zoomControl: false,
      attributionControl: false,
      dragging: false,
      scrollWheelZoom: false,
      doubleClickZoom: false,
      touchZoom: false,
    }).setView([lat, lng], 16);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
    }).addTo(map);

    markerRef.current = L.marker([lat, lng]).addTo(map);
    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
      markerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lat == null || lng == null]);

  useEffect(() => {
    if (!mapRef.current || lat == null || lng == null) return;
    mapRef.current.setView([lat, lng], 16);
    markerRef.current?.setLatLng([lat, lng]);
    mapRef.current.invalidateSize();
  }, [lat, lng]);

  if (lat == null || lng == null) return null;

  return <div className={`address-map-preview${large ? ' address-map-preview-lg' : ''}`} ref={containerRef} />;
}
