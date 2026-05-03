// ── State ──────────────────────────────────────────────────────────────────
let ALL_STICKERS = [];
let MY_STICKERS = {};   // { sticker_id: { estado, cantidad } }
let ALL_USERS = [];
let currentFilter = 'todos';
let currentRoom = 'general';
let chatInterval = null;
let currentSection = 'mis-figuritas';
let offerSelected = new Set();
let requestSelected = new Set();
let tradeTargetUser = null;

// ── Init ───────────────────────────────────────────────────────────────────
async function initApp() {
    await Promise.all([loadStickers(), loadUsers()]);
    renderStickers();
    renderMyExtras();
    populateTradeUserSelect();
    showSection('mis-figuritas');
}

// ── Navigation ─────────────────────────────────────────────────────────────
function showSection(name) {
    document.querySelectorAll('.content-section').forEach(s => s.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    const sec = document.getElementById(`section-${name}`);
    const nav = document.getElementById(`nav-${name}`);
    if (sec) sec.classList.add('active');
    if (nav) nav.classList.add('active');
    currentSection = name;

    if (chatInterval) clearInterval(chatInterval);
    if (name === 'comunidad') {
        loadUsers().then(() => renderUsers());
        renderPMs();
        loadChat(currentRoom);
        chatInterval = setInterval(() => {
            loadChat(currentRoom);
            renderPMs();
        }, 5000);
    }
    if (name === 'negociar') {
        loadUsers().then(() => {
            populateTradeUserSelect();
            if (tradeTargetUser) {
                const sel = document.getElementById('trade-user-select');
                if (sel) sel.value = tradeTargetUser.id;
                loadUserForTrade();
            }
        });
        loadTrades();
    }
    if (name === 'juntadas') {
        loadJuntadas();
    }
}

// ── Stickers ───────────────────────────────────────────────────────────────
async function loadStickers() {
    const [stickersRes, myRes] = await Promise.all([
        fetch('/api/stickers'),
        fetch('/api/mis-figuritas')
    ]);
    ALL_STICKERS = await stickersRes.json();
    const myArr = await myRes.json();
    MY_STICKERS = {};
    myArr.forEach(s => { MY_STICKERS[s.sticker_id] = { estado: s.estado, cantidad: s.cantidad }; });
    updateStats();
}

function updateStats() {
    const tengo = Object.values(MY_STICKERS).filter(s => s.estado === 'tengo').length;
    const falta = Object.values(MY_STICKERS).filter(s => s.estado === 'me_falta').length;
    const rep = Object.values(MY_STICKERS).filter(s => s.estado === 'repetida').length;
    const uniqueOwned = tengo + rep;
    const total = ALL_STICKERS.length;
    const perc = total > 0 ? Math.round((uniqueOwned / total) * 100) : 0;

    const bar = document.getElementById('my-stats');
    if (bar) bar.innerHTML = `
        <div style="display:flex; flex-direction:column; width:100%; gap:4px; margin-top:8px;">
            <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px;">
                <div>
                    <span class="stat-chip tengo">✅ Tengo: ${tengo}</span>
                    <span class="stat-chip falta">❌ Me faltan: ${falta}</span>
                    <span class="stat-chip rep">🔄 Repetidas: ${rep}</span>
                </div>
                <div style="font-weight:bold; font-size:0.9rem;">
                    Álbum: ${perc}% (${uniqueOwned}/${total})
                </div>
            </div>
            <div style="width:100%; background:var(--border); border-radius:10px; height:8px; overflow:hidden;">
                <div style="height:100%; background:var(--accent); width:${perc}%; transition:width 0.3s;"></div>
            </div>
        </div>
    `;
}

function renderStickers() {
    const grid = document.getElementById('stickers-grid');
    if (!grid) return;
    const search = (document.getElementById('sticker-search')?.value || '').toLowerCase();
    let filtered = ALL_STICKERS.filter(s => {
        const matchSearch = s.nombre.toLowerCase().includes(search) || s.id.toLowerCase().includes(search);
        const myS = MY_STICKERS[s.id];
        const estado = myS ? myS.estado : null;
        if (currentFilter === 'todos') return matchSearch;
        if (currentFilter === 'tengo') return matchSearch && estado === 'tengo';
        if (currentFilter === 'me_falta') return matchSearch && estado === 'me_falta';
        if (currentFilter === 'repetida') return matchSearch && estado === 'repetida';
        return matchSearch;
    });

    grid.innerHTML = filtered.map(s => {
        const myS = MY_STICKERS[s.id];
        const estado = myS ? myS.estado : null;
        // Show the full name as requested: Team#Number Player
        const displayName = s.nombre;
        return `<div class="sticker-card ${estado || ''}" id="sc-${s.id}" onclick="toggleStickerMenu('${s.id}', event)">
            <div class="sticker-name">${displayName}</div>
            ${estado ? `<div class="sticker-estado">${estadoLabel[estado]}${cantLabel}</div>` : '<div class="sticker-estado" style="color:#64748b">Sin marcar</div>'}
            <div class="sticker-menu" id="menu-${s.id}">
                <button onclick="event.stopPropagation();setStickerState('${s.id}','tengo')">✅ Tengo</button>
                <button onclick="event.stopPropagation();setStickerState('${s.id}','me_falta')">❌ Me falta</button>
                <button onclick="event.stopPropagation();setStickerRepeat('${s.id}')">🔄 Repetida</button>
                <button onclick="event.stopPropagation();setStickerState('${s.id}',null)">🗑️ Quitar</button>
            </div>
        </div>`;
    }).join('') || '<div class="empty-state"><span>🔍</span>No hay figuritas que coincidan</div>';
}

function toggleStickerMenu(id, event) {
    event.stopPropagation();
    const menu = document.getElementById(`menu-${id}`);
    const card = document.getElementById(`sc-${id}`);
    if (!menu) return;
    const isOpen = menu.style.display === 'block';
    
    // Close all open menus and remove active class
    document.querySelectorAll('.sticker-menu').forEach(m => m.style.display = 'none');
    document.querySelectorAll('.sticker-card').forEach(c => c.classList.remove('active-menu'));
    
    if (!isOpen) {
        menu.style.display = 'block';
        card.classList.add('active-menu');
    }
}
document.addEventListener('click', () => {
    document.querySelectorAll('.sticker-menu').forEach(m => m.style.display = 'none');
    document.querySelectorAll('.sticker-card').forEach(c => c.classList.remove('active-menu'));
});

function filterStickers() { renderStickers(); }
function setFilter(f, btn) {
    currentFilter = f;
    document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    renderStickers();
}

async function copyStickerList() {
    const search = (document.getElementById('sticker-search')?.value || '').toLowerCase();
    
    // Logic: 
    // - "Faltan": Everything NOT marked as 'tengo' or 'repetida'
    // - "Tengo": Everything marked as 'tengo' or 'repetida'
    
    let filtered;
    let title;
    
    if (currentFilter === 'me_falta') {
        filtered = ALL_STICKERS.filter(s => {
            const est = MY_STICKERS[s.id]?.estado;
            return est !== 'tengo' && est !== 'repetida';
        });
        title = "ME FALTAN";
    } else if (currentFilter === 'tengo' || currentFilter === 'repetida') {
        filtered = ALL_STICKERS.filter(s => {
            const est = MY_STICKERS[s.id]?.estado;
            return est === 'tengo' || est === 'repetida';
        });
        title = "MIS FIGURITAS (Tengo + Repetidas)";
    } else {
        filtered = ALL_STICKERS;
        title = "LISTA COMPLETA";
    }

    if (search) {
        filtered = filtered.filter(s => s.id.toLowerCase().includes(search) || s.nombre.toLowerCase().includes(search));
    }

    const text = title + ":\n" + filtered.map(s => s.id).join(', ');

    try {
        await navigator.clipboard.writeText(text);
        alert('¡Lista copiada al portapapeles!');
    } catch(e) {
        alert('Error al copiar. Por favor, selecciona y copia manualmente.');
    }
}

async function setStickerState(id, estado, cantidad = 1) {
    await fetch('/api/mis-figuritas', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ sticker_id: id, estado, cantidad })
    });
    if (estado === null) delete MY_STICKERS[id];
    else MY_STICKERS[id] = { estado, cantidad };
    renderStickers();
    updateStats();
    renderMyExtras();
}

