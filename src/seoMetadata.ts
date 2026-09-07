import catalog from './seoCatalog.json';
import type {Data} from './model';
type Meta={title:string;description:string;canonical:boolean};
const byRoute=new Map(catalog.map(item=>[item.route,item]));
const missing=():Meta=>({title:'ページが見つかりません | Milling Intelligence',description:'指定されたページは見つかりませんでした。',canonical:false});
export function resolvePageMetadata(route:string,_data:Data|null):Meta{const item=byRoute.get(route);return item?{title:item.title,description:item.description,canonical:true}:missing()}
export function applyPageMetadata(meta:Meta){document.title=meta.title;const descriptions=[...document.querySelectorAll<HTMLMetaElement>('meta[name="description"]')];const description=descriptions[0]||document.head.appendChild(document.createElement('meta'));description.setAttribute('name','description');description.setAttribute('content',meta.description);descriptions.slice(1).forEach(x=>x.remove());const canonicals=[...document.querySelectorAll<HTMLLinkElement>('link[rel="canonical"]')];if(!meta.canonical){canonicals.forEach(x=>x.remove());return}const canonical=canonicals[0]||document.head.appendChild(document.createElement('link'));canonical.setAttribute('rel','canonical');canonical.setAttribute('href',location.origin+(location.pathname.replace(/\/+$/,'')||'/'));canonicals.slice(1).forEach(x=>x.remove())}

