/**
 * map.js — Leaflet map setup, tile layer, markers and popups.
 */

// ── Map init ─────────────────────────────────────────────────────────────────
const map = L.map("map", {
  center: [51.505, -0.09],  // default: London
  zoom: 15,
  zoomControl: true,
});

// Dark OSM tile via Stadia Maps (no API key needed for low volume)
L.tileLayer("https://tiles.stadiamaps.com/tiles/alidade_smooth_dark/{z}/{x}/{y}{r}.png", {
  attribution:
    '&copy; <a href="https://www.stadiamaps.com/" target="_blank">Stadia Maps</a> ' +
    '&copy; <a href="https://openmaptiles.org/" target="_blank">OpenMapTiles</a> ' +
    '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank">OpenStreetMap</a>',
  maxZoom: 20,
}).addTo(map);

// ── State ────────────────────────────────────────────────────────────────────
let markers      = [];
let activeMarker = null;

// ── Custom marker icon ────────────────────────────────────────────────────────
function makeIcon(active = false) {
  return L.divIcon({
    className: "unchained-marker" + (active ? " active" : ""),
    iconSize:  [12, 12],
    iconAnchor:[6, 6],
    popupAnchor:[0, -10],
  });
}

// ── Popup content ─────────────────────────────────────────────────────────────
function buildPopup(biz) {
  const typeLabel = biz.type.replace(/_/g, " ");
  let html = `
    <div class="popup-name">${escHtml(biz.name)}</div>
    <div class="popup-type">${escHtml(typeLabel)}</div>
    <div class="popup-detail">`;

  if (biz.address) html += `<div>📍 ${escHtml(biz.address)}</div>`;
  if (biz.opening) html += `<div>🕐 ${escHtml(biz.opening)}</div>`;
  if (biz.phone)   html += `<div>📞 <a href="tel:${escHtml(biz.phone)}">${escHtml(biz.phone)}</a></div>`;
  if (biz.website) {
    const url = biz.website.startsWith("http") ? biz.website : "https://" + biz.website;
    html += `<div>🌐 <a href="${escHtml(url)}" target="_blank" rel="noopener">Website</a></div>`;
  }

  html += `</div>`;
  return html;
}

function escHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// ── Render markers ────────────────────────────────────────────────────────────
function renderMarkers(businesses) {
  clearMarkers();

  markers = businesses.map(biz => {
    const marker = L.marker([biz.lat, biz.lon], { icon: makeIcon() })
      .addTo(map)
      .bindPopup(buildPopup(biz), { maxWidth: 260 });

    marker.on("click", () => {
      setActiveMarker(biz.id);
    });

    return { biz, marker };
  });
}

function clearMarkers() {
  markers.forEach(({ marker }) => map.removeLayer(marker));
  markers = [];
  activeMarker = null;
}

// ── Active state ──────────────────────────────────────────────────────────────
function setActiveMarker(bizId) {
  markers.forEach(({ biz, marker }) => {
    const isActive = biz.id === bizId;
    marker.setIcon(makeIcon(isActive));
    if (isActive) {
      marker.openPopup();
      map.panTo(marker.getLatLng(), { animate: true });
    }
  });
  activeMarker = bizId;
}

// ── Fly to location ───────────────────────────────────────────────────────────
function flyTo(lat, lon, zoom = 15) {
  map.flyTo([lat, lon], zoom, { duration: 1.2 });
}