function setStickerRepeat(id) {
    const cant = prompt('¿Cuántas repetidas tenés?', '2');
    if (!cant) return;
    setStickerState(id, 'repetida', parseInt(cant) || 1);
}

// ── Users & PMs ──────────────────────────────────────────────────────────────
async function loadUsers() {
    const res = await fetch(`/api/usuarios?_t=${Date.now()}`);
    ALL_USERS = await res.json();
}

function renderUsers() {
    const list = document.getElementById('users-list');
    if (!list) return;
    if (!ALL_USERS.length) {
        list.innerHTML = '<div class="empty-state"><span>👥</span>Nadie más por ahora</div>';
        return;
    }
    list.innerHTML = ALL_USERS.map(u => {
        const tengo = u.stickers.filter(s => s.estado === 'tengo').length;
        const falta = u.stickers.filter(s => s.estado === 'me_falta').length;
        const rep = u.stickers.filter(s => s.estado === 'repetida').length;
        return `<div class="user-card" onclick="showUserModal(${u.id})">
            <div class="user-card-name">👤 ${u.nombre} ${u.apellido}</div>
            <div class="user-card-lote">🎫 ${u.lote} · ${u.email}</div>
            <div class="user-card-stats">
                <span class="mini-chip tengo">✅ ${tengo}</span>
                <span class="mini-chip falta">❌ ${falta}</span>
                <span class="mini-chip rep">🔄 ${rep}</span>
            </div>
        </div>`;
    }).join('');
}

