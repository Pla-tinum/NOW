const http = require("http");
const fs = require("fs");
const path = require("path");
const { Pool } = require("pg");
const crypto = require("crypto");

const PORT = process.env.PORT || 3000;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const AI_MODEL = process.env.OPENAI_MODEL || "gpt-5.6-luna";
const pool = process.env.DATABASE_URL ? new Pool({connectionString:process.env.DATABASE_URL}) : null;
const COUNTRY_SOURCES={
 NO:{currency:"NOK",sources:{Marketplace:["finn.no","tise.com"],Cars:["finn.no"],Housing:["finn.no","hybel.no"],Jobs:["finn.no","arbeidsplassen.nav.no"],Travel:["finn.no","entur.no"]}},
 SE:{currency:"SEK",sources:{Marketplace:["blocket.se","tradera.com"],Cars:["blocket.se","wayke.se"],Housing:["hemnet.se","booli.se"],Jobs:["arbetsformedlingen.se","jobbsafari.se"]}},
 DK:{currency:"DKK",sources:{Marketplace:["dba.dk"],Cars:["bilbasen.dk"],Housing:["boligsiden.dk"],Jobs:["jobindex.dk"]}},
 FI:{currency:"EUR",sources:{Marketplace:["tori.fi","huuto.net"],Cars:["nettiauto.com"],Housing:["etuovi.com","oikotie.fi"],Jobs:["tyomarkkinatori.fi"]}},
 ES:{currency:"EUR",sources:{Marketplace:["wallapop.com","milanuncios.com"],Cars:["coches.net","milanuncios.com"],Housing:["idealista.com","fotocasa.es"],Jobs:["infojobs.net","indeed.com"]}},
 DE:{currency:"EUR",sources:{Marketplace:["kleinanzeigen.de"],Cars:["mobile.de","autoscout24.de"],Housing:["immobilienscout24.de","immowelt.de"],Jobs:["stepstone.de","arbeitsagentur.de"]}},
 FR:{currency:"EUR",sources:{Marketplace:["leboncoin.fr"],Cars:["lacentrale.fr","leboncoin.fr"],Housing:["seloger.com","leboncoin.fr"],Jobs:["francetravail.fr","hellowork.com"]}},
 IT:{currency:"EUR",sources:{Marketplace:["subito.it"],Cars:["autoscout24.it","subito.it"],Housing:["immobiliare.it","idealista.it"],Jobs:["infojobs.it","indeed.com"]}},
 NL:{currency:"EUR",sources:{Marketplace:["marktplaats.nl"],Cars:["gaspedaal.nl","autoscout24.nl"],Housing:["funda.nl"],Jobs:["werk.nl","indeed.com"]}},
 GB:{currency:"GBP",sources:{Marketplace:["gumtree.com","ebay.co.uk"],Cars:["autotrader.co.uk"],Housing:["rightmove.co.uk","zoopla.co.uk"],Jobs:["reed.co.uk","indeed.com"]}},
 US:{currency:"USD",sources:{Marketplace:["craigslist.org","ebay.com"],Cars:["autotrader.com","cars.com"],Housing:["zillow.com","realtor.com"],Jobs:["indeed.com","linkedin.com"]}},
 CA:{currency:"CAD",sources:{Marketplace:["kijiji.ca","ebay.ca"],Cars:["autotrader.ca"],Housing:["realtor.ca"],Jobs:["jobbank.gc.ca","indeed.com"]}},
 AU:{currency:"AUD",sources:{Marketplace:["gumtree.com.au","ebay.com.au"],Cars:["carsales.com.au"],Housing:["realestate.com.au","domain.com.au"],Jobs:["seek.com.au","indeed.com"]}},
 PL:{currency:"PLN",sources:{Marketplace:["olx.pl","allegro.pl"],Cars:["otomoto.pl"],Housing:["otodom.pl"],Jobs:["pracuj.pl","praca.pl"]}},
 UA:{currency:"UAH",sources:{Marketplace:["olx.ua","prom.ua"],Cars:["auto.ria.com"],Housing:["dom.ria.com","lun.ua"],Jobs:["work.ua","robota.ua"]}}
}
async function initDb(){
 if(!pool)return;
 await pool.query("CREATE TABLE IF NOT EXISTS users(id BIGSERIAL PRIMARY KEY, device_id TEXT UNIQUE NOT NULL, display_name TEXT NOT NULL DEFAULT 'NOW User', language TEXT DEFAULT 'en', created_at TIMESTAMPTZ DEFAULT NOW())");
 await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS email TEXT UNIQUE"); await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash TEXT"); await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS session_token TEXT UNIQUE"); await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW()");
 await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS bio TEXT DEFAULT ''"); await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS city TEXT DEFAULT ''");
 await pool.query("CREATE TABLE IF NOT EXISTS listings(id BIGSERIAL PRIMARY KEY, user_id BIGINT REFERENCES users(id), kind TEXT NOT NULL DEFAULT 'need', title TEXT NOT NULL, description TEXT NOT NULL, category TEXT, location TEXT, price TEXT, language TEXT DEFAULT 'en', status TEXT DEFAULT 'active', created_at TIMESTAMPTZ DEFAULT NOW())"); await pool.query("CREATE TABLE IF NOT EXISTS jobs(id BIGSERIAL PRIMARY KEY, listing_id BIGINT REFERENCES listings(id), owner_id BIGINT REFERENCES users(id), worker_id BIGINT REFERENCES users(id), status TEXT DEFAULT 'applied', created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW())"); await pool.query("CREATE TABLE IF NOT EXISTS reviews(id BIGSERIAL PRIMARY KEY, job_id BIGINT REFERENCES jobs(id), author_id BIGINT REFERENCES users(id), target_id BIGINT REFERENCES users(id), rating INT CHECK(rating BETWEEN 1 AND 5), text TEXT DEFAULT '', created_at TIMESTAMPTZ DEFAULT NOW())");
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
  if (req.method === "GET" && pathname === "/api/sources") {
    const country=String(new URL(req.url,"http://localhost").searchParams.get("country")||"NO").toUpperCase();
    const config=COUNTRY_SOURCES[country]||{currency:null,sources:{}};
    res.writeHead(200,{"Content-Type":"application/json; charset=utf-8","Cache-Control":"public, max-age=3600"});
    res.end(JSON.stringify({country,...config})); return;
  }
  if (req.method === "POST" && (pathname === "/api/auth/register" || pathname === "/api/auth/login")) {
    let raw=""; req.on("data",c=>raw+=c); req.on("end",async()=>{try{if(!pool)throw new Error("Database unavailable");const b=JSON.parse(raw||"{}");const email=String(b.email||"").trim().toLowerCase().slice(0,200),password=String(b.password||""),name=String(b.name||"NOW User").trim().slice(0,100);if(!email.includes("@")||password.length<6)throw new Error("Invalid email or password");const hash=crypto.scryptSync(password,"now-v1",64).toString("hex"),token=crypto.randomBytes(32).toString("hex");let q;if(pathname.endsWith("register")){q=await pool.query("INSERT INTO users(device_id,email,password_hash,display_name,language,session_token) VALUES($1,$2,$3,$4,$5,$6) RETURNING id,email,display_name,language",["acct-"+crypto.randomUUID(),email,hash,name||"NOW User",String(b.language||"en").slice(0,10),token])}else{q=await pool.query("UPDATE users SET session_token=$1,updated_at=NOW() WHERE email=$2 AND password_hash=$3 RETURNING id,email,display_name,language",[token,email,hash]);if(!q.rows.length)throw new Error("Wrong email or password")}res.writeHead(200,{"Content-Type":"application/json; charset=utf-8","Cache-Control":"no-store"});res.end(JSON.stringify({user:q.rows[0],token}))}catch(e){res.writeHead(400,{"Content-Type":"application/json; charset=utf-8"});res.end(JSON.stringify({error:e.message}))}});return;
  }
  if (req.method === "GET" && pathname === "/api/me") {
    try{if(!pool)throw new Error();const token=String(req.headers.authorization||"").replace(/^Bearer\s+/i,"");const q=await pool.query("SELECT id,email,display_name,language,bio,city,created_at FROM users WHERE session_token=$1",[token]);if(!q.rows.length)throw new Error();const l=await pool.query("SELECT * FROM listings WHERE user_id=$1 ORDER BY created_at DESC",[q.rows[0].id]);res.writeHead(200,{"Content-Type":"application/json; charset=utf-8","Cache-Control":"no-store"});res.end(JSON.stringify({user:q.rows[0],listings:l.rows}))}catch(e){res.writeHead(401,{"Content-Type":"application/json; charset=utf-8"});res.end(JSON.stringify({error:"Unauthorized"}))}return;
  }
  if (pathname === "/api/me/profile" && req.method === "POST") {let raw="";req.on("data",c=>raw+=c);req.on("end",async()=>{try{const token=String(req.headers.authorization||"").replace(/^Bearer\s+/i,""),b=JSON.parse(raw||"{}");const q=await pool.query("UPDATE users SET display_name=$1,bio=$2,city=$3,updated_at=NOW() WHERE session_token=$4 RETURNING id,email,display_name,language,bio,city",[String(b.name||"").slice(0,100),String(b.bio||"").slice(0,600),String(b.city||"").slice(0,120),token]);if(!q.rows.length)throw new Error();res.writeHead(200,{"Content-Type":"application/json"});res.end(JSON.stringify({user:q.rows[0]}))}catch(e){res.writeHead(401);res.end()}});return}
  if (pathname.startsWith("/api/me/listings/") && req.method === "POST") {let raw="";req.on("data",c=>raw+=c);req.on("end",async()=>{try{const token=String(req.headers.authorization||"").replace(/^Bearer\s+/i,""),id=pathname.split("/").pop(),b=JSON.parse(raw||"{}");const q=await pool.query("UPDATE listings l SET title=COALESCE($1,l.title),description=COALESCE($2,l.description),price=COALESCE($3,l.price),location=COALESCE($4,l.location),status=COALESCE($5,l.status) FROM users u WHERE l.id=$6 AND l.user_id=u.id AND u.session_token=$7 RETURNING l.*",[b.title??null,b.description??null,b.price??null,b.location??null,b.status??null,id,token]);if(!q.rows.length)throw new Error();res.writeHead(200,{"Content-Type":"application/json"});res.end(JSON.stringify({listing:q.rows[0]}))}catch(e){res.writeHead(404);res.end()}});return}
  if (pathname === "/api/jobs/apply" && req.method === "POST") {let raw="";req.on("data",c=>raw+=c);req.on("end",async()=>{try{const token=String(req.headers.authorization||"").replace(/^Bearer\s+/i,""),b=JSON.parse(raw||"{}");const me=await pool.query("SELECT id FROM users WHERE session_token=$1",[token]);if(!me.rows.length)throw new Error("Unauthorized");const l=await pool.query("SELECT id,user_id FROM listings WHERE id=$1 AND status='active'",[b.listing_id]);if(!l.rows.length||l.rows[0].user_id===me.rows[0].id)throw new Error("Unavailable");const q=await pool.query("INSERT INTO jobs(listing_id,owner_id,worker_id,status) VALUES($1,$2,$3,'applied') RETURNING *",[l.rows[0].id,l.rows[0].user_id,me.rows[0].id]);res.writeHead(200,{"Content-Type":"application/json"});res.end(JSON.stringify({job:q.rows[0]}))}catch(e){res.writeHead(400,{"Content-Type":"application/json"});res.end(JSON.stringify({error:e.message}))}});return}
  if (pathname.startsWith("/api/jobs/") && req.method === "POST") {let raw="";req.on("data",c=>raw+=c);req.on("end",async()=>{try{const token=String(req.headers.authorization||"").replace(/^Bearer\s+/i,""),parts=pathname.split("/"),id=parts[3],action=parts[4],me=(await pool.query("SELECT id FROM users WHERE session_token=$1",[token])).rows[0];if(!me)throw new Error("Unauthorized");const job=(await pool.query("SELECT * FROM jobs WHERE id=$1",[id])).rows[0];if(!job)throw new Error("Not found");const allowed={accept:['applied','accepted'],start:['accepted','in_progress'],complete:['in_progress','completed'],confirm:['completed','confirmed'],cancel:['applied','cancelled']};if(!allowed[action]||job.status!==allowed[action][0])throw new Error("Invalid status");if(['accept','confirm'].includes(action)&&job.owner_id!==me.id)throw new Error("Forbidden");if(['start','complete'].includes(action)&&job.worker_id!==me.id)throw new Error("Forbidden");if(action==='cancel'&&job.worker_id!==me.id&&job.owner_id!==me.id)throw new Error("Forbidden");const q=await pool.query("UPDATE jobs SET status=$1,updated_at=NOW() WHERE id=$2 RETURNING *",[allowed[action][1],id]);res.writeHead(200,{"Content-Type":"application/json"});res.end(JSON.stringify({job:q.rows[0]}))}catch(e){res.writeHead(400,{"Content-Type":"application/json"});res.end(JSON.stringify({error:e.message}))}});return}
  if (pathname === "/api/reviews" && req.method === "POST") {let raw="";req.on("data",c=>raw+=c);req.on("end",async()=>{try{const token=String(req.headers.authorization||"").replace(/^Bearer\s+/i,""),b=JSON.parse(raw||"{}"),me=(await pool.query("SELECT id FROM users WHERE session_token=$1",[token])).rows[0];const j=(await pool.query("SELECT * FROM jobs WHERE id=$1 AND status='confirmed'",[b.job_id])).rows[0];if(!me||!j||(me.id!==j.owner_id&&me.id!==j.worker_id))throw new Error("Forbidden");const target=me.id===j.owner_id?j.worker_id:j.owner_id;const q=await pool.query("INSERT INTO reviews(job_id,author_id,target_id,rating,text) VALUES($1,$2,$3,$4,$5) RETURNING *",[j.id,me.id,target,Math.max(1,Math.min(5,Number(b.rating)||5)),String(b.text||"").slice(0,1000)]);res.writeHead(200,{"Content-Type":"application/json"});res.end(JSON.stringify({review:q.rows[0]}))}catch(e){res.writeHead(400,{"Content-Type":"application/json"});res.end(JSON.stringify({error:e.message}))}});return}
  if (pathname === "/api/me/jobs" && req.method === "GET") {try{const token=String(req.headers.authorization||"").replace(/^Bearer\s+/i,"");const q=await pool.query("SELECT j.*,l.title,l.price,l.location,CASE WHEN j.owner_id=u.id THEN 'owner' ELSE 'worker' END AS role FROM jobs j JOIN listings l ON l.id=j.listing_id JOIN users u ON (j.owner_id=u.id OR j.worker_id=u.id) WHERE u.session_token=$1 ORDER BY j.updated_at DESC",[token]);res.writeHead(200,{"Content-Type":"application/json"});res.end(JSON.stringify({jobs:q.rows}))}catch(e){res.writeHead(401);res.end()}return}
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
      const api=await fetch("https://api.openai.com/v1/responses",{method:"POST",headers:{Authorization:"Bearer "+OPENAI_API_KEY,"Content-Type":"application/json"},body:JSON.stringify({model:AI_MODEL,instructions:instructions,input:message,reasoning:{effort:"none"},max_output_tokens:1800})});
      const data=await api.json(); if(!api.ok) throw new Error(data.error?.message||"OpenAI failed");
      const out=data.output_text||(data.output||[]).flatMap(x=>x.content||[]).map(x=>x.text||"").join(""); if(!out.trim()) throw new Error("OpenAI returned no text"); const m=out.match(/\{[\s\S]*\}/); const result=JSON.parse(m?m[0]:out);
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
