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

// Prevents moveend from triggering a search during programmatic pan/fly calls.
// Stores a timestamp — all moveend events before that time are ignored.
var suppressMoveSearchUntil = 0;

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
const sidebar        = document.getElementById("sidebar");
const searchToggleBtn = document.getElementById("search-toggle-btn");
const filterToggleBtn = document.getElementById("filter-toggle-btn");
const filterDot       = document.getElementById("filter-dot");

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
    state.allResults = await fetchNearby(bounds, (found, total) => {
      showLoading(`Finding independents… ${found} / ${total}`);
    });
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
  renderMarkers(state.results);
  updateVisibleList(); // show only businesses within the current viewport
}

// Filter state.results to the current map bounds and render the sidebar list.
// Keeps businesses sorted by distance from the search/location centre point.
function updateVisibleList() {
  const bounds  = map.getBounds();
  const visible = state.results.filter(biz => bounds.contains(L.latLng(biz.lat, biz.lon)));

  if (state.lat && state.lon) {
    visible.sort((a, b) =>
      distanceTo(state.lat, state.lon, a.lat, a.lon) -
      distanceTo(state.lat, state.lon, b.lat, b.lon)
    );
  }

  // Distinguish "panned away from results" from "genuinely no results here"
  const hiddenByBounds = state.results.length > 0 && visible.length === 0;
  renderResults(visible, hiddenByBounds);
}

// ── Results list ──────────────────────────────────────────────────────────────
function renderResults(businesses, hiddenByBounds = false) {
  resultsCount.textContent = businesses.length;
  resultsList.innerHTML = "";

  if (businesses.length === 0) {
    if (hiddenByBounds) {
      // Results exist but none are inside the current viewport
      resultsList.innerHTML = `
        <li class="results-empty">
          <span>No businesses in view — pan the map or click <em>Search this area</em>.</span>
        </li>`;
    } else {
      // No independent businesses found in this area at all
      resultsList.innerHTML = `
        <li class="results-empty">
          <strong>NOTHING FOUND</strong>
          <span>No independent businesses in this area.</span>
          <span class="results-empty-cta">Know one that's missing?<br>
            <a href="https://www.openstreetmap.org" target="_blank" rel="noopener">Add it to OpenStreetMap</a>
            — free, and anyone can contribute.
          </span>
        </li>`;
    }
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
      suppressMoveSearchUntil = Date.now() + 1000; // panTo fires moveend (sometimes twice on mobile)
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
      suppressMoveSearchUntil = Date.now() + 1500; // flyTo animation is 1.2 s
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
    suppressMoveSearchUntil = Date.now() + 1500; // flyTo animation is 1.2 s
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
    filterDot?.classList.toggle("visible", state.category !== "all");
  });
});

// Map click — clear the place label (moveend will handle the search)
map.on("click", () => {
  locationInput.value = "";
});

