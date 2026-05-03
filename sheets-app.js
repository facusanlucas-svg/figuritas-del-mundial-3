// ── CONFIG — pegá tu URL de Apps Script acá ──────────────────
const GAS_URL = 'https://script.google.com/macros/s/AKfycbyZAQonjChc9lYLc2XpQPOZYTmnXz7GLAY9-rO2qgXfSYp1YumQ6pWmQxYHA0eTjFwMcQ/exec';

// ── Stickers del Mundial 2026 ─────────────────────────────────
const STICKERS = [];
const GRUPOS = {
  A:['Estados Unidos','México','Canadá','Uruguay'],
  B:['Argentina','Chile','Perú','Ecuador'],
  C:['Brasil','Colombia','Venezuela','Bolivia'],
  D:['España','Portugal','Marruecos','Senegal'],
  E:['Francia','Bélgica','Países Bajos','Alemania'],
  F:['Inglaterra','Italia','Croacia','Polonia'],
  G:['Japón','Corea del Sur','Australia','Arabia Saudita'],
  H:['Irán','Qatar','Costa Rica','Ghana']
};
for(let i=1;i<=20;i++) STICKERS.push({id:`FWC${i}`,nombre:`FIFA WC #${i}`,sec:'FIFA World Cup'});
for(const[g,teams] of Object.entries(GRUPOS))
  for(const t of teams)
    for(let i=1;i<=8;i++)
      STICKERS.push({id:`${t.slice(0,3).toUpperCase()}${i}`,nombre:`${t} #${i}`,sec:`Grupo ${g}`});

// ── State ─────────────────────────────────────────────────────
let ME = null;           // {id,nombre,apellido,lote,email,is_admin}
let MY_S = {};           // {sticker_id:{estado,cantidad}}
let USERS = [];
let filt = 'all';
let chatTimer = null;
let tTarget = null;
const offerSel = new Set(), reqSel = new Set();

// ── API helper ────────────────────────────────────────────────
async function api(action, data={}) {
  const r = await fetch(GAS_URL, {
    method:'POST',
    body: JSON.stringify({action, ...data})
  });
  return r.json();
}

// ── Auth ──────────────────────────────────────────────────────
function swTab(t) {
  document.querySelectorAll('.tab').forEach(b=>b.classList.remove('active'));
  event.target.classList.add('active');
  document.getElementById('f-login').classList.toggle('hidden', t!=='login');
  document.getElementById('f-reg').classList.toggle('hidden', t!=='reg');
}

async function doLogin() {
  const email=v('l-email'), pwd=v('l-pwd');
  if(!email||!pwd) return;
  setBtnLoad('l-btn',true);
  const r = await api('login',{email,password:pwd});
  if(r.success){ ME=r.user; startDash(); }
  else showErr('l-err', r.error);
  setBtnLoad('l-btn',false,'Entrar →');
}

async function doRegister() {
  const nom=v('r-nom'),ape=v('r-ape'),email=v('r-email'),lote=v('r-lote'),pwd=v('r-pwd');
  if(!nom||!ape||!email||!lote||!pwd) return showErr('r-err','Completá todos los campos');
  setBtnLoad('r-btn',true);
  const r = await api('register',{nombre:nom,apellido:ape,email,lote,password:pwd});
  if(r.success){ ME=r.user; startDash(); }
  else showErr('r-err', r.error);
  setBtnLoad('r-btn',false,'Crear Cuenta 🚀');
}

function doLogout() {
  ME=null; MY_S={}; USERS=[];
  if(chatTimer) clearInterval(chatTimer);
  document.getElementById('auth-page').classList.remove('hidden');
  document.getElementById('dash-page').classList.add('hidden');
}

// ── Dashboard init ────────────────────────────────────────────
async function startDash() {
  document.getElementById('auth-page').classList.add('hidden');
  document.getElementById('dash-page').classList.remove('hidden');
  document.getElementById('me-av').textContent = ME.nombre[0].toUpperCase();
  document.getElementById('me-name').textContent = ME.nombre+' '+ME.apellido;
  document.getElementById('me-lote').textContent = 'Lote: '+ME.lote;
  if(ME.is_admin) document.getElementById('n-adm-li').classList.remove('hidden');
  await Promise.all([loadMyStickers(), loadUsers()]);
  renderFig(); renderExtras(); populateUserSelect();
}

