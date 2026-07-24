(()=>{
  const D=window.POLICE_DATA;
  if(!D)return;
  const pid=document.body.dataset.person;
  if(!pid)return;

  const P=D.persons[pid], A=D.accounts, T=D.transactions;
  let current=P.accounts[0];
  let analysisActive=false;
  const q=s=>document.querySelector(s);
  const money=n=>new Intl.NumberFormat('cs-CZ',{style:'currency',currency:'CZK',maximumFractionDigits:0}).format(n);
  const dateFmt=s=>new Intl.DateTimeFormat('cs-CZ').format(new Date(s+'T12:00:00'));
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));

  q('#personName').textContent=P.name;
  q('#personRole').textContent=P.role;

  function accountOption(id){
    const a=A[id];
    return `${D.persons[a.person].name} – ${a.number} (${a.bank})`;
  }

  function buildTabs(){
    q('#accountTabs').innerHTML=P.accounts.map(id=>`<button class="account-tab ${id===current?'active':''}" data-account="${id}">${esc(A[id].number)}<small>${esc(A[id].bank)}</small></button>`).join('');
    document.querySelectorAll('.account-tab').forEach(b=>b.onclick=()=>{
      current=b.dataset.account;
      buildTabs();
      buildSelectors();
      render();
      clearAnalysis();
      updateAnalysisContext();
    });
  }

  function buildSelectors(){
    const allowed=Object.keys(A).filter(id=>A[id].person!==pid);
    q('#compareAccount').innerHTML=allowed.map(id=>`<option value="${id}">${esc(accountOption(id))}</option>`).join('');
  }

  function filtered(){
    const dir=q('#directionFilter').value;
    const term=q('#partyFilter').value.trim().toLocaleLowerCase('cs');
    const from=q('#dateFrom').value||D.meta.periodFrom;
    const to=q('#dateTo').value||D.meta.periodTo;
    return T[current].filter(t=>(dir==='all'||t.direction===dir)&&t.date>=from&&t.date<=to&&(term.length<3||(`${t.counterparty} ${t.counterpartyAccount}`.toLocaleLowerCase('cs').includes(term))));
  }

  function render(){
    const a=A[current], all=T[current], rows=filtered();
    q('#accountLabel').textContent=a.label;
    q('#accountMeta').textContent=`${a.number} (${a.bank})`;
    q('#currentBalance').innerHTML=`${money(all[0].balance)}<small>zůstatek k 16. 6. 2026</small>`;
    const sin=all.filter(x=>x.direction==='in').reduce((s,x)=>s+x.amount,0);
    const sout=all.filter(x=>x.direction==='out').reduce((s,x)=>s+x.amount,0);
    q('#sumIn').textContent=money(sin);
    q('#sumOut').textContent=money(sout);
    q('#txCount').textContent=all.length.toLocaleString('cs-CZ');
    q('#statusline').textContent=`Zobrazeno ${rows.length} z ${all.length} transakcí · období ${dateFmt(q('#dateFrom').value)} – ${dateFmt(q('#dateTo').value)}`;
    q('#txBody').innerHTML=rows.length?rows.map(t=>`<tr>
      <td><strong>${dateFmt(t.date)}</strong><div class="sub">${esc(t.id)}</div></td>
      <td><span class="tag">${esc(t.type)}</span><div class="sub">${esc(t.channel)}${t.location?' · '+esc(t.location):''}</div></td>
      <td><div class="cp">${esc(t.counterparty)}</div><div class="sub">${esc(t.counterpartyAccount||'karetní obchodník')}${t.counterpartyBank?' · '+esc(t.counterpartyBank):''}</div></td>
      <td>${esc(t.note||'—')}<div class="sub">${t.variableSymbol?'VS '+esc(t.variableSymbol):'bez variabilního symbolu'}</div></td>
      <td class="amount ${t.direction}">${t.direction==='in'?'+':'−'} ${money(t.amount)}</td>
      <td class="amount">${money(t.balance)}</td>
    </tr>`).join(''):`<tr><td colspan="6" class="empty">Zadaným filtrům neodpovídají žádné transakce.</td></tr>`;
  }

  function updateAnalysisContext(){
    const a=A[current];
    q('#analysisSource').innerHTML=`<strong>${esc(P.name)}</strong><span>${esc(a.number)} (${esc(a.bank)})</span>`;
  }

  function setAnalysisMode(active){
    analysisActive=active;
    q('#statementView').hidden=active;
    q('#analysisView').hidden=!active;
    q('#analysisToggle').hidden=active;
    q('#analysisExit').hidden=!active;
    q('#modeBadge').textContent=active?'ANALYTICKÝ REŽIM':'REŽIM BANKOVNÍHO VÝPISU';
    if(active){
      updateAnalysisContext();
      clearAnalysis();
      q('#analysisView').scrollIntoView({behavior:'smooth',block:'start'});
    }else{
      q('#statementView').scrollIntoView({behavior:'smooth',block:'start'});
    }
  }

  function clearAnalysis(){
    q('#analysisResults').innerHTML=`<div class="analysis-placeholder"><div class="analysis-symbol">⌁</div><h3>Zvolte typ analýzy a porovnávaný účet</h3><p>Systém porovnává právě otevřený účet pouze s účty jiných osob.</p></div>`;
    q('#analysisProgress').style.display='none';
  }

  function animate(done){
    const box=q('#analysisProgress'), bar=box.querySelector('i'), label=q('#analysisProgressLabel');
    box.style.display='block'; bar.style.width='0';
    let v=0;
    const phases=['Ověřování přístupových oprávnění…','Načítání bankovních záznamů…','Párování protistran a účtů…','Sestavování výsledku analýzy…'];
    label.textContent=phases[0];
    const timer=setInterval(()=>{
      v+=Math.floor(Math.random()*12)+5;
      if(v>25)label.textContent=phases[1];
      if(v>52)label.textContent=phases[2];
      if(v>78)label.textContent=phases[3];
      if(v>=100){
        v=100; clearInterval(timer);
        setTimeout(()=>{box.style.display='none';done();},260);
      }
      bar.style.width=v+'%';
    },85);
  }

  function txDetails(t){
    return `<div class="analysis-tx-meta"><span>${dateFmt(t.date)}</span><span>${esc(t.type)}</span><span>${esc(t.note||'Bez popisu')}</span>${t.variableSymbol?`<span>VS ${esc(t.variableSymbol)}</span>`:''}</div>`;
  }

  function renderMutual(other){
    const sa=A[current], oa=A[other];
    const sourceName=D.persons[sa.person].name, otherName=D.persons[oa.person].name;
    const transfers=[];

    T[current].forEach(t=>{
      if(t.counterpartyAccount!==oa.number)return;
      transfers.push({
        date:t.date, amount:t.amount, note:t.note, type:t.type, variableSymbol:t.variableSymbol,
        from:t.direction==='out'?current:other,
        to:t.direction==='out'?other:current,
        source:t
      });
    });
    T[other].forEach(t=>{
      if(t.counterpartyAccount!==sa.number)return;
      transfers.push({
        date:t.date, amount:t.amount, note:t.note, type:t.type, variableSymbol:t.variableSymbol,
        from:t.direction==='out'?other:current,
        to:t.direction==='out'?current:other,
        source:t
      });
    });

    const seen=new Set();
    const unique=transfers.filter(x=>{
      const key=`${x.date}|${x.amount}|${x.from}|${x.to}`;
      if(seen.has(key))return false;
      seen.add(key);return true;
    }).sort((a,b)=>b.date.localeCompare(a.date)||b.amount-a.amount);

    if(!unique.length){
      q('#analysisResults').innerHTML=`<div class="analysis-empty"><h3>Nebyly nalezeny žádné přímé převody</h3><p>Mezi účty ${esc(sa.number)} a ${esc(oa.number)} nejsou v dostupném období evidovány vzájemné transakce.</p></div>`;
      return;
    }

    const total=unique.reduce((s,x)=>s+x.amount,0);
    q('#analysisResults').innerHTML=`
      <div class="analysis-summary">
        <div><span>Typ analýzy</span><strong>Vzájemné transakce</strong></div>
        <div><span>Nalezené převody</span><strong>${unique.length}</strong></div>
        <div><span>Souhrnný objem</span><strong>${money(total)}</strong></div>
      </div>
      <div class="compare-heading"><div><strong>${esc(sourceName)}</strong><span>${esc(sa.number)}</span></div><div class="compare-link">PŘÍMÉ PŘEVODY</div><div><strong>${esc(otherName)}</strong><span>${esc(oa.number)}</span></div></div>
      <div class="transfer-list">${unique.map(x=>{
        const fromA=A[x.from], toA=A[x.to];
        const fromName=D.persons[fromA.person].name, toName=D.persons[toA.person].name;
        return `<article class="transfer-card">
          <div class="transfer-date">${dateFmt(x.date)}</div>
          <div class="flow-line">
            <div class="flow-person"><strong>${esc(fromName)}</strong><span>${esc(fromA.number)}</span></div>
            <div class="flow-arrow"><span>${money(x.amount)}</span><b>→</b></div>
            <div class="flow-person target"><strong>${esc(toName)}</strong><span>${esc(toA.number)}</span></div>
          </div>
          ${txDetails(x.source)}
        </article>`;
      }).join('')}</div>`;
  }

  function groupTransactions(accountId, excludedNumbers){
    const map=new Map();
    T[accountId].forEach(t=>{
      if(!t.counterpartyAccount||excludedNumbers.has(t.counterpartyAccount))return;
      const key=t.counterpartyAccount;
      if(!map.has(key))map.set(key,{name:t.counterparty,bank:t.counterpartyBank,tx:[]});
      map.get(key).tx.push(t);
    });
    return map;
  }

  function commonType(aTx,bTx){
    const aDirs=new Set(aTx.map(t=>t.direction)), bDirs=new Set(bTx.map(t=>t.direction));
    const shared=[];
    if(aDirs.has('out')&&bDirs.has('out'))shared.push('out');
    if(aDirs.has('in')&&bDirs.has('in'))shared.push('in');
    return shared;
  }

  function directionLabel(shared){
    if(shared.length===2)return 'Společný příjemce i odesílatel';
    return shared[0]==='out'?'Společný příjemce':'Společný odesílatel';
  }

  function sideTransactions(personName, account, party, txs, shared){
    const relevant=txs.filter(t=>shared.includes(t.direction)).sort((a,b)=>b.date.localeCompare(a.date));
    return `<div class="common-side">
      <div class="common-person"><strong>${esc(personName)}</strong><span>${esc(account.number)}</span></div>
      <div class="common-tx-list">${relevant.map(t=>`<div class="common-tx">
        <div class="mini-flow ${t.direction}">${t.direction==='out'?`<b>${esc(personName)}</b><i>→</i><b>${esc(party)}</b>`:`<b>${esc(party)}</b><i>→</i><b>${esc(personName)}</b>`}</div>
        <strong class="amount ${t.direction}">${t.direction==='in'?'+':'−'} ${money(t.amount)}</strong>
        ${txDetails(t)}
      </div>`).join('')}</div>
    </div>`;
  }

  function renderCommon(other){
    const sa=A[current], oa=A[other];
    const excluded=new Set([sa.number,oa.number]);
    const m1=groupTransactions(current,excluded), m2=groupTransactions(other,excluded);
    const common=[...m1.keys()].filter(k=>m2.has(k)).map(k=>{
      const a=m1.get(k), b=m2.get(k), shared=commonType(a.tx,b.tx);
      return {k,a,b,shared};
    }).filter(x=>x.shared.length).sort((x,y)=>{
      const ys=y.a.tx.filter(t=>y.shared.includes(t.direction)).length+y.b.tx.filter(t=>y.shared.includes(t.direction)).length;
      const xs=x.a.tx.filter(t=>x.shared.includes(t.direction)).length+x.b.tx.filter(t=>x.shared.includes(t.direction)).length;
      return ys-xs;
    });

    if(!common.length){
      q('#analysisResults').innerHTML=`<div class="analysis-empty"><h3>Nebyly nalezeny žádné shodné protistrany</h3><p>Oba účty nemají v dostupném období stejného příjemce ani stejného odesílatele.</p></div>`;
      return;
    }

    q('#analysisResults').innerHTML=`
      <div class="analysis-summary">
        <div><span>Typ analýzy</span><strong>Shodné protistrany</strong></div>
        <div><span>Nalezené shody</span><strong>${common.length}</strong></div>
        <div><span>Porovnávané účty</span><strong>2</strong></div>
      </div>
      <div class="common-list">${common.map(g=>{
        const name=g.a.name||g.b.name;
        const bank=g.a.bank||g.b.bank;
        return `<article class="common-card">
          <header class="common-center">
            <span class="match-badge">${directionLabel(g.shared)}</span>
            <h3>${esc(name)}</h3>
            <p>${esc(g.k)}${bank?' · '+esc(bank):''}</p>
          </header>
          <div class="common-branches">
            ${sideTransactions(D.persons[sa.person].name,sa,name,g.a.tx,g.shared)}
            <div class="shared-node"><span>SHODNÁ<br>PROTISTRANA</span></div>
            ${sideTransactions(D.persons[oa.person].name,oa,name,g.b.tx,g.shared)}
          </div>
        </article>`;
      }).join('')}</div>`;
  }

  q('#analysisToggle').onclick=()=>setAnalysisMode(true);
  q('#analysisExit').onclick=()=>setAnalysisMode(false);
  q('#runAnalysis').onclick=()=>{
    const other=q('#compareAccount').value;
    if(!other||A[other].person===pid)return;
    q('#analysisResults').innerHTML='';
    animate(()=>{
      if(q('#analysisType').value==='mutual')renderMutual(other);
      else renderCommon(other);
    });
  };

  ['#directionFilter','#dateFrom','#dateTo'].forEach(s=>q(s).onchange=render);
  q('#partyFilter').oninput=render;
  q('#resetFilters').onclick=()=>{
    q('#directionFilter').value='all';
    q('#partyFilter').value='';
    q('#dateFrom').value=D.meta.periodFrom;
    q('#dateTo').value=D.meta.periodTo;
    render();
  };

  buildTabs();
  buildSelectors();
  render();
  updateAnalysisContext();
  setAnalysisMode(false);
})();
