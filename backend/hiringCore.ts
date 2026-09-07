import { createHash } from 'node:crypto';
import { categories, classificationVersion, classify, countryRegion, jstDay, normalizeTitle, postingDate } from './hiringRules';
export type RawJob = { title: string; identifier?: string | null; location?: string | null; country?: string | null; url: string; published?: string | null; metadata?: Record<string,unknown> };
export type Job = { job_key:string; company:string; company_id:string; mill_id:null; title:string; normalized_title:string; title_raw:string; location:string|null; country:string|null; region:string|null; category:string; classification_version:string; source:string; source_url:string; job_identifier:string|null; posting_date:string|null; first_seen_at:string; last_seen_at:string; checked_at:string; status:'active'|'inactive'; active:boolean; missing_days:string[]; inactive_at:string|null; raw_metadata:Record<string,unknown>; created_at:string; updated_at:string; year_first_observation?:Record<string,string>; month_first_observation?:Record<string,string> };
export type Source = { id:string; company_id:string; company:string; url:string; adapter:'workday'|'easyapply'|'jsonld'; tenant?:string; site?:string; country?:string };
export type Result = { jobs:RawJob[]; complete:boolean; status:'ok'|'partial'|'unverified'|'unavailable'; message:string };
export interface Store { read<T>(key:string):Promise<T|null>; write(key:string,record:Record<string,unknown>):Promise<void> }
export type State = { active_keys:string[]; last_day?:string; last_success_at?:string; status?:string; message?:string; checked_at?:string; observation_count?:number|null; };
export type Summary = { company_id:string; company:string; source:string; date:string; checked_at:string; status:string; complete:boolean; observed:number|null; active:number|null; first_observed:number; baseline:number; new_after_baseline:number; annual_unique_additions:number; monthly_unique_additions:number; categories:Record<string,number>; countries:Record<string,number>; message:string };
export const digest = (s:string) => createHash('sha256').update(s).digest('hex');
export function canonical(raw:RawJob,source:Source,now:string):Job {
  if (!raw || typeof raw.title!=='string' || !raw.title.trim() || raw.title.length>500) throw Error('Malformed job title');
  const url = new URL(raw.url);
  if (url.protocol!=='https:' || url.username || url.password) throw Error('Invalid public job URL');
  for(const v of [raw.identifier,raw.location,raw.country]) if(v!==undefined&&v!==null&&(typeof v!=='string'||v.length>500)) throw Error('Malformed job field');
  const title=raw.title.normalize('NFKC').replace(/\s+/g,' ').trim();
  const location=raw.location?.normalize('NFKC').replace(/\s+/g,' ').trim()||null;
  const id=raw.identifier?.trim()||null;
  if(!id&&!location) throw Error('No stable identifier or location');
  const normalized=normalizeTitle(title);
  const key=digest(JSON.stringify([source.company_id,id?'id':'fallback',id||normalized,...(id?[]:[normalizeTitle(location!)])]));
  const metadata={...raw.metadata,published_raw:raw.published||null};
  if(Buffer.byteLength(JSON.stringify(metadata))>12000) throw Error('Job metadata exceeds bound');
  return {job_key:key,company:source.company,company_id:source.company_id,mill_id:null,title,normalized_title:normalized,title_raw:raw.title,location,country:raw.country||null,region:countryRegion(raw.country||null),category:classify(title),classification_version:classificationVersion,source:source.id,source_url:url.href,job_identifier:id,posting_date:postingDate(raw.published,now),first_seen_at:now,last_seen_at:now,checked_at:now,status:'active',active:true,missing_days:[],inactive_at:null,raw_metadata:metadata,created_at:now,updated_at:now};
}
export async function ingest(store:Store,source:Source,result:Result,now:string):Promise<Summary> {
  const day=jstDay(now), commitKey='commit:'+source.id+':'+day;
  const committed=await store.read<Summary>(commitKey);
  if(committed) return committed;
  const state=await store.read<State>('state:'+source.id)||{active_keys:[]};
  if(state.last_day&&state.last_day>day) throw Error('Out-of-order observation');
  if(result.jobs.length>400) throw Error('Source exceeds bounded run size');
  // Validate the entire response before modifying any jobs.
  const incoming=new Map<string,Job>();
  for(const raw of result.jobs){const job=canonical(raw,source,now);const prior=incoming.get(job.job_key);if(prior&&JSON.stringify([prior.title,prior.location])!==JSON.stringify([job.title,job.location]))throw Error('Conflicting duplicate identifier');incoming.set(job.job_key,job);}
  const active=new Set(state.active_keys);
  const stats:Summary={company_id:source.company_id,company:source.company,source:source.id,date:day,checked_at:now,status:result.status,complete:result.complete,observed:result.status==='ok'||result.status==='partial'?incoming.size:null,active:null,first_observed:0,baseline:0,new_after_baseline:0,annual_unique_additions:0,monthly_unique_additions:0,categories:Object.fromEntries(categories.map(c=>[c,0])),countries:{},message:result.message};
  const observations:Job[]=[];
  for(const next of incoming.values()){
    const old=await store.read<Job>('job:'+next.job_key);
    if(old&&Date.parse(old.last_seen_at)>Date.parse(now))throw Error('Out-of-order job observation');
    const job:Job={...next,first_seen_at:old?.first_seen_at||now,created_at:old?.created_at||now,posting_date:next.posting_date||old?.posting_date||null};
    const year=day.slice(0,4),month=day.slice(0,7);
    job.year_first_observation={...old?.year_first_observation,[year]:old?.year_first_observation?.[year]||day};
    job.month_first_observation={...old?.month_first_observation,[month]:old?.month_first_observation?.[month]||day};
    if(job.year_first_observation[year]===day)stats.annual_unique_additions++;
    if(job.month_first_observation[month]===day)stats.monthly_unique_additions++;
    // Same-day retries after a partial DB write still count initial observations once.
    if(jstDay(job.first_seen_at)===day){stats.first_observed++;if(!state.last_success_at)stats.baseline++;else stats.new_after_baseline++;}
    await store.write('job:'+job.job_key,job);active.add(job.job_key);observations.push(job);
    stats.categories[job.category]++;const country=job.country||'Unknown';stats.countries[country]=(stats.countries[country]||0)+1;
  }
  if(result.complete&&result.status==='ok'){
    for(const key of state.active_keys){if(incoming.has(key))continue;const job=await store.read<Job>('job:'+key);if(!job)throw Error('Missing active job checkpoint');
      const missing=[...new Set([...job.missing_days,day])].sort().slice(-3);
      const inactive=missing.length>=3&&Date.parse(day)-Date.parse(missing[0])>=2*86400000;
      await store.write('job:'+key,{...job,missing_days:missing,checked_at:now,updated_at:now,active:!inactive,status:inactive?'inactive':'active',inactive_at:inactive?now:null});
      if(inactive)active.delete(key);
    }
  }
  if(active.size>1200)throw Error('Active index exceeds bound; investigate source');
  stats.active=state.last_success_at||stats.observed!==null?active.size:null;
  for(let i=0;i<observations.length;i+=25)await store.write('observations:'+source.id+':'+day+':'+(i/25),{schema_version:1,jobs:observations.slice(i,i+25)});
  // A prepared record preserves retry accounting if the process dies between state and commit.
  const prepared=await store.read<Summary>('prepared:'+source.id+':'+day);
  const final=prepared||stats;
  await store.write('prepared:'+source.id+':'+day,final);
  await store.write('state:'+source.id,{...state,active_keys:[...active],last_day:day,last_success_at:stats.observed!==null?now:state.last_success_at||null,status:result.status,message:result.message,checked_at:now,observation_count:stats.observed});
  await store.write(commitKey,final);
  return final;
}

