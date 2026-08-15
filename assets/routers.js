(() => {
  'use strict';
  const app = document.getElementById('routerApp');
  const sync = document.getElementById('routerSync');
  let payload = null;
  let page = 1;
  const PAGE_SIZE = 100;

  const esc = value => String(value ?? '—')
    .replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;')
    .replaceAll('"','&quot;').replaceAll("'",'&#039;');
  const num = value => typeof value === 'number' && Number.isFinite(value) ? value : null;
  const money = value => num(value) === null ? '—' : `$${value.toLocaleString('fr-FR',{maximumFractionDigits:6})}`;
  const badge = (text, cls='') => `<span class="badge ${cls}">${esc(text)}</span>`;
  const source = url => url ? `<a class="source-link" href="${esc(url)}" target="_blank" rel="noopener">API ↗</a>` : '—';
  const isQwen = row => `${row.model_id||''} ${row.name||''} ${row.owned_by||''}`.toLowerCase().includes('qwen');
  const modal = value => Array.isArray(value) ? value.join(', ') : (value || '—');

  function metric(label,value){ return `<div class="metric"><span class="value">${esc(value)}</span><span class="label">${esc(label)}</span></div>`; }
  function table(headers,rows){
    if(!rows.length) return '<div class="empty">Aucune donnée correspondante.</div>';
    return `<div class="table-wrap"><table><thead><tr>${headers.map(h=>`<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>${rows.join('')}</tbody></table></div>`;
  }
  function options(values,label){
    return `<option value="">${esc(label)}</option>${[...new Set(values.filter(Boolean))].sort().map(v=>`<option value="${esc(v)}">${esc(v)}</option>`).join('')}`;
  }
  function renderShell(){
    const t=payload.totals||{}, g=payload.gateways||{};
    app.innerHTML = `
      <section class="hero"><div class="hero-card"><p class="eyebrow">Inventaire exhaustif des gateways</p><h1>OpenRouter & Kilo</h1><p class="lead">Tous les modèles actuellement exposés par leurs APIs publiques, avec recherche Qwen, prix, contexte et variantes explicitement gratuites.</p></div><div class="hero-card hero-status"><span class="kicker">Dernier inventaire</span><strong>${esc(new Date(payload.checked_at).toLocaleString('fr-FR',{dateStyle:'medium',timeStyle:'short',timeZone:'Europe/Paris'}))}</strong><span class="kicker" style="margin-top:12px">Sources</span><strong>OpenRouter API + Kilo Gateway API</strong></div></section>
      <section class="metrics">${metric('Entrées routeurs',t.catalog_entries??'—')}${metric('IDs uniques',t.unique_model_ids??'—')}${metric('Qwen',t.qwen_entries??'—')}${metric('Gratuits explicites',t.free_entries??'—')}${metric('Kilo',g.kilo?.model_count??'—')}${metric('OpenRouter',g.openrouter?.model_count??'—')}</section>
      <section class="panel"><div class="panel-header"><div><h2>Catalogue courant</h2><p>Une même famille peut apparaître plusieurs fois : gateway, variante et pricing sont volontairement conservés.</p></div></div>
        <div class="toolbar">
          <input id="rq" class="control" type="search" placeholder="Qwen, Gemini, Nemotron, modèle…" aria-label="Rechercher un modèle">
          <select id="rgateway" class="control">${options((payload.models||[]).map(x=>x.gateway),'Tous gateways')}</select>
          <select id="rowner" class="control">${options((payload.models||[]).map(x=>x.owned_by),'Tous développeurs')}</select>
          <select id="rfilter" class="control"><option value="all">Tous les modèles</option><option value="qwen">Qwen uniquement</option><option value="free">Gratuits maintenant</option><option value="qwen-free">Qwen gratuits</option></select>
          <select id="rsort" class="control"><option value="name">Trier : modèle</option><option value="input">Input croissant</option><option value="output">Output croissant</option><option value="context">Contexte décroissant</option></select>
        </div>
        <div id="routerResult"></div>
      </section>
      <div class="notice"><strong>Gratuit</strong> signifie ici une variante <code>:free</code> ou un routeur explicitement free. Un prix token nul n’est pas automatiquement interprété comme gratuit, car certaines modalités sont facturées autrement.</div>
      <section class="grid-2" style="margin-top:18px">
        <div class="rank-card"><h3>Kilo</h3><span class="rank-main">${esc(g.kilo?.free_model_count??'—')} gratuits · ${esc(g.kilo?.qwen_model_count??'—')} Qwen</span><span class="rank-sub">${source(g.kilo?.source_url)}</span></div>
        <div class="rank-card"><h3>OpenRouter</h3><span class="rank-main">${esc(g.openrouter?.free_model_count??'—')} gratuits · ${esc(g.openrouter?.qwen_model_count??'—')} Qwen</span><span class="rank-sub">${source(g.openrouter?.source_url)}</span></div>
      </section>`;
    ['rq','rgateway','rowner','rfilter','rsort'].forEach(id=>document.getElementById(id).addEventListener(id==='rq'?'input':'change',()=>{page=1;renderRows();}));
    renderRows();
  }

  function filtered(){
    const q=document.getElementById('rq').value.trim().toLowerCase();
    const gateway=document.getElementById('rgateway').value;
    const owner=document.getElementById('rowner').value;
    const filter=document.getElementById('rfilter').value;
    const sort=document.getElementById('rsort').value;
    let rows=(payload.models||[]).filter(x =>
      (!gateway || x.gateway===gateway) && (!owner || x.owned_by===owner) &&
      (!q || `${x.model_id} ${x.name} ${x.owned_by||''}`.toLowerCase().includes(q)) &&
      (filter==='all' || (filter==='qwen'&&isQwen(x)) || (filter==='free'&&x.free_now) || (filter==='qwen-free'&&x.free_now&&isQwen(x)))
    );
    rows=[...rows].sort((a,b)=>{
      if(sort==='input') return (num(a.prompt_per_1m)??Infinity)-(num(b.prompt_per_1m)??Infinity) || String(a.name).localeCompare(String(b.name));
      if(sort==='output') return (num(a.completion_per_1m)??Infinity)-(num(b.completion_per_1m)??Infinity) || String(a.name).localeCompare(String(b.name));
      if(sort==='context') return (num(b.context_length)??-1)-(num(a.context_length)??-1) || String(a.name).localeCompare(String(b.name));
      return String(a.name).localeCompare(String(b.name)) || String(a.gateway).localeCompare(String(b.gateway));
    });
    return rows;
  }

  function renderRows(){
    const rows=filtered();
    const pages=Math.max(1,Math.ceil(rows.length/PAGE_SIZE));
    page=Math.min(page,pages);
    const slice=rows.slice((page-1)*PAGE_SIZE,page*PAGE_SIZE);
    const body=slice.map(x=>`<tr><td><strong>${esc(x.name)}</strong><br><span class="muted">${esc(x.model_id)}</span></td><td>${badge(x.gateway,x.gateway==='kilo'?'good':'')}</td><td>${esc(x.owned_by||'—')}</td><td>${x.free_now?badge('FREE','good'):'—'}</td><td class="num">${money(x.prompt_per_1m)}</td><td class="num">${money(x.completion_per_1m)}</td><td class="num">${money(x.cache_read_per_1m)}</td><td>${esc(x.context_length??'—')}</td><td>${esc(x.max_completion_tokens??'—')}</td><td>${esc(modal(x.input_modalities))}</td><td>${source(x.source_url)}</td></tr>`);
    const pager=`<div class="toolbar" style="justify-content:space-between;margin-top:12px"><span class="muted"><strong>${rows.length}</strong> résultat(s) · page ${page}/${pages}</span><span><button id="prevPage" class="control" ${page<=1?'disabled':''}>← Précédent</button> <button id="nextPage" class="control" ${page>=pages?'disabled':''}>Suivant →</button></span></div>`;
    document.getElementById('routerResult').innerHTML=table(['Modèle','Gateway','Développeur','Gratuit','Input / 1M','Output / 1M','Cache / 1M','Contexte','Sortie max','Entrées','Source'],body)+pager;
    document.getElementById('prevPage').addEventListener('click',()=>{if(page>1){page--;renderRows();window.scrollTo({top:300,behavior:'smooth'});}});
    document.getElementById('nextPage').addEventListener('click',()=>{if(page<pages){page++;renderRows();window.scrollTo({top:300,behavior:'smooth'});}});
  }

  fetch('data/router-catalogs.json',{cache:'no-store'})
    .then(r=>{if(!r.ok) throw new Error(`HTTP ${r.status}`); return r.json();})
    .then(json=>{payload=json; sync.textContent=`Routeurs · ${json.totals?.catalog_entries??'—'} entrées`; renderShell();})
    .catch(err=>{sync.textContent='Catalogue routeur indisponible'; app.innerHTML=`<section class="loading-card"><h1>Catalogue indisponible</h1><p>${esc(err.message)}</p><p>Le dernier snapshot principal reste disponible depuis <a href="index.html">l’observatoire</a>.</p></section>`;});
})();
