import type { RawJob, Result, Source } from './hiringCore';
type Obj = Record<string,unknown>;
const obj=(v:unknown):Obj=>v&&typeof v==='object'&&!Array.isArray(v)?v as Obj:{};
const str=(v:unknown):string=>typeof v==='string'?v:'';
export const text=(s:string)=>s.replace(/<[^>]*>/g,' ').replace(/&amp;/g,'&').replace(/&nbsp;|&#160;/g,' ').replace(/&#39;|&apos;/g,"'").replace(/&quot;/g,'"').replace(/\s+/g,' ').trim();
export async function getPublic(url:string,init:RequestInit={}):Promise<string> {
  const response=await fetch(url,{...init,signal:AbortSignal.timeout(18000),headers:{'User-Agent':'MillingIntelligence/1.0 (public job history)',...init.headers}});
  if(!response.ok)throw Error('Source HTTP '+response.status);
  if(Number(response.headers.get('content-length'))>2000000)throw Error('Source too large');
  const reader=response.body?.getReader();if(!reader)throw Error('Source body missing');let size=0;const decoder=new TextDecoder();let body='';
  for(;;){const {value,done}=await reader.read();if(done)break;size+=value.byteLength;if(size>2000000){await reader.cancel();throw Error('Source too large');}body+=decoder.decode(value,{stream:true});}
  body+=decoder.decode();if(!body.trim())throw Error('Empty source response');return body;
}
export function parseEasyApply(html:string,source:Source):Result {
  if(!html.includes('Current Job Openings')||!html.includes('Rogers Foods'))throw Error('Unrecognized company listing');
  const jobs:RawJob[]=[];
  for(const match of html.matchAll(/<h5\b[^>]*>([\s\S]*?)<\/h5>([\s\S]*?)(?=<h5\b|<div id="pagination")/g)){
    const a=match[1].match(/<a\b[^>]*href="(https:\/\/easyapply\.co\/job\/[^"?#]+)"[^>]*>([\s\S]*?)<\/a>/);
    const location=match[2].match(/fa-map-marker[^>]*><\/i>([\s\S]*?)<\/span>/);
    if(!a||!location)throw Error('Malformed listing entry');
    jobs.push({title:text(a[2]),url:a[1],identifier:new URL(a[1]).pathname,location:text(location[1]),country:source.country||null,metadata:{adapter:'easyapply',evidence:'official ATS listing'}});
  }
  const nextDisabled=/<li class="page-item disabled">\s*<a[^>]*aria-label="Next"/.test(html);
  if(!jobs.length) return {jobs:[],complete:false,status:'unverified',message:'求人一覧の件数を確定できません。0件とは扱いません。'};
  return {jobs,complete:nextDisabled,status:nextDisabled?'ok':'partial',message:nextDisabled?'公式ATS一覧を全ページ確認':'追加ページがあるため部分観測。終了判定を停止。'};
}
export function parseJsonLd(html:string,source:Source):Result {
  const jobs:RawJob[]=[];
  const walk=(value:unknown,depth=0)=>{if(depth>12)return;if(Array.isArray(value)){value.forEach(v=>walk(v,depth+1));return;}const row=obj(value);
    if(row['@type']==='JobPosting'||Array.isArray(row['@type'])&&row['@type'].includes('JobPosting')){
      const locs=Array.isArray(row.jobLocation)?row.jobLocation:[row.jobLocation];const address=obj(obj(locs[0]).address);const identifier=obj(row.identifier);const country=str(address.addressCountry)||str(obj(address.addressCountry).name)||null;
      const raw:RawJob={title:str(row.title),identifier:str(identifier.value)||str(row.identifier)||null,url:str(row.url)||source.url,location:[address.addressLocality,address.addressRegion].filter(v=>typeof v==='string').join(', ')||null,country,published:str(row.datePosted)||null,metadata:{adapter:'jsonld',datePosted:row.datePosted||null,employmentType:row.employmentType||null,locationCount:locs.length}};
      jobs.push(raw);return;
    }
    Object.values(row).forEach(v=>{if(v&&typeof v==='object')walk(v,depth+1);});
  };
  for(const m of html.matchAll(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)){try{walk(JSON.parse(m[1]));}catch{throw Error('Malformed structured job data');}}
  // JSON-LD does not establish completeness, even when it contains one valid job.
  return {jobs,complete:false,status:jobs.length?'partial':'unverified',message:jobs.length?'公開構造化求人を部分観測。全件数・終了は未判定。':'採用入口を確認。一覧を取得できず、求人数は未確認。'};
}
export async function collectWorkday(source:Source,request=getPublic):Promise<Result> {
  const base=new URL(source.url).origin+'/wday/cxs/'+source.tenant+'/'+source.site;
  let total:number|null=null;const postings:Obj[]=[];
  for(let offset=0;offset<400;offset+=20){const page=obj(JSON.parse(await request(base+'/jobs',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({appliedFacets:{},limit:20,offset,searchText:''})})));
    if(!Number.isInteger(page.total)||Number(page.total)<0||!Array.isArray(page.jobPostings))throw Error('Malformed Workday response');
    // Workday returns total=0 on later pages even when jobs are present.
    if(total!==null&&page.total!==0&&total!==page.total)throw Error('Listing changed during pagination');
    if(total===null)total=Number(page.total);
    if(total>400)throw Error('Workday count exceeds run bound');
    postings.push(...page.jobPostings.map(obj));if(postings.length>=total)break;if(!page.jobPostings.length)throw Error('Incomplete Workday pagination');
  }
  if(total===null||postings.length!==total)throw Error('Workday count mismatch');
  if(total>20){const check=obj(JSON.parse(await request(base+'/jobs',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({appliedFacets:{},limit:20,offset:0,searchText:''})})));if(check.total!==total||JSON.stringify(check.jobPostings)!==JSON.stringify(postings.slice(0,20)))throw Error('Listing changed during pagination');}
  const ids=new Set<string>();const jobs:RawJob[]=[];
  for(const p of postings){const id=Array.isArray(p.bulletFields)?str(p.bulletFields[0]):'';const path=str(p.externalPath);if(!id||!path.startsWith('/job/')||ids.has(id))throw Error('Invalid or duplicate Workday identifier');ids.add(id);
    // Exact date/location from details when available; relative listing date is retained, not inferred.
    let detail:Obj={};try{detail=obj(obj(JSON.parse(await request(base+path))).jobPostingInfo);}catch{ /* Listing remains evidence of presence; optional details are unknown. */ }
    const location=str(detail.location)||str(p.locationsText)||null;
    const country=str(obj(detail.country).descriptor)||str(detail.country)||null;
    jobs.push({title:str(p.title),identifier:id,location,country,url:new URL(source.url).origin+'/'+source.site+path,published:str(detail.startDate)||null,metadata:{adapter:'workday',postedOn:p.postedOn||null,startDate:detail.startDate||null,locationsText:p.locationsText||null,additionalLocations:detail.additionalLocations||null,detail_confirmed:!!detail.title}});
  }
  return {jobs,complete:true,status:'ok',message:'公式Workday一覧の全'+total+'件を確認'};
}
export async function collectSource(source:Source):Promise<Result> {
  try {if(source.adapter==='workday')return await collectWorkday(source);const html=await getPublic(source.url);return source.adapter==='easyapply'?parseEasyApply(html,source):parseJsonLd(html,source);}
  catch(e){return {jobs:[],complete:false,status:'unavailable',message:(e instanceof Error?e.message:'Source unavailable').slice(0,180)};}
}

