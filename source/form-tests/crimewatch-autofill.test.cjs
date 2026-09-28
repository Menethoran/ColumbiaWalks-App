const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {JSDOM} = require('jsdom');
const script = fs.readFileSync(path.join(__dirname, '../android/app/src/main/assets/crimewatch-test-autofill.js'), 'utf8');
const url = 'https://crimewatch.net/us/pa/lancaster/columbia-boro-pd/10552/submit-tip';
// Field IDs, types, names and option values verified from CBPD's live form on 2026-09-28.
const fixture = `<form id="webform-client-form-142312" action="${url}" method="post">
<input id="edit-submitted-person-anonymous-1" type="radio" name="submitted[person][anonymous]" value="0" checked>
<input id="edit-submitted-person-anonymous-2" type="radio" name="submitted[person][anonymous]" value="1">
${['first-name','last-name','mail','phone-number'].map(n=>`<input id="edit-submitted-person-${n}" value="Synthetic contact">`).join('')}
<select id="edit-submitted-narrative-crime"><option value="Theft">Theft</option><option value="Other">Other</option></select>
<input id="edit-submitted-narrative-subject" maxlength="128" required>
<textarea id="edit-submitted-narrative-notes" required></textarea>
<input id="edit-agree" type="checkbox" name="agree" value="1">
<input id="csrf" type="hidden" name="form_token" value="fixture-token">
<input type="file" name="files[narrative_attachments]">
<input id="submit" type="submit" value="Submit"></form>`;
function setup(target=url, html=fixture) {
 const dom=new JSDOM(html,{url:target,runScripts:'outside-only'});
 const w=dom.window;const d=w.document;
 return {w,d,run:(draft={subject:'Controlled test',message:'Third and Locust. Blue sedan. Synthetic test only.'})=>w.eval(script)(draft)};
}
function assertMarked(value) {
 const tokens=value.split(/\s+/);assert.equal(tokens.length%2,1);
 tokens.forEach((t,i)=>i%2===0?assert.equal(t,'[TEST]'):assert.notEqual(t,'[TEST]'));
}
test('fills all four fields, clears contact data, and leaves consent, CSRF and attachments alone',()=>{
 const {w,d,run}=setup();let submissions=0;d.querySelector('form').addEventListener('submit',()=>submissions++);
 assert.equal(run(),'filled');assert.equal(submissions,0);
 assert.equal(d.getElementById('edit-submitted-person-anonymous-2').checked,true);
 assert.equal(d.getElementById('edit-submitted-narrative-crime').value,'Other');
 assert.equal(d.getElementById('edit-submitted-narrative-subject').value,'[TEST] Controlled [TEST] test [TEST]');
 assertMarked(d.getElementById('edit-submitted-narrative-notes').value);
 for(const n of ['first-name','last-name','mail','phone-number']) assert.equal(d.getElementById('edit-submitted-person-'+n).value,'');
 assert.equal(d.getElementById('edit-agree').checked,false);
 assert.equal(d.getElementById('csrf').value,'fixture-token');
 assert.equal(d.querySelector('input[type=file]').value,'');w.close();
});
test('reapplies test marking, anonymity, and Other after user edits without submitting by itself',()=>{
 const {w,d,run}=setup();run();
 const s=d.getElementById('edit-submitted-narrative-subject');const m=d.getElementById('edit-submitted-narrative-notes');
 s.value='Edited [TEST] title';m.value='More\u00a0details\u200bhere';
 d.getElementById('edit-submitted-person-anonymous-1').click();d.getElementById('edit-submitted-narrative-crime').value='Theft';
 const e=new w.Event('submit',{bubbles:true,cancelable:true});d.querySelector('form').dispatchEvent(e);
 assert.equal(e.defaultPrevented,false);assert.equal(s.value,'[TEST] Edited [TEST] title [TEST]');
 assert.equal(m.value,'[TEST] More [TEST] details [TEST] here [TEST]');
 assert.equal(d.getElementById('edit-submitted-person-anonymous-2').checked,true);
 assert.equal(d.getElementById('edit-submitted-narrative-crime').value,'Other');w.close();
});
test('blocks a subject that becomes too long after marking, then accepts a shortened subject',()=>{
 const {w,d,run}=setup();run();const s=d.getElementById('edit-submitted-narrative-subject');s.value='one '.repeat(20);
 const e=new w.Event('submit',{bubbles:true,cancelable:true});d.querySelector('form').dispatchEvent(e);
 assert.equal(e.defaultPrevented,true);assert.ok(s.value.length>128);assert.ok(s.validationMessage.includes('[TEST]'));
 s.value='Short';s.dispatchEvent(new w.Event('input',{bubbles:true}));
 const e2=new w.Event('submit',{bubbles:true,cancelable:true});d.querySelector('form').dispatchEvent(e2);
 assert.equal(e2.defaultPrevented,false);assertMarked(s.value);w.close();
});
test('does not overwrite user edits on repeated load callbacks or a server validation response',()=>{
 const {w,d,run}=setup();run();const m=d.getElementById('edit-submitted-narrative-notes');m.value='User revision';
 assert.equal(run(),'already-filled');assert.equal(m.value,'User revision');w.close();
 const b=setup();b.d.getElementById('edit-submitted-narrative-notes').value='Returned by CRIMEWATCH';b.run();
 assert.equal(b.d.getElementById('edit-submitted-narrative-notes').value,'[TEST] Returned [TEST] by [TEST] CRIMEWATCH [TEST]');b.w.close();
});
test('refuses any other origin, route, action, agency form or missing Other option',()=>{
 for(const target of ['https://evil.example'+new URL(url).pathname, url.replace('10552','99999'),url.replace('https:','http:')]) {
  const a=setup(target);assert.equal(a.run(),'wrong-page');assert.equal(a.d.getElementById('edit-submitted-narrative-subject').value,'');a.w.close();
 }
 for(const html of [fixture.replace('value="Other"','value="Changed"'),fixture.replace('action="'+url+'"','action="https://evil.example"'),fixture.replace('webform-client-form-142312','different')]) {
  const a=setup(url,html);assert.equal(a.run(),'form-changed');assert.equal(a.d.getElementById('edit-submitted-narrative-subject').value,'');a.w.close();
 }
});
test('quotes, HTML, Unicode and script-like report text stay literal; both apps bundle identical script',()=>{
 const {w,d,run}=setup();run({subject:'a "quote"',message:'</script><script>window.pwned=true</script> 😃 & <img src=x>'});
 assert.equal(w.pwned,undefined);assert.ok(d.getElementById('edit-submitted-narrative-notes').value.includes('</script><script>window.pwned=true</script>'));
 assert.equal(fs.readFileSync(path.join(__dirname,'../ios/ColumbiaWalks/Resources/crimewatch-test-autofill.js'),'utf8'),script);w.close();
});
