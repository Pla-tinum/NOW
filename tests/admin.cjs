const test=require('node:test');
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const base=process.env.TEST_URL||'http://127.0.0.1:3000';
async function call(path,method='GET',token,body){const r=await fetch(new URL(path,base),{method,signal:AbortSignal.timeout(30000),headers:{'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},body:body===undefined?undefined:JSON.stringify(body)});return {status:r.status,data:await r.json().catch(()=>({}))}}
test('moderator can hide a reported listing; owner cannot reactivate it',{timeout:180000},async()=>{
 assert.ok(process.env.MOD_TOKEN,'MOD_TOKEN required');const suffix=crypto.randomBytes(7).toString('hex');let token;
 try{
  const u=await call('/api/auth/register','POST',undefined,{name:'NOW QA',email:`now-admin-${suffix}@example.invalid`,password:crypto.randomBytes(20).toString('hex')});assert.equal(u.status,200,JSON.stringify(u.data));token=u.data.token;
  const l=await call('/api/listings','POST',token,{title:'NOW admin QA '+suffix,description:'Disposable report review test',category:'Help',country:'NO'});assert.equal(l.status,201,JSON.stringify(l.data));const id=l.data.listing.id;
  assert.equal((await call('/api/reports','POST',token,{listing_id:id,reason:'QA report'})).status,201);
  const queue=await call('/api/admin/reports','GET',process.env.MOD_TOKEN);assert.equal(queue.status,200,JSON.stringify(queue.data));const report=queue.data.reports.find(x=>x.listing_id===id);assert.ok(report);
  assert.equal((await call('/api/admin/reports/'+report.id+'/resolve','POST',process.env.MOD_TOKEN,{action:'hide'})).status,200);
  assert.ok(!(await call('/api/listings')).data.listings.some(x=>x.id===id));
  assert.equal((await call('/api/me/listings/'+id,'POST',token,{status:'active'})).status,404);
 }finally{if(token)assert.equal((await call('/api/me/account','DELETE',token)).status,200)}
});
