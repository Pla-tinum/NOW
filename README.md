# NOW — Global Real-Life Network

Production: https://now-app-production-6e12.up.railway.app

NOW connects real-world needs and opportunities: Earn, Help, People, Rides, Marketplace and Share. The production web app is served by Node.js and PostgreSQL on Railway.

## Release baseline

- App version: 1.0.0
- Store products: `now_plus_monthly` (59 NOK/month), `now_business_monthly` (130 NOK/month), `listing_boost` (19 NOK consumable)
- Store billing is fail-closed until `STORE_BILLING_ENABLED=true`; the web app never simulates a successful paid purchase.
- Ads are fail-closed until `ADS_ENABLED=true`. NOW Plus and NOW Business are configured as ad-free entitlements.
- AdMob stays in test mode until production unit IDs and store apps are ready.
- Privacy: `/privacy`
- Terms: `/terms`
- Public support: `/support` and deletion instructions: `/delete-account`
- Account deletion: available in YOU and backed by `DELETE /api/me/account`
- Health: `/health`
- Native configuration: `/app-config`

## Content safety

Public listings, profiles, community posts and reviews are checked using OpenAI Moderations. If the check is unavailable, new public content is rejected until it recovers. Reports are queued in PostgreSQL. Set a strong `NOW_MODERATOR_TOKEN` in Railway; an authorized operator can GET `/api/admin/reports` with `Authorization: Bearer <token>` and POST `/api/admin/reports/:id/resolve` with `{ "action": "hide" }` or `{ "action": "dismiss" }`. A human must review the queue and respond to reports.

## Required external release setup

Google Play and Apple products must use the IDs above. Android and iOS Capacitor projects are in `android/` and `ios/`, with app ID `com.valentynshemeiko.now` and version 1.0.0. The web files are packaged locally; native API requests go to the Railway production origin. `npm run sync:mobile` rebuilds these assets and synchronizes native plugins.

The native purchase bridge uses RevenueCat StoreKit / Play Billing SDKs and the server verifies subscription products and unused Boost transactions with the RevenueCat REST API before granting access. Set `REVENUECAT_ANDROID_PUBLIC_KEY` and `REVENUECAT_IOS_PUBLIC_KEY` when packaging, and `REVENUECAT_SECRET_API_KEY` only in Railway. Enable `STORE_BILLING_ENABLED=true` only after the products, store connection and sandbox tests are complete. No secret key belongs in the client. The price on the plan screen is indicative; the store's localized price is authoritative. Purchases, renewal, refund and restore still require live sandbox verification before submission.

The legal pages name Valentyn Shemeiko and publish `aloe.vera225@yahoo.com` as support. Review the final store SDK data flows and retention language before submission. Store metadata and product copy are drafted in `store/metadata.md`; the public `/privacy`, `/support` and `/delete-account` pages work without a separate domain.

AdMob banner integration and UMP consent are in the native build. Demo app/unit IDs are used until the AdMob account exists; production builds need `ADMOB_ANDROID_APP_ID`, `ADMOB_IOS_APP_ID`, `ADMOB_ANDROID_BANNER_UNIT_ID` and `ADMOB_IOS_BANNER_UNIT_ID` when running `npm run sync:mobile`. Keep `ADS_TEST_MODE=true` during device testing; enable `ADS_ENABLED=true` on Railway only after the AdMob privacy message, real IDs, disclosures and test ads are verified. Plus and Business suppress ads.

## Local run

`npm ci`
`npm start`
`npm test` (public smoke checks with `TEST_URL` pointing to a running service)
`npm run test:e2e` (creates and then deletes two disposable accounts; use only on an authorized test or production environment)
`npm run test:moderation` (checks public content and report protection)
`npm run test:billing` (checks server-side purchase rules without store credentials)
`npm run test:browser` (Playwright: desktop Chromium/WebKit and emulated Android/iPhone; run `npx playwright install chromium webkit` first)
`MOD_TOKEN=... npm run test:admin` (checks report review and irreversible moderator hide; fetch the token privately from Railway)
`npm run check:store` (requires real public SDK and AdMob IDs; does not replace signing or device tests)

Node.js 22+ is required for Capacitor 8. Explore uses locally served Leaflet 1.9 and OpenStreetMap tiles. Location is requested only through user action/settings and can be disabled.

## Pre-submission checklist

Test on physical Android and iPhone: signup/login, language, geolocation denial/allow, HOME search, every category, Explore, Create, Needed NOW, Available NOW, listing detail, profile, direct chat, Community, job lifecycle, review, referral deep link, Boost, plan screen, restore purchases, account deletion, Privacy/Terms, offline/API failure states, light/dark theme, and store sandbox purchases. Verify production ads only after test ads pass.
