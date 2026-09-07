import { collectSource } from '../backend/hiringFetch';
import { hiringSources } from '../backend/hiringSources';
import { canonical } from '../backend/hiringCore';
for(const id of ['ardent','rogers','dossche','whitworth']){
 const source=hiringSources.find(s=>s.id===id)!;const result=await collectSource(source);const now=new Date().toISOString();
 for(const job of result.jobs)canonical(job,source,now);
 console.log(JSON.stringify({source:id,status:result.status,complete:result.complete,count:result.status==='unverified'||result.status==='unavailable'?null:result.jobs.length,message:result.message,sample:result.jobs.slice(0,1)}));
}

