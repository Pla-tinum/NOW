const DEFAULT_MAP_CENTER = [20, 0];
const categories = {
  Earn: ['💰', '#7944e5', 'Ask about this gig'],
  Help: ['🤝', '#147955', 'Offer to help'],
  People: ['👥', '#b33c87', 'Ask to join'],
  Rides: ['🚗', '#286dc2', 'Ask about this ride'],
  Marketplace: ['🛍', '#956018', 'Ask about this item']
};
let opportunities = [];
window.NOW_OPPORTUNITIES = opportunities;
let exploreMap, opportunityLayer, userMarker, accuracyCircle, userPosition;
let selectedCategory = 'All';
function initExplore() {
  if (exploreMap) { exploreMap.invalidateSize(); return; }
  if (!window.L) {
    document.getElementById('mapStatus').textContent = uiText('Map could not load. Browse nearby listings below or reload to retry.','Карта не загрузилась. Посмотрите предложения ниже или обновите страницу.');
    renderOpportunities();
    return;
  }
  exploreMap = L.map('map', {scrollWheelZoom: false}).setView(DEFAULT_MAP_CENTER, 2);
  // Safari's address bar and orientation can resize the map without navigation.
  if (window.ResizeObserver) new ResizeObserver(() => {
    if (document.getElementById('map').clientWidth) exploreMap.invalidateSize({pan:false});
  }).observe(document.getElementById('map'));
  const tiles = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {subdomains:'abc',
    maxZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
  }).addTo(exploreMap);
  tiles.on('tileerror', () => {
    document.getElementById('mapStatus').textContent = uiText('Some map tiles could not load. Check your connection.','Часть карты не загрузилась. Проверьте подключение.');
  });
  tiles.on('load', () => {
    const failed = [...tiles.getContainer().querySelectorAll('img')].some(tile => !tile.naturalWidth);
    if (!failed) document.getElementById('mapStatus').textContent = '';
  });
  opportunityLayer = L.layerGroup().addTo(exploreMap);
  loadExploreOpportunities();
}
function distanceKm(opportunity){const [lat,lng]=userPosition||DEFAULT_MAP_CENTER,rad=Math.PI/180,a=Math.sin((opportunity.lat-lat)*rad/2)**2+Math.cos(lat*rad)*Math.cos(opportunity.lat*rad)*Math.sin((opportunity.lng-lng)*rad/2)**2;return 6371*2*Math.atan2(Math.sqrt(a),Math.sqrt(Math.max(0,1-a)))}
function distanceText(opportunity) {
  const [lat, lng] = userPosition || DEFAULT_MAP_CENTER;
  const rad = Math.PI / 180;
  const a = Math.sin((opportunity.lat-lat)*rad/2)**2 + Math.cos(lat*rad)*Math.cos(opportunity.lat*rad)*Math.sin((opportunity.lng-lng)*rad/2)**2;
  const km = 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(Math.max(0, 1-a)));
  return `${km.toFixed(1)} km`;
}
function openOpportunity(opportunity) { if(typeof openListingDetail==='function') openListingDetail(opportunity); }
async function loadExploreOpportunities(){try{const p=userPosition||DEFAULT_MAP_CENTER,country=(localStorage.getItem('nowCountry')||'NO').toUpperCase(),qs=new URLSearchParams({country,category:selectedCategory,q:'',lat:p[0],lng:p[1]});const r=await fetch('/api/search?'+qs);if(!r.ok)throw new Error('search');const d=await r.json(),live=(d.listings||[]).filter(x=>Number.isFinite(Number(x.latitude))&&Number.isFinite(Number(x.longitude))).map(x=>({...x,lat:Number(x.latitude),lng:Number(x.longitude),area:x.location||'',description:x.description||''}));opportunities=live;window.NOW_OPPORTUNITIES=opportunities}catch(e){opportunities=[]}renderOpportunities()}
function renderOpportunities() {
  if (opportunityLayer) opportunityLayer.clearLayers();
  const visible = opportunities.filter(item => selectedCategory === 'All' || item.category === selectedCategory).filter(item=>{const d=distanceKm(item);return !Number.isFinite(d)||d<=100;});
  document.getElementById('opportunityCount').textContent = `⚡ ${visible.length} ${typeof uiText==='function'?uiText('opportunities','предложений'):'opportunities'}`;
  const list = document.getElementById('opportunityList');
  list.replaceChildren();
  visible.forEach(item => {
    const [symbol, color] = categories[item.category]||['•','#7944e5',uiText('View','Открыть')];
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
function resetExploreMap(){if(exploreMap)exploreMap.stop().setView(DEFAULT_MAP_CENTER,2,{animate:false,reset:true});loadExploreOpportunities()}
function locateUser() {
  const status = document.getElementById('locationStatus');
  const button = document.getElementById('locate');
  const fallback = message => {
    button.disabled = false;
    userPosition = null;
    if (userMarker) { userMarker.remove(); userMarker = null; }
    if (accuracyCircle) { accuracyCircle.remove(); accuracyCircle = null; }
    status.textContent = message+' '+uiText('You can still browse available listings.','Вы всё равно можете просматривать доступные предложения.');
    renderOpportunities();
  };
  if (!navigator.geolocation || !window.isSecureContext) {
    fallback(uiText('Location is unavailable in this browser.','Геолокация недоступна в этом браузере.'));
    return;
  }
  button.disabled = true;
  status.textContent = uiText('Finding your location…','Определяем ваше местоположение…');
  navigator.geolocation.getCurrentPosition(position => {
    button.disabled = false;
    const {latitude, longitude, accuracy} = position.coords;
    userPosition = [latitude, longitude];
    status.textContent = uiText('Your location','Ваше местоположение')+' · ±'+Math.round(accuracy)+' m';
    if (exploreMap) {
      if (userMarker) userMarker.remove();
      if (accuracyCircle) accuracyCircle.remove();
      accuracyCircle = L.circle(userPosition, {radius:accuracy, color:'#65c8ff', weight:1, fillOpacity:.08, interactive:false}).addTo(exploreMap);
      userMarker = L.marker(userPosition, {icon:L.divIcon({className:'user-dot',iconSize:[20,20]}), title:uiText('Your location','Ваше местоположение'), alt:uiText('Your location','Ваше местоположение'), zIndexOffset:1000}).addTo(exploreMap);
      exploreMap.stop().setView(userPosition, 14, {animate:false, reset:true});
    }
    loadExploreOpportunities();
  }, error => fallback(error.code === 1 ? uiText('Location permission denied.','Доступ к геолокации запрещён.') : error.code === 3 ? uiText('Location request timed out.','Время определения местоположения истекло.') : uiText('Could not determine your location.','Не удалось определить местоположение.')),
  {enableHighAccuracy:true, timeout:10000, maximumAge:60000});
}
