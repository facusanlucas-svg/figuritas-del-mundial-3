// ═══════════════════════════════════════════════════════════════
//  FIGURITAS DEL MUNDIAL 2026 — Google Apps Script Backend
//  Instrucciones:
//  1. Abrí un Google Sheet nuevo
//  2. Extensiones → Apps Script → pegá este código
//  3. Implementar → Nueva implementación → Aplicación web
//     • Ejecutar como: Yo
//     • Acceso: Cualquier persona
//  4. Copiá la URL y pegala en el HTML (variable SHEET_URL)
// ═══════════════════════════════════════════════════════════════

const ADMIN_EMAIL = 'facusanlucas@gmail.com';
const SHEET_NAME  = SpreadsheetApp.getActiveSpreadsheet();

// ── Sheet helpers ─────────────────────────────────────────────
function getSheet(name) {
  let s = SHEET_NAME.getSheetByName(name);
  if (!s) {
    s = SHEET_NAME.insertSheet(name);
    // Add headers
    const headers = {
      Users:      ['id','lote','nombre','apellido','email','password','created_at'],
      Stickers:   ['user_id','sticker_id','estado','cantidad'],
      Messages:   ['id','user_id','room','content','created_at'],
      Trades:     ['id','from_id','to_id','from_stickers','to_stickers','status','message','created_at'],
      Juntadas:   ['id','titulo','descripcion','fecha','lugar','created_by','created_at'],
      JuntadaRSVP:['juntada_id','user_id','status'],
    };
    if (headers[name]) s.appendRow(headers[name]);
  }
  return s;
}

function sheetToObjects(sheet) {
  const data = sheet.getDataRange().getValues();
  if (data.length < 2) return [];
  const headers = data[0];
  return data.slice(1).map(row => {
    const obj = {};
    headers.forEach((h, i) => obj[h] = row[i]);
    return obj;
  });
}

function appendRow(sheetName, obj) {
  const sheet = getSheet(sheetName);
  const headers = sheet.getRange(1,1,1,sheet.getLastColumn()).getValues()[0];
  sheet.appendRow(headers.map(h => obj[h] !== undefined ? obj[h] : ''));
}

function updateRow(sheetName, matchKey, matchVal, updates) {
  const sheet = getSheet(sheetName);
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const colIdx = headers.indexOf(matchKey);
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][colIdx]) === String(matchVal)) {
      Object.entries(updates).forEach(([k, v]) => {
        const ci = headers.indexOf(k);
        if (ci >= 0) sheet.getRange(i+1, ci+1).setValue(v);
      });
      return true;
    }
  }
  return false;
}

function findRow(sheetName, key, val) {
  return sheetToObjects(getSheet(sheetName)).find(r => String(r[key]) === String(val));
}

function genId(sheetName) {
  const rows = sheetToObjects(getSheet(sheetName));
  if (!rows.length) return 1;
  const ids = rows.map(r => parseInt(r.id) || 0);
  return Math.max(...ids) + 1;
}

function hashPwd(pwd) {
  return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,
    pwd, Utilities.Charset.UTF_8)
    .map(b => ('0' + (b & 0xFF).toString(16)).slice(-2)).join('');
}

function cors(output) {
  return ContentService.createTextOutput(JSON.stringify(output))
    .setMimeType(ContentService.MimeType.JSON);
}

// ── Router ────────────────────────────────────────────────────
function doPost(e) {
  try {
    const body = JSON.parse(e.postData.contents);
    const action = body.action;
    switch(action) {
      case 'register':     return cors(register(body));
      case 'login':        return cors(login(body));
      case 'getMyStickers':return cors(getMyStickers(body));
      case 'updateSticker':return cors(updateSticker(body));
      case 'getUsers':     return cors(getUsers(body));
      case 'getMessages':  return cors(getMessages(body));
      case 'sendMessage':  return cors(sendMessage(body));
      case 'getTrades':    return cors(getTrades(body));
      case 'createTrade':  return cors(createTrade(body));
      case 'updateTrade':  return cors(updateTrade(body));
      case 'getJuntadas':  return cors(getJuntadas(body));
      case 'createJuntada':return cors(createJuntada(body));
      case 'rsvpJuntada':  return cors(rsvpJuntada(body));
      default:             return cors({error: 'Acción desconocida'});
    }
  } catch(err) {
    return cors({error: err.toString()});
  }
}

function doGet(e) {
  return cors({status: 'Figuritas Mundial 2026 API OK'});
}

// ── Auth ──────────────────────────────────────────────────────
function register(b) {
  const users = sheetToObjects(getSheet('Users'));
  if (users.find(u => u.email === b.email.toLowerCase()))
    return {success:false, error:'El email ya está registrado'};
  const id = genId('Users');
  const user = {
    id, lote:b.lote, nombre:b.nombre, apellido:b.apellido,
    email:b.email.toLowerCase(), password:hashPwd(b.password),
    created_at: new Date().toISOString()
  };
  appendRow('Users', user);
  return {success:true, user:{id, lote:b.lote, nombre:b.nombre, apellido:b.apellido, email:user.email, is_admin: user.email===ADMIN_EMAIL}};
}

function login(b) {
  const user = sheetToObjects(getSheet('Users'))
    .find(u => u.email === b.email.toLowerCase() && u.password === hashPwd(b.password));
  if (!user) return {success:false, error:'Email o contraseña incorrectos'};
  return {success:true, user:{
    id:user.id, lote:user.lote, nombre:user.nombre, apellido:user.apellido,
    email:user.email, is_admin: user.email===ADMIN_EMAIL
  }};
}

