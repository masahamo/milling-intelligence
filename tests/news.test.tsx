import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {renderToStaticMarkup} from 'react-dom/server';
import {watchers} from '../backend/watchers';
import {isScheduled,nextScheduledDay,sourceDiagnostics,rotationStart} from '../backend/cadence';
import {dailyRefresh,handler} from '../backend/index';
import {rows,calls,reset,fail} from '../.qa/news-sdk-mock';
import {DailyHealthBar,DailyPanel,type Daily} from '../src/Daily';
const periodic=watchers.filter(w=>w.cadence==='quarterly');
const daily=watchers.filter(w=>w.cadence==='daily');
const plus=(day:string,n:number)=>new Date(Date.parse(day+'T00:00:00Z')+n*86400000).toISOString().slice(0,10);
test('explicit source policy: 20 daily, 7 quarterly; fixed disjoint slots, 91-day cycle and leap/JST boundaries',()=>{
  assert.equal(daily.length,20);assert.equal(periodic.length,7);
  assert.equal(new Set(periodic.map(w=>w.rotationDay)).size,7);
  for(let i=0;i<182;i++){const day=plus(rotationStart,i);assert(daily.every(w=>isScheduled(w,day)));assert(periodic.filter(w=>isScheduled(w,day)).length<=1);}
  for(const w of periodic){const days=Array.from({length:182},(_,i)=>plus(rotationStart,i)).filter(d=>isScheduled(w,d));assert.equal(days.length,2);assert.equal(plus(days[0],91),days[1]);assert.equal(nextScheduledDay(w,plus(days[0],1)),days[1]);}
  assert(watchers.every(w=>isScheduled(w,'2026-09-07')));
  for(const day of ['2028-02-29','2028-03-01','2027-01-01'])assert(nextScheduledDay(periodic[0],day)>=day);
});
test('off-day differs from failure; historic actual attempts win and saved IR is not prematurely stale',()=>{
  const w=periodic[1],day=rotationStart,asOf=Date.parse(day+'T12:00:00+09:00');
  const row={day:'2026-09-07',status:'ok',successAt:'2026-09-07T00:00:00Z',message:'差分なし'};
  const state=sourceDiagnostics(w,day,row,asOf);assert.equal(state.status,'skipped');assert.equal(state.stale,false);assert.equal(state.lastStatus,'ok');
  assert.equal(sourceDiagnostics(w,day,{...row,day,status:'failed'},asOf).status,'failed');
  const priorFailure=sourceDiagnostics(w,day,{...row,status:'failed'},asOf);assert.equal(priorFailure.status,'skipped');assert.equal(priorFailure.lastStatus,'failed');assert.equal(priorFailure.stale,true);
  assert.equal(sourceDiagnostics(w,'2026-09-06',null,asOf).status,'pending');
  assert.equal(sourceDiagnostics(periodic[0],day,null,asOf).status,'pending');
});
test('collector schedules daily news first and one IR, preserves skipped data, fingerprint prevents AI repeats',async()=>{
  reset();const saved={id:'saved',day:'2026-09-07',status:'ok',recent:[{id:'old-ir'}],fingerprint:'keep'};rows.set('mi-watch:'+periodic[1].id,[saved]);
  await dailyRefresh({scheduledTime:rotationStart+'T06:00:00+09:00'});
  assert.equal(calls.scrape.length,21);assert.deepEqual(calls.scrape.slice(0,20),daily.map(w=>w.url));assert.equal(calls.scrape[20],periodic[0].url);assert.deepEqual(rows.get('mi-watch:'+periodic[1].id),[saved]);
  const generations=calls.generate;await dailyRefresh({scheduledTime:rotationStart+'T06:00:00+09:00'});assert.equal(calls.scrape.length,21);
  await dailyRefresh({scheduledTime:plus(rotationStart,1)+'T06:00:00+09:00'});assert.equal(calls.scrape.length,41);assert.equal(calls.generate,generations);
  // A UTC date the previous evening must resolve to the correct JST rotation day.
  reset();await dailyRefresh({scheduledTime:'2026-09-07T21:00:00Z'});assert.equal(calls.scrape.at(-1),periodic[0].url);
});
test('actual failures remain failed, later sources run, cooldown gets a dated diagnostic; successful checkpoint repairs missing day',async()=>{
  reset();fail(daily[0].url);await assert.rejects(dailyRefresh({scheduledTime:rotationStart+'T06:00:00+09:00'}),/nisshin/);assert.equal(calls.scrape.length,21);assert.equal(rows.get('mi-day:'+rotationStart+':nisshin')?.[0].status,'failed');
  reset();fail(daily[0].url,true);await dailyRefresh({scheduledTime:rotationStart+'T06:00:00+09:00'});assert.equal(rows.get('mi-day:'+rotationStart+':nisshin')?.[0].status,'cooldown');await dailyRefresh({scheduledTime:rotationStart+'T06:00:00+09:00'});assert.equal(rows.get('mi-day:'+rotationStart+':nisshin')?.[0].status,'cooldown');
  rows.delete('mi-day:'+rotationStart+':nippn');await dailyRefresh({scheduledTime:rotationStart+'T06:00:00+09:00'});assert.equal(rows.get('mi-day:'+rotationStart+':nippn')?.[0].status,'ok');
});
test('daily API keeps saved news and actual failures; source date history remains available',async()=>{
  reset();const day=new Date().toLocaleDateString('en-CA',{timeZone:'Asia/Tokyo'});rows.set('mi-watch:nisshin',[{id:'x',day,status:'failed',recent:[{id:'preserved'}],changes:[]}]);
  const routes=handler as unknown as Record<string,((c:{query:Record<string,string>})=>Promise<{statusCode:number;body:string}>)[]>;
  const response=await routes['GET /api/daily'][0]({query:{}});const body=JSON.parse(response.body);assert.equal(body.states[0].status,'failed');assert.equal(body.states[0].recent[0].id,'preserved');
  const history=JSON.parse((await routes['GET /api/daily'][0]({query:{date:'2026-09-06'}})).body);assert(history.states.every((s:{status:string})=>s.status==='pending'));
});
test('health UI separates skipped from failed with unchanged news-first Overview order',()=>{
  Object.defineProperty(globalThis,'location',{configurable:true,value:new URL('https://milling-intelligence-n4b7pt.v2.appdeploy.ai/')});
  const day=new Date().toLocaleDateString('en-CA',{timeZone:'Asia/Tokyo'});
  const states=['ok','failed','skipped'].map((status,i)=>({id:String(i),name:'Source '+i,url:'https://example.com',country:'Japan',status,message:'record',day,attemptAt:null,successAt:null,stale:false,changes:[],recent:[],cadence:status==='skipped'?'quarterly':'daily',lastStatus:status==='skipped'?'failed':null,lastMessage:'previous source failure'}));
  const data:Daily={schedule:'毎朝6:00 JST',retrievedAt:new Date().toISOString(),requestedDay:null,states};
  const bar=renderToStaticMarkup(<DailyHealthBar daily={data} error=''/>);assert.match(bar,/成功 1\/2/);assert.match(bar,/失敗 1/);assert.match(bar,/予定対象外 1/);assert.match(bar,/一部取得失敗/);assert.match(bar,/daily/);
  const panel=renderToStaticMarkup(<DailyPanel daily={data} error='' refresh={()=>{}}/>);assert.match(panel,/前回状態：取得失敗/);assert.match(panel,/91日周期/);
  const source=readFileSync('src/MillingIntelligence.tsx','utf8');const barAt=source.indexOf("{section==='home'&&<DailyHealthBar");assert(barAt>source.indexOf('<OverviewNews'));assert(barAt>source.indexOf("className='overview-update'"));assert.equal(source.slice(barAt).split('</main>')[0],"{section==='home'&&<DailyHealthBar daily={live.daily} error={live.error}/>}");
});