async function renderPMs() {
    const res = await fetch(`/api/my_pms?_t=${Date.now()}`);
    const pms = await res.json();
    const list = document.getElementById('pms-list');
    if (!list) return;
    list.innerHTML = '';
    if (pms.length === 0) {
        list.innerHTML = '<div style="color:var(--text2);font-size:0.85rem">No tenés chats privados activos. Clickeá a un usuario para mandarle mensaje.</div>';
        return;
    }
    pms.forEach(pm => {
        const div = document.createElement('div');
        div.className = 'user-card';
        div.style.background = currentRoom === pm.room ? 'var(--card-hover)' : '';
        div.innerHTML = `
            <div style="font-weight:600">💬 ${pm.user.nombre} ${pm.user.apellido}</div>
        `;
        div.onclick = () => {
            document.getElementById('chat-title').textContent = `💬 Chat con ${pm.user.nombre} ${pm.user.apellido}`;
            document.getElementById('btn-chat-gral').classList.remove('hidden');
            loadChat(pm.room);
            renderPMs(); // update active state
        };
        list.appendChild(div);
    });
}

function showUserModal(userId) {
    const u = ALL_USERS.find(x => x.id === userId);
    if (!u) return;
    const tengo = u.stickers.filter(s => s.estado === 'tengo');
    const falta = u.stickers.filter(s => s.estado === 'me_falta');
    const rep = u.stickers.filter(s => s.estado === 'repetida');
    document.getElementById('modal-content').innerHTML = `
        <h2 style="margin-bottom:0.5rem">👤 ${u.nombre} ${u.apellido}</h2>
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.25rem">
            <div style="color:var(--text2);font-size:0.85rem">📧 ${u.email}</div>
            <button onclick="openPM(${u.id}, '${u.nombre} ${u.apellido}')" style="background:var(--accent);color:#fff;border:none;padding:4px 12px;border-radius:20px;cursor:pointer;font-size:0.85rem">💬 Enviar Mensaje</button>
        </div>
        <div style="color:var(--accent);font-weight:700;margin-bottom:1.5rem">🎫 Lote: ${u.lote}</div>
        <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:1rem">
            <div>
                <div class="panel-title" style="color:var(--accent2)">✅ Tiene (${tengo.length})</div>
                <div style="display:flex;flex-wrap:wrap;gap:4px">${tengo.map(s=>{
                    const fullS = ALL_STICKERS.find(as => as.id === s.sticker_id);
                    const name = fullS ? (fullS.nombre.split(' - ')[1] || fullS.nombre) : s.sticker_id;
                    return `<span class="extra-chip" style="background:rgba(16,185,129,0.15);border-color:rgba(16,185,129,0.4);color:var(--accent2)">${name}</span>`;
                }).join('')||'<span style="color:var(--text2);font-size:0.8rem">Ninguna</span>'}</div>
            </div>
            <div>
                <div class="panel-title" style="color:var(--red)">❌ Le faltan (${falta.length})</div>
                <div style="display:flex;flex-wrap:wrap;gap:4px">${falta.map(s=>{
                    const fullS = ALL_STICKERS.find(as => as.id === s.sticker_id);
                    const name = fullS ? (fullS.nombre.split(' - ')[1] || fullS.nombre) : s.sticker_id;
                    return `<span class="extra-chip" style="background:rgba(239,68,68,0.15);border-color:rgba(239,68,68,0.4);color:var(--red)">${name}</span>`;
                }).join('')||'<span style="color:var(--text2);font-size:0.8rem">Ninguna</span>'}</div>
            </div>
            <div>
                <div class="panel-title" style="color:var(--accent3)">🔄 Repetidas (${rep.length})</div>
                <div style="display:flex;flex-wrap:wrap;gap:4px">${rep.map(s=>{
                    const fullS = ALL_STICKERS.find(as => as.id === s.sticker_id);
                    const name = fullS ? (fullS.nombre.split(' - ')[1] || fullS.nombre) : s.sticker_id;
                    return `<span class="extra-chip" style="background:rgba(59,130,246,0.15);border-color:rgba(59,130,246,0.4);color:var(--accent3)">${name} ×${s.cantidad}</span>`;
                }).join('')||'<span style="color:var(--text2);font-size:0.8rem">Ninguna</span>'}</div>
            </div>
        </div>`;
    document.getElementById('user-modal').classList.remove('hidden');
}

