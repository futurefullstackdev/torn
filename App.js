/********************************************************************
*  XP-Farming Ledger – single-key edition (client-side only)
*  1) Ask for YOUR Torn user-id, YOUR API key, price per loss
*  2) Pull your attack log
*  3) Keep rows where someone attacked you & lost
*  4) Sum per attacker; let you mark payments; store everything
*********************************************************************/

///////////////////////////////////////////////////////////////////
//  DOM shortcuts
///////////////////////////////////////////////////////////////////
const $ = id => document.getElementById(id);
const els = {
  myId   : $('myId'),
  myKey  : $('myKey'),
  price  : $('price'),
  save   : $('saveCfg'),
  stat   : $('status'),
  tbody  : $('tbl').querySelector('tbody'),
  btnPay : $('btnPaid'),
  stLoss : $('stLoss'), stOwed:$('stOwed'), stPaid:$('stPaid'),
  stOut  : $('stOut'),  stBest:$('stBest'), stTop :$('stTop')
};

///////////////////////////////////////////////////////////////////
//  localStorage helpers
///////////////////////////////////////////////////////////////////
function jStore(name,val){
  if(val===undefined) return JSON.parse(localStorage.getItem(name)||'{}');
  localStorage.setItem(name,JSON.stringify(val));
}
const CFG  = 'xplCfg';   // {id,key,price}
const PAY  = 'xplPay';   // {attackerId : amountPaid}

///////////////////////////////////////////////////////////////////
//  Fetch your attack log
///////////////////////////////////////////////////////////////////
async function getMyAttacks(id,key){
  const url=`https://api.torn.com/user/${id}?selections=attacks&key=${key}`;
  const r = await fetch(url);
  if(!r.ok)          throw new Error(`HTTP ${r.status}`);
  const j = await r.json();
  if(j.error)        throw new Error(j.error.error);
  return Object.values(j.attacks||{});
}

///////////////////////////////////////////////////////////////////
//  Build ledger rows & statistics
///////////////////////////////////////////////////////////////////
async function buildLedger(){
  const cfg = jStore(CFG);
  if(!(cfg.id && cfg.key)){
    els.stat.textContent='Enter your ID & API key, then “Save & Refresh”.';
    return {rows:[],stats:{}};
  }

  els.stat.textContent='Downloading attack log …';
  const attacks = await getMyAttacks(cfg.id,cfg.key);

  // keep only: I am defender && attacker lost
  const rowsByAtk = {};
  attacks.forEach(a=>{
    if(a.defender_id==cfg.id && a.result==='Lost'){
      const atk = a.attacker_id;
      if(!rowsByAtk[atk]) rowsByAtk[atk]={id:atk,name:a.attacker_name,losses:0};
      rowsByAtk[atk].losses++;
    }
  });

  // merge payments & compute balances
  const paid = jStore(PAY);
  const price = cfg.price||0;
  const rows = Object.values(rowsByAtk).map(r=>{
    r.owes    = r.losses * price;
    r.paid    = paid[r.id]||0;
    r.balance = r.owes - r.paid;
    return r;
  }).sort((a,b)=>b.balance-a.balance);

  // global statistics
  const stats = {
    losses : rows.reduce((s,r)=>s+r.losses,0),
    owes   : rows.reduce((s,r)=>s+r.owes  ,0),
    paid   : rows.reduce((s,r)=>s+r.paid  ,0)
  };
  stats.out = stats.owes - stats.paid;
  stats.best= rows.reduce((m,r)=>r.losses>(m?.losses||0)?r:m,null);
  stats.top = rows.reduce((m,r)=>r.paid  >(m?.paid  ||0)?r:m,null);

  els.stat.textContent=`Processed ${attacks.length.toLocaleString()} fights, `
                      +`${rows.length} attackers.`;
  return {rows,stats};
}

///////////////////////////////////////////////////////////////////
//  Render UI
///////////////////////////////////////////////////////////////////
function money(n){return '$'+n.toLocaleString('en-US');}

function render({rows,stats}){
  // table
  els.tbody.innerHTML='';
  rows.forEach(r=>{
    const tr=document.createElement('tr');
    tr.classList.add(r.balance>0?'pos':(r.balance<0?'neg':'zero'));
    tr.innerHTML=`
      <td><input type="checkbox" data-id="${r.id}"></td>
      <td>${r.name}</td>
      <td>${r.losses}</td>
      <td>${money(r.owes)}</td>
      <td>${money(r.paid)}</td>
      <td>${money(r.balance)}</td>`;
    els.tbody.appendChild(tr);
  });

  // statistics
  els.stLoss.textContent = stats.losses?.toLocaleString()||0;
  els.stOwed.textContent = money(stats.owes||0);
  els.stPaid.textContent = money(stats.paid||0);
  els.stOut .textContent = money(stats.out ||0);
  els.stBest.textContent = stats.best ? `${stats.best.name} (${stats.best.losses})` : '–';
  els.stTop .textContent = stats.top  ? `${stats.top .name} (${money(stats.top.paid)})` : '–';
}

///////////////////////////////////////////////////////////////////
//  Events
///////////////////////////////////////////////////////////////////
els.save.onclick=()=>{
  jStore(CFG,{id:+els.myId.value,key:els.myKey.value.trim(),price:+els.price.value});
  refresh();
};

els.btnPay.onclick=()=>{
  const paid = jStore(PAY);
  document.querySelectorAll('tbody input:checked').forEach(cb=>{
    const id = cb.dataset.id;
    const bal= +cb.parentElement.parentElement.children[5]
                .textContent.replace(/[^\d-]/g,'');
    paid[id]=(paid[id]||0)+bal;
  });
  jStore(PAY,paid);
  refresh();
};

///////////////////////////////////////////////////////////////////
//  Boot
///////////////////////////////////////////////////////////////////
(async function boot(){
  const cfg=jStore(CFG);
  if(cfg.id)   els.myId .value=cfg.id;
  if(cfg.key)  els.myKey.value=cfg.key;
  if(cfg.price)els.price.value=cfg.price;
  refresh();
})();

async function refresh(){
  try{ render(await buildLedger()); }
  catch(e){ els.stat.textContent='Error: '+e.message; console.error(e); }
}
