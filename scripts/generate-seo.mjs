import fs from 'node:fs';
import path from 'node:path';

const host='https://milling-intelligence.vercel.app';
const brand='Milling Intelligence';
const root=process.cwd();
const publicDir=path.join(root,'public');
const registry=JSON.parse(fs.readFileSync(path.join(root,'src','routeRegistry.json'),'utf8'));
const data=JSON.parse(fs.readFileSync(path.join(publicDir,'data','milling-v02.json'),'utf8'));
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const clip=(s,n=155)=>s.length<=n?s:s.slice(0,n-1)+'…';
const canonicalPath=p=>p==='/'?'/':p.replace(/\/+$/,'');
function readExportArray(file,name){const text=fs.readFileSync(file,'utf8'),start=text.indexOf('export const '+name);if(start<0)return '';const eq=text.indexOf('=',start),open=text.indexOf('[',eq);if(open<0)return '';let depth=0,quote='',escape=false;for(let i=open;i<text.length;i++){const ch=text[i];if(quote){if(escape){escape=false;continue}if(ch==='\\'){escape=true;continue}if(ch===quote)quote='';continue}if(ch==='\''||ch==='"'||ch==='`'){quote=ch;continue}if(ch==='[')depth++;else if(ch===']'&&--depth===0)return text.slice(open,i+1)}return ''}
function idsFromText(text,key='id'){const re=new RegExp('(?:\\b'+key+'\\b|["\\\']'+key+'["\\\'])\\s*:\\s*["\\\']([^"\\\']+)["\\\']','g');return [...text.matchAll(re)].map(m=>m[1])}
const exportIds=(file,name)=>idsFromText(readExportArray(path.join(root,'src',file),name));
const uniq=values=>[...new Set(values.filter(Boolean))];
const careerIds=uniq([...exportIds('careerData.ts','careerCompanies'),...exportIds('JapanMillingExpansion.ts','japanCareerCompanies'),...exportIds('JapanMillingExpansion2.ts','japan2CareerCompanies')]);
const millIds=uniq([...exportIds('Mills.tsx','groups'),...exportIds('JapanMillingExpansion.ts','japanMillGroups'),...exportIds('JapanMillingExpansion2.ts','japan2MillGroups')]);
const sourceText=['CompanyScores.tsx','careerData.ts','Mills.tsx','JapanMillingExpansion.ts','JapanMillingExpansion2.ts'].map(file=>fs.readFileSync(path.join(root,'src',file),'utf8')).join('\n');
const nameById=new Map(data.companies.map(x=>[x.id,x.name]));
for(const match of sourceText.matchAll(/(?:\bid\b|\bticker\b)\s*:\s*['"]([^'"]+)['"][\s\S]{0,240}?\bname\b\s*:\s*['"]([^'"]+)['"]/g))if(!nameById.has(match[1]))nameById.set(match[1],match[2]);
const companyIds=uniq([...data.companies.map(x=>x.id),...idsFromText(fs.readFileSync(path.join(root,'src','CompanyScores.tsx'),'utf8'),'ticker'),...careerIds,...millIds]);
const millAliases={'2002':'nisshin-jp','2001':'nippn','2004':'showa','2003':'nittofuji','2009':'torigoe'};
const careerSet=new Set(careerIds),millSet=new Set(millIds);
const makerIds=uniq(exportIds('MillingMachines.tsx','makers'));
const details=[
 ...companyIds.map(id=>{const name=String(nameById.get(id)||id).replace(/^株式会社|株式会社$/g,'').trim(),millId=millAliases[id]||id,hasMill=millSet.has(millId),hasCareer=careerSet.has(id);return {path:'/company/'+encodeURIComponent(id),title:name+'｜製粉事業・工場・製粉能力・採用情報',description:clip(name+'の会社概要、製粉事業、工場、確認済み製粉能力、採用情報、関連ニュース、公式情報源を既存の公開データから確認できます。'),h1:name+'｜製粉事業・工場・製粉能力・採用情報',body:name+'の製粉事業、工場、製粉能力、採用情報を会社IDで統合しています。未確認情報は推定しません。',links:[['/companies','会社一覧'],...(hasMill?[[`/mills/${millId}`,'工場を見る'],['/compare','ランキングを見る']]:[]),...(hasCareer?[[`/career/${id}`,'採用を見る']]:[])]}}),
 ...careerIds.map(id=>({path:'/career/'+encodeURIComponent(id),title:'製粉会社の採用情報',description:'製粉会社の公開採用情報、募集職種、勤務地、求人履歴を確認できます。',h1:'製粉会社の採用情報',body:'公開採用情報、募集職種、勤務地、求人履歴を会社単位で確認できます。',links:[['/career','Career'],['/companies','Companies']]})),
 ...millIds.map(id=>({path:'/mills/'+encodeURIComponent(id),title:'製粉工場・製粉能力',description:'製粉工場、所在地、工場数、確認済み製粉能力、Google Maps、公開情報源を確認できます。',h1:'製粉工場・製粉能力',body:'工場所在地、確認済み製粉能力、能力のbasis、Google Maps、公開情報源をまとめています。',links:[['/mills','製粉工場一覧'],['/compare','製粉能力ランキング'],['/companies','Companies']]})),
 ...makerIds.map(id=>({path:'/machines/'+encodeURIComponent(id),title:'製粉機械メーカーの技術・設備',description:'製粉機械メーカーの企業概要、得意領域、製粉技術、公式情報を確認できます。',h1:'製粉機械メーカーの技術・設備',body:'メーカー概要、得意領域、製粉技術、公式情報をまとめています。',links:[['/machines','製粉機械メーカー一覧'],['/tech','Technology']]})),
 ...data.equipment.map(e=>{const name=[e.manufacturer,e.equipment,e.model].filter(Boolean).join(' ');return {path:'/equipment/'+encodeURIComponent(e.id),title:name+'の製粉設備情報',description:clip(name+'の工程、機能、能力、メーカー公開仕様と出典を確認できます。'),h1:name,body:'工程、機能、処理能力、メーカー公開仕様と出典をまとめています。',links:[['/tech','製粉技術・設備'],['/machines','メーカー一覧']]}}),
 ...data.articles.map(a=>({path:'/article/'+encodeURIComponent(a.id),title:a.title,description:clip(a.fact+' 公開情報の事実と製粉業界への影響を整理しています。'),h1:a.title,body:a.fact,links:[['/archive','記事アーカイブ'],['/companies','Companies']]}))
];
const allPaths=uniq([...registry.map(x=>x.path),...details.map(x=>x.path)]);
const catalog=allPaths.map(route=>{const item=registry.find(x=>x.path===route)||details.find(x=>x.path===route);return {...item,path:canonicalPath(route),route:item.route||canonicalPath(route).replace(/^\//,'')||'home',title:item.title+' | '+brand,canonical:true,prerender:item.prerender!==false}});
fs.writeFileSync(path.join(root,'src','seoCatalog.json'),JSON.stringify(catalog,null,2)+'\n');
fs.writeFileSync(path.join(root,'src','navigationCatalog.json'),JSON.stringify(registry.filter(x=>x.nav).map(x=>({route:x.route,label:x.nav,path:x.path})),null,2)+'\n');
const style='body{margin:0;font:16px/1.7 system-ui,sans-serif;color:#17221c;background:#f7f8f5}main{max-width:1080px;margin:auto;padding:48px 24px}h1{font-size:clamp(2rem,5vw,3.5rem);line-height:1.1}p{max-width:780px}nav,a{color:#17613b}nav{display:flex;gap:16px;flex-wrap:wrap;margin-top:28px}';
const analytics='<script async src="https://www.googletagmanager.com/gtag/js?id=G-LMNN8JBM7E"></script><script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments)}gtag("js",new Date());gtag("config","G-LMNN8JBM7E",{send_page_view:false});gtag("event","page_view",{page_title:document.title,page_location:location.href,page_path:location.pathname});</script>';
const html=item=>`<!doctype html><html lang="ja"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><base href="/"><script>document.querySelector("base").setAttribute("href","/")</script><title>${esc(item.title)}</title><meta name="description" content="${esc(item.description)}"><meta name="robots" content="index,follow,max-image-preview:large"><link rel="canonical" href="${host}${item.path}"><link rel="sitemap" type="application/xml" href="${host}/sitemap.xml"><meta property="og:title" content="${esc(item.title)}"><meta property="og:description" content="${esc(item.description)}"><meta property="og:type" content="website"><meta property="og:url" content="${host}${item.path}">${analytics}<style id="prerender-style">${style}</style></head><body><div id="prerender"><main><p>MILLING INTELLIGENCE</p><h1>${esc(item.h1)}</h1><p>${esc(item.body)}</p><nav aria-label="主要ページ">${item.links.map(([href,label])=>`<a href="${href}">${esc(label)}</a>`).join('')}</nav></main></div><div id="root"></div><script type="module" src="${item.path==='/'?'./':'../'.repeat(Math.max(0,item.path.split('/').filter(Boolean).length-1))}src/main.tsx"></script></body></html>`;
for(const item of catalog.filter(x=>x.prerender)){const file=item.path==='/'?path.join(root,'index.html'):path.join(root,item.path.slice(1)+'.html');fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,html(item))}
const absolute=p=>host+(p==='/'?'/':p);
fs.writeFileSync(path.join(publicDir,'sitemap.xml'),'<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'+catalog.map(x=>`<url><loc>${absolute(x.path)}</loc></url>`).join('')+'</urlset>\n');
fs.writeFileSync(path.join(publicDir,'robots.txt'),`User-agent: *\nAllow: /\n\nSitemap: ${host}/sitemap.xml\n`);
fs.writeFileSync(path.join(publicDir,'llms.txt'),`# Milling Intelligence\n\nJapanese-first public intelligence database for the flour milling industry.\n\n## Canonical entry points\n${registry.map(x=>'- '+absolute(x.path)+' — '+x.title).join('\n')}\n`);
fs.writeFileSync(path.join(root,'prerender-manifest.json'),JSON.stringify(catalog.map(x=>x.path),null,2)+'\n');
console.log(`Generated ${catalog.length} canonical routes from src/routeRegistry.json.`);