// ── Stickers ──────────────────────────────────────────────────
function getMyStickers(b) {
  return sheetToObjects(getSheet('Stickers'))
    .filter(s => String(s.user_id) === String(b.userId));
}

function updateSticker(b) {
  const sheet = getSheet('Stickers');
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const uIdx = headers.indexOf('user_id');
  const sIdx = headers.indexOf('sticker_id');
  
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][uIdx]) === String(b.userId) && data[i][sIdx] === b.stickerId) {
      if (!b.estado) {
        sheet.deleteRow(i + 1);
      } else {
        const eIdx = headers.indexOf('estado');
        const cIdx = headers.indexOf('cantidad');
        sheet.getRange(i+1, eIdx+1).setValue(b.estado);
        sheet.getRange(i+1, cIdx+1).setValue(b.cantidad || 1);
      }
      return {success:true};
    }
  }
  if (b.estado) {
    appendRow('Stickers', {user_id:b.userId, sticker_id:b.stickerId, estado:b.estado, cantidad:b.cantidad||1});
  }
  return {success:true};
}

// ── Users ─────────────────────────────────────────────────────
function getUsers(b) {
  const users = sheetToObjects(getSheet('Users'))
    .filter(u => String(u.id) !== String(b.userId));
  const stickers = sheetToObjects(getSheet('Stickers'));
  return users.map(u => ({
    id:u.id, lote:u.lote, nombre:u.nombre, apellido:u.apellido, email:u.email,
    stickers: stickers.filter(s => String(s.user_id) === String(u.id))
  }));
}

// ── Messages ──────────────────────────────────────────────────
function getMessages(b) {
  const msgs = sheetToObjects(getSheet('Messages')).filter(m => m.room === b.room);
  const users = sheetToObjects(getSheet('Users'));
  return msgs.slice(-100).map(m => {
    const u = users.find(u => String(u.id) === String(m.user_id)) || {};
    return {...m, nombre:u.nombre||'?', apellido:u.apellido||'', lote:u.lote||''};
  });
}

function sendMessage(b) {
  if (!b.content || !b.content.trim()) return {error:'Mensaje vacío'};
  appendRow('Messages', {
    id: genId('Messages'), user_id:b.userId, room:b.room||'general',
    content:b.content.trim(), created_at: new Date().toISOString()
  });
  return {success:true};
}

// ── Trades ────────────────────────────────────────────────────
function getTrades(b) {
  const trades = sheetToObjects(getSheet('Trades'))
    .filter(t => String(t.from_id)===String(b.userId) || String(t.to_id)===String(b.userId));
  const users = sheetToObjects(getSheet('Users'));
  return trades.map(t => {
    const fu = users.find(u => String(u.id)===String(t.from_id))||{};
    const tu = users.find(u => String(u.id)===String(t.to_id))||{};
    return {...t,
      from_nombre:fu.nombre, from_apellido:fu.apellido, from_lote:fu.lote,
      to_nombre:tu.nombre,   to_apellido:tu.apellido,   to_lote:tu.lote
    };
  });
}

function createTrade(b) {
  appendRow('Trades', {
    id: genId('Trades'),
    from_id:b.fromUserId, to_id:b.toUserId,
    from_stickers: JSON.stringify(b.fromStickers||[]),
    to_stickers:   JSON.stringify(b.toStickers||[]),
    status:'pending', message:b.message||'',
    created_at: new Date().toISOString()
  });
  return {success:true};
}

function updateTrade(b) {
  updateRow('Trades','id',b.tradeId,{status:b.status});
  return {success:true};
}

// ── Juntadas ──────────────────────────────────────────────────
function getJuntadas(b) {
  const juntadas = sheetToObjects(getSheet('Juntadas'));
  const rsvps    = sheetToObjects(getSheet('JuntadaRSVP'));
  const users    = sheetToObjects(getSheet('Users'));
  return juntadas.map(j => {
    const creator = users.find(u => String(u.id)===String(j.created_by))||{};
    const going   = rsvps.filter(r => String(r.juntada_id)===String(j.id) && r.status==='going').length;
    const myRsvp  = rsvps.find(r => String(r.juntada_id)===String(j.id) && String(r.user_id)===String(b.userId));
    return {...j,
      creator_nombre: creator.nombre, creator_apellido: creator.apellido,
      asistentes: going, my_rsvp: myRsvp ? myRsvp.status : null
    };
  });
}

function createJuntada(b) {
  const users = sheetToObjects(getSheet('Users'));
  const creator = users.find(u => String(u.id)===String(b.userId));
  if (!creator || creator.email !== ADMIN_EMAIL)
    return {error:'Sin permisos de admin'};
  appendRow('Juntadas', {
    id: genId('Juntadas'),
    titulo:b.titulo, descripcion:b.descripcion||'',
    fecha:b.fecha, lugar:b.lugar,
    created_by:b.userId, created_at: new Date().toISOString()
  });
  return {success:true};
}

function rsvpJuntada(b) {
  const sheet = getSheet('JuntadaRSVP');
  const data  = sheet.getDataRange().getValues();
  const headers = data[0];
  const jiIdx = headers.indexOf('juntada_id');
  const uiIdx = headers.indexOf('user_id');
  const stIdx = headers.indexOf('status');
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][jiIdx])===String(b.juntadaId) && String(data[i][uiIdx])===String(b.userId)) {
      sheet.getRange(i+1, stIdx+1).setValue(b.status);
      return {success:true};
    }
  }
  appendRow('JuntadaRSVP', {juntada_id:b.juntadaId, user_id:b.userId, status:b.status||'going'});
  return {success:true};
}
