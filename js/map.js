/**
 * map.js — Leaflet map setup, tile layer, markers and popups.
 */

// ── Map init ─────────────────────────────────────────────────────────────────
const map = L.map("map", {
  center: [51.505, -0.09],  // default: London
  zoom: 15,
  zoomControl: true,
});

// ── Basemap tile layers ───────────────────────────────────────────────────────
const cartoAttr =
  '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank">OpenStreetMap</a> contributors ' +
  '&copy; <a href="https://carto.com/attributions" target="_blank">CARTO</a>';

const stadiaAttr =
  '&copy; <a href="https://www.stadiamaps.com/" target="_blank">Stadia Maps</a> ' +
  '&copy; <a href="https://openmaptiles.org/" target="_blank">OpenMapTiles</a> ' +
  '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank">OpenStreetMap</a>';

const basemaps = {
  "Carto Dark":         L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",                    { attribution: cartoAttr,  subdomains: "abcd", maxZoom: 20 }),
  "Carto Voyager Dark": L.tileLayer("https://{s}.basemaps.cartocdn.com/rastertiles/voyager_dark_all/{z}/{x}/{y}{r}.png", { attribution: cartoAttr,  subdomains: "abcd", maxZoom: 20 }),
  "Stadia Smooth Dark": L.tileLayer("https://tiles.stadiamaps.com/tiles/alidade_smooth_dark/{z}/{x}/{y}{r}.png",        { attribution: stadiaAttr,                     maxZoom: 20 }),
};

basemaps["Stadia Smooth Dark"].addTo(map);
L.control.layers(basemaps, null, { position: "topright", collapsed: true }).addTo(map);

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

  const osmUrl = biz.osmType
    ? `https://www.openstreetmap.org/${biz.osmType}/${biz.id}`
    : `https://www.openstreetmap.org/#map=19/${biz.lat}/${biz.lon}`;
  html += `
    <details class="popup-osm">
      <summary>Data not up to date?</summary>
      <p>Unchained runs on OpenStreetMap — free, community-maintained map data. It's occasionally out of date. Business owners (or anyone) can update the listing directly; changes appear here within 24 hours.</p>
      <a href="${escHtml(osmUrl)}" target="_blank" rel="noopener">Edit this place on OpenStreetMap →</a>
    </details>`;

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
