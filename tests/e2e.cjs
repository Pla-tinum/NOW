const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');

const base = process.env.TEST_URL || 'http://127.0.0.1:3000';
async function call(path, method = 'GET', token, body) {
  const r = await fetch(new URL(path, base), {method, signal: AbortSignal.timeout(25000), headers: {'Content-Type':'application/json', ...(token ? {Authorization:'Bearer '+token} : {})}, body:body===undefined?undefined:JSON.stringify(body)});
  const data = await r.json().catch(()=>({}));
  return {status:r.status,data};
}
test('two accounts: publish, apply, chat, deal, review, report, block, delete', {timeout:400000}, async () => {
  const suffix = crypto.randomBytes(7).toString('hex');
  const password = crypto.randomBytes(20).toString('hex');
  const tokens = [];
  try {
    const anonymous=await call('/api/listings','POST',undefined,{deviceId:'qa-'+suffix,title:'anonymous QA',description:'Must be rejected'});
    assert.equal(anonymous.status,400);
    for (const label of ['owner','worker']) {
      const r=await call('/api/auth/register','POST',undefined,{name:'NOW QA '+label,email:`now-qa-${label}-${suffix}@example.invalid`,password});
      assert.equal(r.status,200,JSON.stringify(r.data)); tokens.push(r.data.token);
    }
    const [owner,worker]=tokens; console.log('QA: registered');
    const created=await call('/api/listings','POST',owner,{title:'NOW QA '+suffix,description:'Disposable release QA listing',category:'Help',country:'NO',location:'Bergen',kind:'need'});
    assert.equal(created.status,201,JSON.stringify(created.data)); const id=created.data.listing.id; console.log('QA: listed');
    assert.equal((await call('/api/me/listings/'+id,'POST',owner,{status:'deleted'})).status,404);
    const listings=await call('/api/listings'); assert.ok(listings.data.listings.some(x=>x.id===id));
    const applied=await call('/api/jobs/apply','POST',worker,{listing_id:id,message:'QA application'});
    assert.equal(applied.status,200,JSON.stringify(applied.data)); const job=applied.data.job.id; console.log('QA: applied');
    assert.equal((await call(`/api/jobs/${job}/messages`,'POST',owner,{text:'QA hello'})).status,201);
    assert.ok((await call(`/api/jobs/${job}/messages`,'GET',worker)).data.messages.some(x=>x.text==='QA hello')); console.log('QA: chat');
    for(const [action,token] of [['accept',owner],['start',worker],['complete',worker],['confirm',owner]]) {
      const r=await call(`/api/jobs/${job}/${action}`,'POST',token,{}); assert.equal(r.status,200,action+': '+JSON.stringify(r.data)); console.log('QA: '+action);
    }
    assert.equal((await call('/api/reviews','POST',worker,{job_id:job,rating:5,text:'QA review'})).status,200);
    assert.equal((await call('/api/reports','POST',worker,{listing_id:id,reason:'QA report'})).status,201);
    assert.equal((await call('/api/blocks','POST',worker,{user_id:created.data.listing.user_id})).status,201);
    assert.equal((await call('/api/me/account','DELETE',owner)).status,200);
    assert.equal((await call('/api/me','GET',owner)).status,401);
    assert.ok(!(await call('/api/listings')).data.listings.some(x=>x.id===id));
    const msgs=await call(`/api/jobs/${job}/messages`,'GET',worker);
    assert.ok(msgs.data.messages.every(x=>x.text!=='QA hello'));
    assert.equal((await call('/api/me/account','DELETE',worker)).status,200); console.log('QA: deleted');
    tokens.length=0;
  } finally {
    for(const token of tokens){try{await call('/api/me/account','DELETE',token)}catch(_){}}
  }
});
