const PRODUCTS = Object.freeze({ plus: 'now_plus_monthly', business: 'now_business_monthly', boost: 'listing_boost' });

function activeSubscription(subscriber, product, now = Date.now()) {
  const entry = subscriber?.subscriptions?.[product];
  const expires = Date.parse(entry?.grace_period_expires_date || entry?.expires_date || '');
  return !entry?.refunded_at && Number.isFinite(expires) && expires > now ? new Date(expires) : null;
}

function planFromSubscriber(subscriber, now = Date.now()) {
  const business = activeSubscription(subscriber, PRODUCTS.business, now);
  const plus = activeSubscription(subscriber, PRODUCTS.plus, now);
  if (business) return { plan: 'now_business', expiresAt: business };
  if (plus) return { plan: 'now_plus', expiresAt: plus };
  return { plan: 'free', expiresAt: null };
}

function boostPurchases(subscriber) {
  return (subscriber?.non_subscriptions?.[PRODUCTS.boost] || [])
    .filter(p => typeof p.id === 'string' && p.id.length > 0 && Number.isFinite(Date.parse(p.purchase_date)))
    .sort((a, b) => Date.parse(b.purchase_date) - Date.parse(a.purchase_date));
}

async function fetchSubscriber(userId, key = process.env.REVENUECAT_SECRET_API_KEY, fetcher = fetch) {
  if (!key) throw new Error('Store verification is unavailable');
  const response = await fetcher('https://api.revenuecat.com/v1/subscribers/' + encodeURIComponent('now-user-' + userId), {
    headers: { Authorization: 'Bearer ' + key, Accept: 'application/json' },
    signal: AbortSignal.timeout(10000)
  });
  if (!response.ok) throw new Error('Store verification failed');
  const body = await response.json();
  if (!body?.subscriber) throw new Error('Store verification failed');
  return body.subscriber;
}

module.exports = { PRODUCTS, planFromSubscriber, boostPurchases, fetchSubscriber };