// ── Navigation ────────────────────────────────────────────────
function show(sec) {
  event && event.preventDefault();
  document.querySelectorAll('.sec').forEach(s=>s.classList.remove('active'));
  document.querySelectorAll('.nav a').forEach(a=>a.classList.remove('active'));
  document.getElementById('s-'+sec).classList.add('active');
  document.getElementById('n-'+sec)?.classList.add('active');
  if(chatTimer) clearInterval(chatTimer);
  if(sec==='com'){ loadUsers(); loadChat(); chatTimer=setInterval(loadChat,6000); }
  if(sec==='neg') loadTrades();
  if(sec==='jun') loadJuntadas();
}

// ── Stickers ──────────────────────────────────────────────────
async function loadMyStickers() {
  const r = await api('getMyStickers',{userId:ME.id});
  MY_S={};
  (Array.isArray(r)?r:[]).forEach(s=>{ MY_S[s.sticker_id]={estado:s.estado,cantidad:s.cantidad}; });
  updateStats();
}

function updateStats() {
  const t=Object.values(MY_S).filter(s=>s.estado==='tengo').length;
  const f=Object.values(MY_S).filter(s=>s.estado==='me_falta').length;
  const rep=Object.values(MY_S).filter(s=>s.estado==='repetida').length;
  document.getElementById('my-stats').innerHTML=
    `<span class="chip g">✅ Tengo: ${t}</span>
     <span class="chip r">❌ Falta: ${f}</span>
     <span class="chip b">🔄 Rep: ${rep}</span>
     <span class="chip">📦 Total: ${STICKERS.length}</span>`;
}

function renderFig() {
  const q=(document.getElementById('fsearch')?.value||'').toLowerCase();
  const filtered = STICKERS.filter(s=>{
    const match = s.nombre.toLowerCase().includes(q)||s.id.toLowerCase().includes(q);
    const st = MY_S[s.id]?.estado||null;
    if(filt==='all') return match;
    return match && st===filt;
  });
  const lbl={tengo:'✅ Tengo',me_falta:'❌ Me falta',repetida:'🔄 Repetida'};
  document.getElementById('fig-grid').innerHTML = filtered.map(s=>{
    const my=MY_S[s.id]; const st=my?.estado||null;
    const qty=st==='repetida'&&my?` ×${my.cantidad}`:'';
    return `<div class="sc ${st||''}" onclick="toggleMenu('${s.id}',event)">
      <div class="sc-id">${s.id}</div>
      <div class="sc-nm">${s.nombre}</div>
      <div class="sc-st">${st?(lbl[st]+qty):'Sin marcar'}</div>
      <div class="smenu" id="sm-${s.id}">
        <button onclick="event.stopPropagation();setS('${s.id}','tengo')">✅ Tengo</button>
        <button onclick="event.stopPropagation();setS('${s.id}','me_falta')">❌ Me falta</button>
        <button onclick="event.stopPropagation();setRep('${s.id}')">🔄 Repetida</button>
        <button onclick="event.stopPropagation();setS('${s.id}',null)">🗑️ Quitar</button>
      </div>
    </div>`;
  }).join('')||'<div class="empty"><span>🔍</span>Sin resultados</div>';
}

function toggleMenu(id,e) {
  e.stopPropagation();
  const m=document.getElementById('sm-'+id);
  if(!m) return;
  const was=m.style.display==='block';
  document.querySelectorAll('.smenu').forEach(x=>x.style.display='none');
  m.style.display=was?'none':'block';
}
document.addEventListener('click',()=>document.querySelectorAll('.smenu').forEach(x=>x.style.display='none'));

function setFilt(f,btn) {
  filt=f;
  document.querySelectorAll('.fbt').forEach(b=>b.classList.remove('active'));
  btn.classList.add('active'); renderFig();
}

async function setS(id, estado, cantidad=1) {
  await api('updateSticker',{userId:ME.id,stickerId:id,estado,cantidad});
  if(!estado) delete MY_S[id]; else MY_S[id]={estado,cantidad};
  renderFig(); updateStats(); renderExtras();
}

function setRep(id) {
  const c=prompt('¿Cuántas repetidas?','2');
  if(!c) return;
  setS(id,'repetida',parseInt(c)||1);
}

// ── Users ─────────────────────────────────────────────────────
async function loadUsers() {
  const r = await api('getUsers',{userId:ME.id});
  USERS = Array.isArray(r)?r:[];
  renderUsers(); populateUserSelect();
}

