"use client";

import { useMemo, useState } from "react";

type Prospect = {
  name: string; category: string; subcategory: string; website?: string;
  signal: string; source: string; sourceUrl: string; tier: string;
  score: number; aiStatus: string; nextAction: string; fit: string;
};

const prospects: Prospect[] = [
  { name:"HerVeda Naturals", category:"Health & Wellness", subcategory:"Ayurveda / D2C", website:"https://herveda.in", signal:"Technology-enabled Ayurvedic manufacturing, traceable sourcing and D2C / B2B model listed by Startup MP.", source:"Startup MP", sourceUrl:"https://startup.mp.gov.in/stackholders/Startup/WTdxVzNxamRGTjdCUkIyUHozTXE2Zz09", tier:"A", score:92, aiStatus:"Not tested", nextAction:"Run 50 category + brand prompts", fit:"Strong fit: trust, claims, product entities and national category discovery." },
  { name:"Shubanvi Foods / Guiltfreee", category:"Food & Beverage", subcategory:"Clean-label packaged food", website:"https://guiltfreee.com", signal:"Multi-brand food platform focused on healthier, clean-label products and D2C / marketplace distribution.", source:"Startup MP", sourceUrl:"https://startup.mp.gov.in/stackholders/Startup/azkvMFFvbkNBeHZESnE5Y09UaHd6UT09", tier:"A", score:90, aiStatus:"Not tested", nextAction:"Audit product/category entity coverage", fit:"Strong fit: product discovery, clean-label claims and comparison queries." },
  { name:"KhaDigi / Umang Shridhar", category:"Fashion & Lifestyle", subcategory:"Khadi / sustainable fashion", signal:"Founder-led handcrafted khadi and natural-fabric D2C brand with artisan livelihood positioning.", source:"eChai Bhopal", sourceUrl:"https://echai.ventures/bhopal/d2c", tier:"A", score:88, aiStatus:"Not tested", nextAction:"Map national sustainable-fashion prompts", fit:"Strong fit: founder authority, provenance, sustainability and national discovery." },
  { name:"Drinkilu / Renewell", category:"Food & Beverage", subcategory:"Functional beverages", signal:"Previously identified in the Startup MP ecosystem as a functional beverage opportunity; current operating status and brand ownership need reconfirmation.", source:"Prior prospect research", sourceUrl:"https://startup.mp.gov.in/start-up", tier:"B", score:82, aiStatus:"Not tested", nextAction:"Verify current entity, website and product range", fit:"Potential fit: category education and product-led AI discovery." },
  { name:"Za-Aiqa", category:"Food & Beverage", subcategory:"Mughlai / fine dining", signal:"Local fine-dining restaurant with a distinct palace-dining proposition; current listing shows 4.3 rating and 74 reviews.", source:"Local business listing", sourceUrl:"https://www.google.com/maps/search/?api=1&query=Za-Aiqa+Bhopal", tier:"B", score:79, aiStatus:"Not tested", nextAction:"Check GBP, menu, review velocity and AI recommendations", fit:"Potential fit: high-intent cuisine, occasion and location-based discovery." },
  { name:"Giovanni Village", category:"Hospitality", subcategory:"Resort / experiences", signal:"Resort listing shows 4.7 rating and 600 reviews; experience-led stay and event positioning.", source:"Local business listing", sourceUrl:"https://www.google.com/maps/search/?api=1&query=Giovanni+Village+Bhopal", tier:"B", score:78, aiStatus:"Not tested", nextAction:"Audit weekend getaway and resort prompts", fit:"Potential fit: destination discovery, amenities, reviews and booking intent." },
  { name:"Shambhala Resort", category:"Hospitality", subcategory:"Resort / events", signal:"Countryside resort and event venue near Bhopal; listing shows 4.1 rating and 32 reviews.", source:"Local business listing", sourceUrl:"https://www.google.com/maps/search/?api=1&query=Shambhala+Resort+Bhopal", tier:"B", score:74, aiStatus:"Not tested", nextAction:"Verify website, inventory and event packages", fit:"Potential fit: weekend escapes, weddings and experiential stays." },
  { name:"Green House Bistro", category:"Food & Beverage", subcategory:"Premium café / restaurant", signal:"Distinctive greenhouse dining concept within Jehan Numa Retreat; listing shows 4.8 rating and 42 reviews.", source:"Local business listing", sourceUrl:"https://www.google.com/maps/search/?api=1&query=Green+House+Bistro+Bhopal", tier:"B", score:72, aiStatus:"Not tested", nextAction:"Build ambience, brunch and occasion prompt set", fit:"Potential fit: experience-led local recommendation queries." },
  { name:"Sadar Manzil Heritage by Atmosphere", category:"Hospitality", subcategory:"Heritage hotel", signal:"Heritage property listing shows 4.9 rating and 111 reviews.", source:"Local business listing", sourceUrl:"https://www.google.com/maps/search/?api=1&query=Sadar+Manzil+Heritage+Bhopal", tier:"B", score:71, aiStatus:"Not tested", nextAction:"Audit heritage stay and Old Bhopal travel queries", fit:"Potential fit: heritage tourism and boutique stay discovery." },
];

