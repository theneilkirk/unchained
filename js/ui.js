/**
 * ui.js — Wires up all UI interactions.
 * Depends on: map.js, overpass.js, chains.js
 */

// ── State ─────────────────────────────────────────────────────────────────────
const state = {
  lat:        null,   // map centre at last search (for distance display)
  lon:        null,
  category:  "all",
  allResults: [],     // full unfiltered result set from last fetch
  results:    [],     // currently displayed (filtered) results
};

// Prevents moveend from triggering a search during programmatic flyTo calls
let suppressMoveSearch = false;

const MIN_SEARCH_ZOOM = 12;

// ── DOM refs ──────────────────────────────────────────────────────────────────
const locationInput  = document.getElementById("location-input");
const locateBtn      = document.getElementById("locate-btn");
const chips          = document.querySelectorAll(".chip");
const resultsCount   = document.getElementById("results-count");
const resultsList    = document.getElementById("results-list");
const searchAreaBtn  = document.getElementById("search-area-btn");
const loadingOverlay = document.getElementById("loading-overlay");
const toast          = document.getElementById("toast");

// ── Utility ───────────────────────────────────────────────────────────────────
function showLoading(msg = "Finding independents…") {
  document.getElementById("loading-text").textContent = msg;
  loadingOverlay.classList.remove("hidden");
}

function hideLoading() {
  loadingOverlay.classList.add("hidden");
}

let toastTimer;
function showToast(msg, isError = false) {
  toast.textContent = msg;
  toast.className = isError ? "error" : "";
  toast.classList.remove("hidden");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.add("hidden"), 3500);
}

