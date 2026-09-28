const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {JSDOM}=require('jsdom');
const html=fs.readFileSync(path.join(__dirname,'../website/pages/police-tip.html'),'utf8');
const script=fs.readFileSync(path.join(__dirname,'../website/ghost-theme/assets/js/police-tip-draft.js'),'utf8');
function setup(){const w=new JSDOM(html,{url:'https://www.columbiawalks.com/police-tip/',runScripts:'outside-only'}).window;
 w.fetch=()=>{throw Error('Draft helper must not use the network');};w.eval(script);return {w,d:w.document,get:id=>w.document.getElementById('cw-tip-'+id)};}
function fill(a){a.get('inactive').checked=true;for(const [k,v] of Object.entries({subject:'Synthetic check',when:'Yesterday',where:'Test intersection',observation:'No actual incident. Synthetic test only.'}))a.get(k).value=v;}
test('prepares every word with TEST markers and never creates a submission form',()=>{const a=setup();fill(a);a.get('prepare').click();assert.equal(a.get('prepared').hidden,false);
 for(const key of ['output-subject','output-message']){const words=a.get(key).value.split(/\s+/);words.forEach((v,i)=>{if(i%2===0)assert.equal(v,'[TEST]');});}
 assert.equal(a.d.querySelector('form'),null);assert.equal(a.w.localStorage.length,0);assert.equal(a.w.sessionStorage.length,0);
 assert.equal(a.d.querySelector('.cw-official-tip-link').search,'');a.w.close();});
test('requires confirmation and core details, and measures the marked subject length',()=>{const a=setup();a.get('prepare').click();assert.equal(a.get('prepared').hidden,true);fill(a);a.get('subject').value='word '.repeat(30);a.get('prepare').click();assert.match(a.get('status').textContent,/128/);assert.equal(a.get('prepared').hidden,true);a.w.close();});
test('invalidates a prepared copy when the draft changes and renders hostile input as literal text',()=>{const a=setup();fill(a);a.get('observation').value='<img src=x onerror=alert(1)>';a.get('prepare').click();assert.equal(a.d.querySelector('img'),null);assert.ok(a.get('output-message').value.includes('<img'));a.get('where').dispatchEvent(new a.w.Event('input'));assert.equal(a.get('prepared').hidden,true);a.w.close();});
