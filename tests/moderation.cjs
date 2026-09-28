const test=require('node:test');
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const base=process.env.TEST_URL||'http://127.0.0.1:3000';
async function call(path,method='GET',token,body){const r=await fetch(new URL(path,base),{method,signal:AbortSignal.timeout(30000),headers:{'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},body:body===undefined?undefined:JSON.stringify(body)});return {status:r.status,data:await r.json().catch(()=>({}))}}
test('public content is screened, reports are protected and deletion removes content',{timeout:200000},async()=>{
 const suffix=crypto.randomBytes(7).toString('hex');let token;
 try{
  const registered=await call('/api/auth/register','POST',undefined,{name:'NOW QA',email:`now-moderation-${suffix}@example.invalid`,password:crypto.randomBytes(20).toString('hex')});
  assert.equal(registered.status,200,JSON.stringify(registered.data));token=registered.data.token;
  const listing=await call('/api/listings','POST',token,{title:'NOW moderation QA '+suffix,description:'Disposable content safety test',category:'Help',country:'NO'});
  assert.equal(listing.status,201,JSON.stringify(listing.data));
  const id=listing.data.listing.id;
  assert.equal((await call('/api/reports','POST',token,{listing_id:id,reason:'QA moderation report'})).status,201);
  assert.equal((await call('/api/admin/reports')).status,401);
  assert.equal((await call('/api/me/account','DELETE',token)).status,200);token=null;
  assert.ok(!(await call('/api/listings')).data.listings.some(x=>x.id===id));
 }finally{if(token)await call('/api/me/account','DELETE',token)}
});
