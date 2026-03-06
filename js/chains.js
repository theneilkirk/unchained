/**
 * chains.js — Known chain / franchise names to filter out.
 *
 * Matching is case-insensitive, partial-match against the OSM `name` tag.
 * Add freely. Err on the side of inclusion — a false positive (hiding a
 * genuine indie with a chain-sounding name) is unlikely but can be
 * overridden by the user later if we add a "show anyway" toggle.
 *
 * Organised loosely by sector for readability.
 */

const CHAINS = new Set([
  // ── Coffee ──────────────────────────────────────────
  "starbucks", "costa", "cafe nero", "caffe nero", "pret", "pret a manger",
  "greggs", "paul", "patisserie valerie", "boston tea party",
  "the coffee house", "coffee #1",

  // ── Fast Food / QSR ─────────────────────────────────
  "mcdonald's", "mcdonalds", "burger king", "kfc", "subway", "domino's",
  "dominoes", "pizza hut", "papa john's", "nando's", "nandos",
  "five guys", "shake shack", "leon", "wagamama", "itsu",
  "yo sushi", "yo! sushi", "wasabi", "tortilla", "chipotle",
  "taco bell", "wendys", "wendy's", "tim hortons",

  // ── Casual Dining ───────────────────────────────────
  "harvester", "toby carvery", "beefeater", "brewers fayre",
  "miller and carter", "miller & carter", "frankie and benny's",
  "frankie & benny's", "chiquito", "bella italia", "ask italian",
  "zizzi", "prezzo", "coast to coast", "red's true bbq",
  "the oak tree", "hungry horse", "the crown carveries",

  // ── Pubs (managed) ──────────────────────────────────
  "wetherspoons", "wetherspoon", "j.d. wetherspoon", "jd wetherspoon",
  "greene king", "marstons", "marston's", "ember inns",
  "vintage inns", "sizzling pubs", "nicholson's", "nicholsons",
  "punch taverns", "ei group",

  // ── Retail — Grocery ────────────────────────────────
  "tesco", "sainsbury's", "sainsburys", "asda", "morrisons", "waitrose",
  "marks and spencer", "m&s", "marks & spencer", "iceland",
  "aldi", "lidl", "co-op", "co op", "cooperative", "the co-operative",
  "spar", "londis", "budgens", "costcutter", "premier",

  // ── Retail — Fashion / General ──────────────────────
  "h&m", "zara", "primark", "uniqlo", "next", "gap", "topshop",
  "river island", "new look", "dorothy perkins", "burton",
  "bonmarché", "peacocks", "tk maxx", "t.k. maxx", "the works",
  "waterstones", "w h smith", "whsmith", "wh smith",
  "boots", "superdrug", "lloyds pharmacy", "lloydspharmacy",

  // ── Retail — DIY / Tech ─────────────────────────────
  "b&q", "homebase", "screwfix", "toolstation", "wickes",
  "currys", "pc world", "maplin", "apple store",

  // ── Health & Wellbeing ──────────────────────────────
  "anytime fitness", "pure gym", "puregym", "the gym", "gym group",
  "david lloyd", "nuffield health", "village gym", "bannatyne",
  "snap fitness", "curves",

  // ── Hair & Beauty ───────────────────────────────────
  "supercuts", "toni & guy", "toni and guy", "great clips",
  "rush", "regis", "headmasters",

  // ── Banks / Finance ─────────────────────────────────
  "barclays", "lloyds", "hsbc", "natwest", "santander", "halifax",
  "nationwide", "tsb", "metro bank", "monzo", "starling",

  // ── Petrol / Convenience ────────────────────────────
  "bp", "shell", "esso", "texaco", "jet", "total", "gulf",

  // ── Hotels ──────────────────────────────────────────
  "premier inn", "travelodge", "holiday inn", "ibis", "novotel",
  "hilton", "marriott", "doubletree", "crowne plaza", "radisson",

  // ── Other Services ──────────────────────────────────
  "specsavers", "vision express", "optical express",
  "kwik fit", "halfords", "euro car parts",
  "ernest jones", "h.samuel", "h samuel", "goldsmiths",
  "card factory", "clinton cards", "the entertainer",
  "early learning centre", "smyths", "the range",
]);

/**
 * Returns true if the given name appears to be a chain.
 * @param {string} name
 * @returns {boolean}
 */
function isChain(name) {
  if (!name) return false;
  const lower = name.toLowerCase().trim();
  for (const chain of CHAINS) {
    if (lower === chain || lower.startsWith(chain + " ") || lower.includes(chain)) {
      return true;
    }
  }
  return false;
}
