const assert = require('node:assert/strict');
const { chromium, webkit, devices } = require('playwright');
const base = process.env.TEST_URL || 'http://127.0.0.1:3000';
(async () => {
  for (const [name, engine] of Object.entries({chromium, webkit})) {
    const browser = await engine.launch({headless:true});
    const context = await browser.newContext({...devices['iPhone 13'], defaultBrowserType:undefined});
    const page = await context.newPage();
    page.setDefaultTimeout(10000);
    console.log(name + ": started");
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(base);
    await page.locator('.nav button').nth(1).click();
    await page.waitForSelector('.now-marker');
    assert.equal(await page.locator('.now-marker').count(),10);
    for (const category of ['Earn','Help','People','Rides','Marketplace','All']) {
      await page.locator(`[data-category="${category}"]`).click();
      assert.equal(await page.locator('.now-marker').count(),category==='All'?10:2);
      assert.equal(await page.locator('.opportunity').count(),category==='All'?10:2);
    }
    await page.locator('[data-category="Earn"]').click();
    console.log(name + ': filters passed');
    await page.locator('.now-marker').first().click();
    assert.match(await page.locator('#sheetText').innerText(),/NOK.*Demo listing/);
    await page.locator('#sheetAction').click();
    assert.match(await page.locator('#createText').inputValue(),/Evening delivery/);
    await page.getByRole('button',{name:'Find matches now',exact:true}).click();
    await page.locator('.close').click();
    for (let index=0;index<5;index++) {
      await page.locator('.nav button').nth(index).click();
      assert.equal(await page.locator('.page.active').getAttribute('id'),['home','explore','create','chat','you'][index]);
    }
    await page.locator('.nav button').nth(1).click();
    console.log(name + ': navigation passed');
    const zoom = await page.evaluate(()=>exploreMap.getZoom());
    await page.locator('.leaflet-control-zoom-in').click();
    await page.waitForFunction(z=>exploreMap.getZoom()>z,zoom);
    const before=await page.evaluate(()=>exploreMap.getCenter().lng);
    await page.locator('#map').focus();
    await page.keyboard.press('ArrowRight');
    await page.waitForFunction(lng=>Math.abs(exploreMap.getCenter().lng-lng)>.0001,before);
    await page.evaluate(()=>Object.defineProperty(navigator,'geolocation',{configurable:true,value:{getCurrentPosition:success=>success({coords:{latitude:60.38,longitude:5.33,accuracy:30}})}}));
    await page.locator('#locate').click();
    assert.equal(await page.locator('.user-dot').count(),1);
    assert.match(await page.locator('.opportunity').first().innerText(),/from you/);
    console.log(name + ': position passed');
    for (const code of [1,2,3]) {
      await page.evaluate(code=>Object.defineProperty(navigator,'geolocation',{configurable:true,value:{getCurrentPosition:(success,fail)=>fail({code})}}),code);
      await page.locator('#locate').click();
      assert.match(await page.locator('#locationStatus').innerText(),/instead/);
      assert.equal(await page.locator('.user-dot').count(),0);
      await page.waitForFunction(()=>Math.abs(exploreMap.getCenter().lat-60.3774)<.0001);
    }
    await page.evaluate(()=>Object.defineProperty(navigator,'geolocation',{configurable:true,value:undefined}));
    await page.locator('#locate').click();
    assert.match(await page.locator('#locationStatus').innerText(),/unavailable/);
    for(const width of [320,390,520,844]) {
      await page.setViewportSize({width,height:width===844?390:844});
      assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
    }
    await page.setViewportSize({width:390,height:844});
    await page.waitForFunction(()=>exploreMap.getSize().x===document.getElementById('map').clientWidth);
    await page.waitForTimeout(400);
    await page.screenshot({path:`/tmp/now-${name}.png`});
    await page.evaluate(()=>{Storage.prototype.setItem=()=>{throw new Error('Storage blocked')};openCreate('Test storage');publish()});
    assert.equal(await page.locator('#sheetTitle').innerText(),'Request ready');
    assert.deepEqual(errors,[]);
    await page.route('**/vendor/leaflet.js',route=>route.abort());
    await page.reload();
    await page.locator('.nav button').nth(1).click();
    await page.waitForFunction(()=>document.getElementById('mapStatus').textContent.includes('could not load'));
    assert.equal(await page.locator('.opportunity').count(),10);
    await page.unroute('**/vendor/leaflet.js');
    await page.route('https://tile.openstreetmap.org/**',route=>route.abort());
    await page.reload();
    await page.locator('.nav button').nth(1).click();
    await page.waitForFunction(()=>document.getElementById('mapStatus').textContent.includes('could not load'));
    assert.equal(await page.locator('.opportunity').count(),10);
    assert.deepEqual(errors,[]);
    await browser.close();
    console.log(`${name}: navigation, markers, filters, pan/zoom, location outcomes, layouts, storage and network failures PASS`);
  }
  for (const [url,status,type] of [['/',200,'text/html'],['/explore.js',200,'text/javascript'],['/vendor/leaflet.css',200,'text/css'],['/vendor/leaflet.js',200,'text/javascript'],['/server.js',404,'text/plain'],['/toString',404,'text/plain']]) {
    const response=await fetch(base+url);
    assert.equal(response.status,status);assert(response.headers.get('content-type').startsWith(type));
  }
  assert.equal((await fetch(base,{method:'POST'})).status,405);
  assert.equal(await (await fetch(base,{method:'HEAD'})).text(),'');
  console.log('HTTP routes, MIME types, private files, methods PASS');
})().catch(error=>{console.error(error);process.exit(1)});
