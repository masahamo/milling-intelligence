import {ExternalLink} from 'lucide-react';
import type {Data} from './model';
import type {Daily} from './Daily';
import {DailyPanel} from './Daily';
import {groups} from './Mills';
import {careerCompanies} from './careerData';
import {companyMillIds} from './Companies';
import {getListedScore,ListedScoreCard} from './CompanyScores';
import CompanyKpis from './CompanyKpis';
import Quarterly from './Quarterly';
import StockChart from './StockChart';
import {appHref} from './navigation';

export default function CompanyDetail({id,data,daily,dailyError,refreshDaily}:{id:string;data:Data;daily:Daily|null;dailyError:string;refreshDaily:()=>void}){
  const company=data.companies.find(x=>x.id===id),score=getListedScore(id),mill=groups.find(x=>x.id===(companyMillIds[id]||id)),career=careerCompanies.find(x=>x.id===id);
  const name=company?.name||score?.name||mill?.name||career?.name;
  if(!name)return <section className='section'><h1>会社が見つかりません</h1><a href={appHref('companies')}>会社一覧へ戻る</a></section>;
  const articles=data.articles.filter(a=>a.companyIds.includes(id)||(company?.region&&a.country===company.region));
  const sources=[...(company?.sourceIds.map(sourceId=>data.sources.find(s=>s.id===sourceId)).filter(Boolean)||[]),...(mill?.sources||[]),...(score?.sources||[])];
  const uniqueSources=[...new Map(sources.map(s=>[s!.url,s!])).values()];
  return <section className='section company-detail-page'><a href={appHref('companies')}>← 会社一覧</a><div className='page-heading'><div><span>{id}{company?.region?' / '+company.region:mill?.scope?' / '+mill.scope:''}</span><h1>{name}｜製粉事業・工場・製粉能力・採用情報</h1><p>{company?.focus?.join(' / ')||mill?.relation||'既存の公開情報を会社IDで統合して表示しています。'}</p></div></div><div className='company-actions'><a href={appHref('companies')}>会社一覧 →</a>{mill&&<a href={appHref('mills/'+mill.id)}>工場を見る →</a>}{career&&<a href={appHref('career/'+career.id)}>採用を見る →</a>}{mill&&<a href={appHref('compare')}>ランキングを見る →</a>}</div><div className='story-grid'><article className='story'><h2>会社概要</h2><p>{company?.focus?.join('。')||mill?.relation||'詳細は公式情報源をご確認ください。'}</p></article><article className='story'><h2>製粉事業</h2><p>{mill?.totalNote||company?.focus?.join('。')||'未確認'}</p></article>{mill&&<article className='story'><h2>工場・確認済み製粉能力</h2><p><b>{mill.plantCount}</b></p><p>{mill.totalDaily}</p><p>{mill.totalNote}</p><a href={appHref('mills/'+mill.id)}>Mills詳細 →</a></article>}{career&&<article className='story'><h2>採用・転職情報</h2><p>{career.roles.length?career.roles.slice(0,6).join(' / '):'募集職種は未確認'}</p><a href={appHref('career/'+career.id)}>Career詳細 →</a></article>}</div>{score&&<><h2>売上・企業情報</h2><CompanyKpis ticker={id}/><ListedScoreCard ticker={id}/><Quarterly ticker={id}/><StockChart ticker={id} name={name}/></>}<DailyPanel daily={daily} error={dailyError} refresh={refreshDaily} company={id} countryContext={company?.region||mill?.scope} compact/>{articles.length>0&&<section><h2>関連ニュース</h2><div className='story-grid'>{articles.slice(0,8).map(a=><article className='story' key={a.id}><span className='tag tag-1'>{a.category} · {a.country}</span><h3><a href={appHref('article/'+a.id)}>{a.title}</a></h3><p>{a.fact}</p></article>)}</div></section>}{uniqueSources.length>0&&<section><h2>公式情報源</h2><div className='sources'>{uniqueSources.map(s=><div key={s.url}><a href={s.url} target='_blank' rel='noreferrer'>{s.name} <ExternalLink size={14}/></a></div>)}</div></section>}</section>;
}

