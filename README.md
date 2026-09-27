# NOW

Run `npm ci` and `npm start` (Node.js 18+). The server uses `PORT`, defaulting to 3000.

Explore uses locally served Leaflet 1.9 and OpenStreetMap street tiles; no API key is needed. Internet access is required for tiles. Attribution stays visible and normal browser tile caching is preserved; follow the [OpenStreetMap tile policy](https://operations.osmfoundation.org/policies/tiles/) when operating at scale.

Ten clearly labeled demo opportunities cover Earn, Help, People, Rides, and Marketplace around Bergen. Filters update both markers and the accessible list. Marker/list actions prefill Create; these are demo requests, not live bookings or purchases.

Location is requested only after tapping **Use my location**. HTTPS (or localhost) is required. Denied, unavailable, or timed-out requests fall back to Solheimsviken. A successful request shows a position marker and accuracy circle; **Bergen demos** returns to the listings without losing your location. Distances are straight-line estimates. Coordinates are not persisted or sent to the NOW server; the external tile provider receives tile requests for the viewed area.

Browser regression checks: install Playwright separately, then run `NODE_PATH=/path/to/node_modules node tests/explore.cjs` against a running server. Install Chromium and WebKit with Playwright first. These tests exercise phone-sized Chromium and WebKit, category filters, marker actions, navigation, location outcomes, unavailable storage, missing Leaflet, and tile failures. Physical iPhone testing remains useful for device-specific permission prompts and touch gestures.
