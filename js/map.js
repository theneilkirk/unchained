/**
 * map.js — Leaflet map setup, tile layers (Stadia → CartoDB 401 fallback),
 *           marker clustering, and popups.
 */

// ── Map init ──────────────────────────────────────────────────────────────────
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

const stadiaLayer = L.tileLayer(
  "https://tiles.stadiamaps.com/tiles/alidade_smooth_dark/{z}/{x}/{y}{r}.png",
  { attribution: stadiaAttr, maxZoom: 20 }
);

const cartoLayer = L.tileLayer(
  "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
  { attribution: cartoAttr, subdomains: "abcd", maxZoom: 20 }
);

// Stadia is the primary layer. If credits are exhausted (HTTP 401), switch to
// CartoDB Dark Matter silently — no error message, no visible disruption.
let stadiaFallbackDone = false;
let stadiaProbing      = false;

function activateCartoFallback() {
  if (stadiaFallbackDone) return;
  stadiaFallbackDone = true;
  map.removeLayer(stadiaLayer);
  cartoLayer.addTo(map);
}

async function probeStadia() {
  // Only one probe in-flight at a time; bail if already switched.
  if (stadiaProbing || stadiaFallbackDone) return;
  stadiaProbing = true;
  try {
    const res = await fetch(
      "https://tiles.stadiamaps.com/tiles/alidade_smooth_dark/1/0/0.png",
      { method: "HEAD" }
    );
    if (res.status === 401) activateCartoFallback();
  } catch { /* network error — assume Stadia is ok */ }
  stadiaProbing = false;
}

// Load Stadia immediately so there's no blank-map flash while the probe runs.
stadiaLayer.addTo(map);
probeStadia();                           // startup check
stadiaLayer.on("tileerror", probeStadia); // mid-session check (credits may expire)

// ── Marker clustering ─────────────────────────────────────────────────────────
const clusterGroup = L.markerClusterGroup({
  showCoverageOnHover: false,
  maxClusterRadius: 60,
  // Custom cluster icon — dark background with acid-yellow count badge
  iconCreateFunction: function(cluster) {
    return L.divIcon({
      html:       `<span>${cluster.getChildCount()}</span>`,
      className:  "unchained-cluster",
      iconSize:   [32, 32],
      iconAnchor: [16, 16],
    });
  },
});
map.addLayer(clusterGroup);

// ── State ─────────────────────────────────────────────────────────────────────
let markers      = [];
let activeMarker = null;

// ── Custom marker icon ────────────────────────────────────────────────────────
function makeIcon(active = false) {
  return L.divIcon({
    className:   "unchained-marker" + (active ? " active" : ""),
    iconSize:    [12, 12],
    iconAnchor:  [6, 6],
    popupAnchor: [0, -10],
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

  // Subtle edit icon at bottom-right. Default popup shows no data-quality text;
  // hover (desktop) or tap (mobile) reveals the OSM attribution + edit link.
  const osmUrl = biz.osmType
    ? `https://www.openstreetmap.org/${biz.osmType}/${biz.id}`
    : `https://www.openstreetmap.org/#map=19/${biz.lat}/${biz.lon}`;

  html += `
    <div class="popup-osm-wrap">
      <button class="popup-osm-btn" aria-label="Data source info">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
      </button>
      <div class="popup-osm-tooltip">
        Data from <a href="https://www.openstreetmap.org" target="_blank" rel="noopener">OpenStreetMap</a> —
        free, community-maintained, occasionally out of date.
        <a href="${escHtml(osmUrl)}" target="_blank" rel="noopener">Edit this place →</a>
      </div>
    </div>`;

  return html;
}

function escHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// Wire up tap-toggle for the OSM tooltip on mobile (desktop uses CSS :hover on the wrap)
map.on("popupopen", function() {
  const popup = document.querySelector(".leaflet-popup");
  if (!popup) return;
  const btn = popup.querySelector(".popup-osm-btn");
  const tip = popup.querySelector(".popup-osm-tooltip");
  if (btn && tip) {
    btn.addEventListener("click", function(e) {
      e.stopPropagation();
      tip.classList.toggle("visible");
    });
  }
});

// ── Render markers ────────────────────────────────────────────────────────────
function renderMarkers(businesses) {
  clearMarkers();

  markers = businesses.map(biz => {
    const marker = L.marker([biz.lat, biz.lon], { icon: makeIcon() })
      .bindPopup(buildPopup(biz), { maxWidth: 260 });

    marker.on("click", () => {
      // Popup opens automatically via Leaflet; just update icon + sidebar highlight.
      suppressMoveSearchUntil = Date.now() + 1000;
      highlightActiveMarker(biz.id);
      document.querySelectorAll(".result-item.active").forEach(el => el.classList.remove("active"));
      document.querySelector(`.result-item[data-id="${biz.id}"]`)?.classList.add("active");
    });

    clusterGroup.addLayer(marker);
    return { biz, marker };
  });
}

function clearMarkers() {
  clusterGroup.clearLayers();
  markers      = [];
  activeMarker = null;
}

// ── Active state ──────────────────────────────────────────────────────────────
// Update marker icon highlights only (used when the marker is directly clicked on the map)
function highlightActiveMarker(bizId) {
  markers.forEach(({ biz, marker }) => {
    marker.setIcon(makeIcon(biz.id === bizId));
  });
  activeMarker = bizId;
}

// Zoom in to reveal a possibly-clustered marker, then open its popup.
// Called from the sidebar list — the marker may be inside a cluster at current zoom.
function setActiveMarker(bizId) {
  highlightActiveMarker(bizId);
  const entry = markers.find(m => m.biz.id === bizId);
  if (!entry) return;
  suppressMoveSearchUntil = Date.now() + 2000;
  clusterGroup.zoomToShowLayer(entry.marker, () => {
    entry.marker.openPopup();
    map.panTo(entry.marker.getLatLng(), { animate: true });
  });
}

// ── Fly to location ───────────────────────────────────────────────────────────
function flyTo(lat, lon, zoom = 15) {
  map.flyTo([lat, lon], zoom, { duration: 1.2 });
}