const categories = ["All categories","Food & Beverage","Health & Wellness","Fashion & Lifestyle","Hospitality"];
const tierLabel = (tier:string) => tier === "A" ? "Priority A" : "Priority B";

export default function BhopalProspectingPage() {
  const [query,setQuery] = useState("");
  const [category,setCategory] = useState("All categories");
  const [tier,setTier] = useState("All priorities");
  const [selected,setSelected] = useState<Prospect | null>(prospects[0]);
  const filtered = useMemo(() => prospects.filter(p =>
    (category === "All categories" || p.category === category) &&
    (tier === "All priorities" || (tier === "Priority A" ? p.tier === "A" : p.tier === "B")) &&
    (p.name+" "+p.category+" "+p.subcategory+" "+p.signal).toLowerCase().includes(query.toLowerCase())
  ).sort((a,b)=>b.score-a.score),[query,category,tier]);
  const average = Math.round(prospects.reduce((n,p)=>n+p.score,0)/prospects.length);
  return <main className="min-h-screen bg-[#f5f6f8] text-slate-900">
    <div className="mx-auto max-w-7xl px-5 py-8 md:px-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div><div className="text-xs font-semibold uppercase tracking-[.2em] text-indigo-600">Digital Authority Labs · AuthorityIQ</div>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight md:text-4xl">Bhopal Prospecting Engine</h1>
          <p className="mt-2 max-w-2xl text-sm text-slate-500">Discover emerging local brands, qualify commercial fit and prioritise AI Visibility audits.</p></div>
        <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-right"><div className="text-xs text-slate-500">Market workspace</div><div className="font-semibold">Bhopal, Madhya Pradesh</div><div className="text-xs text-slate-400">Starter prospect set · Nov 2026</div></div>
      </div>
      <section className="mt-7 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[["Prospects in starter set",String(prospects.length)],["Priority A",String(prospects.filter(p=>p.tier==="A").length)],["Average prospect score",String(average)],["AI visibility tested","0 / 9"]].map(([label,value])=><div key={label} className="rounded-2xl border border-slate-200 bg-white p-5"><div className="text-sm text-slate-500">{label}</div><div className="mt-2 text-3xl font-semibold tracking-tight">{value}</div></div>)}
      </section>
      <div className="mt-7 grid gap-5 lg:grid-cols-[minmax(0,1.6fr)_minmax(300px,.8fr)]">
        <section className="min-w-0 rounded-2xl border border-slate-200 bg-white">
          <div className="border-b border-slate-100 p-5">
            <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-lg font-semibold">Prospect universe</h2><span className="text-xs text-slate-400">{filtered.length} matches</span></div>
            <div className="mt-4 grid gap-2 md:grid-cols-[1fr_190px_160px]">
              <input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search brand, category or signal…" className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-indigo-400"/>
              <select value={category} onChange={e=>setCategory(e.target.value)} className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm">{categories.map(c=><option key={c}>{c}</option>)}</select>
              <select value={tier} onChange={e=>setTier(e.target.value)} className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm">{["All priorities","Priority A","Priority B"].map(c=><option key={c}>{c}</option>)}</select>
            </div>
          </div>
          <div className="divide-y divide-slate-100">
            {filtered.map(p=><button key={p.name} onClick={()=>setSelected(p)} className={"w-full p-5 text-left transition hover:bg-slate-50 "+(selected?.name===p.name?"bg-indigo-50/60":"")}>
              <div className="flex flex-wrap items-start justify-between gap-3"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><span className="font-semibold">{p.name}</span><span className={"rounded-full px-2 py-0.5 text-[10px] font-semibold "+(p.tier==="A"?"bg-indigo-100 text-indigo-700":"bg-slate-100 text-slate-600")}>{tierLabel(p.tier)}</span></div><div className="mt-1 text-xs text-slate-500">{p.category} · {p.subcategory}</div></div><div className="text-right"><div className="text-2xl font-semibold tabular-nums">{p.score}</div><div className="text-[10px] uppercase tracking-wide text-slate-400">Fit score</div></div></div>
              <p className="mt-3 line-clamp-2 text-sm leading-6 text-slate-600">{p.signal}</p>
              <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs"><span className="text-slate-400">AI Visibility: <strong className="font-medium text-amber-700">{p.aiStatus}</strong></span><span className="font-medium text-indigo-700">View prospect →</span></div>
            </button>)}
            {filtered.length===0&&<div className="p-10 text-center text-sm text-slate-500">No prospects match these filters.</div>}
          </div>
        </section>
        <aside className="space-y-5">
          {selected ? <section className="rounded-2xl border border-slate-200 bg-white p-5">
            <div className="text-xs font-semibold uppercase tracking-wider text-indigo-600">Prospect intelligence</div><h2 className="mt-2 text-xl font-semibold">{selected.name}</h2><div className="mt-1 text-sm text-slate-500">{selected.category} · {selected.subcategory}</div>
            <div className="mt-5 grid grid-cols-2 gap-3"><div className="rounded-xl bg-slate-50 p-3"><div className="text-xs text-slate-500">Prospect score</div><div className="mt-1 text-2xl font-semibold">{selected.score}/100</div></div><div className="rounded-xl bg-slate-50 p-3"><div className="text-xs text-slate-500">AI visibility</div><div className="mt-1 text-lg font-semibold text-amber-700">Not tested</div></div></div>
            <div className="mt-5"><div className="text-xs font-semibold uppercase tracking-wide text-slate-400">Public signal</div><p className="mt-2 text-sm leading-6 text-slate-700">{selected.signal}</p></div>
            <div className="mt-5"><div className="text-xs font-semibold uppercase tracking-wide text-slate-400">Why it fits</div><p className="mt-2 text-sm leading-6 text-slate-700">{selected.fit}</p></div>
            <div className="mt-5"><div className="text-xs font-semibold uppercase tracking-wide text-slate-400">Recommended next action</div><p className="mt-2 text-sm font-medium text-slate-800">{selected.nextAction}</p></div>
            <div className="mt-5 flex flex-wrap gap-2">{selected.website&&<a href={selected.website} target="_blank" rel="noreferrer" className="rounded-lg bg-slate-900 px-3 py-2 text-xs font-semibold text-white">Website ↗</a>}<a href={selected.sourceUrl} target="_blank" rel="noreferrer" className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700">Open source ↗</a></div>
            <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-900">Research lead only. Verify operating status, decision-maker, website ownership and current commercial activity before outreach. The score is a prioritisation heuristic, not measured AI performance.</div>
          </section> : null}
          <section className="rounded-2xl border border-slate-200 bg-white p-5"><h3 className="font-semibold">Qualification checklist</h3><ul className="mt-3 space-y-2 text-sm text-slate-600">{["Active business and current offer verified","Website and Google Business Profile checked","Founder / marketing decision-maker identified","Reviews and social activity sampled","AI prompt benchmark completed","HubSpot company and deal created"].map(x=><li key={x} className="flex gap-2"><span className="text-slate-300">○</span>{x}</li>)}</ul></section>
        </aside>
      </div>
      <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-5"><h2 className="font-semibold">Next modules</h2><div className="mt-3 grid gap-3 md:grid-cols-3">{[["01 · Discovery","Import Startup MP, Maps and local directory leads with source provenance."],["02 · Qualification","Score ICP fit, buying signals, growth stage and audit readiness."],["03 · AI benchmark","Run controlled prompts across ChatGPT, Gemini and Perplexity; store mentions and citations."]].map(([h,d])=><div key={h} className="rounded-xl bg-slate-50 p-4"><div className="text-sm font-semibold">{h}</div><p className="mt-2 text-sm leading-6 text-slate-500">{d}</p></div>)}</div></section>
      <footer className="mt-6 text-xs leading-5 text-slate-400">Seed data is a manually curated research sample, not a live scrape. Startup descriptions are based on public ecosystem records; business ratings are time-sensitive third-party listing snapshots. AI visibility has not yet been tested. Last research refresh: 11 Nov 2026.</footer>
    </div>
  </main>;
}
