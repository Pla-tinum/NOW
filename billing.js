const PRODUCTS = Object.freeze({ plus: 'now_plus_monthly', business: 'now_business_monthly', boost: 'listing_boost' });

function activeSubscription(subscriber, product, now = Date.now()) {
  const entry = subscriber?.subscriptions?.[product];
  const expires = Math.max(Date.parse(entry?.grace_period_expires_date || '') || 0, Date.parse(entry?.expires_date || '') || 0);
  if (entry?.refunded_at || !Number.isFinite(expires) || expires <= now) return null;
  const entitlement = product === PRODUCTS.plus ? 'now_plus' : 'now_business';
  const assigned = subscriber?.entitlements?.[entitlement];
  const entitledUntil = Math.max(Date.parse(assigned?.grace_period_expires_date || '') || 0, Date.parse(assigned?.expires_date || '') || 0);
  if (!assigned || assigned.product_identifier !== product || entitledUntil <= now) return null;
  return { expiresAt: new Date(expires), purchaseDate: entry.purchase_date || null,
    paid: entry.period_type === 'normal' && !['promotional','rc_billing'].includes(entry.store), product,
    transactionId: entry.store_transaction_id || null };
}

function planFromSubscriber(subscriber, now = Date.now()) {
  const business = activeSubscription(subscriber, PRODUCTS.business, now);
  const plus = activeSubscription(subscriber, PRODUCTS.plus, now);
  const current = business || plus;
  if (!current) return { plan: 'free', expiresAt: null, periodKey: null };
  // Latest paid renewal date is the period identity. A sync or app reinstall cannot mint a second allowance.
  const periodKey = current.paid && Number.isFinite(Date.parse(current.purchaseDate || ''))
    ? current.product + ':' + new Date(current.purchaseDate).toISOString() : null;
  return { plan: business ? 'now_business' : 'now_plus', expiresAt: current.expiresAt, periodKey };
}

function boostPurchases(subscriber) {
  return (subscriber?.non_subscriptions?.[PRODUCTS.boost] || [])
    .filter(p => typeof p.id === 'string' && p.id.length > 0 && !p.refunded_at && Number.isFinite(Date.parse(p.purchase_date)))
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
