import { Purchases, PRODUCT_CATEGORY } from '@revenuecat/purchases-capacitor';

const capacitor = window.Capacitor;
const platform = capacitor?.getPlatform?.();
const key = window.NOW_RC_PUBLIC_KEYS?.[platform];
if (capacitor?.isNativePlatform?.() && key) {
  const products = { now_plus: 'now_plus_monthly', now_business: 'now_business_monthly', listing_boost: 'listing_boost' };
  const api = window.NOW_PUBLIC_URL;
  let configured;
  let signedInId;
  async function ready() {
    if (!configured) configured = Purchases.configure({ apiKey: key });
    await configured;
    const token = localStorage.getItem('nowToken');
    if (!token) throw new Error('Sign in to NOW first');
    const response = await fetch('/api/me', { headers: { Authorization: 'Bearer ' + token } });
    if (!response.ok) throw new Error('Sign in to NOW first');
    const { user } = await response.json();
    const id = 'now-user-' + user.id;
    if (signedInId !== id) { await Purchases.logIn({ appUserID: id }); signedInId = id; }
    const config = await fetch('/app-config').then(r => r.json());
    if (!config.storeBilling) throw new Error('Store purchases are not available yet');
    return token;
  }
  async function verify(token, listingId) {
    const endpoint = listingId ? '/api/me/store/boost' : '/api/me/store/sync';
    for (let attempt = 0; attempt < 3; attempt++) {
      const response = await fetch(endpoint, { method: 'POST', headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' }, body: listingId ? JSON.stringify({ listing_id: listingId }) : '{}' });
      if (response.ok) { await window.syncNowPlan?.(); if (document.getElementById('you')?.classList.contains('active')) await window.loadAccount?.(); return; }
      if (attempt < 2) await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1)));
    }
    throw new Error('The store completed the purchase, but NOW has not verified it. Use Restore purchases or contact support.');
  }
  function inform(error) {
    if (error?.userCancelled) return;
    window.alert(error?.message || 'Store purchase is temporarily unavailable.');
  }
  window.NowNativeBilling = {
    async logout() { if (!configured) return; try { await configured; await Purchases.logOut(); signedInId = undefined; } catch (_) {} },
    async sync() { try { const token = await ready(); await verify(token); } catch (_) { /* Keep the last verified, unexpired server state. */ } },
    async purchase(product, listingId) {
      try {
        const token = await ready();
        const id = products[product];
        if (!id || (product === 'listing_boost' && !listingId)) throw new Error('Choose a listing to Boost');
        const type = product === 'listing_boost' ? PRODUCT_CATEGORY.NON_SUBSCRIPTION : PRODUCT_CATEGORY.SUBSCRIPTION;
        const { products: available } = await Purchases.getProducts({ productIdentifiers: [id], type });
        const storeProduct = available.find(item => item.identifier === id);
        if (!storeProduct) throw new Error('This product is not available in the store');
        await Purchases.purchaseStoreProduct({ product: storeProduct });
        await verify(token, listingId);
      } catch (error) { inform(error); }
    },
    async restore() {
      const token = await ready();
      await Purchases.restorePurchases();
      await verify(token);
    }
  };
  window.addEventListener('load', () => setTimeout(() => window.NowNativeBilling.sync(), 1000));
  document.addEventListener('visibilitychange', () => { if (!document.hidden) window.NowNativeBilling.sync(); });
  setInterval(() => window.NowNativeBilling.sync(), 5 * 60 * 1000);
}