function closeModal(e) {
    if (e.target.id === 'user-modal') document.getElementById('user-modal').classList.add('hidden');
}

function getPMRoom(u1, u2) {
    return 'pm_' + [u1, u2].sort((a,b)=>a-b).join('_');
}

function openPM(userId, userName) {
    document.getElementById('user-modal').classList.add('hidden');
    const room = getPMRoom(window._myId, userId);
    document.getElementById('chat-title').textContent = `💬 Chat con ${userName}`;
document.getElementById('btn-chat-gral').classList.remove('hidden');
    loadChat(room);
}

// ── Chat ───────────────────────────────────────────────────────────────────
async function deleteMyAccount() {
    const code = Math.floor(1000 + Math.random() * 9000);
    const confirmText = prompt(`⚠️ ESTO NO SE PUEDE DESHACER ⚠️\nPara borrar tu cuenta y todo tu progreso, escribí el número: ${code}`);
    if (confirmText !== code.toString()) {
        if (confirmText !== null) alert("Código incorrecto. Operación cancelada.");
        return;
    }
    await fetch('/api/account', { method: 'DELETE' });
    window.location.href = '/logout';
}

let lastMessageState = null;
let lastRoom = null;

async function loadChat(room) {
    currentRoom = room;
    if (room === 'general') {
        const title = document.getElementById('chat-title');
        const btn = document.getElementById('btn-chat-gral');
        if (title) title.textContent = '💬 Chat General';
        if (btn) btn.classList.add('hidden');
    }
    const res = await fetch(`/api/messages/${room}?_t=${Date.now()}`);
    const msgs = await res.json();
    const box = document.getElementById('chat-messages');
    if (!box) return;

    const stateHash = msgs.length + '_' + (msgs.length > 0 ? msgs[msgs.length - 1].id : '0');
    if (lastRoom === room && lastMessageState === stateHash) return;
    lastRoom = room;
    lastMessageState = stateHash;

    const wasBottom = box.scrollHeight - box.scrollTop <= box.clientHeight + 50;
    box.innerHTML = msgs.map(m => {
        const isMe = m.user_id === (window._myId || 0);
        const t = new Date(m.created_at).toLocaleTimeString('es-AR', {hour:'2-digit',minute:'2-digit'});
        return `<div class="chat-msg ${isMe?'mine':''}">
            <div class="msg-avatar">${m.nombre[0].toUpperCase()}</div>
            <div class="msg-bubble" style="position:relative;">
                <div class="msg-name">${m.nombre} ${m.apellido} <span class="msg-lote">🎫${m.lote}</span></div>
                <div class="msg-text">${escHtml(m.content)}</div>
                <div class="msg-footer" style="display:flex; justify-content:space-between; align-items:center; margin-top:0.25rem;">
                    <div class="msg-time">${t}</div>
                    ${isMe ? `<button onclick="deleteMessage(${m.id})" style="background:var(--red);color:white;border:none;padding:2px 6px;border-radius:4px;font-size:0.75rem;cursor:pointer;">Borrar</button>` : ''}
                </div>
            </div>
        </div>`;
    }).join('') || '<div class="empty-state"><span>💬</span>Sé el primero en escribir!</div>';
    if (wasBottom || msgs.length < 5) box.scrollTop = box.scrollHeight;
}

