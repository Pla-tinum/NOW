# NOW — Global Real-Life Network

Production: https://now-app-production-6e12.up.railway.app

NOW connects real-world needs and opportunities: Earn, Help, People, Rides, Marketplace and Share. The production web app is served by Node.js and PostgreSQL on Railway.

## Release baseline

- App version: 1.0.0
- Store products: `now_plus_monthly` (59 NOK/month), `now_business_monthly` (150 NOK/month), `listing_boost` (19 NOK one-time)
- Store billing is fail-closed until `STORE_BILLING_ENABLED=true`; the web app never simulates a successful paid purchase.
- Ads are fail-closed until `ADS_ENABLED=true`. NOW Plus and NOW Business are configured as ad-free entitlements.
- AdMob stays in test mode until production unit IDs and store apps are ready.
- Privacy: `/privacy`
- Terms: `/terms`
- Account deletion: available in YOU and backed by `DELETE /api/me/account`
- Health: `/health`
- Native configuration: `/app-config`

## Required external release setup

Google Play and Apple products must use the IDs above. Native shells should expose `window.NowNativeBilling.purchase(product)` and `window.NowNativeBilling.restore()` to the web layer, then verify store transactions server-side before granting entitlements. Do not enable `STORE_BILLING_ENABLED` until verification is implemented and tested.

For ads, keep `ADS_TEST_MODE=true` during development. Production requires the AdMob app/unit IDs in Railway and store-compliant consent/privacy handling before `ADS_ENABLED=true`.

## Local run

`npm ci`
`npm start`

Node.js 18+ is required. Explore uses locally served Leaflet 1.9 and OpenStreetMap tiles. Location is requested only through user action/settings and can be disabled.

## Pre-submission checklist

Test on physical Android and iPhone: signup/login, language, geolocation denial/allow, HOME search, every category, Explore, Create, Needed NOW, Available NOW, listing detail, profile, direct chat, Community, job lifecycle, review, referral deep link, Boost, plan screen, restore purchases, account deletion, Privacy/Terms, offline/API failure states, light/dark theme, and store sandbox purchases. Verify production ads only after test ads pass.