const http = require("http");
const fs = require("fs");
const path = require("path");
const { Pool } = require("pg");

const PORT = process.env.PORT || 3000;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const AI_MODEL = process.env.OPENAI_MODEL || "gpt-5.6-luna";
const pool = process.env.DATABASE_URL ? new Pool({connectionString:process.env.DATABASE_URL}) : null;
async function initDb(){
 if(!pool)return;
 await pool.query("CREATE TABLE IF NOT EXISTS users(id BIGSERIAL PRIMARY KEY, device_id TEXT UNIQUE NOT NULL, display_name TEXT NOT NULL DEFAULT 'NOW User', language TEXT DEFAULT 'en', created_at TIMESTAMPTZ DEFAULT NOW())");
 await pool.query("CREATE TABLE IF NOT EXISTS listings(id BIGSERIAL PRIMARY KEY, user_id BIGINT REFERENCES users(id), kind TEXT NOT NULL DEFAULT 'need', title TEXT NOT NULL, description TEXT NOT NULL, category TEXT, location TEXT, price TEXT, language TEXT DEFAULT 'en', status TEXT DEFAULT 'active', created_at TIMESTAMPTZ DEFAULT NOW())");
}
initDb().catch(e=>console.error("DB init:",e.message));
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
  if (req.method === "GET" && pathname === "/api/listings") {
    try { if(!pool) throw new Error("Database unavailable"); const q=await pool.query("SELECT l.*,u.display_name FROM listings l LEFT JOIN users u ON u.id=l.user_id WHERE l.status='active' ORDER BY l.created_at DESC LIMIT 50"); res.writeHead(200,{"Content-Type":"application/json; charset=utf-8"}); res.end(JSON.stringify({listings:q.rows})); }
    catch(e){res.writeHead(503,{"Content-Type":"application/json; charset=utf-8"});res.end(JSON.stringify({error:"Database unavailable"}));} return;
  }
  if (req.method === "POST" && pathname === "/api/listings") {
    let raw=""; req.on("data",c=>raw+=c); req.on("end",async()=>{try{
      if(!pool)throw new Error("Database unavailable"); const b=JSON.parse(raw||"{}"); const device=String(b.deviceId||"").slice(0,100),title=String(b.title||"").slice(0,160),description=String(b.description||"").slice(0,4000); if(!device||!title||!description)throw new Error("Missing fields");
      const uq=await pool.query("INSERT INTO users(device_id,language) VALUES($1,$2) ON CONFLICT(device_id) DO UPDATE SET language=EXCLUDED.language RETURNING id",[device,String(b.language||"en").slice(0,10)]);
      const q=await pool.query("INSERT INTO listings(user_id,kind,title,description,category,location,price,language) VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *",[uq.rows[0].id,String(b.kind||"need").slice(0,30),title,description,String(b.category||"Other").slice(0,60),String(b.location||"").slice(0,160),String(b.price||"").slice(0,80),String(b.language||"en").slice(0,10)]);
      res.writeHead(201,{"Content-Type":"application/json; charset=utf-8"});res.end(JSON.stringify({listing:q.rows[0]}));
    }catch(e){res.writeHead(400,{"Content-Type":"application/json; charset=utf-8"});res.end(JSON.stringify({error:e.message}))}}); return;
  }
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
