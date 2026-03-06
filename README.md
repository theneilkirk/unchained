# Unchained 🔓

> Find independent businesses near you. No chains, no franchises — just the real local economy.

Built on [OpenStreetMap](https://www.openstreetmap.org) + [Overpass API](https://overpass-api.de). Zero tracking, zero cookies, no backend.

---

## Features

- 📍 **Geolocate** or search any place
- 🗂️ **Category filters** — Food & Drink, Retail, Services, Health, Arts & Culture
- 📏 **Adjustable radius** — 200m to 2km
- 🚫 **Chain filter** — known chains suppressed via `js/chains.js`
- 🗺️ Interactive map with clickable markers
- 📱 Mobile-responsive

---

## Development

No build step required. Open `index.html` directly, or serve locally:

```bash
npx serve .
# or
python3 -m http.server 8080
```

---

## Deploying to GitHub Pages

1. Push to a GitHub repo
2. Settings → Pages → Source: `main` branch / root
3. Done — available at `https://<username>.github.io/<repo>/`

---

## Extending the chain list

Edit `js/chains.js`. The `CHAINS` set is case-insensitive and does substring matching, so `"tesco"` will match "Tesco Extra", "Tesco Express", etc.

---

## Roadmap / ideas

- [ ] User-submitted chain additions
- [ ] "Show anyway" toggle for false positives
- [ ] Opening hours awareness (hide closed, highlight open now)
- [ ] Save favourites (localStorage)
- [ ] Share a location link
- [ ] PWA / offline support

---

## Credits

- Map tiles: [Stadia Maps](https://www.stadiamaps.com/) (Alidade Smooth Dark)
- Map library: [Leaflet](https://leafletjs.com/)
- Data: [OpenStreetMap contributors](https://www.openstreetmap.org/copyright)
- Query: [Overpass API](https://overpass-api.de)
- Place search: [Nominatim](https://nominatim.org)