async function sendMessage() {
    const inp = document.getElementById('chat-input');
    const content = inp.value.trim();
    if (!content) return;
    inp.value = '';
    await fetch('/api/messages', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ content, room: currentRoom })
    });
    await loadChat(currentRoom);
}

async function deleteMessage(id) {
    if(!confirm('¿Seguro que querés borrar este mensaje?')) return;
    await fetch(`/api/messages/${id}`, { method: 'DELETE' });
    loadChat(currentRoom);
}

// ── Trades ─────────────────────────────────────────────────────────────────
function renderMyExtras() {
    const list = document.getElementById('my-extras');
    if (!list) return;
    const extras = Object.entries(MY_STICKERS).filter(([,v]) => v.estado === 'repetida');
    list.innerHTML = extras.map(([id, v]) =>
        `<span class="extra-chip">📌 ${id} ×${v.cantidad}</span>`
    ).join('') || '<div style="color:var(--text2);font-size:0.85rem">Marcá figuritas como "Repetida" en Mis Figuritas</div>';
}

function populateTradeUserSelect() {
    const sel = document.getElementById('trade-user-select');
    if (!sel) return;
    sel.innerHTML = '<option value="">-- Elegir usuario --</option>' +
        ALL_USERS.map(u => `<option value="${u.id}">${u.nombre} ${u.apellido} (Lote: ${u.lote})</option>`).join('');
}

