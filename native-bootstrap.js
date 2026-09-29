(function () {
  const capacitor = window.Capacitor;
  if (!capacitor || !capacitor.isNativePlatform || !capacitor.isNativePlatform()) return;
  const apiOrigin = 'https://now-app-production-6e12.up.railway.app';
  window.NOW_PUBLIC_URL = apiOrigin;
  window.NOW_GET_POSITION = async function () {
    const geo = capacitor.Plugins && capacitor.Plugins.Geolocation;
    if (!geo) throw new Error('Native location unavailable');
    await geo.requestPermissions();
    return geo.getCurrentPosition({ enableHighAccuracy: true, timeout: 10000, maximumAge: 120000 });
  };
  const originalFetch = window.fetch.bind(window);
  window.fetch = function (input, init) {
    if (typeof input === 'string' && /^\/(api\/|app-config(?:[/?#]|$)|health(?:[/?#]|$))/.test(input)) {
      input = apiOrigin + input;
    } else if (input instanceof Request) {
      const url = new URL(input.url, location.href);
      if (url.origin === location.origin && /^\/(api\/|app-config(?:[/?#]|$)|health(?:[/?#]|$))/.test(url.pathname)) {
        input = new Request(apiOrigin + url.pathname + url.search, input);
      }
    }
    return originalFetch(input, init);
  };
})();
