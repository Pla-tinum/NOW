const http = require("http");
const fs = require("fs");
const path = require("path");

const PORT = process.env.PORT || 3000;
// Only expose public assets, never arbitrary project or dependency files.
const routes = {
  "/": ["index.html", "text/html; charset=utf-8"],
  "/index.html": ["index.html", "text/html; charset=utf-8"],
  "/explore.js": ["explore.js", "text/javascript; charset=utf-8"],
  "/vendor/leaflet.js": ["node_modules/leaflet/dist/leaflet.js", "text/javascript; charset=utf-8"],
  "/vendor/leaflet.css": ["node_modules/leaflet/dist/leaflet.css", "text/css; charset=utf-8"]
};
const server = http.createServer((req, res) => {
  if (!["GET", "HEAD"].includes(req.method)) {
    res.writeHead(405, { Allow: "GET, HEAD" });
    res.end();
    return;
  }
  const pathname = req.url.split("?")[0];
  const route = Object.hasOwn(routes, pathname) ? routes[pathname] : null;
  if (!route) {
    res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    res.end(req.method === "HEAD" ? undefined : "Not found");
    return;
  }
  fs.readFile(path.join(__dirname, route[0]), (err, data) => {
    if (err) {
      res.writeHead(500, { "Content-Type": "text/plain; charset=utf-8" });
      res.end(req.method === "HEAD" ? undefined : "NOW failed to load");
      return;
    }
    res.writeHead(200, {
      "Content-Type": route[1],
      "Cache-Control": "no-cache",
      "X-Content-Type-Options": "nosniff"
    });
    res.end(req.method === "HEAD" ? undefined : data);
  });
});
server.listen(PORT, "0.0.0.0", () => {
  console.log(`NOW is running on port ${PORT}`);
});