// Map pan/zoom — auto-search if cached, otherwise update visible list + reveal button
map.on("moveend", () => {
  if (Date.now() < suppressMoveSearchUntil) return;
  if (!state.lat) return;   // app not yet initialised
  if (map.getZoom() < MIN_SEARCH_ZOOM) {
    searchAreaBtn.classList.add("hidden");
    return;
  }

  const lb = map.getBounds();
  const bounds = { south: lb.getSouth(), west: lb.getWest(), north: lb.getNorth(), east: lb.getEast() };
  if (hasCached(bounds)) {
    search(); // re-search from cache; applyFilter → updateVisibleList handles the list
  } else {
    updateVisibleList(); // filter existing results to the new viewport without re-fetching
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

// ── Mobile sidebar collapse toggle ────────────────────────────────────────────
const sidebarHandle = document.getElementById("sidebar-handle");
if (sidebarHandle) {
  sidebarHandle.addEventListener("click", () => {
    sidebar.classList.toggle("collapsed");
  });
}

// ── Mobile search / filter panel toggles ──────────────────────────────────────
if (searchToggleBtn) {
  searchToggleBtn.addEventListener("click", () => {
    const opening = !sidebar.classList.contains("search-open");
    sidebar.classList.remove("filter-open");
    sidebar.classList.toggle("search-open", opening);
    if (opening) locationInput.focus();
  });
}

if (filterToggleBtn) {
  filterToggleBtn.addEventListener("click", () => {
    const opening = !sidebar.classList.contains("filter-open");
    sidebar.classList.remove("search-open");
    sidebar.classList.toggle("filter-open", opening);
  });
}

// ── Clear cache ───────────────────────────────────────────────────────────────
document.getElementById("clear-cache-link")?.addEventListener("click", e => {
  e.preventDefault();
  clearCache();
  showToast("Cache cleared — next search will fetch fresh data.");
});

// ── About overlay ─────────────────────────────────────────────────────────────
const aboutBtn     = document.getElementById("about-btn");
const aboutOverlay = document.getElementById("about-overlay");
const aboutClose   = document.getElementById("about-close");

function openAbout() {
  aboutOverlay.classList.add("open");
  aboutClose.focus();
}

function closeAbout() {
  aboutOverlay.classList.remove("open");
}

aboutBtn?.addEventListener("click", openAbout);
aboutClose?.addEventListener("click", closeAbout);

// Close on backdrop click (but not inner panel click)
aboutOverlay?.addEventListener("click", e => {
  if (e.target === aboutOverlay) closeAbout();
});

// Close on Escape
document.addEventListener("keydown", e => {
  if (e.key === "Escape" && aboutOverlay.classList.contains("open")) closeAbout();
});

// ── Stat ticker ───────────────────────────────────────────────────────────────
const STATS = [
  "Caffè Nero hasn't paid a penny in UK corporation tax since 2007. Over £2 billion in sales. Your local café pays its taxes. Apparently that's optional if you're big enough.",
  "For every £1 you spend at an independent, up to 70p stays in your community. At a chain, as little as 5p does. The rest leaves town and doesn't look back.",
  "Amazon collected £27 billion from UK customers in 2023 and paid £18.7 million in corporation tax. That's roughly 7p for every £100 of sales. Your local bookshop pays more.",
  "A chain opens. It knows your postcode. It will never know your name.",
  "The Tesco CEO earned £9.93 million last year. His average checkout worker earned £23,000. That's 430 workers' wages going to one person — every single year.",
  "37 independent shops closed every day in the UK last year. Not 37 Tescos. Not 37 Starbucks. 37 places where someone knew your usual.",
  "Starbucks made £149 million gross profit in the UK and paid £7.2 million in tax. The following year they paid nothing at all. Your local coffee shop doesn't have that option.",
  "A chain's loyalty card knows everything about you. The chain itself has never heard of you.",
  "£10 spent at a local food shop generates £25 for the local economy. The same £10 at a supermarket generates £14. Same money. Different town.",
  "McDonald's may have avoided £295 million in UK tax over a decade. In the same period, they claimed £872 million in government Covid support. Heads they win, tails we pay.",
  "The average FTSE 100 CEO earned the UK median salary before lunchtime on the 6th of January. The year had barely started. Most people's hadn't.",
  "Independents don't have a head office. The decision-maker serves behind the counter.",
  "90% of McDonald's UK staff are on zero-hours contracts. They can't plan their week. McDonald's plans its profit margins to the penny.",
  "84% of the shops that closed last year were independents. Chains mostly survived. That's not a coincidence — it's a business model.",
  "Spending locally isn't a lifestyle upgrade. It's the difference between a high street and a car park waiting to happen.",
  "The Sainsbury's CEO earned £5.18 million last year. His average worker earned £21,635. He earned their annual salary in roughly four days.",
  "A billion pounds is a thousand million. Tesco made two of them last year. Your corner shop made enough to restock the shelves and call it a good month.",
  "Chains measure success by how much they can extract from a place. Independents measure it by whether they can stay.",
  "80% of independent shops were actively involved in their community last year. Not because someone in a boardroom decided it was good for the brand. Because they live there.",
  "Amazon avoided an estimated £575 million in UK corporation tax in 2024 alone. That's enough to fund roughly 16,000 nurses for a year. Prime delivery: next day. Tax: never.",
];

// Fisher-Yates shuffle
function shuffleArray(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

(function initStatTicker() {
  const ticker   = document.getElementById("stat-ticker");
  const statText = document.getElementById("stat-text");
  const dismiss  = document.getElementById("stat-dismiss");

  if (!ticker || !statText || !dismiss) return;

  let stats      = shuffleArray(STATS);
  let statIndex  = 0;
  let showTimer, hideTimer, nextTimer;
  let dismissed  = false;

  function showNextStat() {
    if (dismissed) return;

    statText.textContent = stats[statIndex];
    statIndex = (statIndex + 1) % stats.length;
    if (statIndex === 0) stats = shuffleArray(STATS); // re-shuffle each cycle

    ticker.classList.add("visible");

    hideTimer = setTimeout(() => {
      ticker.classList.remove("visible");
      nextTimer = setTimeout(showNextStat, 15500); // 0.5s fade + 15s gap
    }, 7000);
  }

  dismiss.addEventListener("click", () => {
    dismissed = true;
    clearTimeout(showTimer);
    clearTimeout(hideTimer);
    clearTimeout(nextTimer);
    ticker.classList.remove("visible");
    setTimeout(() => { ticker.style.display = "none"; }, 500);
  });

  // First stat appears 5s after page load
  showTimer = setTimeout(showNextStat, 5000);
})();

// ── Boot ──────────────────────────────────────────────────────────────────────
// Try to geolocate automatically on load
window.addEventListener("load", () => {
  // Short delay to let map render first
  setTimeout(geolocate, 400);

  // Show About overlay once, 15s after first visit
  if (!localStorage.getItem("uc:about-seen")) {
    setTimeout(() => {
      aboutOverlay.classList.add("open");
      localStorage.setItem("uc:about-seen", "1");
    }, 15000);
  }
});
