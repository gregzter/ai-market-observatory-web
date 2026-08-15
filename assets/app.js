(() => {
  'use strict';

  const app = document.getElementById('app');
  const syncStatus = document.getElementById('syncStatus');
  let data = null;

  const esc = (value) => String(value ?? '—')
    .replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;').replaceAll("'", '&#039;');
  const num = (value) => typeof value === 'number' && Number.isFinite(value) ? value : null;
  const money = (value, currency = 'USD') => {
    const n = num(value);
    if (n === null) return '—';
    const symbols = { USD: '$', CNY: '¥', EUR: '€', INR: '₹' };
    return `${symbols[currency] || `${currency} `}${n.toLocaleString('fr-FR', { maximumFractionDigits: 6 })}`;
  };
  const compact = (value) => {
    if (value === null || value === undefined || value === '') return '—';
    if (Array.isArray(value)) return value.join(', ');
    if (typeof value === 'object') return JSON.stringify(value);
    return String(value);
  };
  const when = (value) => {
    if (!value) return '—';
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? String(value) : d.toLocaleString('fr-FR', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Europe/Paris' });
  };
  const source = (url) => url && /^https?:\/\//.test(url)
    ? `<a class="source-link" href="${esc(url)}" target="_blank" rel="noopener">source ↗</a>` : '—';
  const badge = (text, type = '') => `<span class="badge ${type}">${esc(text)}</span>`;
  const statusType = (value) => {
    const s = String(value || '').toUpperCase();
    if (s.includes('PASS') || s === 'ACTIVE' || s === 'VERIFIED' || s === 'SOURCE_OK') return 'good';
    if (s.includes('FAIL') || s.includes('ERROR') || s.includes('DEPRECATED') || s.includes('PARSER')) return 'bad';
    return 'warn';
  };
  const table = (headers, rows) => {
    if (!rows.length) return '<div class="empty">Aucune donnée correspondante.</div>';
    return `<div class="table-wrap"><table><thead><tr>${headers.map(h => `<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>${rows.join('')}</tbody></table></div>`;
  };
  const metric = (label, value) => `<div class="metric"><span class="value">${esc(value)}</span><span class="label">${esc(label)}</span></div>`;
  const panel = (title, body, subtitle = '') => `<section class="panel"><div class="panel-header"><div><h2>${esc(title)}</h2>${subtitle ? `<p>${esc(subtitle)}</p>` : ''}</div></div>${body}</section>`;
  const controls = (items) => `<div class="toolbar">${items.join('')}</div>`;
  const optionList = (values, label = 'Tous') => `<option value="">${esc(label)}</option>${[...new Set(values.filter(Boolean))].sort().map(v => `<option value="${esc(v)}">${esc(v)}</option>`).join('')}`;

  function route() {
    const name = (location.hash || '#overview').slice(1).split('?')[0];
    return ['overview','pricing','value','subscriptions','promotions','benchmarks','models','sources'].includes(name) ? name : 'overview';
  }

  function setActiveNav(name) {
    document.querySelectorAll('[data-route]').forEach(a => a.classList.toggle('active', a.dataset.route === name));
  }

  function header(title, text, eyebrow = 'AI Market Observatory') {
    const r = data.latest_daily || {};
    return `<section class="hero"><div class="hero-card"><p class="eyebrow">${esc(eyebrow)}</p><h1>${esc(title)}</h1><p class="lead">${esc(text)}</p></div><div class="hero-card hero-status"><span class="kicker">Dernier run quotidien</span><span class="run-id">${esc(r.run_id || '—')}</span><div style="margin-top:10px">${badge(r.validation_status || 'UNKNOWN', statusType(r.validation_status))}</div><span class="kicker" style="margin-top:12px">Snapshot généré</span><strong>${esc(when(data.generated_at))}</strong></div></section>`;
  }

  function overview() {
    const c = data.counts || {};
    const r = data.latest_daily || {};
    const events = (data.events || []).slice(0, 8);
    const currentUsd = (data.pricing || []).filter(p => p.price_status === 'CURRENT' && p.currency_original === 'USD' && p.unit === 'PER_1M_TOKENS' && p.verification_status === 'VERIFIED');
    const cheapestInput = [...currentUsd].filter(p => num(p.price_input_original) !== null).sort((a,b) => a.price_input_original-b.price_input_original)[0];
    const cheapestOutput = [...currentUsd].filter(p => num(p.price_output_original) !== null).sort((a,b) => a.price_output_original-b.price_output_original)[0];
    const activePromos = (data.promotions || []).filter(p => p.status === 'ACTIVE');
    const attention = data.source_health?.attention || [];

    const eventHtml = events.length ? `<div class="event-list">${events.map(e => `<article class="event"><time>${esc(when(e.detected_at))}</time><strong>${esc(e.event_type)} · ${esc(e.entity_id)}</strong><p>${esc(e.summary)}</p></article>`).join('')}</div>` : '<div class="empty">Aucun événement enregistré.</div>';
    const runRows = [[
      r.sources_due, r.sources_checked, r.sources_successful, r.sources_failed,
      r.new_sources, r.changes_detected, badge(r.validation_status || '—', statusType(r.validation_status))
    ]].map(x => `<tr>${x.map(v => `<td>${v}</td>`).join('')}</tr>`);

    app.innerHTML = header('Le marché IA, sans le bruit marketing', 'Prix API, abonnements, promotions, benchmarks, modèles et providers suivis quotidiennement à partir de sources vérifiées.') +
      `<section class="metrics">${metric('Sources', c.sources ?? '—')}${metric('Modèles', c.models ?? '—')}${metric('Providers', c.providers ?? '—')}${metric('Prix', c.pricing ?? '—')}${metric('Observations', c.observations ?? '—')}</section>` +
      `<section class="grid-3"><div class="rank-card"><h3>Input USD le moins cher</h3>${cheapestInput ? `<span class="rank-main">${esc(cheapestInput.model)}</span><span class="rank-sub">${esc(cheapestInput.provider)} · ${money(cheapestInput.price_input_original)}/1M</span>` : '—'}</div><div class="rank-card"><h3>Output USD le moins cher</h3>${cheapestOutput ? `<span class="rank-main">${esc(cheapestOutput.model)}</span><span class="rank-sub">${esc(cheapestOutput.provider)} · ${money(cheapestOutput.price_output_original)}/1M</span>` : '—'}</div><div class="rank-card"><h3>Promotions actives</h3><span class="rank-main">${activePromos.length}</span><span class="rank-sub">${attention.length} source(s) nécessitent de l’attention</span></div></section>` +
      `<section class="grid-2">${panel('Derniers événements', eventHtml, 'Historique vérifié et changements détectés')}${panel('Santé du dernier run', table(['Dues','Contrôlées','Succès','Échecs','Nouvelles sources','Changements','Validation'], runRows), 'Télémétrie du collecteur quotidien')}</section>` +
      `<div class="notice">Les classements de prix ne mélangent jamais les devises et n’inventent pas de conversion. Les promotions incomplètement documentées restent explicitement non confirmées.</div>`;
  }

  function pricing() {
    const rows = data.pricing || [];
    app.innerHTML = header('Prix API', 'Compare les prix publiés, les conditions de contexte/cache et les changements à venir.', 'Tarification') +
      panel('Tarifs', controls([
        `<input id="q" class="control" type="search" placeholder="Modèle, provider…" aria-label="Rechercher">`,
        `<select id="priceStatus" class="control">${optionList(rows.map(x=>x.price_status), 'Tous statuts')}</select>`,
        `<select id="currency" class="control">${optionList(rows.map(x=>x.currency_original), 'Toutes devises')}</select>`,
        `<select id="provider" class="control">${optionList(rows.map(x=>x.provider), 'Tous providers')}</select>`,
        `<select id="sort" class="control"><option value="model">Trier : modèle</option><option value="input">Input croissant</option><option value="output">Output croissant</option><option value="cache">Cache croissant</option></select>`
      ]) + `<div id="priceTable"></div>`, 'Données canoniques dérivées, sans conversion implicite');
    const render = () => {
      const q = document.getElementById('q').value.toLowerCase();
      const st = document.getElementById('priceStatus').value;
      const cur = document.getElementById('currency').value;
      const prov = document.getElementById('provider').value;
      const sort = document.getElementById('sort').value;
      let list = rows.filter(x => (!st || x.price_status===st) && (!cur || x.currency_original===cur) && (!prov || x.provider===prov) && (!q || `${x.model} ${x.provider} ${x.model_id}`.toLowerCase().includes(q)));
      const key = { input:'price_input_original', output:'price_output_original', cache:'price_cached_input_original' }[sort];
      list = [...list].sort(key ? (a,b) => (num(a[key]) ?? Infinity)-(num(b[key]) ?? Infinity) : (a,b) => String(a.model).localeCompare(String(b.model)));
      const body = list.map(x => `<tr><td><strong>${esc(x.model)}</strong><br><span class="muted">${esc(x.model_id)}</span></td><td>${esc(x.provider)}<br><span class="muted">${esc(x.provider_country || '—')}</span></td><td>${esc(x.currency_original)}</td><td class="num">${money(x.price_input_original, x.currency_original)}</td><td class="num">${money(x.price_output_original, x.currency_original)}</td><td class="num">${money(x.price_cached_input_original, x.currency_original)}</td><td>${badge(x.price_status, statusType(x.price_status))}</td><td>${esc(compact(x.conditions))}</td><td>${esc(x.effective_from || '—')}</td><td>${source(x.source_url)}</td></tr>`);
      document.getElementById('priceTable').innerHTML = table(['Modèle','Provider','Devise','Input / 1M','Output / 1M','Cache / 1M','Statut','Conditions','Effectif','Preuve'], body);
    };
    ['q','priceStatus','currency','provider','sort'].forEach(id => document.getElementById(id).addEventListener(id==='q'?'input':'change', render));
    render();
  }

  function value() {
    const usd = (data.pricing || []).filter(p => p.price_status==='CURRENT' && p.currency_original==='USD' && p.unit==='PER_1M_TOKENS' && p.verification_status==='VERIFIED');
    const rank = (key, label) => {
      const list = [...usd].filter(x => num(x[key]) !== null).sort((a,b)=>a[key]-b[key]).slice(0,10);
      return `<div class="rank-card"><h3>${esc(label)}</h3><ol>${list.map(x=>`<li><span class="rank-main">${esc(x.model)}</span><span class="rank-sub">${esc(x.provider)} · ${money(x[key])}/1M</span></li>`).join('')}</ol></div>`;
    };
    const upcoming = (data.pricing || []).filter(p=>p.price_status==='UPCOMING').sort((a,b)=>String(a.effective_from).localeCompare(String(b.effective_from)));
    const upcomingRows = upcoming.map(x=>`<tr><td>${esc(x.effective_from)}</td><td><strong>${esc(x.model)}</strong></td><td>${esc(x.provider)}</td><td>${esc(compact(x.conditions))}</td><td>${money(x.price_input_original,x.currency_original)}</td><td>${money(x.price_output_original,x.currency_original)}</td><td>${money(x.price_cached_input_original,x.currency_original)}</td><td>${source(x.source_url)}</td></tr>`);
    const byModel = new Map();
    usd.forEach(x => { const a=byModel.get(x.model_id)||[]; a.push(x); byModel.set(x.model_id,a); });
    const compare = [...byModel.values()].filter(a=>a.length>1).flat().sort((a,b)=>String(a.model).localeCompare(String(b.model)) || (num(a.price_input_original)??Infinity)-(num(b.price_input_original)??Infinity));
    const compareRows = compare.map(x=>`<tr><td><strong>${esc(x.model)}</strong></td><td>${esc(x.provider)}</td><td>${money(x.price_input_original)}</td><td>${money(x.price_output_original)}</td><td>${money(x.price_cached_input_original)}</td><td>${esc(compact(x.conditions))}</td></tr>`);
    app.innerHTML = header('Value Board', 'Des classements dimension par dimension. Aucun score qualité/prix opaque : coût API, benchmark et abonnement restent séparés.', 'Rapport valeur / prix') +
      `<section class="grid-3">${rank('price_input_original','Input USD / 1M')}${rank('price_output_original','Output USD / 1M')}${rank('price_cached_input_original','Cached input USD / 1M')}</section>` +
      panel('Offres et paliers comparables pour un même modèle', table(['Modèle','Provider','Input','Output','Cache','Conditions'], compareRows), 'Plusieurs providers ou plusieurs paliers tarifaires') +
      `<div style="height:18px"></div>` + panel('Prix vérifiés à venir', table(['Effectif','Modèle','Provider','Conditions','Input','Output','Cache','Preuve'], upcomingRows));
  }

  function subscriptions() {
    const rows = data.subscriptions || [];
    app.innerHTML = header('Abonnements', 'Plans grand public et développeur, quotas, accès CLI et accès tiers documentés.', 'Forfaits') + panel('Plans documentés', controls([
      `<input id="q" class="control" type="search" placeholder="Provider, plan, produit…">`,
      `<select id="currency" class="control">${optionList(rows.map(x=>x.currency), 'Toutes devises')}</select>`
    ]) + `<div id="subTable"></div>`);
    const render=()=>{
      const q=document.getElementById('q').value.toLowerCase(), cur=document.getElementById('currency').value;
      const list=rows.filter(x=>(!cur||x.currency===cur)&&(!q||`${x.provider} ${x.plan_name} ${x.product}`.toLowerCase().includes(q))).sort((a,b)=>String(a.currency).localeCompare(String(b.currency)) || (num(a.monthly_price)??Infinity)-(num(b.monthly_price)??Infinity));
      const body=list.map(x=>`<tr><td><strong>${esc(x.provider)}</strong></td><td>${esc(x.product)} · ${esc(x.plan_name)}</td><td class="num">${money(x.monthly_price,x.currency)}</td><td>${esc(compact(x.weekly_limits || x.hourly_limits || x.model_specific_limits))}</td><td>${esc(compact(x.models_available))}</td><td>${esc(x.cli_access || '—')}</td><td>${esc(x.third_party_access || '—')}</td><td>${source(x.source_url)}</td></tr>`);
      document.getElementById('subTable').innerHTML=table(['Provider','Plan','Prix/mois','Limites','Modèles','CLI','Accès tiers','Preuve'],body);
    };
    ['q','currency'].forEach(id=>document.getElementById(id).addEventListener(id==='q'?'input':'change',render)); render();
  }

  function promotions() {
    const rows=data.promotions||[];
    app.innerHTML=header('Promotions', 'Offres actives, expirations et promotions observées dont les termes restent incomplets.', 'Offres')+panel('Promotions suivies', controls([`<input id="q" class="control" type="search" placeholder="Provider, offre…">`,`<select id="promoStatus" class="control">${optionList(rows.map(x=>x.status),'Tous statuts')}</select>`])+`<div id="promoTable"></div>`);
    const render=()=>{
      const q=document.getElementById('q').value.toLowerCase(),st=document.getElementById('promoStatus').value;
      const list=rows.filter(x=>(!st||x.status===st)&&(!q||`${x.provider} ${x.offer}`.toLowerCase().includes(q)));
      const body=list.map(x=>`<tr><td><strong>${esc(x.provider)}</strong></td><td>${esc(x.offer)}</td><td>${badge(x.status,statusType(x.status))}</td><td>${esc(compact(x.promo_price))}</td><td>${esc(x.end_date||'—')}</td><td>${esc(x.eligibility||'—')}</td><td>${esc(x.notes||'—')}</td><td>${source(x.source_url)}</td></tr>`);
      document.getElementById('promoTable').innerHTML=table(['Provider','Offre','Statut','Prix promo','Fin','Éligibilité','Notes','Preuve'],body);
    }; ['q','promoStatus'].forEach(id=>document.getElementById(id).addEventListener(id==='q'?'input':'change',render)); render();
  }

  function benchmarks() {
    const rows=[...(data.benchmarks||[])].sort((a,b)=>(num(b.score)??-Infinity)-(num(a.score)??-Infinity));
    const body=rows.map(x=>`<tr><td><strong>${esc(x.model)}</strong></td><td>${esc(x.benchmark)} ${esc(x.benchmark_version)}</td><td class="num">${esc(x.score)} ${esc(x.unit)}</td><td class="num">${money(x.measured_task_cost_usd)}</td><td class="num">${money(x.measured_cost_per_task_usd)}</td><td>${esc(x.number_of_tasks)}</td><td>${esc(x.agent_harness||'—')}</td><td>${esc(x.first_party_or_independent||'—')}</td><td>${source(x.source_url)}</td></tr>`);
    app.innerHTML=header('Benchmarks', 'Scores et coûts mesurés sont affichés séparément afin de ne pas transformer un benchmark en score universel.', 'Performances')+panel('Résultats documentés',table(['Modèle','Benchmark','Score','Coût total','Coût/tâche','Tâches','Harness','Origine','Preuve'],body));
  }

  function models() {
    const rows=data.models||[];
    app.innerHTML=header('Modèles', 'Catalogue courant des releases suivies : statut, contexte, poids ouverts et provenance.', 'Catalogue')+panel('Modèles suivis',controls([`<input id="q" class="control" type="search" placeholder="Modèle, développeur, famille…">`,`<select id="developer" class="control">${optionList(rows.map(x=>x.developer),'Tous développeurs')}</select>`])+`<div id="modelTable"></div>`);
    const render=()=>{
      const q=document.getElementById('q').value.toLowerCase(),dev=document.getElementById('developer').value;
      const list=rows.filter(x=>(!dev||x.developer===dev)&&(!q||`${x.display_name} ${x.developer} ${x.family}`.toLowerCase().includes(q)));
      const body=list.map(x=>`<tr><td><strong>${esc(x.display_name)}</strong><br><span class="muted">${esc(x.model_id)}</span></td><td>${esc(x.developer)}</td><td>${esc(x.family||'—')}</td><td>${badge(x.status,statusType(x.status))}</td><td>${x.open_weights===true?'Oui':x.open_weights===false?'Non':'—'}</td><td class="num">${esc(x.context_window??'—')}</td><td>${esc(x.release_date||x.announcement_date||'—')}</td><td>${badge(x.verification_status||'—',statusType(x.verification_status))}</td><td>${source(x.source_url)}</td></tr>`);
      document.getElementById('modelTable').innerHTML=table(['Modèle','Développeur','Famille','Statut','Open weights','Contexte','Date','Vérification','Preuve'],body);
    }; ['q','developer'].forEach(id=>document.getElementById(id).addEventListener(id==='q'?'input':'change',render)); render();
  }

  function sources() {
    const counts=data.source_health?.counts||{}, attention=data.source_health?.attention||[];
    const countCards=Object.entries(counts).map(([k,v])=>metric(k,v)).join('');
    const body=attention.map(x=>`<tr><td><strong>${esc(x.source_id)}</strong><br><span class="muted">${esc(x.organization)}</span></td><td>${esc(x.source_type)}</td><td>${badge(x.source_health,statusType(x.source_health))}</td><td class="num">${esc(x.consecutive_failures??0)}</td><td>${esc(when(x.last_success))}</td><td>${esc(when(x.next_check))}</td><td>${source(x.url)}</td></tr>`);
    app.innerHTML=header('Santé des sources', 'Les erreurs de parsing ou déplacements sont conservés comme état de santé ; une source en échec n’est jamais supprimée automatiquement.', 'Provenance')+`<section class="metrics">${countCards}</section>`+panel('Sources nécessitant de l’attention',table(['Source','Type','État','Échecs','Dernier succès','Prochain contrôle','URL'],body));
  }

  const renderers={overview,pricing,value,subscriptions,promotions,benchmarks,models,sources};
  function render() { if(!data) return; const r=route(); setActiveNav(r); renderers[r](); app.focus({preventScroll:true}); }

  async function boot() {
    try {
      const response=await fetch('./data/snapshot.json',{cache:'no-store'});
      if(!response.ok) throw new Error(`HTTP ${response.status}`);
      data=await response.json();
      syncStatus.textContent=`Run ${data.generated_from_run_id||'—'}`;
      syncStatus.classList.add('ok');
      render();
    } catch (error) {
      console.error(error);
      syncStatus.textContent='Snapshot indisponible'; syncStatus.classList.add('err');
      app.innerHTML=`<section class="loading-card"><h1>Données indisponibles</h1><p>Le frontend est chargé, mais <code>data/snapshot.json</code> n’est pas encore accessible. Le prochain cycle de publication réessaiera automatiquement.</p></section>`;
    }
  }

  window.addEventListener('hashchange',render);
  boot();
})();