// Haversine distance (metres) between two lat/lon points
function distanceTo(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const φ1 = lat1 * Math.PI / 180, φ2 = lat2 * Math.PI / 180;
  const Δφ = (lat2 - lat1) * Math.PI / 180;
  const Δλ = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(Δφ/2)**2 + Math.cos(φ1)*Math.cos(φ2)*Math.sin(Δλ/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function formatDistance(m) {
  return m < 1000 ? `${Math.round(m)}m` : `${(m / 1000).toFixed(1)}km`;
}

// ── Fetch & render cycle ──────────────────────────────────────────────────────
async function search() {
  if (map.getZoom() < MIN_SEARCH_ZOOM) {
    showToast("Zoom in more to search for businesses.");
    return;
  }
  searchAreaBtn.classList.add("hidden");
  showLoading();

  // Capture map centre for distance display
  const centre = map.getCenter();
  state.lat = centre.lat;
  state.lon = centre.lng;

  try {
    const lb = map.getBounds();
    const bounds = {
      south: lb.getSouth(),
      west:  lb.getWest(),
      north: lb.getNorth(),
      east:  lb.getEast(),
    };
    state.allResults = await fetchNearby(bounds);
    applyFilter();
  } catch (err) {
    console.error(err);
    showToast("Couldn't reach Overpass API. Try again in a moment.", true);
  } finally {
    hideLoading();
  }
}

// ── Client-side filter ────────────────────────────────────────────────────────
function applyFilter() {
  state.results = state.category === "all"
    ? state.allResults
    : state.allResults.filter(b => b.category === state.category);
  renderResults(state.results);
  renderMarkers(state.results);
}

// ── Results list ──────────────────────────────────────────────────────────────
function renderResults(businesses) {
  resultsCount.textContent = businesses.length;
  resultsList.innerHTML = "";

  if (businesses.length === 0) {
    resultsList.innerHTML = `
      <li class="results-empty">
        <strong>NOTHING FOUND</strong>
        Try a larger radius or a different category.
      </li>`;
    return;
  }

  const fragment = document.createDocumentFragment();

  businesses.forEach(biz => {
    const dist = (state.lat && state.lon)
      ? distanceTo(state.lat, state.lon, biz.lat, biz.lon)
      : null;

    const li = document.createElement("li");
    li.className = "result-item";
    li.dataset.id = biz.id;
    li.innerHTML = `
      <div class="result-name">${escapeHtml(biz.name)}</div>
      <div class="result-meta">
        <span class="result-tag">${escapeHtml(biz.type.replace(/_/g, " "))}</span>
        ${dist !== null ? `<span class="result-distance">${formatDistance(dist)}</span>` : ""}
      </div>`;

    li.addEventListener("click", () => {
      // Deactivate previous
      document.querySelectorAll(".result-item.active").forEach(el => el.classList.remove("active"));
      li.classList.add("active");
      setActiveMarker(biz.id);
    });

    fragment.appendChild(li);
  });

  resultsList.appendChild(fragment);
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

// ── Geolocation ───────────────────────────────────────────────────────────────
function geolocate() {
  if (!navigator.geolocation) {
    showToast("Geolocation not supported by your browser.", true);
    return;
  }

  showLoading("Getting your location…");

  navigator.geolocation.getCurrentPosition(
    pos => {
      state.lat = pos.coords.latitude;
      state.lon = pos.coords.longitude;
      suppressMoveSearch = true;
      flyTo(state.lat, state.lon);
      map.once('moveend', search);
    },
    err => {
      hideLoading();
      showToast("Location access denied. Search for a place above.", true);
    },
    { timeout: 10000, enableHighAccuracy: true }
  );
}

// ── Place search (Nominatim) ──────────────────────────────────────────────────
let searchDebounce;

async function searchPlace(query) {
  if (!query.trim()) return;

  showLoading("Searching for " + query + "…");

  try {
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=1`;
    const res  = await fetch(url, { headers: { "Accept-Language": "en" } });
    const data = await res.json();

    if (!data.length) {
      hideLoading();
      showToast(`No places found for "${query}"`, true);
      return;
    }

    const place = data[0];
    state.lat = parseFloat(place.lat);
    state.lon = parseFloat(place.lon);
    locationInput.value = place.display_name.split(",").slice(0, 2).join(", ");
    suppressMoveSearch = true;
    flyTo(state.lat, state.lon);
    map.once('moveend', search);
  } catch (err) {
    hideLoading();
    showToast("Place search failed. Check your connection.", true);
  }
}

// ── Event listeners ───────────────────────────────────────────────────────────

// Locate button
locateBtn.addEventListener("click", geolocate);

// Search input — search on Enter
locationInput.addEventListener("keydown", e => {
  if (e.key === "Enter") {
    clearTimeout(searchDebounce);
    searchPlace(locationInput.value);
  }
});

// Category chips — filter client-side from cached results, no re-fetch
chips.forEach(chip => {
  chip.addEventListener("click", () => {
    chips.forEach(c => c.classList.remove("active"));
    chip.classList.add("active");
    state.category = chip.dataset.category;
    applyFilter();
  });
});

// Map click — clear the place label (moveend will handle the search)
map.on("click", () => {
  locationInput.value = "";
});

// Map pan/zoom — auto-search if cached, otherwise reveal "Search this area" button
map.on("moveend", () => {
  if (suppressMoveSearch) {
    suppressMoveSearch = false;
    return;
  }
  if (!state.lat) return;   // app not yet initialised
  if (map.getZoom() < MIN_SEARCH_ZOOM) {
    searchAreaBtn.classList.add("hidden");
    return;
  }

  const lb = map.getBounds();
  const bounds = { south: lb.getSouth(), west: lb.getWest(), north: lb.getNorth(), east: lb.getEast() };
  if (hasCached(bounds)) {
    search();
  } else {
    searchAreaBtn.classList.remove("hidden");
  }
});

// "Search this area" button — search around current map centre on demand
searchAreaBtn.addEventListener("click", () => {
  const centre = map.getCenter();
  state.lat = centre.lat;
  state.lon = centre.lng;
  search();
});

// ── Boot ──────────────────────────────────────────────────────────────────────
// Try to geolocate automatically on load
window.addEventListener("load", () => {
  // Short delay to let map render first
  setTimeout(geolocate, 400);
});
