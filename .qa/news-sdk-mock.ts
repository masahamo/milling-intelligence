export const rows = new Map<string, Record<string, unknown>[]>();
export const calls = {scrape:[] as string[],generate:0};
export let failUrl = '';
export let cooldownUrl = '';
export function reset(){rows.clear();calls.scrape=[];calls.generate=0;failUrl='';cooldownUrl='';}
export function fail(url:string, cooldown=false){if(cooldown)cooldownUrl=url;else failUrl=url;}
export const db = {
  async list(table:string){return {items:structuredClone(rows.get(table)||[])};},
  async add(table:string,records:Record<string,unknown>[]){const result=records.map((r,i)=>({...r,id:table+'-'+i}));rows.set(table,result);return result.map(r=>r.id);},
  async update(table:string,updates:{id:string;record:Record<string,unknown>}[]){for(const u of updates)rows.set(table,[{...u.record,id:u.id}]);return updates.map(()=>true);}
};
export const ai={
  async scrape({url}:{url:string}){calls.scrape.push(url);if(url===cooldownUrl)throw {statusCode:429};return {status:url===failUrl?503:200,text:'Public milling news content unchanged. '.repeat(10)};},
  async generate(){calls.generate++;return {text:JSON.stringify({items:[]})};}
};
export const router=(routes:unknown)=>routes;
export const json=(value:unknown)=>({statusCode:200,body:JSON.stringify(value)});
export const error=(message:string,statusCode:number)=>({statusCode,body:JSON.stringify({error:message})});
