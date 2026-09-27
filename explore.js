/* Demo data only: no listings or location coordinates are sent to NOW. */
const BERGEN = [60.3774, 5.3301];
const categories = {
  Earn: ['💰', '#7944e5', 'Ask about this gig'],
  Help: ['🤝', '#147955', 'Offer to help'],
  People: ['👥', '#b33c87', 'Ask to join'],
  Rides: ['🚗', '#286dc2', 'Ask about this ride'],
  Marketplace: ['🛍', '#956018', 'Ask about this item']
};
const opportunities = [
  ['Earn', 'Evening delivery gig', 60.3901, 5.325, 'Bergen sentrum', '600 NOK', 'Two hours of local bicycle deliveries. Bring your own bike.'],
  ['Earn', 'Furniture assembly', 60.3738, 5.338, 'Kronstad', '700 NOK', 'Help assemble a desk and bookshelf. Tools provided.'],
  ['Help', 'Need help moving a sofa', 60.3781, 5.329, 'Solheimsviken', '450 NOK', 'Two people needed for a sofa move at 18:00. One flight of stairs.'],
  ['Help', 'Help with groceries', 60.3825, 5.3195, 'Møhlenpris', '150 NOK', 'Pick up a small grocery order and deliver it nearby.'],
  ['People', 'Football tonight', 60.3705, 5.347, 'Krohnsminde', 'Free · 5 places', 'Friendly football at 20:00. All skill levels welcome.'],
  ['People', 'Coffee and a language exchange', 60.388, 5.332, 'Nygård', 'Free to join', 'Practice Norwegian and English over coffee. Buy your own drink.'],
  ['Rides', 'Bergen → Voss tomorrow', 60.3894, 5.338, 'Bergen bus station', '150 NOK / seat', 'Leaving at 09:00. Two seats available, with room for a small bag.'],
  ['Rides', 'Share a ride to Flesland', 60.3755, 5.325, 'Danmarks plass', '90 NOK / seat', 'Airport ride at 07:00 tomorrow. One seat and space for luggage.'],
  ['Marketplace', 'City bike looking for a new owner', 60.3851, 5.325, 'Nygårdsparken', '1,200 NOK', 'Used adult city bike with lights and lock. Inspect on collection.'],
  ['Marketplace', 'Small oak coffee table', 60.3802, 5.3365, 'Florida', '350 NOK', 'Good condition, 80 × 50 cm. Local pickup by arrangement.']
].map(([category, title, lat, lng, area, price, description]) => ({category, title, lat, lng, area, price, description}));
let exploreMap, opportunityLayer, userMarker, accuracyCircle, userPosition;
let selectedCategory = 'All';
function initExplore() {
  if (exploreMap) { exploreMap.invalidateSize(); return; }
  if (!window.L) {
    document.getElementById('mapStatus').textContent = 'Map could not load. Browse the demo listings below or reload to retry.';
    renderOpportunities();
    return;
  }
  exploreMap = L.map('map', {scrollWheelZoom: false}).setView(BERGEN, 12);
  // Safari's address bar and orientation can resize the map without navigation.
  if (window.ResizeObserver) new ResizeObserver(() => {
    if (document.getElementById('map').clientWidth) exploreMap.invalidateSize({pan:false});
  }).observe(document.getElementById('map'));
  const tiles = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
  }).addTo(exploreMap);
  tiles.on('tileerror', () => {
    document.getElementById('mapStatus').textContent = 'Some streets could not load. Check your connection; demo listings are still available below.';
  });
  tiles.on('load', () => {
    const failed = [...tiles.getContainer().querySelectorAll('img')].some(tile => !tile.naturalWidth);
    if (!failed) document.getElementById('mapStatus').textContent = '';
  });
  opportunityLayer = L.layerGroup().addTo(exploreMap);
  renderOpportunities();
}
function distanceText(opportunity) {
  const [lat, lng] = userPosition || BERGEN;
  const rad = Math.PI / 180;
  const a = Math.sin((opportunity.lat-lat)*rad/2)**2 + Math.cos(lat*rad)*Math.cos(opportunity.lat*rad)*Math.sin((opportunity.lng-lng)*rad/2)**2;
  const km = 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(Math.max(0, 1-a)));
  return `${km.toFixed(1)} km ${userPosition ? 'from you' : 'from Solheimsviken'}`;
}
function openOpportunity(opportunity) {
  popup(opportunity.title,
    `${opportunity.category} · ${opportunity.area} · ${distanceText(opportunity)} · ${opportunity.price}. ${opportunity.description} Demo listing.`,
    categories[opportunity.category][2], () => {
      closeSheet();
      openCreate(`I'm interested in “${opportunity.title}” in ${opportunity.area}.`);
    });
}
function renderOpportunities() {
  if (opportunityLayer) opportunityLayer.clearLayers();
  const visible = opportunities.filter(item => selectedCategory === 'All' || item.category === selectedCategory);
  document.getElementById('opportunityCount').textContent = `⚡ ${visible.length} ${selectedCategory === 'All' ? '' : selectedCategory + ' '}demo opportunities in Bergen`;
  const list = document.getElementById('opportunityList');
  list.replaceChildren();
  visible.forEach(item => {
    const [symbol, color] = categories[item.category];
    if (opportunityLayer) {
      const icon = L.divIcon({className: 'now-marker', html: `<span class="marker-pin" style="--marker-color:${color}" aria-hidden="true">${symbol}</span>`, iconSize:[44,44], iconAnchor:[22,44]});
      L.marker([item.lat,item.lng], {icon, title: `${item.category}: ${item.title}`, alt: `${item.category}: ${item.title}`, riseOnHover:true})
        .on('click', () => openOpportunity(item)).addTo(opportunityLayer);
    }
    const card = document.createElement('button');
    card.className = 'card opportunity';
    const title = document.createElement('div');
    title.className = 'title';
    title.textContent = `${symbol} ${item.title}`;
    const meta = document.createElement('div');
    meta.className = 'meta';
    meta.textContent = `${item.category} · ${item.area} · ${distanceText(item)} · ${item.price}`;
    card.append(title, meta);
    card.onclick = () => openOpportunity(item);
    list.append(card);
  });
}
document.querySelectorAll('[data-category]').forEach(button => {
  button.addEventListener('click', () => {
    selectedCategory = button.dataset.category;
    document.querySelectorAll('[data-category]').forEach(filter => {
      const active = filter === button;
      filter.classList.toggle('active', active);
      filter.setAttribute('aria-pressed', String(active));
    });
    renderOpportunities();
  });
});
function showBergen() {
  if (exploreMap) exploreMap.stop().setView(BERGEN, 12, {animate:false, reset:true});
}
function locateUser() {
  const status = document.getElementById('locationStatus');
  const button = document.getElementById('locate');
  const fallback = message => {
    button.disabled = false;
    userPosition = null;
    if (userMarker) { userMarker.remove(); userMarker = null; }
    if (accuracyCircle) { accuracyCircle.remove(); accuracyCircle = null; }
    status.textContent = `${message} Showing Solheimsviken · Bergen instead.`;
    showBergen();
    renderOpportunities();
  };
  if (!navigator.geolocation || !window.isSecureContext) {
    fallback('Location is unavailable in this browser.');
    return;
  }
  button.disabled = true;
  status.textContent = 'Finding your location…';
  navigator.geolocation.getCurrentPosition(position => {
    button.disabled = false;
    const {latitude, longitude, accuracy} = position.coords;
    userPosition = [latitude, longitude];
    status.textContent = `Your location · accurate to about ${Math.round(accuracy)} m. Demo opportunities are in Bergen.`;
    if (exploreMap) {
      if (userMarker) userMarker.remove();
      if (accuracyCircle) accuracyCircle.remove();
      accuracyCircle = L.circle(userPosition, {radius:accuracy, color:'#65c8ff', weight:1, fillOpacity:.08, interactive:false}).addTo(exploreMap);
      userMarker = L.marker(userPosition, {icon:L.divIcon({className:'user-dot',iconSize:[20,20]}), title:'Your location', alt:'Your location', zIndexOffset:1000}).addTo(exploreMap);
      exploreMap.stop().setView(userPosition, 14, {animate:false, reset:true});
    }
    renderOpportunities();
  }, error => fallback(error.code === 1 ? 'Location permission denied.' : error.code === 3 ? 'Location request timed out.' : 'Could not determine your location.'),
  {enableHighAccuracy:true, timeout:10000, maximumAge:60000});
}