function renderUsers() {
  const el=document.getElementById('ulist');
  if(!el) return;
  if(!USERS.length){ el.innerHTML='<div class="empty"><span>👥</span>Nadie más aún</div>'; return; }
  el.innerHTML = USERS.map(u=>{
    const t=u.stickers?.filter(s=>s.estado==='tengo').length||0;
    const f=u.stickers?.filter(s=>s.estado==='me_falta').length||0;
    const rep=u.stickers?.filter(s=>s.estado==='repetida').length||0;
    return `<div class="uc" onclick="showUserModal(${u.id})">
      <div class="uc-name">👤 ${esc(u.nombre)} ${esc(u.apellido)}</div>
      <div class="uc-lote">🎫 ${esc(u.lote)} · ${esc(u.email)}</div>
      <div class="uc-stats">
        <span class="mc g">✅ ${t}</span><span class="mc r">❌ ${f}</span><span class="mc b">🔄 ${rep}</span>
      </div>
    </div>`;
  }).join('');
}

function showUserModal(uid) {
  const u=USERS.find(x=>String(x.id)===String(uid)); if(!u) return;
  const ten=u.stickers?.filter(s=>s.estado==='tengo')||[];
  const fal=u.stickers?.filter(s=>s.estado==='me_falta')||[];
  const rep=u.stickers?.filter(s=>s.estado==='repetida')||[];
  document.getElementById('modal-body').innerHTML=`
    <h2 style="margin-bottom:.4rem">👤 ${esc(u.nombre)} ${esc(u.apellido)}</h2>
    <div style="color:var(--muted);font-size:.82rem">📧 ${esc(u.email)}</div>
    <div style="color:var(--accent);font-weight:700;margin:.4rem 0 1.25rem">🎫 Lote: ${esc(u.lote)}</div>
    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:1rem">
      <div><div class="ptitle" style="color:var(--green)">✅ Tiene (${ten.length})</div><div style="display:flex;flex-wrap:wrap;gap:4px">${ten.map(s=>`<span class="exch" style="background:rgba(16,185,129,.12);border-color:rgba(16,185,129,.3);color:var(--green)">${s.sticker_id}</span>`).join('')||'<span style="color:var(--muted);font-size:.78rem">—</span>'}</div></div>
      <div><div class="ptitle" style="color:var(--red)">❌ Le falta (${fal.length})</div><div style="display:flex;flex-wrap:wrap;gap:4px">${fal.map(s=>`<span class="exch" style="background:rgba(239,68,68,.12);border-color:rgba(239,68,68,.3);color:var(--red)">${s.sticker_id}</span>`).join('')||'<span style="color:var(--muted);font-size:.78rem">—</span>'}</div></div>
      <div><div class="ptitle">🔄 Repetidas (${rep.length})</div><div style="display:flex;flex-wrap:wrap;gap:4px">${rep.map(s=>`<span class="exch">${s.sticker_id}×${s.cantidad}</span>`).join('')||'<span style="color:var(--muted);font-size:.78rem">—</span>'}</div></div>
    </div>`;
  document.getElementById('modal').classList.remove('hidden');
}

// ── Chat ──────────────────────────────────────────────────────
async function loadChat() {
  const r = await api('getMessages',{room:'general'});
  const box=document.getElementById('chat-msgs'); if(!box) return;
  const atBottom=box.scrollHeight-box.scrollTop<=box.clientHeight+60;
  const msgs=Array.isArray(r)?r:[];
  box.innerHTML = msgs.map(m=>{
    const isMe=String(m.user_id)===String(ME?.id);
    const t=new Date(m.created_at).toLocaleTimeString('es-AR',{hour:'2-digit',minute:'2-digit'});
    return `<div class="msg ${isMe?'mine':''}">
      <div class="mavt">${(m.nombre||'?')[0].toUpperCase()}</div>
      <div class="mbbl">
        <div class="mname">${esc(m.nombre)} ${esc(m.apellido)} <span class="mlote">🎫${esc(m.lote)}</span></div>
        <div class="mtext">${esc(m.content)}</div>
        <div class="mtime">${t}</div>
      </div>
    </div>`;
  }).join('')||'<div class="empty"><span>💬</span>Sé el primero en escribir!</div>';
  if(atBottom||msgs.length<4) box.scrollTop=box.scrollHeight;
}

async function sendMsg() {
  const inp=document.getElementById('chat-inp');
  const content=inp.value.trim(); if(!content) return;
  inp.value='';
  await api('sendMessage',{userId:ME.id,room:'general',content});
  loadChat();
}

