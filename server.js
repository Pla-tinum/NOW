const http = require("http");
const fs = require("fs");
const path = require("path");

const PORT = process.env.PORT || 3000;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const AI_MODEL = process.env.OPENAI_MODEL || "gpt-5.6-luna";
// Only expose public assets, never arbitrary project or dependency files.
const routes = {
  "/": ["index.html", "text/html; charset=utf-8"],
  "/index.html": ["index.html", "text/html; charset=utf-8"],
  "/explore.js": ["explore.js", "text/javascript; charset=utf-8"],
  "/vendor/leaflet.js": ["node_modules/leaflet/dist/leaflet.js", "text/javascript; charset=utf-8"],
  "/vendor/leaflet.css": ["node_modules/leaflet/dist/leaflet.css", "text/css; charset=utf-8"]
};
const server = http.createServer(async (req, res) => {
  const pathname = req.url.split("?")[0];
  if (req.method === "POST" && pathname === "/api/ai") {
    let raw=""; req.on("data",c=>raw+=c); req.on("end",async()=>{ try {
      const payload=JSON.parse(raw||"{}"); const message=String(payload.message||"").trim().slice(0,4000); const language=String(payload.language||"").slice(0,20); if(!message||!OPENAI_API_KEY) throw new Error("AI unavailable");
      const instructions="You are NOW AI, action engine for a global real-life network. Return ONLY JSON with keys intent, category, title, summary, location, time, budget, constraints, nextAction, reply. category: Earn, Help, People, Rides, Marketplace, Share, Activity, or Other. Reply in the requested app language when provided, otherwise the user language. Requested app language: "+language+". Never invent real matches.";
      const api=await fetch("https://api.openai.com/v1/responses",{method:"POST",headers:{Authorization:"Bearer "+OPENAI_API_KEY,"Content-Type":"application/json"},body:JSON.stringify({model:AI_MODEL,instructions:instructions,input:message,max_output_tokens:700})});
      const data=await api.json(); if(!api.ok) throw new Error(data.error?.message||"OpenAI failed");
      const out=data.output_text||(data.output||[]).flatMap(x=>x.content||[]).map(x=>x.text||"").join(""); const m=out.match(/\{[\s\S]*\}/); const result=JSON.parse(m?m[0]:out);
      res.writeHead(200,{"Content-Type":"application/json; charset=utf-8","Cache-Control":"no-store"}); res.end(JSON.stringify({ok:true,result}));
    } catch(e){ console.error("AI error:",e.message); res.writeHead(502,{"Content-Type":"application/json; charset=utf-8"}); res.end(JSON.stringify({error:"NOW AI could not process this request"})); }}); return;
  }
  if (!["GET", "HEAD"].includes(req.method)) {
    res.writeHead(405, { Allow: "GET, HEAD" });
    res.end();
    return;
  }
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
