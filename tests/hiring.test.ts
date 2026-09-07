import test from 'node:test';
import assert from 'node:assert/strict';
import { canonical, ingest, type Store, type Source, type Result, type Job } from '../backend/hiringCore';
import { classify, jstDay, normalizeTitle, postingDate, validDay } from '../backend/hiringRules';
import { collectWorkday, parseEasyApply, parseJsonLd } from '../backend/hiringFetch';
const source:Source={id:'test',company_id:'test',company:'Test',url:'https://example.com/jobs',adapter:'jsonld'};
const now='2026-09-07T00:00:00.000Z';
const raw={title:'Maintenance Engineer',identifier:'123',location:'Tokyo',country:'Japan',url:'https://example.com/jobs/123',published:'2026-09-01'};
const good:Result={jobs:[raw],complete:true,status:'ok',message:'Complete'};
class Memory implements Store {rows=new Map<string,Record<string,unknown>>();failKey='';async read<T>(key:string){return structuredClone(this.rows.get(key)||null) as T|null;}async write(key:string,row:Record<string,unknown>){if(key===this.failKey){this.failKey='';throw Error('Injected write failure');}this.rows.set(key,structuredClone(row));}}
test('identity uses company and identifier, fallback normalization retains location',()=>{
  assert.equal(canonical(raw,source,now).job_key,canonical({...raw,title:'Renamed'},source,now).job_key);
  assert.notEqual(canonical(raw,source,now).job_key,canonical(raw,{...source,company_id:'other'},now).job_key);
  const a=canonical({...raw,identifier:null,title:'  MILLER  '},source,now),b=canonical({...raw,identifier:null,title:'miller'},source,now);
  assert.equal(a.job_key,b.job_key);assert.notEqual(a.job_key,canonical({...raw,identifier:null,title:'miller',location:'Osaka'},source,now).job_key);
  assert.throws(()=>canonical({...raw,identifier:null,location:null},source,now));
});
test('repeat day is idempotent, next day retains first seen, classifies title',async()=>{
  const store=new Memory();const a=await ingest(store,source,good,now);const b=await ingest(store,source,good,now);assert.deepEqual(a,b);assert.equal(a.baseline,1);
  await ingest(store,source,good,'2026-09-08T00:00:00.000Z');const job=await store.read<Job>('job:'+canonical(raw,source,now).job_key);
  assert.equal(job?.first_seen_at,now);assert.equal(job?.last_seen_at,'2026-09-08T00:00:00.000Z');assert.equal(job?.category,'Maintenance');
});
test('three separate complete absences close; outage and partial never close; reopening keeps identity',async()=>{
  const store=new Memory();await ingest(store,source,good,now);
  for(const [day,result]of [['08',{jobs:[],complete:true,status:'ok'}],['09',{jobs:[],complete:false,status:'unavailable'}],['10',{jobs:[],complete:false,status:'partial'}],['11',{jobs:[],complete:true,status:'ok'}]] as const){await ingest(store,source,{...result,jobs:[],message:''},'2026-09-'+day+'T00:00:00.000Z');}
  const key='job:'+canonical(raw,source,now).job_key;assert.equal((await store.read<Job>(key))?.active,true);
  await ingest(store,source,{...good,jobs:[]},'2026-09-12T00:00:00.000Z');assert.equal((await store.read<Job>(key))?.status,'inactive');
  await ingest(store,source,good,'2026-09-13T00:00:00.000Z');const job=await store.read<Job>(key);assert.equal(job?.active,true);assert.equal(job?.first_seen_at,now);assert.deepEqual(job?.missing_days,[]);
});
test('malformed data rejects entire observation before mutation; conflicting duplicates rejected',async()=>{
  const store=new Memory();await assert.rejects(ingest(store,source,{...good,jobs:[raw,{...raw,title:''}]},now));assert.equal(store.rows.size,0);
  await assert.rejects(ingest(store,source,{...good,jobs:[raw,{...raw,title:'Conflicting'}]},now));
  assert.throws(()=>canonical({...raw,url:'javascript:alert(1)'},source,now));
});
test('null observation on source outage, duplicate input counted once',async()=>{
  const store=new Memory();assert.equal((await ingest(store,source,{...good,jobs:[raw,raw]},now)).observed,1);
  assert.equal((await ingest(store,source,{jobs:[],complete:false,status:'unavailable',message:'HTTP 503'},'2026-09-08T00:00:00.000Z')).observed,null);
});
test('partial writes resume without changing first seen or baseline',async()=>{
  const store=new Memory();store.failKey='commit:test:2026-09-07';await assert.rejects(ingest(store,source,good,now));
  const result=await ingest(store,source,good,now);assert.equal(result.baseline,1);assert.equal(result.first_observed,1);
});
test('dates are strict, relative posting dates stay unknown, JST rolls over at 15 UTC',()=>{
  assert.equal(validDay('2026-02-30'),false);assert.equal(validDay('2024-02-29'),true);assert.equal(postingDate('2026-02-30',now),null);
  assert.equal(postingDate('Posted 2 Days Ago',now),null);assert.equal(postingDate('2026-09-09',now),null);assert.equal(postingDate('2026-09-01T12:00:00',now),null);
  assert.equal(jstDay('2026-09-06T14:59:59Z'),'2026-09-06');assert.equal(jstDay('2026-09-06T15:00:00Z'),'2026-09-07');
  assert.equal(postingDate('2026-09-01T12:00:00+09:00',now),'2026-09-01T03:00:00.000Z');
});
test('important classification precedence and international variants',()=>{
  for(const [title,expected]of [['Project Engineer','Project / CapEx'],['Maintenance Planner & Coordinator','Maintenance'],['Automation Engineering Lead (m/f/x)','Engineering'],['Assistant Miller','Milling'],['Production Utility','Production / Operations'],['Sr. Food Scientist','R&D / Product Development'],['Financial Analyst','Finance'],['Grain Logistics Assistant','Supply Chain / Logistics'],['品質管理','Quality'],['xyz','Other']])assert.equal(classify(title),expected,title);
  assert.equal(normalizeTitle(' ＭＩＬＬＥＲ '),'miller');
});
test('JSON-LD portal is unknown, structured jobs are partial, generic dates are not job dates',()=>{
  assert.equal(parseJsonLd('<h1>Careers</h1>',source).status,'unverified');
  const result=parseJsonLd('<script type="application/ld+json">'+JSON.stringify({'@type':'JobPosting',title:'Miller',identifier:{value:'1'},url:'https://example.com/1',datePosted:'2026-09-01',jobLocation:{address:{addressLocality:'London',addressCountry:'GB'}}})+'</script>',source);
  assert.equal(result.jobs.length,1);assert.equal(result.complete,false);assert.equal(result.jobs[0].published,'2026-09-01');
});
test('EasyApply verifies listing identity and completeness; empty is not zero',()=>{
  const html='Rogers Foods Current Job Openings <h5><a href="https://easyapply.co/job/miller">Miller</a></h5><i class="fa fa-map-marker"></i>Armstrong, BC</span><div id="pagination"><li class="page-item disabled"><a href="/" aria-label="Next">Next</a>';
  const result=parseEasyApply(html,{...source,country:'Canada'});assert.equal(result.jobs[0].location,'Armstrong, BC');assert.equal(result.complete,true);
  assert.equal(parseEasyApply('Rogers Foods Current Job Openings',source).status,'unverified');assert.throws(()=>parseEasyApply('Captcha',source));
});
test('Workday pagination proves true zero and rejects shifting total or duplicate IDs',async()=>{
  const wd={...source,adapter:'workday' as const,tenant:'test',site:'Test'};
  const zero=await collectWorkday(wd,async()=>JSON.stringify({total:0,jobPostings:[]}));assert.equal(zero.complete,true);assert.equal(zero.jobs.length,0);
  await assert.rejects(collectWorkday(wd,async()=>JSON.stringify({total:2,jobPostings:[{title:'Miller',externalPath:'/job/a',bulletFields:['1']},{title:'Miller',externalPath:'/job/b',bulletFields:['1']}]})));
  await assert.rejects(collectWorkday(wd,async()=>JSON.stringify({total:401,jobPostings:[]})));
});

