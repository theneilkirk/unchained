/**
 * overpass.js — Overpass API integration.
 *
 * Builds QL queries for common business types and fetches from
 * the public Overpass API. Results are filtered through chains.js
 * and normalised into a consistent shape.
 */

const OVERPASS_ENDPOINTS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
];

// ── Category → OSM tag mappings ─────────────────────────────────────────────
const CATEGORY_TAGS = {
  food: [
    ["amenity", "restaurant"],
    ["amenity", "cafe"],
    ["amenity", "bar"],
    ["amenity", "pub"],
    ["amenity", "fast_food"],
    ["amenity", "ice_cream"],
    ["amenity", "bakery"],
    ["shop",    "bakery"],
    ["shop",    "deli"],
    ["shop",    "greengrocer"],
    ["shop",    "butcher"],
    ["shop",    "fishmonger"],
    ["shop",    "wine"],
    ["shop",    "alcohol"],
    ["shop",    "farm"],
  ],
  retail: [
    ["shop", "clothes"],
    ["shop", "shoes"],
    ["shop", "books"],
    ["shop", "music"],
    ["shop", "gift"],
    ["shop", "toys"],
    ["shop", "florist"],
    ["shop", "jewellery"],
    ["shop", "antiques"],
    ["shop", "second_hand"],
    ["shop", "vintage"],
    ["shop", "art"],
    ["shop", "craft"],
    ["shop", "stationery"],
    ["shop", "hardware"],
    ["shop", "bicycle"],
    ["shop", "sports"],
    ["shop", "outdoor"],
    ["shop", "pet"],
    ["shop", "garden_centre"],
    ["shop", "convenience"],
    ["shop", "general"],
  ],
  services: [
    ["amenity", "car_wash"],
    ["amenity", "dry_cleaning"],
    ["amenity", "laundry"],
    ["shop",    "hairdresser"],
    ["shop",    "barber"],
    ["shop",    "beauty"],
    ["shop",    "nail_salon"],
    ["shop",    "tattoo"],
    ["shop",    "optician"],
    ["shop",    "tailor"],
    ["shop",    "photo"],
    ["shop",    "printing"],
    ["shop",    "repair"],
    ["shop",    "mobile_phone"],
    ["shop",    "electronics"],
    ["shop",    "computer"],
    ["amenity", "post_office"],
    ["craft",   "*"],
  ],
  health: [
    ["amenity", "pharmacy"],
    ["amenity", "dentist"],
    ["amenity", "doctors"],
    ["amenity", "clinic"],
    ["amenity", "physiotherapist"],
    ["healthcare", "*"],
    ["shop",    "massage"],
    ["shop",    "herbalist"],
    ["shop",    "nutrition_supplements"],
    ["leisure", "fitness_centre"],
    ["leisure", "yoga"],
    ["leisure", "martial_arts"],
  ],
  arts: [
    ["amenity", "arts_centre"],
    ["amenity", "cinema"],
    ["amenity", "theatre"],
    ["amenity", "nightclub"],
    ["amenity", "music_venue"],
    ["amenity", "studio"],
    ["shop",    "art"],
    ["shop",    "music"],
    ["shop",    "musical_instrument"],
    ["tourism", "gallery"],
    ["tourism", "museum"],
    ["leisure", "dance"],
  ],
};

// Build an "all" set from all categories
const ALL_TAGS = Object.values(CATEGORY_TAGS).flat();

/**
 * Build an Overpass QL query string.
 * @param {{south: number, west: number, north: number, east: number}} bounds
 * @param {string} category "all" | "food" | "retail" | "services" | "health" | "arts"
 * @returns {string}
 */
function buildQuery(bounds, category = "all") {
  const { south, west, north, east } = bounds;
  const bbox = `${south},${west},${north},${east}`;
  const tags = category === "all" ? ALL_TAGS : (CATEGORY_TAGS[category] || ALL_TAGS);

  // Build a union of node/way for each tag pair
  const tagFilters = tags.map(([key, val]) => {
    const valStr = val === "*" ? "" : `="${val}"`;
    return [
      `node["${key}"${valStr}](${bbox});`,
      `way["${key}"${valStr}](${bbox});`,
    ].join("\n    ");
  }).join("\n    ");

  return `
[out:json][timeout:25];
(
  ${tagFilters}
);
out center tags;
`.trim();
}

/**
 * Determine broad category from OSM tags.
 * @param {Object} tags  OSM tag object
 * @returns {string}
 */