function loadUserForTrade() {
    const sel = document.getElementById('trade-user-select');
    const userId = parseInt(sel.value);
    tradeTargetUser = ALL_USERS.find(u => u.id === userId);
    offerSelected.clear();
    requestSelected.clear();

    const infoDiv = document.getElementById('trade-user-info');
    const offerDiv = document.getElementById('offer-stickers');
    const reqDiv = document.getElementById('request-stickers');

    if (!tradeTargetUser) {
        infoDiv.classList.add('hidden');
        offerDiv.innerHTML = '';
        reqDiv.innerHTML = '';
        return;
    }

    infoDiv.classList.remove('hidden');
    infoDiv.innerHTML = `
        <div style="font-weight:700">👤 ${tradeTargetUser.nombre} ${tradeTargetUser.apellido}</div>
        <div style="font-size:0.8rem;color:var(--text2)">🎫 Lote: <b style="color:var(--accent)">${tradeTargetUser.lote}</b> · ${tradeTargetUser.email}</div>
        <div style="font-size:0.8rem;color:var(--text2);margin-top:0.4rem">
            Tiene: ${tradeTargetUser.stickers.filter(s=>s.estado==='tengo').length} · 
            Le faltan: ${tradeTargetUser.stickers.filter(s=>s.estado==='me_falta').length} · 
            Repetidas: ${tradeTargetUser.stickers.filter(s=>s.estado==='repetida').length}
        </div>`;

    // My extras to offer
    const myExtras = Object.entries(MY_STICKERS).filter(([,v]) => v.estado === 'repetida');
    offerDiv.innerHTML = myExtras.map(([id]) =>
        `<span class="trade-chip" id="offer-${id}" onclick="toggleOffer('${id}')">${id}</span>`
    ).join('') || '<span style="color:var(--text2);font-size:0.8rem">Sin repetidas para ofrecer</span>';

    // Their extras to request
    const theirExtras = tradeTargetUser.stickers.filter(s => s.estado === 'repetida');
    reqDiv.innerHTML = theirExtras.map(s =>
        `<span class="trade-chip" id="req-${s.sticker_id}" onclick="toggleRequest('${s.sticker_id}')">${s.sticker_id}</span>`
    ).join('') || '<span style="color:var(--text2);font-size:0.85rem">Este usuario todavía no marcó ninguna figurita como "Repetida" en su perfil.<br><br>💡 <b>Recordá:</b> En la vida real, nadie te va a cambiar una figurita que tiene una sola vez porque la necesita para su álbum. Por eso el sistema solo te permite pedirle figuritas que el otro usuario haya marcado explícitamente como "🔄 Repetidas" (es decir, que tiene 2 o más copias).</span>';
}

function toggleOffer(id) {
    if (offerSelected.has(id)) offerSelected.delete(id);
    else offerSelected.add(id);
    document.getElementById(`offer-${id}`)?.classList.toggle('selected', offerSelected.has(id));
}

function toggleRequest(id) {
    if (requestSelected.has(id)) requestSelected.delete(id);
    else requestSelected.add(id);
    document.getElementById(`req-${id}`)?.classList.toggle('selected', requestSelected.has(id));
}

async function sendTradeOffer() {
    if (!tradeTargetUser) return alert('Seleccioná un usuario');
    if (!offerSelected.size && !requestSelected.size) return alert('Seleccioná figuritas para el intercambio');
    const msg = document.getElementById('trade-message').value;
    await fetch('/api/trades', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({
            to_user_id: tradeTargetUser.id,
            from_stickers: [...offerSelected],
            to_stickers: [...requestSelected],
            message: msg
        })
    });
    alert('✅ Propuesta enviada!');
    loadTrades();
}

async function loadTrades() {
    const res = await fetch('/api/trades');
    const trades = await res.json();
    const list = document.getElementById('trades-list');
    if (!list) return;
    if (!trades.length) {
        list.innerHTML = '<div class="empty-state"><span>🤝</span>No hay negociaciones todavía</div>';
        return;
    }

    const sessionRes = await fetch('/api/session');
    const sess = await sessionRes.json();
    window._myId = sess.user_id;

    list.innerHTML = trades.map(t => {
        const isFrom = t.from_user_id === sess.user_id;
        const otherName = isFrom ? `${t.to_nombre} ${t.to_apellido}` : `${t.from_nombre} ${t.from_apellido}`;
        const otherLote = isFrom ? t.to_lote : t.from_lote;
        const fromStickers = JSON.parse(t.from_stickers || '[]');
        const toStickers = JSON.parse(t.to_stickers || '[]');
        const d = new Date(t.created_at).toLocaleDateString('es-AR');
        const actions = !isFrom && t.status === 'pending' ? `
            <div class="trade-actions">
                <button class="btn-accept" onclick="respondTrade(${t.id},'accepted')">✅ Aceptar</button>
                <button class="btn-reject" onclick="respondTrade(${t.id},'rejected')">❌ Rechazar</button>
            </div>` : '';
        return `<div class="trade-item">
            <div class="trade-item-header">
                <div>
                    <span style="font-weight:700">${isFrom ? '📤 Enviado a' : '📥 Recibido de'}: ${otherName}</span>
                    <div style="font-size:0.75rem;color:var(--accent)">🎫 Lote: ${otherLote}</div>
                </div>
                <span class="trade-status ${t.status}">${{pending:'⏳ Pendiente',accepted:'✅ Aceptado',rejected:'❌ Rechazado',cancelled:'🚫 Cancelado'}[t.status]}</span>
            </div>
            <div style="font-size:0.82rem;display:grid;grid-template-columns:1fr auto 1fr;gap:0.5rem;align-items:center">
                <div><b>Ofrezco:</b><br>${fromStickers.join(', ')||'—'}</div>
                <div style="font-size:1.2rem;text-align:center">⇄</div>
                <div><b>Pido:</b><br>${toStickers.join(', ')||'—'}</div>
            </div>
            ${t.message ? `<div style="font-size:0.8rem;color:var(--text2);margin-top:0.5rem">💬 "${escHtml(t.message)}"</div>` : ''}
            <div style="font-size:0.72rem;color:var(--text2);margin-top:0.4rem">${d}</div>
            ${actions}
        </div>`;
    }).join('');
}

