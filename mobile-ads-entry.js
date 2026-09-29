import { AdMob, AdmobConsentStatus, BannerAdPosition, BannerAdSize } from '@capacitor-community/admob';

if (window.Capacitor?.isNativePlatform?.()) {
  const platform = window.Capacitor.getPlatform();
  let shown = false;
  let approved = false;
  let initialized = false;
  async function refresh() {
    const config = window.NOW_ADS;
    const unit = window.NOW_AD_UNITS?.[platform];
    const allowed = config?.enabled && unit && window.nowAdsAllowed?.();
    if (!allowed) {
      if (shown) { await AdMob.removeBanner(); shown = false; document.documentElement.classList.remove('native-ad-visible'); }
      return;
    }
    if (!initialized) {
      await AdMob.initialize();
      initialized = true;
      let consent = await AdMob.requestConsentInfo();
      if (consent.isConsentFormAvailable && consent.status === AdmobConsentStatus.REQUIRED) consent = await AdMob.showConsentForm();
      approved = !!consent.canRequestAds;
      const settings = document.getElementById('settingsCard');
      if (settings && !settings.querySelector('#adPrivacyOptions')) {
        const button = document.createElement('button');
        button.id = 'adPrivacyOptions'; button.className = 'filter'; button.textContent = 'Advertising privacy choices';
        button.onclick = () => AdMob.showPrivacyOptionsForm();
        settings.appendChild(button);
      }
      if (!approved) return;
    }
    if (!approved || shown) return;
    await AdMob.showBanner({ adId: unit, adSize: BannerAdSize.BANNER, position: BannerAdPosition.BOTTOM_CENTER, isTesting: !!config.testMode });
    shown = true; document.documentElement.classList.add('native-ad-visible');
    if (!window.nowAdsAllowed?.()) await refresh();
  }
  window.addEventListener('now:plan-updated', () => refresh().catch(() => {}));
  window.addEventListener('load', () => { setInterval(() => refresh().catch(() => {}), 8000); refresh().catch(() => {}); });
}