function categoriseFromTags(tags) {
  const amenity = tags.amenity || "";
  const shop    = tags.shop    || "";
  const leisure = tags.leisure || "";
  const tourism = tags.tourism || "";

  const foodAmenities = new Set(["restaurant","cafe","bar","pub","fast_food","ice_cream","bakery"]);
  const foodShops     = new Set(["bakery","deli","greengrocer","butcher","fishmonger","wine","alcohol","farm"]);
  const healthAmenities = new Set(["pharmacy","dentist","doctors","clinic","physiotherapist"]);
  const healthLeisure   = new Set(["fitness_centre","yoga","martial_arts"]);
  const artsCulture     = new Set(["arts_centre","cinema","theatre","nightclub","music_venue","studio","gallery","museum"]);
  const servicesAmenity = new Set(["car_wash","dry_cleaning","laundry","post_office"]);
  const servicesShop    = new Set(["hairdresser","barber","beauty","nail_salon","tattoo","optician","tailor","photo","printing","repair","mobile_phone","electronics","computer"]);

  if (foodAmenities.has(amenity) || foodShops.has(shop)) return "food";
  if (healthAmenities.has(amenity) || tags.healthcare || healthLeisure.has(leisure) || shop === "massage") return "health";
  if (artsCulture.has(amenity) || tourism === "gallery" || tourism === "museum") return "arts";
  if (servicesAmenity.has(amenity) || servicesShop.has(shop) || tags.craft) return "services";
  if (shop) return "retail";
  return "other";
}

/**
 * Normalise a raw OSM element into a clean business object.
 * @param {Object} element  raw Overpass element
 * @returns {Object|null}   null if should be excluded
 */
function normalise(element) {
  const tags = element.tags || {};
  const name = tags.name || tags["name:en"] || null;

  if (!name) return null;
  if (isChain(name)) return null;

  // Coordinates — nodes have lat/lon directly; ways expose center
  const lat = element.lat ?? element.center?.lat;
  const lon = element.lon ?? element.center?.lon;
  if (!lat || !lon) return null;

  return {
    id:       element.id,
    name,
    lat,
    lon,
    category: categoriseFromTags(tags),
    type:     tags.amenity || tags.shop || tags.leisure || tags.tourism || tags.craft || "business",
    address:  [
      tags["addr:housenumber"],
      tags["addr:street"],
      tags["addr:city"],
    ].filter(Boolean).join(", ") || null,
    phone:    tags.phone || tags["contact:phone"] || null,
    website:  tags.website || tags["contact:website"] || null,
    opening:  tags.opening_hours || null,
    wheelchair: tags.wheelchair || null,
  };
}

// ── Result cache (localStorage, 24 h TTL) ────────────────────────────────────
const CACHE_TTL = 86_400_000;
const snap = v => Math.round(v / 0.02) * 0.02;

function _cacheKey({ south, west, north, east }) {
  return `uc:${snap(south)},${snap(west)},${snap(north)},${snap(east)}`;
}

function _cacheGet(key) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const { ts, results } = JSON.parse(raw);
    if (Date.now() - ts > CACHE_TTL) { localStorage.removeItem(key); return null; }
    return results;
  } catch { return null; }
}

function _cacheSet(key, results) {
  // Defer to idle time so the UI re-renders before the expensive stringify+write
  const write = () => {
    for (const k of Object.keys(localStorage)) {
      if (!k.startsWith("uc:")) continue;
      try {
        const { ts } = JSON.parse(localStorage.getItem(k));
        if (Date.now() - ts > CACHE_TTL) localStorage.removeItem(k);
      } catch { localStorage.removeItem(k); }
    }
    try {
      localStorage.setItem(key, JSON.stringify({ ts: Date.now(), results }));
    } catch { /* storage full or unavailable */ }
  };
  (typeof requestIdleCallback !== "undefined" ? requestIdleCallback : f => setTimeout(f, 0))(write);
}

function hasCached(bounds) {
  return _cacheGet(_cacheKey(bounds)) !== null;
}

/**
 * Fetch independents within the given map bounds from Overpass.
 * Always fetches all categories — callers filter client-side.
 * Results are cached in localStorage for 24 hours.
 * Tries each endpoint in order, falling back on error.
 * @param {{south: number, west: number, north: number, east: number}} bounds
 * @returns {Promise<Object[]>}
 */
async function fetchNearby(bounds) {
  const key = _cacheKey(bounds);
  const cached = _cacheGet(key);
  if (cached) return cached;

  const query = buildQuery(bounds, "all");
  const body  = "data=" + encodeURIComponent(query);

  let lastErr;
  for (const endpoint of OVERPASS_ENDPOINTS) {
    try {
      const response = await fetch(endpoint, {
        method:  "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body,
      });
      if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);

      const data = await response.json();

      // Normalise, deduplicate by id
      const seen = new Set();
      const results = [];
      for (const el of data.elements) {
        if (seen.has(el.id)) continue;
        seen.add(el.id);
        const biz = normalise(el);
        if (biz) results.push(biz);
      }

      results.sort((a, b) => a.name.localeCompare(b.name));
      _cacheSet(key, results);
      return results;
    } catch (err) {
      lastErr = err;
    }
  }

  throw lastErr;
}