// ── Trades ────────────────────────────────────────────────────
function renderExtras() {
  const el=document.getElementById('my-extras'); if(!el) return;
  const ex=Object.entries(MY_S).filter(([,v])=>v.estado==='repetida');
  el.innerHTML=ex.map(([id,v])=>`<span class="exch">📌 ${id} ×${v.cantidad}</span>`).join('')
    ||'<span style="color:var(--muted);font-size:.82rem">Marcá figuritas como Repetida primero</span>';
}

function populateUserSelect() {
  const sel=document.getElementById('t-usel'); if(!sel) return;
  sel.innerHTML='<option value="">-- Elegir usuario --</option>'+
    USERS.map(u=>`<option value="${u.id}">${esc(u.nombre)} ${esc(u.apellido)} (Lote: ${esc(u.lote)})</option>`).join('');
}

function loadTradeUser() {
  const uid=document.getElementById('t-usel').value;
  tTarget=USERS.find(u=>String(u.id)===uid)||null;
  offerSel.clear(); reqSel.clear();
  const info=document.getElementById('t-uinfo');
  const offerDiv=document.getElementById('t-offer');
  const reqDiv=document.getElementById('t-req');
  if(!tTarget){ info.classList.add('hidden'); offerDiv.innerHTML=''; reqDiv.innerHTML=''; return; }
  info.classList.remove('hidden');
  info.innerHTML=`<b>👤 ${esc(tTarget.nombre)} ${esc(tTarget.apellido)}</b><br>🎫 Lote: <b style="color:var(--accent)">${esc(tTarget.lote)}</b> · ${esc(tTarget.email)}`;
  const myEx=Object.entries(MY_S).filter(([,v])=>v.estado==='repetida');
  offerDiv.innerHTML=myEx.map(([id])=>`<span class="tchip" id="of-${id}" onclick="togOffer('${id}')">${id}</span>`).join('')
    ||'<span style="color:var(--muted);font-size:.78rem">Sin repetidas</span>';
  const theirEx=(tTarget.stickers||[]).filter(s=>s.estado==='repetida');
  reqDiv.innerHTML=theirEx.map(s=>`<span class="tchip" id="rq-${s.sticker_id}" onclick="togReq('${s.sticker_id}')">${s.sticker_id}</span>`).join('')
    ||'<span style="color:var(--muted);font-size:.78rem">Sin repetidas</span>';
}

function togOffer(id){ offerSel.has(id)?offerSel.delete(id):offerSel.add(id); document.getElementById('of-'+id)?.classList.toggle('sel',offerSel.has(id)); }
function togReq(id){ reqSel.has(id)?reqSel.delete(id):reqSel.add(id); document.getElementById('rq-'+id)?.classList.toggle('sel',reqSel.has(id)); }

async function sendTrade() {
  if(!tTarget) return alert('Seleccioná un usuario');
  if(!offerSel.size&&!reqSel.size) return alert('Seleccioná figuritas');
  await api('createTrade',{fromUserId:ME.id,toUserId:tTarget.id,fromStickers:[...offerSel],toStickers:[...reqSel],message:v('t-msg')});
  alert('✅ Propuesta enviada!'); loadTrades();
}