async function respondTrade(id, status) {
    await fetch(`/api/trades/${id}`, {
        method: 'PATCH',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ status })
    });
    loadTrades();
}

// ── Juntadas ───────────────────────────────────────────────────────────────
async function loadJuntadas() {
    const res = await fetch('/api/juntadas');
    const juntadas = await res.json();
    const grid = document.getElementById('juntadas-list');
    if (!grid) return;
    if (!juntadas.length) {
        grid.innerHTML = '<div class="empty-state"><span>🏟️</span>No hay juntadas programadas.<br>¡El admin organizará una pronto!</div>';
        return;
    }
    grid.innerHTML = juntadas.map(j => {
        const fecha = new Date(j.fecha).toLocaleString('es-AR', {dateStyle:'full',timeStyle:'short'});
        const isGoing = j.my_rsvp === 'going';
        return `<div class="juntada-card">
            <div class="juntada-emoji">🏟️</div>
            <div class="juntada-title">${escHtml(j.titulo)}</div>
            <div class="juntada-date">📅 ${fecha}</div>
            <div class="juntada-place">📍 ${escHtml(j.lugar)}</div>
            ${j.descripcion ? `<div class="juntada-desc">${escHtml(j.descripcion)}</div>` : ''}
            <div style="font-size:0.8rem;color:var(--text2);margin-bottom:0.5rem">Organizado por: ${escHtml(j.creator_nombre)} ${escHtml(j.creator_apellido)}</div>
            <div class="juntada-footer">
                <span class="juntada-going">✅ ${j.asistentes} van</span>
                <button class="btn-rsvp ${isGoing?'going':'not-going'}" onclick="rsvpJuntada(${j.id}, ${isGoing})">
                    ${isGoing ? '✅ Voy' : '🤔 ¿Voy?'}
                </button>
            </div>
        </div>`;
    }).join('');
}

async function rsvpJuntada(id, currentlyGoing) {
    await fetch(`/api/juntadas/${id}/rsvp`, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ status: currentlyGoing ? 'not_going' : 'going' })
    });
    loadJuntadas();
}

async function createJuntada(e) {
    e.preventDefault();
    await fetch('/api/juntadas', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({
            titulo: document.getElementById('j-titulo').value,
            descripcion: document.getElementById('j-desc').value,
            fecha: document.getElementById('j-fecha').value,
            lugar: document.getElementById('j-lugar').value
        })
    });
    alert('✅ Juntada creada!');
    e.target.reset();
    showSection('juntadas');
}

// ── Utils ──────────────────────────────────────────────────────────────────
function escHtml(str) {
    return String(str||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// Load session id for chat
fetch('/api/session').then(r=>r.json()).then(s=>{ window._myId = s.user_id; });
