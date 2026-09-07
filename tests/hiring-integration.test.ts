import test from 'node:test';
import assert from 'node:assert/strict';
import {runHiring,migrateHiring,hiringHistory} from '../backend/hiring';
import type {Store} from '../backend/hiringCore';
import {jstDay} from '../backend/hiringRules';
class Memory implements Store {rows=new Map<string,Record<string,unknown>>();async read<T>(key:string){return structuredClone(this.rows.get(key)||null) as T|null;}async write(key:string,value:Record<string,unknown>){this.rows.set(key,structuredClone(value));}}
test('additive migration is idempotent; daily source failures stay isolated; aggregate and history API persist',async()=>{
  const store=new Memory();store.rows.set('unrelated',{keep:true});await migrateHiring(store);const migration=await store.read('schema');await migrateHiring(store);assert.deepEqual(await store.read('schema'),migration);assert.deepEqual(await store.read('unrelated'),{keep:true});
  const now=new Date().toISOString();let calls=0;
  await runHiring(now,store,async source=>{calls++;return source.id==='rogers'?{jobs:[{identifier:'fixture-1',title:'Maintenance Technician',location:'Armstrong',country:'Canada',url:'https://example.com/job/1'}],complete:true,status:'ok',message:'Fixture'}:{jobs:[],complete:false,status:'unavailable',message:'Simulated source outage'};});
  const firstCalls=calls;await runHiring(now,store,async()=>{throw Error('Must use checkpoint');});assert.equal(calls,firstCalls);
  const all=await hiringHistory({},store);assert.equal(all.trend[0].observed,1);assert.equal(all.trend[0].confirmed_sources,1);assert.equal(all.sources.length,26);
  const company=await hiringHistory({company:'rogers',date:jstDay(now)},store);assert.equal(company.jobs.length,1);assert.equal(company.annual_first_observed,1);assert.equal(company.monthly_first_observed,1);
  assert.equal(company.trend[0].categories.Maintenance,1);assert.equal(company.jobs[0].country,'Canada');assert.equal(company.next_page,null);
  await assert.rejects(hiringHistory({date:'2026-02-30'},store));await assert.rejects(hiringHistory({company:'unknown'},store));await assert.rejects(hiringHistory({page:'-1'},store));
});