async function loadTrades() {
  const r=await api('getTrades',{userId:ME.id});
  const trades=Array.isArray(r)?r:[];
  const el=document.getElementById('trades-list'); if(!el) return;
  if(!trades.length){ el.innerHTML='<div class="empty"><span>🤝</span>Sin negociaciones</div>'; return; }
  const stLbl={pending:'⏳ Pendiente',accepted:'✅ Aceptado',rejected:'❌ Rechazado',cancelled:'🚫 Cancelado'};
  el.innerHTML=trades.map(t=>{
    const isFrom=String(t.from_id)===String(ME.id);
    const other=isFrom?`${esc(t.to_nombre)} ${esc(t.to_apellido)}`:`${esc(t.from_nombre)} ${esc(t.from_apellido)}`;
    const lote=isFrom?t.to_lote:t.from_lote;
    let fs=[],ts=[];
    try{fs=JSON.parse(t.from_stickers||'[]')}catch(e){}
    try{ts=JSON.parse(t.to_stickers||'[]')}catch(e){}
    const d=new Date(t.created_at).toLocaleDateString('es-AR');
    const acts=!isFrom&&t.status==='pending'?`<div class="t-acts">
      <button class="btn btn-green" style="font-size:.78rem;padding:.35rem .9rem" onclick="resTrade(${t.id},'accepted')">✅ Aceptar</button>
      <button class="btn btn-red" style="font-size:.78rem;padding:.35rem .9rem" onclick="resTrade(${t.id},'rejected')">❌ Rechazar</button>
    </div>`:'';
    return `<div class="ti">
      <div class="ti-hdr">
        <div><span style="font-weight:700">${isFrom?'📤 A':'📥 De'}: ${other}</span>
          <div style="font-size:.72rem;color:var(--accent)">🎫 Lote: ${esc(lote)}</div></div>
        <span class="tst ${t.status}">${stLbl[t.status]||t.status}</span>
      </div>
      <div style="display:grid;grid-template-columns:1fr auto 1fr;gap:.5rem;align-items:center;font-size:.8rem">
        <div><b>Ofrezco:</b> ${fs.join(', ')||'—'}</div>
        <div style="font-size:1.1rem;text-align:center">⇄</div>
        <div><b>Pido:</b> ${ts.join(', ')||'—'}</div>
      </div>
      ${t.message?`<div style="font-size:.78rem;color:var(--muted);margin-top:.4rem">💬 "${esc(t.message)}"</div>`:''}
      <div style="font-size:.7rem;color:var(--muted);margin-top:.3rem">${d}</div>
      ${acts}
    </div>`;
  }).join('');
}

async function resTrade(id,status){ await api('updateTrade',{tradeId:id,status}); loadTrades(); }

// ── Juntadas ──────────────────────────────────────────────────
async function loadJuntadas() {
  const r=await api('getJuntadas',{userId:ME.id});
  const juntadas=Array.isArray(r)?r:[];
  const el=document.getElementById('jlist'); if(!el) return;
  if(!juntadas.length){ el.innerHTML='<div class="empty"><span>🏟️</span>No hay juntadas todavía</div>'; return; }
  el.innerHTML=juntadas.map(j=>{
    const fecha=new Date(j.fecha).toLocaleString('es-AR',{dateStyle:'full',timeStyle:'short'});
    const going=j.my_rsvp==='going';
    return `<div class="jcard">
      <div style="font-size:1.8rem">🏟️</div>
      <div class="jtitle">${esc(j.titulo)}</div>
      <div class="jdate">📅 ${fecha}</div>
      <div class="jplace">📍 ${esc(j.lugar)}</div>
      ${j.descripcion?`<div class="jdesc">${esc(j.descripcion)}</div>`:''}
      <div style="font-size:.78rem;color:var(--muted)">Por: ${esc(j.creator_nombre)} ${esc(j.creator_apellido)}</div>
      <div class="jfoot">
        <span class="jgoing">✅ ${j.asistentes} van</span>
        <button class="btn ${going?'btn-green':'btn-ghost'}" style="font-size:.78rem;padding:.4rem 1rem;border-radius:20px"
          onclick="rsvp(${j.id},${going})">${going?'✅ Voy':'🤔 ¿Voy?'}</button>
      </div>
    </div>`;
  }).join('');
}

async function rsvp(id,going){ await api('rsvpJuntada',{juntadaId:id,userId:ME.id,status:going?'not_going':'going'}); loadJuntadas(); }

async function createJuntada() {
  const tit=v('j-tit'),fecha=v('j-fecha'),lugar=v('j-lugar');
  if(!tit||!fecha||!lugar) return alert('Completá título, fecha y lugar');
  const r=await api('createJuntada',{userId:ME.id,titulo:tit,descripcion:v('j-desc'),fecha,lugar});
  if(r.error) return alert(r.error);
  alert('✅ Juntada creada!');
  document.getElementById('j-tit').value='';
  document.getElementById('j-desc').value='';
  document.getElementById('j-fecha').value='';
  document.getElementById('j-lugar').value='';
  show('jun');
}

// ── Utils ─────────────────────────────────────────────────────
function v(id){ return document.getElementById(id)?.value||''; }
function esc(s){ return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
function showErr(id,msg){ const el=document.getElementById(id); el.textContent=msg; el.classList.remove('hidden'); }
function setBtnLoad(id,loading,label=''){
  const btn=document.getElementById(id);
  btn.disabled=loading;
  btn.innerHTML=loading?'<span class="spin"></span> Cargando...':label;
}
